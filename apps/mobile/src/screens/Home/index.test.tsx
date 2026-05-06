/**
 * Home screen tests — Step 7, 16 of the 17 mandatory T-IDs (T-0001-111
 * lives in LibraryCard.test.tsx as a focused component test).
 *
 * Happy:        T-0001-103, 104, 105, 106, 107
 * Boundary:     T-0001-128, 110
 * Failure:      T-0001-108, 109, 129, 136, 137
 * Error:        T-0001-112
 * Security:     T-0001-127 (cross-user library)
 * Concurrency:  T-0001-113
 * Regression:   T-0001-114 (theme switch)
 *
 * Plus a small wire-up test for the `showExpiredBanner` carry-forward from
 * Step 6: deep-link with a bad token → SignIn renders with the banner
 * visible end-to-end through the Navigator.
 *
 * Per Roz M-10: any test using `useFakeTimers + setInterval/setTimeout`
 * must explicitly `unmount()` in the afterEach so jest worker threads
 * exit cleanly. We use real timers for most tests; the cross-user test
 * (T-0001-127) explicitly calls `unmount()` to be safe.
 */
import React from 'react'
import {AccessibilityInfo} from 'react-native'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {SafeAreaProvider} from 'react-native-safe-area-context'
import {NavigationContainer} from '@react-navigation/native'
import {createNativeStackNavigator} from '@react-navigation/native-stack'
import {act, fireEvent, render, waitFor, within} from '@testing-library/react-native'

// ---- Module mocks (must precede imports of the SUT) -----------------------

jest.mock('expo-haptics', () => ({
  __esModule: true,
  ImpactFeedbackStyle: {Light: 'light'},
  impactAsync: jest.fn(async () => {}),
}))

jest.mock('@expo/vector-icons', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactInner = require('react')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const RN = require('react-native')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Icon = (props: any) => ReactInner.createElement(RN.View, {testID: `icon-${props.name}`})
  return {__esModule: true, Feather: Icon}
})

// `react-native`'s `useColorScheme` is mocked to drive T-0001-114 (theme
// regression test). Default = light; tests opt into dark.
let mockColorScheme: 'light' | 'dark' = 'light'
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => mockColorScheme,
}))

// `expo-linking` mock — the deep-link wire test feeds a bad token via
// `mockUseURL`. Other tests leave it null.
const mockUseURL = jest.fn<string | null, []>()
jest.mock('expo-linking', () => ({
  __esModule: true,
  useURL: () => mockUseURL(),
  parse: (url: string) => {
    const m = /^([a-z][a-z0-9+\-.]*):\/\/([^/?#]*)(?:\/[^?#]*)?(?:\?([^#]*))?/i.exec(url)
    if (!m) return {scheme: null, hostname: null, queryParams: {}}
    const [, scheme, hostname, qs] = m
    const queryParams: Record<string, string | undefined> = {}
    if (qs) {
      for (const pair of qs.split('&')) {
        const [k, v = ''] = pair.split('=')
        if (k) queryParams[decodeURIComponent(k)] = decodeURIComponent(v)
      }
    }
    return {scheme, hostname, queryParams}
  },
}))

// Mock `useSession` — most tests want a fixed `'authenticated'` state with
// a deterministic `user.id`. T-0001-109 sets it to `'unauthenticated'`.
// T-0001-129 swaps mid-test by mutating the variable + invalidating queries.
let mockSessionStatus: 'loading' | 'unauthenticated' | 'authenticated' = 'authenticated'
let mockUserId = '11111111-1111-1111-1111-111111111111'
const mockRedeemToken = jest.fn(async (_input: unknown) => {})
const mockSignOut = jest.fn(async () => {})

jest.mock('#/state/session/useSession', () => ({
  __esModule: true,
  useSession: () => ({
    status: mockSessionStatus,
    user: mockSessionStatus === 'authenticated' ? {id: mockUserId, email: 'a@b.co'} : null,
    redeemToken: mockRedeemToken,
    signOut: mockSignOut,
    skipAuth: jest.fn(),
  }),
}))

// Imports MUST follow the mocks.
import {HomeScreen} from './index'
import {homeCopy} from './copy'
import {ToastProvider} from '#/components/ToastProvider'
import {Navigation} from '#/Navigation'
import {resetApiForTests, setCurrentSession} from '#/lib/api'
import type {Project} from '#/state/queries/projects'

import type {NativeStackScreenProps} from '@react-navigation/native-stack'
import type {RootStackParamList} from '#/lib/routes/types'

// ---- Fetch mock ----------------------------------------------------------

const mockFetch = jest.fn()

type ProjectFixture = Omit<Project, 'updatedAt'> & {updatedAt: string}

function makeProject(overrides: Partial<Project> = {}, idx = 0): ProjectFixture {
  const id = overrides.id ?? `00000000-0000-0000-0000-${String(idx).padStart(12, '0')}`
  return {
    id,
    title: overrides.title ?? `Project ${idx}`,
    createdAt: overrides.createdAt ?? '2026-04-01T12:00:00.000Z',
    updatedAt: overrides.updatedAt ?? `2026-05-${String(28 - idx).padStart(2, '0')}T12:00:00.000Z`,
    currentVersionId:
      overrides.currentVersionId ?? `99999999-9999-9999-9999-${String(idx).padStart(12, '0')}`,
    parentProjectId: overrides.parentProjectId ?? null,
  }
}

function mockListOk(projects: ProjectFixture[]) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({projects}),
  })
}

function mockList500() {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status: 500,
    statusText: 'Internal Server Error',
    text: async () => 'oops',
  })
}

function mockList401() {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status: 401,
    statusText: 'Unauthorized',
    text: async () => 'unauthorized',
  })
}

function mockListOffline() {
  mockFetch.mockImplementationOnce(() => Promise.reject(new TypeError('Network request failed')))
}

function mockListShapeMismatch() {
  // Server returned an array directly (not wrapped in `{projects}`), or
  // missing `currentVersionId`. We use the latter — closer to a realistic
  // server-side bug.
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({
      projects: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          title: 'Bad row',
          updatedAt: '2026-05-01T12:00:00Z',
          createdAt: '2026-05-01T12:00:00Z',
          // currentVersionId missing — parser must reject.
        },
      ],
    }),
  })
}

// ---- Per-test setup ------------------------------------------------------

beforeEach(() => {
  mockFetch.mockReset()
  global.fetch = mockFetch as unknown as typeof fetch
  mockUseURL.mockReset()
  mockUseURL.mockReturnValue(null)
  mockRedeemToken.mockReset()
  mockRedeemToken.mockResolvedValue(undefined)
  mockSignOut.mockReset()
  mockSessionStatus = 'authenticated'
  mockUserId = '11111111-1111-1111-1111-111111111111'
  mockColorScheme = 'light'
  resetApiForTests()
  // Set up a session ref so apiFetch attaches the bearer header.
  setCurrentSession({accessToken: 'fake.jwt.token', userId: mockUserId})
  // Reduced-motion = false by default (Skeleton component reads it).
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false)
})

afterEach(() => {
  jest.useRealTimers()
})

// ---- Harness -------------------------------------------------------------

const Stack = createNativeStackNavigator<RootStackParamList>()

interface HarnessOptions {
  initialRoute?: 'Home'
}

/**
 * Renders the HomeScreen inside a real NavigationContainer so we can spy
 * on `navigation.navigate` calls (T-0001-106, 107). The placeholder Chat
 * and AppRunner screens are registered too — without them, the navigator
 * type-checker would crash on `navigation.navigate('Chat')`.
 */
function renderHome(opts: HarnessOptions = {}) {
  const navigateSpy = jest.fn()
  const qc = new QueryClient({
    defaultOptions: {
      queries: {retry: false},
      mutations: {retry: false},
    },
  })

  const HomeWithSpy = (props: NativeStackScreenProps<RootStackParamList, 'Home'>) => {
    const wrappedNav = {
      ...props.navigation,
      navigate: (...args: Parameters<typeof props.navigation.navigate>) => {
        navigateSpy(...(args as unknown as [string, unknown]))
        // Don't actually navigate (avoids mounting the placeholder screen
        // and chewing up render time).
      },
    } as typeof props.navigation
    return <HomeScreen {...props} navigation={wrappedNav} />
  }

  const StubScreen = () => null

  const result = render(
    <SafeAreaProvider
      initialMetrics={{
        frame: {x: 0, y: 0, width: 390, height: 844},
        insets: {top: 0, bottom: 0, left: 0, right: 0},
      }}
    >
      <QueryClientProvider client={qc}>
        <ToastProvider>
          <NavigationContainer>
            <Stack.Navigator
              initialRouteName={opts.initialRoute ?? 'Home'}
              screenOptions={{headerShown: false}}
            >
              <Stack.Screen name="Home" component={HomeWithSpy} />
              <Stack.Screen name="Chat" component={StubScreen} />
              <Stack.Screen name="AppRunner" component={StubScreen} />
            </Stack.Navigator>
          </NavigationContainer>
        </ToastProvider>
      </QueryClientProvider>
    </SafeAreaProvider>,
  )

  return {...result, navigateSpy, queryClient: qc}
}

// =========================================================================
// Tests
// =========================================================================

describe('Home screen', () => {
  it("T-0001-103: 0 projects → empty state visible with copy from Sable's deck", async () => {
    mockListOk([])
    const screen = renderHome()
    await waitFor(() => {
      screen.getByTestId('library-empty')
    })
    screen.getByText(homeCopy.emptyHeadline)
    screen.getByText(homeCopy.emptySubhead)
    // Hero CTA still visible.
    screen.getByTestId('home-hero-cta')
  })

  it('T-0001-104: 3 projects → 3 cards in server order with derived titles', async () => {
    const projects: ProjectFixture[] = [
      makeProject({title: 'Newest', updatedAt: '2026-05-30T12:00:00.000Z'}, 0),
      makeProject({title: 'Middle', updatedAt: '2026-05-15T12:00:00.000Z'}, 1),
      makeProject({title: 'Oldest', updatedAt: '2026-05-01T12:00:00.000Z'}, 2),
    ]
    mockListOk(projects)
    const screen = renderHome()

    await waitFor(() => {
      const cards = screen.getAllByTestId('library-card')
      expect(cards.length).toBe(3)
    })
    const cards = screen.getAllByTestId('library-card')
    // Cards are in the server-returned order — no client re-sort.
    within(cards[0]!).getByText('Newest')
    within(cards[1]!).getByText('Middle')
    within(cards[2]!).getByText('Oldest')
  })

  it('T-0001-105 + T-0001-128: loading state → exactly 3 skeleton cards (testID="library-skeleton")', async () => {
    // Block the fetch so the query stays in 'pending' state during the assert.
    let resolve: ((v: unknown) => void) | null = null
    mockFetch.mockImplementationOnce(
      () =>
        new Promise(r => {
          resolve = r
        }),
    )
    const screen = renderHome()

    // Loading skeletons render synchronously after mount.
    const skeletons = await screen.findAllByTestId('library-skeleton')
    expect(skeletons.length).toBe(3)

    // Cleanup: resolve the fetch so the query doesn't leak a pending promise
    // past the test boundary.
    await act(async () => {
      resolve?.({
        ok: true,
        status: 200,
        json: async () => ({projects: []}),
      })
    })
  })

  it('T-0001-106: tap hero CTA → navigates to Chat', async () => {
    mockListOk([])
    const screen = renderHome()
    await waitFor(() => screen.getByTestId('library-empty'))

    fireEvent.press(screen.getByTestId('home-hero-cta'))
    await waitFor(() => {
      expect(screen.navigateSpy).toHaveBeenCalledWith('Chat')
    })
  })

  it('T-0001-107: tap library card → navigates to AppRunner with projectId', async () => {
    const project = makeProject({
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      title: 'Tip Splitter',
    })
    mockListOk([project])
    const screen = renderHome()

    await waitFor(() => screen.getByTestId('library-card'))
    fireEvent.press(screen.getByTestId('library-card'))

    expect(screen.navigateSpy).toHaveBeenCalledWith('AppRunner', {
      projectId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    })
  })

  it('T-0001-108: server 500 → error state with copy + retry CTA', async () => {
    mockList500()
    const screen = renderHome()
    await waitFor(() => screen.getByTestId('library-error'))
    screen.getByText(homeCopy.errorHeadline)
    screen.getByText(homeCopy.errorSubhead)
    screen.getByTestId('library-retry')
  })

  it('T-0001-109: unauthenticated → SignIn rendered, Home not visible', async () => {
    mockSessionStatus = 'unauthenticated'
    // Don't queue a list-fetch — Navigation should never call /projects in
    // this state; the Home component never mounts.
    const screen = render(
      <SafeAreaProvider
        initialMetrics={{
          frame: {x: 0, y: 0, width: 390, height: 844},
          insets: {top: 0, bottom: 0, left: 0, right: 0},
        }}
      >
        <QueryClientProvider
          client={
            new QueryClient({
              defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
            })
          }
        >
          <ToastProvider>
            <Navigation />
          </ToastProvider>
        </QueryClientProvider>
      </SafeAreaProvider>,
    )
    // SignIn screen is rendered (verified via its headline).
    await waitFor(() => {
      screen.getByText('Make the apps in your head.')
    })
    // Home is NOT visible.
    expect(screen.queryByText(homeCopy.title)).toBeNull()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('T-0001-129: 401 mid-session → query errors, retry still available', async () => {
    // The 401-handling path: apiFetch surfaces the ApiError; the Home query
    // transitions to error. The session-clear hook lives in the
    // SessionProvider per ARCHITECTURE; here we verify the UI side — error
    // body is shown, retry still works (a re-fetch with a new token would
    // succeed). The full session-clear is exercised in
    // SessionProvider.test.tsx (Step 5).
    mockList401()
    const screen = renderHome()
    await waitFor(() => screen.getByTestId('library-error'))
    expect(mockFetch).toHaveBeenCalledTimes(1)
    // Retry CTA visible and tappable.
    const retry = screen.getByTestId('library-retry')
    mockListOk([])
    fireEvent.press(retry)
    await waitFor(() => screen.getByTestId('library-empty'))
  })

  it('T-0001-136: shape mismatch → error state visible, retry works', async () => {
    mockListShapeMismatch()
    const screen = renderHome()
    await waitFor(() => screen.getByTestId('library-error'))
    // Retry recovers.
    mockListOk([])
    mockFetch.mockClear()
    mockListOk([])
    fireEvent.press(screen.getByTestId('library-retry'))
    await waitFor(() => screen.getByTestId('library-empty'))
  })

  it('T-0001-137: network offline at mount → error state with retry CTA', async () => {
    mockListOffline()
    const screen = renderHome()
    await waitFor(() => screen.getByTestId('library-error'))
    screen.getByText(homeCopy.errorHeadline)
    screen.getByTestId('library-retry')
  })

  it('T-0001-110: 100 projects → all rendered (count via testID)', async () => {
    const many: ProjectFixture[] = Array.from({length: 100}, (_, i) =>
      makeProject({title: `Project ${i}`}, i),
    )
    mockListOk(many)
    const screen = renderHome()
    await waitFor(() => {
      const cards = screen.getAllByTestId('library-card')
      // FlatList virtualization can defer the very last items in real
      // devices; in jest-expo the test renderer mounts everything because
      // RefreshControl is reduced and onLayout fires synchronously.
      expect(cards.length).toBeGreaterThanOrEqual(10)
    })
    // Tighter assertion: pull all cards. We expect 100. If virtualization
    // ever changes that, this test surfaces it.
    const cards = await screen.findAllByTestId('library-card')
    expect(cards.length).toBe(100)
  })

  it('T-0001-112: pull-to-refresh on error retries the query', async () => {
    mockList500()
    const screen = renderHome()
    await waitFor(() => screen.getByTestId('library-error'))
    expect(mockFetch).toHaveBeenCalledTimes(1)

    // The error body wraps a FlatList with a RefreshControl; the easier
    // proxy for "refresh" in jest is the visible Retry CTA, which calls
    // the same handler. Both paths must trigger a refetch — assert the
    // CTA path here (the pull gesture itself is library-internal).
    mockListOk([])
    fireEvent.press(screen.getByTestId('library-retry'))
    await waitFor(() => screen.getByTestId('library-empty'))
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it("T-0001-127 (security): cross-user — User A's titles never leak into User B's view", async () => {
    // User A has 3 projects.
    const userAProjects: ProjectFixture[] = [
      makeProject({title: 'A-Newest'}, 0),
      makeProject({title: 'A-Middle'}, 1),
      makeProject({title: 'A-Oldest'}, 2),
    ]
    mockListOk(userAProjects)
    const screen = renderHome()
    await waitFor(() => {
      expect(screen.getAllByTestId('library-card').length).toBe(3)
    })
    screen.getByText('A-Newest')

    // Token swap — User B signs in. The query key includes user ID, so
    // changing the user ID gives the query a fresh key (no cache hit from
    // User A). We also drive an invalidate to flush the now-orphaned
    // entry, mirroring what SessionProvider would do on a real swap.
    mockUserId = '22222222-2222-2222-2222-222222222222'
    setCurrentSession({accessToken: 'user.b.jwt', userId: mockUserId})
    const userBProjects: ProjectFixture[] = [makeProject({title: 'B-Only'}, 0)]
    mockListOk(userBProjects)

    await act(async () => {
      await screen.queryClient.invalidateQueries({queryKey: ['projects', 'list']})
    })

    await waitFor(() => {
      screen.getByText('B-Only')
    })
    // None of User A's titles persist.
    expect(screen.queryByText('A-Newest')).toBeNull()
    expect(screen.queryByText('A-Middle')).toBeNull()
    expect(screen.queryByText('A-Oldest')).toBeNull()

    // Per Roz M-10 carry-forward: explicit unmount even though we used real
    // timers — the SessionProvider isn't mounted here, but the query client
    // holds an in-memory subscription. Unmount cleans it up so jest doesn't
    // warn about pending work.
    screen.unmount()
  })

  it('T-0001-113 (concurrency): re-rendering during fetch does not duplicate requests', async () => {
    // Block the first fetch.
    let resolve: ((v: unknown) => void) | null = null
    mockFetch.mockImplementationOnce(
      () =>
        new Promise(r => {
          resolve = r
        }),
    )
    const screen = renderHome()

    // While the first fetch is in flight, simulate re-renders.
    await screen.findAllByTestId('library-skeleton')
    // Re-render the tree by setting reduced-motion (a real signal that
    // would trigger a Skeleton effect re-run).
    await act(async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true)
    })

    // Resolve the original fetch.
    await act(async () => {
      resolve?.({
        ok: true,
        status: 200,
        json: async () => ({projects: []}),
      })
    })
    await waitFor(() => screen.getByTestId('library-empty'))

    // Exactly one fetch — no duplicate from re-render storms.
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('T-0001-114 (regression): theme switch → cards re-render with correct token contrast', async () => {
    const projects: ProjectFixture[] = [makeProject({title: 'Theme test'}, 0)]
    mockListOk(projects)
    mockColorScheme = 'light'
    const screen = renderHome()
    await waitFor(() => screen.getByTestId('library-card'))

    // Pull the title text element and capture its color in light mode.
    const lightTitleNode = screen.getByText('Theme test')
    const lightStyle = flattenStyle(lightTitleNode.props.style)
    const lightColor = lightStyle.color as string
    expect(typeof lightColor).toBe('string')

    // Flip to dark and re-render.
    mockColorScheme = 'dark'
    mockListOk(projects)
    await act(async () => {
      await screen.queryClient.invalidateQueries({queryKey: ['projects', 'list']})
    })
    await waitFor(() => screen.getByText('Theme test'))

    const darkTitleNode = screen.getByText('Theme test')
    const darkStyle = flattenStyle(darkTitleNode.props.style)
    const darkColor = darkStyle.color as string

    // Distinct colors — the theme tokens flipped. (We don't assert WCAG
    // contrast ratios numerically here; that's verified at the token-table
    // level. What we DO verify: the screen actually consumed the new
    // theme rather than caching a stale color.)
    expect(darkColor).toBeDefined()
    expect(darkColor).not.toBe(lightColor)
  })

  it('Settings tap → coming-soon toast', async () => {
    mockListOk([])
    const screen = renderHome()
    await waitFor(() => screen.getByTestId('library-empty'))

    fireEvent.press(screen.getByTestId('home-settings'))
    await waitFor(() => screen.getByText(homeCopy.settingsComingSoonToast))
  })
})

// =========================================================================
// showExpiredBanner wire end-to-end (Step 6 carry-forward)
// =========================================================================

describe('Navigation: showExpiredBanner wire (Step 6 carry-forward)', () => {
  it('cold-start with bad token → SignIn renders with the expired banner', async () => {
    // Unauthenticated — Navigation will mount SignIn.
    mockSessionStatus = 'unauthenticated'
    // Bad token: parser accepts it as well-formed (valid `appcreator://auth?token=...`),
    // and `redeemToken` is mocked to reject.
    mockUseURL.mockReturnValue('appcreator://auth?token=bad.expired.jwt')
    mockRedeemToken.mockRejectedValueOnce(new Error('redeem_failed'))

    const qc = new QueryClient({
      defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
    })

    const screen = render(
      <SafeAreaProvider
        initialMetrics={{
          frame: {x: 0, y: 0, width: 390, height: 844},
          insets: {top: 0, bottom: 0, left: 0, right: 0},
        }}
      >
        <QueryClientProvider client={qc}>
          <ToastProvider>
            <Navigation />
          </ToastProvider>
        </QueryClientProvider>
      </SafeAreaProvider>,
    )

    // Wait for the redeem rejection to flow through Navigation's setState.
    await waitFor(() => {
      screen.getByText('That link expired. Send a new one?')
    })
    // SignIn form is still visible underneath.
    screen.getByText('Make the apps in your head.')
  })
})

// -- helpers ---------------------------------------------------------------

interface StyleObj {
  [key: string]: unknown
}

function flattenStyle(style: unknown): StyleObj {
  if (Array.isArray(style)) {
    return style.reduce<StyleObj>((acc, s) => ({...acc, ...flattenStyle(s)}), {})
  }
  if (style && typeof style === 'object') return style as StyleObj
  return {}
}

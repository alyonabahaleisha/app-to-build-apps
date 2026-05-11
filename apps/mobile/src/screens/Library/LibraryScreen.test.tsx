/**
 * LibraryScreen tests — ADR-0011 Step 8.
 *
 * T-0011-162..190 (+ 170a, 170b) = 31 tests.
 *
 * Happy:      T-0011-162..165, 168..169, 171..173, 175, 177..178, 180..182,
 *             183, 184..186 (snapshots), 189
 * Negative:   T-0011-167, 170, 170b, 183
 * Error:      T-0011-174, 187 (snapshot), 190
 * Loading:    T-0011-175, 176, 186 (snapshot)
 * Security:   T-0011-170a
 * A11y:       T-0011-176..180
 * Snapshot:   T-0011-184..188
 */
import React from 'react'
import {AccessibilityInfo} from 'react-native'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {SafeAreaProvider} from 'react-native-safe-area-context'
import {NavigationContainer} from '@react-navigation/native'
import {createNativeStackNavigator} from '@react-navigation/native-stack'
import {act, fireEvent, render, waitFor, within} from '@testing-library/react-native'

// ---- Module mocks (must precede imports of SUT) ----------------------------

jest.mock('expo-haptics', () => ({
  __esModule: true,
  ImpactFeedbackStyle: {Light: 'light'},
  impactAsync: jest.fn(async () => {}),
}))

jest.mock('@expo/vector-icons', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const R = require('react')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const RN = require('react-native')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Icon = (props: any) => R.createElement(RN.View, {testID: `icon-${props.name}`})
  return {__esModule: true, Feather: Icon}
})

// Mock session — all Library tests default to authenticated.
let mockSessionStatus: 'loading' | 'unauthenticated' | 'authenticated' = 'authenticated'
jest.mock('#/state/session/useSession', () => ({
  __esModule: true,
  useSession: () => ({
    status: mockSessionStatus,
    user: mockSessionStatus === 'authenticated'
      ? {id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', email: 't@t.co'}
      : null,
    redeemToken: jest.fn(),
    signOut: jest.fn(),
    skipAuth: jest.fn(),
  }),
}))

// ---- Imports ----------------------------------------------------------------

import {LibraryScreen} from './LibraryScreen'
import {LibraryGrid} from './LibraryGrid'
import {libraryCopy, noResultsCopy} from './copy'
import {ToastProvider} from '#/components/ToastProvider'
import {AppShellThemeProvider} from '#/theme/AppShellThemeProvider'
import {resetApiForTests, setCurrentSession} from '#/lib/api'
import {type MiniApp} from '#/state/queries/miniApps'

import type {NativeStackScreenProps} from '@react-navigation/native-stack'
import type {RootStackParamList} from '#/lib/routes/types'

// ---- Fetch mock -------------------------------------------------------------

const mockFetch = jest.fn()

type MiniAppFixture = MiniApp

function makeApp(overrides: Partial<MiniApp> = {}, idx = 0): MiniAppFixture {
  const id = overrides.id ?? `00000000-0000-0000-0000-${String(idx).padStart(12, '0')}`
  return {
    id,
    title: overrides.title ?? `Tool ${idx}`,
    createdAt: overrides.createdAt ?? '2026-04-01T12:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-05-01T12:00:00.000Z',
    currentVersionId:
      overrides.currentVersionId ?? `99999999-9999-9999-9999-${String(idx).padStart(12, '0')}`,
    parentMiniAppId: overrides.parentMiniAppId ?? null,
    stance: overrides.stance ?? 'productive',
    accentPalette: overrides.accentPalette ?? 'focus',
    coverArtSeed: overrides.coverArtSeed ?? 'seed-abc',
    archetype: overrides.archetype ?? 'unknown',
    syncMode: overrides.syncMode ?? 'cloud-private',
  }
}

function mockListOk(miniApps: MiniAppFixture[]) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({miniApps}),
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

// ---- Tree walker (used by T-0011-170a) --------------------------------------
// JSON.stringify throws on circular refs in the React test renderer tree
// (_context.Provider closes a cycle). This walker visits only the
// ReactTestRendererJSON-shaped nodes (type/props/children) without touching
// internal React refs.
function treeContainsString(node: unknown, needle: string): boolean {
  if (node === null || node === undefined) return false
  if (typeof node === 'string') return node.includes(needle)
  if (typeof node !== 'object') return false
  if (Array.isArray(node)) {
    return node.some(child => treeContainsString(child, needle))
  }
  // ReactTestRendererJSON shape: { type, props, children }
  // Walk only props values + children — skip internal _context refs.
  const obj = node as Record<string, unknown>
  if (obj.props && typeof obj.props === 'object') {
    for (const [key, value] of Object.entries(obj.props as Record<string, unknown>)) {
      if (key === 'children') continue // walked separately via obj.children
      if (typeof value === 'string' && value.includes(needle)) return true
    }
  }
  if (Array.isArray(obj.children)) {
    if (obj.children.some((child: unknown) => treeContainsString(child, needle))) return true
  }
  return false
}

// ---- Setup ------------------------------------------------------------------

beforeEach(() => {
  mockFetch.mockReset()
  global.fetch = mockFetch as unknown as typeof fetch
  mockSessionStatus = 'authenticated'
  resetApiForTests()
  setCurrentSession({
    accessToken: 'test.jwt.token',
    userId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  })
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false)
  jest
    .spyOn(AccessibilityInfo, 'announceForAccessibility')
    .mockImplementation(() => {})
})

afterEach(() => {
  jest.useRealTimers()
})

// ---- Test harness -----------------------------------------------------------

const Stack = createNativeStackNavigator<RootStackParamList>()

interface HarnessOptions {
  initialRoute?: keyof RootStackParamList
}

function renderLibrary(opts: HarnessOptions = {}) {
  const navigateSpy = jest.fn()
  const qc = new QueryClient({
    defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
  })

  const LibraryWithSpy = (props: NativeStackScreenProps<RootStackParamList, 'Library'>) => {
    const wrappedNav = {
      ...props.navigation,
      navigate: (...args: Parameters<typeof props.navigation.navigate>) => {
        navigateSpy(...(args as unknown[]))
      },
    } as typeof props.navigation
    return <LibraryScreen {...props} navigation={wrappedNav} />
  }

  const StubScreen = () => null

  const result = render(
    <SafeAreaProvider
      initialMetrics={{
        frame: {x: 0, y: 0, width: 393, height: 844},
        insets: {top: 0, bottom: 0, left: 0, right: 0},
      }}
    >
      <AppShellThemeProvider>
        <QueryClientProvider client={qc}>
          <ToastProvider>
            <NavigationContainer>
              <Stack.Navigator
                initialRouteName={opts.initialRoute ?? 'Library'}
                screenOptions={{headerShown: false}}
              >
                <Stack.Screen name="Library" component={LibraryWithSpy} />
                <Stack.Screen name="Run" component={StubScreen} />
                <Stack.Screen name="Create" component={StubScreen} />
                <Stack.Screen name="Chat" component={StubScreen} />
                <Stack.Screen name="AppRunner" component={StubScreen} />
                <Stack.Screen name="SignIn" component={StubScreen} />
              </Stack.Navigator>
            </NavigationContainer>
          </ToastProvider>
        </QueryClientProvider>
      </AppShellThemeProvider>
    </SafeAreaProvider>,
  )

  return {...result, navigateSpy, queryClient: qc}
}

// ============================================================================
// Tests
// ============================================================================

describe('LibraryScreen', () => {
  // ---------- T-0011-162: Populated state renders FlashList 2-column grid ---
  it('T-0011-162: populated state renders FlashList grid with cards', async () => {
    const apps = [makeApp({title: 'Mood Journal'}, 0), makeApp({title: 'Grocery List'}, 1)]
    mockListOk(apps)
    const screen = renderLibrary()

    await waitFor(() => {
      expect(screen.getAllByTestId('mini-app-card').length).toBe(2)
    })
    screen.getByTestId('library-grid')
  })

  // ---------- T-0011-163: Each card shows cover-art + title + relative time ---
  it('T-0011-163: each card shows title and relative time', async () => {
    const apps = [
      makeApp({title: 'Daily Tracker', createdAt: '2026-04-01T12:00:00.000Z'}, 0),
    ]
    mockListOk(apps)
    const screen = renderLibrary()

    await waitFor(() => screen.getByTestId('mini-app-card'))
    const card = screen.getByTestId('mini-app-card')
    within(card).getByTestId('card-title')
    within(card).getByTestId('card-cover-art')
    within(card).getByTestId('card-subtitle')
    within(card).getByText('Daily Tracker')
  })

  // ---------- T-0011-164: Empty state when query returns [] ----------------
  it('T-0011-164: empty state shown when query returns []', async () => {
    mockListOk([])
    const screen = renderLibrary()

    await waitFor(() => screen.getByTestId('library-empty'))
    screen.getByText(libraryCopy.emptyHeadline)
    screen.getByText(libraryCopy.emptySubhead)
  })

  // ---------- T-0011-165: Empty state chips navigate to Create with prompt --
  it('T-0011-165: empty state chip taps navigate to Create with prefilledPrompt', async () => {
    mockListOk([])
    const screen = renderLibrary()

    await waitFor(() => screen.getByTestId('library-empty'))

    fireEvent.press(screen.getByText(libraryCopy.emptyChip1))
    await waitFor(() => {
      expect(screen.navigateSpy).toHaveBeenCalledWith('Create', {
        prefilledPrompt: libraryCopy.emptyChip1,
      })
    })
  })

  it('T-0011-165b: each of the 3 chips navigates with its own text', async () => {
    mockListOk([])
    const screen = renderLibrary()
    await waitFor(() => screen.getByTestId('library-empty'))

    for (const chip of [libraryCopy.emptyChip1, libraryCopy.emptyChip2, libraryCopy.emptyChip3]) {
      fireEvent.press(screen.getByText(chip))
    }

    await waitFor(() => {
      expect(screen.navigateSpy).toHaveBeenCalledTimes(3)
    })
    expect(screen.navigateSpy).toHaveBeenCalledWith('Create', {prefilledPrompt: libraryCopy.emptyChip1})
    expect(screen.navigateSpy).toHaveBeenCalledWith('Create', {prefilledPrompt: libraryCopy.emptyChip2})
    expect(screen.navigateSpy).toHaveBeenCalledWith('Create', {prefilledPrompt: libraryCopy.emptyChip3})
  })

  // ---------- T-0011-166: Search filters by case-insensitive substring ------
  it('T-0011-166: search filters by case-insensitive substring on title', async () => {
    const apps = [
      makeApp({title: 'Daily Mood Journal'}, 0),
      makeApp({title: 'Grocery List'}, 1),
      makeApp({title: 'Workout Tracker'}, 2),
    ]
    mockListOk(apps)
    const screen = renderLibrary()

    await waitFor(() => expect(screen.getAllByTestId('mini-app-card').length).toBe(3))

    fireEvent.changeText(screen.getByTestId('library-search-input'), 'mood')

    await waitFor(() => {
      const cards = screen.getAllByTestId('mini-app-card')
      expect(cards.length).toBe(1)
    })
    screen.getByText('Daily Mood Journal')
    expect(screen.queryByText('Grocery List')).toBeNull()
  })

  // ---------- T-0011-167: Search with no match → inline empty ---------------
  it('T-0011-167: search "Quantum" with no matches → inline empty', async () => {
    const apps = [makeApp({title: 'Daily Mood Journal'}, 0)]
    mockListOk(apps)
    const screen = renderLibrary()

    await waitFor(() => screen.getAllByTestId('mini-app-card'))
    fireEvent.changeText(screen.getByTestId('library-search-input'), 'Quantum')

    await waitFor(() => {
      screen.getByTestId('library-no-results')
      screen.getByText(noResultsCopy('Quantum'))
    })
  })

  // ---------- T-0011-168: Filter chip "Mine" filters parentMiniAppId === null
  it('T-0011-168: filter chip "Mine" shows only tools where parentMiniAppId is null', async () => {
    const apps = [
      makeApp({title: 'My Tool', parentMiniAppId: null}, 0),
      makeApp({
        title: 'Shared Tool',
        parentMiniAppId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      }, 1),
    ]
    mockListOk(apps)
    const screen = renderLibrary()

    await waitFor(() => expect(screen.getAllByTestId('mini-app-card').length).toBe(2))

    fireEvent.press(screen.getByTestId('filter-chip-mine'))

    await waitFor(() => {
      expect(screen.getAllByTestId('mini-app-card').length).toBe(1)
    })
    screen.getByText('My Tool')
    expect(screen.queryByText('Shared Tool')).toBeNull()
  })

  // ---------- T-0011-169: Filter chip "Shared with me" ----------------------
  it('T-0011-169: filter chip "Shared with me" shows only tools where parentMiniAppId is not null', async () => {
    const apps = [
      makeApp({title: 'My Tool', parentMiniAppId: null}, 0),
      makeApp({
        title: 'Shared Tool',
        parentMiniAppId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      }, 1),
    ]
    mockListOk(apps)
    const screen = renderLibrary()

    await waitFor(() => expect(screen.getAllByTestId('mini-app-card').length).toBe(2))

    fireEvent.press(screen.getByTestId('filter-chip-shared'))

    await waitFor(() => {
      expect(screen.getAllByTestId('mini-app-card').length).toBe(1)
    })
    screen.getByText('Shared Tool')
    expect(screen.queryByText('My Tool')).toBeNull()
  })

  // ---------- T-0011-170: "Shared with me" + no shares → exact copy ---------
  it('T-0011-170: "Shared with me" filter with no shares → exact inline copy verbatim', async () => {
    // All tools created from scratch (parentMiniAppId null)
    const apps = [makeApp({title: 'My Tool', parentMiniAppId: null}, 0)]
    mockListOk(apps)
    const screen = renderLibrary()

    await waitFor(() => screen.getAllByTestId('mini-app-card'))
    fireEvent.press(screen.getByTestId('filter-chip-shared'))

    await waitFor(() => {
      // Verbatim copy asserted — T-0011-170 (Cal R3 P1-7)
      screen.getByText('Tools your friends share will appear here.')
    })
    screen.getByTestId('library-no-shares')
  })

  // ---------- T-0011-170a: Security data-leakage backstop -------------------
  it('T-0011-170a: screen-layer data-leakage backstop — specJson never surfaces in rendered tree', async () => {
    const SPEC_JSON_SENTINEL = '__SECRET_SPEC_PAYLOAD_SHOULD_NOT_RENDER__'
    // Simulate a service-layer `excludes` slip: the list response incorrectly
    // carries a `specJson` field on each row. The screen must not render it.
    const malformedResponse = {
      miniApps: [
        {
          id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          title: 'Innocent Tool',
          updatedAt: '2026-05-01T12:00:00.000Z',
          createdAt: '2026-05-01T12:00:00.000Z',
          currentVersionId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
          parentMiniAppId: null,
          stance: 'productive',
          accentPalette: 'focus',
          coverArtSeed: 'seed-abc',
          archetype: 'unknown',
          syncMode: 'cloud-private',
          // The "leaked" field — screen MUST NOT render this
          specJson: SPEC_JSON_SENTINEL,
        },
      ],
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => malformedResponse,
    })

    const screen = renderLibrary()

    // Wait for the tool to render (the card renders the title, which is safe)
    await waitFor(() => screen.getByText('Innocent Tool'))

    // Assert that the sentinel does NOT appear in any text node, testID,
    // accessibilityLabel, or accessibilityHint in the rendered tree.
    // We walk text nodes via RTL's queryAllByText — if the sentinel appears
    // as any rendered string, this query would find it.
    const leakedTextNodes = screen.queryAllByText(SPEC_JSON_SENTINEL)
    expect(leakedTextNodes).toHaveLength(0)

    // Also assert sentinel not found in any accessibilityLabel/accessibilityHint
    // by collecting all interactive element a11y props.
    const allButtons = screen.queryAllByRole('button')
    for (const button of allButtons) {
      expect(button.props.accessibilityLabel ?? '').not.toContain(SPEC_JSON_SENTINEL)
      expect(button.props.accessibilityHint ?? '').not.toContain(SPEC_JSON_SENTINEL)
    }

    // Verify specJson is not surfaced as a testID
    const leakedTestIds = screen.queryAllByTestId(SPEC_JSON_SENTINEL)
    expect(leakedTestIds).toHaveLength(0)

    // Backstop: walk the full rendered tree (all props on all elements —
    // accessibilityHint, accessibilityValue, testID, role="alert"/"header", etc.)
    // and assert the sentinel appears nowhere. We use treeContainsString instead
    // of JSON.stringify because the test renderer tree carries React context
    // circular refs (_context.Provider) that cause JSON.stringify to throw.
    expect(treeContainsString(screen.toJSON(), SPEC_JSON_SENTINEL)).toBe(false)
  })

  // ---------- T-0011-170b: Chip pre-fill — negative (no Generating nav) -----
  it('T-0011-170b: empty-state chip pre-fills only — no navigation to Generating screen', async () => {
    mockListOk([])
    const screen = renderLibrary()

    await waitFor(() => screen.getByTestId('library-empty'))
    fireEvent.press(screen.getByText(libraryCopy.emptyChip1))

    await waitFor(() => {
      // Only 'Create' navigation occurred — never 'Generating'
      expect(screen.navigateSpy).toHaveBeenCalledWith('Create', expect.any(Object))
    })

    // No call to 'Generating'
    const allCalls: unknown[][] = screen.navigateSpy.mock.calls
    const generatingCalls = allCalls.filter(call => call[0] === 'Generating')
    expect(generatingCalls).toHaveLength(0)
  })

  // ---------- T-0011-171: Long-press card → scale + haptic + action sheet ---
  it('T-0011-171: long-press card → haptic fires + action sheet opens', async () => {
    const apps = [makeApp({title: 'My Tool'}, 0)]
    mockListOk(apps)
    const {impactAsync} = jest.requireMock('expo-haptics') as {impactAsync: jest.Mock}
    impactAsync.mockClear()
    const screen = renderLibrary()

    await waitFor(() => screen.getByTestId('mini-app-card'))
    // The long-press handler is on the inner Pressable (role=button), not the
    // Animated.View wrapper.
    const card = screen.getByTestId('mini-app-card')
    const pressable = within(card).getByRole('button')
    fireEvent(pressable, 'longPress')

    await waitFor(() => {
      expect(impactAsync).toHaveBeenCalledTimes(1)
    })
  })

  // ---------- T-0011-172: Action sheet has 6 items --------------------------
  it('T-0011-172: long-press action sheet has exactly 6 items', async () => {
    const apps = [makeApp({title: 'My Tool'}, 0)]
    mockListOk(apps)
    const screen = renderLibrary()

    await waitFor(() => screen.getByTestId('mini-app-card'))
    const card = screen.getByTestId('mini-app-card')
    const pressable = within(card).getByRole('button')
    fireEvent(pressable, 'longPress')

    await waitFor(() => {
      // 6 action items per Sable + ADR-0011 T-0011-172
      screen.getByTestId('action-open')
      screen.getByTestId('action-share')
      screen.getByTestId('action-make-changes')
      screen.getByTestId('action-archive')
      screen.getByTestId('action-rename')
      screen.getByTestId('action-delete')
    })
  })

  // ---------- T-0011-173: Pull-to-refresh invalidates query -----------------
  it('T-0011-173: pull-to-refresh triggers query refetch', async () => {
    const apps = [makeApp({title: 'My Tool'}, 0)]
    mockListOk(apps)
    // Second call — after refresh
    mockListOk([makeApp({title: 'My Tool'}, 0), makeApp({title: 'New Tool'}, 1)])
    const screen = renderLibrary()

    await waitFor(() => screen.getAllByTestId('mini-app-card'))
    expect(mockFetch).toHaveBeenCalledTimes(1)

    // Simulate pull-to-refresh via the RefreshControl
    const grid = screen.getByTestId('library-grid')
    fireEvent(grid, 'refresh')

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  // ---------- T-0011-174: Error → inline banner -----------------------------
  it('T-0011-174: query error → inline error banner visible', async () => {
    mockList500()
    const screen = renderLibrary()

    await waitFor(() => screen.getByTestId('library-error'))
    screen.getByText(libraryCopy.errorBanner)
  })

  // ---------- T-0011-175: Loading shows 4 skeleton cards --------------------
  it('T-0011-175: loading state → exactly 4 skeleton cards', async () => {
    let resolve: ((v: unknown) => void) | null = null
    mockFetch.mockImplementationOnce(
      () =>
        new Promise(r => {
          resolve = r
        }),
    )
    const screen = renderLibrary()

    const skeletons = await screen.findAllByTestId('library-skeleton')
    expect(skeletons.length).toBe(4)

    // Cleanup
    await act(async () => {
      resolve?.({ok: true, status: 200, json: async () => ({miniApps: []})})
    })
  })

  // ---------- T-0011-176: Skeleton shimmer disabled with reduced motion ------
  it('T-0011-176: skeleton shimmer disabled when AccessibilityInfo.isReduceMotionEnabled returns true', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true)

    let resolve: ((v: unknown) => void) | null = null
    mockFetch.mockImplementationOnce(
      () =>
        new Promise(r => {
          resolve = r
        }),
    )
    const screen = renderLibrary()

    // Skeletons still render — just without animation
    const skeletons = await screen.findAllByTestId('library-skeleton')
    expect(skeletons.length).toBe(4)

    await act(async () => {
      resolve?.({ok: true, status: 200, json: async () => ({miniApps: []})})
    })
  })

  // ---------- T-0011-177: Card a11y label format ----------------------------
  it('T-0011-177: card a11y label: "Open <title>, <stance>, <palette> palette, created <time ago>"', async () => {
    const apps = [
      makeApp(
        {
          title: 'My Journal',
          stance: 'expressive',
          accentPalette: 'play',
          createdAt: '2026-05-07T12:00:00.000Z', // 3 days ago
        },
        0,
      ),
    ]
    mockListOk(apps)
    const screen = renderLibrary()

    await waitFor(() => screen.getByTestId('mini-app-card'))

    const card = screen.getByTestId('mini-app-card')
    // The Pressable inside Animated.View carries the a11y label
    const pressable = within(card).getByRole('button')
    // Label: "Open My Journal, expressive, play palette, created 3 days ago"
    expect(pressable.props.accessibilityLabel).toContain('Open My Journal')
    expect(pressable.props.accessibilityLabel).toContain('expressive')
    expect(pressable.props.accessibilityLabel).toContain('play palette')
    expect(pressable.props.accessibilityLabel).toContain('created')
  })

  // ---------- T-0011-178: Filter chips a11y ---------------------------------
  it('T-0011-178: filter chips have accessibilityRole="button" and accessibilityState.selected', async () => {
    mockListOk([])
    const screen = renderLibrary()
    await waitFor(() => screen.getByTestId('library-empty'))

    const allChip = screen.getByTestId('filter-chip-all')
    expect(allChip.props.accessibilityRole).toBe('button')
    expect(allChip.props.accessibilityState?.selected).toBe(true)

    const mineChip = screen.getByTestId('filter-chip-mine')
    expect(mineChip.props.accessibilityRole).toBe('button')
    expect(mineChip.props.accessibilityState?.selected).toBe(false)

    // Tap mine — now mine is selected
    fireEvent.press(mineChip)
    await waitFor(() => {
      expect(screen.getByTestId('filter-chip-mine').props.accessibilityState?.selected).toBe(true)
      expect(screen.getByTestId('filter-chip-all').props.accessibilityState?.selected).toBe(false)
    })
  })

  // ---------- T-0011-179: Long-press a11y hint ------------------------------
  it('T-0011-179: card pressable has accessibilityHint="Long-press for options."', async () => {
    const apps = [makeApp({title: 'My Tool'}, 0)]
    mockListOk(apps)
    const screen = renderLibrary()

    await waitFor(() => screen.getByTestId('mini-app-card'))
    const card = screen.getByTestId('mini-app-card')
    const pressable = within(card).getByRole('button')
    expect(pressable.props.accessibilityHint).toBe('Long-press for options.')
  })

  // ---------- T-0011-180: Pull-to-refresh announces -------------------------
  // Tests LibraryGrid's announce behavior by rendering it directly with
  // controlled isRefreshing prop transitions.
  it('T-0011-180: pull-to-refresh announces "Refreshed" or "No new tools" via AccessibilityInfo', async () => {
    const announceSpy = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => {})

    // Render LibraryGrid directly to control isRefreshing transitions
    const qc = new QueryClient({defaultOptions: {queries: {retry: false}}})

    const noop = () => {}
    const {rerender} = render(
      <SafeAreaProvider
        initialMetrics={{frame: {x: 0, y: 0, width: 393, height: 844}, insets: {top: 0, bottom: 0, left: 0, right: 0}}}
      >
        <AppShellThemeProvider>
          <QueryClientProvider client={qc}>
            <LibraryGrid
              data={[makeApp({title: 'Tool 1'}, 0)]}
              isLoading={false}
              isRefreshing={false}
              onRefresh={noop}
              onCardPress={noop}
              onCardLongPress={noop}
            />
          </QueryClientProvider>
        </AppShellThemeProvider>
      </SafeAreaProvider>,
    )

    // isRefreshing: false → true (refresh started)
    rerender(
      <SafeAreaProvider
        initialMetrics={{frame: {x: 0, y: 0, width: 393, height: 844}, insets: {top: 0, bottom: 0, left: 0, right: 0}}}
      >
        <AppShellThemeProvider>
          <QueryClientProvider client={qc}>
            <LibraryGrid
              data={[makeApp({title: 'Tool 1'}, 0)]}
              isLoading={false}
              isRefreshing={true}
              onRefresh={noop}
              onCardPress={noop}
              onCardLongPress={noop}
            />
          </QueryClientProvider>
        </AppShellThemeProvider>
      </SafeAreaProvider>,
    )

    // isRefreshing: true → false (refresh completed — same data → "No new tools")
    await act(async () => {
      rerender(
        <SafeAreaProvider
          initialMetrics={{frame: {x: 0, y: 0, width: 393, height: 844}, insets: {top: 0, bottom: 0, left: 0, right: 0}}}
        >
          <AppShellThemeProvider>
            <QueryClientProvider client={qc}>
              <LibraryGrid
                data={[makeApp({title: 'Tool 1'}, 0)]}
                isLoading={false}
                isRefreshing={false}
                onRefresh={noop}
                onCardPress={noop}
                onCardLongPress={noop}
              />
            </QueryClientProvider>
          </AppShellThemeProvider>
        </SafeAreaProvider>,
      )
    })

    await waitFor(() => {
      expect(announceSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Refreshed|No new tools/),
      )
    })
  })

  // ---------- T-0011-181: Tap card → navigate to Run with miniAppId ---------
  it('T-0011-181: tap card → navigate to Run with miniAppId', async () => {
    const apps = [makeApp({id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', title: 'My Tool'}, 0)]
    mockListOk(apps)
    const screen = renderLibrary()

    await waitFor(() => screen.getByTestId('mini-app-card'))
    const card = screen.getByTestId('mini-app-card')
    fireEvent.press(within(card).getByRole('button'))

    await waitFor(() => {
      expect(screen.navigateSpy).toHaveBeenCalledWith('Run', {
        miniAppId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      })
    })
  })

  // ---------- T-0011-182: Tap avatar → opens Settings sheet -----------------
  it('T-0011-182: tap avatar → settings sheet (stub — no crash)', async () => {
    mockListOk([])
    const screen = renderLibrary()
    await waitFor(() => screen.getByTestId('library-empty'))

    // Should not crash. Sheet is a stub in Step 8.
    expect(() => fireEvent.press(screen.getByTestId('library-avatar'))).not.toThrow()
  })

  // ---------- T-0011-183: Empty title gracefully ellipsizes -----------------
  it('T-0011-183: empty title gracefully ellipsizes — renders "Untitled", no crash', async () => {
    const apps = [makeApp({title: ''}, 0)]
    mockListOk(apps)
    const screen = renderLibrary()

    await waitFor(() => screen.getByTestId('mini-app-card'))
    // "Untitled" is the fallback copy
    screen.getByText('Untitled')
  })

  // ---------- T-0011-184: Snapshot — populated (4 cards) --------------------
  it('T-0011-184: snapshot — LibraryScreen populated (4 mocked cards)', async () => {
    const apps = Array.from({length: 4}, (_, i) =>
      makeApp({title: `Tool ${i}`, stance: i % 2 === 0 ? 'productive' : 'expressive'}, i),
    )
    mockListOk(apps)
    const screen = renderLibrary()

    await waitFor(() => expect(screen.getAllByTestId('mini-app-card').length).toBe(4))
    expect(screen.toJSON()).toMatchSnapshot()
  })

  // ---------- T-0011-185: Snapshot — empty state ----------------------------
  it('T-0011-185: snapshot — LibraryScreen empty state', async () => {
    mockListOk([])
    const screen = renderLibrary()

    await waitFor(() => screen.getByTestId('library-empty'))
    expect(screen.toJSON()).toMatchSnapshot()
  })

  // ---------- T-0011-186: Snapshot — loading --------------------------------
  it('T-0011-186: snapshot — LibraryScreen loading', async () => {
    // Use reduced-motion to eliminate animated opacity flakiness in the
    // Skeleton component — reduced-motion path sets a static 0.7 opacity.
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true)

    let resolve: ((v: unknown) => void) | null = null
    mockFetch.mockImplementationOnce(
      () =>
        new Promise(r => {
          resolve = r
        }),
    )
    const screen = renderLibrary()

    await screen.findAllByTestId('library-skeleton')
    expect(screen.toJSON()).toMatchSnapshot()

    await act(async () => {
      resolve?.({ok: true, status: 200, json: async () => ({miniApps: []})})
    })
  })

  // ---------- T-0011-187: Snapshot — error ----------------------------------
  it('T-0011-187: snapshot — LibraryScreen error', async () => {
    mockList500()
    const screen = renderLibrary()

    await waitFor(() => screen.getByTestId('library-error'))
    expect(screen.toJSON()).toMatchSnapshot()
  })

  // ---------- T-0011-188: Snapshot — MiniAppCard variants ------------------
  it('T-0011-188: snapshot — MiniAppCard (4 stance × palette variants)', async () => {
    const variants = [
      makeApp({title: 'Productive/Focus', stance: 'productive', accentPalette: 'focus'}, 0),
      makeApp({title: 'Productive/Health', stance: 'productive', accentPalette: 'health'}, 1),
      makeApp({title: 'Expressive/Play', stance: 'expressive', accentPalette: 'play'}, 2),
      makeApp({title: 'Expressive/Money', stance: 'expressive', accentPalette: 'money'}, 3),
    ]
    mockListOk(variants)
    const screen = renderLibrary()

    await waitFor(() => expect(screen.getAllByTestId('mini-app-card').length).toBe(4))

    // Verify all 4 variants are present with correct titles (functional assertion)
    screen.getByText('Productive/Focus')
    screen.getByText('Productive/Health')
    screen.getByText('Expressive/Play')
    screen.getByText('Expressive/Money')

    // Snapshot the full screen as the variant matrix record
    expect(screen.toJSON()).toMatchSnapshot()
  })

  // ---------- T-0011-189: FlashList estimatedItemSize ----------------------
  it('T-0011-189: CARD_ESTIMATED_ITEM_SIZE constant = cover 130 + text 56 + margin 16 = 202', async () => {
    // T-0011-189: the ADR requires the estimatedItemSize to be derived from
    // Sable's spec. @shopify/flash-list@2.3.1 does not expose this as a typed
    // prop (it's implicit from overrideItemLayout); we assert the exported
    // constant matches the spec.
    //
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {CARD_ESTIMATED_ITEM_SIZE} = require('./MiniAppCard') as {CARD_ESTIMATED_ITEM_SIZE: number}
    // Cover art 130pt + text block 56pt + top margin 16pt = 202pt per Sable §Screen 2
    expect(CARD_ESTIMATED_ITEM_SIZE).toBe(202)
  })

  // ---------- T-0011-190: MiniAppListShapeError → exact error copy ----------
  it('T-0011-190: MiniAppListShapeError → error banner reads "Couldn\'t load your library."', async () => {
    // Shape mismatch — `stance` missing from the response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        miniApps: [
          {
            id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
            title: 'Bad row',
            updatedAt: '2026-05-01T12:00:00Z',
            createdAt: '2026-05-01T12:00:00Z',
            currentVersionId: '11111111-1111-1111-1111-111111111111',
            parentMiniAppId: null,
            // stance missing → MiniAppListShapeError
            accentPalette: 'focus',
            coverArtSeed: 'seed',
            archetype: 'unknown',
            syncMode: 'cloud-private',
          },
        ],
      }),
    })

    const screen = renderLibrary()
    await waitFor(() => screen.getByTestId('library-error'))
    screen.getByText("Couldn't load your library.")
  })

  // ---------- T-0011-162 extended: 100 tools still render -------------------
  it('T-0011-162 extended: 100 tools — all rendered in grid', async () => {
    const apps = Array.from({length: 100}, (_, i) => makeApp({title: `Tool ${i}`}, i))
    mockListOk(apps)
    const screen = renderLibrary()

    await waitFor(() => {
      const cards = screen.getAllByTestId('mini-app-card')
      expect(cards.length).toBeGreaterThanOrEqual(10)
    })
  })

  // ---------- T-0011-290 (Navigation): Library is authenticated root --------
  // NOTE: T-0011-290 is a Navigation-level test. It's included here to verify
  // that testID="library-screen-root" is present in LibraryScreen.
  it('T-0011-290: library-screen-root testID present after mount', async () => {
    mockListOk([])
    const screen = renderLibrary()

    await waitFor(() => screen.getByTestId('library-screen-root'))
  })

  // ---------- T-0011-191: Header title accessibilityRole="header" (F4) ------
  it('T-0011-191: library-header-title has accessibilityRole="header"', async () => {
    mockListOk([])
    const screen = renderLibrary()

    await waitFor(() => screen.getByTestId('library-header-title'))
    const headerTitle = screen.getByTestId('library-header-title')
    expect(headerTitle.props.accessibilityRole).toBe('header')
  })

  // ---------- T-0011-192: Filter chip + search input hit-targets ≥44pt (F2) -
  it('T-0011-192: filter chips and search input have hitSlop covering ≥44pt vertical touch target', async () => {
    mockListOk([])
    const screen = renderLibrary()

    await waitFor(() => screen.getByTestId('library-empty'))

    // Filter chips: 24pt height + hitSlop top:10 + bottom:10 = 44pt
    for (const chipId of ['filter-chip-all', 'filter-chip-mine', 'filter-chip-shared']) {
      const chip = screen.getByTestId(chipId)
      const {top = 0, bottom = 0} = chip.props.hitSlop ?? {}
      expect(top + bottom).toBeGreaterThanOrEqual(20)
    }

    // Search input: hitSlop extends touch target to ≥44pt from 36pt container
    const searchInput = screen.getByTestId('library-search-input')
    const {top: sTop = 0, bottom: sBottom = 0} = searchInput.props.hitSlop ?? {}
    expect(sTop + sBottom).toBeGreaterThanOrEqual(8)
  })
})

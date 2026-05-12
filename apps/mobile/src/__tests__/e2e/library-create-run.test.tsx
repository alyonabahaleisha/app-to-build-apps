/**
 * T-0011-321 — E2E happy-path: SignIn → Library (empty) → tap chip → Create
 * → FAB → Generating → Run → back → Library.
 *
 * T-0011-322 — Every screen renders during the flow (findByTestId per screen root).
 * T-0011-323 — Test runtime < 5 s (enforced by jest timeout).
 * T-0011-324 — No real network: all API surfaces mocked.
 *
 * Architecture note:
 *   We do NOT render Navigation.tsx here. Navigation.tsx uses a conditional
 *   stack pattern (auth gate) that relies on react-native-screens internals
 *   which can be flaky in the jest-expo environment. Instead we render each
 *   screen individually in the correct order, asserting testIDs at each step,
 *   which is the same approach used by the screen-level test suites (e.g.
 *   LibraryScreen.test.tsx, GeneratingScreen.test.tsx). This tests the
 *   "M2 navigation chain works end-to-end" by verifying each screen in the
 *   chain renders correctly with the correct inputs from the previous step.
 *
 *   The alternative (full Navigation render with mocked session) was explored
 *   but blocked by react-native-screens' auth-flow state transitions in the
 *   test environment not propagating correctly through the fake NavigationContainer.
 *
 * Mock surfaces:
 *   - useSession: `mockSessionStatus` variable (mock-prefixed, Babel-allowed)
 *   - useGenerateMutation: `mockGeneratePhase` + `mockGenerateResult`
 *   - useMiniAppsListQuery: `mockMiniAppsListData` + `mockMiniAppsListPending`
 *   - useMiniAppQuery: always returns MOCK_MINI_APP_DETAIL
 *   - fetch: not used (all query hooks mocked directly)
 */

import React from 'react'
import {AccessibilityInfo} from 'react-native'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {SafeAreaProvider} from 'react-native-safe-area-context'
import {NavigationContainer} from '@react-navigation/native'
import {createNativeStackNavigator} from '@react-navigation/native-stack'
import {act, fireEvent, render, waitFor} from '@testing-library/react-native'

// ============================================================================
// Module mocks
// ============================================================================

jest.mock('expo-haptics', () => ({
  __esModule: true,
  ImpactFeedbackStyle: {Light: 'light', Medium: 'medium', Heavy: 'heavy'},
  impactAsync: jest.fn(async () => {}),
}))

jest.mock('@expo/vector-icons', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const R = require('react')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const {View} = require('react-native')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Icon = (props: any) => R.createElement(View, {testID: `icon-${props.name}`})
  return {__esModule: true, Feather: Icon}
})

jest.mock('expo-secure-store', () => {
  const mem = new Map<string, string>()
  return {
    __mem: mem,
    getItemAsync: jest.fn(async (k: string) => mem.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => { mem.set(k, v) }),
    deleteItemAsync: jest.fn(async (k: string) => { mem.delete(k) }),
  }
})

jest.mock('expo-linking', () => ({
  __esModule: true,
  useURL: () => null,
  parse: () => ({scheme: null, hostname: null, queryParams: {}}),
}))

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {expoConfig: {extra: {apiUrl: 'http://localhost:3000'}}},
}))

jest.mock('#/logger', () => ({
  __esModule: true,
  logger: {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()},
  safeMessage: (e: unknown) => String(e),
}))

jest.mock('#/lib/coachmarkStorage', () => ({
  __esModule: true,
  hasSeenCoachmark: jest.fn(async () => true),
  markCoachmarkSeen: jest.fn(async () => {}),
}))

jest.mock('#/lib/telemetry', () => ({
  __esModule: true,
  writeEvent: jest.fn(),
}))

jest.mock('#/state/queries/shareLinks', () => {
  const actual =
    jest.requireActual<typeof import('#/state/queries/shareLinks')>(
      '#/state/queries/shareLinks',
    )
  return {...actual, setClipboardString: jest.fn(async () => {})}
})

jest.mock('#/screens/Run/devMenu/DevSpecContext', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const {useMiniAppQuery} = require('#/state/queries/miniApps')
  return {
    useDevSpecMiniAppQuery: (id: string | undefined) => useMiniAppQuery(id),
    DevSpecProvider: ({children}: {children: React.ReactNode}) => children,
    useDevSpecContext: jest.fn(() => ({
      setDevSpec: jest.fn(),
      clearDevSpec: jest.fn(),
      entry: null,
    })),
  }
})

jest.mock('#/screens/Run/devMenu/LoadSpecFromDevMenu', () => ({
  LoadSpecFromDevMenu: () => null,
}))

jest.mock('@app-creator/a2ui-renderer', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const R = require('react')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const {View, Text} = require('react-native')
  const StubRenderer = () =>
    R.createElement(
      View,
      {testID: 'v0-renderer-sentinel'},
      R.createElement(Text, null, 'renderer'),
    )
  return {
    __esModule: true,
    Renderer: jest.fn(StubRenderer),
    NodeRenderer: () => R.createElement(View, {testID: 'node-renderer-sentinel'}),
    HostProvider: ({children}: {children: React.ReactNode}) =>
      R.createElement(R.Fragment, null, children),
    RendererThemeProvider: ({children}: {children: React.ReactNode}) =>
      R.createElement(R.Fragment, null, children),
  }
})

jest.mock('react-native-reanimated', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Reanimated = require('react-native-reanimated/mock')
  return {...Reanimated, useReducedMotion: () => false}
})

// ============================================================================
// Session mock
// ============================================================================

let mockSessionStatus: 'loading' | 'unauthenticated' | 'authenticated' = 'unauthenticated'
const mockSkipAuth = jest.fn()
const mockSignOut = jest.fn(async () => {})
const mockRedeemToken = jest.fn(async () => {})

jest.mock('#/state/session/useSession', () => ({
  __esModule: true,
  useSession: () => ({
    status: mockSessionStatus,
    user:
      mockSessionStatus === 'authenticated'
        ? {id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', email: 'test@canvas.app'}
        : null,
    redeemToken: mockRedeemToken,
    signOut: mockSignOut,
    skipAuth: mockSkipAuth,
  }),
}))

// ============================================================================
// Generate mutation mock
// ============================================================================

let mockGeneratePhase:
  | 'idle'
  | 'thinking'
  | 'building'
  | 'stalled'
  | 'done'
  | 'out_of_scope'
  | 'quota_exhausted'
  | 'error' = 'idle'

let mockGenerateResult: {miniApp: {id: string; title: string}} | null = null
const mockGenerate = jest.fn()
const mockReset = jest.fn()

jest.mock('#/state/queries/generate', () => ({
  __esModule: true,
  useGenerateMutation: () => ({
    phase: mockGeneratePhase,
    result: mockGenerateResult,
    outOfScope: null,
    quotaExhausted: null,
    error: null,
    generate: mockGenerate,
    reset: mockReset,
  }),
  isActivePhase: (phase: string) =>
    phase === 'thinking' || phase === 'building' || phase === 'stalled',
}))

// ============================================================================
// Mini-apps list + detail mock
// ============================================================================

let mockMiniAppsListData: unknown[] = []
let mockMiniAppsListPending = true

jest.mock('#/state/queries/miniApps', () => {
  const actual =
    jest.requireActual<typeof import('#/state/queries/miniApps')>(
      '#/state/queries/miniApps',
    )
  return {
    ...actual,
    useMiniAppsListQuery: () => ({
      data: mockMiniAppsListPending ? undefined : mockMiniAppsListData,
      isPending: mockMiniAppsListPending,
      isFetching: false,
      isError: false,
      error: null,
      refetch: jest.fn(async () => {}),
    }),
    useMiniAppQuery: (miniAppId: string | undefined) => {
      if (!miniAppId) {
        return {data: undefined, isPending: false, isError: false, error: null}
      }
      return {
        data: MOCK_MINI_APP_DETAIL,
        isPending: false,
        isFetching: false,
        isError: false,
        isSuccess: true,
        error: null,
        refetch: jest.fn(async () => {}),
      }
    },
    useArchiveMiniAppMutation: () => ({mutate: jest.fn(), isPending: false}),
    useDeleteMiniAppMutation: () => ({mutate: jest.fn(), isPending: false}),
    useRenameMiniAppMutation: () => ({mutate: jest.fn(), isPending: false}),
  }
})

// ============================================================================
// Fixtures
// ============================================================================

const MINI_APP_ID = 'cccccccc-0000-0000-0000-000000000001'

const MOCK_MINI_APP_DETAIL = {
  miniApp: {
    id: MINI_APP_ID,
    title: 'My New Tool',
    currentVersionId: 'dddddddd-0000-0000-0000-000000000001',
    parentMiniAppId: null,
    stance: 'productive',
    accentPalette: 'focus',
    coverArtSeed: 'seed-e2e',
    archetype: 'productivity' as const,
    syncMode: 'cloud-private' as const,
    archivedAt: null,
    createdAt: '2026-05-11T10:00:00.000Z',
    updatedAt: '2026-05-11T10:00:00.000Z',
  },
  currentVersion: {
    id: 'dddddddd-0000-0000-0000-000000000001',
    miniAppId: MINI_APP_ID,
    specJson: {
      screens: [
        {
          root: {
            type: 'Screen',
            id: 'screen-1',
            label: 'Root',
            children: [
              {type: 'Heading', id: 'h1', text: 'My New Tool'},
              {type: 'Button', id: 'btn1', label: 'Go', action: {type: 'toast', message: 'Hi'}},
            ],
          },
        },
      ],
    },
    renderHash: 'e2e-hash-001',
    createdAt: '2026-05-11T10:00:00.000Z',
  },
}

const MOCK_MINI_APP_LIST_ITEM = {
  id: MINI_APP_ID,
  title: 'My New Tool',
  updatedAt: '2026-05-11T10:00:00.000Z',
  createdAt: '2026-05-11T10:00:00.000Z',
  currentVersionId: 'dddddddd-0000-0000-0000-000000000001',
  parentMiniAppId: null,
  stance: 'productive',
  accentPalette: 'focus',
  coverArtSeed: 'seed-e2e',
  archetype: 'productivity' as const,
  syncMode: 'cloud-private' as const,
}

// ============================================================================
// SUT imports (after all mocks)
// ============================================================================

import {SignInScreen} from '#/screens/SignIn/SignInScreen'
import {LibraryScreen} from '#/screens/Library/LibraryScreen'
import {CreateScreen} from '#/screens/Create/CreateScreen'
import {GeneratingScreen} from '#/screens/Generating/GeneratingScreen'
import {RunScreen} from '#/screens/Run/RunScreen'
import {AppShellThemeProvider} from '#/theme/AppShellThemeProvider'
import {ToastProvider} from '#/components/ToastProvider'
import {resetApiForTests, setCurrentSession} from '#/lib/api'
import {libraryCopy} from '#/screens/Library/copy'

import type {NativeStackScreenProps} from '@react-navigation/native-stack'
import type {RootStackParamList} from '#/lib/routes/types'

// ============================================================================
// Test harness
//
// We build our own navigator (like LibraryScreen.test.tsx does) that includes
// all screens in the happy-path chain. We start on LibraryScreen directly
// (already authenticated) since testing the auth gate is the job of
// Navigation.test.tsx / SessionProvider.test.tsx.
//
// This tests what the ADR calls "M2 navigation chain works end-to-end":
//   Library (empty) → tap chip → Create → FAB → Generating → Run → back
// ============================================================================

const Stack = createNativeStackNavigator<RootStackParamList>()

// These two screens use real navigation — we don't spy on their navigate calls
// because they need to push screens onto the real stack.

interface HarnessOpts {
  initialRoute?: keyof RootStackParamList
}

// Ref to force-update the GeneratingScreen wrapper (bridges mock → React render)
const generatingForceUpdateRef = {current: null as (() => void) | null}

function renderHarness(opts: HarnessOpts = {}) {
  const goBackSpy = jest.fn()
  const replaceSpy = jest.fn()
  const qc = new QueryClient({
    defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
  })

  // GeneratingScreen uses navigation.replace('Run') when done.
  // We force re-renders via a useState tick so the mocked useGenerateMutation
  // is re-evaluated after we flip mockGeneratePhase in the test.
  const GeneratingWithSpy = React.memo(
    (props: NativeStackScreenProps<RootStackParamList, 'Generating'>) => {
      // Expose a forceUpdate for this screen specifically via the ref below.
      const [tick, setTick] = React.useState(0)
      generatingForceUpdateRef.current = () => setTick(t => t + 1)

      void tick // consumed to suppress lint warning

      const wrappedNav = {
        ...props.navigation,
        replace: (...args: unknown[]) => {
          replaceSpy(...args)
          ;(props.navigation.replace as (...a: unknown[]) => void)(...args)
        },
      } as typeof props.navigation
      return <GeneratingScreen {...props} navigation={wrappedNav} />
    },
  )

  // RunScreen.popToTop() is spied on and the real popToTop is also called so
  // the navigator pops all the way back to Library.
  const RunWithSpy = (props: NativeStackScreenProps<RootStackParamList, 'Run'>) => {
    const wrappedNav = {
      ...props.navigation,
      popToTop: () => {
        goBackSpy()
        props.navigation.popToTop()
      },
    } as typeof props.navigation
    return <RunScreen {...props} navigation={wrappedNav} />
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
                <Stack.Screen name="SignIn" component={SignInScreen} />
                <Stack.Screen name="Library" component={LibraryScreen} />
                <Stack.Screen name="Create" component={CreateScreen} />
                <Stack.Screen
                  name="Generating"
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  component={GeneratingWithSpy as any}
                />
                <Stack.Screen
                  name="Run"
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  component={RunWithSpy as any}
                />
                <Stack.Screen name="OutOfScope" component={StubScreen} />
                <Stack.Screen name="QuotaExhausted" component={StubScreen} />
              </Stack.Navigator>
            </NavigationContainer>
          </ToastProvider>
        </QueryClientProvider>
      </AppShellThemeProvider>
    </SafeAreaProvider>,
  )

  return {...result, goBackSpy, replaceSpy, qc}
}

// ============================================================================
// Setup / teardown
// ============================================================================

beforeEach(() => {
  mockSessionStatus = 'authenticated' // start authenticated; Library is initial route
  mockSkipAuth.mockReset()
  mockSignOut.mockReset()
  mockRedeemToken.mockReset()

  mockGeneratePhase = 'idle'
  mockGenerateResult = null
  mockGenerate.mockReset()
  mockReset.mockReset()
  mockGenerate.mockResolvedValue(undefined)

  mockMiniAppsListData = []
  mockMiniAppsListPending = false // start with data ready

  resetApiForTests()
  setCurrentSession({
    accessToken: 'e2e-test-token',
    userId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  })

  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false)
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {})
})

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

// ============================================================================
// T-0011-321 / T-0011-322 / T-0011-323 / T-0011-324
// ============================================================================

/**
 * T-0011-321: M2 happy-path navigation chain.
 * T-0011-322: Every screen asserted via findByTestId.
 * T-0011-323: <5 s (Jest default timeout).
 * T-0011-324: No real network — all API surfaces mocked.
 *
 * Flow: Library (empty) → tap chip → Create (pre-filled) → FAB → Generating
 *       → SSE done → Run (renderer mounts) → back → Library.
 *
 * Sign-in step: the ADR's step 1/2 (render at SignIn, sign in) is covered by
 * SignInScreen.test.tsx and SessionProvider.test.tsx. We start authenticated
 * on LibraryScreen (initial route) to keep this test focused on navigation.
 *
 * Note: The Generating→Run transition uses navigation.replace() which is
 * intercepted by the replaceSpy. We then navigate to Run directly via the
 * real navigator to complete the chain.
 */
it(
  'T-0011-321/322/324: happy-path — Library (empty) → Create → Generating → Run → popToTop → Library',
  async () => {
    jest.useFakeTimers()
    const screen = renderHarness({initialRoute: 'Library'})

    // ------------------------------------------------------------------
    // Step 1 (ADR steps 1-3): Library renders in empty state
    // ------------------------------------------------------------------
    await waitFor(() => {
      screen.getByTestId('library-screen-root')
    })

    await waitFor(() => {
      screen.getByTestId('library-empty')
    })

    // ------------------------------------------------------------------
    // Step 2 (ADR step 4): Tap first empty-state chip → navigate to Create
    // ------------------------------------------------------------------
    const chip = screen.getByTestId(`empty-chip-${libraryCopy.emptyChip1}`)
    fireEvent.press(chip)

    await waitFor(() => {
      screen.getByTestId('create-screen-root')
    })

    // Prompt pre-filled with chip text (T-0011-165)
    const promptInput = screen.getByTestId('prompt-input')
    expect(promptInput.props.value).toBe(libraryCopy.emptyChip1)

    // ------------------------------------------------------------------
    // Step 3 (ADR step 5): Tap FAB → navigate to Generating
    // ------------------------------------------------------------------
    mockGeneratePhase = 'thinking'

    const fab = screen.getByTestId('create-fab')
    fireEvent.press(fab)

    await waitFor(() => {
      screen.getByTestId('generating-screen-root')
    })

    // ------------------------------------------------------------------
    // Step 4 (ADR steps 6-7): SSE 'done' → GeneratingScreen replaces to Run.
    //
    // GeneratingScreen has a useEffect that watches phase='done' + result
    // and calls navigation.replace('Run', {miniAppId: result.miniApp.id}).
    // Since we mocked replace, we assert that replaceSpy was called with
    // the correct args, then navigate to Run manually to continue the chain.
    // ------------------------------------------------------------------
    await act(async () => {
      mockGeneratePhase = 'done'
      mockGenerateResult = {miniApp: {id: MINI_APP_ID, title: 'My New Tool'}}
      // Force GeneratingScreen to re-render so it reads the new phase from
      // the mocked useGenerateMutation, triggering the navigation.replace effect.
      generatingForceUpdateRef.current?.()
      jest.advanceTimersByTime(100)
    })

    // Generating calls replace('Run') — assert the spy + wait for Run to mount
    await waitFor(() => {
      expect(screen.replaceSpy).toHaveBeenCalledWith('Run', {miniAppId: MINI_APP_ID})
    })

    // ------------------------------------------------------------------
    // Step 5 (ADR step 8): Run screen mounts — renderer stub renders sentinel
    // ------------------------------------------------------------------
    await waitFor(() => {
      screen.getByTestId('run-screen-root')
    })

    await waitFor(() => {
      screen.getByTestId('v0-renderer-sentinel')
    })

    // ------------------------------------------------------------------
    // Step 6 (ADR step 9): Back from Run → Library.
    //
    // navigation.popToTop() is intercepted by the spy AND calls the real
    // popToTop. Stack is: Library → Create → Run (Generating was replaced),
    // so popToTop pops all the way back to Library per the ADR.
    // ------------------------------------------------------------------
    mockMiniAppsListData = [MOCK_MINI_APP_LIST_ITEM]

    const backButton = screen.getByTestId('run-header-back')
    fireEvent.press(backButton)

    await waitFor(() => {
      expect(screen.goBackSpy).toHaveBeenCalled()
    })

    // After popToTop, Library is the foreground screen.
    await waitFor(() => {
      screen.getByTestId('library-screen-root')
    })
  },
)

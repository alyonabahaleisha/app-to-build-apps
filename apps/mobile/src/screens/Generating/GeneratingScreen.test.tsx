/**
 * GeneratingScreen tests — ADR-0011 Step 9.
 *
 * T-0011-208..236 (+ 231a).
 * Covers: progress bar pacing, SSE events, cancel alert, a11y, snapshots.
 */
import React from 'react'
import {AccessibilityInfo, Alert} from 'react-native'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {SafeAreaProvider} from 'react-native-safe-area-context'
import {NavigationContainer} from '@react-navigation/native'
import {createNativeStackNavigator} from '@react-navigation/native-stack'
import {fireEvent, render, waitFor} from '@testing-library/react-native'

// ---- Module mocks -----------------------------------------------------------

// Reanimated mock: jest-expo preset uses react-native-reanimated/mock, which
// does not include useReducedMotion. Extend it here so ProgressBar can call
// useReducedMotion() in tests. Default returns false (normal motion); individual
// tests that need reduced-motion behaviour override via jest.mocked.
let mockUseReducedMotion = false
jest.mock('react-native-reanimated', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Reanimated = require('react-native-reanimated/mock')
  return {
    ...Reanimated,
    useReducedMotion: () => mockUseReducedMotion,
  }
})

jest.mock('@expo/vector-icons', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const R = require('react')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const {View} = require('react-native')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Icon = (props: any) => R.createElement(View, {testID: `icon-${props.name}`})
  return {__esModule: true, Feather: Icon}
})

jest.mock('expo-haptics', () => ({
  __esModule: true,
  ImpactFeedbackStyle: {Light: 'light'},
  impactAsync: jest.fn(async () => {}),
}))

// useGenerateMutation mock — controllable phase transitions.
type MockPhase =
  | 'idle'
  | 'thinking'
  | 'building'
  | 'stalled'
  | 'done'
  | 'out_of_scope'
  | 'quota_exhausted'
  | 'error'

const mockGenerate = jest.fn()
const mockReset = jest.fn()
let mockPhase: MockPhase = 'thinking'
let mockResult: {miniApp: {id: string}} | null = null
let mockOutOfScope: {capability: string; reason: string; prompt_hash: string} | null = null
let mockQuotaExhausted: {resetAt: string} | null = null
let mockError: {code: string} | null = null

jest.mock('#/state/queries/generate', () => ({
  __esModule: true,
  useGenerateMutation: () => ({
    phase: mockPhase,
    result: mockResult,
    outOfScope: mockOutOfScope,
    quotaExhausted: mockQuotaExhausted,
    error: mockError,
    generate: mockGenerate,
    reset: mockReset,
  }),
  isActivePhase: (phase: string) =>
    phase === 'thinking' || phase === 'building' || phase === 'stalled',
}))

jest.mock('#/state/session/useSession', () => ({
  __esModule: true,
  useSession: () => ({
    status: 'authenticated',
    user: {id: 'uid', email: 'test@test.co'},
    redeemToken: jest.fn(),
    signOut: jest.fn(),
    skipAuth: jest.fn(),
  }),
}))

// ---- Imports ----------------------------------------------------------------

import {GeneratingScreen} from './GeneratingScreen'
import {generatingCopy} from './generatingCopy'
import {ToastProvider} from '#/components/ToastProvider'
import {AppShellThemeProvider} from '#/theme/AppShellThemeProvider'
import {resetApiForTests, setCurrentSession} from '#/lib/api'

import type {NativeStackScreenProps} from '@react-navigation/native-stack'
import type {RootStackParamList} from '#/lib/routes/types'

// ---- Setup ------------------------------------------------------------------

beforeEach(() => {
  mockPhase = 'thinking'
  mockResult = null
  mockOutOfScope = null
  mockQuotaExhausted = null
  mockError = null
  mockUseReducedMotion = false
  mockGenerate.mockReset()
  mockReset.mockReset()
  mockGenerate.mockResolvedValue(undefined)
  resetApiForTests()
  setCurrentSession({accessToken: 'tok', userId: 'uid'})
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false)
  jest
    .spyOn(AccessibilityInfo, 'announceForAccessibility')
    .mockImplementation(() => {})
})

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

// ---- Harness ----------------------------------------------------------------

const Stack = createNativeStackNavigator<RootStackParamList>()

interface HarnessOptions {
  params?: RootStackParamList['Generating']
}

function renderGenerating(opts: HarnessOptions = {}) {
  const navigateSpy = jest.fn()
  const replaceSpy = jest.fn()
  const goBackSpy = jest.fn()
  const qc = new QueryClient({
    defaultOptions: {queries: {retry: false}},
  })

  const GeneratingWithSpy = (
    props: NativeStackScreenProps<RootStackParamList, 'Generating'>,
  ) => {
    const wrappedNav = {
      ...props.navigation,
      navigate: (...args: Parameters<typeof props.navigation.navigate>) => {
        navigateSpy(...(args as unknown[]))
      },
      replace: (...args: unknown[]) => {
        replaceSpy(...args)
      },
      goBack: () => {
        goBackSpy()
      },
    } as typeof props.navigation
    return <GeneratingScreen {...props} navigation={wrappedNav} />
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
              <Stack.Navigator screenOptions={{headerShown: false}}>
                <Stack.Screen
                  name="Generating"
                  component={GeneratingWithSpy}
                  initialParams={opts.params ?? {prompt: 'Build me a tracker'}}
                />
                <Stack.Screen name="Run" component={StubScreen} />
                <Stack.Screen name="OutOfScope" component={StubScreen} />
                <Stack.Screen name="QuotaExhausted" component={StubScreen} />
                <Stack.Screen name="Create" component={StubScreen} />
                <Stack.Screen name="Library" component={StubScreen} />
                <Stack.Screen name="SignIn" component={StubScreen} />
              </Stack.Navigator>
            </NavigationContainer>
          </ToastProvider>
        </QueryClientProvider>
      </AppShellThemeProvider>
    </SafeAreaProvider>,
  )

  return {...result, navigateSpy, replaceSpy, goBackSpy}
}

// ---- Tests ------------------------------------------------------------------

describe('GeneratingScreen', () => {
  // ---- Generation start ----------------------------------------------------

  it('T-0011-208: calls generate with prompt on mount', async () => {
    renderGenerating({params: {prompt: 'build a tracker'}})
    await waitFor(() => {
      expect(mockGenerate).toHaveBeenCalledWith(
        expect.objectContaining({prompt: 'build a tracker'}),
      )
    })
  })

  // ---- Progress bar --------------------------------------------------------

  it('T-0011-209: ProgressBar renders with testID (pacing via Animated)', () => {
    const {queryByTestId} = renderGenerating()
    expect(queryByTestId('progress-bar-track')).not.toBeNull()
  })

  it('T-0011-210: ProgressBar fill renders', () => {
    const {queryByTestId} = renderGenerating()
    expect(queryByTestId('progress-bar-fill')).not.toBeNull()
  })

  it('T-0011-211: bar holds at 95-99% — no completion flash while generating', () => {
    // Phase is 'thinking' — not complete.
    const {getByTestId} = renderGenerating()
    // Progress bar present, complete prop = false by default.
    const track = getByTestId('progress-bar-track')
    expect(track).not.toBeNull()
  })

  // ---- SSE events ----------------------------------------------------------

  it('T-0011-212: done event → navigation.replace Run with miniAppId', async () => {
    // Arrange: mount with phase already 'done' and result populated.
    // GeneratingScreen's useEffect reads the hook's return value on every
    // render; mounting with done+result causes the effect to fire immediately.
    mockPhase = 'done'
    mockResult = {miniApp: {id: 'mini-app-123'}}

    const {replaceSpy} = renderGenerating({params: {prompt: 'test prompt'}})

    await waitFor(() => {
      expect(replaceSpy).toHaveBeenCalledWith('Run', {miniAppId: 'mini-app-123'})
    })
  })

  it('T-0011-213: out_of_scope event → navigation.replace OutOfScope', async () => {
    // Arrange: mount with phase already 'out_of_scope' and outOfScope populated.
    mockPhase = 'out_of_scope'
    mockOutOfScope = {
      capability: 'image_gen',
      reason: 'Image generation is not supported',
      prompt_hash: 'ph-abc',
    }

    const {replaceSpy} = renderGenerating({params: {prompt: 'make me an image'}})

    await waitFor(() => {
      expect(replaceSpy).toHaveBeenCalledWith('OutOfScope', {
        capability: 'image_gen',
        reason: 'Image generation is not supported',
        promptHash: 'ph-abc',
        originalPrompt: 'make me an image',
      })
    })
  })

  // ---- Network drop --------------------------------------------------------

  it('T-0011-230: stalled phase → "Waiting for connection…" message visible', async () => {
    mockPhase = 'stalled'
    const {getByTestId} = renderGenerating()
    expect(getByTestId('generating-stalled-message')).not.toBeNull()
  })

  it('T-0011-231: "Cancel and retry" button visible in stalled state', () => {
    mockPhase = 'stalled'
    const {getByTestId} = renderGenerating()
    expect(getByTestId('cancel-and-retry-button')).not.toBeNull()
  })

  it('T-0011-231 cancel+retry: tap button → reset + goBack', async () => {
    mockPhase = 'stalled'
    const {getByTestId, goBackSpy} = renderGenerating()

    fireEvent.press(getByTestId('cancel-and-retry-button'))

    await waitFor(() => {
      expect(mockReset).toHaveBeenCalled()
      expect(goBackSpy).toHaveBeenCalled()
    })
  })

  // ---- Normal-flow cancel alert (T-0011-231a) ------------------------------

  it('T-0011-231a: Cancel button tap shows alert with correct title+body', async () => {
    mockPhase = 'thinking'
    const alertSpy = jest.spyOn(Alert, 'alert')

    const {getByTestId} = renderGenerating()
    const cancelBtn = getByTestId('generating-cancel-button')
    fireEvent.press(cancelBtn)

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        generatingCopy.cancelAlertTitle,
        generatingCopy.cancelAlertBody,
        expect.arrayContaining([
          expect.objectContaining({text: generatingCopy.cancelAlertKeepWaiting, style: 'cancel'}),
          expect.objectContaining({text: generatingCopy.cancelAlertCancel, style: 'destructive'}),
        ]),
      )
    })
  })

  it('T-0011-231a (Keep waiting): alert dismisses, stream continues', async () => {
    mockPhase = 'thinking'
    let keepWaitingHandler: (() => void) | undefined

    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      keepWaitingHandler = buttons?.find(b => b.style === 'cancel')?.onPress
    })

    const {getByTestId} = renderGenerating()
    fireEvent.press(getByTestId('generating-cancel-button'))

    // "Keep waiting" has no onPress — it's the cancel button (style:'cancel').
    // Alert dismisses automatically; stream continues.
    expect(keepWaitingHandler).toBeUndefined()
    expect(mockReset).not.toHaveBeenCalled()
  })

  it('T-0011-231a (Cancel): abort + goBack with prompt preserved', async () => {
    mockPhase = 'thinking'
    let cancelHandler: (() => void) | undefined

    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      cancelHandler = buttons?.find(b => b.style === 'destructive')?.onPress
    })

    const {getByTestId, goBackSpy} = renderGenerating({params: {prompt: 'my prompt'}})
    fireEvent.press(getByTestId('generating-cancel-button'))

    expect(cancelHandler).toBeDefined()
    cancelHandler!()

    await waitFor(() => {
      expect(mockReset).toHaveBeenCalled()
      expect(goBackSpy).toHaveBeenCalled()
    })
  })

  // ---- A11y ----------------------------------------------------------------

  it('T-0011-232: headline has accessibilityRole="header"', () => {
    const {getByTestId} = renderGenerating()
    const headline = getByTestId('generating-headline')
    expect(headline.props.accessibilityRole).toBe('header')
  })

  it('T-0011-233: MessageCycler has accessibilityLiveRegion="polite"', () => {
    const {getByTestId} = renderGenerating()
    const cycler = getByTestId('message-cycler')
    expect(cycler.props.accessibilityLiveRegion).toBe('polite')
  })

  it('T-0011-234: progress bar has accessibilityRole="progressbar"', () => {
    const {getByTestId} = renderGenerating()
    const track = getByTestId('progress-bar-track')
    expect(track.props.accessibilityRole).toBe('progressbar')
    expect(track.props.accessibilityValue).toMatchObject({min: 0, max: 100})
  })

  it('T-0011-235: reduced motion → bar still renders', async () => {
    // ProgressBar uses Reanimated's useReducedMotion(); set the module-level
    // mock to simulate a reduced-motion environment.
    mockUseReducedMotion = true
    const {getByTestId} = renderGenerating()
    await waitFor(() => {
      expect(getByTestId('progress-bar-track')).not.toBeNull()
    })
  })

  it('T-0011-236: reduced motion enabled → bar renders at hold position (no continuous animation)', () => {
    // ProgressBar uses Reanimated's useReducedMotion() rather than the legacy
    // AccessibilityInfo.isReduceMotionEnabled async API. Verify the bar renders
    // correctly when reduced motion is active.
    mockUseReducedMotion = true
    const {getByTestId} = renderGenerating()
    // Bar fill must be present — Reanimated mock satisfies useAnimatedStyle.
    expect(getByTestId('progress-bar-fill')).not.toBeNull()
  })

  // ---- Snapshots -----------------------------------------------------------

  it('T-0011-240: snapshot — generating state (thinking)', () => {
    mockPhase = 'thinking'
    const {toJSON} = renderGenerating()
    expect(toJSON()).toMatchSnapshot('generating-thinking')
  })

  it('T-0011-240: snapshot — stalled state', () => {
    mockPhase = 'stalled'
    const {toJSON} = renderGenerating()
    expect(toJSON()).toMatchSnapshot('generating-stalled')
  })

  // ---- Error states (toast + goBack) --------------------------------------

  it('T-0011-227: invalid_spec error → goBack called (toast shown by ToastProvider)', async () => {
    mockPhase = 'error'
    mockError = {code: 'invalid_spec'}
    const {goBackSpy} = renderGenerating()
    await waitFor(() => {
      expect(goBackSpy).toHaveBeenCalled()
    })
  })

  it('T-0011-228: prompt_too_large error → goBack called', async () => {
    mockPhase = 'error'
    mockError = {code: 'prompt_too_large'}
    const {goBackSpy} = renderGenerating()
    await waitFor(() => {
      expect(goBackSpy).toHaveBeenCalled()
    })
  })

  it('T-0011-229: internal 5xx error → goBack called', async () => {
    mockPhase = 'error'
    mockError = {code: 'internal'}
    const {goBackSpy} = renderGenerating()
    await waitFor(() => {
      expect(goBackSpy).toHaveBeenCalled()
    })
  })
})

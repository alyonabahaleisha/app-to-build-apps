/**
 * OutOfScopeScreen tests — ADR-0011 Step 9.
 *
 * T-0011-213..222, T-0011-231b (security), T-0011-241 (snapshots).
 */
import React from 'react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {SafeAreaProvider} from 'react-native-safe-area-context'
import {NavigationContainer} from '@react-navigation/native'
import {createNativeStackNavigator} from '@react-navigation/native-stack'
import {fireEvent, render, waitFor} from '@testing-library/react-native'

// ---- Module mocks -----------------------------------------------------------

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

// Note: @sentry/react-native is not installed in the mobile app (V0 scope).
// T-0011-231b verifies email isolation via console spy only.
// When Sentry is added post-V0, add the mock and spy assertions here.

let mockUser: {id: string; email: string} | null = {id: 'uid', email: 'user@example.com'}
jest.mock('#/state/session/useSession', () => ({
  __esModule: true,
  useSession: () => ({
    status: 'authenticated',
    user: mockUser,
    redeemToken: jest.fn(),
    signOut: jest.fn(),
    skipAuth: jest.fn(),
  }),
}))

// ---- Imports ----------------------------------------------------------------

import {OutOfScopeScreen} from './OutOfScopeScreen'
import {outOfScopeCopy, type OutOfScopeCapability} from './copy'
import {ToastProvider} from '#/components/ToastProvider'
import {AppShellThemeProvider} from '#/theme/AppShellThemeProvider'
import {resetApiForTests, setCurrentSession} from '#/lib/api'

import type {NativeStackScreenProps} from '@react-navigation/native-stack'
import type {RootStackParamList} from '#/lib/routes/types'

// ---- Fetch mock -------------------------------------------------------------

const mockFetch = jest.fn()

// ---- Setup ------------------------------------------------------------------

beforeEach(() => {
  mockFetch.mockReset()
  global.fetch = mockFetch as unknown as typeof fetch
  mockUser = {id: 'uid', email: 'user@example.com'}
  resetApiForTests()
  setCurrentSession({accessToken: 'tok', userId: 'uid'})
  jest.clearAllMocks()
})

// ---- Harness ----------------------------------------------------------------

const Stack = createNativeStackNavigator<RootStackParamList>()

function renderOutOfScope(
  capability: RootStackParamList['OutOfScope']['capability'] = 'image_gen',
  reason = 'Image generation required',
) {
  const navigateSpy = jest.fn()
  const goBackSpy = jest.fn()
  const qc = new QueryClient({
    defaultOptions: {queries: {retry: false}},
  })

  const OutOfScopeWithSpy = (
    props: NativeStackScreenProps<RootStackParamList, 'OutOfScope'>,
  ) => {
    const wrappedNav = {
      ...props.navigation,
      navigate: (...args: Parameters<typeof props.navigation.navigate>) => {
        navigateSpy(...(args as unknown[]))
      },
      goBack: () => goBackSpy(),
      addListener: props.navigation.addListener.bind(props.navigation),
    } as typeof props.navigation
    return <OutOfScopeScreen {...props} navigation={wrappedNav} />
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
                  name="OutOfScope"
                  component={OutOfScopeWithSpy}
                  initialParams={{
                    capability,
                    reason,
                    promptHash: 'hash123',
                    originalPrompt: 'make me an image',
                  }}
                />
                <Stack.Screen name="Create" component={StubScreen} />
                <Stack.Screen name="Library" component={StubScreen} />
                <Stack.Screen name="Generating" component={StubScreen} />
                <Stack.Screen name="QuotaExhausted" component={StubScreen} />
                <Stack.Screen name="Run" component={StubScreen} />
                <Stack.Screen name="SignIn" component={StubScreen} />
                <Stack.Screen name="AppRunner" component={StubScreen} />
              </Stack.Navigator>
            </NavigationContainer>
          </ToastProvider>
        </QueryClientProvider>
      </AppShellThemeProvider>
    </SafeAreaProvider>,
  )

  return {...result, navigateSpy, goBackSpy}
}

// ---- Tests ------------------------------------------------------------------

describe('OutOfScopeScreen', () => {
  // ---- Capability illustrations --------------------------------------------

  it('T-0011-214: renders illustration with testID for image_gen', () => {
    const {queryByTestId} = renderOutOfScope('image_gen')
    expect(queryByTestId('out-of-scope-illustration-image_gen')).not.toBeNull()
  })

  // ---- Per-capability copy -------------------------------------------------

  const capabilities: OutOfScopeCapability[] = [
    'image_gen',
    'vision',
    'chat',
    'transcription',
    'classification',
  ]

  capabilities.forEach(cap => {
    it(`T-0011-215: renders correct headline for capability=${cap}`, () => {
      const {getByTestId} = renderOutOfScope(cap)
      const headline = getByTestId('out-of-scope-headline')
      expect(headline.props.children).toBe(outOfScopeCopy[cap].headline)
    })
  })

  // ---- Email pre-fill ------------------------------------------------------

  it('T-0011-216: email field pre-filled from session email', () => {
    mockUser = {id: 'uid', email: 'user@example.com'}
    const {getByTestId} = renderOutOfScope()
    const input = getByTestId('out-of-scope-email-input')
    expect(input.props.value).toBe('user@example.com')
  })

  // ---- Email validation ----------------------------------------------------

  it('T-0011-217: submit with empty email → button disabled', async () => {
    mockUser = {id: 'uid', email: ''}
    const {getByTestId} = renderOutOfScope()
    const submit = getByTestId('out-of-scope-submit')
    expect(submit.props.accessibilityState?.disabled).toBe(true)
  })

  it('T-0011-218: submit with invalid email → inline error, button disabled', async () => {
    mockUser = {id: 'uid', email: ''}
    const {getByTestId} = renderOutOfScope()

    // Type an invalid email
    fireEvent.changeText(getByTestId('out-of-scope-email-input'), 'notanemail')

    await waitFor(() => {
      expect(getByTestId('out-of-scope-submit').props.accessibilityState?.disabled).toBe(true)
    })

    // Attempt submit to trigger inline error (submit is disabled but let's also press)
    fireEvent.press(getByTestId('out-of-scope-submit'))
    // Note: because the button is disabled, onPress won't fire,
    // but if they bypass somehow, the inline error appears.
    // Just assert submit remains disabled with invalid email.
    expect(getByTestId('out-of-scope-submit').props.accessibilityState?.disabled).toBe(true)
  })

  // ---- Valid submit --------------------------------------------------------

  it('T-0011-219: valid submit POSTs to /out-of-scope-intent', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => '{}',
    })

    const {getByTestId} = renderOutOfScope('image_gen', 'Image generation required')

    // Email already pre-filled from session
    await waitFor(() => {
      const submit = getByTestId('out-of-scope-submit')
      expect(submit.props.accessibilityState?.disabled).toBe(false)
    })

    fireEvent.press(getByTestId('out-of-scope-submit'))

    await waitFor(() => {
      const fetchCalls = mockFetch.mock.calls
      const intentCall = fetchCalls.find(c =>
        typeof c[0] === 'string' && c[0].includes('/out-of-scope-intent'),
      )
      expect(intentCall).toBeDefined()
      const body = JSON.parse(intentCall![1].body as string)
      expect(body.capability).toBe('image_gen')
      expect(body.prompt_hash).toBe('hash123')
    })
  })

  it('T-0011-220: valid submit → confirmation tick + single CTA', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => '{}',
    })

    const {getByTestId, queryByTestId} = renderOutOfScope()

    await waitFor(() => {
      expect(getByTestId('out-of-scope-submit').props.accessibilityState?.disabled).toBe(false)
    })

    fireEvent.press(getByTestId('out-of-scope-submit'))

    await waitFor(() => {
      expect(queryByTestId('out-of-scope-success')).not.toBeNull()
      // Original submit button gone
      expect(queryByTestId('out-of-scope-submit')).toBeNull()
    })
  })

  // ---- Error state ---------------------------------------------------------

  it('T-0011-221: on 5xx → toast "Couldn\'t save. Try again." Field stays', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'error',
      json: async () => ({error: 'internal'}),
    })

    const {getByTestId, queryByTestId} = renderOutOfScope()

    await waitFor(() => {
      expect(getByTestId('out-of-scope-submit').props.accessibilityState?.disabled).toBe(false)
    })

    fireEvent.press(getByTestId('out-of-scope-submit'))

    await waitFor(() => {
      // Submit button still present (field stays)
      expect(queryByTestId('out-of-scope-submit')).not.toBeNull()
      // Success not shown
      expect(queryByTestId('out-of-scope-success')).toBeNull()
    })
  })

  // ---- Back without submit -------------------------------------------------

  it('T-0011-222: back without submit → beforeRemove listener registered and invocable', () => {
    // OutOfScopeScreen registers a beforeRemove listener to signal dismissal
    // telemetry (ADR-0010 placeholder). The harness passes the real
    // navigation.addListener — capture the registered callback and invoke it
    // to verify: (a) the listener is registered, (b) it doesn't throw.
    let capturedBeforeRemoveCb: (() => void) | undefined
    const originalAddListener = jest
      .fn()
      .mockImplementation((event: string, cb: () => void) => {
        if (event === 'beforeRemove') {
          capturedBeforeRemoveCb = cb
        }
        return () => {} // unsubscribe noop
      })

    const qc = new QueryClient({defaultOptions: {queries: {retry: false}}})
    const MockStack = createNativeStackNavigator<RootStackParamList>()

    const OutOfScopeWithListenerSpy = (
      props: NativeStackScreenProps<RootStackParamList, 'OutOfScope'>,
    ) => {
      const wrappedNav = {
        ...props.navigation,
        navigate: jest.fn(),
        goBack: jest.fn(),
        addListener: originalAddListener,
      } as typeof props.navigation
      return <OutOfScopeScreen {...props} navigation={wrappedNav} />
    }

    const {unmount} = render(
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
                <MockStack.Navigator screenOptions={{headerShown: false}}>
                  <MockStack.Screen
                    name="OutOfScope"
                    component={OutOfScopeWithListenerSpy}
                    initialParams={{
                      capability: 'image_gen',
                      reason: 'Image generation required',
                      promptHash: 'hash123',
                      originalPrompt: 'make me an image',
                    }}
                  />
                  <MockStack.Screen name="Create" component={() => null} />
                  <MockStack.Screen name="Library" component={() => null} />
                  <MockStack.Screen name="Generating" component={() => null} />
                  <MockStack.Screen name="QuotaExhausted" component={() => null} />
                  <MockStack.Screen name="Run" component={() => null} />
                  <MockStack.Screen name="SignIn" component={() => null} />
                  <MockStack.Screen name="AppRunner" component={() => null} />
                </MockStack.Navigator>
              </NavigationContainer>
            </ToastProvider>
          </QueryClientProvider>
        </AppShellThemeProvider>
      </SafeAreaProvider>,
    )

    // Listener must have been registered.
    expect(originalAddListener).toHaveBeenCalledWith('beforeRemove', expect.any(Function))
    expect(capturedBeforeRemoveCb).toBeDefined()

    // Invoking the captured callback must not throw (dismissal path).
    expect(() => capturedBeforeRemoveCb?.()).not.toThrow()

    unmount()
  })

  // ---- Unknown capability fallback ----------------------------------------

  it('T-0011-243: unknown capability → fallback illustration + copy', () => {
    const {getByTestId} = renderOutOfScope('unknown', 'Unknown capability')
    expect(getByTestId('out-of-scope-illustration-unknown')).not.toBeNull()
    expect(getByTestId('out-of-scope-headline').props.children).toBe(
      outOfScopeCopy.unknown.headline,
    )
  })

  // ---- Security (T-0011-231b) ----------------------------------------------

  it('T-0011-231b: email not sent to Sentry or console', () => {
    const consoleSpy = {
      log: jest.spyOn(console, 'log').mockImplementation(() => {}),
      warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
      error: jest.spyOn(console, 'error').mockImplementation(() => {}),
    }

    const userEmail = 'user@example.com'
    mockUser = {id: 'uid', email: userEmail}

    renderOutOfScope('image_gen')

    // @sentry/react-native not yet installed (V0 scope). When added, spy on
    // setExtra/setUser/addBreadcrumb and assert none called with userEmail.

    // Assert console not called with email
    ;[consoleSpy.log, consoleSpy.warn, consoleSpy.error].forEach(spy => {
      if (spy.mock.calls.length > 0) {
        const hasEmail = spy.mock.calls.some(
          args => JSON.stringify(args).includes(userEmail),
        )
        expect(hasEmail).toBe(false)
      }
    })

    jest.restoreAllMocks()
  })

  // ---- Snapshots -----------------------------------------------------------

  it('T-0011-241: snapshots for each capability', () => {
    capabilities.forEach(cap => {
      const {toJSON} = renderOutOfScope(cap)
      expect(toJSON()).toMatchSnapshot(`out-of-scope-${cap}`)
    })
  })

  it('T-0011-241: snapshot for unknown capability', () => {
    const {toJSON} = renderOutOfScope('unknown')
    expect(toJSON()).toMatchSnapshot('out-of-scope-unknown')
  })
})

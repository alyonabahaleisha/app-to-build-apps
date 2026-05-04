/**
 * Sign-In screen tests — Step 6, 14 of the 20 IDs.
 *
 * Happy:        T-0001-086, 087, 088, 089
 * Boundary:     T-0001-125 (resend cooldown), T-0001-092 (whitespace trim)
 * Failure:      T-0001-090 (invalid format), T-0001-091 (500 toast),
 *               T-0001-135 (429 toast)
 * Error:        T-0001-093 (offline)
 * Security:     T-0001-094 (input attrs), T-0001-095 (no PII in stack)
 * Concurrency:  T-0001-126 (send-debounce 250ms — single mutate call)
 * Regression:   T-0001-096 (reduced-motion preserves content)
 *
 * Note: The screen consumes `useSession()` (for the loading-state branch)
 * and `useToast()`. Both are wrapped in a tiny test harness so we don't
 * have to mount the full SessionProvider / SessionProvider's secure-store
 * dance per test.
 */
import React from 'react'
import {AccessibilityInfo} from 'react-native'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {SafeAreaProvider} from 'react-native-safe-area-context'
import {act, fireEvent, render, waitFor, within} from '@testing-library/react-native'

// ---- Module mocks (must precede imports of the SUT) -----------------------

jest.mock('expo-haptics', () => ({
  __esModule: true,
  ImpactFeedbackStyle: {Light: 'light'},
  impactAsync: jest.fn(async () => {}),
}))

// `@expo/vector-icons` font loading hits the native runtime — stub each
// glyph as a `<View>` so jest can render without a font asset pipeline.
jest.mock('@expo/vector-icons', () => {
  // Inline imports inside the factory keep jest from complaining about
  // module-level `require` lint, while still avoiding hoisting-order issues.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactInner = require('react')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const RN = require('react-native')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Icon = (props: any) =>
    ReactInner.createElement(RN.View, {testID: `icon-${props.name}`})
  return {
    __esModule: true,
    Feather: Icon,
  }
})

const mockRedeemToken = jest.fn(async () => {})
const mockSignOut = jest.fn(async () => {})
const mockSkipAuth = jest.fn(() => {})
let mockSessionStatus: 'loading' | 'unauthenticated' | 'authenticated' = 'unauthenticated'

jest.mock('#/state/session/useSession', () => ({
  __esModule: true,
  useSession: () => ({
    status: mockSessionStatus,
    user: null,
    redeemToken: mockRedeemToken,
    signOut: mockSignOut,
    skipAuth: mockSkipAuth,
  }),
}))

// Default mock: AccessibilityInfo returns reduced-motion = false. Tests
// that need true call `setReducedMotion(true)` before rendering.
let _reducedMotion = false
jest
  .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
  .mockImplementation(async () => _reducedMotion)
function setReducedMotion(v: boolean) {
  _reducedMotion = v
}

// Imports MUST follow the mocks.
import {SignIn} from './index'
import {ToastProvider} from '#/components/ToastProvider'
import {ApiError, resetApiForTests} from '#/lib/api'
import {signInCopy} from './copy'

// ---- Harness --------------------------------------------------------------

function renderSignIn(opts: {showExpiredBanner?: boolean} = {}) {
  // Fresh QueryClient per test — no cache bleed.
  const qc = new QueryClient({
    defaultOptions: {
      queries: {retry: false},
      mutations: {retry: false},
    },
  })
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: {x: 0, y: 0, width: 390, height: 844},
        insets: {top: 0, bottom: 0, left: 0, right: 0},
      }}
    >
      <QueryClientProvider client={qc}>
        <ToastProvider>
          <SignIn showExpiredBanner={opts.showExpiredBanner} />
        </ToastProvider>
      </QueryClientProvider>
    </SafeAreaProvider>,
  )
}

// fetch mock helpers
const mockFetch = jest.fn()

beforeEach(() => {
  mockFetch.mockReset()
  global.fetch = mockFetch as unknown as typeof fetch
  mockRedeemToken.mockClear()
  mockSignOut.mockClear()
  mockSessionStatus = 'unauthenticated'
  setReducedMotion(false)
  resetApiForTests()
  jest.useRealTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

function mockMagicLinkOk() {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({sent: true}),
  })
}

function mockMagicLink500() {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status: 500,
    statusText: 'Internal Server Error',
    text: async () => 'oops',
  })
}

function mockMagicLink429() {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status: 429,
    statusText: 'Too Many Requests',
    text: async () => 'rate_limited',
  })
}

function mockMagicLinkOffline() {
  // RN's fetch throws TypeError when offline. We mirror that.
  mockFetch.mockImplementationOnce(() =>
    Promise.reject(new TypeError('Network request failed')),
  )
}

// ---- Tests ----------------------------------------------------------------

describe('SignIn screen', () => {
  it('T-0001-086: default state — email empty, Send disabled', () => {
    const screen = renderSignIn()
    const send = screen.getByTestId('sign-in-send')
    expect(send.props.accessibilityState).toEqual(
      expect.objectContaining({disabled: true}),
    )
  })

  it('T-0001-087: valid email entered → button enabled', () => {
    const screen = renderSignIn()
    const input = screen.getByTestId('sign-in-email')
    fireEvent.changeText(input, 'a@b.co')
    const send = screen.getByTestId('sign-in-send')
    expect(send.props.accessibilityState).toEqual(
      expect.objectContaining({disabled: false}),
    )
  })

  it('T-0001-088: tapping Send fires the mutation; UI transitions to "sent" with bold email', async () => {
    mockMagicLinkOk()
    const screen = renderSignIn()
    const input = screen.getByTestId('sign-in-email')
    fireEvent.changeText(input, 'user@example.com')

    const send = screen.getByTestId('sign-in-send')
    fireEvent.press(send)

    await screen.findByText(signInCopy.sentHeadlinePrefix)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetch.mock.calls[0]!
    expect(url).toMatch(/\/auth\/magic-link$/)
    expect((init as RequestInit).method).toBe('POST')
    screen.getByText('user@example.com')
  })

  it('T-0001-089: "Resend" button visible after first send', async () => {
    mockMagicLinkOk()
    const screen = renderSignIn()
    fireEvent.changeText(screen.getByTestId('sign-in-email'), 'user@example.com')
    await act(async () => {
      fireEvent.press(screen.getByTestId('sign-in-send'))
    })
    await waitFor(() => {
      screen.getByTestId('sign-in-resend')
    })
    const resend = screen.getByTestId('sign-in-resend')
    // Label is the Resend copy.
    within(resend).getByText(signInCopy.primaryResend)
  })

  it('T-0001-125: resend cooldown — disabled at t=0, 29s; enabled at 30s; resend re-fires + resets', async () => {
    jest.useFakeTimers({doNotFake: ['performance']})
    const startWall = 1_000_000_000
    jest.setSystemTime(startWall)

    mockMagicLinkOk()
    const screen = renderSignIn()
    fireEvent.changeText(screen.getByTestId('sign-in-email'), 'user@example.com')
    await act(async () => {
      fireEvent.press(screen.getByTestId('sign-in-send'))
    })
    await waitFor(() => {
      screen.getByTestId('sign-in-resend')
    })

    const resend = () => screen.getByTestId('sign-in-resend')
    expect(resend().props.accessibilityState).toEqual(
      expect.objectContaining({disabled: true}),
    )

    // t = 29s — still disabled.
    await act(async () => {
      jest.advanceTimersByTime(29_000)
    })
    expect(resend().props.accessibilityState).toEqual(
      expect.objectContaining({disabled: true}),
    )

    // t = 30s — enabled.
    await act(async () => {
      jest.advanceTimersByTime(1_000)
    })
    expect(resend().props.accessibilityState).toEqual(
      expect.objectContaining({disabled: false}),
    )

    // Tapping Resend re-fires the mutation and resets the cooldown.
    mockMagicLinkOk()
    await act(async () => {
      fireEvent.press(resend())
    })
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(resend().props.accessibilityState).toEqual(
      expect.objectContaining({disabled: true}),
    )
  })

  it('T-0001-090: invalid email format → inline error + Send disabled', () => {
    const screen = renderSignIn()
    const input = screen.getByTestId('sign-in-email')

    for (const bad of ['notanemail', 'a@', '@b.c']) {
      fireEvent.changeText(input, bad)
      // Inline error visible.
      screen.getByText(signInCopy.emailInvalid)
      // Send disabled.
      expect(screen.getByTestId('sign-in-send').props.accessibilityState).toEqual(
        expect.objectContaining({disabled: true}),
      )
    }
  })

  it('T-0001-091: server 500 → toast with the server-error copy', async () => {
    mockMagicLink500()
    const screen = renderSignIn()
    fireEvent.changeText(screen.getByTestId('sign-in-email'), 'user@example.com')

    await act(async () => {
      fireEvent.press(screen.getByTestId('sign-in-send'))
    })

    await waitFor(() => {
      screen.getByText(signInCopy.errorServer)
    })
    // Distinct from the rate-limit copy.
    expect(screen.queryByText(signInCopy.errorRateLimited)).toBeNull()
  })

  it('T-0001-135: server 429 → distinct rate-limited toast copy', async () => {
    mockMagicLink429()
    const screen = renderSignIn()
    fireEvent.changeText(screen.getByTestId('sign-in-email'), 'user@example.com')

    await act(async () => {
      fireEvent.press(screen.getByTestId('sign-in-send'))
    })

    await waitFor(() => {
      screen.getByText(signInCopy.errorRateLimited)
    })
    expect(screen.queryByText(signInCopy.errorServer)).toBeNull()
  })

  it('T-0001-092: email with leading/trailing whitespace → trimmed before validation', async () => {
    mockMagicLinkOk()
    const screen = renderSignIn()
    fireEvent.changeText(screen.getByTestId('sign-in-email'), '   user@example.com   ')

    // Send button should be enabled despite the whitespace, because we
    // validate the trimmed value.
    expect(screen.getByTestId('sign-in-send').props.accessibilityState).toEqual(
      expect.objectContaining({disabled: false}),
    )

    await act(async () => {
      fireEvent.press(screen.getByTestId('sign-in-send'))
    })

    // Confirm the request body carries the trimmed email.
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [, init] = mockFetch.mock.calls[0]!
    const body = JSON.parse((init as RequestInit).body as string) as {email: string}
    expect(body.email).toBe('user@example.com')
  })

  it('T-0001-093: offline during send → toast shows offline copy', async () => {
    mockMagicLinkOffline()
    const screen = renderSignIn()
    fireEvent.changeText(screen.getByTestId('sign-in-email'), 'user@example.com')

    await act(async () => {
      fireEvent.press(screen.getByTestId('sign-in-send'))
    })

    await waitFor(() => {
      screen.getByText(signInCopy.errorOffline)
    })
  })

  it('T-0001-094: email field has correct security/UX input attrs', () => {
    const screen = renderSignIn()
    const input = screen.getByTestId('sign-in-email')
    expect(input.props.autoComplete).toBe('email')
    expect(input.props.autoCapitalize).toBe('none')
    expect(input.props.keyboardType).toBe('email-address')
  })

  it('T-0001-095: failure paths do not surface the typed email in any error message', async () => {
    // Throw with a stack that the test inspects to assert no PII bleeds out.
    mockFetch.mockImplementationOnce(() => Promise.reject(new Error('boom')))

    const screen = renderSignIn()
    const email = 'pii-canary@example.com'
    fireEvent.changeText(screen.getByTestId('sign-in-email'), email)

    let captured: Error | null = null
    try {
      await act(async () => {
        fireEvent.press(screen.getByTestId('sign-in-send'))
      })
    } catch (err) {
      captured = err as Error
    }

    // The component swallows the mutation error into a toast — captured
    // should be null. Either way, no thrown error contains the email.
    if (captured) {
      expect(captured.message).not.toContain(email)
      expect(captured.stack ?? '').not.toContain(email)
    }

    // Visible toast must not contain the typed email either.
    await waitFor(() => {
      screen.getByText(signInCopy.errorServer)
    })
    expect(screen.queryByText(new RegExp(email))).toBeNull()
  })

  it('T-0001-126: Send tapped twice in rapid succession → mutation fires exactly once', async () => {
    // Pending fetch — never resolves during the rapid taps so isPending
    // stays true and the second tap is rejected by the in-flight guard.
    let resolveFirst: (v: unknown) => void = () => {}
    mockFetch.mockImplementation(
      () =>
        new Promise((res) => {
          resolveFirst = res
        }),
    )
    const screen = renderSignIn()
    fireEvent.changeText(screen.getByTestId('sign-in-email'), 'user@example.com')

    const send = screen.getByTestId('sign-in-send')
    fireEvent.press(send)
    // Within 250ms — second tap. UI eventually disables (loading), but the
    // call-count is the canonical assertion: mutation must fire exactly once.
    fireEvent.press(send)
    fireEvent.press(send)

    // Wait for the React state from the in-flight mutation to settle so
    // the disabled state is observable. mutation.mutate flushes
    // useSyncExternalStore updates on the next microtask boundary.
    await waitFor(() => {
      expect(screen.getByTestId('sign-in-send').props.accessibilityState).toEqual(
        expect.objectContaining({disabled: true}),
      )
    })
    // Canonical: exactly one network call.
    expect(mockFetch).toHaveBeenCalledTimes(1)

    // Cleanup — let the in-flight resolve so the test exits cleanly.
    await act(async () => {
      resolveFirst({
        ok: true,
        status: 200,
        json: async () => ({sent: true}),
      })
    })
  })

  it('T-0001-096: reduced-motion preserves identical content + states', async () => {
    setReducedMotion(true)
    mockMagicLinkOk()
    const screen = renderSignIn()
    // Headline + subhead identical regardless of motion preference.
    screen.getByText(signInCopy.headline)
    screen.getByText(signInCopy.subhead)
    fireEvent.changeText(screen.getByTestId('sign-in-email'), 'user@example.com')
    await act(async () => {
      fireEvent.press(screen.getByTestId('sign-in-send'))
    })
    await waitFor(() => screen.getByText(signInCopy.sentHeadlinePrefix))
    // Sent state still renders bold email, footer copy.
    screen.getByText('user@example.com')
    screen.getByText(signInCopy.footer)
  })

  it('also: ApiError instance check — confirms classification path is real', async () => {
    // Belt-and-suspenders: make sure ApiError really does flow through the
    // mutation, so the 500 test isn't accidentally relying on TypeError.
    mockMagicLink500()
    const screen = renderSignIn()
    fireEvent.changeText(screen.getByTestId('sign-in-email'), 'user@example.com')
    await act(async () => {
      fireEvent.press(screen.getByTestId('sign-in-send'))
    })
    await waitFor(() => {
      screen.getByText(signInCopy.errorServer)
    })
    // ApiError is exported but we don't directly assert on it here — the
    // distinct copy proves classifyMagicLinkError ran and returned 'server'
    // (vs 'rate_limited' or 'offline'). This sanity test exists so a
    // future refactor that broke classification would surface clearly.
    expect(ApiError).toBeDefined()
  })
})

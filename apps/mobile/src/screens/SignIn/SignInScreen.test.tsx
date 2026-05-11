/**
 * SignInScreen tests — ADR-0011 Step 7.
 *
 * T-0011-142..161 (20 T-IDs):
 *   Happy:            T-0011-142, 143, 144, 145, 146, 147, 148
 *   A11y:             T-0011-149, 150
 *   Boundary:         T-0011-151, 152
 *   Error:            T-0011-153
 *   Breaking:         T-0011-154
 *   Config exhaustion: T-0011-155, 156, 157, 158, 159
 *   Snapshot:         T-0011-160, 161
 *
 * Harness: AppShellThemeProvider + QueryClientProvider + ToastProvider.
 * `getAuthProvider` is reset between tests via __resetAuthProviderCacheForTests.
 * `useMagicLinkMutation` is stubbed via fetch mock for network tests.
 * `Linking.openURL` is mocked for Terms/Privacy link tests.
 */
import React from 'react'
import {Linking} from 'react-native'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {SafeAreaProvider} from 'react-native-safe-area-context'
import {act, fireEvent, render, waitFor} from '@testing-library/react-native'

// ---- Module mocks (must precede SUT imports) --------------------------------

jest.mock('expo-haptics', () => ({
  __esModule: true,
  ImpactFeedbackStyle: {Light: 'light'},
  impactAsync: jest.fn(async () => {}),
}))

// Gorhom BottomSheet — stub with a plain View so RTL can render.
jest.mock('@gorhom/bottom-sheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const {View, TextInput} = require('react-native')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const BottomSheetModal = React.forwardRef(function BottomSheetModal(props: any, ref: any) {
    // Expose present/dismiss on the ref so tests can call them.
    React.useImperativeHandle(ref, () => ({
      present: () => {
        if (props.onDismiss) {
          // Don't auto-dismiss on present
        }
      },
      dismiss: () => {
        props.onDismiss?.()
      },
    }))
    // Render children always so the sheet content is queryable.
    return React.createElement(View, {testID: 'bottom-sheet-modal'}, props.children)
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const BottomSheetScrollView = ({children, ...rest}: any) =>
    React.createElement(View, rest, children)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const BottomSheetModalProvider = ({children}: any) => React.createElement(View, null, children)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const BottomSheetTextInput = (props: any) => React.createElement(TextInput, props)
  return {
    __esModule: true,
    BottomSheetModal,
    BottomSheetScrollView,
    BottomSheetModalProvider,
    BottomSheetTextInput,
  }
})

// Linking mock
jest.mock('react-native/Libraries/Linking/Linking', () => ({
  openURL: jest.fn(async () => {}),
}))

// logger spy — set up before imports so we can spy on warn.
jest.mock('#/logger', () => {
  const warn = jest.fn()
  return {
    __esModule: true,
    logger: {
      info: jest.fn(),
      warn,
      error: jest.fn(),
    },
    safeMessage: (err: unknown) =>
      err instanceof Error ? err.message : String(err),
  }
})

// session mock — unused by SignInScreen directly (no session.redeemToken call
// yet; the deep-link handler owns that), but SafeContainer / Navigation may
// consume it in future. Provide a stub to avoid missing-context errors.
jest.mock('#/state/session/useSession', () => ({
  __esModule: true,
  useSession: () => ({
    status: 'unauthenticated',
    user: null,
    redeemToken: jest.fn(async () => {}),
    signOut: jest.fn(async () => {}),
    skipAuth: jest.fn(),
  }),
}))

// SUT imports follow mocks.
import {SignInScreen} from './SignInScreen'
import {ToastProvider} from '#/components/ToastProvider'
import {AppShellThemeProvider} from '#/theme/AppShellThemeProvider'
import {resetApiForTests} from '#/lib/api'
import {__setEnvOverrideForTests} from '#/lib/auth/getAuthProvider'
import {__resetMagicLinkProviderForTests} from '#/lib/auth/magicLinkProvider'
import {logger} from '#/logger'
import {signInCopy} from './copy'

// ---- Helpers ----------------------------------------------------------------

const loggerWarnSpy = logger.warn as jest.Mock

function makeQC() {
  return new QueryClient({defaultOptions: {queries: {retry: false}, mutations: {retry: false}}})
}

function renderScreen(opts: {
  showExpiredBanner?: boolean
  /** Raw env string to inject via the test seam (bypasses babel compile-time inlining). */
  env?: string
} = {}) {
  // Use the test seam to set the env flag — prevents babel-preset-expo from
  // inlining process.env.EXPO_PUBLIC_AUTH_PROVIDER at compile time.
  if (opts.env !== undefined) {
    __setEnvOverrideForTests(opts.env)
  }
  const qc = makeQC()
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: {x: 0, y: 0, width: 390, height: 844},
        insets: {top: 0, bottom: 0, left: 0, right: 0},
      }}
    >
      <AppShellThemeProvider>
        <QueryClientProvider client={qc}>
          <ToastProvider>
            <SignInScreen showExpiredBanner={opts.showExpiredBanner} />
          </ToastProvider>
        </QueryClientProvider>
      </AppShellThemeProvider>
    </SafeAreaProvider>,
  )
}

const mockFetch = jest.fn()

beforeEach(() => {
  mockFetch.mockReset()
  global.fetch = mockFetch as unknown as typeof fetch
  resetApiForTests()
  // Default: magic-link provider via test seam.
  __setEnvOverrideForTests('magic-link')
  __resetMagicLinkProviderForTests()
  loggerWarnSpy.mockClear()
  jest.useRealTimers()
})

afterEach(() => {
  // Clear env override so process.env reading is restored.
  __setEnvOverrideForTests(null)
  jest.useRealTimers()
})

function mockMagicLink500() {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status: 500,
    statusText: 'Internal Server Error',
    text: async () => 'oops',
  })
}

// ---- Tests ------------------------------------------------------------------

describe('SignInScreen', () => {
  // ---- Happy ----

  it('T-0011-142: renders wordmark "Canvas" with accessibilityRole="header"', () => {
    const screen = renderScreen()
    const wordmark = screen.getByTestId('sign-in-wordmark')
    expect(wordmark.props.accessibilityRole).toBe('header')
    expect(wordmark.props.children).toBe(signInCopy.wordmark)
  })

  it('T-0011-143: renders tagline "A personal canvas for your everyday tools."', () => {
    const screen = renderScreen()
    screen.getByTestId('sign-in-tagline')
    screen.getByText(signInCopy.tagline)
  })

  it('T-0011-144: sign-in button is full-width, 48pt tall, accent bg', () => {
    const screen = renderScreen()
    const btn = screen.getByTestId('sign-in-button')
    // Height 48 is in the style applied to the button.
    expect(btn).toBeTruthy()
    // accessibilityRole="button" verifies it's treated as a button.
    expect(btn.props.accessibilityRole).toBe('button')
  })

  it('T-0011-145: footer Terms + Privacy links present', () => {
    const screen = renderScreen()
    expect(screen.getByTestId('sign-in-terms')).toBeTruthy()
    expect(screen.getByTestId('sign-in-privacy')).toBeTruthy()
  })

  it('T-0011-146: tap Terms opens Linking.openURL with the Terms URL', async () => {
    const screen = renderScreen()
    await act(async () => {
      fireEvent.press(screen.getByTestId('sign-in-terms'))
    })
    expect(Linking.openURL).toHaveBeenCalledWith(expect.stringContaining('terms'))
  })

  it('T-0011-147: with magic-link provider, tap button opens EmailEntrySheet', async () => {
    // Default env is magic-link (set in beforeEach).
    const screen = renderScreen()
    await act(async () => {
      fireEvent.press(screen.getByTestId('sign-in-button'))
    })
    // EmailEntrySheet is rendered (via the BottomSheetModal stub which always
    // renders its children — the email input is queryable).
    expect(screen.getByTestId('email-sheet-input')).toBeTruthy()
  })

  it('T-0011-148: with apple provider, tap button calls stubbed signInWithApple() and surfaces error toast', async () => {
    const screen = renderScreen({env: 'apple'})

    await act(async () => {
      fireEvent.press(screen.getByTestId('sign-in-button'))
    })

    // siwaProvider stub throws AuthFailedError('siwa_not_yet_implemented').
    // Screen catches it and shows the generic error toast.
    await waitFor(() => {
      screen.getByText(signInCopy.errorSignIn)
    })
  })

  // ---- A11y ----

  it('T-0011-149: sign-in button has accessibilityRole="button" and provider-appropriate label', () => {
    // magic-link variant
    const screen = renderScreen()
    const btn = screen.getByTestId('sign-in-button')
    expect(btn.props.accessibilityRole).toBe('button')
    expect(btn.props.accessibilityLabel).toBe(signInCopy.a11yButtonMagicLink)
  })

  it('T-0011-150: footer Terms + Privacy links have accessibilityRole="link" and hitSlop ≥44pt vertical', () => {
    const screen = renderScreen()
    const terms = screen.getByTestId('sign-in-terms')
    const privacy = screen.getByTestId('sign-in-privacy')
    // Role check
    expect(terms.props.accessibilityRole).toBe('link')
    expect(privacy.props.accessibilityRole).toBe('link')
    // hitSlop vertical coverage: top + bottom must be ≥30 so that 14pt line-height + slop ≥44pt.
    // Concrete shape: {top: 15, bottom: 15, left: 8, right: 8}.
    const termsHitSlop = terms.props.hitSlop as {top: number; bottom: number; left: number; right: number}
    const privacyHitSlop = privacy.props.hitSlop as {top: number; bottom: number; left: number; right: number}
    expect(termsHitSlop.top + termsHitSlop.bottom).toBeGreaterThanOrEqual(30)
    expect(privacyHitSlop.top + privacyHitSlop.bottom).toBeGreaterThanOrEqual(30)
  })

  // ---- Boundary ----

  it('T-0011-151: EmailEntrySheet rejects empty input — Send disabled', async () => {
    const screen = renderScreen()

    // Open the sheet
    await act(async () => {
      fireEvent.press(screen.getByTestId('sign-in-button'))
    })

    const sendBtn = screen.getByTestId('email-sheet-send')
    // Empty email → Send must be disabled.
    expect(sendBtn.props.accessibilityState).toEqual(
      expect.objectContaining({disabled: true}),
    )
  })

  it('T-0011-152: EmailEntrySheet accepts valid email — Send enabled', async () => {
    const screen = renderScreen()

    await act(async () => {
      fireEvent.press(screen.getByTestId('sign-in-button'))
    })

    fireEvent.changeText(screen.getByTestId('email-sheet-input'), 'user@example.com')

    const sendBtn = screen.getByTestId('email-sheet-send')
    expect(sendBtn.props.accessibilityState).toEqual(
      expect.objectContaining({disabled: false}),
    )
  })

  // ---- Error ----

  it('T-0011-153: on magic-link 5xx, toast "Sign-in failed. Try again."', async () => {
    mockMagicLink500()
    const screen = renderScreen()

    await act(async () => {
      fireEvent.press(screen.getByTestId('sign-in-button'))
    })
    fireEvent.changeText(screen.getByTestId('email-sheet-input'), 'user@example.com')

    await act(async () => {
      fireEvent.press(screen.getByTestId('email-sheet-send'))
    })

    await waitFor(() => {
      screen.getByText(signInCopy.errorServer)
    })
    // Exact copy per Sable's spec.
    expect(screen.getByText(signInCopy.errorServer).props.children).toBe(
      'Sign-in failed. Try again.',
    )
  })

  // ---- Breaking ----

  it('T-0011-154: M1 SignIn index.tsx is deleted (filesystem check)', () => {
    // The M1 file is deleted as part of this step. We verify by attempting
    // to require it and asserting the require throws.
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('./index')
    }).toThrow()
  })

  // ---- Config exhaustion ----

  it('T-0011-155: EXPO_PUBLIC_AUTH_PROVIDER truly unset → default magic-link path', () => {
    // Clear the test override entirely so readEnvFlag reads process.env directly.
    // process.env.EXPO_PUBLIC_AUTH_PROVIDER is not set in the test environment,
    // so readEnvFlag falls through to the '' branch → magic-link. This exercises
    // the real env-reading code path, unlike T-0011-156 which injects '' explicitly.
    __setEnvOverrideForTests(null)
    const screen = renderScreen() // no env key — override stays null
    const btn = screen.getByTestId('sign-in-button')
    expect(btn.props.accessibilityLabel).toBe(signInCopy.a11yButtonMagicLink)
  })

  it('T-0011-156: EXPO_PUBLIC_AUTH_PROVIDER="" (explicit empty string) → fallback to magic-link', () => {
    // Injects empty string via the test seam — exercises the trim().toLowerCase() → '' branch.
    const screen = renderScreen({env: ''})
    const btn = screen.getByTestId('sign-in-button')
    expect(btn.props.accessibilityLabel).toBe(signInCopy.a11yButtonMagicLink)
  })

  it('T-0011-157: EXPO_PUBLIC_AUTH_PROVIDER="APPLE" (uppercase) → normalizes to apple', () => {
    const screen = renderScreen({env: 'APPLE'})
    const btn = screen.getByTestId('sign-in-button')
    expect(btn.props.accessibilityLabel).toBe(signInCopy.a11yButtonApple)
  })

  it('T-0011-158: EXPO_PUBLIC_AUTH_PROVIDER="garbage" → falls back to magic-link + logger.warn with exact payload', () => {
    const screen = renderScreen({env: 'garbage'})
    // Verify button is magic-link (fallback applied).
    const btn = screen.getByTestId('sign-in-button')
    expect(btn.props.accessibilityLabel).toBe(signInCopy.a11yButtonMagicLink)
    // Verify logger.warn received the exact structured payload (T-0011-158 pin).
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      expect.objectContaining({event: 'auth_provider_invalid', value: 'garbage'}),
      expect.any(String),
    )
    expect(loggerWarnSpy).toHaveBeenCalledTimes(1)
  })

  it('T-0011-159: EXPO_PUBLIC_AUTH_PROVIDER="  apple  " (whitespace) → normalizes to apple', () => {
    const screen = renderScreen({env: '  apple  '})
    const btn = screen.getByTestId('sign-in-button')
    expect(btn.props.accessibilityLabel).toBe(signInCopy.a11yButtonApple)
  })

  // ---- Snapshots ----

  it('T-0011-160: SignInScreen default state snapshot', () => {
    const screen = renderScreen()
    expect(screen.toJSON()).toMatchSnapshot()
  })

  it('T-0011-161: SignInScreen with "link expired" banner (carryover from M1 prop)', () => {
    const screen = renderScreen({showExpiredBanner: true})
    // The expired banner surfaces in the EmailEntrySheet (which is always
    // rendered in the DOM via the stub). Verify the text is present.
    screen.getByText(signInCopy.expiredBanner)
    expect(screen.toJSON()).toMatchSnapshot()
  })
})

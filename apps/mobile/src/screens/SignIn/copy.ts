/**
 * Sign-In copy — every user-facing string lives here as a plain literal.
 *
 * Per ARCHITECTURE.md §11: no concatenation, no inline ternaries that
 * produce different copy variants. The M2 Lingui codemod can wrap these
 * literals one-for-one without touching JSX.
 *
 * Strings sourced from Sable's `docs/ux/app-creation-poc-ux.md`
 * §Content & Copy table for the Sign-In screen.
 */
export const signInCopy = {
  headline: 'Make the apps in your head.',
  subhead: 'Describe an idea. Get a real app.',
  emailLabel: 'Email',
  emailPlaceholder: 'you@example.com',
  emailInvalid: "That doesn't look like an email.",
  primaryDefault: 'Send magic link',
  primarySending: 'Sending…',
  primaryResend: 'Resend',
  // Accessibility variants of the primary button per UX doc §Accessibility.
  a11ySendDefault: 'Send magic link',
  a11ySendSending: 'Sending sign-in link',
  a11ySendResend: 'Resend sign-in link',
  sentHeadlinePrefix: 'Check your inbox',
  sentSubheadPrefix: 'We sent a sign-in link to ',
  sentSubheadSuffix: '.',
  footer: "We'll email you a one-tap sign-in link. No password.",
  expiredBanner: 'That link expired. Send a new one?',
  expiredDismiss: 'Dismiss',
  errorServer: "Couldn't send the link. Try again in a moment.",
  errorRateLimited: 'Too many attempts. Try again in a minute.',
  errorOffline: "You're offline.",
  verifyingHeadline: 'Signing you in…',
  skipAuth: 'Continue without signing in',
  a11ySkipAuth: 'Continue without signing in',
} as const

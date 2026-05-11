/**
 * SignIn copy — V0 strings per Sable's canvas-v0-ux.md §Screen 1.
 *
 * Per ARCHITECTURE.md §11: no concatenation, no inline ternaries that
 * produce different copy variants. The M2 Lingui codemod can wrap these
 * literals one-for-one without touching JSX.
 *
 * Replaces M1 copy (magic-link headline "Make the apps in your head.").
 * V0 copy uses Sable's wordmark + tagline pattern.
 */
export const signInCopy = {
  // Wordmark — rendered with accessibilityRole="header"
  wordmark: 'Canvas',
  // Tagline — type-body, fg-muted
  tagline: 'A personal canvas for your everyday tools.',
  // Sign-in button label — provider-aware
  buttonMagicLink: 'Sign in with email',
  buttonApple: 'Sign in with Apple',
  // A11y labels for the auth button
  a11yButtonMagicLink: 'Sign in with email',
  a11yButtonApple: 'Sign in with Apple',
  // Footer micro-copy (type-micro, fg-faint)
  footer: 'By signing in, you agree to our ',
  footerTerms: 'Terms',
  footerAnd: ' and ',
  footerPrivacy: 'Privacy Policy',
  footerSuffix: '.',
  // Error toast
  errorSignIn: 'Sign-in failed. Try again.',
  // EmailEntrySheet strings (magic-link path)
  emailSheetHeadline: 'Enter your email',
  emailSheetSubhead: "We'll send you a sign-in link.",
  emailLabel: 'Email',
  emailPlaceholder: 'you@example.com',
  emailInvalid: "That doesn't look like an email.",
  emailSendDefault: 'Send magic link',
  emailSendSending: 'Sending…',
  emailSendResend: 'Resend',
  a11yEmailSendDefault: 'Send magic link',
  a11yEmailSendSending: 'Sending sign-in link',
  a11yEmailSendResend: 'Resend sign-in link',
  sentHeadlinePrefix: 'Check your inbox',
  sentSubheadPrefix: 'We sent a sign-in link to ',
  sentSubheadSuffix: '.',
  errorServer: "Sign-in failed. Try again.",
  errorRateLimited: 'Too many attempts. Try again in a minute.',
  errorOffline: "You're offline.",
  // Expired banner (carryover from M1 prop — T-0011-161)
  expiredBanner: 'That link expired. Send a new one?',
  expiredDismiss: 'Dismiss',
  // Hydration splash (session loading) — shown in HydrationSplash (Navigation.tsx)
  verifyingHeadline: 'Signing you in…',
} as const

// URLs for Terms and Privacy links.
export const SIGN_IN_URLS = {
  terms: 'https://canvas.app/terms',
  privacy: 'https://canvas.app/privacy',
} as const

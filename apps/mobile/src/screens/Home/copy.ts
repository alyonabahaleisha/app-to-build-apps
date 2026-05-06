/**
 * Home copy — every user-facing string lives here as a plain literal.
 *
 * Per ARCHITECTURE.md §11: no concatenation that produces different copy
 * variants. The M2 Lingui codemod can wrap each literal one-for-one without
 * touching JSX.
 *
 * Strings sourced from `docs/ux/app-creation-poc-ux.md` §Content & Copy.
 */
export const homeCopy = {
  title: 'Your apps',
  recentSection: 'Recent',
  heroCta: '✨ Create new app',
  heroCtaA11y: 'Create a new app from a description',
  settingsA11y: 'Settings',
  settingsComingSoonToast: 'Settings coming soon',
  emptyHeadline: 'Your library is empty.',
  emptySubhead: 'Tap Create new app to make your first one. It takes about a minute.',
  errorHeadline: "Couldn't load your library.",
  errorSubhead: 'Pull to retry.',
  errorRetryCta: 'Retry',
  errorRetryA11y: 'Retry loading your library',
  // Time-ago — ARCHITECTURE.md §11 keeps these literal even though `{time}` is
  // computed; the template lives in `lib/timeAgo.ts`, this is the "Created" prefix.
  cardCreatedPrefix: 'Created ',
  cardUntitled: 'Untitled',
} as const

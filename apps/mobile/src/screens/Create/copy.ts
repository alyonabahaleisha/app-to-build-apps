/**
 * Create screen copy — every user-facing string lives here.
 *
 * Per ARCHITECTURE.md §11: no concatenation that produces different copy
 * variants. Lingui codemod can wrap each literal one-for-one.
 *
 * Strings sourced from docs/ux/canvas-v0-ux.md §Content & Copy §Screen 3.
 */
export const createCopy = {
  // Header
  title: 'Create',

  // Input
  inputPlaceholder: 'Describe a tool you want.',
  inputA11yLabel: 'Prompt input',

  // Editing pill
  editingPillPrefix: "Editing '",
  editingPillSuffix: "'",
  editingPillDismissA11y: 'Dismiss editing context',

  // Suggestions section
  suggestionsHeader: 'Or try one of these',
  chipHint: 'Pre-fills the prompt.',

  // Mic
  micA11yLabel: 'Voice input — coming soon',
  micA11yHint: 'Opens waitlist sign-up',

  // FAB
  fabA11yLabel: 'Generate tool',

  // Counter
  counterApproachingLimit: 'Approaching length limit',

  // Cancel alert
  cancelAlertTitle: 'Cancel?',
  cancelAlertBody: "You'll lose this generation.",
  cancelAlertKeepWaiting: 'Keep waiting',
  cancelAlertCancel: 'Cancel',

  // Voice mic waitlist sheet
  voiceMicSheetTitle: 'Voice input is coming soon — want to be notified?',
  voiceMicSheetEmailLabel: 'Email',
  voiceMicSheetEmailPlaceholder: 'your@email.com',
  voiceMicSheetSubmit: 'Notify me when this lands',
  voiceMicSheetEmailInvalid: 'Enter a valid email address.',
  voiceMicSheetSuccess: "Got it. We'll email you when voice input is ready.",
} as const

export const MAX_PROMPT_LENGTH = 2000
export const COUNTER_VISIBLE_AT = 1800
export const COUNTER_DANGER_AT = 1900

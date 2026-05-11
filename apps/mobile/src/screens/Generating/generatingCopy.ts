/**
 * Generating screen copy — Sable's canvas-v0-ux.md §Screen 3a.
 */
export const generatingCopy = {
  headline: 'Building your tool…',

  // 3 rotating messages for MessageCycler
  messages: [
    'Sketching the layout…',
    'Wiring up the actions…',
    'Adding the finishing touches…',
  ] as const,

  // Network drop
  waitingForConnection: 'Waiting for connection…',
  cancelAndRetry: 'Cancel and retry',

  // Normal-flow cancel button (T-0011-231a)
  cancel: 'Cancel',
  cancelAlertTitle: 'Cancel?',
  cancelAlertBody: "You'll lose this generation.",
  cancelAlertKeepWaiting: 'Keep waiting',
  cancelAlertCancel: 'Cancel',

  // Progress bar a11y
  progressBarA11yLabel: 'Generation progress',
} as const

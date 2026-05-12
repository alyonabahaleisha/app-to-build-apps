/**
 * Copy strings for RunScreen + sub-components.
 * ADR-0011 Step 10 + canvas-v0-ux.md §Screen 4.
 */

export const runCopy = {
  backA11y: 'Back to Library',
  meatballA11y: 'Tool options',
  meatballHint: 'Opens share, edit, archive, delete.',

  // Meatball sheet items
  share: 'Share',
  copyLink: 'Copy link',
  makeChanges: 'Make changes',
  rename: 'Rename',
  archive: 'Archive',
  delete: 'Delete',

  // Share 501 toast (temporary — ADR-0008 replaces)
  shareNotReady: "Share isn't ready yet",
  // Share success toast (fires when ADR-0008 lands with 200)
  linkCopied: 'Link copied',

  // Rename sheet
  renameTitle: 'Rename',
  renameInputPlaceholder: 'Tool name',
  renameSave: 'Save',
  renameCancel: 'Cancel',
  renameTooLong: 'Name must be 80 characters or fewer',
  renameEmpty: 'Name cannot be empty',

  // Archive
  archiveAlertTitle: 'Archive this tool?',
  archiveAlertBody: 'It will move to your archive.',
  archiveAlertConfirm: 'Archive',
  archiveAlertCancel: 'Cancel',

  // Delete
  deleteAlertTitle: 'Delete this tool?',
  deleteAlertBody: 'This cannot be undone.',
  deleteAlertConfirm: 'Delete',
  deleteAlertCancel: 'Cancel',

  // Loading state
  loading: 'Loading…',

  // Error states
  notFound: "This tool isn't available",
  notFoundCta: 'Back to Library',
  fetchErrorHeadline: 'Something went wrong',
  fetchErrorBody: "We couldn't load this tool.",
  fetchErrorRetry: 'Try again',

  // Render error (canvas-v0-ux.md §Screen 4a)
  renderErrorHeadline: "This tool didn't render.",
  renderErrorBody: 'Something went wrong. Try recreating it.',
  renderErrorBackCta: 'Back to Library',
  renderErrorRecreateCta: 'Recreate',

  // Coachmark (canvas-v0-ux.md §First-Time-User Coachmark)
  coachmarkBody: 'Tap here to share this tool.',
  coachmarkGotIt: 'Got it',
  coachmarkA11y: 'Tip: Tap the options button to share this tool. Tap Got it to dismiss.',
} as const

export const MAX_RENAME_LENGTH = 80

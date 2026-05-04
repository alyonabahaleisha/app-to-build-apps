/**
 * Chat screen copy — Sable's canonical strings (chat-creation-ux.md §Content & Copy).
 * Import these; never hardcode copy at the call site.
 */
export const chatCopy = {
  // Top bar
  topBarTitle: 'New app',
  backButtonLabel: 'Back',

  // Welcome card
  welcomeHeading: 'What will you build?',
  welcomeSubhead: "Describe an app idea and we'll make it real.",

  // Example prompts
  examplePrompts: [
    'A daily water intake tracker',
    'A tip calculator with split options',
    'A simple habit streak counter',
  ],

  // Input bar
  inputPlaceholder: 'Describe your app…',
  sendButtonLabel: 'Send',
  characterLimit: 2000,

  // Remix chip
  remixChipPrefix: 'Remixing from ',
  remixChipClearLabel: 'Clear remix attribution',
  remixChipAccessibilityLabel: (handle: string) =>
    `Remixing from @${handle}. Activate the close button to clear.`,

  // Loading bubble phases
  loadingThinking: 'Thinking about your idea…',
  loadingBuilding: 'Building your app…',
  loadingStalled: 'Still working…',

  // Live-region announcements
  announceThinking: 'Thinking about your idea',
  announceBuilding: 'Building your app',
  announceDone: 'Your app is ready',

  // Error bubble messages — per Sable's error map
  errorCodes: {
    invalid_input: "Hmm, I couldn't turn that into an app. Try a different idea.",
    invalid_spec: "Hmm, I couldn't turn that into an app. Try a different idea.",
    prompt_too_large: 'Your description is too long. Try shortening it.',
    rate_limited: "We're a bit busy right now. Try again in a minute.",
    internal: 'Something went wrong on our end. Try again in a moment.',
    connection_lost: 'Connection lost. We saved your draft — check My apps',
  } as Record<string, string>,

  // Cancel-during-loading alert
  cancelAlertTitle: 'Cancel this generation?',
  cancelAlertBody:
    "It's almost done — leaving will lose progress. The result will still save to My apps.",
  cancelAlertConfirm: 'Leave anyway',
  cancelAlertStay: 'Stay',

  // Connection lost toast (shown before navigating away)
  connectionLostToast: 'Connection lost. We saved your draft — check My apps',
} as const

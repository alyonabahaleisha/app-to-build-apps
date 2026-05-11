/**
 * OutOfScope screen copy — per-capability strings.
 *
 * ADR-0011 Step 9 + Sable's canvas-v0-ux.md §Screen 3b.
 *
 * 5 capabilities (closed enum for V0) + 'unknown' fallback.
 * T-0011-215: correct copy for each of 5 capabilities.
 * T-0011-243: capability='unknown' → fallback illustration + copy.
 */
export type OutOfScopeCapability =
  | 'image_gen'
  | 'vision'
  | 'chat'
  | 'transcription'
  | 'classification'
  | 'unknown'

export interface CapabilityCopy {
  /** Short headline shown above the reason. e.g. "Image generation is coming…" */
  headline: string
  /** Body copy. e.g. "Generate and display images from text prompts." */
  body: string
  /** CTA on submit button */
  ctaLabel: string
  /** A11y full description for VoiceOver */
  a11yDescription: string
}

export const outOfScopeCopy: Record<OutOfScopeCapability, CapabilityCopy> = {
  image_gen: {
    headline: 'Image generation is coming…',
    body: 'Generate and display images from text prompts. Want to be the first to try it?',
    ctaLabel: 'Notify me when this lands',
    a11yDescription: 'Image generation is coming. Generate and display images from text prompts.',
  },
  vision: {
    headline: 'Vision analysis is coming…',
    body: 'Analyze photos and images with AI. Want to be the first to try it?',
    ctaLabel: 'Notify me when this lands',
    a11yDescription: 'Vision analysis is coming. Analyze photos and images with AI.',
  },
  chat: {
    headline: 'Conversational AI is coming…',
    body: 'Build tools with back-and-forth AI conversations. Want to be the first to try it?',
    ctaLabel: 'Notify me when this lands',
    a11yDescription: 'Conversational AI is coming. Build tools with back-and-forth AI conversations.',
  },
  transcription: {
    headline: 'Voice notes are coming…',
    body: "We'll let you know when you can dictate prompts hands-free.",
    ctaLabel: 'Notify me when this lands',
    a11yDescription: 'Voice transcription is coming. Record and transcribe speech to text.',
  },
  classification: {
    headline: 'AI classification is coming…',
    body: 'Automatically sort and categorize content. Want to be the first to try it?',
    ctaLabel: 'Notify me when this lands',
    a11yDescription: 'AI classification is coming. Automatically sort and categorize content.',
  },
  unknown: {
    headline: 'This capability is coming…',
    body: "We're working on new features. Want to be notified when they land?",
    ctaLabel: 'Notify me when this lands',
    a11yDescription: "This capability is coming. We're working on new features.",
  },
}

export const outOfScopeScreenCopy = {
  emailLabel: 'Email',
  emailPlaceholder: 'your@email.com',
  emailInvalid: 'Enter a valid email address.',
  tryDifferentIdea: 'Try a different idea',
  submitting: 'Saving…',
  submitError: "Couldn't save. Try again.",
  successMessage: (capability: string) =>
    `Got it. We'll email you the moment ${capability} is ready.`,
  successCta: 'Try a different idea',
} as const

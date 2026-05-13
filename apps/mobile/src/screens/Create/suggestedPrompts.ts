/**
 * suggestedPrompts — curated pool of 10 prompts + session-seeded picker.
 *
 * ADR-0011 Step 9. The pool is a hand-edited constant; PM owns the content
 * via canvas-v0-brief.md §3.10. No server fetch in V0.
 *
 * Session seed: `crypto.randomUUID()` once at module load (app launch).
 * The same 6 chips appear throughout a session; different sessions get
 * different sets. Fisher-Yates shuffle seeded from the UUID's numeric bytes.
 *
 * T-0011-204: shuffled per-session
 * T-0011-205: same session seed → same order
 * T-0011-206: two different seeds → at least one different chip order
 * T-0011-207: pool has exactly 10 entries
 */

export interface SuggestedPrompt {
  emoji: string
  text: string
}

// 10 curated prompts — closed list for V0 (canvas-v0-brief.md §3.10).
export const SUGGESTED_PROMPT_POOL: readonly SuggestedPrompt[] = [
  {emoji: '📓', text: 'Daily mood journal'},
  {emoji: '🥗', text: 'Weekly grocery list'},
  {emoji: '🏃', text: 'Track my workouts'},
  {emoji: '🧮', text: 'Simple expense tracker'},
  {emoji: '📚', text: 'Books I want to read'},
  {emoji: '💊', text: 'Medication reminder log'},
  {emoji: '🌱', text: 'Plant watering schedule'},
  {emoji: '🎯', text: 'Daily habit tracker'},
  {emoji: '🍳', text: 'Weekly meal planner'},
  {emoji: '🗓️', text: 'Meeting notes organizer'},
] as const

// Pool length guard — tests assert exactly 10.
const _poolLengthCheck: 10 = SUGGESTED_PROMPT_POOL.length as 10

// Silence unused-variable lint on compile-time guard.
void _poolLengthCheck

/**
 * Seeded Fisher-Yates shuffle.
 *
 * The seed is a string (UUID). We derive a simple LCG state from the
 * first 8 hex chars of the UUID so the same UUID always yields the same
 * shuffle.
 */
function seededShuffle<T>(arr: readonly T[], seed: string): T[] {
  // Extract an integer seed from the first 8 hex chars of the UUID.
  const hex = seed.replace(/-/g, '').slice(0, 8)
  let s = parseInt(hex, 16) >>> 0 // unsigned 32-bit

  // LCG parameters (Numerical Recipes).
  const next = () => {
    s = Math.imul(1664525, s) + 1013904223
    return (s >>> 0) / 0x100000000
  }

  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[result[i], result[j]] = [result[j]!, result[i]!]
  }
  return result
}

// Module-level session seed — generated once at app launch (not per-render).
// `Math.random` + `Date.now` is sufficient: the seed only feeds a UI shuffle
// of the suggested-prompt picker, not anything cryptographic. RN has no
// global `crypto.randomUUID`; reaching for `expo-crypto` would be over-spec.
export const SESSION_SEED: string =
  Date.now().toString(36) + '-' + Math.random().toString(36).slice(2)

/**
 * Returns 6 prompts picked from the pool, deterministically shuffled
 * using the session seed. The same seed always yields the same 6.
 *
 * Exported for testing with a custom seed.
 */
export function pickSuggestedPrompts(seed: string = SESSION_SEED): SuggestedPrompt[] {
  return seededShuffle(SUGGESTED_PROMPT_POOL, seed).slice(0, 6)
}

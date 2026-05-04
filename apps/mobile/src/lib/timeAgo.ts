/**
 * `timeAgo(date, now?)` — pure relative-time formatter.
 *
 * Returns the strings from Sable's UX deck (§Content & Copy, "Home time-ago"):
 *   "just now", "5 minutes ago", "yesterday", "3 days ago", "a week ago", etc.
 *
 * Boundaries (chosen to feel right, not cargo-culted from Intl.RelativeTime):
 *   <  60s          → "just now"
 *   <  60min        → "{n} minutes ago" (n=1 → "a minute ago")
 *   <  24h          → "{n} hours ago"   (n=1 → "an hour ago")
 *   <  48h          → "yesterday"
 *   <   7d          → "{n} days ago"
 *   <  14d          → "a week ago"
 *   <  60d          → "{n} weeks ago"
 *   <  365d         → "{n} months ago"
 *   ≥ 365d          → "{n} years ago" (n=1 → "a year ago")
 *
 * Intl.RelativeTimeFormat would be one option, but (a) RN's Hermes ICU
 * support varies across versions and (b) Sable wants specific phrasings
 * ("a week ago" not "1 week ago"). Hand-rolled keeps it deterministic.
 */

const SECOND_MS = 1_000
const MINUTE_MS = 60 * SECOND_MS
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const WEEK_MS = 7 * DAY_MS
const MONTH_MS = 30 * DAY_MS
const YEAR_MS = 365 * DAY_MS

export function timeAgo(date: Date | string, now: Date = new Date()): string {
  const then = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(then.getTime())) return 'just now'

  const diffMs = now.getTime() - then.getTime()
  // Future or near-zero — treat as "just now". Saves a future-tense branch
  // that nothing in the UX deck asks for.
  if (diffMs < MINUTE_MS) return 'just now'

  if (diffMs < HOUR_MS) {
    const m = Math.floor(diffMs / MINUTE_MS)
    return m === 1 ? 'a minute ago' : `${m} minutes ago`
  }

  if (diffMs < DAY_MS) {
    const h = Math.floor(diffMs / HOUR_MS)
    return h === 1 ? 'an hour ago' : `${h} hours ago`
  }

  if (diffMs < 2 * DAY_MS) return 'yesterday'

  if (diffMs < WEEK_MS) {
    const d = Math.floor(diffMs / DAY_MS)
    return `${d} days ago`
  }

  if (diffMs < 2 * WEEK_MS) return 'a week ago'

  if (diffMs < 2 * MONTH_MS) {
    const w = Math.floor(diffMs / WEEK_MS)
    return `${w} weeks ago`
  }

  if (diffMs < YEAR_MS) {
    const mo = Math.floor(diffMs / MONTH_MS)
    return mo === 1 ? 'a month ago' : `${mo} months ago`
  }

  const y = Math.floor(diffMs / YEAR_MS)
  return y === 1 ? 'a year ago' : `${y} years ago`
}

/**
 * Reserved handle list — ADR-0002 Step 2 (§I, §"Step 2 AC").
 *
 * The @example handle is reserved because that user owns seed projects.
 * The rest are common system-name squatting targets. The list is intentionally
 * small; adding entries is cheap and doesn't require a migration.
 *
 * Application-side check fires before the DB UNIQUE constraint so callers get
 * a meaningful error code (`handle_reserved`) instead of a generic
 * unique_violation from the DB.
 *
 * T-0002-018: RESERVED_HANDLES includes all 7 entries listed below.
 * T-0002-019: isReservedHandle is case-insensitive.
 * T-0002-020: empty string is not reserved (it's invalid — regex catches it upstream).
 */
export const RESERVED_HANDLES: ReadonlyArray<string> = [
  'admin',
  'system',
  'official',
  'support',
  'app',
  'creator',
  'example',
] as const

/**
 * Returns true when `handle` matches a reserved handle (case-insensitive).
 * Empty strings are not reserved — they fail the regex `^[a-z0-9-]{3,20}$`
 * before this check is reached.
 */
export function isReservedHandle(handle: string): boolean {
  return RESERVED_HANDLES.includes(handle.toLowerCase())
}

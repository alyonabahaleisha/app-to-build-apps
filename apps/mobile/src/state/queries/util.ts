/**
 * TanStack Query plumbing — query-key factory + stale-time constants.
 * Per ARCHITECTURE.md §4: every domain hook constructs keys via
 * `createQueryKey`, never inline literals.
 */

/**
 * Build a stable, readonly query key. Args are appended verbatim — TanStack
 * compares keys structurally, so primitives and plain objects are stable
 * across renders as long as they're equal-by-value.
 *
 * @example
 *   createQueryKey('projects', userId)             // ['projects', '<uuid>']
 *   createQueryKey('projects', userId, {page: 1})  // ['projects', '<uuid>', {page: 1}]
 */
export function createQueryKey(root: string, ...args: ReadonlyArray<unknown>): readonly unknown[] {
  return [root, ...args] as const
}

/**
 * Stale-time presets in milliseconds. Use these instead of inlining ms
 * arithmetic at call sites — keeps cache policies discoverable and
 * tweakable in one place.
 */
export const STALE = {
  SECONDS: (n: number) => n * 1_000,
  MINUTES: (n: number) => n * 60 * 1_000,
  HOURS: (n: number) => n * 60 * 60 * 1_000,
} as const

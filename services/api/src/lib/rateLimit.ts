/**
 * In-memory fixed-window rate limiter. Per ADR-0001 §H (Robert's AC-Q3): 30
 * requests / minute / user / route on every authenticated POST. Sized so a
 * real user never hits it; a misbehaving client gets 429 backpressure.
 *
 * Hand-rolled (not `@fastify/rate-limit`) per ARCHITECTURE.md §14 sanctioned
 * deps. The MVP runs a single API instance; ARCHITECTURE.md §17 D9 records
 * this as known debt for horizontal scale.
 *
 * Window semantics: fixed-window from the first request in a fresh bucket.
 * When `now − bucket.windowStart > windowMs` the bucket is reset (lazy expiry
 * — no background sweep). The first request after expiry restarts the window.
 *
 * Pure module, no Fastify coupling. Returns `{allowed, retryAfter?}` so the
 * caller chooses status code + body shape.
 */

interface Bucket {
  count: number
  /** ms epoch when the current window started. */
  windowStart: number
}

// Note on growth: this Map is bounded by the number of distinct keys that
// have made a request — at MVP scale, ~the user count. Idle buckets are NOT
// pruned eagerly (lazy expiry only resets a bucket on the next call for the
// same key). ARCHITECTURE.md §17 D9 records this as known debt; eviction +
// horizontal-scale (Redis) backing is Phase 2. retro-lessons.md flags
// unbounded in-memory structures — flagged here, accepted for the POC.
const buckets = new Map<string, Bucket>()

export interface RateLimitResult {
  allowed: boolean
  /** Seconds until the current window expires; undefined when allowed. */
  retryAfter?: number
}

/**
 * Account one request against `key`. Returns `{allowed: true}` if under the
 * limit, otherwise `{allowed: false, retryAfter}` where `retryAfter` is the
 * seconds until the bucket resets.
 *
 * `key` should namespace the route + the user (e.g. `auth.sync:<userId>`) so
 * two routes share neither budget nor counter.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  const existing = buckets.get(key)
  if (!existing || now - existing.windowStart > windowMs) {
    buckets.set(key, {count: 1, windowStart: now})
    return {allowed: true}
  }
  if (existing.count < limit) {
    existing.count += 1
    return {allowed: true}
  }
  const retryAfter = Math.max(1, Math.ceil((existing.windowStart + windowMs - now) / 1000))
  return {allowed: false, retryAfter}
}

/**
 * Test-only escape hatch. Production code never calls this. The Map is
 * process-local; tests that mutate buckets across cases must reset between
 * runs to avoid cross-test bleed.
 */
export function resetRateLimitForTests(): void {
  buckets.clear()
}

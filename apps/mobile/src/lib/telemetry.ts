/**
 * Mobile telemetry — thin event writer.
 *
 * ADR-0011 Step 10 introduces `share_link_copied` as the first client-side
 * event type. The actual event pipeline (writing to the API's events table)
 * is ADR-0010's concern; for V0 this is a no-op that tests can spy on.
 *
 * T-0011-251 requires asserting that `writeEvent` is NOT called with
 * `{eventType: 'share_link_copied'}` on a 501 response — the spy target
 * is this function.
 */

export type MobileEventType = 'share_link_copied'

export interface MobileEvent {
  eventType: MobileEventType
  [key: string]: unknown
}

/**
 * writeEvent — records a client-side telemetry event.
 * V0: logs only; no network call. ADR-0010 wires the real pipeline.
 */
export function writeEvent(_event: MobileEvent): void {
  // V0 placeholder — ADR-0010 replaces with real event write.
  // Intentionally left as no-op so tests can spy without network side-effects.
}

/**
 * Mobile telemetry — thin event writer.
 *
 * ADR-0011 Step 10 introduces `share_link_copied` as the first client-side
 * event type. ADR-0008 Step 7 adds `link_clone_opened` and introduces the
 * per-event payload whitelist (mirrors the server-side ADR-0007 pattern).
 *
 * T-0011-251 requires asserting that `writeEvent` is NOT called with
 * `{eventType: 'share_link_copied'}` on a 501 response — the spy target
 * is this function.
 *
 * V0: the write is a no-op (no network call). ADR-0010 wires the real pipeline.
 * Whitelist validation is synchronous and DOES throw — same contract as the
 * server-side EventPayloadValidationError in services/api/src/llm/telemetry.ts.
 */

// ---------------------------------------------------------------------------
// Event type union — client-side UX surface events only.
// Server-side data-state events (share_link.created etc.) live in
// services/api/src/llm/telemetry.ts.
// ---------------------------------------------------------------------------
export type MobileEventType = 'share_link_copied' | 'link_clone_opened'

// ---------------------------------------------------------------------------
// Per-event payload whitelists — same enforcement contract as server-side.
//
// share_id_prefix: first 4 chars of ksuid — anonymous time-bucket, no PII.
// mode: 'view' | 'remix' — which Universal Link mode opened (for link_clone_opened).
// No full share_id, email, sub, or identity_token.
// ---------------------------------------------------------------------------
export const MOBILE_EVENT_PAYLOAD_WHITELIST: Record<MobileEventType, ReadonlyArray<string>> = {
  share_link_copied: ['share_id_prefix'],
  link_clone_opened: ['share_id_prefix', 'mode'],
} as const

// ---------------------------------------------------------------------------
// MobileEventPayloadValidationError — thrown synchronously on whitelist
// violation, before any write attempt. Mirrors EventPayloadValidationError
// from the server-side telemetry module.
// ---------------------------------------------------------------------------
export class MobileEventPayloadValidationError extends Error {
  readonly code = 'mobile_event_payload_validation' as const
  readonly eventType: MobileEventType
  readonly offendingKey: string

  constructor(eventType: MobileEventType, offendingKey: string) {
    super(
      `Mobile event payload key '${offendingKey}' is not allowed for event type '${eventType}'. ` +
        `Allowed keys: [${MOBILE_EVENT_PAYLOAD_WHITELIST[eventType].join(', ')}]`,
    )
    this.name = 'MobileEventPayloadValidationError'
    this.eventType = eventType
    this.offendingKey = offendingKey
  }
}

// ---------------------------------------------------------------------------
// MobileEvent shape — eventType is the discriminant; remaining keys are payload.
// ---------------------------------------------------------------------------
export interface MobileEvent {
  eventType: MobileEventType
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// writeEvent — records a client-side telemetry event.
//
// Validates payload keys against per-event-type whitelist synchronously.
// Throws MobileEventPayloadValidationError on unknown keys.
// V0: after validation, no-op. ADR-0010 replaces with real event write.
// ---------------------------------------------------------------------------
export function writeEvent(event: MobileEvent): void {
  const {eventType, ...payload} = event

  // Whitelist validation — synchronous, throws before any I/O.
  const allowed = MOBILE_EVENT_PAYLOAD_WHITELIST[eventType]
  for (const key of Object.keys(payload)) {
    if (!(allowed as ReadonlyArray<string>).includes(key)) {
      throw new MobileEventPayloadValidationError(eventType, key)
    }
  }

  // V0 placeholder — ADR-0010 replaces with real event write.
  // Intentionally left as no-op so tests can spy without network side-effects.
}

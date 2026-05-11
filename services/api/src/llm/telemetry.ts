/**
 * Telemetry — pipeline event writes to the `events` table.
 *
 * ADR-0007 Step 6: M1 event types removed. Only V0 event types remain.
 * Single responsibility:
 *   1. Validate payload keys against per-event-type whitelist (throws synchronously).
 *   2. Short-circuit if EVAL_MODE=true (skip DB insert; validation still runs).
 *   3. Insert into `events` table; swallow DB errors (telemetry never blocks generation).
 *
 * The whitelist is exported so analytics consumers have a stable key contract
 * without depending on the DB schema. Adding a key to one event type's list
 * does NOT loosen enforcement for any other type (per-type Records, not a shared set).
 */

import pino from 'pino'
import {env} from '../lib/env.js'
import {db} from '../db/index.js'
import {schema} from '../db/index.js'
import {safeMessage} from '../lib/logger.js'

// ---------------------------------------------------------------------------
// Module-level logger — same pattern as pipeline.ts.
// ---------------------------------------------------------------------------
const log = pino({level: env.LOG_LEVEL})

// ---------------------------------------------------------------------------
// Event type union — V0 only (ADR-0007 Step 6: M1 plan.*, build.*, edit.* removed).
// ADR-0008 Step 3: share_link.* server-side events added.
// ---------------------------------------------------------------------------
export type EventType =
  | 'generate.completed'
  | 'generate.invalid_spec'
  | 'generate.out_of_scope'
  | 'out_of_scope_intent_captured'
  // ADR-0008 Step 3: share-link data-state events (server-side only).
  // Client-side UX events (share_link_copied, link_clone_opened) live in
  // apps/mobile/src/lib/telemetry.ts and have their own separate whitelist.
  | 'share_link.created'
  | 'share_link.clone_accepted'
  | 'share_link.reserved_mode_viewed'

// ---------------------------------------------------------------------------
// Per-type payload whitelists — V0 event types only (ADR-0007 Step 6).
//
// The whitelist is the source of truth; future call sites that need a new key
// must extend the relevant whitelist entry here.
// ---------------------------------------------------------------------------
export const EVENT_PAYLOAD_WHITELIST: Record<EventType, ReadonlyArray<string>> = {
  'generate.completed': [
    'generationId',
    'archetype',
    'screens_count',
    'navigation',
    'generation_duration_ms',
  ],
  'generate.invalid_spec': ['generationId', 'error_kind', 'code_count'],
  'generate.out_of_scope': ['generationId', 'capability', 'reason_length'],
  // has_email is boolean — presence of email in the captured row.
  'out_of_scope_intent_captured': ['capability', 'has_email'],

  // ADR-0008 Step 3 — share-link server-side events.
  // share_id_prefix: first 4 chars of the ksuid — time-series bucket for analytics.
  //   Full share_id is the URL token and is NOT stored in telemetry (privacy).
  // source_archetype: derived from the version's spec_json archetype field.
  // idempotent_hit: boolean — true when the clone already existed (re-clone).
  // mode: 'view' | 'remix' — which reserved mode was viewed.
  'share_link.created': ['share_id_prefix', 'source_archetype'],
  'share_link.clone_accepted': ['share_id_prefix', 'idempotent_hit', 'source_archetype'],
  'share_link.reserved_mode_viewed': ['share_id_prefix', 'mode'],
} as const

// ---------------------------------------------------------------------------
// EventPayloadValidationError — thrown synchronously by writeEvent on whitelist
// violation, BEFORE any DB call. The orchestrator catches this, logs ERROR,
// and continues — generation is never blocked by a telemetry validation error.
// ---------------------------------------------------------------------------
export class EventPayloadValidationError extends Error {
  readonly code = 'event_payload_validation' as const
  readonly eventType: EventType
  readonly offendingKey: string

  constructor(eventType: EventType, offendingKey: string) {
    super(
      `Event payload key '${offendingKey}' is not allowed for event type '${eventType}'. ` +
        `Allowed keys: [${EVENT_PAYLOAD_WHITELIST[eventType].join(', ')}]`,
    )
    this.name = 'EventPayloadValidationError'
    this.eventType = eventType
    this.offendingKey = offendingKey
  }
}

// ---------------------------------------------------------------------------
// writeEvent — public API
//
// ctx is optional: miniAppId and userId are stored on the events row when
// present (for per-mini-app and per-user analytics joins), but are never
// included in the payload (PII stays out of payload_json).
// ---------------------------------------------------------------------------
export async function writeEvent(
  eventType: EventType,
  payload: Record<string, unknown>,
  ctx?: {miniAppId?: string; userId?: string},
): Promise<void> {
  // 0. Runtime event-type guard — TypeScript's EventType union is compile-time
  //    only. An out-of-union string arrives here as `unknown` at runtime and
  //    would silently look up `undefined` in the whitelist, causing empty-key
  //    iteration with no validation. Throw eagerly so callers get a clear error
  //    rather than a swallowed DB failure. (T-0008-149)
  if (!(eventType in EVENT_PAYLOAD_WHITELIST)) {
    throw new Error(
      `telemetry: unknown event type '${eventType}'. Allowed: ${Object.keys(EVENT_PAYLOAD_WHITELIST).join(', ')}`,
    )
  }

  // 1. Whitelist validation — synchronous, throws before any I/O.
  const allowed = EVENT_PAYLOAD_WHITELIST[eventType]
  for (const key of Object.keys(payload)) {
    if (!(allowed as ReadonlyArray<string>).includes(key)) {
      throw new EventPayloadValidationError(eventType, key)
    }
  }

  // 2. Eval-mode short-circuit — validation ran above; DB insert skipped.
  if (env.EVAL_MODE === 'true') {
    return
  }

  // 3. DB insert — best-effort; errors are swallowed so generation never blocks.
  try {
    // Extract generation_duration_ms from payload if present (V0 generate.completed event).
    const durationMs =
      typeof payload['generation_duration_ms'] === 'number'
        ? payload['generation_duration_ms']
        : undefined

    await db.insert(schema.events).values({
      eventType,
      payloadJson: payload,
      userId: ctx?.userId,
      miniAppId: ctx?.miniAppId,
      ...(durationMs !== undefined ? {durationMs} : {}),
    })
  } catch (err) {
    log.error(
      {err: safeMessage(err), eventType},
      'writeEvent failed — telemetry lost, generation unaffected',
    )
  }
}

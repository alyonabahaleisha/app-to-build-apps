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
// ---------------------------------------------------------------------------
export type EventType =
  | 'generate.completed'
  | 'generate.invalid_spec'
  | 'generate.out_of_scope'
  | 'out_of_scope_intent_captured'

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
// ctx is optional: projectId and userId are stored on the events row when
// present (for per-project and per-user analytics joins), but are never
// included in the payload (PII stays out of payload_json).
// ---------------------------------------------------------------------------
export async function writeEvent(
  eventType: EventType,
  payload: Record<string, unknown>,
  ctx?: {projectId?: string; userId?: string},
): Promise<void> {
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
      projectId: ctx?.projectId,
      ...(durationMs !== undefined ? {durationMs} : {}),
    })
  } catch (err) {
    log.error(
      {err: safeMessage(err), eventType},
      'writeEvent failed — telemetry lost, generation unaffected',
    )
  }
}

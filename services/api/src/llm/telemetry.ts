/**
 * Telemetry — pipeline event writes to the `events` table.
 *
 * Extracted from pipeline.ts (ADR-0004 Step 8). Single responsibility:
 *   1. Validate payload keys against per-event-type whitelist (throws synchronously).
 *   2. Short-circuit if PLAN_BUILD_EVAL_MODE=true (skip DB insert; validation still runs).
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
// Event type union.
//
// ADR-0004 event types are preserved for backward compatibility (not yet
// removed — that is Step 6). ADR-0007 Step 5 adds out_of_scope_intent_captured.
// ADR-0007 Step 6 will remove all ADR-0004 event types and add the remaining
// V0 event types (generate.completed, generate.invalid_spec, generate.out_of_scope).
// ---------------------------------------------------------------------------
export type EventType =
  | 'plan.completed'
  | 'plan.timeout_fallback'
  | 'plan.invalid_fallback'
  | 'plan.unknown_fallback'
  | 'plan.transport_fallback'
  | 'build.completed'
  | 'build.conformance_fallback'
  | 'edit.completed'
  | 'edit.patch_out_of_scope_fallback'
  // ADR-0007 Step 5: out_of_scope_intent capture event.
  | 'out_of_scope_intent_captured'

// ---------------------------------------------------------------------------
// Per-type payload whitelists.
//
// Each allowed key list is determined by auditing every writeEvent call site
// in pipeline.ts as of Step 8. The whitelist is the source of truth; future
// call sites that need a new key must extend the relevant whitelist entry here.
//
// Divergences from Cal's starting list (adjusted to match actual call sites,
// per the Step 8 brief: "adjust the whitelist, don't change the call"):
//
//   plan.timeout_fallback  — added 'error_code', 'mode' (actual call passes both)
//   plan.invalid_fallback  — added 'mode' (actual call passes mode)
//   plan.unknown_fallback  — added 'mode' (actual call passes mode: 'live')
//   plan.transport_fallback — added 'mode' (actual call passes mode)
//   edit.completed         — replaced 'version_id' with 'screens_count', 'navigation',
//                            'build_duration_ms' (version_id was Cal's starting guess;
//                            actual call writes screens_count/navigation/build_duration_ms)
//   edit.patch_out_of_scope_fallback — added 'offendingOp' (actual call passes it)
// ---------------------------------------------------------------------------
export const EVENT_PAYLOAD_WHITELIST: Record<EventType, ReadonlyArray<string>> = {
  'plan.completed': [
    'generationId',
    'archetype',
    'screens_count',
    'navigation',
    'mode',
    'plan_duration_ms',
  ],
  'plan.timeout_fallback': ['generationId', 'error_code', 'mode'],
  'plan.invalid_fallback': ['generationId', 'error_code', 'mode'],
  'plan.unknown_fallback': ['generationId', 'mode'],
  'plan.transport_fallback': ['generationId', 'error_code', 'mode'],
  'build.completed': [
    'generationId',
    'archetype',
    'screens_count',
    'navigation',
    'build_duration_ms',
  ],
  'build.conformance_fallback': ['generationId', 'reason', 'archetype'],
  'edit.completed': [
    'generationId',
    'archetype',
    'screens_count',
    'navigation',
    'build_duration_ms',
  ],
  'edit.patch_out_of_scope_fallback': ['generationId', 'offendingOp', 'reason'],
  // ADR-0007 Step 5 — out_of_scope_intent capture.
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
  if (env.PLAN_BUILD_EVAL_MODE === 'true') {
    return
  }

  // 3. DB insert — best-effort; errors are swallowed so generation never blocks.
  try {
    // Extract duration_ms from payload if present (plan_duration_ms or build_duration_ms).
    const durationMs =
      typeof payload['plan_duration_ms'] === 'number'
        ? payload['plan_duration_ms']
        : typeof payload['build_duration_ms'] === 'number'
          ? payload['build_duration_ms']
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

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
import type {AppleIdentityErrorCode} from '../lib/appleIdentity.js'

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
  // ADR-0013 Step 5: SIWA auth observability events.
  // No email, sub, or token plaintext — asserted in T-0013-125..127.
  | 'auth.siwa_sign_in_succeeded'
  | 'auth.siwa_sign_in_failed'
  | 'auth.siwa_token_validation_failed'

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
    // ADR-0010 Step 4: prompt version at generation time. Only whitelisted on
    // generate.completed — not on generate.invalid_spec or generate.out_of_scope
    // (intentional V0 scope tightness: failures are not joined to version analytics).
    'prompt_version',
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

  // ADR-0013 Step 5 — SIWA auth observability events.
  //
  // Allowed keys: provider (required) + failure_code (optional).
  // INTENTIONAL OMISSIONS: email, sub, identity_token are NOT whitelisted here —
  // they are PII / credential material and must never appear in telemetry payloads
  // (T-0013-125..127). failure_code is constrained to AppleIdentityErrorCode values
  // when present (T-0013-141); see PAYLOAD_VALUE_VALIDATORS below.
  'auth.siwa_sign_in_succeeded': ['provider'],
  'auth.siwa_sign_in_failed': ['provider', 'failure_code'],
  'auth.siwa_token_validation_failed': ['provider', 'failure_code'],
} as const

// ---------------------------------------------------------------------------
// Per-field value validators — key-based whitelist (above) allows the key;
// these validators enforce permitted VALUES for sensitive fields.
//
// Only `failure_code` on SIWA failure events needs value-validation — the
// field is optional (T-0013-141) but when present must be one of the 8
// AppleIdentityErrorCode union values. This keeps the key whitelist
// key-based (ADR-0007 pattern) while closing the value-injection surface.
// ---------------------------------------------------------------------------

const APPLE_IDENTITY_ERROR_CODES: ReadonlyArray<AppleIdentityErrorCode> = [
  'malformed',
  'signature_invalid',
  'kid_unknown',
  'expired',
  'issuer_mismatch',
  'audience_mismatch',
  'jwks_unreachable',
  'missing_claim',
]

// Map of eventType → Map of fieldName → validation function.
// The validation function receives the value and throws EventPayloadValidationError
// if it violates the constraint.
type ValueValidator = (
  value: unknown,
  eventType: EventType,
  key: string,
) => void

const PAYLOAD_VALUE_VALIDATORS: Partial<Record<EventType, Partial<Record<string, ValueValidator>>>> = {
  'auth.siwa_sign_in_failed': {
    failure_code: (value, eventType, key) => {
      if (!(APPLE_IDENTITY_ERROR_CODES as ReadonlyArray<unknown>).includes(value)) {
        throw new EventPayloadValidationError(
          eventType,
          // Reuse EventPayloadValidationError but surface the value constraint
          // in the message by appending via overriding the key string.
          `${key} (value '${String(value)}' not in AppleIdentityErrorCode union)`,
        )
      }
    },
  },
  'auth.siwa_token_validation_failed': {
    failure_code: (value, eventType, key) => {
      if (!(APPLE_IDENTITY_ERROR_CODES as ReadonlyArray<unknown>).includes(value)) {
        throw new EventPayloadValidationError(
          eventType,
          `${key} (value '${String(value)}' not in AppleIdentityErrorCode union)`,
        )
      }
    },
  },
}

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

  // 1b. Value validation — runs after key whitelist for fields that require
  //     constrained values (e.g. failure_code on SIWA events, T-0013-141).
  const valueValidators = PAYLOAD_VALUE_VALIDATORS[eventType]
  if (valueValidators) {
    for (const [key, validate] of Object.entries(valueValidators)) {
      if (key in payload && validate) {
        validate(payload[key], eventType, key)
      }
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

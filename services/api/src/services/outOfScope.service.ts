/**
 * OutOfScope service — ADR-0007 Step 5.
 *
 * Single operation: captureIntent({userId, capability, promptHash, reason, email?})
 *
 * Data sensitivity: auth-only. The row is owner-bound. No read endpoint in V0.
 * Per retro-lessons.md `normalizeRow` lesson: this service returns void — the
 * caller gets no PII back, only a confirmation that the write succeeded.
 *
 * The two-step flow (ADR-0007 §H):
 *   1. Detection: /generate SSE emits out_of_scope event + fires generate.out_of_scope
 *      telemetry. No row inserted yet.
 *   2. Capture: /out-of-scope-intent POSTs here. Row inserted. Telemetry fires.
 *
 * If the user dismisses the "notify me" form, only the telemetry event exists.
 * The capture rate (captures / detections) is a V0.5 prioritization metric.
 */

import type {NodePgDatabase} from 'drizzle-orm/node-postgres'

import * as schema from '../db/schema.js'
import {outOfScopeIntent} from '../db/schema.js'
import {writeEvent} from '../llm/telemetry.js'
import {safeMessage} from '../lib/logger.js'
import pino from 'pino'
import {env} from '../lib/env.js'

type Db = NodePgDatabase<typeof schema>

const log = pino({level: env.LOG_LEVEL})

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface CaptureIntentInput {
  userId: string
  capability: string
  promptHash: string
  reason: string
  email?: string | null
}

// ---------------------------------------------------------------------------
// Service factory — inject db for testability
// ---------------------------------------------------------------------------

export interface OutOfScopeService {
  captureIntent(input: CaptureIntentInput): Promise<void>
}

export function createOutOfScopeService(db: Db): OutOfScopeService {
  return {
    async captureIntent(input: CaptureIntentInput): Promise<void> {
      // Insert the row — returns void; no PII returned to caller.
      await db.insert(outOfScopeIntent).values({
        userId: input.userId,
        capability: input.capability,
        promptHash: input.promptHash,
        reason: input.reason,
        email: input.email ?? null,
      })

      // Telemetry — best-effort; never blocks or throws to the caller.
      // EVAL_MODE short-circuits the DB insert inside writeEvent; the row
      // above is still written (eval mode applies to telemetry only, per
      // ADR-0007 §I and T-0007-122).
      try {
        await writeEvent(
          'out_of_scope_intent_captured',
          {
            capability: input.capability,
            has_email: input.email != null && input.email.length > 0,
          },
          {userId: input.userId},
        )
      } catch (err) {
        log.error(
          {err: safeMessage(err), userId: input.userId},
          'outOfScopeService: telemetry write failed — row inserted, telemetry lost',
        )
      }
    },
  }
}

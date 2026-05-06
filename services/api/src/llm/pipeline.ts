/**
 * Pipeline orchestrator — Plan → Build generation pipeline (ADR-0004 Step 5).
 *
 * Routing decision:
 *   hash(userId) mod 100 < PLAN_BUILD_PIPELINE_PERCENT → new path
 *   PLAN_BUILD_PIPELINE_SHADOW = 'true'               → planner runs, legacy result returned
 *
 * Fallback hierarchy (any one fires the M1 single-call path):
 *   1. PERCENT=0, SHADOW=false                              → legacy (no planner)
 *   2. hash(userId) mod 100 >= PERCENT                     → legacy
 *   3. Planner timeout (12 s wall-clock)                   → legacy + plan.timeout_fallback event
 *   4. Planner Zod-invalid after retry                     → legacy + plan.invalid_fallback event
 *   5. Planner transport error (429 exhausted, 500, etc.)  → legacy + plan.transport_fallback event
 *   6. plan.archetype === 'unknown'                        → legacy + plan.unknown_fallback event
 *   7. Plan-conformance failure after builder re-prompt    → legacy + build.conformance_fallback event
 *
 * Shadow mode: planner runs on every request; plan event is written; but the
 * LEGACY result is what the client receives. Used during Phase B validation.
 *
 * Note on AbortSignal + Promise.race (belt-and-suspenders):
 *   Anthropic SDK 0.92.0 documents AbortSignal support on messages.create.
 *   However, SDK behavior under abort is not guaranteed to propagate consistently.
 *   We wrap every planner call in a Promise.race([producePlan(...), timeoutReject(12_000)])
 *   so the 12 s timeout fires regardless of whether the SDK honors the signal.
 *   Same pattern applied to the builder at 90 s. See ADR-0004 §J and Notes for Colby #5.
 */

import {randomUUID} from 'crypto'
import {createHash} from 'crypto'
import pino from 'pino'
import {env} from '../lib/env.js'
import {db} from '../db/index.js'
import {schema} from '../db/index.js'
import {safeMessage} from '../lib/logger.js'
import {generateAppSpec, type GenerateEvent} from './generate.js'
import {producePlan} from './planner.js'
import {
  PlannerInvalidError,
  PlannerTimeoutError,
  PlanConformanceError,
} from './errors.js'
import type {A2UISpec, Plan} from '@app-creator/a2ui-schema'

// Module-level logger for telemetry write failures. Pino is already a dep;
// this logger is a sibling to Fastify's built-in logger — same format, separate
// instance. Step 8 will consolidate when telemetry.ts is extracted.
const log = pino({level: env.LOG_LEVEL})

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type {GenerateEvent}

export type PipelineOpts = {
  userId: string
  prompt: string
  parentPromptContext?: string
  currentSpec?: A2UISpec
  currentPlan?: Plan
}

// ---------------------------------------------------------------------------
// Routing — deterministic, non-cryptographic hash
//
// Per ADR-0004 Notes for Colby #6: use MD5 (fast, non-crypto), read first
// 4 bytes as uint32 (big-endian), mod 100. NOT sha256 — that's for PII
// obfuscation in Anthropic metadata (hashUserId in util.ts). Routing is a
// different concern: speed and determinism, not privacy.
// ---------------------------------------------------------------------------

function routingHash(userId: string): number {
  const buf = createHash('md5').update(userId).digest()
  // Read first 4 bytes as unsigned 32-bit big-endian integer.
  return buf.readUInt32BE(0)
}

/**
 * Returns true if this userId should be routed to the new pipeline.
 * Deterministic: same userId always returns the same result.
 */
export function shouldUseNewPipeline(userId: string): boolean {
  const percent = env.PLAN_BUILD_PIPELINE_PERCENT
  if (percent === 0) return false
  if (percent === 100) return true
  return routingHash(userId) % 100 < percent
}

// ---------------------------------------------------------------------------
// Timeout helpers — Promise.race belt-and-suspenders
// ---------------------------------------------------------------------------

/**
 * Returns a promise that rejects with PlannerTimeoutError after `ms` milliseconds.
 * Used in Promise.race to guarantee timeout even if the SDK swallows AbortSignal.
 */
function plannerTimeoutReject(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    const timer = setTimeout(() => reject(new PlannerTimeoutError()), ms)
    timer.unref()
  })
}

/**
 * Returns a promise that rejects with an AnthropicTransportError-shaped error
 * after `ms` milliseconds. Used for the builder (90 s) timeout.
 * The builder doesn't have its own timeout error class — it surfaces as the
 * existing transport error which routes handle today.
 */
function builderTimeoutReject(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          Object.assign(new Error('Builder call exceeded 90 s wall-clock budget'), {
            code: 'builder_timeout',
          }),
        ),
      ms,
    )
    timer.unref()
  })
}

// ---------------------------------------------------------------------------
// Event type helpers
// ---------------------------------------------------------------------------

function plannerErrorEventType(
  err: unknown,
): 'plan.timeout_fallback' | 'plan.invalid_fallback' | 'plan.transport_fallback' {
  if (err instanceof PlannerTimeoutError) return 'plan.timeout_fallback'
  if (err instanceof PlannerInvalidError) return 'plan.invalid_fallback'
  // PlannerTransportError + anything else
  return 'plan.transport_fallback'
}

// ---------------------------------------------------------------------------
// writeEvent — private DB telemetry helper
//
// Step 8 will extract this into services/api/src/llm/telemetry.ts and add
// whitelist enforcement. For now: best-effort insert, never throws.
//
// IMPORTANT: callers must NEVER pass prompt text, user email, or any free-text
// user content in the payload. Allowed keys are structural metadata only:
// generationId, archetype, screens_count, navigation, mode, plan_duration_ms,
// build_duration_ms, error_code, reason. T-0004-080 verifies this at the
// orchestrator level; T-0004-104/105 will verify it at the telemetry level
// (Step 8).
//
// TODO: Step 8 will extract this into services/api/src/llm/telemetry.ts and add whitelist enforcement.
// ---------------------------------------------------------------------------

async function writeEvent(
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    await db.insert(schema.events).values({
      eventType,
      payloadJson: payload,
    })
  } catch (err) {
    log.error({err: safeMessage(err), eventType}, 'writeEvent failed — telemetry lost, generation unaffected')
  }
}

// ---------------------------------------------------------------------------
// runPipeline — the orchestrator
// ---------------------------------------------------------------------------

/**
 * Orchestrates the Plan → Build generation pipeline.
 *
 * With PERCENT=0, SHADOW=false: byte-for-byte identical to generateAppSpec.
 * With PERCENT=100, SHADOW=false: always routes to new path.
 * With SHADOW=true: planner runs for observability, legacy result returned.
 *
 * Never propagates PlanConformanceError — caught and converted to fallback.
 * All other errors (transport, invalid spec, rate limit) propagate to caller.
 */
export async function* runPipeline(
  opts: PipelineOpts,
): AsyncGenerator<GenerateEvent, void> {
  const useNew = shouldUseNewPipeline(opts.userId)
  const shadowMode = env.PLAN_BUILD_PIPELINE_SHADOW === 'true'

  // Fast path: nothing to do, byte-for-byte legacy. T-0004-122 regression test.
  if (!useNew && !shadowMode) {
    yield* generateAppSpec(opts)
    return
  }

  const generationId = randomUUID()
  const planStart = Date.now()

  // ---------------------------------------------------------------------------
  // Planner stage — 12 s wall-clock, AbortSignal + Promise.race belt-and-suspenders
  // ---------------------------------------------------------------------------
  const plannerController = new AbortController()
  const plannerSignal = plannerController.signal
  const plannerTimer = setTimeout(() => plannerController.abort(), 12_000)

  let plan: Plan | null = null

  try {
    plan = await Promise.race([
      producePlan({...opts, signal: plannerSignal}),
      plannerTimeoutReject(12_000),
    ])
    clearTimeout(plannerTimer)

    const planDurationMs = Date.now() - planStart
    await writeEvent('plan.completed', {
      generationId,
      archetype: plan.archetype,
      screens_count: plan.screens.length,
      navigation: plan.navigation,
      mode: shadowMode ? 'shadow' : 'live',
      plan_duration_ms: planDurationMs,
    })
  } catch (err) {
    clearTimeout(plannerTimer)
    const eventType = plannerErrorEventType(err)
    const errorCode =
      err instanceof PlannerTimeoutError
        ? 'planner_timeout'
        : err instanceof PlannerInvalidError
          ? err.code
          : (err as {code?: string}).code ?? 'unknown'

    await writeEvent(eventType, {
      generationId,
      error_code: errorCode,
      mode: shadowMode ? 'shadow' : 'live',
    })
    plan = null
  }

  // ---------------------------------------------------------------------------
  // Shadow mode: planner data already written; return legacy result to client
  // ---------------------------------------------------------------------------
  if (shadowMode) {
    yield* generateAppSpec(opts)
    return
  }

  // ---------------------------------------------------------------------------
  // Fallback: null plan or unknown archetype
  // ---------------------------------------------------------------------------
  if (plan === null) {
    yield* generateAppSpec(opts)
    return
  }

  if (plan.archetype === 'unknown') {
    await writeEvent('plan.unknown_fallback', {
      generationId,
      mode: 'live',
    })
    yield* generateAppSpec(opts)
    return
  }

  // ---------------------------------------------------------------------------
  // New path: builder with plan — 90 s wall-clock belt-and-suspenders
  // ---------------------------------------------------------------------------
  const buildStart = Date.now()

  try {
    // Stream the plan-aware builder's events as they're produced.
    // Each next() call races against the 90 s wall-clock timeout (belt-and-
    // suspenders over the SDK's own timeout). PlanConformanceError thrown by
    // the builder propagates out of the race, exits the loop, and is caught
    // by the outer try/catch where the conformance-fallback path activates.
    // Yielding inside the loop preserves SSE streaming UX — clients see
    // thinking_started/building_started immediately, just like M1.
    const buildGen = generateAppSpec({...opts, plan})
    const builderTimeoutPromise = builderTimeoutReject(90_000)

    while (true) {
      const nextResult = await Promise.race([buildGen.next(), builderTimeoutPromise])
      if ((nextResult as IteratorResult<GenerateEvent>).done) break
      yield (nextResult as IteratorYieldResult<GenerateEvent>).value
    }

    const buildDurationMs = Date.now() - buildStart
    await writeEvent('build.completed', {
      generationId,
      archetype: plan.archetype,
      screens_count: plan.screens.length,
      navigation: plan.navigation,
      build_duration_ms: buildDurationMs,
    })
  } catch (err) {
    if (err instanceof PlanConformanceError) {
      // Conformance failure after builder retry — fall back to legacy.
      // Do NOT propagate to caller; this is a fallback signal, not a user-facing error.
      await writeEvent('build.conformance_fallback', {
        generationId,
        reason: err.reason,
        archetype: plan.archetype,
      })
      yield* generateAppSpec(opts)
      return
    }
    // All other errors (transport, timeout, invalid spec, rate limit) propagate.
    throw err
  }
}

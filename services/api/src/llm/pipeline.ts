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
import {applyPatch} from 'fast-json-patch'
import {env} from '../lib/env.js'
import {safeMessage} from '../lib/logger.js'
import {generateAppSpec, type GenerateEvent} from './generate.js'
import {producePlan} from './planner.js'
import {
  PlannerInvalidError,
  PlannerTimeoutError,
  PlanConformanceError,
  PatchOutOfScopeError,
  InvalidSpecError,
} from './errors.js'
import type {A2UISpec, JsonPatch, Plan} from '@app-creator/a2ui-schema'
import {A2UISpecSchema, JsonPatchSchema} from '@app-creator/a2ui-schema'
import {anthropic} from './anthropic.js'
import {produceAppSpecPatchTool} from './tools/produceAppSpecPatch.js'
import {SYSTEM_PROMPT_STATIC, SYSTEM_PROMPT_CATALOG} from './prompts/system.js'
import {serializePlan} from './serializePlan.js'
import {hashUserId, flattenZodIssues, sleep} from './util.js'
import {validatePatchAgainstIntent} from './patchValidation.js'
import {writeEvent} from './telemetry.js'

// Module-level logger for non-telemetry error logging in the orchestrator.
// Telemetry errors are logged in telemetry.ts via its own pino instance.
const log = pino({level: env.LOG_LEVEL})

// ---------------------------------------------------------------------------
// Edit pipeline result type
// ---------------------------------------------------------------------------

export type EditPipelineResult = {
  newSpec: A2UISpec
  plan: Plan
}

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
    try {
      await writeEvent('plan.completed', {
        generationId,
        archetype: plan.archetype,
        screens_count: plan.screens.length,
        navigation: plan.navigation,
        mode: shadowMode ? 'shadow' : 'live',
        plan_duration_ms: planDurationMs,
      })
    } catch (telErr) {
      // Telemetry validation or write failure must not block generation.
      log.error({err: safeMessage(telErr), eventType: 'plan.completed'}, 'telemetry write failed — generation unaffected')
    }
  } catch (err) {
    clearTimeout(plannerTimer)
    const eventType = plannerErrorEventType(err)
    const errorCode =
      err instanceof PlannerTimeoutError
        ? 'planner_timeout'
        : err instanceof PlannerInvalidError
          ? err.code
          : (err as {code?: string}).code ?? 'unknown'

    try {
      await writeEvent(eventType, {
        generationId,
        error_code: errorCode,
        mode: shadowMode ? 'shadow' : 'live',
      })
    } catch (telErr) {
      log.error({err: safeMessage(telErr), eventType}, 'telemetry write failed — generation unaffected')
    }
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
    try {
      await writeEvent('plan.unknown_fallback', {
        generationId,
        mode: 'live',
      })
    } catch (telErr) {
      log.error({err: safeMessage(telErr), eventType: 'plan.unknown_fallback'}, 'telemetry write failed — generation unaffected')
    }
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
    try {
      await writeEvent('build.completed', {
        generationId,
        archetype: plan.archetype,
        screens_count: plan.screens.length,
        navigation: plan.navigation,
        build_duration_ms: buildDurationMs,
      })
    } catch (telErr) {
      log.error({err: safeMessage(telErr), eventType: 'build.completed'}, 'telemetry write failed — generation unaffected')
    }
  } catch (err) {
    if (err instanceof PlanConformanceError) {
      // Conformance failure after builder retry — fall back to legacy.
      // Do NOT propagate to caller; this is a fallback signal, not a user-facing error.
      try {
        await writeEvent('build.conformance_fallback', {
          generationId,
          reason: err.reason,
          archetype: plan.archetype,
        })
      } catch (telErr) {
        log.error({err: safeMessage(telErr), eventType: 'build.conformance_fallback'}, 'telemetry write failed — generation unaffected')
      }
      yield* generateAppSpec(opts)
      return
    }
    // All other errors (transport, timeout, invalid spec, rate limit) propagate.
    throw err
  }
}

// ---------------------------------------------------------------------------
// runPipelineEdit — edit pipeline orchestrator
//
// Mirrors runPipeline's structure but:
//   1. Always runs the planner (no percent routing / shadow mode — edits are
//      always new-path; the legacy single-call path has no edit concept).
//   2. Builder uses the patch tool (produce_app_spec_patch), not produce_app_spec.
//   3. Patch is validated against edit_intent.target_paths. Out-of-scope:
//      re-prompt once with diagnostic; second failure throws PatchOutOfScopeError.
//   4. Returns {newSpec, plan} — NOT an AsyncGenerator; edits are not SSE-streamed.
//
// The planner accepts currentPlan: undefined (legacy versions with plan_json IS NULL);
// in that case it reconstructs an implicit plan from the spec alone (T-0004-100).
//
// Telemetry events: edit.completed on success, edit.patch_out_of_scope_fallback
// on out-of-scope after one retry (before throwing PatchOutOfScopeError).
// ---------------------------------------------------------------------------

export type EditPipelineOpts = {
  userId: string
  prompt: string
  currentSpec: A2UISpec
  currentPlan: Plan | undefined
}

/**
 * Run the plan → patch build pipeline for a single-intent edit.
 *
 * Always runs the planner (no percent routing; edits have no legacy fallback).
 * The planner receives currentSpec and currentPlan (may be undefined for legacy
 * projects — the planner reconstructs an implicit plan in that case).
 *
 * Returns {newSpec, plan} on success. Throws:
 *   PatchOutOfScopeError — builder patch violated target_paths after 1 retry
 *   InvalidSpecError     — patch result failed A2UISpecSchema validation
 *   PlannerInvalidError  — planner failed after retry
 *   PlannerTimeoutError  — planner timed out (12 s)
 *   (other transport errors propagate as-is)
 */
export async function runPipelineEdit(opts: EditPipelineOpts): Promise<EditPipelineResult> {
  const generationId = randomUUID()

  // ---------------------------------------------------------------------------
  // Planner stage — 12 s wall-clock, same belt-and-suspenders as runPipeline
  // ---------------------------------------------------------------------------
  const plannerController = new AbortController()
  const plannerSignal = plannerController.signal
  const plannerTimer = setTimeout(() => plannerController.abort(), 12_000)
  const planStart = Date.now()

  let plan: Plan
  try {
    plan = await Promise.race([
      producePlan({
        userId: opts.userId,
        prompt: opts.prompt,
        currentSpec: opts.currentSpec,
        currentPlan: opts.currentPlan,
        signal: plannerSignal,
      }),
      plannerTimeoutReject(12_000),
    ])
    clearTimeout(plannerTimer)

    try {
      await writeEvent('plan.completed', {
        generationId,
        archetype: plan.archetype,
        screens_count: plan.screens.length,
        navigation: plan.navigation,
        mode: 'live',
        plan_duration_ms: Date.now() - planStart,
      })
    } catch (telErr) {
      // Telemetry failure must not block the edit pipeline.
      log.error({err: safeMessage(telErr), eventType: 'plan.completed'}, 'telemetry write failed — edit pipeline unaffected')
    }
  } catch (err) {
    clearTimeout(plannerTimer)
    // All planner errors propagate for edits — there is no legacy fallback path.
    // The route maps them to appropriate HTTP responses.
    throw err
  }

  // ---------------------------------------------------------------------------
  // Edit_intent: the plan must have edit_intent.target_paths for patch validation.
  // If the planner omitted edit_intent (shouldn't happen for an edit prompt),
  // treat as an empty targetPaths list — the validator will reject all ops.
  // ---------------------------------------------------------------------------
  const targetPaths: string[] = plan.edit_intent?.target_paths ?? []

  // ---------------------------------------------------------------------------
  // Builder stage — 90 s wall-clock. Uses messages.create (not .stream).
  // Edits are not SSE-streamed in this ADR.
  // ---------------------------------------------------------------------------
  const buildStart = Date.now()

  let patchAttempts = 0

  // Build a serialized representation of the current spec for the system block.
  const currentSpecBlock = `Current spec (apply your patch to this):\n${JSON.stringify(opts.currentSpec, null, 2)}`

  // System: static + cached catalog + plan (with edit_intent) + current spec
  const buildSystemBlocks = [
    {type: 'text' as const, text: SYSTEM_PROMPT_STATIC},
    {
      type: 'text' as const,
      text: SYSTEM_PROMPT_CATALOG,
      cache_control: {type: 'ephemeral' as const},
    },
    {type: 'text' as const, text: serializePlan(plan)},
    {type: 'text' as const, text: currentSpecBlock},
  ]

  let buildMessages: Array<{role: 'user' | 'assistant'; content: string}> = [
    {role: 'user', content: opts.prompt},
  ]

  while (patchAttempts < 2) {
    let rawOutput: unknown
    try {
      const response = await Promise.race([
        anthropic.messages.create(
          {
            model: 'claude-sonnet-4-6',
            max_tokens: 8000,
            metadata: {user_id: hashUserId(opts.userId)},
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            system: buildSystemBlocks as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            tools: [produceAppSpecPatchTool] as any,
            tool_choice: {type: 'tool', name: 'produce_app_spec_patch'},
            messages: buildMessages,
          },
        ),
        builderTimeoutReject(90_000),
      ])

      const toolBlock = (response as {content: Array<{type: string; input?: unknown}>}).content.find(
        b => b.type === 'tool_use',
      )
      if (!toolBlock) {
        throw new InvalidSpecError('no_tool_use')
      }
      rawOutput = toolBlock.input
    } catch (err) {
      const sdkErr = err as {status?: number; code?: string}
      if (sdkErr?.status === 429 && patchAttempts < 1) {
        patchAttempts++
        await sleep(1000)
        continue
      }
      if (err instanceof InvalidSpecError) throw err
      throw err
    }

    // Parse the patch (Zod validation)
    let patch: JsonPatch
    try {
      patch = JsonPatchSchema.parse(rawOutput)
    } catch (zerr) {
      throw new InvalidSpecError('invalid_spec', flattenZodIssues(zerr))
    }

    // Validate patch against edit_intent.target_paths
    const validation = validatePatchAgainstIntent(patch, targetPaths)
    if (!validation.ok) {
      if (patchAttempts === 0) {
        // First violation: re-prompt with diagnostic
        patchAttempts++
        buildMessages = [
          ...buildMessages,
          {role: 'assistant', content: JSON.stringify(patch)},
          {
            role: 'user',
            content: `Patch op at index ${validation.offendingOp} violates edit_intent.target_paths: ${validation.reason}. Revise the patch so every op path is within the declared target_paths.`,
          },
        ]
        continue
      }
      // Second violation: give up
      try {
        await writeEvent('edit.patch_out_of_scope_fallback', {
          generationId,
          offendingOp: validation.offendingOp,
          reason: validation.reason,
        })
      } catch (telErr) {
        log.error({err: safeMessage(telErr), eventType: 'edit.patch_out_of_scope_fallback'}, 'telemetry write failed — edit pipeline unaffected')
      }
      throw new PatchOutOfScopeError(validation.offendingOp, validation.reason)
    }

    // Apply the patch (validate=true, mutate=false per CLAUDE.md §9).
    // Cast our generic JsonPatch to fast-json-patch's discriminated Operation[]
    // — the runtime values are identical; the difference is only TypeScript's
    // ability to narrow by `op`. Our Zod schema guarantees the same op values.
    let newSpec: A2UISpec
    try {
      const result = applyPatch(
        JSON.parse(JSON.stringify(opts.currentSpec)), // deep clone — mutate: false equivalent
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        patch as any,
        /*validate*/ true,
        /*mutate*/ false,
      )
      newSpec = A2UISpecSchema.parse(result.newDocument)
    } catch (err) {
      throw new InvalidSpecError('invalid_spec', String(err))
    }

    const buildDurationMs = Date.now() - buildStart
    try {
      await writeEvent('edit.completed', {
        generationId,
        archetype: plan.archetype,
        screens_count: plan.screens.length,
        navigation: plan.navigation,
        build_duration_ms: buildDurationMs,
      })
    } catch (telErr) {
      log.error({err: safeMessage(telErr), eventType: 'edit.completed'}, 'telemetry write failed — edit pipeline unaffected')
    }

    return {newSpec, plan}
  }

  // Unreachable in practice — all exits are via throw or return.
  // TypeScript needs this for exhaustiveness.
  throw new PatchOutOfScopeError(0, 'unexpected loop exit')
}

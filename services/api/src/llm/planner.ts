import {PlanSchema, type Plan, type A2UISpec} from '@app-creator/a2ui-schema'
import {anthropic} from './anthropic.js'
import {producePlanTool} from './tools/producePlan.js'
import {PLANNER_STATIC, PLANNER_CONTEXT} from './prompts/planner.js'
import {PlannerInvalidError, PlannerTimeoutError, PlannerTransportError} from './errors.js'
import {safeMessage} from '../lib/logger.js'
import {hashUserId, flattenZodIssues, sleep} from './util.js'
import {PLANNER_MODEL} from './models.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PlannerMessage = {role: 'user' | 'assistant'; content: string}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildPlannerMessages(opts: {
  prompt: string
  currentSpec?: A2UISpec
  currentPlan?: Plan
}): PlannerMessage[] {
  if (opts.currentPlan !== undefined && opts.currentSpec !== undefined) {
    // Edit call: prior plan + prior spec as assistant context, then user edit prompt.
    return [
      {role: 'assistant', content: JSON.stringify(opts.currentPlan)},
      {role: 'assistant', content: JSON.stringify(opts.currentSpec)},
      {role: 'user', content: opts.prompt},
    ]
  }
  return [{role: 'user', content: opts.prompt}]
}

function isAbortError(err: unknown): boolean {
  if (err instanceof Error) {
    // Node / DOM AbortError names
    if (err.name === 'AbortError') return true
    // Anthropic SDK wraps abort as APIUserAbortError
    if (err.name === 'APIUserAbortError') return true
    // Some environments set a .type property
    if ((err as {type?: string}).type === 'aborted') return true
  }
  return false
}

function diagnosticTurn(zodErr: unknown): PlannerMessage {
  return {
    role: 'user',
    content: `Your previous response failed validation: ${JSON.stringify(flattenZodIssues(zodErr))}. Emit a corrected plan.`,
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Calls Anthropic Haiku with forced tool_choice on produce_plan.
 * Returns a validated Plan or throws PlannerInvalidError | PlannerTimeoutError | PlannerTransportError.
 *
 * Retry policy for 429:
 *   attempt 0 → wait 1s → attempt 1 → wait 2s → attempt 2 → throw PlannerTransportError
 *   (mirrors generate.ts M1 policy: 2 retries with 1s+2s backoff)
 *
 * Retry policy for Zod-invalid plan:
 *   attempt 0 → diagnostic turn → attempt 1 → throw PlannerInvalidError('invalid_plan')
 */
export async function producePlan(opts: {
  userId: string
  prompt: string
  currentSpec?: A2UISpec
  currentPlan?: Plan
  signal?: AbortSignal
}): Promise<Plan> {
  const baseMessages = buildPlannerMessages(opts)

  let transportAttempts = 0
  let zodAttempts = 0
  let lastZodError: unknown

  // Outer loop: transport-level retries (429 backoff, max 2 retries = 3 total attempts).
  while (transportAttempts < 3) {
    // Build messages for this attempt: on zod retry, append diagnostic turn.
    const messages =
      zodAttempts === 0 ? baseMessages : [...baseMessages, diagnosticTurn(lastZodError)]

    try {
      const response = await anthropic.messages.create(
        {
          model: PLANNER_MODEL,
          max_tokens: 1500,
          metadata: {user_id: hashUserId(opts.userId)},
          system: [
            {type: 'text', text: PLANNER_STATIC},
            {type: 'text', text: PLANNER_CONTEXT, cache_control: {type: 'ephemeral'}},
          ],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tools: [producePlanTool] as any,
          tool_choice: {type: 'tool', name: 'produce_plan'},
          messages,
        },
        {signal: opts.signal},
      )

      const toolBlock = response.content.find(b => b.type === 'tool_use')
      if (!toolBlock) {
        throw new PlannerInvalidError('no_tool_use')
      }

      try {
        return PlanSchema.parse(toolBlock.input)
      } catch (zerr) {
        // Zod failure — retry with a diagnostic turn (once only).
        if (zodAttempts === 0) {
          lastZodError = zerr
          zodAttempts++
          // Don't increment transportAttempts; Zod failure is not a transport error.
          continue
        }
        // Second Zod failure — give up.
        throw new PlannerInvalidError('invalid_plan', flattenZodIssues(zerr))
      }
    } catch (err: unknown) {
      // Re-throw our own error types immediately.
      if (err instanceof PlannerInvalidError) throw err
      if (err instanceof PlannerTimeoutError) throw err

      // AbortError from signal — surface as PlannerTimeoutError.
      if (isAbortError(err)) throw new PlannerTimeoutError()

      const sdkErr = err as {status?: number}

      // 429 — backoff and retry (up to 2 retries total).
      if (sdkErr?.status === 429 && transportAttempts < 2) {
        transportAttempts++
        await sleep(transportAttempts === 1 ? 1000 : 2000)
        continue
      }

      // 429 exhausted or other transport error.
      throw new PlannerTransportError(safeMessage(err))
    }
  }

  // Unreachable in practice — loop exits via throw or return.
  throw new PlannerTransportError('exhausted retries')
}

import {A2UISpecSchema, type A2UISpec, type Plan} from '@app-creator/a2ui-schema'
import {anthropic} from './anthropic.js'
import {produceAppSpecTool} from './tools/produceAppSpec.js'
import {SYSTEM_PROMPT_STATIC, SYSTEM_PROMPT_CATALOG} from './prompts/system.js'
import {
  InvalidSpecError,
  RateLimitedError,
  AnthropicTransportError,
  PlanConformanceError,
} from './errors.js'
import {safeMessage} from '../lib/logger.js'
import {hashUserId, flattenZodIssues, sleep} from './util.js'
import {serializePlan} from './serializePlan.js'
import {validatePlanConformance} from '../services/specValidation.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ThinkingStartedEvent = {type: 'thinking_started'}
export type BuildingStartedEvent = {type: 'building_started'}
export type DoneEvent = {
  type: 'done'
  spec: A2UISpec
  plan: Plan | null
  thinking_duration_ms: number
  generation_duration_ms: number
}

export type GenerateEvent = ThinkingStartedEvent | BuildingStartedEvent | DoneEvent

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildMessages(opts: {prompt: string; parentPromptContext?: string}) {
  if (opts.parentPromptContext) {
    return [
      {
        role: 'user' as const,
        content: `Original app prompt: ${opts.parentPromptContext}\n\nNew request: ${opts.prompt}`,
      },
    ]
  }
  return [{role: 'user' as const, content: opts.prompt}]
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Streams generation phase events from Anthropic.
 *
 * Yields:
 *   {type: 'thinking_started'} — immediately, before the first await
 *   {type: 'building_started'} — once, when the first tool_use block starts
 *   {type: 'done', spec, thinking_duration_ms, generation_duration_ms} — on success
 *
 * Throws:
 *   InvalidSpecError — malformed spec or no tool_use block
 *   RateLimitedError — Anthropic 429 after 2 retries
 *   AnthropicTransportError — all other Anthropic errors
 */
export async function* generateAppSpec(opts: {
  userId: string
  prompt: string
  parentPromptContext?: string
  plan?: Plan
}): AsyncGenerator<GenerateEvent, void> {
  const requestStart = Date.now()

  // Yield thinking_started synchronously — before the first await inside the loop.
  yield {type: 'thinking_started'}

  let buildingEmitted = false
  let phase2Start = 0
  let attempts = 0
  // Conformance-retry state: tracked independently of the 429 transport retry.
  // At most one conformance re-prompt is attempted.
  let conformanceAttempts = 0
  // Messages to pass to the SDK. May be extended with a diagnostic turn on
  // conformance failure before the second SDK call. The type annotation allows
  // mixing user and assistant roles in the conformance re-prompt scenario.
  let currentMessages: Array<{role: 'user' | 'assistant'; content: string}> = buildMessages(opts)

  while (attempts < 3) {
    try {
      // ADR-0002 §D claimed extended thinking + forced tool_choice could be
      // combined. Anthropic actually rejects that pairing at the API level
      // ("Thinking may not be enabled when tool_choice forces tool use.").
      // Forced tool_choice is non-negotiable — it's how we guarantee
      // structured output. So thinking is disabled. Loading-state UX collapses
      // to a single dominant phase ("Building your app…"); `thinking_started`
      // still fires synchronously on request acceptance for continuity, then
      // `building_started` follows nearly immediately when the first
      // tool_use block_start arrives.
      const stream = anthropic.messages.stream({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        metadata: {user_id: hashUserId(opts.userId)},
        // When a plan is supplied, inject it as the third (uncached) system block
        // after the cached catalog. This placement preserves the catalog cache hit —
        // the cache matches by exact prefix up to the cached block.
        // When no plan is supplied, the system array is byte-for-byte identical to M1.
        system: opts.plan
          ? [
              {type: 'text', text: SYSTEM_PROMPT_STATIC},
              {
                type: 'text',
                text: SYSTEM_PROMPT_CATALOG,
                cache_control: {type: 'ephemeral'},
              },
              {type: 'text', text: serializePlan(opts.plan)},
            ]
          : [
              {type: 'text', text: SYSTEM_PROMPT_STATIC},
              {
                type: 'text',
                text: SYSTEM_PROMPT_CATALOG,
                cache_control: {type: 'ephemeral'},
              },
            ],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tools: [produceAppSpecTool] as any,
        tool_choice: {type: 'tool', name: 'produce_app_spec'},
        messages: currentMessages,
      })

      for await (const event of stream) {
        if (
          !buildingEmitted &&
          event.type === 'content_block_start' &&
          event.content_block.type === 'tool_use'
        ) {
          phase2Start = Date.now()
          yield {type: 'building_started'}
          buildingEmitted = true
        }
      }

      const final = await stream.finalMessage()

      // Defensive: if building_started was never emitted (no streamed tool_use
      // start), set phase2Start now so duration buckets are non-negative.
      if (phase2Start === 0) {
        phase2Start = Date.now()
      }

      const toolBlock = final.content.find(b => b.type === 'tool_use')
      if (!toolBlock) {
        throw new InvalidSpecError('no_tool_use')
      }

      let parsed: A2UISpec
      try {
        parsed = A2UISpecSchema.parse(toolBlock.input)
      } catch (zerr) {
        throw new InvalidSpecError('invalid_spec', flattenZodIssues(zerr))
      }

      // Plan-conformance check (only when a plan was supplied).
      // Re-prompt once on failure; throw PlanConformanceError on second failure.
      if (opts.plan) {
        const conf = validatePlanConformance(parsed, opts.plan)
        if (!conf.ok) {
          if (conformanceAttempts === 0) {
            // First conformance failure: append a diagnostic turn and retry
            // the SDK call. `building_started` is NOT re-emitted — the
            // consumer only cares about phase boundaries on the first call.
            conformanceAttempts++
            // Echo the prior tool_use input as an assistant turn so the model
            // can see what it emitted, followed by a correction request.
            currentMessages = [
              ...currentMessages,
              {
                role: 'assistant' as const,
                content: JSON.stringify(toolBlock.input),
              },
              {
                role: 'user' as const,
                content: `Your spec did not conform to the plan: ${conf.reason}. Fix the spec to match plan.screens exactly.`,
              },
            ]
            // Reset the stream's phase2Start so the retry doesn't double-count
            // generation time, but keep buildingEmitted true so it doesn't
            // re-emit.
            phase2Start = 0
            continue
          }
          // Second conformance failure — give up.
          throw new PlanConformanceError(conf.reason)
        }
      }

      yield {
        type: 'done',
        spec: parsed,
        plan: opts.plan ?? null,
        thinking_duration_ms: phase2Start - requestStart,
        generation_duration_ms: Date.now() - phase2Start,
      }
      return
    } catch (err: unknown) {
      const sdkErr = err as {status?: number}

      if (sdkErr?.status === 429 && attempts < 2) {
        attempts++
        await sleep(attempts === 1 ? 1000 : 2000)
        continue
      }

      if (err instanceof InvalidSpecError) throw err
      if (err instanceof PlanConformanceError) throw err
      if (sdkErr?.status === 429) throw new RateLimitedError()

      throw new AnthropicTransportError(safeMessage(err))
    }
  }

  // Unreachable in practice — loop exits via throw or return. Safety net.
  throw new RateLimitedError()
}

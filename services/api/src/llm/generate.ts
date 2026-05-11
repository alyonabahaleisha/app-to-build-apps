/**
 * generate.ts — V0 single-call generation pipeline (ADR-0007 Step 3).
 *
 * Replaces the M1 two-stage Plan → Build pipeline with a single Sonnet call
 * over two tools: produce_app_spec and out_of_scope.
 *
 * tool_choice: 'auto' is the load-bearing deviation from CLAUDE.md §3's
 * force-single-tool rule. canvas-v0.md "Notes for Cal" authorises it explicitly:
 * out-of-scope detection requires the model to choose between two schema-
 * enforced tools. See ADR-0007 §C for full rationale.
 *
 * Yields:
 *   {type: 'thinking_started'}  — synchronously, before the first await
 *   {type: 'building_started'}  — once, on first tool_use content_block_start
 *   {type: 'done', spec, generationId, thinking_duration_ms, generation_duration_ms}
 *   {type: 'out_of_scope', capability, reason, prompt_hash, generationId, ...}
 *
 * Throws:
 *   InvalidSpecError — malformed spec, cross-ref failure, no tool_use block,
 *                      unknown tool name, or out_of_scope re-validation failure
 *   RateLimitedError — Anthropic 429 after 2 retries
 *   AnthropicTransportError — all other Anthropic errors
 */
import {randomUUID} from 'node:crypto'
import {SpecSchema, validateCrossRefs, type Spec} from '@app-creator/protocol'
import {anthropic} from './anthropic.js'
import {produceAppSpecTool} from './tools/produceAppSpec.js'
import {outOfScopeTool, OutOfScopeInputSchema, type OutOfScopeInput} from './tools/outOfScope.js'
import {SYSTEM_PROMPT_STATIC, SYSTEM_PROMPT_CATALOG, PROMPT_VERSION} from './prompts/system.js'
import {InvalidSpecError, RateLimitedError, AnthropicTransportError} from './errors.js'
import {safeMessage} from '../lib/logger.js'
import {hashUserId, flattenZodIssues, sleep, sha256Hex} from './util.js'
import {writeEvent} from './telemetry.js'
import pino from 'pino'
import {env} from '../lib/env.js'

const log = pino({level: env.LOG_LEVEL})

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ThinkingStartedEvent = {type: 'thinking_started'}
export type BuildingStartedEvent = {type: 'building_started'}
export type DoneSpecEvent = {
  type: 'done'
  spec: Spec
  generationId: string
  thinking_duration_ms: number
  generation_duration_ms: number
}
export type OutOfScopeEvent = {
  type: 'out_of_scope'
  generationId: string
  capability: OutOfScopeInput['capability']
  reason: string
  prompt_hash: string
  thinking_duration_ms: number
  generation_duration_ms: number
}

export type GenerateEvent = ThinkingStartedEvent | BuildingStartedEvent | DoneSpecEvent | OutOfScopeEvent

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

/**
 * writeEventSafe — fire-and-forget telemetry write.
 * Telemetry failures never block generation (ADR-0007 §I).
 */
function writeEventSafe(
  type: Parameters<typeof writeEvent>[0],
  payload: Record<string, unknown>,
): void {
  writeEvent(type, payload).catch(err => {
    log.error({err: safeMessage(err), eventType: type}, 'telemetry writeEvent failed')
  })
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Streams generation phase events from Anthropic.
 *
 * Note: `plan` parameter is intentionally absent. ADR-0007 drops the two-stage
 * Plan → Build pipeline entirely. T-0007-066 verifies this at the type level.
 */
export async function* generateAppSpec(opts: {
  userId: string
  prompt: string
  parentPromptContext?: string
}): AsyncGenerator<GenerateEvent, void> {
  const generationId = randomUUID()
  const promptHash = sha256Hex(opts.prompt)
  const requestStart = Date.now()

  // Yield thinking_started synchronously — before the first await inside the loop.
  yield {type: 'thinking_started'}

  let buildingEmitted = false
  let phase2Start = 0
  let attempts = 0

  while (attempts < 3) {
    try {
      // ADR-0007 §C: tool_choice: 'auto' is the authorised deviation from
      // CLAUDE.md §3's force-single-tool rule. Two tools: produce_app_spec
      // (emits V0 Spec) and out_of_scope (closed-enum capability tag).
      const stream = anthropic.messages.stream({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        metadata: {user_id: hashUserId(opts.userId)},
        system: [
          {type: 'text', text: SYSTEM_PROMPT_STATIC},
          {
            type: 'text',
            text: SYSTEM_PROMPT_CATALOG,
            cache_control: {type: 'ephemeral'},
          },
        ],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tools: [produceAppSpecTool, outOfScopeTool] as any,
        tool_choice: {type: 'auto'},
        messages: buildMessages(opts),
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

      // Discriminate on tool name.
      if (toolBlock.name === 'out_of_scope') {
        // Defense-in-depth re-validation at SSE emission boundary (T-0007-181).
        // Anthropic's input_schema is the primary gate, but a synthetic 201-char
        // reason or schema-mismatch bug could bypass it; the explicit Zod parse
        // here throws InvalidSpecError before any user-visible content is emitted.
        // Silent truncation on a security boundary is forbidden (RZ3-01 fix).
        let input: OutOfScopeInput
        try {
          input = OutOfScopeInputSchema.parse(toolBlock.input)
        } catch (zerr) {
          throw new InvalidSpecError('invalid_spec', {
            kind: 'zod',
            codes: flattenZodIssues(zerr),
          })
        }

        writeEventSafe('generate.out_of_scope', {
          generationId,
          capability: input.capability,
          reason_length: input.reason.length,
        })

        yield {
          type: 'out_of_scope',
          generationId,
          capability: input.capability,
          reason: input.reason,
          prompt_hash: promptHash,
          thinking_duration_ms: phase2Start - requestStart,
          generation_duration_ms: Date.now() - phase2Start,
        }
        return
      }

      if (toolBlock.name === 'produce_app_spec') {
        // Zod parse — shape + enum validation.
        let parsed: Spec
        try {
          parsed = SpecSchema.parse(toolBlock.input)
        } catch (zerr) {
          const codes = flattenZodIssues(zerr)
          writeEventSafe('generate.invalid_spec', {
            generationId,
            error_kind: 'zod',
            code_count: codes.length,
          })
          throw new InvalidSpecError('invalid_spec', {
            kind: 'zod',
            codes,
          })
        }

        // Cross-ref validation — referential integrity across the spec.
        const crossRef = validateCrossRefs(parsed)
        if (!crossRef.ok) {
          // codes only — never path or message (LLM-emitted strings per §F)
          const codes = crossRef.errors.map(e => e.code)
          writeEventSafe('generate.invalid_spec', {
            generationId,
            error_kind: 'cross_ref',
            code_count: codes.length,
          })
          throw new InvalidSpecError('invalid_spec', {
            kind: 'cross_ref',
            codes,
          })
        }

        writeEventSafe('generate.completed', {
          generationId,
          archetype: parsed.archetype,
          screens_count: parsed.screens.length,
          navigation: parsed.navigation,
          generation_duration_ms: Date.now() - phase2Start,
          // ADR-0010 Step 4: value taken from the imported const, never
          // hardcoded — regression-safe against future PROMPT_VERSION bumps.
          prompt_version: PROMPT_VERSION,
        })

        yield {
          type: 'done',
          spec: parsed,
          generationId,
          thinking_duration_ms: phase2Start - requestStart,
          generation_duration_ms: Date.now() - phase2Start,
        }
        return
      }

      // Unknown tool name — should not happen with tool_choice: 'auto' over a
      // closed 2-element array, but guards against future SDK behaviour changes.
      throw new InvalidSpecError('unknown_tool')
    } catch (err: unknown) {
      const sdkErr = err as {status?: number}

      if (sdkErr?.status === 429 && attempts < 2) {
        attempts++
        await sleep(attempts === 1 ? 1000 : 2000)
        continue
      }

      if (err instanceof InvalidSpecError) throw err
      if (sdkErr?.status === 429) throw new RateLimitedError()

      throw new AnthropicTransportError(safeMessage(err))
    }
  }

  // Unreachable in practice — loop exits via throw or return. Safety net.
  throw new RateLimitedError()
}

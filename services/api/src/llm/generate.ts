import {createHash} from 'crypto'
import {A2UISpecSchema, type A2UISpec} from '@app-creator/a2ui-schema'
import {ZodError} from 'zod'
import {anthropic} from './anthropic.js'
import {produceAppSpecTool} from './tools/produceAppSpec.js'
import {SYSTEM_PROMPT_STATIC, SYSTEM_PROMPT_CATALOG} from './prompts/system.js'
import {InvalidSpecError, RateLimitedError, AnthropicTransportError} from './errors.js'
import {safeMessage} from '../lib/logger.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ThinkingStartedEvent = {type: 'thinking_started'}
export type BuildingStartedEvent = {type: 'building_started'}
export type DoneEvent = {
  type: 'done'
  spec: A2UISpec
  thinking_duration_ms: number
  generation_duration_ms: number
}

export type GenerateEvent = ThinkingStartedEvent | BuildingStartedEvent | DoneEvent

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hashUserId(userId: string): string {
  return createHash('sha256').update(userId).digest('hex').slice(0, 16)
}

function flattenZodIssues(err: unknown): unknown {
  if (err instanceof ZodError) {
    return err.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    }))
  }
  return String(err)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

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
}): AsyncGenerator<GenerateEvent, void> {
  const requestStart = Date.now()

  // Yield thinking_started synchronously — before the first await inside the loop.
  yield {type: 'thinking_started'}

  let buildingEmitted = false
  let phase2Start = 0
  let attempts = 0

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
        system: [
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

      const toolBlock = final.content.find((b) => b.type === 'tool_use')
      if (!toolBlock) {
        throw new InvalidSpecError('no_tool_use')
      }

      let parsed: A2UISpec
      try {
        parsed = A2UISpecSchema.parse(toolBlock.input)
      } catch (zerr) {
        throw new InvalidSpecError('invalid_spec', flattenZodIssues(zerr))
      }

      yield {
        type: 'done',
        spec: parsed,
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
      if (sdkErr?.status === 429) throw new RateLimitedError()

      throw new AnthropicTransportError(safeMessage(err))
    }
  }

  // Unreachable in practice — loop exits via throw or return. Safety net.
  throw new RateLimitedError()
}

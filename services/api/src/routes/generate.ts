/**
 * POST /generate — SSE-driven app generation route. ADR-0007 Step 4 V0 cutover.
 *
 * Wire protocol (ADR-0002 §C, CLAUDE.md §7, ADR-0007 §J):
 *   Content-Type: text/event-stream; one `data: <JSON>\n\n` per event.
 *   Events: thinking_started → building_started → done → [DONE].
 *           OR: thinking_started → building_started → out_of_scope → [DONE].
 *   On LLM error: thinking_started (if emitted) → error → [DONE].
 *
 * Pre-flight failures (body validation, rate-limit, prompt_too_large,
 * missing auth): plain JSON 4xx — NO SSE stream opened.
 *
 * Client-disconnect behaviour (ADR-0002 §O): the Anthropic call completes
 * regardless. Project persists on done. `client_disconnect_during_generate` is logged.
 *
 * Security notes:
 *   - `userId` hash is handled inside `generateAppSpec`; the route never touches it.
 *   - Raw prompt is never logged at INFO level.
 *   - Error responses include only closed-enum codes (no LLM-emitted strings).
 *   - `done` event does NOT include `plan` field (plan removed in V0).
 *
 * V0 changes vs M1:
 *   - Drops `runPipeline` import; uses `generateAppSpec` directly.
 *   - Handles new `out_of_scope` event type (no project persisted).
 *   - Error detail shape: `{kind: 'zod'|'cross_ref', codes: string[]}` not `{path, message, code}[]`.
 *   - `done` event no longer includes `plan` field (T-0007-091).
 *   - Body schema does NOT accept `plan` field (T-0007-090).
 *   - `done` event includes `generationId` (T-0007-092).
 *   - parentPromptContext combined with prompt applies to 12,000-char gate (T-0007-179).
 */
import type {FastifyInstance, FastifyPluginAsync} from 'fastify'
import {z} from 'zod'
import type {NodePgDatabase} from 'drizzle-orm/node-postgres'

import * as schema from '../db/schema.js'
import {miniApps} from '../db/schema.js'
import {eq} from 'drizzle-orm'
import {requireAuth, type AuthenticatedRequest} from '../lib/auth.js'
import {safeMessage} from '../lib/logger.js'
import {rateLimit} from '../lib/rateLimit.js'
import {generateAppSpec} from '../llm/generate.js'
import {InvalidSpecError, RateLimitedError, AnthropicTransportError} from '../llm/errors.js'
import {createMiniAppsService, type MiniAppsService} from '../services/miniApps.service.js'

type Db = NodePgDatabase<typeof schema>

// ---------------------------------------------------------------------------
// Body schema — V0: no `plan` field
// ---------------------------------------------------------------------------

const GenerateBodySchema = z.object({
  prompt: z.string().trim().min(1).max(2000),
  parent_project_id: z.string().uuid().optional(),
})

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Characters beyond which the combined system+catalog+messages input is too large. */
const MAX_TOTAL_INPUT_CHARS = 12_000
const RATE_LIMIT_PER_MINUTE = 30
const RATE_LIMIT_WINDOW_MS = 60_000

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Rough upper bound on total token input chars. Checks prompt + optional
 * parentPromptContext (composed into the user message) against the 12,000-char
 * gate (T-0007-076, T-0007-179).
 */
function estimateTotalInputChars(prompt: string, parentPromptContext?: string): number {
  const SYSTEM_CATALOG_ESTIMATE = 11_000
  const contextLen = parentPromptContext ? parentPromptContext.length : 0
  return prompt.length + contextLen + SYSTEM_CATALOG_ESTIMATE
}

interface MappedError {
  code: string
  detail?: unknown
  status?: number
}

/**
 * Translate LLM errors to the wire code + HTTP status.
 *   InvalidSpecError  → {code: 'invalid_spec', detail: {kind, codes}}
 *   RateLimitedError  → {code: 'rate_limited'}, status 503
 *   AnthropicTransportError → {code: 'internal'}, status 500
 *   unknown           → {code: 'internal'}, status 500
 */
function mapError(err: unknown): MappedError {
  if (err instanceof InvalidSpecError) {
    return {code: 'invalid_spec', detail: err.detail}
  }
  if (err instanceof RateLimitedError) {
    return {code: 'rate_limited', status: 503}
  }
  if (err instanceof AnthropicTransportError) {
    return {code: 'internal', status: 500}
  }
  return {code: 'internal', status: 500}
}

// ---------------------------------------------------------------------------
// Route options
// ---------------------------------------------------------------------------

export interface GenerateRoutesOptions {
  /** Injected by tests; production uses the singleton from db/index.ts. */
  db?: Db
  /** Override service (test-only — e.g. DB-down simulation). */
  service?: MiniAppsService
}

async function resolveService(opts: GenerateRoutesOptions): Promise<MiniAppsService> {
  if (opts.service) return opts.service
  if (opts.db) return createMiniAppsService(opts.db)
  const mod = await import('../db/index.js')
  return createMiniAppsService(mod.getDb())
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export const generateRoutes: FastifyPluginAsync<GenerateRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: GenerateRoutesOptions,
) => {
  const miniAppsService = await resolveService(opts)
  const resolvedDb: Db = opts.db ?? (await import('../db/index.js').then(m => m.getDb()))

  fastify.post('/generate', {preHandler: [requireAuth]}, async (req, reply) => {
    const userId = (req as unknown as AuthenticatedRequest).user.id

    // ------------------------------------------------------------------
    // 1. Body validation — 400 JSON, no SSE
    // ------------------------------------------------------------------
    let body: z.infer<typeof GenerateBodySchema>
    try {
      body = GenerateBodySchema.parse(req.body)
    } catch {
      return reply.code(400).send({error: 'invalid_input'})
    }

    // ------------------------------------------------------------------
    // 2. Rate limit — 429 JSON, no SSE
    // ------------------------------------------------------------------
    const rl = rateLimit(`generate:${userId}`, RATE_LIMIT_PER_MINUTE, RATE_LIMIT_WINDOW_MS)
    if (!rl.allowed) {
      reply.header('Retry-After', String(rl.retryAfter))
      return reply.code(429).send({error: 'rate_limited'})
    }

    // ------------------------------------------------------------------
    // 3. parent_project_id ACL — 404 JSON, no SSE
    //    Project must EITHER be public OR owned by the caller.
    //    If neither → 404 (don't reveal existence).
    // ------------------------------------------------------------------
    let parentPromptContext: string | undefined
    if (body.parent_project_id) {
      const parentRows = await resolvedDb
        .select()
        .from(miniApps)
        .where(eq(miniApps.id, body.parent_project_id))
      const parent = parentRows[0]
      if (!parent || (parent.visibility !== 'public' && parent.ownerId !== userId)) {
        return reply.code(404).send({error: 'not_found'})
      }
      parentPromptContext = parent.originalPrompt || undefined
    }

    // ------------------------------------------------------------------
    // 4. Prompt + context length guard — 400 JSON, no SSE (T-0007-076, T-0007-179)
    //    Combined prompt + parentPromptContext is checked here, not just prompt.
    // ------------------------------------------------------------------
    if (estimateTotalInputChars(body.prompt, parentPromptContext) >= MAX_TOTAL_INPUT_CHARS) {
      return reply.code(400).send({error: 'prompt_too_large'})
    }

    // ------------------------------------------------------------------
    // 5. Open SSE stream
    // ------------------------------------------------------------------
    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache')
    reply.raw.setHeader('X-Accel-Buffering', 'no')
    reply.raw.setHeader('Connection', 'keep-alive')

    let clientGone = false
    req.raw.on('close', () => {
      clientGone = true
    })

    // ------------------------------------------------------------------
    // 6. Drive the LLM generator + persist
    // ------------------------------------------------------------------
    try {
      let thinkingDurationMs = 0
      let generationDurationMs = 0
      let generationId: string | null = null
      let doneSpec: import('@app-creator/protocol').Spec | null = null
      // out_of_scope tracking
      let outOfScopeEvent: import('../llm/generate.js').OutOfScopeEvent | null = null

      for await (const event of generateAppSpec({
        userId,
        prompt: body.prompt,
        parentPromptContext,
      })) {
        if (event.type === 'done') {
          // Don't emit 'done' yet — need to persist first.
          doneSpec = event.spec
          generationId = event.generationId
          thinkingDurationMs = event.thinking_duration_ms
          generationDurationMs = event.generation_duration_ms
        } else if (event.type === 'out_of_scope') {
          // Capture — emit after the loop.
          outOfScopeEvent = event
        } else {
          // thinking_started and building_started emit immediately.
          if (!clientGone) {
            reply.raw.write(`data: ${JSON.stringify(event)}\n\n`)
          }
        }
      }

      // ------------------------------------------------------------------
      // 7a. out_of_scope path — emit event, no project persisted
      // ------------------------------------------------------------------
      if (outOfScopeEvent !== null) {
        if (!clientGone) {
          reply.raw.write(
            `data: ${JSON.stringify({
              type: 'out_of_scope',
              capability: outOfScopeEvent.capability,
              reason: outOfScopeEvent.reason,
              prompt_hash: outOfScopeEvent.prompt_hash,
            })}\n\n`,
          )
        }
        return
      }

      // ------------------------------------------------------------------
      // 7b. done path — persist project, emit done event
      // ------------------------------------------------------------------
      if (doneSpec === null || generationId === null) {
        throw new Error('generator completed without done or out_of_scope event')
      }

      const detail = await miniAppsService.create({
        ownerId: userId,
        spec: doneSpec,
        originalPrompt: body.prompt,
        parentMiniAppId: body.parent_project_id,
      })

      const doneEventPayload = {
        type: 'done',
        generationId,
        miniApp: {
          id: detail.miniApp.id,
          title: detail.miniApp.title,
          visibility: detail.miniApp.visibility,
          // SSE wire field name remains `parent_project_id` until ADR-0011
          // Step 4 (mobile state-queries rename). Internal Drizzle property is
          // `parentMiniAppId` (correct post-schema-rename); only the JSON key
          // ships unchanged to avoid breaking mobile clients mid-Phase-1.
          parent_project_id: detail.miniApp.parentMiniAppId,
          original_prompt: detail.miniApp.originalPrompt,
          created_at: detail.miniApp.createdAt.toISOString(),
        },
        spec: doneSpec,
        render_hash: detail.currentVersion.renderHash,
        thinking_duration_ms: thinkingDurationMs,
        generation_duration_ms: generationDurationMs,
      }

      if (!clientGone) {
        reply.raw.write(`data: ${JSON.stringify(doneEventPayload)}\n\n`)
      } else {
        req.log.info(
          {
            userId,
            miniAppId: detail.miniApp.id,
            action: 'client_disconnect_during_generate',
          },
          'client_disconnect_during_generate',
        )
      }
    } catch (err) {
      const mapped = mapError(err)
      if (mapped.status) {
        reply.raw.statusCode = mapped.status
      }
      if (!clientGone) {
        reply.raw.write(
          `data: ${JSON.stringify({type: 'error', code: mapped.code, detail: mapped.detail})}\n\n`,
        )
      }
      req.log.error({err: safeMessage(err), userId}, 'generate_failed')
    } finally {
      if (!clientGone) {
        reply.raw.write('data: [DONE]\n\n')
      }
      reply.raw.end()
    }
  })
}

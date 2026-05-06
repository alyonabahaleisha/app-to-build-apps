/**
 * POST /generate — SSE-driven app generation route. ADR-0002 Step 4.
 *
 * Wire protocol (ADR-0002 §C, CLAUDE.md §7):
 *   Content-Type: text/event-stream; one `data: <JSON>\n\n` per event.
 *   Events: thinking_started → building_started → done → [DONE].
 *   On LLM error: thinking_started (if emitted) → error → [DONE].
 *
 * Pre-flight failures (body validation, rate-limit, prompt_too_large,
 * missing auth): plain JSON 4xx — NO SSE stream opened (T-0002-045/046/
 * 047/059/062).
 *
 * Client-disconnect behaviour (ADR-0002 §O): the Anthropic call completes
 * regardless. Project persists. `client_disconnect_during_generate` is logged.
 *
 * Security notes:
 *   - Thinking trace text NEVER appears in SSE output (T-0002-057).
 *   - `userId` hash is handled inside `generateAppSpec`; the route never
 *     touches it (T-0002-035 defence).
 *   - Raw prompt is never logged at INFO level (AC-CG-Q1).
 */
import type {FastifyInstance, FastifyPluginAsync} from 'fastify'
import {z} from 'zod'
import type {NodePgDatabase} from 'drizzle-orm/node-postgres'

import type {A2UISpec, Plan} from '@app-creator/a2ui-schema'
import * as schema from '../db/schema.js'
import {projects} from '../db/schema.js'
import {eq} from 'drizzle-orm'
import {requireAuth, type AuthenticatedRequest} from '../lib/auth.js'
import {safeMessage} from '../lib/logger.js'
import {rateLimit} from '../lib/rateLimit.js'
import {runPipeline} from '../llm/pipeline.js'
import {InvalidSpecError, RateLimitedError, AnthropicTransportError} from '../llm/errors.js'
import {createProjectsService, type ProjectsService} from '../services/projects.service.js'

type Db = NodePgDatabase<typeof schema>

// ---------------------------------------------------------------------------
// Body schema
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
 * Rough upper bound on total token input chars. We check the prompt length
 * plus a conservative 11000-char budget for the static system + catalog
 * blocks (measured from the actual prompt text in system.ts; 12000 total cap
 * per ADR-0002 §D). This avoids an actual token count call.
 */
function estimateTotalInputChars(prompt: string): number {
  const SYSTEM_CATALOG_ESTIMATE = 11_000
  return prompt.length + SYSTEM_CATALOG_ESTIMATE
}

interface MappedError {
  code: string
  detail?: unknown
  status?: number
}

/**
 * Translate LLM errors to the wire code + HTTP status.
 *   InvalidSpecError  → {code: 'invalid_spec', detail: <zod issues>}
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
  service?: ProjectsService
}

async function resolveService(opts: GenerateRoutesOptions): Promise<ProjectsService> {
  if (opts.service) return opts.service
  if (opts.db) return createProjectsService(opts.db)
  const mod = await import('../db/index.js')
  return createProjectsService(mod.getDb())
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export const generateRoutes: FastifyPluginAsync<GenerateRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: GenerateRoutesOptions,
) => {
  const projectsService = await resolveService(opts)
  // Keep a reference to the db for the parent-ACL lookup. Production falls
  // through to the singleton; tests inject their own pool.
  const resolvedDb: Db = opts.db ?? (await import('../db/index.js').then(m => m.getDb()))

  fastify.post('/generate', {preHandler: [requireAuth]}, async (req, reply) => {
    const userId = (req as unknown as AuthenticatedRequest).user.id

    // ------------------------------------------------------------------
    // 1. Body validation — 400 JSON, no SSE (T-0002-045/046/052)
    // ------------------------------------------------------------------
    let body: z.infer<typeof GenerateBodySchema>
    try {
      body = GenerateBodySchema.parse(req.body)
    } catch {
      return reply.code(400).send({error: 'invalid_input'})
    }

    // ------------------------------------------------------------------
    // 2. Rate limit — 400 JSON, no SSE (T-0002-062)
    // ------------------------------------------------------------------
    const rl = rateLimit(`generate:${userId}`, RATE_LIMIT_PER_MINUTE, RATE_LIMIT_WINDOW_MS)
    if (!rl.allowed) {
      reply.header('Retry-After', String(rl.retryAfter))
      return reply.code(429).send({error: 'rate_limited'})
    }

    // ------------------------------------------------------------------
    // 3. Prompt length guard — 400 JSON, no SSE (T-0002-047)
    // ------------------------------------------------------------------
    if (estimateTotalInputChars(body.prompt) >= MAX_TOTAL_INPUT_CHARS) {
      return reply.code(400).send({error: 'prompt_too_large'})
    }

    // ------------------------------------------------------------------
    // 4. parent_project_id ACL — 404 JSON, no SSE (T-0002-060/061)
    //    Project must EITHER be public OR owned by the caller.
    //    If neither → 404 (don't reveal existence).
    // ------------------------------------------------------------------
    let parentPromptContext: string | undefined
    if (body.parent_project_id) {
      const parentRows = await resolvedDb
        .select()
        .from(projects)
        .where(eq(projects.id, body.parent_project_id))
      const parent = parentRows[0]
      if (!parent || (parent.visibility !== 'public' && parent.ownerId !== userId)) {
        return reply.code(404).send({error: 'not_found'})
      }
      parentPromptContext = parent.originalPrompt || undefined
    }

    // ------------------------------------------------------------------
    // 5. Open SSE stream (T-0002-058)
    // ------------------------------------------------------------------
    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache')
    reply.raw.setHeader('X-Accel-Buffering', 'no')
    reply.raw.setHeader('Connection', 'keep-alive')

    // Server keeps streaming even if the client disconnects (ADR-0002 §O).
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
      let doneSpec: A2UISpec | null = null
      let donePlan: Plan | null = null

      for await (const event of runPipeline({
        userId,
        prompt: body.prompt,
        parentPromptContext,
      })) {
        if (event.type === 'done') {
          // Don't emit 'done' yet — need to persist first, then build the
          // enriched done payload that includes project metadata.
          doneSpec = event.spec
          donePlan = event.plan
          thinkingDurationMs = event.thinking_duration_ms
          generationDurationMs = event.generation_duration_ms
        } else {
          // emit thinking_started and building_started immediately
          if (!clientGone) {
            reply.raw.write(`data: ${JSON.stringify(event)}\n\n`)
          }
        }
      }

      // ------------------------------------------------------------------
      // 7. Persist project (runs regardless of clientGone per ADR-0002 §O)
      // ------------------------------------------------------------------
      if (doneSpec === null) {
        // Defensive: generator should always yield 'done' or throw.
        throw new Error('generator completed without done event')
      }

      const detail = await projectsService.create({
        ownerId: userId,
        spec: doneSpec,
        originalPrompt: body.prompt,
        parentProjectId: body.parent_project_id,
        // Translate null back to undefined for the service boundary:
        // plan?: Plan (optional), so null is not accepted.
        plan: donePlan ?? undefined,
      })

      const doneEvent = {
        type: 'done',
        project: {
          id: detail.project.id,
          title: detail.project.title,
          visibility: detail.project.visibility,
          parent_project_id: detail.project.parentProjectId,
          original_prompt: detail.project.originalPrompt,
          created_at: detail.project.createdAt.toISOString(),
        },
        spec: doneSpec,
        plan: donePlan,
        render_hash: detail.currentVersion.renderHash,
        thinking_duration_ms: thinkingDurationMs,
        generation_duration_ms: generationDurationMs,
      }

      if (!clientGone) {
        reply.raw.write(`data: ${JSON.stringify(doneEvent)}\n\n`)
      } else {
        req.log.info(
          {
            userId,
            projectId: detail.project.id,
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

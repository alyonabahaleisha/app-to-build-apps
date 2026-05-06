/**
 * POST /me/projects/:projectId/edit — single-intent edit route (ADR-0004 Step 7).
 *
 * Protocol: JSON request → JSON response. NOT SSE (deferred to a future ADR).
 *
 * Flow:
 *   1. Auth (requireAuth)
 *   2. Body validation — {prompt: string(1–2000)}
 *   3. Rate limit — 30/min/user on counter `edit:${userId}` (separate from `generate:`)
 *   4. Load project + verify ownership — 404 on non-existent or unowned
 *   5. Load current version (spec + plan; plan may be NULL for legacy projects)
 *   6. Call runPipelineEdit({userId, prompt, currentSpec, currentPlan})
 *   7. Persist via projectsService.applyEdit(projectId, newSpec, plan)
 *   8. Return 200 {version_id, render_hash, plan} — structured only (T-0004-101)
 *
 * Error contract (T-0004-088 through T-0004-101):
 *   400 {error: 'invalid_input'}     — missing/empty/too-long prompt
 *   401 {error: 'unauthorized'}      — requireAuth failure
 *   404 {error: 'not_found'}         — project missing or not owned (T-0004-091)
 *   422 {error: 'patch_out_of_scope'} — builder violated target_paths twice (T-0004-094)
 *   422 {error: 'invalid_spec'}      — patch result fails A2UISpecSchema (T-0004-099)
 *   429 {error: 'rate_limited'}      — rate limit hit (T-0004-090)
 *   500 {error: 'internal'}          — all other errors
 *
 * Security notes:
 *   - Ownership check returns 404, not 403 — does not reveal project existence.
 *   - Response body (200) contains only structured plan fields — no prompt text,
 *     no planner trace, no free-text user content (T-0004-101).
 *   - plan field is PlanSchema.safeParse()'d before inclusion to guarantee shape.
 */
import type {FastifyInstance, FastifyPluginAsync} from 'fastify'
import {z} from 'zod'
import type {NodePgDatabase} from 'drizzle-orm/node-postgres'

import {PlanSchema} from '@app-creator/a2ui-schema'
import * as schema from '../db/schema.js'
import {projects} from '../db/schema.js'
import {eq} from 'drizzle-orm'
import {requireAuth, type AuthenticatedRequest} from '../lib/auth.js'
import {safeMessage} from '../lib/logger.js'
import {rateLimit} from '../lib/rateLimit.js'
import {runPipelineEdit} from '../llm/pipeline.js'
import {PatchOutOfScopeError, InvalidSpecError} from '../llm/errors.js'
import {createProjectsService, type ProjectsService} from '../services/projects.service.js'

type Db = NodePgDatabase<typeof schema>

// ---------------------------------------------------------------------------
// Body schema
// ---------------------------------------------------------------------------

const EditBodySchema = z.object({
  prompt: z.string().trim().min(1).max(2000),
})

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const RATE_LIMIT_PER_MINUTE = 30
const RATE_LIMIT_WINDOW_MS = 60_000

// ---------------------------------------------------------------------------
// Route options
// ---------------------------------------------------------------------------

export interface EditRoutesOptions {
  /** Injected by tests; production lazy-loads from db/index.ts. */
  db?: Db
  /** Override the service instance (test-only). */
  service?: ProjectsService
}

async function resolveService(opts: EditRoutesOptions): Promise<ProjectsService> {
  if (opts.service) return opts.service
  if (opts.db) return createProjectsService(opts.db)
  const mod = await import('../db/index.js')
  return createProjectsService(mod.getDb())
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export const editRoutes: FastifyPluginAsync<EditRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: EditRoutesOptions,
) => {
  const projectsService = await resolveService(opts)
  // Keep a reference to the db for the project ownership lookup.
  const resolvedDb: Db = opts.db ?? (await import('../db/index.js').then(m => m.getDb()))

  fastify.post<{Params: {projectId: string}}>(
    '/me/projects/:projectId/edit',
    {preHandler: [requireAuth]},
    async (req, reply) => {
      const userId = (req as unknown as AuthenticatedRequest).user.id
      const projectId = req.params.projectId

      // ------------------------------------------------------------------
      // 1. UUID validation on the path param
      // ------------------------------------------------------------------
      if (!UUID_REGEX.test(projectId)) {
        return reply.code(400).send({error: 'invalid_input'})
      }

      // ------------------------------------------------------------------
      // 2. Body validation — 400 JSON (T-0004-092)
      // ------------------------------------------------------------------
      let body: z.infer<typeof EditBodySchema>
      try {
        body = EditBodySchema.parse(req.body)
      } catch {
        return reply.code(400).send({error: 'invalid_input'})
      }

      // ------------------------------------------------------------------
      // 3. Rate limit on separate counter (T-0004-090)
      // ------------------------------------------------------------------
      const rl = rateLimit(`edit:${userId}`, RATE_LIMIT_PER_MINUTE, RATE_LIMIT_WINDOW_MS)
      if (!rl.allowed) {
        reply.header('Retry-After', String(rl.retryAfter))
        return reply.code(429).send({error: 'rate_limited'})
      }

      // ------------------------------------------------------------------
      // 4. Load project + ownership check (T-0004-091)
      //    404 for missing OR unowned — don't reveal existence.
      // ------------------------------------------------------------------
      const projectRows = await resolvedDb
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
      const project = projectRows[0]

      if (!project || project.ownerId !== userId) {
        return reply.code(404).send({error: 'not_found'})
      }

      if (project.currentVersionId === null) {
        // Defensive: project exists but has no version (partial write).
        return reply.code(404).send({error: 'not_found'})
      }

      // ------------------------------------------------------------------
      // 5. Load current version (spec + plan)
      //    plan may be NULL for legacy projects (T-0004-100).
      // ------------------------------------------------------------------
      const currentVersion = await projectsService.getVersion(project.currentVersionId)
      if (!currentVersion) {
        return reply.code(404).send({error: 'not_found'})
      }

      // planJson is unknown from the DB; parse it or treat as undefined.
      let currentPlan: ReturnType<typeof PlanSchema.parse> | undefined
      if (currentVersion.planJson !== null && currentVersion.planJson !== undefined) {
        const parsed = PlanSchema.safeParse(currentVersion.planJson)
        currentPlan = parsed.success ? parsed.data : undefined
      }

      // currentSpec is A2UISpec from the DB (already validated on write).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const currentSpec = currentVersion.specJson as any

      // ------------------------------------------------------------------
      // 6. Run the edit pipeline
      // ------------------------------------------------------------------
      let newSpec: Awaited<ReturnType<typeof runPipelineEdit>>['newSpec']
      let plan: Awaited<ReturnType<typeof runPipelineEdit>>['plan']

      try {
        const result = await runPipelineEdit({
          userId,
          prompt: body.prompt,
          currentSpec,
          currentPlan,
        })
        newSpec = result.newSpec
        plan = result.plan
      } catch (err) {
        if (err instanceof PatchOutOfScopeError) {
          return reply.code(422).send({error: 'patch_out_of_scope'})
        }
        if (err instanceof InvalidSpecError) {
          return reply.code(422).send({error: 'invalid_spec'})
        }
        req.log.error({err: safeMessage(err), userId, projectId}, 'edit_pipeline_failed')
        return reply.code(500).send({error: 'internal'})
      }

      // ------------------------------------------------------------------
      // 7. Persist
      // ------------------------------------------------------------------
      let detail: Awaited<ReturnType<typeof projectsService.applyEdit>>

      try {
        detail = await projectsService.applyEdit(projectId, newSpec, plan)
      } catch (err) {
        req.log.error({err: safeMessage(err), userId, projectId}, 'edit_persist_failed')
        return reply.code(500).send({error: 'internal'})
      }

      // ------------------------------------------------------------------
      // 8. Return 200 — structured plan only (T-0004-101)
      //    Never echo prompt or any free-text user content.
      //    Validate the plan shape before including it in the response.
      // ------------------------------------------------------------------
      const safePlan = PlanSchema.safeParse(plan)

      req.log.info(
        {
          userId,
          projectId,
          versionId: detail.currentVersion.id,
          action: 'project.edit',
        },
        'project_edit',
      )

      return reply.code(200).send({
        version_id: detail.currentVersion.id,
        render_hash: detail.currentVersion.renderHash,
        plan: safePlan.success ? safePlan.data : null,
      })
    },
  )
}

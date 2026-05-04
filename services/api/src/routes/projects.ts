/**
 * Projects routes — ADR-0001 Step 4 / ADR-0002 Step 7.
 *
 *   GET /me/projects        — auth-required. Lists the caller's projects
 *                             sorted by updated_at DESC. Body shape is
 *                             strictly {projects: ProjectListItem[]}; specJson
 *                             is NEVER present on the list (T-0001-064 /
 *                             `userCount` retro-lesson).
 *
 *   GET /me/projects/:id    — auth-required. Returns {project, currentVersion}
 *                             for the owner. For non-owners OR non-existent
 *                             projects, returns 404 {error: 'not_found'} —
 *                             NOT 403, to avoid leaking project existence
 *                             (T-0001-056, T-0001-065).
 *
 * ADR-0002 Step 7: renamed from /projects → /me/projects to align with the
 * user-scoped namespace. Old paths (/projects, /projects/:id) are no longer
 * registered — Fastify returns 404 by default (T-0002-126, T-0002-127).
 *
 * Audit log (T-0001-120): every successful GET /me/projects/:id emits a single
 * structured INFO record `{userId, projectId, action: 'project.read',
 * durationMs}`. No email, no spec contents, no token.
 *
 * Error contract:
 *   - 400 {error: 'invalid_input'}   — malformed UUID on :id.
 *   - 401 {error: 'unauthorized'}    — handled by `requireAuth`.
 *   - 404 {error: 'not_found'}       — project missing OR not owned.
 *   - 500 {error: 'internal'}        — bubbles from service via safeMessage.
 */
import type {FastifyInstance, FastifyPluginAsync} from 'fastify'
import type {NodePgDatabase} from 'drizzle-orm/node-postgres'

import * as schema from '../db/schema.js'
import {requireAuth, type AuthenticatedRequest} from '../lib/auth.js'
import {safeMessage} from '../lib/logger.js'
import {createProjectsService, type ProjectsService} from '../services/projects.service.js'

type Db = NodePgDatabase<typeof schema>

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface ProjectsRoutesOptions {
  /**
   * Drizzle instance the route's service binding uses. Tests inject the
   * testcontainers-bound db; production omits this and we lazy-load the
   * singleton from `db/index.ts`.
   */
  db?: Db
  /** Override the service instance (test-only — DB-down simulation). */
  service?: ProjectsService
}

async function resolveService(opts: ProjectsRoutesOptions): Promise<ProjectsService> {
  if (opts.service) return opts.service
  if (opts.db) return createProjectsService(opts.db)
  const mod = await import('../db/index.js')
  return createProjectsService(mod.getDb())
}

export const projectsRoutes: FastifyPluginAsync<ProjectsRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: ProjectsRoutesOptions,
) => {
  const service = await resolveService(opts)

  // -------------------------------------------------------------------------
  // GET /me/projects  (auth-required)
  // -------------------------------------------------------------------------
  fastify.get('/me/projects', {preHandler: [requireAuth]}, async (req, reply) => {
    const authed = req as unknown as AuthenticatedRequest
    const userId = authed.user.id
    const t0 = performance.now()

    try {
      const items = await service.list(userId)
      // ISO-string the timestamps so the JSON body is deterministic and
      // JSON-Schema-validatable. Drizzle returns Dates; we control the wire
      // shape here (the ProjectListItem type still uses Date in TS-land).
      const projects = items.map((p) => ({
        id: p.id,
        title: p.title,
        currentVersionId: p.currentVersionId,
        parentProjectId: p.parentProjectId,
        updatedAt: p.updatedAt.toISOString(),
        createdAt: p.createdAt.toISOString(),
      }))

      req.log.info(
        {
          userId,
          action: 'project.list',
          count: projects.length,
          durationMs: Math.round(performance.now() - t0),
        },
        'project_list',
      )

      return reply.code(200).send({projects})
    } catch (err) {
      req.log.error({err: safeMessage(err)}, 'projects_list_failed')
      return reply.code(500).send({error: 'internal'})
    }
  })

  // -------------------------------------------------------------------------
  // GET /me/projects/:id  (auth-required)
  // -------------------------------------------------------------------------
  fastify.get<{Params: {id: string}}>(
    '/me/projects/:id',
    {preHandler: [requireAuth]},
    async (req, reply) => {
      const authed = req as unknown as AuthenticatedRequest
      const userId = authed.user.id
      const projectId = req.params.id

      if (!UUID_REGEX.test(projectId)) {
        // Strict shape: {error}. No `detail`, no echo of the bad input.
        return reply.code(400).send({error: 'invalid_input'})
      }

      const t0 = performance.now()
      try {
        const detail = await service.get(userId, projectId)
        if (!detail) {
          // 404 — NOT 403. The route does NOT distinguish "doesn't exist"
          // from "exists but not yours" — that's the security win
          // (T-0001-065).
          return reply.code(404).send({error: 'not_found'})
        }

        const body = {
          project: {
            id: detail.project.id,
            ownerId: detail.project.ownerId,
            title: detail.project.title,
            currentVersionId: detail.project.currentVersionId,
            parentProjectId: detail.project.parentProjectId,
            createdAt: detail.project.createdAt.toISOString(),
            updatedAt: detail.project.updatedAt.toISOString(),
          },
          currentVersion: {
            id: detail.currentVersion.id,
            projectId: detail.currentVersion.projectId,
            specJson: detail.currentVersion.specJson,
            renderHash: detail.currentVersion.renderHash,
            createdAt: detail.currentVersion.createdAt.toISOString(),
          },
        }

        req.log.info(
          {
            userId,
            projectId,
            action: 'project.read',
            durationMs: Math.round(performance.now() - t0),
          },
          'project_read',
        )

        return reply.code(200).send(body)
      } catch (err) {
        req.log.error({err: safeMessage(err)}, 'projects_get_failed')
        return reply.code(500).send({error: 'internal'})
      }
    },
  )
}

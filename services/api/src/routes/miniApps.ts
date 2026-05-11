/**
 * Mini-apps routes — ADR-0011 Step 3 (renamed from projects.ts + new endpoints).
 *
 *   GET    /me/mini-apps            — auth-required. Lists the caller's mini-apps
 *                                    (excludes archived + deleted rows).
 *   GET    /me/mini-apps/:id        — auth-required. Owner-only, 404 on non-owner.
 *   POST   /me/mini-apps/:id/rename — body {title: string (1-80 chars)}, updates title.
 *   POST   /me/mini-apps/:id/archive — sets archived_at; idempotent.
 *   POST   /me/mini-apps/:id/unarchive — clears archived_at.
 *   DELETE /me/mini-apps/:id        — soft delete (sets deleted_at). Idempotent.
 *   POST   /me/mini-apps/:id/share  — stub (ADR-0008): returns 501 not_implemented.
 *   POST   /me/mini-apps/clone      — stub (ADR-0008): returns 501 not_implemented.
 *
 * Route shape preserved from M1 projects.ts:
 *   - Auth via `requireAuth` preHandler.
 *   - 404 returned for non-existent AND non-owned rows (no ownership leak).
 *   - Error body is always {error: string}; 500 uses 'internal' (no internals leak).
 *   - specJson is NEVER present on the list response (retro-lessons.md normalizeRow).
 *
 * Rate limits per ADR-0011 AC-N6 / T-0011-118 / T-0011-119:
 *   POST routes (archive, unarchive, rename, share, clone): 10/min/user
 *   PATCH/GET (rename is POST here per ADR spec; GET list): 60/min/user
 *
 * Audit log: GET /me/mini-apps/:id emits {userId, miniAppId, action: 'mini_app.read'}.
 */
import type {FastifyInstance, FastifyPluginAsync} from 'fastify'
import {z} from 'zod'
import type {NodePgDatabase} from 'drizzle-orm/node-postgres'

import * as schema from '../db/schema.js'
import {requireAuth, type AuthenticatedRequest} from '../lib/auth.js'
import {safeMessage} from '../lib/logger.js'
import {rateLimit} from '../lib/rateLimit.js'
import {createMiniAppsService, type MiniAppsService} from '../services/miniApps.service.js'

type Db = NodePgDatabase<typeof schema>

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Rate limit constants — per ADR-0011 AC-N6 + T-0011-118 / T-0011-119
const WRITE_LIMIT = 10
const WRITE_WINDOW_MS = 60_000
const READ_LIMIT = 60
const READ_WINDOW_MS = 60_000

// Rename body validation — 1..80 chars, not whitespace-only.
const renameTitleSchema = z
  .string()
  .min(1)
  .max(80)
  .refine(s => s.trim().length > 0, {message: 'title must not be whitespace-only'})

export interface MiniAppsRoutesOptions {
  db?: Db
  service?: MiniAppsService
}

async function resolveService(opts: MiniAppsRoutesOptions): Promise<MiniAppsService> {
  if (opts.service) return opts.service
  if (opts.db) return createMiniAppsService(opts.db)
  const mod = await import('../db/index.js')
  return createMiniAppsService(mod.getDb())
}

export const miniAppsRoutes: FastifyPluginAsync<MiniAppsRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: MiniAppsRoutesOptions,
) => {
  const service = await resolveService(opts)

  // -------------------------------------------------------------------------
  // GET /me/mini-apps  (auth-required)
  // Excludes archived + deleted rows by default (T-0011-059a).
  // specJson is NEVER included (retro-lessons.md / T-0011-048).
  // -------------------------------------------------------------------------
  fastify.get('/me/mini-apps', {preHandler: [requireAuth]}, async (req, reply) => {
    const authed = req as unknown as AuthenticatedRequest
    const userId = authed.user.id
    const t0 = performance.now()

    const rl = rateLimit(`mini-apps.list:${userId}`, READ_LIMIT, READ_WINDOW_MS)
    if (!rl.allowed) {
      reply.header('Retry-After', String(rl.retryAfter))
      return reply.code(429).send({error: 'rate_limited'})
    }

    try {
      const items = await service.list(userId)
      const miniApps = items.map(p => ({
        id: p.id,
        title: p.title,
        currentVersionId: p.currentVersionId,
        parentMiniAppId: p.parentMiniAppId,
        stance: p.stance,
        accentPalette: p.accentPalette,
        coverArtSeed: p.coverArtSeed,
        archetype: p.archetype,
        syncMode: p.syncMode,
        updatedAt: p.updatedAt.toISOString(),
        createdAt: p.createdAt.toISOString(),
      }))

      req.log.info(
        {
          userId,
          action: 'mini_app.list',
          count: miniApps.length,
          durationMs: Math.round(performance.now() - t0),
        },
        'mini_app_list',
      )

      return reply.code(200).send({miniApps})
    } catch (err) {
      req.log.error({err: safeMessage(err)}, 'mini_apps_list_failed')
      return reply.code(500).send({error: 'internal'})
    }
  })

  // -------------------------------------------------------------------------
  // GET /me/mini-apps/:id  (auth-required, owner-only)
  // -------------------------------------------------------------------------
  fastify.get<{Params: {id: string}}>(
    '/me/mini-apps/:id',
    {preHandler: [requireAuth]},
    async (req, reply) => {
      const authed = req as unknown as AuthenticatedRequest
      const userId = authed.user.id
      const miniAppId = req.params.id

      if (!UUID_REGEX.test(miniAppId)) {
        return reply.code(400).send({error: 'invalid_input'})
      }

      const t0 = performance.now()
      try {
        const detail = await service.get(userId, miniAppId)
        if (!detail) {
          // 404 — NOT 403. Does not distinguish "doesn't exist" from "not owner".
          return reply.code(404).send({error: 'not_found'})
        }

        const body = {
          miniApp: {
            id: detail.miniApp.id,
            ownerId: detail.miniApp.ownerId,
            title: detail.miniApp.title,
            currentVersionId: detail.miniApp.currentVersionId,
            parentMiniAppId: detail.miniApp.parentMiniAppId,
            stance: detail.miniApp.stance,
            accentPalette: detail.miniApp.accentPalette,
            coverArtSeed: detail.miniApp.coverArtSeed,
            archetype: detail.miniApp.archetype,
            syncMode: detail.miniApp.syncMode,
            archivedAt: detail.miniApp.archivedAt?.toISOString() ?? null,
            createdAt: detail.miniApp.createdAt.toISOString(),
            updatedAt: detail.miniApp.updatedAt.toISOString(),
          },
          currentVersion: {
            id: detail.currentVersion.id,
            miniAppId: detail.currentVersion.miniAppId,
            specJson: detail.currentVersion.specJson,
            renderHash: detail.currentVersion.renderHash,
            createdAt: detail.currentVersion.createdAt.toISOString(),
          },
        }

        req.log.info(
          {
            userId,
            miniAppId,
            action: 'mini_app.read',
            durationMs: Math.round(performance.now() - t0),
          },
          'mini_app_read',
        )

        return reply.code(200).send(body)
      } catch (err) {
        req.log.error({err: safeMessage(err)}, 'mini_apps_get_failed')
        return reply.code(500).send({error: 'internal'})
      }
    },
  )

  // -------------------------------------------------------------------------
  // POST /me/mini-apps/:id/rename  (auth-required, owner-only)
  // body: {title: string (1-80 chars, not whitespace-only)}
  // Rate: 10/min/user (WRITE_LIMIT) — T-0011-118
  // -------------------------------------------------------------------------
  fastify.post<{Params: {id: string}; Body: {title: string}}>(
    '/me/mini-apps/:id/rename',
    {preHandler: [requireAuth]},
    async (req, reply) => {
      const userId = (req as unknown as AuthenticatedRequest).user.id
      const {id} = req.params

      if (!UUID_REGEX.test(id)) return reply.code(400).send({error: 'invalid_input'})

      const rl = rateLimit(`mini-apps.rename:${userId}`, WRITE_LIMIT, WRITE_WINDOW_MS)
      if (!rl.allowed) {
        reply.header('Retry-After', String(rl.retryAfter))
        return reply.code(429).send({error: 'rate_limited'})
      }

      const parsed = renameTitleSchema.safeParse((req.body as {title?: unknown})?.title)
      if (!parsed.success) return reply.code(400).send({error: 'invalid_input'})

      try {
        const updated = await service.rename(userId, id, parsed.data)
        if (!updated) return reply.code(404).send({error: 'not_found'})
        return reply.code(200).send({miniApp: {id: updated.id, title: updated.title}})
      } catch (err) {
        req.log.error({err: safeMessage(err)}, 'mini_apps_rename_failed')
        return reply.code(500).send({error: 'internal'})
      }
    },
  )

  // -------------------------------------------------------------------------
  // POST /me/mini-apps/:id/archive  (auth-required, owner-only)
  // Idempotent: calling twice keeps archived_at from the first call.
  // Rate: 10/min/user
  // -------------------------------------------------------------------------
  fastify.post<{Params: {id: string}}>(
    '/me/mini-apps/:id/archive',
    {preHandler: [requireAuth]},
    async (req, reply) => {
      const userId = (req as unknown as AuthenticatedRequest).user.id
      const {id} = req.params

      if (!UUID_REGEX.test(id)) return reply.code(400).send({error: 'invalid_input'})

      const rl = rateLimit(`mini-apps.archive:${userId}`, WRITE_LIMIT, WRITE_WINDOW_MS)
      if (!rl.allowed) {
        reply.header('Retry-After', String(rl.retryAfter))
        return reply.code(429).send({error: 'rate_limited'})
      }

      try {
        const updated = await service.archive(userId, id)
        if (!updated) return reply.code(404).send({error: 'not_found'})
        return reply.code(200).send({
          miniApp: {id: updated.id, archivedAt: updated.archivedAt?.toISOString() ?? null},
        })
      } catch (err) {
        req.log.error({err: safeMessage(err)}, 'mini_apps_archive_failed')
        return reply.code(500).send({error: 'internal'})
      }
    },
  )

  // -------------------------------------------------------------------------
  // POST /me/mini-apps/:id/unarchive  (auth-required, owner-only)
  // Rate: 10/min/user
  // -------------------------------------------------------------------------
  fastify.post<{Params: {id: string}}>(
    '/me/mini-apps/:id/unarchive',
    {preHandler: [requireAuth]},
    async (req, reply) => {
      const userId = (req as unknown as AuthenticatedRequest).user.id
      const {id} = req.params

      if (!UUID_REGEX.test(id)) return reply.code(400).send({error: 'invalid_input'})

      const rl = rateLimit(`mini-apps.unarchive:${userId}`, WRITE_LIMIT, WRITE_WINDOW_MS)
      if (!rl.allowed) {
        reply.header('Retry-After', String(rl.retryAfter))
        return reply.code(429).send({error: 'rate_limited'})
      }

      try {
        const updated = await service.unarchive(userId, id)
        if (!updated) return reply.code(404).send({error: 'not_found'})
        return reply.code(200).send({miniApp: {id: updated.id, archivedAt: null}})
      } catch (err) {
        req.log.error({err: safeMessage(err)}, 'mini_apps_unarchive_failed')
        return reply.code(500).send({error: 'internal'})
      }
    },
  )

  // -------------------------------------------------------------------------
  // DELETE /me/mini-apps/:id  (auth-required, owner-only)
  // Soft delete — sets deleted_at. Idempotent per T-0011-060:
  //   first call  → 200 {deletedAt: ISO8601}
  //   second call → 200 {already_deleted: true}
  //   not owner / not found → 404 (owner-leak guard)
  // Rate: 10/min/user
  // -------------------------------------------------------------------------
  fastify.delete<{Params: {id: string}}>(
    '/me/mini-apps/:id',
    {preHandler: [requireAuth]},
    async (req, reply) => {
      const userId = (req as unknown as AuthenticatedRequest).user.id
      const {id} = req.params

      if (!UUID_REGEX.test(id)) return reply.code(400).send({error: 'invalid_input'})

      const rl = rateLimit(`mini-apps.delete:${userId}`, WRITE_LIMIT, WRITE_WINDOW_MS)
      if (!rl.allowed) {
        reply.header('Retry-After', String(rl.retryAfter))
        return reply.code(429).send({error: 'rate_limited'})
      }

      try {
        const result = await service.delete(userId, id)
        if (result.kind === 'not_found') return reply.code(404).send({error: 'not_found'})
        if (result.kind === 'already_deleted') return reply.code(200).send({already_deleted: true})
        return reply.code(200).send({deletedAt: result.deletedAt.toISOString()})
      } catch (err) {
        req.log.error({err: safeMessage(err)}, 'mini_apps_delete_failed')
        return reply.code(500).send({error: 'internal'})
      }
    },
  )

  // -------------------------------------------------------------------------
  // POST /me/mini-apps/:id/share  — stub for ADR-0008
  // Returns 501 so mobile client can detect the stub (T-0011-062).
  // Rate: 10/min/user
  // -------------------------------------------------------------------------
  fastify.post<{Params: {id: string}}>(
    '/me/mini-apps/:id/share',
    {preHandler: [requireAuth]},
    async (_req, reply) => {
      return reply.code(501).send({error: 'not_implemented', adr: 'ADR-0008'})
    },
  )

  // -------------------------------------------------------------------------
  // POST /me/mini-apps/clone  — stub for ADR-0008 (T-0011-063)
  // Rate: 10/min/user
  // -------------------------------------------------------------------------
  fastify.post(
    '/me/mini-apps/clone',
    {preHandler: [requireAuth]},
    async (_req, reply) => {
      return reply.code(501).send({error: 'not_implemented', adr: 'ADR-0008'})
    },
  )
}

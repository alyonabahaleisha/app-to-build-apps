/**
 * Clones + share-link routes — ADR-0008 Step 3.
 *
 * NOT registered in server.ts (per ADR-0008 PR 1 scope brief — deferred to
 * follow-up commit unifying ADR-0008 + ADR-0013 /auth/apple registrations).
 * Export the plugin function; the follow-up commit wires it.
 *
 * Routes:
 *   POST /mini-apps/:id/share-links  — auth-required, owner-only, 10/min.
 *     Creates a share link for the caller's mini_app. Returns {share_id, universal_link}.
 *
 *   POST /clones  — auth-required, 10/min.
 *     Accepts {share_id}; calls acceptCloneIntent; returns {cloned_mini_app_id}.
 *     200 on idempotent re-clone; 201 on first clone.
 *
 *   GET /m/:share_id/clone  — public, resolves to redirect target (Universal Link endpoint).
 *     In V0 the server returns 200 with a redirect payload; the iOS AASA association
 *     causes the OS to intercept the URL before it reaches Safari.
 *
 *   GET /m/:share_id/view   — 200 {mode:'view', supported:false} (AC-P9 reserved).
 *   GET /m/:share_id/remix  — 200 {mode:'remix', supported:false} (AC-P9 reserved).
 *
 * Security:
 *   - Clone response NEVER includes source_mini_app_id, source_owner_user_id,
 *     source_version_id (AC-P8). Enforced at service layer AND verified by tests.
 *   - Owner-check for share creation returns 404 (not 403) to avoid leaking existence.
 *
 * Telemetry events emitted:
 *   share_link.created        — on successful share link creation
 *   share_link.clone_accepted — on clone (idempotent_hit: bool, source_archetype: string)
 *
 * Rate limits: 10 req/min per user on all POST routes (AC-N6).
 */
import type {FastifyInstance, FastifyPluginAsync} from 'fastify'
import type {NodePgDatabase} from 'drizzle-orm/node-postgres'

import * as schema from '../db/schema.js'
import {requireAuth, type AuthenticatedRequest} from '../lib/auth.js'
import {safeMessage} from '../lib/logger.js'
import {rateLimit} from '../lib/rateLimit.js'
import {writeEvent} from '../llm/telemetry.js'
import {
  createShareLinkService,
  NotFoundError,
  ShareNotFoundError,
  RevokedError,
  type ShareLinkService,
} from '../services/shareLink.service.js'

type Db = NodePgDatabase<typeof schema>

const WRITE_LIMIT = 10
const WRITE_WINDOW_MS = 60_000

const SHARE_ID_REGEX = /^[0-9A-Za-z]{24}$/
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface ClonesRoutesOptions {
  db?: Db
  service?: ShareLinkService
}

async function resolveService(opts: ClonesRoutesOptions): Promise<ShareLinkService> {
  if (opts.service) return opts.service
  if (opts.db) return createShareLinkService(opts.db)
  const mod = await import('../db/index.js')
  return createShareLinkService(mod.getDb())
}

export const clonesRoutes: FastifyPluginAsync<ClonesRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: ClonesRoutesOptions,
) => {
  const service = await resolveService(opts)

  // ---------------------------------------------------------------------------
  // POST /mini-apps/:id/share-links — create a share link (owner only)
  // T-0008-038..049
  // ---------------------------------------------------------------------------
  fastify.post<{Params: {id: string}}>(
    '/mini-apps/:id/share-links',
    {preHandler: [requireAuth]},
    async (req, reply) => {
      const authed = req as unknown as AuthenticatedRequest
      const userId = authed.user.id
      const {id: miniAppId} = req.params

      if (!UUID_REGEX.test(miniAppId)) {
        return reply.code(400).send({error: 'invalid_mini_app_id'})
      }

      const rl = rateLimit(`share.create:${userId}`, WRITE_LIMIT, WRITE_WINDOW_MS)
      if (!rl.allowed) {
        reply.header('Retry-After', String(rl.retryAfter))
        return reply.code(429).send({error: 'rate_limited'})
      }

      try {
        const result = await service.createShareLink(userId, miniAppId)

        // Telemetry — T-0008-049. share_id_prefix is the first 4 chars (sortable bucket).
        // Errors are swallowed (telemetry never blocks the response).
        writeEvent(
          'share_link.created',
          {share_id_prefix: result.shareId.slice(0, 4), source_archetype: 'unknown'},
        ).catch(() => {})

        // Public-safe shape: share_id + universal_link only. T-0008-047.
        return reply.code(201).send({
          share_id: result.shareId,
          universal_link: result.url,
        })
      } catch (err) {
        if (err instanceof NotFoundError) return reply.code(404).send({error: 'not_found'})
        req.log.error({err: safeMessage(err)}, 'share_create_failed')
        return reply.code(500).send({error: 'internal'})
      }
    },
  )

  // ---------------------------------------------------------------------------
  // POST /clones — accept a clone intent (auth required)
  // T-0008-060..081
  // ---------------------------------------------------------------------------
  fastify.post(
    '/clones',
    {
      preHandler: [requireAuth],
      schema: {
        body: {
          type: 'object',
          required: ['share_id'],
          properties: {
            share_id: {type: 'string', minLength: 24, maxLength: 24},
          },
          additionalProperties: false,
        },
      },
    },
    async (req, reply) => {
      const authed = req as unknown as AuthenticatedRequest
      const userId = authed.user.id
      const body = req.body as {share_id: string}
      const shareId = body.share_id

      if (!SHARE_ID_REGEX.test(shareId)) {
        return reply.code(400).send({error: 'invalid_share_id'})
      }

      const rl = rateLimit(`clone:${userId}`, WRITE_LIMIT, WRITE_WINDOW_MS)
      if (!rl.allowed) {
        reply.header('Retry-After', String(rl.retryAfter))
        return reply.code(429).send({error: 'rate_limited'})
      }

      try {
        const result = await service.acceptCloneIntent(shareId, userId)

        // Telemetry — T-0008-080, T-0008-081. Swallowed on error.
        writeEvent('share_link.clone_accepted', {
          share_id_prefix: shareId.slice(0, 4),
          idempotent_hit: !result.created,
          source_archetype: 'unknown',
        }).catch(() => {})

        // Public-safe response: cloned_mini_app_id only at the top level.
        // Full shape in nested mini_app object — no source identifiers. T-0008-072.
        return reply.code(result.created ? 201 : 200).send({
          cloned_mini_app_id: result.miniApp.id,
          mini_app: {
            id: result.miniApp.id,
            title: result.miniApp.title,
            owner_user_id: result.miniApp.ownerUserId,
            cover_art_seed: result.miniApp.coverArtSeed,
            stance: result.miniApp.stance,
            accent_palette: result.miniApp.accentPalette,
            archetype: result.miniApp.archetype,
          },
          current_version: {
            id: result.currentVersion.id,
            mini_app_id: result.currentVersion.miniAppId,
            render_hash: result.currentVersion.renderHash,
          },
        })
      } catch (err) {
        if (err instanceof ShareNotFoundError) {
          // T-0008-052b: exact string 'share_not_found', no trailing punctuation.
          return reply.code(404).send({error: 'share_not_found'})
        }
        if (err instanceof RevokedError) {
          return reply.code(410).send({error: 'share_revoked'})
        }
        req.log.error({err: safeMessage(err)}, 'clone_failed')
        return reply.code(500).send({error: 'internal'})
      }
    },
  )

  // ---------------------------------------------------------------------------
  // GET /m/:share_id/clone — Universal Link target (AC-P7)
  // Returns 200 with a structured response. The iOS AASA intercepts this URL
  // before it reaches Safari; this server route exists for non-iOS callers
  // (web browsers see the response; iOS native app gets the Universal Link).
  // T-0008-050..059 (via public share-link lookup)
  // ---------------------------------------------------------------------------
  fastify.get<{Params: {share_id: string}}>(
    '/m/:share_id/clone',
    {},
    async (req, reply) => {
      const {share_id: shareId} = req.params

      // Permissive on length — treat wrong length as "not found" (T-0008-054)
      const publicView = await service.getShareLinkPublicView(shareId).catch(() => null)
      if (!publicView) {
        return reply.code(404).send({error: 'share_not_found'})
      }

      return reply.code(200).send({
        share_id: publicView.shareId,
        cover_stance: publicView.coverStance,
        cover_palette: publicView.coverPalette,
        cover_icon: publicView.coverIcon,
        cover_art_seed: publicView.coverArtSeed,
        modes: {
          clone: {supported: true},
          view: {supported: false, reason: 'reserved_for_future_version'},
          remix: {supported: false, reason: 'reserved_for_future_version'},
        },
      })
    },
  )

  // ---------------------------------------------------------------------------
  // GET /m/:share_id/view — reserved mode, AC-P9
  // 200 with supported:false. NOT a 410 (410 = "gone"; reserved = "coming soon").
  // ---------------------------------------------------------------------------
  fastify.get<{Params: {share_id: string}}>(
    '/m/:share_id/view',
    {},
    async (_req, reply) => {
      return reply.code(200).send({
        mode: 'view',
        supported: false,
        reason: 'reserved_for_future_version',
      })
    },
  )

  // ---------------------------------------------------------------------------
  // GET /m/:share_id/remix — reserved mode, AC-P9
  // ---------------------------------------------------------------------------
  fastify.get<{Params: {share_id: string}}>(
    '/m/:share_id/remix',
    {},
    async (_req, reply) => {
      return reply.code(200).send({
        mode: 'remix',
        supported: false,
        reason: 'reserved_for_future_version',
      })
    },
  )
}

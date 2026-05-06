/**
 * Marketplace routes — ADR-0002 Step 5.
 *
 *   POST /projects/:id/publish   — auth-required, owner-only, rate 60/min/user.
 *   POST /projects/:id/unpublish — auth-required, owner-only, rate 60/min/user.
 *   POST /users/me/handle        — auth-required, rate 30/min/user.
 *   GET  /handles/check?h=...    — auth-required, rate 60/min/user.
 *
 * Error contract (consistent with ADR-0001's {error: string} envelope):
 *   400 handle_required / invalid_handle / handle_reserved / handle_taken /
 *       handle_immutable / invalid_input / invalid_state
 *   401 unauthorized — from requireAuth
 *   404 not_found    — project absent OR caller not owner (don't leak existence)
 *   429 rate_limited — caller over per-route-per-user limit
 *   500 internal     — all other errors; raw message logged via safeMessage
 *
 * Security notes:
 *   - Responses never include raw email, owner_id, or original_prompt
 *     (T-0002-096, T-0002-097).
 *   - published_at is ISO-stringed on the wire (same pattern as ADR-0001 dates).
 */
import type {FastifyInstance, FastifyPluginAsync} from 'fastify'
import {z} from 'zod'
import type {NodePgDatabase} from 'drizzle-orm/node-postgres'

import * as schema from '../db/schema.js'
import {requireAuth, type AuthenticatedRequest} from '../lib/auth.js'
import {safeMessage} from '../lib/logger.js'
import {rateLimit} from '../lib/rateLimit.js'
import {
  createMarketplaceService,
  type MarketplaceService,
  HandleRequiredError,
  InvalidHandleError,
  HandleReservedError,
  HandleTakenError,
  HandleImmutableError,
  NotFoundError,
  InvalidStateError,
} from '../services/marketplace.service.js'

type Db = NodePgDatabase<typeof schema>

// ---------------------------------------------------------------------------
// Body + query schemas
// ---------------------------------------------------------------------------

const PublishBodySchema = z.object({
  handle: z.string().optional(),
})

const SetHandleBodySchema = z.object({
  handle: z.string(),
})

const HandleCheckQuerySchema = z.object({
  h: z.string().min(1),
})

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const RATE_LIMIT_WINDOW_MS = 60_000
const RL_PUBLISH = 60
const RL_UNPUBLISH = 60
const RL_SET_HANDLE = 30
const RL_CHECK_HANDLE = 60
const RL_SUGGEST_HANDLE = 30

// ---------------------------------------------------------------------------
// Route options
// ---------------------------------------------------------------------------

export interface MarketplaceRoutesOptions {
  /** Injected by tests; production uses the singleton from db/index.ts. */
  db?: Db
  /** Override the service instance (test-only). */
  service?: MarketplaceService
}

async function resolveService(opts: MarketplaceRoutesOptions): Promise<MarketplaceService> {
  if (opts.service) return opts.service
  if (opts.db) return createMarketplaceService(opts.db)
  const mod = await import('../db/index.js')
  return createMarketplaceService(mod.getDb())
}

// ---------------------------------------------------------------------------
// Error → status + body mapping
// ---------------------------------------------------------------------------

function mapServiceError(
  err: unknown,
): {status: number; body: {error: string; detail?: unknown}} | null {
  if (err instanceof NotFoundError) return {status: 404, body: {error: 'not_found'}}
  if (err instanceof HandleRequiredError) return {status: 400, body: {error: 'handle_required'}}
  if (err instanceof InvalidHandleError) return {status: 400, body: {error: 'invalid_handle'}}
  if (err instanceof HandleReservedError) return {status: 400, body: {error: 'handle_reserved'}}
  if (err instanceof HandleTakenError) return {status: 400, body: {error: 'handle_taken'}}
  if (err instanceof HandleImmutableError) return {status: 400, body: {error: 'handle_immutable'}}
  if (err instanceof InvalidStateError) return {status: 400, body: {error: 'invalid_state'}}
  return null
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export const marketplaceRoutes: FastifyPluginAsync<MarketplaceRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: MarketplaceRoutesOptions,
) => {
  const service = await resolveService(opts)

  // -------------------------------------------------------------------------
  // POST /projects/:id/publish
  // -------------------------------------------------------------------------
  fastify.post<{Params: {id: string}}>(
    '/projects/:id/publish',
    {preHandler: [requireAuth]},
    async (req, reply) => {
      const userId = (req as unknown as AuthenticatedRequest).user.id
      const projectId = req.params.id

      // UUID validation
      if (!UUID_REGEX.test(projectId)) {
        return reply.code(400).send({error: 'invalid_input'})
      }

      // Rate limit
      const rl = rateLimit(`publish:${userId}`, RL_PUBLISH, RATE_LIMIT_WINDOW_MS)
      if (!rl.allowed) {
        reply.header('Retry-After', String(rl.retryAfter))
        return reply.code(429).send({error: 'rate_limited'})
      }

      // Body validation (handle is optional)
      let body: z.infer<typeof PublishBodySchema>
      try {
        body = PublishBodySchema.parse(req.body)
      } catch {
        return reply.code(400).send({error: 'invalid_input'})
      }

      try {
        const result = await service.publish({
          userId,
          projectId,
          handle: body.handle,
        })

        req.log.info({userId, projectId, action: 'project.publish'}, 'project_published')

        return reply.code(200).send({
          project: {
            ...result.project,
            published_at: result.project.published_at.toISOString(),
          },
        })
      } catch (err) {
        const mapped = mapServiceError(err)
        if (mapped) return reply.code(mapped.status).send(mapped.body)
        req.log.error({err: safeMessage(err), userId, projectId}, 'publish_failed')
        return reply.code(500).send({error: 'internal'})
      }
    },
  )

  // -------------------------------------------------------------------------
  // POST /projects/:id/unpublish
  // -------------------------------------------------------------------------
  fastify.post<{Params: {id: string}}>(
    '/projects/:id/unpublish',
    {preHandler: [requireAuth]},
    async (req, reply) => {
      const userId = (req as unknown as AuthenticatedRequest).user.id
      const projectId = req.params.id

      if (!UUID_REGEX.test(projectId)) {
        return reply.code(400).send({error: 'invalid_input'})
      }

      const rl = rateLimit(`unpublish:${userId}`, RL_UNPUBLISH, RATE_LIMIT_WINDOW_MS)
      if (!rl.allowed) {
        reply.header('Retry-After', String(rl.retryAfter))
        return reply.code(429).send({error: 'rate_limited'})
      }

      try {
        const result = await service.unpublish({userId, projectId})

        req.log.info({userId, projectId, action: 'project.unpublish'}, 'project_unpublished')

        return reply.code(200).send({
          project: {
            ...result.project,
            published_at: null,
          },
        })
      } catch (err) {
        const mapped = mapServiceError(err)
        if (mapped) return reply.code(mapped.status).send(mapped.body)
        req.log.error({err: safeMessage(err), userId, projectId}, 'unpublish_failed')
        return reply.code(500).send({error: 'internal'})
      }
    },
  )

  // -------------------------------------------------------------------------
  // POST /users/me/handle
  // -------------------------------------------------------------------------
  fastify.post('/users/me/handle', {preHandler: [requireAuth]}, async (req, reply) => {
    const userId = (req as unknown as AuthenticatedRequest).user.id

    const rl = rateLimit(`setHandle:${userId}`, RL_SET_HANDLE, RATE_LIMIT_WINDOW_MS)
    if (!rl.allowed) {
      reply.header('Retry-After', String(rl.retryAfter))
      return reply.code(429).send({error: 'rate_limited'})
    }

    let body: z.infer<typeof SetHandleBodySchema>
    try {
      body = SetHandleBodySchema.parse(req.body)
    } catch {
      return reply.code(400).send({error: 'invalid_input'})
    }

    try {
      const result = await service.setHandle({userId, handle: body.handle})

      req.log.info({userId, action: 'user.set_handle'}, 'user_handle_set')

      return reply.code(200).send({user: result.user})
    } catch (err) {
      const mapped = mapServiceError(err)
      if (mapped) return reply.code(mapped.status).send(mapped.body)
      req.log.error({err: safeMessage(err), userId}, 'set_handle_failed')
      return reply.code(500).send({error: 'internal'})
    }
  })

  // -------------------------------------------------------------------------
  // GET /handles/check?h=<handle>
  // -------------------------------------------------------------------------
  fastify.get('/handles/check', {preHandler: [requireAuth]}, async (req, reply) => {
    const userId = (req as unknown as AuthenticatedRequest).user.id

    const rl = rateLimit(`checkHandle:${userId}`, RL_CHECK_HANDLE, RATE_LIMIT_WINDOW_MS)
    if (!rl.allowed) {
      reply.header('Retry-After', String(rl.retryAfter))
      return reply.code(429).send({error: 'rate_limited'})
    }

    let query: z.infer<typeof HandleCheckQuerySchema>
    try {
      query = HandleCheckQuerySchema.parse(req.query)
    } catch {
      return reply.code(400).send({error: 'invalid_input'})
    }

    try {
      const result = await service.checkHandle(query.h)
      return reply.code(200).send(result)
    } catch (err) {
      req.log.error({err: safeMessage(err), userId}, 'check_handle_failed')
      return reply.code(500).send({error: 'internal'})
    }
  })

  // -------------------------------------------------------------------------
  // GET /me/handle/suggest
  // Returns a structurally valid handle suggestion derived from the caller's
  // email (or their current handle if they already have one). The publish
  // sheet uses this to prefill its handle field on first publish.
  // -------------------------------------------------------------------------
  fastify.get('/me/handle/suggest', {preHandler: [requireAuth]}, async (req, reply) => {
    const userId = (req as unknown as AuthenticatedRequest).user.id

    const rl = rateLimit(`suggestHandle:${userId}`, RL_SUGGEST_HANDLE, RATE_LIMIT_WINDOW_MS)
    if (!rl.allowed) {
      reply.header('Retry-After', String(rl.retryAfter))
      return reply.code(429).send({error: 'rate_limited'})
    }

    try {
      const result = await service.suggestHandle({userId})
      return reply.code(200).send(result)
    } catch (err) {
      const mapped = mapServiceError(err)
      if (mapped) return reply.code(mapped.status).send(mapped.body)
      req.log.error({err: safeMessage(err), userId}, 'suggest_handle_failed')
      return reply.code(500).send({error: 'internal'})
    }
  })
}

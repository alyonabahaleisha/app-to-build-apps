/**
 * /me/out-of-scope-intents routes — ADR-0011 Step 5.
 *
 *   GET  /me/out-of-scope-intents
 *     Auth-required. Returns the caller's out-of-scope intent summaries,
 *     grouped by capability. Email/userId/promptHash are NEVER returned
 *     (auth-only fields per data sensitivity table).
 *     Rate limit: 60/min/user.
 *
 *   PATCH /me/out-of-scope-intents/:capability
 *     Auth-required. Updates notifyOptIn for ALL of the caller's rows for
 *     the given capability. Returns {updated: number}. Idempotent — 200 even
 *     when updated=0 (no rows matched).
 *     Capability is a closed enum — unknown values → 400.
 *     Rate limit: 60/min/user (shared window with GET).
 *
 * Response shape:
 *   GET  200 → {intents: OutOfScopeIntentSummary[]}
 *   PATCH 200 → {updated: number}
 *   400  → {error: 'invalid_input'}
 *   401  → {error: 'unauthorized'}  (from requireAuth)
 *   429  → {error: 'rate_limited', retryAfter: number}
 *
 * Rate limit counter: `me.oos:${userId}` — shared between GET and PATCH so
 * a client cannot GET 60 + PATCH 60 in the same minute.
 */

import type {FastifyInstance, FastifyPluginAsync} from 'fastify'
import {z} from 'zod'
import type {NodePgDatabase} from 'drizzle-orm/node-postgres'

import * as schema from '../db/schema.js'
import {requireAuth, type AuthenticatedRequest} from '../lib/auth.js'
import {safeMessage} from '../lib/logger.js'
import {rateLimit} from '../lib/rateLimit.js'
import {createMeService, type MeService} from '../services/me.service.js'

type Db = NodePgDatabase<typeof schema>

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RATE_LIMIT = 60
const RATE_LIMIT_WINDOW_MS = 60_000

// Closed enum of valid capability values. Kept in sync with
// outOfScope.ts — both must match the DB constraint.
export const VALID_CAPABILITIES = [
  'image_gen',
  'vision',
  'chat',
  'transcription',
  'classification',
  'unknown',
] as const

const CapabilitySchema = z.enum(VALID_CAPABILITIES)

// PATCH body: only notifyOptIn is patchable.
const PatchBodySchema = z.object({
  notifyOptIn: z.boolean(),
})

// ---------------------------------------------------------------------------
// Plugin options
// ---------------------------------------------------------------------------

export interface MeRoutesOptions {
  /** Drizzle instance. Tests inject the testcontainers-bound db; production lazy-loads. */
  db?: Db
  /** Override the service instance (test-only). */
  service?: MeService
}

async function resolveService(opts: MeRoutesOptions): Promise<MeService> {
  if (opts.service) return opts.service
  if (opts.db) return createMeService(opts.db)
  const mod = await import('../db/index.js')
  return createMeService(mod.getDb())
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export const meRoutes: FastifyPluginAsync<MeRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: MeRoutesOptions,
) => {
  const service = await resolveService(opts)

  // -------------------------------------------------------------------------
  // GET /me/out-of-scope-intents
  // -------------------------------------------------------------------------
  fastify.get('/me/out-of-scope-intents', {preHandler: [requireAuth]}, async (req, reply) => {
    const authed = req as unknown as AuthenticatedRequest
    const userId = authed.user.id

    const rl = rateLimit(`me.oos:${userId}`, RATE_LIMIT, RATE_LIMIT_WINDOW_MS)
    if (!rl.allowed) {
      return reply.code(429).send({error: 'rate_limited', retryAfter: rl.retryAfter})
    }

    try {
      const intents = await service.listMyOutOfScopeIntents(userId)
      return reply.code(200).send({intents})
    } catch (err) {
      req.log.error({err: safeMessage(err)}, 'me: listMyOutOfScopeIntents failed')
      return reply.code(500).send({error: 'internal'})
    }
  })

  // -------------------------------------------------------------------------
  // PATCH /me/out-of-scope-intents/:capability
  // -------------------------------------------------------------------------
  fastify.patch(
    '/me/out-of-scope-intents/:capability',
    {preHandler: [requireAuth]},
    async (req, reply) => {
      const authed = req as unknown as AuthenticatedRequest
      const userId = authed.user.id

      const rl = rateLimit(`me.oos:${userId}`, RATE_LIMIT, RATE_LIMIT_WINDOW_MS)
      if (!rl.allowed) {
        return reply.code(429).send({error: 'rate_limited', retryAfter: rl.retryAfter})
      }

      // Validate capability
      const capabilityParsed = CapabilitySchema.safeParse((req.params as {capability: string}).capability)
      if (!capabilityParsed.success) {
        return reply.code(400).send({error: 'invalid_input'})
      }

      // Validate body
      const bodyParsed = PatchBodySchema.safeParse(req.body)
      if (!bodyParsed.success) {
        return reply.code(400).send({error: 'invalid_input'})
      }

      try {
        const result = await service.patchMyOutOfScopeIntent(
          userId,
          capabilityParsed.data,
          {notifyOptIn: bodyParsed.data.notifyOptIn},
        )
        return reply.code(200).send(result)
      } catch (err) {
        req.log.error({err: safeMessage(err)}, 'me: patchMyOutOfScopeIntent failed')
        return reply.code(500).send({error: 'internal'})
      }
    },
  )
}

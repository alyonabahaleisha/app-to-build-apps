/**
 * Auth routes — ADR-0001 Step 3.
 *
 * `POST /auth/magic-link` (public): bootstrap. Asks Supabase to send a
 *   magic-link email. Returns `{sent: true}` on success — the generated URL
 *   never reaches the client (T-0001-042). Email is never logged at INFO
 *   (T-0001-043).
 *
 * `POST /auth/sync` (auth required): mirrors the JWT's `sub` into our local
 *   `users` table. Idempotent. Rate-limited at 30/min/user via
 *   `lib/rateLimit.ts` (Robert's AC-Q3 / T-0001-118). On second-and-later
 *   sync calls, the local `users.email` is NOT updated even if the JWT's
 *   `email` claim has changed — Supabase auth is source of truth, our
 *   mirror is one-way at first sign-in (T-0001-044, T-0001-119).
 *
 * Error contract (CLAUDE.md §6, retro-lessons.md `userCount` lesson):
 *   - 4xx: typed `{error: '<code>', detail?: '<short>'}`. Specific so the
 *     client can drive UX copy.
 *   - 500: `{error: 'internal'}` only. Vague on purpose — no SDK message,
 *     no stack — and the underlying err is logged via `safeMessage`.
 */
import type {FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest} from 'fastify'
import type {NodePgDatabase} from 'drizzle-orm/node-postgres'
import {z} from 'zod'

import * as schema from '../db/schema.js'
import {requireAuth, type AuthenticatedRequest} from '../lib/auth.js'
import {safeMessage} from '../lib/logger.js'
import {rateLimit} from '../lib/rateLimit.js'
import {issueMagicLink} from '../services/auth.service.js'
import {findOrCreate} from '../services/users.service.js'

type Db = NodePgDatabase<typeof schema>

export interface AuthRoutesOptions {
  /**
   * Drizzle instance the `/auth/sync` handler uses for the upsert. Tests
   * inject the testcontainers-bound db; production omits this and we lazy-
   * load the singleton `db` from `db/index.ts`.
   */
  db?: Db
}

// Email validation per ADR-0001 §Step 3 AC: 1 ≤ len ≤ 320 (RFC 5321 max),
// must contain `@` and `.`. We intentionally don't enforce a strict regex —
// Supabase normalizes upstream. T-0001-039 verifies unicode email passes.
const emailSchema = z
  .string()
  .min(1)
  .max(320)
  .refine(v => v.includes('@') && v.includes('.'), {message: 'email format'})

const magicLinkBody = z.object({email: emailSchema})

const RATE_LIMIT_PER_MINUTE = 30
const RATE_WINDOW_MS = 60_000

// Lazy DB resolver. Avoids importing the singleton at module-load time so
// tests that never hit the route don't need DATABASE_URL.
async function resolveDb(injected: Db | undefined): Promise<Db> {
  if (injected) return injected
  const mod = await import('../db/index.js')
  return mod.getDb()
}

export const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: AuthRoutesOptions,
) => {
  // -------------------------------------------------------------------------
  // POST /auth/magic-link  (public)
  // -------------------------------------------------------------------------
  fastify.post('/magic-link', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = magicLinkBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({error: 'invalid_input', detail: 'email format'})
    }
    try {
      await issueMagicLink(parsed.data.email)
      return reply.code(200).send({sent: true})
    } catch (err) {
      // Log the SDK error message via safeMessage; the response body is the
      // strict `{error: 'internal'}` shape — no detail, no SDK string. Email
      // intentionally absent from the log record (T-0001-043).
      req.log.error({err: safeMessage(err)}, 'magic_link_failed')
      return reply.code(500).send({error: 'internal'})
    }
  })

  // -------------------------------------------------------------------------
  // POST /auth/sync  (auth required + rate-limited)
  // -------------------------------------------------------------------------
  fastify.post('/sync', {preHandler: [requireAuth]}, async (req, reply) => {
    const authed = req as unknown as AuthenticatedRequest
    const userId = authed.user.id

    // Rate limit per user (AC-Q3, T-0001-118). Key includes the route so the
    // budget is route-scoped, not global.
    const rl = rateLimit(`auth.sync:${userId}`, RATE_LIMIT_PER_MINUTE, RATE_WINDOW_MS)
    if (!rl.allowed) {
      if (rl.retryAfter !== undefined) {
        reply.header('Retry-After', rl.retryAfter)
      }
      return reply.code(429).send({error: 'rate_limited'})
    }

    try {
      const db = await resolveDb(opts.db)
      const user = await findOrCreate(db, userId, authed.user.email)
      return reply.code(200).send({user: {id: user.id, email: user.email}})
    } catch (err) {
      req.log.error({err: safeMessage(err)}, 'auth_sync_failed')
      return reply.code(500).send({error: 'internal'})
    }
  })
}

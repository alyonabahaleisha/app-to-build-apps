/**
 * POST /out-of-scope-intent — ADR-0007 Step 5.
 *
 * Two-step out-of-scope flow (ADR-0007 §H):
 *   1. Detection: /generate SSE emits out_of_scope event. No row yet.
 *   2. Capture (this route): user taps "Notify me"; client POSTs
 *      {capability, prompt_hash, reason, email?}. Row inserted in
 *      out_of_scope_intent.
 *
 * Body schema (Zod):
 *   - capability: closed enum (image_gen|vision|chat|transcription|classification|unknown)
 *   - prompt_hash: /^[a-f0-9]{64}$/ — lowercase sha256 hex (T-0007-185)
 *   - reason: 1–200 chars
 *   - email: optional RFC 5321 (≤320 chars, must contain @)
 *
 * Security:
 *   - Auth required (requireAuth preHandler). 401 if no JWT.
 *   - user_id is always the authenticated user — never client-provided.
 *   - Client cannot specify id, user_id, or created_at (server-managed).
 *
 * Rate limit: 30/min/user on counter `oos-intent:${userId}` — separate
 * from the generate: counter so out-of-scope submits don't eat generate budget.
 *
 * Response: 200 {captured: true} on success. 4xx on validation failure.
 */

import type {FastifyInstance, FastifyPluginAsync} from 'fastify'
import {z} from 'zod'
import type {NodePgDatabase} from 'drizzle-orm/node-postgres'

import * as schema from '../db/schema.js'
import {requireAuth, type AuthenticatedRequest} from '../lib/auth.js'
import {safeMessage} from '../lib/logger.js'
import {rateLimit} from '../lib/rateLimit.js'
import {createOutOfScopeService, type OutOfScopeService} from '../services/outOfScope.service.js'

type Db = NodePgDatabase<typeof schema>

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RATE_LIMIT_PER_MINUTE = 30
const RATE_LIMIT_WINDOW_MS = 60_000

// ---------------------------------------------------------------------------
// Body schema
// ---------------------------------------------------------------------------

// prompt_hash: lowercase sha256 hex — exactly 64 lowercase hex chars.
// Uppercase and mixed-case are rejected (T-0007-185).
const PROMPT_HASH_REGEX = /^[a-f0-9]{64}$/

const CaptureIntentBodySchema = z.object({
  capability: z.enum([
    'image_gen',
    'vision',
    'chat',
    'transcription',
    'classification',
    'unknown',
  ]),
  // Lowercase sha256 hex, exactly 64 chars (T-0007-185: uppercase rejected)
  prompt_hash: z.string().regex(PROMPT_HASH_REGEX),
  reason: z.string().min(1).max(200),
  // Optional email. When provided: must contain @ and be ≤320 chars.
  email: z
    .string()
    .max(320)
    .refine(v => v.includes('@'), {message: 'email must contain @'})
    .optional()
    .nullable(),
})

// ---------------------------------------------------------------------------
// Plugin options
// ---------------------------------------------------------------------------

export interface OutOfScopeRoutesOptions {
  /**
   * Drizzle instance. Tests inject the testcontainers-bound db;
   * production omits this and lazy-loads the singleton from db/index.ts.
   */
  db?: Db
  /** Override the service instance (test-only). */
  service?: OutOfScopeService
}

// Lazy DB resolver — avoids importing the singleton at module-load time.
async function resolveDb(injected: Db | undefined): Promise<Db> {
  if (injected) return injected
  const {getDb} = await import('../db/index.js')
  return getDb()
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export const outOfScopeRoutes: FastifyPluginAsync<OutOfScopeRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: OutOfScopeRoutesOptions,
) => {
  fastify.post(
    '/out-of-scope-intent',
    {preHandler: [requireAuth]},
    async (req, reply) => {
      const authedReq = req as AuthenticatedRequest

      // Rate limit — separate counter from generate: (T-0007-120)
      const rateLimitKey = `oos-intent:${authedReq.user.id}`
      const rl = rateLimit(rateLimitKey, RATE_LIMIT_PER_MINUTE, RATE_LIMIT_WINDOW_MS)
      if (!rl.allowed) {
        return reply.code(429).send({
          error: 'rate_limited',
          retryAfter: rl.retryAfter,
        })
      }

      // Body validation
      const parsed = CaptureIntentBodySchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.code(400).send({error: 'invalid_input'})
      }
      const body = parsed.data

      try {
        const db = await resolveDb(opts.db)
        const service = opts.service ?? createOutOfScopeService(db)

        await service.captureIntent({
          // user_id is always from auth — never from body (T-0007-117, T-0007-118)
          userId: authedReq.user.id,
          capability: body.capability,
          promptHash: body.prompt_hash,
          reason: body.reason,
          email: body.email ?? null,
        })

        return reply.code(200).send({captured: true})
      } catch (err) {
        req.log.error({err: safeMessage(err)}, 'out-of-scope-intent: insert failed')
        return reply.code(500).send({error: 'internal'})
      }
    },
  )
}

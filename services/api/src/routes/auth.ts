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
import {verifyAppleIdentityToken, AppleIdentityError} from '../lib/appleIdentity.js'
import {safeMessage} from '../lib/logger.js'
import {rateLimit} from '../lib/rateLimit.js'
import {issueMagicLink, issueLocalJwtForUser} from '../services/auth.service.js'
import {findOrCreate, findOrCreateByAppleSub} from '../services/users.service.js'

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

// POST /auth/apple — per-IP rate limit (stricter than /sync: auth attempts)
const APPLE_RATE_LIMIT_PER_MINUTE = 10

// ADR-0013 Step 1 — body schema for POST /auth/apple.
// identityToken max 4096 chars enforced here (T-0013-049).
// displayName max 120 chars (T-0013-050). authorizationCode + nonce optional.
const appleSignInBody = z.object({
  identityToken: z.string().min(1).max(4096),
  authorizationCode: z.string().min(1).max(1024).optional(),
  nonce: z.string().min(1).max(64).optional(),
  displayName: z.string().min(1).max(120).optional(),
})

// Response schema — `user` has EXACTLY {id, display_name}. Email excluded
// per canvas-v0.md §API Contracts privacy stance (P0-1, T-0013-044..046).
// Used at runtime for type inference (ResponseUser below) + voided to suppress
// unused-var lint (the runtime value is a type anchor, not a runtime validator).
const appleSignInResponse = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number(),
  user: z.object({
    id: z.string(),
    display_name: z.string().nullable(),
  }),
})
void appleSignInResponse // type anchor — see T-0013-131/132 compile-time assertions below

// ---------------------------------------------------------------------------
// T-0013-131: Compile-time inverse-extends assertion — 'email' must NOT appear
// on the ResponseUser shape. If the schema is ever broadened to include email,
// 'email' extends keyof ResponseUser resolves to true → _check: never = true
// fails to typecheck.
// ---------------------------------------------------------------------------
type ResponseUser = z.infer<typeof appleSignInResponse>['user']
type _AssertNoEmail = 'email' extends keyof ResponseUser ? never : true
const _assertNoEmail: _AssertNoEmail = true
void _assertNoEmail

// ---------------------------------------------------------------------------
// T-0013-132: Two independent assertions — each catches one casing of the
// internal identifier independently. Union-extends is non-distributive in
// TypeScript, so a single `'appleUserId' | 'apple_user_id' extends keyof T`
// would miss a single-key leak. Split assertions close that gap.
// ---------------------------------------------------------------------------
type _AssertNoAppleUserIdCamel = 'appleUserId' extends keyof ResponseUser ? never : true
const _c1: _AssertNoAppleUserIdCamel = true
void _c1

type _AssertNoAppleUserIdSnake = 'apple_user_id' extends keyof ResponseUser ? never : true
const _c2: _AssertNoAppleUserIdSnake = true
void _c2

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
  // POST /auth/apple  (public — new SIWA route, ADR-0013 Step 1)
  //
  // Flow: parse body → rate-limit by IP → verify Apple identity token →
  //   find-or-create user → issue local JWT + refresh token → respond.
  //
  // Response: {access_token, refresh_token, expires_in, user: {id, display_name}}
  // `email` is intentionally excluded (P0-1 / canvas-v0.md §API Contracts).
  // T-0013-044..076, T-0013-130..132.
  //
  // Error mapping (T-0013-052..059, T-0013-061):
  //   malformed | signature_invalid | kid_unknown | audience_mismatch |
  //   issuer_mismatch | missing_claim → 401 {error: 'unauthorized'}
  //   expired                         → 401 {error: 'unauthorized', detail: 'token_expired'}
  //   jwks_unreachable                → 503 {error: 'internal'}
  //   DB failure                      → 500 {error: 'internal'}
  // -------------------------------------------------------------------------
  fastify.post('/apple', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = appleSignInBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({error: 'invalid_input', detail: 'identityToken required'})
    }
    const body = parsed.data

    // Per-IP rate limit: 10/min (T-0013-066).
    const ip = req.ip ?? 'unknown'
    const rl = rateLimit(`auth.apple:${ip}`, APPLE_RATE_LIMIT_PER_MINUTE, RATE_WINDOW_MS)
    if (!rl.allowed) {
      if (rl.retryAfter !== undefined) {
        reply.header('Retry-After', rl.retryAfter)
      }
      return reply.code(429).send({error: 'rate_limited'})
    }

    // Verify Apple identity token. Never log the token itself (T-0013-063).
    let claims: Awaited<ReturnType<typeof verifyAppleIdentityToken>>
    try {
      claims = await verifyAppleIdentityToken(body.identityToken)
    } catch (err) {
      if (err instanceof AppleIdentityError) {
        if (err.code === 'jwks_unreachable') {
          req.log.error({err: safeMessage(err)}, 'siwa_jwks_unreachable')
          return reply.code(503).send({error: 'internal'})
        }
        if (err.code === 'expired') {
          return reply.code(401).send({error: 'unauthorized', detail: 'token_expired'})
        }
        // All other codes: don't leak which check failed (T-0013-061).
        return reply.code(401).send({error: 'unauthorized'})
      }
      req.log.error({err: safeMessage(err)}, 'siwa_token_verify_unexpected')
      return reply.code(401).send({error: 'unauthorized'})
    }

    // Find or create user — sub-keyed, not email-keyed.
    // Apple Relay aliases stored verbatim; NEVER logged at INFO (T-0013-033/063).
    const db = await resolveDb(opts.db)
    let user: Awaited<ReturnType<typeof findOrCreateByAppleSub>>
    try {
      user = await findOrCreateByAppleSub(db, claims.sub, claims.email, body.displayName)
    } catch (err) {
      req.log.error({err: safeMessage(err)}, 'siwa_find_or_create_failed')
      return reply.code(500).send({error: 'internal'})
    }

    // Issue local JWT + refresh token. The access_token is HS256 against
    // SUPABASE_JWT_SECRET — identical shape to magic-link JWTs (T-0013-043/064).
    let tokens: Awaited<ReturnType<typeof issueLocalJwtForUser>>
    try {
      tokens = await issueLocalJwtForUser(db, user)
    } catch (err) {
      req.log.error({err: safeMessage(err)}, 'siwa_jwt_issue_failed')
      return reply.code(500).send({error: 'internal'})
    }

    // Response: email intentionally excluded (P0-1). Only {id, display_name}.
    return reply.code(200).send({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_in: tokens.expiresIn,
      user: {
        id: user.id,
        display_name: user.displayName,
      },
    })
  })

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

/**
 * JWT verification + Fastify auth pre-handler. Per ADR-0001 §Step 2.
 *
 * Verifies Supabase-issued HS256 JWTs against `SUPABASE_JWT_SECRET`. The `sub`
 * claim is the canonical identity (FK to `users.id`); `email` is required and
 * carried alongside for convenience but never used as the primary key.
 *
 * Security invariants enforced here (asserted in auth.test.ts):
 *  - 401 body shape is exactly `{error: 'unauthorized'}` — no token echo, no
 *    detail, no email (T-0001-024).
 *  - The user's email is never logged at INFO from this module (T-0001-025).
 *  - The `sub` claim must be a UUID (T-0001-117) — defended because it FKs to
 *    `users.id`.
 *  - 30s clock-skew tolerance, both bounds (T-0001-021).
 */
import type {FastifyReply, FastifyRequest} from 'fastify'
import {createRemoteJWKSet, jwtVerify, type JWTPayload} from 'jose'
import jwt, {type Algorithm, type JwtPayload} from 'jsonwebtoken'

import {env} from './env.js'
import {safeMessage} from './logger.js'

export interface AuthUser {
  id: string
  email: string
}

export interface AuthenticatedRequest extends FastifyRequest {
  user: AuthUser
}

const HS256: Algorithm = 'HS256'
const CLOCK_TOLERANCE_SECONDS = 30

// Supabase migrated user-session tokens to ES256 (ECC P-256) in late 2024.
// New sessions are signed with the project's ES256 key; the public key is
// fetched lazily from the JWKS endpoint and cached. The legacy HS256 path
// stays as a fallback so (a) Step 2's existing tests still pass against
// hand-minted HS256 tokens and (b) projects that haven't migrated yet keep
// working without code changes.
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>()

function getJwks() {
  const url = env.SUPABASE_URL
  if (!url) return null
  let jwks = jwksCache.get(url)
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${url}/auth/v1/.well-known/jwks.json`))
    jwksCache.set(url, jwks)
  }
  return jwks
}

// Strict RFC-4122-shaped UUID regex. We don't enforce a specific version
// because Supabase has historically used different generators; any well-formed
// UUID is acceptable as long as the shape is right.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export class AuthError extends Error {
  override readonly name = 'AuthError'
}

/**
 * Dev-mode bypass: when NODE_ENV !== 'production' and the bearer token is the
 * literal string 'dev-bypass', requireAuth resolves to the synthetic dev user
 * instead of doing JWT verification. Lets the mobile `skipAuth` button drive
 * authenticated endpoints during local testing without a real magic-link
 * round-trip. The dev user row is upserted on first use.
 *
 * Production is unaffected — this branch never fires when NODE_ENV='production'.
 */
export const DEV_BYPASS_TOKEN = 'dev-bypass'
export const DEV_USER: AuthUser = {
  id: 'deadbeef-0000-0000-0000-000000000000',
  email: 'dev-guest@local.dev',
}

/**
 * Verify a Supabase-issued JWT. On success, returns `{sub, email}` after
 * narrowing the payload. Throws `AuthError` on any failure — caller is
 * responsible for translating to an HTTP 401.
 *
 * Failure cases (all → throw):
 *  - missing/invalid secret config (caller-side issue, not a token issue)
 *  - malformed token (wrong shape, wrong algorithm, bad signature)
 *  - expired token (`exp` in past)
 *  - clock-skew outside ±30s on `iat`/`nbf`
 *  - missing `sub` or `email` claim
 *  - `sub` not a UUID
 *  - `email` not a non-empty string
 */
export async function verifyJwt(token: string): Promise<AuthUser> {
  if (typeof token !== 'string' || token.length === 0) {
    throw new AuthError('empty_token')
  }

  // Try JWKS first (covers ES256 / RS256 — the modern Supabase signing path).
  // If the project hasn't migrated, JWKS verification fails (no matching key
  // for HS256); fall through to the legacy HS256 secret path.
  const jwks = getJwks()
  if (jwks) {
    try {
      const {payload} = await jwtVerify(token, jwks, {
        algorithms: ['ES256', 'RS256'],
        clockTolerance: CLOCK_TOLERANCE_SECONDS,
      })
      return narrowPayload(payload)
    } catch {
      // Fall through to HS256 attempt below. Don't surface this error unless
      // both paths fail — many tokens are HS256 and JWKS rejection is expected.
    }
  }

  const secret = env.SUPABASE_JWT_SECRET
  if (!secret || secret.trim() === '') {
    // Defensive: in non-test envs SUPABASE_* is enforced at boot (T-0001-029).
    // If we reach here in test, every token must reject.
    throw new AuthError('jwt_secret_unconfigured')
  }

  let decoded: string | JwtPayload
  try {
    decoded = jwt.verify(token, secret, {
      algorithms: [HS256],
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
    })
  } catch (err) {
    // Wrap every jsonwebtoken error in AuthError so callers handle one type.
    throw new AuthError(`verify_failed: ${safeMessage(err)}`)
  }

  if (typeof decoded === 'string' || decoded === null) {
    throw new AuthError('payload_not_object')
  }

  return narrowPayload(decoded as Record<string, unknown>)
}

/** Validate `sub` (UUID) and `email` (non-empty string). Shared by both paths. */
function narrowPayload(payload: JWTPayload | Record<string, unknown>): AuthUser {
  const sub = (payload as {sub?: unknown}).sub
  const email = (payload as {email?: unknown}).email
  if (typeof sub !== 'string' || !UUID_REGEX.test(sub)) {
    throw new AuthError('invalid_sub')
  }
  if (typeof email !== 'string' || email.trim().length === 0) {
    throw new AuthError('invalid_email_claim')
  }
  return {id: sub, email}
}

/**
 * Fastify pre-handler. On success, attaches `req.user` and lets the route
 * proceed. On any failure, replies 401 with body `{error: 'unauthorized'}` —
 * shape strictly one key, exactly that value (T-0001-024).
 *
 * Logging contract (T-0001-025): the user's email is never written at INFO
 * from this handler. Errors log `safeMessage(err)` only, no claim values.
 */
export async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = req.headers.authorization
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
    return reply.code(401).send({error: 'unauthorized'})
  }
  const token = header.slice('Bearer '.length)
  if (token.length === 0) {
    return reply.code(401).send({error: 'unauthorized'})
  }
  if (env.NODE_ENV !== 'production' && token === DEV_BYPASS_TOKEN) {
    ;(req as unknown as AuthenticatedRequest).user = DEV_USER
    return
  }
  try {
    const user = await verifyJwt(token)
    ;(req as unknown as AuthenticatedRequest).user = user
    return
  } catch (err) {
    // Log the *category* of failure via safeMessage (no token, no email).
    // Use error level — failed auth attempts are diagnostic-relevant. The
    // `req.log.info` channel stays free of any auth-derived PII.
    req.log.error({err: safeMessage(err)}, 'auth_failed')
    return reply.code(401).send({error: 'unauthorized'})
  }
}

/**
 * Auth service — thin wrapper around the Supabase admin client. Isolates the
 * SDK call so the route handler can stay focused on HTTP concerns and the
 * test surface can mock at one well-known seam.
 *
 * Contract (ADR-0001 §Step 3):
 *  - `issueMagicLink(email)` calls `supabaseAdmin.auth.admin.generateLink({
 *    type: 'magiclink', email})`.
 *  - The generated URL is intentionally NOT returned. We only need confirmation
 *    that Supabase accepted the request and queued the email. T-0001-042
 *    asserts the URL never reaches the client.
 *  - On Supabase failure (network, 5xx, malformed response) — throws. The
 *    route handler maps to 500 `{error: 'internal'}` and logs via
 *    `safeMessage`. T-0001-040 asserts the SDK error message is logged but
 *    never returned in the response body.
 *
 * ADR-0013 Step 1 adds:
 *  - `issueLocalJwtForUser(user)` — mints an HS256 JWT + opaque refresh token
 *    for the SIWA sign-in flow. The refresh token is stored as sha256 hash
 *    in `apple_refresh_tokens`. T-0013-037..043.
 */
import {randomBytes, createHash} from 'node:crypto'

import jwt from 'jsonwebtoken'
import {eq} from 'drizzle-orm'
import type {NodePgDatabase} from 'drizzle-orm/node-postgres'

import {appleRefreshTokens} from '../db/schema.js'
import * as schema from '../db/schema.js'
import {env} from '../lib/env.js'
import {getSupabaseAdmin} from '../lib/supabase.js'
import type {MirroredUser} from './users.service.js'

type Db = NodePgDatabase<typeof schema>

// JWT lifetime mirrors Supabase's 1-hour default (T-0013-038).
const JWT_EXPIRES_IN_SECONDS = 3600
const REFRESH_TOKEN_BYTES = 32
// Refresh token TTL: 30 days.
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000

export interface LocalJwtResult {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

/**
 * Ask Supabase to send a magic-link email. Resolves on success, rejects on
 * any Supabase failure. Caller is responsible for translating to HTTP.
 */
export async function issueMagicLink(email: string): Promise<void> {
  const client = getSupabaseAdmin()
  const result = await client.auth.admin.generateLink({type: 'magiclink', email})
  // Supabase's `generateLink` returns `{data, error}`. We treat a non-null
  // `error` as a thrown error so the caller's try/catch shape is uniform.
  if (result.error) {
    throw new Error(`supabase.generateLink failed: ${result.error.message}`)
  }
}

/**
 * Issue an HS256 JWT + opaque refresh token for a SIWA-authenticated user.
 *
 * - JWT payload: `{sub: user.id, email: user.email, aud: 'authenticated'}`.
 *   The `sub` is our local users.id UUID — NOT Apple's sub. The JWT is
 *   verifiable by `verifyJwt` in lib/auth.ts unchanged (T-0013-043).
 * - Refresh token: 32 bytes of cryptographically-random hex (64 chars).
 *   Only the sha256 hash is persisted — see ADR-0013 §Decision Step 1 for
 *   the sha256-vs-bcrypt rationale (T-0013-040).
 * - `expiresIn`: seconds until the access token expires (T-0013-041).
 *
 * T-0013-037..043.
 */
export async function issueLocalJwtForUser(
  db: Db,
  user: MirroredUser,
): Promise<LocalJwtResult> {
  const secret = env.SUPABASE_JWT_SECRET
  if (!secret) {
    throw new Error('SUPABASE_JWT_SECRET is not configured')
  }

  const now = Math.floor(Date.now() / 1000)
  const accessToken = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      aud: 'authenticated',
      iat: now,
      exp: now + JWT_EXPIRES_IN_SECONDS,
    },
    secret,
    {algorithm: 'HS256'},
  )

  // Generate opaque refresh token — plaintext known only here, returned once
  // to the client, then discarded. Only the hash is stored (T-0013-040).
  const tokenPlaintext = randomBytes(REFRESH_TOKEN_BYTES).toString('hex')
  const tokenHash = createHash('sha256').update(tokenPlaintext).digest('hex')

  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS)
  await db.insert(appleRefreshTokens).values({
    userId: user.id,
    tokenHash,
    expiresAt,
  })

  return {
    accessToken,
    refreshToken: tokenPlaintext,
    expiresIn: JWT_EXPIRES_IN_SECONDS,
  }
}

/**
 * Revoke all refresh tokens for a user (e.g. on sign-out or account deletion).
 * Sets `revoked_at` to now for any non-revoked tokens. V0.5+ usage.
 */
export async function revokeRefreshTokensForUser(db: Db, userId: string): Promise<void> {
  await db
    .update(appleRefreshTokens)
    .set({revokedAt: new Date()})
    .where(eq(appleRefreshTokens.userId, userId))
}

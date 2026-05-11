/**
 * ADR-0013 Step 1c — issueLocalJwtForUser tests.
 *
 * T-0013-037..043: JWT issuance shape, refresh token hash, sha256 specificity,
 * expiresIn accuracy, regression against verifyJwt.
 *
 * Uses testcontainers for the apple_refresh_tokens insert (T-0013-040).
 * No real Apple credentials needed — the function is entirely server-side.
 */
import {randomUUID, createHash} from 'node:crypto'

import type {NodePgDatabase} from 'drizzle-orm/node-postgres'

process.env.NODE_ENV = 'test'
process.env.SUPABASE_JWT_SECRET = 'auth-service-test-secret-' + randomUUID()

import {issueLocalJwtForUser} from './auth.service.js'
import {verifyJwt} from '../lib/auth.js'
import {appleRefreshTokens} from '../db/schema.js'
import * as schema from '../db/schema.js'
import {users} from '../db/schema.js'
import {closeTestPool, getTestDb, truncateAll} from '../../test/setup.js'
import type {MirroredUser} from './users.service.js'

type Db = NodePgDatabase<typeof schema>

function makeMirroredUser(overrides: Partial<MirroredUser> = {}): MirroredUser {
  return {
    id: overrides.id ?? randomUUID(),
    email: overrides.email ?? `user-${randomUUID()}@example.com`,
    createdAt: overrides.createdAt ?? new Date(),
    displayName: overrides.displayName ?? null,
  }
}

describe('ADR-0013 Step 1c — issueLocalJwtForUser', () => {
  let db: Db

  beforeAll(async () => {
    db = await getTestDb()
  })

  afterEach(async () => {
    await truncateAll()
  })

  afterAll(async () => {
    await closeTestPool()
  })

  // We need to insert a users row before the apple_refresh_tokens FK fires.
  async function insertUser(db: Db, user: MirroredUser): Promise<void> {
    await db.insert(users).values({
      id: user.id,
      email: user.email,
    })
  }

  // T-0013-037
  it('T-0013-037: returns {accessToken, refreshToken, expiresIn}; accessToken verifiable by verifyJwt', async () => {
    const user = makeMirroredUser()
    await insertUser(db, user)
    const result = await issueLocalJwtForUser(db, user)

    expect(typeof result.accessToken).toBe('string')
    expect(typeof result.refreshToken).toBe('string')
    expect(typeof result.expiresIn).toBe('number')

    // Access token must verify against SUPABASE_JWT_SECRET.
    const verified = await verifyJwt(result.accessToken)
    expect(verified.id).toBe(user.id)
    expect(verified.email).toBe(user.email)
  })

  // T-0013-038
  it('T-0013-038: JWT payload has sub = user.id (UUID), email = user.email, aud = "authenticated"', async () => {
    const user = makeMirroredUser({email: 'jose@example.com'})
    await insertUser(db, user)
    const {accessToken} = await issueLocalJwtForUser(db, user)

    // Decode payload (base64url middle segment).
    const payloadB64 = accessToken.split('.')[1]!
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8')) as Record<
      string,
      unknown
    >

    expect(payload['sub']).toBe(user.id)
    expect(payload['email']).toBe(user.email)
    expect(payload['aud']).toBe('authenticated')
    // exp should be approximately now + 3600.
    const now = Math.floor(Date.now() / 1000)
    expect(payload['exp']).toBeGreaterThanOrEqual(now + 3590)
    expect(payload['exp']).toBeLessThanOrEqual(now + 3610)
  })

  // T-0013-039
  it('T-0013-039: refreshToken is a 64-char hex string (32 bytes)', async () => {
    const user = makeMirroredUser()
    await insertUser(db, user)
    const {refreshToken} = await issueLocalJwtForUser(db, user)

    expect(refreshToken).toMatch(/^[0-9a-f]{64}$/)
  })

  // T-0013-040
  it('T-0013-040: refresh token stored as sha256 hash, NOT plaintext — hash verified via crypto.createHash("sha256")', async () => {
    const user = makeMirroredUser()
    await insertUser(db, user)
    const {refreshToken} = await issueLocalJwtForUser(db, user)

    // Compute the expected hash — must use sha256 per ADR-0013 §Decision Step 1.
    const expectedHash = createHash('sha256').update(refreshToken).digest('hex')

    // Look up the stored hash in apple_refresh_tokens.
    const {eq} = await import('drizzle-orm')
    const rows = await db
      .select({tokenHash: appleRefreshTokens.tokenHash})
      .from(appleRefreshTokens)
      .where(eq(appleRefreshTokens.userId, user.id))

    expect(rows).toHaveLength(1)
    expect(rows[0]?.tokenHash).toBe(expectedHash)
    // Plaintext MUST NOT be stored.
    expect(rows[0]?.tokenHash).not.toBe(refreshToken)
  })

  // T-0013-041
  it('T-0013-041: expiresIn matches the JWT exp - iat delta', async () => {
    const user = makeMirroredUser()
    await insertUser(db, user)
    const {accessToken, expiresIn} = await issueLocalJwtForUser(db, user)

    const payloadB64 = accessToken.split('.')[1]!
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8')) as {
      exp: number
      iat: number
    }

    const jwtDelta = payload.exp - payload.iat
    // Allow 1-second drift between system clocks.
    expect(Math.abs(jwtDelta - expiresIn)).toBeLessThanOrEqual(1)
  })

  // T-0013-042
  it('T-0013-042: refreshToken plaintext not in apple_refresh_tokens table', async () => {
    const user = makeMirroredUser()
    await insertUser(db, user)
    const {refreshToken} = await issueLocalJwtForUser(db, user)

    const rows = await db.select({tokenHash: appleRefreshTokens.tokenHash}).from(appleRefreshTokens)
    for (const row of rows) {
      expect(row.tokenHash).not.toBe(refreshToken)
    }
  })

  // T-0013-043
  it('T-0013-043: issued JWT verifiable by verifyJwt — same HS256 path as magic-link JWT', async () => {
    const user = makeMirroredUser()
    await insertUser(db, user)
    const {accessToken} = await issueLocalJwtForUser(db, user)

    // verifyJwt is the production requireAuth middleware — must succeed.
    const verified = await verifyJwt(accessToken)
    expect(verified.id).toBe(user.id)
    expect(verified.email).toBe(user.email)
  })
})

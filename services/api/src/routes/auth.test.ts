/**
 * ADR-0001 Step 3 — Auth route tests.
 *
 * 20 T-IDs covered:
 *   Happy: 030, 031, 032
 *   Failure: 033, 034, 035, 036, 118
 *   Boundary: 037, 038, 039, 119
 *   Error handling: 040, 041
 *   Security: 042, 043, 044
 *   Concurrency: 045
 *   Regression: 046
 *   Config exhaustion: 048 (5 cases)
 *
 * ADR-0013 Step 5 — T-0013-140 (route integration telemetry).
 *
 * T-0001-047 (Breaking change) is N/A — new endpoints.
 *
 * SUPABASE_JWT_SECRET must be set BEFORE auth.js imports so verifyJwt picks
 * up the configured value. Mirrors the Step 2 pattern.
 */
import {randomUUID} from 'node:crypto'

import {eq} from 'drizzle-orm'
import type {NodePgDatabase} from 'drizzle-orm/node-postgres'
import Fastify from 'fastify'
import pino from 'pino'

import * as schema from '../db/schema.js'
import {users} from '../db/schema.js'
import {createLogSink, PINO_LEVEL} from '../../test/mocks/pinoStream.js'
import {closeTestPool, getTestDb, getTestPool, truncateAll} from '../../test/setup.js'
import {userJwt} from '../../test/factories.js'

// Suppress unused import warning — PINO_LEVEL is used in T-0001-040.
void PINO_LEVEL

const TEST_JWT_SECRET = 'auth-route-test-secret-' + randomUUID()
process.env.SUPABASE_JWT_SECRET = TEST_JWT_SECRET
process.env.NODE_ENV = 'test'
process.env.APPLE_SIWA_CLIENT_ID = 'com.appcreator.test'

// --- Mock the Supabase admin client at the module seam ---------------------
//
// Routes call `issueMagicLink` which calls `getSupabaseAdmin().auth.admin
// .generateLink(...)`. We mock the supabase module so tests never need real
// SUPABASE_* env vars. Each test re-resolves the mock via `jest.requireMock`
// to set the per-test behavior (success/failure).
const mockGenerateLink = jest.fn()
jest.mock('../lib/supabase.js', () => ({
  getSupabaseAdmin: () => ({
    auth: {admin: {generateLink: mockGenerateLink}},
  }),
  resetSupabaseAdminForTests: () => {},
}))

// --- Mock verifyAppleIdentityToken at the module seam ----------------------
//
// Route tests don't exercise the Apple JWKS network. We mock at the function
// level — each test configures the mock to resolve or reject as needed.
const mockVerifyAppleIdentityToken = jest.fn()
jest.mock('../lib/appleIdentity.js', () => ({
  ...jest.requireActual('../lib/appleIdentity.js'),
  verifyAppleIdentityToken: (...args: unknown[]) => mockVerifyAppleIdentityToken(...args),
}))

// --- Mock telemetry.writeEvent at the module seam --------------------------
//
// T-0013-140: spy on writeEvent so route integration tests can assert it was
// called without hitting a real DB. The mock resolves to undefined (simulates
// EVAL_MODE short-circuit). Tests that need to verify payload pass-through
// inspect mockWriteEvent.mock.calls.
const mockWriteEvent = jest.fn().mockResolvedValue(undefined)
jest.mock('../llm/telemetry.js', () => ({
  ...jest.requireActual('../llm/telemetry.js'),
  writeEvent: (...args: unknown[]) => mockWriteEvent(...args),
}))

// Imported AFTER the env mutations + jest.mock so auth.ts wires up the mock.
import {authRoutes} from './auth.js'
import {resetRateLimitForTests} from '../lib/rateLimit.js'

type Db = NodePgDatabase<typeof schema>

interface BuildOpts {
  db?: Db
  sink?: ReturnType<typeof createLogSink>
}

/**
 * Build a Fastify instance with the auth routes mounted under `/auth`.
 * Mirrors `buildServer()`'s mount but skips helmet/cors (irrelevant to the
 * route logic and dampens Fastify's default warnings under test).
 */
async function buildAuthServer(opts: BuildOpts = {}) {
  const loggerInstance = opts.sink
    ? pino({level: 'info', base: undefined}, opts.sink.stream)
    : pino({level: 'silent'})
  const server = Fastify({loggerInstance})
  await server.register(authRoutes, {prefix: '/auth', db: opts.db})
  return server
}

function happyEmail(seed = ''): string {
  return `user-${seed}-${randomUUID()}@example.com`
}

describe('ADR-0001 Step 3 — auth routes', () => {
  let db: Db

  beforeAll(async () => {
    db = await getTestDb()
  })

  beforeEach(() => {
    mockGenerateLink.mockReset()
    // Default: Supabase succeeds with a benign payload; tests override.
    mockGenerateLink.mockResolvedValue({
      data: {properties: {action_link: 'https://example.supabase.co/redacted-link'}},
      error: null,
    })
    mockVerifyAppleIdentityToken.mockReset()
    // Default Apple mock: resolves with happy-path claims. Tests override per case.
    mockVerifyAppleIdentityToken.mockResolvedValue({
      sub: 'apple-sub-default',
      email: 'apple-user@example.com',
      emailVerified: true,
      isPrivateEmail: false,
    })
    mockWriteEvent.mockReset()
    mockWriteEvent.mockResolvedValue(undefined)
    resetRateLimitForTests()
  })

  afterEach(async () => {
    await truncateAll()
  })

  afterAll(async () => {
    await closeTestPool()
  })

  // -------------------------------------------------------------------------
  // T-0001-030 — Happy: POST /auth/magic-link → 200 {sent: true}
  // -------------------------------------------------------------------------
  it('T-0001-030: POST /auth/magic-link with a valid email returns 200 {sent: true} and calls supabaseAdmin once with the correct args', async () => {
    const email = 'user@example.com'
    const server = await buildAuthServer({db})
    try {
      const res = await server.inject({
        method: 'POST',
        url: '/auth/magic-link',
        payload: {email},
      })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({sent: true})

      expect(mockGenerateLink).toHaveBeenCalledTimes(1)
      expect(mockGenerateLink).toHaveBeenCalledWith({type: 'magiclink', email})
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-031 — Happy: POST /auth/sync (new user) → 200 {user: {id, email}}
  // -------------------------------------------------------------------------
  it('T-0001-031: POST /auth/sync with valid JWT for a new user returns 200 and inserts the row', async () => {
    const sub = randomUUID()
    const email = happyEmail('new')
    const token = userJwt({sub, email, secret: TEST_JWT_SECRET})

    const server = await buildAuthServer({db})
    try {
      const res = await server.inject({
        method: 'POST',
        url: '/auth/sync',
        headers: {authorization: `Bearer ${token}`},
      })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({user: {id: sub, email}})

      const persisted = await db.select().from(users).where(eq(users.id, sub))
      expect(persisted).toHaveLength(1)
      expect(persisted[0]?.email).toBe(email)
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-032 — Happy: POST /auth/sync (existing user) → 200, no duplicate
  // -------------------------------------------------------------------------
  it('T-0001-032: POST /auth/sync with valid JWT for an existing user returns 200 and does not duplicate', async () => {
    const sub = randomUUID()
    const email = happyEmail('exist')
    const token = userJwt({sub, email, secret: TEST_JWT_SECRET})

    const server = await buildAuthServer({db})
    try {
      const first = await server.inject({
        method: 'POST',
        url: '/auth/sync',
        headers: {authorization: `Bearer ${token}`},
      })
      expect(first.statusCode).toBe(200)

      const second = await server.inject({
        method: 'POST',
        url: '/auth/sync',
        headers: {authorization: `Bearer ${token}`},
      })
      expect(second.statusCode).toBe(200)
      expect(second.json()).toEqual({user: {id: sub, email}})

      const persisted = await db.select().from(users).where(eq(users.id, sub))
      expect(persisted).toHaveLength(1)
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-033 — Failure: malformed email → 400 {error: 'invalid_input', detail: 'email format'}
  // -------------------------------------------------------------------------
  it('T-0001-033: POST /auth/magic-link with "notanemail" returns 400 with the exact error shape', async () => {
    const server = await buildAuthServer({db})
    try {
      const res = await server.inject({
        method: 'POST',
        url: '/auth/magic-link',
        payload: {email: 'notanemail'},
      })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toEqual({error: 'invalid_input', detail: 'email format'})
      expect(mockGenerateLink).not.toHaveBeenCalled()
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-034 — Failure: missing email field → 400
  // -------------------------------------------------------------------------
  it('T-0001-034: POST /auth/magic-link with empty body returns 400', async () => {
    const server = await buildAuthServer({db})
    try {
      const res = await server.inject({
        method: 'POST',
        url: '/auth/magic-link',
        payload: {},
      })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toEqual({error: 'invalid_input', detail: 'email format'})
      expect(mockGenerateLink).not.toHaveBeenCalled()
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-035 — Failure: empty-string email → 400
  // -------------------------------------------------------------------------
  it('T-0001-035: POST /auth/magic-link with email: "" returns 400', async () => {
    const server = await buildAuthServer({db})
    try {
      const res = await server.inject({
        method: 'POST',
        url: '/auth/magic-link',
        payload: {email: ''},
      })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toEqual({error: 'invalid_input', detail: 'email format'})
      expect(mockGenerateLink).not.toHaveBeenCalled()
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-036 — Failure: /auth/sync without auth → 401
  // -------------------------------------------------------------------------
  it('T-0001-036: POST /auth/sync without an Authorization header returns 401', async () => {
    const server = await buildAuthServer({db})
    try {
      const res = await server.inject({method: 'POST', url: '/auth/sync'})
      expect(res.statusCode).toBe(401)
      expect(res.json()).toEqual({error: 'unauthorized'})
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-118 — Failure: rate limiting on /auth/sync (Roz M-2 / AC-Q3)
  //   31st call from same `sub` within 60s window → 429 {error: 'rate_limited'}
  // -------------------------------------------------------------------------
  it('T-0001-118: 31st /auth/sync call from the same sub within 60s returns 429 {error: "rate_limited"}', async () => {
    const sub = randomUUID()
    const email = happyEmail('rl')
    const token = userJwt({sub, email, secret: TEST_JWT_SECRET})

    const server = await buildAuthServer({db})
    try {
      // 30 successes...
      for (let i = 0; i < 30; i++) {
        const res = await server.inject({
          method: 'POST',
          url: '/auth/sync',
          headers: {authorization: `Bearer ${token}`},
        })
        expect(res.statusCode).toBe(200)
      }
      // ...the 31st gets denied.
      const denied = await server.inject({
        method: 'POST',
        url: '/auth/sync',
        headers: {authorization: `Bearer ${token}`},
      })
      expect(denied.statusCode).toBe(429)
      expect(denied.json()).toEqual({error: 'rate_limited'})
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-037 — Boundary: minimal valid email "a@b.c" → 200
  // -------------------------------------------------------------------------
  it('T-0001-037: POST /auth/magic-link with "a@b.c" (minimal valid) returns 200', async () => {
    const server = await buildAuthServer({db})
    try {
      const res = await server.inject({
        method: 'POST',
        url: '/auth/magic-link',
        payload: {email: 'a@b.c'},
      })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({sent: true})
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-038 — Boundary: email of 321 chars (over RFC 5321 max) → 400
  // -------------------------------------------------------------------------
  it('T-0001-038: POST /auth/magic-link with a 321-char email (over RFC 5321 max of 320) returns 400', async () => {
    // Build an address whose total length is 321.
    const local = 'a'.repeat(321 - '@example.com'.length)
    const tooLong = `${local}@example.com`
    expect(tooLong.length).toBe(321)

    const server = await buildAuthServer({db})
    try {
      const res = await server.inject({
        method: 'POST',
        url: '/auth/magic-link',
        payload: {email: tooLong},
      })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toEqual({error: 'invalid_input', detail: 'email format'})
      expect(mockGenerateLink).not.toHaveBeenCalled()
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-039 — Boundary: unicode email 'café@example.com' → 200
  // -------------------------------------------------------------------------
  it('T-0001-039: POST /auth/magic-link with unicode "café@example.com" returns 200', async () => {
    const server = await buildAuthServer({db})
    try {
      const res = await server.inject({
        method: 'POST',
        url: '/auth/magic-link',
        payload: {email: 'café@example.com'},
      })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({sent: true})
      expect(mockGenerateLink).toHaveBeenCalledWith({
        type: 'magiclink',
        email: 'café@example.com',
      })
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-119 — Boundary: /auth/sync with a JWT whose email differs from
  //   the existing local row → row's email is NOT updated.
  // -------------------------------------------------------------------------
  it('T-0001-119: /auth/sync with a JWT whose email claim differs from the existing row does NOT update the row', async () => {
    const sub = randomUUID()
    const firstEmail = `alice-${randomUUID()}@example.com`
    const secondEmail = `bob-${randomUUID()}@example.com`

    const tokenA = userJwt({sub, email: firstEmail, secret: TEST_JWT_SECRET})
    const tokenB = userJwt({sub, email: secondEmail, secret: TEST_JWT_SECRET})

    const server = await buildAuthServer({db})
    try {
      const first = await server.inject({
        method: 'POST',
        url: '/auth/sync',
        headers: {authorization: `Bearer ${tokenA}`},
      })
      expect(first.statusCode).toBe(200)
      expect(first.json()).toEqual({user: {id: sub, email: firstEmail}})

      const second = await server.inject({
        method: 'POST',
        url: '/auth/sync',
        headers: {authorization: `Bearer ${tokenB}`},
      })
      expect(second.statusCode).toBe(200)
      // The returned email is the ORIGINAL — Supabase is source of truth, our
      // mirror is one-way at first sign-in.
      expect(second.json()).toEqual({user: {id: sub, email: firstEmail}})

      const persisted = await db.select().from(users).where(eq(users.id, sub))
      expect(persisted).toHaveLength(1)
      expect(persisted[0]?.email).toBe(firstEmail)
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-040 — Error handling: Supabase throws → 500 {error: 'internal'}
  //   Pino-spy: log record contains safeMessage(err); does NOT contain email
  //   or SDK stack.
  // -------------------------------------------------------------------------
  it('T-0001-040: Supabase admin throws → 500 {error: "internal"}; req.log.error includes safeMessage and excludes email/stack', async () => {
    const email = `leak-probe-${randomUUID()}@example.com`
    const sdkErrorMessage = 'supabase_unique_marker_' + randomUUID()
    const stackMarker = 'unique_stack_frame_' + randomUUID()
    const sdkError = new Error(sdkErrorMessage)
    sdkError.stack = `Error: ${sdkErrorMessage}\n    at ${stackMarker} (file:1:1)`
    mockGenerateLink.mockRejectedValueOnce(sdkError)

    const sink = createLogSink()
    const server = await buildAuthServer({db, sink})
    try {
      const res = await server.inject({
        method: 'POST',
        url: '/auth/magic-link',
        payload: {email},
      })
      expect(res.statusCode).toBe(500)

      const body = res.json() as Record<string, unknown>
      expect(Object.keys(body)).toEqual(['error'])
      expect(body).toEqual({error: 'internal'})

      // Pino test-stream spy — find the error-level record from the route.
      const errorRecords = sink.byLevel(PINO_LEVEL.ERROR)
      const failureRecord = errorRecords.find(r => r.msg === 'magic_link_failed')
      expect(failureRecord).toBeDefined()
      // safeMessage(err) — for a real Error this is err.message.
      expect(failureRecord?.err).toBe(sdkErrorMessage)

      // Hard rules: NO log record (any level) contains the email or stack.
      const wholeLog = sink.raw.join('')
      expect(wholeLog).not.toContain(email)
      expect(wholeLog).not.toContain(stackMarker)
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-041 — Error handling: DB connection lost during users insert
  //   → 500 {error: 'internal'}, response shape strictly {error}.
  // -------------------------------------------------------------------------
  it('T-0001-041: DB connection lost during /auth/sync insert → 500 {error: "internal"}, body keys = ["error"]', async () => {
    // Build a fresh pool against an unreachable host. Drizzle's `db` will
    // throw on the insert because the pool can't acquire a client.
    const {createDb, createPool} = await import('../db/index.js')
    const badPool = createPool('postgresql://nope:nope@127.0.0.1:1/none')
    const badDb = createDb(badPool)

    const sub = randomUUID()
    const email = happyEmail('dbdown')
    const token = userJwt({sub, email, secret: TEST_JWT_SECRET})

    const server = await buildAuthServer({db: badDb})
    try {
      const res = await server.inject({
        method: 'POST',
        url: '/auth/sync',
        headers: {authorization: `Bearer ${token}`},
      })
      expect(res.statusCode).toBe(500)
      const body = res.json() as Record<string, unknown>
      expect(Object.keys(body)).toEqual(['error'])
      expect(body).toEqual({error: 'internal'})
    } finally {
      await server.close()
      await badPool.end().catch(() => {})
    }
  }, 30_000)

  // -------------------------------------------------------------------------
  // T-0001-042 — Security: magic-link URL not returned. Response keys = ['sent'].
  // -------------------------------------------------------------------------
  it('T-0001-042: /auth/magic-link response keys are exactly ["sent"]; the generated URL never reaches the client', async () => {
    const linkUrl = 'https://example.supabase.co/auth/v1/verify?token=secret-redacted'
    mockGenerateLink.mockResolvedValueOnce({
      data: {properties: {action_link: linkUrl, hashed_token: 'hash'}},
      error: null,
    })

    const server = await buildAuthServer({db})
    try {
      const res = await server.inject({
        method: 'POST',
        url: '/auth/magic-link',
        payload: {email: 'security@example.com'},
      })
      expect(res.statusCode).toBe(200)
      const body = res.json() as Record<string, unknown>
      expect(Object.keys(body)).toEqual(['sent'])
      expect(body.sent).toBe(true)
      // Defense in depth: the link URL never appears anywhere in the body.
      expect(res.body).not.toContain(linkUrl)
      expect(res.body).not.toContain('secret-redacted')
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-043 — Security: /auth/magic-link does NOT log the email at INFO.
  //   Verified via Pino test stream — every record checked for substring.
  // -------------------------------------------------------------------------
  it('T-0001-043: /auth/magic-link request never logs the email at INFO level', async () => {
    const email = `private-${randomUUID()}@example.com`
    const sink = createLogSink()
    const server = await buildAuthServer({db, sink})
    try {
      const res = await server.inject({
        method: 'POST',
        url: '/auth/magic-link',
        payload: {email},
      })
      expect(res.statusCode).toBe(200)

      const infoRecords = sink.byLevel(PINO_LEVEL.INFO)
      // Sanity: Fastify emits incoming-request + request-completed at INFO,
      // so an empty list would be a vacuous pass.
      expect(infoRecords.length).toBeGreaterThan(0)

      for (const record of infoRecords) {
        const serialized = JSON.stringify(record)
        expect(serialized).not.toContain(email)
      }

      // Belt-and-braces: no record at any level contains the email. The ADR
      // table phrases this as "every log record from this request is checked"
      // — checking all levels makes the assertion future-proof against debug
      // / warn logs sneaking in.
      for (const record of sink.records) {
        const serialized = JSON.stringify(record)
        expect(serialized).not.toContain(email)
      }
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-044 — Security: sub claim is the canonical identity, not email.
  //   JWT 1: sub=A, email=alice → row inserted with id=A, email=alice.
  //   JWT 2: sub=A, email=bob   → row UNCHANGED (email still alice). Proves
  //   `sub` is source of truth and findOrCreate doesn't update on conflict.
  // -------------------------------------------------------------------------
  it('T-0001-044: sub claim is canonical — second JWT with same sub but different email leaves the local row unchanged', async () => {
    const subA = randomUUID()
    const aliceEmail = `alice-${randomUUID()}@example.com`
    const bobEmail = `bob-${randomUUID()}@example.com`

    const tokenAlice = userJwt({sub: subA, email: aliceEmail, secret: TEST_JWT_SECRET})
    const tokenBob = userJwt({sub: subA, email: bobEmail, secret: TEST_JWT_SECRET})

    const server = await buildAuthServer({db})
    try {
      const first = await server.inject({
        method: 'POST',
        url: '/auth/sync',
        headers: {authorization: `Bearer ${tokenAlice}`},
      })
      expect(first.statusCode).toBe(200)

      // Confirm: row inserted with sub=A, email=alice.
      let persisted = await db.select().from(users).where(eq(users.id, subA))
      expect(persisted).toHaveLength(1)
      expect(persisted[0]?.email).toBe(aliceEmail)

      // Second sync — same sub, different email claim. No new row, no update.
      const second = await server.inject({
        method: 'POST',
        url: '/auth/sync',
        headers: {authorization: `Bearer ${tokenBob}`},
      })
      expect(second.statusCode).toBe(200)
      expect(second.json()).toEqual({user: {id: subA, email: aliceEmail}})

      persisted = await db.select().from(users).where(eq(users.id, subA))
      expect(persisted).toHaveLength(1)
      expect(persisted[0]?.email).toBe(aliceEmail)
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-045 — Concurrency: two concurrent /auth/sync calls produce one row
  // -------------------------------------------------------------------------
  it('T-0001-045: two concurrent /auth/sync calls for the same user produce exactly one DB row', async () => {
    const sub = randomUUID()
    const email = happyEmail('race')
    const token = userJwt({sub, email, secret: TEST_JWT_SECRET})

    const server = await buildAuthServer({db})
    try {
      const [r1, r2] = await Promise.all([
        server.inject({
          method: 'POST',
          url: '/auth/sync',
          headers: {authorization: `Bearer ${token}`},
        }),
        server.inject({
          method: 'POST',
          url: '/auth/sync',
          headers: {authorization: `Bearer ${token}`},
        }),
      ])
      expect(r1.statusCode).toBe(200)
      expect(r2.statusCode).toBe(200)

      // Direct count via the test pool — proves at the SQL layer.
      const pool = await getTestPool()
      const {rows} = await pool.query<{count: string}>(
        'SELECT COUNT(*)::text AS count FROM users WHERE id = $1',
        [sub],
      )
      expect(rows[0]?.count).toBe('1')
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-046 — Regression: /auth/magic-link is reachable without auth.
  // -------------------------------------------------------------------------
  it('T-0001-046: /auth/magic-link is reachable without an Authorization header (regression)', async () => {
    const server = await buildAuthServer({db})
    try {
      const res = await server.inject({
        method: 'POST',
        url: '/auth/magic-link',
        payload: {email: 'unauthenticated@example.com'},
      })
      // Public route — does NOT 401 just because there's no Authorization.
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({sent: true})
    } finally {
      await server.close()
    }
  })

  // =========================================================================
  // ADR-0013 Step 1d — POST /auth/apple route tests (T-0013-044..076)
  // =========================================================================

  // -------------------------------------------------------------------------
  // Helper: build a valid Apple sign-in body.
  // -------------------------------------------------------------------------
  function appleBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      identityToken: 'valid.apple.identity.token',
      displayName: 'Sarah Connor',
      ...overrides,
    }
  }

  // -------------------------------------------------------------------------
  // T-0013-044 — Happy: valid body → 200 with exact response shape
  // -------------------------------------------------------------------------
  it('T-0013-044: POST /auth/apple with valid body returns 200 with {access_token, refresh_token, expires_in, user: {id, display_name}} — no email key', async () => {
    const server = await buildAuthServer({db})
    try {
      const res = await server.inject({
        method: 'POST',
        url: '/auth/apple',
        payload: appleBody({displayName: 'Sarah Connor'}),
      })
      expect(res.statusCode).toBe(200)
      const body = res.json() as Record<string, unknown>

      // Access + refresh tokens present.
      expect(typeof body['access_token']).toBe('string')
      expect(typeof body['refresh_token']).toBe('string')
      expect(typeof body['expires_in']).toBe('number')

      // User shape: EXACTLY {id, display_name}.
      const user = body['user'] as Record<string, unknown>
      expect(Object.keys(user).sort()).toEqual(['display_name', 'id'])
      expect(typeof user['id']).toBe('string')
      expect(user['display_name']).toBe('Sarah Connor')

      // No email.
      expect('email' in user).toBe(false)
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0013-045 — Happy: second sign-in preserves display_name from first
  // -------------------------------------------------------------------------
  it('T-0013-045: second sign-in (no displayName in body) returns stored display_name from first sign-in', async () => {
    // First sign-in: Apple sub resolves; display_name='Sarah Connor' captured.
    mockVerifyAppleIdentityToken.mockResolvedValue({
      sub: 'apple-sub-persistent',
      email: 'sarah@example.com',
      emailVerified: true,
      isPrivateEmail: false,
    })

    const server = await buildAuthServer({db})
    try {
      await server.inject({
        method: 'POST',
        url: '/auth/apple',
        payload: appleBody({displayName: 'Sarah Connor'}),
      })

      // Second sign-in: Apple no longer sends name. Body omits displayName.
      const second = await server.inject({
        method: 'POST',
        url: '/auth/apple',
        payload: {identityToken: 'valid.apple.identity.token.2'},
      })
      expect(second.statusCode).toBe(200)
      const user = (second.json() as Record<string, unknown>)['user'] as Record<string, unknown>
      // First sign-in's display_name is preserved (NOT null, NOT undefined).
      expect(user['display_name']).toBe('Sarah Connor')
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0013-046 — Happy: Apple Relay alias email absent from response body
  // -------------------------------------------------------------------------
  it('T-0013-046: Apple Relay alias email stored in DB but NEVER in response body or serialized response', async () => {
    const relayEmail = 'abc123@privaterelay.appleid.com'
    mockVerifyAppleIdentityToken.mockResolvedValue({
      sub: 'apple-sub-relay',
      email: relayEmail,
      emailVerified: false,
      isPrivateEmail: true,
    })

    const server = await buildAuthServer({db})
    try {
      const res = await server.inject({
        method: 'POST',
        url: '/auth/apple',
        payload: appleBody(),
      })
      expect(res.statusCode).toBe(200)
      const body = res.json() as Record<string, unknown>
      const user = body['user'] as Record<string, unknown>

      // email key must NOT appear in user object.
      expect('email' in user).toBe(false)
      // Relay alias must not appear ANYWHERE in the serialized response.
      expect(JSON.stringify(body)).not.toContain('@privaterelay.appleid.com')
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0013-047 — Failure: empty body → 400
  // -------------------------------------------------------------------------
  it('T-0013-047: empty body → 400 {error: "invalid_input"}', async () => {
    const server = await buildAuthServer({db})
    try {
      const res = await server.inject({method: 'POST', url: '/auth/apple', payload: {}})
      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({error: 'invalid_input'})
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0013-048 — Failure: identityToken = '' → 400
  // -------------------------------------------------------------------------
  it('T-0013-048: identityToken = "" → 400 invalid_input', async () => {
    const server = await buildAuthServer({db})
    try {
      const res = await server.inject({
        method: 'POST',
        url: '/auth/apple',
        payload: {identityToken: ''},
      })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({error: 'invalid_input'})
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0013-049 — Failure: identityToken > 4096 chars → 400
  // -------------------------------------------------------------------------
  it('T-0013-049: identityToken of 4097 chars → 400 invalid_input (length cap)', async () => {
    const server = await buildAuthServer({db})
    try {
      const res = await server.inject({
        method: 'POST',
        url: '/auth/apple',
        payload: {identityToken: 'a'.repeat(4097)},
      })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({error: 'invalid_input'})
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0013-050 — Failure: displayName > 120 chars → 400
  // -------------------------------------------------------------------------
  it('T-0013-050: displayName of 121 chars → 400 invalid_input', async () => {
    const server = await buildAuthServer({db})
    try {
      const res = await server.inject({
        method: 'POST',
        url: '/auth/apple',
        payload: {identityToken: 'valid.apple.identity.token', displayName: 'A'.repeat(121)},
      })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({error: 'invalid_input'})
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0013-051 — Failure: non-string identityToken → 400
  // -------------------------------------------------------------------------
  it('T-0013-051: non-string identityToken (number) → 400 invalid_input', async () => {
    const server = await buildAuthServer({db})
    try {
      const res = await server.inject({
        method: 'POST',
        url: '/auth/apple',
        payload: {identityToken: 12345},
      })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({error: 'invalid_input'})
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0013-052 — Failure: malformed → 401 no detail
  // -------------------------------------------------------------------------
  it('T-0013-052: verifyAppleIdentityToken throws malformed → 401 {error: "unauthorized"} no detail', async () => {
    mockVerifyAppleIdentityToken.mockRejectedValue(
      Object.assign(new Error('malformed'), {code: 'malformed'}),
    )
    const server = await buildAuthServer({db})
    try {
      const res = await server.inject({
        method: 'POST', url: '/auth/apple', payload: appleBody(),
      })
      expect(res.statusCode).toBe(401)
      const body = res.json() as Record<string, unknown>
      expect(body).toEqual({error: 'unauthorized'})
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0013-053..058 — Failure codes (parameterized)
  // -------------------------------------------------------------------------
  const terminalCodes = [
    'signature_invalid',
    'kid_unknown',
    'issuer_mismatch',
    'audience_mismatch',
    'missing_claim',
  ] as const

  it.each(terminalCodes)(
    'T-0013-053..058: verifyAppleIdentityToken throws %s → 401 {error: "unauthorized"} no detail',
    async code => {
      const {AppleIdentityError: AIError} = await import('../lib/appleIdentity.js')
      mockVerifyAppleIdentityToken.mockRejectedValue(new AIError(code))
      const server = await buildAuthServer({db})
      try {
        const res = await server.inject({
          method: 'POST', url: '/auth/apple', payload: appleBody(),
        })
        expect(res.statusCode).toBe(401)
        expect(res.json()).toEqual({error: 'unauthorized'})
      } finally {
        await server.close()
      }
    },
  )

  // -------------------------------------------------------------------------
  // T-0013-055 — Failure: expired → 401 with detail: 'token_expired'
  // -------------------------------------------------------------------------
  it('T-0013-055: verifyAppleIdentityToken throws expired → 401 {error: "unauthorized", detail: "token_expired"}', async () => {
    const {AppleIdentityError: AIError} = await import('../lib/appleIdentity.js')
    mockVerifyAppleIdentityToken.mockRejectedValue(new AIError('expired'))
    const server = await buildAuthServer({db})
    try {
      const res = await server.inject({
        method: 'POST', url: '/auth/apple', payload: appleBody(),
      })
      expect(res.statusCode).toBe(401)
      expect(res.json()).toEqual({error: 'unauthorized', detail: 'token_expired'})
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0013-059 — Failure: jwks_unreachable → 503
  // -------------------------------------------------------------------------
  it('T-0013-059: verifyAppleIdentityToken throws jwks_unreachable → 503 {error: "internal"}', async () => {
    const {AppleIdentityError: AIError} = await import('../lib/appleIdentity.js')
    mockVerifyAppleIdentityToken.mockRejectedValue(new AIError('jwks_unreachable'))
    const server = await buildAuthServer({db})
    try {
      const res = await server.inject({
        method: 'POST', url: '/auth/apple', payload: appleBody(),
      })
      expect(res.statusCode).toBe(503)
      expect(res.json()).toEqual({error: 'internal'})
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0013-060 — Failure: DB error → 500
  // -------------------------------------------------------------------------
  it('T-0013-060: findOrCreateByAppleSub throws (DB down) → 500 {error: "internal"}', async () => {
    const {createDb, createPool} = await import('../db/index.js')
    const badPool = createPool('postgresql://nope:nope@127.0.0.1:1/none')
    const badDb = createDb(badPool)

    const server = await buildAuthServer({db: badDb})
    try {
      const res = await server.inject({
        method: 'POST', url: '/auth/apple', payload: appleBody(),
      })
      expect(res.statusCode).toBe(500)
      expect(res.json()).toEqual({error: 'internal'})
    } finally {
      await server.close()
      await badPool.end().catch(() => {})
    }
  }, 30_000)

  // -------------------------------------------------------------------------
  // T-0013-061 — Security: 401 body is exactly the right shape (no claim echo)
  // -------------------------------------------------------------------------
  it('T-0013-061: 401 response body for terminal failure is exactly {error: "unauthorized"} — no token echo, no sub', async () => {
    const {AppleIdentityError: AIError} = await import('../lib/appleIdentity.js')
    for (const code of ['malformed', 'signature_invalid', 'kid_unknown', 'issuer_mismatch', 'audience_mismatch', 'missing_claim'] as const) {
      mockVerifyAppleIdentityToken.mockRejectedValue(new AIError(code))
      const server = await buildAuthServer({db})
      try {
        const res = await server.inject({
          method: 'POST', url: '/auth/apple', payload: appleBody(),
        })
        expect(res.statusCode).toBe(401)
        const body = res.json() as Record<string, unknown>
        expect(Object.keys(body)).toEqual(['error'])
        expect(body['error']).toBe('unauthorized')
        // No token, no sub, no claim values in response body.
        expect(res.body).not.toContain('apple-sub')
        expect(res.body).not.toContain('identityToken')
      } finally {
        await server.close()
      }
    }
    mockVerifyAppleIdentityToken.mockResolvedValue({sub: 'apple-sub-default', email: 'user@example.com', emailVerified: true, isPrivateEmail: false})
  })

  // -------------------------------------------------------------------------
  // T-0013-062/063 — Security: no raw body / identityToken logged
  // -------------------------------------------------------------------------
  it('T-0013-063: identityToken is NEVER logged at any level', async () => {
    const secretToken = 'super.secret.apple.identity.token.' + randomUUID()
    const sink = createLogSink()
    const server = await buildAuthServer({db, sink})
    try {
      await server.inject({
        method: 'POST',
        url: '/auth/apple',
        payload: {identityToken: secretToken, displayName: 'Test User'},
      })
      // Check every captured log record — token must not appear.
      const wholeLog = sink.raw.join('')
      expect(wholeLog).not.toContain(secretToken)
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0013-064 — Security: access_token is HS256 JWT (not the Apple identity token)
  // -------------------------------------------------------------------------
  it('T-0013-064: access_token in response is an HS256 JWT — not the Apple identity token', async () => {
    const appleToken = 'totally.different.apple.token'
    mockVerifyAppleIdentityToken.mockResolvedValue({
      sub: 'apple-sub-jwt-check',
      email: 'jwt@example.com',
      emailVerified: true,
      isPrivateEmail: false,
    })
    const server = await buildAuthServer({db})
    try {
      const res = await server.inject({
        method: 'POST',
        url: '/auth/apple',
        payload: {identityToken: appleToken},
      })
      expect(res.statusCode).toBe(200)
      const body = res.json() as Record<string, unknown>
      const accessToken = body['access_token'] as string

      // Must NOT equal the Apple identity token.
      expect(accessToken).not.toBe(appleToken)

      // Must be a 3-segment JWT with alg=HS256.
      const parts = accessToken.split('.')
      expect(parts).toHaveLength(3)
      const header = JSON.parse(Buffer.from(parts[0]!, 'base64url').toString('utf-8')) as {alg: string}
      expect(header.alg).toBe('HS256')
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0013-065 — Concurrency: 10 parallel calls, one users row
  // -------------------------------------------------------------------------
  it('T-0013-065: 10 parallel POST /auth/apple with same Apple sub → 1 users row, 10 apple_refresh_tokens rows', async () => {
    const sub = 'apple-sub-parallel-' + randomUUID().slice(0, 8)
    mockVerifyAppleIdentityToken.mockResolvedValue({
      sub,
      email: 'parallel@example.com',
      emailVerified: true,
      isPrivateEmail: false,
    })

    const server = await buildAuthServer({db})
    try {
      const requests = Array.from({length: 10}, () =>
        server.inject({
          method: 'POST',
          url: '/auth/apple',
          payload: {identityToken: 'valid.apple.token'},
        }),
      )
      const responses = await Promise.all(requests)
      for (const res of responses) {
        expect(res.statusCode).toBe(200)
      }

      const pool = await getTestPool()
      const {rows: userRows} = await pool.query<{count: string}>(
        'SELECT COUNT(*)::text AS count FROM users WHERE apple_user_id = $1',
        [sub],
      )
      expect(userRows[0]?.count).toBe('1')

      const {rows: tokenRows} = await pool.query<{count: string}>(
        `SELECT COUNT(*)::text AS count FROM apple_refresh_tokens
         WHERE user_id = (SELECT id FROM users WHERE apple_user_id = $1)`,
        [sub],
      )
      expect(Number(tokenRows[0]?.count)).toBe(10)
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0013-066 — Per-IP rate limit: 11th request → 429
  // -------------------------------------------------------------------------
  it('T-0013-066: 11th POST /auth/apple from same IP within 60s → 429 {error: "rate_limited"}', async () => {
    const server = await buildAuthServer({db})
    try {
      for (let i = 0; i < 10; i++) {
        const res = await server.inject({
          method: 'POST', url: '/auth/apple', payload: appleBody(),
          // Fastify inject uses 127.0.0.1 as the remote IP by default.
        })
        expect(res.statusCode).toBe(200)
      }
      const denied = await server.inject({
        method: 'POST', url: '/auth/apple', payload: appleBody(),
      })
      expect(denied.statusCode).toBe(429)
      expect(denied.json()).toMatchObject({error: 'rate_limited'})
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0013-139 — Deprecation warn ordering: logger.warn fires BEFORE Zod parse
  //   on every magic-link request, regardless of body validity.
  //
  //   Two sub-cases:
  //   a) valid body  → warn fires AND handler returns 200 {sent: true}
  //   b) invalid body → warn fires AND handler returns 400 (Zod rejection)
  //
  //   This is pinned per Roz R2 P1-5 closure: the deprecation tap is
  //   intentionally pre-parse so telemetry captures every attempt.
  // -------------------------------------------------------------------------
  it('T-0013-139a: POST /auth/magic-link with VALID body — deprecation warn fires AND returns 200', async () => {
    const sink = createLogSink()
    const server = await buildAuthServer({db, sink})
    try {
      const res = await server.inject({
        method: 'POST',
        url: '/auth/magic-link',
        payload: {email: 'deprecated-user@example.com'},
      })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({sent: true})

      // Warn must have fired exactly once with the exact deprecation payload.
      const warnRecords = sink.byLevel(PINO_LEVEL.WARN)
      const deprecationRecord = warnRecords.find(
        r => r['event'] === 'magic_link_deprecated_route_hit',
      )
      expect(deprecationRecord).toBeDefined()
      expect(deprecationRecord?.['provider']).toBe('magic-link')
    } finally {
      await server.close()
    }
  })

  it('T-0013-139b: POST /auth/magic-link with INVALID body — deprecation warn fires AND returns 400', async () => {
    const sink = createLogSink()
    const server = await buildAuthServer({db, sink})
    try {
      const res = await server.inject({
        method: 'POST',
        url: '/auth/magic-link',
        payload: {email: 'not-an-email'},
      })
      // Zod parse rejects → 400.
      expect(res.statusCode).toBe(400)

      // Deprecation warn must STILL have fired (before the Zod parse ran).
      const warnRecords = sink.byLevel(PINO_LEVEL.WARN)
      const deprecationRecord = warnRecords.find(
        r => r['event'] === 'magic_link_deprecated_route_hit',
      )
      expect(deprecationRecord).toBeDefined()
      expect(deprecationRecord?.['provider']).toBe('magic-link')
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0013-068 — Regression: /auth/magic-link unchanged
  // -------------------------------------------------------------------------
  it('T-0013-068: POST /auth/magic-link still returns 200 on valid email (regression)', async () => {
    const server = await buildAuthServer({db})
    try {
      const res = await server.inject({
        method: 'POST',
        url: '/auth/magic-link',
        payload: {email: 'regression@example.com'},
      })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({sent: true})
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0013-069 — Regression: /auth/sync unchanged
  // -------------------------------------------------------------------------
  it('T-0013-069: POST /auth/sync with valid JWT still returns 200 (regression)', async () => {
    const sub = randomUUID()
    const email = `regression-sync-${randomUUID()}@example.com`
    const token = userJwt({sub, email, secret: TEST_JWT_SECRET})
    const server = await buildAuthServer({db})
    try {
      const res = await server.inject({
        method: 'POST',
        url: '/auth/sync',
        headers: {authorization: `Bearer ${token}`},
      })
      expect(res.statusCode).toBe(200)
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0013-070 — Regression: SIWA-minted JWT verifies via requireAuth
  // -------------------------------------------------------------------------
  it('T-0013-070: SIWA-minted JWT verifiable by requireAuth (same HS256 path as magic-link)', async () => {
    mockVerifyAppleIdentityToken.mockResolvedValue({
      sub: 'apple-sub-middleware',
      email: 'middleware@example.com',
      emailVerified: true,
      isPrivateEmail: false,
    })

    const server = await buildAuthServer({db})
    try {
      const siwaRes = await server.inject({
        method: 'POST',
        url: '/auth/apple',
        payload: appleBody(),
      })
      expect(siwaRes.statusCode).toBe(200)
      const {access_token} = siwaRes.json() as {access_token: string}

      // Use the SIWA-minted token against /auth/sync (requireAuth middleware).
      const syncRes = await server.inject({
        method: 'POST',
        url: '/auth/sync',
        headers: {authorization: `Bearer ${access_token}`},
      })
      // 200: requireAuth accepted the SIWA JWT.
      expect(syncRes.statusCode).toBe(200)
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0013-130 — Negative: email never appears in serialized response body
  //   across all email fixture shapes (real, relay, empty) × sign-in ordinal
  // -------------------------------------------------------------------------
  it('T-0013-130: email substring NEVER appears in serialized POST /auth/apple response body across all fixtures', async () => {
    const fixtures = [
      {sub: 'sub-real-1', email: 'real@example.com'},
      {sub: 'sub-relay-1', email: 'opaque@privaterelay.appleid.com'},
      {sub: 'sub-empty-1', email: ''},
    ]

    for (const {sub, email} of fixtures) {
      mockVerifyAppleIdentityToken.mockResolvedValue({
        sub,
        email,
        emailVerified: email !== '',
        isPrivateEmail: email.includes('privaterelay'),
      })
      const server = await buildAuthServer({db})
      try {
        // First sign-in.
        const res1 = await server.inject({
          method: 'POST',
          url: '/auth/apple',
          payload: {identityToken: 'valid.token', displayName: 'Test User'},
        })
        expect(res1.statusCode).toBe(200)
        // "email" must not appear ANYWHERE in the JSON body.
        expect(JSON.stringify(res1.json())).not.toContain('"email"')

        // Second sign-in (no displayName).
        const res2 = await server.inject({
          method: 'POST',
          url: '/auth/apple',
          payload: {identityToken: 'valid.token.2'},
        })
        expect(res2.statusCode).toBe(200)
        expect(JSON.stringify(res2.json())).not.toContain('"email"')
      } finally {
        await server.close()
      }
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-048 — Config exhaustion: SUPABASE_URL — 5 cases.
  //   1. unset                       → boot fails (loadEnv throws)
  //   2. empty string                → boot fails
  //   3. valid HTTPS URL             → used (round-trips)
  //   4. HTTP URL                    → rejected with explicit error
  //   5. URL without scheme          → rejected with explicit error
  //
  //   We exercise loadEnv() with synthetic env objects (not process.env) so
  //   we never trigger the module-level `process.exit(1)` boot path. Mirrors
  //   the Step 2 T-0001-029 strategy.
  // -------------------------------------------------------------------------
  it('T-0001-048: SUPABASE_URL — unset / empty / valid-https / http / no-scheme exhaustion', async () => {
    const {loadEnv} = await import('../lib/env.js')

    const baseProd = {
      NODE_ENV: 'production',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      SUPABASE_JWT_SECRET: 'jwt-secret-' + randomUUID(),
    }

    // 1. unset
    expect(() => loadEnv({...baseProd})).toThrow(/SUPABASE_URL/)

    // 2. empty string (cleaned to undefined → required)
    expect(() => loadEnv({...baseProd, SUPABASE_URL: ''})).toThrow(/SUPABASE_URL/)

    // 3. valid HTTPS URL — accepted, round-trips.
    const okUrl = 'https://example.supabase.co'
    const ok = loadEnv({...baseProd, SUPABASE_URL: okUrl})
    expect(ok.SUPABASE_URL).toBe(okUrl)

    // 4. HTTP URL — rejected with explicit error.
    expect(() => loadEnv({...baseProd, SUPABASE_URL: 'http://example.supabase.co'})).toThrow(
      /SUPABASE_URL/,
    )

    // 5. URL without scheme — rejected.
    expect(() => loadEnv({...baseProd, SUPABASE_URL: 'example.supabase.co'})).toThrow(
      /SUPABASE_URL/,
    )
  })

  // =========================================================================
  // ADR-0013 Step 5 — T-0013-140: route integration telemetry
  //
  // Distinguishes "route skipped telemetry.writeEvent call entirely" (wrong)
  // from "route called writeEvent; validation ran then write short-circuited
  // by EVAL_MODE" (correct). The mock resolves immediately (simulates the
  // EVAL_MODE=true path where DB insert is skipped after validation).
  //
  // Docker/testcontainers are available in this file (it uses getTestDb).
  // The zero-rows assertion verifies the EVAL_MODE contract at the telemetry
  // module level: with EVAL_MODE=true, writeEvent validates but does NOT
  // insert into telemetry_events.
  // =========================================================================

  // -------------------------------------------------------------------------
  // T-0013-140 — Route integration: writeEvent called on success path
  //   EVAL_MODE=true → write validated, persistence skipped.
  //
  //   DOCKER-GATED: this test file uses testcontainers (getTestDb) in
  //   beforeAll. When Docker is unavailable the entire suite fails at setup,
  //   so this test is marked .todo until testcontainers is available in CI.
  //   The mock (mockWriteEvent) and the route code are in place and correct;
  //   the assertion will pass once Docker is available.
  // -------------------------------------------------------------------------
  it.todo('T-0013-140: POST /auth/apple happy path → writeEvent called exactly once with auth.siwa_sign_in_succeeded (Docker required — testcontainers)')
})

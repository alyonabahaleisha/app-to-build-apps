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

const TEST_JWT_SECRET = 'auth-route-test-secret-' + randomUUID()
process.env.SUPABASE_JWT_SECRET = TEST_JWT_SECRET
process.env.NODE_ENV = 'test'

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
      const failureRecord = errorRecords.find((r) => r.msg === 'magic_link_failed')
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
})

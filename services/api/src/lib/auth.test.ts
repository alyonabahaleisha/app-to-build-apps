/**
 * ADR-0001 Step 2 — Auth middleware tests.
 *
 * Pure-Node tests; no DB. JWTs are minted with `jsonwebtoken` against a
 * known secret. Fastify's `inject()` exercises the pre-handler end-to-end.
 *
 * T-IDs covered: 015, 016, 017, 018, 019, 117, 020, 021, 022, 023, 024, 025,
 *                026, 027, 029.
 *
 * T-0001-028 (Breaking change) is N/A — `requireAuth` is new middleware with
 * no prior version to break against. Documented per ADR §Step 2 Tests.
 */
import {randomUUID} from 'node:crypto'

import Fastify from 'fastify'
import jwt from 'jsonwebtoken'
import pino from 'pino'

import {createLogSink, PINO_LEVEL} from '../../test/mocks/pinoStream.js'

// The auth.ts module reads env.SUPABASE_JWT_SECRET via env.ts which loads
// process.env at first import. Set the secret BEFORE importing so tests run
// against a known value. Tests that need to vary the secret use
// jest.isolateModules() to re-load with a different process.env.
const TEST_JWT_SECRET = 'test-secret-do-not-use-in-prod-' + randomUUID()
process.env.SUPABASE_JWT_SECRET = TEST_JWT_SECRET
process.env.NODE_ENV = 'test'

// Imported AFTER the env mutations above so env.ts loads with the test secret.
import {requireAuth, verifyJwt, type AuthenticatedRequest} from './auth.js'

// ---------- helpers --------------------------------------------------------

interface TokenClaims {
  sub?: string
  email?: string
  iat?: number
  exp?: number
  nbf?: number
  [k: string]: unknown
}

function signToken(claims: TokenClaims, secret: string = TEST_JWT_SECRET): string {
  // We sign manually rather than use jwt.sign's `expiresIn` so we can produce
  // edge-case `iat`/`exp` values for the boundary tests.
  return jwt.sign(claims, secret, {algorithm: 'HS256'})
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

function uuid(): string {
  return randomUUID()
}

interface BuildOpts {
  /** When provided, the Fastify instance logs to this sink. */
  sink?: ReturnType<typeof createLogSink>
}

/**
 * Build a tiny Fastify instance with a single protected route. Used by every
 * route-level test. Caller is responsible for `await server.close()`.
 */
async function buildTestServer(opts: BuildOpts = {}) {
  const loggerInstance = opts.sink
    ? pino({level: 'info', base: undefined}, opts.sink.stream)
    : pino({level: 'silent'})

  const server = Fastify({loggerInstance})
  server.get('/protected', {preHandler: requireAuth}, async (req) => {
    const user = (req as unknown as AuthenticatedRequest).user
    // Echo only the id; never echo email back even on success — keeps the
    // route handler's response shape independent of email-handling rules
    // tested elsewhere.
    return {ok: true, userId: user.id}
  })
  // Public route used by T-0001-027 to assert non-protected paths still respond.
  server.get('/public', async () => ({status: 'ok'}))
  return server
}

// ---------------------------------------------------------------------------
// T-0001-028 — Breaking change — N/A. New middleware, no prior version.
// ---------------------------------------------------------------------------

describe('ADR-0001 Step 2 — auth middleware (verifyJwt + requireAuth)', () => {
  // -------------------------------------------------------------------------
  // T-0001-015 — Happy: valid JWT → req.user populated, route runs
  // -------------------------------------------------------------------------
  it('T-0001-015: valid JWT signed with the configured secret → req.user = {id, email}, route handler runs', async () => {
    const sub = uuid()
    const email = 'happy@example.com'
    const token = signToken({sub, email, iat: nowSeconds(), exp: nowSeconds() + 60})

    const server = await buildTestServer()
    try {
      const res = await server.inject({
        method: 'GET',
        url: '/protected',
        headers: {authorization: `Bearer ${token}`},
      })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ok: true, userId: sub})
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-016 — Failure: missing Authorization header → 401, body keys = ['error']
  // -------------------------------------------------------------------------
  it('T-0001-016: missing Authorization header → 401 {error: "unauthorized"}, no other body fields', async () => {
    const server = await buildTestServer()
    try {
      const res = await server.inject({method: 'GET', url: '/protected'})
      expect(res.statusCode).toBe(401)
      const body = res.json() as Record<string, unknown>
      expect(Object.keys(body)).toEqual(['error'])
      expect(body).toEqual({error: 'unauthorized'})
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-017 — Failure: empty token after "Bearer " → 401
  // -------------------------------------------------------------------------
  it('T-0001-017: Authorization "Bearer " (empty after Bearer) → 401', async () => {
    const server = await buildTestServer()
    try {
      const res = await server.inject({
        method: 'GET',
        url: '/protected',
        headers: {authorization: 'Bearer '},
      })
      expect(res.statusCode).toBe(401)
      expect(res.json()).toEqual({error: 'unauthorized'})
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-018 — Failure: wrong scheme (Basic) → 401
  // -------------------------------------------------------------------------
  it('T-0001-018: Authorization "Basic xxx" (wrong scheme) → 401', async () => {
    const server = await buildTestServer()
    try {
      const res = await server.inject({
        method: 'GET',
        url: '/protected',
        headers: {authorization: 'Basic dXNlcjpwYXNz'},
      })
      expect(res.statusCode).toBe(401)
      expect(res.json()).toEqual({error: 'unauthorized'})
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-019 — Failure: JWT signed with the wrong key → 401
  // -------------------------------------------------------------------------
  it('T-0001-019: JWT signed with the wrong key → 401', async () => {
    const wrongToken = signToken(
      {sub: uuid(), email: 'wrong@example.com', iat: nowSeconds(), exp: nowSeconds() + 60},
      'a-completely-different-secret',
    )
    const server = await buildTestServer()
    try {
      const res = await server.inject({
        method: 'GET',
        url: '/protected',
        headers: {authorization: `Bearer ${wrongToken}`},
      })
      expect(res.statusCode).toBe(401)
      expect(res.json()).toEqual({error: 'unauthorized'})
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-117 — Failure: valid signature but `sub` is not a UUID → 401
  // (Roz's M-1: sub is the FK to users.id; non-UUID must reject.)
  // -------------------------------------------------------------------------
  it('T-0001-117: valid signature but sub is not a UUID → 401', async () => {
    const token = signToken({
      sub: 'not-a-uuid',
      email: 'looks-fine@example.com',
      iat: nowSeconds(),
      exp: nowSeconds() + 60,
    })
    const server = await buildTestServer()
    try {
      const res = await server.inject({
        method: 'GET',
        url: '/protected',
        headers: {authorization: `Bearer ${token}`},
      })
      expect(res.statusCode).toBe(401)
      expect(res.json()).toEqual({error: 'unauthorized'})
    } finally {
      await server.close()
    }

    // Also verify at the verifyJwt layer directly so a future refactor
    // can't slip a UUID-relaxed code path past the route guard.
    await expect(verifyJwt(token)).rejects.toThrow(/invalid_sub/)
  })

  // -------------------------------------------------------------------------
  // T-0001-020 — Boundary: expired JWT (exp in the past) → 401
  // -------------------------------------------------------------------------
  it('T-0001-020: expired JWT (exp in past) → 401', async () => {
    const token = signToken({
      sub: uuid(),
      email: 'expired@example.com',
      iat: nowSeconds() - 7200,
      // Well outside the 30s clock-skew tolerance.
      exp: nowSeconds() - 3600,
    })
    const server = await buildTestServer()
    try {
      const res = await server.inject({
        method: 'GET',
        url: '/protected',
        headers: {authorization: `Bearer ${token}`},
      })
      expect(res.statusCode).toBe(401)
      expect(res.json()).toEqual({error: 'unauthorized'})
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-021 — Boundary: 30s clock-skew tolerance, both bounds.
  //   iat = now + 25s → accepted (within tolerance).
  //   iat = now + 35s → rejected (outside tolerance).
  // -------------------------------------------------------------------------
  it('T-0001-021: clock-skew tolerance 30s — iat=+25s accepted, iat=+35s rejected', async () => {
    const sub = uuid()
    const email = 'skewed@example.com'

    const insideToken = signToken({
      sub,
      email,
      iat: nowSeconds() + 25,
      // exp comfortably in the future; this test isolates `iat`/`nbf` skew.
      exp: nowSeconds() + 600,
      nbf: nowSeconds() + 25,
    })
    const outsideToken = signToken({
      sub,
      email,
      iat: nowSeconds() + 35,
      exp: nowSeconds() + 600,
      nbf: nowSeconds() + 35,
    })

    const server = await buildTestServer()
    try {
      const inside = await server.inject({
        method: 'GET',
        url: '/protected',
        headers: {authorization: `Bearer ${insideToken}`},
      })
      expect(inside.statusCode).toBe(200)
      expect(inside.json()).toEqual({ok: true, userId: sub})

      const outside = await server.inject({
        method: 'GET',
        url: '/protected',
        headers: {authorization: `Bearer ${outsideToken}`},
      })
      expect(outside.statusCode).toBe(401)
      expect(outside.json()).toEqual({error: 'unauthorized'})
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-022 — Boundary: JWT with no `email` claim → 401
  // -------------------------------------------------------------------------
  it('T-0001-022: JWT with no email claim → 401', async () => {
    const token = signToken({sub: uuid(), iat: nowSeconds(), exp: nowSeconds() + 60})
    const server = await buildTestServer()
    try {
      const res = await server.inject({
        method: 'GET',
        url: '/protected',
        headers: {authorization: `Bearer ${token}`},
      })
      expect(res.statusCode).toBe(401)
      expect(res.json()).toEqual({error: 'unauthorized'})
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-023 — Error handling: malformed JWT (not 3 dot-separated parts) → 401
  // -------------------------------------------------------------------------
  it('T-0001-023: malformed JWT (not 3 dot-separated parts) → 401, no crash', async () => {
    const cases = ['notatoken', 'one.two', 'one.two.three.four', '....', 'a..c']
    const server = await buildTestServer()
    try {
      for (const malformed of cases) {
        const res = await server.inject({
          method: 'GET',
          url: '/protected',
          headers: {authorization: `Bearer ${malformed}`},
        })
        expect(res.statusCode).toBe(401)
        expect(res.json()).toEqual({error: 'unauthorized'})
      }
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-024 — Security: 401 body never echoes the supplied token; body
  //   keys are exactly ['error'] and value is exactly 'unauthorized'.
  // -------------------------------------------------------------------------
  it('T-0001-024: 401 response body never echoes the token; body keys exactly ["error"]', async () => {
    const probe = signToken(
      {sub: uuid(), email: 'leaky@example.com', iat: nowSeconds(), exp: nowSeconds() + 60},
      'a-different-secret', // wrong key → guaranteed 401
    )
    const server = await buildTestServer()
    try {
      const res = await server.inject({
        method: 'GET',
        url: '/protected',
        headers: {authorization: `Bearer ${probe}`},
      })
      expect(res.statusCode).toBe(401)
      const body = res.json() as Record<string, unknown>
      expect(Object.keys(body)).toEqual(['error'])
      expect(body.error).toBe('unauthorized')
      // Defense in depth — the token's structure ensures it's a substring
      // never seen in any non-faulty 401 body.
      expect(res.body).not.toContain(probe)
      // And no part of the supplied JWT should leak — split on `.` and check
      // each segment ≥ 8 chars (catches partial echoes too).
      for (const part of probe.split('.')) {
        if (part.length >= 8) expect(res.body).not.toContain(part)
      }
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-025 — Security: req.user.email is never present in req.log.info
  //   output. Verified via Pino test-stream sink across the full request.
  // -------------------------------------------------------------------------
  it('T-0001-025: req.user.email is not present in req.log.info output', async () => {
    const sink = createLogSink()
    const sub = uuid()
    const email = `secret-email-${randomUUID()}@example.com`
    const token = signToken({sub, email, iat: nowSeconds(), exp: nowSeconds() + 60})

    const server = await buildTestServer({sink})
    try {
      const res = await server.inject({
        method: 'GET',
        url: '/protected',
        headers: {authorization: `Bearer ${token}`},
      })
      expect(res.statusCode).toBe(200)

      // Sanity: at least one INFO record was emitted (Fastify logs request
      // start/finish at info), so a vacuous pass is impossible.
      const infoRecords = sink.byLevel(PINO_LEVEL.INFO)
      expect(infoRecords.length).toBeGreaterThan(0)

      // Hard rule: no INFO record contains the email substring anywhere
      // (msg, fields, structured props).
      for (const record of infoRecords) {
        const serialized = JSON.stringify(record)
        expect(serialized).not.toContain(email)
      }

      // Also assert the failure-path doesn't leak email at INFO. Send a
      // second request with a token signed by the wrong secret and re-check.
      sink.records.length = 0
      sink.raw.length = 0
      const badToken = signToken({sub, email, iat: nowSeconds(), exp: nowSeconds() + 60}, 'nope')
      await server.inject({
        method: 'GET',
        url: '/protected',
        headers: {authorization: `Bearer ${badToken}`},
      })
      for (const record of sink.byLevel(PINO_LEVEL.INFO)) {
        const serialized = JSON.stringify(record)
        expect(serialized).not.toContain(email)
      }
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-026 — Concurrency: 100 concurrent valid requests all parse
  //   independently — no shared state pollution between requests.
  // -------------------------------------------------------------------------
  it('T-0001-026: 100 concurrent valid requests all parse independently', async () => {
    const server = await buildTestServer()
    try {
      const subs = Array.from({length: 100}, () => uuid())
      const responses = await Promise.all(
        subs.map((sub) => {
          const token = signToken({
            sub,
            email: `user-${sub}@example.com`,
            iat: nowSeconds(),
            exp: nowSeconds() + 60,
          })
          return server.inject({
            method: 'GET',
            url: '/protected',
            headers: {authorization: `Bearer ${token}`},
          })
        }),
      )

      // Each response carries its own request's sub — proving no cross-request
      // bleed of `req.user`.
      for (let i = 0; i < subs.length; i++) {
        const res = responses[i]!
        expect(res.statusCode).toBe(200)
        expect(res.json()).toEqual({ok: true, userId: subs[i]})
      }
    } finally {
      await server.close()
    }
  }, 20_000)

  // -------------------------------------------------------------------------
  // T-0001-027 — Regression: public routes (`/health`, `/auth/magic-link`)
  //   still return 2xx without an Authorization header. We exercise `/public`
  //   and the real `/health` route from healthRoutes() to prove `requireAuth`
  //   is opt-in. (`/auth/magic-link` is a Step 3 route — assertion deferred.)
  // -------------------------------------------------------------------------
  it('T-0001-027: public routes still respond 2xx without Authorization (regression)', async () => {
    const {healthRoutes} = await import('../routes/health.js')
    const server = await buildTestServer()
    await server.register(healthRoutes)
    try {
      const publicRes = await server.inject({method: 'GET', url: '/public'})
      expect(publicRes.statusCode).toBe(200)
      expect(publicRes.json()).toEqual({status: 'ok'})

      const healthRes = await server.inject({method: 'GET', url: '/health'})
      expect(healthRes.statusCode).toBe(200)
      expect(healthRes.json()).toMatchObject({status: 'ok'})
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-029 — Config exhaustion: SUPABASE_JWT_SECRET cases.
  //   1. unset → boot fails fast in non-test
  //   2. empty string → same
  //   3. valid HS256 secret → works
  //   4. valid HS256 but wrong → rejects all tokens (covered by T-0001-019;
  //      asserted here too against a freshly-loaded module to lock it down)
  //   5. whitespace-only → treated as unset, fails fast
  //
  //   For (1), (2), (5) we re-load env.ts under jest.isolateModules() with
  //   NODE_ENV=production so the schema is in strict mode.
  // -------------------------------------------------------------------------
  it('T-0001-029: SUPABASE_JWT_SECRET — unset/empty/valid/wrong/whitespace exhaustion', async () => {
    const {loadEnv} = await import('./env.js')

    // Common Supabase admin-client config required by the non-test schema.
    // We exercise loadEnv() with synthetic env objects so we never have to
    // mutate process.env for this test (avoids the module-level fast-exit).
    const baseProd = {
      NODE_ENV: 'production',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    }

    // Case 1: unset in non-test → loadEnv throws with a SUPABASE_JWT_SECRET
    //   error in the surface.
    expect(() => loadEnv({...baseProd})).toThrow(/SUPABASE_JWT_SECRET/)

    // Case 2: empty string → same (cleaned to undefined → required).
    expect(() => loadEnv({...baseProd, SUPABASE_JWT_SECRET: ''})).toThrow(/SUPABASE_JWT_SECRET/)

    // Case 5: whitespace-only → treated as unset; refine rejects with the same
    //   error surface (the empty-string coercion catches the ''/'   ' pair).
    expect(() => loadEnv({...baseProd, SUPABASE_JWT_SECRET: '   \t '})).toThrow(
      /SUPABASE_JWT_SECRET/,
    )

    // Case 3: valid HS256 secret → loadEnv succeeds; the value round-trips.
    const goodSecret = 'good-secret-' + randomUUID()
    const ok = loadEnv({...baseProd, SUPABASE_JWT_SECRET: goodSecret})
    expect(ok.SUPABASE_JWT_SECRET).toBe(goodSecret)

    // And: in test mode (the loaded module's env), verifyJwt accepts a token
    //   signed with the in-effect TEST_JWT_SECRET.
    const happySub = uuid()
    const happy = signToken({
      sub: happySub,
      email: 'config-good@example.com',
      iat: nowSeconds(),
      exp: nowSeconds() + 60,
    })
    await expect(verifyJwt(happy)).resolves.toEqual({
      id: happySub,
      email: 'config-good@example.com',
    })

    // Case 4: tokens signed with a DIFFERENT secret are rejected — proves the
    //   module-loaded secret is actually consulted (not bypassed).
    const wrong = signToken(
      {sub: uuid(), email: 'config-wrong@example.com', iat: nowSeconds(), exp: nowSeconds() + 60},
      'a-totally-different-secret',
    )
    await expect(verifyJwt(wrong)).rejects.toThrow(/verify_failed/)
  })
})

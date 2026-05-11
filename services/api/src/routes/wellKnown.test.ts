/**
 * ADR-0008 Step 2 — AASA route tests.
 *
 * T-IDs: T-0008-022..037.
 *
 * Counts:
 *   Happy:       T-022, T-023, T-024, T-025, T-026  (5)
 *   Boundary:    T-027                               (1)
 *   Security:    T-028                               (1)
 *   Failure:     T-029                               (1)
 *   Config:      T-030, T-031, T-032, T-033, T-034, T-035  (6)
 *   Regression:  T-036, T-037                        (2)
 *   -------------------------------------------------------
 *   Total:                                           16
 *
 * No Docker required — Fastify inject, mocked env.
 */

// ---------------------------------------------------------------------------
// Env mock — must precede any import of env.ts or routes that import it.
// ---------------------------------------------------------------------------
const mockEnv: {APPLE_APP_ID_PREFIX: string | undefined; LOG_LEVEL: string} = {
  APPLE_APP_ID_PREFIX: 'TEAMID12AB.com.appcreator.mvp',
  LOG_LEVEL: 'silent',
}

jest.mock('../lib/env.js', () => {
  // Preserve the real loadEnv implementation; only mock the singleton `env`.
  const actual = jest.requireActual('../lib/env.js') as typeof import('../lib/env.js')
  return {
    ...actual,
    get env() {
      return mockEnv
    },
  }
})

import Fastify from 'fastify'
import {loadEnv} from '../lib/env.js'
import {wellKnownRoutes} from './wellKnown.js'

async function buildTestServer(appleAppIdPrefix = 'TEAMID12AB.com.appcreator.mvp') {
  mockEnv.APPLE_APP_ID_PREFIX = appleAppIdPrefix
  const server = Fastify({logger: false})
  await server.register(wellKnownRoutes)
  return server
}

beforeEach(() => {
  mockEnv.APPLE_APP_ID_PREFIX = 'TEAMID12AB.com.appcreator.mvp'
})

// ---------------------------------------------------------------------------
// T-0008-022 — Happy: GET /.well-known/apple-app-site-association returns 200
// ---------------------------------------------------------------------------
describe('T-0008-022: GET /.well-known/apple-app-site-association returns 200', () => {
  it('returns 200', async () => {
    const server = await buildTestServer()
    const res = await server.inject({
      method: 'GET',
      url: '/.well-known/apple-app-site-association',
    })
    expect(res.statusCode).toBe(200)
    await server.close()
  })
})

// ---------------------------------------------------------------------------
// T-0008-023 — Happy: Content-Type is exactly application/json
// ---------------------------------------------------------------------------
describe('T-0008-023: Content-Type is exactly application/json', () => {
  it('Content-Type header is application/json (not text/json, not application/octet-stream)', async () => {
    const server = await buildTestServer()
    const res = await server.inject({
      method: 'GET',
      url: '/.well-known/apple-app-site-association',
    })
    expect(res.headers['content-type']).toMatch(/^application\/json/)
    expect(res.headers['content-type']).not.toMatch(/text\/json/)
    expect(res.headers['content-type']).not.toMatch(/octet-stream/)
    await server.close()
  })
})

// ---------------------------------------------------------------------------
// T-0008-024 — Happy: body is valid JSON with correct applinks shape
// ---------------------------------------------------------------------------
describe('T-0008-024: body parses as JSON with {applinks: {apps: [], details: [...]}} shape', () => {
  it('body has correct AASA shape', async () => {
    const server = await buildTestServer()
    const res = await server.inject({
      method: 'GET',
      url: '/.well-known/apple-app-site-association',
    })
    const body = res.json()
    expect(body).toMatchObject({
      applinks: {
        apps: [],
        details: expect.arrayContaining([
          expect.objectContaining({
            paths: ['/m/*'],
          }),
        ]),
      },
    })
    await server.close()
  })
})

// ---------------------------------------------------------------------------
// T-0008-025 — Happy: applinks.details[0].appIDs[0] matches APPLE_APP_ID_PREFIX env
// ---------------------------------------------------------------------------
describe('T-0008-025: applinks.details[0].appIDs[0] equals env APPLE_APP_ID_PREFIX', () => {
  it('appID in response matches configured env', async () => {
    const expected = 'TEAMID12AB.com.appcreator.mvp'
    const server = await buildTestServer(expected)
    const res = await server.inject({
      method: 'GET',
      url: '/.well-known/apple-app-site-association',
    })
    const body = res.json()
    expect(body.applinks.details[0].appIDs[0]).toBe(expected)
    await server.close()
  })
})

// ---------------------------------------------------------------------------
// T-0008-026 — Happy: applinks.details[0].paths is exactly ['/m/*']
// ---------------------------------------------------------------------------
describe("T-0008-026: applinks.details[0].paths is exactly ['/m/*']", () => {
  it('paths array is closed to exactly one pattern', async () => {
    const server = await buildTestServer()
    const res = await server.inject({
      method: 'GET',
      url: '/.well-known/apple-app-site-association',
    })
    const body = res.json()
    expect(body.applinks.details[0].paths).toEqual(['/m/*'])
    await server.close()
  })
})

// ---------------------------------------------------------------------------
// T-0008-027 — Boundary: route is reachable without Authorization header
// ---------------------------------------------------------------------------
describe('T-0008-027: route is reachable without Authorization header (public)', () => {
  it('no auth header → still 200', async () => {
    const server = await buildTestServer()
    const res = await server.inject({
      method: 'GET',
      url: '/.well-known/apple-app-site-association',
      // Deliberately omit Authorization header
    })
    expect(res.statusCode).toBe(200)
    await server.close()
  })
})

// ---------------------------------------------------------------------------
// T-0008-028 — Security: same body for authenticated and unauthenticated callers
// ---------------------------------------------------------------------------
describe('T-0008-028: same body for authed and unauthed callers (no per-user data)', () => {
  it('response body is identical with and without Authorization header', async () => {
    const server = await buildTestServer()
    const unauthed = await server.inject({
      method: 'GET',
      url: '/.well-known/apple-app-site-association',
    })
    const authed = await server.inject({
      method: 'GET',
      url: '/.well-known/apple-app-site-association',
      headers: {Authorization: 'Bearer some-token'},
    })
    expect(unauthed.json()).toEqual(authed.json())
    await server.close()
  })
})

// ---------------------------------------------------------------------------
// T-0008-029 — Failure: POST returns 404 (route is GET-only)
// ---------------------------------------------------------------------------
describe('T-0008-029: POST /.well-known/apple-app-site-association returns 404', () => {
  it('POST is not registered', async () => {
    const server = await buildTestServer()
    const res = await server.inject({
      method: 'POST',
      url: '/.well-known/apple-app-site-association',
    })
    expect(res.statusCode).toBe(404)
    await server.close()
  })
})

// ---------------------------------------------------------------------------
// T-0008-030..035 — Config exhaustion (loadEnv direct tests — no Docker)
// ---------------------------------------------------------------------------
describe('loadEnv — APPLE_APP_ID_PREFIX config exhaustion (T-0008-030..035)', () => {
  const BASE_PROD = {
    NODE_ENV: 'production',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'svc-role-key',
    SUPABASE_JWT_SECRET: 'jwt-secret',
    APPLE_SIWA_CLIENT_ID: 'com.appcreator.mvp.siwa',
    APPLE_SIWA_TEAM_ID: 'TEAMID1234',
    APPLE_SIWA_KEY_ID: 'KID1234567',
    APPLE_SIWA_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----',
  }

  // T-0008-030: APPLE_APP_ID_PREFIX unset → throws
  it("T-0008-030: APPLE_APP_ID_PREFIX unset in non-test env → throws 'Invalid environment'", () => {
    expect(() => loadEnv({...BASE_PROD})).toThrow(/APPLE_APP_ID_PREFIX|Invalid environment/)
  })

  // T-0008-031: APPLE_APP_ID_PREFIX='' → throws
  it("T-0008-031: APPLE_APP_ID_PREFIX='' → throws", () => {
    expect(() => loadEnv({...BASE_PROD, APPLE_APP_ID_PREFIX: ''})).toThrow(
      /Invalid environment/,
    )
  })

  // T-0008-032: APPLE_APP_ID_PREFIX='   ' → throws
  it("T-0008-032: APPLE_APP_ID_PREFIX='   ' (whitespace) → throws", () => {
    expect(() => loadEnv({...BASE_PROD, APPLE_APP_ID_PREFIX: '   '})).toThrow(
      /Invalid environment/,
    )
  })

  // T-0008-033: APPLE_APP_ID_PREFIX='lowercase.app' → throws (regex requires uppercase TEAMID)
  it("T-0008-033: APPLE_APP_ID_PREFIX='lowercase.app' → throws (regex requires uppercase TEAMID)", () => {
    expect(() => loadEnv({...BASE_PROD, APPLE_APP_ID_PREFIX: 'lowercase.app'})).toThrow(
      /Invalid environment/,
    )
  })

  // T-0008-034: APPLE_APP_ID_PREFIX='TEAMID12AB.com.appcreator.mvp' → accepted
  it("T-0008-034: APPLE_APP_ID_PREFIX='TEAMID12AB.com.appcreator.mvp' → accepted, normalized as-is", () => {
    const result = loadEnv({
      ...BASE_PROD,
      APPLE_APP_ID_PREFIX: 'TEAMID12AB.com.appcreator.mvp',
    })
    expect(result.APPLE_APP_ID_PREFIX).toBe('TEAMID12AB.com.appcreator.mvp')
  })

  // T-0008-035: APPLE_APP_ID_PREFIX with mixed-case bundle ID → accepted
  it("T-0008-035: APPLE_APP_ID_PREFIX='TEAMID12AB.com.AppCreator.MVP' → accepted (bundle ID is case-preserved)", () => {
    const result = loadEnv({
      ...BASE_PROD,
      APPLE_APP_ID_PREFIX: 'TEAMID12AB.com.AppCreator.MVP',
    })
    expect(result.APPLE_APP_ID_PREFIX).toBe('TEAMID12AB.com.AppCreator.MVP')
  })
})

// ---------------------------------------------------------------------------
// T-0008-036 — Regression: route is rate-limit-exempt (100 calls → all 200)
// ---------------------------------------------------------------------------
describe('T-0008-036: route is rate-limit-exempt — 100 rapid calls all return 200', () => {
  it('100 sequential calls all return 200', async () => {
    const server = await buildTestServer()
    for (let i = 0; i < 100; i++) {
      const res = await server.inject({
        method: 'GET',
        url: '/.well-known/apple-app-site-association',
      })
      expect(res.statusCode).toBe(200)
    }
    await server.close()
  })
})

// ---------------------------------------------------------------------------
// T-0008-037 — Regression: Cache-Control present + max-age ≤ 86400
// ---------------------------------------------------------------------------
describe('T-0008-037: Cache-Control present with public max-age ≤ 86400', () => {
  it('Cache-Control header is set and bounded', async () => {
    const server = await buildTestServer()
    const res = await server.inject({
      method: 'GET',
      url: '/.well-known/apple-app-site-association',
    })
    const cc = res.headers['cache-control'] as string
    expect(cc).toBeTruthy()
    expect(cc).toMatch(/public/)
    const maxAgeMatch = cc.match(/max-age=(\d+)/)
    expect(maxAgeMatch).not.toBeNull()
    const maxAge = parseInt(maxAgeMatch![1]!, 10)
    expect(maxAge).toBeGreaterThan(0)
    expect(maxAge).toBeLessThanOrEqual(86400)
    await server.close()
  })
})

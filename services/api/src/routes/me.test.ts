/**
 * /me/out-of-scope-intents route tests — ADR-0011 Step 5.
 *
 * T-IDs covered:
 *   T-0011-113: GET /me/out-of-scope-intents no auth → 401
 *   T-0011-114: GET /me/out-of-scope-intents 200 → {intents: [...]}
 *   T-0011-115: PATCH /me/out-of-scope-intents/:capability no auth → 401
 *   T-0011-116: PATCH valid capability + notifyOptIn → 200 {updated: N}
 *   T-0011-117: PATCH unknown capability → 400 invalid_input
 *   T-0011-118: 61st GET request → 429 rate_limited (Boundary)
 *   T-0011-119: 61st PATCH request → 429 rate_limited (Boundary, shared window)
 *
 * Strategy: inject a mock service — no Docker, pure unit-level.
 * Rate-limit bucket is reset in beforeEach via resetRateLimitForTests().
 */

import {randomUUID} from 'node:crypto'

import Fastify from 'fastify'

import {userJwt, uniqueEmail} from '../../test/factories.js'
import {resetRateLimitForTests} from '../lib/rateLimit.js'

// ---------------------------------------------------------------------------
// JWT env setup — must precede auth.js module import
// ---------------------------------------------------------------------------

const TEST_JWT_SECRET = 'me-route-test-secret-' + randomUUID()
process.env.SUPABASE_JWT_SECRET = TEST_JWT_SECRET
process.env.NODE_ENV = 'test'
process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key'

// ---------------------------------------------------------------------------
// Late imports
// ---------------------------------------------------------------------------

import {meRoutes, VALID_CAPABILITIES} from './me.js'
import type {MeService, OutOfScopeIntentSummary, PatchResult} from '../services/me.service.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const USER_ID = randomUUID()
const USER_EMAIL = uniqueEmail('me-route')

function authHeader(): {authorization: string} {
  return {
    authorization: `Bearer ${userJwt({sub: USER_ID, email: USER_EMAIL, secret: TEST_JWT_SECRET})}`,
  }
}

const MOCK_SUMMARIES: OutOfScopeIntentSummary[] = [
  {
    capability: 'image_gen',
    capturedCount: 3,
    lastCapturedAt: new Date().toISOString(),
    notifyOptIn: false,
  },
  {
    capability: 'vision',
    capturedCount: 1,
    lastCapturedAt: new Date().toISOString(),
    notifyOptIn: true,
  },
]

function buildMockService(overrides: Partial<MeService> = {}): MeService {
  return {
    listMyOutOfScopeIntents: jest.fn().mockResolvedValue(MOCK_SUMMARIES),
    patchMyOutOfScopeIntent: jest.fn().mockResolvedValue({updated: 1} as PatchResult),
    ...overrides,
  }
}

async function buildServer(service: MeService) {
  const server = Fastify({logger: false})
  await server.register(meRoutes, {service})
  return server
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ADR-0011 Step 5 — /me/out-of-scope-intents routes', () => {
  let mockService: MeService

  beforeEach(() => {
    resetRateLimitForTests()
    mockService = buildMockService()
  })

  // -------------------------------------------------------------------------
  // GET /me/out-of-scope-intents
  // -------------------------------------------------------------------------

  describe('GET /me/out-of-scope-intents', () => {
    it('T-0011-113: no auth → 401', async () => {
      const server = await buildServer(mockService)
      const res = await server.inject({
        method: 'GET',
        url: '/me/out-of-scope-intents',
      })
      expect(res.statusCode).toBe(401)
    })

    it('T-0011-114: 200 → {intents: [...]}', async () => {
      const server = await buildServer(mockService)
      const res = await server.inject({
        method: 'GET',
        url: '/me/out-of-scope-intents',
        headers: authHeader(),
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body).toHaveProperty('intents')
      expect(Array.isArray(body.intents)).toBe(true)
      expect(body.intents).toHaveLength(2)
    })

    it('T-0011-114: response items have the expected summary shape', async () => {
      const server = await buildServer(mockService)
      const res = await server.inject({
        method: 'GET',
        url: '/me/out-of-scope-intents',
        headers: authHeader(),
      })
      const {intents} = res.json()
      for (const item of intents) {
        expect(item).toHaveProperty('capability')
        expect(item).toHaveProperty('capturedCount')
        expect(item).toHaveProperty('lastCapturedAt')
        expect(item).toHaveProperty('notifyOptIn')
        // Email NEVER present
        expect(item).not.toHaveProperty('email')
        expect(item).not.toHaveProperty('userId')
        expect(item).not.toHaveProperty('promptHash')
      }
    })

    it('T-0011-114: calls listMyOutOfScopeIntents with caller userId from JWT', async () => {
      const server = await buildServer(mockService)
      await server.inject({
        method: 'GET',
        url: '/me/out-of-scope-intents',
        headers: authHeader(),
      })
      expect(mockService.listMyOutOfScopeIntents).toHaveBeenCalledWith(USER_ID)
    })

    it('T-0011-118: 61st request → 429 rate_limited (Boundary)', async () => {
      const server = await buildServer(mockService)
      // Make 60 allowed requests
      for (let i = 0; i < 60; i++) {
        const res = await server.inject({
          method: 'GET',
          url: '/me/out-of-scope-intents',
          headers: authHeader(),
        })
        expect(res.statusCode).toBe(200)
      }
      // 61st should be rate-limited
      const res = await server.inject({
        method: 'GET',
        url: '/me/out-of-scope-intents',
        headers: authHeader(),
      })
      expect(res.statusCode).toBe(429)
      const body = res.json()
      expect(body.error).toBe('rate_limited')
      expect(body.retryAfter).toBeGreaterThan(0)
    })

    it('service failure → 500', async () => {
      const failService = buildMockService({
        listMyOutOfScopeIntents: jest.fn().mockRejectedValue(new Error('db down')),
      })
      const server = await buildServer(failService)
      const res = await server.inject({
        method: 'GET',
        url: '/me/out-of-scope-intents',
        headers: authHeader(),
      })
      expect(res.statusCode).toBe(500)
      expect(res.json().error).toBe('internal')
    })
  })

  // -------------------------------------------------------------------------
  // PATCH /me/out-of-scope-intents/:capability
  // -------------------------------------------------------------------------

  describe('PATCH /me/out-of-scope-intents/:capability', () => {
    it('T-0011-115: no auth → 401', async () => {
      const server = await buildServer(mockService)
      const res = await server.inject({
        method: 'PATCH',
        url: '/me/out-of-scope-intents/image_gen',
        headers: {'content-type': 'application/json'},
        payload: {notifyOptIn: true},
      })
      expect(res.statusCode).toBe(401)
    })

    it('T-0011-116: valid capability + notifyOptIn → 200 {updated: N}', async () => {
      const server = await buildServer(mockService)
      const res = await server.inject({
        method: 'PATCH',
        url: '/me/out-of-scope-intents/image_gen',
        headers: {...authHeader(), 'content-type': 'application/json'},
        payload: {notifyOptIn: true},
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body).toHaveProperty('updated')
      expect(typeof body.updated).toBe('number')
    })

    it('T-0011-116: passes correct args to patchMyOutOfScopeIntent', async () => {
      const server = await buildServer(mockService)
      await server.inject({
        method: 'PATCH',
        url: '/me/out-of-scope-intents/vision',
        headers: {...authHeader(), 'content-type': 'application/json'},
        payload: {notifyOptIn: false},
      })
      expect(mockService.patchMyOutOfScopeIntent).toHaveBeenCalledWith(
        USER_ID,
        'vision',
        {notifyOptIn: false},
      )
    })

    it('T-0011-117: unknown capability → 400 invalid_input', async () => {
      const server = await buildServer(mockService)
      const res = await server.inject({
        method: 'PATCH',
        url: '/me/out-of-scope-intents/robot_uprising',
        headers: {...authHeader(), 'content-type': 'application/json'},
        payload: {notifyOptIn: true},
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().error).toBe('invalid_input')
    })

    it('T-0011-117: missing notifyOptIn body field → 400 invalid_input', async () => {
      const server = await buildServer(mockService)
      const res = await server.inject({
        method: 'PATCH',
        url: '/me/out-of-scope-intents/image_gen',
        headers: {...authHeader(), 'content-type': 'application/json'},
        payload: {},
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().error).toBe('invalid_input')
    })

    it('T-0011-117: notifyOptIn non-boolean → 400 invalid_input', async () => {
      const server = await buildServer(mockService)
      const res = await server.inject({
        method: 'PATCH',
        url: '/me/out-of-scope-intents/image_gen',
        headers: {...authHeader(), 'content-type': 'application/json'},
        payload: {notifyOptIn: 'yes'},
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().error).toBe('invalid_input')
    })

    it('T-0011-119: 61st PATCH → 429 (shared window with GET, Boundary)', async () => {
      const server = await buildServer(mockService)
      // Drain 60 slots via PATCH
      for (let i = 0; i < 60; i++) {
        const res = await server.inject({
          method: 'PATCH',
          url: '/me/out-of-scope-intents/image_gen',
          headers: {...authHeader(), 'content-type': 'application/json'},
          payload: {notifyOptIn: true},
        })
        expect(res.statusCode).toBe(200)
      }
      // 61st should be blocked
      const res = await server.inject({
        method: 'PATCH',
        url: '/me/out-of-scope-intents/image_gen',
        headers: {...authHeader(), 'content-type': 'application/json'},
        payload: {notifyOptIn: true},
      })
      expect(res.statusCode).toBe(429)
      const body = res.json()
      expect(body.error).toBe('rate_limited')
    })

    it('T-0011-119: GET requests count toward PATCH rate limit window', async () => {
      const server = await buildServer(mockService)
      // Use 30 GET slots + 30 PATCH slots = 60 total
      for (let i = 0; i < 30; i++) {
        await server.inject({
          method: 'GET',
          url: '/me/out-of-scope-intents',
          headers: authHeader(),
        })
      }
      for (let i = 0; i < 30; i++) {
        await server.inject({
          method: 'PATCH',
          url: '/me/out-of-scope-intents/image_gen',
          headers: {...authHeader(), 'content-type': 'application/json'},
          payload: {notifyOptIn: false},
        })
      }
      // 61st (any method) should be blocked
      const res = await server.inject({
        method: 'PATCH',
        url: '/me/out-of-scope-intents/image_gen',
        headers: {...authHeader(), 'content-type': 'application/json'},
        payload: {notifyOptIn: true},
      })
      expect(res.statusCode).toBe(429)
    })

    it('all valid capabilities are accepted', async () => {
      const server = await buildServer(mockService)
      for (const cap of VALID_CAPABILITIES) {
        resetRateLimitForTests()
        const res = await server.inject({
          method: 'PATCH',
          url: `/me/out-of-scope-intents/${cap}`,
          headers: {...authHeader(), 'content-type': 'application/json'},
          payload: {notifyOptIn: true},
        })
        expect(res.statusCode).toBe(200)
      }
    })

    it('service failure → 500', async () => {
      const failService = buildMockService({
        patchMyOutOfScopeIntent: jest.fn().mockRejectedValue(new Error('db down')),
      })
      const server = await buildServer(failService)
      const res = await server.inject({
        method: 'PATCH',
        url: '/me/out-of-scope-intents/image_gen',
        headers: {...authHeader(), 'content-type': 'application/json'},
        payload: {notifyOptIn: true},
      })
      expect(res.statusCode).toBe(500)
      expect(res.json().error).toBe('internal')
    })
  })
})

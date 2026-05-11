/**
 * Mini-apps routes tests — ADR-0011 Step 3.
 *
 * T-IDs covered:
 *   Ported / renamed from projects.test.ts:
 *     T-0001-058 (no auth → 401)
 *     T-0001-057 (malformed UUID → 400)
 *     T-0001-053 (list 200 strict JSON Schema)
 *     T-0001-054 (detail 200 strict JSON Schema)
 *     T-0001-122 (fork roundtrip — parentMiniAppId)
 *     T-0001-056 / T-0001-065 (non-owner GET → 404)
 *     T-0001-060 (empty list → 200 {miniApps: []})
 *     T-0001-061 (100 mini-apps → all returned sorted)
 *     T-0001-063 (DB failure → 500 + safeMessage log)
 *     T-0001-064 (specJson absent on list items)
 *     T-0001-066 (cross-user isolation)
 *     T-0001-120 (audit log — action: 'mini_app.read')
 *
 *   New ADR-0011 Step 3 T-IDs:
 *     T-0011-041: GET /me/mini-apps returns {miniApps:[]} not {projects:[]}
 *     T-0011-042: GET /me/mini-apps list items include new fields (stance, etc.)
 *     T-0011-043: GET /me/mini-apps does not include archived rows
 *     T-0011-044: GET /me/mini-apps/:id detail includes new fields
 *     T-0011-045: POST /me/mini-apps/:id/rename 200 with {miniApp:{id,title}}
 *     T-0011-046: POST /me/mini-apps/:id/rename 400 on empty title
 *     T-0011-047: POST /me/mini-apps/:id/rename 400 on whitespace-only title
 *     T-0011-048: POST /me/mini-apps/:id/rename 400 on title >80 chars
 *     T-0011-049: POST /me/mini-apps/:id/rename 404 for non-owner
 *     T-0011-050: POST /me/mini-apps/:id/archive 200 with archivedAt
 *     T-0011-051: POST /me/mini-apps/:id/archive idempotent (same archivedAt)
 *     T-0011-052: POST /me/mini-apps/:id/unarchive 200, archivedAt null
 *     T-0011-053: POST /me/mini-apps/:id/archive 404 for non-owner
 *     T-0011-054: DELETE /me/mini-apps/:id 200 {deletedAt} first call
 *     T-0011-055: DELETE /me/mini-apps/:id 200 {already_deleted:true} second call
 *     T-0011-057: DELETE /me/mini-apps/:id 404 for non-owner (no 403)
 *     T-0011-062: POST /me/mini-apps/:id/share 501 not_implemented
 *     T-0011-063: POST /me/mini-apps/clone 501 not_implemented
 *     T-0011-070: DELETE /me/mini-apps/:id does NOT return 403 for phantom id
 *     T-0011-072: old /me/projects paths return 404 — route no longer registered
 *                 (renamed from T-0011-071 per Roz O3 — ID freed for archive-on-deleted)
 *
 *   ADR-0011 Roz F1 additions (missing from PR 1):
 *     T-0011-056: POST /me/mini-apps/:id/archive HTTP idempotency — second call returns
 *                 same archivedAt value as first (route-layer coverage)
 *     T-0011-058: DELETE sets deleted_at; subsequent GET returns 404
 *     T-0011-059: After DELETE, GET list does NOT include deleted row
 *     T-0011-059a: Archived rows excluded from default GET list
 *     T-0011-060: DELETE idempotency — second call returns 200 {already_deleted:true} not 404
 *     T-0011-061: DELETE by non-owner → 404 (route layer)
 *     T-0011-064: POST /me/mini-apps/:id/share without auth → 401
 *     T-0011-065: POST /me/mini-apps/clone without auth → 401
 *     T-0011-066: PATCH /me/mini-apps/:id with {title:42} → 400
 *     T-0011-069: Concurrent renames → last-write-wins; both return 200
 *     T-0011-071: Archive on already-deleted mini_app → 404
 *
 * Response shape asserted with Ajv (additionalProperties: false).
 * Mirrors projects.test.ts guard against unexpected field leaks.
 */
import {randomUUID} from 'node:crypto'

import Ajv from 'ajv'
import type {NodePgDatabase} from 'drizzle-orm/node-postgres'
import Fastify from 'fastify'
import pino from 'pino'

import * as schema from '../db/schema.js'
import {users} from '../db/schema.js'
import {createLogSink, PINO_LEVEL} from '../../test/mocks/pinoStream.js'
import {closeTestPool, getTestDb, truncateAll} from '../../test/setup.js'
import {specWithHeading, userJwt, validSpec} from '../../test/factories.js'
import {resetRateLimitForTests} from '../lib/rateLimit.js'

// SUPABASE_JWT_SECRET must be set BEFORE auth.js imports so verifyJwt picks
// up the configured value.
const TEST_JWT_SECRET = 'mini-apps-route-test-secret-' + randomUUID()
process.env.SUPABASE_JWT_SECRET = TEST_JWT_SECRET
process.env.NODE_ENV = 'test'

import {miniAppsRoutes} from './miniApps.js'
import {createMiniAppsService, type MiniAppsService} from '../services/miniApps.service.js'

type Db = NodePgDatabase<typeof schema>

interface BuildOpts {
  db?: Db
  service?: MiniAppsService
  sink?: ReturnType<typeof createLogSink>
}

async function buildMiniAppsServer(opts: BuildOpts = {}) {
  const loggerInstance = opts.sink
    ? pino({level: 'info', base: undefined}, opts.sink.stream)
    : pino({level: 'silent'})
  const server = Fastify({loggerInstance})
  await server.register(miniAppsRoutes, {db: opts.db, service: opts.service})
  return server
}

async function makeUser(db: Db, email = `route-test-${randomUUID()}@example.com`): Promise<string> {
  const id = randomUUID()
  await db.insert(users).values({id, email})
  return id
}

function authHeader(sub: string, email: string): {authorization: string} {
  return {authorization: `Bearer ${userJwt({sub, email, secret: TEST_JWT_SECRET})}`}
}

// ---------------------------------------------------------------------------
// JSON Schemas — strict (additionalProperties: false). Defends against field
// leaks per retro-lessons.md normalizeRow pattern.
// ---------------------------------------------------------------------------

const ajv = new Ajv({strict: true, allErrors: true})

const miniAppListItemSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'title',
    'updatedAt',
    'createdAt',
    'currentVersionId',
    'parentMiniAppId',
    'stance',
    'accentPalette',
    'coverArtSeed',
    'archetype',
    'syncMode',
  ],
  properties: {
    id: {type: 'string'},
    title: {type: 'string'},
    updatedAt: {type: 'string'},
    createdAt: {type: 'string'},
    currentVersionId: {type: 'string'},
    parentMiniAppId: {type: ['string', 'null']},
    stance: {type: 'string'},
    accentPalette: {type: 'string'},
    coverArtSeed: {type: 'string'},
    archetype: {type: 'string'},
    syncMode: {type: 'string'},
  },
} as const

const miniAppListResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['miniApps'],
  properties: {
    miniApps: {type: 'array', items: miniAppListItemSchema},
  },
} as const

const miniAppDetailSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'ownerId',
    'title',
    'currentVersionId',
    'parentMiniAppId',
    'createdAt',
    'updatedAt',
    'stance',
    'accentPalette',
    'coverArtSeed',
    'archetype',
    'syncMode',
    'archivedAt',
  ],
  properties: {
    id: {type: 'string'},
    ownerId: {type: 'string'},
    title: {type: 'string'},
    currentVersionId: {type: 'string'},
    parentMiniAppId: {type: ['string', 'null']},
    createdAt: {type: 'string'},
    updatedAt: {type: 'string'},
    stance: {type: 'string'},
    accentPalette: {type: 'string'},
    coverArtSeed: {type: 'string'},
    archetype: {type: 'string'},
    syncMode: {type: 'string'},
    archivedAt: {type: ['string', 'null']},
  },
} as const

const miniAppVersionSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'miniAppId', 'specJson', 'renderHash', 'createdAt'],
  properties: {
    id: {type: 'string'},
    miniAppId: {type: 'string'},
    specJson: {type: 'object'},
    renderHash: {type: 'string'},
    createdAt: {type: 'string'},
  },
} as const

const miniAppDetailResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['miniApp', 'currentVersion'],
  properties: {
    miniApp: miniAppDetailSchema,
    currentVersion: miniAppVersionSchema,
  },
} as const

const validateList = ajv.compile(miniAppListResponseSchema)
const validateDetail = ajv.compile(miniAppDetailResponseSchema)

describe('ADR-0011 Step 3 — mini-apps routes', () => {
  let db: Db

  beforeAll(async () => {
    db = await getTestDb()
  })

  beforeEach(() => {
    resetRateLimitForTests()
  })

  afterEach(async () => {
    await truncateAll()
  })

  afterAll(async () => {
    await closeTestPool()
  })

  // -------------------------------------------------------------------------
  // T-0001-058 — Failure: GET /me/mini-apps without auth returns 401
  // -------------------------------------------------------------------------
  it('T-0001-058: GET /me/mini-apps without an Authorization header returns 401', async () => {
    const server = await buildMiniAppsServer({db})
    try {
      const res = await server.inject({method: 'GET', url: '/me/mini-apps'})
      expect(res.statusCode).toBe(401)
      expect(res.json()).toEqual({error: 'unauthorized'})
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-057 — Failure: GET /me/mini-apps/:id with malformed UUID → 400
  // -------------------------------------------------------------------------
  it('T-0001-057: GET /me/mini-apps/:id with a malformed UUID returns 400 {error: "invalid_input"}', async () => {
    const ownerId = await makeUser(db)
    const email = `boundary-${randomUUID()}@example.com`
    const server = await buildMiniAppsServer({db})
    try {
      const res = await server.inject({
        method: 'GET',
        url: '/me/mini-apps/not-a-uuid',
        headers: authHeader(ownerId, email),
      })
      expect(res.statusCode).toBe(400)
      const body = res.json() as Record<string, unknown>
      expect(body).toEqual({error: 'invalid_input'})
      expect(Object.keys(body).sort()).toEqual(['error'])
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0011-041 — GET /me/mini-apps returns {miniApps:[]} key (not "projects")
  // -------------------------------------------------------------------------
  it('T-0011-041: GET /me/mini-apps response uses {miniApps:[]} key, not {projects:[]}', async () => {
    const ownerId = await makeUser(db)
    const server = await buildMiniAppsServer({db})
    try {
      const res = await server.inject({
        method: 'GET',
        url: '/me/mini-apps',
        headers: authHeader(ownerId, `key-test-${randomUUID()}@example.com`),
      })
      expect(res.statusCode).toBe(200)
      const body = res.json() as Record<string, unknown>
      expect(body).toHaveProperty('miniApps')
      expect(body).not.toHaveProperty('projects')
      expect(Object.keys(body).sort()).toEqual(['miniApps'])
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-053 / T-0011-042 — GET /me/mini-apps strict JSON Schema + new fields
  // -------------------------------------------------------------------------
  it('T-0001-053 / T-0011-042: GET /me/mini-apps returns 200 with body strictly matching the JSON Schema including new fields', async () => {
    const ownerId = await makeUser(db)
    const service = createMiniAppsService(db)
    await service.create({ownerId, spec: specWithHeading('Strict shape A')})
    await service.create({ownerId, spec: specWithHeading('Strict shape B')})

    const server = await buildMiniAppsServer({db})
    try {
      const res = await server.inject({
        method: 'GET',
        url: '/me/mini-apps',
        headers: authHeader(ownerId, `strict-${randomUUID()}@example.com`),
      })
      expect(res.statusCode).toBe(200)
      const body = res.json() as Record<string, unknown>

      expect(validateList(body)).toBe(true)
      expect(validateList.errors).toBeNull()
      expect(Object.keys(body).sort()).toEqual(['miniApps'])

      const items = (body as {miniApps: Array<Record<string, unknown>>}).miniApps
      expect(items.length).toBe(2)
      // Every item has the new ADR-0011 fields
      for (const item of items) {
        expect(typeof item['stance']).toBe('string')
        expect(typeof item['accentPalette']).toBe('string')
        expect(typeof item['coverArtSeed']).toBe('string')
        expect(typeof item['archetype']).toBe('string')
        expect(typeof item['syncMode']).toBe('string')
      }
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0011-043 — GET /me/mini-apps does not include archived rows
  // -------------------------------------------------------------------------
  it('T-0011-043: GET /me/mini-apps excludes archived mini-apps from the response', async () => {
    const ownerId = await makeUser(db)
    const service = createMiniAppsService(db)
    const active = await service.create({ownerId, spec: specWithHeading('Active')})
    const toArchive = await service.create({ownerId, spec: specWithHeading('Archived')})
    await service.archive(ownerId, toArchive.miniApp.id)

    const server = await buildMiniAppsServer({db})
    try {
      const res = await server.inject({
        method: 'GET',
        url: '/me/mini-apps',
        headers: authHeader(ownerId, `arch-${randomUUID()}@example.com`),
      })
      expect(res.statusCode).toBe(200)
      const body = res.json() as {miniApps: Array<{id: string}>}
      const ids = body.miniApps.map(m => m.id)
      expect(ids).toContain(active.miniApp.id)
      expect(ids).not.toContain(toArchive.miniApp.id)
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-054 / T-0011-044 — GET /me/mini-apps/:id strict JSON Schema + new fields
  // -------------------------------------------------------------------------
  it('T-0001-054 / T-0011-044: GET /me/mini-apps/:id returns 200 with body strictly matching the JSON Schema including new fields', async () => {
    const ownerId = await makeUser(db)
    const service = createMiniAppsService(db)
    const detail = await service.create({ownerId, spec: specWithHeading('Detail shape')})

    const server = await buildMiniAppsServer({db})
    try {
      const res = await server.inject({
        method: 'GET',
        url: `/me/mini-apps/${detail.miniApp.id}`,
        headers: authHeader(ownerId, `detail-${randomUUID()}@example.com`),
      })
      expect(res.statusCode).toBe(200)
      const body = res.json() as Record<string, unknown>

      expect(validateDetail(body)).toBe(true)
      expect(validateDetail.errors).toBeNull()
      expect(Object.keys(body).sort()).toEqual(['currentVersion', 'miniApp'])

      const miniApp = (body as {miniApp: Record<string, unknown>}).miniApp
      expect(typeof miniApp['stance']).toBe('string')
      expect(typeof miniApp['accentPalette']).toBe('string')
      expect(typeof miniApp['coverArtSeed']).toBe('string')
      expect(typeof miniApp['archetype']).toBe('string')
      expect(typeof miniApp['syncMode']).toBe('string')
      expect(miniApp['archivedAt']).toBeNull()
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-122 — Happy: forking — parentMiniAppId roundtrips through both routes
  // -------------------------------------------------------------------------
  it('T-0001-122: fork roundtrip — parentMiniAppId is on the list item AND on the detail miniApp', async () => {
    const ownerId = await makeUser(db)
    const service = createMiniAppsService(db)
    const parent = await service.create({ownerId, spec: validSpec()})
    const child = await service.create({
      ownerId,
      spec: specWithHeading('Forked'),
      parentMiniAppId: parent.miniApp.id,
    })

    const server = await buildMiniAppsServer({db})
    try {
      const headers = authHeader(ownerId, `fork-${randomUUID()}@example.com`)

      const detailRes = await server.inject({
        method: 'GET',
        url: `/me/mini-apps/${child.miniApp.id}`,
        headers,
      })
      expect(detailRes.statusCode).toBe(200)
      expect(
        (detailRes.json() as {miniApp: {parentMiniAppId: string}}).miniApp.parentMiniAppId,
      ).toBe(parent.miniApp.id)

      const listRes = await server.inject({method: 'GET', url: '/me/mini-apps', headers})
      expect(listRes.statusCode).toBe(200)
      const list = (
        listRes.json() as {miniApps: Array<{id: string; parentMiniAppId: string | null}>}
      ).miniApps
      const childItem = list.find(p => p.id === child.miniApp.id)
      expect(childItem?.parentMiniAppId).toBe(parent.miniApp.id)

      const parentItem = list.find(p => p.id === parent.miniApp.id)
      expect(parentItem?.parentMiniAppId).toBeNull()
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-056 / T-0001-065 — Failure / Security: non-owner GET → 404
  // -------------------------------------------------------------------------
  it('T-0001-056 + T-0001-065: GET /me/mini-apps/:id for non-owner returns 404 — NOT 403; body keys exactly ["error"]', async () => {
    const ownerA = await makeUser(db, `owner-a-${randomUUID()}@example.com`)
    const ownerB = await makeUser(db, `owner-b-${randomUUID()}@example.com`)
    const service = createMiniAppsService(db)
    const detail = await service.create({ownerId: ownerA, spec: validSpec()})

    const server = await buildMiniAppsServer({db})
    try {
      const res = await server.inject({
        method: 'GET',
        url: `/me/mini-apps/${detail.miniApp.id}`,
        headers: authHeader(ownerB, `b-${randomUUID()}@example.com`),
      })
      expect(res.statusCode).toBe(404)
      const body = res.json() as Record<string, unknown>
      expect(body).toEqual({error: 'not_found'})
      expect(Object.keys(body).sort()).toEqual(['error'])

      const phantom = randomUUID()
      const res2 = await server.inject({
        method: 'GET',
        url: `/me/mini-apps/${phantom}`,
        headers: authHeader(ownerB, `b2-${randomUUID()}@example.com`),
      })
      expect(res2.statusCode).toBe(404)
      expect(res2.json()).toEqual({error: 'not_found'})
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-060 — Boundary: empty list → 200 {miniApps: []}
  // -------------------------------------------------------------------------
  it('T-0001-060: empty mini-apps for the user → 200 {miniApps: []}', async () => {
    const ownerId = await makeUser(db)
    const server = await buildMiniAppsServer({db})
    try {
      const res = await server.inject({
        method: 'GET',
        url: '/me/mini-apps',
        headers: authHeader(ownerId, `empty-${randomUUID()}@example.com`),
      })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({miniApps: []})
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-061 — Boundary: 100 mini-apps → all returned in correct sort order
  // -------------------------------------------------------------------------
  it('T-0001-061: user with 100 mini-apps → GET /me/mini-apps returns all 100 in updatedAt DESC order', async () => {
    const ownerId = await makeUser(db)
    const service = createMiniAppsService(db)

    const created: string[] = []
    for (let i = 0; i < 100; i++) {
      const detail = await service.create({ownerId, spec: specWithHeading(`Bulk ${i}`)})
      created.push(detail.miniApp.id)
    }

    const server = await buildMiniAppsServer({db})
    try {
      const res = await server.inject({
        method: 'GET',
        url: '/me/mini-apps',
        headers: authHeader(ownerId, `bulk-${randomUUID()}@example.com`),
      })
      expect(res.statusCode).toBe(200)
      const list = (res.json() as {miniApps: Array<{id: string; updatedAt: string}>}).miniApps
      expect(list).toHaveLength(100)

      expect(list[0]?.id).toBe(created[99])
      expect(list[99]?.id).toBe(created[0])

      for (let i = 1; i < list.length; i++) {
        expect(new Date(list[i - 1]!.updatedAt).getTime()).toBeGreaterThanOrEqual(
          new Date(list[i]!.updatedAt).getTime(),
        )
      }
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-063 — Error handling: DB failure during list → 500 + safeMessage log
  // -------------------------------------------------------------------------
  it('T-0001-063: DB failure during list → 500 {error: "internal"}; req.log includes safeMessage and excludes raw user data', async () => {
    const ownerId = await makeUser(db)
    const email = `dbdown-${randomUUID()}@example.com`

    const failureMessage = 'sim_db_drop_' + randomUUID()
    const failingService: MiniAppsService = {
      async create() {
        throw new Error('not used')
      },
      async list() {
        throw new Error(failureMessage)
      },
      async get() {
        throw new Error('not used')
      },
      async getVersion() {
        throw new Error('not used')
      },
      async archive() {
        throw new Error('not used')
      },
      async unarchive() {
        throw new Error('not used')
      },
      async rename() {
        throw new Error('not used')
      },
      async delete() {
        throw new Error('not used')
      },
    }

    const sink = createLogSink()
    const server = await buildMiniAppsServer({db, service: failingService, sink})
    try {
      const res = await server.inject({
        method: 'GET',
        url: '/me/mini-apps',
        headers: authHeader(ownerId, email),
      })
      expect(res.statusCode).toBe(500)
      const body = res.json() as Record<string, unknown>
      expect(body).toEqual({error: 'internal'})
      expect(Object.keys(body).sort()).toEqual(['error'])

      const errorRecords = sink.byLevel(PINO_LEVEL.ERROR)
      const failure = errorRecords.find(r => r.msg === 'mini_apps_list_failed')
      expect(failure).toBeDefined()
      expect(failure?.err).toBe(failureMessage)

      const wholeLog = sink.raw.join('')
      expect(wholeLog).not.toContain(email)
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-064 — Security: list response deep-equals fixture; specJson absent
  // -------------------------------------------------------------------------
  it('T-0001-064: list response strict-shape — specJson absent on every mini-app; defends the normalizeRow retro-lesson', async () => {
    const ownerId = await makeUser(db)
    const service = createMiniAppsService(db)
    const a = await service.create({ownerId, spec: specWithHeading('Sensitive A')})
    const b = await service.create({ownerId, spec: specWithHeading('Sensitive B')})

    const server = await buildMiniAppsServer({db})
    try {
      const res = await server.inject({
        method: 'GET',
        url: '/me/mini-apps',
        headers: authHeader(ownerId, `shape-${randomUUID()}@example.com`),
      })
      expect(res.statusCode).toBe(200)
      const body = res.json() as {miniApps: Array<Record<string, unknown>>}

      expect(validateList(body)).toBe(true)
      expect(validateList.errors).toBeNull()
      expect(Object.keys(body).sort()).toEqual(['miniApps'])

      const expectedKeys = [
        'accentPalette',
        'archetype',
        'coverArtSeed',
        'createdAt',
        'currentVersionId',
        'id',
        'parentMiniAppId',
        'stance',
        'syncMode',
        'title',
        'updatedAt',
      ]
      for (const item of body.miniApps) {
        expect(Object.keys(item).sort()).toEqual(expectedKeys)
        expect(item).not.toHaveProperty('specJson')
        expect(item).not.toHaveProperty('ownerId')
      }

      const byId = new Map(body.miniApps.map(p => [p.id as string, p]))
      expect(byId.get(a.miniApp.id)?.title).toBe('Sensitive A')
      expect(byId.get(b.miniApp.id)?.title).toBe('Sensitive B')
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-066 — Security: user A cannot list user B's mini-apps
  // -------------------------------------------------------------------------
  it("T-0001-066: cross-user isolation — user A's mini-apps do not appear in user B's list", async () => {
    const ownerA = await makeUser(db, `iso-a-${randomUUID()}@example.com`)
    const ownerB = await makeUser(db, `iso-b-${randomUUID()}@example.com`)
    const service = createMiniAppsService(db)
    await service.create({ownerId: ownerA, spec: specWithHeading('A1')})
    await service.create({ownerId: ownerA, spec: specWithHeading('A2')})

    const server = await buildMiniAppsServer({db})
    try {
      const res = await server.inject({
        method: 'GET',
        url: '/me/mini-apps',
        headers: authHeader(ownerB, `b-${randomUUID()}@example.com`),
      })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({miniApps: []})
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-120 — Security: GET /me/mini-apps/:id emits structured audit log
  // -------------------------------------------------------------------------
  it("T-0001-120: GET /me/mini-apps/:id emits {userId, miniAppId, action: 'mini_app.read', durationMs}; no email/specJson/token", async () => {
    const ownerId = await makeUser(db)
    const email = `audit-${randomUUID()}@example.com`
    const token = userJwt({sub: ownerId, email, secret: TEST_JWT_SECRET})
    const service = createMiniAppsService(db)
    const detail = await service.create({ownerId, spec: specWithHeading('Audit me')})

    const sink = createLogSink()
    const server = await buildMiniAppsServer({db, sink})
    try {
      const res = await server.inject({
        method: 'GET',
        url: `/me/mini-apps/${detail.miniApp.id}`,
        headers: {authorization: `Bearer ${token}`},
      })
      expect(res.statusCode).toBe(200)

      const infoRecords = sink.byLevel(PINO_LEVEL.INFO)
      const audit = infoRecords.find(
        r => (r as Record<string, unknown>).action === 'mini_app.read',
      )
      expect(audit).toBeDefined()
      expect(audit?.userId).toBe(ownerId)
      expect((audit as Record<string, unknown>)?.miniAppId).toBe(detail.miniApp.id)
      expect(typeof audit?.durationMs).toBe('number')
      expect((audit?.durationMs as number) >= 0).toBe(true)

      const wholeLog = sink.raw.join('')
      expect(wholeLog).not.toContain(email)
      expect(wholeLog).not.toContain('Audit me')
      expect(wholeLog).not.toContain(token)
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0011-045 — POST /me/mini-apps/:id/rename 200 with {miniApp:{id,title}}
  // -------------------------------------------------------------------------
  it('T-0011-045: POST /me/mini-apps/:id/rename returns 200 {miniApp:{id,title}}', async () => {
    const ownerId = await makeUser(db)
    const service = createMiniAppsService(db)
    const {miniApp} = await service.create({ownerId, spec: specWithHeading('Old')})

    const server = await buildMiniAppsServer({db})
    try {
      const res = await server.inject({
        method: 'POST',
        url: `/me/mini-apps/${miniApp.id}/rename`,
        headers: {
          ...authHeader(ownerId, `rename-${randomUUID()}@example.com`),
          'content-type': 'application/json',
        },
        payload: JSON.stringify({title: 'New Title'}),
      })
      expect(res.statusCode).toBe(200)
      const body = res.json() as {miniApp: {id: string; title: string}}
      expect(body.miniApp.id).toBe(miniApp.id)
      expect(body.miniApp.title).toBe('New Title')
      expect(Object.keys(body).sort()).toEqual(['miniApp'])
      expect(Object.keys(body.miniApp).sort()).toEqual(['id', 'title'])
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0011-046 — POST /me/mini-apps/:id/rename 400 on empty title
  // -------------------------------------------------------------------------
  it('T-0011-046: POST /me/mini-apps/:id/rename 400 when title is empty string', async () => {
    const ownerId = await makeUser(db)
    const service = createMiniAppsService(db)
    const {miniApp} = await service.create({ownerId, spec: validSpec()})

    const server = await buildMiniAppsServer({db})
    try {
      const res = await server.inject({
        method: 'POST',
        url: `/me/mini-apps/${miniApp.id}/rename`,
        headers: {
          ...authHeader(ownerId, `re-empty-${randomUUID()}@example.com`),
          'content-type': 'application/json',
        },
        payload: JSON.stringify({title: ''}),
      })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toEqual({error: 'invalid_input'})
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0011-047 — POST /me/mini-apps/:id/rename 400 on whitespace-only title
  // -------------------------------------------------------------------------
  it('T-0011-047: POST /me/mini-apps/:id/rename 400 when title is whitespace-only', async () => {
    const ownerId = await makeUser(db)
    const service = createMiniAppsService(db)
    const {miniApp} = await service.create({ownerId, spec: validSpec()})

    const server = await buildMiniAppsServer({db})
    try {
      const res = await server.inject({
        method: 'POST',
        url: `/me/mini-apps/${miniApp.id}/rename`,
        headers: {
          ...authHeader(ownerId, `re-ws-${randomUUID()}@example.com`),
          'content-type': 'application/json',
        },
        payload: JSON.stringify({title: '   '}),
      })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toEqual({error: 'invalid_input'})
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0011-048 — POST /me/mini-apps/:id/rename 400 on title >80 chars
  // -------------------------------------------------------------------------
  it('T-0011-048: POST /me/mini-apps/:id/rename 400 when title exceeds 80 chars', async () => {
    const ownerId = await makeUser(db)
    const service = createMiniAppsService(db)
    const {miniApp} = await service.create({ownerId, spec: validSpec()})

    const server = await buildMiniAppsServer({db})
    try {
      const res = await server.inject({
        method: 'POST',
        url: `/me/mini-apps/${miniApp.id}/rename`,
        headers: {
          ...authHeader(ownerId, `re-long-${randomUUID()}@example.com`),
          'content-type': 'application/json',
        },
        payload: JSON.stringify({title: 'A'.repeat(81)}),
      })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toEqual({error: 'invalid_input'})
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0011-049 — POST /me/mini-apps/:id/rename 404 for non-owner
  // -------------------------------------------------------------------------
  it('T-0011-049: POST /me/mini-apps/:id/rename 404 when caller is not the owner', async () => {
    const ownerA = await makeUser(db, `ren-a-${randomUUID()}@example.com`)
    const ownerB = await makeUser(db, `ren-b-${randomUUID()}@example.com`)
    const service = createMiniAppsService(db)
    const {miniApp} = await service.create({ownerId: ownerA, spec: validSpec()})

    const server = await buildMiniAppsServer({db})
    try {
      const res = await server.inject({
        method: 'POST',
        url: `/me/mini-apps/${miniApp.id}/rename`,
        headers: {
          ...authHeader(ownerB, `ren-b-${randomUUID()}@example.com`),
          'content-type': 'application/json',
        },
        payload: JSON.stringify({title: 'Stolen'}),
      })
      expect(res.statusCode).toBe(404)
      expect(res.json()).toEqual({error: 'not_found'})
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0011-050 — POST /me/mini-apps/:id/archive 200 with archivedAt
  // -------------------------------------------------------------------------
  it('T-0011-050: POST /me/mini-apps/:id/archive returns 200 {miniApp:{id,archivedAt}} with ISO8601 archivedAt', async () => {
    const ownerId = await makeUser(db)
    const service = createMiniAppsService(db)
    const {miniApp} = await service.create({ownerId, spec: validSpec()})

    const server = await buildMiniAppsServer({db})
    try {
      const res = await server.inject({
        method: 'POST',
        url: `/me/mini-apps/${miniApp.id}/archive`,
        headers: authHeader(ownerId, `arch-${randomUUID()}@example.com`),
        payload: '{}',
      })
      expect(res.statusCode).toBe(200)
      const body = res.json() as {miniApp: {id: string; archivedAt: string | null}}
      expect(body.miniApp.id).toBe(miniApp.id)
      expect(body.miniApp.archivedAt).not.toBeNull()
      // archivedAt must be a valid ISO8601 date string
      expect(new Date(body.miniApp.archivedAt!).toISOString()).toBe(body.miniApp.archivedAt)
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0011-051 — POST /me/mini-apps/:id/archive idempotent
  // -------------------------------------------------------------------------
  it('T-0011-051: POST /me/mini-apps/:id/archive is idempotent — second call returns same archivedAt', async () => {
    const ownerId = await makeUser(db)
    const service = createMiniAppsService(db)
    const {miniApp} = await service.create({ownerId, spec: validSpec()})

    const server = await buildMiniAppsServer({db})
    try {
      const headers = authHeader(ownerId, `arch-idem-${randomUUID()}@example.com`)
      const res1 = await server.inject({
        method: 'POST',
        url: `/me/mini-apps/${miniApp.id}/archive`,
        headers,
        payload: '{}',
      })
      expect(res1.statusCode).toBe(200)
      const at1 = (res1.json() as {miniApp: {archivedAt: string}}).miniApp.archivedAt

      await new Promise(r => setTimeout(r, 5))

      const res2 = await server.inject({
        method: 'POST',
        url: `/me/mini-apps/${miniApp.id}/archive`,
        headers,
        payload: '{}',
      })
      expect(res2.statusCode).toBe(200)
      const at2 = (res2.json() as {miniApp: {archivedAt: string}}).miniApp.archivedAt

      expect(at1).toBe(at2)
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0011-052 — POST /me/mini-apps/:id/unarchive 200, archivedAt null
  // -------------------------------------------------------------------------
  it('T-0011-052: POST /me/mini-apps/:id/unarchive returns 200 {miniApp:{id,archivedAt:null}}', async () => {
    const ownerId = await makeUser(db)
    const service = createMiniAppsService(db)
    const {miniApp} = await service.create({ownerId, spec: validSpec()})
    await service.archive(ownerId, miniApp.id)

    const server = await buildMiniAppsServer({db})
    try {
      const res = await server.inject({
        method: 'POST',
        url: `/me/mini-apps/${miniApp.id}/unarchive`,
        headers: authHeader(ownerId, `unarch-${randomUUID()}@example.com`),
        payload: '{}',
      })
      expect(res.statusCode).toBe(200)
      const body = res.json() as {miniApp: {id: string; archivedAt: null}}
      expect(body.miniApp.id).toBe(miniApp.id)
      expect(body.miniApp.archivedAt).toBeNull()
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0011-053 — POST /me/mini-apps/:id/archive 404 for non-owner
  // -------------------------------------------------------------------------
  it('T-0011-053: POST /me/mini-apps/:id/archive 404 when caller is not the owner', async () => {
    const ownerA = await makeUser(db, `arc-a-${randomUUID()}@example.com`)
    const ownerB = await makeUser(db, `arc-b-${randomUUID()}@example.com`)
    const service = createMiniAppsService(db)
    const {miniApp} = await service.create({ownerId: ownerA, spec: validSpec()})

    const server = await buildMiniAppsServer({db})
    try {
      const res = await server.inject({
        method: 'POST',
        url: `/me/mini-apps/${miniApp.id}/archive`,
        headers: authHeader(ownerB, `arc-b-${randomUUID()}@example.com`),
        payload: '{}',
      })
      expect(res.statusCode).toBe(404)
      expect(res.json()).toEqual({error: 'not_found'})
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0011-054 — DELETE /me/mini-apps/:id 200 {deletedAt} first call
  // -------------------------------------------------------------------------
  it('T-0011-054: DELETE /me/mini-apps/:id first call returns 200 {deletedAt: ISO8601}', async () => {
    const ownerId = await makeUser(db)
    const service = createMiniAppsService(db)
    const {miniApp} = await service.create({ownerId, spec: validSpec()})

    const server = await buildMiniAppsServer({db})
    try {
      const res = await server.inject({
        method: 'DELETE',
        url: `/me/mini-apps/${miniApp.id}`,
        headers: authHeader(ownerId, `del-${randomUUID()}@example.com`),
      })
      expect(res.statusCode).toBe(200)
      const body = res.json() as {deletedAt: string}
      expect(body.deletedAt).toBeDefined()
      expect(new Date(body.deletedAt).toISOString()).toBe(body.deletedAt)
      expect(Object.keys(body).sort()).toEqual(['deletedAt'])
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0011-055 — DELETE /me/mini-apps/:id 200 {already_deleted:true} second call
  // -------------------------------------------------------------------------
  it('T-0011-055: DELETE /me/mini-apps/:id second call returns 200 {already_deleted:true}', async () => {
    const ownerId = await makeUser(db)
    const service = createMiniAppsService(db)
    const {miniApp} = await service.create({ownerId, spec: validSpec()})

    const server = await buildMiniAppsServer({db})
    try {
      const headers = authHeader(ownerId, `del-idem-${randomUUID()}@example.com`)
      await server.inject({method: 'DELETE', url: `/me/mini-apps/${miniApp.id}`, headers})

      const res2 = await server.inject({
        method: 'DELETE',
        url: `/me/mini-apps/${miniApp.id}`,
        headers,
      })
      expect(res2.statusCode).toBe(200)
      expect(res2.json()).toEqual({already_deleted: true})
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0011-057 — DELETE /me/mini-apps/:id 404 for non-owner (no 403)
  // -------------------------------------------------------------------------
  it('T-0011-057: DELETE /me/mini-apps/:id for non-owner returns 404 (no 403 — no ownership leak)', async () => {
    const ownerA = await makeUser(db, `del-a-${randomUUID()}@example.com`)
    const ownerB = await makeUser(db, `del-b-${randomUUID()}@example.com`)
    const service = createMiniAppsService(db)
    const {miniApp} = await service.create({ownerId: ownerA, spec: validSpec()})

    const server = await buildMiniAppsServer({db})
    try {
      const res = await server.inject({
        method: 'DELETE',
        url: `/me/mini-apps/${miniApp.id}`,
        headers: authHeader(ownerB, `del-b-${randomUUID()}@example.com`),
      })
      expect(res.statusCode).toBe(404)
      expect(res.json()).toEqual({error: 'not_found'})
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0011-070 — DELETE /me/mini-apps/:id does NOT return 403 for phantom id
  // -------------------------------------------------------------------------
  it('T-0011-070: DELETE /me/mini-apps/:id for a phantom UUID returns 404, never 403', async () => {
    const ownerId = await makeUser(db)
    const server = await buildMiniAppsServer({db})
    try {
      const res = await server.inject({
        method: 'DELETE',
        url: `/me/mini-apps/${randomUUID()}`,
        headers: authHeader(ownerId, `phantom-${randomUUID()}@example.com`),
      })
      expect(res.statusCode).toBe(404)
      expect(res.json()).toEqual({error: 'not_found'})
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0011-062 — POST /me/mini-apps/:id/share → 501 not_implemented
  // -------------------------------------------------------------------------
  it('T-0011-062: POST /me/mini-apps/:id/share returns 501 {error:"not_implemented", adr:"ADR-0008"}', async () => {
    const ownerId = await makeUser(db)
    const service = createMiniAppsService(db)
    const {miniApp} = await service.create({ownerId, spec: validSpec()})

    const server = await buildMiniAppsServer({db})
    try {
      const res = await server.inject({
        method: 'POST',
        url: `/me/mini-apps/${miniApp.id}/share`,
        headers: authHeader(ownerId, `share-${randomUUID()}@example.com`),
        payload: '{}',
      })
      expect(res.statusCode).toBe(501)
      const body = res.json() as Record<string, unknown>
      expect(body.error).toBe('not_implemented')
      expect(body.adr).toBe('ADR-0008')
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0011-063 — POST /me/mini-apps/clone → 501 not_implemented
  // -------------------------------------------------------------------------
  it('T-0011-063: POST /me/mini-apps/clone returns 501 {error:"not_implemented", adr:"ADR-0008"}', async () => {
    const ownerId = await makeUser(db)
    const server = await buildMiniAppsServer({db})
    try {
      const res = await server.inject({
        method: 'POST',
        url: `/me/mini-apps/clone`,
        headers: authHeader(ownerId, `clone-${randomUUID()}@example.com`),
        payload: '{}',
      })
      expect(res.statusCode).toBe(501)
      const body = res.json() as Record<string, unknown>
      expect(body.error).toBe('not_implemented')
      expect(body.adr).toBe('ADR-0008')
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0011-072 — old /me/projects paths return 404 — route no longer registered
  // (renamed from T-0011-071 to free that ID for the archive-on-deleted test
  // per Roz O3 finding)
  // -------------------------------------------------------------------------
  it('T-0011-072: GET /me/projects (old path) returns 404 — route no longer registered', async () => {
    const ownerId = await makeUser(db)
    const server = await buildMiniAppsServer({db})
    try {
      const res = await server.inject({
        method: 'GET',
        url: '/me/projects',
        headers: authHeader(ownerId, `old-${randomUUID()}@example.com`),
      })
      expect(res.statusCode).toBe(404)

      const res2 = await server.inject({
        method: 'GET',
        url: `/me/projects/${randomUUID()}`,
        headers: authHeader(ownerId, `old2-${randomUUID()}@example.com`),
      })
      expect(res2.statusCode).toBe(404)
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0011-056 — POST /me/mini-apps/:id/archive HTTP idempotency (route layer)
  // Second call returns 200 with same archivedAt value as first call.
  // -------------------------------------------------------------------------
  it('T-0011-056: POST /me/mini-apps/:id/archive route-layer idempotency — second call returns 200 with identical archivedAt', async () => {
    const ownerId = await makeUser(db)
    const service = createMiniAppsService(db)
    const {miniApp} = await service.create({ownerId, spec: validSpec()})

    const server = await buildMiniAppsServer({db})
    try {
      const headers = authHeader(ownerId, `arch-idem2-${randomUUID()}@example.com`)

      const res1 = await server.inject({
        method: 'POST',
        url: `/me/mini-apps/${miniApp.id}/archive`,
        headers,
        payload: '{}',
      })
      expect(res1.statusCode).toBe(200)
      const at1 = (res1.json() as {miniApp: {archivedAt: string}}).miniApp.archivedAt

      // Small delay — a non-idempotent implementation would write a newer timestamp.
      await new Promise(r => setTimeout(r, 5))

      const res2 = await server.inject({
        method: 'POST',
        url: `/me/mini-apps/${miniApp.id}/archive`,
        headers,
        payload: '{}',
      })
      expect(res2.statusCode).toBe(200)
      const at2 = (res2.json() as {miniApp: {archivedAt: string}}).miniApp.archivedAt

      // Must be the same ISO string — not a fresh timestamp.
      expect(at1).toBe(at2)
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0011-058 — DELETE sets deleted_at; subsequent GET /me/mini-apps/:id → 404
  // -------------------------------------------------------------------------
  it('T-0011-058: DELETE /me/mini-apps/:id sets deleted_at; subsequent GET returns 404', async () => {
    const ownerId = await makeUser(db)
    const service = createMiniAppsService(db)
    const {miniApp} = await service.create({ownerId, spec: validSpec()})

    const server = await buildMiniAppsServer({db})
    try {
      const headers = authHeader(ownerId, `del-get-${randomUUID()}@example.com`)

      // DELETE first
      const delRes = await server.inject({
        method: 'DELETE',
        url: `/me/mini-apps/${miniApp.id}`,
        headers,
      })
      expect(delRes.statusCode).toBe(200)

      // GET after DELETE must return 404
      const getRes = await server.inject({
        method: 'GET',
        url: `/me/mini-apps/${miniApp.id}`,
        headers,
      })
      expect(getRes.statusCode).toBe(404)
      expect(getRes.json()).toEqual({error: 'not_found'})
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0011-059 — After DELETE, GET /me/mini-apps list does NOT include deleted row
  // -------------------------------------------------------------------------
  it('T-0011-059: after DELETE, GET /me/mini-apps list excludes the deleted mini-app', async () => {
    const ownerId = await makeUser(db)
    const service = createMiniAppsService(db)
    const kept = await service.create({ownerId, spec: validSpec()})
    const doomed = await service.create({ownerId, spec: validSpec()})

    const server = await buildMiniAppsServer({db})
    try {
      const headers = authHeader(ownerId, `del-list-${randomUUID()}@example.com`)

      await server.inject({method: 'DELETE', url: `/me/mini-apps/${doomed.miniApp.id}`, headers})

      const listRes = await server.inject({method: 'GET', url: '/me/mini-apps', headers})
      expect(listRes.statusCode).toBe(200)
      const ids = (listRes.json() as {miniApps: Array<{id: string}>}).miniApps.map(m => m.id)
      expect(ids).toContain(kept.miniApp.id)
      expect(ids).not.toContain(doomed.miniApp.id)
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0011-059a — Archived rows excluded from default GET /me/mini-apps list
  // Seed 2 mini-apps, archive 1, assert list returns only the non-archived row.
  // -------------------------------------------------------------------------
  it('T-0011-059a: GET /me/mini-apps default list excludes archived rows — archived row absent, active row present', async () => {
    const ownerId = await makeUser(db)
    const service = createMiniAppsService(db)
    const active = await service.create({ownerId, spec: validSpec()})
    const toArchive = await service.create({ownerId, spec: validSpec()})

    const server = await buildMiniAppsServer({db})
    try {
      const headers = authHeader(ownerId, `arch-list-${randomUUID()}@example.com`)

      // Archive via route
      const archRes = await server.inject({
        method: 'POST',
        url: `/me/mini-apps/${toArchive.miniApp.id}/archive`,
        headers,
        payload: '{}',
      })
      expect(archRes.statusCode).toBe(200)

      const listRes = await server.inject({method: 'GET', url: '/me/mini-apps', headers})
      expect(listRes.statusCode).toBe(200)
      const ids = (listRes.json() as {miniApps: Array<{id: string}>}).miniApps.map(m => m.id)
      expect(ids).toContain(active.miniApp.id)
      expect(ids).not.toContain(toArchive.miniApp.id)
      // Exactly 1 row — the archived one is gone
      expect(ids).toHaveLength(1)
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0011-060 — DELETE idempotency HTTP mapping:
  // Second DELETE returns 200 {already_deleted:true} (NOT 404).
  // -------------------------------------------------------------------------
  it('T-0011-060: DELETE /me/mini-apps/:id second call returns 200 {already_deleted:true} — not 404', async () => {
    const ownerId = await makeUser(db)
    const service = createMiniAppsService(db)
    const {miniApp} = await service.create({ownerId, spec: validSpec()})

    const server = await buildMiniAppsServer({db})
    try {
      const headers = authHeader(ownerId, `del-idem2-${randomUUID()}@example.com`)

      const res1 = await server.inject({
        method: 'DELETE',
        url: `/me/mini-apps/${miniApp.id}`,
        headers,
      })
      expect(res1.statusCode).toBe(200)

      const res2 = await server.inject({
        method: 'DELETE',
        url: `/me/mini-apps/${miniApp.id}`,
        headers,
      })
      // Must be 200 with already_deleted — not 404.
      expect(res2.statusCode).toBe(200)
      expect(res2.json()).toEqual({already_deleted: true})
      expect(Object.keys(res2.json() as Record<string, unknown>).sort()).toEqual(['already_deleted'])
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0011-061 — DELETE called by non-owner → 404 at route layer
  // Seed mini-app for user A; user B's auth attempts DELETE; assert 404.
  // -------------------------------------------------------------------------
  it('T-0011-061: DELETE /me/mini-apps/:id called by non-owner returns 404 (route layer — no ownership leak)', async () => {
    const ownerA = await makeUser(db, `del61-a-${randomUUID()}@example.com`)
    const ownerB = await makeUser(db, `del61-b-${randomUUID()}@example.com`)
    const service = createMiniAppsService(db)
    const {miniApp} = await service.create({ownerId: ownerA, spec: validSpec()})

    const server = await buildMiniAppsServer({db})
    try {
      const res = await server.inject({
        method: 'DELETE',
        url: `/me/mini-apps/${miniApp.id}`,
        headers: authHeader(ownerB, `del61-b2-${randomUUID()}@example.com`),
      })
      expect(res.statusCode).toBe(404)
      expect(res.json()).toEqual({error: 'not_found'})
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0011-064 — POST /me/mini-apps/:id/share without auth header → 401
  // Verifies requireAuth preHandler is registered on the share stub.
  // -------------------------------------------------------------------------
  it('T-0011-064: POST /me/mini-apps/:id/share without Authorization header returns 401', async () => {
    const server = await buildMiniAppsServer({db})
    try {
      const res = await server.inject({
        method: 'POST',
        url: `/me/mini-apps/${randomUUID()}/share`,
        payload: '{}',
      })
      expect(res.statusCode).toBe(401)
      expect(res.json()).toEqual({error: 'unauthorized'})
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0011-065 — POST /me/mini-apps/clone without auth header → 401
  // Verifies requireAuth preHandler is registered on the clone stub.
  // -------------------------------------------------------------------------
  it('T-0011-065: POST /me/mini-apps/clone without Authorization header returns 401', async () => {
    const server = await buildMiniAppsServer({db})
    try {
      const res = await server.inject({
        method: 'POST',
        url: `/me/mini-apps/clone`,
        payload: '{}',
      })
      expect(res.statusCode).toBe(401)
      expect(res.json()).toEqual({error: 'unauthorized'})
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0011-066 — PATCH /me/mini-apps/:id with body {title: 42} → 400
  // Wrong type on title field (number instead of string).
  // Uses POST /rename since ADR-0011 models rename as a POST action.
  // -------------------------------------------------------------------------
  it('T-0011-066: POST /me/mini-apps/:id/rename with {title: 42} (wrong type) returns 400', async () => {
    const ownerId = await makeUser(db)
    const service = createMiniAppsService(db)
    const {miniApp} = await service.create({ownerId, spec: validSpec()})

    const server = await buildMiniAppsServer({db})
    try {
      const res = await server.inject({
        method: 'POST',
        url: `/me/mini-apps/${miniApp.id}/rename`,
        headers: {
          ...authHeader(ownerId, `type-${randomUUID()}@example.com`),
          'content-type': 'application/json',
        },
        payload: JSON.stringify({title: 42}),
      })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toEqual({error: 'invalid_input'})
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0011-069 — Concurrent renames → last-write-wins; both return 200
  // -------------------------------------------------------------------------
  it('T-0011-069: concurrent renames via Promise.all both return 200; last write wins', async () => {
    const ownerId = await makeUser(db)
    const service = createMiniAppsService(db)
    const {miniApp} = await service.create({ownerId, spec: validSpec()})

    const server = await buildMiniAppsServer({db})
    try {
      const headers = {
        ...authHeader(ownerId, `conc-${randomUUID()}@example.com`),
        'content-type': 'application/json',
      }

      const [res1, res2] = await Promise.all([
        server.inject({
          method: 'POST',
          url: `/me/mini-apps/${miniApp.id}/rename`,
          headers,
          payload: JSON.stringify({title: 'Concurrent Title A'}),
        }),
        server.inject({
          method: 'POST',
          url: `/me/mini-apps/${miniApp.id}/rename`,
          headers,
          payload: JSON.stringify({title: 'Concurrent Title B'}),
        }),
      ])

      // Both must succeed — neither may 500 or 404.
      expect(res1.statusCode).toBe(200)
      expect(res2.statusCode).toBe(200)

      // The title from each response must be one of the two sent values.
      const title1 = (res1.json() as {miniApp: {title: string}}).miniApp.title
      const title2 = (res2.json() as {miniApp: {title: string}}).miniApp.title
      expect(['Concurrent Title A', 'Concurrent Title B']).toContain(title1)
      expect(['Concurrent Title A', 'Concurrent Title B']).toContain(title2)
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0011-071 — Archive applied to already-deleted mini_app → 404
  // -------------------------------------------------------------------------
  it('T-0011-071: POST /me/mini-apps/:id/archive on an already-deleted mini_app returns 404', async () => {
    const ownerId = await makeUser(db)
    const service = createMiniAppsService(db)
    const {miniApp} = await service.create({ownerId, spec: validSpec()})

    // Soft-delete first via service layer to set up the precondition.
    await service.delete(ownerId, miniApp.id)

    const server = await buildMiniAppsServer({db})
    try {
      const res = await server.inject({
        method: 'POST',
        url: `/me/mini-apps/${miniApp.id}/archive`,
        headers: authHeader(ownerId, `arch-deleted-${randomUUID()}@example.com`),
        payload: '{}',
      })
      // archive() on a deleted row returns null → route maps to 404.
      expect(res.statusCode).toBe(404)
      expect(res.json()).toEqual({error: 'not_found'})
    } finally {
      await server.close()
    }
  })
})

/**
 * ADR-0001 Step 4 / ADR-0002 Step 7 — projects route tests.
 *
 * T-IDs covered:
 *   Happy:    T-0001-053, 054, 122 / T-0002-124, 125
 *   Breaking: T-0002-126, 127 (old paths return 404)
 *   Failure:  T-0001-056, 057, 058
 *   Boundary: T-0001-060, 061
 *   Error:    T-0001-063
 *   Security: T-0001-064, 065, 066, 120
 *   Regression: T-0002-128 (all ADR-0001 tests migrated to new paths)
 *
 * ADR-0002 Step 7: routes renamed /projects → /me/projects and
 * /projects/:id → /me/projects/:id. All existing test URLs updated.
 *
 * Service-layer T-IDs (049/050/051/052/055/059/067/068/069/070/121/130/131/138)
 * are exercised in `services/projects.service.test.ts`.
 *
 * Response shape is asserted strictly with Ajv. Adding `additionalProperties:
 * false` plus deep-equal on a fixture is the `userCount` retro-lesson defense:
 * any new top-level field that slips into the response fails the test.
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

// SUPABASE_JWT_SECRET must be set BEFORE auth.js imports so verifyJwt picks
// up the configured value. Mirrors Step 2/3 patterns.
const TEST_JWT_SECRET = 'projects-route-test-secret-' + randomUUID()
process.env.SUPABASE_JWT_SECRET = TEST_JWT_SECRET
process.env.NODE_ENV = 'test'

import {projectsRoutes} from './projects.js'
import {createProjectsService, type ProjectsService} from '../services/projects.service.js'

type Db = NodePgDatabase<typeof schema>

interface BuildOpts {
  db?: Db
  /** Override the default service binding — used for the DB-down test. */
  service?: ProjectsService
  sink?: ReturnType<typeof createLogSink>
}

async function buildProjectsServer(opts: BuildOpts = {}) {
  const loggerInstance = opts.sink
    ? pino({level: 'info', base: undefined}, opts.sink.stream)
    : pino({level: 'silent'})
  const server = Fastify({loggerInstance})
  await server.register(projectsRoutes, {db: opts.db, service: opts.service})
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
// JSON Schemas — strict (additionalProperties: false everywhere). T-0001-053,
// T-0001-054, T-0001-064 each compile and `validate()` against the live body.
// ---------------------------------------------------------------------------

const ajv = new Ajv({strict: true, allErrors: true})

const projectListItemSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'title', 'updatedAt', 'createdAt', 'currentVersionId', 'parentProjectId'],
  properties: {
    id: {type: 'string'},
    title: {type: 'string'},
    updatedAt: {type: 'string'},
    createdAt: {type: 'string'},
    currentVersionId: {type: 'string'},
    parentProjectId: {type: ['string', 'null']},
  },
} as const

const projectListResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['projects'],
  properties: {
    projects: {type: 'array', items: projectListItemSchema},
  },
} as const

const projectSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'ownerId',
    'title',
    'currentVersionId',
    'parentProjectId',
    'createdAt',
    'updatedAt',
  ],
  properties: {
    id: {type: 'string'},
    ownerId: {type: 'string'},
    title: {type: 'string'},
    currentVersionId: {type: 'string'},
    parentProjectId: {type: ['string', 'null']},
    createdAt: {type: 'string'},
    updatedAt: {type: 'string'},
  },
} as const

const projectVersionSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'projectId', 'specJson', 'renderHash', 'createdAt'],
  properties: {
    id: {type: 'string'},
    projectId: {type: 'string'},
    specJson: {type: 'object'},
    renderHash: {type: 'string'},
    createdAt: {type: 'string'},
  },
} as const

const projectDetailResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['project', 'currentVersion'],
  properties: {
    project: projectSchema,
    currentVersion: projectVersionSchema,
  },
} as const

const validateList = ajv.compile(projectListResponseSchema)
const validateDetail = ajv.compile(projectDetailResponseSchema)

describe('ADR-0001 Step 4 / ADR-0002 Step 7 — projects routes', () => {
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

  // -------------------------------------------------------------------------
  // T-0001-058 — Failure: GET /me/projects without auth returns 401
  // -------------------------------------------------------------------------
  it('T-0001-058: GET /me/projects without an Authorization header returns 401', async () => {
    const server = await buildProjectsServer({db})
    try {
      const res = await server.inject({method: 'GET', url: '/me/projects'})
      expect(res.statusCode).toBe(401)
      expect(res.json()).toEqual({error: 'unauthorized'})
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-057 — Failure: GET /me/projects/:id with malformed UUID returns 400
  // -------------------------------------------------------------------------
  it('T-0001-057: GET /me/projects/:id with a malformed UUID returns 400 {error: "invalid_input"}', async () => {
    const ownerId = await makeUser(db)
    const email = `boundary-${randomUUID()}@example.com`

    const server = await buildProjectsServer({db})
    try {
      const res = await server.inject({
        method: 'GET',
        url: '/me/projects/not-a-uuid',
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
  // T-0001-053 / T-0002-124 — Happy: GET /me/projects body strictly matches
  // the JSON Schema (same shape as old GET /projects — T-0002-124 regression)
  // -------------------------------------------------------------------------
  it('T-0001-053 / T-0002-124: GET /me/projects returns 200 with body strictly matching the JSON Schema', async () => {
    const ownerId = await makeUser(db)
    const service = createProjectsService(db)
    await service.create({ownerId, spec: specWithHeading('Strict shape A')})
    await service.create({ownerId, spec: specWithHeading('Strict shape B')})

    const server = await buildProjectsServer({db})
    try {
      const res = await server.inject({
        method: 'GET',
        url: '/me/projects',
        headers: authHeader(ownerId, `strict-${randomUUID()}@example.com`),
      })
      expect(res.statusCode).toBe(200)
      const body = res.json() as Record<string, unknown>

      expect(validateList(body)).toBe(true)
      expect(validateList.errors).toBeNull()
      expect(Object.keys(body).sort()).toEqual(['projects'])
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-054 / T-0002-125 — Happy: GET /me/projects/:id body strictly
  // matches the JSON Schema (same shape as old GET /projects/:id)
  // -------------------------------------------------------------------------
  it('T-0001-054 / T-0002-125: GET /me/projects/:id returns 200 with body strictly matching the JSON Schema', async () => {
    const ownerId = await makeUser(db)
    const service = createProjectsService(db)
    const detail = await service.create({ownerId, spec: specWithHeading('Detail shape')})

    const server = await buildProjectsServer({db})
    try {
      const res = await server.inject({
        method: 'GET',
        url: `/me/projects/${detail.project.id}`,
        headers: authHeader(ownerId, `detail-${randomUUID()}@example.com`),
      })
      expect(res.statusCode).toBe(200)
      const body = res.json() as Record<string, unknown>

      expect(validateDetail(body)).toBe(true)
      expect(validateDetail.errors).toBeNull()
      expect(Object.keys(body).sort()).toEqual(['currentVersion', 'project'])
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-122 — Happy: forking — parentProjectId roundtrips through both routes
  // -------------------------------------------------------------------------
  it('T-0001-122: fork roundtrip — parentProjectId is on the list item AND on the detail project', async () => {
    const ownerId = await makeUser(db)
    const service = createProjectsService(db)
    const parent = await service.create({ownerId, spec: validSpec()})
    const child = await service.create({
      ownerId,
      spec: specWithHeading('Forked'),
      parentProjectId: parent.project.id,
    })

    const server = await buildProjectsServer({db})
    try {
      const headers = authHeader(ownerId, `fork-${randomUUID()}@example.com`)

      const detailRes = await server.inject({
        method: 'GET',
        url: `/me/projects/${child.project.id}`,
        headers,
      })
      expect(detailRes.statusCode).toBe(200)
      expect(
        (detailRes.json() as {project: {parentProjectId: string}}).project.parentProjectId,
      ).toBe(parent.project.id)

      const listRes = await server.inject({method: 'GET', url: '/me/projects', headers})
      expect(listRes.statusCode).toBe(200)
      const list = (
        listRes.json() as {projects: Array<{id: string; parentProjectId: string | null}>}
      ).projects
      const childItem = list.find(p => p.id === child.project.id)
      expect(childItem?.parentProjectId).toBe(parent.project.id)

      const parentItem = list.find(p => p.id === parent.project.id)
      expect(parentItem?.parentProjectId).toBeNull()
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-056 / T-0001-065 — Failure / Security: non-owner GET → 404
  // -------------------------------------------------------------------------
  it('T-0001-056 + T-0001-065: GET /me/projects/:id for non-owner returns 404 {error: "not_found"} — NOT 403; body keys exactly ["error"]', async () => {
    const ownerA = await makeUser(db, `owner-a-${randomUUID()}@example.com`)
    const ownerB = await makeUser(db, `owner-b-${randomUUID()}@example.com`)
    const service = createProjectsService(db)
    const detail = await service.create({ownerId: ownerA, spec: validSpec()})

    const server = await buildProjectsServer({db})
    try {
      const res = await server.inject({
        method: 'GET',
        url: `/me/projects/${detail.project.id}`,
        headers: authHeader(ownerB, `b-${randomUUID()}@example.com`),
      })
      expect(res.statusCode).toBe(404)
      const body = res.json() as Record<string, unknown>
      expect(body).toEqual({error: 'not_found'})
      expect(Object.keys(body).sort()).toEqual(['error'])

      // Sanity: a non-existent UUID also returns the same shape.
      const phantom = randomUUID()
      const res2 = await server.inject({
        method: 'GET',
        url: `/me/projects/${phantom}`,
        headers: authHeader(ownerB, `b2-${randomUUID()}@example.com`),
      })
      expect(res2.statusCode).toBe(404)
      expect(res2.json()).toEqual({error: 'not_found'})
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-060 — Boundary: empty list → 200 {projects: []}
  // -------------------------------------------------------------------------
  it('T-0001-060: empty projects for the user → 200 {projects: []}', async () => {
    const ownerId = await makeUser(db)
    const server = await buildProjectsServer({db})
    try {
      const res = await server.inject({
        method: 'GET',
        url: '/me/projects',
        headers: authHeader(ownerId, `empty-${randomUUID()}@example.com`),
      })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({projects: []})
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-061 — Boundary: 100 projects → all returned in correct sort order
  // -------------------------------------------------------------------------
  it('T-0001-061: user with 100 projects → GET /me/projects returns all 100 in updatedAt DESC order', async () => {
    const ownerId = await makeUser(db)
    const service = createProjectsService(db)

    // Insert sequentially so updatedAt is monotonically increasing in the DB.
    const created: string[] = []
    for (let i = 0; i < 100; i++) {
      const detail = await service.create({ownerId, spec: specWithHeading(`Bulk ${i}`)})
      created.push(detail.project.id)
    }

    const server = await buildProjectsServer({db})
    try {
      const res = await server.inject({
        method: 'GET',
        url: '/me/projects',
        headers: authHeader(ownerId, `bulk-${randomUUID()}@example.com`),
      })
      expect(res.statusCode).toBe(200)
      const list = (res.json() as {projects: Array<{id: string; updatedAt: string}>}).projects
      expect(list).toHaveLength(100)

      // Newest first — created last is at index 0.
      expect(list[0]?.id).toBe(created[99])
      expect(list[99]?.id).toBe(created[0])

      // Strictly non-increasing timestamps.
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
    const failingService: ProjectsService = {
      async create() {
        throw new Error('not used')
      },
      async list() {
        throw new Error(failureMessage)
      },
      async get() {
        throw new Error('not used')
      },
    }

    const sink = createLogSink()
    const server = await buildProjectsServer({db, service: failingService, sink})
    try {
      const res = await server.inject({
        method: 'GET',
        url: '/me/projects',
        headers: authHeader(ownerId, email),
      })
      expect(res.statusCode).toBe(500)
      const body = res.json() as Record<string, unknown>
      expect(body).toEqual({error: 'internal'})
      expect(Object.keys(body).sort()).toEqual(['error'])

      // Pino spy: error record carries safeMessage(err); never the user email.
      const errorRecords = sink.byLevel(PINO_LEVEL.ERROR)
      const failure = errorRecords.find(r => r.msg === 'projects_list_failed')
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
  it('T-0001-064: list response strict-shape — specJson absent on every project; defends the userCount retro-lesson', async () => {
    const ownerId = await makeUser(db)
    const service = createProjectsService(db)
    const a = await service.create({ownerId, spec: specWithHeading('Sensitive A')})
    const b = await service.create({ownerId, spec: specWithHeading('Sensitive B')})

    const server = await buildProjectsServer({db})
    try {
      const res = await server.inject({
        method: 'GET',
        url: '/me/projects',
        headers: authHeader(ownerId, `shape-${randomUUID()}@example.com`),
      })
      expect(res.statusCode).toBe(200)
      const body = res.json() as {
        projects: Array<Record<string, unknown>>
      }

      expect(validateList(body)).toBe(true)
      expect(validateList.errors).toBeNull()
      expect(Object.keys(body).sort()).toEqual(['projects'])

      // Hard rule: every list item is missing specJson, ownerId, and any
      // other rumored field. Asserted via the exact key set.
      const expectedKeys = [
        'createdAt',
        'currentVersionId',
        'id',
        'parentProjectId',
        'title',
        'updatedAt',
      ]
      for (const item of body.projects) {
        expect(Object.keys(item).sort()).toEqual(expectedKeys)
        expect(item).not.toHaveProperty('specJson')
        expect(item).not.toHaveProperty('ownerId')
      }

      // Belt-and-braces deep-equal on the projection — by id, the items are
      // exactly the two we inserted.
      const byId = new Map(body.projects.map(p => [p.id as string, p]))
      expect(byId.get(a.project.id)?.title).toBe('Sensitive A')
      expect(byId.get(b.project.id)?.title).toBe('Sensitive B')
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-066 — Security: user A cannot list user B's projects
  // -------------------------------------------------------------------------
  it("T-0001-066: cross-user isolation — user A's projects do not appear in user B's list", async () => {
    const ownerA = await makeUser(db, `iso-a-${randomUUID()}@example.com`)
    const ownerB = await makeUser(db, `iso-b-${randomUUID()}@example.com`)
    const service = createProjectsService(db)
    await service.create({ownerId: ownerA, spec: specWithHeading('A1')})
    await service.create({ownerId: ownerA, spec: specWithHeading('A2')})

    const server = await buildProjectsServer({db})
    try {
      const res = await server.inject({
        method: 'GET',
        url: '/me/projects',
        headers: authHeader(ownerB, `b-${randomUUID()}@example.com`),
      })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({projects: []})
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0002-126 — Breaking: GET /projects (old path) returns 404
  // T-0002-127 — Breaking: GET /projects/:id (old path) returns 404
  // Old paths are no longer registered; Fastify returns 404 by default.
  // -------------------------------------------------------------------------
  it('T-0002-126: GET /projects (old path) returns 404 — route no longer registered', async () => {
    const ownerId = await makeUser(db)
    const server = await buildProjectsServer({db})
    try {
      const res = await server.inject({
        method: 'GET',
        url: '/projects',
        headers: authHeader(ownerId, `old-path-${randomUUID()}@example.com`),
      })
      expect(res.statusCode).toBe(404)
    } finally {
      await server.close()
    }
  })

  it('T-0002-127: GET /projects/:id (old path) returns 404 — route no longer registered', async () => {
    const ownerId = await makeUser(db)
    const server = await buildProjectsServer({db})
    try {
      const res = await server.inject({
        method: 'GET',
        url: `/projects/${randomUUID()}`,
        headers: authHeader(ownerId, `old-path-detail-${randomUUID()}@example.com`),
      })
      expect(res.statusCode).toBe(404)
    } finally {
      await server.close()
    }
  })

  // -------------------------------------------------------------------------
  // T-0001-120 — Security: GET /me/projects/:id emits structured audit log;
  //   record contains {userId, projectId, action: 'project.read', durationMs};
  //   record does NOT contain email, specJson, or any token substring.
  // -------------------------------------------------------------------------
  it("T-0001-120: GET /me/projects/:id emits {userId, projectId, action: 'project.read', durationMs}; no email/specJson/token", async () => {
    const ownerId = await makeUser(db)
    const email = `audit-${randomUUID()}@example.com`
    const token = userJwt({sub: ownerId, email, secret: TEST_JWT_SECRET})
    const service = createProjectsService(db)
    const detail = await service.create({ownerId, spec: specWithHeading('Audit me')})

    const sink = createLogSink()
    const server = await buildProjectsServer({db, sink})
    try {
      const res = await server.inject({
        method: 'GET',
        url: `/me/projects/${detail.project.id}`,
        headers: {authorization: `Bearer ${token}`},
      })
      expect(res.statusCode).toBe(200)

      const infoRecords = sink.byLevel(PINO_LEVEL.INFO)
      const audit = infoRecords.find(r => (r as Record<string, unknown>).action === 'project.read')
      expect(audit).toBeDefined()
      expect(audit?.userId).toBe(ownerId)
      expect(audit?.projectId).toBe(detail.project.id)
      expect(typeof audit?.durationMs).toBe('number')
      expect((audit?.durationMs as number) >= 0).toBe(true)

      // Hard rules — across EVERY captured record, the email / spec contents /
      // token must be absent. Picks up incidental Fastify req-completed logs.
      const wholeLog = sink.raw.join('')
      expect(wholeLog).not.toContain(email)
      expect(wholeLog).not.toContain('Audit me') // unique heading text → unique spec marker
      expect(wholeLog).not.toContain(token)
    } finally {
      await server.close()
    }
  })
})

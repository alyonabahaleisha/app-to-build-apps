/**
 * ADR-0002 Step 6 — library route tests.
 *
 * T-IDs covered here (route-level, supertest + Fastify):
 *   Happy:      T-0002-101, T-0002-102
 *   Failure:    T-0002-106, T-0002-107, T-0002-108, T-0002-109, T-0002-110
 *   Security:   T-0002-116, T-0002-117, T-0002-118, T-0002-119, T-0002-120,
 *               T-0002-121
 *   Negative:   T-0002-122
 *   Regression: T-0002-123
 *
 * Service-level T-IDs (099, 100, 103-105, 111-115) live in
 * library.service.test.ts.
 *
 * JWT fixture pattern mirrors marketplace.test.ts.
 */
import {randomUUID} from 'node:crypto'

import {eq} from 'drizzle-orm'
import type {NodePgDatabase} from 'drizzle-orm/node-postgres'
import Fastify from 'fastify'
import pino from 'pino'

import * as schema from '../db/schema.js'
import {projects, users} from '../db/schema.js'
import {closeTestPool, getTestDb, getTestPool, truncateAll} from '../../test/setup.js'
import {uniqueEmail, userJwt, validSpec} from '../../test/factories.js'
import {createProjectsService} from '../services/projects.service.js'
import {resetRateLimitForTests} from '../lib/rateLimit.js'
import type {LibraryService} from '../services/library.service.js'

// SUPABASE_JWT_SECRET must be set BEFORE auth.js imports.
const TEST_JWT_SECRET = 'library-route-test-secret-' + randomUUID()
process.env.SUPABASE_JWT_SECRET = TEST_JWT_SECRET
process.env.NODE_ENV = 'test'

import {libraryRoutes} from './library.js'

type Db = NodePgDatabase<typeof schema>

// ---------------------------------------------------------------------------
// Server builder
// ---------------------------------------------------------------------------

interface BuildOpts {
  db?: Db
  service?: LibraryService
}

async function buildLibraryServer(opts: BuildOpts = {}) {
  const server = Fastify({logger: pino({level: 'silent'})})
  await server.register(libraryRoutes, {db: opts.db, service: opts.service})
  return server
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

async function makeUser(db: Db, handle?: string): Promise<{id: string; email: string}> {
  const id = randomUUID()
  const email = uniqueEmail()
  await db.insert(users).values({id, email})
  if (handle) {
    await db.update(users).set({handle}).where(eq(users.id, id))
  }
  return {id, email}
}

function authHeader(userId: string, email: string): string {
  return 'Bearer ' + userJwt({sub: userId, email, secret: TEST_JWT_SECRET})
}

async function makePublicProject(
  db: Db,
  ownerId: string,
  opts: {parentProjectId?: string; publishedAt?: Date; originalPrompt?: string} = {},
): Promise<string> {
  const svc = createProjectsService(db)
  const detail = await svc.create({
    ownerId,
    spec: validSpec(),
    originalPrompt: opts.originalPrompt ?? 'test prompt',
    parentProjectId: opts.parentProjectId,
  })
  const projectId = detail.project.id
  const publishedAt = opts.publishedAt ?? new Date()
  await db
    .update(projects)
    .set({visibility: 'public', publishedAt})
    .where(eq(projects.id, projectId))
  return projectId
}

async function makePrivateProject(db: Db, ownerId: string): Promise<string> {
  const svc = createProjectsService(db)
  const detail = await svc.create({ownerId, spec: validSpec()})
  return detail.project.id
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('ADR-0002 Step 6 — library routes', () => {
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
  // T-0002-101: GET /library?limit=5 returns ≤5 items + next_cursor
  // -------------------------------------------------------------------------

  it('T-0002-101: GET /library?limit=5 returns at most 5 items and sets next_cursor when more exist', async () => {
    const server = await buildLibraryServer({db})
    const {id, email} = await makeUser(db, 'limituser')

    // Create 7 public projects
    for (let i = 0; i < 7; i++) {
      await makePublicProject(db, id, {publishedAt: new Date(Date.now() - i * 1000)})
    }

    const res = await server.inject({
      method: 'GET',
      url: '/library?limit=5',
      headers: {authorization: authHeader(id, email)},
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.items.length).toBe(5)
    expect(body.next_cursor).not.toBeNull()
  })

  // -------------------------------------------------------------------------
  // T-0002-102: following next_cursor returns next page; stable across publish/unpublish
  // -------------------------------------------------------------------------

  it('T-0002-102: cursor-based pagination is stable across publish/unpublish between pages', async () => {
    const server = await buildLibraryServer({db})
    const {id, email} = await makeUser(db, 'cursoruser')

    // Create 6 projects with known, distinct timestamps
    const allIds: string[] = []
    for (let i = 0; i < 6; i++) {
      const pid = await makePublicProject(db, id, {
        publishedAt: new Date(Date.now() - i * 1000),
      })
      allIds.push(pid)
    }

    // Page 1
    const res1 = await server.inject({
      method: 'GET',
      url: '/library?limit=3',
      headers: {authorization: authHeader(id, email)},
    })
    expect(res1.statusCode).toBe(200)
    const page1 = JSON.parse(res1.payload)
    expect(page1.items.length).toBe(3)
    const page1Ids = new Set(page1.items.map((i: {id: string}) => i.id))

    // Unpublish one of the projects that should appear on page 2
    await db
      .update(projects)
      .set({visibility: 'private', publishedAt: null})
      .where(eq(projects.id, allIds[4]!))

    // Page 2 using cursor
    const res2 = await server.inject({
      method: 'GET',
      url: `/library?limit=3&cursor=${encodeURIComponent(page1.next_cursor)}`,
      headers: {authorization: authHeader(id, email)},
    })
    expect(res2.statusCode).toBe(200)
    const page2 = JSON.parse(res2.payload)

    // No overlap with page 1
    for (const item of page2.items) {
      expect(page1Ids.has(item.id)).toBe(false)
    }
    // Unpublished project does not appear
    expect(page2.items.map((i: {id: string}) => i.id)).not.toContain(allIds[4])
  })

  // -------------------------------------------------------------------------
  // T-0002-106: GET /library/:id for private project → 404
  // -------------------------------------------------------------------------

  it('T-0002-106: GET /library/:id returns 404 for a private project', async () => {
    const server = await buildLibraryServer({db})
    const {id, email} = await makeUser(db, 'privateowner')
    const projectId = await makePrivateProject(db, id)

    const res = await server.inject({
      method: 'GET',
      url: `/library/${projectId}`,
      headers: {authorization: authHeader(id, email)},
    })

    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.payload)).toEqual({error: 'not_found'})
  })

  // -------------------------------------------------------------------------
  // T-0002-107: GET /library/:id for non-existent → 404
  // -------------------------------------------------------------------------

  it('T-0002-107: GET /library/:id returns 404 for a non-existent project', async () => {
    const server = await buildLibraryServer({db})
    const {id, email} = await makeUser(db)

    const res = await server.inject({
      method: 'GET',
      url: `/library/${randomUUID()}`,
      headers: {authorization: authHeader(id, email)},
    })

    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.payload)).toEqual({error: 'not_found'})
  })

  // -------------------------------------------------------------------------
  // T-0002-108: GET /library?limit=51 → 400 invalid_input
  // -------------------------------------------------------------------------

  it('T-0002-108: GET /library?limit=51 returns 400 invalid_input', async () => {
    const server = await buildLibraryServer({db})
    const {id, email} = await makeUser(db)

    const res = await server.inject({
      method: 'GET',
      url: '/library?limit=51',
      headers: {authorization: authHeader(id, email)},
    })

    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.payload)).toEqual({error: 'invalid_input'})
  })

  // -------------------------------------------------------------------------
  // T-0002-109: GET /library?limit=0 → 400 invalid_input
  // -------------------------------------------------------------------------

  it('T-0002-109: GET /library?limit=0 returns 400 invalid_input', async () => {
    const server = await buildLibraryServer({db})
    const {id, email} = await makeUser(db)

    const res = await server.inject({
      method: 'GET',
      url: '/library?limit=0',
      headers: {authorization: authHeader(id, email)},
    })

    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.payload)).toEqual({error: 'invalid_input'})
  })

  // -------------------------------------------------------------------------
  // T-0002-110: GET /library?cursor=garbage → 400 invalid_input
  // -------------------------------------------------------------------------

  it('T-0002-110: GET /library?cursor=garbage returns 400 invalid_input', async () => {
    const server = await buildLibraryServer({db})
    const {id, email} = await makeUser(db)

    const res = await server.inject({
      method: 'GET',
      url: '/library?cursor=not-valid-cursor',
      headers: {authorization: authHeader(id, email)},
    })

    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.payload)).toEqual({error: 'invalid_input'})
  })

  // -------------------------------------------------------------------------
  // T-0002-116: GET /library MUST NOT return private projects
  // -------------------------------------------------------------------------

  it('T-0002-116: GET /library excludes private projects from the response', async () => {
    const server = await buildLibraryServer({db})
    const {id, email} = await makeUser(db, 'mixeduser')
    const publicId = await makePublicProject(db, id)
    const privateId = await makePrivateProject(db, id)

    const res = await server.inject({
      method: 'GET',
      url: '/library',
      headers: {authorization: authHeader(id, email)},
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    const returnedIds = body.items.map((i: {id: string}) => i.id)
    expect(returnedIds).toContain(publicId)
    expect(returnedIds).not.toContain(privateId)
  })

  // -------------------------------------------------------------------------
  // T-0002-117: GET /library MUST NOT return spec_json
  // -------------------------------------------------------------------------

  it('T-0002-117: GET /library items do not include spec_json', async () => {
    const server = await buildLibraryServer({db})
    const {id, email} = await makeUser(db, 'speccheck')
    await makePublicProject(db, id)

    const res = await server.inject({
      method: 'GET',
      url: '/library',
      headers: {authorization: authHeader(id, email)},
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.items.length).toBeGreaterThan(0)
    for (const item of body.items) {
      expect(item).not.toHaveProperty('spec_json')
    }
  })

  // -------------------------------------------------------------------------
  // T-0002-118: GET /library MUST NOT return raw email
  // -------------------------------------------------------------------------

  it('T-0002-118: GET /library items do not include email field', async () => {
    const server = await buildLibraryServer({db})
    const {id, email} = await makeUser(db, 'emailcheck')
    await makePublicProject(db, id)

    const res = await server.inject({
      method: 'GET',
      url: '/library',
      headers: {authorization: authHeader(id, email)},
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    for (const item of body.items) {
      expect(item).not.toHaveProperty('email')
    }
  })

  // -------------------------------------------------------------------------
  // T-0002-119: GET /library/:id MUST NOT return server prompt or thinking trace
  // -------------------------------------------------------------------------

  it('T-0002-119: GET /library/:id response does not include thinking trace or server prompt fields', async () => {
    const server = await buildLibraryServer({db})
    const {id, email} = await makeUser(db, 'detailcheck')
    const projectId = await makePublicProject(db, id)

    const res = await server.inject({
      method: 'GET',
      url: `/library/${projectId}`,
      headers: {authorization: authHeader(id, email)},
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    // Structural: these fields must be absent from the response
    expect(body).not.toHaveProperty('thinking_trace')
    expect(body).not.toHaveProperty('system_prompt')
    expect(body.project).not.toHaveProperty('email')
    expect(body.project).not.toHaveProperty('owner_id')
    // current_version should not have owner_id either
    expect(body.current_version).not.toHaveProperty('owner_id')
  })

  // -------------------------------------------------------------------------
  // T-0002-120: GET /library/:id private project owned by the caller → still 404
  // -------------------------------------------------------------------------

  it('T-0002-120: GET /library/:id returns 404 for own private project', async () => {
    const server = await buildLibraryServer({db})
    const {id, email} = await makeUser(db, 'ownerprivate')
    const projectId = await makePrivateProject(db, id)

    const res = await server.inject({
      method: 'GET',
      url: `/library/${projectId}`,
      headers: {authorization: authHeader(id, email)},
    })

    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.payload)).toEqual({error: 'not_found'})
  })

  // -------------------------------------------------------------------------
  // T-0002-121: auth-gated — 401 on missing JWT
  // -------------------------------------------------------------------------

  it('T-0002-121: GET /library returns 401 without a JWT', async () => {
    const server = await buildLibraryServer({db})

    const resList = await server.inject({method: 'GET', url: '/library'})
    expect(resList.statusCode).toBe(401)

    const resDetail = await server.inject({
      method: 'GET',
      url: `/library/${randomUUID()}`,
    })
    expect(resDetail.statusCode).toBe(401)
  })

  // -------------------------------------------------------------------------
  // T-0002-122: GET /library MUST NOT include original_prompt in items
  // -------------------------------------------------------------------------

  it('T-0002-122: GET /library items do not include original_prompt', async () => {
    const server = await buildLibraryServer({db})
    const {id, email} = await makeUser(db, 'promptcheck')
    await makePublicProject(db, id, {originalPrompt: 'secret user prompt text'})

    const res = await server.inject({
      method: 'GET',
      url: '/library',
      headers: {authorization: authHeader(id, email)},
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    for (const item of body.items) {
      expect(item).not.toHaveProperty('original_prompt')
    }
    // Double-check it's not in the raw payload text
    expect(res.payload).not.toContain('secret user prompt text')
  })

  // -------------------------------------------------------------------------
  // T-0002-123: EXPLAIN uses projects_library_idx partial index
  // -------------------------------------------------------------------------

  it('T-0002-123: EXPLAIN on library list query uses projects_library_idx', async () => {
    const pool = await getTestPool()

    // Run EXPLAIN ANALYZE on a representative library list query.
    // The partial index is: WHERE visibility='public' ORDER BY published_at DESC.
    // Run an initial EXPLAIN to confirm the query is valid syntax.
    await pool.query(
      `EXPLAIN (FORMAT TEXT) SELECT id FROM projects WHERE visibility='public' ORDER BY published_at DESC, id DESC LIMIT 20`,
    )

    // To make this a meaningful regression test we insert a row first so the
    // planner has statistics. With empty tables the planner may choose a seq
    // scan regardless of index availability.
    const userId = randomUUID()
    await pool.query(`INSERT INTO users (id, email) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [
      userId,
      `idx-test-${Date.now()}@test.com`,
    ])
    await pool.query(
      `INSERT INTO project_versions (id, project_id, spec_json, render_hash)
       SELECT gen_random_uuid(), p.id, '{"version":"0.1","views":[],"initialViewId":"x"}'::jsonb, 'hash'
       FROM (
         INSERT INTO projects (id, owner_id, title, visibility, published_at)
         VALUES (gen_random_uuid(), $1, 'test', 'public', NOW())
         RETURNING id
       ) p`,
      [userId],
    )

    const result2 = await pool.query(
      `EXPLAIN (FORMAT TEXT) SELECT id FROM projects WHERE visibility='public' ORDER BY published_at DESC, id DESC LIMIT 20`,
    )
    const plan2: string = result2.rows
      .map((r: Record<string, unknown>) => Object.values(r).join(' '))
      .join('\n')

    // Verify the index is referenced by name in the plan
    expect(plan2).toContain('projects_library_idx')
  })
})

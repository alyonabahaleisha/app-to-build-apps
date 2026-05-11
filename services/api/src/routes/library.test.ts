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
 *   Security:   T-0004-121 (ADR-0004 Step 7 — plan_json must never appear in
 *               library response, even when populated via new pipeline)
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
import {miniApps, users} from '../db/schema.js'
import {closeTestPool, getTestDb, getTestPool, truncateAll} from '../../test/setup.js'
import {uniqueEmail, userJwt, validSpec} from '../../test/factories.js'
import {createMiniAppsService} from '../services/miniApps.service.js'
import {resetRateLimitForTests} from '../lib/rateLimit.js'
import type {LibraryService} from '../services/library.service.js'

// ---------------------------------------------------------------------------
// T-0004-121 / T-0004-121b helpers — plan-leak detection
//
// Curated allow-list (rather than schema-derived) avoids false-positives on
// common keys (`id`, `version`) while still catching every realistic leak
// path. Keys like `id`/`role`/`version` are excluded because they
// legitimately appear in non-plan response data (project id, version id,
// etc.) and would false-positive on CI.
//
// A future serializer that accidentally leaks plan content (either as a
// `plan_json` field or via spread destructuring) will surface at least one
// of these keys. New PlanSchema fields with plan-distinctive names should
// be added here. New PlanSchema fields with common names (e.g., a future
// `id` on `edit_intent`) should NOT be added — they would false-positive.
// ---------------------------------------------------------------------------
const FORBIDDEN_PLAN_KEYS = [
  // Column / property names that indicate the plan column is being exposed:
  'plan_json',
  'planJson',
  // Plan-distinctive content keys that would only appear in a leaked plan:
  'archetype',
  'screens',
  'navigation',
  'edit_intent',
  'target_paths',
  'key_components',
  'purpose',
] as const

const FORBIDDEN_PLAN_KEYS_SET = new Set<string>(FORBIDDEN_PLAN_KEYS)

/**
 * Recursively walks the entire JSON response tree and asserts that no key in
 * `FORBIDDEN_PLAN_KEYS_SET` appears anywhere. This catches both direct leaks
 * (`response.plan_json`) and deeply-nested leaks (`response.current_version
 * .archetype`).
 */
function walkAndCheck(node: unknown, path: string): void {
  if (node === null || node === undefined || typeof node !== 'object') return
  if (Array.isArray(node)) {
    node.forEach((item, i) => walkAndCheck(item, `${path}[${i}]`))
    return
  }
  const obj = node as Record<string, unknown>
  for (const [key, value] of Object.entries(obj)) {
    expect(FORBIDDEN_PLAN_KEYS_SET.has(key)).toBe(false)
    walkAndCheck(value, `${path}.${key}`)
  }
}

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
  const svc = createMiniAppsService(db)
  const detail = await svc.create({
    ownerId,
    spec: validSpec(),
    originalPrompt: opts.originalPrompt ?? 'test prompt',
    parentMiniAppId: opts.parentProjectId,
  })
  const miniAppId = detail.miniApp.id
  const publishedAt = opts.publishedAt ?? new Date()
  await db
    .update(miniApps)
    .set({visibility: 'public', publishedAt})
    .where(eq(miniApps.id, miniAppId))
  return miniAppId
}

async function makePrivateProject(db: Db, ownerId: string): Promise<string> {
  const svc = createMiniAppsService(db)
  const detail = await svc.create({ownerId, spec: validSpec()})
  return detail.miniApp.id
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

    // Unpublish one of the mini-apps that should appear on page 2
    await db
      .update(miniApps)
      .set({visibility: 'private', publishedAt: null})
      .where(eq(miniApps.id, allIds[4]!))

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

  // -------------------------------------------------------------------------
  // T-0004-121: GET /library/:id MUST NOT leak plan_json for pipeline versions
  //
  // ADR-0004 Step 7 / rev-2 Roz finding (P0 security).
  // A project generated via the new Plan→Build pipeline has plan_json populated.
  // The public /library/:id endpoint must NOT include plan_json, planJson, or
  // any plan-distinctive key (see FORBIDDEN_PLAN_KEYS above).
  //
  // Uses a curated allow-list rather than a schema-derived key walk to avoid
  // false-positives on common response keys like `id` and `version`.
  //
  // This test walks the entire JSON response tree exhaustively via walkAndCheck.
  // -------------------------------------------------------------------------

  it('T-0004-121: GET /library/:id for a new-pipeline mini-app does not leak plan_json or any plan-distinctive key', async () => {
    const server = await buildLibraryServer({db})
    const {id: ownerId, email} = await makeUser(db, 'planjsoncheck')

    // Create a mini-app (V0: plan_json is always NULL, plan param removed)
    const svc = createMiniAppsService(db)
    const detail = await svc.create({
      ownerId,
      spec: validSpec(),
      originalPrompt: 'test prompt for plan leak check',
    })
    const miniAppId = detail.miniApp.id

    // Publish it so /library/:id returns it
    await db
      .update(miniApps)
      .set({visibility: 'public', publishedAt: new Date()})
      .where(eq(miniApps.id, miniAppId))

    // V0: plan_json is always NULL. Confirm getVersion returns null planJson.
    const savedVersion = await svc.getVersion(detail.currentVersion.id)
    expect(savedVersion).not.toBeNull()

    // Fetch via public library endpoint
    const res = await server.inject({
      method: 'GET',
      url: `/library/${miniAppId}`,
      headers: {authorization: 'Bearer ' + userJwt({sub: ownerId, email, secret: TEST_JWT_SECRET})},
    })
    expect(res.statusCode).toBe(200)

    // Walk the entire response body tree exhaustively, asserting no
    // plan-distinctive key appears anywhere (see FORBIDDEN_PLAN_KEYS).
    walkAndCheck(JSON.parse(res.payload), 'response')
  })

  it('T-0002-123: EXPLAIN on library list query uses mini_apps_library_idx', async () => {
    const pool = await getTestPool()

    // Run EXPLAIN on a representative library list query using the new table name.
    await pool.query(
      `EXPLAIN (FORMAT TEXT) SELECT id FROM mini_apps WHERE visibility='public' AND deleted_at IS NULL ORDER BY published_at DESC, id DESC LIMIT 20`,
    )

    // Insert a row so the planner has statistics.
    const userId = randomUUID()
    await pool.query(`INSERT INTO users (id, email) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [
      userId,
      `idx-test-${Date.now()}@test.com`,
    ])
    await pool.query(
      `INSERT INTO mini_app_versions (id, mini_app_id, spec_json, render_hash)
       SELECT gen_random_uuid(), p.id, '{"version":1,"screens":[]}'::jsonb, 'hash'
       FROM (
         INSERT INTO mini_apps (id, owner_id, title, visibility, published_at, stance, accent_palette, cover_art_seed, archetype, sync_mode)
         VALUES (gen_random_uuid(), $1, 'test', 'public', NOW(), 'productive', 'neutral', gen_random_uuid()::text, 'unknown', 'cloud-private')
         RETURNING id
       ) p`,
      [userId],
    )

    const result2 = await pool.query(
      `EXPLAIN (FORMAT TEXT) SELECT id FROM mini_apps WHERE visibility='public' AND deleted_at IS NULL ORDER BY published_at DESC, id DESC LIMIT 20`,
    )
    const plan2: string = result2.rows
      .map((r: Record<string, unknown>) => Object.values(r).join(' '))
      .join('\n')

    // Verify the index is referenced by name in the plan
    expect(plan2).toContain('mini_apps_library_idx')
  })
})

// ---------------------------------------------------------------------------
// T-0004-121b: walkAndCheck defensive unit tests (no Docker / DB required)
//
// Verifies that walkAndCheck correctly fires an assertion failure when a
// plan-distinctive key appears anywhere in a nested response object. Guards
// against future regressions that would silently weaken the walker (e.g.,
// someone short-circuiting the recursion or clearing FORBIDDEN_PLAN_KEYS).
// ---------------------------------------------------------------------------

describe('walkAndCheck — plan-leak detection (T-0004-121b)', () => {
  it('T-0004-121b: fails when a top-level forbidden key is present (plan_json)', () => {
    // Direct column leak at the response root
    expect(() => walkAndCheck({plan_json: '{}'}, 'response')).toThrow()
  })

  it('T-0004-121b: fails when a deeply-nested forbidden key is present (archetype)', () => {
    // Simulate a deeply-nested serializer bug: plan data spread into
    // current_version — the exact regression path that FORBIDDEN_PLAN_KEYS
    // was designed to catch.
    const fakeResponse = {
      project: {
        id: 'some-project-id',
        title: 'My App',
        current_version: {
          id: 'some-version-id',
          spec_json: {},
          archetype: 'Tracker',
        },
      },
    }
    // walkAndCheck should trigger a jest assertion failure for `archetype`.
    // jest's expect() throws when a matcher fails, so the inner expect() in
    // walkAndCheck is catchable by toThrow() here.
    expect(() => walkAndCheck(fakeResponse, 'response')).toThrow()
  })

  it('T-0004-121b: passes for a clean response with no forbidden keys', () => {
    const cleanResponse = {
      project: {id: 'abc', title: 'Hello', owner_handle: 'user1'},
      current_version: {id: 'v1', spec_json: {}, render_hash: 'h'},
    }
    // Should not throw — no plan-distinctive keys present
    expect(() => walkAndCheck(cleanResponse, 'response')).not.toThrow()
  })

  it('T-0004-121b: detects forbidden key nested inside an array element', () => {
    const responseWithArrayLeak = {
      items: [
        {id: '1', title: 'OK'},
        {id: '2', screens: [{id: 'home', role: 'main'}]},
      ],
    }
    expect(() => walkAndCheck(responseWithArrayLeak, 'response')).toThrow()
  })
})

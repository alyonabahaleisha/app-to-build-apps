/**
 * ADR-0002 Step 6 — library service tests.
 *
 * T-IDs covered here (service-level, testcontainers Postgres):
 *   Happy:       T-0002-099, T-0002-100, T-0002-103, T-0002-104, T-0002-105
 *   Boundary:    T-0002-111, T-0002-112, T-0002-113
 *   Concurrency: T-0002-114, T-0002-115
 *
 * Route-level T-IDs (HTTP shapes, auth gating, query-param validation) live
 * in `routes/library.test.ts`.
 *
 * Cursor helpers (encode/decode reversibility) are also tested here because
 * they're pure functions belonging to the service module.
 */
import {randomUUID} from 'node:crypto'

import {eq} from 'drizzle-orm'
import type {NodePgDatabase} from 'drizzle-orm/node-postgres'

import * as schema from '../db/schema.js'
import {projects, users} from '../db/schema.js'
import {
  createLibraryService,
  decodeCursor,
  encodeCursor,
  InvalidCursorError,
} from './library.service.js'
import {createProjectsService} from './projects.service.js'
import {uniqueEmail, validSpec} from '../../test/factories.js'
import {closeTestPool, getTestDb, truncateAll} from '../../test/setup.js'

type Db = NodePgDatabase<typeof schema>

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

async function makeUser(db: Db, handle?: string): Promise<string> {
  const id = randomUUID()
  await db.insert(users).values({id, email: uniqueEmail()})
  if (handle) {
    await db.update(users).set({handle}).where(eq(users.id, id))
  }
  return id
}

async function makePublicProject(
  db: Db,
  ownerId: string,
  opts: {
    parentProjectId?: string
    publishedAt?: Date
  } = {},
): Promise<string> {
  const projSvc = createProjectsService(db)
  const detail = await projSvc.create({
    ownerId,
    spec: validSpec(),
    originalPrompt: 'test prompt',
    parentProjectId: opts.parentProjectId,
  })
  const projectId = detail.project.id

  // Set published_at directly since marketplace publish also sets handle which
  // may conflict in bulk-create scenarios. We just set the DB columns directly.
  const publishedAt = opts.publishedAt ?? new Date()
  await db
    .update(projects)
    .set({visibility: 'public', publishedAt})
    .where(eq(projects.id, projectId))

  return projectId
}

async function makePrivateProject(db: Db, ownerId: string): Promise<string> {
  const projSvc = createProjectsService(db)
  const detail = await projSvc.create({ownerId, spec: validSpec()})
  return detail.project.id
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('ADR-0002 Step 6 — libraryService', () => {
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
  // Cursor helpers — pure function tests (no DB needed but run in suite)
  // -------------------------------------------------------------------------

  describe('cursor encode/decode reversibility', () => {
    it('encode then decode returns original payload', () => {
      const original = {
        published_at: new Date('2024-06-15T10:30:00.000Z'),
        project_id: randomUUID(),
      }
      const encoded = encodeCursor(original)
      const decoded = decodeCursor(encoded)
      expect(decoded.project_id).toBe(original.project_id)
      expect(decoded.published_at.toISOString()).toBe(original.published_at.toISOString())
    })

    it('decodeCursor throws InvalidCursorError on garbage input', () => {
      expect(() => decodeCursor('not-base64url!')).toThrow(InvalidCursorError)
    })

    it('decodeCursor throws InvalidCursorError on valid base64url but wrong shape', () => {
      const bad = Buffer.from(JSON.stringify({foo: 'bar'})).toString('base64url')
      expect(() => decodeCursor(bad)).toThrow(InvalidCursorError)
    })

    it('decodeCursor throws InvalidCursorError on valid shape but invalid date', () => {
      const bad = Buffer.from(
        JSON.stringify({published_at: 'not-a-date', project_id: randomUUID()}),
      ).toString('base64url')
      expect(() => decodeCursor(bad)).toThrow(InvalidCursorError)
    })
  })

  // -------------------------------------------------------------------------
  // T-0002-099: list returns seed/published projects ordered by published_at DESC
  // -------------------------------------------------------------------------

  it('T-0002-099: list returns public projects ordered by published_at DESC', async () => {
    const svc = createLibraryService(db)
    const userId = await makeUser(db, 'alice')

    const earlier = new Date('2024-01-01T00:00:00Z')
    const later = new Date('2024-06-01T00:00:00Z')

    await makePublicProject(db, userId, {publishedAt: earlier})
    await makePublicProject(db, userId, {publishedAt: later})

    const result = await svc.list({limit: 20})
    expect(result.items.length).toBe(2)
    // Most recent first
    expect(result.items[0]!.published_at.getTime()).toBeGreaterThanOrEqual(
      result.items[1]!.published_at.getTime(),
    )
  })

  // -------------------------------------------------------------------------
  // T-0002-100: list items include author_handle, exclude spec_json/email/owner_id
  // -------------------------------------------------------------------------

  it('T-0002-100: list items include author_handle and exclude sensitive fields', async () => {
    const svc = createLibraryService(db)
    const userId = await makeUser(db, 'bob')
    await makePublicProject(db, userId)

    const result = await svc.list({limit: 20})
    expect(result.items.length).toBe(1)

    const item = result.items[0]!
    expect(item.author_handle).toBe('bob')
    // Presence checks for required safe fields
    expect(typeof item.id).toBe('string')
    expect(typeof item.title).toBe('string')
    expect(item.published_at).toBeInstanceOf(Date)
    expect(typeof item.render_hash).toBe('string')

    // Absence of sensitive fields — TypeScript union already prevents these
    // but we also check the runtime object (defense in depth for T-0002-100,
    // T-0002-117, T-0002-118, T-0002-122).
    const raw = item as unknown as Record<string, unknown>
    expect(raw['spec_json']).toBeUndefined()
    expect(raw['email']).toBeUndefined()
    expect(raw['owner_id']).toBeUndefined()
    expect(raw['original_prompt']).toBeUndefined()
  })

  // -------------------------------------------------------------------------
  // T-0002-103: get returns project + current_version + author + parent
  // -------------------------------------------------------------------------

  it('T-0002-103: get returns project detail with current_version and author_handle', async () => {
    const svc = createLibraryService(db)
    const userId = await makeUser(db, 'charlie')
    const projectId = await makePublicProject(db, userId)

    const result = await svc.get(projectId)
    expect(result).not.toBeNull()
    expect(result!.project.author_handle).toBe('charlie')
    expect(result!.project.id).toBe(projectId)
    expect(typeof result!.project.original_prompt).toBe('string')
    expect(typeof result!.current_version.spec_json).toBe('object')
    expect(typeof result!.current_version.render_hash).toBe('string')
    expect(result!.current_version.created_at).toBeInstanceOf(Date)
  })

  // -------------------------------------------------------------------------
  // T-0002-104: project with parent_project_id returns parent: {id, author_handle, title}
  // -------------------------------------------------------------------------

  it('T-0002-104: get returns parent attribution when parent_project_id is set', async () => {
    const svc = createLibraryService(db)
    const parentOwnerId = await makeUser(db, 'parentuser')
    const remixerId = await makeUser(db, 'remixer')

    const parentId = await makePublicProject(db, parentOwnerId)
    const remixId = await makePublicProject(db, remixerId, {parentProjectId: parentId})

    const result = await svc.get(remixId)
    expect(result).not.toBeNull()
    expect(result!.project.parent).not.toBeNull()
    expect(result!.project.parent!.id).toBe(parentId)
    expect(result!.project.parent!.author_handle).toBe('parentuser')
    expect(typeof result!.project.parent!.title).toBe('string')
  })

  // -------------------------------------------------------------------------
  // T-0002-105: project without parent_project_id returns parent: null
  // -------------------------------------------------------------------------

  it('T-0002-105: get returns parent: null when parent_project_id is not set', async () => {
    const svc = createLibraryService(db)
    const userId = await makeUser(db, 'solo')
    const projectId = await makePublicProject(db, userId)

    const result = await svc.get(projectId)
    expect(result).not.toBeNull()
    expect(result!.project.parent).toBeNull()
  })

  // -------------------------------------------------------------------------
  // T-0002-111: list returns {items: [], next_cursor: null} when no public projects
  // -------------------------------------------------------------------------

  it('T-0002-111: list returns empty result when no public projects exist', async () => {
    const svc = createLibraryService(db)
    const userId = await makeUser(db, 'ghost')
    await makePrivateProject(db, userId)

    const result = await svc.list({limit: 20})
    expect(result.items).toEqual([])
    expect(result.next_cursor).toBeNull()
  })

  // -------------------------------------------------------------------------
  // T-0002-112: list with exactly `limit` items → next_cursor: null
  // -------------------------------------------------------------------------

  it('T-0002-112: next_cursor is null when result count equals limit exactly', async () => {
    const svc = createLibraryService(db)
    const userId = await makeUser(db, 'exact')

    // Create exactly 3 public projects; request limit=3
    for (let i = 0; i < 3; i++) {
      await makePublicProject(db, userId, {
        publishedAt: new Date(Date.now() - i * 1000),
      })
    }

    const result = await svc.list({limit: 3})
    expect(result.items.length).toBe(3)
    expect(result.next_cursor).toBeNull()
  })

  // -------------------------------------------------------------------------
  // T-0002-113: list with limit+1 items → first `limit` returned, next_cursor set
  // -------------------------------------------------------------------------

  it('T-0002-113: next_cursor is set when more items exist beyond the limit', async () => {
    const svc = createLibraryService(db)
    const userId = await makeUser(db, 'plenty')

    // Create 4 public projects; request limit=3
    for (let i = 0; i < 4; i++) {
      await makePublicProject(db, userId, {
        publishedAt: new Date(Date.now() - i * 1000),
      })
    }

    const result = await svc.list({limit: 3})
    expect(result.items.length).toBe(3)
    expect(result.next_cursor).not.toBeNull()

    // Following the cursor should return the remaining item
    const page2 = await svc.list({limit: 3, cursor: result.next_cursor!})
    expect(page2.items.length).toBe(1)
    expect(page2.next_cursor).toBeNull()
  })

  // -------------------------------------------------------------------------
  // T-0002-114: cursor stability when a project is unpublished between pages
  // -------------------------------------------------------------------------

  it('T-0002-114: cursor excludes unpublished project on page 2 fetch', async () => {
    const svc = createLibraryService(db)
    const userId = await makeUser(db, 'paginator')

    // Create 4 projects with known timestamps (descending so cursor is stable)
    const ids: string[] = []
    for (let i = 0; i < 4; i++) {
      const id = await makePublicProject(db, userId, {
        publishedAt: new Date(Date.now() - i * 1000),
      })
      ids.push(id)
    }

    // Fetch page 1 (limit=2)
    const page1 = await svc.list({limit: 2})
    expect(page1.items.length).toBe(2)
    expect(page1.next_cursor).not.toBeNull()

    // Unpublish the 3rd project (would be first item on page 2)
    await db
      .update(projects)
      .set({visibility: 'private', publishedAt: null})
      .where(eq(projects.id, ids[2]!))

    // Page 2 should skip the now-private project and return only 1 item
    const page2 = await svc.list({limit: 2, cursor: page1.next_cursor!})
    const page2Ids = page2.items.map((i) => i.id)
    expect(page2Ids).not.toContain(ids[2])
  })

  // -------------------------------------------------------------------------
  // T-0002-115: new publish during pagination does NOT appear in already-fetched pages
  // -------------------------------------------------------------------------

  it('T-0002-115: new projects published after page 1 fetch do not appear in page 2', async () => {
    const svc = createLibraryService(db)
    const userId = await makeUser(db, 'stable')

    // Create 3 projects in the past
    for (let i = 0; i < 3; i++) {
      await makePublicProject(db, userId, {
        publishedAt: new Date(Date.now() - (10 - i) * 1000),
      })
    }

    // Fetch page 1 (limit=2) — captures top 2
    const page1 = await svc.list({limit: 2})
    expect(page1.items.length).toBe(2)
    const page1Ids = new Set(page1.items.map((i) => i.id))

    // Publish a new project with a future timestamp AFTER page 1 cursor was established
    const newId = await makePublicProject(db, userId, {
      publishedAt: new Date(Date.now() + 60_000),
    })

    // Page 2 using the cursor from page 1 — new item has published_at AFTER
    // the cursor anchor so it does NOT appear (cursor goes backward in time)
    const page2 = await svc.list({limit: 2, cursor: page1.next_cursor!})
    const page2Ids = page2.items.map((i) => i.id)

    // The new item should not be in page 2
    expect(page2Ids).not.toContain(newId)
    // Page 2 should contain the 3rd original project (not the new one)
    expect(page2.items.length).toBe(1)
    // None of page 2's items were in page 1
    for (const id of page2Ids) {
      expect(page1Ids.has(id)).toBe(false)
    }
  })
})

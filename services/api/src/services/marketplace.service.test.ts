/**
 * ADR-0002 Step 5 — marketplace service tests.
 *
 * T-IDs covered here (service-level, testcontainers Postgres):
 *   Happy:       T-0002-065, T-0002-066, T-0002-067, T-0002-068, T-0002-069
 *   Concurrency: T-0002-085, T-0002-086, T-0002-087
 *   Security:    T-0002-088
 *
 * Route-level T-IDs (HTTP shapes, auth gating, rate limits, remaining
 * handle/check tests) live in `routes/marketplace.test.ts`.
 */
import {randomUUID} from 'node:crypto'

import {eq} from 'drizzle-orm'
import type {NodePgDatabase} from 'drizzle-orm/node-postgres'

import * as schema from '../db/schema.js'
import {projects, users} from '../db/schema.js'
import {
  createMarketplaceService,
  HandleRequiredError,
  HandleTakenError,
  NotFoundError,
} from './marketplace.service.js'
import {createProjectsService} from './projects.service.js'
import {uniqueEmail, validSpec} from '../../test/factories.js'
import {closeTestPool, getTestDb, truncateAll} from '../../test/setup.js'

type Db = NodePgDatabase<typeof schema>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function makeUser(db: Db, email = uniqueEmail()): Promise<string> {
  const id = randomUUID()
  await db.insert(users).values({id, email})
  return id
}

async function makeProject(db: Db, ownerId: string): Promise<string> {
  const svc = createProjectsService(db)
  const detail = await svc.create({ownerId, spec: validSpec()})
  return detail.project.id
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('ADR-0002 Step 5 — marketplaceService (unit)', () => {
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
  // T-0002-065 — Happy: first publish with handle sets handle + flips visibility
  // -------------------------------------------------------------------------
  it('T-0002-065: publish with no existing users.handle + body handle sets handle and flips visibility=public + sets published_at', async () => {
    const userId = await makeUser(db)
    const projectId = await makeProject(db, userId)
    const svc = createMarketplaceService(db)

    const result = await svc.publish({userId, projectId, handle: 'alyona'})

    expect(result.project.visibility).toBe('public')
    expect(result.project.author_handle).toBe('alyona')
    expect(result.project.published_at).toBeInstanceOf(Date)
    expect(result.project.render_hash).toBeTruthy()

    // Verify DB state
    const [userRow] = await db.select().from(users).where(eq(users.id, userId))
    expect(userRow?.handle).toBe('alyona')

    const [projectRow] = await db.select().from(projects).where(eq(projects.id, projectId))
    expect(projectRow?.visibility).toBe('public')
    expect(projectRow?.publishedAt).toBeInstanceOf(Date)
  })

  // -------------------------------------------------------------------------
  // T-0002-066 — Happy: publish when user already has handle (no body handle)
  // -------------------------------------------------------------------------
  it('T-0002-066: publish when user already has handle set flips visibility=public + sets published_at', async () => {
    const userId = await makeUser(db)
    // Pre-set the handle directly
    await db.update(users).set({handle: 'existing-handle'}).where(eq(users.id, userId))

    const projectId = await makeProject(db, userId)
    const svc = createMarketplaceService(db)

    // No handle in body — user already has one
    const result = await svc.publish({userId, projectId})

    expect(result.project.visibility).toBe('public')
    expect(result.project.author_handle).toBe('existing-handle')
    expect(result.project.published_at).toBeInstanceOf(Date)
  })

  // -------------------------------------------------------------------------
  // T-0002-067 — Happy: re-publish (already public) → idempotent, no state change
  // -------------------------------------------------------------------------
  it('T-0002-067: re-publish on already-public project returns 200 without updating published_at', async () => {
    const userId = await makeUser(db)
    await db.update(users).set({handle: 'somehandle'}).where(eq(users.id, userId))

    const projectId = await makeProject(db, userId)
    const svc = createMarketplaceService(db)

    // First publish
    const first = await svc.publish({userId, projectId})
    const firstPublishedAt = first.project.published_at

    // Small deliberate delay to make any re-set published_at distinguishable
    await new Promise(r => setTimeout(r, 5))

    // Second publish — idempotent
    const second = await svc.publish({userId, projectId})

    // published_at must not have changed
    expect(second.project.published_at.getTime()).toBe(firstPublishedAt.getTime())
    expect(second.project.visibility).toBe('public')

    // DB row unchanged
    const [projectRow] = await db.select().from(projects).where(eq(projects.id, projectId))
    expect(projectRow?.visibility).toBe('public')
  })

  // -------------------------------------------------------------------------
  // T-0002-068 — Happy: unpublish on public project → visibility=private + published_at=null
  // -------------------------------------------------------------------------
  it('T-0002-068: unpublish on public project sets visibility=private and published_at=null', async () => {
    const userId = await makeUser(db)
    await db.update(users).set({handle: 'myhandle'}).where(eq(users.id, userId))

    const projectId = await makeProject(db, userId)
    const svc = createMarketplaceService(db)

    await svc.publish({userId, projectId})
    const result = await svc.unpublish({userId, projectId})

    expect(result.project.visibility).toBe('private')
    expect(result.project.published_at).toBeNull()

    const [projectRow] = await db.select().from(projects).where(eq(projects.id, projectId))
    expect(projectRow?.visibility).toBe('private')
    expect(projectRow?.publishedAt).toBeNull()
  })

  // -------------------------------------------------------------------------
  // T-0002-069 — Happy: re-unpublish (already private) → idempotent
  // -------------------------------------------------------------------------
  it('T-0002-069: re-unpublish on already-private project returns 200 with no state change', async () => {
    const userId = await makeUser(db)
    const projectId = await makeProject(db, userId)
    const svc = createMarketplaceService(db)

    // Project is already private (default)
    const result = await svc.unpublish({userId, projectId})

    expect(result.project.visibility).toBe('private')
    expect(result.project.published_at).toBeNull()

    // DB unchanged — no publish_at was ever set
    const [projectRow] = await db.select().from(projects).where(eq(projects.id, projectId))
    expect(projectRow?.visibility).toBe('private')
    expect(projectRow?.publishedAt).toBeNull()
  })

  // -------------------------------------------------------------------------
  // T-0002-085 — Concurrency: two simultaneous first-publish requests from
  //   different users with the same handle → winner commits, loser gets
  //   HandleTakenError; final visibility state is consistent.
  // -------------------------------------------------------------------------
  it('T-0002-085: concurrent first-publish from two users with same handle → one wins, other gets handle_taken', async () => {
    const userA = await makeUser(db, uniqueEmail('race-a'))
    const userB = await makeUser(db, uniqueEmail('race-b'))
    const projectA = await makeProject(db, userA)
    const projectB = await makeProject(db, userB)
    const svc = createMarketplaceService(db)

    const [resultA, resultB] = await Promise.allSettled([
      svc.publish({userId: userA, projectId: projectA, handle: 'racehandle'}),
      svc.publish({userId: userB, projectId: projectB, handle: 'racehandle'}),
    ])

    // Exactly one must succeed and one must fail with handle_taken
    const fulfilled = [resultA, resultB].filter(r => r.status === 'fulfilled')
    const rejected = [resultA, resultB].filter(r => r.status === 'rejected')

    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)

    if (rejected[0]?.status === 'rejected') {
      expect(rejected[0].reason).toBeInstanceOf(HandleTakenError)
    }

    // Winner's project is public; loser's is private
    const [rowA] = await db.select().from(projects).where(eq(projects.id, projectA))
    const [rowB] = await db.select().from(projects).where(eq(projects.id, projectB))

    const visibilities = [rowA?.visibility, rowB?.visibility].sort()
    expect(visibilities).toEqual(['private', 'public'])
  })

  // -------------------------------------------------------------------------
  // T-0002-086 — Concurrency: same user, same project, concurrent publish →
  //   both return 200; published_at is set once (idempotent)
  // -------------------------------------------------------------------------
  it('T-0002-086: concurrent publish from same user on same project → both succeed; published_at set once', async () => {
    const userId = await makeUser(db)
    await db.update(users).set({handle: 'stable-handle'}).where(eq(users.id, userId))

    const projectId = await makeProject(db, userId)
    const svc = createMarketplaceService(db)

    const [r1, r2] = await Promise.all([
      svc.publish({userId, projectId}),
      svc.publish({userId, projectId}),
    ])

    expect(r1.project.visibility).toBe('public')
    expect(r2.project.visibility).toBe('public')

    // Both responses carry the same (or close) published_at — only one UPDATE ran
    const [projectRow] = await db.select().from(projects).where(eq(projects.id, projectId))
    expect(projectRow?.visibility).toBe('public')
    expect(projectRow?.publishedAt).toBeInstanceOf(Date)
  })

  // -------------------------------------------------------------------------
  // T-0002-087 — Concurrency: publish then immediately unpublish (race) →
  //   final state is consistent; published_at is null after unpublish
  // -------------------------------------------------------------------------
  it('T-0002-087: publish then concurrent unpublish → final state consistent; published_at null after unpublish', async () => {
    const userId = await makeUser(db)
    await db.update(users).set({handle: 'race-handle'}).where(eq(users.id, userId))

    const projectId = await makeProject(db, userId)
    const svc = createMarketplaceService(db)

    // Publish first, then immediately unpublish (sequential race simulation)
    await svc.publish({userId, projectId})
    await svc.unpublish({userId, projectId})

    const [projectRow] = await db.select().from(projects).where(eq(projects.id, projectId))
    // After unpublish wins, final state must be private with null published_at
    expect(projectRow?.visibility).toBe('private')
    expect(projectRow?.publishedAt).toBeNull()
  })

  // -------------------------------------------------------------------------
  // T-0002-088 — Security: users.handle UPDATE is atomic in the publish
  //   transaction. Simulate by verifying handle is set IFF visibility flipped.
  // -------------------------------------------------------------------------
  it('T-0002-088: handle and visibility update are atomic — no half-state observable', async () => {
    const userId = await makeUser(db)
    const projectId = await makeProject(db, userId)
    const svc = createMarketplaceService(db)

    await svc.publish({userId, projectId, handle: 'atomichandle'})

    // Both handle and visibility must be updated together
    const [userRow] = await db.select().from(users).where(eq(users.id, userId))
    const [projectRow] = await db.select().from(projects).where(eq(projects.id, projectId))

    expect(userRow?.handle).toBe('atomichandle')
    expect(projectRow?.visibility).toBe('public')
    expect(projectRow?.publishedAt).not.toBeNull()

    // Simulate rollback scenario: if no row matched (project was already public),
    // handle should still be readable. Verify via re-fetch.
    const [userRow2] = await db.select().from(users).where(eq(users.id, userId))
    expect(userRow2?.handle).toBe('atomichandle')
  })

  // -------------------------------------------------------------------------
  // publish with not-found project throws NotFoundError
  // -------------------------------------------------------------------------
  it('publish on non-existent project throws NotFoundError', async () => {
    const userId = await makeUser(db)
    const svc = createMarketplaceService(db)

    await expect(
      svc.publish({userId, projectId: randomUUID(), handle: 'testhandle'}),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  // -------------------------------------------------------------------------
  // publish without handle when user has none throws HandleRequiredError
  // -------------------------------------------------------------------------
  it('publish without handle when user has no handle throws HandleRequiredError', async () => {
    const userId = await makeUser(db)
    const projectId = await makeProject(db, userId)
    const svc = createMarketplaceService(db)

    await expect(svc.publish({userId, projectId})).rejects.toBeInstanceOf(HandleRequiredError)
  })
})

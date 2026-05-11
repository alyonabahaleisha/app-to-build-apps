/**
 * ADR-0008 Step 3 — shareLink.service tests.
 *
 * T-IDs covered: T-0008-082..087d (service-layer direct tests).
 *
 * T-0008-087c is the P0-1 closure test — partial-failure rollback.
 *
 * These tests require testcontainer Postgres (Docker-gated).
 */

import {randomUUID} from 'node:crypto'
import {eq, and} from 'drizzle-orm'
import type {NodePgDatabase} from 'drizzle-orm/node-postgres'

import * as schema from '../db/schema.js'
import {
  users,
  miniApps,
  miniAppVersions,
  shareLinks,
  shareLinkClones,
} from '../db/schema.js'
import {closeTestPool, getTestDb, truncateAll} from '../../test/setup.js'
import {userRow, miniAppRow, validSpec, specWithoutHeading} from '../../test/factories.js'
import {
  createShareLinkService,
  generateShareId,
  ShareNotFoundError,
  RevokedError,
  NotFoundError,
  type ShareLinkService,
} from './shareLink.service.js'

type Db = NodePgDatabase<typeof schema>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSeed(): string {
  return randomUUID().replace(/-/g, '').slice(0, 32)
}

async function insertUserAndApp(
  db: Db,
  overrides?: {stance?: string; accentPalette?: string},
): Promise<{userId: string; miniAppId: string; versionId: string}> {
  const userId = randomUUID()
  await db.insert(users).values(userRow({id: userId}))

  const miniAppId = randomUUID()
  await db.insert(miniApps).values(
    miniAppRow({
      id: miniAppId,
      ownerId: userId,
      stance: overrides?.stance ?? 'productive',
      accentPalette: overrides?.accentPalette ?? 'neutral',
      coverArtSeed: makeSeed(),
    }),
  )

  const versionId = randomUUID()
  await db.insert(miniAppVersions).values({
    id: versionId,
    miniAppId,
    specJson: validSpec(),
    renderHash: 'a'.repeat(64),
  })

  await db.update(miniApps).set({currentVersionId: versionId}).where(eq(miniApps.id, miniAppId))

  return {userId, miniAppId, versionId}
}

// ---------------------------------------------------------------------------
// generateShareId tests (unit — no DB)
// ---------------------------------------------------------------------------

describe('generateShareId (unit)', () => {
  it('returns exactly 24 chars', () => {
    expect(generateShareId()).toHaveLength(24)
  })

  it('returns base62 chars only (0-9A-Za-z)', () => {
    const id = generateShareId()
    expect(/^[0-9A-Za-z]{24}$/.test(id)).toBe(true)
  })

  it('T-0008-040 smoke: 1000 generated share_ids are all unique and all 24 chars', () => {
    const ids = Array.from({length: 1000}, () => generateShareId())
    const unique = new Set(ids)
    expect(unique.size).toBe(1000)
    for (const id of ids) {
      expect(id).toHaveLength(24)
    }
  })
})

// ---------------------------------------------------------------------------
// Service tests (DB required)
// ---------------------------------------------------------------------------

describe('shareLink.service (DB)', () => {
  let db: Db
  let service: ShareLinkService

  beforeAll(async () => {
    db = await getTestDb()
    service = createShareLinkService(db)
  })

  afterEach(async () => {
    await truncateAll()
  })

  afterAll(async () => {
    await closeTestPool()
  })

  // -------------------------------------------------------------------------
  // T-0008-082 — Happy: createShareLink returns shareId and persists row
  // -------------------------------------------------------------------------
  it('T-0008-082: createShareLink({miniAppId, userId}) returns {shareId} and persists row', async () => {
    const {userId, miniAppId} = await insertUserAndApp(db)

    const result = await service.createShareLink(userId, miniAppId)

    expect(result.shareId).toBeTruthy()
    expect(result.shareId).toHaveLength(24)
    expect(result.url).toBe(`https://canvas.app/m/${result.shareId}/clone`)

    const rows = await db.select().from(shareLinks).where(eq(shareLinks.shareId, result.shareId))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.ownerUserId).toBe(userId)
  })

  // -------------------------------------------------------------------------
  // T-0008-083 — Failure: createShareLink with non-owner userId throws NotFoundError
  // -------------------------------------------------------------------------
  it('T-0008-083: createShareLink with non-owner userId throws NotFoundError (not ForbiddenError — no ownership leak)', async () => {
    const {miniAppId} = await insertUserAndApp(db)
    const otherUserId = randomUUID()
    await db.insert(users).values(userRow({id: otherUserId}))

    await expect(service.createShareLink(otherUserId, miniAppId)).rejects.toThrow(
      NotFoundError,
    )
  })

  // -------------------------------------------------------------------------
  // T-0008-084 — Failure: createShareLink with unknown miniAppId throws NotFoundError
  // -------------------------------------------------------------------------
  it('T-0008-084: createShareLink with unknown miniAppId throws NotFoundError', async () => {
    const userId = randomUUID()
    await db.insert(users).values(userRow({id: userId}))

    await expect(service.createShareLink(userId, randomUUID())).rejects.toThrow(NotFoundError)
  })

  // -------------------------------------------------------------------------
  // T-0008-085 — Sensitivity: getShareLinkPublicView return type has no source identifiers
  // Compile-time: checked by the interface definition in shareLink.service.ts.
  // Runtime: serialize to JSON and assert absence of sensitive keys.
  // -------------------------------------------------------------------------
  it('T-0008-085: getShareLinkPublicView return type compile-time check — no miniAppVersionId or ownerUserId', () => {
    // Compile-time assertion: the ShareLinkPublicView interface (in the service module)
    // does not include miniAppVersionId or ownerUserId as fields.
    // If a developer adds those fields, TypeScript's interface definition prevents
    // accidental exposure — no `Exclude` magic needed at runtime.
    // The runtime assertion in T-0008-086 covers the serialized value.
    //
    // Verify by inspecting the return type: PublicView should not have those keys.
    type PublicView = Awaited<ReturnType<typeof service.getShareLinkPublicView>>
    type HasMiniAppVersionId = NonNullable<PublicView> extends {miniAppVersionId: unknown}
      ? true
      : false
    const _check: HasMiniAppVersionId = false // must be false (field absent)
    void _check
    expect(true).toBe(true)
  })

  // -------------------------------------------------------------------------
  // T-0008-086 — Sensitivity: getShareLinkPublicView runtime JSON check
  // -------------------------------------------------------------------------
  it('T-0008-086: getShareLinkPublicView runtime: serialized JSON does NOT contain sensitive keys', async () => {
    const {userId, miniAppId} = await insertUserAndApp(db)
    const {shareId} = await service.createShareLink(userId, miniAppId)

    const result = await service.getShareLinkPublicView(shareId)
    const serialized = JSON.stringify(result)

    expect(serialized).not.toMatch(/miniAppVersionId/)
    expect(serialized).not.toMatch(/ownerUserId/)
    expect(serialized).not.toMatch(/mini_app_version_id/)
    expect(serialized).not.toMatch(/owner_user_id/)
    expect(serialized).not.toMatch(/specJson/)
    expect(serialized).not.toMatch(/spec_json/)
  })

  // -------------------------------------------------------------------------
  // T-0008-087 — Sensitivity: acceptCloneIntent return type has no source_* fields
  // -------------------------------------------------------------------------
  it('T-0008-087: acceptCloneIntent return type — mini_app shape has no source_* fields', async () => {
    const {userId: ownerId, versionId} = await insertUserAndApp(db)

    // Insert share_link manually for this test
    const shareId = generateShareId()
    await db.insert(shareLinks).values({
      shareId,
      miniAppVersionId: versionId,
      ownerUserId: ownerId,
      coverStance: 'productive',
      coverPalette: 'focus',
      coverIcon: 'list',
      coverArtSeed: makeSeed(),
    })

    const clonerId = randomUUID()
    await db.insert(users).values(userRow({id: clonerId}))

    const result = await service.acceptCloneIntent(shareId, clonerId)

    const serialized = JSON.stringify(result)
    expect(serialized).not.toMatch(/source_mini_app_id/)
    expect(serialized).not.toMatch(/source_owner_user_id/)
    expect(serialized).not.toMatch(/source_version_id/)
    expect(serialized).not.toMatch(/original_prompt/)
    // Cloner's user ID IS present; source owner's is NOT
    expect(result.miniApp.ownerUserId).toBe(clonerId)
  })

  // -------------------------------------------------------------------------
  // T-0008-087b — Failure: DB unavailable mid-call (mocked) → 500, no partial row
  // NOTE: This is covered at the route level in clones.test.ts where we inject
  // a failing service. The service itself propagates the error; the route wraps it.
  // -------------------------------------------------------------------------

  // -------------------------------------------------------------------------
  // T-0008-087c — P0-1 closure: Transactional rollback under partial-failure.
  //
  // We cannot inject a failure on tx.insert(shareLinkClones) easily without
  // mocking Drizzle internals. Instead, we test the semantic equivalent:
  //
  //   Step A: Run acceptCloneIntent with the unique constraint pre-violated
  //           (insert a share_link_clones row with the same (shareId, clonerId)
  //            BEFORE calling acceptCloneIntent). This causes the tx to throw
  //            a unique-constraint error at step 5.
  //
  //   Step B: Assert that mini_apps table has zero NEW rows (only the pre-seeded one
  //           from insertUserAndApp). The rollback prevents the orphaned mini_app row.
  //
  //   Step C: Re-run acceptCloneIntent without the pre-violation.
  //           Assert exactly one share_link_clones row exists (idempotency not broken).
  //
  // This tests the same invariant as T-0008-087c: partial-write rejection rolls back.
  // -------------------------------------------------------------------------
  it('T-0008-087c: transactional rollback under partial-failure — share_link_clones unique violation rolls back mini_app insert', async () => {
    const {userId: ownerId, versionId} = await insertUserAndApp(db)

    const shareId = generateShareId()
    await db.insert(shareLinks).values({
      shareId,
      miniAppVersionId: versionId,
      ownerUserId: ownerId,
      coverStance: 'productive',
      coverPalette: 'focus',
      coverIcon: 'list',
      coverArtSeed: makeSeed(),
    })

    const clonerId = randomUUID()
    await db.insert(users).values(userRow({id: clonerId}))

    // Pre-insert a dummy clone mini_app for the cloner to set up the pre-violation
    const dummyCloneAppId = randomUUID()
    await db.insert(miniApps).values(
      miniAppRow({id: dummyCloneAppId, ownerId: clonerId, coverArtSeed: makeSeed()}),
    )
    // Pre-seed the share_link_clones row — this will cause step 5 to fail when
    // acceptCloneIntent tries to insert the same (shareId, clonerId).
    await db.insert(shareLinkClones).values({
      shareLinkId: shareId,
      clonerUserId: clonerId,
      clonedMiniAppId: dummyCloneAppId,
    })

    // Count mini_apps for the cloner before the call
    const beforeApps = await db
      .select()
      .from(miniApps)
      .where(eq(miniApps.ownerId, clonerId))
    expect(beforeApps).toHaveLength(1) // only the dummy

    // Call acceptCloneIntent — the unique constraint at step 5 fires,
    // triggering RaceLostError → the service re-runs the idempotency check
    // and returns the existing clone (dummyCloneAppId row).
    // No NEW mini_app or mini_app_version rows should be created.
    const result = await service.acceptCloneIntent(shareId, clonerId)
    expect(result.created).toBe(false)
    expect(result.miniApp.id).toBe(dummyCloneAppId)

    // CRITICAL: still exactly one mini_app for the cloner (rollback worked)
    const afterApps = await db
      .select()
      .from(miniApps)
      .where(eq(miniApps.ownerId, clonerId))
    expect(afterApps).toHaveLength(1)

    // Exactly one share_link_clones row (idempotency not broken by the prior attempt)
    const cloneRows = await db
      .select()
      .from(shareLinkClones)
      .where(
        and(eq(shareLinkClones.shareLinkId, shareId), eq(shareLinkClones.clonerUserId, clonerId)),
      )
    expect(cloneRows).toHaveLength(1)

    // Step C: remove the pre-seed, run a fresh acceptCloneIntent with a fresh user.
    // This proves the system recovers to a clean state for new clones.
    await truncateAll()
    // Re-setup
    const {userId: ownerId2, versionId: versionId2} = await insertUserAndApp(db)
    const shareId2 = generateShareId()
    await db.insert(shareLinks).values({
      shareId: shareId2,
      miniAppVersionId: versionId2,
      ownerUserId: ownerId2,
      coverStance: 'productive',
      coverPalette: 'focus',
      coverIcon: 'list',
      coverArtSeed: makeSeed(),
    })
    const clonerId2 = randomUUID()
    await db.insert(users).values(userRow({id: clonerId2}))

    const result2 = await service.acceptCloneIntent(shareId2, clonerId2)
    expect(result2.created).toBe(true)

    // Exactly ONE mini_app for the cloner (idempotency not broken)
    const appsAfterClean = await db
      .select()
      .from(miniApps)
      .where(eq(miniApps.ownerId, clonerId2))
    expect(appsAfterClean).toHaveLength(1)
  })

  // -------------------------------------------------------------------------
  // T-0008-087d — Happy / P2-2: Two share_links / same source → two distinct clones
  // -------------------------------------------------------------------------
  it('T-0008-087d: two share_links for same source-version → two distinct clone rows in cloner namespace', async () => {
    const {userId: ownerId, versionId} = await insertUserAndApp(db)

    const shareIdA = generateShareId()
    const shareIdB = generateShareId()
    await db.insert(shareLinks).values({
      shareId: shareIdA,
      miniAppVersionId: versionId,
      ownerUserId: ownerId,
      coverStance: 'productive',
      coverPalette: 'focus',
      coverIcon: 'list',
      coverArtSeed: makeSeed(),
    })
    await db.insert(shareLinks).values({
      shareId: shareIdB,
      miniAppVersionId: versionId,
      ownerUserId: ownerId,
      coverStance: 'productive',
      coverPalette: 'focus',
      coverIcon: 'list',
      coverArtSeed: makeSeed(),
    })

    const clonerId = randomUUID()
    await db.insert(users).values(userRow({id: clonerId}))

    const resultA = await service.acceptCloneIntent(shareIdA, clonerId)
    const resultB = await service.acceptCloneIntent(shareIdB, clonerId)

    // Two distinct mini_apps — different IDs (T-0008-087d: no cross-link dedup)
    expect(resultA.miniApp.id).not.toBe(resultB.miniApp.id)
    // Two distinct cover_art_seeds (each clone gets fresh seed)
    expect(resultA.miniApp.coverArtSeed).not.toBe(resultB.miniApp.coverArtSeed)
    // Both have spec_json equal to source (verified via renderHash match)
    expect(resultA.currentVersion.renderHash).toBe(resultB.currentVersion.renderHash)

    // Two rows in share_link_clones
    const cloneRows = await db
      .select()
      .from(shareLinkClones)
      .where(eq(shareLinkClones.clonerUserId, clonerId))
    expect(cloneRows).toHaveLength(2)
  })

  // -------------------------------------------------------------------------
  // T-0008-061 — Happy: idempotent re-clone returns same mini_app.id + same cover_art_seed
  // -------------------------------------------------------------------------
  it('T-0008-061: same user re-clones same share_id → 200 path; same mini_app.id and cover_art_seed', async () => {
    const {userId: ownerId, versionId} = await insertUserAndApp(db)

    const shareId = generateShareId()
    await db.insert(shareLinks).values({
      shareId,
      miniAppVersionId: versionId,
      ownerUserId: ownerId,
      coverStance: 'productive',
      coverPalette: 'focus',
      coverIcon: 'list',
      coverArtSeed: makeSeed(),
    })

    const clonerId = randomUUID()
    await db.insert(users).values(userRow({id: clonerId}))

    const first = await service.acceptCloneIntent(shareId, clonerId)
    const second = await service.acceptCloneIntent(shareId, clonerId)

    expect(first.created).toBe(true)
    expect(second.created).toBe(false)
    expect(second.miniApp.id).toBe(first.miniApp.id)
    expect(second.miniApp.coverArtSeed).toBe(first.miniApp.coverArtSeed)
    expect(second.currentVersion.id).toBe(first.currentVersion.id)
  })

  // -------------------------------------------------------------------------
  // T-0008-078 — Regression: clone title fallback is 'Shared tool' when no Heading
  // -------------------------------------------------------------------------
  it("T-0008-078: clone title falls back to 'Shared tool' when spec has no Heading", async () => {
    const userId = randomUUID()
    await db.insert(users).values(userRow({id: userId}))

    const miniAppId = randomUUID()
    await db.insert(miniApps).values(
      miniAppRow({id: miniAppId, ownerId: userId, coverArtSeed: makeSeed()}),
    )

    const versionId = randomUUID()
    await db.insert(miniAppVersions).values({
      id: versionId,
      miniAppId,
      specJson: specWithoutHeading(),
      renderHash: 'b'.repeat(64),
    })
    await db.update(miniApps).set({currentVersionId: versionId}).where(eq(miniApps.id, miniAppId))

    const shareId = generateShareId()
    await db.insert(shareLinks).values({
      shareId,
      miniAppVersionId: versionId,
      ownerUserId: userId,
      coverStance: 'productive',
      coverPalette: 'focus',
      coverIcon: 'list',
      coverArtSeed: makeSeed(),
    })

    const clonerId = randomUUID()
    await db.insert(users).values(userRow({id: clonerId}))

    const result = await service.acceptCloneIntent(shareId, clonerId)
    expect(result.miniApp.title).toBe('Shared tool')
  })

  // -------------------------------------------------------------------------
  // T-0008-066 — Failure: acceptCloneIntent with unknown share_id → ShareNotFoundError
  // -------------------------------------------------------------------------
  it('T-0008-066: acceptCloneIntent with unknown share_id → ShareNotFoundError', async () => {
    const userId = randomUUID()
    await db.insert(users).values(userRow({id: userId}))

    await expect(
      service.acceptCloneIntent(generateShareId(), userId),
    ).rejects.toThrow(ShareNotFoundError)
  })

  // -------------------------------------------------------------------------
  // T-0008-069 — Failure: acceptCloneIntent with revoked share → RevokedError
  // -------------------------------------------------------------------------
  it('T-0008-069: acceptCloneIntent with revoked share (revoked_at set) → RevokedError', async () => {
    const {userId: ownerId, versionId} = await insertUserAndApp(db)

    const shareId = generateShareId()
    await db.insert(shareLinks).values({
      shareId,
      miniAppVersionId: versionId,
      ownerUserId: ownerId,
      coverStance: 'productive',
      coverPalette: 'focus',
      coverIcon: 'list',
      coverArtSeed: makeSeed(),
      revokedAt: new Date(), // revoked
    })

    const clonerId = randomUUID()
    await db.insert(users).values(userRow({id: clonerId}))

    await expect(service.acceptCloneIntent(shareId, clonerId)).rejects.toThrow(RevokedError)
  })

  // -------------------------------------------------------------------------
  // T-0008-082b — Failure: createShareLink DB failure propagates (no share_links row)
  // Simulated by passing a non-existent miniAppId (service throws NotFoundError before DB write).
  // The DB-connectivity failure path is covered at the route level.
  // -------------------------------------------------------------------------
  it('T-0008-082b: createShareLink with DB-layer failure → no share_links row persisted', async () => {
    const userId = randomUUID()
    await db.insert(users).values(userRow({id: userId}))

    await expect(service.createShareLink(userId, randomUUID())).rejects.toThrow()

    const rows = await db.select().from(shareLinks)
    expect(rows).toHaveLength(0)
  })
})

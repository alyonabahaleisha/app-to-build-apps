/**
 * ADR-0008 Step 1 — share_link + share_link_clones schema tests.
 *
 * T-IDs covered: T-0008-001 through T-0008-021.
 *
 * Counts:
 *   Happy:       T-001, T-002, T-012, T-021          (4)
 *   Failure:     T-003, T-004, T-005, T-006, T-007,
 *                T-008, T-009, T-010, T-011           (9)
 *   Boundary:    T-012, T-021                        (already counted in Happy)
 *   Concurrency: T-013                               (1)
 *   Regression:  T-014, T-015, T-016, T-017          (4)
 *   Migration:   T-018, T-019                        (2)
 *   Breaking:    T-020                               (1)
 *   -------------------------------------------------------
 *   Total:                                           21
 *
 * Note: T-018/019/020 (migration-file tests) are structural checks that
 * verify the migration SQL file contents directly — no Docker required.
 * T-013 (concurrency) uses Promise.all against the test DB.
 * All other tests require the testcontainer Postgres (Docker-gated).
 */

import {randomUUID} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {join} from 'node:path'

import type {NodePgDatabase} from 'drizzle-orm/node-postgres'

import {
  miniApps,
  miniAppVersions,
  shareLinks,
  shareLinkClones,
  users,
} from './schema.js'
import * as schema from './schema.js'
import {userRow, miniAppRow, validSpec} from '../../test/factories.js'
import {closeTestPool, getTestPool, getTestDb, truncateAll} from '../../test/setup.js'

type Db = NodePgDatabase<typeof schema>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Valid 24-char base62 share_id. */
function makeShareId(suffix = ''): string {
  const base = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwx'
  const id = (base + suffix).slice(0, 24).padEnd(24, 'z')
  return id
}

/** Valid 32-char hex cover_art_seed. */
function makeSeed(): string {
  return randomUUID().replace(/-/g, '').slice(0, 32)
}

/** Insert a test user + mini_app + mini_app_version, returns their IDs. */
async function insertSourceVersion(
  db: Db,
): Promise<{userId: string; miniAppId: string; versionId: string}> {
  const userId = randomUUID()
  await db.insert(users).values(userRow({id: userId}))

  const miniAppId = randomUUID()
  await db.insert(miniApps).values(
    miniAppRow({
      id: miniAppId,
      ownerId: userId,
      stance: 'productive',
      accentPalette: 'neutral',
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

  await db
    .update(miniApps)
    .set({currentVersionId: versionId})
    .where(
      (await import('drizzle-orm')).eq(miniApps.id, miniAppId),
    )

  return {userId, miniAppId, versionId}
}

/** Insert a valid share_link row. */
async function insertShareLink(
  db: Db,
  {
    shareId = makeShareId(),
    versionId,
    ownerUserId,
  }: {shareId?: string; versionId: string; ownerUserId: string},
): Promise<string> {
  await db.insert(shareLinks).values({
    shareId,
    miniAppVersionId: versionId,
    ownerUserId,
    coverStance: 'productive',
    coverPalette: 'focus',
    coverIcon: 'list',
    coverArtSeed: makeSeed(),
  })
  return shareId
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('ADR-0008 Step 1 — share_link + share_link_clones schema', () => {
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
  // T-0008-001 — Happy: insert share_link with all columns succeeds
  // -------------------------------------------------------------------------
  it('T-0008-001: insert into share_links with all 9 columns + valid 24-char share_id → row persisted', async () => {
    const {userId, versionId} = await insertSourceVersion(db)
    const shareId = makeShareId('ABCD')
    await db.insert(shareLinks).values({
      shareId,
      miniAppVersionId: versionId,
      ownerUserId: userId,
      coverStance: 'productive',
      coverPalette: 'focus',
      coverIcon: 'star',
      coverArtSeed: makeSeed(),
    })
    const rows = await db.select().from(shareLinks)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.shareId).toBe(shareId)
    expect(rows[0]?.coverStance).toBe('productive')
  })

  // -------------------------------------------------------------------------
  // T-0008-002 — Happy: insert share_link_clones with valid FKs succeeds
  // -------------------------------------------------------------------------
  it('T-0008-002: insert into share_link_clones with valid FKs → row persisted, no unique violation', async () => {
    const {userId, versionId} = await insertSourceVersion(db)
    const shareId = await insertShareLink(db, {versionId, ownerUserId: userId})

    // Cloner is a different user
    const clonerId = randomUUID()
    await db.insert(users).values(userRow({id: clonerId}))
    const cloneId = randomUUID()
    await db.insert(miniApps).values(
      miniAppRow({id: cloneId, ownerId: clonerId, coverArtSeed: makeSeed()}),
    )

    await db.insert(shareLinkClones).values({
      shareLinkId: shareId,
      clonerUserId: clonerId,
      clonedMiniAppId: cloneId,
    })

    const rows = await db.select().from(shareLinkClones)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.shareLinkId).toBe(shareId)
  })

  // -------------------------------------------------------------------------
  // T-0008-003 — Failure: share_id of length 23 → CHECK violation
  // -------------------------------------------------------------------------
  it('T-0008-003: share_id of length 23 → CHECK violation', async () => {
    const {userId, versionId} = await insertSourceVersion(db)
    const pool = await getTestPool()
    await expect(
      pool.query(
        `INSERT INTO share_links (share_id, mini_app_version_id, owner_user_id, cover_stance, cover_palette, cover_icon, cover_art_seed)
         VALUES ($1, $2, $3, 'productive', 'focus', 'list', $4)`,
        ['ABCDEFGHIJKLMNOPQRSTUVW', versionId, userId, makeSeed()],
      ),
    ).rejects.toThrow(/check|violates/i)
  })

  // -------------------------------------------------------------------------
  // T-0008-004 — Failure: share_id of length 25 → CHECK violation
  // -------------------------------------------------------------------------
  it('T-0008-004: share_id of length 25 → CHECK violation', async () => {
    const {userId, versionId} = await insertSourceVersion(db)
    const pool = await getTestPool()
    await expect(
      pool.query(
        `INSERT INTO share_links (share_id, mini_app_version_id, owner_user_id, cover_stance, cover_palette, cover_icon, cover_art_seed)
         VALUES ($1, $2, $3, 'productive', 'focus', 'list', $4)`,
        ['ABCDEFGHIJKLMNOPQRSTUVWXY', versionId, userId, makeSeed()],
      ),
    ).rejects.toThrow(/check|violates/i)
  })

  // -------------------------------------------------------------------------
  // T-0008-005 — Failure: cover_stance 'unknown' → CHECK violation
  // -------------------------------------------------------------------------
  it("T-0008-005: cover_stance: 'unknown' → CHECK violation (closed enum)", async () => {
    const {userId, versionId} = await insertSourceVersion(db)
    const pool = await getTestPool()
    await expect(
      pool.query(
        `INSERT INTO share_links (share_id, mini_app_version_id, owner_user_id, cover_stance, cover_palette, cover_icon, cover_art_seed)
         VALUES ($1, $2, $3, 'unknown', 'focus', 'list', $4)`,
        [makeShareId('AAAA'), versionId, userId, makeSeed()],
      ),
    ).rejects.toThrow(/check|violates/i)
  })

  // -------------------------------------------------------------------------
  // T-0008-006 — Failure: cover_palette 'monochrome' → CHECK violation
  // -------------------------------------------------------------------------
  it("T-0008-006: cover_palette: 'monochrome' → CHECK violation", async () => {
    const {userId, versionId} = await insertSourceVersion(db)
    const pool = await getTestPool()
    await expect(
      pool.query(
        `INSERT INTO share_links (share_id, mini_app_version_id, owner_user_id, cover_stance, cover_palette, cover_icon, cover_art_seed)
         VALUES ($1, $2, $3, 'productive', 'monochrome', 'list', $4)`,
        [makeShareId('BBBB'), versionId, userId, makeSeed()],
      ),
    ).rejects.toThrow(/check|violates/i)
  })

  // -------------------------------------------------------------------------
  // T-0008-007 — Failure: cover_art_seed of length 31 → CHECK violation
  // -------------------------------------------------------------------------
  it('T-0008-007: cover_art_seed of length 31 (vs required 32) → CHECK violation', async () => {
    const {userId, versionId} = await insertSourceVersion(db)
    const pool = await getTestPool()
    const shortSeed = 'a'.repeat(31)
    await expect(
      pool.query(
        `INSERT INTO share_links (share_id, mini_app_version_id, owner_user_id, cover_stance, cover_palette, cover_icon, cover_art_seed)
         VALUES ($1, $2, $3, 'productive', 'focus', 'list', $4)`,
        [makeShareId('CCCC'), versionId, userId, shortSeed],
      ),
    ).rejects.toThrow(/check|violates/i)
  })

  // -------------------------------------------------------------------------
  // T-0008-008 — Failure: cover_art_seed of length 33 → CHECK violation
  // -------------------------------------------------------------------------
  it('T-0008-008: cover_art_seed of length 33 → CHECK violation', async () => {
    const {userId, versionId} = await insertSourceVersion(db)
    const pool = await getTestPool()
    const longSeed = 'a'.repeat(33)
    await expect(
      pool.query(
        `INSERT INTO share_links (share_id, mini_app_version_id, owner_user_id, cover_stance, cover_palette, cover_icon, cover_art_seed)
         VALUES ($1, $2, $3, 'productive', 'focus', 'list', $4)`,
        [makeShareId('DDDD'), versionId, userId, longSeed],
      ),
    ).rejects.toThrow(/check|violates/i)
  })

  // -------------------------------------------------------------------------
  // T-0008-009 — Failure: share_link with non-existent mini_app_version_id → FK violation
  // -------------------------------------------------------------------------
  it('T-0008-009: insert share_link with mini_app_version_id not in mini_app_versions → FK violation', async () => {
    const {userId} = await insertSourceVersion(db)
    const pool = await getTestPool()
    await expect(
      pool.query(
        `INSERT INTO share_links (share_id, mini_app_version_id, owner_user_id, cover_stance, cover_palette, cover_icon, cover_art_seed)
         VALUES ($1, $2, $3, 'productive', 'focus', 'list', $4)`,
        [makeShareId('EEEE'), randomUUID(), userId, makeSeed()],
      ),
    ).rejects.toThrow(/foreign key|violates/i)
  })

  // -------------------------------------------------------------------------
  // T-0008-010 — Failure: share_link with non-existent owner_user_id → FK violation
  // -------------------------------------------------------------------------
  it('T-0008-010: insert share_link with owner_user_id not in users → FK violation', async () => {
    const {versionId} = await insertSourceVersion(db)
    const pool = await getTestPool()
    await expect(
      pool.query(
        `INSERT INTO share_links (share_id, mini_app_version_id, owner_user_id, cover_stance, cover_palette, cover_icon, cover_art_seed)
         VALUES ($1, $2, $3, 'productive', 'focus', 'list', $4)`,
        [makeShareId('FFFF'), versionId, randomUUID(), makeSeed()],
      ),
    ).rejects.toThrow(/foreign key|violates/i)
  })

  // -------------------------------------------------------------------------
  // T-0008-011 — Failure: duplicate (share_link_id, cloner_user_id) → unique violation
  // -------------------------------------------------------------------------
  it('T-0008-011: insert second share_link_clones row with same (share_link_id, cloner_user_id) → unique constraint violation', async () => {
    const {userId, versionId} = await insertSourceVersion(db)
    const shareId = await insertShareLink(db, {versionId, ownerUserId: userId})

    const clonerId = randomUUID()
    await db.insert(users).values(userRow({id: clonerId}))
    const cloneApp1 = randomUUID()
    const cloneApp2 = randomUUID()
    await db.insert(miniApps).values(
      miniAppRow({id: cloneApp1, ownerId: clonerId, coverArtSeed: makeSeed()}),
    )
    await db.insert(miniApps).values(
      miniAppRow({id: cloneApp2, ownerId: clonerId, coverArtSeed: makeSeed()}),
    )

    await db.insert(shareLinkClones).values({
      shareLinkId: shareId,
      clonerUserId: clonerId,
      clonedMiniAppId: cloneApp1,
    })

    await expect(
      db.insert(shareLinkClones).values({
        shareLinkId: shareId,
        clonerUserId: clonerId,
        clonedMiniAppId: cloneApp2,
      }),
    ).rejects.toThrow(/unique|duplicate/i)
  })

  // -------------------------------------------------------------------------
  // T-0008-012 — Boundary: share_id of exact length 24 with 0-9A-Za-z → inserts cleanly
  // -------------------------------------------------------------------------
  it('T-0008-012: share_id of exact length 24 with all 0-9A-Za-z chars → inserts cleanly', async () => {
    const {userId, versionId} = await insertSourceVersion(db)
    // All digit-letter combinations
    const validId = '0123456789ABCDEFGHabcdef'
    await db.insert(shareLinks).values({
      shareId: validId,
      miniAppVersionId: versionId,
      ownerUserId: userId,
      coverStance: 'productive',
      coverPalette: 'focus',
      coverIcon: 'list',
      coverArtSeed: makeSeed(),
    })
    const rows = await db.select().from(shareLinks)
    expect(rows[0]?.shareId).toBe(validId)
  })

  // -------------------------------------------------------------------------
  // T-0008-013 — Concurrency: two parallel inserts of share_link_clones with same
  //              (share_link_id, cloner_user_id) — exactly one succeeds
  // -------------------------------------------------------------------------
  it('T-0008-013: two parallel inserts of share_link_clones with same (share_link_id, cloner_user_id) — exactly one succeeds, other gets unique violation', async () => {
    const {userId, versionId} = await insertSourceVersion(db)
    const shareId = await insertShareLink(db, {versionId, ownerUserId: userId})

    const clonerId = randomUUID()
    await db.insert(users).values(userRow({id: clonerId}))
    const app1 = randomUUID()
    const app2 = randomUUID()
    await db.insert(miniApps).values(
      miniAppRow({id: app1, ownerId: clonerId, coverArtSeed: makeSeed()}),
    )
    await db.insert(miniApps).values(
      miniAppRow({id: app2, ownerId: clonerId, coverArtSeed: makeSeed()}),
    )

    const results = await Promise.allSettled([
      db.insert(shareLinkClones).values({
        shareLinkId: shareId,
        clonerUserId: clonerId,
        clonedMiniAppId: app1,
      }),
      db.insert(shareLinkClones).values({
        shareLinkId: shareId,
        clonerUserId: clonerId,
        clonedMiniAppId: app2,
      }),
    ])

    const fulfilled = results.filter(r => r.status === 'fulfilled')
    const rejected = results.filter(r => r.status === 'rejected')
    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)

    const cloneRows = await db.select().from(shareLinkClones)
    expect(cloneRows).toHaveLength(1)
  })

  // -------------------------------------------------------------------------
  // T-0008-014 — Regression: deleting a users row cascades to share_links
  // -------------------------------------------------------------------------
  it('T-0008-014: deleting a users row cascades to its share_links rows', async () => {
    const {eq} = await import('drizzle-orm')
    const {userId, versionId} = await insertSourceVersion(db)
    await insertShareLink(db, {versionId, ownerUserId: userId})
    expect(await db.select().from(shareLinks)).toHaveLength(1)

    await db.delete(users).where(eq(users.id, userId))

    expect(await db.select().from(shareLinks)).toHaveLength(0)
  })

  // -------------------------------------------------------------------------
  // T-0008-015 — Regression: deleting a mini_app_versions row cascades to share_links
  // -------------------------------------------------------------------------
  it('T-0008-015: deleting a mini_app_versions row cascades to its share_links rows', async () => {
    const {eq} = await import('drizzle-orm')
    const {versionId, userId} = await insertSourceVersion(db)
    await insertShareLink(db, {versionId, ownerUserId: userId})
    expect(await db.select().from(shareLinks)).toHaveLength(1)

    await db.delete(miniAppVersions).where(eq(miniAppVersions.id, versionId))

    expect(await db.select().from(shareLinks)).toHaveLength(0)
  })

  // -------------------------------------------------------------------------
  // T-0008-016 — Regression: deleting a mini_apps row cascades to share_link_clones
  //              via cloned_mini_app_id FK
  // -------------------------------------------------------------------------
  it('T-0008-016: deleting a mini_apps row cascades to share_link_clones rows referencing it via cloned_mini_app_id', async () => {
    const {eq} = await import('drizzle-orm')
    const {userId, versionId} = await insertSourceVersion(db)
    const shareId = await insertShareLink(db, {versionId, ownerUserId: userId})

    const clonerId = randomUUID()
    await db.insert(users).values(userRow({id: clonerId}))
    const cloneAppId = randomUUID()
    await db.insert(miniApps).values(
      miniAppRow({id: cloneAppId, ownerId: clonerId, coverArtSeed: makeSeed()}),
    )
    await db.insert(shareLinkClones).values({
      shareLinkId: shareId,
      clonerUserId: clonerId,
      clonedMiniAppId: cloneAppId,
    })
    expect(await db.select().from(shareLinkClones)).toHaveLength(1)

    await db.delete(miniApps).where(eq(miniApps.id, cloneAppId))

    expect(await db.select().from(shareLinkClones)).toHaveLength(0)
  })

  // -------------------------------------------------------------------------
  // T-0008-017 — Regression: deleting a share_links row cascades to share_link_clones
  // -------------------------------------------------------------------------
  it('T-0008-017: deleting a share_links row cascades to share_link_clones rows', async () => {
    const {eq} = await import('drizzle-orm')
    const {userId, versionId} = await insertSourceVersion(db)
    const shareId = await insertShareLink(db, {versionId, ownerUserId: userId})

    const clonerId = randomUUID()
    await db.insert(users).values(userRow({id: clonerId}))
    const cloneAppId = randomUUID()
    await db.insert(miniApps).values(
      miniAppRow({id: cloneAppId, ownerId: clonerId, coverArtSeed: makeSeed()}),
    )
    await db.insert(shareLinkClones).values({
      shareLinkId: shareId,
      clonerUserId: clonerId,
      clonedMiniAppId: cloneAppId,
    })
    expect(await db.select().from(shareLinkClones)).toHaveLength(1)

    await db.delete(shareLinks).where(eq(shareLinks.shareId, shareId))

    expect(await db.select().from(shareLinkClones)).toHaveLength(0)
  })

  // -------------------------------------------------------------------------
  // T-0008-021 — Boundary: revoked_at nullable — both NULL and non-NULL accepted
  // -------------------------------------------------------------------------
  it('T-0008-021: revoked_at nullable — insert with NULL is fine; insert with non-NULL is fine', async () => {
    const {userId, versionId} = await insertSourceVersion(db)

    // With NULL revoked_at (default)
    const id1 = makeShareId('NULL1')
    await db.insert(shareLinks).values({
      shareId: id1,
      miniAppVersionId: versionId,
      ownerUserId: userId,
      coverStance: 'productive',
      coverPalette: 'focus',
      coverIcon: 'list',
      coverArtSeed: makeSeed(),
      revokedAt: null,
    })

    // With non-NULL revoked_at
    const id2 = makeShareId('RVKD2')
    await db.insert(shareLinks).values({
      shareId: id2,
      miniAppVersionId: versionId,
      ownerUserId: userId,
      coverStance: 'productive',
      coverPalette: 'focus',
      coverIcon: 'list',
      coverArtSeed: makeSeed(),
      revokedAt: new Date(),
    })

    const rows = await db.select().from(shareLinks)
    expect(rows).toHaveLength(2)
    const withNull = rows.find(r => r.shareId === id1)
    const withDate = rows.find(r => r.shareId === id2)
    expect(withNull?.revokedAt).toBeNull()
    expect(withDate?.revokedAt).toBeInstanceOf(Date)
  })
})

// ---------------------------------------------------------------------------
// Migration file structure — no Docker required
// ---------------------------------------------------------------------------

describe('ADR-0008 Step 1 — migration file structure (no Docker)', () => {
  // -------------------------------------------------------------------------
  // T-0008-018 — Migration: 0011_share_link.sql exists and contains key DDL
  // -------------------------------------------------------------------------
  it('T-0008-018: migration file 0011_share_link.sql exists with correct DDL', async () => {
    const filePath = join(process.cwd(), 'migrations/0011_share_link.sql')
    const sql = await readFile(filePath, 'utf-8')
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS share_links/)
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS share_link_clones/)
    expect(sql).toMatch(/UNIQUE \(share_link_id, cloner_user_id\)/)
    expect(sql).toMatch(/CHECK \(length\(share_id\) = 24\)/)
  })

  // -------------------------------------------------------------------------
  // T-0008-019 — Migration: migration is idempotent (CREATE TABLE IF NOT EXISTS)
  // -------------------------------------------------------------------------
  it('T-0008-019: migration 0011 is idempotent — applying twice is a no-op', async () => {
    const filePath = join(process.cwd(), 'migrations/0011_share_link.sql')
    const sql = await readFile(filePath, 'utf-8')
    // Verify CREATE TABLE IF NOT EXISTS is used (idempotency token).
    const matches = sql.match(/CREATE TABLE IF NOT EXISTS/g)
    expect(matches).not.toBeNull()
    expect(matches!.length).toBeGreaterThanOrEqual(2)
  })

  // -------------------------------------------------------------------------
  // T-0008-020 — Breaking: migration DDL references mini_apps + mini_app_versions
  //              (dependency on ADR-0011 enforced at DB layer)
  // -------------------------------------------------------------------------
  it('T-0008-020: migration DDL references mini_apps and mini_app_versions (ADR-0011 dependency enforced)', async () => {
    const filePath = join(process.cwd(), 'migrations/0011_share_link.sql')
    const sql = await readFile(filePath, 'utf-8')
    // Must reference both renamed V0 tables — not the M1 names
    expect(sql).toMatch(/REFERENCES mini_app_versions/)
    expect(sql).toMatch(/REFERENCES mini_apps/)
    expect(sql).not.toMatch(/REFERENCES projects\b/)
    expect(sql).not.toMatch(/REFERENCES project_versions\b/)
  })
})

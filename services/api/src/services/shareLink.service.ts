/**
 * ShareLink service — ADR-0008 Step 3.
 *
 * Operations:
 *   - createShareLink(creatorUserId, miniAppVersionId) → {shareId, url}
 *     Verifies the user owns the mini_app_version's parent mini_app.
 *     Freezes cover-art identity at share time (ADR-0005 §K).
 *
 *   - getShareLinkInternal(shareId) → ShareLinkInternalView | null
 *     INTERNAL ONLY — includes source_version_id. Never serialized to response.
 *
 *   - getShareLinkPublicView(shareId) → ShareLinkPublicView | null
 *     Public shape — cover-art fields + mode capability flags. NEVER includes
 *     mini_app_version_id, owner_user_id, spec_json. T-0008-085, T-0008-086.
 *
 *   - acceptCloneIntent(shareId, clonerUserId) → AcceptCloneResult
 *     CRITICAL: wraps 3 inserts in db.transaction(). Pattern matches
 *     miniApps.service.ts:create() at line ~247 (T-0008-087c closure).
 *     Idempotency: ON CONFLICT DO NOTHING on share_link_clones.
 *     Race path: RaceLostError → caller re-fetches the winning clone.
 *
 * Data sensitivity (AC-P8):
 *   getShareLinkPublicView and acceptCloneIntent return types are designed
 *   so source identifiers (mini_app_version_id, owner_user_id, spec_json)
 *   cannot appear in the public response — neither at compile time nor at
 *   runtime. T-0008-085, T-0008-086, T-0008-087 pin this contract.
 *
 * Clone title fallback:
 *   Clones use 'Shared tool' when spec has no Heading — NOT the source's
 *   original_prompt (which is source-owner data per AC-P8). This explicitly
 *   overrides AC-P2 for the clone creation path (Step 3 §AC deviation).
 *   T-0008-078 pins this.
 *
 * Cover-art seed on clone:
 *   Each clone gets a FRESH 32-char hex seed. Different from source (AC-P4).
 *   Idempotent re-clone returns the SAME seed from the stored row (T-0008-061).
 */
import {randomBytes} from 'node:crypto'
import {and, eq, isNull} from 'drizzle-orm'
import type {NodePgDatabase} from 'drizzle-orm/node-postgres'

import {renderHash, type Spec} from '@app-creator/protocol'

import * as schema from '../db/schema.js'
import {
  miniApps,
  miniAppVersions,
  shareLinks,
  shareLinkClones,
  type MiniApp,
  type MiniAppVersion,
} from '../db/schema.js'

type Db = NodePgDatabase<typeof schema>

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class ShareNotFoundError extends Error {
  readonly code = 'share_not_found' as const
  constructor(shareId: string) {
    super(`Share link not found: ${shareId}`)
    this.name = 'ShareNotFoundError'
  }
}

export class RevokedError extends Error {
  readonly code = 'share_revoked' as const
  constructor(shareId: string) {
    super(`Share link revoked: ${shareId}`)
    this.name = 'RevokedError'
  }
}

export class NotFoundError extends Error {
  readonly code = 'not_found' as const
  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
  }
}

export class ForbiddenError extends Error {
  readonly code = 'forbidden' as const
  constructor(message: string) {
    super(message)
    this.name = 'ForbiddenError'
  }
}

/** Thrown when a concurrent transaction wins the unique-constraint race. */
export class RaceLostError extends Error {
  readonly code = 'race_lost' as const
  constructor() {
    super('concurrent_clone_won')
    this.name = 'RaceLostError'
  }
}

// ---------------------------------------------------------------------------
// Public types — data sensitivity enforced by omission (not by runtime filter)
// ---------------------------------------------------------------------------

/** T-0008-085: compile-time guarantee — no source identifiers in public view. */
export interface ShareLinkPublicView {
  readonly shareId: string
  readonly coverStance: string
  readonly coverPalette: string
  readonly coverIcon: string
  readonly coverArtSeed: string
  readonly revokedAt: Date | null
  // NOTE: miniAppVersionId and ownerUserId are intentionally absent.
}

/** INTERNAL ONLY — never serialized to a response. */
export interface ShareLinkInternalView {
  readonly shareId: string
  readonly sourceVersionId: string   // The frozen mini_app_version_id
  readonly ownerUserId: string       // For authorization
  readonly revokedAt: Date | null
}

/** Public shape of a cloned mini_app. T-0008-087: no source_* fields. */
export interface PublicClonedMiniApp {
  readonly id: string
  readonly title: string
  readonly ownerUserId: string       // The cloner's userId — not the source owner
  readonly coverArtSeed: string      // Fresh seed generated at clone time
  readonly stance: string
  readonly accentPalette: string
  readonly archetype: string
  readonly createdAt: Date
  // NOTE: source_mini_app_id, source_owner_user_id, source_version_id intentionally absent.
}

export interface PublicClonedVersion {
  readonly id: string
  readonly miniAppId: string
  readonly renderHash: string
  // NOTE: specJson intentionally absent from this public type (large + not needed for clone landing).
}

export interface AcceptCloneResult {
  readonly miniApp: PublicClonedMiniApp
  readonly currentVersion: PublicClonedVersion
  readonly created: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a 24-char base62 share ID. Non-enumerable, opaque, collision-resistant. */
export function generateShareId(): string {
  const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
  const BASE62_LEN = BASE62.length // 62
  let result = ''
  // Generate enough random bytes to fill 24 base62 characters via rejection sampling.
  // Each byte is valid if < floor(256/62)*62 = 248 (avoids modulo bias).
  // Worst case: ~3% rejection per byte → ~74 bytes needed in expectation for 24 chars.
  // We over-generate (128 bytes) and slice — rejection probability of needing more is ~0.
  while (result.length < 24) {
    const bytes = randomBytes(64)
    for (const byte of bytes) {
      if (result.length >= 24) break
      // Reject bytes ≥ 248 (floor(256/62)*62 = 248) to avoid modulo bias.
      if (byte < 248) {
        result += BASE62[byte % BASE62_LEN]!
      }
    }
  }
  return result
}

/** Generate a 32-char hex cover_art_seed. */
function generateCoverArtSeed(): string {
  return randomBytes(16).toString('hex')
}

/** Derive clone title from spec. T-0008-078: fallback is 'Shared tool', NOT original_prompt. */
function deriveCloneTitle(specJson: unknown): string {
  if (!specJson || typeof specJson !== 'object') return 'Shared tool'
  const spec = specJson as {screens?: unknown[]}
  if (!Array.isArray(spec.screens) || spec.screens.length === 0) return 'Shared tool'
  const firstScreen = spec.screens[0] as {root?: unknown} | undefined
  if (!firstScreen?.root) return 'Shared tool'
  const heading = findFirstHeadingText(firstScreen.root as Record<string, unknown>)
  return heading?.trim() || 'Shared tool'
}

type AnyNode = {type?: string; [key: string]: unknown}

function findFirstHeadingText(node: AnyNode): string | undefined {
  if (node.type === 'Heading') {
    const text = node['text']
    if (text && typeof text === 'object' && 'value' in text) return String((text as {value: unknown}).value)
    if (typeof text === 'string') return text
    return undefined
  }
  for (const field of ['children', 'items'] as const) {
    const children = node[field]
    if (Array.isArray(children)) {
      for (const child of children as AnyNode[]) {
        const found = findFirstHeadingText(child)
        if (found !== undefined) return found
      }
    }
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Service interface
// ---------------------------------------------------------------------------

export interface ShareLinkService {
  createShareLink: (
    creatorUserId: string,
    miniAppId: string,
  ) => Promise<{shareId: string; url: string}>

  getShareLinkInternal: (shareId: string) => Promise<ShareLinkInternalView | null>

  getShareLinkPublicView: (shareId: string) => Promise<ShareLinkPublicView | null>

  acceptCloneIntent: (shareId: string, clonerUserId: string) => Promise<AcceptCloneResult>
}

// ---------------------------------------------------------------------------
// Service factory
// ---------------------------------------------------------------------------

export function createShareLinkService(db: Db): ShareLinkService {
  return {
    /**
     * Create a share link for the caller's mini_app.
     * Verifies ownership before inserting. Freezes cover-art at share time.
     * Each call mints a new share_id — no deduplication (T-0008-046).
     */
    async createShareLink(
      creatorUserId: string,
      miniAppId: string,
    ): Promise<{shareId: string; url: string}> {
      // 1. Load mini_app — ownership check.
      const appRows = await db
        .select()
        .from(miniApps)
        .where(and(eq(miniApps.id, miniAppId), isNull(miniApps.deletedAt)))
      const app = appRows[0]
      if (!app) throw new NotFoundError('mini_app not found')
      if (app.ownerId !== creatorUserId) {
        // Return NotFoundError not ForbiddenError — avoid ownership leak (T-0008-041)
        throw new NotFoundError('mini_app not found')
      }
      if (!app.currentVersionId) throw new NotFoundError('mini_app has no current version')

      // 2. Load the current version (frozen at share time).
      const versionRows = await db
        .select()
        .from(miniAppVersions)
        .where(eq(miniAppVersions.id, app.currentVersionId))
      const version = versionRows[0]
      if (!version) throw new NotFoundError('mini_app_version not found')

      // 3. Derive cover-art identity from mini_app columns (ADR-0005 §K).
      //    coverStance + coverPalette map from stance/accentPalette.
      //    V0 palette mapping: use the app's accentPalette → cover_palette if valid,
      //    else fall back to 'focus'. Similarly for stance → cover_stance.
      const VALID_COVER_STANCES = ['productive', 'expressive'] as const
      const VALID_COVER_PALETTES = ['focus', 'health', 'money', 'social', 'learn', 'play'] as const
      type CoverStance = (typeof VALID_COVER_STANCES)[number]
      type CoverPalette = (typeof VALID_COVER_PALETTES)[number]

      // Map mini_app stance → cover_stance (the ADR's cover_stance enum)
      const coverStance: CoverStance = (VALID_COVER_STANCES as readonly string[]).includes(app.stance)
        ? (app.stance as CoverStance)
        : 'productive'

      // Map mini_app accentPalette → cover_palette (different enum)
      const coverPalette: CoverPalette = (VALID_COVER_PALETTES as readonly string[]).includes(app.accentPalette)
        ? (app.accentPalette as CoverPalette)
        : 'focus'

      // 4. Mint a new share_id and persist.
      const shareId = generateShareId()
      await db.insert(shareLinks).values({
        shareId,
        miniAppVersionId: version.id,
        ownerUserId: creatorUserId,
        coverStance,
        coverPalette,
        coverIcon: app.archetype, // V0: use archetype as coverIcon placeholder
        coverArtSeed: app.coverArtSeed.slice(0, 32).padEnd(32, '0'),
        // revokedAt: null (default) — V0 never revokes
      })

      return {
        shareId,
        url: `https://canvas.app/m/${shareId}/clone`,
      }
    },

    /**
     * Internal lookup — returns source_version_id for the clone path.
     * NEVER serialize this to a public response (AC-P8).
     */
    async getShareLinkInternal(shareId: string): Promise<ShareLinkInternalView | null> {
      const rows = await db
        .select({
          shareId: shareLinks.shareId,
          sourceVersionId: shareLinks.miniAppVersionId,
          ownerUserId: shareLinks.ownerUserId,
          revokedAt: shareLinks.revokedAt,
        })
        .from(shareLinks)
        .where(eq(shareLinks.shareId, shareId))
      const row = rows[0]
      if (!row) return null
      return {
        shareId: row.shareId,
        sourceVersionId: row.sourceVersionId,
        ownerUserId: row.ownerUserId,
        revokedAt: row.revokedAt ?? null,
      }
    },

    /**
     * Public lookup — cover-art fields + revocation status only.
     * T-0008-055: does NOT include mini_app_version_id, owner_user_id, spec_json.
     */
    async getShareLinkPublicView(shareId: string): Promise<ShareLinkPublicView | null> {
      const rows = await db
        .select({
          shareId: shareLinks.shareId,
          coverStance: shareLinks.coverStance,
          coverPalette: shareLinks.coverPalette,
          coverIcon: shareLinks.coverIcon,
          coverArtSeed: shareLinks.coverArtSeed,
          revokedAt: shareLinks.revokedAt,
          // INTENTIONALLY EXCLUDED: miniAppVersionId, ownerUserId
        })
        .from(shareLinks)
        .where(eq(shareLinks.shareId, shareId))
      const row = rows[0]
      if (!row) return null
      return {
        shareId: row.shareId,
        coverStance: row.coverStance,
        coverPalette: row.coverPalette,
        coverIcon: row.coverIcon,
        coverArtSeed: row.coverArtSeed,
        revokedAt: row.revokedAt ?? null,
      }
    },

    /**
     * Accept a clone intent.
     *
     * CRITICAL: Steps 3–5 (mini_app insert, mini_app_version insert,
     * share_link_clones insert) are wrapped in a single db.transaction().
     * Pattern matches miniApps.service.ts:create() at line ~247 (T-0008-087c).
     *
     * Idempotency path (step 2): if a share_link_clones row already exists
     * for (shareId, clonerUserId), return the existing clone without entering
     * the transaction. created: false.
     *
     * Race path (ON CONFLICT DO NOTHING on step 5): if the unique constraint
     * fires (two concurrent callers), the transaction throws RaceLostError.
     * The caller catches this and re-runs the idempotency check (step 2),
     * returning the winning clone with created: false.
     */
    async acceptCloneIntent(shareId: string, clonerUserId: string): Promise<AcceptCloneResult> {
      // 1. Resolve share_link → source version.
      const linkInternal = await this.getShareLinkInternal(shareId)
      if (!linkInternal) throw new ShareNotFoundError(shareId)
      if (linkInternal.revokedAt !== null) throw new RevokedError(shareId)

      // 2. Idempotency check — no transaction needed for read path.
      const existingCloneRow = await findExistingClone(db, shareId, clonerUserId)
      if (existingCloneRow) {
        return {
          miniApp: existingCloneRow.miniApp,
          currentVersion: existingCloneRow.version,
          created: false,
        }
      }

      // 3–5. Transactional write — matches miniApps.service.ts pattern.
      //      Any failure rolls back ALL writes (T-0008-087c, T-0008-087b).
      try {
        return await db.transaction(async tx => {
          // Load source version inside transaction for consistency.
          const sourceVersionRows = await tx
            .select()
            .from(miniAppVersions)
            .where(eq(miniAppVersions.id, linkInternal.sourceVersionId))
          const sourceVersion = sourceVersionRows[0]
          if (!sourceVersion) throw new ShareNotFoundError(shareId)

          // Clone title — 'Shared tool' fallback (T-0008-078, AC-P8 deviation from AC-P2).
          const title = deriveCloneTitle(sourceVersion.specJson)

          // Fresh cover_art_seed for the clone — different from source (T-0008-062).
          const freshSeed = generateCoverArtSeed()

          // 3. INSERT mini_app (clone owned by clonerUserId, NOT source owner — AC-P8).
          const [miniAppRow] = await tx
            .insert(miniApps)
            .values({
              ownerId: clonerUserId,
              title,
              currentVersionId: null,
              parentMiniAppId: null,
              originalPrompt: '',       // source original_prompt intentionally NOT copied (AC-P8)
              stance: 'productive',     // V0 default for clones
              accentPalette: 'neutral', // V0 default for clones
              coverArtSeed: freshSeed,
              archetype: 'unknown',
              syncMode: 'cloud-private',
            })
            .returning()
          if (!miniAppRow) throw new Error('mini_apps insert returned no row')

          // 4. INSERT mini_app_version (copy spec_json; recompute render_hash).
          const newRenderHash = renderHash(sourceVersion.specJson as Spec)
          const [versionRow] = await tx
            .insert(miniAppVersions)
            .values({
              miniAppId: miniAppRow.id,
              specJson: sourceVersion.specJson,
              renderHash: newRenderHash,
              planJson: null,
            })
            .returning()
          if (!versionRow) throw new Error('mini_app_versions insert returned no row')

          // Wire current_version_id.
          await tx
            .update(miniApps)
            .set({currentVersionId: versionRow.id})
            .where(eq(miniApps.id, miniAppRow.id))

          // 5. INSERT share_link_clones — unique constraint is the race guard.
          //    ON CONFLICT DO NOTHING: if another concurrent transaction already
          //    inserted this (share_link_id, cloner_user_id), conflict returns [].
          const conflictResult = await tx
            .insert(shareLinkClones)
            .values({
              shareLinkId: shareId,
              clonerUserId,
              clonedMiniAppId: miniAppRow.id,
            })
            .onConflictDoNothing()
            .returning()

          if (conflictResult.length === 0) {
            // Race lost — the OTHER concurrent transaction won. Throw to abort
            // this transaction, rolling back steps 3 and 4. The caller re-runs
            // the idempotency check (step 2) and returns the winner's clone.
            throw new RaceLostError()
          }

          return {
            miniApp: toPublicMiniApp({...miniAppRow, currentVersionId: versionRow.id}),
            currentVersion: toPublicVersion(versionRow),
            created: true,
          }
        })
      } catch (err) {
        if (err instanceof RaceLostError) {
          // Re-run idempotency check to return the winning clone.
          const winningClone = await findExistingClone(db, shareId, clonerUserId)
          if (winningClone) {
            return {
              miniApp: winningClone.miniApp,
              currentVersion: winningClone.version,
              created: false,
            }
          }
          // Extremely unlikely — both attempts failed. Surface as internal error.
          throw new Error('concurrent_clone_resolution_failed')
        }
        throw err
      }
    },
  }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/** Map a MiniApp DB row to the public clone shape (no source identifiers). */
function toPublicMiniApp(app: MiniApp & {currentVersionId: string}): PublicClonedMiniApp {
  return {
    id: app.id,
    title: app.title,
    ownerUserId: app.ownerId,  // The cloner — always
    coverArtSeed: app.coverArtSeed,
    stance: app.stance,
    accentPalette: app.accentPalette,
    archetype: app.archetype,
    createdAt: app.createdAt,
  }
}

/** Map a MiniAppVersion DB row to the public clone version shape. */
function toPublicVersion(version: MiniAppVersion): PublicClonedVersion {
  return {
    id: version.id,
    miniAppId: version.miniAppId,
    renderHash: version.renderHash,
    // specJson intentionally absent from public type
  }
}

/** Look up an existing clone for idempotency. */
async function findExistingClone(
  db: Db,
  shareId: string,
  clonerUserId: string,
): Promise<{miniApp: PublicClonedMiniApp; version: PublicClonedVersion} | null> {
  const rows = await db
    .select({
      clone: shareLinkClones,
      app: miniApps,
      version: miniAppVersions,
    })
    .from(shareLinkClones)
    .innerJoin(miniApps, eq(miniApps.id, shareLinkClones.clonedMiniAppId))
    .innerJoin(miniAppVersions, eq(miniAppVersions.id, miniApps.currentVersionId))
    .where(
      and(
        eq(shareLinkClones.shareLinkId, shareId),
        eq(shareLinkClones.clonerUserId, clonerUserId),
      ),
    )

  const row = rows[0]
  if (!row) return null
  if (!row.app.currentVersionId) return null

  return {
    miniApp: toPublicMiniApp({...row.app, currentVersionId: row.app.currentVersionId}),
    version: toPublicVersion(row.version),
  }
}

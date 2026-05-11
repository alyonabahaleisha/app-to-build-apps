/**
 * MiniApps service — ADR-0011 Step 2 (renamed from projects.service.ts).
 *
 * Operations:
 *   - create({ownerId, spec, ...})       → MiniAppDetail
 *   - list(ownerId)                      → MiniAppListItem[]   (specJson EXCLUDED)
 *   - get(ownerId, miniAppId)            → MiniAppDetail | null
 *   - getVersion(versionId)              → MiniAppVersion | null
 *   - archive(ownerId, miniAppId)        → MiniApp | null (null = not found / not owner)
 *   - unarchive(ownerId, miniAppId)      → MiniApp | null
 *   - rename(ownerId, miniAppId, title)  → MiniApp | null
 *   - delete(ownerId, miniAppId)         → DeleteResult (tagged union)
 *
 * Sensitivity (per retro-lessons.md `normalizeRow` lesson):
 *   `list` omits `specJson`. Only `get` returns the full version.
 *   The TS types make this impossible to "accidentally" include.
 *
 * Cover-art seed stability (T-0011-023b):
 *   Creating a new mini_app_versions row (re-prompt path) does NOT rewrite
 *   the parent mini_apps.cover_art_seed. Only the version row is appended.
 *
 * Stance + accentPalette closed enums (T-0011-038 / 039):
 *   create() rejects unknown values — the protocol package defines the allowed
 *   set. We validate here at the service boundary.
 */
import {and, desc, eq, isNull} from 'drizzle-orm'
import type {NodePgDatabase} from 'drizzle-orm/node-postgres'

import {SpecSchema, validateCrossRefs, renderHash, type Spec} from '@app-creator/protocol'

// ADR-0010 Step 4: PROMPT_VERSION written on every mini_app_versions insert
// so analytics can join by prompt version post-launch.
import {PROMPT_VERSION} from '../llm/prompts/system.js'

import * as schema from '../db/schema.js'
import {
  miniApps,
  miniAppVersions,
  messages,
  type MiniApp,
  type MiniAppVersion,
} from '../db/schema.js'

type Db = NodePgDatabase<typeof schema>

// ---------------------------------------------------------------------------
// Closed-enum validation helpers
// ---------------------------------------------------------------------------

const VALID_STANCES = ['productive', 'playful', 'calm'] as const
type Stance = (typeof VALID_STANCES)[number]

const VALID_PALETTES = [
  'neutral',
  'focus',
  'ocean',
  'sunset',
  'forest',
  'candy',
  'mono',
] as const
type AccentPalette = (typeof VALID_PALETTES)[number]

function isValidStance(s: string): s is Stance {
  return (VALID_STANCES as readonly string[]).includes(s)
}

function isValidPalette(p: string): p is AccentPalette {
  return (VALID_PALETTES as readonly string[]).includes(p)
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface CreateMiniAppInput {
  ownerId: string
  spec: Spec
  parentMiniAppId?: string
  /**
   * The user's original prompt text. Stored verbatim on the mini_app row
   * and inserted as the first `messages` row.
   */
  originalPrompt?: string
  /**
   * V0: when set, this generation is a re-prompt-to-edit. The service applies
   * best-effort collection data migration from the parent version to the new spec.
   * When absent: fresh creation.
   */
  parentVersionId?: string
  /**
   * Cover-art seed. If omitted, a new UUID is generated. When editing an existing
   * mini-app the caller should pass the existing seed to preserve cover-art
   * stability (T-0011-023b).
   */
  coverArtSeed?: string
}

export type MiniAppListItem = Pick<
  MiniApp,
  | 'id'
  | 'title'
  | 'currentVersionId'
  | 'parentMiniAppId'
  | 'stance'
  | 'accentPalette'
  | 'coverArtSeed'
  | 'archetype'
  | 'syncMode'
> & {
  updatedAt: Date
  createdAt: Date
}

export interface MiniAppDetail {
  miniApp: Omit<MiniApp, 'currentVersionId'> & {currentVersionId: string}
  currentVersion: MiniAppVersion
}

export type DeleteResult =
  | {kind: 'deleted'; deletedAt: Date}
  | {kind: 'already_deleted'}
  | {kind: 'not_found'}

// ---------------------------------------------------------------------------
// Title derivation — T-0007-099 (preserved from M1 projects.service)
// ---------------------------------------------------------------------------

const MAX_PROMPT_TITLE_LENGTH = 40

type AnyNode = {type: string; [key: string]: unknown}

function findFirstHeadingText(node: AnyNode): string | undefined {
  if (node.type === 'Heading') {
    const text = node['text']
    if (text && typeof text === 'object' && 'value' in text) {
      return String((text as {value: unknown}).value)
    }
    if (typeof text === 'string') return text
    return undefined
  }
  const childrenFields = ['children', 'items'] as const
  for (const field of childrenFields) {
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

export function deriveTitle(spec: Spec, originalPrompt = ''): string {
  const firstScreen = spec.screens[0]
  if (firstScreen) {
    const heading = findFirstHeadingText(firstScreen.root as AnyNode)
    const trimmed = heading?.trim() ?? ''
    if (trimmed.length > 0) {
      if (trimmed.length > MAX_PROMPT_TITLE_LENGTH) {
        return trimmed.slice(0, MAX_PROMPT_TITLE_LENGTH) + '…'
      }
      return trimmed
    }
  }

  const trimmedPrompt = originalPrompt.trim()
  if (trimmedPrompt.length === 0) return 'Untitled'
  if (trimmedPrompt.length > MAX_PROMPT_TITLE_LENGTH) {
    return trimmedPrompt.slice(0, MAX_PROMPT_TITLE_LENGTH) + '…'
  }
  return trimmedPrompt
}

// ---------------------------------------------------------------------------
// migrateCollectionData — V0 stub (ADR-0007 §B Notes for Colby)
// V0 returns {} for all inputs. V0.5 flips this on.
// ---------------------------------------------------------------------------

async function migrateCollectionData(
  _parentVersionId: string,
  _newSpec: Spec,
): Promise<Record<string, unknown[]>> {
  return {}
}

// ---------------------------------------------------------------------------
// Service interface
// ---------------------------------------------------------------------------

export interface MiniAppsService {
  create: (input: CreateMiniAppInput) => Promise<MiniAppDetail>
  list: (ownerId: string) => Promise<MiniAppListItem[]>
  get: (ownerId: string, miniAppId: string) => Promise<MiniAppDetail | null>
  getVersion: (versionId: string) => Promise<MiniAppVersion | null>
  archive: (ownerId: string, miniAppId: string) => Promise<MiniApp | null>
  unarchive: (ownerId: string, miniAppId: string) => Promise<MiniApp | null>
  rename: (ownerId: string, miniAppId: string, newTitle: string) => Promise<MiniApp | null>
  delete: (ownerId: string, miniAppId: string) => Promise<DeleteResult>
}

// ---------------------------------------------------------------------------
// Service factory
// ---------------------------------------------------------------------------

export function createMiniAppsService(db: Db): MiniAppsService {
  return {
    async create({
      ownerId,
      spec,
      parentMiniAppId,
      originalPrompt = '',
      parentVersionId,
      coverArtSeed,
    }: CreateMiniAppInput): Promise<MiniAppDetail> {
      // 1. Defensive Zod re-validation at the service boundary.
      const parsed = SpecSchema.parse(spec)

      // 2. Cross-ref validation at service boundary.
      const crossRef = validateCrossRefs(parsed)
      if (!crossRef.ok) {
        throw new Error(
          `invalid_spec: cross_ref errors: ${crossRef.errors.map(e => e.code).join(', ')}`,
        )
      }

      // 3. Closed-enum validation for stance + accentPalette (T-0011-038 / 039).
      const specStance = (parsed as {stance?: string}).stance ?? 'productive'
      const specPalette = (parsed as {palette?: string}).palette ?? 'neutral'
      if (!isValidStance(specStance)) {
        throw new Error(`invalid_spec: unknown stance '${specStance}'`)
      }
      if (!isValidPalette(specPalette)) {
        throw new Error(`invalid_spec: unknown accentPalette '${specPalette}'`)
      }

      // 4. Best-effort collection data migration (V0: always {}).
      const _migratedData = parentVersionId
        ? await migrateCollectionData(parentVersionId, parsed)
        : {}

      // 5. Cheap derivations.
      const title = deriveTitle(parsed, originalPrompt)
      const hash = renderHash(parsed)
      const seed = coverArtSeed ?? crypto.randomUUID()

      // ADR-0010 Step 4 / T-0010-157: PROMPT_VERSION must be a non-empty string
      // at write time. The const is always populated from the module import; an
      // empty value would indicate a broken build rather than a missing migration,
      // and silent-null in the analytics join would corrupt the data from day one.
      if (!PROMPT_VERSION || PROMPT_VERSION.trim() === '') {
        throw new Error('PROMPT_VERSION is not set — cannot insert mini_app_versions row')
      }

      // 6. Transactional write — mini_app row + mini_app_versions row.
      //    If the version insert fails after mini_app insert, the transaction
      //    rolls back and neither row survives (T-0011-023a).
      return await db.transaction(async tx => {
        const [miniAppRow] = await tx
          .insert(miniApps)
          .values({
            ownerId,
            title,
            currentVersionId: null,
            parentMiniAppId: parentMiniAppId ?? null,
            originalPrompt,
            stance: specStance,
            accentPalette: specPalette,
            coverArtSeed: seed,
            archetype: (parsed as {archetype?: string}).archetype ?? 'unknown',
            syncMode: 'cloud-private',
          })
          .returning()
        if (!miniAppRow) throw new Error('mini_apps insert returned no row')

        const [versionRow] = await tx
          .insert(miniAppVersions)
          .values({
            miniAppId: miniAppRow.id,
            specJson: parsed,
            renderHash: hash,
            // V0: plan_json is always NULL (ADR-0007 §G: plan column deprecated).
            planJson: null,
            // ADR-0010 Step 4: stamp every new version with the prompt version
            // that generated it. Value taken from the imported const — never from
            // user input (T-0010-094). Drizzle will error if migration 0012 has
            // not been applied (T-0010-157: loud failure, not silent null).
            promptVersion: PROMPT_VERSION,
          })
          .returning()
        if (!versionRow) throw new Error('mini_app_versions insert returned no row')

        await tx
          .update(miniApps)
          .set({currentVersionId: versionRow.id})
          .where(eq(miniApps.id, miniAppRow.id))

        if (originalPrompt.length > 0) {
          await tx.insert(messages).values({
            miniAppId: miniAppRow.id,
            role: 'user',
            content: originalPrompt,
          })
        }

        return {
          miniApp: {...miniAppRow, currentVersionId: versionRow.id},
          currentVersion: versionRow,
        }
      })
    },

    async list(ownerId: string): Promise<MiniAppListItem[]> {
      const rows = await db
        .select({
          id: miniApps.id,
          title: miniApps.title,
          currentVersionId: miniApps.currentVersionId,
          parentMiniAppId: miniApps.parentMiniAppId,
          stance: miniApps.stance,
          accentPalette: miniApps.accentPalette,
          coverArtSeed: miniApps.coverArtSeed,
          archetype: miniApps.archetype,
          syncMode: miniApps.syncMode,
          updatedAt: miniApps.updatedAt,
          createdAt: miniApps.createdAt,
        })
        .from(miniApps)
        .where(
          and(
            eq(miniApps.ownerId, ownerId),
            isNull(miniApps.archivedAt),
            isNull(miniApps.deletedAt),
          ),
        )
        .orderBy(desc(miniApps.updatedAt))

      return rows.map(r => ({
        id: r.id,
        title: r.title,
        currentVersionId: r.currentVersionId as string,
        parentMiniAppId: r.parentMiniAppId,
        stance: r.stance,
        accentPalette: r.accentPalette,
        coverArtSeed: r.coverArtSeed,
        archetype: r.archetype,
        syncMode: r.syncMode,
        updatedAt: r.updatedAt,
        createdAt: r.createdAt,
      }))
    },

    async get(ownerId: string, miniAppId: string): Promise<MiniAppDetail | null> {
      const miniAppRows = await db
        .select()
        .from(miniApps)
        .where(and(eq(miniApps.id, miniAppId), isNull(miniApps.deletedAt)))
      const miniApp = miniAppRows[0]
      if (!miniApp) return null
      if (miniApp.ownerId !== ownerId) return null
      if (miniApp.currentVersionId === null) return null

      const versionRows = await db
        .select()
        .from(miniAppVersions)
        .where(eq(miniAppVersions.id, miniApp.currentVersionId))
      const version = versionRows[0]
      if (!version) return null

      return {
        miniApp: {...miniApp, currentVersionId: miniApp.currentVersionId},
        currentVersion: version,
      }
    },

    async getVersion(versionId: string): Promise<MiniAppVersion | null> {
      // T-0011-036: return null if the version's mini_app is soft-deleted.
      const rows = await db
        .select({
          version: miniAppVersions,
          deletedAt: miniApps.deletedAt,
        })
        .from(miniAppVersions)
        .innerJoin(miniApps, eq(miniApps.id, miniAppVersions.miniAppId))
        .where(eq(miniAppVersions.id, versionId))

      const row = rows[0]
      if (!row) return null
      if (row.deletedAt !== null) return null
      return row.version
    },

    async archive(ownerId: string, miniAppId: string): Promise<MiniApp | null> {
      // Find the row first — enforce ownership. Not found OR wrong owner → null.
      const existing = await db
        .select()
        .from(miniApps)
        .where(and(eq(miniApps.id, miniAppId), isNull(miniApps.deletedAt)))
      const row = existing[0]
      if (!row || row.ownerId !== ownerId) return null

      // Idempotent: if already archived, return the row unchanged (T-0011-056).
      if (row.archivedAt !== null) return row

      const [updated] = await db
        .update(miniApps)
        .set({archivedAt: new Date()})
        .where(eq(miniApps.id, miniAppId))
        .returning()
      return updated ?? null
    },

    async unarchive(ownerId: string, miniAppId: string): Promise<MiniApp | null> {
      const existing = await db
        .select()
        .from(miniApps)
        .where(and(eq(miniApps.id, miniAppId), isNull(miniApps.deletedAt)))
      const row = existing[0]
      if (!row || row.ownerId !== ownerId) return null

      const [updated] = await db
        .update(miniApps)
        .set({archivedAt: null})
        .where(eq(miniApps.id, miniAppId))
        .returning()
      return updated ?? null
    },

    async rename(
      ownerId: string,
      miniAppId: string,
      newTitle: string,
    ): Promise<MiniApp | null> {
      const existing = await db
        .select()
        .from(miniApps)
        .where(and(eq(miniApps.id, miniAppId), isNull(miniApps.deletedAt)))
      const row = existing[0]
      if (!row || row.ownerId !== ownerId) return null

      const [updated] = await db
        .update(miniApps)
        .set({title: newTitle, updatedAt: new Date()})
        .where(eq(miniApps.id, miniAppId))
        .returning()
      return updated ?? null
    },

    async delete(ownerId: string, miniAppId: string): Promise<DeleteResult> {
      // Look up the row regardless of deleted_at — to distinguish the three cases.
      const rows = await db.select().from(miniApps).where(eq(miniApps.id, miniAppId))
      const row = rows[0]

      // Row never existed OR belongs to another user → not_found.
      // We return not_found for both cases to avoid leaking ownership (T-0011-061 / 070).
      if (!row || row.ownerId !== ownerId) return {kind: 'not_found'}

      // Already deleted → already_deleted (idempotent, 200 to caller per T-0011-060).
      if (row.deletedAt !== null) return {kind: 'already_deleted'}

      const deletedAt = new Date()
      await db.update(miniApps).set({deletedAt}).where(eq(miniApps.id, miniAppId))
      return {kind: 'deleted', deletedAt}
    },
  }
}

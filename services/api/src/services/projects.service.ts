/**
 * Projects service — ADR-0007 Step 4 V0 cutover.
 *
 * Three read operations + one write:
 *   - create({ownerId, spec, parentProjectId?, originalPrompt?, parentVersionId?}) → ProjectDetail
 *   - list(ownerId)                            → ProjectListItem[]   (specJson EXCLUDED)
 *   - get(ownerId, projectId)                  → ProjectDetail | null
 *   - getVersion(versionId)                    → ProjectVersion | null
 *   - applyEdit(...)                           → ProjectDetail  (preserved for Step 6 sweep)
 *
 * V0 changes vs M1:
 *   - `spec` type: A2UISpec → Spec (from @app-creator/protocol)
 *   - `plan` parameter: dropped from create()
 *   - renderHash: uses @app-creator/protocol's renderHash (not lib/canonical.ts)
 *   - deepValidateSpec: replaced by validateCrossRefs
 *   - migrateCollectionData: V0 stub — always returns {} (V0.5 flips this on)
 *   - plan_json: always NULL on V0 inserts (per ADR-0007 §G)
 *   - parentVersionId: optional; when present, triggers collection data migration
 *
 * Title derivation (T-0007-099):
 *   Walk spec.screens[0].root depth-first; return the first Heading.text
 *   (whitespace-trimmed). Fallback: first 40 chars of originalPrompt
 *   (whitespace-trimmed, truncated with '…' suffix if > 40 chars).
 *   If prompt is empty → literal "Untitled".
 *
 * Sensitivity (per retro-lessons.md `normalizeRow` lesson):
 *   `list` omits `specJson`. Only `get` returns the full version.
 *   The TS types make this impossible to "accidentally" include.
 */
import {desc, eq} from 'drizzle-orm'
import type {NodePgDatabase} from 'drizzle-orm/node-postgres'

import {SpecSchema, validateCrossRefs, renderHash, type Spec} from '@app-creator/protocol'

import * as schema from '../db/schema.js'
import {
  projects,
  projectVersions,
  messages,
  type Project,
  type ProjectVersion,
} from '../db/schema.js'

type Db = NodePgDatabase<typeof schema>

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface CreateProjectInput {
  ownerId: string
  spec: Spec
  parentProjectId?: string
  /**
   * The user's original prompt text. Stored verbatim on the project row
   * and inserted as the first `messages` row.
   */
  originalPrompt?: string
  /**
   * V0: when set, this generation is a re-prompt-to-edit. The service applies
   * best-effort collection data migration from the parent version to the new spec.
   * When absent: fresh creation.
   */
  parentVersionId?: string
}

export type ProjectListItem = Pick<
  Project,
  'id' | 'title' | 'currentVersionId' | 'parentProjectId'
> & {
  updatedAt: Date
  createdAt: Date
}

export interface ProjectDetail {
  project: Omit<Project, 'currentVersionId'> & {currentVersionId: string}
  currentVersion: ProjectVersion
}

// ---------------------------------------------------------------------------
// Title derivation — T-0007-099
// ---------------------------------------------------------------------------

const MAX_PROMPT_TITLE_LENGTH = 40

type AnyNode = {type: string; [key: string]: unknown}

function findFirstHeadingText(node: AnyNode): string | undefined {
  if (node.type === 'Heading') {
    const text = node['text']
    if (text && typeof text === 'object' && 'value' in text) {
      // V0 binding: {kind: 'literal', value: string}
      return String((text as {value: unknown}).value)
    }
    if (typeof text === 'string') return text
    return undefined
  }
  // Walk container children arrays
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
  // Walk spec.screens[0].root depth-first for a Heading node.
  const firstScreen = spec.screens[0]
  if (firstScreen) {
    const heading = findFirstHeadingText(firstScreen.root as AnyNode)
    const trimmed = heading?.trim() ?? ''
    if (trimmed.length > 0) return trimmed
  }

  // Fallback: first 40 chars of originalPrompt.
  const trimmedPrompt = originalPrompt.trim()
  if (trimmedPrompt.length === 0) return 'Untitled'
  if (trimmedPrompt.length > MAX_PROMPT_TITLE_LENGTH) {
    return trimmedPrompt.slice(0, MAX_PROMPT_TITLE_LENGTH) + '…'
  }
  return trimmedPrompt
}

// ---------------------------------------------------------------------------
// migrateCollectionData — V0 stub (ADR-0007 §B Notes for Colby)
//
// V0 returns {} for all inputs. V0.5 flips this on when collection rows
// persist server-side. T-0007-180 locks the V0 stub so V0.5's activation
// is detected when this test starts failing.
// ---------------------------------------------------------------------------

async function migrateCollectionData(
  _parentVersionId: string,
  _newSpec: Spec,
): Promise<Record<string, unknown[]>> {
  return {}
}

// ---------------------------------------------------------------------------
// Service factory
// ---------------------------------------------------------------------------

export interface ProjectsService {
  create: (input: CreateProjectInput) => Promise<ProjectDetail>
  list: (ownerId: string) => Promise<ProjectListItem[]>
  get: (ownerId: string, projectId: string) => Promise<ProjectDetail | null>
  getVersion: (versionId: string) => Promise<ProjectVersion | null>
  /**
   * applyEdit is preserved for Step 6 deletion sweep. It is no longer called
   * by the V0 generate route (re-prompt-to-edit goes through create() now).
   */
  applyEdit: (
    projectId: string,
    newSpec: Spec,
  ) => Promise<ProjectDetail>
}

export function createProjectsService(db: Db): ProjectsService {
  return {
    async create({
      ownerId,
      spec,
      parentProjectId,
      originalPrompt = '',
      parentVersionId,
    }: CreateProjectInput): Promise<ProjectDetail> {
      // 1. Defensive Zod re-validation — Zod parse already ran in generate.ts;
      //    this is the service boundary's defence-in-depth check.
      const parsed = SpecSchema.parse(spec)

      // 2. Cross-ref validation at service boundary.
      const crossRef = validateCrossRefs(parsed)
      if (!crossRef.ok) {
        throw new Error(
          `invalid_spec: cross_ref errors: ${crossRef.errors.map(e => e.code).join(', ')}`,
        )
      }

      // 3. Best-effort collection data migration (V0: always {}).
      const _migratedData = parentVersionId
        ? await migrateCollectionData(parentVersionId, parsed)
        : {}

      // 4. Cheap derivations.
      const title = deriveTitle(parsed, originalPrompt)
      const hash = renderHash(parsed)

      // 5. Transactional write.
      return await db.transaction(async tx => {
        const [projectRow] = await tx
          .insert(projects)
          .values({
            ownerId,
            title,
            currentVersionId: null,
            parentProjectId: parentProjectId ?? null,
            originalPrompt,
          })
          .returning()
        if (!projectRow) throw new Error('projects insert returned no row')

        const [versionRow] = await tx
          .insert(projectVersions)
          .values({
            projectId: projectRow.id,
            specJson: parsed,
            renderHash: hash,
            // V0: plan_json is always NULL (ADR-0007 §G: plan column deprecated).
            planJson: null,
          })
          .returning()
        if (!versionRow) throw new Error('project_versions insert returned no row')

        await tx
          .update(projects)
          .set({currentVersionId: versionRow.id})
          .where(eq(projects.id, projectRow.id))

        if (originalPrompt.length > 0) {
          await tx.insert(messages).values({
            projectId: projectRow.id,
            role: 'user',
            content: originalPrompt,
          })
        }

        return {
          project: {...projectRow, currentVersionId: versionRow.id},
          currentVersion: versionRow,
        }
      })
    },

    async list(ownerId: string): Promise<ProjectListItem[]> {
      const rows = await db
        .select({
          id: projects.id,
          title: projects.title,
          currentVersionId: projects.currentVersionId,
          parentProjectId: projects.parentProjectId,
          updatedAt: projects.updatedAt,
          createdAt: projects.createdAt,
        })
        .from(projects)
        .where(eq(projects.ownerId, ownerId))
        .orderBy(desc(projects.updatedAt))

      return rows.map(r => ({
        id: r.id,
        title: r.title,
        currentVersionId: r.currentVersionId as string,
        parentProjectId: r.parentProjectId,
        updatedAt: r.updatedAt,
        createdAt: r.createdAt,
      }))
    },

    async get(ownerId: string, projectId: string): Promise<ProjectDetail | null> {
      const projectRows = await db.select().from(projects).where(eq(projects.id, projectId))
      const project = projectRows[0]
      if (!project) return null
      if (project.ownerId !== ownerId) return null
      if (project.currentVersionId === null) return null

      const versionRows = await db
        .select()
        .from(projectVersions)
        .where(eq(projectVersions.id, project.currentVersionId))
      const version = versionRows[0]
      if (!version) return null

      return {
        project: {...project, currentVersionId: project.currentVersionId},
        currentVersion: version,
      }
    },

    async getVersion(versionId: string): Promise<ProjectVersion | null> {
      const rows = await db
        .select()
        .from(projectVersions)
        .where(eq(projectVersions.id, versionId))
      return rows[0] ?? null
    },

    /**
     * applyEdit — preserved for Step 6 deletion sweep.
     * V0 re-prompt-to-edit goes through create() with parentVersionId.
     * plan parameter removed (ADR-0007 — planner deleted).
     */
    async applyEdit(
      projectId: string,
      newSpec: Spec,
    ): Promise<ProjectDetail> {
      const parsed = SpecSchema.parse(newSpec)
      const hash = renderHash(parsed)

      return await db.transaction(async tx => {
        const [versionRow] = await tx
          .insert(projectVersions)
          .values({
            projectId,
            specJson: parsed,
            renderHash: hash,
            planJson: null,
          })
          .returning()
        if (!versionRow) throw new Error('project_versions insert returned no row')

        const [updatedProject] = await tx
          .update(projects)
          .set({currentVersionId: versionRow.id})
          .where(eq(projects.id, projectId))
          .returning()
        if (!updatedProject) throw new Error('projects update returned no row')

        return {
          project: {...updatedProject, currentVersionId: versionRow.id},
          currentVersion: versionRow,
        }
      })
    },
  }
}

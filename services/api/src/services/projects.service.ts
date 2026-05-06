/**
 * Projects service — ADR-0001 Step 4.
 *
 * Three operations on the project library:
 *   - create({ownerId, spec, parentProjectId?}) → ProjectDetail
 *   - list(ownerId)                            → ProjectListItem[]   (specJson EXCLUDED)
 *   - get(ownerId, projectId)                  → ProjectDetail | null
 *
 * Sensitivity (per retro-lessons.md `normalizeRow` lesson):
 *   `list` is a `public-safe`-ish surface (still scoped to the owner) and
 *   intentionally OMITS `specJson`. Only `get` returns the full version.
 *   The TS types make this impossible to "accidentally" include.
 *
 * Validation order (per ADR §Step 4 + T-0001-130/131/138):
 *   1. Zod parse — shape, enums, recursive node schema.
 *   2. deepValidateSpec — depth ≤ 8, action targets resolved, view ids resolved.
 *   3. Compute renderHash from canonicalized spec bytes.
 *   4. Single transaction: INSERT project (current_version_id NULL) →
 *      INSERT project_version → UPDATE project.current_version_id.
 *
 * Title derivation:
 *   - First Heading text in the first view, whitespace-trimmed.
 *   - Empty / missing → "Untitled".
 *   - >60 chars → first 60 chars + ellipsis (total length 61, T-0001-059).
 */
import {desc, eq} from 'drizzle-orm'
import type {NodePgDatabase} from 'drizzle-orm/node-postgres'

import {A2UISpecSchema, type A2UINode, type A2UISpec} from '@app-creator/a2ui-schema'

import {renderHash} from '../lib/canonical.js'
import * as schema from '../db/schema.js'
import {
  projects,
  projectVersions,
  messages,
  type Project,
  type ProjectVersion,
} from '../db/schema.js'
import {deepValidateSpec} from './specValidation.js'

type Db = NodePgDatabase<typeof schema>

// ---------------------------------------------------------------------------
// Public types — derived from the Drizzle row types via Pick/Omit so column
// renames in `schema.ts` propagate here automatically.
// ---------------------------------------------------------------------------

export interface CreateProjectInput {
  ownerId: string
  spec: A2UISpec
  parentProjectId?: string
  /**
   * The user's original prompt text. Stored verbatim on the project row
   * (ADR-0002 §G) and inserted as the first `messages` row for future memory
   * features. Defaults to '' for backward compat with ADR-0001 callers.
   */
  originalPrompt?: string
}

/**
 * The list-item shape. Note the absence of `specJson` and `ownerId` — the
 * former defends T-0001-064 (the `userCount`/`normalizeRow` retro-lesson),
 * the latter is implicit (the list is owner-scoped, the caller already
 * knows whose list they're looking at).
 */
export type ProjectListItem = Pick<
  Project,
  'id' | 'title' | 'currentVersionId' | 'parentProjectId'
> & {
  updatedAt: Date
  createdAt: Date
}

export interface ProjectDetail {
  /**
   * Project columns — `currentVersionId` is non-null after `create()` returns.
   * The DB column is nullable (the FK breaks an insertion cycle); the service
   * narrows it for callers because by the time `create()` resolves, the field
   * is always populated.
   */
  project: Omit<Project, 'currentVersionId'> & {currentVersionId: string}
  currentVersion: ProjectVersion
}

// ---------------------------------------------------------------------------
// Title derivation — exported for visibility in tests/debugging.
// ---------------------------------------------------------------------------

const MAX_TITLE_LENGTH = 60

function findFirstHeadingText(node: A2UINode): string | undefined {
  if (node.type === 'Heading') return node.text
  if (node.type === 'List') {
    for (const item of node.items) {
      const found = findFirstHeadingText(item)
      if (found !== undefined) return found
    }
    return undefined
  }
  if (node.type === 'Form') {
    for (const field of node.fields) {
      const found = findFirstHeadingText(field)
      if (found !== undefined) return found
    }
    return undefined
  }
  if (node.type === 'Container') {
    for (const child of node.children) {
      const found = findFirstHeadingText(child)
      if (found !== undefined) return found
    }
    return undefined
  }
  return undefined
}

export function deriveTitle(spec: A2UISpec): string {
  const firstView = spec.views[0]
  // A2UISpecSchema requires .min(1) views, so firstView is always defined,
  // but TS narrowing on array access still wants a guard.
  if (!firstView) return 'Untitled'
  const heading = findFirstHeadingText(firstView.root)
  const trimmed = heading?.trim() ?? ''
  if (trimmed === '') return 'Untitled'
  if (trimmed.length > MAX_TITLE_LENGTH) {
    return trimmed.slice(0, MAX_TITLE_LENGTH) + '…'
  }
  return trimmed
}

// ---------------------------------------------------------------------------
// Service factory — `db` is injected so route tests can swap in a sabotaged
// proxy (T-0001-062) and so the production binding stays at the route layer.
// ---------------------------------------------------------------------------

export interface ProjectsService {
  create: (input: CreateProjectInput) => Promise<ProjectDetail>
  list: (ownerId: string) => Promise<ProjectListItem[]>
  get: (ownerId: string, projectId: string) => Promise<ProjectDetail | null>
}

export function createProjectsService(db: Db): ProjectsService {
  return {
    async create({
      ownerId,
      spec,
      parentProjectId,
      originalPrompt = '',
    }: CreateProjectInput): Promise<ProjectDetail> {
      // 1. Zod validation — throws ZodError on shape failure (T-0001-055).
      const parsed = A2UISpecSchema.parse(spec)

      // 2. Deep validation — throws ValidationError on depth / unresolved
      //    target / unresolved view (T-0001-130/131/138). BEFORE any DB write.
      deepValidateSpec(parsed)

      // 3. Cheap derivations.
      const title = deriveTitle(parsed)
      const hash = renderHash(parsed)

      // 4. Transactional write. Insert project with NULL current_version_id,
      //    insert version, update project, insert messages row. Any failure
      //    rolls back all inserts (T-0001-062, T-0002-043).
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
          })
          .returning()
        if (!versionRow) throw new Error('project_versions insert returned no row')

        await tx
          .update(projects)
          .set({currentVersionId: versionRow.id})
          .where(eq(projects.id, projectRow.id))

        // Insert the user's original prompt as the first messages row so the
        // chat history table is seeded for future edit/memory features
        // (ADR-0002 §G, T-0002-043). Only insert if the prompt is non-empty.
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

    /**
     * Owner-scoped list. Returns the public-safe shape: id/title/timestamps/
     * currentVersionId/parentProjectId — explicitly NO `specJson`.
     *
     * Per retro-lessons.md `normalizeRow` lesson, omission of `specJson` here
     * is enforced both at the SELECT (we list specific columns) and at the
     * type level (`ProjectListItem` doesn't include it).
     */
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

      // currentVersionId is nullable in the DB schema; the union here would
      // expose null to callers. After `create()` runs in a transaction, it's
      // never null in committed rows, so we narrow to string. T-0001-068
      // verifies that `list` never observes a half-formed row.
      return rows.map(r => ({
        id: r.id,
        title: r.title,
        currentVersionId: r.currentVersionId as string,
        parentProjectId: r.parentProjectId,
        updatedAt: r.updatedAt,
        createdAt: r.createdAt,
      }))
    },

    /**
     * Owner-scoped get. Returns null when the project doesn't exist OR when
     * it exists but isn't owned by the requested user. The route translates
     * null into 404 (T-0001-056, T-0001-065 — 404, NOT 403).
     */
    async get(ownerId: string, projectId: string): Promise<ProjectDetail | null> {
      const projectRows = await db.select().from(projects).where(eq(projects.id, projectId))
      const project = projectRows[0]
      if (!project) return null
      if (project.ownerId !== ownerId) return null
      if (project.currentVersionId === null) {
        // Defensive: `create` always sets this. A null here means a partial
        // write slipped through (shouldn't happen) — treat as not-found.
        return null
      }
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
  }
}

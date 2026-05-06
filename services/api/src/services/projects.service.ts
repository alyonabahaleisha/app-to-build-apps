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

import {A2UISpecSchema, PlanSchema, type A2UINode, type A2UISpec, type Plan} from '@app-creator/a2ui-schema'

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
  /**
   * ADR-0004 Step 4: optional plan artifact from the Plan→Build pipeline.
   * When provided: runtime-validated via PlanSchema.parse() before any DB write.
   * When absent (undefined): plan_json is written as NULL, which is the
   * explicit signal that this version came from the M1 single-call fallback
   * path (ADR-0004 §F-3, §G).
   *
   * Data sensitivity: owner-only. Must NOT be exposed via the public
   * /library/:id response (ADR-0004 §Data Sensitivity, Step 7 enforces this).
   */
  plan?: Plan
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
  /**
   * Look up a single project_versions row by its primary key.
   *
   * Returns null when no row with that versionId exists — does NOT throw.
   * This contract is tested by T-0004-125 (rev-1: closes Step 4 ratio gap).
   *
   * Caller context: owner-gated routes and the pipeline orchestrator (Step 5)
   * use this to load the current plan before re-prompting the planner.
   * planJson is included here (owner-only path; ADR-0004 §G).
   */
  getVersion: (versionId: string) => Promise<ProjectVersion | null>
  /**
   * ADR-0004 Step 7: Apply an edit result to a project.
   *
   * Inside a single transaction:
   *   1. Insert a new project_versions row with the updated spec, render hash,
   *      and the reconstructed/updated plan from the edit pipeline.
   *   2. Update projects.current_version_id to the new version's id.
   *
   * Last-writer-wins on simultaneous edits — both writes succeed but
   * current_version_id ends at the latest committed (T-0004-089).
   *
   * `plan` is always populated for edit-path versions — the planner
   * reconstructs a plan even for legacy versions with plan_json IS NULL.
   */
  applyEdit: (
    projectId: string,
    newSpec: A2UISpec,
    plan: Plan,
  ) => Promise<ProjectDetail>
}

export function createProjectsService(db: Db): ProjectsService {
  return {
    async create({
      ownerId,
      spec,
      parentProjectId,
      originalPrompt = '',
      plan,
    }: CreateProjectInput): Promise<ProjectDetail> {
      // 1. Zod validation — throws ZodError on shape failure (T-0001-055).
      const parsed = A2UISpecSchema.parse(spec)

      // 2. Deep validation — throws ValidationError on depth / unresolved
      //    target / unresolved view (T-0001-130/131/138). BEFORE any DB write.
      deepValidateSpec(parsed)

      // 3. ADR-0004 Step 4: runtime-validate the plan before any DB write.
      //    Fail fast on a structurally invalid plan so we never persist garbage
      //    in plan_json (T-0004-059). When plan is undefined, planJson is NULL.
      const validatedPlan = plan !== undefined ? PlanSchema.parse(plan) : null

      // 4. Cheap derivations.
      const title = deriveTitle(parsed)
      const hash = renderHash(parsed)

      // 5. Transactional write. Insert project with NULL current_version_id,
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
            // NULL signals M1 fallback path; populated when planner ran
            // successfully (ADR-0004 §G).
            planJson: validatedPlan,
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
     *
     * Data sensitivity: `currentVersion` includes `planJson` (owner-only).
     * The public /library/:id route (Step 7) must NOT pass this ProjectDetail
     * shape directly to the response — it must exclude planJson explicitly.
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

    /**
     * Look up a single project_versions row by its primary key.
     *
     * Returns null when no row with that versionId exists — does NOT throw.
     * Contract tested by T-0004-125 (rev-1).
     *
     * Used by the pipeline orchestrator (Step 5) to load the current plan
     * before re-prompting the planner. planJson is owner-only and must not
     * be forwarded to public consumers (ADR-0004 §Data Sensitivity).
     */
    async getVersion(versionId: string): Promise<ProjectVersion | null> {
      const rows = await db
        .select()
        .from(projectVersions)
        .where(eq(projectVersions.id, versionId))
      return rows[0] ?? null
    },

    /**
     * ADR-0004 Step 7: Apply an edit result to a project.
     *
     * Transactional two-step: insert new version row, update project's
     * current_version_id. The plan is always populated (edit pipeline
     * reconstructs a plan even for legacy NULL-plan versions).
     *
     * Returns the updated project + new version. T-0004-089 verifies last-
     * writer-wins: two concurrent calls both insert rows; the final
     * current_version_id is whichever committed last.
     */
    async applyEdit(
      projectId: string,
      newSpec: A2UISpec,
      plan: Plan,
    ): Promise<ProjectDetail> {
      // Validate both artifacts before touching the DB.
      const parsed = A2UISpecSchema.parse(newSpec)
      const validatedPlan = PlanSchema.parse(plan)
      const hash = renderHash(parsed)

      return await db.transaction(async tx => {
        const [versionRow] = await tx
          .insert(projectVersions)
          .values({
            projectId,
            specJson: parsed,
            renderHash: hash,
            planJson: validatedPlan,
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

/**
 * Marketplace service — ADR-0002 Step 5.
 *
 * Four operations:
 *   publish(input)         — flip project visibility=public, optionally setting
 *                            user handle on first publish. Idempotent.
 *   unpublish(input)       — flip visibility=private, set published_at=null.
 *                            Idempotent.
 *   setHandle(input)       — set users.handle once (immutable after first set).
 *   checkHandle(handle)    — availability check; no DB write.
 *
 * Handle validation order in `publish` (per ADR §"Critical correctness notes"):
 *   1. Project exists + owner check → NotFoundError
 *   2. Invalid current_version_id → InvalidStateError (defensive)
 *   3. If body.handle provided: validateHandle() → Invalid | Reserved
 *   4. If no body.handle: check user.handle; null → HandleRequiredError
 *   5. Idempotent check: already public → return early
 *   6. Inside transaction: update users.handle if needed, then update project
 *
 * Data sensitivity:
 *   - author_handle is the public handle, never the raw email.
 *   - No email, no original_prompt in any return value (T-0002-096/097).
 */
import {eq, and, isNull} from 'drizzle-orm'
import type {NodePgDatabase} from 'drizzle-orm/node-postgres'

import * as schema from '../db/schema.js'
import {projects, projectVersions, users} from '../db/schema.js'
import {isReservedHandle} from '../lib/reservedHandles.js'

type Db = NodePgDatabase<typeof schema>

// ---------------------------------------------------------------------------
// Handle validation regex — tightened from spec per ADR §"Notes for Colby" #8.
// Disallows leading/trailing dashes; requires letter/digit at both ends.
// Min length 3: 1 + 1-18 + 1 = 3..20 chars.
// ---------------------------------------------------------------------------
const HANDLE_REGEX = /^[a-z0-9][a-z0-9-]{1,18}[a-z0-9]$/

// ---------------------------------------------------------------------------
// Postgres unique_violation code
// ---------------------------------------------------------------------------
const PG_UNIQUE_VIOLATION = '23505'

// ---------------------------------------------------------------------------
// Domain errors — each carries a `code` for route→error-body mapping.
// ---------------------------------------------------------------------------

export class HandleRequiredError extends Error {
  readonly code = 'handle_required' as const
  constructor() {
    super('handle is required for first publish')
    this.name = 'HandleRequiredError'
  }
}

export class InvalidHandleError extends Error {
  readonly code = 'invalid_handle' as const
  constructor(handle: string) {
    super(`handle '${handle}' does not match required format`)
    this.name = 'InvalidHandleError'
  }
}

export class HandleReservedError extends Error {
  readonly code = 'handle_reserved' as const
  constructor(handle: string) {
    super(`handle '${handle}' is reserved`)
    this.name = 'HandleReservedError'
  }
}

export class HandleTakenError extends Error {
  readonly code = 'handle_taken' as const
  constructor() {
    super('handle is already taken')
    this.name = 'HandleTakenError'
  }
}

export class HandleImmutableError extends Error {
  readonly code = 'handle_immutable' as const
  constructor() {
    super('handle cannot be changed after it is set')
    this.name = 'HandleImmutableError'
  }
}

export class NotFoundError extends Error {
  readonly code = 'not_found' as const
  constructor() {
    super('project not found or not owned by caller')
    this.name = 'NotFoundError'
  }
}

export class InvalidStateError extends Error {
  readonly code = 'invalid_state' as const
  constructor() {
    super('project is in an invalid state (no current version)')
    this.name = 'InvalidStateError'
  }
}

// ---------------------------------------------------------------------------
// Shared handle validation helper
// ---------------------------------------------------------------------------

function validateHandle(handle: string): void {
  if (!HANDLE_REGEX.test(handle)) {
    throw new InvalidHandleError(handle)
  }
  if (isReservedHandle(handle)) {
    throw new HandleReservedError(handle)
  }
}

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

export interface PublishResult {
  project: {
    id: string
    title: string
    visibility: 'public'
    published_at: Date
    author_handle: string
    parent_project_id: string | null
    render_hash: string
  }
}

export interface UnpublishResult {
  project: {
    id: string
    title: string
    visibility: 'private'
    published_at: null
    parent_project_id: string | null
  }
}

export interface SetHandleResult {
  user: {
    id: string
    handle: string
  }
}

export interface CheckHandleResult {
  available: boolean
  reason?: 'taken' | 'reserved' | 'invalid'
}

export interface SuggestHandleResult {
  handle: string
}

/**
 * Derive a handle suggestion from an email local-part. Guarantees the result
 * satisfies HANDLE_REGEX and isn't reserved. Availability against the users
 * table is intentionally NOT checked here — the publish sheet already runs
 * `useHandleCheckQuery` as the user types, and that path is the source of
 * truth for `taken`. This function only has to produce a structurally valid
 * starting point.
 */
export function deriveHandleFromEmail(email: string): string {
  const localPart = email.split('@')[0] ?? ''
  // Lowercase, replace any non-[a-z0-9-] with '-', collapse repeats, trim.
  let candidate = localPart
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 20)
  if (candidate.length < 3 || isReservedHandle(candidate) || !HANDLE_REGEX.test(candidate)) {
    // Fallback: produce a guaranteed-valid handle. Length 9 ('user-' + 4 hex)
    // satisfies regex (3..20) and is unlikely to collide with reserved words.
    const suffix = Math.floor(Math.random() * 0xffff)
      .toString(16)
      .padStart(4, '0')
    candidate = `user-${suffix}`
  }
  return candidate
}

// ---------------------------------------------------------------------------
// Service factory
// ---------------------------------------------------------------------------

export function createMarketplaceService(db: Db) {
  return {
    /**
     * Publish a project. Idempotent — re-publishing an already-public project
     * returns current state with no UPDATE.
     *
     * Validation order (critical for error code precedence):
     *   1. Fetch project + owner check → NotFoundError
     *   2. Zombie guard (current_version_id IS NULL) → InvalidStateError
     *   3. If handle provided: validateHandle → InvalidHandleError | HandleReservedError
     *   4. If no handle: check user.handle; null → HandleRequiredError
     *   5. Idempotent early-return if already public
     *   6. Transaction: update users.handle (if needed) + update project
     */
    async publish(input: {
      userId: string
      projectId: string
      handle?: string
    }): Promise<PublishResult> {
      // 1. Fetch project + owner check in one query (WHERE id AND owner_id).
      //    Zero rows = not found OR not owner; we return the same 404 shape.
      const projectRows = await db
        .select()
        .from(projects)
        .where(and(eq(projects.id, input.projectId), eq(projects.ownerId, input.userId)))

      const project = projectRows[0]
      if (!project) throw new NotFoundError()

      // 2. Zombie guard — current_version_id should always be set after create().
      if (!project.currentVersionId) throw new InvalidStateError()

      // 3. Validate the provided handle (before any DB write).
      if (input.handle !== undefined) {
        validateHandle(input.handle)
      }

      // 4. Fetch user row to check existing handle.
      const userRows = await db.select().from(users).where(eq(users.id, input.userId))
      const user = userRows[0]
      if (!user) throw new NotFoundError() // Defensive: user should always exist

      // If no handle provided: require existing user handle.
      if (input.handle === undefined && user.handle === null) {
        throw new HandleRequiredError()
      }

      // 5. Idempotent: already public → return current state without UPDATE.
      if (project.visibility === 'public') {
        // Fetch the render_hash from the current project version.
        const versionRows = await db
          .select({renderHash: projectVersions.renderHash})
          .from(projectVersions)
          .where(eq(projectVersions.id, project.currentVersionId))
        const version = versionRows[0]
        if (!version) throw new InvalidStateError()

        const authorHandle = user.handle ?? (input.handle as string)
        return {
          project: {
            id: project.id,
            title: project.title,
            visibility: 'public',
            // published_at is non-null when visibility='public' (enforced by
            // the UPDATE below on first publish).
            published_at: project.publishedAt as Date,
            author_handle: authorHandle,
            parent_project_id: project.parentProjectId,
            render_hash: version.renderHash,
          },
        }
      }

      // 6. Transaction: update handle (if needed) + flip project visibility.
      const authorHandle = await db.transaction(async tx => {
        // Set handle if the user doesn't have one yet and a new one is provided.
        let finalHandle: string
        if (user.handle === null && input.handle !== undefined) {
          try {
            await tx
              .update(users)
              .set({handle: input.handle})
              .where(and(eq(users.id, input.userId), isNull(users.handle)))
          } catch (err: unknown) {
            const pgErr = err as {code?: string}
            if (pgErr.code === PG_UNIQUE_VIOLATION) {
              throw new HandleTakenError()
            }
            throw err
          }
          finalHandle = input.handle
        } else {
          // User already has a handle — use it.
          finalHandle = user.handle as string
        }

        // Flip visibility to 'public'. WHERE guard: only update if still private
        // (handles concurrent same-user same-project publish: idempotent once
        // committed; per ADR "Concurrent same-user same-project publish" note).
        await tx
          .update(projects)
          .set({
            visibility: 'public',
            publishedAt: new Date(),
          })
          .where(and(eq(projects.id, input.projectId), eq(projects.visibility, 'private')))

        return finalHandle
      })

      // Fetch version for render_hash (outside transaction — project is now public).
      const versionRows = await db
        .select({renderHash: projectVersions.renderHash})
        .from(projectVersions)
        .where(eq(projectVersions.id, project.currentVersionId))
      const version = versionRows[0]
      if (!version) throw new InvalidStateError()

      // Re-fetch project to get the fresh published_at value.
      const updatedRows = await db.select().from(projects).where(eq(projects.id, input.projectId))
      const updatedProject = updatedRows[0]
      if (!updatedProject) throw new NotFoundError()

      return {
        project: {
          id: updatedProject.id,
          title: updatedProject.title,
          visibility: 'public',
          published_at: updatedProject.publishedAt as Date,
          author_handle: authorHandle,
          parent_project_id: updatedProject.parentProjectId,
          render_hash: version.renderHash,
        },
      }
    },

    /**
     * Unpublish a project. Idempotent — unpublishing an already-private project
     * returns current state with no UPDATE.
     */
    async unpublish(input: {userId: string; projectId: string}): Promise<UnpublishResult> {
      const projectRows = await db
        .select()
        .from(projects)
        .where(and(eq(projects.id, input.projectId), eq(projects.ownerId, input.userId)))

      const project = projectRows[0]
      if (!project) throw new NotFoundError()

      // Idempotent: already private → return current state.
      if (project.visibility === 'private') {
        return {
          project: {
            id: project.id,
            title: project.title,
            visibility: 'private',
            published_at: null,
            parent_project_id: project.parentProjectId,
          },
        }
      }

      // Flip back to private.
      await db
        .update(projects)
        .set({visibility: 'private', publishedAt: null})
        .where(and(eq(projects.id, input.projectId), eq(projects.visibility, 'public')))

      return {
        project: {
          id: project.id,
          title: project.title,
          visibility: 'private',
          published_at: null,
          parent_project_id: project.parentProjectId,
        },
      }
    },

    /**
     * Set a user's handle for the first time. Immutable after first set.
     *
     * Checks immutability before UPDATE so even concurrent calls from the same
     * user get a meaningful HandleImmutableError (not a unique violation) if the
     * handle is already set.
     */
    async setHandle(input: {userId: string; handle: string}): Promise<SetHandleResult> {
      validateHandle(input.handle)

      // Read current handle state.
      const userRows = await db.select().from(users).where(eq(users.id, input.userId))
      const user = userRows[0]
      if (!user) throw new NotFoundError()

      // Immutability check — before any write.
      if (user.handle !== null) {
        throw new HandleImmutableError()
      }

      // UPDATE scoped to null-handle users only. Use .returning() to detect
      // zero-rows-affected: if another concurrent call from the same user set
      // the handle between our read and our write, the WHERE handle IS NULL no
      // longer matches — treat that as HandleImmutableError, not a silent win.
      let updatedRows: {id: string}[]
      try {
        updatedRows = await db
          .update(users)
          .set({handle: input.handle})
          .where(and(eq(users.id, input.userId), isNull(users.handle)))
          .returning({id: users.id})
      } catch (err: unknown) {
        const pgErr = err as {code?: string}
        if (pgErr.code === PG_UNIQUE_VIOLATION) {
          throw new HandleTakenError()
        }
        throw err
      }

      // Zero rows: handle was set between our read and this write (race).
      if (updatedRows.length === 0) {
        throw new HandleImmutableError()
      }

      return {
        user: {
          id: input.userId,
          handle: input.handle,
        },
      }
    },

    /**
     * Availability check. No DB write; one read for taken-check.
     * Returns immediately for invalid or reserved handles (no DB hit needed).
     */
    async checkHandle(handle: string): Promise<CheckHandleResult> {
      // Invalid format — no DB needed.
      if (!HANDLE_REGEX.test(handle)) {
        return {available: false, reason: 'invalid'}
      }

      // Reserved — no DB needed.
      if (isReservedHandle(handle)) {
        return {available: false, reason: 'reserved'}
      }

      // Check DB for taken.
      const rows = await db.select({id: users.id}).from(users).where(eq(users.handle, handle))

      if (rows.length > 0) {
        return {available: false, reason: 'taken'}
      }

      return {available: true}
    },

    /**
     * Suggest a handle for the authenticated user. If they already have one,
     * return it (idempotent — caller can use the response to show their
     * current handle on the sheet). Otherwise derive from email.
     */
    async suggestHandle(input: {userId: string}): Promise<SuggestHandleResult> {
      const rows = await db
        .select({handle: users.handle, email: users.email})
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1)
      const user = rows[0]
      if (!user) {
        // Auth'd request from requireAuth — user row must exist. Defensive path
        // covers the JWT-valid-but-row-deleted edge.
        throw new NotFoundError()
      }
      if (user.handle) {
        return {handle: user.handle}
      }
      return {handle: deriveHandleFromEmail(user.email)}
    },
  }
}

export type MarketplaceService = ReturnType<typeof createMarketplaceService>

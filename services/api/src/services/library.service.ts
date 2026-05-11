/**
 * Library service — ADR-0002 Step 6.
 *
 * Two read-only operations:
 *   list({cursor, limit}) — paginated public project feed, ordered by
 *                           (published_at DESC, id DESC). Cursor is opaque
 *                           base64url JSON. Limit 1..50, default 20.
 *   get(projectId)        — public project detail; returns null for private
 *                           or non-existent projects (route → 404).
 *
 * Data sensitivity:
 *   - No email, owner_id anywhere in return types.
 *   - list: no spec_json, no original_prompt.
 *   - get: spec_json exposed (needed for remix flow); original_prompt exposed
 *     (per AC-CG-P6); email + owner_id never returned.
 *
 * Security notes:
 *   - Visibility filter is on EVERY query. A private project must never appear
 *     in any return value regardless of call path.
 *   - Author handles are from INNER JOIN users — rows without a handle have
 *     no matching join row. An explicit WHERE au.handle IS NOT NULL ensures
 *     defense-in-depth (T-0002-100).
 *   - Parent handle null-check: if parent.author_handle is null we treat
 *     parent as null rather than exposing a half-built object.
 *
 * Implementation note on Drizzle multi-alias joins:
 *   Drizzle v0.36's TypeScript inference narrows the result to `never` when
 *   more than ~3 aliased tables are joined via the fluent API (a known
 *   limitation). We use `db.execute(sql`...`)` with explicit typed row shapes
 *   to avoid this — the SQL is exactly what the ADR specified and the planner
 *   still uses the partial index.
 */
import {sql} from 'drizzle-orm'
import type {NodePgDatabase} from 'drizzle-orm/node-postgres'

import * as schema from '../db/schema.js'

type Db = NodePgDatabase<typeof schema>

// ---------------------------------------------------------------------------
// Domain error
// ---------------------------------------------------------------------------

export class InvalidCursorError extends Error {
  readonly code = 'invalid_cursor' as const
  constructor() {
    super('cursor is malformed or expired')
    this.name = 'InvalidCursorError'
  }
}

// ---------------------------------------------------------------------------
// Return types — explicit omissions are load-bearing (retro-lessons normalizeRow)
// ---------------------------------------------------------------------------

export interface LibraryParent {
  id: string
  author_handle: string
  title: string
}

export interface LibraryListItem {
  id: string
  title: string
  author_handle: string
  published_at: Date
  render_hash: string
  parent: LibraryParent | null
}

export interface LibraryListResult {
  items: LibraryListItem[]
  next_cursor: string | null
}

export interface LibraryDetailResult {
  project: {
    id: string
    title: string
    author_handle: string
    published_at: Date
    original_prompt: string
    parent: LibraryParent | null
  }
  current_version: {
    id: string
    spec_json: unknown
    render_hash: string
    created_at: Date
  }
}

// ---------------------------------------------------------------------------
// Raw row types from SQL queries
// ---------------------------------------------------------------------------

interface ListRow extends Record<string, unknown> {
  id: string
  title: string
  published_at: Date
  author_handle: string | null
  render_hash: string
  parent_id: string | null
  parent_title: string | null
  parent_author_handle: string | null
}

interface DetailRow extends Record<string, unknown> {
  id: string
  title: string
  visibility: string
  published_at: Date | null
  original_prompt: string
  author_handle: string | null
  version_id: string
  spec_json: unknown
  render_hash: string
  version_created_at: Date
  parent_id: string | null
  parent_title: string | null
  parent_author_handle: string | null
}

// ---------------------------------------------------------------------------
// Cursor helpers — opaque base64url JSON payload
// ---------------------------------------------------------------------------

interface CursorPayload {
  published_at: Date
  project_id: string
}

/**
 * Encode a cursor from the last-returned item's (published_at, id) tuple.
 * The output is a base64url string safe for query strings.
 */
export function encodeCursor(item: {published_at: Date; project_id: string}): string {
  return Buffer.from(
    JSON.stringify({
      published_at: item.published_at.toISOString(),
      project_id: item.project_id,
    }),
  ).toString('base64url')
}

/**
 * Decode an opaque cursor. Throws InvalidCursorError on any malformation:
 * non-base64url input, non-JSON, missing fields, bad date.
 */
export function decodeCursor(s: string): CursorPayload {
  let obj: unknown
  try {
    obj = JSON.parse(Buffer.from(s, 'base64url').toString('utf8'))
  } catch {
    throw new InvalidCursorError()
  }

  const cast = obj as Record<string, unknown>
  if (typeof cast?.published_at !== 'string' || typeof cast?.project_id !== 'string') {
    throw new InvalidCursorError()
  }

  const date = new Date(cast.published_at as string)
  if (isNaN(date.getTime())) throw new InvalidCursorError()

  return {
    published_at: date,
    project_id: cast.project_id as string,
  }
}

// ---------------------------------------------------------------------------
// Service factory
// ---------------------------------------------------------------------------

export function createLibraryService(db: Db) {
  return {
    /**
     * Paginated public project list.
     *
     * ORDER: (published_at DESC, id DESC) — stable because id is UUID unique
     * within the same published_at value.
     *
     * CURSOR: tuple comparison (published_at, id) < (cursor.published_at,
     * cursor.project_id) implemented as raw SQL so the planner can use the
     * partial index projects_library_idx on (visibility, published_at DESC, id).
     *
     * LIMIT+1 trick: fetch limit+1 rows. If result len > limit, slice to
     * limit and encode next_cursor from the last returned row. Otherwise
     * next_cursor = null.
     *
     * Self-join rationale:
     *   - INNER JOIN users au ON p.owner_id = au.id AND au.handle IS NOT NULL
     *       → excludes projects whose author has no handle (data integrity)
     *   - INNER JOIN project_versions pv ON p.current_version_id = pv.id
     *       → render_hash for list card
     *   - LEFT JOIN projects parent ON p.parent_project_id = parent.id
     *   - LEFT JOIN users pau ON parent.owner_id = pau.id AND pau.handle IS NOT NULL
     *       → parent attribution; null handle → parent treated as null
     */
    async list({cursor, limit}: {cursor?: string; limit: number}): Promise<LibraryListResult> {
      const decoded = cursor ? decodeCursor(cursor) : null

      let rows: ListRow[]
      if (decoded) {
        const result = await db.execute<ListRow>(sql`
          SELECT
            p.id,
            p.title,
            p.published_at,
            au.handle       AS author_handle,
            pv.render_hash,
            parent.id       AS parent_id,
            parent.title    AS parent_title,
            pau.handle      AS parent_author_handle
          FROM mini_apps p
          INNER JOIN users au
            ON au.id = p.owner_id
           AND au.handle IS NOT NULL
          INNER JOIN mini_app_versions pv
            ON pv.id = p.current_version_id
          LEFT JOIN mini_apps parent
            ON parent.id = p.parent_mini_app_id
          LEFT JOIN users pau
            ON pau.id = parent.owner_id
           AND pau.handle IS NOT NULL
          WHERE p.visibility = 'public'
            AND p.deleted_at IS NULL
            AND (p.published_at, p.id) < (${decoded.published_at.toISOString()}::timestamptz, ${decoded.project_id}::uuid)
          ORDER BY p.published_at DESC, p.id DESC
          LIMIT ${limit + 1}
        `)
        rows = result.rows as ListRow[]
      } else {
        const result = await db.execute<ListRow>(sql`
          SELECT
            p.id,
            p.title,
            p.published_at,
            au.handle       AS author_handle,
            pv.render_hash,
            parent.id       AS parent_id,
            parent.title    AS parent_title,
            pau.handle      AS parent_author_handle
          FROM mini_apps p
          INNER JOIN users au
            ON au.id = p.owner_id
           AND au.handle IS NOT NULL
          INNER JOIN mini_app_versions pv
            ON pv.id = p.current_version_id
          LEFT JOIN mini_apps parent
            ON parent.id = p.parent_mini_app_id
          LEFT JOIN users pau
            ON pau.id = parent.owner_id
           AND pau.handle IS NOT NULL
          WHERE p.visibility = 'public'
            AND p.deleted_at IS NULL
          ORDER BY p.published_at DESC, p.id DESC
          LIMIT ${limit + 1}
        `)
        rows = result.rows as ListRow[]
      }

      const hasMore = rows.length > limit
      const items = hasMore ? rows.slice(0, limit) : rows

      const lastItem = items[items.length - 1]
      const next_cursor =
        hasMore && lastItem
          ? encodeCursor({
              published_at: new Date(lastItem.published_at),
              project_id: lastItem.id,
            })
          : null

      return {
        items: items.map(row => ({
          id: row.id,
          title: row.title,
          author_handle: row.author_handle as string,
          published_at: new Date(row.published_at),
          render_hash: row.render_hash,
          parent:
            row.parent_id !== null && row.parent_author_handle !== null
              ? {
                  id: row.parent_id,
                  author_handle: row.parent_author_handle,
                  title: row.parent_title as string,
                }
              : null,
        })),
        next_cursor,
      }
    },

    /**
     * Fetch a single public project with its current version.
     *
     * Returns null if:
     *  - the project does not exist
     *  - the project exists but visibility !== 'public'
     *
     * The route converts null to 404 without leaking existence (T-0002-106,
     * T-0002-107, T-0002-120 — even if the caller owns the project).
     *
     * original_prompt is included here per AC-CG-P6 (needed by the remix
     * flow on mobile). It is intentionally absent from the list endpoint.
     */
    async get(projectId: string): Promise<LibraryDetailResult | null> {
      const result = await db.execute<DetailRow>(sql`
        SELECT
          p.id,
          p.title,
          p.visibility,
          p.published_at,
          p.original_prompt,
          au.handle       AS author_handle,
          pv.id           AS version_id,
          pv.spec_json,
          pv.render_hash,
          pv.created_at   AS version_created_at,
          parent.id       AS parent_id,
          parent.title    AS parent_title,
          pau.handle      AS parent_author_handle
        FROM mini_apps p
        INNER JOIN users au
          ON au.id = p.owner_id
         AND au.handle IS NOT NULL
        INNER JOIN mini_app_versions pv
          ON pv.id = p.current_version_id
        LEFT JOIN mini_apps parent
          ON parent.id = p.parent_mini_app_id
        LEFT JOIN users pau
          ON pau.id = parent.owner_id
         AND pau.handle IS NOT NULL
        WHERE p.id = ${projectId}
          AND p.visibility = 'public'
          AND p.deleted_at IS NULL
      `)

      const rows: DetailRow[] = result.rows as DetailRow[]
      const row = rows[0]
      if (!row) return null

      // Defense: visibility is enforced in WHERE, but narrow the type.
      if (row.visibility !== 'public') return null

      return {
        project: {
          id: row.id,
          title: row.title,
          author_handle: row.author_handle as string,
          published_at: new Date(row.published_at as Date),
          original_prompt: row.original_prompt,
          parent:
            row.parent_id !== null && row.parent_author_handle !== null
              ? {
                  id: row.parent_id,
                  author_handle: row.parent_author_handle,
                  title: row.parent_title as string,
                }
              : null,
        },
        current_version: {
          id: row.version_id,
          spec_json: row.spec_json,
          render_hash: row.render_hash,
          created_at: new Date(row.version_created_at),
        },
      }
    },
  }
}

export type LibraryService = ReturnType<typeof createLibraryService>

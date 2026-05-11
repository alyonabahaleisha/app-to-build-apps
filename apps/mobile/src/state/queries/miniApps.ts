/**
 * MiniApps domain — TanStack Query hooks for the user's mini-app list,
 * individual detail, and write mutations (rename, archive, delete).
 *
 * ADR-0011 Step 4: renamed from state/queries/projects.ts. All endpoints
 * updated from /me/projects → /me/mini-apps. Query-cache keys updated.
 * Old Project* types deleted — no aliases.
 *
 * Wire-protocol note:
 *   The server sends camelCase JSON (parentMiniAppId, not parent_project_id).
 *   The mobile parser validates and maps verbatim from the server shape.
 *
 * Defense-in-depth shape validation:
 *   Parsers throw typed error classes on mismatch — TanStack Query
 *   propagates the throw into the `error` slot of the query result.
 *
 * Mutation pattern (CLAUDE.md §2):
 *   All write hooks implement the previous-snapshot optimistic-update
 *   pattern: onMutate cancels in-flight queries + saves snapshot;
 *   onError restores; onSettled invalidates.
 *
 * Closed enums (T-0011-078, T-0011-093, T-0011-094):
 *   syncMode: 'local' | 'cloud-private'
 *   archetype: 'unknown' | 'productivity' | 'entertainment' | 'social' | 'finance' | 'health'
 *   (v0.5 archetypes like 'dashboard' are NOT valid in V0)
 */
import {useMutation, useQuery, useQueryClient, type UseQueryResult} from '@tanstack/react-query'

import {apiFetch} from '#/lib/api'
import {logger, safeMessage} from '#/logger'
import {createQueryKey, STALE} from '#/state/queries/util'

// -- Closed enums --------------------------------------------------------------

const VALID_SYNC_MODES = ['local', 'cloud-private'] as const
export type SyncMode = (typeof VALID_SYNC_MODES)[number]

// V0 valid archetypes only — T-0011-094 asserts 'dashboard' is rejected
const VALID_ARCHETYPES = [
  'unknown',
  'productivity',
  'entertainment',
  'social',
  'finance',
  'health',
] as const
export type Archetype = (typeof VALID_ARCHETYPES)[number]

// -- Public types --------------------------------------------------------------

export interface MiniApp {
  id: string
  title: string
  updatedAt: string
  createdAt: string
  currentVersionId: string
  /** Nullable — null means "created from scratch", non-null means cloned. */
  parentMiniAppId: string | null
  stance: string
  accentPalette: string
  coverArtSeed: string
  archetype: Archetype
  syncMode: SyncMode
}

export interface MiniAppDetail {
  miniApp: {
    id: string
    /** T-0011-092: ownerId present in server response but never surfaced by
     * the detail parser — defensive shape, auth-only concern. */
    title: string
    currentVersionId: string
    parentMiniAppId: string | null
    stance: string
    accentPalette: string
    coverArtSeed: string
    archetype: Archetype
    syncMode: SyncMode
    archivedAt: string | null
    createdAt: string
    updatedAt: string
  }
  currentVersion: {
    id: string
    miniAppId: string
    specJson: unknown
    renderHash: string
    createdAt: string
  }
}

// -- Errors -------------------------------------------------------------------

export class MiniAppListShapeError extends Error {
  readonly issue: string
  constructor(issue: string) {
    super(`miniApps/list: shape mismatch — ${issue}`)
    this.name = 'MiniAppListShapeError'
    this.issue = issue
  }
}

export class MiniAppDetailShapeError extends Error {
  readonly issue: string
  constructor(issue: string) {
    super(`miniApps/detail: shape mismatch — ${issue}`)
    this.name = 'MiniAppDetailShapeError'
    this.issue = issue
  }
}

// -- Query keys ----------------------------------------------------------------

export const miniAppsKeys = {
  all: () => createQueryKey('miniApps'),
  list: () => createQueryKey('miniApps', 'list'),
  detail: (id: string) => createQueryKey('miniApps', 'detail', {id}),
} as const

// -- Validator helpers ---------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isStringField(o: Record<string, unknown>, key: string): boolean {
  return typeof o[key] === 'string'
}

function parseSyncMode(raw: unknown, ctx: string): SyncMode {
  if (typeof raw !== 'string' || !(VALID_SYNC_MODES as readonly string[]).includes(raw)) {
    throw new MiniAppListShapeError(`${ctx}.syncMode not in closed-enum, got: ${String(raw)}`)
  }
  return raw as SyncMode
}

function parseArchetype(raw: unknown, ctx: string): Archetype {
  if (typeof raw !== 'string' || !(VALID_ARCHETYPES as readonly string[]).includes(raw)) {
    throw new MiniAppListShapeError(`${ctx}.archetype not in closed-enum, got: ${String(raw)}`)
  }
  return raw as Archetype
}

function parseDetailSyncMode(raw: unknown, ctx: string): SyncMode {
  if (typeof raw !== 'string' || !(VALID_SYNC_MODES as readonly string[]).includes(raw)) {
    throw new MiniAppDetailShapeError(`${ctx}.syncMode not in closed-enum, got: ${String(raw)}`)
  }
  return raw as SyncMode
}

function parseDetailArchetype(raw: unknown, ctx: string): Archetype {
  if (typeof raw !== 'string' || !(VALID_ARCHETYPES as readonly string[]).includes(raw)) {
    throw new MiniAppDetailShapeError(`${ctx}.archetype not in closed-enum, got: ${String(raw)}`)
  }
  return raw as Archetype
}

// -- List response parser ------------------------------------------------------

/**
 * Parse GET /me/mini-apps → `MiniApp[]`. Throws `MiniAppListShapeError`
 * on shape mismatch. Exported for direct unit testing.
 *
 * T-0011-072..T-0011-096.
 */
export function parseMiniAppListResponse(raw: unknown): MiniApp[] {
  if (!isObject(raw)) {
    throw new MiniAppListShapeError('response is not an object')
  }
  const miniApps = raw.miniApps
  if (!Array.isArray(miniApps)) {
    throw new MiniAppListShapeError('"miniApps" is not an array')
  }
  const out: MiniApp[] = []
  for (let i = 0; i < miniApps.length; i++) {
    const m = miniApps[i] as unknown
    if (!isObject(m)) {
      throw new MiniAppListShapeError(`miniApps[${i}] is not an object`)
    }
    const ctx = `miniApps[${i}]`
    if (!isStringField(m, 'id') || !UUID_RE.test(m.id as string)) {
      throw new MiniAppListShapeError(`${ctx}.id missing or not uuid`)
    }
    if (!isStringField(m, 'title')) {
      throw new MiniAppListShapeError(`${ctx}.title missing`)
    }
    if (!isStringField(m, 'updatedAt')) {
      throw new MiniAppListShapeError(`${ctx}.updatedAt missing`)
    }
    if (!isStringField(m, 'createdAt')) {
      throw new MiniAppListShapeError(`${ctx}.createdAt missing`)
    }
    if (!isStringField(m, 'currentVersionId') || !UUID_RE.test(m.currentVersionId as string)) {
      throw new MiniAppListShapeError(`${ctx}.currentVersionId missing or not uuid`)
    }
    // parentMiniAppId nullable: accept null or uuid string
    const parent = m.parentMiniAppId
    if (parent !== null && parent !== undefined) {
      if (typeof parent !== 'string' || !UUID_RE.test(parent)) {
        throw new MiniAppListShapeError(`${ctx}.parentMiniAppId not uuid or null`)
      }
    }
    // New fields — T-0011-073..T-0011-078
    if (!isStringField(m, 'stance')) {
      throw new MiniAppListShapeError(`${ctx}.stance missing`)
    }
    if (!isStringField(m, 'accentPalette')) {
      throw new MiniAppListShapeError(`${ctx}.accentPalette missing`)
    }
    if (!isStringField(m, 'coverArtSeed')) {
      throw new MiniAppListShapeError(`${ctx}.coverArtSeed missing`)
    }
    const archetype = parseArchetype(m.archetype, ctx)
    const syncMode = parseSyncMode(m.syncMode, ctx)

    out.push({
      id: m.id as string,
      title: m.title as string,
      updatedAt: m.updatedAt as string,
      createdAt: m.createdAt as string,
      currentVersionId: m.currentVersionId as string,
      parentMiniAppId: typeof parent === 'string' ? parent : null,
      stance: m.stance as string,
      accentPalette: m.accentPalette as string,
      coverArtSeed: m.coverArtSeed as string,
      archetype,
      syncMode,
    })
  }
  return out
}

// -- Detail response parser ---------------------------------------------------

/**
 * Parse GET /me/mini-apps/:id → `MiniAppDetail`. Throws
 * `MiniAppDetailShapeError` on shape mismatch. Exported for unit testing.
 *
 * T-0011-080: throws on missing miniApp.stance.
 * T-0011-092: ownerId is present in the server body but intentionally NOT
 * surfaced in the returned `MiniAppDetail.miniApp` shape (auth-only field —
 * retro-lessons.md normalizeRow lesson).
 */
export function parseMiniAppDetailResponse(raw: unknown): MiniAppDetail {
  if (!isObject(raw)) {
    throw new MiniAppDetailShapeError('response is not an object')
  }
  if (!isObject(raw.miniApp)) {
    throw new MiniAppDetailShapeError('"miniApp" is not an object')
  }
  if (!isObject(raw.currentVersion)) {
    throw new MiniAppDetailShapeError('"currentVersion" is not an object')
  }
  const m = raw.miniApp
  const v = raw.currentVersion

  if (!isStringField(m, 'id') || !UUID_RE.test(m.id as string)) {
    throw new MiniAppDetailShapeError('miniApp.id missing or not uuid')
  }
  if (!isStringField(m, 'title')) {
    throw new MiniAppDetailShapeError('miniApp.title missing')
  }
  if (!isStringField(m, 'currentVersionId') || !UUID_RE.test(m.currentVersionId as string)) {
    throw new MiniAppDetailShapeError('miniApp.currentVersionId missing or not uuid')
  }
  const parent = m.parentMiniAppId
  if (parent !== null && parent !== undefined) {
    if (typeof parent !== 'string' || !UUID_RE.test(parent)) {
      throw new MiniAppDetailShapeError('miniApp.parentMiniAppId not uuid or null')
    }
  }
  if (!isStringField(m, 'stance')) {
    throw new MiniAppDetailShapeError('miniApp.stance missing')
  }
  if (!isStringField(m, 'accentPalette')) {
    throw new MiniAppDetailShapeError('miniApp.accentPalette missing')
  }
  if (!isStringField(m, 'coverArtSeed')) {
    throw new MiniAppDetailShapeError('miniApp.coverArtSeed missing')
  }
  if (!isStringField(m, 'createdAt')) {
    throw new MiniAppDetailShapeError('miniApp.createdAt missing')
  }
  if (!isStringField(m, 'updatedAt')) {
    throw new MiniAppDetailShapeError('miniApp.updatedAt missing')
  }
  const archetype = parseDetailArchetype(m.archetype, 'miniApp')
  const syncMode = parseDetailSyncMode(m.syncMode, 'miniApp')

  // archivedAt: nullable ISO string or null
  const archivedAt =
    typeof m.archivedAt === 'string' ? m.archivedAt : null

  if (!isStringField(v, 'id') || !UUID_RE.test(v.id as string)) {
    throw new MiniAppDetailShapeError('currentVersion.id missing or not uuid')
  }
  if (!isStringField(v, 'miniAppId') || !UUID_RE.test(v.miniAppId as string)) {
    throw new MiniAppDetailShapeError('currentVersion.miniAppId missing or not uuid')
  }
  if (!isStringField(v, 'renderHash')) {
    throw new MiniAppDetailShapeError('currentVersion.renderHash missing')
  }
  if (!isStringField(v, 'createdAt')) {
    throw new MiniAppDetailShapeError('currentVersion.createdAt missing')
  }

  return {
    miniApp: {
      // T-0011-092: ownerId intentionally omitted from returned shape
      id: m.id as string,
      title: m.title as string,
      currentVersionId: m.currentVersionId as string,
      parentMiniAppId: typeof parent === 'string' ? parent : null,
      stance: m.stance as string,
      accentPalette: m.accentPalette as string,
      coverArtSeed: m.coverArtSeed as string,
      archetype,
      syncMode,
      archivedAt,
      createdAt: m.createdAt as string,
      updatedAt: m.updatedAt as string,
    },
    currentVersion: {
      id: v.id as string,
      miniAppId: v.miniAppId as string,
      specJson: v.specJson,
      renderHash: v.renderHash as string,
      createdAt: v.createdAt as string,
    },
  }
}

// -- Query hooks --------------------------------------------------------------

/**
 * `useMiniAppsListQuery` — fetches GET /me/mini-apps, validates shape,
 * returns `MiniApp[]` sorted by `updatedAt DESC` (server sorts).
 * T-0011-072, T-0011-091.
 */
export function useMiniAppsListQuery(): UseQueryResult<MiniApp[], Error> {
  return useQuery<MiniApp[], Error>({
    queryKey: miniAppsKeys.list(),
    queryFn: async () => {
      const data = await apiFetch<unknown>('/me/mini-apps')
      return parseMiniAppListResponse(data)
    },
    staleTime: STALE.MINUTES(5), // T-0011-091
    retry: false,
  })
}

/**
 * `useMiniAppQuery` — fetches GET /me/mini-apps/:id, validates shape,
 * returns `MiniAppDetail`. Returns 404 errors as query errors.
 * When `miniAppId` is undefined, the query is disabled (T-0011-095).
 */
export function useMiniAppQuery(
  miniAppId: string | undefined,
): UseQueryResult<MiniAppDetail, Error> {
  return useQuery<MiniAppDetail, Error>({
    queryKey: miniAppsKeys.detail(miniAppId ?? ''),
    queryFn: async () => {
      const data = await apiFetch<unknown>(`/me/mini-apps/${miniAppId}`)
      return parseMiniAppDetailResponse(data)
    },
    staleTime: STALE.MINUTES(5),
    retry: false,
    enabled: !!miniAppId, // T-0011-095
  })
}

// -- Mutation hooks -----------------------------------------------------------

interface RenameInput {
  id: string
  title: string
}

/**
 * `useRenameMiniAppMutation` — POST /me/mini-apps/:id/rename.
 *
 * Implements the optimistic-update pattern (CLAUDE.md §2):
 *   - onMutate: cancel + snapshot + optimistic title update in list cache
 *   - onError: restore snapshot
 *   - onSettled: invalidate list + detail
 *
 * T-0011-081..T-0011-084, T-0011-096.
 */
export function useRenameMiniAppMutation() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, RenameInput>({
    mutationFn: async ({id, title}) => {
      return apiFetch(`/me/mini-apps/${id}/rename`, {
        method: 'POST',
        body: JSON.stringify({title}),
      })
    },
    onMutate: async ({id, title}) => {
      await qc.cancelQueries({queryKey: miniAppsKeys.list()})
      const previous = qc.getQueryData<MiniApp[]>(miniAppsKeys.list())
      qc.setQueryData<MiniApp[]>(miniAppsKeys.list(), old =>
        old?.map(m => (m.id === id ? {...m, title} : m)) ?? old,
      )
      return {previous}
    },
    onError: (err, _vars, ctx) => {
      const context = ctx as {previous?: MiniApp[]} | undefined
      if (context?.previous !== undefined) {
        qc.setQueryData(miniAppsKeys.list(), context.previous)
      }
      // T-0011-096: log network errors via safeMessage
      logger.error('Rename mutation failed', {safeMessage: safeMessage(err)})
    },
    onSettled: (_data, _err, vars) => {
      void qc.invalidateQueries({queryKey: miniAppsKeys.list()})
      void qc.invalidateQueries({queryKey: miniAppsKeys.detail(vars.id)})
    },
    retry: false,
  })
}

/**
 * `useArchiveMiniAppMutation` — POST /me/mini-apps/:id/archive.
 *
 * Optimistically removes the archived row from the list cache since
 * GET /me/mini-apps excludes archived rows by default (T-0011-085).
 */
export function useArchiveMiniAppMutation() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, {id: string}>({
    mutationFn: async ({id}) => {
      return apiFetch(`/me/mini-apps/${id}/archive`, {method: 'POST'})
    },
    onMutate: async ({id}) => {
      await qc.cancelQueries({queryKey: miniAppsKeys.list()})
      const previous = qc.getQueryData<MiniApp[]>(miniAppsKeys.list())
      qc.setQueryData<MiniApp[]>(miniAppsKeys.list(), old => old?.filter(m => m.id !== id) ?? old)
      return {previous}
    },
    onError: (_err, _vars, ctx) => {
      const context = ctx as {previous?: MiniApp[]} | undefined
      if (context?.previous !== undefined) {
        qc.setQueryData(miniAppsKeys.list(), context.previous)
      }
    },
    onSettled: () => {
      void qc.invalidateQueries({queryKey: miniAppsKeys.list()})
    },
    retry: false,
  })
}

/**
 * `useDeleteMiniAppMutation` — DELETE /me/mini-apps/:id.
 *
 * Optimistically removes the row from the list cache (T-0011-086).
 * Restores on 4xx (T-0011-087).
 */
export function useDeleteMiniAppMutation() {
  const qc = useQueryClient()
  return useMutation<unknown, Error, {id: string}>({
    mutationFn: async ({id}) => {
      return apiFetch(`/me/mini-apps/${id}`, {method: 'DELETE'})
    },
    onMutate: async ({id}) => {
      await qc.cancelQueries({queryKey: miniAppsKeys.list()})
      const previous = qc.getQueryData<MiniApp[]>(miniAppsKeys.list())
      qc.setQueryData<MiniApp[]>(miniAppsKeys.list(), old => old?.filter(m => m.id !== id) ?? old)
      return {previous}
    },
    onError: (_err, _vars, ctx) => {
      const context = ctx as {previous?: MiniApp[]} | undefined
      if (context?.previous !== undefined) {
        qc.setQueryData(miniAppsKeys.list(), context.previous)
      }
    },
    onSettled: () => {
      void qc.invalidateQueries({queryKey: miniAppsKeys.list()})
    },
    retry: false,
  })
}

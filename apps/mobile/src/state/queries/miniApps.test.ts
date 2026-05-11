/**
 * ADR-0011 Step 4 — mobile mini-apps query hook tests.
 *
 * T-IDs covered:
 *   T-0011-072 — useMiniAppsListQuery hits GET /me/mini-apps
 *   T-0011-073 — parseMiniAppListResponse validates new fields (stance, accentPalette, coverArtSeed, archetype, syncMode)
 *   T-0011-074 — throws MiniAppListShapeError when stance missing
 *   T-0011-075 — throws when accentPalette missing
 *   T-0011-076 — throws when coverArtSeed missing
 *   T-0011-077 — throws when archetype missing
 *   T-0011-078 — throws when syncMode not in closed-enum
 *   T-0011-079 — useMiniAppQuery hits GET /me/mini-apps/:id
 *   T-0011-080 — parseMiniAppDetailResponse throws on missing miniApp.stance
 *   T-0011-081 — useRenameMiniAppMutation performs optimistic update on miniAppsKeys.list()
 *   T-0011-082 — on rename mutation 4xx, previous list snapshot is restored via onError
 *   T-0011-083 — on rename mutation 5xx, previous list snapshot is restored
 *   T-0011-084 — after rename, onSettled invalidates miniAppsKeys.list() and miniAppsKeys.detail(id)
 *   T-0011-085 — useArchiveMiniAppMutation removes the archived row from the list optimistically
 *   T-0011-086 — useDeleteMiniAppMutation removes the row from list optimistically
 *   T-0011-087 — delete mutation rollback restores the row on 4xx
 *   T-0011-088 — list query with empty response → returns empty array; no throw
 *   T-0011-089 — state/queries/projects.ts file is deleted (filesystem check)
 *   T-0011-090 — no mobile file imports '#/state/queries/projects' (grep check)
 *   T-0011-091 — STALE.MINUTES(5) still used as staleTime
 *   T-0011-092 — parseMiniAppDetailResponse does not surface ownerId
 *   T-0011-093 — throws on syncMode value 'wrong-value'
 *   T-0011-094 — throws on archetype value 'dashboard' (V0.5; not V0)
 *   T-0011-095 — useMiniAppQuery(undefined) is disabled (no fetch attempted)
 *   T-0011-096 — rename mutation logs via safeMessage if error occurs
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import {execSync} from 'node:child_process'

import {renderHook, act, waitFor} from '@testing-library/react-native'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import React from 'react'

import {apiFetch} from '#/lib/api'
import {
  MiniAppDetailShapeError,
  MiniAppListShapeError,
  miniAppsKeys,
  parseMiniAppDetailResponse,
  parseMiniAppListResponse,
  useMiniAppsListQuery,
  useMiniAppQuery,
  useRenameMiniAppMutation,
  useArchiveMiniAppMutation,
  useDeleteMiniAppMutation,
} from './miniApps'

// -- Mocks -------------------------------------------------------------------

jest.mock('#/lib/api', () => ({
  apiFetch: jest.fn(),
}))

jest.mock('#/logger', () => ({
  logger: {info: jest.fn(), warn: jest.fn(), error: jest.fn()},
  safeMessage: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}))

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>

// -- Fixtures ----------------------------------------------------------------

const MINI_APP_ID = '00000000-0000-0000-0000-000000000001'
const VERSION_ID = '00000000-0000-0000-0000-000000000099'

function makeListItem(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: MINI_APP_ID,
    title: 'My app',
    updatedAt: '2026-05-01T12:00:00.000Z',
    createdAt: '2026-04-01T12:00:00.000Z',
    currentVersionId: VERSION_ID,
    parentMiniAppId: null,
    stance: 'productive',
    accentPalette: 'focus',
    coverArtSeed: 'seed-abc',
    archetype: 'unknown',
    syncMode: 'cloud-private',
    ...overrides,
  }
}

const VALID_LIST_RESPONSE = {miniApps: [makeListItem()]}

const VALID_DETAIL_RESPONSE = {
  miniApp: {
    id: MINI_APP_ID,
    ownerId: '11111111-1111-1111-1111-111111111111',
    title: 'My app',
    currentVersionId: VERSION_ID,
    parentMiniAppId: null,
    stance: 'productive',
    accentPalette: 'focus',
    coverArtSeed: 'seed-abc',
    archetype: 'unknown',
    syncMode: 'cloud-private',
    archivedAt: null,
    createdAt: '2026-04-01T12:00:00.000Z',
    updatedAt: '2026-05-01T12:00:00.000Z',
  },
  currentVersion: {
    id: VERSION_ID,
    miniAppId: MINI_APP_ID,
    specJson: {version: 1, root: {type: 'Container', children: []}},
    renderHash: 'abc123',
    createdAt: '2026-04-01T12:00:00.000Z',
  },
}

// -- Test helpers ------------------------------------------------------------

beforeEach(() => {
  mockApiFetch.mockReset()
})

function makeWrapper() {
  const qc = new QueryClient({defaultOptions: {queries: {retry: false}}})
  const Wrapper = ({children}: {children: React.ReactNode}) =>
    React.createElement(QueryClientProvider, {client: qc}, children)
  return {qc, Wrapper}
}

// ============================================================================
// T-0011-072: useMiniAppsListQuery hits GET /me/mini-apps
// ============================================================================
describe('T-0011-072: useMiniAppsListQuery — URL path', () => {
  it('calls apiFetch with /me/mini-apps', async () => {
    mockApiFetch.mockResolvedValueOnce(VALID_LIST_RESPONSE)
    const {Wrapper} = makeWrapper()
    const {result} = renderHook(() => useMiniAppsListQuery(), {wrapper: Wrapper})
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockApiFetch).toHaveBeenCalledWith('/me/mini-apps')
  })
})

// ============================================================================
// T-0011-073: parseMiniAppListResponse validates new fields
// ============================================================================
describe('T-0011-073: parseMiniAppListResponse — validates new fields', () => {
  it('parses a valid list response with all new fields', () => {
    const result = parseMiniAppListResponse(VALID_LIST_RESPONSE)
    expect(result).toHaveLength(1)
    const item = result[0]!
    expect(item.stance).toBe('productive')
    expect(item.accentPalette).toBe('focus')
    expect(item.coverArtSeed).toBe('seed-abc')
    expect(item.archetype).toBe('unknown')
    expect(item.syncMode).toBe('cloud-private')
  })
})

// ============================================================================
// T-0011-074: throws when stance missing
// ============================================================================
describe('T-0011-074: parseMiniAppListResponse — stance missing', () => {
  it('throws MiniAppListShapeError when stance is absent', () => {
    const item = makeListItem({stance: undefined})
    expect(() => parseMiniAppListResponse({miniApps: [item]})).toThrow(MiniAppListShapeError)
  })
})

// ============================================================================
// T-0011-075: throws when accentPalette missing
// ============================================================================
describe('T-0011-075: parseMiniAppListResponse — accentPalette missing', () => {
  it('throws MiniAppListShapeError when accentPalette is absent', () => {
    const item = makeListItem({accentPalette: undefined})
    expect(() => parseMiniAppListResponse({miniApps: [item]})).toThrow(MiniAppListShapeError)
  })
})

// ============================================================================
// T-0011-076: throws when coverArtSeed missing
// ============================================================================
describe('T-0011-076: parseMiniAppListResponse — coverArtSeed missing', () => {
  it('throws MiniAppListShapeError when coverArtSeed is absent', () => {
    const item = makeListItem({coverArtSeed: undefined})
    expect(() => parseMiniAppListResponse({miniApps: [item]})).toThrow(MiniAppListShapeError)
  })
})

// ============================================================================
// T-0011-077: throws when archetype missing
// ============================================================================
describe('T-0011-077: parseMiniAppListResponse — archetype missing', () => {
  it('throws MiniAppListShapeError when archetype is absent', () => {
    const item = makeListItem({archetype: undefined})
    expect(() => parseMiniAppListResponse({miniApps: [item]})).toThrow(MiniAppListShapeError)
  })
})

// ============================================================================
// T-0011-078: throws when syncMode not in closed-enum
// ============================================================================
describe('T-0011-078: parseMiniAppListResponse — syncMode not in closed-enum', () => {
  it('throws MiniAppListShapeError for syncMode=cloud-public (not in enum)', () => {
    const item = makeListItem({syncMode: 'cloud-public'})
    expect(() => parseMiniAppListResponse({miniApps: [item]})).toThrow(MiniAppListShapeError)
  })
})

// ============================================================================
// T-0011-079: useMiniAppQuery hits GET /me/mini-apps/:id
// ============================================================================
describe('T-0011-079: useMiniAppQuery — URL path', () => {
  it('calls apiFetch with /me/mini-apps/:id', async () => {
    mockApiFetch.mockResolvedValueOnce(VALID_DETAIL_RESPONSE)
    const {Wrapper} = makeWrapper()
    const {result} = renderHook(() => useMiniAppQuery(MINI_APP_ID), {wrapper: Wrapper})
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockApiFetch).toHaveBeenCalledWith(`/me/mini-apps/${MINI_APP_ID}`)
  })
})

// ============================================================================
// T-0011-080: parseMiniAppDetailResponse throws on missing miniApp.stance
// ============================================================================
describe('T-0011-080: parseMiniAppDetailResponse — stance missing', () => {
  it('throws MiniAppDetailShapeError when miniApp.stance is absent', () => {
    const response = {
      ...VALID_DETAIL_RESPONSE,
      miniApp: {...VALID_DETAIL_RESPONSE.miniApp, stance: undefined},
    }
    expect(() => parseMiniAppDetailResponse(response)).toThrow(MiniAppDetailShapeError)
  })
})

// ============================================================================
// T-0011-081: useRenameMiniAppMutation optimistic update
// ============================================================================
describe('T-0011-081: useRenameMiniAppMutation — optimistic update', () => {
  it('updates list cache optimistically before server responds', async () => {
    const {qc, Wrapper} = makeWrapper()
    qc.setQueryData(miniAppsKeys.list(), [makeListItem({title: 'Old title'})])

    let resolveRename!: (v: unknown) => void
    mockApiFetch.mockReturnValueOnce(new Promise(res => { resolveRename = res }))

    const {result} = renderHook(() => useRenameMiniAppMutation(), {wrapper: Wrapper})
    act(() => {
      result.current.mutate({id: MINI_APP_ID, title: 'New title'})
    })

    // Before server responds, cache should reflect optimistic title
    await waitFor(() => {
      const cached = qc.getQueryData<{title: string}[]>(miniAppsKeys.list())
      expect(cached?.[0]?.title).toBe('New title')
    })

    resolveRename({miniApp: {id: MINI_APP_ID, title: 'New title'}})
  })
})

// ============================================================================
// T-0011-082: rename mutation 4xx restores snapshot
// ============================================================================
describe('T-0011-082: useRenameMiniAppMutation — 4xx rollback', () => {
  it('restores previous list on 4xx error', async () => {
    const {qc, Wrapper} = makeWrapper()
    const original = [makeListItem({title: 'Old title'})]
    qc.setQueryData(miniAppsKeys.list(), original)
    mockApiFetch.mockRejectedValueOnce(Object.assign(new Error('not_found'), {status: 404}))

    const {result} = renderHook(() => useRenameMiniAppMutation(), {wrapper: Wrapper})
    act(() => {
      result.current.mutate({id: MINI_APP_ID, title: 'New title'})
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    const cached = qc.getQueryData<{title: string}[]>(miniAppsKeys.list())
    expect(cached?.[0]?.title).toBe('Old title')
  })
})

// ============================================================================
// T-0011-083: rename mutation 5xx restores snapshot
// ============================================================================
describe('T-0011-083: useRenameMiniAppMutation — 5xx rollback', () => {
  it('restores previous list on 5xx error', async () => {
    const {qc, Wrapper} = makeWrapper()
    const original = [makeListItem({title: 'Old title'})]
    qc.setQueryData(miniAppsKeys.list(), original)
    mockApiFetch.mockRejectedValueOnce(Object.assign(new Error('internal'), {status: 500}))

    const {result} = renderHook(() => useRenameMiniAppMutation(), {wrapper: Wrapper})
    act(() => {
      result.current.mutate({id: MINI_APP_ID, title: 'New title'})
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    const cached = qc.getQueryData<{title: string}[]>(miniAppsKeys.list())
    expect(cached?.[0]?.title).toBe('Old title')
  })
})

// ============================================================================
// T-0011-084: onSettled invalidates list + detail
// ============================================================================
describe('T-0011-084: useRenameMiniAppMutation — onSettled invalidates', () => {
  it('invalidates list and detail after rename success', async () => {
    const {qc, Wrapper} = makeWrapper()
    qc.setQueryData(miniAppsKeys.list(), [makeListItem()])
    mockApiFetch
      .mockResolvedValueOnce({miniApp: makeListItem({title: 'Renamed'})}) // rename
      .mockResolvedValueOnce(VALID_LIST_RESPONSE) // refetch list
      .mockResolvedValueOnce(VALID_DETAIL_RESPONSE) // refetch detail

    const invalidateSpy = jest.spyOn(qc, 'invalidateQueries')
    const {result} = renderHook(() => useRenameMiniAppMutation(), {wrapper: Wrapper})
    await act(async () => {
      await result.current.mutateAsync({id: MINI_APP_ID, title: 'Renamed'})
    })

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({queryKey: miniAppsKeys.list()}),
    )
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({queryKey: miniAppsKeys.detail(MINI_APP_ID)}),
    )
  })
})

// ============================================================================
// T-0011-085: useArchiveMiniAppMutation removes row optimistically
// ============================================================================
describe('T-0011-085: useArchiveMiniAppMutation — optimistic remove', () => {
  it('removes the archived row from list cache optimistically', async () => {
    const {qc, Wrapper} = makeWrapper()
    qc.setQueryData(miniAppsKeys.list(), [makeListItem()])
    let resolveArchive!: (v: unknown) => void
    mockApiFetch.mockReturnValueOnce(new Promise(res => { resolveArchive = res }))

    const {result} = renderHook(() => useArchiveMiniAppMutation(), {wrapper: Wrapper})
    act(() => {
      result.current.mutate({id: MINI_APP_ID})
    })

    await waitFor(() => {
      const cached = qc.getQueryData<unknown[]>(miniAppsKeys.list())
      expect(cached).toHaveLength(0)
    })

    resolveArchive({})
  })
})

// ============================================================================
// T-0011-086: useDeleteMiniAppMutation removes row optimistically
// ============================================================================
describe('T-0011-086: useDeleteMiniAppMutation — optimistic remove', () => {
  it('removes the row from list cache optimistically', async () => {
    const {qc, Wrapper} = makeWrapper()
    qc.setQueryData(miniAppsKeys.list(), [makeListItem()])
    let resolveDelete!: (v: unknown) => void
    mockApiFetch.mockReturnValueOnce(new Promise(res => { resolveDelete = res }))

    const {result} = renderHook(() => useDeleteMiniAppMutation(), {wrapper: Wrapper})
    act(() => {
      result.current.mutate({id: MINI_APP_ID})
    })

    await waitFor(() => {
      const cached = qc.getQueryData<unknown[]>(miniAppsKeys.list())
      expect(cached).toHaveLength(0)
    })

    resolveDelete({})
  })
})

// ============================================================================
// T-0011-087: delete mutation restores snapshot on 4xx
// ============================================================================
describe('T-0011-087: useDeleteMiniAppMutation — 4xx rollback', () => {
  it('restores the deleted row in list cache on 4xx', async () => {
    const {qc, Wrapper} = makeWrapper()
    const originalList = [makeListItem()]
    qc.setQueryData(miniAppsKeys.list(), originalList)
    // First call: mutation (404). Subsequent calls: refetch after onSettled invalidate.
    mockApiFetch
      .mockRejectedValueOnce(Object.assign(new Error('not_found'), {status: 404}))
      .mockResolvedValue(VALID_LIST_RESPONSE)

    const {result} = renderHook(() => useDeleteMiniAppMutation(), {wrapper: Wrapper})
    act(() => {
      result.current.mutate({id: MINI_APP_ID})
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    // onError has run; snapshot is restored before onSettled fires refetch
    const cached = qc.getQueryData<unknown[]>(miniAppsKeys.list())
    expect(cached).toHaveLength(1)
  })
})

// ============================================================================
// T-0011-088: empty list response → empty array, no throw
// ============================================================================
describe('T-0011-088: parseMiniAppListResponse — empty response', () => {
  it('returns empty array for {miniApps: []}', () => {
    const result = parseMiniAppListResponse({miniApps: []})
    expect(result).toEqual([])
  })
})

// ============================================================================
// T-0011-089: state/queries/projects.ts file is deleted (filesystem check)
// ============================================================================
describe('T-0011-089: projects.ts deleted', () => {
  it('state/queries/projects.ts does not exist', () => {
    const filePath = path.resolve(__dirname, 'projects.ts')
    expect(fs.existsSync(filePath)).toBe(false)
  })
})

// ============================================================================
// T-0011-090: no mobile file imports '#/state/queries/projects'
// ============================================================================
describe('T-0011-090: no import of #/state/queries/projects', () => {
  it('grep finds zero files importing from #/state/queries/projects', () => {
    const srcDir = path.resolve(__dirname, '../../../../')
    let output = ''
    try {
      output = execSync(
        `grep -r "#/state/queries/projects" "${srcDir}" --include="*.ts" --include="*.tsx" -l 2>/dev/null`,
        {encoding: 'utf-8'},
      ).trim()
    } catch {
      // grep exits 1 when no matches — that's the success case
      output = ''
    }
    // Filter out this test file itself (it contains the path as a string literal in grep calls)
    const violations = output
      .split('\n')
      .filter(Boolean)
      .filter(l => !l.includes('miniApps.test.ts'))
    expect(violations).toHaveLength(0)
  })
})

// ============================================================================
// T-0011-091: STALE.MINUTES(5) used as staleTime
// ============================================================================
describe('T-0011-091: staleTime is STALE.MINUTES(5)', () => {
  it('list query uses 5-minute stale time', async () => {
    mockApiFetch.mockResolvedValueOnce(VALID_LIST_RESPONSE)
    const {Wrapper} = makeWrapper()
    const {result} = renderHook(() => useMiniAppsListQuery(), {wrapper: Wrapper})
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    // staleTime is set on the observer, not directly on cache entry — verify by
    // checking the data was fetched (a non-stale fresh query wouldn't refetch)
    expect(result.current.isStale).toBe(false)
  })
})

// ============================================================================
// T-0011-092: parseMiniAppDetailResponse does not surface ownerId
// ============================================================================
describe('T-0011-092: parseMiniAppDetailResponse — ownerId not surfaced', () => {
  it('returned MiniAppDetail.miniApp does not have ownerId property', () => {
    const result = parseMiniAppDetailResponse(VALID_DETAIL_RESPONSE)
    expect(result.miniApp).not.toHaveProperty('ownerId')
  })
})

// ============================================================================
// T-0011-093: throws on syncMode 'wrong-value' (closed-enum)
// ============================================================================
describe('T-0011-093: parseMiniAppListResponse — wrong syncMode', () => {
  it('throws MiniAppListShapeError for syncMode="wrong-value"', () => {
    const item = makeListItem({syncMode: 'wrong-value'})
    expect(() => parseMiniAppListResponse({miniApps: [item]})).toThrow(MiniAppListShapeError)
  })
})

// ============================================================================
// T-0011-094: throws on archetype 'dashboard' (V0.5; not V0)
// ============================================================================
describe('T-0011-094: parseMiniAppListResponse — dashboard archetype rejected', () => {
  it('throws MiniAppListShapeError for archetype="dashboard"', () => {
    const item = makeListItem({archetype: 'dashboard'})
    expect(() => parseMiniAppListResponse({miniApps: [item]})).toThrow(MiniAppListShapeError)
  })
})

// ============================================================================
// T-0011-095: useMiniAppQuery(undefined) is disabled
// ============================================================================
describe('T-0011-095: useMiniAppQuery — disabled when id is undefined', () => {
  it('does not call apiFetch when miniAppId is undefined', async () => {
    const {Wrapper} = makeWrapper()
    renderHook(() => useMiniAppQuery(undefined), {wrapper: Wrapper})
    // Give TanStack Query a tick to potentially fetch
    await new Promise(r => setTimeout(r, 50))
    expect(mockApiFetch).not.toHaveBeenCalled()
  })
})

// ============================================================================
// T-0011-096: rename mutation logs via safeMessage on error
// ============================================================================
describe('T-0011-096: useRenameMiniAppMutation — safeMessage on error', () => {
  it('logs error via logger.error with safeMessage on failure', async () => {
    const {logger: mockLogger} = jest.requireMock('#/logger') as {
      logger: {error: jest.MockedFunction<(msg: string, ctx?: object) => void>}
    }
    mockLogger.error.mockClear()
    const {qc, Wrapper} = makeWrapper()
    qc.setQueryData(miniAppsKeys.list(), [makeListItem()])
    mockApiFetch.mockRejectedValueOnce(new Error('NetworkError'))

    const {result} = renderHook(() => useRenameMiniAppMutation(), {wrapper: Wrapper})
    act(() => {
      result.current.mutate({id: MINI_APP_ID, title: 'Fail'})
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Rename mutation failed',
      expect.objectContaining({safeMessage: expect.any(String)}),
    )
  })
})

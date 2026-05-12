/**
 * Clones query hook tests — ADR-0008 Step 5.
 *
 * T-0008-125: useCloneMutation 201 path → invalidates miniAppsKeys.list() once.
 * T-0008-126: useCloneMutation 200 (idempotent) path → still invalidates Library.
 * T-0008-127: 404 response → CloneError with code 'not_found'; CLONE_TOAST_MESSAGES['not_found'] is correct copy.
 * T-0008-128: 410 response → CloneError with code 'revoked'; CLONE_TOAST_MESSAGES['revoked'] is correct copy.
 * T-0008-129: network failure (TypeError) → CloneError with code 'network'; mutation rejects.
 * T-0008-130: after a successful clone, miniAppsKeys.list() is invalidated (intent was already
 *             cleared by popPendingClone before mutate — covered in pendingClone.test.ts).
 * T-0008-131: failed clone does NOT re-persist the pending intent (no setPendingClone call).
 * T-0008-132: successful clone emits link_clone_opened telemetry with share_id_prefix + mode.
 * T-0008-129c: clone-mutation network error during pendingClone-replay — mutation rejects,
 *              no telemetry emitted, pending intent NOT re-persisted.
 */
import {renderHook, act} from '@testing-library/react-native'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import React from 'react'

import {apiFetch, ApiError} from '#/lib/api'
import {writeEvent} from '#/lib/telemetry'
import {setPendingClone, popPendingClone} from '#/lib/pendingClone'
import {miniAppsKeys} from '#/state/queries/miniApps'
import {CloneError, CLONE_TOAST_MESSAGES, useCloneMutation} from './clones'

// -- Mocks -------------------------------------------------------------------

jest.mock('#/lib/api', () => {
  const actual = jest.requireActual('#/lib/api') as typeof import('#/lib/api')
  return {
    ...actual,
    apiFetch: jest.fn(),
  }
})

jest.mock('#/lib/telemetry', () => ({
  writeEvent: jest.fn(),
  MOBILE_EVENT_PAYLOAD_WHITELIST: {
    share_link_copied: ['share_id_prefix'],
    link_clone_opened: ['share_id_prefix', 'mode'],
  },
}))

jest.mock('#/lib/pendingClone', () => ({
  setPendingClone: jest.fn(),
  popPendingClone: jest.fn(),
  clearPendingClone: jest.fn(),
}))

jest.mock('#/logger', () => ({
  logger: {info: jest.fn(), warn: jest.fn(), error: jest.fn()},
  safeMessage: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}))

// -- Setup -------------------------------------------------------------------

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>
const mockWriteEvent = writeEvent as jest.MockedFunction<typeof writeEvent>
const mockPopPendingClone = popPendingClone as jest.MockedFunction<typeof popPendingClone>
const mockSetPendingClone = setPendingClone as jest.MockedFunction<typeof setPendingClone>

const SHARE_ID = 'aBcD1234aBcD1234aBcD1234'
const MINI_APP_ID = '00000000-0000-0000-0000-000000000001'

function makeWrapper(qc: QueryClient) {
  return function Wrapper({children}: {children: React.ReactNode}) {
    return React.createElement(QueryClientProvider, {client: qc}, children)
  }
}

function makeQc() {
  return new QueryClient({
    defaultOptions: {
      queries: {retry: false},
      mutations: {retry: false},
    },
  })
}

const CLONE_SUCCESS_RESPONSE = {
  miniApp: {id: MINI_APP_ID, title: 'Cloned App'},
}

beforeEach(() => {
  mockApiFetch.mockReset()
  mockWriteEvent.mockReset()
  mockPopPendingClone.mockReset()
  mockSetPendingClone.mockReset()
})

// -- Toast message copy (static assertions) ----------------------------------

describe('CLONE_TOAST_MESSAGES', () => {
  it('T-0008-127: not_found message matches spec copy', () => {
    expect(CLONE_TOAST_MESSAGES.not_found).toBe('This tool is no longer available.')
  })

  it('T-0008-128: revoked message matches spec copy', () => {
    expect(CLONE_TOAST_MESSAGES.revoked).toBe('This share link has been revoked.')
  })
})

// -- useCloneMutation --------------------------------------------------------

describe('useCloneMutation', () => {
  it('T-0008-125: 201 path — calls POST /mini-apps/clone and invalidates miniAppsKeys.list()', async () => {
    const qc = makeQc()
    mockApiFetch.mockResolvedValueOnce(CLONE_SUCCESS_RESPONSE)
    const invalidateSpy = jest.spyOn(qc, 'invalidateQueries')

    const {result} = renderHook(() => useCloneMutation(), {
      wrapper: makeWrapper(qc),
    })

    await act(async () => {
      await result.current.mutateAsync({shareId: SHARE_ID, mode: 'view'})
    })

    expect(mockApiFetch).toHaveBeenCalledWith('/mini-apps/clone', {
      method: 'POST',
      body: JSON.stringify({shareId: SHARE_ID}),
    })

    // invalidateQueries called for miniAppsKeys.list()
    const calls = invalidateSpy.mock.calls
    const listKey = miniAppsKeys.list()
    const listInvalidation = calls.find(
      c => JSON.stringify((c[0] as {queryKey: unknown}).queryKey) === JSON.stringify(listKey),
    )
    expect(listInvalidation).toBeDefined()
  })

  it('T-0008-126: idempotent (200) path — still invalidates Library', async () => {
    const qc = makeQc()
    mockApiFetch.mockResolvedValueOnce(CLONE_SUCCESS_RESPONSE)
    const invalidateSpy = jest.spyOn(qc, 'invalidateQueries')

    const {result} = renderHook(() => useCloneMutation(), {
      wrapper: makeWrapper(qc),
    })

    await act(async () => {
      await result.current.mutateAsync({shareId: SHARE_ID, mode: 'view'})
    })

    const calls = invalidateSpy.mock.calls
    const listKey = miniAppsKeys.list()
    const listInvalidation = calls.find(
      c => JSON.stringify((c[0] as {queryKey: unknown}).queryKey) === JSON.stringify(listKey),
    )
    expect(listInvalidation).toBeDefined()
  })

  it('T-0008-127: 404 response — throws CloneError with code not_found', async () => {
    const qc = makeQc()
    mockApiFetch.mockRejectedValueOnce(new ApiError(404, '{"error":"not_found"}'))

    const {result} = renderHook(() => useCloneMutation(), {
      wrapper: makeWrapper(qc),
    })

    let error: unknown
    await act(async () => {
      try {
        await result.current.mutateAsync({shareId: SHARE_ID})
      } catch (e) {
        error = e
      }
    })

    expect(error).toBeInstanceOf(CloneError)
    expect((error as CloneError).code).toBe('not_found')
  })

  it('T-0008-128: 410 response — throws CloneError with code revoked', async () => {
    const qc = makeQc()
    mockApiFetch.mockRejectedValueOnce(new ApiError(410, '{"error":"revoked"}'))

    const {result} = renderHook(() => useCloneMutation(), {
      wrapper: makeWrapper(qc),
    })

    let error: unknown
    await act(async () => {
      try {
        await result.current.mutateAsync({shareId: SHARE_ID})
      } catch (e) {
        error = e
      }
    })

    expect(error).toBeInstanceOf(CloneError)
    expect((error as CloneError).code).toBe('revoked')
  })

  it('T-0008-129: network failure (TypeError) — CloneError with code network; mutation rejects', async () => {
    const qc = makeQc()
    mockApiFetch.mockRejectedValueOnce(new TypeError('Network request failed'))

    const {result} = renderHook(() => useCloneMutation(), {
      wrapper: makeWrapper(qc),
    })

    let error: unknown
    await act(async () => {
      try {
        await result.current.mutateAsync({shareId: SHARE_ID})
      } catch (e) {
        error = e
      }
    })

    expect(error).toBeInstanceOf(CloneError)
    expect((error as CloneError).code).toBe('network')
  })

  it('T-0008-131: failed clone does NOT re-persist the pending intent', async () => {
    const qc = makeQc()
    mockApiFetch.mockRejectedValueOnce(new TypeError('Network request failed'))
    // Simulate: pendingClone was popped before this mutate call
    mockPopPendingClone.mockResolvedValueOnce(SHARE_ID)

    const {result} = renderHook(() => useCloneMutation(), {
      wrapper: makeWrapper(qc),
    })

    await act(async () => {
      try {
        await result.current.mutateAsync({shareId: SHARE_ID})
      } catch {
        // expected
      }
    })

    // The mutation must NOT call setPendingClone at any point
    expect(mockSetPendingClone).not.toHaveBeenCalled()
  })

  it('T-0008-132: successful clone emits link_clone_opened telemetry with share_id_prefix and mode', async () => {
    const qc = makeQc()
    mockApiFetch.mockResolvedValueOnce(CLONE_SUCCESS_RESPONSE)

    const {result} = renderHook(() => useCloneMutation(), {
      wrapper: makeWrapper(qc),
    })

    await act(async () => {
      await result.current.mutateAsync({shareId: SHARE_ID, mode: 'view'})
    })

    expect(mockWriteEvent).toHaveBeenCalledTimes(1)
    expect(mockWriteEvent).toHaveBeenCalledWith({
      eventType: 'link_clone_opened',
      share_id_prefix: SHARE_ID.slice(0, 4),
      mode: 'view',
    })
  })

  it('T-0008-130: after successful clone, miniAppsKeys.list() is invalidated (intent already cleared)', async () => {
    const qc = makeQc()
    mockApiFetch.mockResolvedValueOnce(CLONE_SUCCESS_RESPONSE)
    const invalidateSpy = jest.spyOn(qc, 'invalidateQueries')

    const {result} = renderHook(() => useCloneMutation(), {
      wrapper: makeWrapper(qc),
    })

    // Simulate the pendingClone-replay path: pop returns a value (now null after pop)
    mockPopPendingClone.mockResolvedValueOnce(null)

    await act(async () => {
      await result.current.mutateAsync({shareId: SHARE_ID, mode: 'remix'})
    })

    const listKey = miniAppsKeys.list()
    const listInvalidation = invalidateSpy.mock.calls.find(
      c => JSON.stringify((c[0] as {queryKey: unknown}).queryKey) === JSON.stringify(listKey),
    )
    expect(listInvalidation).toBeDefined()
  })

  it('T-0008-129c: clone network error during replay — mutation rejects, no telemetry emitted', async () => {
    const qc = makeQc()
    mockApiFetch.mockRejectedValueOnce(new TypeError('Network request failed'))

    const {result} = renderHook(() => useCloneMutation(), {
      wrapper: makeWrapper(qc),
    })

    let error: unknown
    await act(async () => {
      try {
        // Simulate post-SIWA replay: shareId was popped from pendingClone before this call
        await result.current.mutateAsync({shareId: SHARE_ID, mode: 'view'})
      } catch (e) {
        error = e
      }
    })

    expect(error).toBeInstanceOf(CloneError)
    expect((error as CloneError).code).toBe('network')
    // No telemetry — clone never completed server-side
    expect(mockWriteEvent).not.toHaveBeenCalled()
    // Intent must NOT be re-persisted
    expect(mockSetPendingClone).not.toHaveBeenCalled()
  })
})

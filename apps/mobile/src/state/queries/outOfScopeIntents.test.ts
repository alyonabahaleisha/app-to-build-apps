/**
 * ADR-0011 Step 5 — mobile out-of-scope intents query hook tests.
 *
 * T-IDs covered:
 *   T-0011-113: useOutOfScopeIntentsQuery hits GET /me/out-of-scope-intents
 *   T-0011-114: successful response parsed into OutOfScopeIntentSummary[]
 *   T-0011-115: throws OutOfScopeIntentShapeError when capability is absent
 *   T-0011-116: throws OutOfScopeIntentShapeError when capturedCount is absent
 *   T-0011-117: throws OutOfScopeIntentShapeError when notifyOptIn is absent
 *   T-0011-120: useUpdateNotifyOptInMutation — optimistic update flips notifyOptIn in cache
 *   T-0011-121: useUpdateNotifyOptInMutation — on 4xx error, previous snapshot restored
 *   T-0011-122: useUpdateNotifyOptInMutation — onSettled invalidates the list query
 */

import {renderHook, act, waitFor} from '@testing-library/react-native'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import React from 'react'

import {apiFetch} from '#/lib/api'
import {
  OutOfScopeIntentShapeError,
  outOfScopeIntentsKeys,
  useOutOfScopeIntentsQuery,
  useUpdateNotifyOptInMutation,
  type OutOfScopeIntentSummary,
} from './outOfScopeIntents'

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

function makeSummary(overrides: Partial<OutOfScopeIntentSummary> = {}): OutOfScopeIntentSummary {
  return {
    capability: 'image_gen',
    capturedCount: 3,
    lastCapturedAt: '2026-05-01T12:00:00.000Z',
    notifyOptIn: false,
    ...overrides,
  }
}

const VALID_LIST_RESPONSE = {
  intents: [
    makeSummary({capability: 'image_gen', notifyOptIn: false}),
    makeSummary({capability: 'vision', notifyOptIn: true}),
  ],
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
// T-0011-113: useOutOfScopeIntentsQuery hits GET /me/out-of-scope-intents
// ============================================================================
describe('T-0011-113: useOutOfScopeIntentsQuery — URL path', () => {
  it('calls apiFetch with /me/out-of-scope-intents', async () => {
    mockApiFetch.mockResolvedValueOnce(VALID_LIST_RESPONSE)
    const {Wrapper} = makeWrapper()
    const {result} = renderHook(() => useOutOfScopeIntentsQuery(), {wrapper: Wrapper})
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockApiFetch).toHaveBeenCalledWith('/me/out-of-scope-intents')
  })
})

// ============================================================================
// T-0011-114: successful response parsed into OutOfScopeIntentSummary[]
// ============================================================================
describe('T-0011-114: useOutOfScopeIntentsQuery — parses response', () => {
  it('returns parsed OutOfScopeIntentSummary[]', async () => {
    mockApiFetch.mockResolvedValueOnce(VALID_LIST_RESPONSE)
    const {Wrapper} = makeWrapper()
    const {result} = renderHook(() => useOutOfScopeIntentsQuery(), {wrapper: Wrapper})
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const data = result.current.data!
    expect(data).toHaveLength(2)
    expect(data[0]).toMatchObject({
      capability: 'image_gen',
      capturedCount: 3,
      notifyOptIn: false,
    })
    expect(data[1]).toMatchObject({
      capability: 'vision',
      notifyOptIn: true,
    })
  })

  it('returns [] for empty intents array', async () => {
    mockApiFetch.mockResolvedValueOnce({intents: []})
    const {Wrapper} = makeWrapper()
    const {result} = renderHook(() => useOutOfScopeIntentsQuery(), {wrapper: Wrapper})
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })

  it('staleTime is STALE.MINUTES(5) — query is not stale immediately after fetch', async () => {
    mockApiFetch.mockResolvedValue(VALID_LIST_RESPONSE)
    const {Wrapper} = makeWrapper()
    const {result} = renderHook(() => useOutOfScopeIntentsQuery(), {wrapper: Wrapper})
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    // With a 5-minute staleTime, the query should not be stale right after fetching
    expect(result.current.isStale).toBe(false)
  })
})

// ============================================================================
// T-0011-115: throws OutOfScopeIntentShapeError when capability is absent
// ============================================================================
describe('T-0011-115: shape validation — capability absent', () => {
  it('throws OutOfScopeIntentShapeError when capability is absent', async () => {
    const {capability: _cap, ...withoutCapability} = makeSummary()
    mockApiFetch.mockResolvedValueOnce({intents: [withoutCapability]})
    const {Wrapper} = makeWrapper()
    const {result} = renderHook(() => useOutOfScopeIntentsQuery(), {wrapper: Wrapper})
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeInstanceOf(OutOfScopeIntentShapeError)
  })
})

// ============================================================================
// T-0011-116: throws OutOfScopeIntentShapeError when capturedCount is absent
// ============================================================================
describe('T-0011-116: shape validation — capturedCount absent', () => {
  it('throws OutOfScopeIntentShapeError when capturedCount is absent', async () => {
    const {capturedCount: _c, ...withoutCount} = makeSummary()
    mockApiFetch.mockResolvedValueOnce({intents: [withoutCount]})
    const {Wrapper} = makeWrapper()
    const {result} = renderHook(() => useOutOfScopeIntentsQuery(), {wrapper: Wrapper})
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeInstanceOf(OutOfScopeIntentShapeError)
  })
})

// ============================================================================
// T-0011-117: throws OutOfScopeIntentShapeError when notifyOptIn is absent
// ============================================================================
describe('T-0011-117: shape validation — notifyOptIn absent', () => {
  it('throws OutOfScopeIntentShapeError when notifyOptIn is absent', async () => {
    const {notifyOptIn: _n, ...withoutOpt} = makeSummary()
    mockApiFetch.mockResolvedValueOnce({intents: [withoutOpt]})
    const {Wrapper} = makeWrapper()
    const {result} = renderHook(() => useOutOfScopeIntentsQuery(), {wrapper: Wrapper})
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeInstanceOf(OutOfScopeIntentShapeError)
  })

  it('throws when lastCapturedAt is absent', async () => {
    const {lastCapturedAt: _l, ...withoutTs} = makeSummary()
    mockApiFetch.mockResolvedValueOnce({intents: [withoutTs]})
    const {Wrapper} = makeWrapper()
    const {result} = renderHook(() => useOutOfScopeIntentsQuery(), {wrapper: Wrapper})
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeInstanceOf(OutOfScopeIntentShapeError)
  })

  it('throws when response.intents is not an array', async () => {
    mockApiFetch.mockResolvedValueOnce({intents: 'bad'})
    const {Wrapper} = makeWrapper()
    const {result} = renderHook(() => useOutOfScopeIntentsQuery(), {wrapper: Wrapper})
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeInstanceOf(OutOfScopeIntentShapeError)
  })
})

// ============================================================================
// T-0011-120: useUpdateNotifyOptInMutation — optimistic update
// ============================================================================
describe('T-0011-120: useUpdateNotifyOptInMutation — optimistic update', () => {
  it('flips notifyOptIn in cache immediately', async () => {
    // Seed the list cache
    mockApiFetch.mockResolvedValue(VALID_LIST_RESPONSE)
    const {qc, Wrapper} = makeWrapper()
    const listHook = renderHook(() => useOutOfScopeIntentsQuery(), {wrapper: Wrapper})
    await waitFor(() => expect(listHook.result.current.isSuccess).toBe(true))

    // Reset before mutation — don't let the list query refetch interfere
    mockApiFetch.mockReset()
    mockApiFetch.mockResolvedValue({updated: 1})

    const mutHook = renderHook(() => useUpdateNotifyOptInMutation(), {wrapper: Wrapper})
    await act(async () => {
      mutHook.result.current.mutate({capability: 'image_gen', notifyOptIn: true})
    })

    // While mutation is in-flight, the cache should have the optimistic value
    const cached = qc.getQueryData<OutOfScopeIntentSummary[]>(outOfScopeIntentsKeys.list())
    const imageGenEntry = cached?.find(s => s.capability === 'image_gen')
    expect(imageGenEntry?.notifyOptIn).toBe(true)
  })
})

// ============================================================================
// T-0011-121: useUpdateNotifyOptInMutation — rollback on error
// ============================================================================
describe('T-0011-121: useUpdateNotifyOptInMutation — rollback on 4xx', () => {
  it('restores previous snapshot on error', async () => {
    // Seed the list cache
    mockApiFetch.mockResolvedValueOnce(VALID_LIST_RESPONSE)
    const {qc, Wrapper} = makeWrapper()
    const listHook = renderHook(() => useOutOfScopeIntentsQuery(), {wrapper: Wrapper})
    await waitFor(() => expect(listHook.result.current.isSuccess).toBe(true))

    // Mutation fails; onSettled refetch succeeds (returns original data)
    mockApiFetch
      .mockRejectedValueOnce(new Error('403 Forbidden'))
      .mockResolvedValue(VALID_LIST_RESPONSE)

    const mutHook = renderHook(() => useUpdateNotifyOptInMutation(), {wrapper: Wrapper})
    await act(async () => {
      mutHook.result.current.mutate({capability: 'image_gen', notifyOptIn: true})
    })
    await waitFor(() => expect(mutHook.result.current.isError).toBe(true))

    const cached = qc.getQueryData<OutOfScopeIntentSummary[]>(outOfScopeIntentsKeys.list())
    const imageGenEntry = cached?.find(s => s.capability === 'image_gen')
    // Should be restored to the original false value
    expect(imageGenEntry?.notifyOptIn).toBe(false)
  })
})

// ============================================================================
// T-0011-122: useUpdateNotifyOptInMutation — onSettled invalidates
// ============================================================================
describe('T-0011-122: useUpdateNotifyOptInMutation — onSettled invalidates list', () => {
  it('calls invalidateQueries on settlement', async () => {
    mockApiFetch.mockResolvedValueOnce(VALID_LIST_RESPONSE)
    const {qc, Wrapper} = makeWrapper()
    const listHook = renderHook(() => useOutOfScopeIntentsQuery(), {wrapper: Wrapper})
    await waitFor(() => expect(listHook.result.current.isSuccess).toBe(true))

    // Successful mutation
    mockApiFetch.mockResolvedValue({updated: 1})

    const invalidateSpy = jest.spyOn(qc, 'invalidateQueries')

    const mutHook = renderHook(() => useUpdateNotifyOptInMutation(), {wrapper: Wrapper})
    await act(async () => {
      mutHook.result.current.mutate({capability: 'vision', notifyOptIn: false})
    })
    await waitFor(() => expect(mutHook.result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({queryKey: outOfScopeIntentsKeys.list()}),
    )
  })
})

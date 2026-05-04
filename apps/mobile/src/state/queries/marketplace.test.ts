/**
 * Marketplace query hooks — unit tests.
 *
 * These tests cover the query/mutation behavior, URL construction, body
 * shape, cache invalidation, and typed error handling.
 *
 * Tests do NOT cover T-0002-148 through T-0002-164 (those are in screen +
 * component files). These tests focus on the hook internals.
 */
import {renderHook, act, waitFor} from '@testing-library/react-native'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import React from 'react'

import {apiFetch, ApiError} from '#/lib/api'
import {
  PublishError,
  usePublishMutation,
  useUnpublishMutation,
  useCheckHandleQuery,
  useHandleSuggestQuery,
  useSetHandleMutation,
} from '#/state/queries/marketplace'
import {projectsKeys} from '#/state/queries/projects'

// -- Mock apiFetch -----------------------------------------------------------

jest.mock('#/lib/api', () => {
  const actual = jest.requireActual('#/lib/api') as typeof import('#/lib/api')
  return {
    ...actual,
    apiFetch: jest.fn(),
  }
})

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>

// -- Helpers -----------------------------------------------------------------

function makeWrapper(qc: QueryClient) {
  return function Wrapper({children}: {children: React.ReactNode}) {
    return React.createElement(
      QueryClientProvider,
      {client: qc},
      children,
    )
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

// -- Tests -------------------------------------------------------------------

describe('usePublishMutation', () => {
  it('calls POST /projects/:id/publish with handle body', async () => {
    const qc = makeQc()
    mockApiFetch.mockResolvedValueOnce({
      project: {
        id: 'proj-1',
        visibility: 'public',
        publishedAt: '2026-05-02T00:00:00Z',
        authorHandle: 'alice',
      },
    })

    const {result} = renderHook(() => usePublishMutation(), {
      wrapper: makeWrapper(qc),
    })

    await act(async () => {
      await result.current.mutateAsync({projectId: 'proj-1', handle: 'alice'})
    })

    expect(mockApiFetch).toHaveBeenCalledWith('/projects/proj-1/publish', {
      method: 'POST',
      body: JSON.stringify({handle: 'alice'}),
    })
  })

  it('calls POST /projects/:id/publish with empty body when handle absent', async () => {
    const qc = makeQc()
    mockApiFetch.mockResolvedValueOnce({
      project: {
        id: 'proj-2',
        visibility: 'public',
        publishedAt: '2026-05-02T00:00:00Z',
        authorHandle: 'bob',
      },
    })

    const {result} = renderHook(() => usePublishMutation(), {
      wrapper: makeWrapper(qc),
    })

    await act(async () => {
      await result.current.mutateAsync({projectId: 'proj-2'})
    })

    expect(mockApiFetch).toHaveBeenCalledWith('/projects/proj-2/publish', {
      method: 'POST',
      body: JSON.stringify({}),
    })
  })

  it('invalidates projects.detail and projects.list on success', async () => {
    const qc = makeQc()
    const invalidate = jest.spyOn(qc, 'invalidateQueries')

    mockApiFetch.mockResolvedValueOnce({
      project: {
        id: 'proj-3',
        visibility: 'public',
        publishedAt: '2026-05-02T00:00:00Z',
        authorHandle: 'charlie',
      },
    })

    const {result} = renderHook(() => usePublishMutation(), {
      wrapper: makeWrapper(qc),
    })

    await act(async () => {
      await result.current.mutateAsync({projectId: 'proj-3', handle: 'charlie'})
    })

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: projectsKeys.detail('proj-3'),
    })
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: projectsKeys.list(),
    })
  })

  it('throws PublishError with handle_taken code on 409 with handle_taken body', async () => {
    const qc = makeQc()
    mockApiFetch.mockRejectedValueOnce(
      new ApiError(409, JSON.stringify({error: 'handle_taken'})),
    )

    const {result} = renderHook(() => usePublishMutation(), {
      wrapper: makeWrapper(qc),
    })

    let caught: unknown
    await act(async () => {
      try {
        await result.current.mutateAsync({projectId: 'proj-4', handle: 'taken'})
      } catch (e) {
        caught = e
      }
    })

    expect(caught).toBeInstanceOf(PublishError)
    expect((caught as PublishError).code).toBe('handle_taken')
  })

  it('throws PublishError with network code on TypeError (offline)', async () => {
    const qc = makeQc()
    mockApiFetch.mockRejectedValueOnce(new TypeError('Network request failed'))

    const {result} = renderHook(() => usePublishMutation(), {
      wrapper: makeWrapper(qc),
    })

    let caught: unknown
    await act(async () => {
      try {
        await result.current.mutateAsync({projectId: 'proj-5', handle: 'alice'})
      } catch (e) {
        caught = e
      }
    })

    expect(caught).toBeInstanceOf(PublishError)
    expect((caught as PublishError).code).toBe('network')
  })
})

describe('useUnpublishMutation', () => {
  it('calls POST /projects/:id/unpublish', async () => {
    const qc = makeQc()
    mockApiFetch.mockResolvedValueOnce({
      project: {id: 'proj-1', visibility: 'private'},
    })

    const {result} = renderHook(() => useUnpublishMutation(), {
      wrapper: makeWrapper(qc),
    })

    await act(async () => {
      await result.current.mutateAsync({projectId: 'proj-1'})
    })

    expect(mockApiFetch).toHaveBeenCalledWith('/projects/proj-1/unpublish', {
      method: 'POST',
      body: JSON.stringify({}),
    })
  })

  it('invalidates projects.detail and projects.list on success', async () => {
    const qc = makeQc()
    const invalidate = jest.spyOn(qc, 'invalidateQueries')
    mockApiFetch.mockResolvedValueOnce({
      project: {id: 'proj-2', visibility: 'private'},
    })

    const {result} = renderHook(() => useUnpublishMutation(), {
      wrapper: makeWrapper(qc),
    })

    await act(async () => {
      await result.current.mutateAsync({projectId: 'proj-2'})
    })

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: projectsKeys.detail('proj-2'),
    })
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: projectsKeys.list(),
    })
  })
})

describe('useCheckHandleQuery', () => {
  it('calls GET /handles/check?h=<handle> when enabled', async () => {
    const qc = makeQc()
    mockApiFetch.mockResolvedValueOnce({available: true})

    const {result} = renderHook(
      () => useCheckHandleQuery('alice', true),
      {wrapper: makeWrapper(qc)},
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockApiFetch).toHaveBeenCalledWith('/handles/check?h=alice')
    expect(result.current.data).toEqual({available: true})
  })

  it('does not fire when enabled=false', () => {
    const qc = makeQc()
    mockApiFetch.mockClear()
    const {result} = renderHook(
      () => useCheckHandleQuery('alice', false),
      {wrapper: makeWrapper(qc)},
    )

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockApiFetch).not.toHaveBeenCalled()
  })

  it('encodes special chars in handle', async () => {
    const qc = makeQc()
    mockApiFetch.mockResolvedValueOnce({available: false, reason: 'taken'})

    const {result} = renderHook(
      () => useCheckHandleQuery('a b', true),
      {wrapper: makeWrapper(qc)},
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockApiFetch).toHaveBeenCalledWith('/handles/check?h=a%20b')
  })
})

describe('useHandleSuggestQuery', () => {
  it('calls GET /me/handle/suggest when enabled', async () => {
    const qc = makeQc()
    mockApiFetch.mockResolvedValueOnce({handle: 'alyona-bahaleisha'})

    const {result} = renderHook(
      () => useHandleSuggestQuery(true),
      {wrapper: makeWrapper(qc)},
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockApiFetch).toHaveBeenCalledWith('/me/handle/suggest')
    expect(result.current.data?.handle).toBe('alyona-bahaleisha')
  })

  it('does not fire when enabled=false', () => {
    const qc = makeQc()
    mockApiFetch.mockClear()
    const {result} = renderHook(
      () => useHandleSuggestQuery(false),
      {wrapper: makeWrapper(qc)},
    )

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockApiFetch).not.toHaveBeenCalled()
  })
})

describe('useSetHandleMutation', () => {
  it('calls POST /users/me/handle', async () => {
    const qc = makeQc()
    mockApiFetch.mockResolvedValueOnce({handle: 'alice'})

    const {result} = renderHook(() => useSetHandleMutation(), {
      wrapper: makeWrapper(qc),
    })

    await act(async () => {
      await result.current.mutateAsync({handle: 'alice'})
    })

    expect(mockApiFetch).toHaveBeenCalledWith('/users/me/handle', {
      method: 'POST',
      body: JSON.stringify({handle: 'alice'}),
    })
  })
})

describe('PublishError', () => {
  it('has name PublishError and correct code', () => {
    const err = new PublishError('handle_taken')
    expect(err.name).toBe('PublishError')
    expect(err.code).toBe('handle_taken')
    expect(err.message).toBe('handle_taken')
  })

  it('accepts a custom message', () => {
    const err = new PublishError('network', 'Connection failed')
    expect(err.message).toBe('Connection failed')
    expect(err.code).toBe('network')
  })
})

/**
 * Tests for useGenerateMutation — ADR-0002 Step 8.
 *
 * T-0002-131: phase='thinking' set synchronously before first await.
 * T-0002-132: SSE building_started → phase='building'.
 * T-0002-133: SSE done → phase='done', result populated.
 * T-0002-136: 30s stall → phase='stalled'.
 * T-0002-137: stall timer clears on phase transition (no spurious stalled).
 * T-0002-141: network error after initial event → connection_lost.
 * T-0002-144: Authorization header contains session JWT.
 * T-0002-146: in-flight guard — second call throws.
 *
 * SSE mocking strategy: mock fetch directly, return a Response whose `body`
 * is a ReadableStream we control via a pull-based queue. Each test enqueues
 * SSE text chunks and an `[DONE]` sentinel; the hook's reader loop processes
 * them and we wait for state transitions.
 */

import React from 'react'
import {renderHook, act} from '@testing-library/react-native'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {useGenerateMutation} from './generate'

// Wrapper providing QueryClientProvider — required because useGenerateMutation
// calls useQueryClient() internally (to invalidate the projects list on done).
function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
  })
  const Wrapper = ({children}: {children: React.ReactNode}) =>
    React.createElement(QueryClientProvider, {client: qc}, children)
  return Wrapper
}

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

const mockGetCurrentSession = jest.fn()
const mockGetApiUrl = jest.fn(() => 'http://localhost:3000')
jest.mock('#/lib/api', () => ({
  getCurrentSession: () => mockGetCurrentSession(),
  getApiUrl: () => mockGetApiUrl(),
}))

jest.mock('#/logger', () => ({
  logger: {info: jest.fn(), warn: jest.fn(), error: jest.fn()},
  safeMessage: (e: unknown) => String(e),
}))

// ---------------------------------------------------------------------------
// SSE helpers
// ---------------------------------------------------------------------------

function sseEvent(type: string, data: Record<string, unknown> = {}): string {
  return `data: ${JSON.stringify({type, ...data})}\n\n`
}

function sseDone(): string {
  return 'data: [DONE]\n\n'
}

const RESULT_PAYLOAD = {
  miniApp: {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    title: 'Tip Calculator',
    visibility: 'private',
    parent_project_id: null,
    original_prompt: 'A tip calculator',
    created_at: '2026-05-10T00:00:00.000Z',
  },
  spec: {},
  render_hash: 'hash123',
  thinking_duration_ms: 3000,
  generation_duration_ms: 45000,
}

/**
 * Create a mock fetch that returns a response whose body is a ReadableStream
 * backed by a simple queue. Callers can push chunks in after the fact.
 *
 * Returns `{ enqueue, close, closeWithError }` to control the stream.
 */
function makeMockFetch(status = 200): {
  fetch: jest.Mock
  enqueue: (chunk: string) => void
  close: () => void
  closeWithError: (err: Error) => void
} {
  let ctrl!: ReadableStreamDefaultController<Uint8Array>
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      ctrl = c
    },
  })

  const mockFetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    body: stream,
    json: async () => ({error: 'internal'}),
  })

  return {
    fetch: mockFetch,
    enqueue: (chunk: string) => ctrl.enqueue(new TextEncoder().encode(chunk)),
    close: () => ctrl.close(),
    closeWithError: (err: Error) => ctrl.error(err),
  }
}

// ---------------------------------------------------------------------------
// Per-test setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.useFakeTimers()
  mockGetCurrentSession.mockReturnValue({
    accessToken: 'test.jwt.token',
    userId: 'user-123',
  })
  mockGetApiUrl.mockReturnValue('http://localhost:3000')
})

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// T-0002-131: phase='thinking' set synchronously before first await
// ---------------------------------------------------------------------------

it('T-0002-131: phase is "thinking" synchronously when generate() is called', async () => {
  // fetch never resolves — inspecting state before the await.
  global.fetch = jest.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch

  const {result} = renderHook(() => useGenerateMutation(), {wrapper: makeWrapper()})
  expect(result.current.phase).toBe('idle')

  // Fire generate without awaiting.
  act(() => {
    void result.current.generate({prompt: 'A tip calculator'})
  })

  // Phase must be 'thinking' synchronously.
  expect(result.current.phase).toBe('thinking')
})

// ---------------------------------------------------------------------------
// T-0002-132: SSE building_started → phase='building'
// ---------------------------------------------------------------------------

it('T-0002-132: building_started SSE event transitions phase to "building"', async () => {
  const {fetch, enqueue, close} = makeMockFetch()
  global.fetch = fetch as unknown as typeof fetch

  const {result} = renderHook(() => useGenerateMutation(), {wrapper: makeWrapper()})

  // Start generate.
  const genPromise = result.current.generate({prompt: 'Build something'})

  // Emit thinking_started then building_started.
  await act(async () => {
    enqueue(sseEvent('thinking_started'))
    enqueue(sseEvent('building_started'))
    enqueue(sseDone())
    close()
    await genPromise
  })

  expect(result.current.phase).toBe('building')
})

// ---------------------------------------------------------------------------
// T-0002-133: SSE done → phase='done', result populated
// ---------------------------------------------------------------------------

it('T-0002-133: done SSE event sets phase="done" and populates result', async () => {
  const {fetch, enqueue, close} = makeMockFetch()
  global.fetch = fetch as unknown as typeof fetch

  const {result} = renderHook(() => useGenerateMutation(), {wrapper: makeWrapper()})

  await act(async () => {
    const genPromise = result.current.generate({prompt: 'A tip calculator'})
    enqueue(sseEvent('thinking_started'))
    enqueue(sseEvent('building_started'))
    enqueue(sseEvent('done', RESULT_PAYLOAD))
    enqueue(sseDone())
    close()
    await genPromise
  })

  expect(result.current.phase).toBe('done')
  expect(result.current.result?.miniApp.id).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
  expect(result.current.result?.render_hash).toBe('hash123')
})

// ---------------------------------------------------------------------------
// T-0002-136: 30s stall → phase='stalled'
// ---------------------------------------------------------------------------

it('T-0002-136: stall timer fires after 30s of silence, phase becomes "stalled"', async () => {
  const {fetch, enqueue} = makeMockFetch()
  global.fetch = fetch as unknown as typeof fetch

  const {result} = renderHook(() => useGenerateMutation(), {wrapper: makeWrapper()})

  // Start generate, send thinking_started, then go silent.
  act(() => {
    void result.current.generate({prompt: 'Build something'})
  })

  await act(async () => {
    enqueue(sseEvent('thinking_started'))
  })

  expect(result.current.phase).toBe('thinking')

  // Advance 29s — no stall yet.
  await act(async () => {
    jest.advanceTimersByTime(29_000)
  })
  expect(result.current.phase).toBe('thinking')

  // Advance past 30s mark.
  await act(async () => {
    jest.advanceTimersByTime(1_100)
  })
  expect(result.current.phase).toBe('stalled')
})

// ---------------------------------------------------------------------------
// T-0002-137: stall timer clears on phase transition
// ---------------------------------------------------------------------------

it('T-0002-137: stall timer cleared on building_started — no spurious "stalled"', async () => {
  const {fetch, enqueue, close} = makeMockFetch()
  global.fetch = fetch as unknown as typeof fetch

  const {result} = renderHook(() => useGenerateMutation(), {wrapper: makeWrapper()})

  act(() => {
    void result.current.generate({prompt: 'Build something'})
  })

  await act(async () => {
    enqueue(sseEvent('thinking_started'))
  })

  // Advance 28s (2s before stall fires).
  await act(async () => {
    jest.advanceTimersByTime(28_000)
  })
  expect(result.current.phase).toBe('thinking')

  // building_started arrives — re-arms the stall timer for another 30s.
  await act(async () => {
    enqueue(sseEvent('building_started'))
  })

  expect(result.current.phase).toBe('building')

  // Advance 4s more (would have fired old stall, but it was cleared).
  await act(async () => {
    jest.advanceTimersByTime(4_000)
  })
  expect(result.current.phase).toBe('building')

  // Close cleanly.
  await act(async () => {
    enqueue(sseEvent('done', RESULT_PAYLOAD))
    enqueue(sseDone())
    close()
  })

  expect(result.current.phase).toBe('done')
})

// ---------------------------------------------------------------------------
// T-0002-141: network error after initial event → connection_lost
// ---------------------------------------------------------------------------

it('T-0002-141: network error mid-stream → connection_lost error code', async () => {
  const {fetch, enqueue, closeWithError} = makeMockFetch()
  global.fetch = fetch as unknown as typeof fetch

  const {result} = renderHook(() => useGenerateMutation(), {wrapper: makeWrapper()})

  await act(async () => {
    const genPromise = result.current.generate({prompt: 'Build something'})
    enqueue(sseEvent('thinking_started'))
    // Simulate stream dropping after the first event.
    closeWithError(new TypeError('Network request failed'))
    await genPromise
  })

  expect(result.current.phase).toBe('error')
  expect(result.current.error?.code).toBe('connection_lost')
})

// ---------------------------------------------------------------------------
// T-0002-144: Authorization header with session JWT
// ---------------------------------------------------------------------------

it('T-0002-144: generate() sends Authorization header with session token', async () => {
  const {fetch, enqueue, close} = makeMockFetch()
  global.fetch = fetch as unknown as typeof fetch

  mockGetCurrentSession.mockReturnValue({
    accessToken: 'my-super-secret-jwt',
    userId: 'user-999',
  })

  const {result} = renderHook(() => useGenerateMutation(), {wrapper: makeWrapper()})

  await act(async () => {
    const genPromise = result.current.generate({prompt: 'A streak counter'})
    enqueue(sseEvent('thinking_started'))
    enqueue(sseEvent('done', RESULT_PAYLOAD))
    enqueue(sseDone())
    close()
    await genPromise
  })

  expect(fetch).toHaveBeenCalledTimes(1)
  const [_url, init] = (fetch as jest.Mock).mock.calls[0] as [string, RequestInit]
  const headers = init.headers as Record<string, string>
  expect(headers['Authorization']).toBe('Bearer my-super-secret-jwt')
})

// ---------------------------------------------------------------------------
// T-0002-146: in-flight guard
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// T-0007-101: out_of_scope SSE event — mobile consumer handles it
// ---------------------------------------------------------------------------

it('T-0007-101: out_of_scope SSE event transitions phase to "out_of_scope" and populates outOfScope result', async () => {
  const {fetch, enqueue, close} = makeMockFetch()
  global.fetch = fetch as unknown as typeof fetch

  const {result} = renderHook(() => useGenerateMutation(), {wrapper: makeWrapper()})

  await act(async () => {
    const genPromise = result.current.generate({prompt: 'Build something with photos'})
    enqueue(sseEvent('thinking_started'))
    enqueue(sseEvent('building_started'))
    enqueue(
      sseEvent('out_of_scope', {
        capability: 'vision',
        reason: 'requires photo analysis',
        prompt_hash: 'a'.repeat(64),
      }),
    )
    enqueue(sseDone())
    close()
    await genPromise
  })

  expect(result.current.phase).toBe('out_of_scope')
  expect(result.current.outOfScope).toBeDefined()
  expect(result.current.outOfScope?.capability).toBe('vision')
  expect(result.current.outOfScope?.reason).toBe('requires photo analysis')
  expect(result.current.outOfScope?.prompt_hash).toBe('a'.repeat(64))
  // No project result populated on out_of_scope path
  expect(result.current.result).toBeNull()
})

it('T-0002-146: second generate() call while first is in flight throws', async () => {
  global.fetch = jest.fn().mockReturnValue(new Promise(() => {})) as unknown as typeof fetch

  const {result} = renderHook(() => useGenerateMutation(), {wrapper: makeWrapper()})

  // Start first generate.
  act(() => {
    void result.current.generate({prompt: 'First prompt'})
  })

  expect(result.current.phase).toBe('thinking')

  // Second call must throw.
  let threw = false
  await act(async () => {
    try {
      await result.current.generate({prompt: 'Second prompt'})
    } catch {
      threw = true
    }
  })

  expect(threw).toBe(true)
  expect(result.current.phase).toBe('thinking')
})

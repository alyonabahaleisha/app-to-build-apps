/**
 * aiBridge middleware tests
 *
 * T-0006-021: basic happy path — items resolved from state, summarize called, set dispatched
 * T-0006-144: host.onAIError fires when aiDispatcher.summarize rejects
 * T-0006-145: host.onAIError fires with reason=timeout when aiDispatcher times out
 */
import {makeAIBridgeMiddleware} from './aiBridge'
import type {AIDispatcher} from './aiBridge'
import type {RendererState, Row} from '../types'

// Minimal RendererState factory with a single collection populated with rows.
function makeStateWithCollection(
  collectionId: string,
  rows: Array<{id: string; data: Row}>,
): RendererState {
  const rowsMap = new Map(rows.map(r => [r.id, r.data]))
  const collection = {
    schema: {
      id: collectionId,
      name: collectionId,
      // One stub field satisfies Collection's min(1) constraint.
      fields: [{name: 'title', type: {type: 'string' as const}, required: false}],
      seedData: [{title: 'stub'}],
      syncMode: 'local' as const,
    },
    rows: rowsMap,
    rowOrder: rows.map(r => r.id),
  }
  return {
    spec: {} as unknown as RendererState['spec'],
    slots: new Map(),
    collections: new Map([[collectionId, collection]]),
    currentScreenId: 's1',
    history: [],
    pendingUndo: null,
  }
}

// Helper to build opts with sensible defaults.
function makeOpts(overrides: Partial<Parameters<typeof makeAIBridgeMiddleware>[0]> = {}) {
  const dispatch = jest.fn()
  const onAIError = jest.fn()
  const state = makeStateWithCollection('tasks', [
    {id: 'r1', data: {title: 'First', done: false}},
    {id: 'r2', data: {title: 'Second', done: true}},
  ])
  return {
    dispatch,
    onAIError,
    state,
    opts: {
      getDispatcher: () => null as AIDispatcher | null,
      getDispatch: () => dispatch,
      host: {onAIError},
      getState: () => state,
      ...overrides,
    },
  }
}

// ---------------------------------------------------------------------------
// T-0006-021 — happy path: real items resolved from state, summarize called
// ---------------------------------------------------------------------------

describe('aiBridge middleware (T-0006-021)', () => {
  it('calls aiDispatcher.summarize with real collection rows and dispatches set on completion', async () => {
    const {dispatch, onAIError, opts} = makeOpts()

    const mockAI: AIDispatcher = {
      summarize: jest.fn().mockResolvedValue('Summary result'),
    }

    const next = jest.fn()
    const mw = makeAIBridgeMiddleware({
      ...opts,
      getDispatcher: () => mockAI,
    })

    mw(
      {
        type: 'aiProcess',
        task: 'summarize',
        collection: 'tasks',
        prompt: 'Summarize my tasks',
        target: 'summarySlot',
      },
      next,
    )

    // Should NOT call next (short-circuit)
    expect(next).not.toHaveBeenCalled()

    // summarize should have been called with the actual rows from state —
    // not an empty array. This is the load-bearing assertion for Fix 1.
    expect(mockAI.summarize).toHaveBeenCalledWith({
      prompt: 'Summarize my tasks',
      items: [
        {title: 'First', done: false},
        {title: 'Second', done: true},
      ],
    })

    // Wait for the promise to resolve
    await Promise.resolve()

    expect(dispatch).toHaveBeenCalledWith({
      type: 'set',
      target: 'summarySlot',
      value: 'Summary result',
    })
    expect(onAIError).not.toHaveBeenCalled()
  })

  it('calls host.onAIError on rejection', async () => {
    const {onAIError} = makeOpts()
    const error = new Error('AI failed')
    const mockAI: AIDispatcher = {
      summarize: jest.fn().mockRejectedValue(error),
    }
    const next = jest.fn()

    const mw = makeAIBridgeMiddleware({
      ...makeOpts().opts,
      getDispatcher: () => mockAI,
      host: {onAIError},
    })

    mw(
      {type: 'aiProcess', task: 'summarize', collection: 'tasks', prompt: 'p', target: 't'},
      next,
    )

    // Flush all microtasks — rejection handler is in a .catch() which needs
    // the promise chain to settle (2 ticks: promise rejection + catch handler)
    await new Promise<void>(resolve => setTimeout(resolve, 0))

    expect(onAIError).toHaveBeenCalledWith(error)
  })

  it('short-circuits silently when AI dispatcher is null', () => {
    const {dispatch, onAIError, opts} = makeOpts()
    const next = jest.fn()

    const mw = makeAIBridgeMiddleware(opts)

    mw(
      {type: 'aiProcess', task: 'summarize', collection: 'tasks', prompt: 'p', target: 't'},
      next,
    )

    expect(next).not.toHaveBeenCalled()
    expect(dispatch).not.toHaveBeenCalled()
    expect(onAIError).not.toHaveBeenCalled()
  })

  it('passes non-aiProcess actions through to next', () => {
    const {opts} = makeOpts()
    const next = jest.fn()

    const mw = makeAIBridgeMiddleware(opts)

    mw({type: 'set', target: 'x', value: 1}, next)
    expect(next).toHaveBeenCalledWith({type: 'set', target: 'x', value: 1})
  })

  it('calls host.onAIError when collection is not found in state', () => {
    const {opts, onAIError} = makeOpts()
    const mockAI: AIDispatcher = {summarize: jest.fn()}
    const next = jest.fn()

    const mw = makeAIBridgeMiddleware({
      ...opts,
      getDispatcher: () => mockAI,
    })

    // Dispatch for a collection that doesn't exist in state.
    mw(
      {type: 'aiProcess', task: 'summarize', collection: 'nonexistent', prompt: 'p', target: 't'},
      next,
    )

    expect(onAIError).toHaveBeenCalledWith(expect.any(Error))
    expect(mockAI.summarize).not.toHaveBeenCalled()
    expect(next).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// T-0006-144 — host.onAIError fires when aiDispatcher.summarize rejects
// ---------------------------------------------------------------------------

describe('aiBridge middleware (T-0006-144)', () => {
  it('host.onAIError fires when aiDispatcher.summarize rejects', async () => {
    const {opts, onAIError} = makeOpts()
    const rejectionError = new Error('AI service error')
    const mockAI: AIDispatcher = {
      summarize: jest.fn().mockRejectedValue(rejectionError),
    }
    const next = jest.fn()

    const mw = makeAIBridgeMiddleware({
      ...opts,
      getDispatcher: () => mockAI,
      host: {onAIError},
    })

    mw(
      {type: 'aiProcess', task: 'summarize', collection: 'tasks', prompt: 'Summarize', target: 'slot'},
      next,
    )

    // The summary slot is never written — the middleware short-circuits.
    // host.onAIError owns the error UX; ListSummary continues showing shimmer.
    await new Promise<void>(resolve => setTimeout(resolve, 0))

    expect(onAIError).toHaveBeenCalledWith(
      expect.objectContaining({message: 'AI service error'}),
    )
    // The dispatch mock should NOT have been called with a 'set' action.
    expect(opts.getDispatch()).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// T-0006-145 — host.onAIError fires with reason=timeout when dispatcher times out
// ---------------------------------------------------------------------------

describe('aiBridge middleware (T-0006-145)', () => {
  it('host.onAIError fires when aiDispatcher.summarize rejects with timeout error', async () => {
    // The 30s timeout lives inside aiDispatcher.ts — it races resultPromise against
    // a setTimeout that rejects with new Error('AI timeout'). When the timer wins,
    // the rejection propagates to aiBridge's .catch() which calls host.onAIError.
    // We simulate that here by having summarize() reject with the timeout error.
    const {opts, onAIError} = makeOpts()
    const timeoutError = new Error('AI timeout')
    const mockAI: AIDispatcher = {
      summarize: jest.fn().mockRejectedValue(timeoutError),
    }
    const next = jest.fn()

    const mw = makeAIBridgeMiddleware({
      ...opts,
      getDispatcher: () => mockAI,
      host: {onAIError},
    })

    mw(
      {type: 'aiProcess', task: 'summarize', collection: 'tasks', prompt: 'Summarize', target: 'slot'},
      next,
    )

    await new Promise<void>(resolve => setTimeout(resolve, 0))

    expect(onAIError).toHaveBeenCalledWith(
      expect.objectContaining({message: 'AI timeout'}),
    )
  })
})

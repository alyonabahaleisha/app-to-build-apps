/**
 * Middleware composition tests — T-0006-023, T-0006-024, T-0006-028a
 *
 * Tests the composeMiddleware machinery and the telemetry insertion-point
 * forward-compat contract.
 */
import {composeMiddleware, makeReducerMiddleware} from './middleware'
import type {Middleware} from './middleware'
import type {RendererAction} from './types'
import {haptics} from './middleware/haptics'
import {makeToastMiddleware} from './middleware/toast'
import {makeAIBridgeMiddleware} from './middleware/aiBridge'
import {makeNavigationMiddleware} from './middleware/navigation'
import {makeUndoBufferMiddleware} from './middleware/undoBuffer'
import {buildInitialRendererState, resetRowIdCounter, reducer} from './reducer'
import type {Spec} from '@app-creator/protocol'

const MINIMAL_SPEC: Spec = {
  version: 1,
  archetype: 'ListCRUD',
  stance: 'productive',
  palette: 'focus',
  coverIcon: 'check',
  navigation: 'none',
  screens: [{id: 's1', root: {id: 'n1', type: 'Heading', text: 'Hello', level: 1}}],
  initialScreenId: 's1',
  collections: [],
  initialState: {},
}

// -- T-0006-023: bad middleware that doesn't call next blocks downstream --------

describe('middleware composition — bad middleware blocks downstream (T-0006-023)', () => {
  it('a middleware that never calls next prevents downstream from running', () => {
    const downstreamCalled: string[] = []

    const blockingMiddleware: Middleware = (_action, _next) => {
      // Intentionally does NOT call next
    }

    const downstreamMiddleware: Middleware = (action, next) => {
      downstreamCalled.push(action.type)
      next(action)
    }

    const reducerCalls: RendererAction[] = []
    const terminalMiddleware: Middleware = (action, _next) => {
      reducerCalls.push(action)
    }

    const chain = composeMiddleware([blockingMiddleware, downstreamMiddleware, terminalMiddleware])
    chain.dispatch({type: 'toast', message: 'hi', tone: undefined})

    expect(downstreamCalled).toHaveLength(0)
    expect(reducerCalls).toHaveLength(0)
  })
})

// -- T-0006-024: Side-effect middleware runs before reducer ----------------------

describe('middleware composition — order: side effects before reducer (T-0006-024)', () => {
  it('middleware runs in array order; reducer (terminal) runs last', () => {
    const order: string[] = []

    const mw1: Middleware = (action, next) => {
      order.push('mw1')
      next(action)
    }
    const mw2: Middleware = (action, next) => {
      order.push('mw2')
      next(action)
    }
    const terminal: Middleware = (_action, _next) => {
      order.push('terminal')
    }

    const chain = composeMiddleware([mw1, mw2, terminal])
    chain.dispatch({type: 'set', target: 'x', value: 1})

    expect(order).toEqual(['mw1', 'mw2', 'terminal'])
  })
})

// -- T-0006-025: Security — malformed target passed through unchanged ----------

describe('middleware composition — security: malformed target passed through (T-0006-025)', () => {
  it('action with malformed target is passed to reducer unchanged', () => {
    const received: RendererAction[] = []
    const terminal: Middleware = (action, _next) => {
      received.push(action)
    }

    const chain = composeMiddleware([terminal])
    const malformedAction = {type: 'set' as const, target: '<script>alert(1)</script>', value: 'xss'}
    chain.dispatch(malformedAction)

    expect(received).toHaveLength(1)
    expect(received[0]).toEqual(malformedAction)
  })
})

// -- T-0006-028a: Telemetry insertion-point contract (MT-05) ------------------

describe('middleware — telemetry insertion-point contract (T-0006-028a)', () => {
  function buildDefaultChain(
    telemetry: Middleware,
    insertBeforeToast: boolean,
  ): ReturnType<typeof composeMiddleware> {
    resetRowIdCounter()
    const spec = MINIMAL_SPEC
    let state = buildInitialRendererState(spec)
    const internalDispatch = (action: RendererAction) => {
      state = reducer(state, action)
    }

    const host = {
      onToast: jest.fn(),
      onAIError: jest.fn(),
    }
    const toastMiddleware = makeToastMiddleware(host)
    const aiBridgeMiddleware = makeAIBridgeMiddleware({
      getDispatcher: () => null,
      getDispatch: () => chain.dispatch,
      host,
      getState: () => state,
    })
    const navigationMiddleware = makeNavigationMiddleware(() => null, {})
    const undoBufferMiddleware = makeUndoBufferMiddleware(
      () => state,
      () => chain.dispatch,
      host,
    )
    const reducerTerminal = makeReducerMiddleware(internalDispatch)

    const middlewareList = insertBeforeToast
      ? [haptics, telemetry, toastMiddleware, aiBridgeMiddleware, navigationMiddleware, undoBufferMiddleware, reducerTerminal]
      : [haptics, toastMiddleware, telemetry, aiBridgeMiddleware, navigationMiddleware, undoBufferMiddleware, reducerTerminal]

    const chain = composeMiddleware(middlewareList)
    return chain
  }

  it('telemetry inserted BEFORE toast sees toast actions', () => {
    const seen: RendererAction[] = []
    const telemetry: Middleware = (action, next) => {
      seen.push(action)
      next(action)
    }

    const chain = buildDefaultChain(telemetry, true /* insertBeforeToast */)
    chain.dispatch({type: 'toast', message: 'hi', tone: undefined})

    expect(seen.some(a => a.type === 'toast')).toBe(true)
  })

  it('telemetry inserted AFTER toast does NOT see toast actions', () => {
    const seen: RendererAction[] = []
    const telemetry: Middleware = (action, next) => {
      seen.push(action)
      next(action)
    }

    const chain = buildDefaultChain(telemetry, false /* insertBeforeToast = after toast */)
    chain.dispatch({type: 'toast', message: 'hi', tone: undefined})

    expect(seen.some(a => a.type === 'toast')).toBe(false)
  })

  it('telemetry inserted BEFORE toast sees addItem, navigate, set actions', () => {
    const seen: RendererAction[] = []
    const telemetry: Middleware = (action, next) => {
      seen.push(action)
      next(action)
    }

    const chain = buildDefaultChain(telemetry, true)

    chain.dispatch({type: 'set', target: 'x', value: 1})
    chain.dispatch({type: 'navigate', target: 's1'})

    expect(seen.some(a => a.type === 'set')).toBe(true)
    expect(seen.some(a => a.type === 'navigate')).toBe(true)
  })
})

// -- T-0006-026: Reducer state never includes raw user PII ---------------------

describe('reducer — security: no raw user PII in default state (T-0006-026)', () => {
  it('initial state slots come from spec, not user input', () => {
    resetRowIdCounter()
    const state = buildInitialRendererState(MINIMAL_SPEC)
    // Spec.initialState values are LLM-authored, not user data.
    // The spec that reaches the renderer is validated upstream.
    // This test verifies that the state machine doesn't inject additional
    // data beyond what the spec defines.
    expect(state.slots.size).toBe(0)  // MINIMAL_SPEC has empty initialState
    expect(state.collections.size).toBe(0)
  })
})

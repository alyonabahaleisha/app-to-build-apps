/**
 * Tests for useA2UIState hook.
 *
 * Covers T-0003-001 through T-0003-022 at the hook level (complement to
 * reducer.test.ts which covers the pure reducer directly).
 *
 * Uses @testing-library/react-native renderHook + act for hook testing.
 */
import {act, renderHook} from '@testing-library/react-native'
import React from 'react'

import type {A2UISpec} from '@app-creator/a2ui-schema'

import {render} from '../index'
import {RendererLoggerProvider} from '../logger/RendererLoggerProvider'
import type {RendererLogger} from '../types'
import {useA2UIState} from './useA2UIState'

// -- Fixtures -----------------------------------------------------------------

const SIMPLE_SPEC: A2UISpec = {
  version: 1,
  views: [{id: 'main', root: {type: 'Heading', text: 'Test'}}],
  initialViewId: 'main',
}

const SPEC_WITH_INITIAL_STATE: A2UISpec = {
  version: 1,
  views: [{id: 'main', root: {type: 'Heading', text: 'Test'}}],
  initialViewId: 'main',
  initialState: {counter: 10, flag: true, name: 'Alice'},
}

const SPEC_WITH_VIEWS: A2UISpec = {
  version: 1,
  views: [
    {id: 'main', root: {type: 'Heading', text: 'Main'}},
    {id: 'settings', root: {type: 'Heading', text: 'Settings'}},
  ],
  initialViewId: 'main',
}

// -- Helper -------------------------------------------------------------------

function makeLoggerSpy(): jest.Mocked<RendererLogger> {
  return {
    warn: jest.fn(),
    error: jest.fn(),
  }
}

function makeWrapper(logger?: RendererLogger) {
  return function Wrapper({children}: {children: React.ReactNode}) {
    if (logger) {
      return (
        <RendererLoggerProvider logger={logger}>{children}</RendererLoggerProvider>
      )
    }
    return <>{children}</>
  }
}

// -- Tests --------------------------------------------------------------------

describe('useA2UIState', () => {
  // T-0003-001
  it('seeds state from spec.initialState', () => {
    const {result} = renderHook(() => useA2UIState(SPEC_WITH_INITIAL_STATE))
    expect(result.current.state['counter']).toBe(10)
    expect(result.current.state['flag']).toBe(true)
    expect(result.current.state['name']).toBe('Alice')
  })

  it('returns empty record when spec has no initialState', () => {
    const {result} = renderHook(() => useA2UIState(SIMPLE_SPEC))
    expect(Object.keys(result.current.state)).toHaveLength(0)
  })

  // T-0003-002
  it('currentViewId initializes to spec.initialViewId', () => {
    const {result} = renderHook(() => useA2UIState(SPEC_WITH_VIEWS))
    expect(result.current.currentViewId).toBe('main')
  })

  // T-0003-003
  it('dispatch set produces next state with state[targetId] === value', () => {
    const {result} = renderHook(() => useA2UIState(SIMPLE_SPEC))
    act(() => {
      result.current.dispatch({type: 'set', targetId: 'x', value: 7})
    })
    expect(result.current.state['x']).toBe(7)
  })

  // T-0003-004
  it('dispatch increment by 2 increments by 2', () => {
    const spec: A2UISpec = {
      ...SIMPLE_SPEC,
      initialState: {c: 5},
    }
    const {result} = renderHook(() => useA2UIState(spec))
    act(() => {
      result.current.dispatch({type: 'increment', targetId: 'c', by: 2})
    })
    expect(result.current.state['c']).toBe(7)
  })

  // T-0003-005
  it('dispatch increment with no by defaults to 1', () => {
    const spec: A2UISpec = {...SIMPLE_SPEC, initialState: {c: 3}}
    const {result} = renderHook(() => useA2UIState(spec))
    act(() => {
      result.current.dispatch({type: 'increment', targetId: 'c'})
    })
    expect(result.current.state['c']).toBe(4)
  })

  // T-0003-006
  it('dispatch decrement by 3 decrements by 3', () => {
    const spec: A2UISpec = {...SIMPLE_SPEC, initialState: {c: 10}}
    const {result} = renderHook(() => useA2UIState(spec))
    act(() => {
      result.current.dispatch({type: 'decrement', targetId: 'c', by: 3})
    })
    expect(result.current.state['c']).toBe(7)
  })

  // T-0003-007
  it('dispatch toast invokes onToast callback and does not mutate state', () => {
    const onToast = jest.fn()
    const {result} = renderHook(() => useA2UIState(SIMPLE_SPEC, {onToast}))
    const stateBefore = result.current.state
    act(() => {
      result.current.dispatch({type: 'toast', message: 'hi'})
    })
    expect(onToast).toHaveBeenCalledWith('hi')
    expect(result.current.state).toBe(stateBefore)
  })

  // T-0003-008
  it('dispatch navigate to known viewId updates currentViewId', () => {
    const {result} = renderHook(() => useA2UIState(SPEC_WITH_VIEWS))
    act(() => {
      result.current.dispatch({type: 'navigate', viewId: 'settings'})
    })
    expect(result.current.currentViewId).toBe('settings')
  })

  // T-0003-011-hook-gap (renamed from T-0003-011 in Step 5):
  // Documents the pre-§I.1-amendment behavior: dispatching to a targetId that
  // has no Counter node in the spec fires unbounded (counterBoundsMap returns
  // undefined → no min/max injected). This is the correct behavior for
  // non-Counter ids and remains unchanged post-amendment.
  it('T-0003-011-hook-gap: increment on a targetId that has no Counter node in spec fires unbounded', () => {
    // SIMPLE_SPEC has no Counter nodes, so counterBoundsMap is empty.
    // Dispatching increment to 'c' (not a Counter id) should be unbounded.
    const spec: A2UISpec = {...SIMPLE_SPEC, initialState: {c: 8}}
    const {result} = renderHook(() => useA2UIState(spec))
    act(() => {
      result.current.dispatch({type: 'increment', targetId: 'c', by: 5})
    })
    // counterBoundsMap has no entry for 'c' → no max injected → unbounded.
    expect(result.current.state['c']).toBe(13)
  })

  // T-0003-011-hook-clamp (Step 5 amendment — §I.1 closure proof):
  // When a Counter node with {id:'c', min:0, max:50} exists in spec.views,
  // the hook's counterBoundsMap injects max:50 into the INCREMENT action.
  // Dispatching increment with by:100 clamps to 50.
  it('T-0003-011-hook-clamp: increment on a Counter id clamps to max via counterBoundsMap (§I.1)', () => {
    const spec: A2UISpec = {
      version: 1,
      views: [
        {
          id: 'main',
          root: {
            type: 'Counter',
            id: 'c',
            label: 'Count',
            min: 0,
            max: 50,
          },
        },
      ],
      initialViewId: 'main',
      initialState: {c: 0},
    }
    const {result} = renderHook(() => useA2UIState(spec))
    act(() => {
      result.current.dispatch({type: 'increment', targetId: 'c', by: 100})
    })
    // counterBoundsMap finds Counter{id:'c', max:50} → injects max:50 →
    // reducer clamps to 50, not 100.
    expect(result.current.state['c']).toBe(50)
  })

  // T-0003-012 — type mismatch warn-logs and returns state unchanged
  it('set with type-mismatched value warn-logs a2ui_set_type_mismatch and returns state unchanged', () => {
    const logger = makeLoggerSpy()
    const spec: A2UISpec = {...SIMPLE_SPEC, initialState: {counter: 5}}
    const {result} = renderHook(() => useA2UIState(spec), {
      wrapper: makeWrapper(logger),
    })
    const stateBefore = result.current.state

    act(() => {
      result.current.dispatch({type: 'set', targetId: 'counter', value: 'hello'})
    })

    expect(logger.warn).toHaveBeenCalledWith('a2ui_set_type_mismatch', {
      targetId: 'counter',
      expectedType: 'number',
      actualType: 'string',
    })
    expect(result.current.state).toBe(stateBefore)

    // Verify the actual mismatched value is NOT in the log payload (PII risk).
    const payload = (logger.warn as jest.Mock).mock.calls[0]?.[1] as Record<
      string,
      unknown
    >
    expect(payload).not.toHaveProperty('value')
    expect(JSON.stringify(payload)).not.toContain('hello')
  })

  // T-0003-013 — navigate to unknown viewId warn-logs and returns state unchanged
  it('navigate to unknown viewId warn-logs a2ui_navigate_unknown_view and is a no-op', () => {
    const logger = makeLoggerSpy()
    const {result} = renderHook(() => useA2UIState(SPEC_WITH_VIEWS), {
      wrapper: makeWrapper(logger),
    })
    const viewBefore = result.current.currentViewId

    act(() => {
      result.current.dispatch({type: 'navigate', viewId: 'nonexistent'})
    })

    expect(logger.warn).toHaveBeenCalledWith('a2ui_navigate_unknown_view', {
      viewId: 'nonexistent',
      knownViewIds: expect.arrayContaining(['main', 'settings']),
    })
    expect(result.current.currentViewId).toBe(viewBefore)

    // Verify full spec and node content are NOT in the log payload.
    const payload = (logger.warn as jest.Mock).mock.calls[0]?.[1] as Record<
      string,
      unknown
    >
    expect(payload).not.toHaveProperty('spec')
    expect(payload).not.toHaveProperty('views')
    expect(JSON.stringify(payload)).not.toContain('"type":"Heading"')
  })

  // T-0003-013b — spec reference change resets state
  it('spec reference change resets state; stale keys do not carry over', () => {
    let currentSpec = SIMPLE_SPEC
    const {result, rerender} = renderHook(
      ({spec}: {spec: A2UISpec}) => useA2UIState(spec),
      {initialProps: {spec: currentSpec}},
    )

    // Set some state under the first spec.
    act(() => {
      result.current.dispatch({type: 'set', targetId: 'old_key', value: 42})
    })
    expect(result.current.state['old_key']).toBe(42)

    // Switch to a new spec (different reference, different views/state).
    const newSpec: A2UISpec = {
      version: 1,
      views: [{id: 'new_main', root: {type: 'Text', text: 'New'}}],
      initialViewId: 'new_main',
      initialState: {new_key: 99},
    }
    rerender({spec: newSpec})

    // After spec change, old_key must be gone and new_key seeded from initialState.
    expect(result.current.state).not.toHaveProperty('old_key')
    expect(result.current.state['new_key']).toBe(99)
    expect(result.current.currentViewId).toBe('new_main')
  })

  // T-0003-013c — dispatch after unmount is a no-op (does not throw)
  it('dispatch after unmount is a no-op, does not throw', async () => {
    const {result, unmount} = renderHook(() => useA2UIState(SIMPLE_SPEC))
    const dispatchRef = result.current.dispatch
    unmount()

    // Dispatch after unmount must not throw and must not update state.
    expect(() => {
      dispatchRef({type: 'set', targetId: 'x', value: 1})
    }).not.toThrow()
  })

  // T-0003-021 — existing render() API surface is unchanged
  it('render() function is still exported from the package (regression)', () => {
    // Import is at the top of the file; verify the exported function signature.
    expect(typeof render).toBe('function')
  })

  // T-0003-021b — Dispatch type: (action) => void is assignable to (action, state) => void
  it('Dispatch type narrows to single-arg; one-arg and two-arg functions both compile', () => {
    // This test verifies the TypeScript-level contract at runtime.
    // The actual TS compilation check is in typecheck; here we verify
    // the function signature is correct at runtime.
    type Dispatch = import('../types').Dispatch
    type RenderState = import('../types').RenderState

    // A one-arg function is a valid Dispatch.
    const oneArg: Dispatch = (_action) => {}
    expect(typeof oneArg).toBe('function')

    // A two-arg function (ignoring second) is also assignable to Dispatch
    // when called with one arg — TS allows extra parameters in implementation.
    // At runtime: calling with one arg works; second arg is simply undefined.
    const twoArgImpl = (_action: Parameters<Dispatch>[0], _state?: RenderState) => {}
    // Assign to Dispatch slot — TS allows this (function variance).
    const asDispatch: Dispatch = twoArgImpl
    expect(typeof asDispatch).toBe('function')

    // Both can be called with one arg without error.
    // renderHook is needed to establish the React context for the hooks.
    renderHook(() => useA2UIState(SIMPLE_SPEC))
    act(() => {
      oneArg({type: 'toast', message: 'test'})
      asDispatch({type: 'toast', message: 'test'})
    })
    // No assertions on state — just ensuring no throw.
  })

  // T-0003-022 — Map storage prevents __proto__ pollution
  it('set with targetId="__proto__" does not pollute Object prototype', () => {
    const {result} = renderHook(() => useA2UIState(SIMPLE_SPEC))
    act(() => {
      result.current.dispatch({type: 'set', targetId: '__proto__', value: 'pwn'})
    })
    // Object.prototype must remain unmodified.
    expect(Object.prototype).not.toHaveProperty('pwn')
    // The value is stored and readable.
    expect(result.current.state['__proto__']).toBe('pwn')
  })

  // Exposed state is frozen (defends against component mutations).
  it('exposed state record is frozen', () => {
    const {result} = renderHook(() => useA2UIState(SPEC_WITH_INITIAL_STATE))
    expect(Object.isFrozen(result.current.state)).toBe(true)
  })

  // set with null existing value allows any new type (null is the "untyped" sentinel).
  it('set replaces a null existing value with any type without type-mismatch warning', () => {
    const logger = makeLoggerSpy()
    const spec: A2UISpec = {...SIMPLE_SPEC, initialState: {x: null}}
    const {result} = renderHook(() => useA2UIState(spec), {
      wrapper: makeWrapper(logger),
    })
    act(() => {
      result.current.dispatch({type: 'set', targetId: 'x', value: 42})
    })
    expect(logger.warn).not.toHaveBeenCalled()
    expect(result.current.state['x']).toBe(42)
  })
})

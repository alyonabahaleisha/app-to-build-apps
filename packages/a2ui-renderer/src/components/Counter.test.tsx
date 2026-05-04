/**
 * Tests for CounterRenderer.
 *
 * Step 5 — T-0003-069..081 (17 mandatory T-IDs) + T-0003-076b (bounds injection
 * through Button → dispatch path; central rationale of ADR-0003 §I.1).
 *
 * Snapshot rationale: Counter is a new component (no prior snapshot exists).
 * T-0003-079a/b, T-0003-080, T-0003-080b are new baselines.
 *
 * Uses @testing-library/react-native (rtl) for interaction tests (press events).
 * Uses react-test-renderer (create) for snapshot tests.
 *
 * expo-haptics is mocked at the module level (see moduleNameMapper in
 * jest.config.js). T-0003-081 overrides the mock to simulate a throw.
 */
import {fireEvent, render, screen} from '@testing-library/react-native'
import React from 'react'
import {create} from 'react-test-renderer'

// Mock expo-haptics before any import resolves it.
jest.mock('expo-haptics', () => ({
  __esModule: true,
  ImpactFeedbackStyle: {Light: 'light'},
  impactAsync: jest.fn(async () => {}),
}))

import * as Haptics from 'expo-haptics'

import type {A2UISpec} from '@app-creator/a2ui-schema'

import {useA2UIState} from '../state/useA2UIState'
import {DEFAULT_LIGHT_THEME, RendererThemeProvider} from '../theme/RendererThemeProvider'
import {RendererLoggerProvider} from '../logger/RendererLoggerProvider'
import type {Dispatch, RenderState} from '../types'
import {CounterRenderer} from './Counter'
import type {A2UICounterNode} from './Counter'
import {ButtonRenderer} from './Button'
import type {A2UIButtonNode} from './Button'

// -- Helpers ------------------------------------------------------------------

function makeDispatch(): jest.Mock {
  return jest.fn()
}

function renderCounter(
  node: A2UICounterNode,
  state: RenderState = {},
  dispatch: Dispatch = makeDispatch(),
) {
  return render(
    <RendererThemeProvider value={DEFAULT_LIGHT_THEME}>
      <CounterRenderer node={node} state={state} dispatch={dispatch} />
    </RendererThemeProvider>,
  )
}

function makeNode(overrides?: Partial<A2UICounterNode>): A2UICounterNode {
  return {
    type: 'Counter',
    id: 'count',
    label: 'Items',
    ...overrides,
  }
}


// -- T-0003-069: Three elements rendered (−, value, +) ------------------------

describe('CounterRenderer — T-0003-069: three elements rendered', () => {
  it('renders three elements: decrement button, value, increment button', () => {
    renderCounter(makeNode(), {count: 5})
    // Both step buttons should be present via accessibilityRole="button"
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThanOrEqual(2)
    // Value should be visible
    expect(screen.getByText('5')).toBeTruthy()
  })
})

// -- T-0003-070: Value reads from state[node.id], defaults to min ?? 0 --------

describe('CounterRenderer — T-0003-070: value reads from state', () => {
  it('renders state[node.id] as the value', () => {
    renderCounter(makeNode(), {count: 42})
    expect(screen.getByText('42')).toBeTruthy()
  })

  it('defaults to min ?? 0 when state has no entry', () => {
    renderCounter(makeNode({min: 5}), {})
    expect(screen.getByText('5')).toBeTruthy()
  })

  it('defaults to 0 when state is empty and no min is set', () => {
    renderCounter(makeNode(), {})
    expect(screen.getByText('0')).toBeTruthy()
  })
})

// -- T-0003-071: + press dispatches increment ---------------------------------

describe('CounterRenderer — T-0003-071: + press dispatches increment', () => {
  it('+ press dispatches {type:increment, targetId:node.id, by:step??1}', () => {
    const dispatch = makeDispatch()
    renderCounter(makeNode({id: 'c', step: undefined}), {c: 3}, dispatch)
    // The increment button ("+")
    const buttons = screen.getAllByRole('button')
    const plusButton = buttons.find(b => b.props.accessibilityLabel?.includes('Increase'))
    expect(plusButton).toBeTruthy()
    fireEvent.press(plusButton!)
    expect(dispatch).toHaveBeenCalledWith({
      type: 'increment',
      targetId: 'c',
      by: 1,
    })
  })
})

// -- T-0003-072: − press dispatches decrement ---------------------------------

describe('CounterRenderer — T-0003-072: − press dispatches decrement', () => {
  it('− press dispatches {type:decrement, targetId:node.id, by:step??1}', () => {
    const dispatch = makeDispatch()
    renderCounter(makeNode({id: 'c', step: undefined}), {c: 3}, dispatch)
    const buttons = screen.getAllByRole('button')
    const minusButton = buttons.find(b => b.props.accessibilityLabel?.includes('Decrease'))
    expect(minusButton).toBeTruthy()
    fireEvent.press(minusButton!)
    expect(dispatch).toHaveBeenCalledWith({
      type: 'decrement',
      targetId: 'c',
      by: 1,
    })
  })
})

// -- T-0003-073: custom step dispatches with correct by ----------------------

describe('CounterRenderer — T-0003-073: custom step', () => {
  it('+ with step:5 dispatches increment with by:5', () => {
    const dispatch = makeDispatch()
    renderCounter(makeNode({id: 'c', step: 5}), {c: 10}, dispatch)
    const buttons = screen.getAllByRole('button')
    const plusButton = buttons.find(b => b.props.accessibilityLabel?.includes('Increase'))
    expect(plusButton).toBeTruthy()
    fireEvent.press(plusButton!)
    expect(dispatch).toHaveBeenCalledWith({
      type: 'increment',
      targetId: 'c',
      by: 5,
    })
  })
})

// -- T-0003-074: at max, + is disabled ----------------------------------------

describe('CounterRenderer — T-0003-074: at max, + is disabled', () => {
  it('at value===max, + button has accessibilityState.disabled===true and press is a no-op', () => {
    const dispatch = makeDispatch()
    renderCounter(makeNode({id: 'c', max: 10}), {c: 10}, dispatch)
    const buttons = screen.getAllByRole('button')
    const plusButton = buttons.find(b => b.props.accessibilityLabel?.includes('Increase'))
    expect(plusButton).toBeTruthy()
    expect(plusButton!.props.accessibilityState?.disabled).toBe(true)
    // Press should be a no-op
    fireEvent.press(plusButton!)
    expect(dispatch).not.toHaveBeenCalled()
  })
})

// -- T-0003-075: at min, − is disabled ----------------------------------------

describe('CounterRenderer — T-0003-075: at min, − is disabled', () => {
  it('at value===min, − button has accessibilityState.disabled===true and press is a no-op', () => {
    const dispatch = makeDispatch()
    renderCounter(makeNode({id: 'c', min: 0}), {c: 0}, dispatch)
    const buttons = screen.getAllByRole('button')
    const minusButton = buttons.find(b => b.props.accessibilityLabel?.includes('Decrease'))
    expect(minusButton).toBeTruthy()
    expect(minusButton!.props.accessibilityState?.disabled).toBe(true)
    // Press should be a no-op
    fireEvent.press(minusButton!)
    expect(dispatch).not.toHaveBeenCalled()
  })
})

// -- T-0003-076: clamping at boundary -----------------------------------------

describe('CounterRenderer — T-0003-076: increment from near-max clamps', () => {
  it('increment from 9 with step:3 and max:10 clamps to 10 via hook (not 12)', () => {
    // Verify the dispatch fires — the clamp happens in the state engine (useA2UIState).
    // Here we confirm the component dispatches the correct action, and T-0003-076b
    // confirms the end-to-end clamp.
    const dispatch = makeDispatch()
    renderCounter(makeNode({id: 'c', min: 0, max: 10, step: 3}), {c: 9}, dispatch)
    const buttons = screen.getAllByRole('button')
    const plusButton = buttons.find(b => b.props.accessibilityLabel?.includes('Increase'))
    expect(plusButton).toBeTruthy()
    fireEvent.press(plusButton!)
    // Dispatches with by:3 — hook's counterBoundsMap injects max:10, reducer clamps.
    expect(dispatch).toHaveBeenCalledWith({
      type: 'increment',
      targetId: 'c',
      by: 3,
    })
  })
})

// -- T-0003-076b: Programmatic Button → Counter clamp (§I.1 central rationale)

describe('CounterRenderer — T-0003-076b: programmatic Button → Counter clamp (§I.1)', () => {
  /**
   * T-0003-076b: the central rationale of ADR-0003 §I.
   * A Button with action {type:'increment', targetId:'c', by:100} on a
   * Counter {id:'c', min:0, max:50} with currentValue:45 clamps to 50.
   *
   * This works because useA2UIState.counterBoundsMap walks the spec on mount,
   * finds the Counter node's {min:0, max:50}, and injects them into the
   * INCREMENT internal action. The clamp lives in the state engine (reducer),
   * not in Counter's own +/− press handler.
   */
  it('Button action increment targetId:c by:100 on Counter{min:0,max:50,value:45} clamps state.c to 50', () => {
    // Spec with a Counter node (c, min:0, max:50) as root.
    // We need the counterBoundsMap to walk this node.
    // The Counter node is in the view root — counterBoundsMap must find it.
    const counterNode: A2UICounterNode = {
      type: 'Counter',
      id: 'c',
      label: 'Count',
      min: 0,
      max: 50,
    }
    const buttonNode: A2UIButtonNode = {
      type: 'Button',
      label: 'Add 100',
      action: {type: 'increment', targetId: 'c', by: 100},
    }

    const spec: A2UISpec = {
      version: 1,
      views: [
        {
          id: 'main',
          root: {
            type: 'Container',
            direction: 'column',
            children: [counterNode, buttonNode],
          },
        },
      ],
      initialViewId: 'main',
      initialState: {c: 45},
    }

    let capturedState: RenderState = {}

    function TestHarness() {
      const {state, dispatch} = useA2UIState(spec)
      capturedState = state
      return (
        <>
          <CounterRenderer node={counterNode} state={state} dispatch={dispatch} />
          <ButtonRenderer node={buttonNode} state={state} dispatch={dispatch} />
        </>
      )
    }

    render(
      <RendererThemeProvider value={DEFAULT_LIGHT_THEME}>
        <RendererLoggerProvider logger={{warn: jest.fn(), error: jest.fn()}}>
          <TestHarness />
        </RendererLoggerProvider>
      </RendererThemeProvider>,
    )

    // Initial state should be 45.
    expect(capturedState['c']).toBe(45)

    // Press the Button (Add 100) — should clamp to 50, not 145.
    const addButton = screen.getByRole('button', {name: 'Add 100'})
    fireEvent.press(addButton)

    // After dispatch, state.c must be clamped to max:50.
    expect(capturedState['c']).toBe(50)
    // Not 145, not unchanged.
    expect(capturedState['c']).not.toBe(145)
    expect(capturedState['c']).not.toBe(45)
  })
})

// -- T-0003-076c: unbounded counter (no min/max) ------------------------------

describe('CounterRenderer — T-0003-076c: unbounded counter', () => {
  it('increment from 999 by 1 yields 1000 when no min/max set', () => {
    const dispatch = makeDispatch()
    renderCounter(makeNode({id: 'c'}), {c: 999}, dispatch)
    const buttons = screen.getAllByRole('button')
    const plusButton = buttons.find(b => b.props.accessibilityLabel?.includes('Increase'))
    expect(plusButton).toBeTruthy()
    fireEvent.press(plusButton!)
    expect(dispatch).toHaveBeenCalledWith({
      type: 'increment',
      targetId: 'c',
      by: 1,
    })
    // No disabled state — both buttons should be enabled
    const minusButton = buttons.find(b => b.props.accessibilityLabel?.includes('Decrease'))
    expect(minusButton!.props.accessibilityState?.disabled).toBeFalsy()
    expect(plusButton!.props.accessibilityState?.disabled).toBeFalsy()
  })
})

// -- T-0003-077: accessibilityLabel format ------------------------------------

describe('CounterRenderer — T-0003-077: accessibilityLabel format', () => {
  it('accessibilityLabel is "<label>, current value <n>" per Sable line 322', () => {
    renderCounter(makeNode({label: 'Servings', id: 'srv'}), {srv: 3})
    // The outer View has the combined label
    expect(screen.getByLabelText('Servings, current value 3')).toBeTruthy()
  })
})

// -- T-0003-078: accessibilityActions -----------------------------------------

describe('CounterRenderer — T-0003-078: accessibilityActions', () => {
  it('accessibilityActions includes increment and decrement action names', () => {
    renderCounter(makeNode(), {count: 5})
    // The outer container View should carry accessibilityActions
    const container = screen.getByLabelText('Items, current value 5')
    const actions: Array<{name: string}> = container.props.accessibilityActions ?? []
    const names = actions.map(a => a.name)
    expect(names).toContain('increment')
    expect(names).toContain('decrement')
  })
})

// -- T-0003-078b: at-max, onAccessibilityAction('increment') is a no-op -------

describe('CounterRenderer — T-0003-078b: a11y action increment at-max is no-op', () => {
  /**
   * At max, handleIncrement() returns early (atMax guard). The onAccessibilityAction
   * handler routes 'increment' → handleIncrement(). Confirm dispatch is NOT called.
   */
  it('at-max Counter: fire onAccessibilityAction increment, dispatch is NOT called', () => {
    const dispatch = makeDispatch()
    renderCounter(makeNode({id: 'c', max: 10}), {c: 10}, dispatch)
    const container = screen.getByLabelText('Items, current value 10')
    fireEvent(container, 'accessibilityAction', {nativeEvent: {actionName: 'increment'}})
    expect(dispatch).not.toHaveBeenCalled()
  })
})

// -- T-0003-078c: at-min, onAccessibilityAction('decrement') is a no-op ------

describe('CounterRenderer — T-0003-078c: a11y action decrement at-min is no-op', () => {
  /**
   * Symmetric to T-0003-078b. At min, handleDecrement() returns early.
   */
  it('at-min Counter: fire onAccessibilityAction decrement, dispatch is NOT called', () => {
    const dispatch = makeDispatch()
    renderCounter(makeNode({id: 'c', min: 0}), {c: 0}, dispatch)
    const container = screen.getByLabelText('Items, current value 0')
    fireEvent(container, 'accessibilityAction', {nativeEvent: {actionName: 'decrement'}})
    expect(dispatch).not.toHaveBeenCalled()
  })
})

// -- T-0003-079a: Snapshot — zero state (mid-range, no boundary) --------------

describe('CounterRenderer — T-0003-079a: snapshot zero state', () => {
  // CLAUDE.md §8 snapshot rationale: Counter is a new component (Step 5).
  // These snapshots are new baselines. No prior snapshot to compare against.
  it('snapshot: Counter at zero (mid-range, no boundary)', () => {
    const tree = create(
      <RendererThemeProvider value={DEFAULT_LIGHT_THEME}>
        <CounterRenderer
          node={makeNode({id: 'c', label: 'Items'})}
          state={{c: 0}}
          dispatch={makeDispatch()}
        />
      </RendererThemeProvider>,
    )
    expect(tree.toJSON()).toMatchSnapshot()
  })
})

// -- T-0003-079b: Snapshot — at-min (− disabled) — closes Roz's R-9 ----------

describe('CounterRenderer — T-0003-079b: snapshot at-min', () => {
  it('snapshot: Counter at-min boundary (− disabled)', () => {
    const tree = create(
      <RendererThemeProvider value={DEFAULT_LIGHT_THEME}>
        <CounterRenderer
          node={makeNode({id: 'c', label: 'Items', min: 0, max: 10})}
          state={{c: 0}}
          dispatch={makeDispatch()}
        />
      </RendererThemeProvider>,
    )
    expect(tree.toJSON()).toMatchSnapshot()
  })
})

// -- T-0003-080: Snapshot — at-max (+ disabled) -------------------------------

describe('CounterRenderer — T-0003-080: snapshot at-max', () => {
  it('snapshot: Counter at max boundary (+ disabled)', () => {
    const tree = create(
      <RendererThemeProvider value={DEFAULT_LIGHT_THEME}>
        <CounterRenderer
          node={makeNode({id: 'c', label: 'Items', min: 0, max: 10})}
          state={{c: 10}}
          dispatch={makeDispatch()}
        />
      </RendererThemeProvider>,
    )
    expect(tree.toJSON()).toMatchSnapshot()
  })
})

// -- T-0003-080b: Snapshot — custom step mid-range ----------------------------
// NOTE: 080b is NOT a thematic pair with 080. 080 is at-max; 080b is a
// separate scenario covering custom-step mid-range (per ADR Notes-for-Colby #16).

describe('CounterRenderer — T-0003-080b: snapshot custom step mid-range', () => {
  it('snapshot: Counter with custom step:5 mid-range', () => {
    const tree = create(
      <RendererThemeProvider value={DEFAULT_LIGHT_THEME}>
        <CounterRenderer
          node={makeNode({id: 'c', label: 'Minutes', step: 5, min: 0, max: 60})}
          state={{c: 25}}
          dispatch={makeDispatch()}
        />
      </RendererThemeProvider>,
    )
    expect(tree.toJSON()).toMatchSnapshot()
  })
})

// -- T-0003-081: Haptics throwing is caught silently --------------------------

describe('CounterRenderer — T-0003-081: Haptics throwing is caught silently', () => {
  it('when Haptics.impactAsync throws, dispatch still fires (try/catch wraps haptic)', () => {
    const hapticsMock = Haptics.impactAsync as jest.Mock
    hapticsMock.mockImplementationOnce(() => {
      throw new Error('No haptic hardware')
    })
    const dispatch = makeDispatch()
    renderCounter(makeNode({id: 'c'}), {c: 5}, dispatch)
    const buttons = screen.getAllByRole('button')
    const plusButton = buttons.find(b => b.props.accessibilityLabel?.includes('Increase'))
    expect(plusButton).toBeTruthy()
    // Should not throw even though Haptics throws.
    expect(() => fireEvent.press(plusButton!)).not.toThrow()
    // Dispatch still fires.
    expect(dispatch).toHaveBeenCalledTimes(1)
  })
})

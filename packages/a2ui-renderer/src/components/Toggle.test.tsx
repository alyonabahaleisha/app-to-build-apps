/**
 * Tests for ToggleRenderer.
 *
 * Step 6 — T-0003-091..097 (7 T-IDs covering this component).
 *
 * Uses @testing-library/react-native (rtl) for interaction tests.
 * Uses react-test-renderer (create) for snapshot tests.
 *
 * RendererThemeProvider wraps every render so useRendererTheme() resolves.
 * RendererLoggerProvider wraps renders that exercise the warn-log path.
 *
 * NOTE: RTL's getByRole does not recognise 'switch' as a role name for
 * RN's Switch component. We query the Switch via getByLabelText (using
 * node.label) instead, which matches on accessibilityLabel. For the
 * accessibilityRole assertion (T-0003-094) we query by label then inspect
 * the prop directly.
 */
import {fireEvent, render, screen} from '@testing-library/react-native'
import React from 'react'
import {create} from 'react-test-renderer'

import {DEFAULT_LIGHT_THEME, RendererThemeProvider} from '../theme/RendererThemeProvider'
import {RendererLoggerProvider} from '../logger/RendererLoggerProvider'
import type {Dispatch, RenderState, RendererLogger} from '../types'
import {ToggleRenderer} from './Toggle'
import type {A2UIToggleNode} from './Toggle'

// -- Helpers ------------------------------------------------------------------

function makeDispatch(): jest.Mock {
  return jest.fn()
}

function makeLoggerSpy(): jest.Mocked<RendererLogger> {
  return {warn: jest.fn(), error: jest.fn()}
}

function renderToggle(
  node: A2UIToggleNode,
  state: RenderState = {},
  dispatch: Dispatch = makeDispatch(),
  logger?: jest.Mocked<RendererLogger>,
) {
  const loggerInstance = logger ?? makeLoggerSpy()
  return render(
    <RendererThemeProvider value={DEFAULT_LIGHT_THEME}>
      <RendererLoggerProvider logger={loggerInstance}>
        <ToggleRenderer node={node} state={state} dispatch={dispatch} />
      </RendererLoggerProvider>
    </RendererThemeProvider>,
  )
}

function makeNode(overrides?: Partial<A2UIToggleNode>): A2UIToggleNode {
  return {
    type: 'Toggle',
    id: 'darkMode',
    label: 'Dark Mode',
    ...overrides,
  }
}

// -- T-0003-091: row container ≥56pt min-height (Sable Notes-for-Colby #3) ---

describe('ToggleRenderer — T-0003-091: row ≥56pt min-height', () => {
  it('renders a row container with minHeight ≥ 56pt', () => {
    const {toJSON} = renderToggle(makeNode())
    const tree = toJSON() as {type: string; props: Record<string, unknown>}
    // The outer View container should have minHeight 56 in its style.
    expect(tree).toBeTruthy()
    const containerStyle = Array.isArray(tree.props.style)
      ? Object.assign({}, ...tree.props.style)
      : tree.props.style
    expect(containerStyle.minHeight).toBeGreaterThanOrEqual(56)
  })
})

// -- T-0003-092: reads state[id] as boolean, defaults to defaultValue --------

describe('ToggleRenderer — T-0003-092: state read and defaultValue', () => {
  it('reads state[id] as boolean and passes to Switch value', () => {
    renderToggle(makeNode({id: 'darkMode'}), {darkMode: true})
    // Query by label — RTL does not map 'switch' accessibilityRole to a role query.
    const switchEl = screen.getByLabelText('Dark Mode')
    expect(switchEl.props.value).toBe(true)
  })

  it('defaults to defaultValue when state has no entry', () => {
    renderToggle(makeNode({id: 'darkMode', defaultValue: true}), {})
    const switchEl = screen.getByLabelText('Dark Mode')
    expect(switchEl.props.value).toBe(true)
  })

  it('defaults to false when state is empty and no defaultValue', () => {
    renderToggle(makeNode({id: 'darkMode'}), {})
    const switchEl = screen.getByLabelText('Dark Mode')
    expect(switchEl.props.value).toBe(false)
  })
})

// -- T-0003-093: Switch flip dispatches set action ---------------------------

describe('ToggleRenderer — T-0003-093: Switch flip dispatches set', () => {
  it('flipping the Switch dispatches {type:set, targetId:id, value:nextBool}', () => {
    const dispatch = makeDispatch()
    renderToggle(makeNode({id: 'darkMode'}), {darkMode: false}, dispatch)
    const switchEl = screen.getByLabelText('Dark Mode')
    fireEvent(switchEl, 'valueChange', true)
    expect(dispatch).toHaveBeenCalledWith({
      type: 'set',
      targetId: 'darkMode',
      value: true,
    })
  })

  it('flipping to false dispatches value:false', () => {
    const dispatch = makeDispatch()
    renderToggle(makeNode({id: 'darkMode'}), {darkMode: true}, dispatch)
    const switchEl = screen.getByLabelText('Dark Mode')
    fireEvent(switchEl, 'valueChange', false)
    expect(dispatch).toHaveBeenCalledWith({
      type: 'set',
      targetId: 'darkMode',
      value: false,
    })
  })
})

// -- T-0003-094: accessibilityRole="switch" and label exposed ----------------

describe('ToggleRenderer — T-0003-094: accessibility', () => {
  it('accessibilityRole is "switch"', () => {
    renderToggle(makeNode({label: 'Notifications', id: 'notifs'}))
    // Query by label, then inspect the accessibilityRole prop directly.
    const switchEl = screen.getByLabelText('Notifications')
    expect(switchEl.props.accessibilityRole).toBe('switch')
  })

  it('accessibilityLabel equals node.label', () => {
    renderToggle(makeNode({label: 'Notifications', id: 'notifs'}))
    const switchEl = screen.getByLabelText('Notifications')
    expect(switchEl.props.accessibilityLabel).toBe('Notifications')
  })
})

// -- T-0003-095: non-boolean state coerces to false + warn-log (no actual value)

describe('ToggleRenderer — T-0003-095: non-boolean state coercion + warn-log', () => {
  it('non-boolean state[id] coerces to false + warn-logs a2ui_toggle_type_mismatch', () => {
    const logger = makeLoggerSpy()
    const dispatch = makeDispatch()
    // Inject a string value to simulate a type mismatch
    renderToggle(
      makeNode({id: 'darkMode'}),
      {darkMode: 'maybe' as unknown as boolean},
      dispatch,
      logger,
    )
    const switchEl = screen.getByLabelText('Dark Mode')
    // Coerces to false
    expect(switchEl.props.value).toBe(false)
    // Warn-log fires exactly once
    expect(logger.warn).toHaveBeenCalledTimes(1)
    const [message, payload] = logger.warn.mock.calls[0]
    expect(message).toBe('a2ui_toggle_type_mismatch')
    expect(payload).toMatchObject({
      id: 'darkMode',
      expectedType: 'boolean',
      actualType: 'string',
    })
    // PII rule §G-4: the actual value ('maybe') MUST NOT appear in the log payload.
    const payloadStr = JSON.stringify(payload)
    expect(payloadStr).not.toContain('maybe')
    expect(payloadStr).not.toContain('"value"')
  })

  it('non-boolean number state coerces to false + logs actualType:number', () => {
    const logger = makeLoggerSpy()
    renderToggle(
      makeNode({id: 'darkMode'}),
      {darkMode: 42 as unknown as boolean},
      makeDispatch(),
      logger,
    )
    expect(logger.warn).toHaveBeenCalledTimes(1)
    const [, payload] = logger.warn.mock.calls[0]
    expect(payload).toMatchObject({actualType: 'number'})
    // The number 42 must not appear in the log payload.
    expect(JSON.stringify(payload)).not.toContain('42')
  })
})

// -- T-0003-095b: Toggle with missing id → disabled Switch + warn-log --------

describe('ToggleRenderer — T-0003-095b: missing id → disabled Switch + warn-log', () => {
  it('node with missing id renders a disabled Switch and warn-logs a2ui_toggle_missing_id', () => {
    const logger = makeLoggerSpy()
    const dispatch = makeDispatch()
    // Force missing id via `as any` cast (bypasses TypeScript's required-field check).
    const nodeWithoutId = {
      type: 'Toggle',
      label: 'Dark Mode',
      // id intentionally omitted
    } as unknown as A2UIToggleNode
    // Should not throw — Error Boundary must not trip.
    expect(() => renderToggle(nodeWithoutId, {}, dispatch, logger)).not.toThrow()
    // The switch should be rendered as disabled — query by label
    const switchEl = screen.getByLabelText('Dark Mode')
    expect(switchEl.props.disabled).toBe(true)
    // Warn-log fires
    expect(logger.warn).toHaveBeenCalledWith('a2ui_toggle_missing_id', expect.anything())
  })
})

// -- T-0003-096: Snapshot — Toggle on + label --------------------------------

describe('ToggleRenderer — T-0003-096: snapshot Toggle on + label', () => {
  // CLAUDE.md §8 snapshot rationale: Toggle is a new component (Step 6).
  // These snapshots are new baselines. No prior snapshot to compare against.
  it('snapshot: Toggle on (value=true) with label', () => {
    const tree = create(
      <RendererThemeProvider value={DEFAULT_LIGHT_THEME}>
        <RendererLoggerProvider logger={makeLoggerSpy()}>
          <ToggleRenderer
            node={makeNode({id: 'darkMode', label: 'Dark Mode', defaultValue: true})}
            state={{darkMode: true}}
            dispatch={makeDispatch()}
          />
        </RendererLoggerProvider>
      </RendererThemeProvider>,
    )
    expect(tree.toJSON()).toMatchSnapshot()
  })
})

// -- T-0003-097: Snapshot — Toggle off + label --------------------------------

describe('ToggleRenderer — T-0003-097: snapshot Toggle off + label', () => {
  it('snapshot: Toggle off (value=false) with label', () => {
    const tree = create(
      <RendererThemeProvider value={DEFAULT_LIGHT_THEME}>
        <RendererLoggerProvider logger={makeLoggerSpy()}>
          <ToggleRenderer
            node={makeNode({id: 'darkMode', label: 'Dark Mode'})}
            state={{darkMode: false}}
            dispatch={makeDispatch()}
          />
        </RendererLoggerProvider>
      </RendererThemeProvider>,
    )
    expect(tree.toJSON()).toMatchSnapshot()
  })
})

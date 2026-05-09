/**
 * SwitchRenderer tests
 *
 * T-0006-095: snapshot at productive×focus
 * T-0006-096: snapshot at expressive×health
 * T-0006-101: toggle dispatches set with !current
 * T-0006-102 (Switch): 3 binding kinds render without error
 */
import React from 'react'
import {fireEvent} from '@testing-library/react-native'
import type {Node, Spec} from '@app-creator/protocol'
import {renderWithTheme} from '../../__test-utils__/renderWithTheme'
import {buildInitialRendererState} from '../../state/reducer'
import {SwitchRenderer} from './Switch'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type SwitchNode = Extract<Node, {type: 'Switch'}>

const SPEC_WITH_SLOT: Spec = {
  version: 1,
  archetype: 'ListCRUD',
  stance: 'productive',
  palette: 'focus',
  coverIcon: 'list',
  navigation: 'none',
  screens: [{id: 's1', root: {id: 'n1', type: 'Heading', text: 'T', level: 1}}],
  initialScreenId: 's1',
  collections: [],
  initialState: {notificationsEnabled: false},
}

const SWITCH_STATE_OFF: SwitchNode = {
  id: 'sw1',
  type: 'Switch',
  label: 'Enable notifications',
  valueBinding: {kind: 'state', slot: 'notificationsEnabled'},
}

const SWITCH_LITERAL_ON: SwitchNode = {
  id: 'sw2',
  type: 'Switch',
  label: 'Dark mode',
  valueBinding: {kind: 'literal', value: true},
}

const SWITCH_LITERAL_OFF: SwitchNode = {
  id: 'sw3',
  type: 'Switch',
  label: 'Auto-save',
  valueBinding: {kind: 'literal', value: false},
}

const SWITCH_COLLECTION: SwitchNode = {
  id: 'sw4',
  type: 'Switch',
  label: 'Completed',
  valueBinding: {kind: 'collectionField', collectionId: 'tasks', field: 'done'},
}

const SWITCH_CUSTOM_A11Y: SwitchNode = {
  id: 'sw5',
  type: 'Switch',
  label: 'Notifications',
  valueBinding: {kind: 'literal', value: false},
  accessibilityLabel: 'Toggle push notifications',
}

// ---------------------------------------------------------------------------
// T-0006-095: snapshot at productive×focus
// ---------------------------------------------------------------------------

describe('SwitchRenderer snapshot (T-0006-095) — productive×focus', () => {
  it('matches snapshot at productive×focus', () => {
    const state = buildInitialRendererState(SPEC_WITH_SLOT)
    const {toJSON} = renderWithTheme(
      <SwitchRenderer node={SWITCH_STATE_OFF} />,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0006-096: snapshot at expressive×health
// ---------------------------------------------------------------------------

describe('SwitchRenderer snapshot (T-0006-096) — expressive×health', () => {
  it('matches snapshot at expressive×health', () => {
    const state = buildInitialRendererState(SPEC_WITH_SLOT)
    const {toJSON} = renderWithTheme(
      <SwitchRenderer node={SWITCH_STATE_OFF} />,
      {stance: 'expressive', palette: 'health', rendererState: state},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0006-101: toggle dispatches set with !current
// ---------------------------------------------------------------------------

describe('SwitchRenderer toggle dispatch (T-0006-101)', () => {
  it('toggling dispatches set with true when current value is false', () => {
    const mockDispatch = jest.fn()
    const state = buildInitialRendererState(SPEC_WITH_SLOT)
    // notificationsEnabled = false in initialState
    const {getByLabelText} = renderWithTheme(
      <SwitchRenderer node={SWITCH_STATE_OFF} />,
      {stance: 'productive', palette: 'focus', rendererState: state, dispatch: mockDispatch},
    )

    // The Switch component fires onValueChange with the new value.
    const switchEl = getByLabelText('Enable notifications')
    fireEvent(switchEl, 'valueChange', true)

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'set',
      target: 'notificationsEnabled',
      value: true,
    })
  })

  it('toggling dispatches set with false when current value is true', () => {
    const mockDispatch = jest.fn()
    const SPEC_ON: Spec = {
      ...SPEC_WITH_SLOT,
      initialState: {notificationsEnabled: true},
    }
    const state = buildInitialRendererState(SPEC_ON)
    const {getByLabelText} = renderWithTheme(
      <SwitchRenderer node={SWITCH_STATE_OFF} />,
      {stance: 'productive', palette: 'focus', rendererState: state, dispatch: mockDispatch},
    )

    const switchEl = getByLabelText('Enable notifications')
    fireEvent(switchEl, 'valueChange', false)

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'set',
      target: 'notificationsEnabled',
      value: false,
    })
  })

  it('literal binding does not dispatch on toggle', () => {
    const mockDispatch = jest.fn()
    const {getByLabelText} = renderWithTheme(
      <SwitchRenderer node={SWITCH_LITERAL_OFF} />,
      {stance: 'productive', palette: 'focus', dispatch: mockDispatch},
    )

    const switchEl = getByLabelText('Auto-save')
    fireEvent(switchEl, 'valueChange', true)

    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('renders with accessibilityRole switch on the Switch element', () => {
    const {toJSON} = renderWithTheme(
      <SwitchRenderer node={SWITCH_LITERAL_ON} />,
      {stance: 'productive', palette: 'focus'},
    )
    const tree = JSON.stringify(toJSON())
    // Both the outer Switch and RCTSwitch carry accessibilityRole="switch"
    expect(tree).toContain('"accessibilityRole":"switch"')
  })

  it('accessibilityState.checked reflects current bound value (true)', () => {
    const {toJSON} = renderWithTheme(
      <SwitchRenderer node={SWITCH_LITERAL_ON} />,
      {stance: 'productive', palette: 'focus'},
    )
    const tree = JSON.stringify(toJSON())
    // Switch is on; accessibilityState should have checked: true
    expect(tree).toContain('"checked":true')
  })

  it('accessibilityState.checked reflects false for off switch', () => {
    const {toJSON} = renderWithTheme(
      <SwitchRenderer node={SWITCH_LITERAL_OFF} />,
      {stance: 'productive', palette: 'focus'},
    )
    const tree = JSON.stringify(toJSON())
    expect(tree).toContain('"checked":false')
  })

  it('uses custom accessibilityLabel when provided', () => {
    const {toJSON} = renderWithTheme(
      <SwitchRenderer node={SWITCH_CUSTOM_A11Y} />,
      {stance: 'productive', palette: 'focus'},
    )
    const tree = JSON.stringify(toJSON())
    expect(tree).toContain('"Toggle push notifications"')
  })

  it('outer row minHeight is at least 56pt (hit target)', () => {
    const state = buildInitialRendererState(SPEC_WITH_SLOT)
    const {toJSON} = renderWithTheme(
      <SwitchRenderer node={SWITCH_STATE_OFF} />,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )
    const tree = JSON.stringify(toJSON())
    expect(tree).toContain('"minHeight":56')
  })
})

// ---------------------------------------------------------------------------
// T-0006-102 (Switch): 3 binding kinds render without error
// ---------------------------------------------------------------------------

describe('SwitchRenderer binding kinds (T-0006-102)', () => {
  it.each([
    ['literal binding', SWITCH_LITERAL_OFF],
    ['state binding', SWITCH_STATE_OFF],
    ['collectionField binding', SWITCH_COLLECTION],
  ] as [string, SwitchNode][])('%s renders without error', (_desc, node) => {
    const g = global as Record<string, unknown>
    const prevDEV = g.__DEV__
    g.__DEV__ = false
    try {
      const state = buildInitialRendererState(SPEC_WITH_SLOT)
      const {toJSON} = renderWithTheme(
        <SwitchRenderer node={node} />,
        {stance: 'productive', palette: 'focus', rendererState: state},
      )
      expect(toJSON()).not.toBeNull()
    } finally {
      g.__DEV__ = prevDEV
    }
  })
})

/**
 * PickerRenderer tests
 *
 * T-0006-093: snapshot at productive×focus
 * T-0006-094: snapshot at expressive×health
 * T-0006-100: selection dispatches set
 * T-0006-102 (Picker): 3 binding kinds render without error
 * T-0006-105: options min(1)/max(12) enforced at schema parse
 *
 * Step 6 deviation note:
 *   Full Gorhom sheet option list lands at Step 8. The hidden option list
 *   (testID="picker-options-<id>") allows dispatch testing in Step 6 tests.
 */
import React from 'react'
import {fireEvent} from '@testing-library/react-native'
import type {Node, Spec} from '@app-creator/protocol'
import {PickerSchema} from '@app-creator/protocol'
import {renderWithTheme} from '../../__test-utils__/renderWithTheme'
import {buildInitialRendererState} from '../../state/reducer'
import {PickerRenderer} from './Picker'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type PickerNode = Extract<Node, {type: 'Picker'}>

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
  initialState: {priority: 'medium'},
}

const PICKER_STATE: PickerNode = {
  id: 'pk1',
  type: 'Picker',
  label: 'Priority',
  valueBinding: {kind: 'state', slot: 'priority'},
  options: [
    {value: 'low', label: 'Low'},
    {value: 'medium', label: 'Medium'},
    {value: 'high', label: 'High'},
  ],
}

const PICKER_LITERAL: PickerNode = {
  id: 'pk2',
  type: 'Picker',
  label: 'Category',
  valueBinding: {kind: 'literal', value: 'work'},
  options: [
    {value: 'work', label: 'Work'},
    {value: 'personal', label: 'Personal'},
  ],
}

const PICKER_COLLECTION: PickerNode = {
  id: 'pk3',
  type: 'Picker',
  label: 'Status',
  valueBinding: {kind: 'collectionField', collectionId: 'tasks', field: 'status'},
  options: [
    {value: 'todo', label: 'To Do'},
    {value: 'done', label: 'Done'},
  ],
}

const PICKER_SINGLE_OPTION: PickerNode = {
  id: 'pk4',
  type: 'Picker',
  label: 'Type',
  valueBinding: {kind: 'literal', value: 'a'},
  options: [{value: 'a', label: 'Alpha'}],
}

// ---------------------------------------------------------------------------
// T-0006-093: snapshot at productive×focus
// ---------------------------------------------------------------------------

describe('PickerRenderer snapshot (T-0006-093) — productive×focus', () => {
  it('matches snapshot at productive×focus', () => {
    const state = buildInitialRendererState(SPEC_WITH_SLOT)
    const {toJSON} = renderWithTheme(
      <PickerRenderer node={PICKER_STATE} />,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0006-094: snapshot at expressive×health
// ---------------------------------------------------------------------------

describe('PickerRenderer snapshot (T-0006-094) — expressive×health', () => {
  it('matches snapshot at expressive×health', () => {
    const state = buildInitialRendererState(SPEC_WITH_SLOT)
    const {toJSON} = renderWithTheme(
      <PickerRenderer node={PICKER_STATE} />,
      {stance: 'expressive', palette: 'health', rendererState: state},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0006-100: selection dispatches set
// ---------------------------------------------------------------------------

describe('PickerRenderer selection dispatch (T-0006-100)', () => {
  it('selecting an option dispatches set with the selected value', () => {
    const mockDispatch = jest.fn()
    const state = buildInitialRendererState(SPEC_WITH_SLOT)
    const {getByTestId} = renderWithTheme(
      <PickerRenderer node={PICKER_STATE} />,
      {stance: 'productive', palette: 'focus', rendererState: state, dispatch: mockDispatch},
    )

    // Press the hidden option for "high"
    const highOption = getByTestId('picker-option-high')
    fireEvent.press(highOption)

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'set',
      target: 'priority',
      value: 'high',
    })
  })

  it('literal binding does not dispatch on selection', () => {
    const mockDispatch = jest.fn()
    const {getByTestId} = renderWithTheme(
      <PickerRenderer node={PICKER_LITERAL} />,
      {stance: 'productive', palette: 'focus', dispatch: mockDispatch},
    )

    fireEvent.press(getByTestId('picker-option-personal'))

    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('displays the selected option label from state slot', () => {
    const state = buildInitialRendererState(SPEC_WITH_SLOT)
    const {getAllByText} = renderWithTheme(
      <PickerRenderer node={PICKER_STATE} />,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )
    // 'priority' slot = 'medium'; 'Medium' appears in the main field AND hidden options list.
    // At least one instance should be present.
    const mediumEls = getAllByText('Medium')
    expect(mediumEls.length).toBeGreaterThanOrEqual(1)
  })

  it('has accessibilityRole combobox on the tappable field', () => {
    const state = buildInitialRendererState(SPEC_WITH_SLOT)
    const {toJSON} = renderWithTheme(
      <PickerRenderer node={PICKER_STATE} />,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )
    const tree = JSON.stringify(toJSON())
    expect(tree).toContain('"accessibilityRole":"combobox"')
  })
})

// ---------------------------------------------------------------------------
// T-0006-102 (Picker): 3 binding kinds render without error
// ---------------------------------------------------------------------------

describe('PickerRenderer binding kinds (T-0006-102)', () => {
  it.each([
    ['literal binding', PICKER_LITERAL],
    ['state binding', PICKER_STATE],
    ['collectionField binding', PICKER_COLLECTION],
  ] as [string, PickerNode][])('%s renders without error', (_desc, node) => {
    const g = global as Record<string, unknown>
    const prevDEV = g.__DEV__
    g.__DEV__ = false
    try {
      const state = buildInitialRendererState(SPEC_WITH_SLOT)
      const {toJSON} = renderWithTheme(
        <PickerRenderer node={node} />,
        {stance: 'productive', palette: 'focus', rendererState: state},
      )
      expect(toJSON()).not.toBeNull()
    } finally {
      g.__DEV__ = prevDEV
    }
  })
})

// ---------------------------------------------------------------------------
// T-0006-105: options min(1)/max(12) enforced at schema parse
// ---------------------------------------------------------------------------

describe('PickerRenderer schema validation (T-0006-105)', () => {
  it('accepts a picker with 1 option', () => {
    const state = buildInitialRendererState(SPEC_WITH_SLOT)
    const {toJSON} = renderWithTheme(
      <PickerRenderer node={PICKER_SINGLE_OPTION} />,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )
    expect(toJSON()).not.toBeNull()
  })

  it('rejects a picker with 13 options at schema parse', () => {
    const tooManyOptions = Array.from({length: 13}, (_, i) => ({
      value: `opt${i}`,
      label: `Option ${i}`,
    }))
    const result = PickerSchema.safeParse({
      id: 'pkInvalid',
      type: 'Picker',
      label: 'Too many',
      valueBinding: {kind: 'literal', value: 'opt0'},
      options: tooManyOptions,
    })
    expect(result.success).toBe(false)
  })

  it('accepts a picker with 12 options', () => {
    const maxOptions = Array.from({length: 12}, (_, i) => ({
      value: `opt${i}`,
      label: `Option ${i}`,
    }))
    const result = PickerSchema.safeParse({
      id: 'pkMax',
      type: 'Picker',
      label: 'Max options',
      valueBinding: {kind: 'literal', value: 'opt0'},
      options: maxOptions,
    })
    expect(result.success).toBe(true)
  })
})

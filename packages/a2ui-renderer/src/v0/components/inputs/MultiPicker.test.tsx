/**
 * MultiPickerRenderer tests — ADR-0009 Step 2
 *
 * T-0009-040: Schema parse succeeds.
 * T-0009-041: Comma in option value rejects at schema.
 * T-0009-042: CSV binding parses to selected list; chip dismissal removes one.
 * T-0009-043: 16 options succeeds; 17 rejects.
 * T-0009-059: Snapshots at productive×focus + expressive×health.
 * T-0009-067: min/max schema parse succeeds; renderer enforces at submit.
 * T-0009-233: Empty CSV → [].
 * T-0009-234: Trailing comma → ['a'].
 */
import React from 'react'
import {fireEvent, act} from '@testing-library/react-native'
import type {Node, Spec} from '@app-creator/protocol'
import {MultiPickerSchema} from '@app-creator/protocol'
import {renderWithTheme} from '../../__test-utils__/renderWithTheme'
import {buildInitialRendererState} from '../../state/reducer'
import {MultiPickerRenderer, parseCSV, joinCSV} from './MultiPicker'

type MultiPickerNode = Extract<Node, {type: 'MultiPicker'}>

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SPEC: Spec = {
  version: 1,
  archetype: 'Journal',
  stance: 'expressive',
  palette: 'health',
  coverIcon: 'list',
  navigation: 'none',
  screens: [{id: 's1', root: {id: 'n1', type: 'Heading', text: 'T', level: 1}}],
  initialScreenId: 's1',
  collections: [],
  initialState: {tags: 'work,personal'},
}

const OPTIONS_3 = [
  {value: 'work', label: 'Work'},
  {value: 'personal', label: 'Personal'},
  {value: 'health', label: 'Health'},
]

const MP_STATE: MultiPickerNode = {
  id: 'mp1',
  type: 'MultiPicker',
  label: 'Tags',
  valueBinding: {kind: 'state', slot: 'tags'},
  options: OPTIONS_3,
}

const MP_LITERAL: MultiPickerNode = {
  id: 'mp2',
  type: 'MultiPicker',
  label: 'Categories',
  valueBinding: {kind: 'literal', value: 'work'},
  options: OPTIONS_3,
}

// ---------------------------------------------------------------------------
// T-0009-233: Empty CSV parse
// ---------------------------------------------------------------------------

describe('parseCSV — empty CSV (T-0009-233)', () => {
  it("'' (empty string) → [] (not [''])", () => {
    expect(parseCSV('')).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// T-0009-234: Trailing comma parse
// ---------------------------------------------------------------------------

describe('parseCSV — trailing comma (T-0009-234)', () => {
  it("'a,' → ['a'] (trailing comma ignored)", () => {
    expect(parseCSV('a,')).toEqual(['a'])
  })

  it("'a,b,c' → ['a','b','c']", () => {
    expect(parseCSV('a,b,c')).toEqual(['a', 'b', 'c'])
  })
})

describe('joinCSV', () => {
  it("['a','b'] → 'a,b'", () => {
    expect(joinCSV(['a', 'b'])).toBe('a,b')
  })

  it('[] → ""', () => {
    expect(joinCSV([])).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Schema validation (T-0009-040, T-0009-041, T-0009-043, T-0009-067)
// ---------------------------------------------------------------------------

describe('MultiPickerSchema validation', () => {
  const BASE = {
    id: 'mp1',
    type: 'MultiPicker' as const,
    label: 'Tags',
    valueBinding: {kind: 'state' as const, slot: 'tags'},
    options: [{value: 'a', label: 'Alpha'}],
  }

  it('parses valid schema (T-0009-040)', () => {
    const result = MultiPickerSchema.safeParse(BASE)
    expect(result.success).toBe(true)
  })

  it('rejects option value with comma (T-0009-041)', () => {
    const result = MultiPickerSchema.safeParse({
      ...BASE,
      options: [{value: 'a,b', label: 'Invalid'}],
    })
    expect(result.success).toBe(false)
  })

  it('accepts exactly 16 options (T-0009-043)', () => {
    const options = Array.from({length: 16}, (_, i) => ({value: `opt${i}`, label: `Opt ${i}`}))
    const result = MultiPickerSchema.safeParse({...BASE, options})
    expect(result.success).toBe(true)
  })

  it('rejects 17 options (T-0009-043)', () => {
    const options = Array.from({length: 17}, (_, i) => ({value: `opt${i}`, label: `Opt ${i}`}))
    const result = MultiPickerSchema.safeParse({...BASE, options})
    expect(result.success).toBe(false)
  })

  it('parses with min/max (T-0009-067)', () => {
    const result = MultiPickerSchema.safeParse({...BASE, min: 2, max: 5})
    expect(result.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// T-0009-059: Snapshots
// ---------------------------------------------------------------------------

describe('MultiPickerRenderer snapshot (T-0009-059) — productive×focus', () => {
  it('matches snapshot at productive×focus', () => {
    const {toJSON} = renderWithTheme(
      <MultiPickerRenderer node={MP_LITERAL} />,
      {stance: 'productive', palette: 'focus'},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})

describe('MultiPickerRenderer snapshot (T-0009-059) — expressive×health', () => {
  it('matches snapshot at expressive×health', () => {
    const {toJSON} = renderWithTheme(
      <MultiPickerRenderer node={MP_LITERAL} />,
      {stance: 'expressive', palette: 'health'},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// Renderer behavior (T-0009-042)
// ---------------------------------------------------------------------------

describe('MultiPickerRenderer behavior (T-0009-042)', () => {
  it('renders selected chips from CSV binding', () => {
    const state = buildInitialRendererState(SPEC)
    const {queryByTestId} = renderWithTheme(
      <MultiPickerRenderer node={MP_STATE} />,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )
    // 'work' and 'personal' should be selected (from 'work,personal' CSV).
    expect(queryByTestId('multipicker-chip-label-work')).toBeTruthy()
    expect(queryByTestId('multipicker-chip-label-personal')).toBeTruthy()
  })

  it('chip remove dispatches updated CSV', () => {
    const mockDispatch = jest.fn()
    const state = buildInitialRendererState(SPEC)
    const {getByTestId} = renderWithTheme(
      <MultiPickerRenderer node={MP_STATE} />,
      {stance: 'productive', palette: 'focus', rendererState: state, dispatch: mockDispatch},
    )

    // Remove 'work' chip
    act(() => { fireEvent.press(getByTestId('multipicker-chip-remove-work')) })

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'set',
      target: 'tags',
      value: 'personal',
    })
  })

  it('opens sheet on trigger press', () => {
    const {getByTestId, queryByTestId} = renderWithTheme(
      <MultiPickerRenderer node={MP_LITERAL} />,
      {stance: 'productive', palette: 'focus'},
    )
    expect(queryByTestId('bottom-sheet-modal')).toBeNull()
    act(() => { fireEvent.press(getByTestId('multipicker-trigger-mp2')) })
    expect(getByTestId('bottom-sheet-modal')).toBeTruthy()
  })

  it('options have accessibilityRole checkbox', () => {
    const {getByTestId} = renderWithTheme(
      <MultiPickerRenderer node={MP_LITERAL} />,
      {stance: 'productive', palette: 'focus'},
    )
    act(() => { fireEvent.press(getByTestId('multipicker-trigger-mp2')) })
    const workOption = getByTestId('multipicker-option-work')
    expect(workOption.props.accessibilityRole).toBe('checkbox')
  })

  it('has accessibilityRole combobox on trigger', () => {
    const {toJSON} = renderWithTheme(
      <MultiPickerRenderer node={MP_LITERAL} />,
      {stance: 'productive', palette: 'focus'},
    )
    const tree = JSON.stringify(toJSON())
    expect(tree).toContain('"accessibilityRole":"combobox"')
  })

  it('does not dispatch for literal binding on Done', () => {
    const mockDispatch = jest.fn()
    const {getByTestId} = renderWithTheme(
      <MultiPickerRenderer node={MP_LITERAL} />,
      {stance: 'productive', palette: 'focus', dispatch: mockDispatch},
    )

    act(() => { fireEvent.press(getByTestId('multipicker-trigger-mp2')) })
    act(() => { fireEvent.press(getByTestId('multipicker-done-mp2')) })

    expect(mockDispatch).not.toHaveBeenCalled()
  })
})

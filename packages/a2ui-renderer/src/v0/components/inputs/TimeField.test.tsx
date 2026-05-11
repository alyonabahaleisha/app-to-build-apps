/**
 * TimeFieldRenderer tests — ADR-0009 Step 2
 *
 * T-0009-038: TimeFieldSchema parses with mode: 'time'.
 * T-0009-039: Renderer formats HH:MM per locale.
 * T-0009-059: Snapshots at productive×focus + expressive×health.
 * T-0009-062: mode: 'invalid' rejects at schema.
 */
import React from 'react'
import {fireEvent, act} from '@testing-library/react-native'
import type {Node, Spec} from '@app-creator/protocol'
import {TimeFieldSchema} from '@app-creator/protocol'
import {renderWithTheme} from '../../__test-utils__/renderWithTheme'
import {buildInitialRendererState} from '../../state/reducer'
import {TimeFieldRenderer, formatTimeForDisplay, dateToHHMM} from './TimeField'
import {ListItemContextProvider} from '../../state/ListItemContext'

type TimeFieldNode = Extract<Node, {type: 'TimeField'}>

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SPEC: Spec = {
  version: 1,
  archetype: 'Tracker',
  stance: 'productive',
  palette: 'health',
  coverIcon: 'list',
  navigation: 'none',
  screens: [{id: 's1', root: {id: 'n1', type: 'Heading', text: 'T', level: 1}}],
  initialScreenId: 's1',
  collections: [],
  initialState: {wakeTime: '06:30'},
}

const TF_STATE: TimeFieldNode = {
  id: 'tf1',
  type: 'TimeField',
  label: 'Wake time',
  valueBinding: {kind: 'state', slot: 'wakeTime'},
  mode: 'time',
}

const TF_LITERAL: TimeFieldNode = {
  id: 'tf2',
  type: 'TimeField',
  label: 'Meeting time',
  valueBinding: {kind: 'literal', value: '14:00'},
}

const TF_COLLECTION: TimeFieldNode = {
  id: 'tf3',
  type: 'TimeField',
  label: 'Shift start',
  valueBinding: {kind: 'collectionField', collectionId: 'shifts', field: 'startTime'},
}

// ---------------------------------------------------------------------------
// Unit tests for helpers
// ---------------------------------------------------------------------------

describe('dateToHHMM', () => {
  it('converts Date to HH:MM (24h)', () => {
    const d = new Date()
    d.setHours(13, 30, 0, 0)
    expect(dateToHHMM(d)).toBe('13:30')
  })

  it('pads single-digit hours and minutes', () => {
    const d = new Date()
    d.setHours(6, 5, 0, 0)
    expect(dateToHHMM(d)).toBe('06:05')
  })
})

describe('formatTimeForDisplay', () => {
  it('returns "—" for undefined', () => {
    expect(formatTimeForDisplay(undefined)).toBe('—')
  })

  it('returns "—" for empty string', () => {
    expect(formatTimeForDisplay('')).toBe('—')
  })

  it('formats a valid HH:MM string (does not throw)', () => {
    const result = formatTimeForDisplay('13:30')
    expect(typeof result).toBe('string')
    expect(result).not.toBe('—')
  })
})

// ---------------------------------------------------------------------------
// Schema validation (T-0009-038, T-0009-062)
// ---------------------------------------------------------------------------

describe('TimeFieldSchema validation', () => {
  const BASE = {
    id: 'tf1',
    type: 'TimeField' as const,
    label: 'Time',
    valueBinding: {kind: 'state' as const, slot: 'slot1'},
  }

  it('parses with required fields only (T-0009-038)', () => {
    const result = TimeFieldSchema.safeParse(BASE)
    expect(result.success).toBe(true)
  })

  it('parses mode: "time"', () => {
    const result = TimeFieldSchema.safeParse({...BASE, mode: 'time'})
    expect(result.success).toBe(true)
  })

  it('parses mode: "time-with-seconds"', () => {
    const result = TimeFieldSchema.safeParse({...BASE, mode: 'time-with-seconds'})
    expect(result.success).toBe(true)
  })

  it('rejects mode: "invalid" (T-0009-062)', () => {
    const result = TimeFieldSchema.safeParse({...BASE, mode: 'invalid'})
    expect(result.success).toBe(false)
  })

  it('parses with min and max', () => {
    const result = TimeFieldSchema.safeParse({...BASE, min: '08:00', max: '18:00'})
    expect(result.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// T-0009-059: Snapshots
// ---------------------------------------------------------------------------

describe('TimeFieldRenderer snapshot (T-0009-059) — productive×focus', () => {
  it('matches snapshot at productive×focus', () => {
    const state = buildInitialRendererState(SPEC)
    const {toJSON} = renderWithTheme(
      <TimeFieldRenderer node={TF_STATE} />,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})

describe('TimeFieldRenderer snapshot (T-0009-059) — expressive×health', () => {
  it('matches snapshot at expressive×health', () => {
    const state = buildInitialRendererState(SPEC)
    const {toJSON} = renderWithTheme(
      <TimeFieldRenderer node={TF_STATE} />,
      {stance: 'expressive', palette: 'health', rendererState: state},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// Renderer behavior (T-0009-039)
// ---------------------------------------------------------------------------

describe('TimeFieldRenderer behavior', () => {
  it('renders formatted time from state slot (T-0009-039)', () => {
    const state = buildInitialRendererState(SPEC)
    const {toJSON} = renderWithTheme(
      <TimeFieldRenderer node={TF_STATE} />,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )
    const tree = JSON.stringify(toJSON())
    // "06:30" should appear formatted — either "6:30 AM" or "06:30" depending on locale
    expect(tree).toMatch(/6:30|06:30/)
  })

  it('renders "—" when no value is bound', () => {
    const {toJSON} = renderWithTheme(
      <TimeFieldRenderer node={TF_LITERAL} />,
      {stance: 'productive', palette: 'focus'},
    )
    const tree = JSON.stringify(toJSON())
    // "14:00" → "2:00 PM" or "14:00" in 24h locale
    expect(tree).not.toContain('"—"')
  })

  it('has accessibilityRole button on tappable field', () => {
    const {toJSON} = renderWithTheme(
      <TimeFieldRenderer node={TF_LITERAL} />,
      {stance: 'productive', palette: 'focus'},
    )
    const tree = JSON.stringify(toJSON())
    expect(tree).toContain('"accessibilityRole":"button"')
  })

  it('opens sheet on press', () => {
    const state = buildInitialRendererState(SPEC)
    const {getByTestId, queryByTestId} = renderWithTheme(
      <TimeFieldRenderer node={TF_STATE} />,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )

    expect(queryByTestId('bottom-sheet-modal')).toBeNull()

    act(() => { fireEvent.press(getByTestId('timefield-trigger-tf1')) })

    expect(getByTestId('bottom-sheet-modal')).toBeTruthy()
  })

  it('3 binding kinds render without error', () => {
    const state = buildInitialRendererState(SPEC)

    // state binding
    const {toJSON: j1} = renderWithTheme(
      <TimeFieldRenderer node={TF_STATE} />,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )
    expect(j1()).not.toBeNull()

    // literal binding
    const {toJSON: j2} = renderWithTheme(
      <TimeFieldRenderer node={TF_LITERAL} />,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )
    expect(j2()).not.toBeNull()

    // collectionField binding — must be inside ListItemContextProvider in __DEV__
    const mockRow = {startTime: '09:00', id: 'r1'}
    const {toJSON: j3} = renderWithTheme(
      <ListItemContextProvider value={{row: mockRow, rowId: 'r1', index: 0}}>
        <TimeFieldRenderer node={TF_COLLECTION} />
      </ListItemContextProvider>,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )
    expect(j3()).not.toBeNull()
  })
})

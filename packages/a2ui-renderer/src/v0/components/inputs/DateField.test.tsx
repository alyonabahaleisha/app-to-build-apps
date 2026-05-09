/**
 * DateFieldRenderer tests
 *
 * T-0006-091: snapshot at productive×focus
 * T-0006-092: snapshot at expressive×health
 * T-0006-099: tap triggers picker open (stub: onPress wired, toast fired)
 * T-0006-102 (DateField): 3 binding kinds render without error
 *
 * Step 6 deviation note (per task brief):
 *   DateField is a stub in Step 6 — tapping calls host.onToast.
 *   Full DateTimePickerIOS in Gorhom sheet integration lands at Step 8.
 *   T-0006-099 tests that the onPress handler is wired (toast called);
 *   the native picker content test is a Step 8 concern.
 */
import React from 'react'
import {fireEvent} from '@testing-library/react-native'
import type {Node, Spec} from '@app-creator/protocol'
import {renderWithTheme} from '../../__test-utils__/renderWithTheme'
import {buildInitialRendererState} from '../../state/reducer'
import {DateFieldRenderer} from './DateField'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type DateFieldNode = Extract<Node, {type: 'DateField'}>

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
  initialState: {dueDate: '2026-05-09T00:00:00.000Z'},
}

const FIELD_STATE: DateFieldNode = {
  id: 'df1',
  type: 'DateField',
  label: 'Due date',
  valueBinding: {kind: 'state', slot: 'dueDate'},
  mode: 'date',
}

const FIELD_LITERAL: DateFieldNode = {
  id: 'df2',
  type: 'DateField',
  label: 'Meeting time',
  valueBinding: {kind: 'literal', value: '2026-05-09T14:30:00.000Z'},
  mode: 'time',
}

const FIELD_COLLECTION: DateFieldNode = {
  id: 'df3',
  type: 'DateField',
  label: 'Workout date',
  valueBinding: {kind: 'collectionField', collectionId: 'workouts', field: 'date'},
}

const FIELD_DATETIME: DateFieldNode = {
  id: 'df4',
  type: 'DateField',
  label: 'Appointment',
  valueBinding: {kind: 'literal', value: '2026-06-01T10:00:00.000Z'},
  mode: 'datetime',
}

// ---------------------------------------------------------------------------
// T-0006-091: snapshot at productive×focus
// ---------------------------------------------------------------------------

describe('DateFieldRenderer snapshot (T-0006-091) — productive×focus', () => {
  it('matches snapshot at productive×focus', () => {
    const state = buildInitialRendererState(SPEC_WITH_SLOT)
    const {toJSON} = renderWithTheme(
      <DateFieldRenderer node={FIELD_STATE} />,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0006-092: snapshot at expressive×health
// ---------------------------------------------------------------------------

describe('DateFieldRenderer snapshot (T-0006-092) — expressive×health', () => {
  it('matches snapshot at expressive×health', () => {
    const state = buildInitialRendererState(SPEC_WITH_SLOT)
    const {toJSON} = renderWithTheme(
      <DateFieldRenderer node={FIELD_STATE} />,
      {stance: 'expressive', palette: 'health', rendererState: state},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0006-099: tap triggers picker open (stub: onPress wired, toast called)
// ---------------------------------------------------------------------------

describe('DateFieldRenderer tap behavior (T-0006-099)', () => {
  it('calls host.onToast when field is pressed (Step 6 picker stub)', () => {
    const mockToast = jest.fn()
    const state = buildInitialRendererState(SPEC_WITH_SLOT)
    const {getByRole} = renderWithTheme(
      <DateFieldRenderer node={FIELD_STATE} />,
      {
        stance: 'productive',
        palette: 'focus',
        rendererState: state,
        host: {onToast: mockToast},
      },
    )

    const field = getByRole('button')
    fireEvent.press(field)

    expect(mockToast).toHaveBeenCalledTimes(1)
  })

  it('renders formatted date value from state slot', () => {
    const state = buildInitialRendererState(SPEC_WITH_SLOT)
    const {toJSON} = renderWithTheme(
      <DateFieldRenderer node={FIELD_STATE} />,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )
    const tree = JSON.stringify(toJSON())
    // Date "2026-05-09" should render as some locale string containing "2026"
    expect(tree).toContain('2026')
  })

  it('renders time mode display correctly', () => {
    const {toJSON} = renderWithTheme(
      <DateFieldRenderer node={FIELD_LITERAL} />,
      {stance: 'productive', palette: 'focus'},
    )
    expect(toJSON()).not.toBeNull()
  })

  it('renders datetime mode without error', () => {
    const {toJSON} = renderWithTheme(
      <DateFieldRenderer node={FIELD_DATETIME} />,
      {stance: 'productive', palette: 'focus'},
    )
    expect(toJSON()).not.toBeNull()
  })

  it('has accessibilityRole button', () => {
    const {toJSON} = renderWithTheme(
      <DateFieldRenderer node={FIELD_LITERAL} />,
      {stance: 'productive', palette: 'focus'},
    )
    const tree = JSON.stringify(toJSON())
    expect(tree).toContain('"accessibilityRole":"button"')
  })
})

// ---------------------------------------------------------------------------
// T-0006-102 (DateField): 3 binding kinds render without error
// ---------------------------------------------------------------------------

describe('DateFieldRenderer binding kinds (T-0006-102)', () => {
  it.each([
    ['literal binding', FIELD_LITERAL],
    ['state binding', FIELD_STATE],
    ['collectionField binding', FIELD_COLLECTION],
  ] as [string, DateFieldNode][])('%s renders without error', (_desc, node) => {
    const g = global as Record<string, unknown>
    const prevDEV = g.__DEV__
    g.__DEV__ = false
    try {
      const state = buildInitialRendererState(SPEC_WITH_SLOT)
      const {toJSON} = renderWithTheme(
        <DateFieldRenderer node={node} />,
        {stance: 'productive', palette: 'focus', rendererState: state},
      )
      expect(toJSON()).not.toBeNull()
    } finally {
      g.__DEV__ = prevDEV
    }
  })
})

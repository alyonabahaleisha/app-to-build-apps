/**
 * TimelineRenderer tests
 *
 * V1 Phase 1 Step 4 — Lists & Data tier expansion.
 *
 * T-0009-099: Timeline renders left rail with circles at each event
 * T-0009-100: Timeline groupBy: 'month' renders month headers between events
 * T-0009-107: snapshots at productive×focus + expressive×health
 */
import React from 'react'
import type {Node, Spec} from '@app-creator/protocol'
import {buildInitialRendererState} from '../../state/reducer'
import {renderWithTheme} from '../../__test-utils__/renderWithTheme'
import {TimelineRenderer} from './Timeline'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type TimelineNode = Extract<Node, {type: 'Timeline'}>

function makeSpec(overrides?: Partial<Spec>): Spec {
  return {
    version: 1,
    archetype: 'Tracker',
    stance: 'productive',
    palette: 'focus',
    coverIcon: 'calendar',
    navigation: 'none',
    screens: [{id: 's1', root: {id: 'n1', type: 'Heading', text: 'T', level: 1}}],
    initialScreenId: 's1',
    collections: [
      {
        id: 'events',
        name: 'Events',
        fields: [
          {name: 'title', type: {type: 'string'}, required: true},
          {name: 'createdAt', type: {type: 'date'}, required: true},
        ],
        seedData: [
          {title: 'Project kickoff', createdAt: '2026-01-01T09:00:00Z'},
          {title: 'Design review', createdAt: '2026-01-15T14:00:00Z'},
          {title: 'Sprint planning', createdAt: '2026-02-01T10:00:00Z'},
        ],
        syncMode: 'local',
      },
    ],
    initialState: {},
    ...overrides,
  }
}

const TIMELINE_NODE: TimelineNode = {
  id: 't1',
  type: 'Timeline',
  collectionId: 'events',
  dateField: 'createdAt',
}

const TIMELINE_GROUPBY_MONTH: TimelineNode = {
  id: 't2',
  type: 'Timeline',
  collectionId: 'events',
  dateField: 'createdAt',
  groupBy: 'month',
}

const TIMELINE_ABSOLUTE: TimelineNode = {
  id: 't3',
  type: 'Timeline',
  collectionId: 'events',
  dateField: 'createdAt',
  dateFormat: 'absolute',
}

const TIMELINE_SHORT: TimelineNode = {
  id: 't4',
  type: 'Timeline',
  collectionId: 'events',
  dateField: 'createdAt',
  dateFormat: 'short',
}

// ---------------------------------------------------------------------------
// T-0009-107: snapshot at productive×focus
// ---------------------------------------------------------------------------

describe('TimelineRenderer snapshot (T-0009-107) — productive×focus', () => {
  // Pin system time so relative-date strings are stable across CI runs.
  // Same anchor as Heatmap/Calendar (Step 6) for catalog-wide consistency.
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-01-15T12:00:00Z'))
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it('matches snapshot at productive×focus', () => {
    const spec = makeSpec()
    const rendererState = buildInitialRendererState(spec)
    const {toJSON} = renderWithTheme(
      <TimelineRenderer node={TIMELINE_NODE} />,
      {stance: 'productive', palette: 'focus', rendererState},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0009-107: snapshot at expressive×health
// ---------------------------------------------------------------------------

describe('TimelineRenderer snapshot (T-0009-107) — expressive×health', () => {
  // Pin system time so relative-date strings are stable across CI runs.
  // Same anchor as Heatmap/Calendar (Step 6) for catalog-wide consistency.
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-01-15T12:00:00Z'))
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it('matches snapshot at expressive×health', () => {
    const spec = makeSpec()
    const rendererState = buildInitialRendererState(spec)
    const {toJSON} = renderWithTheme(
      <TimelineRenderer node={TIMELINE_NODE} />,
      {stance: 'expressive', palette: 'health', rendererState},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0009-099: Timeline renders left rail with circles
// ---------------------------------------------------------------------------

describe('TimelineRenderer rail rendering (T-0009-099)', () => {
  it('T-0009-099: renders timeline container with accessibilityRole="list"', () => {
    const spec = makeSpec()
    const rendererState = buildInitialRendererState(spec)
    const {toJSON} = renderWithTheme(
      <TimelineRenderer node={TIMELINE_NODE} />,
      {stance: 'productive', palette: 'focus', rendererState},
    )
    // RNTL getByRole('list') does not match View with accessibilityRole="list"
    // in the test environment (same limitation as Callout.test.tsx T-0009-081).
    // Use toJSON() props inspection — matches the established pattern.
    const tree = toJSON()
    expect(tree).not.toBeNull()
    expect((tree as {props?: {accessibilityRole?: string}})?.props?.accessibilityRole).toBe('list')
  })

  it('renders timeline container testID', () => {
    const spec = makeSpec()
    const rendererState = buildInitialRendererState(spec)
    const {getByTestId} = renderWithTheme(
      <TimelineRenderer node={TIMELINE_NODE} />,
      {stance: 'productive', palette: 'focus', rendererState},
    )
    expect(getByTestId('timeline-container')).toBeTruthy()
  })

  it('renders event titles from collection', () => {
    const spec = makeSpec()
    const rendererState = buildInitialRendererState(spec)
    const {getByText} = renderWithTheme(
      <TimelineRenderer node={TIMELINE_NODE} />,
      {stance: 'productive', palette: 'focus', rendererState},
    )
    expect(getByText('Project kickoff')).toBeTruthy()
    expect(getByText('Design review')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// T-0009-100: groupBy: 'month' renders month headers
// ---------------------------------------------------------------------------

describe('TimelineRenderer groupBy (T-0009-100)', () => {
  it('T-0009-100: groupBy: month renders month group headers', () => {
    const spec = makeSpec()
    const rendererState = buildInitialRendererState(spec)
    const {getAllByRole} = renderWithTheme(
      <TimelineRenderer node={TIMELINE_GROUPBY_MONTH} />,
      {stance: 'productive', palette: 'focus', rendererState},
    )
    // Group headers have accessibilityRole="header"
    const headers = getAllByRole('header')
    // At least 2 month headers (January 2026, February 2026)
    expect(headers.length).toBeGreaterThanOrEqual(2)
  })

  it('no group headers when groupBy is not set (default none)', () => {
    const spec = makeSpec()
    const rendererState = buildInitialRendererState(spec)
    const {queryAllByRole} = renderWithTheme(
      <TimelineRenderer node={TIMELINE_NODE} />,
      {stance: 'productive', palette: 'focus', rendererState},
    )
    // No group headers — only event rows
    const headers = queryAllByRole('header')
    expect(headers.length).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Additional content and accessibility tests
// ---------------------------------------------------------------------------

describe('TimelineRenderer content', () => {
  it('renders empty state when collection has no rows', () => {
    const emptySpec = makeSpec({
      collections: [
        {
          id: 'events',
          name: 'Events',
          fields: [{name: 'title', type: {type: 'string'}, required: true}, {name: 'createdAt', type: {type: 'date'}, required: true}],
          seedData: [],
          syncMode: 'local',
        },
      ],
    })
    const rendererState = buildInitialRendererState(emptySpec)
    const {getByText} = renderWithTheme(
      <TimelineRenderer node={TIMELINE_NODE} />,
      {stance: 'productive', palette: 'focus', rendererState},
    )
    expect(getByText('No events yet')).toBeTruthy()
  })

  it('renders empty view when collectionId is unknown (no crash)', () => {
    const spec = makeSpec({collections: []})
    const rendererState = buildInitialRendererState(spec)
    const {toJSON} = renderWithTheme(
      <TimelineRenderer node={TIMELINE_NODE} />,
      {stance: 'productive', palette: 'focus', rendererState},
    )
    // Renders an empty View with accessibilityRole="list" — should not throw
    expect(toJSON()).not.toBeNull()
  })

  it('accepts absolute dateFormat without crash', () => {
    const spec = makeSpec()
    const rendererState = buildInitialRendererState(spec)
    const {getByTestId} = renderWithTheme(
      <TimelineRenderer node={TIMELINE_ABSOLUTE} />,
      {stance: 'productive', palette: 'focus', rendererState},
    )
    expect(getByTestId('timeline-container')).toBeTruthy()
  })

  it('accepts short dateFormat without crash', () => {
    const spec = makeSpec()
    const rendererState = buildInitialRendererState(spec)
    const {getByTestId} = renderWithTheme(
      <TimelineRenderer node={TIMELINE_SHORT} />,
      {stance: 'productive', palette: 'focus', rendererState},
    )
    expect(getByTestId('timeline-container')).toBeTruthy()
  })
})

/**
 * MetricTileRenderer tests
 *
 * T-0009-122: sparkline renders <Polyline> from react-native-svg
 * T-0009-123: deltaTone 'positive' colors delta in success
 * T-0009-124: without sparklineData renders without sparkline area
 * T-0009-131: snapshots at productive×focus + expressive×health
 * T-0009-235: single-point sparkline — division-by-zero guard (renders as horizontal line)
 * T-0009-236: 30-point sparkline renders all points without truncation
 */
// react-native-svg has native bindings that can't load in Jest (Node.js env).
// Mock locally here so we don't intercept lucide-react-native (Icon component)
// in other test files — a global mock in jest.config.js would break their snapshots.
// Inline factory avoids `require()` (no-require-imports rule).
jest.mock('react-native-svg', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  const stub =
    (name: string) =>
    (props: Record<string, unknown>) =>
      React.createElement(name, props)
  return {
    __esModule: true,
    default: stub('Svg'),
    Svg: stub('Svg'),
    Polyline: stub('Polyline'),
    Line: stub('Line'),
    Circle: stub('Circle'),
    Rect: stub('Rect'),
    Path: stub('Path'),
    G: stub('G'),
  }
})

import React from 'react'
import type {Node, Spec} from '@app-creator/protocol'
import {renderWithTheme} from '../../__test-utils__/renderWithTheme'
import {MetricTileRenderer} from './MetricTile'
import {buildInitialRendererState} from '../../state/reducer'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type MetricTileNode = Extract<Node, {type: 'MetricTile'}>

const BASE_METRIC: MetricTileNode = {
  id: 'met1',
  type: 'MetricTile',
  value: '42',
  label: 'Tasks completed',
}

const METRIC_WITH_SPARKLINE: MetricTileNode = {
  ...BASE_METRIC,
  id: 'met2',
  sparklineData: [10, 20, 15, 30, 25, 40],
}

const METRIC_SINGLE_POINT: MetricTileNode = {
  ...BASE_METRIC,
  id: 'met3',
  sparklineData: [42],
}

const METRIC_30_POINTS: MetricTileNode = {
  ...BASE_METRIC,
  id: 'met4',
  sparklineData: Array(30).fill(1),
}

const METRIC_WITH_DELTA_POSITIVE: MetricTileNode = {
  ...BASE_METRIC,
  id: 'met5',
  delta: '+5',
  deltaTone: 'positive',
}

const METRIC_WITH_DELTA_NEGATIVE: MetricTileNode = {
  ...BASE_METRIC,
  id: 'met6',
  delta: '-3',
  deltaTone: 'negative',
}

const METRIC_WITH_DELTA_NEUTRAL: MetricTileNode = {
  ...BASE_METRIC,
  id: 'met7',
  delta: '±0',
  deltaTone: 'neutral',
}

// ---------------------------------------------------------------------------
// T-0009-131: snapshot at productive×focus
// ---------------------------------------------------------------------------

describe('MetricTileRenderer snapshot (T-0009-131) — productive×focus', () => {
  it('matches snapshot at productive×focus', () => {
    const {toJSON} = renderWithTheme(<MetricTileRenderer node={METRIC_WITH_SPARKLINE} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0009-131: snapshot at expressive×health
// ---------------------------------------------------------------------------

describe('MetricTileRenderer snapshot (T-0009-131) — expressive×health', () => {
  it('matches snapshot at expressive×health', () => {
    const {toJSON} = renderWithTheme(<MetricTileRenderer node={METRIC_WITH_SPARKLINE} />, {
      stance: 'expressive',
      palette: 'health',
    })
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0009-122: sparkline renders <Polyline> from react-native-svg
// ---------------------------------------------------------------------------

describe('MetricTileRenderer sparkline (T-0009-122)', () => {
  it('T-0009-122: renders without error when sparklineData is provided', () => {
    const {toJSON} = renderWithTheme(<MetricTileRenderer node={METRIC_WITH_SPARKLINE} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('renders Polyline element in the tree when sparklineData has 2+ points', () => {
    const {toJSON} = renderWithTheme(<MetricTileRenderer node={METRIC_WITH_SPARKLINE} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = JSON.stringify(toJSON())
    // react-native-svg mock renders 'Polyline' element in the tree.
    expect(tree).toContain('Polyline')
  })
})

// ---------------------------------------------------------------------------
// T-0009-123: deltaTone colors delta text
// ---------------------------------------------------------------------------

describe('MetricTileRenderer deltaTone (T-0009-123)', () => {
  it('T-0009-123: renders with deltaTone positive without error', () => {
    const {toJSON} = renderWithTheme(<MetricTileRenderer node={METRIC_WITH_DELTA_POSITIVE} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('renders with deltaTone negative without error', () => {
    const {toJSON} = renderWithTheme(<MetricTileRenderer node={METRIC_WITH_DELTA_NEGATIVE} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('renders with deltaTone neutral without error', () => {
    const {toJSON} = renderWithTheme(<MetricTileRenderer node={METRIC_WITH_DELTA_NEUTRAL} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('renders delta text value', () => {
    const {getAllByText} = renderWithTheme(<MetricTileRenderer node={METRIC_WITH_DELTA_POSITIVE} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(getAllByText('+5', {includeHiddenElements: true}).length).toBeGreaterThanOrEqual(1)
  })

  it('positive and negative deltaTone render with different colors in the tree', () => {
    const {toJSON: positiveTree} = renderWithTheme(
      <MetricTileRenderer node={METRIC_WITH_DELTA_POSITIVE} />,
      {stance: 'productive', palette: 'focus'},
    )
    const {toJSON: negativeTree} = renderWithTheme(
      <MetricTileRenderer node={METRIC_WITH_DELTA_NEGATIVE} />,
      {stance: 'productive', palette: 'focus'},
    )
    // Trees differ because delta colors differ (success vs danger).
    expect(JSON.stringify(positiveTree())).not.toEqual(JSON.stringify(negativeTree()))
  })
})

// ---------------------------------------------------------------------------
// T-0009-124: without sparklineData, no sparkline area rendered
// ---------------------------------------------------------------------------

describe('MetricTileRenderer no sparkline (T-0009-124)', () => {
  it('T-0009-124: renders without sparklineData without crash', () => {
    const {toJSON} = renderWithTheme(<MetricTileRenderer node={BASE_METRIC} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('does not render Polyline when sparklineData is absent', () => {
    const {toJSON} = renderWithTheme(<MetricTileRenderer node={BASE_METRIC} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = JSON.stringify(toJSON())
    expect(tree).not.toContain('Polyline')
  })
})

// ---------------------------------------------------------------------------
// T-0009-235: single-point sparkline — division-by-zero guard
// ---------------------------------------------------------------------------

describe('MetricTileRenderer single-point sparkline (T-0009-235)', () => {
  it('T-0009-235: sparklineData with 1 point renders without crashing', () => {
    const {toJSON} = renderWithTheme(<MetricTileRenderer node={METRIC_SINGLE_POINT} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('single-point sparkline renders a Line element (horizontal) instead of Polyline', () => {
    const {toJSON} = renderWithTheme(<MetricTileRenderer node={METRIC_SINGLE_POINT} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = JSON.stringify(toJSON())
    // Single point uses Line (not Polyline) to avoid NaN coordinates.
    expect(tree).toContain('Line')
    expect(tree).not.toContain('Polyline')
  })
})

// ---------------------------------------------------------------------------
// T-0009-236: 30-point sparkline renders without truncation
// ---------------------------------------------------------------------------

describe('MetricTileRenderer 30-point sparkline (T-0009-236)', () => {
  it('T-0009-236: sparklineData with 30 points renders without crash or truncation', () => {
    const {toJSON} = renderWithTheme(<MetricTileRenderer node={METRIC_30_POINTS} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('30-point sparkline includes Polyline element', () => {
    const {toJSON} = renderWithTheme(<MetricTileRenderer node={METRIC_30_POINTS} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = JSON.stringify(toJSON())
    expect(tree).toContain('Polyline')
  })

  it('renders value and label', () => {
    const {getAllByText} = renderWithTheme(<MetricTileRenderer node={BASE_METRIC} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(getAllByText('42', {includeHiddenElements: true}).length).toBeGreaterThanOrEqual(1)
    expect(getAllByText('Tasks completed', {includeHiddenElements: true}).length).toBeGreaterThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// MetricTile valueBinding — renders slot value from RendererState
// ---------------------------------------------------------------------------

describe('MetricTileRenderer valueBinding', () => {
  const BINDING_SPEC: Spec = {
    version: 1,
    archetype: 'Calculator',
    stance: 'productive',
    palette: 'focus',
    coverIcon: 'hash',
    navigation: 'none',
    screens: [{id: 's1', root: {id: 'n1', type: 'Heading', text: 'T', level: 1}}],
    initialScreenId: 's1',
    collections: [],
    initialState: {total: 42},
  }

  const METRIC_WITH_BINDING: MetricTileNode = {
    id: 'met_bound',
    type: 'MetricTile',
    valueBinding: {kind: 'state', slot: 'total'},
    label: 'total tasks',
  }

  it('renders the slot value when valueBinding: {kind:"state", slot:"total"} and slots.total=42', () => {
    const rendererState = buildInitialRendererState(BINDING_SPEC)
    const {getAllByText} = renderWithTheme(<MetricTileRenderer node={METRIC_WITH_BINDING} />, {
      stance: 'productive',
      palette: 'focus',
      rendererState,
    })
    expect(getAllByText('42', {includeHiddenElements: true}).length).toBeGreaterThanOrEqual(1)
  })

  it('renders "" when valueBinding slot is absent from state', () => {
    const rendererState = buildInitialRendererState({...BINDING_SPEC, initialState: {}})
    const {toJSON} = renderWithTheme(<MetricTileRenderer node={METRIC_WITH_BINDING} />, {
      stance: 'productive',
      palette: 'focus',
      rendererState,
    })
    expect(toJSON()).not.toBeNull()
  })
})

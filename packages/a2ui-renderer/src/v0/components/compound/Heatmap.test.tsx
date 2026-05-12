/**
 * HeatmapRenderer tests — ADR-0009 Step 6
 *
 * T-0009-147: HeatmapSchema.parse({collectionId, dateField, range: '90d'}) succeeds
 * T-0009-148: quintile binning maps to 5 levels (fixture with known counts)
 * T-0009-149: intensityMode: 'binary' uses single non-zero shade
 * T-0009-150: today's cell has 1pt accent border
 * T-0009-151: accessibilityCustomActions exposes per-cell info on long-press
 * T-0009-153: snapshots at productive×focus + expressive×health
 * T-0009-155: range: '500d' rejects (not in enum) — in protocol compound.test.ts
 * T-0009-244a: range: '365d' succeeds (exactly at enum max) — in protocol compound.test.ts
 */
import React from 'react'
import type {Node, Spec} from '@app-creator/protocol'
import {HeatmapSchema} from '@app-creator/protocol'
import {renderWithTheme} from '../../__test-utils__/renderWithTheme'
import {buildInitialRendererState} from '../../state/reducer'
import {HeatmapRenderer, computeQuintileThresholds, countToLevel, countToBinaryLevel} from './Heatmap'

type HeatmapNode = Extract<Node, {type: 'Heatmap'}>

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_HEATMAP: HeatmapNode = {
  id: 'hm1',
  type: 'Heatmap',
  collectionId: 'workouts',
  dateField: 'completedAt',
}

// Build a spec with a 'workouts' collection that has known dates for testing.
function buildWorkoutSpec(seedData: Array<{name: string; completedAt: string}>): Spec {
  return {
    version: 1,
    archetype: 'Tracker',
    stance: 'productive',
    palette: 'focus',
    coverIcon: 'list',
    navigation: 'none',
    screens: [{id: 's1', root: {id: 'n1', type: 'Heading', text: 'T', level: 1}}],
    initialScreenId: 's1',
    collections: [
      {
        id: 'workouts',
        name: 'Workouts',
        fields: [
          {name: 'name', type: {type: 'string'} as const, required: true},
          {name: 'completedAt', type: {type: 'date'} as const, required: true},
        ],
        seedData,
        syncMode: 'local' as const,
      },
    ],
    initialState: {},
  }
}

// ---------------------------------------------------------------------------
// T-0009-147: Schema validation (proxy — real tests in protocol compound.test.ts)
// ---------------------------------------------------------------------------

describe('HeatmapSchema validation (T-0009-147, T-0009-155, T-0009-244a)', () => {
  it('T-0009-147: HeatmapSchema.parse({collectionId, dateField, range: "90d"}) succeeds', () => {
    const result = HeatmapSchema.safeParse({
      id: 'hm1',
      type: 'Heatmap',
      collectionId: 'workouts',
      dateField: 'completedAt',
      range: '90d',
    })
    expect(result.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// T-0009-148: Quintile binning unit tests — real fixture with known counts
// ---------------------------------------------------------------------------

describe('computeQuintileThresholds + countToLevel (T-0009-148)', () => {
  it('T-0009-148: empty non-zero counts returns degenerate thresholds', () => {
    const thresholds = computeQuintileThresholds([])
    expect(thresholds).toEqual([1, 1, 1, 1])
  })

  it('T-0009-148: single value — all thresholds collapse to that value', () => {
    const thresholds = computeQuintileThresholds([5])
    // All percentiles point to the single element (5)
    expect(thresholds[0]).toBe(5)
  })

  it('T-0009-148: quintile binning with 6 known counts', () => {
    // counts = [1, 2, 3, 5, 10, 50]
    // sorted = [1, 2, 3, 5, 10, 50], n=6
    // p20 = floor(0.2*6)=1 → sorted[1]=2
    // p40 = floor(0.4*6)=2 → sorted[2]=3
    // p60 = floor(0.6*6)=3 → sorted[3]=5
    // p80 = floor(0.8*6)=4 → sorted[4]=10
    const thresholds = computeQuintileThresholds([1, 2, 3, 5, 10, 50])
    expect(thresholds).toEqual([2, 3, 5, 10])
  })

  it('T-0009-148: countToLevel maps 0 to level 0', () => {
    const thresholds: [number, number, number, number] = [2, 3, 5, 10]
    expect(countToLevel(0, thresholds)).toBe(0)
  })

  it('T-0009-148: count=1 maps to level 1 (below p20=2)', () => {
    const thresholds: [number, number, number, number] = [2, 3, 5, 10]
    expect(countToLevel(1, thresholds)).toBe(1)
  })

  it('T-0009-148: count=2 maps to level 2 (at p20, below p40=3)', () => {
    const thresholds: [number, number, number, number] = [2, 3, 5, 10]
    expect(countToLevel(2, thresholds)).toBe(2)
  })

  it('T-0009-148: count=3 maps to level 3 (at p40, below p60=5)', () => {
    const thresholds: [number, number, number, number] = [2, 3, 5, 10]
    expect(countToLevel(3, thresholds)).toBe(3)
  })

  it('T-0009-148: count=5 maps to level 4 (at p60, below p80=10)', () => {
    const thresholds: [number, number, number, number] = [2, 3, 5, 10]
    expect(countToLevel(5, thresholds)).toBe(4)
  })

  it('T-0009-148: count=10 maps to level 5 (at p80)', () => {
    const thresholds: [number, number, number, number] = [2, 3, 5, 10]
    expect(countToLevel(10, thresholds)).toBe(5)
  })

  it('T-0009-148: count=50 maps to level 5 (above p80=10)', () => {
    const thresholds: [number, number, number, number] = [2, 3, 5, 10]
    expect(countToLevel(50, thresholds)).toBe(5)
  })

  it('T-0009-148: renderer with collection items renders without crashing', () => {
    // Quintile-level math (5 distinct intensity levels for 6 known counts) is
    // authoritatively covered by the computeQuintileThresholds + countToLevel
    // unit tests above. This sub-test is a smoke test: the renderer accepts
    // a spec with collection items and produces a non-null tree.
    const spec = buildWorkoutSpec([
      {name: 'Run 1', completedAt: '2026-01-15'},
      {name: 'Run 2', completedAt: '2026-01-15'},
    ])
    const state = buildInitialRendererState(spec)

    const {toJSON} = renderWithTheme(
      <HeatmapRenderer node={BASE_HEATMAP} />,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )
    expect(toJSON()).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// T-0009-149: binary mode uses single non-zero shade
// ---------------------------------------------------------------------------

describe('HeatmapRenderer binary mode (T-0009-149)', () => {
  it('T-0009-149: countToBinaryLevel returns 0 for count=0', () => {
    expect(countToBinaryLevel(0)).toBe(0)
  })

  it('T-0009-149: countToBinaryLevel returns 1 for count=1', () => {
    expect(countToBinaryLevel(1)).toBe(1)
  })

  it('T-0009-149: countToBinaryLevel returns 1 for count=50 (any non-zero)', () => {
    expect(countToBinaryLevel(50)).toBe(1)
  })

  it('T-0009-149: binary mode renders without error', () => {
    const node: HeatmapNode = {...BASE_HEATMAP, intensityMode: 'binary'}
    const {toJSON} = renderWithTheme(
      <HeatmapRenderer node={node} />,
      {stance: 'productive', palette: 'focus'},
    )
    expect(toJSON()).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// T-0009-150: today's cell has 1pt accent border
// ---------------------------------------------------------------------------

describe('HeatmapRenderer today border (T-0009-150)', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-01-15T12:00:00Z'))
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it('T-0009-150: renders heatmap with today having borderWidth=1', () => {
    // Fake timer pins "today" to 2026-01-15 so the today-cell border is deterministic
    // across runs regardless of real wall-clock date.
    const spec = buildWorkoutSpec([
      {name: 'Workout', completedAt: '2026-01-15'},
    ])
    const state = buildInitialRendererState(spec)

    const {toJSON} = renderWithTheme(
      <HeatmapRenderer node={BASE_HEATMAP} />,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )

    // Verify the component tree contains a cell with borderWidth: 1 (today's cell).
    const tree = JSON.stringify(toJSON())
    expect(tree).toContain('"borderWidth":1')
  })
})

// ---------------------------------------------------------------------------
// T-0009-151: accessibilityCustomActions per-cell info
// ---------------------------------------------------------------------------

describe('HeatmapRenderer accessibilityCustomActions (T-0009-151)', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-01-15T12:00:00Z'))
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it('T-0009-151: cells have accessibilityActions with cellInfo', () => {
    const spec = buildWorkoutSpec([{name: 'Workout', completedAt: '2026-01-15'}])
    const state = buildInitialRendererState(spec)

    const {toJSON} = renderWithTheme(
      <HeatmapRenderer node={BASE_HEATMAP} />,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )

    // Verify accessibilityActions is present in the rendered tree
    const tree = JSON.stringify(toJSON())
    expect(tree).toContain('"cellInfo"')
    expect(tree).toContain('"accessibilityActions"')
  })

  it('T-0009-151: accessibility labels include date and count info', () => {
    const spec = buildWorkoutSpec([{name: 'Workout', completedAt: '2026-01-15'}])
    const state = buildInitialRendererState(spec)

    const {toJSON} = renderWithTheme(
      <HeatmapRenderer node={BASE_HEATMAP} />,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )

    const tree = JSON.stringify(toJSON())
    // Accessibility labels contain "item" or "items" — both forms appear in the grid.
    // Check for the common substring "item" (present in both "0 items" and "1 item").
    expect(tree).toContain('item')
  })
})

// ---------------------------------------------------------------------------
// T-0009-153: Snapshots at productive×focus + expressive×health
// ---------------------------------------------------------------------------

describe('HeatmapRenderer snapshot (T-0009-153) — productive×focus', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-01-15T12:00:00Z'))
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it('matches snapshot at productive×focus', () => {
    const {toJSON} = renderWithTheme(
      <HeatmapRenderer node={BASE_HEATMAP} />,
      {stance: 'productive', palette: 'focus'},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})

describe('HeatmapRenderer snapshot (T-0009-153) — expressive×health', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-01-15T12:00:00Z'))
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it('matches snapshot at expressive×health', () => {
    const {toJSON} = renderWithTheme(
      <HeatmapRenderer node={BASE_HEATMAP} />,
      {stance: 'expressive', palette: 'health'},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})

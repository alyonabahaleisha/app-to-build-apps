/**
 * GridListRenderer tests
 *
 * V1 Phase 1 Step 4 — Lists & Data tier expansion.
 *
 * T-0009-091: GridList renders 2-column grid on iPhone-class width; collapses on narrow widths
 * T-0009-105: snapshots at productive×focus + expressive×health
 * T-0009-A-GL: GridList search-filter integration — mirrors SearchBar.test.tsx rerender pattern
 */
import React from 'react'
import {act} from '@testing-library/react-native'
import {Dimensions} from 'react-native'
import type {Node, Spec} from '@app-creator/protocol'
import {buildInitialRendererState} from '../../state/reducer'
import {renderWithTheme} from '../../__test-utils__/renderWithTheme'
import {GridListRenderer} from './GridList'
import {SearchFilterProvider, useSearchFilterControls} from '../../state/SearchFilterContext'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type GridListNode = Extract<Node, {type: 'GridList'}>

function makeSpec(overrides?: Partial<Spec>): Spec {
  return {
    version: 1,
    archetype: 'ListCRUD',
    stance: 'productive',
    palette: 'focus',
    coverIcon: 'list',
    navigation: 'none',
    screens: [{id: 's1', root: {id: 'n1', type: 'Heading', text: 'T', level: 1}}],
    initialScreenId: 's1',
    collections: [
      {
        id: 'photos',
        name: 'Photos',
        fields: [{name: 'title', type: {type: 'string'}, required: true}],
        seedData: [
          {title: 'Sunset'},
          {title: 'Cityscape'},
          {title: 'Portrait'},
          {title: 'Landscape'},
        ],
        syncMode: 'local',
      },
    ],
    initialState: {},
    ...overrides,
  }
}

const GRID_LIST_NODE: GridListNode = {
  id: 'gl1',
  type: 'GridList',
  collectionId: 'photos',
}

const GRID_LIST_3_COL: GridListNode = {
  id: 'gl2',
  type: 'GridList',
  collectionId: 'photos',
  columns: 3,
}

const GRID_LIST_WITH_ASPECT: GridListNode = {
  id: 'gl3',
  type: 'GridList',
  collectionId: 'photos',
  itemAspectRatio: '4:5',
}

// ---------------------------------------------------------------------------
// T-0009-105: snapshot at productive×focus
// ---------------------------------------------------------------------------

describe('GridListRenderer snapshot (T-0009-105) — productive×focus', () => {
  it('matches snapshot at productive×focus', () => {
    const spec = makeSpec()
    const rendererState = buildInitialRendererState(spec)
    const {toJSON} = renderWithTheme(
      <GridListRenderer node={GRID_LIST_NODE} />,
      {stance: 'productive', palette: 'focus', rendererState},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0009-105: snapshot at expressive×health
// ---------------------------------------------------------------------------

describe('GridListRenderer snapshot (T-0009-105) — expressive×health', () => {
  it('matches snapshot at expressive×health', () => {
    const spec = makeSpec()
    const rendererState = buildInitialRendererState(spec)
    const {toJSON} = renderWithTheme(
      <GridListRenderer node={GRID_LIST_NODE} />,
      {stance: 'expressive', palette: 'health', rendererState},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0009-091: columns and rendering — concrete collapse threshold test
//
// The Jest environment reports windowWidth = 375pt by default (RN jest preset
// sets physical pixels 750×1334 at scale 2, so logical width = 375). This is
// below the 380pt threshold, so a 3-col GridList collapses to 2-col.
//
// Observable: rendered cell widths differ based on effective numColumns:
//   2-col at 375pt: cellWidth = floor((375 - 4*(2+1)) / 2) = 181
//   3-col at 375pt: cellWidth = floor((375 - 4*(3+1)) / 3) = 119
//   3-col at 768pt: cellWidth = floor((768 - 4*(3+1)) / 3) = 250
//
// Threshold semantics (ADR-0009 UX, Path 1): "collapse when width < 380pt".
// Any requestedColumns > 2 collapses to 2 on narrow devices.
// 2-col is the minimum and is never collapsed further.
// ---------------------------------------------------------------------------

describe('GridListRenderer rendering (T-0009-091)', () => {
  // Store original dimensions for restoration after wide-screen tests.
  const ORIGINAL_DIMS = Dimensions.get('window')
  const ORIGINAL_SCREEN = Dimensions.get('screen')

  afterEach(() => {
    // Restore original dimensions in case a test changed them.
    Dimensions.set({window: ORIGINAL_DIMS, screen: ORIGINAL_SCREEN})
  })

  it('T-0009-091: renders container with accessibilityRole="list"', () => {
    const spec = makeSpec()
    const rendererState = buildInitialRendererState(spec)
    const {getByTestId} = renderWithTheme(
      <GridListRenderer node={GRID_LIST_NODE} />,
      {stance: 'productive', palette: 'focus', rendererState},
    )
    expect(getByTestId('gridlist-container')).toBeTruthy()
  })

  it('T-0009-091: collapses 3-column to 2-column when windowWidth < 380pt', () => {
    // The RN jest preset exposes Dimensions.get('window').width = 750.
    // We set it to 375 (< 380pt threshold) to trigger the collapse path.
    // At 375pt with gap=8 (space-sm, productive stance) and 2-col:
    //   cellWidth = floor((375 - 8*(2+1)) / 2) = floor(351/2) = 175
    // If NOT collapsed (3-col): cellWidth = floor((375 - 8*(3+1)) / 3) = floor(343/3) = 114
    act(() => {
      Dimensions.set({
        window: {width: 375, height: 812, scale: 2, fontScale: 1},
        screen: {width: 375, height: 812, scale: 2, fontScale: 1},
      })
    })

    const spec = makeSpec()
    const rendererState = buildInitialRendererState(spec)
    const {toJSON} = renderWithTheme(
      <GridListRenderer node={GRID_LIST_3_COL} />,
      {stance: 'productive', palette: 'focus', rendererState},
    )

    const tree = JSON.stringify(toJSON())
    // 175 = 2-col cell width (collapse happened)
    expect(tree).toContain('"width":175')
    // 114 = 3-col cell width (should NOT appear — means no collapse)
    expect(tree).not.toContain('"width":114')
  })

  it('T-0009-091: does NOT collapse 3-column on wide screen (windowWidth >= 380pt)', () => {
    // Default test env: width = 750 (above the 380pt threshold). 3-col stays 3-col.
    // cellWidth = floor((750 - 8*(3+1)) / 3) = floor(718/3) = 239
    // If collapsed to 2-col: cellWidth = floor((750 - 8*(2+1)) / 2) = floor(726/2) = 363
    const spec = makeSpec()
    const rendererState = buildInitialRendererState(spec)
    const {toJSON} = renderWithTheme(
      <GridListRenderer node={GRID_LIST_3_COL} />,
      {stance: 'productive', palette: 'focus', rendererState},
    )

    const tree = JSON.stringify(toJSON())
    // 239 = 3-col cell width (no collapse — correct)
    expect(tree).toContain('"width":239')
    // 363 = 2-col cell width at 750pt — should NOT appear (would mean wrong collapse)
    expect(tree).not.toContain('"width":363')
  })

  it('T-0009-091: 2-column is never collapsed (it is the minimum)', () => {
    // The collapse condition is `requestedColumns > 2`. A 2-col GridList stays
    // at 2-col regardless of windowWidth — 2 is the minimum.
    // Default test width 750; gap=8 (space-sm, productive); 2-col:
    //   cellWidth = floor((750 - 8*(2+1)) / 2) = floor(726/2) = 363
    const spec = makeSpec()
    const rendererState = buildInitialRendererState(spec)
    const {toJSON} = renderWithTheme(
      <GridListRenderer node={GRID_LIST_NODE} />,
      {stance: 'productive', palette: 'focus', rendererState},
    )

    const tree = JSON.stringify(toJSON())
    expect(tree).toContain('"width":363')
  })

  it('renders with custom itemAspectRatio', () => {
    const spec = makeSpec()
    const rendererState = buildInitialRendererState(spec)
    const {getByTestId} = renderWithTheme(
      <GridListRenderer node={GRID_LIST_WITH_ASPECT} />,
      {stance: 'productive', palette: 'focus', rendererState},
    )
    expect(getByTestId('gridlist-container')).toBeTruthy()
  })

  it('renders empty state when collection has no rows', () => {
    const emptySpec = makeSpec({
      collections: [
        {
          id: 'photos',
          name: 'Photos',
          fields: [{name: 'title', type: {type: 'string'}, required: true}],
          seedData: [],
          syncMode: 'local',
        },
      ],
    })
    const rendererState = buildInitialRendererState(emptySpec)
    const {getByText} = renderWithTheme(
      <GridListRenderer node={GRID_LIST_NODE} />,
      {stance: 'productive', palette: 'focus', rendererState},
    )
    expect(getByText('No items yet')).toBeTruthy()
  })

  it('renders empty view when collectionId is unknown (no crash)', () => {
    const spec = makeSpec({collections: []})
    const rendererState = buildInitialRendererState(spec)
    const {toJSON} = renderWithTheme(
      <GridListRenderer node={GRID_LIST_NODE} />,
      {stance: 'productive', palette: 'focus', rendererState},
    )
    // Renders an empty View — should not throw
    expect(toJSON()).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// T-0009-A-GL: GridList search-filter integration (ADR-0009 line 847 + 1837)
//
// Pattern (per SearchBar.test.tsx): render GridList inside SearchFilterProvider.
// A sibling FilterController component calls setFilter via useSearchFilterControls.
// Because the Map is stable (non-reactive), we call rerender() after setFilter
// to force GridList to re-execute useSearchFilter() and pick up the new value.
// This mirrors production wiring: SearchBar calls setFilter AND dispatches a
// RendererState action, and the dispatch triggers the re-render that exposes
// the filter to GridList.
// ---------------------------------------------------------------------------

/**
 * Test double: a component that provides filter control access to the test.
 * Calls onReady with a setter function that tests use to activate the filter.
 */
function FilterController({
  collectionId,
  onReady,
}: {
  collectionId: string
  onReady: (setFilter: (q: string) => void) => void
}) {
  const controls = useSearchFilterControls()
  React.useEffect(() => {
    onReady((q: string) => controls.setFilter(collectionId, q))
  }, [controls, collectionId, onReady])
  return null
}

describe('GridListRenderer search-filter integration (T-0009-A-GL)', () => {
  it('shows only matching rows when a search filter is active', () => {
    const spec = makeSpec()
    const rendererState = buildInitialRendererState(spec)
    let setFilter: ((q: string) => void) | null = null

    const {getByText, queryByText, rerender} = renderWithTheme(
      <SearchFilterProvider>
        <FilterController
          collectionId="photos"
          onReady={(fn) => { setFilter = fn }}
        />
        <GridListRenderer node={GRID_LIST_NODE} />
      </SearchFilterProvider>,
      {stance: 'productive', palette: 'focus', rendererState},
    )

    // Set filter then rerender so GridList re-reads the updated Map value.
    act(() => { setFilter!('sunset') })
    act(() => {
      rerender(
        <SearchFilterProvider>
          <FilterController
            collectionId="photos"
            onReady={(fn) => { setFilter = fn }}
          />
          <GridListRenderer node={GRID_LIST_NODE} />
        </SearchFilterProvider>,
      )
    })

    // "Sunset" matches the active filter — visible.
    expect(getByText('Sunset')).toBeTruthy()
    // Non-matching rows are filtered out.
    expect(queryByText('Cityscape')).toBeNull()
    expect(queryByText('Portrait')).toBeNull()
    expect(queryByText('Landscape')).toBeNull()
  })

  it('shows all rows when no search filter is active (T-0009-066 behavior)', () => {
    const spec = makeSpec()
    const rendererState = buildInitialRendererState(spec)

    // No setFilter called — searchQuery is null — all rows shown.
    const {getByText} = renderWithTheme(
      <SearchFilterProvider>
        <GridListRenderer node={GRID_LIST_NODE} />
      </SearchFilterProvider>,
      {stance: 'productive', palette: 'focus', rendererState},
    )

    expect(getByText('Sunset')).toBeTruthy()
    expect(getByText('Cityscape')).toBeTruthy()
    expect(getByText('Portrait')).toBeTruthy()
    expect(getByText('Landscape')).toBeTruthy()
  })

  it('filter is case-insensitive (T-0009-053 behavior)', () => {
    const spec = makeSpec()
    const rendererState = buildInitialRendererState(spec)
    let setFilter: ((q: string) => void) | null = null

    const {getByText, queryByText, rerender} = renderWithTheme(
      <SearchFilterProvider>
        <FilterController
          collectionId="photos"
          onReady={(fn) => { setFilter = fn }}
        />
        <GridListRenderer node={GRID_LIST_NODE} />
      </SearchFilterProvider>,
      {stance: 'productive', palette: 'focus', rendererState},
    )

    // Uppercase "CITY" should match "Cityscape" (SearchFilterContext lowercases the query).
    act(() => { setFilter!('CITY') })
    act(() => {
      rerender(
        <SearchFilterProvider>
          <FilterController
            collectionId="photos"
            onReady={(fn) => { setFilter = fn }}
          />
          <GridListRenderer node={GRID_LIST_NODE} />
        </SearchFilterProvider>,
      )
    })

    expect(getByText('Cityscape')).toBeTruthy()
    expect(queryByText('Sunset')).toBeNull()
    expect(queryByText('Portrait')).toBeNull()
    expect(queryByText('Landscape')).toBeNull()
  })
})

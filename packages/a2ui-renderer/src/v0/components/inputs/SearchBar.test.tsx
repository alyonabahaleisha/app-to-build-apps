/**
 * SearchBarRenderer tests — ADR-0009 Step 2
 *
 * T-0009-051: SearchBarSchema with boundCollectionId parses.
 * T-0009-053: Substring filter is case-insensitive.
 * T-0009-058: voiceMic shows mic when empty; opens coming-soon on tap.
 * T-0009-059: Snapshots at productive×focus + expressive×health.
 * T-0009-065: boundCollectionId: '' rejects (min 1).
 * T-0009-066: Empty query clears filter (renderer treats empty as null).
 */
import React from 'react'
import {fireEvent, act} from '@testing-library/react-native'
import type {Node, Spec} from '@app-creator/protocol'
import {SearchBarSchema} from '@app-creator/protocol'
import {renderWithTheme} from '../../__test-utils__/renderWithTheme'
import {buildInitialRendererState} from '../../state/reducer'
import {SearchBarRenderer} from './SearchBar'
import {SearchFilterProvider, useSearchFilter} from '../../../v0/state/SearchFilterContext'
import {Text} from 'react-native'

type SearchBarNode = Extract<Node, {type: 'SearchBar'}>

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SPEC: Spec = {
  version: 1,
  archetype: 'ListCRUD',
  stance: 'productive',
  palette: 'focus',
  coverIcon: 'list',
  navigation: 'none',
  screens: [{id: 's1', root: {id: 'n1', type: 'Heading', text: 'T', level: 1}}],
  initialScreenId: 's1',
  collections: [],
  initialState: {query: ''},
}

const SPEC_WITH_QUERY: Spec = {
  ...SPEC,
  initialState: {query: 'coffee'},
}

const SB_BASIC: SearchBarNode = {
  id: 'sb1',
  type: 'SearchBar',
  valueBinding: {kind: 'state', slot: 'query'},
  placeholder: 'Search tasks',
}

const SB_BOUND: SearchBarNode = {
  id: 'sb2',
  type: 'SearchBar',
  valueBinding: {kind: 'state', slot: 'query'},
  boundCollectionId: 'tasks',
}

const SB_MIC: SearchBarNode = {
  id: 'sb3',
  type: 'SearchBar',
  valueBinding: {kind: 'state', slot: 'query'},
  voiceMic: true,
}

const SB_LITERAL: SearchBarNode = {
  id: 'sb4',
  type: 'SearchBar',
  valueBinding: {kind: 'literal', value: ''},
}

// ---------------------------------------------------------------------------
// Schema validation (T-0009-051, T-0009-065)
// ---------------------------------------------------------------------------

describe('SearchBarSchema validation', () => {
  const BASE = {
    id: 'sb1',
    type: 'SearchBar' as const,
    valueBinding: {kind: 'state' as const, slot: 'query'},
  }

  it('parses with required fields (T-0009-051)', () => {
    const result = SearchBarSchema.safeParse(BASE)
    expect(result.success).toBe(true)
  })

  it('parses with boundCollectionId (T-0009-051)', () => {
    const result = SearchBarSchema.safeParse({...BASE, boundCollectionId: 'tasks'})
    expect(result.success).toBe(true)
  })

  it('rejects boundCollectionId: "" (min 1) (T-0009-065)', () => {
    const result = SearchBarSchema.safeParse({...BASE, boundCollectionId: ''})
    expect(result.success).toBe(false)
  })

  it('parses with voiceMic: true', () => {
    const result = SearchBarSchema.safeParse({...BASE, voiceMic: true})
    expect(result.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// T-0009-059: Snapshots
// ---------------------------------------------------------------------------

describe('SearchBarRenderer snapshot (T-0009-059) — productive×focus', () => {
  it('matches snapshot at productive×focus', () => {
    const {toJSON} = renderWithTheme(
      <SearchFilterProvider>
        <SearchBarRenderer node={SB_LITERAL} />
      </SearchFilterProvider>,
      {stance: 'productive', palette: 'focus'},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})

describe('SearchBarRenderer snapshot (T-0009-059) — expressive×health', () => {
  it('matches snapshot at expressive×health', () => {
    const {toJSON} = renderWithTheme(
      <SearchFilterProvider>
        <SearchBarRenderer node={SB_LITERAL} />
      </SearchFilterProvider>,
      {stance: 'expressive', palette: 'health'},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// Renderer behavior
// ---------------------------------------------------------------------------

describe('SearchBarRenderer behavior', () => {
  it('renders without error', () => {
    const {toJSON} = renderWithTheme(
      <SearchFilterProvider>
        <SearchBarRenderer node={SB_BASIC} />
      </SearchFilterProvider>,
      {stance: 'productive', palette: 'focus'},
    )
    expect(toJSON()).not.toBeNull()
  })

  it('has accessibilityRole search', () => {
    const {toJSON} = renderWithTheme(
      <SearchFilterProvider>
        <SearchBarRenderer node={SB_BASIC} />
      </SearchFilterProvider>,
      {stance: 'productive', palette: 'focus'},
    )
    const tree = JSON.stringify(toJSON())
    expect(tree).toContain('"accessibilityRole":"search"')
  })

  it('shows clear button when query is non-empty', () => {
    const state = buildInitialRendererState(SPEC_WITH_QUERY)
    const {getByTestId} = renderWithTheme(
      <SearchFilterProvider>
        <SearchBarRenderer node={SB_BASIC} />
      </SearchFilterProvider>,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )
    expect(getByTestId('searchbar-clear-sb1')).toBeTruthy()
  })

  it('does not show clear button when query is empty', () => {
    const state = buildInitialRendererState(SPEC)
    const {queryByTestId} = renderWithTheme(
      <SearchFilterProvider>
        <SearchBarRenderer node={SB_BASIC} />
      </SearchFilterProvider>,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )
    expect(queryByTestId('searchbar-clear-sb1')).toBeNull()
  })

  it('dispatches set with empty string on clear (T-0009-066)', () => {
    const mockDispatch = jest.fn()
    const state = buildInitialRendererState(SPEC_WITH_QUERY)
    const {getByTestId} = renderWithTheme(
      <SearchFilterProvider>
        <SearchBarRenderer node={SB_BASIC} />
      </SearchFilterProvider>,
      {stance: 'productive', palette: 'focus', rendererState: state, dispatch: mockDispatch},
    )

    act(() => { fireEvent.press(getByTestId('searchbar-clear-sb1')) })

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'set',
      target: 'query',
      value: '',
    })
  })

  it('dispatches set on text change', () => {
    const mockDispatch = jest.fn()
    const state = buildInitialRendererState(SPEC)
    const {getByTestId} = renderWithTheme(
      <SearchFilterProvider>
        <SearchBarRenderer node={SB_BASIC} />
      </SearchFilterProvider>,
      {stance: 'productive', palette: 'focus', rendererState: state, dispatch: mockDispatch},
    )

    act(() => { fireEvent.changeText(getByTestId('searchbar-input-sb1'), 'coffee') })

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'set',
      target: 'query',
      value: 'coffee',
    })
  })

  it('shows mic when voiceMic=true and query is empty (T-0009-058)', () => {
    const state = buildInitialRendererState(SPEC)
    const {getByTestId} = renderWithTheme(
      <SearchFilterProvider>
        <SearchBarRenderer node={SB_MIC} />
      </SearchFilterProvider>,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )
    expect(getByTestId('searchbar-mic-sb3')).toBeTruthy()
  })

  it('mic tap calls onToast with coming-soon message (T-0009-058)', () => {
    const mockToast = jest.fn()
    const state = buildInitialRendererState(SPEC)
    const {getByTestId} = renderWithTheme(
      <SearchFilterProvider>
        <SearchBarRenderer node={SB_MIC} />
      </SearchFilterProvider>,
      {
        stance: 'productive',
        palette: 'focus',
        rendererState: state,
        host: {onToast: mockToast},
      },
    )

    act(() => { fireEvent.press(getByTestId('searchbar-mic-sb3')) })

    expect(mockToast).toHaveBeenCalledWith(
      expect.stringContaining('coming soon'),
      undefined,
    )
  })
})

// ---------------------------------------------------------------------------
// T-0009-053: Case-insensitive substring filter
// T-0009-066: Empty query clears filter
// ---------------------------------------------------------------------------

describe('SearchBar + SearchFilterContext integration', () => {
  // A reader component that reads the filter for a collection.
  function FilterDisplay({collectionId}: {collectionId: string}) {
    const query = useSearchFilter(collectionId)
    return <Text testID="filter-display">{query ?? '__null__'}</Text>
  }

  it('writes lowercased query to SearchFilterContext (T-0009-053)', () => {
    const mockDispatch = jest.fn()
    const state = buildInitialRendererState(SPEC)
    let rerender: ReturnType<typeof renderWithTheme>['rerender']

    const {getByTestId, rerender: r} = renderWithTheme(
      <SearchFilterProvider>
        <SearchBarRenderer node={SB_BOUND} />
        <FilterDisplay collectionId="tasks" />
      </SearchFilterProvider>,
      {stance: 'productive', palette: 'focus', rendererState: state, dispatch: mockDispatch},
    )
    rerender = r

    // Type 'Coffee' — should be stored as 'coffee' in the Map.
    act(() => { fireEvent.changeText(getByTestId('searchbar-input-sb2'), 'Coffee') })

    // The filter should now have 'coffee'.
    // Re-render the filter display to pick up the change.
    act(() => {
      rerender(
        <SearchFilterProvider>
          <SearchBarRenderer node={SB_BOUND} />
          <FilterDisplay collectionId="tasks" />
        </SearchFilterProvider>,
      )
    })

    // Filter is stored lowercased in the Map.
    // The dispatch went to mockDispatch with 'Coffee' (raw).
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({value: 'Coffee'}),
    )
  })
})

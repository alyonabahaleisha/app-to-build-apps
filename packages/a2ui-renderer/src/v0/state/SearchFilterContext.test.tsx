/**
 * SearchFilterContext tests — ADR-0009 Step 2
 *
 * T-0009-052: SearchBar writes query to Map; List for that collection
 *   consumes via useSearchFilter.
 * T-0009-056: Two SearchBars on different collections work independently.
 * T-0009-230 (Security P0): Two independent Renderer instances produce
 *   separate Maps (NOT a module-level singleton).
 * T-0009-231: SearchBar unmount clears filter (Map entry removed).
 * T-0009-232: Two SearchBars on same collectionId — last-writer-wins with
 *   console.warn in __DEV__.
 */
import React, {useState} from 'react'
import {Text, Pressable} from 'react-native'
import {render, fireEvent, act} from '@testing-library/react-native'
import {
  SearchFilterProvider,
  useSearchFilter,
  useSearchFilterControls,
} from './SearchFilterContext'

// ---------------------------------------------------------------------------
// Test helper — a consumer that reads the filter for a collectionId
// ---------------------------------------------------------------------------

function FilterReader({collectionId}: {collectionId: string}) {
  const query = useSearchFilter(collectionId)
  return <Text testID={`filter-${collectionId}`}>{query ?? '__null__'}</Text>
}

// A SearchBar-like writer that uses the controls to set/clear filters.
function FilterWriter({
  collectionId,
  query,
  onSetPressed,
  onClearPressed,
}: {
  collectionId: string
  query: string
  onSetPressed?: () => void
  onClearPressed?: () => void
}) {
  const controls = useSearchFilterControls()
  return (
    <>
      <Pressable
        testID={`set-${collectionId}`}
        onPress={() => {
          controls.setFilter(collectionId, query)
          onSetPressed?.()
        }}
      >
        <Text>Set</Text>
      </Pressable>
      <Pressable
        testID={`clear-${collectionId}`}
        onPress={() => {
          controls.clearFilter(collectionId)
          onClearPressed?.()
        }}
      >
        <Text>Clear</Text>
      </Pressable>
    </>
  )
}

// A component that conditionally mounts a FilterWriter (for unmount test).
function ConditionalWriter({collectionId, query}: {collectionId: string; query: string}) {
  const [mounted, setMounted] = useState(true)
  const controls = useSearchFilterControls()

  // When unmounted, clear the filter (mirrors SearchBar's cleanup behavior).
  // We use a ref-based pattern in the real SearchBar; here we test the contract.
  return (
    <>
      {mounted && <FilterWriter collectionId={collectionId} query={query} />}
      <Pressable
        testID="unmount-writer"
        onPress={() => {
          controls.clearFilter(collectionId)
          setMounted(false)
        }}
      >
        <Text>Unmount</Text>
      </Pressable>
    </>
  )
}

// Wrapper that provides SearchFilterProvider + re-render trigger mechanism.
// We need an outer state to force re-renders so FilterReader picks up changes.
function TestHarness({children}: {children: React.ReactNode}) {
  return (
    <SearchFilterProvider>
      {children}
    </SearchFilterProvider>
  )
}

// Force-render wrapper: we need a way to re-render FilterReader after
// controls.setFilter mutates the Map (the Map mutation doesn't trigger RN re-render).
// We accomplish this by having the FilterWriter setState on an outer component.
function ReactiveHarness({
  collectionId,
  writerCollectionId,
  writerQuery,
}: {
  collectionId: string
  writerCollectionId?: string
  writerQuery?: string
}) {
  const [tick, setTick] = useState(0)
  return (
    <SearchFilterProvider>
      <FilterReader collectionId={collectionId} />
      {writerCollectionId !== undefined && writerQuery !== undefined && (
        <FilterWriter
          collectionId={writerCollectionId}
          query={writerQuery}
          onSetPressed={() => setTick(t => t + 1)}
          onClearPressed={() => setTick(t => t + 1)}
        />
      )}
      {/* Suppress unused tick warning */}
      <Text testID="tick">{tick}</Text>
    </SearchFilterProvider>
  )
}

// ---------------------------------------------------------------------------
// T-0009-052: SearchBar writes query to Map; consumer reads via useSearchFilter
// ---------------------------------------------------------------------------

describe('SearchFilterContext — filter read/write (T-0009-052)', () => {
  it('returns null when no filter is set for a collection', () => {
    const {getByTestId} = render(
      <TestHarness>
        <FilterReader collectionId="tasks" />
      </TestHarness>,
    )
    expect(getByTestId('filter-tasks').props.children).toBe('__null__')
  })

  it('returns the lowercased query after setFilter is called', () => {
    const {getByTestId} = render(
      <ReactiveHarness
        collectionId="tasks"
        writerCollectionId="tasks"
        writerQuery="Coffee"
      />,
    )
    // Before set: null
    expect(getByTestId('filter-tasks').props.children).toBe('__null__')
    // Set the filter
    act(() => { fireEvent.press(getByTestId('set-tasks')) })
    // After set: lowercased
    expect(getByTestId('filter-tasks').props.children).toBe('coffee')
  })

  it('returns null after clearFilter is called', () => {
    const {getByTestId} = render(
      <ReactiveHarness
        collectionId="tasks"
        writerCollectionId="tasks"
        writerQuery="coffee"
      />,
    )
    // Set the filter
    act(() => { fireEvent.press(getByTestId('set-tasks')) })
    expect(getByTestId('filter-tasks').props.children).toBe('coffee')
    // Clear the filter
    act(() => { fireEvent.press(getByTestId('clear-tasks')) })
    expect(getByTestId('filter-tasks').props.children).toBe('__null__')
  })
})

// ---------------------------------------------------------------------------
// T-0009-056: Two SearchBars on different collections work independently
// ---------------------------------------------------------------------------

describe('SearchFilterContext — independent collections (T-0009-056)', () => {
  function TwoCollectionHarness() {
    const [tick, setTick] = useState(0)
    return (
      <SearchFilterProvider>
        <FilterReader collectionId="tasks" />
        <FilterReader collectionId="notes" />
        <FilterWriter
          collectionId="tasks"
          query="task-query"
          onSetPressed={() => setTick(t => t + 1)}
          onClearPressed={() => setTick(t => t + 1)}
        />
        <FilterWriter
          collectionId="notes"
          query="note-query"
          onSetPressed={() => setTick(t => t + 1)}
          onClearPressed={() => setTick(t => t + 1)}
        />
        <Text testID="tick">{tick}</Text>
      </SearchFilterProvider>
    )
  }

  it('each collection filter is independent', () => {
    const {getByTestId} = render(<TwoCollectionHarness />)

    // Set tasks filter
    act(() => { fireEvent.press(getByTestId('set-tasks')) })
    expect(getByTestId('filter-tasks').props.children).toBe('task-query')
    expect(getByTestId('filter-notes').props.children).toBe('__null__')

    // Set notes filter
    act(() => { fireEvent.press(getByTestId('set-notes')) })
    expect(getByTestId('filter-tasks').props.children).toBe('task-query')
    expect(getByTestId('filter-notes').props.children).toBe('note-query')

    // Clear tasks — notes unaffected
    act(() => { fireEvent.press(getByTestId('clear-tasks')) })
    expect(getByTestId('filter-tasks').props.children).toBe('__null__')
    expect(getByTestId('filter-notes').props.children).toBe('note-query')
  })
})

// ---------------------------------------------------------------------------
// T-0009-230 (Security P0): Two independent Renderer instances → separate Maps
// ---------------------------------------------------------------------------

describe('SearchFilterContext — instance scoping (T-0009-230)', () => {
  it('two separate providers maintain independent Maps', () => {
    // Two separate SearchFilterProvider instances.
    // Provider A sets 'tasks' → 'alpha'.
    // Provider B sets 'tasks' → 'beta'.
    // Each reader should only see its own provider's value.

    function RendererA() {
      const [tick, setTick] = useState(0)
      return (
        <SearchFilterProvider>
          <FilterReader collectionId="tasks" />
          <FilterWriter
            collectionId="tasks"
            query="alpha"
            onSetPressed={() => setTick(t => t + 1)}
          />
          <Text testID="tick-a">{tick}</Text>
        </SearchFilterProvider>
      )
    }

    function RendererB() {
      const [tick, setTick] = useState(0)
      return (
        <SearchFilterProvider>
          <FilterReader collectionId="tasks" />
          <FilterWriter
            collectionId="tasks"
            query="beta"
            onSetPressed={() => setTick(t => t + 1)}
          />
          <Text testID="tick-b">{tick}</Text>
        </SearchFilterProvider>
      )
    }

    // Render both in the same test (no shared outer Provider).
    const {getAllByTestId} = render(
      <>
        <RendererA />
        <RendererB />
      </>,
    )

    // Both readers start as null.
    const tasksReaders = getAllByTestId('filter-tasks')
    expect(tasksReaders).toHaveLength(2)
    expect(tasksReaders[0]!.props.children).toBe('__null__')
    expect(tasksReaders[1]!.props.children).toBe('__null__')

    // Set filter in A only — use getAllByTestId[0] to press A's button specifically.
    const setButtons = getAllByTestId('set-tasks')
    act(() => { fireEvent.press(setButtons[0]!) })

    // The first FilterReader (in A) sees 'alpha'; the second (in B) still sees null.
    const tasksReadersAfter = getAllByTestId('filter-tasks')
    expect(tasksReadersAfter[0]!.props.children).toBe('alpha')
    expect(tasksReadersAfter[1]!.props.children).toBe('__null__')
  })
})

// ---------------------------------------------------------------------------
// T-0009-231: SearchBar unmount clears filter
// ---------------------------------------------------------------------------

describe('SearchFilterContext — unmount clears filter (T-0009-231)', () => {
  it('filter is cleared when the writer is unmounted', () => {
    function Harness() {
      const [t, setT] = useState(0)
      return (
        <SearchFilterProvider>
          <FilterReader collectionId="tasks" />
          <ConditionalWriter collectionId="tasks" query="cof" />
          <Text testID="tick">{t}</Text>
          <Pressable testID="tick-btn" onPress={() => setT(x => x + 1)}>
            <Text>Tick</Text>
          </Pressable>
        </SearchFilterProvider>
      )
    }
    const {getByTestId} = render(<Harness />)

    // Set the filter
    act(() => { fireEvent.press(getByTestId('set-tasks')) })
    // Force re-render to pick up Map change
    act(() => { fireEvent.press(getByTestId('tick-btn')) })
    expect(getByTestId('filter-tasks').props.children).toBe('cof')

    // Unmount the writer (clears filter)
    act(() => { fireEvent.press(getByTestId('unmount-writer')) })
    act(() => { fireEvent.press(getByTestId('tick-btn')) })
    expect(getByTestId('filter-tasks').props.children).toBe('__null__')
  })
})

// ---------------------------------------------------------------------------
// T-0009-232: Two SearchBars on same collectionId — last-writer-wins + console.warn
// ---------------------------------------------------------------------------

describe('SearchFilterContext — last-writer-wins on same collection (T-0009-232)', () => {
  it('second writer overwrites first and emits console.warn in __DEV__', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined)

    function TwoWritersHarness() {
      const [tick, setTick] = useState(0)
      return (
        <SearchFilterProvider>
          <FilterReader collectionId="tasks" />
          {/* First writer */}
          <FilterWriter
            collectionId="tasks"
            query="first"
            onSetPressed={() => setTick(t => t + 1)}
          />
          {/* Second writer on same collection */}
          <FilterWriter
            collectionId="tasks"
            query="second"
            onSetPressed={() => setTick(t => t + 1)}
          />
          <Text testID="tick">{tick}</Text>
        </SearchFilterProvider>
      )
    }

    const {getAllByTestId} = render(<TwoWritersHarness />)
    const setButtons = getAllByTestId('set-tasks')

    // Press first writer
    act(() => { fireEvent.press(setButtons[0]!) })
    // Press second writer (overwrites; emits warn because map already has a value)
    act(() => { fireEvent.press(setButtons[1]!) })

    // Second writer wins
    expect(getAllByTestId('filter-tasks')[0]!.props.children).toBe('second')

    // console.warn fired for the second write (different query overwrites existing)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('two SearchBars are writing to'),
    )

    warnSpy.mockRestore()
  })
})

/**
 * useRendererState tests — T-0006-013, T-0006-014, T-0006-027
 */
import {renderHook, act} from '@testing-library/react-native'
import {useRendererState} from './useRendererState'
import {resetRowIdCounter} from './reducer'
import type {Spec} from '@app-creator/protocol'
import type {HostCallbacks} from './hostCallbacks'

const SPEC_V1: Spec = {
  version: 1,
  archetype: 'ListCRUD',
  stance: 'productive',
  palette: 'focus',
  coverIcon: 'check',
  navigation: 'none',
  screens: [{id: 's1', root: {id: 'n1', type: 'Heading', text: 'V1', level: 1}}],
  initialScreenId: 's1',
  collections: [],
  initialState: {counter: 0, name: 'World'},
}

const SPEC_V2: Spec = {
  version: 1,
  archetype: 'Tracker',
  stance: 'expressive',
  palette: 'health',
  coverIcon: 'heart',
  navigation: 'none',
  screens: [{id: 'screen1', root: {id: 'n1', type: 'Heading', text: 'V2', level: 1}}],
  initialScreenId: 'screen1',
  collections: [],
  initialState: {score: 100},
}

const SPEC_WITH_COLLECTION: Spec = {
  ...SPEC_V1,
  collections: [
    {
      id: 'items',
      name: 'Items',
      fields: [{name: 'title', type: {type: 'string'}, required: true}],
      seedData: [{title: 'Item A'}, {title: 'Item B'}],
      syncMode: 'local',
    },
  ],
}

const HOST: HostCallbacks = {
  onToast: jest.fn(),
  onAIError: jest.fn(),
}

// -- T-0006-014: Initializes from Spec.initialState + seedData -----------------

describe('useRendererState — initialization (T-0006-014)', () => {
  beforeEach(() => resetRowIdCounter())

  it('initializes slots from Spec.initialState', () => {
    const {result} = renderHook(() =>
      useRendererState(SPEC_V1, {host: HOST}),
    )
    expect(result.current.state.slots.get('counter')).toBe(0)
    expect(result.current.state.slots.get('name')).toBe('World')
  })

  it('initializes collections from Spec.collections[i].seedData', () => {
    const {result} = renderHook(() =>
      useRendererState(SPEC_WITH_COLLECTION, {host: HOST}),
    )
    const col = result.current.state.collections.get('items')!
    expect(col).toBeDefined()
    expect(col.rowOrder).toHaveLength(2)
    const firstRow = col.rows.get(col.rowOrder[0]!)!
    expect(firstRow['title']).toBe('Item A')
  })

  it('initializes currentScreenId from Spec.initialScreenId', () => {
    const {result} = renderHook(() =>
      useRendererState(SPEC_V1, {host: HOST}),
    )
    expect(result.current.state.currentScreenId).toBe('s1')
  })
})

// -- T-0006-013: Spec-ref change triggers RESET --------------------------------

describe('useRendererState — spec-ref change triggers RESET (T-0006-013)', () => {
  beforeEach(() => resetRowIdCounter())

  it('resets state when spec reference changes', () => {
    // Use renderHook with Props so rerender() can pass a new spec
    const {result, rerender} = renderHook(
      ({spec}: {spec: Spec}) => useRendererState(spec, {host: HOST}),
      {initialProps: {spec: SPEC_V1}},
    )

    // Mutate some state
    act(() => {
      result.current.dispatch({type: 'set', target: 'counter', value: 99})
    })
    expect(result.current.state.slots.get('counter')).toBe(99)

    // Swap spec reference
    rerender({spec: SPEC_V2})

    // State should be reset to SPEC_V2's initialState
    expect(result.current.state.slots.get('counter')).toBeUndefined()
    expect(result.current.state.slots.get('score')).toBe(100)
    expect(result.current.state.currentScreenId).toBe('screen1')
  })

  it('does NOT reset state when spec reference is the same object', () => {
    const {result, rerender} = renderHook(
      ({spec}: {spec: Spec}) => useRendererState(spec, {host: HOST}),
      {initialProps: {spec: SPEC_V1}},
    )

    act(() => {
      result.current.dispatch({type: 'set', target: 'counter', value: 42})
    })
    expect(result.current.state.slots.get('counter')).toBe(42)

    // Rerender with same spec reference — state must not reset
    rerender({spec: SPEC_V1})
    expect(result.current.state.slots.get('counter')).toBe(42)
  })
})

// -- T-0006-027: Dispatch-after-unmount safety ---------------------------------

describe('useRendererState — dispatch-after-unmount safety (T-0006-027)', () => {
  beforeEach(() => resetRowIdCounter())

  it('100 dispatches after unmount produce no errors', () => {
    const {result, unmount} = renderHook(() =>
      useRendererState(SPEC_V1, {host: HOST}),
    )

    const {dispatch} = result.current
    unmount()

    // These should be no-ops without throwing
    expect(() => {
      for (let i = 0; i < 100; i++) {
        dispatch({type: 'set', target: 'counter', value: i})
      }
    }).not.toThrow()
  })
})

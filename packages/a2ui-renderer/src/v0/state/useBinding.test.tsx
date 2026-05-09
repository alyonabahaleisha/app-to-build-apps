/**
 * useBinding tests — T-0006-015, T-0006-016, T-0006-017, T-0006-018a, T-0006-018b
 */
import React from 'react'
import {renderHook} from '@testing-library/react-native'
import {useBinding, setUnknownNodeTypeCallback} from './useBinding'
import type {Binding} from './useBinding'
import {RendererStateContext} from './useRendererState'
import {ListItemContextProvider} from './ListItemContext'
import {buildInitialRendererState, resetRowIdCounter} from './reducer'
import type {RendererState} from './types'
import type {DispatchFn} from './middleware'
import type {Spec} from '@app-creator/protocol'

const SPEC: Spec = {
  version: 1,
  archetype: 'ListCRUD',
  stance: 'productive',
  palette: 'focus',
  coverIcon: 'check',
  navigation: 'none',
  screens: [{id: 's1', root: {id: 'n1', type: 'Heading', text: 'T', level: 1}}],
  initialScreenId: 's1',
  collections: [],
  initialState: {greeting: 'hello', count: 42},
}

function makeWrapper(state: RendererState, dispatch: DispatchFn = jest.fn()) {
  return function Wrapper({children}: {children: React.ReactNode}) {
    return (
      <RendererStateContext.Provider value={{state, dispatch}}>
        {children}
      </RendererStateContext.Provider>
    )
  }
}

function makeWrapperWithListItem(
  state: RendererState,
  rowData: Record<string, unknown>,
  dispatch: DispatchFn = jest.fn(),
) {
  return function Wrapper({children}: {children: React.ReactNode}) {
    return (
      <RendererStateContext.Provider value={{state, dispatch}}>
        <ListItemContextProvider
          value={{row: rowData as Record<string, import('./types').BindingValue>, rowId: 'row1', index: 0}}
        >
          {children}
        </ListItemContextProvider>
      </RendererStateContext.Provider>
    )
  }
}

beforeEach(() => {
  resetRowIdCounter()
  setUnknownNodeTypeCallback(undefined)
})

// -- T-0006-015: literal binding -----------------------------------------------

describe('useBinding — literal (T-0006-015)', () => {
  it('returns binding.value directly', () => {
    const state = buildInitialRendererState(SPEC)
    const binding: Binding<string> = {kind: 'literal', value: 'hi'}
    const {result} = renderHook(() => useBinding(binding), {
      wrapper: makeWrapper(state),
    })
    expect(result.current).toBe('hi')
  })
})

// -- T-0006-016: state binding -------------------------------------------------

describe('useBinding — state (T-0006-016)', () => {
  it('returns current value of state.slots.get(slot)', () => {
    const state = buildInitialRendererState(SPEC)
    const binding: Binding<string> = {kind: 'state', slot: 'greeting'}
    const {result} = renderHook(() => useBinding(binding), {
      wrapper: makeWrapper(state),
    })
    expect(result.current).toBe('hello')
  })

  it('returns undefined for a slot not in initialState', () => {
    const state = buildInitialRendererState(SPEC)
    const binding: Binding<string> = {kind: 'state', slot: 'nonExistent'}
    const {result} = renderHook(() => useBinding(binding), {
      wrapper: makeWrapper(state),
    })
    expect(result.current).toBeUndefined()
  })
})

// -- T-0006-017: collectionField binding inside ListItemContext ----------------

describe('useBinding — collectionField inside ListItemContext (T-0006-017)', () => {
  it('returns row[field] from ListItemContext', () => {
    const state = buildInitialRendererState(SPEC)
    const rowData = {name: 'José García', reps: 10}
    const binding: Binding<string> = {
      kind: 'collectionField',
      collectionId: 'workouts',
      field: 'name',
    }
    const {result} = renderHook(() => useBinding(binding), {
      wrapper: makeWrapperWithListItem(state, rowData),
    })
    expect(result.current).toBe('José García')
  })

  it('handles unicode field values (李明)', () => {
    const state = buildInitialRendererState(SPEC)
    const rowData = {name: '李明', score: 95}
    const binding: Binding<string> = {
      kind: 'collectionField',
      collectionId: 'scores',
      field: 'name',
    }
    const {result} = renderHook(() => useBinding(binding), {
      wrapper: makeWrapperWithListItem(state, rowData),
    })
    expect(result.current).toBe('李明')
  })

  it('handles name with apostrophe (O\'Brien)', () => {
    const state = buildInitialRendererState(SPEC)
    const rowData = {name: "O'Brien"}
    const binding: Binding<string> = {
      kind: 'collectionField',
      collectionId: 'users',
      field: 'name',
    }
    const {result} = renderHook(() => useBinding(binding), {
      wrapper: makeWrapperWithListItem(state, rowData),
    })
    expect(result.current).toBe("O'Brien")
  })
})

// -- T-0006-018a: collectionField outside ListItemContext throws in __DEV__ ----

describe('useBinding — collectionField outside ListItemContext in __DEV__ (T-0006-018a)', () => {
  const originalDev = (global as Record<string, unknown>).__DEV__

  beforeEach(() => {
    ;(global as Record<string, unknown>).__DEV__ = true
  })

  afterEach(() => {
    ;(global as Record<string, unknown>).__DEV__ = originalDev
  })

  it('THROWS when collectionField binding resolved outside ListItemContext in __DEV__', () => {
    const state = buildInitialRendererState(SPEC)
    const binding: Binding<string> = {
      kind: 'collectionField',
      collectionId: 'workouts',
      field: 'name',
    }
    // No ListItemContextProvider in wrapper — should throw
    expect(() => {
      renderHook(() => useBinding(binding), {
        wrapper: makeWrapper(state),
      })
    }).toThrow(/collectionField binding.*outside a ListItemContext/)
  })
})

// -- T-0006-018b: collectionField outside ListItemContext returns undefined in prod ----

describe('useBinding — collectionField outside ListItemContext in production (T-0006-018b)', () => {
  const originalDev = (global as Record<string, unknown>).__DEV__

  beforeEach(() => {
    ;(global as Record<string, unknown>).__DEV__ = false
  })

  afterEach(() => {
    ;(global as Record<string, unknown>).__DEV__ = originalDev
  })

  it('returns undefined and emits onUnknownNodeType warning (does not crash)', () => {
    const onUnknownNodeType = jest.fn()
    setUnknownNodeTypeCallback(onUnknownNodeType)

    const state = buildInitialRendererState(SPEC)
    const binding: Binding<string> = {
      kind: 'collectionField',
      collectionId: 'workouts',
      field: 'name',
    }
    const {result} = renderHook(() => useBinding(binding), {
      wrapper: makeWrapper(state),
    })
    expect(result.current).toBeUndefined()
    expect(onUnknownNodeType).toHaveBeenCalledWith(
      expect.stringContaining('collectionField'),
    )
  })
})

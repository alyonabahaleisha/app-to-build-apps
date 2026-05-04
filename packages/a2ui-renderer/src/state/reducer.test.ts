/**
 * Tests for the pure A2UI state reducer.
 *
 * Tests covered:
 *   T-0003-003 through T-0003-016 (reducer-level behavior)
 *   T-0003-022 (prototype-pollution defense)
 *
 * Note: T-0003-001/002 (seeding from spec.initialState, initialViewId) are
 * tested in useA2UIState.test.tsx because they test hook-level initialization.
 * T-0003-009/010 (referential equality) are tested here at reducer level.
 */
import type {A2UISpec} from '@app-creator/a2ui-schema'

import {buildInitialReducerState, reducer} from './reducer'
import type {InternalAction, ReducerState} from './reducer'

// -- Helpers ------------------------------------------------------------------

const SIMPLE_SPEC: A2UISpec = {
  version: 1,
  views: [{id: 'main', root: {type: 'Heading', text: 'Test'}}],
  initialViewId: 'main',
}

const SPEC_WITH_VIEWS: A2UISpec = {
  version: 1,
  views: [
    {id: 'main', root: {type: 'Heading', text: 'Main'}},
    {id: 'settings', root: {type: 'Heading', text: 'Settings'}},
  ],
  initialViewId: 'main',
}

function makeState(overrides?: Partial<ReducerState>): ReducerState {
  return {
    spec: SIMPLE_SPEC,
    values: new Map(),
    currentViewId: 'main',
    ...overrides,
  }
}

function makeStateWith(entries: Record<string, import('@app-creator/a2ui-schema').A2UIValue>): ReducerState {
  return {
    spec: SIMPLE_SPEC,
    values: new Map(Object.entries(entries)),
    currentViewId: 'main',
  }
}

// -- Tests --------------------------------------------------------------------

describe('reducer', () => {
  // T-0003-003
  it('SET produces next state with state[id] === value', () => {
    const s = makeState()
    const a: InternalAction = {type: 'SET', id: 'x', value: 7}
    const next = reducer(s, a)
    expect(next.values.get('x')).toBe(7)
  })

  // T-0003-004
  it('INCREMENT by 2 increments by 2', () => {
    const s = makeStateWith({c: 5})
    const next = reducer(s, {type: 'INCREMENT', id: 'c', by: 2})
    expect(next.values.get('c')).toBe(7)
  })

  // T-0003-005
  it('INCREMENT by 1 (default by=1 is handled at hook level, reducer receives by)', () => {
    const s = makeStateWith({c: 3})
    const next = reducer(s, {type: 'INCREMENT', id: 'c', by: 1})
    expect(next.values.get('c')).toBe(4)
  })

  // T-0003-006
  it('DECREMENT by 3 decrements by 3', () => {
    const s = makeStateWith({c: 10})
    const next = reducer(s, {type: 'DECREMENT', id: 'c', by: 3})
    expect(next.values.get('c')).toBe(7)
  })

  // T-0003-008 (navigate known view)
  it('NAVIGATE to known viewId updates currentViewId', () => {
    const s = makeState({spec: SPEC_WITH_VIEWS})
    const next = reducer(s, {
      type: 'NAVIGATE',
      viewId: 'settings',
      knownViewIds: new Set(['main', 'settings']),
    })
    expect(next.currentViewId).toBe('settings')
  })

  // T-0003-009 — referential equality at max boundary
  it('INCREMENT at max returns referentially-equal state (no re-render)', () => {
    const s = makeStateWith({c: 10})
    const next = reducer(s, {type: 'INCREMENT', id: 'c', by: 1, max: 10})
    expect(Object.is(s, next)).toBe(true)
  })

  // T-0003-010 — referential equality at min boundary
  it('DECREMENT at min returns referentially-equal state (no re-render)', () => {
    const s = makeStateWith({c: 0})
    const next = reducer(s, {type: 'DECREMENT', id: 'c', by: 1, min: 0})
    expect(Object.is(s, next)).toBe(true)
  })

  // T-0003-011 — increment past max clamps to max
  it('INCREMENT past max clamps to max (state.c=8, by:5, max:10 → 10)', () => {
    const s = makeStateWith({c: 8})
    const next = reducer(s, {type: 'INCREMENT', id: 'c', by: 5, max: 10})
    expect(next.values.get('c')).toBe(10)
  })

  // T-0003-011b — decrement past min clamps to min
  it('DECREMENT past min clamps to min (state.c=2, by:5, min:0 → 0)', () => {
    const s = makeStateWith({c: 2})
    const next = reducer(s, {type: 'DECREMENT', id: 'c', by: 5, min: 0})
    expect(next.values.get('c')).toBe(0)
  })

  // T-0003-013 (navigate unknown viewId returns state unchanged)
  it('NAVIGATE to unknown viewId returns state unchanged', () => {
    const s = makeState()
    const next = reducer(s, {
      type: 'NAVIGATE',
      viewId: 'nonexistent',
      knownViewIds: new Set(['main']),
    })
    expect(Object.is(s, next)).toBe(true)
  })

  // T-0003-014 — reducer does not mutate input state
  it('reducer does not mutate input state object', () => {
    const values = new Map<string, import('@app-creator/a2ui-schema').A2UIValue>([
      ['x', 1],
    ])
    const frozen = Object.freeze({
      spec: SIMPLE_SPEC,
      values,
      currentViewId: 'main',
    }) as ReducerState
    // Should not throw — reducer must not modify frozen input
    expect(() => reducer(frozen, {type: 'SET', id: 'x', value: 99})).not.toThrow()
    // Original values are unchanged
    expect(values.get('x')).toBe(1)
  })

  // T-0003-015 — unknown action type returns state unchanged
  it('unknown internal action type returns state unchanged (defensive)', () => {
    const s = makeState()
    // Force an unknown action through as cast
    const next = reducer(s, {type: 'UNKNOWN'} as unknown as InternalAction)
    expect(Object.is(s, next)).toBe(true)
  })

  // T-0003-016 — concurrency: two dispatches produce state reflecting both
  // (This is tested at reducer level: sequential applications)
  it('two sequential SET actions reflect both updates (no lost-update)', () => {
    const s = makeState()
    const after1 = reducer(s, {type: 'SET', id: 'a', value: 1})
    const after2 = reducer(after1, {type: 'SET', id: 'b', value: 2})
    expect(after2.values.get('a')).toBe(1)
    expect(after2.values.get('b')).toBe(2)
  })

  // T-0003-022 — prototype-pollution defense
  it('SET with targetId="__proto__" does not pollute Object prototype', () => {
    const s = makeState()
    const next = reducer(s, {type: 'SET', id: '__proto__', value: 'pwn'})
    // Object prototype must be unchanged
    expect(Object.prototype).not.toHaveProperty('pwn')
    // The Map itself correctly stores the value under the literal key
    expect(next.values.get('__proto__')).toBe('pwn')
  })

  // RESET action test (part of spec-change reset, indirectly covers T-0003-013b)
  it('RESET returns fresh state seeded from new spec', () => {
    const s = makeStateWith({old_key: 42})
    const newSpec: A2UISpec = {
      version: 1,
      views: [{id: 'new_main', root: {type: 'Text', text: 'Hi'}}],
      initialViewId: 'new_main',
      initialState: {new_key: 99},
    }
    const next = reducer(s, {type: 'RESET', spec: newSpec})
    expect(next.spec).toBe(newSpec)
    expect(next.currentViewId).toBe('new_main')
    expect(next.values.get('new_key')).toBe(99)
    expect(next.values.has('old_key')).toBe(false)
  })

  // buildInitialReducerState helper
  it('buildInitialReducerState seeds from spec.initialState', () => {
    const spec: A2UISpec = {
      version: 1,
      views: [{id: 'v1', root: {type: 'Heading', text: 'H'}}],
      initialViewId: 'v1',
      initialState: {counter: 5, flag: true},
    }
    const state = buildInitialReducerState(spec)
    expect(state.values.get('counter')).toBe(5)
    expect(state.values.get('flag')).toBe(true)
    expect(state.currentViewId).toBe('v1')
    expect(state.spec).toBe(spec)
  })

  it('buildInitialReducerState with no initialState seeds empty Map', () => {
    const state = buildInitialReducerState(SIMPLE_SPEC)
    expect(state.values.size).toBe(0)
  })

  // INCREMENT with no stored value starts from 0
  it('INCREMENT on key with no prior value starts from 0', () => {
    const s = makeState()
    const next = reducer(s, {type: 'INCREMENT', id: 'new_c', by: 3})
    expect(next.values.get('new_c')).toBe(3)
  })

  // DECREMENT with no stored value starts from 0
  it('DECREMENT on key with no prior value starts from 0', () => {
    const s = makeState()
    const next = reducer(s, {type: 'DECREMENT', id: 'new_c', by: 2})
    expect(next.values.get('new_c')).toBe(-2)
  })

  // Clamping: increment from near-max but not AT max should not clamp
  it('INCREMENT past max from below-max clamps correctly', () => {
    const s = makeStateWith({c: 9})
    const next = reducer(s, {type: 'INCREMENT', id: 'c', by: 5, max: 10})
    expect(next.values.get('c')).toBe(10)
    // And should NOT be referentially equal (state did change)
    expect(Object.is(s, next)).toBe(false)
  })

  // Unbounded increment (no max defined)
  it('INCREMENT with no max is unbounded', () => {
    const s = makeStateWith({c: 999})
    const next = reducer(s, {type: 'INCREMENT', id: 'c', by: 1})
    expect(next.values.get('c')).toBe(1000)
  })
})

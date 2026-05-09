/**
 * undoBuffer middleware tests
 *
 * T-0006-161d: removeItem → pendingUndo populated + undo toast shown
 * T-0006-161e: addItem within 5s → restores at original insertIndex
 * T-0006-161f: 5s expiry → clearPendingUndo dispatched (NF-02: fake timers)
 *
 * Note: T-0006-161d/e/f are listed under Step 9 in the ADR (Step 9 ACs test
 * the feedback contract for removeItem), but the undoBuffer middleware is
 * implemented here in Step 2. These tests run against the Step 2 implementation.
 */
import {makeUndoBufferMiddleware, UNDO_WINDOW_MS} from './undoBuffer'
import {buildInitialRendererState, reducer, resetRowIdCounter} from '../reducer'
import type {RendererAction} from '../types'
import type {Spec, Collection} from '@app-creator/protocol'

const COLLECTION_FIXTURE: Collection = {
  id: 'workouts',
  name: 'Workouts',
  fields: [{name: 'name', type: {type: 'string'}, required: true}],
  seedData: [{name: 'Push-ups'}, {name: 'Squats'}],
  syncMode: 'local',
}

const SPEC: Spec = {
  version: 1,
  archetype: 'ListCRUD',
  stance: 'productive',
  palette: 'focus',
  coverIcon: 'check',
  navigation: 'none',
  screens: [{id: 's1', root: {id: 'n1', type: 'Heading', text: 'H', level: 1}}],
  initialScreenId: 's1',
  collections: [COLLECTION_FIXTURE],
  initialState: {},
}

// Helper: build state + apply reducer-based dispatch
function makeTestHarness() {
  resetRowIdCounter()
  let state = buildInitialRendererState(SPEC)
  const dispatched: RendererAction[] = []

  const getState = () => state
  const getDispatch = () => (action: RendererAction) => {
    dispatched.push(action)
    state = reducer(state, action)
  }

  const onToast = jest.fn()
  const mw = makeUndoBufferMiddleware(getState, getDispatch, {onToast})

  // Wrapper: apply action through middleware, then through reducer
  function dispatch(action: RendererAction) {
    mw(action, (a) => {
      state = reducer(state, a)
    })
  }

  return {getState, dispatch, dispatched, onToast}
}

describe('undoBuffer middleware', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  // T-0006-161d: removeItem populates pendingUndo + shows undo toast
  it('T-0006-161d: removeItem populates pendingUndo and calls host.onToast', () => {
    const {getState, dispatch, onToast} = makeTestHarness()
    const col = getState().collections.get('workouts')!
    const rowId = col.rowOrder[0]!

    dispatch({type: 'removeItem', collection: 'workouts', itemId: rowId})

    const state = getState()
    expect(state.pendingUndo).not.toBeNull()
    expect(state.pendingUndo!.rowId).toBe(rowId)
    expect(state.pendingUndo!.collectionId).toBe('workouts')
    expect(state.pendingUndo!.rowData['name']).toBe('Push-ups')
    expect(state.pendingUndo!.insertIndex).toBe(0)

    // Undo toast should have been shown
    expect(onToast).toHaveBeenCalledWith(
      expect.stringContaining('Push-ups'),
      undefined,
    )
  })

  // T-0006-161e: addItem within 5s restores at original insertIndex
  it('T-0006-161e: addItem within 5s restores row at original insertIndex', () => {
    const {getState, dispatch} = makeTestHarness()
    const col = getState().collections.get('workouts')!
    const rowId = col.rowOrder[0]!  // Push-ups at index 0
    const rowData = col.rows.get(rowId)!

    dispatch({type: 'removeItem', collection: 'workouts', itemId: rowId})

    // Verify row is gone
    expect(getState().collections.get('workouts')!.rows.has(rowId)).toBe(false)
    expect(getState().pendingUndo).not.toBeNull()

    // Dispatch addItem with same collection (undo restore path in reducer)
    // The reducer detects pendingUndo + matching collection and restores at insertIndex
    dispatch({
      type: 'addItem',
      collection: 'workouts',
      item: rowData,
    })

    const afterUndo = getState()
    // pendingUndo should be cleared
    expect(afterUndo.pendingUndo).toBeNull()
    // Row should be back at original position (index 0)
    expect(afterUndo.collections.get('workouts')!.rowOrder[0]).toBe(rowId)
    expect(afterUndo.collections.get('workouts')!.rows.get(rowId)!['name']).toBe('Push-ups')
  })

  // T-0006-161f: 5s expiry dispatches clearPendingUndo (NF-02: fake timers)
  it('T-0006-161f: 5s expiry dispatches clearPendingUndo', () => {
    const {getState, dispatch, dispatched} = makeTestHarness()
    const col = getState().collections.get('workouts')!
    const rowId = col.rowOrder[0]!

    dispatch({type: 'removeItem', collection: 'workouts', itemId: rowId})

    expect(getState().pendingUndo).not.toBeNull()

    // Advance timers past the 5s window
    jest.advanceTimersByTime(UNDO_WINDOW_MS + 1)

    // clearPendingUndo should have been dispatched
    const clearAction = dispatched.find(a => a.type === 'clearPendingUndo')
    expect(clearAction).toBeDefined()
    expect(getState().pendingUndo).toBeNull()
  })

  it('second removeItem replaces first pending timer (no stale timer)', () => {
    const {getState, dispatch, dispatched} = makeTestHarness()
    const col = getState().collections.get('workouts')!
    const row0 = col.rowOrder[0]!
    const row1 = col.rowOrder[1]!

    // Remove first row
    dispatch({type: 'removeItem', collection: 'workouts', itemId: row0})
    // Remove second row (should replace timer)
    dispatch({type: 'removeItem', collection: 'workouts', itemId: row1})

    // Advance timers — only one clearPendingUndo should be dispatched
    jest.advanceTimersByTime(UNDO_WINDOW_MS + 1)

    const clearActions = dispatched.filter(a => a.type === 'clearPendingUndo')
    expect(clearActions).toHaveLength(1)
  })

  it('passes through non-removeItem, non-addItem actions unchanged', () => {
    // set is not handled by undoBuffer — should pass through
    const next = jest.fn()
    const {getState: gs2, onToast} = makeTestHarness()
    const mw = makeUndoBufferMiddleware(gs2, () => () => {}, {onToast})
    mw({type: 'set', target: 'x', value: 99}, next)
    expect(next).toHaveBeenCalledWith({type: 'set', target: 'x', value: 99})
  })
})

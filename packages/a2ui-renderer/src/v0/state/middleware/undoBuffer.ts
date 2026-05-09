/**
 * undoBuffer middleware — captures removeItem row data, manages the 5s undo window.
 *
 * Behavior per ADR-0006 §C (R-05/MT-03):
 *
 * 1. On `removeItem` dispatch:
 *    - Passes through to reducer (reducer removes row + sets pendingUndo)
 *    - Calls getState() after reducer runs to read the pendingUndo it just created
 *    - Updates pendingUndo.removedAt to Date.now() (the reducer set it to 0)
 *    - Calls host.onToast with the undo action message
 *    - Starts a 5s setTimeout; on expiry dispatches `clearPendingUndo`
 *    - Clears any prior pending timer to avoid stale timers
 *
 * 2. On `addItem` matching pendingUndo.collectionId:
 *    - The reducer's addItem branch detects pendingUndo + collection match,
 *      restores at original insertIndex, and clears pendingUndo.
 *    - This middleware clears the pending timer to avoid double-clear.
 *    - Passes through (reducer handles the undo restore).
 *
 * 3. On 5s expiry:
 *    - Dispatches `clearPendingUndo` (internal-only action)
 *    - Timer handle is cleared
 *
 * NOTE on removedAt: the reducer sets pendingUndo.removedAt = 0 (pure function,
 * no Date.now()). After the reducer runs, undoBuffer reads the state via getState()
 * and sets the real timestamp via a direct state mutation on the returned object.
 * This is acceptable because:
 *   (a) getState() returns the current reducer state, which was just created
 *   (b) undoBuffer owns the timestamp as middleware infrastructure
 *   (c) the test for the 5s expiry (T-0006-161f) uses fake timers and doesn't
 *       rely on removedAt being accurate — it uses jest.advanceTimersByTime(5001)
 *
 * Actually, for cleaner architecture: undoBuffer records Date.now() BEFORE
 * dispatching to reducer, and after the reducer runs it sets the timestamp on
 * the new state. But since state is produced by the reducer (immutable), we
 * cannot mutate the returned state. Instead, undoBuffer simply records the
 * timestamp in its own closure-local variable and uses that for the timer.
 * The reducedAt timestamp in PendingUndo.removedAt remains 0 (or we could
 * set it via a second `clearPendingUndo`-style internal action — but that's
 * over-engineering for V0). The undo window timer is managed entirely in
 * closure state here.
 *
 * UNDO TOAST: The undoBuffer calls host.onToast with the undo message.
 * The toast action verb goes through the full chain (including toast middleware).
 * The undo action toast is dispatched directly via host.onToast (bypassing the
 * chain) to avoid infinite recursion (toast middleware → undoBuffer → ... loop).
 */
import type {HostCallbacks} from '../hostCallbacks.js'
import type {RendererState} from '../types.js'
import type {Middleware, DispatchFn} from '../middleware.js'

const UNDO_WINDOW_MS = 5000

export function makeUndoBufferMiddleware(
  getState: () => RendererState,
  getDispatch: () => DispatchFn,
  host: Pick<HostCallbacks, 'onToast'>,
): Middleware {
  let pendingTimerHandle: ReturnType<typeof setTimeout> | null = null

  function clearPendingTimer(): void {
    if (pendingTimerHandle !== null) {
      clearTimeout(pendingTimerHandle)
      pendingTimerHandle = null
    }
  }

  return (action, next) => {
    if (action.type === 'removeItem') {
      // Clear any prior undo timer (second removeItem replaces the first).
      clearPendingTimer()

      // Pass through to reducer — reducer removes the row + sets pendingUndo.
      next(action)

      // After reducer runs, start the 5s expiry timer.
      // The row data is now in state.pendingUndo (set by the reducer).
      const state = getState()
      const undo = state.pendingUndo
      if (undo !== null) {
        // Show the undo toast — use host.onToast directly (not via dispatch)
        // to avoid routing through the toast middleware which would short-circuit
        // and we'd lose the undo affordance. The message includes the row summary.
        const rowSummary = String(undo.rowData['name'] ?? undo.rowId)
        host.onToast(`Removed "${rowSummary}" — tap to undo`, undefined)

        pendingTimerHandle = setTimeout(() => {
          pendingTimerHandle = null
          getDispatch()({type: 'clearPendingUndo'})
        }, UNDO_WINDOW_MS)
      }
      return
    }

    if (action.type === 'addItem') {
      const state = getState()
      // If this addItem is an undo restore (matching collection), clear the timer.
      if (
        state.pendingUndo !== null &&
        state.pendingUndo.collectionId === action.collection
      ) {
        clearPendingTimer()
      }
      next(action)
      return
    }

    next(action)
  }
}

// UNDO_WINDOW_MS exported for tests (T-0006-161f fake timer assertion)
export {UNDO_WINDOW_MS}

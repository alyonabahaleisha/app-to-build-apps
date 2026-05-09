/**
 * feedback middleware — per-verb feedback orchestration.
 *
 * Responsibilities (Step 9):
 *   1. `clearCollection` — intercepts BEFORE the reducer runs. Shows an
 *      Alert.alert confirmation dialog. Calls next(action) only if the user
 *      confirms; drops the action on cancel. Haptic fires unconditionally
 *      (the haptics middleware already fired upstream, but that is acceptable
 *      because the Medium haptic on clearCollection communicates the
 *      destructive intent of the tap, not the outcome).
 *
 *   2. All other verbs — passes through to next() unchanged. Haptic feedback
 *      is handled by the haptics middleware (earlier in the chain). Toast
 *      feedback for 'toast' actions is handled by makeToastMiddleware. The
 *      undo window for 'removeItem' is handled by makeUndoBufferMiddleware.
 *
 * Per-verb feedback summary (documented here for the T-0006-158 contract):
 *   set          → no feedback (silent slot write)
 *   update       → no haptic; LayoutAnimation handles the row update (List)
 *   reset        → Light haptic (haptics middleware, UX doc line 1554)
 *   addItem      → Light haptic (haptics middleware); row enter animation (List)
 *   removeItem   → Medium haptic (haptics middleware); undo toast (undoBuffer)
 *   updateItem   → Light haptic (haptics middleware, UX doc line 1554)
 *   clearCollection → Medium haptic (haptics middleware) + Alert confirm (here)
 *   navigate     → no haptic (native transition provides feedback)
 *   back         → no haptic (native pop provides feedback)
 *   capture      → Light haptic (haptics middleware)
 *   toast        → host.onToast (toast middleware, short-circuits chain)
 *   aiProcess    → no haptic; component renders own loading state
 *
 * Chain order (ADR-0006 §C):
 *   [haptics, toast, aiBridge, navigate, undoBuffer, feedback, reducer]
 *
 * NOTE: feedback is inserted AFTER undoBuffer so that undoBuffer can intercept
 * removeItem first (to capture row data BEFORE the reducer removes it). The
 * feedback middleware only needs clearCollection interception, which the reducer
 * does not modify via the undo buffer.
 */
import {Alert} from 'react-native'
import type {Middleware} from '../middleware.js'

const DEFAULT_CLEAR_CONFIRM_TEXT =
  'Are you sure you want to clear all items? This cannot be undone.'

// Known verb types — the 12 protocol verbs + 2 internal renderer actions.
// An action whose type falls outside this set is unexpected; we log a warning
// for forward-compat visibility (T-0006-160) and pass it through.
const KNOWN_VERBS = new Set([
  'set',
  'update',
  'reset',
  'addItem',
  'removeItem',
  'updateItem',
  'clearCollection',
  'navigate',
  'back',
  'capture',
  'toast',
  'aiProcess',
  'clearPendingUndo',
  '__RESET__',
])

export const feedback: Middleware = (action, next) => {
  if (action.type === 'clearCollection') {
    // Intercept clearCollection — show confirmation alert before dispatch.
    // The haptics middleware (earlier in the chain) already fired Medium haptic
    // to signal the destructive intent. We do NOT call next() until confirmed.
    const confirmText = action.confirmText ?? DEFAULT_CLEAR_CONFIRM_TEXT

    Alert.alert(
      'Clear all items',
      confirmText,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          // On cancel: do nothing — reducer never runs.
          onPress: () => undefined,
        },
        {
          text: 'Clear',
          style: 'destructive',
          // On confirm: pass the action downstream to the reducer.
          onPress: () => next(action),
        },
      ],
      {cancelable: true},
    )
    // Do NOT call next() here — the alert callbacks handle it asynchronously.
    return
  }

  // Known verbs pass through silently — their feedback is owned by upstream
  // middleware (haptics, toast, undoBuffer).
  if (!KNOWN_VERBS.has(action.type)) {
    // Unknown verb — log a warning for forward-compat visibility, then pass through.
    // This catches future spec verbs before they're wired in the renderer, making
    // the gap visible in development without breaking runtime behavior.
    console.warn(`[feedback] Unknown verb: ${action.type}`)
  }

  next(action)
}

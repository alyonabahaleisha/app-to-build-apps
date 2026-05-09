/**
 * haptics middleware — fires Expo Haptics per-verb feedback.
 *
 * Passes through to next (does NOT short-circuit) — haptics are a side-effect
 * layered on top of normal dispatch flow.
 *
 * Per-verb haptic mapping (canvas-v0-ux.md §Action Verb Feedback Contract):
 *   addItem      → Light
 *   removeItem   → Medium
 *   set          → (none — slot writes are silent)
 *   update       → (none)
 *   reset        → (none)
 *   updateItem   → (none)
 *   clearCollection → Medium (destructive)
 *   navigate     → (none — nav has a native transition animation instead)
 *   back         → (none)
 *   capture      → Light (acknowledges camera open)
 *   toast        → (none — visual feedback only)
 *   aiProcess    → (none — spinner provides feedback)
 *
 * Note: no 'share' case — F-04 removed share from the verb set.
 */
import * as Haptics from 'expo-haptics'
import type {Middleware} from '../middleware.js'

export const haptics: Middleware = (action, next) => {
  switch (action.type) {
    case 'addItem':
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      break
    case 'removeItem':
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      break
    case 'clearCollection':
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      break
    case 'capture':
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      break
    default:
      // No haptic for other verbs — intentional.
      break
  }
  next(action)
}

/**
 * navigation middleware — handles `navigate` and `back` action verbs.
 *
 * PASSES THROUGH to next (does NOT short-circuit).
 * The reducer also handles navigate/back to update currentScreenId and history.
 * This middleware calls the navigation primitive BEFORE the reducer runs,
 * so the animation starts as the state updates.
 *
 * Step 10 wires the actual @react-navigation/native-stack NavigationPrimitive
 * implementation. For StackNav the primitive calls navigationRef.navigate /
 * navigationRef.goBack. For TabsNav and ModalOverlayNav the primitive is a
 * custom object that updates local React state in the navigator component.
 *
 * Error signals (NF-01 Roz fix):
 *   - back on empty history: calls host.onNavigationError('back-on-empty-history')
 *   - navigate with no nav pattern: calls host.onNavigationError('navigate-on-none-nav')
 *   - navigate while sheet open: calls host.onNavigationError('navigate-while-sheet-open')
 * These use the dedicated hook, NOT host.onUnknownNodeType.
 */
import type {HostCallbacks} from '../hostCallbacks.js'
import type {RendererState} from '../types.js'
import type {Middleware} from '../middleware.js'

// NavigationPrimitive — the interface navigation.ts calls. Concrete implementation
// is provided at Step 10 when React Navigation native-stack is wired up.
export interface NavigationPrimitive {
  navigate(screenId: string): void
  pop(): void
}

export function makeNavigationMiddleware(
  getNav: () => NavigationPrimitive | null,
  host: Pick<HostCallbacks, 'onNavigationError'>,
  getState?: () => RendererState,
): Middleware {
  return (action, next) => {
    if (action.type === 'navigate') {
      const nav = getNav()
      if (nav === null) {
        // Navigation primitive not mounted (nav pattern is 'none').
        host.onNavigationError?.('navigate-on-none-nav')
      } else {
        nav.navigate(action.target)
      }
      // PASS-THROUGH: reducer also updates currentScreenId + history
      next(action)
      return
    }

    if (action.type === 'back') {
      const nav = getNav()
      if (nav === null) {
        host.onNavigationError?.('navigate-on-none-nav')
        next(action)
        return
      }
      // Check history length before the reducer pops it (T-0006-172a).
      const state = getState?.()
      if (state !== undefined && state.history.length === 0) {
        host.onNavigationError?.('back-on-empty-history')
        // Still pass through — reducer no-ops on empty history (idempotent).
        next(action)
        return
      }
      nav.pop()
      // PASS-THROUGH: reducer also pops history
      next(action)
      return
    }

    next(action)
  }
}

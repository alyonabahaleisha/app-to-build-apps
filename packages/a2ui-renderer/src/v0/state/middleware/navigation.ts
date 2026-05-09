/**
 * navigation middleware — handles `navigate` and `back` action verbs.
 *
 * PASSES THROUGH to next (does NOT short-circuit).
 * The reducer also handles navigate/back to update currentScreenId and history.
 * This middleware calls the navigation primitive BEFORE the reducer runs,
 * so the animation starts as the state updates.
 *
 * PLACEHOLDER: The navigation primitive injection is Step 10's job.
 * For Step 2, this middleware calls an injected NavigationPrimitive interface
 * and then passes through to the reducer. Step 10 replaces the placeholder
 * implementation with actual @react-navigation/native-stack calls.
 *
 * Error signals (NF-01 Roz fix):
 *   - back on empty history: calls host.onNavigationError('back-on-empty-history')
 *   - navigate with no nav pattern: calls host.onNavigationError('navigate-on-none-nav')
 * These use the dedicated hook, NOT host.onUnknownNodeType.
 */
import type {HostCallbacks} from '../hostCallbacks.js'
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
      } else {
        nav.pop()
      }
      // PASS-THROUGH: reducer also pops history
      next(action)
      return
    }

    next(action)
  }
}

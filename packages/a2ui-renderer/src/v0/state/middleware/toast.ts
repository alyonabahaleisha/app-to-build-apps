/**
 * toast middleware — handles the `toast` action verb.
 *
 * SHORT-CIRCUITS: does NOT call next(). Toast has no state effect in the reducer
 * (reducer's toast branch is a no-op), so there is no benefit to continuing the
 * chain. Stopping here prevents the action from reaching the reducer unnecessarily.
 *
 * ADR-0007 telemetry forward-compat (T-0006-028a):
 *   Because this middleware short-circuits, any middleware inserted AFTER toast
 *   will silently miss all toast events. Telemetry must be inserted BEFORE toast.
 *   Chain: [haptics, TELEMETRY, toast, aiBridge, navigate, undoBuffer, reducer]
 *
 * The host callback `onToast` is injected at construction time — the middleware
 * factory captures it in a closure rather than pulling from React context, so
 * it can be tested without mounting a component tree.
 */
import type {HostCallbacks} from '../hostCallbacks.js'
import type {Middleware} from '../middleware.js'

export function makeToastMiddleware(host: Pick<HostCallbacks, 'onToast'>): Middleware {
  return (action, _next) => {
    if (action.type === 'toast') {
      host.onToast(action.message, action.tone)
      // SHORT-CIRCUIT: do not call _next
      return
    }
    _next(action)
  }
}

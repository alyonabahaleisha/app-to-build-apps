/**
 * aiBridge middleware — handles the `aiProcess` action verb.
 *
 * SHORT-CIRCUITS: does NOT call next(). The AI dispatch is async — on
 * completion it synthesizes a `set` action and dispatches it via the
 * provided dispatch function.
 *
 * PLACEHOLDER: This is the Step 2 placeholder implementation. The full
 * `react-native-ai-apple` integration is wired in Step 8 (aiDispatcher.ts).
 * For now, the middleware accepts an `AIDispatcher` interface and calls it —
 * real implementation will swap the concrete dispatcher in.
 *
 * The host error callback (`onAIError`) is injected via HostCallbacks.
 */
import type {HostCallbacks} from '../hostCallbacks.js'
import type {Middleware, DispatchFn} from '../middleware.js'

// AIDispatcher — the interface the aiBridge middleware calls. The concrete
// implementation in Step 8 wraps react-native-ai-apple. Tests use a mock.
export interface AIDispatcher {
  summarize(input: {
    prompt: string
    items: ReadonlyArray<Record<string, unknown>>
  }): Promise<string>
}

export function makeAIBridgeMiddleware(
  getAIDispatcher: () => AIDispatcher | null,
  getDispatch: () => DispatchFn,
  host: Pick<HostCallbacks, 'onAIError'>,
): Middleware {
  return (action, _next) => {
    if (action.type === 'aiProcess') {
      const dispatcher = getAIDispatcher()
      if (dispatcher === null) {
        // AI not available (not iOS 26+ Pro, or provider not mounted).
        // SHORT-CIRCUIT without error — components guard upstream via useAICapabilities.
        return
      }

      // Collect current items — dispatcher will serialize them.
      // The AI bridge doesn't have access to state here; the collection data is
      // passed through the action at dispatch time. For Step 2 placeholder, we
      // pass an empty array; Step 8 wires the actual collection rows.
      dispatcher
        .summarize({prompt: action.prompt, items: []})
        .then(result => {
          getDispatch()({type: 'set', target: action.target, value: result})
        })
        .catch((err: unknown) => {
          host.onAIError(err instanceof Error ? err : new Error(String(err)))
        })

      // SHORT-CIRCUIT: do not call _next
      return
    }
    _next(action)
  }
}

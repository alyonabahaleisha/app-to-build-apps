/**
 * aiBridge middleware — handles the `aiProcess` action verb.
 *
 * SHORT-CIRCUITS: does NOT call next(). The AI dispatch is async — on
 * completion it synthesizes a `set` action and dispatches it via the
 * provided dispatch function.
 *
 * The host error callback (`onAIError`) is injected via HostCallbacks.
 * On rejection or timeout the middleware calls host.onAIError and the
 * summary slot is never written — ListSummary continues showing the
 * loading shimmer; the host owns the error UX (toast, hide, etc.).
 */
import type {HostCallbacks} from '../hostCallbacks.js'
import type {RendererState} from '../types.js'
import type {Middleware, DispatchFn} from '../middleware.js'

// AIDispatcher — the interface the aiBridge middleware calls. The concrete
// implementation in aiDispatcher.ts wraps react-native-ai-apple. Tests use a mock.
export interface AIDispatcher {
  summarize(input: {
    prompt: string
    items: ReadonlyArray<Record<string, unknown>>
  }): Promise<string>
}

export function makeAIBridgeMiddleware(opts: {
  getDispatcher: () => AIDispatcher | null
  getDispatch: () => DispatchFn
  host: Pick<HostCallbacks, 'onAIError'>
  getState: () => RendererState
}): Middleware {
  return (action, _next) => {
    if (action.type === 'aiProcess') {
      const dispatcher = opts.getDispatcher()
      if (dispatcher === null) {
        // AI not available (not iOS 26+ Pro, or provider not mounted).
        // SHORT-CIRCUIT without error — components guard upstream via useAICapabilities.
        return
      }

      // Resolve the collection rows from current state so the AI model has
      // real item context. CollectionState.rows is Map<RowId, Row> where
      // Row = Record<string, BindingValue> — the data object directly.
      const state = opts.getState()
      const collection = state.collections.get(action.collection)
      if (!collection) {
        // Collection not found in state — treat as unavailable.
        opts.host.onAIError(new Error(`AI bridge: collection "${action.collection}" not found`))
        return
      }
      const items = Array.from(collection.rows.values())

      dispatcher
        .summarize({prompt: action.prompt, items})
        .then(result => {
          opts.getDispatch()({type: 'set', target: action.target, value: result})
        })
        .catch((err: unknown) => {
          opts.host.onAIError(err instanceof Error ? err : new Error(String(err)))
        })

      // SHORT-CIRCUIT: do not call _next
      return
    }
    _next(action)
  }
}

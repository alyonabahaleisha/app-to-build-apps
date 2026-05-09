/**
 * Middleware composition for the V0 renderer dispatcher.
 *
 * Chain order (per ADR-0006 §C):
 *   [haptics, toast, aiBridge, navigate, undoBuffer, reducer]
 *
 * Each middleware has shape: (action, next) => void
 *   - next() passes the action to the next middleware in the chain
 *   - NOT calling next() short-circuits downstream (used by toast, aiBridge)
 *
 * Forward-compat contract (ADR-0007 telemetry — T-0006-028a):
 *   Telemetry middleware MUST be inserted BEFORE `toast`, not after.
 *   Toast middleware short-circuits on 'toast' actions (never calls next()),
 *   so any middleware inserted AFTER toast will silently miss all toast events.
 *   The only correct insertion point for telemetry is between haptics and toast:
 *   [haptics, TELEMETRY, toast, aiBridge, navigate, undoBuffer, reducer]
 *
 * The reducer is always last in the chain and is passed as the terminal
 * middleware by composeMiddleware. It calls the internalDispatch from useReducer
 * rather than calling next() (there is no next after the reducer).
 */
import type {RendererAction} from './types.js'

// DispatchFn — the type of the dispatch function the chain produces.
export type DispatchFn = (action: RendererAction) => void

// Middleware — a function that receives an action and the next handler.
// Calling next(action) passes the action downstream; not calling it short-circuits.
export type Middleware = (action: RendererAction, next: DispatchFn) => void

// ComposedChain — the result of composeMiddleware: a single dispatch surface.
export type ComposedChain = {
  dispatch: DispatchFn
}

/**
 * composeMiddleware — reduces an array of middleware + terminal into a single
 * dispatch function.
 *
 * The last element of the array is the terminal (reducer wrapper) — it is
 * called after all middleware have had a chance to run or short-circuit.
 * Each middleware wraps the next one using closure-captured `nextFn`.
 *
 * Composition is right-to-left (last in array = first to execute as terminal),
 * so the array order is "outermost first":
 *   [haptics, toast, aiBridge, navigate, undoBuffer, reducerTerminal]
 *   → haptics wraps toast wraps aiBridge wraps ... wraps reducerTerminal
 */
export function composeMiddleware(chain: Middleware[]): ComposedChain {
  if (chain.length === 0) {
    return {dispatch: () => undefined}
  }

  // Build from right to left. The rightmost entry is the terminal.
  // Its "next" is a no-op (the terminal should never call next, but we
  // provide a safe fallback rather than throwing).
  let composed: DispatchFn = (action: RendererAction) => {
    // Terminal no-op safety fallback — the actual reducer middleware should
    // handle the dispatch and not call next.
    void action
  }

  // Walk the chain in reverse, wrapping each with the one to its right.
  for (let i = chain.length - 1; i >= 0; i--) {
    const middleware = chain[i]!
    const nextFn = composed
    composed = (action: RendererAction) => {
      middleware(action, nextFn)
    }
  }

  return {dispatch: composed}
}

/**
 * makeReducerMiddleware — wraps the reducer + useReducer's internalDispatch
 * into a Middleware-shaped terminal. This is the last entry in the chain.
 *
 * It calls internalDispatch(action) and does not call next (it's the terminal).
 */
export function makeReducerMiddleware(internalDispatch: (action: RendererAction) => void): Middleware {
  return (action: RendererAction, _next: DispatchFn) => {
    internalDispatch(action)
    // Intentionally does not call _next — this is the terminal.
  }
}

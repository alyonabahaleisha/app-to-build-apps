/**
 * useRendererState — top-level state hook for the V0 renderer.
 *
 * Initializes from Spec.initialState + Spec.collections[i].seedData.
 *
 * Spec-ref change triggers RESET using the React "derived state from props"
 * pattern (same as M1 legacy/state/useA2UIState.ts:112-113). If the spec
 * reference changes, a __RESET__ is dispatched synchronously during render —
 * React re-renders with fresh state before painting.
 *
 * Dispatch-after-unmount safety (T-0006-027):
 *   A mounted ref tracks lifecycle. After unmount, dispatch is a no-op.
 *   Defends against async haptic promises / AI callbacks resolving after
 *   the component tree has been torn down.
 *
 * Middleware composition order (ADR-0006 §C, Step 9):
 *   [haptics, toast, aiBridge, navigate, undoBuffer, feedback, reducer]
 */
import {createContext, useContext, useEffect, useMemo, useReducer, useRef} from 'react'
import type {Spec} from '@app-creator/protocol'
import {reducer, buildInitialRendererState, resetRowIdCounter} from './reducer.js'
import type {RendererState, RendererAction} from './types.js'
import {composeMiddleware, makeReducerMiddleware} from './middleware.js'
import type {DispatchFn} from './middleware.js'
import {haptics} from './middleware/haptics.js'
import {makeToastMiddleware} from './middleware/toast.js'
import {makeAIBridgeMiddleware} from './middleware/aiBridge.js'
import type {AIDispatcher} from './middleware/aiBridge.js'
import {makeNavigationMiddleware} from './middleware/navigation.js'
import type {NavigationPrimitive} from './middleware/navigation.js'
import {makeUndoBufferMiddleware} from './middleware/undoBuffer.js'
import {feedback} from './middleware/feedback.js'
import type {HostCallbacks} from './hostCallbacks.js'

export type {DispatchFn, HostCallbacks, AIDispatcher, NavigationPrimitive}

export interface UseRendererStateOpts {
  host: HostCallbacks
  /** AI dispatcher — null if AI not available on this device */
  aiDispatcher?: AIDispatcher | null
  /** Navigation primitive — null until Step 10 wires up React Navigation */
  navigationPrimitive?: NavigationPrimitive | null
}

export interface UseRendererStateResult {
  state: RendererState
  dispatch: DispatchFn
}

export function useRendererState(
  spec: Spec,
  opts: UseRendererStateOpts,
): UseRendererStateResult {
  const [fullState, internalDispatch] = useReducer(
    reducer,
    spec,
    buildInitialRendererState,
  )

  // Spec-ref change reset (T-0006-013):
  // M1 pattern — dispatch synchronously during render if spec reference changed.
  // React re-renders with fresh state before painting (no useEffect delay).
  if (fullState.spec !== spec) {
    resetRowIdCounter()
    internalDispatch({type: '__RESET__', spec})
  }

  // Dispatch-after-unmount safety (T-0006-027).
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // fullStateRef — always current state, used by undoBuffer middleware getState().
  const fullStateRef = useRef(fullState)
  fullStateRef.current = fullState

  // Stable refs for opts so middleware factories can read current values without
  // being re-composed on every render.
  const hostRef = useRef(opts.host)
  useEffect(() => {
    hostRef.current = opts.host
  })

  const aiDispatcherRef = useRef(opts.aiDispatcher ?? null)
  useEffect(() => {
    aiDispatcherRef.current = opts.aiDispatcher ?? null
  })

  const navRef = useRef(opts.navigationPrimitive ?? null)
  useEffect(() => {
    navRef.current = opts.navigationPrimitive ?? null
  })

  // dispatchRef — updated after every render to point to the current safe dispatch.
  // Allows aiBridge + undoBuffer closures to call dispatch without capturing stale refs.
  const dispatchRef = useRef<DispatchFn>(() => undefined)

  // Build the composed middleware chain once per mount.
  // Middleware factories receive stable getters (lambdas that read refs) so
  // the chain never needs to be recomposed on prop/state changes.
  const dispatch = useMemo<DispatchFn>(() => {
    const chain = composeMiddleware([
      haptics,
      makeToastMiddleware({onToast: (msg, tone) => hostRef.current.onToast(msg, tone)}),
      makeAIBridgeMiddleware({
        getDispatcher: () => aiDispatcherRef.current,
        getDispatch: () => dispatchRef.current,
        host: {onAIError: (err) => hostRef.current.onAIError(err)},
        getState: () => fullStateRef.current,
      }),
      makeNavigationMiddleware(
        () => navRef.current,
        {onNavigationError: (sig) => hostRef.current.onNavigationError?.(sig)},
      ),
      makeUndoBufferMiddleware(
        () => fullStateRef.current,
        () => dispatchRef.current,
        {onToast: (msg, tone) => hostRef.current.onToast(msg, tone)},
      ),
      feedback,
      makeReducerMiddleware(internalDispatch),
    ])

    const safeDispatch: DispatchFn = (action: RendererAction) => {
      if (!mountedRef.current) return
      chain.dispatch(action)
    }

    return safeDispatch
    // Chain is built once per mount; internalDispatch is stable from useReducer.
  }, [internalDispatch])

  // Keep dispatchRef current so async closures in middleware use the latest fn.
  dispatchRef.current = dispatch

  return {state: fullState, dispatch}
}

// -- RendererStateContext -----------------------------------------------------
// Provided by the renderer root and consumed by useBinding + components.

type RendererStateContextValue = {
  state: RendererState
  dispatch: DispatchFn
} | null

export const RendererStateContext = createContext<RendererStateContextValue>(null)

/**
 * useRendererStateContext — reads the renderer state from context.
 * Must be called inside a RendererStateContext.Provider.
 */
export function useRendererStateContext(): {state: RendererState; dispatch: DispatchFn} {
  const ctx = useContext(RendererStateContext)
  if (ctx === null) {
    throw new Error(
      '[a2ui-renderer] useRendererStateContext must be called inside a RendererStateContext.Provider',
    )
  }
  return ctx
}

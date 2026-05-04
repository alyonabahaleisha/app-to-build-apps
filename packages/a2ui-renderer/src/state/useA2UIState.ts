/**
 * useA2UIState — the single state hook for the A2UI renderer.
 *
 * Translates spec-level A2UIActions into InternalActions for the reducer.
 * Handles toast by calling opts.onToast (the host's callback).
 *
 * Spec-change reset (T-0003-013b, locked decision):
 *   State resets on spec reference change. Implemented using the React
 *   "derived state from props" pattern — if fullState.spec !== spec, a RESET
 *   is dispatched synchronously during render, triggering an immediate
 *   re-render with fresh state before painting.
 *
 * Dispatch-after-unmount safety (T-0003-013c):
 *   dispatch() is a no-op after the host unmounts. Defends against async
 *   haptic-promise resolving after navigate-back.
 *
 * Bounds injection — §I.1 (Step 5 amendment, closes Roz Step-1 QA Issue 1):
 *   counterBoundsMap is built by walking spec.views once, memoized with
 *   useMemo([spec]). Maps Counter node id → {min?, max?, step?}. This lets
 *   a programmatic Button.action:{type:'increment', targetId:'c', by:100}
 *   on a Counter{max:50} clamp correctly to 50, even though the action itself
 *   carries no bounds (bounds belong to the Counter node, not the action).
 *
 * Warn-logging:
 *   Routes through the RendererLoggerProvider context so the workspace
 *   boundary (no import from apps/mobile) is never violated.
 */
import {useCallback, useEffect, useMemo, useReducer, useRef} from 'react'

import type {A2UIAction, A2UINode, A2UISpec} from '@app-creator/a2ui-schema'

import {useRendererLogger} from '../logger/RendererLoggerProvider'
import type {Dispatch, RenderState} from '../types'
import {buildInitialReducerState, reducer} from './reducer'

// -- Counter bounds map (§I.1) ------------------------------------------------

/**
 * CounterBounds — the per-id data we need to inject into INCREMENT/DECREMENT
 * internal actions for correct clamping.
 */
export interface CounterBounds {
  min?: number
  max?: number
  step?: number
}

/**
 * buildCounterBoundsMap — walks spec.views recursively once and collects every
 * Counter node's {min?, max?, step?} keyed by id.
 *
 * This map is memoized on spec reference — rebuilt only when the spec changes.
 * Called inside useMemo([spec]) so it doesn't allocate on every render.
 *
 * Recursive walk enters Container.children, List.items, and Form.fields so
 * Counter nodes nested at any depth are found.
 */
export function buildCounterBoundsMap(spec: A2UISpec): Map<string, CounterBounds> {
  const map = new Map<string, CounterBounds>()

  function walk(node: A2UINode): void {
    if (node.type === 'Counter') {
      map.set(node.id, {min: node.min, max: node.max, step: node.step})
      return
    }
    if (node.type === 'Container') {
      for (const child of node.children) walk(child)
      return
    }
    if (node.type === 'List') {
      for (const item of node.items) walk(item)
      return
    }
    if (node.type === 'Form') {
      for (const field of node.fields) walk(field)
      return
    }
    // Heading, Text, Image, Button, TextInput, Toggle — no children, nothing to recurse.
  }

  for (const view of spec.views) {
    walk(view.root)
  }

  return map
}

// -- Hook types ---------------------------------------------------------------

export interface UseA2UIStateOpts {
  onToast?: (message: string) => void
}

export interface UseA2UIStateResult {
  state: RenderState
  currentViewId: string
  dispatch: Dispatch
}

// -- Hook ---------------------------------------------------------------------

export function useA2UIState(
  spec: A2UISpec,
  opts?: UseA2UIStateOpts,
): UseA2UIStateResult {
  const logger = useRendererLogger()

  const [fullState, internalDispatch] = useReducer(
    reducer,
    spec,
    buildInitialReducerState,
  )

  // Spec-change reset (T-0003-013b):
  // If the spec reference changed since the last render, dispatch RESET
  // synchronously during this render. React allows calling dispatch during
  // render for the "derived state from props" pattern — it triggers a
  // synchronous re-render before painting, without a useEffect delay.
  if (fullState.spec !== spec) {
    internalDispatch({type: 'RESET', spec})
  }

  // Dispatch-after-unmount safety (T-0003-013c).
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Stable refs for callbacks that change between renders but should not
  // invalidate the dispatch callback.
  const onToastRef = useRef(opts?.onToast)
  useEffect(() => {
    onToastRef.current = opts?.onToast
  }, [opts?.onToast])

  const loggerRef = useRef(logger)
  useEffect(() => {
    loggerRef.current = logger
  })

  // Keep a ref to the current values Map for the set type-mismatch check
  // (avoids including fullState.values in dispatch's dep array, which would
  // invalidate dispatch on every state change).
  const valuesRef = useRef(fullState.values)
  valuesRef.current = fullState.values

  // Memoize knownViewIds so NAVIGATE dispatch doesn't allocate a new Set
  // every render.
  const knownViewIds = useMemo(
    () => new Set(spec.views.map(v => v.id)),
    [spec],
  )

  // §I.1 — counterBoundsMap: walk spec.views once to collect all Counter
  // node bounds. Memoized on spec reference. Rebuilt only when spec changes
  // (same trigger as the RESET path above). This lets programmatic
  // Button→Counter dispatches clamp correctly without Counter injecting
  // its own bounds into the action (bounds belong to the spec, not the UI).
  const counterBoundsMap = useMemo(
    () => buildCounterBoundsMap(spec),
    [spec],
  )

  const dispatch: Dispatch = useCallback(
    (action: A2UIAction) => {
      if (!mountedRef.current) return

      switch (action.type) {
        case 'set': {
          // Type-mismatch guard: if targetId already has a non-null value,
          // the new value must be the same typeof. Spec-author bugs (e.g.,
          // setting a counter field to "hello") are caught here.
          // NOTE: actual value is intentionally NOT logged (PII risk — the
          //       TextInput content could contain a password). §J.
          const existing = valuesRef.current.get(action.targetId)
          if (
            existing !== undefined &&
            existing !== null &&
            typeof existing !== typeof action.value
          ) {
            loggerRef.current.warn('a2ui_set_type_mismatch', {
              targetId: action.targetId,
              expectedType: typeof existing,
              actualType: typeof action.value,
            })
            return
          }
          internalDispatch({type: 'SET', id: action.targetId, value: action.value})
          break
        }

        case 'increment': {
          // §I.1 bounds injection: look up the Counter's {min, max, step} from
          // the pre-built map. If targetId isn't a Counter, bounds is undefined
          // and the action fires unbounded — no regression (T-0003-076c).
          // Default by falls back to the Counter's step first, then to 1, so
          // Counter's own + press and a programmatic Button both behave the same.
          const bounds = counterBoundsMap.get(action.targetId)
          internalDispatch({
            type: 'INCREMENT',
            id: action.targetId,
            by: action.by ?? bounds?.step ?? 1,
            min: bounds?.min,
            max: bounds?.max,
          })
          break
        }

        case 'decrement': {
          // §I.1 symmetric: same bounds look-up for decrement.
          const bounds = counterBoundsMap.get(action.targetId)
          internalDispatch({
            type: 'DECREMENT',
            id: action.targetId,
            by: action.by ?? bounds?.step ?? 1,
            min: bounds?.min,
            max: bounds?.max,
          })
          break
        }

        case 'toast':
          // Toast is the host's concern — the renderer doesn't render its own
          // toast UI. Just call up to the host's callback.
          onToastRef.current?.(action.message)
          break

        case 'navigate': {
          if (!knownViewIds.has(action.viewId)) {
            // Unknown viewId — no-op + warn-log (§B).
            // NOTE: full spec and node content are intentionally NOT logged
            //       to avoid leaking LLM output. §K.
            loggerRef.current.warn('a2ui_navigate_unknown_view', {
              viewId: action.viewId,
              knownViewIds: Array.from(knownViewIds),
            })
            return
          }
          internalDispatch({
            type: 'NAVIGATE',
            viewId: action.viewId,
            knownViewIds,
          })
          break
        }
      }
    },
    [internalDispatch, knownViewIds, counterBoundsMap],
  )

  // Expose state as a frozen Record<string, A2UIValue>.
  // Map is the internal source of truth; this snapshot is derived per-render.
  // Freezing defends against components mutating the state object directly.
  const state: RenderState = useMemo(
    () => Object.freeze(Object.fromEntries(fullState.values)) as RenderState,
    [fullState.values],
  )

  return {
    state,
    currentViewId: fullState.currentViewId,
    dispatch,
  }
}

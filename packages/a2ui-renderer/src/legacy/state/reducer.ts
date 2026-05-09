/**
 * Pure reducer for A2UI state engine.
 *
 * Internal action types use SCREAMING_SNAKE_CASE to distinguish them from
 * spec-level A2UIAction types (lowercase). Components never see these —
 * they dispatch A2UIActions; the hook translates and calls this reducer.
 *
 * State internal storage uses Map<string, A2UIValue> to prevent prototype-
 * pollution attacks from spec-author-controlled targetId values such as
 * `__proto__` or `constructor` (T-0003-022).
 *
 * Referential-equality preservation:
 *   INCREMENT/DECREMENT at boundary returns the SAME state object (no copy).
 *   This prevents needless re-renders when the Counter is already pinned
 *   at min or max (T-0003-009, T-0003-010).
 *
 * Clamping semantics (§I, locked decision):
 *   increment past max → clamp to max (not no-op)
 *   decrement past min → clamp to min (not no-op)
 *   T-0003-011, T-0003-011b, T-0003-076b verify.
 */
import type {A2UISpec, A2UIValue} from '@app-creator/a2ui-schema'

// -- Types --------------------------------------------------------------------

export type InternalAction =
  | {type: 'SET'; id: string; value: A2UIValue}
  | {type: 'INCREMENT'; id: string; by: number; min?: number; max?: number}
  | {type: 'DECREMENT'; id: string; by: number; min?: number; max?: number}
  | {type: 'NAVIGATE'; viewId: string; knownViewIds: Set<string>}
  | {type: 'RESET'; spec: A2UISpec}

export interface ReducerState {
  /** The spec this state was initialized from — used to detect spec identity changes. */
  spec: A2UISpec
  /** Keyed by node id. Map prevents __proto__ pollution. */
  values: Map<string, A2UIValue>
  currentViewId: string
}

// -- Helpers ------------------------------------------------------------------

export function buildValuesMap(spec: A2UISpec): Map<string, A2UIValue> {
  return new Map<string, A2UIValue>(Object.entries(spec.initialState ?? {}))
}

export function buildInitialReducerState(spec: A2UISpec): ReducerState {
  return {
    spec,
    values: buildValuesMap(spec),
    currentViewId: spec.initialViewId,
  }
}

// -- Reducer ------------------------------------------------------------------

/**
 * reducer — pure function; never mutates input state.
 *
 * Returns referentially-equal state (the exact same object) when no change
 * occurred — this is the contract for T-0003-009/010 (no needless re-renders
 * when at boundary).
 */
export function reducer(s: ReducerState, a: InternalAction): ReducerState {
  switch (a.type) {
    case 'RESET': {
      // Spec identity changed — discard all values, re-seed from new spec.
      return buildInitialReducerState(a.spec)
    }

    case 'SET': {
      const next = new Map(s.values)
      next.set(a.id, a.value)
      return {...s, values: next}
    }

    case 'INCREMENT': {
      const current = (s.values.get(a.id) as number | undefined) ?? 0
      if (a.max !== undefined && current >= a.max) {
        // Already at or above max — return referentially-equal state.
        return s
      }
      let next = current + a.by
      if (a.max !== undefined) {
        next = Math.min(next, a.max)
      }
      const nextMap = new Map(s.values)
      nextMap.set(a.id, next)
      return {...s, values: nextMap}
    }

    case 'DECREMENT': {
      const current = (s.values.get(a.id) as number | undefined) ?? 0
      if (a.min !== undefined && current <= a.min) {
        // Already at or below min — return referentially-equal state.
        return s
      }
      let next = current - a.by
      if (a.min !== undefined) {
        next = Math.max(next, a.min)
      }
      const nextMap = new Map(s.values)
      nextMap.set(a.id, next)
      return {...s, values: nextMap}
    }

    case 'NAVIGATE': {
      if (!a.knownViewIds.has(a.viewId)) {
        // Unknown viewId — warn-log happens in the hook (reducer is side-effect-free).
        return s
      }
      return {...s, currentViewId: a.viewId}
    }

    default: {
      // Defensive: unknown action type — return unchanged state.
      // Fires if new action types are added before reducer catches up.
      return s
    }
  }
}

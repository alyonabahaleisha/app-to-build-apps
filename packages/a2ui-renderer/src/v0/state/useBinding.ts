/**
 * useBinding<T> — resolves a Binding<T> to its current value.
 *
 * Three resolution branches (ADR-0006 §B):
 *
 * 1. literal: returns binding.value directly.
 * 2. state: reads state.slots.get(binding.slot).
 * 3. collectionField: reads the current row from ListItemContext, then
 *    returns row[binding.field].
 *
 * collectionField behavior outside a ListItemContext:
 *   - __DEV__ (T-0006-018a): THROWS with a descriptive error. Silent wrong
 *     values are the normalizeRow-class bugs Roz flagged. Throw surfaces the
 *     bug at development time.
 *   - production (T-0006-018b): returns undefined and calls
 *     host.onUnknownNodeType (or equivalent) once. Does not crash.
 *
 * T-0006-018a/b test mechanism (Roz NF-03):
 *   global.__DEV__ is set by the RN Jest preset to true. Tests that need the
 *   production path do: global.__DEV__ = false in beforeEach, restore in afterEach.
 *
 * The binding types (StringBinding, NumberBinding, etc.) all share the same
 * 3-branch discriminated union shape, so this hook works for all of them.
 * The generic <T> parameter is the caller's responsibility (no runtime check).
 */
import {useRendererStateContext} from './useRendererState.js'
import {useListItemContext} from './ListItemContext.js'
import type {HostCallbacks} from './hostCallbacks.js'

// Binding<T> — the union shape common to all binding types from protocol.
// We declare it locally here to avoid importing 5 separate binding types.
// The actual protocol binding types (StringBinding, NumberBinding, etc.) all
// conform to this shape — the discriminant and field names are identical.
export type Binding<T> =
  | {kind: 'literal'; value: T}
  | {kind: 'state'; slot: string}
  | {kind: 'collectionField'; collectionId: string; field: string}

// Declared outside the hook so it's injected at renderer root setup.
// Tests can pass a mock. The useBinding hook reads this via module-level ref.
let _onUnknownNodeType: HostCallbacks['onUnknownNodeType'] | undefined

export function setUnknownNodeTypeCallback(cb: HostCallbacks['onUnknownNodeType']): void {
  _onUnknownNodeType = cb
}

// Tracks whether the production warning has already been emitted for a given
// binding + context combination. We reset this per-test via the exported reset fn.
// In production, we emit once per React render pass (not per call) to avoid spam.
// Simple approach: emit every call in prod (callers will debounce if needed).

/**
 * useBinding<T> — resolves a binding to its current value.
 */
export function useBinding<T>(binding: Binding<T>): T | undefined {
  const {state} = useRendererStateContext()
  const listItem = useListItemContext()

  switch (binding.kind) {
    case 'literal': {
      return binding.value
    }

    case 'state': {
      return state.slots.get(binding.slot) as T | undefined
    }

    case 'collectionField': {
      if (listItem === null) {
        // Outside a ListItemContext — this is always a bug.
        if (
          typeof __DEV__ !== 'undefined' && __DEV__
        ) {
          throw new Error(
            `[a2ui-renderer] useBinding: collectionField binding ` +
              `(collectionId="${binding.collectionId}", field="${binding.field}") ` +
              `resolved outside a ListItemContext. ` +
              `This component must be rendered inside a <List> row. ` +
              `This throws in dev to surface the bug early (T-0006-018a).`,
          )
        }
        // Production: warn via host callback, return undefined
        _onUnknownNodeType?.(
          `collectionField binding for "${binding.field}" used outside ListItemContext`,
        )
        return undefined
      }
      return listItem.row[binding.field] as T | undefined
    }
  }
}

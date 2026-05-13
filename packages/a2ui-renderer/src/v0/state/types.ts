/**
 * V0 renderer state types.
 *
 * Two layers:
 *   - slots: Map<SlotName, BindingValue> — named state slots from Spec.initialState
 *   - collections: Map<CollectionId, CollectionState> — typed collection state
 *
 * `pendingUndo` holds the data for the 5s undo window opened by removeItem.
 * It is populated by the undoBuffer middleware (not the reducer directly — the
 * reducer handles it as part of the removeItem state transition), and cleared
 * either by an undo (addItem with matching rowId) or by the 5s expiry timer.
 *
 * `clearPendingUndo` is an internal-only action type — the undoBuffer middleware
 * dispatches it after the 5s expiry to null out pendingUndo. It is NOT in the
 * 13-verb closed set exported by @app-creator/protocol. Components and spec authors
 * never emit this action; only the renderer's own middleware does.
 */
import type {Collection, BindingValue} from '@app-creator/protocol'
export type {
  StringBinding,
  NumberBinding,
  BooleanBinding,
  DateBinding,
  ImageBinding,
  BindingValue,
} from '@app-creator/protocol'

// SlotName is a validated string key matching SlotNameSchema regex.
export type SlotName = string

// CollectionId is a validated string key matching COLLECTION_ID_REGEX.
export type CollectionId = string

// RowId is a stable string id for a collection row (generated at addItem time or
// preserved from seed data for undo restoration).
export type RowId = string

// Row is a plain record of field values — the runtime representation of a
// collection row. Keys are field names; values are the BindingValue primitives.
export type Row = Record<string, BindingValue>

// CollectionState — runtime state for a single collection.
// schema is immutable (from spec); rows + rowOrder are mutable.
export type CollectionState = {
  /** The collection definition from the spec — immutable once initialized. */
  schema: Collection
  /** Map of row id → row data. Insertion order is maintained but rowOrder is authoritative. */
  rows: Map<RowId, Row>
  /** Explicit row ordering for FlashList and undo restoration. */
  rowOrder: RowId[]
}

// PendingUndo — transient buffer holding the data needed to restore a removed row.
// Lives in RendererState so undo is testable and deterministic.
export type PendingUndo = {
  collectionId: CollectionId
  rowId: RowId
  /** Immutable copy of the removed row for restoration. */
  rowData: Row
  /** Original index in rowOrder — used to restore at correct position, not append. */
  insertIndex: number
  /** Timestamp at removeItem dispatch — used by the middleware timer. */
  removedAt: number
}

// RendererState — the complete V0 renderer state.
export type RendererState = {
  /** The Spec this state was initialized from — used for spec-ref change detection. */
  spec: import('@app-creator/protocol').Spec
  /** Named state slots. Map prevents __proto__ pollution from spec-author-controlled names. */
  slots: Map<SlotName, BindingValue>
  /** Collection runtime state, keyed by collection id. */
  collections: Map<CollectionId, CollectionState>
  /** Currently active screen id (for stack/tabs nav). */
  currentScreenId: string
  /** Screen-id history stack for `back` action (stack nav only). */
  history: string[]
  /** Non-null during the 5s undo window after a removeItem dispatch. */
  pendingUndo: PendingUndo | null
}

// ClearPendingUndoAction — internal-only action dispatched by undoBuffer middleware
// after the 5s undo window expires. NOT in the 13-verb closed set; never emitted
// by spec components or external callers.
export type ClearPendingUndoAction = {type: 'clearPendingUndo'}

// ResetAction — internal-only action dispatched by useRendererState when the
// spec reference changes. Triggers full re-initialization from the new spec.
// NOT in the 13-verb closed set.
export type ResetAction = {type: '__RESET__'; spec: import('@app-creator/protocol').Spec}

// RendererAction — the full action set the reducer handles: 13 spec verbs +
// internal actions (clearPendingUndo, __RESET__).
export type RendererAction =
  | import('@app-creator/protocol').Action
  | ClearPendingUndoAction
  | ResetAction

// MAX_ROWS — maximum collection row count enforced by the reducer.
// T-0006-010: 51st addItem no-ops with a warning.
export const MAX_ROWS = 50

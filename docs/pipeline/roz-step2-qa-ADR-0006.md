# QA Report — ADR-0006 Step 2 (state model + reducer + middleware framework + Binding<T> resolution)

_Reviewed by Roz — 2026-05-09_

## Verdict: PASS WITH NOTES

| Check | Status |
|---|---|
| Type Check (a2ui-renderer) | PASS — clean |
| Type Check (mobile) | PASS — AppRunner unaffected |
| Lint | PASS — 62 warnings all pre-existing in src/legacy/ |
| Tests | PASS — 281/281, 28 suites |
| Coverage | PASS WITH NOTES — 94.79% overall, v0/state branch 83.78% |
| Reducer purity | PASS — no Date.now/Math.random/I/O; module counter deviation accepted |
| Middleware composition | PASS — `[haptics, toast, aiBridge, navigate, undoBuffer, reducer]` |
| Telemetry insertion-point (T-028a / MT-05) | PASS — 3 test cases lock the contract |
| useBinding 3 kinds + __DEV__ toggle | PASS — NF-03 closed |
| pendingUndo + undoBuffer mechanics | PASS — NF-02 closed (fake timers used) |
| `generateRowId()` module-counter deviation | RULED ACCEPTED |
| `hostCallbacks.ts` new file | RULED ACCEPTED |
| AppRunner unchanged | PASS — still imports legacy re-export |
| No scope creep | PASS — only state/ in v0/ |

## Per-Test-ID Coverage

All 23 ADR-spec'd T-IDs (T-0006-006..028a) present and verified. Includes T-0006-012a deep-freeze immutability per Roz's prior note (recursively freezes Maps + Rows + history + pendingUndo).

## Issues Found (none gating)

### Issue 1 (Advisory) — T-0006-028 is tautological

Tests `expect(VERBS).toHaveLength(12)` + `typeof verb === 'string'`. Doesn't exercise the reducer. T-0006-007 does the actual functional work. Replace with a loop that dispatches each verb into `reducer` before Step 9 or 10. One loop, 12 dispatches. Cosmetic anti-pattern; not gating.

### Issue 2 (Minor) — `'back-on-empty-history'` signal defined but never emitted

`NavigationErrorSignal` includes `'back-on-empty-history'`. The middleware never emits it because it lacks `getState`. The reducer no-ops on empty history but cannot signal it (reducer is pure).

Resolution: before Step 10, either (a) inject `getState` into navigation middleware (like undoBuffer has), or (b) update the docstring to mark this signal as "Step 10 only — surfaced by React Navigation error handling." Step 10 concern, not Step 2.

### Issue 3 (Coverage advisory) — useRendererState lines 107-120, 157 uncovered

Lambda bodies inside `useMemo` and the `useRendererStateContext` throw path. Step 3 will exercise these naturally when AICapabilitiesProvider tests use the context-outside-provider pattern.

### Issue 4 (Pre-existing) — 62 lint warnings in src/legacy/

All `@typescript-eslint/no-explicit-any` in legacy test files. Pre-existing from Step 1.

## Deviations Ruled

### `generateRowId()` module-counter — ACCEPTED

The module-counter is the correct V0 choice:
1. `Action.addItem` has no `rowId` field; widening would be a protocol schema change.
2. Pure ID injection requires breaking `useReducer` signature.
3. Counter is deterministic (`resetRowIdCounter()` called at spec change for test isolation).
4. Sequential string IDs (`row_1`, `row_2`) acceptable for V0 — no persistence/sync concern.
5. Documented, bounded, testable. Not a purity violation that affects observable transitions.

If V0.5 introduces collection sync, inject a stable ID generator via the reducer signature then.

### `hostCallbacks.ts` new file — ACCEPTED

Not in original Step 2 file list but a natural extraction from §G's inline definition. Content matches §G rev-1 exactly: `onToast`, `onAIError`, `onUnknownNodeType?`, `onNavigationError?`. NavigationErrorSignal enum correct. File placement (`state/hostCallbacks.ts`) is defensible; Step 10 may promote to `src/v0/hostCallbacks.ts` when `Renderer.tsx` lands.

## Reducer Purity + Deep-Freeze Verification

**Purity:** CONFIRMED. No `Date.now`, `Math.random`, `console.*`, `fetch`, `setTimeout` in reducer.ts. Only module-level mutation is `_rowIdCounter` (deviation accepted).

**Deep-freeze (T-0006-012a):** CONFIRMED per Roz prior note. `deepFreezeRendererState` recursively freezes:
- `state.slots` Map
- Each `CollectionState` object + its `rows` Map + each `Row`
- `state.collections` Map
- `state.history` array
- `state.pendingUndo` and `pendingUndo.rowData` when non-null
- Top-level `state` object

Acknowledges `Object.freeze` doesn't prevent `Map.prototype.set` — falls back to structural value comparison for Map immutability check. Accurate JS semantics.

## Middleware Composition + Telemetry Insertion-Point

Composition order matches §C exactly. Toast and aiBridge short-circuit (don't call next). T-0006-028a lock has 3 cases:
1. Before-toast: telemetry sees toast actions ✓
2. After-toast: telemetry does NOT see toast actions ✓
3. Before-toast: telemetry sees other actions (set, navigate) ✓

Forward-compat contract for ADR-0007 telemetry is locked.

## useBinding 3-Kind Resolution + __DEV__ Toggle

All 3 kinds correct. CollectionField outside ListItemContext:
- Dev (T-018a): throws regex-matched error
- Prod (T-018b): returns undefined + calls onUnknownNodeType

`__DEV__` toggle: capture original, set true/false in beforeEach, restore in afterEach. Tests deterministic. NF-03 closed.

## pendingUndo + undoBuffer

State model has `pendingUndo: PendingUndo | null` with all required fields. removeItem reducer populates pendingUndo with `removedAt: 0` (reducer is pure; middleware owns timing). addItem detects pendingUndo match and restores at `insertIndex`. undoBuffer middleware uses `setTimeout(UNDO_WINDOW_MS)` and clears via `clearPendingUndo` action.

T-161d/e/f all present and use fake timers. NF-02 closed.

## ESM / CLAUDE.md Compliance

All clean. ESM `.js` extensions, no legacy imports, no `console.log`, no deep workspace imports. `useEffect` used for ref-update infra (justified). `useMemo` for chain construction (justified — middleware factories close over refs).

## Notes for Step 3

1. **`useRendererStateContext` throw path** — uncovered. AICapabilitiesProvider tests will naturally exercise this; add explicit "outside provider" test.
2. **`hostCallbacks.ts` placement** — consider promoting to `src/v0/hostCallbacks.ts` when Renderer.tsx lands at Step 10.
3. **`'back-on-empty-history'` signal** — resolve before Step 10 (inject getState OR update docstring).
4. **T-0006-028 tautology** — replace with dispatch loop before Step 9 or 10.
5. **useRendererState useMemo deps** — `[internalDispatch]` correct today. ADR-0007 telemetry prop will require deps update; leave a comment.

## Roz's Assessment

281 tests pass, all 23 ADR-spec'd IDs present and exercised. Reducer pure by every meaningful measure. Module counter deviation sounds impure but the alternatives are worse. Deep-freeze implementation addressed my prior note exactly.

Telemetry insertion-point lock has three test cases — before-toast sees toast, after-toast doesn't, before-toast sees other actions. ADR-0007 forward-compat is contractually closed.

The one actual bug is `'back-on-empty-history'` defined but never emitted. Step 10 concern, not Step 2. Misleading docstring should be cleaned before Colby reaches Step 10.

**Step 3 unblocked.**

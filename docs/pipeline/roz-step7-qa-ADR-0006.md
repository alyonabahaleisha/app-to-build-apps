# QA Report — ADR-0006 Step 7 (Lists tier + FlashList + Reanimated)

_Reviewed by Roz — 2026-05-07_

## Verdict: FAIL

One gating issue: `estimatedItemSize` is computed but never passed to FlashList — direct ADR AC violation, masked by a test that checks the wrong surface.

| Check | Status |
|---|---|
| Type Check | PASS |
| Lint | PASS — 0 errors |
| Tests (V0) | PASS — 382/382 |
| Tests (Legacy) | PASS — 211/211 |
| useEffect ban | PASS — zero in `src/v0/components/` |
| act() warnings | PASS — zero in test:rn output |
| Round-2 Note 1 fix | PASS — redundant ref update removed in TextField + NumberField |
| Round-2 Note 2 fix | PASS — act() wrappers added to FP1/FP2/FP3/FP4 |
| Component count vs ADR | PASS — 5 components match ADR (List, ListItem, SwipeableRow, EmptyState, LoadingState — orchestrator brief was wrong) |
| FlashList `estimatedItemSize` | **FAIL** — prop missing on FlashList element |
| ListItemContext binding | PASS |
| Pending undo flow | PASS |
| Reanimated reducedMotion bypass | PASS WITH NOTE — branch not exercised in test |
| AppRunner unchanged | PASS |
| Scope creep | PASS |

---

## Findings

### Finding 1 (GATING) — `estimatedItemSize` missing from FlashList props

**File:** `packages/a2ui-renderer/src/v0/components/lists/List.tsx` line 189.

**ADR AC:** "FlashList `estimatedItemSize` per layout: compact 44, standard 56, expanded 80."

`estimatedItemSize` is correctly computed at line 143, used for the wrapping `Animated.View` `minHeight` (line 185) and `DefaultRowView` `rowHeight` (line 204), but **never passed to `<FlashList>`**:

```tsx
<FlashList<RowEntry>
  data={rowEntries}
  keyExtractor={(entry) => entry.rowId}
  renderItem={...}
  // estimatedItemSize={estimatedItemSize}  ← MISSING
/>
```

This is the core FlashList virtualization prop. Without it, FlashList logs a warning and falls back to an internal heuristic, defeating the purpose of using FlashList over FlatList (ADR §L: "no FlatList").

**Why the test missed it:** T-0006-124 asserts `expect(tree).toContain('"minHeight":${expectedSize * 3}')` — it checks the wrapping container's `minHeight`, not the FlashList prop. The FlashList mock in `jestSetup.js` doesn't capture or forward unrecognized props, so the test passes regardless.

**Required fix (round 2):**
1. Add `estimatedItemSize={estimatedItemSize}` to `<FlashList>` in `List.tsx` line 189.
2. Update the FlashList mock in `jestSetup.js` to capture/expose `estimatedItemSize`.
3. Strengthen T-0006-124 to verify the prop is on the FlashList element (testID or props inspection).

### Finding 2 (Advisory) — ShimmerBlock animation assigned during render body

**File:** `packages/a2ui-renderer/src/v0/components/lists/LoadingState.tsx` lines 67-76.

`ShimmerBlock` assigns `opacity.value = withRepeat(...)` directly in the render body to avoid `useEffect` (which is banned). Reanimated re-runs the assignment on every re-render, restarting the animation. In practice harmless because `ShimmerBlock` is static, but Reanimated strict mode (RN 0.76 dev builds) may warn.

**Resolution:** consider `useDerivedValue` or `useSharedValue` lazy initializer at Step 11 cleanup pass.

### Finding 3 (Advisory) — T-0006-123 reduced-motion branch not exercised

**File:** `packages/a2ui-renderer/src/v0/components/lists/LoadingState.test.tsx` lines 136-152.

Test labeled "reduced motion" acknowledges `useReducedMotion()` returns `false` in test env. The `if (!reducedMotion)` branch in `ShimmerBlock` (line 67) is never exercised with `true`. Implementation logic is correct but coverage gap is real.

**Resolution (cheap, may bundle with round 2):** mock `useReducedMotion` to return `true` in a dedicated test, or expose a testID to assert initial opacity value.

### Finding 4 (Advisory) — Reanimated mock placement semantically misaligned

**File:** `packages/a2ui-renderer/src/legacy/__mocks__/ReactNativeReanimatedMock.js`.

Lives in `src/legacy/__mocks__/` but consumed exclusively by `src/v0/` tests. Other legacy mocks are RN internals stubs legitimately shared. This one is a custom V0-only implementation. Future placement: `src/__mocks__/react-native-reanimated.js` (auto-resolution) or `src/v0/__test-utils__/__mocks__/`. Not gating.

**Resolution:** Step 10 cleanup pass.

---

## T-ID Coverage (T-0006-107..128)

22 T-IDs: 20 pass, 1 fail (T-0006-124 — wrong surface), 1 pass with gap (T-0006-123 — branch not exercised).

| T-ID | Status |
|---|---|
| T-107..116 (10 snapshots) | PASS |
| T-117 rows from rowOrder via FlashList | PASS |
| T-118 ListItemContext rowId/row/index | PASS |
| T-119 leading slots (icon/avatar/badge/none) | PASS |
| T-120 leading swipe dispatch | PASS |
| T-121 trailing swipe removeItem | PASS |
| T-122 emptyState node + default | PASS |
| T-123 shimmer row count | PASS WITH GAP (Finding 3) |
| T-124 estimatedItemSize | **FAIL** (Finding 1) |
| T-125 unknown collectionId | PASS |
| T-126 50 rows | PASS |
| T-127 100 parallel reducer calls | PASS |
| T-128 rowId key, rowOrder stable | PASS |

---

## Required Fixes for Round 2

1. **Pass `estimatedItemSize` to `<FlashList>`** in `List.tsx` line 189.
2. **Update FlashList mock** in `jestSetup.js` to capture/expose `estimatedItemSize` so tests can verify.
3. **Strengthen T-0006-124** to assert the prop on the FlashList element (props inspection), not the container `minHeight`.
4. **(Optional bundle) Close T-0006-123** by mocking `useReducedMotion` to return `true` and verifying static-opacity branch.

After fixes land, scoped re-run: typecheck, both test suites, lint.

---

## Roz's Assessment

The lists tier is 95% there. Five correct components, clean test suite, zero useEffect leaks, act() warnings gone, both round-2 notes addressed, scope boundary clean. The Reanimated mock is solid engineering.

The gating finding is embarrassing because it is a one-liner: `estimatedItemSize` is computed, correctly valued, passed everywhere except the one place that matters. The ADR says it should be there. T-0006-124's name says it verifies this. Neither produced the prop. The test checks the wrong surface (container minHeight, not FlashList prop) and passes regardless.

Fix is mechanical: one line in List.tsx, mock update, test assertion strengthening.

Step 8 cannot start until this lands.

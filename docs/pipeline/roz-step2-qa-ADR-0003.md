# QA Report — ADR-0003 Step 2: Container + List

_Reviewed by Roz — 2026-05-02_

## Verdict: PASS WITH NOTES

---

| Check      | Status          | Details                                                                                                                                                                                                  |
| ---------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Type Check | PASS            | `pnpm typecheck` clean across all 4 workspaces.                                                                                                                                                          |
| Lint       | PASS WITH NOTES | 0 errors. 27 `@typescript-eslint/no-explicit-any` warnings in Container/List test files — intentional test-level casts for `react-test-renderer`'s untyped `toJSON()`. No workspace-boundary violations. |
| Tests      | PASS            | 91/91 in renderer package. 7 suites, 0 failures. AppRunner 7/7 in isolation.                                                                                                                             |
| Coverage   | PASS WITH NOTES | 98.23% stmts / 95.89% branches. Gates met. Two coverage gaps reported in Issues.                                                                                                                         |
| Complexity | PASS            | Container.tsx 99 LOC, List.tsx 79 LOC.                                                                                                                                                                   |
| Security   | PASS            | No workspace boundary violations. T-0003-006b lint runtime test still passing.                                                                                                                           |

---

## T-ID Verification

All 23 mandatory T-IDs (T-0003-023..038c) present. Counts match Step 2 Test Summary (Happy 9, Boundary 4, Snapshot 7, Negative 2, Failure 1). Each snapshot T-ID is its own `it` block — R-7 satisfied.

## Pressure-Test Results

**T-0003-038b — Defensive fallback (PASS, genuine):** `as any` cast bypasses Zod, asserts `not.toThrow()` AND that the exact `[Unimplemented: UnknownWidget]` string appears in rendered output. Default branch in `render.tsx` line 64 preserved.

**T-0003-038c — Key stability (PASS, but vacuous for stated claim):** see Issue 1.

**Snapshot enumeration (PASS):** 5 Container + 2 List snapshots, each separate `exports[...]` entry. Container snapshots include `undefined` for unset alignItems/justifyContent — minor cosmetic noise.

**Workspace boundary (PASS):** Container/List import only `react`, `react-native`, `@app-creator/a2ui-schema`, internal package paths. T-0003-006b runtime lint still 11/11.

**`NodeRenderer` public surface (PASS):** Named export from `render.tsx`, NOT re-exported in `index.ts`. Package-internal as Colby intended.

**Container no `accessibilityRole` (PASS):** Source confirms bare `<View>`. T-0003-038 verified.

**List separator branches (PASS):** T-0003-034 verifies 5 children (3 items + 2 separators), each separator has `{height:1, backgroundColor: bg.subtle}`, `gap: 0`. T-0003-033 verifies `md` gap default with no separators.

---

## Issues Found

### Issue 1 (Minor, doc-debt): T-0003-038c key-stability assertion is vacuous for stated claim

`Container.test.tsx` lines 305–385. Test description claims "already-set state for a child's `id` persists when children array grows." Actual assertion verifies `node.text` rendering survives re-render. Since no renderer component uses internal `useState`, React's key-reconciliation engine is never exercised. The test passes regardless of key strategy.

**Impact:** Cannot catch a future regression where a renderer component gains internal state and has it reset by array prepend. Architectural invariant (no internal state in renderer components) is maintained today, so no runtime consequence.

**Remediation:** Add a comment clarifying that the test locks rendering behavior, not key reconciliation. Alternatively replace with a `testID` + `getByTestId` identity assertion. Non-blocking.

### Issue 2 (Minor, coverage gap): `render.tsx` List dispatch branch + error branch uncovered

Lines 19 (initialViewId-not-found error) and 59 (List dispatch in NodeRenderer) uncovered. List tests drive `ListRenderer` directly rather than through `render()`. Overall coverage above gates, but these branches should be exercised before Step 8's determinism tests rely on `render()`.

**Remediation:** Step 3 should add at least one test that calls `render()` with a multi-component spec (Heading + Text + Image inside a Container) to force the dispatch branches.

### Issue 3 (Carry-forward, Step 1): `useA2UIState.ts` decrement default-by branch gap

Line 138 (`by: action.by ?? 1` decrement case) uncovered at hook level. Reducer-level coverage complete. Annotated in Step 1 QA.

### Issue 4 (Carry-forward, Step 1): Step 5 BLOCKER — bounds wiring

Resolved in ADR §I.1. Step 5 will close. Not a Step 2 concern.

---

## Roz's Assessment

Step 2 is clean. Two new components match ADR specs exactly. T-0003-038b is genuine. T-0003-038c is documentation debt — passes, but doesn't exercise its stated invariant because no renderer component uses internal state. Coverage 98%/96% with two minor `render.tsx` branches uncovered (List dispatch, error fallback).

**Step 3 (Image + Heading + Text) may proceed.**

— Roz

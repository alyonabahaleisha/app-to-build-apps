# QA Report — ADR-0003 Step 5: Counter + bounds-injection wiring (§I.1)

_Reviewed by Roz — 2026-05-02_

## Verdict: PASS WITH NOTES

---

| Check      | Status          | Details                                                                                                                                                                                                                                                      |
| ---------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Type Check | PASS            | All 4 workspaces clean.                                                                                                                                                                                                                                      |
| Lint       | PASS WITH NOTES | 0 errors. 62 `no-explicit-any` warnings (pre-existing). Counter.tsx itself: 0 warnings.                                                                                                                                                                      |
| Tests      | PASS            | 156/156 in renderer. 13 suites. 24 snapshots match.                                                                                                                                                                                                          |
| Coverage   | PASS WITH NOTES | Aggregate 93.68% stmts / 90.9% branches. Counter.tsx 84%/75% (uncovered: onAccessibilityAction handler). useA2UIState.ts 91%/87% (uncovered: List + Form walk in buildCounterBoundsMap). Above thresholds at aggregate, but the gaps are NEW code in Step 5. |
| Complexity | PASS            | Counter.tsx 204 LOC, CCN ≤ 5. useA2UIState.ts 267 LOC. No animation primitives in Counter — Phase 2 deferral confirmed.                                                                                                                                      |
| Security   | PASS            | Workspace boundary clean. No PII in dispatched payloads.                                                                                                                                                                                                     |

## All 17+2 Mandatory T-IDs Verified

All T-0003-069..081 + T-0003-011-hook-gap (relabeled) + T-0003-011-hook-clamp (new) present and assertions specific.

**T-0003-076b** — the central rationale of §I — passes end-to-end through a real component render, not unit-isolated reducer test. Button → fireEvent.press → useA2UIState → counterBoundsMap.get('c') → reducer clamp. Counter in Container at one level of nesting.

## §I.1 Wiring Assessment

The bounds-injection architecture is structurally sound:

- `buildCounterBoundsMap` memoized on `spec` reference — same trigger as state RESET. Two `useMemo([spec])` calls; spec change rebuilds both atomically.
- Dispatch enrichment symmetric for INCREMENT/DECREMENT.
- Non-Counter targetIds → `bounds === undefined` → reducer guards make these no-ops. No regression.
- `action.by ?? bounds?.step ?? 1` chain correctly prioritizes explicit `by` over Counter step.
- T-0003-076b is a genuine integration proof.

## Issues Found

### Note 1 (Medium): Counter.tsx `onAccessibilityAction` handler untested

`Counter.tsx` lines 110–113. Handler routes native `'increment'`/`'decrement'` accessibility actions to `handleIncrement()`/`handleDecrement()`. T-0003-078 only verifies the `accessibilityActions` prop array shape. Routing is untested — accessible-tech path unverified.

**Remediation:** Step 6 add T-0003-078b: fire `onAccessibilityAction({nativeEvent:{actionName:'increment'}})` on at-max Counter, assert dispatch not called (no-op via existing `atMax` guard).

### Note 2 (Medium): `buildCounterBoundsMap` List + Form walk branches uncovered

`useA2UIState.ts` lines 71–76. Container branch covered by T-0003-076b. List-item walk and Form-field walk are dead in tests. The recursion is structurally identical (correct by inspection) but unverified.

**Remediation:** Step 6 add direct unit tests of the exported `buildCounterBoundsMap` function: (a) Counter inside List items, (b) Counter inside Form fields, (c) Counter nested 3 levels deep (Container > Container > Form > Counter).

### Note 3 (Low): Deep-nesting recursion unproven

The pressure-test scenario (Counter > 3 levels) has no test. Implementation is correct by inspection. Folded into Note 2's remediation.

### Note 4 (Pre-existing): Lint carry-forward unchanged

62 `no-explicit-any` warnings + 1 redundant eslint-disable from Steps 1–4. Step 5 introduces zero new lint issues.

## Roz's Assessment

Step 5 closes Step 1 Issue 1. The §I.1 architecture is implemented correctly. T-0003-076b is genuine. `buildCounterBoundsMap` recursive walk is correct by inspection.

The three coverage gaps are notable because they were specifically called out in the pressure-test brief — List and Form walk branches exist in production code with no test exercise. `buildCounterBoundsMap` is exported; ~20 lines of direct unit tests would close all three notes at once.

**Step 6 (TextInput + Toggle) may proceed.** Notes 1–3 not blocking but should close before ADR completion.

— Roz

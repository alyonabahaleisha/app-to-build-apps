# QA Report — ADR-0009 Test Spec Review

_Reviewed by Roz — 2026-05-07_

## Verdict: REVISE

3 P0 + 21 P1 findings. Six per-step summary count drifts. Architecturally sound; gaps are findable and fixable without structural changes.

## P0 (blocking)

1. **MoneyField floating-point regression test missing.** Cal flagged the JS float bug in §J risks but wrote no test pinning the integer-only canonicalization path. Silent data corruption risk.
2. **ValidatorResult backward-compatibility shape test missing.** T-0009-203 tests behavior; no test verifies V0 tests using `toEqual` (exact match) won't break due to the new always-present `warnings: []`.
3. **SearchFilterContext instance-scoping security test missing.** `auth-only` data in the Map. No test verifies the Map is per-Renderer-instance (not a module-level singleton). Cross-user filter bleed risk.

## P1 Required Additions

4. SearchBar unmount-clears-filter test
5. Two SearchBars on same collectionId — behavioral pin or rejection
6. MultiPicker empty CSV parse (`''` → `[]`)
7. MultiPicker trailing comma parse (`'a,'` → `['a']`)
8. MetricTile sparkline 1 data point (division-by-zero guard)
9. MetricTile sparkline max-30 boundary
10. Receipt no-tax no-tip math check
11. Gallery empty-state rendering ("No photos yet" hardcoded copy)
12. Gallery null imageField per-row fallback behavior
13. tintColor short-hex rejection (`'#FFF'` 3-char hex)
14. AvatarGroup `accessibilityLabel` content test
15. Callout `danger` variant `accessibilityRole="alert"`
16. T-0009-191 split into two (Timeline + Heatmap separately)
17. Divider no-label `accessibilityRole="none"` test
18. T-0009-110 moved to Step 8 or flagged Step-8-dependent
19. Calendar same-date-tap behavior pinned
20. System-prompt catalog budget bumped 35,000 → 40,000 chars for Phase 1.5 headroom
21. T-0009-220 specificity improved ("contextually distinguished" → concrete assertion)
22. Step 6 Boundary count reconciled (summary claims 2, actual 1+1=2 — needs missing test)
23. Step 7 Happy count reconciled (summary 30, actual 29)
24. receipt_total_mismatch warning message content test

## Per-Step Summary Drift

| Step | Table rows | Summary total | Drift |
|---|---|---|---|
| 1 | 30 | 28 | -2 |
| 2 | 37 | 36 | -1 |
| 3 | 21 | 21 | 0 |
| 4 | 22 | 22 | 0 |
| 5 | 25 | 25 | 0 |
| 6 | 21 | 22 | +1 |
| 7 | 29 | 30 | +1 |
| 8 | 19 | 20 | +1 |
| 9 | 8 | 8 | 0 |
| 10 | 15 | 16 | +1 |

Test Totals table (227) is correct. Per-step summaries need reconciliation.

## Non-Blocking Observations

- Non-standard categories used: `Failure (a11y)`, `Happy (warning)`, `Same`, `Regression (a11y)`, `Boundary (perf)`. Acceptable but inconsistent.
- Cal's footer ratio numbers (43 negative, 121 happy) don't exactly match my recount (44 negative incl Failure-a11y, 123 happy incl Happy-warning). Minor.
- date-fns version pin uses caret (`^3.6.0`); project convention is exact pins. Recommend `3.6.0`. `expo-document-picker@~12.0.2` tilde is acceptable per Expo SDK convention.

## Roz's Assessment

ADR is well-structured. Real architectural work — SearchFilterContext specced cleanly, cross-ref validator extension coherent, Sable's UX faithfully translated. Six summary tables have count drift (mechanical recount fix). Three P0 gaps are findable, fixable, and don't require structural changes.

For a 25-component additive expansion with tight V0 patterns to follow, this is closer to REVISE than REJECT. Architectural decisions sound. Coverage philosophy (happy-leaning for compositional work) defensible and documented.

Cal addresses P0s + P1s + reconciles summaries + bumps budget → re-review. Expect one round, not three.

# QA Report — ADR-0006 Canvas V0 Renderer (rev-1 review)

_Reviewed by Roz — 2026-05-08_

## Verdict: APPROVE WITH NOTES

Colby is cleared to start Step 1. All P0/High findings from rev-0 are genuinely closed. The residuals documented below are cosmetic cleanup misses and one implementability gap in a Step 9 test — none gate the Step 1–8 implementation window.

---

## Rev-0 Closure Verification

All 7 architectural concerns and 12 numbered findings ruled CLOSED:

- Concern 1 (`onShare` removed): PARTIAL — type fixed; 3 ghost refs remain (NF-04).
- Concern 2 (telemetry insertion): CLOSED via T-0006-028a.
- Concern 3 (Milestone B narrowed): CLOSED.
- Concern 5 (AI bridge act() flush): CLOSED via T-0006-038a.
- Concern 6 (Step 10 nav failures): CLOSED on count; observability vehicle issue (NF-01).
- Concern 7 (T-0006-177 deterministic): CLOSED with Option A.
- R-01..R-12: all addressed.
- 7 of 10 missing tests added; 3 deferred to advisory.

---

## New Gaps Introduced by Rev-1

### NF-01 (Medium) — T-0006-172a/c: wrong observability vehicle

`host.onUnknownNodeType` is declared as "schema-violating node type seen at render"; its parameter is a component-type string. Routing nav runtime signals (`'back-on-empty-history'`, `'navigate-on-none-nav'`) through this hook is semantic overload.

**Fix:** add `onNavigationError?(signal: NavigationErrorSignal): void` to `HostCallbacks`. Update T-0006-172a/c to use it.

Does not block Steps 1–9. Becomes real at Step 10. Should fix before Colby implements `navigation.ts` middleware.

### NF-02 (Advisory) — T-0006-161f: no fake-timer specification

T-0006-161f tests the 5s expiry. Real timers will hang the test. Description should specify `jest.useFakeTimers()` + `jest.advanceTimersByTime(5001)`.

### NF-03 (Advisory) — T-0006-018a/b: `__DEV__` toggle mechanism unspecified

In RN Jest, `__DEV__` is `global.__DEV__` set by the preset to `true`. Test 018b needs `global.__DEV__ = false` in setup. Description should specify the toggle pattern.

### NF-04 (Cosmetic) — Three `share` ghost references remain

1. Data Sensitivity table: `host.onShare()` row still listed.
2. §C haptics middleware code example: `case 'share'` branch.
3. Step 9 ACs: parenthetical "if the host emits a synthetic action via callback, we honor it for symmetry."

Type is correct; doc-only.

### NF-05 (Advisory) — Notes for Colby #3 missing `undoBuffer`

Note #3 documents `[haptics, toast, aiBridge, navigate, reducer]`. §C says `[haptics, toast, aiBridge, navigate, undoBuffer, reducer]`. Doc inconsistency.

---

## Roz's Assessment

Rev-1 closed everything that mattered. The P0 items are properly resolved. State model extension for `pendingUndo` is sound. Telemetry insertion-point lock is exactly what I asked for.

NF-01 is the one I'd flag before Step 10 — the hook contract needs to be decided before Colby writes `navigation.ts`. Trivial to fix in the ADR; annoying to retrofit into merged code.

**Step 1 unblocked. NF-01 should resolve before Step 10.**

# QA Report — ADR-0009 Round-2 Test Spec Review

_Reviewed by Roz — 2026-05-07_

## Verdict: APPROVED

All 3 P0 fixes land cleanly. 18 of 18 P1 fixes land. Behavioral pins concrete. Three per-step summary boxes have residual cosmetic drift (totals table is correct at 247). Round-2 changes introduced no new architectural questions.

**Colby can start.**

## P0 Fix Verification

- **T-228 (MoneyField float regression)** — clean. Pins `parseAndCanonicalize("0.10") + parseAndCanonicalize("0.20") === 30` (integer-exact). References `parseAndCanonicalize` by name; Colby creates per §J contract.
- **T-229 (ValidatorResult `toEqual` backward-compat)** — substantially clean. Audit + migrate is implementable. **Note (P2):** "Lock-in" clause is prose, not a self-enforcing assertion. Future `toEqual` on `ValidatorResult` could break silently. Recommend custom ESLint rule in a future pass.
- **T-230 (SearchFilterContext instance-scoping)** — clean. Two `<Renderer>` instances in one Jest test, each with SearchBar writing to same collection key. Cross-user filter bleed risk pinned.

## P1 Fix Verification (18 items spot-checked)

All 18 land cleanly with concrete assertions. Highlights:
- T-243: Divider no-label `accessibilityRole="none"` — both branches in one test.
- T-231/T-232: SearchBar unmount-clears + same-collectionId last-writer-wins behavioral pins.
- T-240: tintColor short-hex THROWS (Cal pinned the behavior, not "throws or returns sentinel").
- T-241: AvatarGroup auto-generated `accessibilityLabel` — exact string asserted.
- T-242: Callout `danger` variant `accessibilityRole="alert"`.
- T-110 reframing: explicit Colby instruction (`.todo` skip with Step-8 cross-ref).
- T-235/T-236: MetricTile sparkline 1-point (horizontal line, not crash) + max-30 boundary.
- T-237: Receipt no-tax/tip math — fills the gap in T-0009-120's implicit assumption.
- T-244: Calendar same-date-tap STAY SELECTED (iOS Reminders/Health behavior).
- T-244a: Heatmap range max boundary closes T-0009-155's missing positive case.
- T-238/T-239: Gallery empty state + null imageField fallback.
- T-191a/T-191b: Timeline + Heatmap split — mismatch visible in test report.
- T-245: receipt_total_mismatch warning content with exact message format.
- T-217: Budget bumped 35,000 → 40,000 chars (12.5% Phase 1.5 headroom).
- T-220: M1 substring-absence + V1 Image substring-presence — concrete strings.

## Per-Step Summary Reconciliation

| Step | Summary box | Actual rows | Status |
|---|---|---|---|
| 1 | 31 | 31 | Clean |
| 2 | 43 | 43 | Clean |
| 3 | 24 | 24 | Total clean; internal Happy/Failure breakdown off by 1 each |
| 4 | 22 | 22 | Clean |
| 5 | 28 | 28 | Clean |
| 6 | 24 | 23 | DRIFT: summary overcounts by 1 |
| 7 | 32 | 31 | DRIFT: Happy=19 claimed vs 18 actual |
| 8 | 22 | 22 | Clean |
| 9 | 8 | 8 | Clean |
| 10 | 16 | 15 | DRIFT: Happy=9 claimed vs 8 actual |

Three summary boxes have total drift (Steps 6, 7, 10). Totals table correct at 247. Drifts are cosmetic; do not affect implementation.

## Total Count Verification

- `grep -c "^| T-0009-"` = 247 (table rows — correct).
- `grep -oE "T-0009-[0-9]+[a-z]?" | sort -u | wc -l` = 248 (off by 1 because T-0009-191 bare appears in description text of T-0009-191a). Cal's claim of 247 is substantively correct; the verification grep needs filter to `^| T-0009-` for an accurate row count.

## Additional Round-2 Issues (cosmetic)

1. **Stale footer prose at line 1723** — claims 228 tests + claims "above ADR-0006's 267" (wrong direction). Should read "247 — within ADR-0006's 267 ballpark."
2. **Step 3 internal category breakdown** — Happy=12 claimed vs 13 actual; Failure=4 claimed vs 5 actual. Total correct.
3. **T-232 implementation hint missing** — assertion of `console.warn` requires `jest.spyOn(console, 'warn')` in the test. Colby will figure out. Worth noting.

## Non-Blocking Carry-Forward

- Non-standard category labels (`Failure (a11y)`, `Happy (warning)`, `Same`, `Regression (a11y)`, `Boundary (perf)`) — present, acceptable.
- date-fns `^3.6.0` caret pin vs project convention exact pin — P2.
- Footer ratio acknowledgement (happy-leaning for compositional work) — defensible.

## Roz's Assessment

Round 1 returned 3 P0 + 21 P1. Cal addressed all of them. New T-IDs are concrete, implementable, gap-closing.

Round-2 introduced three cosmetic summary box drifts and one stale footer sentence. None affect Colby's ability to implement.

T-229's lock-in clause is the one real gap: process instruction, not self-enforcing gate. A future `toEqual` on `ValidatorResult` will break silently. P2 — doesn't block Phase 1.

Spec is implementable. Three cosmetic drifts are document cleanup, not blockers.

**APPROVED.**

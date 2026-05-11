# QA Report — ADR-0009 PR 4 (Step 5 — Productivity domain compounds)

_Reviewed by Roz — 2026-05-11_

## Verdict: REVISE (1 BLOCKING bug + 2 advisory findings)

940/940 tests pass, 157/157 snapshots, typecheck clean. Schemas are correct, strictness verified, NodeRenderer 43→47 with proper length assertion.

| Check | Status | Details |
|---|---|---|
| Type Check | PASS | Both packages clean |
| Lint | PASS | 0 new errors in either package |
| Tests | PASS | Renderer 940/940 + 157 snapshots; Protocol 1060 passed |
| Coverage | PASS | MetricTile 96.7%, Receipt 92.3%, StepList 95.2%, TransactionRow 90.0% |
| Complexity | PASS | All files <300 lines, no function over CCN 10 |
| Security | PASS | No auth/secrets/PII |
| Docs Impact | PASS | gen-docs.ts + generated files regenerated |
| Dependencies | PASS | `react-native-svg` is transitive via lucide; no new direct dep |

## BLOCKING — F1: `Receipt.tsx` `SummaryRow` hardcodes `currency: 'USD'`

`SummaryRow` declares `const currency = 'USD'` internally with a comment "handled by parent." The parent does resolve `node.currency ?? 'USD'` correctly and passes it to `ReceiptItemRow` — but does NOT pass it to `SummaryRow`. The component signature has no `currency` prop.

**Result:** Any Receipt with `currency: 'EUR'`/`'GBP'`/`'JPY'`/etc. renders the line items correctly (with `€`/`£`/`¥`) but renders the Subtotal/Tax/Tip/Total footer rows as USD (`$`). Real bug for any non-USD receipt.

**Fix:** Add `currency: string` (or `Currency`) to `SummaryRow`'s props and pass it at every call site in `ReceiptRenderer` (Roz noted lines 211, 213, 216, 229).

## BLOCKING — F2: T-0009-113 negative-amount color assertion insufficient (explicit Cal pin)

T-0009-112 (positive → success) asserts only `expect(toJSON()).not.toBeNull()`. The productive×focus snapshot indirectly locks in `#0E8345` (success).

T-0009-113 (negative → fg, NOT danger) asserts only that the positive and negative trees differ. The assertion would still pass if Colby changed negative to `danger` (`#C03A2B`) — both colors differ from `#0E8345`. There is no snapshot of the negative-amount node and no explicit assertion that the rendered color is `#14171A` (fg) rather than `#C03A2B` (danger).

This is the explicit ADR Step 5 AC item 2 Cal pin: positive in `success`, negative in `fg` (NOT `danger`). The test must lock that pin against future regressions.

**Fix (one of):**
- Add a snapshot of `NEGATIVE_NODE` at `productive×focus` — would capture `"color": "#14171A"`.
- OR direct assertions: `expect(JSON.stringify(tree)).toContain('#14171A')` AND `expect(JSON.stringify(tree)).not.toContain('#C03A2B')`.

## Advisory — F3: `ReactNativeSvgMock.js` is dead code

Lives at `packages/a2ui-renderer/src/__mocks__/ReactNativeSvgMock.js`. Not named `react-native-svg.js`, so Jest's `__mocks__` auto-mock convention does not apply. Not referenced in `moduleNameMapper` in `jest.config.js`. Not consumed by any test. The actual mock used by `MetricTile.test.tsx` is the inline `jest.mock('react-native-svg', ...)` factory in that file.

Also uses `require('react')` (line 14) — inconsistent with Colby's stated rationale ("inline factory avoids `require()`").

**Fix:** Delete the file. Future developers may think it's being applied globally when it isn't.

## Non-blocking observations

- **T-0009-235 single-point guard**: implementation correct (`computeSparklinePoints` line 83-87 + `Sparkline` line 109-127). Test verifies element type is `Line` not `Polyline`, but doesn't verify y1===y2===midY coordinates. Element-type check meaningful enough for now; midY math is correct by construction.
- **T-0009-236 max-30 boundary**: schema sub-cases (accept 30, reject 31) fully covered. Renderer test verifies no crash + Polyline present but doesn't count coordinate pairs in the `points` attribute. Implementation has no truncation logic, so no bug — just test description overstates assertion strength.
- **T-0009-120 + T-0009-237 receipt-mismatch deferral**: Genuinely deferred to Step 8 `validateCrossRefs`. Test body honestly scoped to renderer no-crash behavior. The file-header comment overstates ("5-cent mismatch produces receipt_total_mismatch") relative to what's asserted — cosmetic; not a correctness issue.

## ADR Step 5 Acceptance Criteria

1. All 4 schemas parse valid + reject invalid — PASS
2. TransactionRow positive→success, negative→fg (NOT danger) — **FAIL** at test-strength level per F2 (renderer code is correct; test doesn't lock the pin)
3. Receipt `receipt_total_mismatch` warning at validate time — deferred to Step 8 (honest)
4. MetricTile sparkline uses `react-native-svg` `<Polyline>` (no Skia) — PASS
5. StepList numbered style connecting vertical rail — PASS
6. StepList checklist style BooleanBinding per step — PASS
7. 4 snapshot tests pass (8 new snapshots) — PASS
8. NodeRenderer 43→47 arms — PASS

## Confirmed passing — Scrutiny items

- T-0009-235 single-point guard: implementation correct
- T-0009-236 schema sub-cases: both tested
- T-0009-237 Receipt no-tax/no-tip: both sub-cases tested at renderer level
- All 4 schemas use `.strict()`
- TransactionRow + StepList inferred shapes match spec
- NodeRenderer 47 arms: length assertion, not string match
- Inline `jest.mock` in MetricTile.test.tsx uses `jest.requireActual`, not `require()` — ESLint clean
- Mock scoped to MetricTile.test.tsx only — 20 pre-existing Icon snapshots unaffected
- `ReceiptItemRow` correctly receives currency — only `SummaryRow` is broken

## Scope creep — None for this PR

In-flight `apps/mobile/src/screens/Run/**` changes are from the concurrent RunScreen Colby. Not this PR's scope.

## Roz's Assessment

One real bug, one explicit Cal-pin test gap, one cleanup. All surgical.

The SummaryRow currency bug is the kind of thing that ships fine in our USD-default tests but breaks for any user with a Receipt in another currency. Three-line fix.

T-0009-113 is the test that prevents a future "$5 charge in red" refactor. The ADR specifically called out the negative→fg-NOT-danger pin; the test must lock it. Either a negative snapshot or two direct string assertions.

**REVISE.** Surgical fix → R2 → Ellis.

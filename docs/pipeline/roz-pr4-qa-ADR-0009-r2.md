# R2 QA Report — ADR-0009 PR 4 (Step 5) Surgical Fix Verification

_Reviewed by Roz — 2026-05-11_

## Verdict: PASS

All three R1 findings closed. 942/942 tests, 158/158 snapshots, typecheck clean.

| Check | Status | Details |
|---|---|---|
| Type Check | PASS | clean |
| Lint | PASS | no new errors in changed files |
| Tests | PASS | 942/942 |
| Snapshots | PASS | 158/158 (was 157 — net +1 for NEGATIVE_NODE) |
| F1 — SummaryRow currency | CLOSED | with one observation (below) |
| F2 — T-0009-113 color pin | CLOSED | snapshot locks `#14171A`, no `#C03A2B` |
| F3 — Mock file cleanup | CLOSED | file removed, 5 sibling mocks remain |
| Scope creep | CLEAN | only F1/F2/F3 prescribed files changed |

## F1 Verification — SummaryRow currency

`SummaryRow` props now destructures `currency: string`. Hardcoded `'USD'` line removed. All 4 call sites in `ReceiptRenderer` pass `currency={currency}` (Subtotal/Tax/Tip/Total).

**T-0009-238 assertion quality:**

Test 1 (`expect(tree).toContain('€')`) — INSUFFICIENT ALONE because the EUR fixture has one item row (Croissant) routed through `ReceiptItemRow`, which was never broken. That row alone contributes `€` to the tree regardless of the `SummaryRow` fix.

Test 2 (`expect(tree).not.toContain('"$')`) — CARRIES THE WEIGHT. Pre-fix `SummaryRow` rendered `$3.50`/`$0.35`/`$0.50`/`$4.35` producing `"$..."` patterns. Item rows render `€3.50` via `ReceiptItemRow` — never produce `"$`. So any `"$` in the tree was attributable exclusively to `SummaryRow`. This assertion is the actual regression lock.

The isolation argument holds. F1 is genuinely closed. **Observation (non-blocking):** Test 1's description overclaims ("covers Subtotal, Tax, Tip, and Total rows") given the item row also emits `€`. Cosmetic — the locking is real via Test 2.

## F2 Verification — T-0009-113 negative-amount color

`TransactionRow.test.tsx.snap` contains new snapshot keyed `negative amount color (T-0009-113) ... locks fg (#14171A), not danger (#C03A2B)`. Snapshot content at the amount Text node has `"color": "#14171A"`. `#C03A2B` absent from the snapshot.

Regression lock: if anyone changes negative amount color to `danger`, the snapshot fails. ADR Step 5 AC item 2 Cal pin now genuinely locked.

T-0009-113 has two `it` blocks now (one redundant non-null check + the snapshot test). Snapshot is what matters; redundant block is harmless.

## F3 Verification — Dead file deleted

`packages/a2ui-renderer/src/__mocks__/ReactNativeSvgMock.js` removed. Directory retains 5 sibling mocks (AnimatedObject, EventEmitter, ExpoHaptics, NativeAnimatedHelper, ReactNativeReanimated). 942/942 confirms no test broken by removal.

## Scope Creep — Clean

Only the prescribed files changed for this surgical fix:
- `packages/a2ui-renderer/src/v0/components/compound/Receipt.tsx`
- `packages/a2ui-renderer/src/v0/components/compound/Receipt.test.tsx`
- `packages/a2ui-renderer/src/v0/components/compound/TransactionRow.test.tsx`
- `packages/a2ui-renderer/src/v0/components/compound/__snapshots__/TransactionRow.test.tsx.snap`
- `packages/a2ui-renderer/src/__mocks__/ReactNativeSvgMock.js` (deleted)

Other working-tree changes (`apps/mobile/src/screens/Run/**`, coachmark files, etc.) are from the concurrent RunScreen workstream — not this PR's scope.

## Roz's R2 Assessment

All three R1 findings closed. F2's snapshot is the mechanically critical pin and it is correctly captured. F1's `not.toContain('"$')` assertion isolates the SummaryRow regression despite Test 1 being weaker than its description claims.

**PASS. Ellis can commit.**

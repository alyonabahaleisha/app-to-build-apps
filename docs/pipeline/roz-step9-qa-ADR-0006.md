# QA Report — ADR-0006 Step 9 (Actions tier + feedback middleware)

_Reviewed by Roz — 2026-05-07_

## Verdict: FAIL

Three blocking findings. One Cal-amendment finding (FAB disabled). Several non-blocking notes.

| Check | Status |
|---|---|
| Type Check | PASS |
| Lint | PASS — 0 errors |
| Tests (V0) | PASS — 500/500 |
| Tests (Legacy) | PASS — 211/211 |
| Security | PASS |
| useEffect ban | PASS |
| NodeRenderer 28-arm | PASS |
| Scope creep | PASS |
| T-0006-155 (Button haptic) | **FAIL** — haptic half unasserted |
| T-0006-159 (FAB reduced-motion haptic) | **FAIL** — "haptics still fire" unasserted |
| T-0006-160 (unknown verb logging) | **FAIL** — implementation silent, test override |
| `(node as any).disabled` cast | ACCEPT (Option A — schema gap, Cal amends FabSchema) |
| `Alert.alert` in middleware | ACCEPT — imperative SDK call, not §K violation |
| feedback chain position | ACCEPT — sound reasoning |

---

## Blocking Findings

### Finding 1 (BLOCKING) — T-0006-155: haptic half unasserted

**File:** `Button.test.tsx:218-229`

ADR: "Button press fires light haptic, then dispatches action."
Test asserts only dispatch. `expo-haptics` not mocked. If haptics middleware were disconnected, test would still pass.

**Fix:** Mock `expo-haptics` in `jestSetup.js`. Assert `Haptics.impactAsync(Light)` was called for `addItem` action.

### Finding 2 (BLOCKING) — T-0006-159: "haptics still fire" with reduced-motion unasserted

**File:** `FAB.test.tsx:147-172`

ADR: "Reduced-motion: animations collapse to instant; **haptics still fire**."
Tests assert reduced-motion render + dispatch. Zero haptic assertions. Reduced-motion branch could silently suppress haptics and tests would pass.

**Fix:** Same expo-haptics mock + assertion that `Haptics.impactAsync` fires when reduced-motion is active.

### Finding 3 (BLOCKING) — T-0006-160: spec/test mismatch + tautological assertion

**File:** `feedback.test.ts:173-190`

ADR: "Action with no handler in feedback middleware logs warning, dispatches anyway."
Implementation: silent fall-through, no `console.warn`, no logger. Test comment overrides spec: "passes through without crashing or warning."
Assertion only checks `next` was called.

**Resolution paths:**
- **Path A (recommended):** Add `logger.warn(...)` in feedback.ts unknown-verb path. Add spy assertion. Faithful to spec.
- **Path B:** Cal amends T-0006-160 to remove "logs warning."

### Finding 5 (BLOCKING) — Step 2 haptics.ts gap + misleading feedback.ts comment

**Files:**
- `feedback.ts:20` claims `reset → Light haptic (haptics middleware)`
- `haptics.ts` has no case for `reset` OR `updateItem`
- UX doc line 1554: `reset → Light haptic`

Three-way conflict. Pre-existing Step 2 gap, but Colby's Step 9 comment actively misrepresents reality.

**Fix:**
1. `haptics.ts` add cases: `reset → Light` and `updateItem → Light` (faithful to UX doc).
2. Update `haptics.test.ts` for both new cases.
3. Verify `feedback.ts:20` comment matches reality.

---

## Acceptance Rulings (Non-Blocking)

### `(node as any).disabled` cast — Option A

`FabSchema` (protocol/components/actions.ts:37-46) doesn't define `disabled`. UX doc line 1542 explicitly lists "disabled (50% opacity + flat elevation)" as a state. T-0006-161g is valid (MT-07 label).

**Verdict: schema gap, not design choice.** Accept the cast as temporary.

**Cal task:** Add `disabled: BooleanBindingSchema.optional()` to `FabSchema`. Then Colby replaces cast with `useBinding<boolean>()` matching Button pattern (and properly handling slot bindings, not just literal).

### `Alert.alert` in middleware — ACCEPT

§K covers useEffect, not middleware purity. `Alert.alert` is an imperative React Native SDK call, comparable to `Haptics.impactAsync()` (already used in haptics middleware). Test mocks `Alert.alert` via spyOn. Architecturally sound.

### feedback chain position — ACCEPT

Order: `[haptics, toast, aiBridge, navigate, undoBuffer, feedback, reducer]`. Position 6 (after undoBuffer, before reducer) lets undoBuffer capture row data on `removeItem` first, then feedback intercepts `clearCollection` before reducer runs. Sound.

**Cal task:** Update ADR §C (line 1520) to include `feedback` in canonical chain.

---

## Non-Blocking Notes

### Finding 7 — Middleware composition canonical-order docs

ADR §C says `[haptics, toast, aiBridge, navigate, undoBuffer, reducer]` — predates feedback. Cal updates docs.

### Finding 8 — `sm` Button hit target 32pt below 44pt accessibility floor

UX doc lists 32pt for sm explicitly; ADR T-0006-153 confirms. Internally consistent. Sable should confirm intentional given iOS accessibility minimums.

### Finding 9 — Test count mismatch vs Colby's claims

Colby claimed 28+17+11. Actual: 20+16+20. Tests pass; overclaim should be corrected in handoff notes.

---

## Required Fixes for Round 2

1. **Mock `expo-haptics`** in `jestSetup.js` (or per-test) so haptic assertions are testable.
2. **T-0006-155** add Light haptic assertion for Button addItem press.
3. **T-0006-159** add haptic-fires assertion when reduced-motion is active for FAB.
4. **T-0006-160** Path A: `logger.warn` for unknown verb in feedback.ts + spy assertion. (Path B requires Cal amendment, slower.)
5. **haptics.ts** add `reset` and `updateItem` cases (UX doc line 1554 contract).
6. **`feedback.ts:20`** comment must match reality after fix #5.

After fixes land, scoped re-run: typecheck, both test suites, lint.

## Cal Tasks (Non-Gating)

1. ADR §C: add `feedback` to canonical chain.
2. `FabSchema`: add `disabled` field.
3. Carry-forward Cal tasks: §State Model binding (Step 5), useReducedMotion §K (Step 3), DateField/Picker stub (Step 6), FlashList v1→v2 §L (Step 7), queueMicrotask §K (Step 8), T-0006-144/145 amendment (Step 8).

---

## Roz's Assessment

Three blocking issues. T-155 and T-159 are the same root problem — haptic assertions missing because expo-haptics isn't mocked. T-160 is Colby overriding the ADR in a test comment without amendment process. Finding 5 is a documentation bug compounding a Step 2 gap.

The `(node as any)` cast gets Option A — schema gap, not design mistake. The `Alert.alert` middleware question isn't a §K violation. The feedback chain position is correct.

Step 10 (Milestone B) cannot start in this state.

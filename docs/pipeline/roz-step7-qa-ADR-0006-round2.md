# QA Report — ADR-0006 Step 7 Round 2 (Surgical Fix)

_Reviewed by Roz — 2026-05-07_

## Verdict: FAIL

FlashList v2 pivot verified correct. estimatedItemSize gating issue resolved. But Fix 4 (reduced-motion test) is structurally broken AND `List.tsx` reduced-motion branches remain uncovered.

| Check | Status |
|---|---|
| Type Check | PASS |
| Lint | PASS — 0 errors |
| Tests (V0) | PASS — 383/383 |
| Tests (Legacy) | PASS — 211/211 |
| FlashList v2 pivot | PASS — `estimatedItemSize` confirmed absent in v2.3.1 |
| Container `minHeight` correct | PASS — applies via `ITEM_LAYOUT_HEIGHT[itemLayout]` |
| T-0006-124 load-bearing | PASS — direct prop assertion verified |
| Fix 4 (T-0006-123 reduced-motion in LoadingState) | **FAIL** — `jest.mock` inside `beforeEach` is a no-op |
| `List.tsx` reduced-motion branch | **FAIL** — animation-suppression branches uncovered (new finding) |

---

## Findings

### Finding 1 (BLOCKING) — `jest.mock` inside `beforeEach` is a Babel hoist no-op

**File:** `LoadingState.test.tsx` lines 167-188

```js
describe('LoadingStateRenderer reduced-motion branch (T-0006-123)', () => {
  beforeEach(() => {
    jest.mock('../../a11y/useReducedMotion', () => ({useReducedMotion: () => true}))
  })
  afterEach(() => {
    jest.unmock('../../a11y/useReducedMotion')
  })
  it('renders the correct number of rows in reduced-motion mode', () => { ... })
})
```

`jest.mock` is a Babel transform hoisted to file scope at parse time. Calling it at runtime inside `beforeEach` does nothing. The mock never activates. `useReducedMotion` returns `false` throughout this test like every other test in the file. The assertion (`tree.children?.length === 3`) passes regardless of motion state because row count is controlled by `node.lines`, not by `reducedMotion`. The `!reducedMotion` branch in `ShimmerBlock` is not exercised.

**Correct fix:** move `jest.mock` to file scope (top of file). For per-test variation, use `jest.spyOn` with `mockReturnValue(true)` or refactor `ShimmerBlock` to accept `reducedMotion` as a prop.

### Finding 2 (BLOCKING — new in round 2) — `List.tsx` reduced-motion branches uncovered

**File:** `List.tsx` lines 147-149

```ts
const enteringAnim = reducedMotion ? undefined : FadeIn.duration(200)
const exitingAnim  = reducedMotion ? undefined : FadeOut.duration(200)
const layoutAnim   = reducedMotion ? undefined : LinearTransition.duration(200)
```

No test in `List.test.tsx` mocks `useReducedMotion` to return `true` to verify these become `undefined`. Round 1's Finding 3 was about LoadingState only; this gap was not flagged at round 1, but it was implied by the ADR's reduced-motion AC and is the more important branch (List is the primary consumer).

**Correct fix:** file-scope `jest.mock('../../a11y/useReducedMotion', ...)` in `List.test.tsx` + per-test `jest.spyOn().mockReturnValue(true)`. Verify `entering`, `exiting`, `layout` props on `Animated.View` are `undefined`.

---

## Roz's Assessment

The FlashList v2 pivot is correct. estimatedItemSize gating issue resolved cleanly. T-0006-124 is now load-bearing.

But two reduced-motion branches lack test coverage:
1. The LoadingState shimmer test claims to verify it but uses a broken mock pattern.
2. The List.tsx animation-suppression branches were never tested in round 1 or round 2.

383 tests pass; two of them aren't testing what they claim. The accessibility regression risk is real — animation reaches users with reduced motion enabled, in violation of WCAG/iOS guidelines.

**Required for round 3:**
- Move `jest.mock` to file scope in `LoadingState.test.tsx`.
- Add file-scope mock + reduced-motion tests for `List.test.tsx` covering `entering`/`exiting`/`layout` undefined when reduced motion is on.

Alternatively: revert Fix 4 entirely, mark T-0006-123 + new List.tsx branch as known-uncovered, defer to Step 11 cleanup pass with explicit doc note. This would be a `PASS WITH NOTES` outcome.

Either option requires user direction.

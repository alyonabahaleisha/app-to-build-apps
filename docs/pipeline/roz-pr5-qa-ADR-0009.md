# QA Report — ADR-0009 PR 5 (Step 6 — Date components: Calendar + Heatmap)

_Reviewed by Roz — 2026-05-12_

## Verdict: REVISE (2 BLOCKING + advisory findings)

987 tests pass overall but 4 a2ui-renderer tests **FAIL** under current execution. Real-clock date-rot + a factual error about RN's `grid` a11y role.

| Check | Status | Details |
|---|---|---|
| Type Check (protocol) | PASS | clean |
| Type Check (a2ui-renderer) | PASS | clean |
| Lint | PASS | 0 errors in PR's files; pre-existing warnings unrelated |
| Tests (protocol) | PASS | 1083 + 12 todo |
| Tests (a2ui-renderer) | **FAIL** | 982 passed, **4 failed**, 1 todo, 162 snapshots (4 stale) |
| Coverage | NOTE | Calendar 90.9%/75%, Heatmap 93.1%/87.5% |
| Complexity | PASS | |
| Security | PASS | |
| Dependencies | PASS | `date-fns@^3.6.0` MIT, tree-shaken correctly |

## BLOCKING — Issue 1: T-0009-153 Heatmap snapshots are stale (date-rot)

`packages/a2ui-renderer/src/v0/components/compound/__snapshots__/Heatmap.test.tsx.snap`. Snapshot recorded May 11, 2026 with hardcoded date strings (`"May 11, 2026: 0 items"`, `"0 items on May 11, 2026"`) and `borderWidth: 1`/accent borderColor on the May 11 cell. Running on May 12, implementation renders May 12 as today — produces `borderWidth: 0` on what the snapshot expects to be the today-cell, plus a new May 12 cell entry. Both T-0009-153 snapshots fail.

**Root cause:** `HeatmapRenderer` calls `const today = new Date()` with no date injection or Jest fake-timer setup. Snapshot encodes today's real date at record time — fails every day after commit.

**Fix:** Heatmap renderer must accept an injectable `nowOverride?: Date` prop (or equivalent test seam). Both T-0009-153 tests must use `jest.useFakeTimers()` + `jest.setSystemTime(new Date('2026-01-15'))` or the `nowOverride` prop with a fixed date so the snapshot is stable. Re-record after fix.

Timeline snapshot failures (T-0009-107, "130d ago" → "131d ago") are pre-existing Step 5 drift — not this PR.

## BLOCKING — Issue 2: T-0009-145 `accessibilityRole="list"` deviation incorrect

`packages/a2ui-renderer/src/v0/components/compound/Calendar.tsx:171`. Implementation uses `accessibilityRole="list"`. Test at `Calendar.test.tsx:342` asserts `'list'` with a comment claiming **React Native does not support `'grid'`** — that is **factually wrong**. React Native's `AccessibilityRole` type at `node_modules/react-native/Libraries/Components/View/ViewAccessibility.js:48,79` includes `'grid'` explicitly.

ADR T-0009-145 spec: `Calendar grid uses accessibilityRole="grid"`. Implementation deviates without valid technical reason; test was written to match the wrong implementation rather than the spec.

**Fix:** Change `accessibilityRole="list"` → `accessibilityRole="grid"` on Calendar container View (line 171). Update T-0009-145 assertion to `toBe('grid')` and remove incorrect comment.

## Non-blocking findings

**Finding 3 — T-0009-148 renderer sub-test tautological with misleading title.** `Heatmap.test.tsx:139-155`. Titled "renderer shows 5 distinct intensity levels for fixture with 6 known counts" but the fixture has only one date with count=2 (rest 0). Test body asserts only `toJSON() !== null`. Real T-0009-148 work is in the `computeQuintileThresholds`/`countToLevel` unit tests above (lines 83-137) — those are solid. Rename this sub-test to reflect what it actually tests, OR expand to assert distinct opacity/backgroundColor values in the tree.

**Finding 4 — T-0009-150 today's-border latent flakiness.** Uses `new Date().toISOString().slice(0,10)` (UTC) for seed; renderer uses `new Date()` for today. In negative-UTC-offset zones near midnight, the cells diverge. Fix Issue 1's fake-timer approach naturally addresses this too.

**Finding 5 — T-0009-151 substring assertion weak.** Second test asserts `expect(tree).toContain('item')` — matches every cell's a11y label (`"0 items"`, `"1 item"`). First test (`'"cellInfo"'` + `'"accessibilityActions"'`) is meaningful; second is tautological given the first passes. Acceptable but noted.

**Finding 6 — T-0009-144 fix correctly scoped.** `{includeHiddenElements: true}` only on the decorative dot query. Accent dot has `accessibilityElementsHidden` (correct a11y). No concerns.

**Finding 7 — T-0009-137 `.todo` properly formed.** `it.todo(...)`, not `.skip`. References "Step 9 bundle analysis." The single todo in 987 count accounted for.

**Finding 8 — `.optional()` vs ADR's `.default()` on CalendarSchema fields.** ADR specifies `.default('month')` etc; impl uses `.optional()` with defaults applied at render time. Documented in schema comment as ZodEffects vs ZodObject compatibility with `z.discriminatedUnion`. Acceptable documented deviation.

## Scope creep (noted, not blocking)

`apps/mobile/src/screens/Run/` untracked working-tree changes — concurrent RunScreen workstream. Not this PR's diff.

## Roz's Assessment

Two surgical fixes required:

1. **Inject a stable date into HeatmapRenderer.** Snapshots that fail on day N+1 are worse than no snapshots — they train people to rubber-stamp failures.

2. **Correct `accessibilityRole` to `"grid"`.** Implementation deviation justified by a false premise. The comment "RN doesn't support grid" is factually wrong. RN has supported `'grid'` since long before this codebase existed. Test was written to paper over an impl bug — that's the anti-pattern.

Finding 3 also worth addressing during the fix pass — misleading test title.

**REVISE.** Surgical fix → R2 → Ellis.

# QA Report — ADR-0006 Step 12 (Snapshot Matrix + Viewport Boundary)

_Reviewed by Roz — 2026-05-07_

## Verdict: PASS WITH NOTES

Matrix complete, viewport test load-bearing, sweep items applied.

| Check | Status |
|---|---|
| Type Check | PASS |
| Lint | PASS — 0 errors, 66 pre-existing warnings |
| Tests (legacy) | PASS — 211/211 |
| Tests (V0 RN) | PASS — 611/611 |
| Tests (mobile) | PASS — 185/185 |
| Matrix completeness | PASS — exactly 56 entries, T-0006-180..235 contiguous |
| Viewport test (T-0006-178) | PASS — load-bearing |
| Stability assertion (T-0006-236) | PASS — 4 real invariants |
| Snapshot policy doc | PASS — 2-of-12 sampling rationale documented |
| CI workflow | PASS — valid YAML, correct script reference, correct path guards |
| Sweep items | PASS — JSDoc + .env cleaned |
| Cleanup deferrals | PASS — Reanimated mock + ShimmerBlock not touched (correct) |

---

## Matrix Completeness

`grep -c 'exports\[' snapshot-matrix.test.tsx.snap` = **56**. T-0006-180..235 sorted, contiguous, no duplicates. T-180..207 productive×focus (28 entries); T-208..235 expressive×health (28 entries). Every component represented exactly once per register.

## T-0006-178 Viewport (Load-Bearing)

`collectWidths` recursively walks `toJSON()` tree, collects numeric `style.width`/`style.minWidth`. A hardcoded `width: 400` would produce `overflowingWidths = [400]` and fail. Outer wrapper at exactly 320 doesn't trigger false positive (strict `>` filter).

## T-0006-236 Stability

Four real invariants:
1. `MATRIX_ENTRIES.length === 56` — adding/removing components fails CI.
2. Productive×focus count === 28, palette enum correct.
3. Expressive×health count === 28, palette enum correct.
4. T-IDs unique, contiguous 180..235.

None tautological.

## Observation (Non-Gating)

T-0006-230 (ConditionalSection/expressive×health) snapshot renders `null` because fixture uses `showWhen: 'whenEmpty'` against non-empty collection. Semantically correct but no visual diff surface. Productive×focus entry (T-202) provides actual diff coverage. Acceptable for V0; worth noting for week-5 polish review.

## Snapshot Policy Doc

`packages/a2ui-renderer/test/snapshot-policy.md` documents 2-of-12 register sampling rationale (max stance×typography variation). Other 10 register pairs are explicit polish-review gap, not CI coverage.

## CI Workflow

Valid YAML. Path triggers cover renderer src + jest config + protocol src + design-system src. Correct test script reference. Polish doc directory excluded (intentional).

## Sweep Items

- `Renderer.tsx:29` JSDoc: now reads "The `__V0_Renderer` shim alias was removed at Step 11 cutover." Step 11 concern resolved.
- `apps/mobile/.env`: `EXPO_PUBLIC_CANVAS_V0_DEMO` absent.

## Roz's Assessment

Everything that should be here is here. 56 snapshots, T-IDs contiguous, viewport test load-bearing, stability assertions real. Only flag is T-0006-230 producing a `null` snapshot — semantically correct but thin for diff coverage. One sentence in the policy doc would acknowledge this.

**Step 12 closes cleanly. Step 13 unblocked.**

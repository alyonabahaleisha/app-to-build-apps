# QA Report R2 — ADR-0009 PR 3 Step 4 (Surgical Fix Verification)

_Reviewed by Roz — 2026-05-10_

## Verdict: REVISE → CLOSED (P1-A fixed in orchestrator pass)

Three of four R1 findings closed by Colby. P1-A (codegen drift) was NOT closed by Colby (4th repeat of this pattern). Orchestrator ran codegen + verified 43 union members + 3 generated files now staged for Ellis commit.

## R1 Finding Closure

| Finding | Status | Notes |
|---|---|---|
| P1-A (codegen stale) | **CLOSED in orchestrator pass** | `pnpm --filter @app-creator/protocol codegen` ran; `generated/types.ts` 43 union members verified; 3 files regenerated and ready for commit |
| P1-B (Carousel §K Path B) | CLOSED | Cal: ADR-0006 §K row #6 added, counts updated (5→6, 6th→7th); ADR-0009 line 67 amended. Colby: eslint.config.mjs ignores updated; Carousel.tsx inline disable removed; comment cites §K #6 |
| P2-A (GridList useSearchFilter) | CLOSED | Import path correct, hook called with `node.collectionId`, filter applied before rowEntries construction, empty query bypasses filter; 3 T-0009-A-GL integration tests with FilterController + rerender |
| P2-B (T-0009-091 + collapse threshold) | CLOSED | `NARROW_WIDTH_COLLAPSE_PT = 380` (Path 1 spec compliance); 3 concrete tests with `Dimensions.set` + cell-width arithmetic asserting threshold semantics |
| A1 (autoplay assertion loose) | UNCHANGED — advisory only | Optional improvement for next iteration |

## Codegen Drift — Investigation

Root cause: Colby ran codegen during his fix pass but did not stage the output files. The committed types.ts had 39 union members on disk; only after orchestrator re-ran codegen did the file reflect 43. T-0005-180 byte-stability test passes against stale on-disk output, confirming false-positive vector.

**Fix applied in orchestrator pass:**
- `pnpm --filter @app-creator/protocol codegen` → "4 files written"
- `grep -c "^  | {id: string; type:" packages/protocol/generated/types.ts` → 43 ✓
- 3 files staged: `generated/{types.ts, docs.md, json-schema.json}`

**Process recommendation (for next sprint, NOT blocking this PR):** Add CI gate that runs `pnpm --filter @app-creator/protocol codegen` followed by `git diff --exit-code packages/protocol/generated/`. Would catch this pattern at PR-creation time rather than R2 review. Same pattern as the build-time lockfile-drift check.

## Verified Closed Items (R2 Re-Run)

- **ADR-0006 §K:** Row #6 at line 553 (Carousel autoplay setInterval, complete justification, mount/unmount cleanup, reduced-motion gating); line 542 "Adding a 7th exception requires..."; line 555 "...reflects these 6 exceptions"
- **ADR-0009 line 67:** "Phase 1 introduces ONE new §K exception: Carousel autoplay setInterval..."; zero surviving "NO new §K exceptions"
- **eslint.config.mjs:** Line 75 adds Carousel.tsx to ignores; comment block citing §K #6 with count 6
- **Carousel.tsx:** No `eslint-disable` directives; ADR-0006 §K #6 comment at lines 136-139
- **GridList.tsx:** `useSearchFilter` imported from `../../state/SearchFilterContext.js` (line 36); called as `useSearchFilter(node.collectionId)` (line 115); filter applied to `allRowEntries` before rowEntries construction (lines 165-168); rowMatchesQuery imported from `./List.js` (line 37); List.tsx exports `rowMatchesQuery` (line 167)
- **T-0009-091:** No longer tautological; 3 concrete dimension-mocked tests; boundary `windowWidth < 380` (strict, not ≤)
- **T-0009-A-GL:** 3 search-filter integration tests; FilterController + rerender pattern mirrors SearchBar.test.tsx; specific named-text assertions

## Tests

- protocol: 1015 passed + 12 todo (no regression)
- renderer: 881 passed, 149 snapshots (no regression)
- typecheck: all 6 workspaces clean

## Roz's R2 Assessment (post-orchestrator-fix)

Three of four R1 findings closed cleanly by Cal + Colby. The §K amendment is textbook: ADR-0006, ADR-0009, eslint.config, source file all updated in concert. GridList search-filter integration correct + concrete. Collapse-threshold rewrite no longer a tautology.

P1-A codegen drift fixed by orchestrator pass — 30-second mechanical operation that should be CI-enforced going forward.

**Ellis can commit.** Adding CI codegen-drift gate as separate follow-up backlog item.

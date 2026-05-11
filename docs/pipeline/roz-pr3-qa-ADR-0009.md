# QA Report — ADR-0009 PR 3 Step 4 (Lists & Data Tier)

_Reviewed by Roz — 2026-05-10_

## Verdict: REVISE (2 P1 + 2 P2 + 1 advisory)

The schema work is correct. CarouselBaseSchema/CarouselSchema split is the right answer to ZodEffects/discriminatedUnion incompatibility. superRefine mutually-exclusive guard works. ErrorState clean. Timeline groupBy month-header rendering correct. NodeRenderer 43 arms verified. Snapshot delta 141 → 149 as required.

Three issues didn't make it across the line.

## P1-A: Generated files stale — codegen not run before commit

Running `pnpm --filter @app-creator/protocol codegen` produces a 3-file diff. `generated/{types.ts, docs.md, json-schema.json}` all missing the 4 new Step 4 entries. `gen-types.ts` source is correct; committed output isn't.

**THIRD occurrence of this exact pattern** (PR 1 caught it, PR 2 clean, PR 3 regressed). T-0005-180 byte-stability passes against stale-on-disk output. Process discipline issue — needs pre-commit hook or CI gate.

**Fix:** Run `pnpm --filter @app-creator/protocol codegen`; commit all 3 regenerated files.

## P1-B: Carousel useEffect — ADR-0009 Phase 1 invariant violated, ADR-0006 §K not amended

`packages/a2ui-renderer/src/v0/components/lists/Carousel.tsx:143` uses `useEffect` for `setInterval` autoplay. Two violations:

1. **ADR-0009 lines 66-67:** "No useEffect outside the §K-approved exceptions (ADR-0006). Phase 1 introduces NO new §K exceptions." Carousel autoplay = 6th exception.
2. **ADR-0006 §K closing line:** "Adding to the list without a §K amendment is forbidden."

Colby used inline `// eslint-disable-next-line no-restricted-syntax` rather than updating `eslint.config.mjs` ignores list. Different (more opaque) bypass than PR 2's SearchBar pattern.

The rationale at lines 136-141 ("imperative side-effect with no synchronous equivalent") is technically sound. setInterval genuinely requires a timer with mount/unmount cleanup. **Path B (formal §K amendment) is the right architectural answer.**

**Fix path chosen: Path B — formal §K amendment.**

1. Amend ADR-0006 §K table with row #6 (Carousel autoplay)
2. Update ADR-0006 §K closing line "5 exceptions" → "6 exceptions"
3. Amend ADR-0009 line 67: "Phase 1 introduces NO new §K exceptions" → "Phase 1 introduces ONE new §K exception: Carousel autoplay setInterval (exception #6 in ADR-0006 §K)"
4. Update `eslint.config.mjs` ignores block to add `packages/a2ui-renderer/src/v0/components/lists/Carousel.tsx`
5. Remove the inline `// eslint-disable-next-line` from Carousel.tsx (no longer needed once file is in ignores)

## P2-A: GridList does not consume useSearchFilter

ADR-0009 Step 4 deliverables (line 847): "List.tsx — modify to consume useSearchFilter (this also affects GridList + Gallery)." ADR-0009 line 1837: "Don't forget to update GridList (Step 4) and Gallery (Step 7)."

`List.tsx` correctly integrates. `GridList.tsx` does NOT import or call `useSearchFilter`. A SearchBar with `boundCollectionId` bound to a GridList collection filters the List but not the GridList — behavioral inconsistency.

**Fix:** Add `useSearchFilter` import from `../../state/SearchFilterContext.js`; call `useSearchFilter(node.collectionId)`; apply same `rowMatchesQuery` filter as `List.tsx` before building `rowEntries`.

## P2-B: T-0009-091 untested + collapse threshold mismatch

Two issues:

1. **Test is tautological** — only asserts `getByTestId('gridlist-container')` with no `useWindowDimensions` mock. Collapse logic at line 112 untested.
2. **Threshold mismatch** — ADR/UX spec says "collapse when device width < 380pt". Implementation: `windowWidth < MIN_CELL_WIDTH_PT * requestedColumns` = `< 150 × 3 = 450pt` for 3-column.

**Fix:** Decide one threshold semantics (single fixed 380pt OR formula-based 150pt × N). If formula-based intentional, update ADR/UX to match. Either way: add test that mocks `useWindowDimensions({width: 375})` and asserts `numColumns === 2`.

## Advisory A1: T-0009-096 autoplay assertion loose

`Carousel.test.tsx:135-152` advances timer 4000ms then asserts `getByTestId('carousel-container')` truthy. Proves component survives tick, not that `currentIndex` advanced. Stronger assertion: query fraction-indicator text before/after (`"1 / 3" → "2 / 3"`) or inspect dot color state. Advisory only.

## Acceptance Verified

- 43 Node union members in spec.zod.ts ✓
- 4 new schemas in lists.ts ✓
- CarouselBaseSchema/CarouselSchema split correct ✓
- gen-types.ts NODE_TYPE +4 ✓ (but generated files stale — P1-A)
- gen-docs.ts 43/76 counts updated ✓ (but generated files stale — P1-A)
- NodeRenderer 43 dispatch arms ✓
- T-0009-109 boundary test: clean, all 43 arms enumerated ✓
- Snapshot delta +8 (141 → 149) ✓
- Lint clean (0 errors; 4 pre-existing warnings acceptable)
- Typecheck clean

## Tests

- protocol: 1015 passed + 12 todo
- renderer: 876 passed, 149 snapshots
- T-0005-180 byte-stability: passes (against stale on-disk output — false-positive vector)

## Documentation Update Required: YES

- `packages/protocol/generated/types.ts` — regenerate
- `packages/protocol/generated/docs.md` — regenerate
- `packages/protocol/generated/json-schema.json` — regenerate
- `docs/adrs/ADR-0006-canvas-v0-renderer.md` §K — add row #6, count 5→6
- `docs/adrs/ADR-0009-v1-catalog-expansion-phase1.md` line 67 — amend invariant
- `eslint.config.mjs` — add Carousel.tsx to ignores
- `Carousel.tsx` — remove inline eslint-disable

## Roz's Assessment

Process discipline: codegen-not-run is the third repeat. Needs CI gate.

§K exception: the comment at Carousel.tsx:136-141 acknowledges the process but doesn't complete it. The rationale is sound; the documentation isn't. Path B (formal amendment) is the right call.

GridList useSearchFilter: ADR called it out twice. Forgotten. Functional gap.

**Verdict: REVISE.** 2 P1s must resolve. 2 P2s must resolve. Advisory optional.

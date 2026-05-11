# QA Report — ADR-0009 PR 2 (Step 2 — Inputs tier expansion + SearchFilterContext + CurrencySchema)

_Reviewed by Roz — 2026-05-10_

## Verdict: REVISE (1 P1)

The inputs tier expansion is technically solid. MoneyField cents canonicalization is correct and gated. CurrencySchema is exactly the 7-value closed enum the spec requires. SearchFilterContext scoping is correctly per-Renderer-instance via `useRef`, not a module-level singleton — the most consequential architectural risk in PR 2, and Colby got it right. The List filter integration is clean. All 39 NodeRenderer arms present. Codegen drift zero. The PR 1 P1 (gen-types.ts stale) is NOT repeated.

One P1 blocks commit. Fix is mechanical: amend ADR-0006 §K with the 5th exception row.

| Check | Status | Details |
|---|---|---|
| Type Check | PASS | protocol + design-system + renderer all clean |
| Lint | PASS | 0 errors, 4 pre-existing warnings |
| Tests | PASS | 974 protocol (+11 todo), 252 design-system, 825 renderer |
| Coverage | N/A | No threshold for PR scope |
| Complexity | PASS | No function >CCN 10; no file >300 lines in new files |
| DB Migrations | N/A | No schema changes |
| Security | PASS | No secrets, no injection vectors, no PII in logs |
| CI/CD Compat | N/A | No auth/RBAC/env/middleware changes |
| Docs Impact | **FAIL (P1)** | ADR-0006 §K not amended for 5th useEffect exception |
| Dependencies | PASS | No new deps in this PR (date-fns + expo-document-picker correctly deferred to Steps 6+7) |

## P1 — ADR-0006 §K not amended for SearchBar useEffect exception

**File:** `docs/adrs/ADR-0006-canvas-v0-renderer.md` lines 542-554

ADR-0006 §K states explicitly: "Each exception is a documented architectural decision. Adding a 5th exception requires a new amendment to this section." and "The ESLint rule's ignores list reflects these 4 exceptions. Adding to the list without a §K amendment is forbidden."

Colby added SearchBar to the ESLint ignores list in `eslint.config.mjs` (correctly, with rationale in the comment block) but did NOT add a 5th row to the §K exception table. The ADR table still shows 4 rows. The closing line still reads "The ESLint rule's `ignores` list reflects these 4 exceptions."

The eslint config is downstream of the ADR; the ADR is the authoritative spec for §K exceptions. The two documents now contradict each other.

**Fix:** Add row #5 to the §K table:

| # | Surface | Exempted path | Justification | Amendment landed |
|---|---|---|---|---|
| 5 | SearchBar SearchFilterContext write + cleanup on unmount | `src/v0/components/inputs/SearchBar.tsx` | `useEffect` cleanup (`return () => {...}`) is the only correct mechanism for unmount-time Map entry removal in React. No synchronous alternative for unmount-time work (same justification as nav/ exception #4). The effect writes the query to the Map on mount/update and clears it on unmount — necessary for the SearchFilterContext contract (T-0009-231). | ADR-0009 Step 2 (this PR) |

Update closing sentence from "4 exceptions" → "5 exceptions."

## Advisories (non-gating but fold in while Colby is in the files)

### A1 — SearchBar useEffect cleanup comment misleads

**File:** `packages/a2ui-renderer/src/v0/components/inputs/SearchBar.tsx:57-61`

Comment reads: "Cleanup: clear filter on unmount." In React, `useEffect` cleanup fires on every effect re-run (i.e., on every query change), not only on unmount. On each keystroke: (1) previous effect's cleanup clears the filter, (2) the new effect body immediately sets the new filter — functionally correct, but the comment misrepresents the lifecycle.

Suggested: "Cleanup: called on each query change (before the next effect run) and on unmount. The clear-then-set within a single render cycle is intentional — List consumers re-read the Map synchronously after the set."

### A2 — `codegen.test.ts` enum coverage list missing `Currency`

**File:** `packages/protocol/scripts/codegen.test.ts:141-148`

The `enumTypes` array in T-0005-182 does not include `Currency`. The type IS correctly generated (verified via codegen run + diff), but the test doesn't assert it. Same gap pattern as PR 1's P1 (stale-output-due-to-incomplete-test-coverage). One-line fix: add `'Currency'` to the array.

## Pre-existing observation (not new)

`gen-types.ts:202` NODE_TYPE template uses `type: 'Fab'` but Zod schema declares `z.literal('FAB')`. Pre-existing from PR 1 (verified via `git show 31dcbe4`). Not a PR 2 finding. Worth a follow-up.

## Correctness Verification — Critical Items

1. **PR 1 P1 not repeated.** `grep -c "| {id: string; type:" generated/types.ts` → 39. All 6 new types present in NODE_TYPE template.
2. **CurrencySchema = 7 values.** `enums.ts:68`: `z.enum(['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'INR'])`.
3. **MoneyField cents canonicalization.** `parseAndCanonicalize` uses string-split arithmetic. `parseAndCanonicalize('0.10', 'USD') + parseAndCanonicalize('0.20', 'USD') === 30`. Tests at `MoneyField.test.tsx:67-75` verify.
4. **SearchFilterContext per-Renderer scoping.** `useRef<SearchFilterMap>(new Map())` per component mount, not module-level. T-0009-230 mounts two separate providers and confirms no shared state.
5. **SearchBar → List filter activation.** `SearchBar.tsx` writes via `filterControls.setFilter`. `List.tsx` calls `useSearchFilter(node.collectionId)` and filters `allRowEntries` via `rowMatchesQuery` (case-insensitive substring on string fields, ignores numeric).
6. **NodeRenderer 39 arms.** All 6 new types dispatched at `NodeRenderer.tsx:124-135`. Defensive default intact.
7. **Codegen drift zero.** `pnpm --filter @app-creator/protocol codegen` matches working tree exactly.
8. **TimeField HH:MM 24h.** `dateToHHMM` uses `String(date.getHours()).padStart(2, '0')` — 24h, no AM/PM.
9. **MultiPicker CSV.** `parseCSV` splits on `,`; schema enforces `/^[^,]+$/` on option values.
10. **`unknown_search_collection`** still skeleton (returns `[]`); not regressed.
11. **SearchBar useEffect necessity.** No synchronous equivalent for unmount-time Map.delete in React. Architecturally justified (same rationale as nav/ exception #4). What's missing is the §K table update.

## Test Counts

| Package | Before PR 2 | After PR 2 | Delta |
|---|---|---|---|
| protocol | 968 + 11 todo | 974 + 11 todo | +6 (codegen tripwires for 6 new components) |
| design-system | 252 | 252 | 0 (no DS changes) |
| renderer | 710 | 825 | +115 |
| Snapshots | 56 + others | +12 new input component snapshots | — |

## CI/CD Verification Required: No

## Documentation Update Required: YES (P1)

ADR-0006 §K table amendment required before Ellis commits.

## Roz's Assessment

The technical work is correct and complete. SearchFilterContext is the most consequential new architectural surface in PR 2, and Colby got the per-Renderer scoping exactly right — `useRef`-based Map, not a module-level singleton. The MoneyField cents canonicalization avoids the JS float pitfall with the proper string-split arithmetic and a regression test that explicitly exercises $0.10 + $0.20. CurrencySchema is closed at 7 values per invariant 6.

The one P1 is process, not technical. ADR-0006 §K is the spec for useEffect exceptions, and it states explicitly that ESLint config changes without a §K amendment are forbidden. Colby followed the technical pattern (eslint.config.mjs comment block has the full rationale) but skipped the ADR amendment. The fix is one table row + one closing-sentence number.

The advisories are documentation-quality items. A1 is a misleading comment that a future reader will misunderstand. A2 is a small test coverage gap (same pattern as PR 1's P1).

**One P1 fix required. Ellis should hold the commit until Colby amends ADR-0006 §K (and folds the two advisories while in the files).**

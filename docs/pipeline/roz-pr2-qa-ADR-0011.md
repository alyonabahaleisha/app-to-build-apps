# QA Report — ADR-0011 Phase 1 PR 2 (Steps 4+5)

_Reviewed by Roz — 2026-05-10_

## Verdict: REVISE

| Check | Status |
|---|---|
| Type Check (API + Mobile) | PASS |
| Lint | PASS (0 errors; 4 pre-existing warnings) |
| Tests (API me.ts route) | PASS — 16/16 |
| Tests (API me.service) | N/A — Docker-gated |
| Tests (Mobile targeted) | PASS — 44 across miniApps, outOfScopeIntents, AppShellThemeProvider |
| Tests (Mobile full) | PASS — 217/0/1 skipped |
| DB migrations | N/A (PR 1 cascade landed migration 0008) |
| Security | PASS |
| CI/CD | N/A |
| Docs Impact | N/A |
| Dependencies | None added |

## BLOCKING — F1: GenerateResult shape mismatch — runtime navigation break

**Background:** PR 1 (`0e2cc70`) renamed the SSE `done` event's top-level key from `project` to `miniApp`. The cascade-fix QA (`676b669`) caught the wire-protocol issue on `parent_project_id` but missed this structural key rename. The bug survives into PR 2's working tree.

**Defect:** Server SSE done payload: `{type: 'done', miniApp: {id, ...}, spec, render_hash}`. Mobile `GenerateResult` (state/queries/generate.ts:35) expects: `{project: {id, ...}, spec, render_hash}`. The handler at `generate.ts:240` uses `setResult(data as unknown as GenerateResult)` — bypasses typecheck.

At runtime, every successful generation:
- `result.project` is `undefined` (server sent `miniApp`)
- `Chat/index.tsx:93` does `navigation.replace('AppRunner', {projectId: result.project.id})`
- Throws `TypeError: Cannot read properties of undefined (reading 'id')`
- Navigation to AppRunner breaks for every successful generation

**Why typecheck passes:** `as unknown as GenerateResult` cast at line 240 masks the mismatch. No runtime shape validation. Chat screen test mocks `useGenerateMutation` entirely so the SSE parser is never exercised.

**Resolution required (pick one):**
1. **Mobile rename** (recommended) — `GenerateResult.project` → `GenerateResult.miniApp`; update `Chat/index.tsx:93` to `result.miniApp.id`. Consistent with PR 1's `miniApp` naming throughout.
2. Server rename back — `doneEventPayload.miniApp` → `doneEventPayload.project` (restores backward compat but contradicts PR 1's coordinated rename).

Either way: atomic — server + client both updated in same commit.

## MEDIUM — F2: Stale JSDoc in Home/index.tsx

`apps/mobile/src/screens/Home/index.tsx:18` says `useProjectsListQuery()` → should be `useMiniAppsListQuery()`.
`:26` says `projects-list cache` → should be `miniApps-list cache`.

M1-era comments survived the Step 4 rename. Code is correct (line 45 imports + line 62 calls `useMiniAppsListQuery`); only JSDoc stale.

## Notes (non-findings)

- **N1:** QA brief AC-9 (`getMe(userId)`) was phantom — function doesn't exist in ADR-0011 Step 5 spec. Conflated with ADR-0013 in the brief. Colby correctly did not implement. No action.
- **N2:** Archive/delete mutations use `onMutate + onError + onSettled` (correct three-hook pattern per CLAUDE.md §2; `onSuccess` is folded into `onSettled` which fires on both success and error).
- **N3:** `GenerateInput.parentProjectId` mapping to wire `parent_project_id` is intentional (wire deferral preserved); not a finding.
- **N4:** `sql<boolean>` annotation at me.service.ts:86 is standard Drizzle pattern; `Boolean(r.notifyOptIn)` cast at line 99 guards against non-boolean driver output.

## Acceptance Criteria Audit (Steps 4 + 5)

All 18 ACs pass except the phantom AC-9 (N/A — not in ADR spec). See full audit table in Roz's complete report (delivered via task message).

## Critical Scrutiny — Wire-protocol deferral

REST endpoints (`GET /me/mini-apps/*`) correctly send `parentMiniAppId` camelCase; mobile parser reads same. SSE generate route correctly preserves `parent_project_id` snake_case. Both correct for their respective surfaces.

F1 is a SEPARATE structural bug at the SSE done-event top-level key — `miniApp` vs `project`. Typecheck doesn't catch it; runtime breaks navigation.

## Roz's Assessment

Phase 1 PR 2 implementation is largely correct. Step 4 rename clean. Step 5 me service auth-only data correct (email excluded, userId excluded, promptHash excluded). PATCH rate limit shares window with GET per T-0011-119. Test quality high.

F1 blocks ship — every successful generation throws on navigation. Introduced in PR 1, missed by cascade-fix, surfaces here. Fix is two-file mobile edit (state/queries/generate.ts type + Chat/index.tsx field read).

F2 is cosmetic JSDoc cleanup; fold in same pass.

**Two surgical fixes required before merge.**

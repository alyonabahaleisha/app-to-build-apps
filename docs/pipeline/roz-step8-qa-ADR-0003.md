# QA Report — ADR-0003 Step 8: AppRunner integration finale

_Reviewed by Roz — 2026-05-02_

## Verdict: PASS WITH NOTES

| Check                | Status          | Details                                                                                                                                                                                                                                                                          |
| -------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Type Check           | PASS            | All 4 workspaces clean.                                                                                                                                                                                                                                                          |
| Lint                 | PASS WITH NOTES | 0 errors. 62 pre-existing warnings. Zero new in Step 8.                                                                                                                                                                                                                          |
| Tests (renderer)     | PASS            | 211/211 across 18 suites. +6 from Step 7 (T-0003-113a/b, 114a/b, 120, 121).                                                                                                                                                                                                      |
| Tests (AppRunner)    | PASS            | 31/31 across 3 suites: 13 index + 7 RenderErrorBoundary + 11 PublishSheet.                                                                                                                                                                                                       |
| Coverage (renderer)  | PASS            | 99.12% stmts / 96.64% branches.                                                                                                                                                                                                                                                  |
| Coverage (AppRunner) | PASS WITH NOTES | RenderErrorBoundary 100/100/100 stmts/funcs/lines, 66.66% branches (`__DEV__` guard — Jest-resolved false). AppRunner/index.tsx 75.67%/57.69% — interaction paths in unpublish ActionSheet callback (lines 141–149) and PublishSheet ref (line 127) not exercised in unit tests. |
| Complexity           | PASS WITH NOTES | AppRunner/index.tsx 350 LOC (50 over threshold). Driven by JSX + StyleSheet, no functions exceed CCN 10.                                                                                                                                                                         |
| Security             | PASS WITH NOTES | See Finding 1.                                                                                                                                                                                                                                                                   |
| Docs                 | PASS            | T-0003-120 (`pipeline-state.md`) + T-0003-121 (`adr-index.md`) both pass.                                                                                                                                                                                                        |

## All 16 Mandatory T-IDs Verified

T-0003-106..121 present and assertions specific.

**Critical assertion quality:**

- T-0003-107: confirmed old reducer fully removed (only mention is in JSDoc removal-comment).
- T-0003-110: exact `getByText` strings, not regex.
- T-0003-112: exact object match `{projectId, renderHash, mode:'owner'}`.
- T-0003-113/114: two distinct test families (render-stability vs spec-canonicalization), two fixtures each.
- T-0003-116: explicitly asserts `ownerStateReducer === undefined` and `dispatchOwnerState === undefined`. No partial migration.
- T-0003-119: `Object.keys(payload).sort()` enumerates all keys — any extra would fail.
- T-0003-120/121: regex matches for `ADR-0003-renderer.md`, `ADR-0004`, `0003`, `a2ui`, `mobile-shell`.

## Fixture Provenance

- `pomodoro.json`: valid A2UI shape, multi-view, Counter+Toggle+Button.
- `tipsplitter.json`: valid A2UI shape, two views, Form+Counter+Toggle+List+Button.
- `pomodoro.hash` + `tipsplitter.hash`: 64-char SHA-256 hex strings, validated.

## NodeRenderer Public Export

`packages/a2ui-renderer/src/index.ts` adds `NodeRenderer`. Minimal change — AppRunner needs it for both real implementation and test mock interception. No other internals exposed.

## Issues Found

### Finding 1 (Real — actionable before final sweep): Hardcoded colors in RenderErrorBoundary (CLAUDE.md §1 violation)

`apps/mobile/src/screens/AppRunner/RenderErrorBoundary.tsx` lines 110, 116, 123, 128 hardcode `#0a0a0b`, `#5e6470`, `#4f46e5`, `#ffffff`. Theme tokens exist (`palette.text.primary`, `text.muted`, `primary`, `primaryFg`).

CLAUDE.md §1: "Never hardcode colors or spacing values." Class component cannot call `useTheme`. Correct pattern: split fallback UI into a function component that calls `useTheme`, OR inject theme as a prop via a thin function-component wrapper.

**Impact:** dark-mode renders the boundary with light-mode colors. Bug.

### Finding 2 (Pre-existing, not Step 8 regression): Raw `error?.message` rendered without `safeMessage` wrapping

`AppRunner/index.tsx` line 179: `{error?.message ?? 'Project not found.'}`. `apiFetch` throws `ApiError` with `response.statusText` as message — surfaces internal API text. Established pattern is `safeMessage()` for outside-origin errors.

Pre-existing from Step 7 scaffold. Step 8 touched this file but did not remediate.

### Finding 3 (Branch coverage debt): AppRunner/index.tsx 57.69% branches

Unpublish ActionSheet callback body (lines 141–149) and `publishSheetRef.current?.present()` (line 127) untested. Both error branches in unpublish are duplicates (identical toast) — minor smell. Below threshold but concentrated in interaction paths.

## Pre-existing (Not Step 8 Regressions)

- `services/api` testcontainers (Docker unavailable).
- `apps/mobile` Chat/Home/generate (ExpoFetchModule absent in Jest).

## Roz's Assessment

Step 8 is correct. All 16 T-IDs verified with specific, non-tautological assertions. Two test families for determinism implemented distinctly. Behavioral preservation verified across loading/error/Publish CTA branches. Mock cardinality enforced.

The findings are real and should be addressed before the ADR final sweep. **Finding 1 (hardcoded colors) is the most actionable — fixing dark-mode rendering on the error boundary is a one-component patch.**

**Step 8 may proceed.** ADR-0003 implementation is complete pending Finding 1 remediation. Finding 2 is pre-existing scope; Finding 3 is interaction-path coverage debt.

— Roz

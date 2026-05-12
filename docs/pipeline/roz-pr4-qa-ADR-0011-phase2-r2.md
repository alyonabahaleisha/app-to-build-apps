# R2 QA Report — ADR-0011 Phase 2 PR 4 (Step 10 — RunScreen) Surgical Fix Verification

_Reviewed by Roz — 2026-05-11_

## Verdict: PASS WITH NOTES

Both R1 P-findings closed. RunScreen.tsx 408→352 lines. T-0011-244/278 collisions resolved. T-ID repurposing for T-0011-245/281 accepted with breadcrumb. Roz caught a NEW T-0011-246 triple collision (pre-existing, missed in R1) — non-blocking backlog item.

| Check | Status | Details |
|---|---|---|
| Type Check | PASS | clean |
| Lint | PASS | 0 errors |
| Tests | PASS | 352/352, 24 snapshots |
| Complexity (F3) | PASS | RunScreen.tsx 352 / RunErrorBoundary 52 / RunErrorState 40 |
| F1 — T-0011-244 collision | RESOLVED | Second occurrence is range comment, not test label |
| F1 — T-0011-278 collision | RESOLVED | Same — range comment vs test label |
| F1 — T-0011-245/281 repurposing | ACCEPT w/ breadcrumb | ADR-claimed IDs reused; original behaviors untested |
| **NEW — T-0011-246 triple collision** | **PRE-EXISTING / BACKLOG** | Lines 298, 314, 324 |
| Scope creep | CLEAN | only Run/ scope + Navigation.tsx wire + api.test.ts allowlist |

## F1 Primary — Collision Resolution

- T-0011-244: appears at line 4 (range comment) + line 291 (test label). Distinct usages. RESOLVED.
- T-0011-278: appears at line 856 (range comment `// Snapshots (T-0011-278..T-0011-282)`) + line 860 (test label). Distinct. RESOLVED.
- T-0011-245 (line 307): unique test label.
- T-0011-281 (line 867): unique test label.

## F1 Nuance — T-ID Repurposing Decision

ADR-0011 defines:
- **T-0011-245**: "RendererThemeProvider gets (stance, palette) from mini-app row"
- **T-0011-281**: "FirstRunCoachmark snapshot"

Colby's actual implementations:
- **T-0011-245** (line 307): "mounts Renderer with spec from useMiniAppQuery"
- **T-0011-281** (line 867): "RunHeader loading" snapshot

**Ruling: ACCEPT** with mandatory breadcrumb:

- The ADR T-0011-278 row reads "RunHeader default + loading" — Colby correctly split the two renders. T-0011-278 covers default; T-0011-281 covers loading. Pragmatic reuse of an ADR-claimed-but-unimplemented ID.
- The ADR T-0011-245 (RendererThemeProvider stance/palette resolution) is a real spec requirement. It is **not covered anywhere** in this test file. Likely covered at the `packages/a2ui-renderer/` test layer (ADR-0006), but verify before V0 exit.

**Backlog**: Confirm RendererThemeProvider stance/palette coverage exists at the renderer integration layer before V0 ship.

## NEW Finding — T-0011-246 Triple Collision (Pre-existing, missed in R1)

`RunScreen.test.tsx`:
- Line 298: `it('T-0011-246 / loading: RunHeader.Loading renders with back button', ...)`
- Line 314: `it('T-0011-246: host header renders with back, title, meatball', ...)`
- Line 324: `it('T-0011-246: title shows mini-app title from query', ...)`

ADR defines T-0011-246 as a single populated-state behavior. Line 298 is a loading-state test mislabeled. Lines 314 + 324 share one ADR behavior with split assertions — CLAUDE.md §8 allows this.

**Classification: Pre-existing (missed in R1). Non-blocking for this R2 sign-off.** Must be fixed before M2 exit.

Suggested fix (for backlog): Assign T-0011-285 to the loading-state header test at line 298. (T-0011-283/284 are coachmarkStorage unit tests; T-0011-282 is RunFailedBanner snapshot; T-0011-266 is "coachmark auto-dismisses after 8s.")

Roz owns this miss as much as Colby.

## F3 — File Extraction Verified

- `apps/mobile/src/screens/Run/RunScreen.tsx`: **352 lines** (`wc -l`)
- `apps/mobile/src/screens/Run/RunErrorBoundary.tsx`: 52 lines (class component; `componentDidCatch` → `logger.error` with `safeMessage`)
- `apps/mobile/src/screens/Run/RunErrorState.tsx`: 40 lines (functional; `{is404, onBack, onRecreate}` props)

RunScreen.tsx imports both at lines 64-65. Error branch (lines 259-268) delegates to `RunErrorState`. Render-error boundary (lines 288-309) delegates to `RunErrorBoundary`. Behavior identical.

352 lines acceptable at soft-300 threshold. Logical complexity is genuine; no further extraction warranted.

## Scope Creep — Clean

Touched in R2:
- `RunScreen.tsx` — extractions + imports
- `RunScreen.test.tsx` — T-ID renames
- `RunErrorBoundary.tsx` — NEW
- `RunErrorState.tsx` — NEW
- `__snapshots__/RunScreen.test.tsx.snap` — regenerated with T-0011-278/281 labels
- `Navigation.tsx` — RunScreen wiring (in scope for PR 4)
- `lib/api.test.ts` — allowlist (documented in R1)

Concurrent `packages/a2ui-renderer/**` working-tree changes are the ADR-0009 Step 6 workstream. Not this PR's scope.

## Advisories F2/F4/F5/F6 — Correctly Deferred

- F2 coachmarkStorage backend (intentional ADR override)
- F4 archive/delete silent failure UX
- F5 T-0011-295 doc test description
- F6 worker leak warning

All remain in backlog. Correct.

## Roz's R2 Assessment

Two P-findings resolved cleanly. Extraction is structurally sound. T-ID repurposing pragmatic; breadcrumb on record. T-0011-246 triple-collision is Roz's R1 miss; non-blocking backlog item.

**PASS WITH NOTES. Ellis can commit.**

Backlog for M2 exit:
1. Confirm RendererThemeProvider stance/palette coverage at `packages/a2ui-renderer/` test layer
2. Reassign T-0011-285 to the loading-state RunHeader test at RunScreen.test.tsx:298
3. F2/F4/F5/F6 advisories from R1

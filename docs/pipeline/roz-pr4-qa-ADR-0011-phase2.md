# QA Report — ADR-0011 Phase 2 PR 4 (Step 10 — RunScreen)

_Reviewed by Roz — 2026-05-11_

## Verdict: REVISE (2 P-findings + 4 advisories)

352/352 tests, 22 suites, 24 snapshots, typecheck/lint clean. Implementation solid — workspace boundaries respected, security clean, coachmark lifecycle correct, T-0011-259 stale-spy fix textbook. Two P-findings block sign-off.

| Check | Status | Details |
|---|---|---|
| Type Check | PASS | clean |
| Lint | PASS | 0 errors |
| Tests | PASS | 352/352, 24 snapshots |
| **Complexity** | **FAIL** | RunScreen.tsx is 408 lines (>300 threshold) |
| Security | PASS | No PII in logs; workspace boundaries clean |
| UX flow | PASS | All states traced; coachmark logic correct |
| Worker leak | Advisory | "Worker process force-exited" — likely autoDismissRef timer in FirstRunCoachmark |

## BLOCKING — P1 F1: T-ID collisions

`apps/mobile/src/screens/Run/RunScreen.test.tsx`:
- Line 291 + line 307 both labeled `T-0011-244` — two distinct tests
- Line 860 + line 867 both labeled `T-0011-278` — two distinct tests

This breaks the T-ID traceability contract — the ID system exists so a failing test maps to an unambiguous spec requirement. File header says "41 T-IDs"; Colby claims 48. Discrepancy partly from these duplicates.

**Fix:** Assign correct sequential IDs from the gap range (e.g., T-0011-245 for loading-state renderer; T-0011-278b or next free for RunHeader loading snapshot). Update file header count.

## BLOCKING — P2 F3: RunScreen.tsx exceeds 300-line threshold

`apps/mobile/src/screens/Run/RunScreen.tsx` is 408 lines. Natural extractions available:
- `RunRenderErrorBoundary` class (lines 83-123, 41 lines) → `RunErrorBoundary.tsx`
- Error state render branch (lines 309-325) → `RunErrorState.tsx`

After extraction RunScreen.tsx lands ~330 lines (still slightly over, but acceptable; further trim if needed). The screen's logical complexity is genuine — 8 action handlers, 3 render branches, coachmark controller, mutation pair — so don't try to collapse beyond that.

## Advisory Findings (Non-blocking)

### F2 Advisory — coachmarkStorage uses expo-secure-store for non-token

`apps/mobile/src/lib/coachmarkStorage.ts` stores `coachmark_share_seen` in expo-secure-store. CLAUDE.md §10 reserves secure-store for tokens. ADR-0011 Step 10 note 7 explicitly overrides this for per-device-state semantics ("user signing in on new device should see coachmark again"). Per CLAUDE.md §0 rule: "When the two disagree, ARCHITECTURE.md wins — log the conflict and proceed with the spec's rule." ADR is the spec.

Implementation matches the documented spec. `api.test.ts` allowlist correctly extended with exactly 3 entries (no scope creep): `lib/coachmarkStorage.ts`, `lib/coachmarkStorage.test.ts`, `screens/Run/RunScreen.test.tsx`. **Advisory — not blocking** — but flag the Keychain-vs-MMKV intent tension for next dev touching this module.

### F4 Advisory — Archive/Delete silent failure UX

`RunScreen.tsx:236-277` (handleArchive, handleDelete): mutation failures roll back optimistic state but show NO user-visible error. User presses Delete → item disappears → mutation fails → item reappears on refetch with no explanation. Real UX problem once in users' hands. ADR doesn't specify a toast here — flag for next iteration.

### F5 Advisory — T-0011-295 test overstates assertion

`RunScreen.test.tsx:939-953` asserts only `typeof runScreenModule.RunScreen === 'function'`. Comment says "documentation and compile-time guard" — accurate. NOT a regression test for `useAuthDeepLink` interference. Typecheck covers it more thoroughly. Not tautological (would fail if RunScreen not exported), but test description overstates what's locked.

### F6 Advisory — Worker process force-exited

"A worker process has failed to exit gracefully... Active timers can also cause this."

Likely culprit: `autoDismissRef.current` setTimeout in `FirstRunCoachmark.tsx` set in useEffect, may not clear if a test ends before the 8-second auto-dismiss. Fake timers in beforeEach should catch it but if a test mounts the coachmark and doesn't advance timers, the timer lingers. Doesn't affect correctness; noise that can mask real leaks.

## Specific scrutiny resolutions (all PASS)

- **T-0011-259 stale-spy fix**: Verified `alertSpy.mockClear()` at line 549 (NOT `mockReset()`). Spy preserved; only `mock.calls` zeroed. Correct.
- **coachmarkStorage import boundary allowlist**: Exactly 3 expected entries added; no scope creep.
- **telemetry.ts `_event` prefix**: line 24, no logic change.
- **LibraryScreen.test.tsx + GeneratingScreen.test.tsx duplicate `name="Run"` removal**: Each file has exactly one `name="Run"` entry after fix; no other test logic touched; both suites PASS.
- **Coachmark check on mount, mark on dismiss**: `RunScreen.tsx:149-156` calls `hasSeenCoachmark()` in `useEffect([])` (mount only). `markCoachmarkSeen()` fires in `handleDismiss` (FirstRunCoachmark.tsx:87) — NOT on mount. Correct lifecycle.
- **Workspace boundary**: `RunScreen.tsx:58-59` uses package imports `@app-creator/a2ui-renderer` + `@app-creator/protocol` — no deep imports. Correct.
- **ADR-0006 §K useEffect ban**: Scoped to `packages/a2ui-renderer/src/v0/**` per eslint config lines 85-104. RunScreen + FirstRunCoachmark are in `apps/mobile/**` — outside ban scope. No §K violation, no amendment needed.

### DeleteConfirmAlert.tsx spec variance (noted)

ADR-0011 Step 10 lists `DeleteConfirmAlert.tsx` as a file to create. Doesn't exist. Implementation uses inline `Alert.alert()` in `handleDelete` (RunScreen.tsx). Reasonable choice — RN's native Alert is standard for destructive confirmation. Tests assert it correctly. Spec variance, not defect.

## Scope creep — Clean

ONLY `apps/mobile/**` files in this PR's diff. The `packages/a2ui-renderer/**` + `packages/protocol/**` untracked working-tree changes are concurrent ADR-0009 Step 6 — separate workstream.

## Roz's Assessment

Solid implementation. 48 tests cover meaningful behaviors — loading, errors, meatball actions, navigation transitions, a11y, coachmark dismissal paths. The stale-spy fix is the kind of subtle bug that bites in CI flakiness; Colby caught + fixed correctly.

Two things block sign-off:
1. **T-ID duplicates** — assign the correct sequential IDs from gaps
2. **408-line RunScreen.tsx** — extract `RunRenderErrorBoundary` + `RunErrorState`

Advisories worth addressing before M2 exit but don't block this PR.

**REVISE.** Fix 2 P-findings → R2 → Ellis.

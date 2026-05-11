# QA Report R2 — ADR-0011 Phase 2 PR 3 (Surgical Fix Verification)

_Reviewed by Roz — 2026-05-10_

## Verdict: PASS

All 6 R1 findings closed cleanly. No new defects. 327 tests pass.

| Check | Status |
|---|---|
| Type Check | PASS |
| Lint | PASS |
| Tests | PASS — 327/327 (1 pre-existing skip), 23 suites |
| All 6 R1 findings | CLOSED |

## Finding Verification

### F1 (BLOCKER) — T-0011-212/213 Navigation Tests

CLOSED. Both tests set `mockPhase` + `mockResult`/`mockOutOfScope` before render. useEffect fires on mount; assertions:
- T-0011-212: `expect(replaceSpy).toHaveBeenCalledWith('Run', {miniAppId: 'mini-app-123'})` — specific value, zero tautology
- T-0011-213: `expect(replaceSpy).toHaveBeenCalledWith('OutOfScope', {capability: 'image_gen', reason: '...', promptHash: 'ph-abc', originalPrompt: 'make me an image'})` — 4 params asserted, no wildcards

Both wrapped in `waitFor`. Reanimated `useReducedMotion` module mock shared by T-0011-235/236.

### F2 (REVISE) — Reanimated 4 Migration

CLOSED. `ProgressBar.tsx`:
- Imports from `react-native-reanimated` only
- Pacing constants match spec: `PHASE1_TARGET=0.75 / 6500ms`, `PHASE2_TARGET=0.95 / 1500ms`
- `useReducedMotion()` built-in Reanimated hook (NOT setInterval fallback)
- Reduced-motion path: `withTiming(target, {duration: 0})` instant step
- `onProgressChange` prop removed cleanly

### F3 (MODERATE) — useGenerateMutation Cleanup

CLOSED. `generate.ts:315-320` adds `useEffect` cleanup: `clearStall()` + `abortRef.current?.abort()` on unmount. `clearStall` is stable (useCallback, no changing deps).

### F4 (MODERATE) — popToTop

CLOSED. `QuotaExhaustedScreen.tsx:59` uses `navigation.popToTop()`. Test spies on `popToTopSpy`. Stack hygiene preserved.

### F5 — Real Tests

CLOSED.

**T-0011-198** (`VoiceMicWaitlistSheet.test.tsx`, 5 tests):
- POST shape: `body.capability === 'transcription'` + `body.email === 'user@example.com'` against actual fetch call
- Success state: `voice-waitlist-success` appears
- Error path: 5xx mock; submit still present
- Empty email guard + invalid email guard

**T-0011-222** (`OutOfScopeScreen.test.tsx:292-367`): Mocks `addListener`, captures `beforeRemove` callback, asserts:
- `addListener` called with `'beforeRemove'` + `expect.any(Function)`
- Captured callback defined
- Invoking it does not throw

### F6 — transcription Body Copy

CLOSED. `OutOfScope/copy.ts:50`: `"We'll let you know when you can dictate prompts hands-free."` — distinct from headline.

## Pre-existing (NOT this PR)

Worker forced-exit warning remains. Stack traces point to `Toast.tsx` Animated.Value updates in the Reanimated mock internal scheduler — pre-existing, scoped backlog (F10).

## Roz's R2 Assessment

All six findings genuinely fixed, not papered over. F1 tests now exercise real navigation behavior with specific expected arguments — would catch a regression if someone swapped `replace` for `navigate` or misspelled `'Run'`. Reanimated 4 migration is clean. useEffect cleanup correct pattern. `popToTop` right call. Five VoiceMicWaitlistSheet tests assert wire behavior. transcription body no longer a headline echo.

327 tests pass. Worker exit warning scoped to Reanimated mock's internal scheduler — not this PR's responsibility.

**Ellis can commit.**

# QA Report — ADR-0011 Phase 2 PR 3 (Step 9 — CreateScreen + Generating + OutOfScope + QuotaExhausted)

_Reviewed by Roz — 2026-05-10_

## Verdict: REVISE

322 tests pass; infrastructure is sound (4 screens, correct routing types, `quota_exhausted` phase added, AbortController wired, cancel alert copy exact, hit targets met). Pattern consistent with Phase 2 PR 2.

**Two issues block PASS:** F1 (tautological tests for most consequential transitions) + F2 (spec deviation — wrong animation API).

| Check | Status |
|---|---|
| Type Check | PASS |
| Lint | PASS |
| Tests | PASS (322/322); but F1 tests pass trivially |
| Coverage | PASS — Create 84%, Generating 79%, OutOfScope 88%, QuotaExhausted 95%; VoiceMicWaitlistSheet 50% branch |
| Complexity | PASS |
| Security | PASS — email never to Sentry/console; Sentry block commented for V0 |

## BLOCKING — F1: T-0011-212 + T-0011-213 are tautological

`GeneratingScreen.test.tsx:220-248`. Both tests assert `expect(replaceSpy).not.toHaveBeenCalled()` because mocks prevent useEffect from firing — they pass precisely because nothing happens.

T-0011-212 ("done event → navigation.replace Run with miniAppId") — actual assertion is the opposite of what the test name claims.
T-0011-213 ("out_of_scope event → navigation.replace OutOfScope") — same pattern.

These are the most consequential navigation transitions in the entire step. **Zero behavioral coverage** at the screen level. Hook integration test also stubs `useGenerateMutation` wholesale.

**Fix:** Rewrite both to drive real phase transitions via mock mutation + `act()` + `rerender()`. Assert `replaceSpy.toHaveBeenCalledWith('Run', {miniAppId: '...'})` and `replaceSpy.toHaveBeenCalledWith('OutOfScope', {capability, reason})`. The hook mock infrastructure exists (`mockPhase`, `mockResult`, `mockOutOfScope`); transitions must be wrapped in `act()` to trigger React re-renders.

## REVISE — F2: ProgressBar uses legacy Animated, not Reanimated 4 withSequence

`ProgressBar.tsx`. ADR Step 9 (line 1025) specifies `Reanimated 4 withSequence`. Sable UX (line 493) confirms `Reanimated withTiming`. Reanimated is installed (`~3.16.1`).

Implementation imports `Animated` from `react-native` and uses `Animated.sequence + Animated.timing` (legacy API). Mixes motion vocabulary the rest of V0 will use. Reduced-motion branch's `setInterval` works in tests but breaks Reanimated's `useReducedMotion` hook integration.

**Fix:** Replace with Reanimated 4:
- `import {useSharedValue, useAnimatedStyle, withSequence, withTiming, withDelay} from 'react-native-reanimated'`
- Pacing: `withSequence(withTiming(0.75, {duration: 6500}), withTiming(0.95, {duration: 1500}))`
- Reduced-motion: use Reanimated's `useReducedMotion()` hook + step-based fallback (`withTiming(value, {duration: 0})`)

## MODERATE — F3: useGenerateMutation timer leak on unmount

`state/queries/generate.ts`. `armStall` sets a 30s `setTimeout` in `stallRef`. Cleared in `reset()` and `generate()` `finally`. **No useEffect cleanup on hook unmount.** If GeneratingScreen unmounts while stall timer is armed, callback fires against unmounted context.

Jest reports: "A worker process has failed to exit gracefully... Active timers" — likely root cause.

**Fix:** Add `useEffect(() => () => { clearStall(); abortRef.current?.abort() }, [])` to `useGenerateMutation`.

## MODERATE — F4: T-0011-225 spec says "pop to Library"; impl uses `navigate('Library')`

`QuotaExhaustedScreen.tsx:56`. ADR T-0011-225 + E2E T-0011-326 both say "pop to Library." Implementation uses `navigation.navigate('Library')`.

Current flat-stack navigator: `navigate` works (goes to Library since it's root) but leaves different stack history vs `pop`. Step 11 navigator restructure may produce divergent behavior. Spec says "pop" for a reason — prevents re-entering Create via back button.

**Fix:** Use `navigation.popToTop()` or `navigation.reset()` per ADR intent.

## OBSERVATION — F5: Tautological `expect(true).toBe(true)` (3 sites)

- `CreateScreen.test.tsx:343` — T-0011-198 (VoiceMicWaitlistSheet POST) — deferred to "VoiceMicWaitlistSheet internals" not tested elsewhere. **AC unverified.**
- `CreateScreen.test.tsx:448` — T-0011-206 — acceptable cross-ref to suggestedPrompts.test.ts; minor noise.
- `OutOfScopeScreen.test.tsx:297` — T-0011-222 (back-without-submit dismissal telemetry). Comment: "can't easily trigger beforeRemove." **AC unverified.**

**Fix:** Write real T-0011-198 (POST `/me/out-of-scope-intents` for `capability=transcription`) and T-0011-222 (mock `beforeRemove` event → assert dismissal telemetry).

## OBSERVATION — F6: transcription body copy duplicates headline

`OutOfScope/copy.ts:50`. `body: 'Voice notes are coming. Want to be the first to try them?'` — first sentence near-verbatim repeats headline. All other capabilities have distinct body text. Copy fix.

## OBSERVATION — F7: VoiceMicWaitlistSheet 50% branch coverage

Submit + error paths untested. Related to F5 T-0011-198 closure.

## OBSERVATION — F8: T-0011-231a test body doesn't assert prompt preservation

`GeneratingScreen.test.tsx:316`. Asserts `mockReset` + `goBackSpy` called; doesn't verify prompt preserved. (Prompt IS preserved via mounted CreateScreen state — but test doesn't verify.)

## OBSERVATION — F9: Run screen absent from Navigation.tsx

GeneratingScreen calls `navigation.replace('Run', {miniAppId})`. `Run` in `RootStackParamList` but no `Stack.Screen`. Step 10 home. Known scope; manual testing of success path blocked at Step 9.

## OBSERVATION — F10: Worker process leak (linked to F3)

30s stall timer + Jest forced-exit warning. CI with `--forceExit` masks; without it fails.

## Roz's Assessment

Pattern consistent with PR 2. Four screens land cleanly: Create + Generating + OutOfScope + QuotaExhausted. Routing types correct. Hit targets met. Chat deleted. Sentry block commented per V0 deferral.

F1 is the serious one. T-0011-212/213 are the behavioral tests for Generating → Run and Generating → OutOfScope — the two most consequential transitions in the entire step. Both assert the opposite of what they claim. These are scheduled for E2E in Step 12 but unit-level dispatch tests should exist now.

F2 is the spec deviation: Reanimated installed, ADR + Sable both name Reanimated, implementation uses legacy `Animated`. Wrong motion vocabulary.

F3 + F4 are moderate — timer leak will surface in CI as flaky forced-exit; `navigate` vs `pop` matters when Step 11 restructures the navigator.

**REVISE.** Fix F1 + F2 + F3 + F4 + F5 (T-0011-198 + T-0011-222 real tests). F6-F10 backlog.

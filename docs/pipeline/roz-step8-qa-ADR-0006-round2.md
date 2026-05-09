# QA Report — ADR-0006 Step 8 Round 2 (Surgical Fix)

_Reviewed by Roz — 2026-05-07_

## Verdict: PASS

Both gating issues resolved cleanly.

| Check | Status |
|---|---|
| Type Check | PASS |
| Lint | PASS — 0 errors |
| Tests (V0) | PASS — 442/442 |
| Tests (Legacy) | PASS — 211/211 |
| Regressions | PASS — 439 prior V0 tests still pass |
| Fix 1 load-bearing | PASS — verified |
| Fix 2 load-bearing | PASS — verified |
| Fix 3 stale comment | PASS |
| `queueMicrotask` scope | PASS — ListSummary only |
| `useEffect` prohibition | PASS |
| AI dispatcher contract | PASS — `AIDispatcher.summarize` interface unchanged |

---

## Fix 1 Load-Bearing Verification

`aiBridge.ts` lines 44-54: `state = opts.getState()` runs before `dispatcher.summarize()`. Collection resolution at line 45; `items` populated at line 51; dispatcher fires at line 54. Order correct.

T-0006-021 assertion: `expect(mockAI.summarize).toHaveBeenCalledWith({prompt, items: [{title: 'First', done: false}, {title: 'Second', done: true}]})`. If `items: []` returned, deep-equal fails. Load-bearing.

`useRendererState.ts` line 112 passes `getState: () => fullStateRef.current` — mirrors undoBufferMiddleware.

## Fix 2 Load-Bearing Verification

T-0006-144 (`aiBridge.test.ts:193-223`): mock rejects; asserts `onAIError` called with the message. Removing `.catch` would fail. Load-bearing.

T-0006-145 (`aiBridge.test.ts:229-259`): tests middleware's `.catch` routing for timeout errors. Real timer mechanism tested at `aiDispatcher.test.ts:179-216` with `useFakeTimers` + `advanceTimersByTime(AI_TIMEOUT_MS + 1)`. Architecturally correct split — aiBridge owns catch routing, aiDispatcher owns the timer.

T-0006-144/145 in `ListSummary.test.tsx` (lines 293-330) correctly document Path B: verify graceful-degradation (shimmer remains when slot is empty). Middleware-level tests own the error assertion. No duplication, no gap.

## Sanitization Chain

T-0006-147 coverage is at `aiDispatcher` unit level — correct. aiBridge passes raw `Row[]` to dispatcher; sanitization runs in `aiDispatcher.summarize` before the native call. aiBridge doesn't sanitize by design.

## Roz's Assessment

Both gating findings resolved. Fix 1 closes the `items: []` stub — collection resolution before dispatcher call, regression-catching test in place. Fix 2's split (aiBridge.test.ts owns error routing, ListSummary.test.tsx owns graceful-degradation) is architecturally correct. Timeout covered via fake timers at the dispatcher level.

No loose assertions, no tautologies, no regressions.

**Step 9 unblocked.**

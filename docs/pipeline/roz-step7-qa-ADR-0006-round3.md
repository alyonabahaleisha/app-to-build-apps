# QA Report — ADR-0006 Step 7 Round 3 (Surgical Fix)

_Reviewed by Roz — 2026-05-07_

## Verdict: PASS

Both round-2 blockers resolved cleanly.

| Check | Status |
|---|---|
| Type Check | PASS |
| Lint | PASS — 0 errors |
| Tests (V0) | PASS — 386/386 (+3 vs round-2) |
| Tests (Legacy) | PASS — 211/211 |
| jest.mock-in-beforeEach antipattern | PASS — none in `src/v0/` |
| `buildAnimationProps` extraction | PASS — exported, consumed at `List.tsx:161`, outputs used at 199/208/209 |
| `testID="shimmer-block"` | PASS — present in `LoadingState.tsx:80` and snapshot |
| Spy mechanism (LoadingState + List) | PASS — spyOn in beforeEach + mockRestore in afterEach |
| Load-bearing (buildAnimationProps) | PASS — inverting the ternary would fail both assertions |
| Load-bearing (LoadingState opacity) | PASS — ignoring reducedMotion leaves initial 0.4, test asserts 1 |
| useEffect violations | PASS — none |
| Scope creep | PASS — only the 4 fix files + snapshots touched |
| Snapshots | PASS — 45 snapshots pass; testID change reflected |

---

## Roz's Assessment

Both fixes clean.

**Blocker 1 (LoadingState):** `spyOn` is the right runtime counterpart to `jest.mock`'s parse-time hoist. Tree-walk assertion bypasses RNTL's accessibility filter for `accessibilityElementsHidden` nodes. With `reducedMotion=true`, `useSharedValue(1)` initializes; `useAnimatedStyle` captures the value synchronously under the mock. Test would catch a regression that ignores `reducedMotion` (initial would be 0.4, assertion expects 1).

**Blocker 2 (List):** `buildAnimationProps` is not dead code — it's the correct extraction seam. The AnimatedView mock strips `entering`/`exiting`/`layout` before they reach the underlying View, so tree inspection is impossible. Testing the pure function directly is the only practical approach. Both pure-unit and integration tests are load-bearing.

**Round 3 closes the loop. Step 8 unblocked.**

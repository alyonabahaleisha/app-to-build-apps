# QA Report — ADR-0006 Step 9 Round 2 (Surgical Fix)

_Reviewed by Roz — 2026-05-07_

## Verdict: PASS WITH NOTES

All three round-1 blockers resolved.

| Check | Status |
|---|---|
| Type Check | PASS |
| Lint | PASS — 0 errors |
| Tests (V0) | PASS — 502/502 |
| Tests (Legacy) | PASS — 211/211 |
| Fix 1 (jest.mock expo-haptics) | PASS — load-bearing |
| Fix 2+3 (Option B cross-refs) | PASS — load-bearing, with one note |
| Fix 4 (T-0006-160 warn) | PASS — load-bearing |
| Fix 5 (reset/updateItem haptics) | PASS — load-bearing |
| Fix 6 (feedback.ts:20 comment) | PASS — matches haptics.ts |
| Scope creep | PASS — only expected fix files touched |

---

## Fix Verifications

### Fix 1 — jest.mock(expo-haptics)
`jestSetup.js:93-99`. `impactAsync` is `jest.fn()`. `clearAllMocks()` resets between tests. `notificationAsync` + `selectionAsync` mocked. Full API surface present.

### Fix 2+3 — Option B Cross-References
- `Button.test.tsx:215-224`: T-155 explicitly named, points to haptics.test.ts for haptic half.
- `FAB.test.tsx:147-167`: Same pattern for T-159.
- `haptics.test.ts:29`: addItem test renamed to "fires Light haptic on addItem (also satisfies T-0006-155 haptic half, T-0006-159 haptic half)".

**Option B union proof:** Button.test.tsx proves `press → dispatch({type: 'addItem'})`. haptics.test.ts proves `dispatch({type: 'addItem'}) → Haptics.impactAsync(Light)`. Chain valid because haptics is the first middleware in `useRendererState.ts` composition `[haptics, toast, aiBridge, navigate, undoBuffer, feedback, reducer]`. Union holds.

### Fix 4 — T-0006-160 Warning
- `feedback.ts`: `KNOWN_VERBS` (12 protocol + 2 internal). `console.warn` if unknown. `next()` outside guard — pass-through guaranteed.
- `feedback.test.ts:179-192`: `warnSpy` asserts `toHaveBeenCalledWith(stringContaining('futureVerb'))`. Mental removal: remove warn → spy never called → test fails. Load-bearing.

### Fix 5 — reset/updateItem Cases
`haptics.ts:29-30` cases fall through to `Haptics.impactAsync(Light)`. Tests at lines 53-63 assert correctly. Pass-through test no longer includes `reset` in no-haptic list.

### Fix 6 — Comment Accuracy
`feedback.ts:20,23` correctly cites UX doc line 1554 for both `reset` and `updateItem`. Internally consistent with haptics.ts.

---

## Notes

### Note 1 (Non-blocking) — T-0006-159 reduced-motion haptic dimension

The cross-reference in FAB.test.tsx explains haptics fire regardless of reduced-motion (haptics.ts has no useReducedMotion check). The haptics.test.ts test covers verb-level haptic, not the reduced-motion dimension explicitly. A future reader must read two files to reconstruct the full invariant. Acceptable under Option B but a clarity improvement opportunity.

### Pre-existing — `'update'` verb absent from no-haptic pass-through list in haptics.test.ts

Predates Step 7. Future addition of `update` haptic case wouldn't be caught by the pass-through test. Low severity.

### `(node as any).disabled` cast — still present in FAB.test.tsx

Cal task pending (FabSchema amendment). Correctly out of scope for this round.

---

## Roz's Assessment

All three blockers from round 1 resolved. Mock correctly established. Cross-references explicit with correct T-IDs. Warning test load-bearing. Fix 5 closes the actual haptics coverage gap.

Option B is a legitimate engineering tradeoff — isolation in component tests + real middleware-level coverage in haptics.test.ts. Cross-references thorough enough that the split is navigable.

**Step 10 (Milestone B) unblocked.**

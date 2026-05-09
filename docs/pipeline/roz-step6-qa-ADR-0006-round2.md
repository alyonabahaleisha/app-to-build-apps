# QA Report — ADR-0006 Step 6 Round 2 (Surgical Fix)

_Reviewed by Roz — 2026-05-07_

## Verdict: PASS WITH NOTES

Both gating issues from round 1 resolved.

| Check | Status |
|---|---|
| Type Check | PASS — clean |
| Lint | PASS — 0 errors, 64 pre-existing warnings unchanged |
| Tests (V0) | PASS — 318/318 |
| Tests (Legacy) | PASS — 211/211 |
| useEffect grep on `src/v0/components/` | PASS — comments only, no calls |
| `.eslintrc.cjs` deleted | PASS |
| ESLint ban — bare form | PASS — fires on `useEffect()` |
| ESLint ban — member form | PASS — fires on `React.useEffect()` |
| Workspace-boundary imports | PASS — 6 patterns migrated and verified |
| `eslint-boundary.test.ts` | PASS — 11/11 |
| Ref-guard pattern correctness | PASS WITH NOTE — see Note 1 |
| Focus-preservation tests | PASS WITH NOTE — see Note 2 |
| No regressions | PASS — 314 prior tests still pass |
| No scope creep | PASS |

---

## Independent Ban Verification

Created temporary violation file with both `useEffect()` and `React.useEffect()` forms; lint produced 2 errors (one per form). Removed file. Ban is effective.

The migrated config is **better** than the deleted `.eslintrc.cjs` — the legacy file only covered the bare form. The MemberExpression selector for `React.useEffect` is new and would have caught the original Step 6 violations regardless of import style.

---

## Notes

### Note 1 (Advisory) — Redundant unconditional ref update

Files: `TextField.tsx` lines 64 + 67; `NumberField.tsx` lines 52 + 55.

```ts
if (prevBoundValueRef.current !== boundValue && !focused) {
  prevBoundValueRef.current = boundValue   // line 64
  setDraft(boundValue)
}
prevBoundValueRef.current = boundValue     // line 67 — unconditional duplicate
```

When the if-block fires, the ref is written twice with the same value. When focused and `boundValue` changes, line 67 silently updates the ref to the new value, which means the next render after blur (without another external update) sees `ref.current === boundValue` and skips sync. Resolves itself because blur dispatches the commit, so no observable bug under the current single-slot dispatch model.

No infinite re-render. No user-visible defect. **Code smell only — could confuse future maintainers about the invariant being tracked.** Not gating.

**Resolution (optional, anytime):** remove the unconditional line. The conditional update inside the if-block is sufficient.

### Note 2 (Advisory) — `act()` warnings in StateHarness tests

Files: `TextField.test.tsx` (FP1, FP2); `NumberField.test.tsx` (FP3, FP4).

The `StateHarness` components use `React.useEffect` (exempt under test-file carveout) to expose a `setState` callback to the test. Direct invocation outside `act()` produces console warnings. Assertions still pass; tests validate the correct behavior — draft preservation when focused, external sync when not.

**Resolution (optional):** wrap callback invocations in `act()` at the test site.

---

## Verification Checklist

1. Typecheck clean ✓
2. 318/318 V0 + 211/211 legacy ✓
3. Zero useEffect calls in `src/v0/components/` ✓
4. Ref-guard pattern correct (Note 1 advisory only) ✓
5. No infinite re-render ✓
6. `.eslintrc.cjs` deleted ✓
7. Root `eslint.config.mjs` has both selectors + 6 workspace-boundary patterns ✓
8. Ban fires on both forms ✓
9. Workspace-boundary rules enforce ✓
10. `eslint-boundary.test.ts` 11/11 ✓
11. Focus-preservation tests validate correct behavior (Note 2 advisory) ✓
12. No regressions ✓
13. No scope creep ✓

---

## Roz's Assessment

Both gating issues resolved. useEffect gone from production code, replaced with functionally correct derived-state ref-guard pattern. ESLint ban now covers both bare and namespaced forms — strict improvement over the deleted legacy config. Ban fires. File deleted. Migration complete.

Two non-gating notes: redundant ref write is a readability nit; `act()` warnings are CI cosmetic noise. Neither blocks Step 7.

**Step 7 unblocked.**

# QA Report — ADR-0003 Step 1: State engine + theme provider + logger sink + render-error infrastructure

_Reviewed by Roz — 2026-05-02_

## Verdict: PASS WITH NOTES

---

## Gate Results

| Check         | Status          | Details                                                                                                                                                                                                         |
| ------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Type Check    | PASS            | `pnpm typecheck` clean across all 4 workspaces. `Dispatch` narrowing and the full `RendererTheme` expansion type-check without error.                                                                           |
| Lint          | PASS            | `pnpm lint` clean. `.eslintrc.cjs` workspace-boundary rules present and structurally correct.                                                                                                                   |
| Tests         | PASS            | 61/61 in the renderer package. 5 test suites, 0 failures.                                                                                                                                                       |
| Coverage      | PASS            | 90% statements / 88.67% branches. ADR gates: ≥90% stmts, ≥85% branches. Both met. Step 1 source files at 100% statements; blended numbers include untouched `render.tsx` / `index.ts` (Step 2+ responsibility). |
| Complexity    | PASS            | `useA2UIState.ts` 184 LOC; `reducer.ts` 121 LOC; no function over 20 LOC; nesting ≤ 3.                                                                                                                          |
| DB Migrations | N/A             | No DB changes in Step 1.                                                                                                                                                                                        |
| Security      | PASS WITH NOTES | See security section.                                                                                                                                                                                           |
| CI/CD Compat  | N/A             | No auth/RBAC/middleware/env-var changes.                                                                                                                                                                        |
| Docs Impact   | N/A             | No new endpoints, env vars, or user-visible behavior in Step 1.                                                                                                                                                 |
| Dependencies  | PASS            | `@testing-library/react-native@^12.4.0` and `eslint@^9.10.0` (Cal's Notes-for-Colby item 17) added. MIT licenses, no surprise transitives.                                                                      |

---

## AppRunner Observable Behavior — T-0003-021b Verification

AppRunner tests pass 7/7 in isolation. The `Dispatch` type change from `(action, state) => void` to `(action) => void` is backward-compatible: AppRunner's `ownerDispatch` was already `(action: A2UIAction) => void` at line 100. The 4-line `_state` removal Colby applied is a clean, no-behavior-change preview of Step 8.

The 4 failing suites in the mobile workspace (`LoadingBubble`, `generate.test`, `Chat/index`, `Home/index`) are pre-existing ADR-0002 untracked files — not Colby's. Verified via `git status --short`.

---

## T-ID Verification — All 27 Mandatory IDs Present

All 27 T-IDs (T-0003-001..022 plus T-0003-006b, T-0003-011b, T-0003-013b, T-0003-013c, T-0003-021b) implemented with specific assertions in their stated test files. No gaps.

## Security-Critical Assertions

**T-0003-022 (`__proto__` pollution defense):** Genuine. `Map.set('__proto__', 'pwn')` writes under literal key without prototype chain traversal. Test asserts `Object.prototype` unchanged AND `next.values.get('__proto__') === 'pwn'` — the round-trip assertion prevents vacuous pass.

**T-0003-012 (set type-mismatch warn-log PII):** Passes `normalizeRow` standard. `expect(payload).not.toHaveProperty('value')` and `expect(JSON.stringify(payload)).not.toContain('hello')`. Mismatched value is excluded.

**T-0003-013 (navigate unknown view warn-log PII):** Passes. Asserts payload does not contain `'spec'`, `'views'`, or `'"type":"Heading"'`. Only `viewId` + `knownViewIds: string[]` logged.

**T-0003-006b (workspace boundary lint runtime):** Implemented as runtime test per NF-2. Uses ESLint `Linter.verify()` against fixture strings with forbidden imports. Seven forbidden patterns each produce `violations.length >= 1` with `ruleId === 'no-restricted-imports'`. Three control-case tests confirm permitted imports produce zero violations. The config is loaded via `require()` of the actual `.eslintrc.cjs` — guard at line 43-49 fails before lint runs if config is deleted/weakened.

`Linter` (legacy-config API) used rather than `ESLint.lintText()` (flat-config API) — compatible with `eslint@^9.10.0` + `.eslintrc.cjs` format. No concern at current version pin.

---

## `useA2UIState` Implementation Review

**Spec-change reset pattern (T-0003-013b):** Implemented as documented React "derived state from props" idiom — dispatch-during-render with a tracking ref, NOT `useEffect`. Lines 60-62. A `useEffect` would show a frame of stale state. Colby followed the right pattern.

**`react-hooks/exhaustive-deps`:** No `eslint-disable` needed. The `loggerRef` `useEffect` at line 81-83 has no dep array (intentional — sync-ref-to-prop pattern). The `onToastRef` update uses correct deps. No hidden bug.

---

## Issues Found

### Issue 1 (Step 5 BLOCKER — design gap to resolve before Counter): Bounds enforcement gap in `dispatch` translation layer

**File:** `packages/a2ui-renderer/src/state/useA2UIState.ts` lines 126-131 and 134-139.

The `increment`/`decrement` cases in the dispatch switch translate to `INCREMENT`/`DECREMENT` internal actions WITHOUT `min`/`max`. The reducer's clamping logic requires those fields. The `A2UIAction` schema for `increment`/`decrement` carries only `{targetId, by?}` — bounds are Counter node properties, not action properties.

**Consequence:** ADR §I's stated behavior — "a `Button.action: increment(counter_id, 100)` on `max:50` clamps to 50" — cannot be implemented through the `dispatch` pathway as currently wired. **T-0003-076b will not pass with this dispatch translation** unless Step 5 introduces a mechanism to pass bounds to the reducer.

**Three options:**

- **(a)** Counter component wraps dispatch to inject bounds from its node spec (a Counter-specific dispatch wrapper, not the standard `Dispatch` type).
- **(b)** New internal `BOUNDED_INCREMENT` action type; hook walks spec for bounds.
- **(c)** Reducer gains access to spec via closure; looks up bounds by `targetId`.

Option (a) is least invasive and consistent with ADR §D ("bounds are on the state, not the UI element"). **Cal must decide this before Colby writes `Counter.tsx`** — raising it now is better than discovering it when T-0003-076b fails.

**Not a Step 1 blocker** — reducer has the correct clamping logic, Step 1's tests all pass.

### Issue 2 (Minor): T-0003-011 hook-level test asserts wrong expected behavior

**File:** `useA2UIState.test.tsx` lines 148-162.

Test labeled `T-0003-011` asserts `expect(result.current.state['c']).toBe(13)` — UNclamped. Comment explains "Without min/max passed, increment is unbounded at the hook level." The real T-0003-011 (clamping) is correctly covered in `reducer.test.ts` at the pure-reducer level. The hook test should be relabeled (or use a different T-ID like T-0003-011-hook-gap) to avoid future-review confusion.

Non-blocking.

---

## Pre-Existing Issues (Out of Scope)

- `apps/mobile/src/screens/AppRunner/index.tsx:291` `firstPublish={true}` hardcoded — ADR-0002 acknowledged.
- `console.error` noise on `["marketplace","handleSuggest"]` in AppRunner tests — ADR-0002 mobile test setup.

---

## Roz's Assessment

Colby's Step 1 implementation is clean. All 27 mandatory T-IDs present, every assertion specific. Security-critical tests do what they claim. `__proto__` defense is genuine (Map round-trip). Warn-log PII tests inspect payload objects. Workspace-boundary lint runs real ESLint against real fixtures.

`useA2UIState` follows the React-documented "derived state from props" pattern correctly.

**One thing to flag before Step 5:** the dispatch translation layer doesn't pass `min`/`max` to the reducer. T-0003-076b will not be implementable without a wiring decision. Cal must resolve before Counter ships. Does NOT block Steps 2, 3, or 4.

Coverage 90%/88.67%. AppRunner 7/7. Renderer 61/61. Type clean. Lint clean.

**Step 2 may proceed.**

— Roz

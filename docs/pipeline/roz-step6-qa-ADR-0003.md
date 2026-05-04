# QA Report — ADR-0003 Step 6: TextInput + Toggle
*Reviewed by Roz — 2026-05-02*

## Verdict: PASS WITH NOTES

| Check | Status | Details |
|---|---|---|
| Type Check | PASS | All 4 workspaces clean. |
| Lint | PASS WITH NOTES | 0 errors. 62 `no-explicit-any` warnings (pre-existing). Zero new warnings in Step 6 code. |
| Tests | PASS | 193/193, 16 suites, 29 snapshots. |
| Coverage | PASS WITH NOTES | 97.32% stmts / 94.25% branches. Both above thresholds. |
| Complexity | PASS | TextInput.tsx 128 LOC, Toggle.tsx 131 LOC. CCN ≤ 5, nesting ≤ 3. |
| Security | PASS | §G-4 PII rule enforced in both component warn-logs. |

## All 21 Mandatory T-IDs Verified

T-0003-082..097 (incl. 088b/c/d, 090b, 095b) all present.

**Critical assertions verified:**
- T-0003-088c (TextInput boolean state): payload contains `{id, expectedType:'string', actualType:'boolean'}`, `payloadStr.not.toContain('true')`, `not.toContain('"value"')`. PII clean.
- T-0003-088d (focus border): `fireEvent(input, 'focus')` → border = `palette.primary`; blur → `palette.border.subtle`. Specific.
- T-0003-095 (Toggle non-boolean): both string and number variants, `actualType` differs, actual value absent from payload.
- T-0003-095b (missing id): `as any` cast, no throw, disabled Switch + warn-log.
- Toggle row min-height 56pt verified by inspection of `styles.row` + T-0003-091 assertion.

## Step 5 Cleanups Closed

- T-0003-078b: at-max Counter, a11y `'increment'` action → dispatch NOT called (atMax guard fires). Specific.
- T-0003-078c: at-min symmetric. Specific.
- `buildCounterBoundsMap` 3 unit tests: List items, Form fields, 3-level Container > Container > Form nesting. Each asserts `map.get(id)` equals exact bounds. Step 5 Notes 2+3 closed.

## `useState` Focus-State Scoping (verified clean)

TextInput.tsx line 60 `useState(focused)` drives ONLY `borderColor` style. Never written via `dispatch`, never read from `state[node.id]`. Same category as Button's Pressable `pressed` callback. Confirmed: display state, not A2UI value state. ADR rule unbroken.

## Coverage Artifacts (non-blocking)

- TextInput.tsx line 105 (`scrollEnabled` JSX ternary): Istanbul JSX-prop-expression artifact. Branches 100% covered.
- Toggle.tsx line 76 (`onValueChange={() => undefined}` on disabled Switch): inert handler, never fires. Coverage artifact, no behavioral consequence.
- render.tsx TextInput/Toggle case branches: deferred to Step 8 (consistent pattern with Container/Button/Counter from prior steps).

## Issues Found

**Note 1 (Low): Toggle.tsx line 76 inert `onValueChange` uncovered.** Coverage artifact only — disabled Switch can't fire valueChange. No remediation needed; trivially closeable in Step 7 if desired.

**Note 2 (Pre-existing): AppRunner worker leak warning in mobile test suite** — unrelated to Step 6. AppRunner 7/7 pass.

No new issues from Step 6 code.

## Roz's Assessment

193/193. 29 snapshots. 97.32%/94.25%. AppRunner 7/7. PII rule enforced correctly on both new components. Step 5 cleanups all closed with specific assertions, not tautological checks.

**Step 7 (Form) may proceed.**

— Roz

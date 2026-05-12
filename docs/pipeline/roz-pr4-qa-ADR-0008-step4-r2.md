# R2 QA Report — ADR-0008 Step 4 Surgical Fix Verification

_Reviewed by Roz — 2026-05-11_

## Verdict: PASS

All 3 R1 findings closed. 100% coverage on `universalLink.ts`.

| Check | Status | Details |
|---|---|---|
| Type Check | PASS | 0 errors in Step 4 scope (DocumentPicker.tsx drift unchanged from R1; ADR-0009 Step 7 concern) |
| Lint | PASS | 0 errors |
| Tests (universalLink) | PASS | 31/31 |
| Tests (full mobile) | PASS | 383/383 across 23 suites (was 381 — exactly +2) |
| Coverage (universalLink.ts) | PASS | 100% statements/branches/functions/lines |
| F1 typecheck | CLOSED | Line 395 has all 4 fields |
| F2 T-0008-101c | CLOSED | malformed URL catch branch exercised |
| F3 T-0008-108b | CLOSED | warm-start reserved-mode covered |
| Scope creep | CLEAN | R2 touches only universalLink.test.tsx |

## F1 — Typecheck Fix

`appConfig({config: {}, projectRoot: '', staticConfigPath: null, packageJsonPath: null})` at line 395 — verbatim as prescribed. Step 4 scope typecheck zero errors.

## F2 — T-0008-101c (line 72 catch branch)

Lines 216-222. Three assertions:
- `'not a url'` — throws `TypeError [ERR_INVALID_URL]`
- `'://broken'` — throws
- `'   '` (whitespace) — throws (`!url` upstream catches empty string `''`; whitespace falls through to `new URL()`)

All three reach the `catch { return null }` branch correctly. T-ID unique globally.

## F3 — T-0008-108b (line 141 warm-start reserved-mode)

Lines 362-388. Uses `capturedUrlListener` (same mock pattern as T-0008-108). URL: `https://canvas.app/m/aBcDeFgHiJkLmNoPqRsTuVwX/view`.

Three specific assertions:
- `expect(onReservedMode).toHaveBeenCalledTimes(1)` — count
- `expect(onReservedMode).toHaveBeenCalledWith({shareId: SHARE_ID, mode: 'view'})` — payload
- `expect(onActiveLink).not.toHaveBeenCalled()` — silence on other callback

NOT tautological. Catches regressions where `mode` is wrong or `shareId` is mangled.

## Scope

R2 modifies exactly one file: `apps/mobile/src/lib/universalLink.test.tsx`. Concurrent workstream drift (ADR-0009 Step 7 in `packages/**`) is not part of this PR.

## Roz's R2 Assessment

All findings closed. Typecheck clean for Step 4. Both advisory tests are present, exercise the correct lines, and have specific assertions. 383 tests, 100% coverage on the new module.

**PASS.** Ellis can commit.

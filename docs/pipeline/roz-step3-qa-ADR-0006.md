# QA Report — ADR-0006 Step 3 (theme + AI capabilities + a11y)

_Reviewed by Roz — 2026-05-09_

## Verdict: PASS WITH NOTES

| Check | Status |
|---|---|
| Type Check (a2ui-renderer) | PASS — clean |
| Type Check (mobile) | PASS — AppRunner unaffected |
| Tests | PASS — 317/317, 32 suites |
| Coverage (Step 3 files) | PASS WITH NOTES — `aiCapabilitiesCheck.ts` at 0% (mocked at boundary) |
| Scope creep | PASS |
| AppRunner unchanged | PASS |
| useEffect exceptions | PASS WITH NOTES (§K amendment needed for `useReducedMotion`) |
| ESLint enforcement | NOTE — pre-existing flat config precedence issue |

## Per-Test-ID Coverage

All 10 ADR-spec'd T-IDs (T-029..038a) implemented + 2 bonus tests:
- `useTheme` outside provider throws (clean error message)
- `useRendererStateContext` outside provider throws (closes Step 2 Issue 3 coverage gap)

T-038a (act() flush pattern) confirmed correct: render synchronously → assert pre-resolve `false` → `await act(async () => { await Promise.resolve() })` → assert post-resolve, dispatcher called once (no remount). MT-04 closed.

## Findings

### Finding 1 (Advisory) — `aiCapabilitiesCheck.ts` 0% coverage

The provider tests mock `aiCapabilitiesCheck` at the module boundary, so the actual `require('react-native-ai-apple')` logic is never executed. Four code paths exist (success, no-foundation-models, os-too-old, check-failed); only 3 are exercised at the provider level (T-032, T-033, T-035). The `os-too-old` path (`isAvailable()` returns `false`) has no test at any layer.

**Resolution:** add a dedicated `aiCapabilitiesCheck.test.ts` before Step 10 using `jest.doMock` to simulate the four `require()` outcomes. Not a Step 4 gate.

### Finding 2 (Advisory) — §K amendment required for `useReducedMotion`

ADR §K names a single `useEffect` exception (`AICapabilitiesProvider`). Colby added a second exception for `useReducedMotion` in `src/v0/a11y/` and widened the ESLint override accordingly. Technical justification is sound (async `AccessibilityInfo` subscription).

**Resolution:** Cal should file a §K amendment naming `useReducedMotion` as the second documented exception, with the source comment as justification. Not a Step 4 gate.

### Finding 3 (Pre-existing) — ESLint flat config precedence

`.eslintrc.cjs` package-local config is overridden by root `eslint.config.mjs` (ESLint 9 flat config). The useEffect ban + workspace boundary rules are documentation-only in workspace lint runs. Pre-existing limitation; not Step 3's concern.

**Resolution:** Cal decides enforcement strategy (move rules to root flat config OR accept documentation-only status). Should land before Step 10.

### Finding 4 (Advisory) — File-split deviation

ADR's "Files to create" specifies `useTheme.ts` and `useAICapabilities.ts` as separate files. Colby co-located them with their providers. Public API identical; the hooks depend on private contexts in the same file (separation would require exporting context). **Acceptable.**

## ESM / CLAUDE.md Compliance

All clean. ESM `.js` extensions, no legacy imports, no `console.log`, `@app-creator/design-system: workspace:*` in package.json.

## Notes for Step 4 (Layout tier)

1. **AccessibilityWrapper hit-target enforcement** — non-interactive layout containers may not need ≥44pt enforcement. Confirm with Cal before Step 5 (Inputs).
2. **NodeRenderer defensive branch** — Step 4's NodeRenderer must include `default` calling `host.onUnknownNodeType`. The hook is in place (`hostCallbacks.ts`).
3. **T-038a flush pattern** — extract to `src/v0/__test-utils__/flushEffects.ts` before test count grows further.

## Roz's Assessment

317/317. Both typechecks clean. All 10 ADR-spec'd T-IDs present + Step 2 bonus requests delivered. The `aiCapabilitiesCheck.ts` zero-coverage is explainable (mocking strategy correct for an optional native dep). The `useReducedMotion` §K expansion is the right technical call; just needs paperwork.

**Step 4 unblocked.**

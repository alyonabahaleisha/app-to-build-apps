# QA Report R2 — ADR-0011 Phase 2 PR 1 SignInScreen (Surgical Fix Verification)

_Reviewed by Roz — 2026-05-10_

## Verdict: PASS

Both blockers closed correctly. F3 and F6 fold-ins clean. No new issues.

## Fix Verification

### F1 — Production guard on `__setEnvOverrideForTests`

`getAuthProvider.ts:75-82` — guard at top: `if (process.env.NODE_ENV === 'production') { return }`. **Tighter than minimum:** blocks both override mutation AND cache reset in production (a naive guard blocking only the override would have left a partial vector). Colby got both.

T-0011-162 at `getAuthProvider.test.ts:32-56` — pre-sets override to 'magic-link', resets cache, mutates NODE_ENV to 'production', calls `__setEnvOverrideForTests('apple')`, restores NODE_ENV, asserts `providerAfterGuard.name === 'magic-link'`. If guard were absent, override would have changed to 'apple' → siwaProvider. Specific enough to catch regression.

### F2 — Footer link touch targets ≥44pt

`SignInScreen.tsx:229, :249` — both Pressables: `hitSlop={{top: 15, bottom: 15, left: 8, right: 8}}`. Math: 14pt line-height + 15 + 15 = **44pt**. Compliant.

T-0011-150 — asserts `top + bottom >= 30` (14 + 30 = 44pt). Test casts hitSlop to concrete `{top, bottom, left, right}` shape — regression to numeric `hitSlop={4}` would throw runtime cast error AND fail assertion. Tight.

2 snapshots updated for shape change; no other drift.

### F3 — useMemo → useEffect

`SignInScreen.tsx:82-89` — `useEffect` with `[isMagicLink]` dependency. Side-effect correctly isolated. Comment explains rationale.

### F6 — T-0011-155 (truly unset) vs T-0011-156 (empty string)

T-0011-155: calls `__setEnvOverrideForTests(null)` directly (bypassing `renderScreen`'s `opts.env` gate), then `renderScreen()` with no env key. `_testEnvOverride === null` → `readEnvFlag` reads `process.env.EXPO_PUBLIC_AUTH_PROVIDER` via bracket notation → `undefined` → `''` → `'magic-link'`. **Genuine "unset env var" code path.**

T-0011-156: calls `renderScreen({env: ''})` → `__setEnvOverrideForTests('')` → `_testEnvOverride === ''` (not `null`) → `readEnvFlag` takes override branch and returns `''` directly. **Different branch.**

The null-vs-empty-string seam works correctly given `_testEnvOverride !== null` guard in `readEnvFlag`.

## Pre-existing Observation

`services/api` test suite: 341 failures across 17 suites. All DB-integration requiring live Postgres (testcontainers unavailable in this env). Zero `services/api/` files touched by this PR. Not introduced; not concern.

## Tests

- Mobile: 223 passed, 1 pre-existing skip, 0 failed
- Renderer: 881 passed
- Typecheck: clean across all 6 packages

## Roz R2 Assessment

Both blockers closed correctly. F1 guard pattern is tighter than minimum — blocks both override AND cache reset in production, the right call. T-0011-162 specific enough to catch regression. F2 hit-target math correct, assertion handles both geometry + shape constraint. F6 differentiation genuine.

**Ellis can commit.**

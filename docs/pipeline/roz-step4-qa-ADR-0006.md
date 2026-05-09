# QA Report — ADR-0006 Step 4 (Layout tier + initial NodeRenderer)

_Reviewed by Roz — 2026-05-07_

## Verdict: PASS WITH NOTES

| Check | Status | Details |
|---|---|---|
| Type Check | PASS | `pnpm --filter @app-creator/a2ui-renderer typecheck` — clean |
| Lint | PASS | 0 errors, 64 warnings (all pre-existing `any` in `src/legacy/` tests; 0 new in `src/v0/`) |
| Tests (legacy) | PASS | 211/211 via `pnpm --filter @app-creator/a2ui-renderer test` |
| Tests (V0) | PASS | 150/150 via `pnpm --filter @app-creator/a2ui-renderer test:rn` |
| Coverage (Step 4 files) | PASS WITH NOTES | `NodeRenderer.tsx` 100%. Layout tier 94.64% stmt. `Screen.tsx` 78.57% — uncovered branches noted below |
| Snapshots | PASS | 10 snapshots (5 components × 2 stances), all in `__snapshots__/`, all passing |
| Complexity | PASS | All new files well within limits; longest function `buildSafePadding` is 12 lines; deepest nesting 2 levels |
| DB Migrations | N/A | |
| Security | PASS | No hardcoded values, no `eval`, no `fetch`, no `console.log` in any `src/v0/` file |
| CI/CD Compat | PASS WITH NOTES | `pnpm test` at root does not invoke V0 tests — see Finding 1 |
| Docs Impact | N/A | No new endpoints, env vars, or user-visible behavior |
| Dependencies | PASS | `react-native-safe-area-context: >=4.0.0` added as peer dep; appropriate version floor, no new prod deps |

---

## T-ID Coverage — Step 4 (T-0006-039..063)

All 25 ADR-spec'd T-IDs implemented and passing.

| T-ID | Description | File | Status |
|---|---|---|---|
| T-0006-039 | ScreenRenderer at productive×focus | `Screen.test.tsx` | PASS |
| T-0006-040 | ScreenRenderer at expressive×health | `Screen.test.tsx` | PASS |
| T-0006-041 | SectionRenderer at productive×focus | `Section.test.tsx` | PASS |
| T-0006-042 | SectionRenderer at expressive×health | `Section.test.tsx` | PASS |
| T-0006-043 | StackRenderer at productive×focus | `Stack.test.tsx` | PASS |
| T-0006-044 | StackRenderer at expressive×health | `Stack.test.tsx` | PASS |
| T-0006-045 | RowRenderer at productive×focus | `Row.test.tsx` | PASS |
| T-0006-046 | RowRenderer at expressive×health | `Row.test.tsx` | PASS |
| T-0006-047 | CardRenderer at productive×focus | `Card.test.tsx` | PASS |
| T-0006-048 | CardRenderer at expressive×health | `Card.test.tsx` | PASS |
| T-0006-049 | Screen snapshot at productive×focus | `Screen.test.tsx` | PASS |
| T-0006-050 | Section snapshot at productive×focus | `Section.test.tsx` | PASS |
| T-0006-051 | Stack snapshot at productive×focus | `Stack.test.tsx` | PASS |
| T-0006-052 | Row snapshot at productive×focus | `Row.test.tsx` | PASS |
| T-0006-053 | Card snapshot at productive×focus | `Card.test.tsx` | PASS |
| T-0006-054 | Screen snapshot at expressive×health | `Screen.test.tsx` | PASS |
| T-0006-055 | Section snapshot at expressive×health | `Section.test.tsx` | PASS |
| T-0006-056 | Stack snapshot at expressive×health | `Stack.test.tsx` | PASS |
| T-0006-057 | Row snapshot at expressive×health | `Row.test.tsx` | PASS |
| T-0006-058 | Card snapshot at expressive×health | `Card.test.tsx` | PASS |
| T-0006-059 | Screen with invalid `safeArea` rejected at schema parse | `Screen.test.tsx` | PASS |
| T-0006-060 | Stack.children at MAX_NESTING_DEPTH=8 renders correctly | `Stack.test.tsx` | PASS |
| T-0006-061 | Card.elevation resolves to correct shadow recipe per stance | `Card.test.tsx` | PASS |
| T-0006-062 | NodeRenderer discriminates 5 layout types | `NodeRenderer.test.tsx` | PASS |
| T-0006-063 | NodeRenderer unknown type calls `host.onUnknownNodeType` + returns null | `NodeRenderer.test.tsx` | PASS |

---

## Checklist Results

1. **361 tests pass** — VERIFIED (211 legacy via `test`, 150 V0 via `test:rn`). Note: `pnpm --filter @app-creator/a2ui-renderer test` only yields 211; `test:rn` must be invoked separately for V0. See Finding 1.
2. **All 25 T-IDs implemented** — VERIFIED.
3. **5 layout components, correct prop signatures** — VERIFIED against `canvas-v0-ux.md §Component Specs`. All props match the UX doc table exactly: Screen (`padding`, `safeArea`, `children`), Section (`title`, `caption`, `padding`, `children`), Stack (`gap`, `align`, `children`), Row (`gap`, `align`, `justify`, `wrap`, `children`), Card (`elevation`, `padding`, `radius`, `children`).
4. **`Screen.safeArea` uses `useSafeAreaInsets`** — VERIFIED. `Screen.tsx` line 22 imports from `react-native-safe-area-context`; `package.json` lists `react-native-safe-area-context: >=4.0.0` as peer dep.
5. **`Card.elevation` resolves to correct shadow recipes** — VERIFIED. `flat | raised | floating` map to explicit `SHADOW_RECIPES` constants exported from `Card.tsx`. T-0006-061 asserts `shadowRadius`, `shadowOpacity`, and `shadowOffset` values individually.
6. **NodeRenderer default branch** — VERIFIED. Uses optional chaining `host.onUnknownNodeType?.()` so it works with and without a HostProvider. T-0006-063 asserts the type string is passed and `toJSON()` returns null.
7. **`useStance()` extension** — VERIFIED ACCEPTABLE. `RendererStanceContext` wraps `RendererThemeContext` in the provider tree; the Step 3 `useTheme()` tests still pass unchanged. Architectural justification stands: `ResolvedTheme` from the design-system carries no stance label, and components need raw stance for `LAYOUT_DEFAULTS` lookup. The hook throws the same guard pattern as `useTheme()`.
8. **No `useEffect` in layout components** — VERIFIED. `grep -rn "useEffect" packages/a2ui-renderer/src/v0/components/` returns empty.
9. **No Reanimated/FlatList in Step 4** — VERIFIED. `grep -rn "Animated\|FlatList" packages/a2ui-renderer/src/v0/components/` returns empty.
10. **Snapshot tests** — VERIFIED. 5 `__snapshots__/` files, each with 2 entries (productive×focus + expressive×health). All 10 pass.
11. **`flushEffects` extracted** — VERIFIED. `__test-utils__/flushEffects.ts` exists, correctly implements the `act()` flush pattern from Step 3 note.
12. **HostContext minimal stub** — VERIFIED. `HostProvider` and `useHost()` provide callbacks to the renderer tree. `FALLBACK_HOST` returns no-ops so layout-only tests don't require a `HostProvider`. `onUnknownNodeType` is correctly optional in both `HostCallbacks` and `FALLBACK_HOST`.
13. **No legacy imports in v0 files** — VERIFIED. One comment reference in `reducer.ts` line 363 (a code comment, not an import).
14. **No scope creep** — VERIFIED. `src/v0/components/` contains only `NodeRenderer.tsx` and `layout/` (5 files). No Typography, Display, Input, List, or nav components.
15. **AppRunner unchanged** — VERIFIED. `apps/mobile/src/screens/AppRunner/index.tsx` imports from `@app-creator/a2ui-renderer` (the package root), which still re-exports `src/legacy/`.

---

## Issues Found

### Finding 1 (Advisory) — V0 tests not invoked by `pnpm test`

`pnpm test` at the repo root runs `pnpm -r --parallel test`, which invokes the `"test": "jest"` script in `packages/a2ui-renderer`. That script uses `jest.config.js`, which has `testPathIgnorePatterns: ['/src/v0/']`. The 150 V0 tests only run via `"test:rn": "jest --config jest.config.rn.cjs"`, which is not wired into any CI workflow. The ADR explicitly endorses two configs (line 563, 1518) and this mirrors the pre-existing Step 3 pattern, so it is not Colby's fault. However, no CI job verifies V0 tests on PR.

**Impact:** 150 tests are structurally invisible to CI. A regression in a V0 layout component would not be caught until someone manually runs `test:rn`.

**Resolution (pre-Step 10):** Either wire `test:rn` into the CI pipeline, or fold both configs into a single `test` script invocation. One option: `"test": "jest && jest --config jest.config.rn.cjs"`. Not a Step 5 gate, but should land before Step 10.

### Finding 2 (Advisory) — `Screen.tsx` buildSafePadding `top`/`bottom`/`none` arms untested at render level

Coverage report: `Screen.tsx` 78.57% statements. The `'top'`, `'bottom'`, and `'none'` arms of `buildSafePadding` have zero render-path test coverage. T-0006-059 exercises them at schema-parse level only. The `SCREEN_NODE` fixture uses `safeArea: 'both'` exclusively.

**Impact:** A typo in any of the three uncovered arms would not be caught.

**File:** `packages/a2ui-renderer/src/v0/components/layout/Screen.tsx` lines 45–52.

**Resolution:** Add three render-path tests to `Screen.test.tsx`. Low effort; Step 5 can pick this up since `renderWithTheme` is wired.

### Finding 3 (Pre-existing) — ESLint flat config precedence

Same as Step 3 Finding 3. The `useEffect` ban and workspace boundary rules in `packages/a2ui-renderer/.eslintrc.cjs` are documentation-only under ESLint 9 flat config. No new Step 4 dimension.

---

## Verification Checklist Results

**useStance does not break Step 3 useTheme tests:** CONFIRMED. `RendererThemeProvider.test.tsx` passes including all Step 3 IDs (T-0006-030, T-031, T-038, both "outside provider" throw tests).

**Defensive branch wired correctly:** CONFIRMED. `NodeRenderer.tsx` line 41: `host.onUnknownNodeType?.((node as {type: string}).type)`. Optional chaining is correct here — `onUnknownNodeType` is declared optional in `HostCallbacks`. T-0006-063 third sub-test explicitly verifies no throw when `onUnknownNodeType` is absent from host.

**Failure:happy ratio (Step 4):** ADR says 2 failure, 12 happy, 1 boundary, 10 snapshot = 25 total. Meets the spirit of the rule for layout primitives with no real failure modes beyond schema rejection.

---

## CI/CD Verification Required: Yes

V0 test suite (`test:rn`) is not wired into any CI workflow. Finding 1 above.

## Documentation Update Required: No

Step 4 adds no new endpoints, env vars, or user-visible behavior. `useStance` is a renderer-internal hook; no public API docs affected.

---

## Roz's Assessment

211/211 legacy. 150/150 V0. Typecheck clean. All 25 T-IDs present and passing. The defensive branch is correctly wired with optional chaining that matches the optional type on `HostCallbacks.onUnknownNodeType`. The `useStance()` addition is architecturally sound — `ResolvedTheme` genuinely does not carry a stance label, and the context wrapping order (Stance outside Theme) means the provider tree is unambiguous. The `flushEffects` extraction was done per my Step 3 note. No `useEffect` in any layout component. No Reanimated or FlatList. No scope creep. AppRunner is unchanged.

Two findings worth tracking: the CI gap on V0 tests (Finding 1) is the larger concern — 150 tests are invisible to the pipeline and will stay that way unless someone fixes the `test` script or adds a CI step. The `buildSafePadding` branch gap (Finding 2) is a legitimate coverage hole that belongs on the Step 5 task list.

Neither finding gates Step 5. The `PASS WITH NOTES` verdict reflects two advisory items, not blockers.

**Step 5 unblocked.**

---

## Notes for Step 5 (Typography + Display = Milestone A)

1. **Pick up Finding 2** — add three render-path tests to `Screen.test.tsx` for `safeArea: 'top' | 'bottom' | 'none'`. Cheap; closes the coverage hole before Milestone A demo.
2. **Snapshot count grows fast** — typography (3) + display (4) = 7 components × 2 register pairs = 14 snapshots in Step 5 alone. Keep the snapshot-write convention consistent.
3. **Stat / Badge / Chip / Avatar accessibility** — these are non-interactive but VoiceOver still reads them. `accessibilityRole="text"` for Stat/Badge/Chip; `accessibilityRole="image"` + meaningful `accessibilityLabel` for Avatar.
4. **Heading vs Body vs Caption** — Sable's UX doc has explicit type-scale tokens per stance. Resolve via `theme.typography` (or whatever the design-system surface is). Don't hard-code font sizes.
5. **Milestone A demo target** — at the end of Step 5, the renderer should be able to mount a hardcoded Screen + Section + Heading + Body + Card composition. Sample-spec demo on iOS Simulator is the test.

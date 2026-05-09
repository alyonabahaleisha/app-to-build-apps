# QA Report — ADR-0006 Step 1 (Round 2 / Re-Run)

_Reviewed by Roz — 2026-05-08_

## Verdict: PASS WITH NOTES

All 3 rev-0 blocking issues closed.

| Check | Status |
|---|---|
| Type Check (a2ui-renderer) | PASS |
| Type Check (mobile) | PASS |
| Tests | PASS — 211/211, 18 suites, 31 snapshots |
| 53 git renames | PASS — `grep -c "^R"` = 53 (51× R100, 1× R098, 1× R096 = the 3 content-edit files) |
| `src/legacy/index.ts` staged | PASS — `A` |
| `@types/seedrandom` exact pin | PASS — `"3.0.8"` no caret |

## Issue Closure

- **rev-0 Issue 1 (file moves not git renames):** CLOSED. 53 R-entries; blame continuous.
- **rev-0 Issue 2 (`src/legacy/index.ts` untracked):** CLOSED. Staged as new file.
- **rev-0 Issue 3 (`@types/seedrandom` caret):** CLOSED. Pinned exact `3.0.8`.

## Content Edit Integrity Post-Rework

All 3 content edits preserved through the rename rework:

- Toggle.test.tsx — non-null assertions on `mock.calls[0]!`. Verified.
- render.test.tsx — path fixes (`../../../../`). Resolves to repo root files; verified.
- eslint-boundary.test.ts — path fix (`../../../`). Resolves to package `.eslintrc.cjs`; verified.

## New Production Dependencies (all ADR-authorized)

| Package | Pinned Version | Status |
|---|---|---|
| `seedrandom` | `3.0.5` | PASS |
| `expo-haptics` | `14.0.1` | PASS — matches mobile |
| `@react-navigation/native-stack` | `7.14.12` | PASS |
| `@gorhom/bottom-sheet` | `5.2.13` | PASS |
| `@shopify/flash-list` | `2.3.1` | PASS |
| `react-native-keyboard-controller` | `1.21.7` | PASS |
| `react-native-ai-apple` | `0.1.0` (optionalDependencies) | NOTE — not on npm |

## Notes for Ellis's Commit Narrative (cosmetic, non-gating)

1. **`expo-haptics` peerDep → dep promotion.** Was `peerDependencies: {expo-haptics: ">=13.0.0"}`, now `dependencies: {expo-haptics: "14.0.1"}`. V0 renderer owns haptics internally; host no longer needs to provide.
2. **`expo-image-picker@14.7.1` pre-staged.** Not consumed in Step 1; pre-staged for Step 8 ImagePicker compound component. Exact pin, MIT.
3. **`react-native-ai-apple@0.1.0` optional dep resolution source unspecified.** Document where this resolves from (private registry, local workspace, or future publish) so CI clean installs don't silently skip it.

## Roz's Assessment

All three rev-0 blocking issues closed. The rename rework is clean — 53 git renames, blame intact, same 211 tests passing with the same assertions, same count. Content-edit files survived the rework with their assertions intact, and path resolution arithmetic checks out for the new `src/legacy/state/` location.

New production deps are ADR-authorized and exact-pinned. The `react-native-ai-apple` optionality is the right call. The `expo-image-picker` pre-staging is tidy if documented in the commit.

**Step 1 closed. Step 2 may proceed.**

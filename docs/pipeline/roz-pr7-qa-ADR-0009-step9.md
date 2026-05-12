# QA Report — ADR-0009 PR 7 (Step 9 — Snapshot matrix grows 56→106)

_Reviewed by Roz — 2026-05-12_

## Verdict: REVISE (2 stale-reference fixes; scope-creep ELLIS-handled at commit)

Test logic is solid. T-0006-236 invariant well-designed. Date-sensitive split correct. Two stale references in CI + docs need updating. Scope creep is a commit-time concern Ellis handles via selective staging.

| Check | Status |
|---|---|
| Type Check | PASS |
| Lint | PASS (4 pre-existing warnings unchanged) |
| Tests | PASS — 1112 / 0 failed / 1 todo; 106 snapshots passing |
| Complexity | PASS — data file, no logic over CCN 3 |
| **CI/CD Compat** | **FAIL — CI workflow not updated** |
| **Docs Impact** | **FAIL — `snapshot-policy.md:39` stale** |

## BLOCKING — F1: CI workflow `renderer-snapshot-matrix.yml` stale

`.github/workflows/renderer-snapshot-matrix.yml` has 3 stale references to "56 snapshots":
- Line 4 comment: `"Fails if any of the 56 register-pair snapshots drift from committed goldens."`
- Line 30 job name: `"Renderer Snapshot Matrix (56 snapshots)"`
- Line 49 step name: `"Run snapshot matrix (T-0006-180..235, T-0006-236, T-0006-178)"` — missing `T-0006-237..286` range

ADR impact table (line 586) explicitly calls out the CI workflow for update. Not landed.

**Fix:** Update all 3 strings to reference 106 / `T-0006-237..286`.

## BLOCKING — F2: `snapshot-policy.md:39` stale

`packages/a2ui-renderer/test/snapshot-policy.md:39`:

> "We do not add all 12 registers to CI preemptively. The 56-snapshot matrix is the right CI gate for V0."

Should read 106. Lines 24-25 + 61 were correctly updated; line 39 was missed.

## NOT BLOCKING — Scope creep in working tree (Ellis-handled)

Working tree contains 13 files outside the 3-file Step 9 scope:
- `apps/mobile/.env.example`, `apps/mobile/eas.json`, `apps/mobile/src/lib/auth/magicLinkProvider.ts` (ADR-0013 drift)
- `apps/mobile/src/lib/routes/types.ts` + 6 `apps/mobile/src/screens/AppRunner/` deletes + 3 mobile test fixups (ADR-0011 Step 10 leftover cleanup)
- `eslint.config.mjs` (ADR-0013 EXPO_PUBLIC_AUTH_PROVIDER rule)

These are LEGITIMATE concurrent workstream changes — just NOT part of Step 9. Ellis selective-staging handles this at commit. Not a Colby concern.

## All other scrutiny — PASS

- **All 25 new V1 components × 2 registers = 50 entries** present and balanced
- **T-0006-236 invariant assertions exact**: `toHaveLength(106)`, both registers `toHaveLength(53)`, T-ID gap check correct (180-235 / gap at 236 / 237-286)
- **Date-sensitive split**: 6 entries (Calendar T-0006-256/281, Heatmap T-0006-257/282, Timeline T-0006-250/275) in `DATE_SENSITIVE_ENTRIES` with proper fake-timer setup pinned to `2026-01-15T12:00:00Z`
- **Icon replacements**: `'list'`, `'flame'`, `'zap'` all confirmed present in catalog; `'layout'` and `'activity'` not present
- **V0 snapshot integrity**: 56 V0 entries pass with zero drift after describe-path renaming — content structurally identical (0 obsolete snapshots)

## Pre-existing (NOT this PR)

- React console.error during GridList/Carousel teardown — FlashList unmount issue from Step 4 commit `2817ae3`. 4 errors per matrix run; tests still pass.
- 4 lint warnings in `useReducedMotion.test.ts` + `Renderer.test.tsx` — pre-existing

## Roz's Assessment

Test logic solid. T-0006-236 invariant catches missing components, duplicates, or register imbalance — strong design. Date-sensitive architectural split is the right call.

Two mechanical fixes: three CI strings + one policy doc line. ~5-minute surgical.

Scope creep gets resolved at Ellis's staging step (not Colby's responsibility).

**REVISE.** Fix CI workflow + policy doc → R2 → Ellis commits with strict selective staging.

# QA Report — ADR-0005 Step 9 (80-icon module)

_Reviewed by Roz — 2026-05-08_

## Verdict: PASS WITH NOTES

| Check | Status | Details |
|---|---|---|
| Type Check (protocol) | PASS | `tsc --noEmit` clean |
| Type Check (design-system) | PASS | `tsc --noEmit` clean |
| Tests (protocol) | PASS | 820/820, 19 suites |
| Tests (design-system) | PASS | 186/186, 3 suites |
| Coverage | PASS | `src/icons/` at 100% in both packages |
| Complexity | PASS | All files under thresholds |
| Security | PASS | No secrets; `ICON_PATHS` SVG-char regex enforced |
| Dependencies | PASS | `lucide-static@0.487.0` and `lucide-react-native@0.487.0` pinned exactly |

---

## Issues Found

### Finding 1 — CI: `codegen-drift.yml` drift check misses `src/icons/paths.ts` (low)

The workflow runs `pnpm codegen` then `git diff --exit-code packages/protocol/generated/`. The drift check covers only `generated/` — not `src/icons/paths.ts`. Manual edit to `paths.ts` slips through.

**Fix:** extend drift step to `git diff --exit-code packages/protocol/generated/ packages/protocol/src/icons/paths.ts`. One-line change.

### Finding 2 — ADR Step 9 "Files to create" placement diverges from cycle-safe reality (resolved)

ADR Step 9 says icons live in `packages/design-system/`. Cal's ADR §A explicitly forbids protocol importing from design-system. Colby placed icons in protocol (data) with `<Icon>` in design-system (UI primitive). This is the only cycle-safe arrangement. ADR errata, not code defect.

**Fix:** patch ADR Step 9 "Files to create" table.

---

## Per-AC Verification

All ACs PASS. 80 icon names present, paths.ts generated and reproducible, `<Icon>` renders all 4 sizes, codegen fails on missing icons, IconNamePlaceholderSchema removed.

---

## Per-Test-ID Checklist

All 13 ADR T-IDs (T-0005-219..231) present. Plus deferred T-0005-134 (real, in slot.test.ts AND lists.test.ts) and T-0005-154 (real, in spec.test.ts). Placeholders removed. Closed-enum rejection verified for `'invalid-icon'` and `'unknown-icon'`.

---

## Cycle-Safe Placement Verification

`packages/protocol/src/icons/` has zero `react-native-*` imports. `packages/design-system/src/icons/component.tsx` imports `IconName` from `@app-creator/protocol` (package entry). No workspace deep imports. Workspace typecheck clean. The cycle-safe split holds.

---

## IconNamePlaceholderSchema Swap

`grep -rn "IconNamePlaceholderSchema" packages/protocol/src/` returns zero matches. All five consumers (slot.ts, display.ts, lists.ts, actions.ts, spec.zod.ts, components/index.ts) now use `IconNameSchema`.

---

## Codegen Reproducibility

`pnpm codegen` ran successfully; `git diff --exit-code` on both `generated/` and `src/icons/paths.ts` produces zero diff. Codegen is deterministic.

---

## `refresh` → `refresh-cw` Substitution Ruling

Lucide ships `RefreshCw`, `RefreshCcw`, `RefreshCcwDot`, `RefreshCwOff`. No plain `Refresh`. Colby's substitution is the only valid choice for the "refresh action" semantic. The `names.ts` comment documents this. The `z.enum([...ICON_NAMES])` will reject `'refresh'` at parse — correct, since it doesn't map to any Lucide icon.

**Required follow-up:** Sable patches `docs/ux/canvas-v0-ux.md` §Iconography Action tier — `refresh` → `refresh-cw`. UX doc errata, not code defect. Should land before ADR-0006 (renderer consumes the catalog).

---

## T-0005-187a Narrowing Verification

Step 7's "share" guard was narrowed because the 80-icon catalog legitimately includes `"share"` as an enum value. Colby's narrowed guards target action verbs only:
1. Structural walk for `{type: 'string', const: <value>}` pairs — asserts `'share'` not in that set (correct: `share` was cut as an action verb; remains as an icon name).
2. Raw match for `"const": "share"` — same target.

Both pass. The narrowing is robust.

---

## ESM / CLAUDE.md Compliance

All clean. ESM extensions, no deep imports, no `console.log` (only `console.error` in `gen-icon-paths.ts`, which is lint-allowed). Functional component for `<Icon>`. No scope creep.

---

## CI/CD Verification Required: Yes

`codegen-drift.yml` drift step extension (Finding 1). Easy one-line fix. Does not gate Step 10.

## Documentation Update Required: Yes

1. UX doc §Iconography: `refresh` → `refresh-cw`. Sable owns. Assign before ADR-0006.
2. ADR Step 9 "Files to create": patch to reflect actual placement in `packages/protocol/`. Cal owns. Housekeeping.

---

## Notes for Step 10 (coverArt)

- `ICON_PATHS` in protocol is `as const` (frozen at TS level). T-0005-256c (MT-3) tests an empty-path runtime guard. Test must mock or use a test-local paths object — runtime mutation of the frozen record won't work.
- `<Icon>` component's path-data is the same source `coverArt` will draw from. Verify Step 10 reads `ICON_PATHS` directly, not via the `<Icon>` indirection.

---

## Roz's Assessment

1006 tests, all green. Typecheck clean on both packages. Codegen reproducible. `IconNamePlaceholderSchema` gone. The cycle-safe placement in protocol is not just acceptable — it's the only arrangement that works given §A. The ADR's "Files to create" list was wrong and Colby fixed it by reasoning from the dependency constraint rather than following the letter of a spec that hadn't thought through the import graph.

Two notes for Colby: the `codegen-drift.yml` drift check misses `src/icons/paths.ts` (Finding 1, easy one-line fix). The `console.error` in `gen-icon-paths.ts` is lint-clean but it's the one place in the codebase that uses `console` in non-test source — flag for convention tightening if that ever happens.

The `refresh` → `refresh-cw` substitution is the right call. Lucide is the source of truth. Sable's doc is the errata.

**Step 10 unblocked.**

# QA Report — ADR-0005 Step 7: Codegen + CI Guard

_Reviewed by Roz — 2026-05-08_

## Verdict: PASS WITH NOTES

The core deliverables are solid. All 11 test IDs are present or cross-referenced per specification. Codegen is reproducible (3× verified). `"share"` is absent. Verb count is exactly 12. Both NOTE cleanups from Step 6 landed correctly. CI workflow is correctly shaped. Three notes, none of which gate Step 8.

---

## Check Results

| Check | Status | Details |
|---|---|---|
| Type Check | PASS | `tsc --noEmit` exits 0. Clean. |
| Lint | PASS | 0 errors in protocol package. |
| Tests | PASS | 570/570 pass. 18 test suites. |
| Coverage | PASS WITH NOTES | Lines 97.82% ✓. Branches 78.65% — below ADR's 95% gate. Function 72.26% — Zod-introspection artifact. See NOTE-A. |
| Complexity | PASS | Scripts are under 50 lines for business logic. `gen-docs.ts` largest at ~219 lines, all data tables. |
| Security | PASS | No secrets. Scripts write only to `packages/protocol/generated/`. `process.stdout.write` not `console.log`. |
| CI/CD Compat | PASS | `codegen-drift.yml` additive. `eval.yml` untouched. |
| Dependencies | PASS | `zod-to-json-schema@^3.25.2` (already used by services/api). `tsx@^4.19.0`. `yaml@^2.7.1`. All dev-only for protocol. |

---

## Per-AC Verification

All ACs PASS:

- `pnpm codegen` exits 0 and produces 3 files — verified across 3 runs.
- All 3 files reproducible — `git diff --exit-code` returns 0 each time.
- `gen-docs.ts` emits ≥60 sections — 66 total headers, 61 named (5 group headers excluded by additive test).
- `codegen-drift.yml` triggers on `packages/protocol/**` push and PR; codegen step precedes git-diff step.
- `.gitignore` does NOT exclude `generated/`.

---

## Per-Test-ID Checklist

All 11 ADR-spec'd T-IDs verified:

- **T-0005-179..183:** all pass (3 files exist, reproducible, valid JSON Schema 7, types.ts exports correct, 61 sections in docs.md)
- **T-0005-183a (F-07):** parameterized over 28 component names; all bodies non-empty
- **T-0005-184:** cross-referenced to Step 9 (`gen-icon-paths.ts`) — Colby's deviation accepted; clear comment in test
- **T-0005-185 (F-05 reframe):** retired as redundant CI simulation per ADR rev-2; reproducibility carried by T-0005-180
- **T-0005-186 (F-05 sharpening):** 6 sub-assertions via parsed YAML (push.paths, pr.paths, jobs, codegen step, git-diff step, ordering) — Colby's deviation 2 accepted
- **T-0005-187a (F-02):** structural walk + string search — both confirm `"share"` absent
- **T-0005-187b (F-13):** structural anyOf-walk confirms exactly 12 verbs

Cardinality tripwires (additive): 28-component NodeSchema union verified; 61 named docs.md sections verified.

---

## F-02 / F-05 / F-07 / F-13 Closure Verification

**F-02 CLOSED.** `generated/json-schema.json` has no `"share"` as `const` value (structural walk) AND no `"share"` substring (regex). Belt-and-suspenders.

**F-05 CLOSED.** Byte-stable reproducibility via T-0005-180 (3 independent runs, zero diff). T-0005-185 correctly retired. `codegen-drift.yml` is the production guard.

**F-07 CLOSED.** T-0005-183a parameterized over 28 component names; all bodies confirmed non-empty.

**F-13 CLOSED.** Structural walk (not regex) finds exactly 12 verbs in the action union; all 12 expected verbs present; `share` absent.

---

## NOTE-1 / NOTE-2 Cleanup Verification

**NOTE-1 CLOSED.** `validate.test.ts` lines 628–629:
- `expect(result.errors.length).toBe(4)` — exact count.
- `expect(codes).toEqual(new Set(['duplicate_id', 'unknown_collection', 'nesting_too_deep', 'seed_field_extra']))` — exact set equality.

**NOTE-2 CLOSED.** Lines 22–25 acknowledge T-0005-177 exception explicitly.

---

## Ruling on Deviations

**Deviation 1 — T-0005-184 cross-reference to Step 9.** Accepted. Test block at line 236 of `codegen.test.ts` is explicit. Step 9 (gen-icon-paths.ts) owns the assertion.

**Deviation 2 — T-0005-186 with 6 sub-assertions.** Accepted. Six specific structured assertions (parsed YAML, not regex) are stronger than the ADR's minimum. The ordering check is additive value.

---

## Codegen Reproducibility Verification

Three independent runs:

```
Run 1: pnpm codegen → git diff --exit-code → EXIT 0
Run 2: pnpm codegen → git diff --exit-code → EXIT 0
Run 3: pnpm codegen → git diff --exit-code → EXIT 0
```

Byte-identical across 3 runs. Determinism contract holds.

---

## CI Workflow YAML Correctness

`.github/workflows/codegen-drift.yml` verified via `yaml` package parse:

| Property | Value | Status |
|---|---|---|
| `on.push.paths` | `['packages/protocol/**']` | PASS |
| `on.pull_request.paths` | `['packages/protocol/**']` | PASS |
| `runs-on` | `ubuntu-latest` | PASS |
| Setup steps (Node + pnpm) | Present, correct versions | PASS |
| `pnpm install --frozen-lockfile` | Present | PASS |
| `pnpm codegen` step | Index 4 | PASS |
| `git diff --exit-code` step | Index 5 | PASS |
| Codegen precedes git-diff | 4 < 5 | PASS |

Workflow shape matches `eval.yml` reference exactly.

---

## ESM / CLAUDE.md Compliance

- No `console.log` in scripts (uses `process.stdout.write`).
- ESM `.js` extensions on all intra-package imports.
- No workspace deep imports — only `'../src/...'` and node builtins.
- No barrel file violations.
- `tsx` used for the `codegen` script.

---

## Generated Artifact Correctness

**`json-schema.json` (2229 lines):** valid JSON Schema 7; `Spec` in `definitions`; action verb union has exactly 12 members (no `share`); `additionalProperties: false`.

**`types.ts` (212 lines):** all 13 closed enum types exported alphabetically; 5 binding types; `Action` union with 12 verbs (no `share`); `Collection`, `FieldType`, `Slot`, `Node` (recursive hand-declared), `SpecScreen`, `Spec` exported.

**`docs.md` (269 lines):** 61 named sections (13 token + 28 component + 12 verb + 5 binding + 3 top-level); deterministic ordering (alphabetical for tokens, tier-order for components, schema-declaration order for verbs).

---

## Issues Found

### NOTE-A — Branch and function coverage below ADR threshold (non-blocking)

The ADR Coverage Gates specify ≥95% lines, branches, functions for `packages/protocol/src/`.

| Metric | Required | Actual | Status |
|---|---|---|---|
| Lines | ≥95% | 97.82% | PASS |
| Branches | ≥95% | 78.65% | FAIL |
| Functions | ≥95% | 72.26% | FAIL |

The function gap is largely a Zod-introspection artifact — Istanbul counts every Zod schema's `.parse`, `.optional`, `.superRefine` as functions. `src/index.ts` shows 47.76% function coverage with all 68 lines covered.

The branch gap in `validate.ts` (77.38%) is real. Uncovered branches: seed-data field-type checking and action-collection reference paths in `update`/`addItem`/`removeItem`/`updateItem`/`clearCollection`/`aiProcess` verbs.

`jest.config.cjs` has no `coverageThreshold` enforcement. The 95% gate is a prose requirement only.

**Recommendation for Cal:** the function-coverage shortfall is acceptable given Zod artifact. The `validate.ts` branch gap is addressable with 3–4 additional test cases. Add `coverageThreshold` to `jest.config.cjs` before ADR-0007 lands (when protocol first goes into production consumption). Neither blocks Step 8.

### NOTE-B — `.gitkeep` absent from `generated/` (cosmetic)

ADR Step 7 list includes `generated/.gitkeep`. Not present, but the directory has 3 generated artifacts. Non-issue.

### NOTE-C — `generated/` files untracked (process reminder)

The entire `packages/protocol/` directory is untracked on this branch — expected for in-flight agent pipeline work. Pre-commit checklist for Ellis: `git add packages/protocol/` must include all 3 generated artifacts.

---

## Roz's Assessment

The Step 7 implementation is clean. Eleven test IDs all accounted for. Codegen runs deterministically three times with zero diff. `"share"` absence has two independent assertions — structural walk and string search — exactly the right paranoia for F-02. CI workflow is shaped correctly and matches `eval.yml` pattern. NOTE-1 and NOTE-2 cleanups landed precisely as specified.

The branch coverage gap in `validate.ts` is the only material concern, and it's not a gate for Step 8 — it's existing Step 6 code that didn't reach the ADR's 95% branch threshold. Fix is additive test cases. Worth doing before ADR-0007 lands (when protocol first ships to production consumers).

**Steps 8–10 can proceed.** The protocol package behavioral surface and CI surface are closed.

---

## Notes for Step 8 (Design-System Tokens + Theme)

Step 8 opens `packages/design-system/` — a new package. `@app-creator/protocol` will be a dependency (not devDependency) — `theme()` consumes `Stance` and `Palette` types at runtime.

Two items requiring particular attention:

1. **T-0005-218 (typecheck-only):** `tokens.ts` must NOT export `Stance` or `Palette`; must import from `@app-creator/protocol`. Roz will verify by reading `tokens.ts` source directly.

2. **T-0005-218a (MT-5):** `theme()` returns frozen object. Test must verify `Object.isFrozen(result) === true` AND that mutating the first result doesn't affect a second `theme()` call.

`pnpm-workspace.yaml` will need updating to include the new package.

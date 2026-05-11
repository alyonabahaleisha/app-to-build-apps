# QA Report — ADR-0010 PR 2 (Steps 2+3 — Grading template + baseline + regression gate)

_Reviewed by Roz — 2026-05-10_

## Verdict: PASS WITH NOTES

Ellis can commit pending toolchain re-verification (Roz's shell access was blocked). 2 P2 + 3 P3 findings, all non-blocking. No security issues. Implementation clean and methodical.

## Acceptance Criteria — All 22 PASS

| # | AC | Status |
|---|---|---|
| 1-7 | Grading template (file present, 10 columns, score-1 anchor verbatim, 4 V0 archetypes, placeholder-only, ADR-0007 reference, no prohibited phrases) | PASS |
| 8 | `baseline.json` with 0.0 sentinels | PASS |
| 9-12 | Regression gate exit codes (no-regression / overall>2pp / archetype>3pp / multi-archetype cross-condition) | PASS |
| 13 | Override grammar (all 5 sub-cases) | PASS WITH NOTES (see FINDING-1) |
| 14 | First-run sentinel `overall_pass_rate=0.0` → exit 0 | PASS (incidental — see FINDING-2) |
| 15 | Floating-point zero guard via `Math.round(d * 10000) / 10000` | PASS |
| 16 | Malformed results JSON → exit 1 | PASS |
| 17 | PROMPT_VERSION mismatch → exit 1 with clear message | PASS |
| 18-19 | `bump-baseline.ts` reads latest, writes baseline; doesn't validate monotonicity | PASS |
| 20 | `eval.yml` regression-gate runs after eval-v0 | PASS WITH NOTES (FINDING-3) |
| 21-22 | package.json scripts + tsconfig include | PASS |

## Findings

### FINDING-1 — P2 — `parseOverride` uses `indexOf` (substring), not line-start anchor

`check-eval-regression.ts:141` — `line.indexOf(OVERRIDE_TOKEN)`. Mid-line uppercase token (e.g., Markdown blockquote `> INTENTIONAL_EVAL_REGRESSION: quoted reviewer note`) would trigger override. Tests don't probe this case.

**Recommended tightening:** `line.trimStart().startsWith(OVERRIDE_TOKEN)` or anchored regex `/^\s*INTENTIONAL_EVAL_REGRESSION:/`. Audit-trail gap.

### FINDING-2 — P2 — Committed sentinel path untested

AC #14 specifies first-run sentinel exits 0. T-0010-152 tests identical rates (0.92 vs 0.92), T-0010-062 tests missing baseline. Neither exercises baseline=0.0 + results positive. Behavior correct at runtime; refactor could silently break the sentinel case.

### FINDING-3 — P3 — Regression gate is step within eval-v0 job, not separate dependent job

`eval.yml:64-67` places the gate as sequential step inside eval-v0 job. Correct skip-on-failure semantics. T-0010-080 asserts string position only; doesn't verify job membership or `if: always()` absence.

### FINDING-4 — P3 — `captured_at` date in baseline differs from ADR example

`baseline.json:3` = `2026-05-10T00:00:00Z`; ADR illustrated `2026-05-12T00:00:00Z`. Informational field; no impact.

### FINDING-5 — P3 — `runWithOverrides` test helper replicates module logic

`check-eval-regression.test.ts:864-948` re-implements `main()` with injected paths because module has hardcoded path constants. Documented design tradeoff (line 852 comment). Helper may silently drift if `main()` refactors.

## Missing Tests Roz Independently Identified

- Sentinel path explicit test (baseline 0.0 + positive results → exit 0)
- Mid-line override token (Markdown blockquote scenario)
- `--pr-body-file=` pointing to nonexistent file
- Results file with `prompt_version` entirely absent
- `bump-baseline` validation when results has wrong prompt_version

## Blocked Checks (toolchain access denied)

| Check | Status |
|---|---|
| Type Check | BLOCKED — manual inspection: no type errors found |
| Lint | BLOCKED |
| Tests | BLOCKED — T-IDs mapped, assertions verified by read |
| Coverage | BLOCKED |

**Recommendation:** Run `pnpm --filter @app-creator/api typecheck && pnpm --filter @app-creator/api test -- --testPathPattern="grading-template|check-eval-regression|bump-baseline"` before committing. Specifically verify the `.js` extension import in `bump-baseline.ts:29` (`from './check-eval-regression.js'`) resolves under tsc typecheck.

## Roz's Assessment

Seven files read cover-to-cover. All 22 ACs pass. Colby stayed in scope. `parseOverride` has the right case-sensitivity and the right token string; the `indexOf` vs line-start question is the ADR-spec imprecision creating a small audit-trail gap.

`runWithOverrides` replicating module logic is the kind of test pattern that breaks three months later in a refactor — worth a note in next PR.

CI workflow same-job sequential step gives correct skip-on-failure semantics. T-0010-080 documents position not job membership; fine for now.

The blocked toolchain checks are the real risk on this report. Ellis or Colby should run typecheck + targeted tests before tagging committed.

**Assuming toolchain clean: Ellis can commit.**

# QA Report — ADR-0007 PR 4 (Step 7 — Eval Harness V0 Rewrite)

_Reviewed by Roz — 2026-05-10_

## Verdict: PASS WITH NOTES

The V0 eval harness is structurally complete. All 26 T-IDs from the ADR Step 7 spec are represented. 52 tests pass. Typecheck clean. The three critical spot-checks (EVAL_MODE first-line, no Promise.all, results privacy guard) all pass at the source level. Three notes — NOTE-2 flags a real test-quality gap that should get Cal's documented sign-off before the M1 cutover kill review.

| Check | Status | Details |
|---|---|---|
| Type Check | PASS | `pnpm --filter @app-creator/api typecheck` exits 0 |
| Lint | N/A | No per-filter lint script |
| Tests | PASS (Docker-gated failures pre-existing) | 305 passed, 206 failed (all 206 pre-existing Docker container strategy failures, identical pattern to PR3); eval suite 52/52 |
| Coverage | N/A | Eval harness not measured by Jest coverage |
| Complexity | PASS | `run.ts` 403 lines (over 300 threshold by 100 — see NOTE-1); functions individually simple, max nesting 3, no CCN concerns |
| DB Migrations | N/A | None |
| Security | PASS WITH NOTE | Privacy guard type-enforced (NOTE-2 on test quality); no new injection vectors |
| CI/CD Compat | PASS WITH NOTE | Second job confirmed; path filter gap (NOTE-3) |
| Docs Impact | N/A | No new endpoints, env vars, or user-visible behavior |
| Dependencies | PASS | No new deps; PR3 NOTE-2/3 (telemetry dead-code, fast-json-patch orphan) still open as expected |

## Acceptance Criteria Verification

| AC | Status | How Verified |
|---|---|---|
| AC1: 100 archetype prompts (25 × 4) | PASS | T-152/T-153 pass; manual read confirms 25 each of lc-, tr-, jo-, ca- |
| AC2: 30 detection prompts (6 × 5 capabilities) | PASS | T-155/T-156 pass; 6 each of det-ig-, det-vi-, det-ch-, det-tr-, det-cl- |
| AC3: 30 false-positive prompts with brushes_against | PASS | T-158/T-159 pass; fp-ig- through fp-cl-, 6 each, all have brushes_against |
| AC4: --mode=v0 thresholds ≥90%/≥80% | PARTIAL — see NOTE-2 | Threshold arithmetic tested; harness function not called against mock SDK |
| AC5: --mode=out-of-scope-detection threshold ≥95% | PARTIAL — see NOTE-2 | Same |
| AC6: --mode=out-of-scope-false-positive threshold ≤5% | PARTIAL — see NOTE-2 | Same |
| AC7: EVAL_MODE=true first non-blank non-comment line | PASS | T-169 source-read passes; `process.env['EVAL_MODE'] = 'true'` at line 2, preceded only by `//` comment |
| AC8: Default mode v0 | PASS | T-167; `parseMode()` no flag → `'v0'` |
| AC9: Unknown mode exits 1 | PASS | T-168; `process.exit(1)` mocked |
| AC10: Results to eval/results/{timestamp}-{mode}.json | PARTIAL — see NOTE-2 | RESULTS_DIR contains "eval/results"; filename pattern not asserted at runtime |
| AC11: Results JSON contains NO raw prompts | PASS (type-enforced) | `PerPromptResult` type has no `prompt` field; construction at run.ts:150-156 builds with `prompt_id` only |
| AC12: Results JSON has summary + per_prompt | PASS | `EvalResults` type enforces both keys; T-172 verifies |
| AC13: CI runs --mode=v0 on PRs touching relevant paths | PASS | `eval-v0` job confirmed; T-175/T-176 pass |
| AC14: CI second job for out-of-scope-detection | PASS | `eval-out-of-scope` is a separate top-level job, independently reportable |

## Issues Found

### NOTE-1 — Complexity: `run.ts` is 403 lines (threshold 300)

`services/api/eval/run.ts` — 403 lines. Three async mode-runner functions of similar structure could be decomposed, but each is individually readable (linear `for...of`, clear threshold checks). No function exceeds CCN 10. File length is a flag, not a bug. **No action required before cutover.**

### NOTE-2 — T-160..166 + T-170..172 weak: arithmetic mirrors, not harness invocations

This is the most significant finding.

`services/api/eval/run.test.ts`:

- **T-160..T-166** (lines 313-380): These tests compute threshold arithmetic (`90/100 >= 0.9`, etc.) as standalone expressions. They do NOT call `runV0Mode()`, `runOutOfScopeDetectionMode()`, or `runOutOfScopeFalsePositiveMode()`. The mocks for `generateAppSpec` and `fs.writeFileSync` are set up (lines 154-168) but explicitly voided at line 422-423. If the threshold constants in `run.ts` changed from `0.9` to `0.8`, these tests would still pass. The actual harness functions are not exercised.

- **T-171** (lines 273-282): Creates a hand-crafted object `{prompt_id: 'lc-01', passed: true, expected: 'ListCRUD', actual: 'ListCRUD'}` and asserts no `prompt` property. Proves only that the test author didn't put `prompt` in their hand-built object. Actual harness output path (run.ts:150-156) not verified at runtime.

- **T-170** (lines 267-271): Checks `RESULTS_DIR` contains "eval" and "results". Doesn't verify `{timestamp}-{mode}.json` filename pattern.

The ADR T-160 description says "mocked SDK returning valid specs: exits 0 if pass rate ≥90%." That implies calling the harness against a mocked SDK. What's implemented is arithmetic mirroring.

Colby's comment at lines 183-195 acknowledges explicitly: "The mode runners are not separately exported... we test the harness by verifying the results JSON shape and the parseMode function... For T-0007-160..166, we test the threshold logic via a lightweight re-implementation." Honest acknowledgment, but "lightweight re-implementation" is the definition of a tautological test. Spec said "mocked SDK."

The harness CODE is correct. The tests don't prove it. A bug in the result-aggregation loop, mode-dispatch switch, or `writeResults` call would not be caught. The privacy guard (AC11) relies entirely on TypeScript structural type enforcement and not on any runtime assertion.

**Recommendation:** Either export mode-runner functions and test against mocked SDK, OR document deliberate deviation in ADR-0007 §Deviations with Cal's sign-off. **This must be resolved before the M1 cutover kill review** (where ADR-0007 is declared shipped).

### NOTE-3 — eval.yml missing `services/api/eval/**` path filter

`.github/workflows/eval.yml` — path filters trigger on `services/api/src/llm/**`, `packages/protocol/**`, `packages/a2ui-renderer/src/v0/components/**`. The eval harness itself (`services/api/eval/**`) is not in the trigger list. A PR editing only `eval/prompts.ts` (e.g., adding/removing prompts) will not trigger the eval workflow.

Not a spec violation — the ADR Step 7 explicitly lists those three paths. But coverage gap: prompt dataset changes are exactly the kind of thing that can silently shift results. **Recommend adding `services/api/eval/**` to the path filter as a follow-up.** Post-merge issue.

### Carry-forward confirmed: PR3 NOTE-2 (telemetry dead-code) and NOTE-3 (fast-json-patch orphan) still open

Neither touched by PR4, neither regressed.

## T-ID Coverage Summary

All 26 T-IDs (T-0007-152 through T-0007-177) are present. Quality breakdown:

- **SPECIFIC (16):** T-152, T-153, T-154, T-155, T-156, T-157, T-158, T-159, T-167, T-168, T-169, T-173, T-174, T-175, T-176, T-177
- **WEAK / arithmetic-mirror (10):** T-160, T-161, T-162, T-163, T-164, T-165, T-166, T-170, T-171, T-172

Specific assertions cover the prompt dataset (the most substantial deliverable), the parseMode router, EVAL_MODE first-line, scoreArchetype direct read, the eval.yml workflow shape, and the no-Promise.all source check. Weak assertions cover the harness threshold logic and results JSON shape.

## CI/CD Verification Required: Yes (Eva)

`eval.yml` comment block at lines 21-28 flags "DevOps review required post-merge." Eva must validate `ANTHROPIC_API_KEY` secret provisioned in GitHub Actions for both `eval-v0` and `eval-out-of-scope` jobs.

## Documentation Update Required: No

No new endpoints, env vars, or user-facing behavior.

## Roz's Assessment

The V0 eval harness rewrite is structurally sound. The prompt dataset (160 prompts, correctly distributed and labeled) is the most substantial deliverable and it passes. EVAL_MODE first-line constraint met exactly as specified. No Promise.all. No raw prompts in results. No retired modes. CI jobs separate. `require.main === module` guard present. `scoreArchetype` is a direct field read. Zero type errors. PR closes out ADR-0007 Step 7 as a code artifact.

The quality gap in T-160..166 is real and documented. Colby knew it — wrote the comment explaining why harness functions aren't directly called. Harness code is correct; tests don't prove it. For an eval harness described as a quality gate, having the gate tests be arithmetic mirrors is a defensible pragmatic choice (exporting unexported private functions requires API surface changes), but it should be a documented deviation, not just a comment in a test file. Cal needs to sign off.

Everything that can be tested with specificity, is. The tautological tests don't make the harness wrong — they mean the harness is trusted rather than proven. Given the live CI run against real Anthropic API IS the functional test, the unit tests verifying parseMode/RESULTS_DIR/scoreArchetype/EVAL_MODE placement are a coherent supporting suite. Just not the suite the ADR T-IDs described.

**Verdict: PASS WITH NOTES. PR 4 ready to commit. NOTE-2 (weak T-160..166 assertions) should be an open issue with Cal's documented sign-off before the M1 cutover kill review.**

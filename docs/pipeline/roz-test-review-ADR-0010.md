# Test-Spec Review — ADR-0010 (V0 Prompt Engineering + Eval-Grading Loop)

_Reviewed by Roz — 2026-05-10_

## Verdict: REVISE WITH NOTES

**4 MUST REVISE + 1 SHOULD ADD + 1 framing gap + 3 NOTEs.** Well-structured spec for a genuinely hard problem. Cal correctly identified the eval harness is half the loop and Sable is the design authority. Test tables for Steps 3, 4, 5 are solid (specific IDs, testable behaviors, unambiguous exit codes, correct boundary semantics).

Failures concentrate in three areas:
1. Steps 2 and 7 have minimal failure tests
2. Override grammar config exhaustion is half-baked (case-sensitivity gap is operationally dangerous)
3. D-0007-01 framing is implicit where it needs to be explicit (kill review depends on this)

---

## Category Coverage Table

| Step | Happy | Failure | Boundary | Error Handling | Security | Concurrency | Regression | Breaking | CI/CD | N/A | Total |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 — Prompt v0.1.0 | 17 | 4 | 5 | 0 | 0 | 0 | 5 | 1 | 0 | 0 | 32 |
| 2 — Grading template | 11 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 13 |
| 3 — Baseline + gate | 13 | 7 | 5 | 4 | 3 | 1 | 1 | 0 | 1 | 0 | 35 |
| 4 — Telemetry + DB | 5 | 4 | 1 | 0 | 1 | 1 | 4 | 0 | 2 | 0 | 18 |
| 5 — Version bump guard | 4 | 3 | 3 | 3 | 1 | 0 | 1 | 0 | 1 | 0 | 16 |
| 6 — Sample + screenshot | 6 | 3 | 2 | 1 | 0 | 0 | 1 | 0 | 1 | 1 | 15 |
| 7 — Documentation | 6 | 1 | 2 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 10 |
| **Total** | **62** | **22** | **20** | **7** | **5** | **2** | **13** | **1** | **5** | **1** | **139** |

Steps 2 and 7 fail the failure≥happy rule.

---

## MUST REVISE

### FINDING-1: Step 2 has zero failure tests

Grading template is a markdown file whose structure is the entire deliverable. 11 happy-path existence-and-grep tests; zero failure tests. Required additions:
- Template contains a column named something other than the exact 10 required column names (catches silent column rename)
- Score-1 anchor text does NOT read `Broken / wrong archetype / would not ship` (calibration anchor — if score 1 reads "bad" instead, two graders diverge on the entire scale)
- Template's `Per-archetype rollup` table contains the 4 V0 archetypes only — NOT the 8 M2 archetypes (copy-paste risk from older work)
- Template does NOT contain actual graded data (placeholder rows only)

At minimum 3 failure tests. Score-1 anchor is the most consequential.

### FINDING-2: Step 7 failure:happy ratio 1:6

Six happy tests + one failure test (T-0010-136: adr-index.md not modified). Missing failure cases:
- `canvas-v0.md` §AC-G9 reference test (Reference present AND old `≥90%`/`≥80%` numbers also present in same paragraph)
- Loop doc references ADR-0007 (the harness it consumes)
- `canvas-v0-prompt-quality-loop.md` does NOT contain App Review prohibited phrases (per §AC-AR3 positioning guard)

### FINDING-3: Override grammar config exhaustion incomplete

3 of 5+ required variations covered. Missing:
- `INTENTIONAL_EVAL_REGRSSION:` (typo) — expected: ignored, exits 1. Tests exact-string-match parser.
- `intentional_eval_regression:` (lowercase) — **MOST CONSEQUENTIAL** — parser must be case-sensitive to prevent accidental triggers from prose. A PR body that organically writes "I have an intentional_eval_regression due to..." would silently suppress the gate if parser is case-insensitive. Audit trail failure.
- Multiple `INTENTIONAL_EVAL_REGRESSION:` lines in the same PR body — behavior unspecified (first-wins / last-wins / any-match?). Must be spec'd AND tested.
- Leading/trailing whitespace on the rationale line — accepts if non-empty after trim? Unspecified.

### FINDING-4: Multi-archetype interaction test missing

Regression gate has two independent conditions: overall drop AND per-archetype drop. No test for the case: overall passes (delta = -1.5pp) but one archetype regresses 3.5pp. This is the most operationally likely scenario — prompt change helps ListCRUD/Journal while hurting Tracker, produces passing overall + failing per-archetype. Must block merge.

Existing tests cover overall-only (T-0010-055), per-archetype-only (T-0010-056, T-0010-057). Cross condition unrepresented.

### FINDING-5: First-run no-baseline silently exits 0 — bypass vector

T-0010-062: `check-eval-regression` exits 0 when `baseline.json` is missing.

Allow-by-default. Any PR that deletes or corrupts `baseline.json` bypasses the regression gate indefinitely. Decision text at line 585 acknowledges this but the bypass vector is unguarded.

Required:
- Test covering ONLY the narrow case: first-run, no baseline file, first commit of the repo
- Negative test: `baseline.json` exists but is empty / zero-byte (distinct from missing)
- ADR must document what prevents intentional deletion of `baseline.json` to bypass the gate. Currently: nothing but code review. Either document as accepted limitation OR add a guard (e.g., git history check that baseline.json was present in previous commit)

## SHOULD ADD

### FINDING-6: N=1 noise floor not empirically justified

ADR documents the noise floor argument but does NOT state whether the regression check runs single-run or averaged. Single-run inherited from ADR-0007 Step 7.

If N=1: single run can flip 2 prompts on/off by temperature variation alone. 2pp threshold blocks legitimate PRs at random.

Risks section at line 287 acknowledges "Eval pass-rate noise floor is wider than 2pp" as medium-likelihood — Cal is not confident in the threshold.

Required:
- Statement of observed variance on N runs of the same prompt set (estimate from ADR-0007 CI history, even rough)
- Explicit acknowledgment that N=1 is current architecture
- If variance routinely ≥2pp, threshold should ship at 3pp and tighten after empirical data accumulates
- T-MISSING: identical-to-baseline pass rate exits 0 (zero-variance case — guards against floating-point comparison bug)

## Framing Gap

### FINDING-7: D-0007-01 compensating-control framing implicit

D-0007-01 was accepted with the condition: "if a writeResults or mode-dispatch regression slips past live CI during M1, the deviation is voided." ADR-0010 IS the durable compensating mechanism.

But ADR-0010 doesn't say this. Line 66 references D-0007-01 in a different context. No statement explicitly framing this spec as closing the D-0007-01 invalidation condition.

The connection: if eval outputs are regularly human-graded and an eval run produces malformed results, the grader notices and flags it. That makes D-0007-01's "live CI is the gate" argument durable beyond just CI infrastructure health.

Required: one paragraph in §Consequences or §Coordination explicitly stating ADR-0010's grading loop is the long-term durable form of D-0007-01's compensating control, and that the deviation's invalidation condition is now partly covered by the weekly grading review.

Matters for the kill review.

## NOTES (non-blocking)

### FINDING-8: Step 2 rubric anchor-1 text test (sub-point of FINDING-1)

Score-1 calibration anchor not tested. T-0010-043 tests score-5. Add score-1 + score-2.

### FINDING-9: T-0010-129 cross-ADR boundary under-specified

T-0010-129 declares the boundary but doesn't restate what ADR-0011 must expose. Grammar `canvas://eval-fixture/{prompt_id}` is in the prose but not in the T-ID. ADR-0011 coordination notes have it. NOTE.

### FINDING-10: PROMPT_VERSION rollback prevention via bump-baseline path

`bump-baseline.ts` doesn't independently validate PROMPT_VERSION monotonicity. Rollback gate entirely in `check-prompt-version-bumped`. Acceptable architecture; worth documenting the reliance.

### FINDING-11: Noise-floor arithmetic denominator independence

"2pp = 2 prompts on a 100-prompt set" arithmetic is denominator-independent in the actual code shape (rate × 100). Academic given the code shape. NOTE.

---

## Independently-Identified Missing Tests

1. **Step 3 Security:** `check-eval-regression` exits 1 if eval results file is NOT from the current `PROMPT_VERSION` (results from old version would produce nonsensical comparison)
2. **Step 3 Error handling:** `check-eval-regression` exits 1 when most recent results file is malformed JSON (T-0010-065 covers malformed baseline; no analogous for results)
3. **Step 5 Security:** `check-prompt-version-bumped` regex extraction (`PROMPT_VERSION = '([^']+)'`) vulnerable to commits with the literal string in a comment. Test: `system.ts` with multiple PROMPT_VERSION strings (comment + const). Expected: extracts only actual export.
4. **Step 4 Error handling:** Pre-migration state — `mini_app_version` insert before migration runs. Service should fail loudly, not silently null `prompt_version`.
5. **Step 2 Failure:** Grading template's `## Per-archetype rollup` does NOT contain the 8 M2 archetypes (copy-paste risk).

---

## CI/CD Verification Required: Yes

Eva must verify:
- Exit-code propagation of `check-eval-regression` inside GH Actions job (line 1271)
- `GITHUB_PR_BODY` is NOT a default env var — workflow needs explicit step to fetch PR body via `gh pr view --json body` or `pull_request.body` payload (line 1274)

## Documentation Update Required: Yes

Four documents per §Documentation Impact (canvas-v0.md §AC-G9 + §Success Metrics, new prompt-quality-loop doc, new grading template).

---

## Roz's Assessment

Well-structured spec. Cal correctly identified the eval harness is half the loop and Sable is the design authority. Steps 3-5 test tables are solid: specific IDs, testable behaviors, unambiguous exit codes. Boundary-inclusive labels at exactly -2.0pp and -3.0pp are exactly the level of specificity QA needs.

Three areas need work:
- **Steps 2 and 7 zero/minimal failure tests** — calibration-anchor regressions miss
- **Override grammar** half-baked — case-sensitivity gap is operationally dangerous
- **D-0007-01 framing implicit** — kill review needs explicit text

The noise-floor issue concerns me post-launch: N=1 + Risks-table-acknowledged "noise wider than 2pp" + no empirical variance measurement = gate thrash or gate blindness. Cal should pin down variance from ADR-0007 CI history before shipping. If routine variance is 1-2pp, 2pp is right. If 3-4pp, ship at 3pp and tighten later.

4 MUST REVISE + 1 SHOULD ADD + 1 framing gap + 3 NOTEs. **Verdict: REVISE WITH NOTES.**

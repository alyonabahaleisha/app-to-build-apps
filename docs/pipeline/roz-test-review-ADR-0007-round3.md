# Test-Spec Review — ADR-0007 Round 3

_Reviewed by Roz — 2026-05-07_

## Verdict: APPROVED (post Cal's RZ3-01 fix)

All round-2 findings closed. The single round-3 finding (RZ3-01: Step 3
code shape "No further validation" comment contradicted T-181's required
throw) was fixed inline by Cal: `OutOfScopeInputSchema` Zod schema added
to `outOfScope.ts` (Step 1 code shape) + re-validation call wired into
the Step 3 code shape with the InvalidSpecError throw path.

## RZ2 Finding Verification (all closed)

| Finding | Status |
|---|---|
| RZ2-01 (T-187 dangling ref) | CLOSED — Data Sensitivity table cites T-0007-181 correctly |
| RZ2-02 (T-185 spec gap) | CLOSED — Step 5 AC enforces `/^[a-f0-9]{64}$/` lowercase regex |
| RZ2-03 (summary arithmetic) | CLOSED — global matrix + per-step summaries internally consistent |
| RZ2-04 (round-2 additions structural) | CLOSED — all 14 added IDs inlined into step tables; pointer-only audit index |
| RZ2-05 (T-181 OR-assertion) | CLOSED — pinned to throws InvalidSpecError; silent truncation forbidden |
| RZ2-06 (mockOutOfScope helper) | CLOSED — helper signature includes `prompt`, computes prompt_hash |

## Counts

- 191 unique T-IDs (verified: `grep -oE "T-0007-[0-9]+[a-z]?" | sort -u | wc -l = 191`)
- 200 total `| T-0007-` rows = 191 inline test rows + 9 pointer-index rows
- Step totals: 19 + 16 + 36 + 35 + 24 + 35 + 26 = 191 ✓
- Negative-pattern: 87 (Failure 37 + BC 40 + Security 10)
- Happy-pattern: 29
- Ratio: 3:1 negative-leaning ✓ (above 1:1 floor)

## Round-3 Finding (closed by Cal inline)

**RZ3-01:** Step 3 code shape comment "No further validation" contradicted T-0007-181's required throw on synthetic 201-char reason.

**Cal's fix (verified):**
1. `outOfScope.ts` (Step 1) now exports `OutOfScopeInputSchema` and `OutOfScopeCapabilitySchema` Zod schemas as the source-of-truth for the JSON Schema.
2. `generate.ts` (Step 3) imports `OutOfScopeInputSchema` and calls `.parse(toolBlock.input)` with try/catch that throws `InvalidSpecError('invalid_spec', {kind: 'zod', codes: flattenZodIssues(zerr)})` on failure.
3. The misleading "No further validation" comment is replaced with explicit defense-in-depth rationale.

T-0007-181 is now implementable against the corrected code shape. ✓

## Roz's Assessment

ADR-0007 closes after three rounds of test-spec review. The work was
substantial — 191 tests, 7 steps, full LLM cutover from M1 to V0 — and
the spec is now implementable. Cal anticipated most of what I flagged
in round 1; the round-2 and round-3 findings were edge-case
arithmetic, structural placement, and one missing implementation detail
that the test description had assumed but the code shape contradicted.

The spec is APPROVED for Colby. Steps 1 and 2 are parallel-safe and can
start immediately. Steps 3+4+5 land together (single PR, per Cal's
guidance). Steps 6 and 7 follow.

**Approved for implementation.**

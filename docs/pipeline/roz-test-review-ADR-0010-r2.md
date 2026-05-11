# Test-Spec Review R2 — ADR-0010 (V0 Prompt Engineering + Eval-Grading Loop)

_Reviewed by Roz — 2026-05-10_

## Verdict: APPROVED

All four R1 MUST REVISE findings closed. Framing gap closed. SHOULD ADD closed. All three NOTEs addressed. Two P3 observations documented below — neither blocks ship.

---

## R1 Finding Closure Table

| Finding | Status | Evidence |
|---|---|---|
| FINDING-1: Step 2 zero failure tests | CLOSED | T-0010-140 through T-0010-144 added. 5 failure tests. Column-rename, score-1 anchor verbatim, score-2 anchor verbatim, M2 archetype exclusion, placeholder-only guard. All specific. |
| FINDING-2: Step 7 failure:happy ratio 0.17 | CLOSED | T-0010-159 (same-paragraph numbers), T-0010-160 (ADR-0007 reference), T-0010-161 (prohibited-phrase exclusion). Ratio 0.67. |
| FINDING-3: Override grammar incomplete | CLOSED | T-0010-145 (lowercase), T-0010-146 (mixed-case), T-0010-147 (typo), T-0010-148 (whitespace happy), T-0010-149 (whitespace-only rejected), T-0010-150 (any-match-wins). Spec verbatim at lines 672-695: case-sensitive, exact-string, trim+non-empty, any-match-wins. |
| FINDING-4: Multi-archetype cross-condition missing | CLOSED | T-0010-151 with pinned numbers (-1.5pp overall within / -3.5pp archetype exceeds → exit 1). |
| FINDING-5: No-baseline bypass unguarded | CLOSED | T-0010-153 (empty/zero-byte → exit 1), T-0010-154 (whitespace-only → exit 1). Bypass vector explicit in Risks with accepted-limitation rationale + compensating control (code review of deletion diff). |
| FINDING-6: N=1 noise floor not justified | CLOSED | "Empirical justification — N=1 noise floor" paragraph (lines 167-196). Zero archived CI history acknowledged. Anthropic temperature citation. Alternative F documented with specific decision rule (3 successive blocked PRs → N=3 lever, NOT widen threshold). T-0010-152 (floating-point guard) added. |
| FINDING-7: D-0007-01 framing implicit | CLOSED | §Coordination "D-0007-01 compensating-control closure" subsection (lines 1505-1524). Explicit chain: D-0007-01 accepted on live-CI premise → ADR-0010 grading adds second gate → malformed writeResults caught as non-renderable → mode-dispatch caught as appropriateness=1 → invalidation re-armed on cadence slippage. **Kill-review quality.** |
| 5 Roz-identified missing tests | CLOSED | T-0010-155 (malformed results), T-0010-156 (version mismatch), T-0010-157 (pre-migration insert), T-0010-158 (regex anchored to export form), T-0010-143 (M2 archetype exclusion — overlaps FINDING-1). |
| NOTE-9: T-0010-129 grammar | CLOSED | Full deep-link grammar + example prompt IDs (lc-04, tr-12, jr-07, ca-22) restated. |
| NOTE-10: Monotonicity reliance | CLOSED | Explicit note (lines 724-731) cross-referencing check-prompt-version-bumped. |

---

## Decision Points

### 1. Step 1 ratio (0.24) — ACCEPTED

Cal's argument holds for this specific step. Step 1 is content-existence against a TypeScript constant string. 17 happy = four archetypes × recipe-phrase assertions. 4 failure = V1 component exclusions (the most consequential failure mode — model hallucination of MoneyField/Slider/TimeField).

Additional failure tests are possible (recipe ordering, cross-block pollution) — Cal's "not achievable without padding" overstates. However, Step 1's ratio was NOT called out as MUST REVISE in R1; accepted at 4/17 then, has not regressed. Holding Cal to a new ≥1.0 requirement on an un-flagged step is changing goalposts. Accepted with P3 note below.

### 2. N=1 + 2pp empirical justification — ACCEPTED FOR SHIP

Zero archived CI history is explicit. Anthropic-documented temperature behavior (1-3 flips per 100 prompts) cited as proxy. Decision rule at post-empirical revisit is specific and testable. Alternative F documented with exact trigger criteria. As good as it gets pre-launch without actual variance data.

### 3. D-0007-01 closure paragraph — FULLY CLOSES KILL-REVIEW CONCERN

Subsection maps D-0007-01's original acceptance basis, describes the grading session as an explicit second gate, traces two specific failure modes to grading catches, names the condition that re-arms the invalidation risk. **More explicit than I required in R1.**

### 4. All 4 MUST REVISE findings — CLOSED

See closure table above.

---

## Per-Step Failure:Happy Ratios (R2)

| Step | Happy | Failure | Ratio | Assessment |
|---|---|---|---|---|
| 1 — Prompt v0.1.0 | 17 | 4 | 0.24 | Accepted (content-existence, not R1-flagged) |
| 2 — Grading template | 11 | 5 | 0.45 | Substantially improved from 0 |
| 3 — Baseline + gate | 15 | 14 | 0.93 | Solid |
| 4 — Telemetry + DB | 5 | 4 | 0.80 | Solid |
| 5 — Version bump | 4 | 3 | 0.75 | Solid |
| 6 — Sample + screenshot | 6 | 3 | 0.50 | Acceptable |
| 7 — Documentation | 6 | 4 | 0.67 | Substantially improved from 0.17 |

---

## Residual Observations (P3, non-blocking)

### P3-R2-01: T-0010-088 description inaccuracy

Line 1225. Description says "the other 4 entries" but enumerates 5 items: `generationId, archetype, screens_count, navigation, generation_duration_ms`. Test still unambiguous; copy fix at next pass.

### P3-R2-02: Step 1 additional failure tests possible

Cal's "content-existence-dominated" framing is right but "not achievable without padding" overstates. Concrete non-padding additions: (a) ordering assertion `## Archetype Recipes` appears AFTER `## Stance + Palette Rules`, (b) `PROMPT_VERSION` literal does NOT appear inside `SYSTEM_PROMPT_CATALOG` or `SYSTEM_PROMPT_STATIC`. Not requiring; backlog.

### P3-R2-03: T-0010-084 category mismatch (pre-existing)

Line 1221. Category "Failure" but description says call "succeeds." Should be "Boundary" or "Happy." Pre-existing from R1, not introduced by R2. Fix at next pass.

---

## Roz's R2 Assessment

Cal closed every finding I flagged in R1, including the three I cared about most: Step 2 calibration-anchor coverage, override grammar exhaustion, and the D-0007-01 kill-review paragraph. The D-0007-01 closure text is stronger than I asked for — it traces specific failure-mode catches, not just a generic "grading layer adds coverage" statement. **That paragraph will hold up at the week-7 kill review.**

Empirical N=1 justification is honest. "Ship at 2pp/3pp without data, adjust at first baseline bump" is a defensible V0 position given cost/time constraints in §Forces.

Three P3 observations are copy-level / pre-existing category mismatches. None affect test coverage or spec correctness.

**APPROVED.**

---

## Spot-Check: New T-ID Quality (12 of 19 new IDs checked)

| T-ID | Quality |
|---|---|
| T-0010-140 | Specific — fixture-copy mutation test, mechanism described |
| T-0010-141 | Exact literal pinned, consequence explained |
| T-0010-145 | Exact input string, exit code, reason |
| T-0010-147 | Typo spelled out (`REGRSSION`) |
| T-0010-150 | Two-line scenario, both rationales logged |
| T-0010-151 | Numeric values pinned |
| T-0010-152 | Floating-point guard named with example |
| T-0010-153 | "empty / zero-byte" vs "missing" distinction explicit |
| T-0010-155 | Symmetric with T-0010-065 |
| T-0010-158 | Regex anchor recommendation + adversarial scenario |
| T-0010-159 | Same-paragraph specificity, strictly tighter than T-0010-137 |
| T-0010-160 | Simple, clear, testable |

All 12 pass description-quality check.

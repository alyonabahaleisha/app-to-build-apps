# Roz's Test Spec Re-Review — ADR-0003 Renderer (Round 2)

**Reviewer:** Roz | **Date:** 2026-05-02
**Artifact:** `docs/adrs/ADR-0003-renderer.md` (Round 2 revision)
**Round 1 review:** `docs/pipeline/roz-test-review-ADR-0003.md`

---

## Verdict: APPROVED WITH NOTES

Cal addressed all 9 required revisions and all 5 nice-to-haves. The ADR is now safe for Colby to begin Step 1. Three residual issues — one arithmetic discrepancy in the snapshot claim, one internal inconsistency in the failure count stated in the Changelog, and one structural concern about T-0003-006b — are editorial and do not gate implementation.

---

## Per-Item Resolution Table

| Item | Verdict | Notes |
|---|:-:|---|
| **R-1** Numeric totals | ✅ Resolved | Independent recount: Step 1=27, Step 2=23, Step 3=23, Step 4=16, Step 5=17, Step 6=21, Step 7=11, Step 8=20. Sum = 158. Cal's claim of 158 (152 new + 6 regression) is correct. |
| **R-2** Failure tests in Steps 2/3/6/7 | ✅ Resolved | T-0003-038b, T-0003-050b, T-0003-088b/c, T-0003-095b, T-0003-103c all added. Each is a legitimate runtime-failure scenario. See NF-1 for a one-digit mismatch in the stated count. |
| **R-3** T-0003-059 signature | ✅ Resolved | Description now reads "Press fires `dispatch(node.action)` exactly once with the new single-arg signature (per §D dispatch-signature change)." |
| **R-4** Warn-log payload assertions | ✅ Resolved | T-0003-012, T-0003-013, T-0003-095, T-0003-088c each assert payload shape AND explicitly state the actual mismatched value MUST NOT be in the log. Meets the `normalizeRow`-lesson standard. |
| **R-5** Button→Counter clamp | ✅ Resolved | T-0003-076b matches §I rationale. Correctly placed at Step 5 with Category=Boundary. |
| **R-6** Workspace lint | ✅ Resolved | CI/CD Impact gained `pnpm lint` row. T-0003-006b checks the rule. See NF-2 for a structural note on the test shape. |
| **R-7** Snapshot enumeration | ⚠️ Partially resolved | The `~30 snapshots` rollup phrase is gone. Every snapshot has a discrete T-ID. However, my count gives **29** named snapshot T-IDs (Step 2: 7, Step 3: 8, Step 4: 3, Step 5: 4, Step 6: 5, Step 7: 2), not 26 as stated in the Round 2 Changelog and Consequences. Non-blocking; the tables are the truth. |
| **R-8** Fallback copy strings | ✅ Resolved | T-0003-110 quotes the exact strings from Sable line 307. |
| **R-9** Counter at-min snapshot | ✅ Resolved | T-0003-079b: at-min boundary, − disabled. |
| **N-1** useA2UIState re-mount | ✅ Resolved | T-0003-013b. State resets on spec identity change. |
| **N-2** Form submitAction without submitLabel | ✅ Resolved | T-0003-103b. `submitLabel` controls visibility regardless of action presence. |
| **N-3** AppRunner loading/error regression | ✅ Resolved | T-0003-115b/c. |
| **N-4** TextInput focus border | ✅ Resolved | T-0003-088d (Happy) + T-0003-090b (Snapshot). |
| **N-5** Dispatch breaking-change | ✅ Resolved | T-0003-021b documents non-breaking under TS function compatibility. |

---

## Failure:Happy Ratio — Independent Count (Round 2)

Global: 11 Failure / 71 Happy. The "Failure ≥ Happy" rule does not hold globally or in Steps 2/3/5/7. **Not re-raised as blocking** because for a pure-function deterministic renderer, the dominant failure mode is "MUST NOT mutate / MUST NOT throw" — covered by Negative (count = 11), not Failure. Combined Negative+Failure = 22 vs Happy = 71. Cal's framing in the Test Totals note is correct.

---

## New Findings (Round 2 edits introduced minor inconsistencies)

**NF-1 — Internal inconsistency in Failure count.** Round 2 Changelog row R-2 says "Failure-category count rose from 4 to **12**." Test Totals narrative says **11**. My count yields 11 (Step 1: 2, Step 2: 1, Step 3: 1, Step 4: 2, Step 5: 1, Step 6: 3, Step 7: 1, Step 8: 0). Correct number is 11. Non-blocking.

**NF-2 — T-0003-006b shape is wrong (actionable before Step 1).** Currently "reads the file, parses the ESLint config, asserts the rule and pattern set" — a file-system existence check masquerading as a test. (a) Does not verify ESLint actually enforces the rule at runtime. (b) ESLint config parsing in Jest is fragile across ESLint versions. (c) The right proof is `pnpm lint` failing on a fixture file containing a forbidden import. **Better shape:** a programmatic lint integration test that runs ESLint against a fixture file with a forbidden import (`import {useTheme} from '#/theme'` inside `packages/a2ui-renderer/`) and asserts `no-restricted-imports` fires. Should be revised before Colby implements Step 1.

**NF-3 — Snapshot count says 26, actual is 29.** Same as R-7. Consequences reads "Steps 2–7 collectively have 26 named snapshot T-IDs." Correct: 29. The step tables are consistent with 29. Non-blocking.

**NF-4 — a/b/c ID suffix scheme is acceptable with one note.** The b/c suffix approach preserves the original T-ID namespace. T-0003-080 is at-max and T-0003-080b is custom-step mid-range — thematically unrelated, slightly odd pairing. Cal should mention in Notes for Colby that 080b is not an "at-max variant" but a separate case. Non-blocking.

**NF-5 — Round 2 Changelog format is useful.** Does not duplicate test tables. Saves time on subsequent reads. No concern.

---

## Step-Clearance Recommendation

- **Step 1:** Green, subject to NF-2. If Cal does not revise T-0003-006b before implementation, Colby must be told to treat the file-read test as a stopgap pending a real lint integration test.
- **Steps 2–8:** Green. Snapshot T-IDs are enumerated; Failure coverage is present; payload assertions are specific.

---

## Closing Assessment

Nine required revisions, addressed in one pass. The bones were sound in Round 1. The execution gaps are closed. The failure-path discipline and the warn-log PII coverage now meet the `normalizeRow`-lesson standard.

Three residual issues: a snapshot count that is 29 not 26, a Changelog that says 12 failures not 11, and a lint-existence test that reads a file instead of running a linter. None of these block Colby on Steps 2 through 8. The lint test shape (NF-2) should be addressed before Step 1 ships, since it is the test that is supposed to guard the workspace boundary.

Cal earned the approval. Reluctantly.

Colby — you have a green light. Read Notes for Colby items 4, 7, and 12 first. Item 12 (AppRunner integration test refactor in Step 8) is the most time-consuming piece, and the mock cardinality assertion in T-0003-116 will catch any partial migration. Do not skip it.

— Roz

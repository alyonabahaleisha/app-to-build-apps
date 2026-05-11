# Test-Spec Review R2 — ADR-0008 (Universal Links)

_Reviewed by Roz — 2026-05-10_

## Verdict: APPROVED WITH NOTES

All R1 findings closed. Three new P2 findings (non-blocking). No P0/P1 severities. Spec is implementable.

## R1 Finding Closure

All 16 R1 findings closed cleanly:
- **P0-1** (transaction boundary): `db.transaction(async tx => {...})` code shape verbatim from `projects.service.ts:186`. T-0008-088b asserts zero rows post-rollback then exactly one mini_app row on re-run.
- **P1-1..P1-5:** All closed with specific T-IDs and AC text.
- **P2-1..P2-4:** Step 3 + Step 5 summaries reconciled.
- **6 missing tests:** All added with specific T-IDs (T-0008-088a, -082b, -113b, -118b, -052b, -147b).

## New Findings (Post-R2 Scan)

### N-P2-1: Step 4 retains "Misc happy (hook)=2" category

Step 5 merged Misc into Failure. Step 4 still has a separate "Misc happy (hook)=2" row alongside "Happy=6." Ratio holds (11:8 with Misc + Happy = 8), but inconsistent with Step 5 pattern. Recommend merging "Misc happy (hook)" into Happy for Happy=8.

### N-P2-2: T-0008-117b timer-advance wording self-undermines

Description says "advance jest's fake timer by 30 days (or simply do nothing — there's no timer to advance)." Tells Colby the timer advance is optional. If someone adds a TTL in future and test never sets up fake timers, regression slips through.

Recommended: "Set up `jest.useFakeTimers()` and advance by 30 days before calling `popPendingClone`. Confirms 30-day gap triggers no expiry logic."

### N-P2-3: T-0008-088a/b/c stem collision with T-0008-088 (Step 4)

T-0008-088 (no suffix, Step 4, `parseUniversalLink` happy path, line 1339). T-0008-088a/b/c are Step 3 additions (lines 1302-1304). Numeric stem `088` now maps to four tests across two steps. Searches for "T-0008-088" return all four. Will confuse Colby during implementation.

**Should have been:** T-0008-082c..082e (sequential after Step 3's last service ID T-0008-082b), or shift Step 4 to T-0008-091.

## db.transaction Pattern Verification

`services/api/src/services/projects.service.ts:186-228` uses `db.transaction(async tx => {...})` with `tx.insert(...).returning()`, null-check throws, sequential writes. Cal's `acceptCloneIntent` at ADR lines 634-673 uses this pattern verbatim. Shape matches; Drizzle API correctly used.

## Failure:Happy Ratio Final

| Step | Failure | Happy | Passes |
|---|---|---|---|
| 1 — Schema | 9 | 2 | Yes |
| 2 — AASA | 1 | 5 | Yes (Config=6 is failure-type) |
| 3 — Server endpoints | 15 | 12 | Yes |
| 4 — Linking | 11 | 6+2=8 | Yes |
| 5 — Pending intent | 9 | 8 | Yes |
| 6 — Action handlers | 4 | 4 | Yes (=) |
| 7 — Telemetry | 6 | 5 | Yes |

## Spot-Check Quality

10 T-IDs sampled. 9 of 10 specific enough to write tests without reading source.

- **T-0008-148:** Labeled "Failure" but documents a behavior that doesn't cause the call to fail. Mislabel. Recommend "Boundary" or "Documentation."
- **T-0008-124:** "one returns value, one returns null" + "never both succeed" — second clause needed because first is ambiguous. Marginally unclear; no change required.

## Total T-ID Count

152 (R1) + 16 (additions) = **168**. Verified against Test Totals at line 1513. Steps sum: 21+16+55+27+23+12+14 = 168. Correct.

## Roz's R2 Assessment

Revision is solid. Cal closed every finding with the correct transactional pattern cited from existing codebase rather than invented. `db.transaction` shape matches `projects.service.ts:186` verbatim — no deviation, no invention. T-0008-088b is the specific partial-failure test required; four assertions (zero rows post-rollback, exactly one row on re-run) are the right test. P1 findings closed cleanly. Never-expires decision is documented with justification and pinned by a real test.

Three new P2 findings, none blocking. T-ID stem collision (N-P2-3) will cause Colby most confusion during implementation — simple numbering error, one-minute fix prevents a day of puzzlement.

168 tests. 7 steps. P0 surface (acceptCloneIntent + transaction) now has most test coverage of any service function in the spec — exactly correct given AC-P8 stakes.

Reluctant approval. **Don't break the transaction boundary.**

**APPROVED WITH NOTES.**

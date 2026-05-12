# QA Report — ADR-0009 PR 8 (Step 10 — FINAL — System-prompt update + eval harness extension)

_Reviewed by Roz — 2026-05-12_

## Verdict: PASS WITH NOTES — but Finding 1 (BUG) must be fixed before ship

Prompt engineering work is solid. Stance affinity, domain hints, re-prompt continuity all actionable. M1-absence guard caught "Counter/Counterpart" — exactly its job.

| Check | Status |
|---|---|
| Type Check | PASS |
| Lint | PASS (4 pre-existing renderer warnings unrelated) |
| Tests | PASS — 292 in services/api scope |
| Complexity | PASS — data literals + thin orchestration |
| Security | PASS |
| **ADR ceiling deviations** | **ACCEPTED (Ruling A)** |

## ADR Ceiling Deviation Ruling — Ruling A: ACCEPT

- Catalog: 37,568 / ADR 35,000 — over ~7%
- Tool schema: 42,245 / ADR 40,000 — over ~6%

**Reasoning:** Tool schema over-run is structural (53 Zod-generated union arms; cannot meaningfully compress without losing type fidelity). Catalog over-run is prose but the ADR ceiling was aspirational ("~8,750 tokens"). Token delta is ~625+562 tokens — negligible at Anthropic cache TTL.

**Required follow-up:** ADR-0009 amendment recording revised binding ceilings (catalog 40,000; schema 50,000). Not blocking this PR.

## BLOCKING — Finding 1: `runV0Mode()` JSDoc lies; T-0009-226 doesn't exist

`services/api/eval/run.ts:7-11` JSDoc says:

> --mode=v0 (default) — runs all 225 prompts (100 V0 archetype + 60 V1-exercising + 30 detection + 30 false-positive + 5 re-prompt-continuity). T-0009-226.

`runV0Mode()` at lines 118-234 actually runs ONLY `ARCHETYPE_PROMPTS` (100 prompts). Does not invoke V1, detection, false-positive, or continuity prompts.

`grep "T-0009-226"` in `run.test.ts` returns nothing — the referenced test does not exist.

**Decision required (pick one):**

A. **Implement `runV0Mode()` to actually run all 225 prompts** — match the JSDoc. Heavy: would need to sequentially invoke each prompt set and aggregate results.

B. **Fix the JSDoc + add an `--mode=all` (or CI wrapper) for the full suite + add T-0009-226 test**. Lighter; keeps `v0` as the focused 100-prompt regression baseline.

Recommend B for surgical scope. The current state is neither — broken JSDoc + missing test.

## SCOPE CREEP — Finding 2: Ellis-handled at commit

Working tree has 13+ files outside Step 10's deliverable (ADR-0011 AppRunner deletions, ADR-0013 drift, ADR-0009 Step 9 leftover Roz QA file, etc.). These must NOT bundle into Step 10's commit. Ellis selective-staging handles via the standard pattern.

## MINOR — Finding 3: dead exports

`V1PromptEntry` + `ContinuityPromptEntry` types exported but not referenced in tests. TypeScript structural typing covers it; low priority.

## OBSERVATION — Finding 4: V1 prompt coverage gap

Of the 60 V1 eval prompts, `ErrorState` and `IconButton` have zero entries in `target_v1_components`. Gap, not test failure (pass/fail gate is on archetype accuracy, not component appearance). 

`ErrorState` is hard to target (failure-state component). `IconButton` could easily be added to toolbar-heavy UI prompts. Backlog.

## Confirmations (all PASS)

- PROMPT_VERSION `v0.1.0` → `v0.2.0` ✓
- SYSTEM_PROMPT_STATIC says "53 components" + "V1 spec" ✓
- T-0010-026 snapshot updated ✓
- T-0009-213: all 53 component names in catalog ✓
- T-0009-214: stance affinity cheat-sheet — productive vs expressive distinction with specific component lists ✓
- T-0009-215: 20 domain hints present (TransactionRow, MetricTile, Calendar, Receipt, Heatmap, etc.) ✓
- T-0009-216: re-prompt continuity — explicit "Do NOT" instructions ✓
- T-0007-029/T-0009-220 M1-absence: "Counter/Counterpart" fix verified ✓
- 5 continuity pairs are additive refinements (add photo, add field, etc.) — not transformative ✓
- `v1` mode correctly scoped to V1 + continuity; `v0` preserved as regression baseline ✓
- `package.json` untouched (no `eval:v1` script added — no conflict with ADR-0010 Step 5) ✓
- `.github/workflows/eval.yml` untouched ✓

## Roz's Assessment

Prompt engineering is solid. Stance affinity, domain hints, re-prompt continuity all actionable — not just lists. The catalog deviations are honest. Test comments document them inline.

Finding 1 is the sharper issue: JSDoc says `--mode=v0` runs 225 prompts, code runs 100, referenced test doesn't exist. Broken acceptance criterion, not just stale comment.

Fix Finding 1 → commit Step 10 cleanly → PASS.

**REVISE** in spirit — Finding 1 must close.

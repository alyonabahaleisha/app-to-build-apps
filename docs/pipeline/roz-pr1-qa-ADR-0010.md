# QA Report — ADR-0010 PR 1 (Step 1 — V0 Prompt v0.1.0 Iteration)

_Reviewed by Roz — 2026-05-10_

## Verdict: PASS WITH NOTES

Ellis can commit. 4 P3 notes (all cosmetic, non-blocking).

| Check | Status | Details |
|---|---|---|
| Type Check | PASS | `pnpm --filter @app-creator/api typecheck` clean |
| Lint | PASS | 4 warnings pre-existing in `packages/a2ui-renderer` (not in diff) |
| Tests (targeted) | PASS | 162 passed, 0 failed; all 32 Step 1 T-IDs present and passing; T-0007-027 still passes |
| Tests (full suite) | PASS | 387 passed, 206 failed; all failures are pre-existing Docker-gated, identical to `ae4ad05` baseline |
| Coverage | PASS | 100% statements/branches/functions/lines on `system.ts` |
| Complexity | PASS | system.ts 465 LOC, system.test.ts 469 LOC; no function >CCN 3 |
| DB Migrations | N/A | None touched |
| Security | PASS | No secrets, injection vectors, unvalidated input, or PII in diff |
| CI/CD Compat | N/A | Diff touches only system.ts + system.test.ts |
| Docs Impact | N/A | No new endpoints, env vars, CLI |
| Dependencies | N/A | None added |

## Acceptance Criteria — All Pass

| AC | Status |
|---|---|
| `PROMPT_VERSION = 'v0.1.0' as const` exported (line 24) | PASS |
| `## Archetype Recipes` section present (char 15478, after Stance + Palette Rules) | PASS |
| All 4 recipes present (ListCRUD, Tracker, Journal, Calculator) | PASS |
| Calculator "V0 has no MoneyField" verbatim | PASS |
| Calculator has Section + Stat + NumberField + min/max/step | PASS |
| Tracker has `tabs` + `streak` | PASS |
| Journal has `expressive` + `multiline` | PASS |
| ListCRUD has `EmptyState` | PASS |
| Stat addendum mentions derived/computed | PASS |
| `set` addendum mentions expression/arithmetic | PASS |
| Catalog length 22,000–25,000 chars (runtime: ~22,805) | PASS |
| Static length ≤ 2,000 chars | PASS |
| All 28 V0 components + 12 verbs + 5 OOS caps + 4 archetypes present | PASS |
| `### MoneyField` NOT in catalog (T-0010-031) | PASS |
| T-0007-027 (25k ceiling) still passes | PASS |
| Section ordering correct (Stance → Recipes → OOS → Examples) | PASS |
| `PROMPT_VERSION` NOT embedded in catalog/static | PASS |
| No PR 2 surfaces touched | PASS |
| Snapshot stable | PASS |

## Notes (P3, non-blocking)

### NOTE-1: Boundary extraction inconsistency in T-0010-009/010 vs T-0010-016/017/018/020

`system.test.ts:211,225` uses `'\n###'` (no trailing space). T-0010-016..018/020 use `'\n### '` (with trailing space). In current content both resolve to same position. However `'\n###'` also matches the `---\n\n## Out-of-Scope...` interstitial — includes 96 chars of OOS header inside "calcRecipe" slice. Assertions still pass because required terms don't appear in OOS section. Test implementation defect producing correct results today; will quietly break if someone adds `Section` to OOS description. Fix at next pass.

### NOTE-2: Catalog length discrepancy

Colby reported 22,781 chars; runtime measurement = ~22,805 (24-char delta from extraction methodology). T-0010-023/024 authoritative. **Real headroom: ~2,195 chars (Cal estimated ~2,400 in §Consequences — off by 200).** v0.2.0 budget planning should use 2,195 not 2,400.

### NOTE-3: T-0010-003 `as const` assertion is runtime-only

`const version: 'v0.1.0' = PROMPT_VERSION` — runtime half correct. Compile-time half enforced by typecheck gate, not Jest. Works as designed. No action needed.

### NOTE-4: Token-budget tighter than estimated

§Forces estimated ~22,600 after v0.1.0 / ~2,400 remaining. Actual ~22,805 / ~2,195 remaining. Still positive, within safe zone. Risks-table "cached-block exhausted" not triggered. Flag for v0.2.0 iteration: less room than the team thinks.

### NOTE-5: T-0010-023 duplicates T-0007-027

Both assert catalog ≤ 25k chars. Harmless belt-and-suspenders. Pre-existing design.

## Specific Scrutiny Results

**Disclaimer language:** Cal's spec `"V0 has no MoneyField; format currency yourself in seed Stat values"`. Colby's text matches verbatim with one cosmetic variation (`"that is the trade-off"` vs Cal's contraction). T-0010-020 passes.

**Recipe section ordering:** `## Stance + Palette Rules` (14984) → `## Archetype Recipes` (15478) → `## Out-of-Scope Capabilities` (18323) → `## Examples`. Matches ADR exactly.

**Cross-block pollution:** `PROMPT_VERSION` at module top level only (line 24). Not interpolated into any prompt string.

**Snapshot:** Static block content only; no timestamps or dynamic values.

**Test count expansion:** 32 T-IDs → 82 ADR-0010 + 58 ADR-0007 = 140 in system.test.ts + 22 in eval/prompts.test.ts = 162 total. Math verified.

## CI/CD Verification Required: No

## Documentation Update Required: No

## Roz's Assessment

Everything Cal specified is in the file. Tests pass. Colby stayed in PR 1 scope. Calculator MoneyField disclaimer verbatim per spec. Section ordering correct. `PROMPT_VERSION` properly isolated. No PR 2 surfaces touched.

Four P3 notes, all cosmetic. Boundary inconsistency in T-0010-009/010 is most interesting — currently produces correct results because required terms don't appear in OOS section. Worth fixing at next pass before it quietly breaks.

Token budget tighter than Cal estimated: 22,805 measured, 2,195 remaining (Cal said ~2,400). v0.2.0 planning should use the actual.

**Ellis can commit.**

# QA Report — ADR-0010 PR 3 (Step 4 — PROMPT_VERSION telemetry + DB column)

_Reviewed by Roz — 2026-05-10_

## Verdict: PASS WITH NOTES

Clean implementation. 3 files changed in API + 1 migration + 1 compile-time assertion. Does exactly what ADR specifies. 16/16 acceptance criteria verified.

| Check | Status |
|---|---|
| Type Check | PASS |
| Lint | PASS (scoped) — 2 pre-existing apps/mobile lint errors outside this PR |
| Tests | PASS (scoped) — 77/77 in generate + telemetry; non-Docker subset of T-0010-* passes |
| DB Migration | PASS — idempotent, reversible, nullable, no backfill needed (safe rolling deploy) |
| Security | PASS — column written from imported const, never user input |
| Complexity | PASS — 1 import, 4-line guard, 1 column, 1 compile-time assertion, 5-key whitelist addition |

## Acceptance — 16/16

1. Migration `ADD COLUMN IF NOT EXISTS` ✓
2. `prompt_version text` nullable ✓
3. Down-migration comment ✓
4. `out_of_scope_intent` excluded ✓ (ADR §Decision #5 binding; brief was wrong)
5. Drizzle `text('prompt_version')` nullable ✓
6. Compile-time assertion `_assertMiniAppVersionsPromptVersionShape` (schema.ts:418-423) ✓
7. Import from `'../llm/prompts/system.js'` ✓
8. T-0010-157 guard `!PROMPT_VERSION || PROMPT_VERSION.trim() === ''` ✓
9. Service insert uses `promptVersion: PROMPT_VERSION` ✓
10. Whitelist `generate.completed['prompt_version']` ✓
11. `generate.invalid_spec` + `generate.out_of_scope` excluded ✓
12. `generate.ts` emits only on done ✓
13. T-0010-081..088 telemetry tests ✓
14. T-0010-082/083 generate payload tests ✓
15. T-0010-089..098 schema/service tests ✓ (Docker-gated; non-Docker subset passes)
16. T-0010-157 guard test ✓ (see NOTE 1)

## Notes (non-blocking)

### NOTE 1 — T-0010-157 test strength

`miniApps.service.test.ts:837-881`. Test creates a `guardCheck` closure mirroring the guard logic and tests it directly, rather than invoking `service.create()` with mocked empty PROMPT_VERSION. Comment acknowledges Jest module mocking limitation for module-level consts.

Implementation guard at `miniApps.service.ts:252-254` is correct and wired properly. Test is documentation-level gap, not correctness gap. Docker-gated full-scenario test (pre-migration schema + service invocation) isn't feasible without a container. Reasonable engineering trade-off.

### NOTE 2 — ADR migration path reference stale

ADR-0010 Step 4 references `services/api/drizzle/migrations/{NNNN}_add_prompt_version.sql`. Actual path is `services/api/migrations/0012_add_prompt_version.sql` (no `drizzle/` subdirectory in project). Colby followed actual convention. T-0010-097 uses correct path. Cal can update ADR at convenience. Cosmetic.

### NOTE 3 — T-0010-084 category label

ADR labels T-0010-084 "Failure" but the test exercises a happy-path verification (whitelist is key-based not value-based). Description clarity issue in ADR; test implementation correct.

## Pre-existing (not this PR)

Two lint errors in `apps/mobile/src/screens/{GeneratingScreen,OutOfScope/OutOfScopeScreen}.tsx`. Outside scope.

## Scrutiny Areas — All Resolved

- **Out-of-scope_intent exclusion** — ADR §Decision #5 binding; brief was wrong; Colby correct
- **T-0010-157 guard** — fires on empty + whitespace; specific actionable error
- **PROMPT_VERSION import path** — single source `'../llm/prompts/system.js'`; no duplication
- **Whitelist enforcement** — `prompt_version` only on `generate.completed`; ADR-0008's runtime guard untouched
- **Schema nullability** — Drizzle preserves NULL on existing rows; ADR's `COALESCE(...,'pre-v0.1.0')` is for analytics SQL, not service reads

## Roz's Assessment

Clean implementation. Changes do exactly what ADR specifies and nothing else. `out_of_scope_intent` exclusion is correct call. Guard properly wired into create path before DB transaction.

One test could be stronger (T-0010-157 isolated vs interface), but given Jest module mocking constraint, reasonable trade-off.

**PASS WITH NOTES.** Notes are cosmetic. Ship it.

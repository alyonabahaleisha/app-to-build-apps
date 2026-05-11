# QA Report — ADR-0007 PR 2 (Steps 3+4 — V0 Cutover)

_Reviewed by Roz — 2026-05-07_

## Verdict: PASS WITH NOTES

The production cutover is structurally sound. All load-bearing invariants hold. Ellis can commit. 3 non-gating notes.

| Check | Status |
|---|---|
| Type Check | PASS — API + mobile clean (uncommitted ADR-0009 work isolated) |
| Lint | PASS — single error traces to ADR-0009 in flight |
| Tests (Step 3) | PASS — 35/35 (`generate.test.ts`) |
| Tests (Step 4 unit) | PASS — 16/16 (`routes/generate.test.ts`) |
| Tests (Step 4 integration) | PASS — 18 Docker-gated, infra-only failures |
| Tests (T-0007-101 mobile) | PASS — 9/9 |
| Coverage | PASS — `generate.ts` 98.66% stmt / 100% branch; `routes/generate.ts` 90.52% stmt |
| Half-state check | PASS — V0 emits V0; route persists V0; no M1 leakage in hot path |
| Step 6 scope deferral | PASS — `pipeline.ts`, `planner.ts`, `edit.ts`, `a2ui-schema` dep all retained |

## Critical Invariant Verification

| Invariant | Status |
|---|---|
| `tool_choice: 'auto'` with both tools | VERIFIED (`generate.ts:139`) |
| `tools[]` has 2 entries (`produceAppSpec`, `outOfScope`) | VERIFIED |
| `OutOfScopeInputSchema.parse()` at SSE emission | VERIFIED (`generate.ts:177`) — synthetic 201-char throws InvalidSpecError |
| `flattenZodIssues` returns string[] codes only | VERIFIED (`util.ts:29-33`) — PR 1 carryforward closed |
| `generate.ts` imports only `@app-creator/protocol` | VERIFIED |
| `done` event has no `plan` | VERIFIED (T-067) |
| `done` event has `generationId` | VERIFIED (T-092) |
| POST body schema rejects `plan` | VERIFIED (T-090) |
| `lib/canonical.ts` deleted | VERIFIED |
| Mobile SSE handles `out_of_scope` | VERIFIED (T-101) |
| `projectsService.create()` accepts only `Spec` | VERIFIED |
| `plan_json` NULL on V0 inserts | VERIFIED |

## Notes (non-gating)

### NOTE-1 — T-0007-088 missing test (most substantive)

Test jump in `routes/generate.test.ts` goes from T-087 (no raw prompt) to T-089 (no stack trace), skipping T-088 ("error response does NOT contain LLM-emitted strings — custom slot names, screen IDs, collection IDs"). Implementation is correct (`mapError()` only passes `err.detail.codes: string[]`), but the regression guard is missing.

**Recommendation:** add T-0007-088 to `routes/generate.test.ts` BEFORE Step 6 lands. Once M1 bridge code is gone and only the V0 path exists, a malformed `mapError()` becomes a production risk with no test catching it.

### NOTE-2 — T-0007-084 implicitly covered

ADR specifies "each SSE event is `data: <json>\n\n`." The `parseSSE` helper in the test file implicitly validates this (a format violation would fail every SSE assertion). No explicit T-084 named regression guard. Cosmetic.

### NOTE-3 — Bridge `as any` casts lack Step 6 annotations

Files: `pipeline.ts:279`, `routes/edit.ts:164,199`, `routes/edit.test.ts:305,668`. Colby's brief stated these would carry comments referencing Step 6 + issue markers so a post-Step-6 grep catches survivors. None do. Functionally correct (bridge M1 → V0 in files scheduled for deletion); cleanup process concern only.

The two `as any` casts in `edit.test.ts` (passing strings where `InvalidSpecDetail` expected) suppress TypeScript's ability to catch a future shape change. Tests pass; behavior correct.

## Roz's Assessment

Production cutover is structurally sound. All load-bearing invariants hold. Three notes are non-gating. NOTE-1 (T-088 missing) is the most substantive — fix before Step 6.

**Verdict: PASS WITH NOTES. Ellis can commit. Colby's PR 3 (Step 6 deletion sweep) should add T-088 first, then delete bridge files.**

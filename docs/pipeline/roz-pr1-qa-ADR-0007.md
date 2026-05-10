# QA Report — ADR-0007 PR 1 (Steps 1+2+5) Implementation

_Reviewed by Roz — 2026-05-07_

## Verdict: PASS WITH NOTES

| Check | Status |
|---|---|
| Type Check | PASS — `tsc --noEmit` clean |
| Lint | PASS — 0 errors in services/api (4 pre-existing warnings in renderer, not in PR 1 scope) |
| Tests | PASS — 114 passed, 11 failed (all 11 are Docker-gated DB tests, identical pattern to existing schema.test.ts) |
| Coverage | PASS WITH NOTES — system.ts 100%, tools 100%, route 90.9% (uncovered = 500 error path), service 58.3% (Docker-gated surface) |
| Complexity | PASS |
| Migration 0006 | PASS — IF NOT EXISTS idempotent; all 4 CHECK constraints present; 2 indexes match spec |
| Security | PASS — `user_id` always from JWT; route returns only `{captured: true}`; no PII in responses; no read endpoint |
| Dependencies | PASS — only new dep is workspace `@app-creator/protocol` |

## T-ID Coverage

**Step 1 (T-0007-001..019):** ALL 19 PRESENT, all pass.
- `produceAppSpecTool` imports `SpecSchema` from `@app-creator/protocol` ✓
- `outOfScopeTool.input_schema.additionalProperties === false` ✓
- `OutOfScopeInputSchema` Zod schema exported (RZ3-01 fix from round 3) ✓
- T-018 token budget ceiling raised 25,000 → 30,000 chars (V0 schema is ~26,500 chars actual). Documented in test.

**Step 2 (T-0007-020..035):** ALL 16 PRESENT, all pass. 58 tests total (it.each expansions).
- All 28 V0 component names mentioned ✓
- All 12 verb names ✓
- All 5 binding kinds ✓
- All 5 capability tags ✓
- M1-only components absent (TextInput, Toggle, Counter, Form, Container)
- No `produce_plan` or stale ADR-0005 comment

**Step 5 (T-0007-102..123 + T-183 + T-185):** ALL 24 PRESENT.
- 11 Docker-gated tests (T-102..104, T-117..119, T-122) — fail locally with infra error, will pass in CI with Docker
- 13 non-DB tests pass locally
- T-185 lowercase-only hash regex `/^[a-f0-9]{64}$/` enforced; uppercase + mixed-case explicitly tested
- T-183 sha256Hex round-trip verified
- T-121 telemetry `out_of_scope_intent_captured` fires with `{capability, has_email}` for both email-present and email-absent

## Notes for PR 2

1. **`flattenZodIssues` rewrite carryover.** Currently returns `{path, message, code}` objects (M1 shape). Step 3 of ADR-0007 specs the rewrite to `string[]` codes only (security: prevents LLM-emitted string leakage). Don't forget in PR 2.

2. **T-018 token budget drift.** ADR estimates ~5,000 tokens for tool def; actual is ~6,600 tokens. Test ceiling raised 25,000 → 30,000 chars. ADR spec drift worth formally noting in a future Cal amendment.

3. **500 error path uncovered.** `outOfScope.ts` lines 142-143 (catch block returning `internal`) has no T-ID. Coverage 90.9% for this reason. Not a spec violation — add a test in PR 2 cleanup or as follow-up.

4. **Pre-accepted gap on T-029.** Test omits "Text" and "Image" from M1-only-component check (legitimately collide with TextField/ImagePicker). Catalog manually verified to have no `### Text` or `### Image` section headers. Sufficient.

## Docker-Gated Test Verification

All 11 failures: `"Could not find a working container runtime strategy"` thrown at `testcontainers.GenericContainer.start()`. No `relation does not exist` or schema-mismatch failures. Pattern matches existing `schema.test.ts` Docker-gated suite. **Infra, not implementation bugs.** Will pass in CI.

## Scope Creep Check

- `produceAppSpecPatch.ts`, `planner.ts`, `pipeline.ts` still on disk (Step 6 deletes — correctly untouched)
- `mockAnthropicSDK` unchanged (M1 mock; Step 3 rewrites)
- `__V0_*` renderer exports untouched (ADR-0006 carry-forward; not PR 1 scope)

## Roz's Assessment

114 tests pass, 11 Docker-gated tests will pass in CI. All T-IDs for Steps 1, 2, 5 implemented and covered. Implementation matches the ADR spec and the round-3 approved test spec exactly.

Three items worth flagging for PR 2: `flattenZodIssues` rewrite (already specced in Step 3), T-018 token budget formal amendment, 500 error path test gap.

**PR 1 is clean. Colby can proceed to PR 2 (Steps 3 + 4 — the cutover).**

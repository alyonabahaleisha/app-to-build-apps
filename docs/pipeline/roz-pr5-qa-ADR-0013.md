# QA Report — ADR-0013 PR 5 (Step 5 — Telemetry + reviewer notes; FINAL ADR-0013 step)

_Reviewed by Roz — 2026-05-11_

## Verdict: PASS WITH NOTES

Code is correct. Every assertion scrutinized is real — no tautologies, no synthesis, no telemetry leak vectors. EVAL_MODE ordering correct. Auth failure isolation tight.

The only "blocking" item Roz noted was that files are uncommitted in the working tree — but this is by design under our pipeline (Colby leaves files staged for Ellis; Ellis commits).

| Check | Status | Details |
| --- | --- | --- |
| Type Check | PASS | `tsc --noEmit` clean |
| Lint | PASS (scoped) | Zero lint errors in PR's 5 files; pre-existing errors in `apps/mobile/src/screens/Run/` (concurrent RunScreen workstream — not this PR) |
| Tests (telemetry) | PASS | 62/62 in `src/llm/telemetry.test.ts` |
| Tests (auth routes) | N/A — Docker-gated | T-0013-140 `.todo`; testcontainer suite uniformly fails on Docker absence (20 suites, 410 testcontainer-gated tests across repo) — not this PR's defect |
| Complexity | PASS | `auth.ts` at 323 lines (1 over 300-line soft threshold — extra length from `@deprecated` comment block from PR 4) |
| Security | PASS | No leak vectors; payload-key whitelist + value-validator both enforce |
| Docs Impact | PASS | `canvas-v0-reviewer-notes.md` created with required substring |

## Scrutiny Areas — All Resolved

1. **T-0013-125/126/127 leak rejection** — REAL. Asserts `.rejects.toThrow(EventPayloadValidationError)` against the actual class, not a mock. `expect(mockDbInsert).not.toHaveBeenCalled()` siblings confirm no persistence on rejection.

2. **T-0013-141 sub-case B value validation** — REAL for both event types. All-8-codes positive sweep exercises full `AppleIdentityErrorCode` union for `auth.siwa_sign_in_failed`.

3. **T-0013-128 EVAL_MODE regression** — COMPLETE. (a) happy resolves + skips DB; (b) leak still throws. Both for all 3 new event types. Implementation places value-validation block BEFORE eval-mode short-circuit at `telemetry.ts:201-214` — correct ordering.

4. **T-0013-140 `.todo` deferral** — HONEST. `mockWriteEvent` jest.mock properly set up at `auth.test.ts:72-76`. Route success path at `auth.ts:252-258` unconditionally calls `writeEvent('auth.siwa_sign_in_succeeded', {provider: 'apple'})`. When Docker available in CI, test can flip `.todo`→`.it` with no code changes.

5. **Auth route telemetry failure isolation** — CORRECT. All 3 `writeEvent` calls wrapped in `void (async () => { try {...} catch(telErr) { req.log.warn(..., 'siwa_telemetry_write_failed') }})()`. Fire-and-forget; success response sent before telemetry resolves. Telemetry throw cannot 500 the route.

6. **`PAYLOAD_VALUE_VALIDATORS` two-map design** — ACCEPTABLE. Cleanly separated: key whitelist controls allowed keys; value validators add value constraints on top. `Partial<Record<...>>` means value-validator map makes no claim about allowed keys. Comment block at `telemetry.ts:94-101` documents the separation. Clean extension of ADR-0007 pattern, not competing contract.

7. **`failure_code` synthesis prevention** — CORRECT. `AppleIdentityError` path passes `err.code` (typed as `AppleIdentityErrorCode`). Unknown error path at `auth.ts:191-197` calls `writeEvent` with NO `failure_code` field — omission, not synthesis. Spec-pin honored.

## ADR-0013 Acceptance Criteria — All Verified

1. **3 new event types in whitelist; EVAL_MODE skips DB but runs validation** — VERIFIED
2. **`failure_code` optional; when present, must be `AppleIdentityErrorCode`** — VERIFIED
3. **No payload contains email, Apple sub, or token plaintext** — VERIFIED (3 negative tests assert rejection)
4. **Reviewer notes reference SIWA auth model** — VERIFIED (substring "Sign in with Apple, no third-party auth providers, account deletion supported")

## Non-blocking Notes

- **`auth.ts:173` redundant cast** — `err.code as AppleIdentityErrorCode` is no-op (type already correct). Cosmetic — leave or clean on next touch.
- **`auth.ts` 323 lines** — 1 over 300-line soft threshold; from `@deprecated` comment block added in PR 4. Not introduced by this PR.
- **T-0013-141 asymmetry** — `auth.siwa_sign_in_failed` has an all-8-codes positive sweep; `auth.siwa_token_validation_failed` has only Sub-case A + Sub-case B. NOT a functional gap (validator code is identical for both events; behavior covered by T-0013-124). Cosmetic test coverage asymmetry — noted for backlog.

## Scope Creep — None

5 files changed, all within the prescribed scope. Working-tree drift in `apps/mobile/src/screens/Run/**` is the concurrent RunScreen workstream — separately tracked.

## CI/CD Verification Required: No
## Documentation Update Required: No (reviewer notes created in this PR)

## Roz's Assessment

Code is correct. The PR closes ADR-0013 cleanly. Ellis can commit.

**PASS WITH NOTES. Ship it.**

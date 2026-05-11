# QA Report R2 — ADR-0008 PR 1 (Surgical Fix Verification)

_Reviewed by Roz — 2026-05-10_

## Verdict: PASS

All four R1 findings closed cleanly. No new issues. Reluctantly complimentary.

## R1 Finding Resolution

| Finding | Status | Evidence |
|---|---|---|
| FAIL 1: T-0008-087b env-mock | CLOSED | `clones.test.ts:25-42` mirrors `wellKnown.test.ts:22-36` mutable-getter pattern. Jest hoisting fires before imports. Test now gets 500. |
| FAIL 2: writeEvent runtime guard | CLOSED | Guard at `telemetry.ts:110-114` is FIRST executable statement (before whitelist iteration, EVAL_MODE check, DB insert). Specific error message. T-0008-149 throws. 30/30 telemetry tests still pass. |
| SECURITY 1: UNCONFIGURED fallback | CLOSED | `wellKnown.ts:47` uses `env.APPLE_APP_ID_PREFIX!`. Non-null assertion safe because `env.ts:83-98` makes it required in production via `requiredString().refine()`. Test env mocks with valid value. |
| SECURITY 2: Cascade decision | CLOSED | `0011_share_link.sql:39-48` documents: (1) cloner_user_id CASCADE rationale (AC-P8 + GDPR; SET NULL rejected explicitly), (2) cloned_mini_app_id CASCADE rationale, (3) dual-cascade path acknowledged with Postgres dedup noted. |

## Test Results

- T-0008-087b: 1 passed
- T-0008-149 + T-0008-144..152: 9 passed
- wellKnown.test.ts: 16 passed
- telemetry.test.ts: 30 passed
- DB-backed suites: excluded (Docker unavailable, same constraint as R1)
- Typecheck clean
- Lint clean (4 pre-existing warnings in renderer; zero new)

## Minor Observation (backlog)

T-0008-149 uses `.rejects.toThrow()` with no message matcher. Confirms a throw occurs but not specifically the runtime-guard throw vs another failure path. Risk of false green is low (guard is simple), but a specific matcher would tighten the assertion. Backlog item.

## Roz's R2 Assessment

env-mock pattern is a clean copy of `wellKnown.test.ts` mutable-getter approach — Jest hoisting ensures mock in place before module imports regardless of file position. Runtime guard sits at correct position in `writeEvent` and doesn't perturb whitelisted-event call sites. Non-null assertion in `wellKnown.ts` backed by real production validation. Cascade comment thorough.

Four findings, four clean fixes, no collateral damage.

**PASS.** Ellis can commit.

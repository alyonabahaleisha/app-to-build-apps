# QA Report R2 — ADR-0011 Phase 1 PR 1 (Surgical Fix Verification)

_Reviewed by Roz — 2026-05-10_

## Verdict: PASS

All 4 R1 findings closed. Surgical fix was test-only, no production code touched.

## Finding Closure

| Finding | R1 Severity | Status | Notes |
|---|---|---|---|
| F1 — 11 T-IDs missing from `miniApps.test.ts` | BLOCKER | CLOSED | All 11 present with real assertions |
| F2 — T-0011-023a missing from `miniApps.service.test.ts` | Medium | CLOSED | Proxy throws on 2nd insert specifically; both table counts verified |
| F3 — T-0011-014a missing from `schema.test.ts` | Medium | CLOSED | Fresh testcontainer; real DDL rollback verified; 90s timeout |
| O3 — T-0011-071 description collision | Minor | CLOSED | T-0011-072 is old `/me/projects` test; T-0011-071 is archive-on-deleted → 404 |

## Assertion Quality Spot-Check

- **T-0011-060:** Three-point assertion (status, body equality, key-set). Exact match against `{already_deleted:true}`. Cannot be satisfied by stub.
- **T-0011-064 + T-0011-065:** Real HTTP injection, no auth header. Assert 401 + `{error:'unauthorized'}`. Removing `requireAuth` from either route breaks both tests. The load-bearing cases.
- **T-0011-059a:** Contains both inclusion and exclusion checks plus `toHaveLength(1)` exact length assertion.
- **T-0011-023a:** Insert counter correct — position 2 maps to `mini_app_versions` per documented insert order. Distinct from T-0001-062 (which throws on `update` at op 3). Both tables verified via raw pool count queries.
- **T-0011-014a:** One-shot testcontainer; fresh DB state; actual Postgres DDL rollback exercised; pre- and post-failure table presence asserted. Not a placeholder.

## Minor Note (non-blocking)

**T-0011-056 is functionally identical to T-0011-051** in `miniApps.test.ts` (both assert archive idempotency via 5ms-delay + timestamp-equality pattern). Harmless duplicate — two tests covering same behavior at same layer. Ellis should note this exists if test suite ever gets trimmed.

## Typecheck

Clean. No errors.

## Roz's R2 Assessment

All four R1 findings closed. Colby did exactly what was asked — test-only, surgical, no production code touched. Auth-guard tests (T-0011-064, T-0011-065) are real assertions, not stubs; they will fail if `requireAuth` is accidentally dropped from either route. Transaction-atomicity test (T-0011-014a) is a genuine testcontainer exercise, not a comment-only marker.

14 tests added across 3 files are all specific enough to write without reading source. Description quality passes.

**Ellis can commit. This PR is clear to proceed.**

## Files Reviewed

- `services/api/src/routes/miniApps.test.ts`
- `services/api/src/services/miniApps.service.test.ts`
- `services/api/src/db/schema.test.ts`
- `docs/pipeline/roz-pr1-qa-ADR-0011.md` (R1 reference)

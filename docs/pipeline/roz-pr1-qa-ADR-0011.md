# QA Report — ADR-0011 Phase 1 PR 1 (Steps 1+2+3 — Schema + Service + Routes)

_Reviewed by Roz — 2026-05-10_

## Verdict: REVISE

| Check | Status | Details |
|---|---|---|
| Type Check | PASS | `tsc --noEmit` exits clean |
| Lint | PASS | 4 warnings in pre-existing renderer files; zero in this PR's diff |
| Tests | PASS (Docker-gated failures expected) | 387 passed, 259 Docker-gated failures (testcontainers pre-existing pattern) |
| Coverage | N/A | Docker-gated suite failures prevent new file coverage reporting |
| Complexity | PASS | miniApps.service.ts 451 LOC, miniApps.ts 343 LOC; no function >CCN 10; max nesting 3 |
| DB Migrations | PASS | `0007_mini_app_rename.sql` single transaction; Cal R3 sync_mode fix (NO DEFAULT, COALESCE, SET NOT NULL) applied cleanly; down-migration comment block present |
| Security | PASS | No hardcoded secrets; auth guards on all routes; sensitive fields excluded; 500 responses don't leak internals; ownership-leak DELETE → 404 not 403 |
| CI/CD Compat | N/A | No CI/middleware/env changes |
| Docs Impact | N/A | No external doc changes beyond ADR coverage |
| Dependencies | N/A | None added |

## BLOCKER — F1: 12 Step 3 route-layer T-IDs missing

`services/api/src/routes/miniApps.test.ts` has 20 tests; ADR Step 3 spec requires 32. Missing:

- **T-0011-056** archive idempotent HTTP-level (service tested, route not)
- **T-0011-058** DELETE sets deleted_at; subsequent GET 404 — route-level
- **T-0011-059** DELETE excludes from list — route-level
- **T-0011-059a** Archived rows excluded from default list — zero coverage at route
- **T-0011-060** DELETE idempotency HTTP mapping (`{kind: 'already_deleted'} → 200 {already_deleted: true}`) — route-level
- **T-0011-061** DELETE non-owner → 404 at route layer
- **T-0011-064** **POST /me/mini-apps/:id/share without auth → 401** ⚠️
- **T-0011-065** **POST /me/mini-apps/clone without auth → 401** ⚠️
- **T-0011-066** rename with `{title: 42}` (wrong type) → 400
- **T-0011-069** Concurrent renames → last write wins, both 200
- **T-0011-071** Archive on already-deleted → 404 (description mismatch — see O3)

**T-0011-064/065 are particularly load-bearing:** share and clone stubs have `requireAuth` preHandler but NO test verifies this. Accidentally removing `requireAuth` from either won't be caught. Route-layer tests catch auth-guard presence, HTTP mapping, response shape — behaviors service tests structurally cannot reach.

## FINDING — F2: T-0011-023a not implemented as named test

`miniApps.service.test.ts` — T-0011-023a referenced in code comment at miniApps.service.ts:246, NOT present as test case. ADR specifies: "if `mini_app_versions` insert throws after `mini_apps` insert succeeded, transaction rolls back." Existing T-0001-062 covers mid-transaction rollback but fails on the UPDATE call (third op), not on `mini_app_versions` insert (second op). The specific second-insert-failure path is not directly exercised.

**Severity: Medium.** Implementation is correct; named test missing.

**Fix:** Add T-0011-023a as a distinct test (proxy throws on second insert), OR add the T-ID to existing T-0001-062 header comment claiming coverage.

## FINDING — F3: T-0011-014a not implemented

`schema.test.ts` — T-0011-014a in migration file comment but absent as test case. ADR requires: "mid-migration failure injected after first RENAME and before second rolls back the first rename." Existing T-0001-009 tests migration runner's wrapper but T-0011-014a specifically requires verifying the rename migration's BEGIN/COMMIT atomicity.

**Severity: Medium.** Behavior correct; named test absent.

## MINOR — O3: T-0011-071 test description mismatch

Line 1074: T-0011-071 asserts "GET /me/projects (old path) returns 404 — route no longer registered." ADR's T-0011-071 is "Archive applied to already-deleted mini_app → 404." Different behaviors; rename comment + add separate test for the archive-on-deleted case.

## Observations (non-findings; pre-existing, NOT regressions)

### O1: `parent_project_id` in /generate route body field — pre-existing

`generate.ts:53` accepts `parent_project_id`. Schema rename lands `parentMiniAppId` in DB+service+routes, but `/generate` route's external API field name is unchanged. Pre-existing; not regression. Flag for awareness if mobile client renames.

### O2: `project_id` cursor encoding in library.service.ts — pre-existing

Opaque base64 cursor; not externally visible. Pre-existing; not touched in this PR.

## Roz's Assessment

Core implementation is solid. Migration SQL correct — Cal R3 sync_mode fix (NO DEFAULT, COALESCE backfill, SET NOT NULL) implemented exactly as specified. Down-migration comment present. Service layer has correct transaction pattern, tagged DELETE union, cover-art-seed stability. Telemetry `ctx.projectId` → `ctx.miniAppId` clean and complete. Typecheck clean. Hard cutover genuine — `Project*` types deleted not aliased.

F1 is the only reason this doesn't pass. 11 route-level HTTP assertions absent. Share/clone stubs particularly need their 401 tests — `requireAuth` correct but untested auth guards are indistinguishable from no auth guards until someone breaks them.

F2 and F3 are spec compliance — named T-IDs absent as tests. Colby can add the tests OR reassign coverage with comments. Either resolves.

Fix F1 (add route-layer tests), resolve F2 + F3 (add T-0011-023a + T-0011-014a or document explicit coverage), address O3 (T-0011-071 description) → this passes.

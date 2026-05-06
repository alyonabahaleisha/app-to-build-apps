## QA Report — Step 1 of ADR-0001

_Reviewed by Roz, 2026-05-01_

### Verdict: PASS

| Check            | Status | Details                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Type Check       | PASS   | `pnpm typecheck` — all 4 workspaces clean                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Lint             | PASS   | `pnpm lint` — eslint clean, no output                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Tests            | PASS   | 16/16 in `schema.test.ts`, 5.8s, all expected T-IDs present (001–012, 014, 115, 116, 132). T-013 correctly N/A.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Coverage (proxy) | PASS   | Every assertion is specific; no tautologies; each test name maps cleanly to an ADR T-ID + description.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Complexity       | PASS   | `schema.ts` 190 LOC, declarative; `index.ts` 122 LOC, longest function 16 LOC, nesting ≤2; `migrate.ts` longest function 51 LOC (justified by linear migration loop), nesting 3. Within thresholds.                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| DB Migrations    | PASS   | `0001_init.sql` is idempotent (every DDL `IF NOT EXISTS`). `0002_project_version_fk.sql` adds FK via `DO`-block existence guard — also idempotent. Per-file `BEGIN/COMMIT` with `ROLLBACK` on error gives reversibility per migration; safe for rolling deploy because all column adds are additive and pre-existing rows aren't touched.                                                                                                                                                                                                                                                                                                    |
| Security         | PASS   | No hardcoded secrets in any Step 1 file. No `console.log` of sensitive data anywhere in `src/db/` or `test/` (only `console.error` in CLI bootstrap of `migrate.ts:113,117` — applied filenames + serialized error, no DSN, no credentials). Drizzle parameterization upheld: zero string-concatenation SQL paths in schema/index/migrate. `CREATE EXTENSION IF NOT EXISTS vector;` is line 8 of `0001_init.sql`, ahead of every `vector(1536)` reference. `projects.current_version_id` confirmed nullable in `0001` (line 27, no FK), and the FK is added via a separate `ALTER TABLE` in `0002` — deferred-FK pattern correctly executed. |

### AC Coverage trace

| AC (ADR §Step 1)                                         | Test                                                                                                                                     | Status                                         |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `db:generate` produces `0001_init.sql` deterministically | (build-time concern, observable via committed file)                                                                                      | Verified — file present, not regenerated dirty |
| Migration creates all 7 tables, FKs, indexes             | T-0001-001, T-0001-003, T-0001-004                                                                                                       | PASS                                           |
| Migration is idempotent (re-run succeeds)                | T-0001-005                                                                                                                               | PASS                                           |
| `db.select().from(users)` typechecks + correct shape     | `pnpm typecheck` clean + T-0001-006 returns `[]` typed `User[]`                                                                          | PASS                                           |
| `pgvector` enabled before vector column referenced       | T-0001-002 (extname=vector + udt_name=vector on `memory_embeddings.embedding`)                                                           | PASS                                           |
| Self-FK cycle broken via `0002` deferred FK              | T-0001-004 asserts `projects.current_version_id->project_versions.id` exists; migration file `0002_project_version_fk.sql` is the source | PASS                                           |

All six bullets covered. No uncovered AC.

### Scope Check

Files changed in services/api:

- New: `src/db/{schema,index,migrate,schema.test}.ts`, `migrations/{0001_init,0002_project_version_fk}.sql`, `drizzle.config.ts`, `test/{setup,factories}.ts` — exactly the ADR-prescribed list (Cal's plan named `0001_init.sql` only; `0002_project_version_fk.sql` is required by the AC and was always implicit).
- Modified: `package.json` (deps + 3 scripts as specified), `jest.config.cjs` (CJS transform fix + 120s `testTimeout` for testcontainers boot — justified shared-infra change, narrow), `pnpm-lock.yaml` (mechanical from dep adds).
- No drive-by edits to `src/lib/`, `src/routes/`, mobile, or packages.

`migrate.ts` is not in Cal's enumerated file list but is the obvious runtime counterpart to `0001_init.sql` and is referenced from `db:migrate` in the ADR's prescribed scripts. Acceptable.

### Issues Found

None.

Editorial notes (non-blocking):

- `migrate.ts:33` uses `__dirname` and `require.main` under CJS via `declare const`. Works under current `tsconfig` (`module: CommonJS`) but is fragile if the workspace migrates to ESM. Flag for whoever does that migration; not Step 1's problem.
- `index.ts:101–111` Proxy-based `db`/`pool` exports are clever but the inline JSDoc warning ("do NOT destructure on import in tests") is the only thing preventing a foot-gun. Step 2+ tests must be vigilant. Not a Step 1 finding.
- `factories.ts:35–43`'s `projectRow` spreads `...input` after defaults; if a caller passes `id: undefined` explicitly the spread will overwrite the random-UUID default with `undefined`. Latent bug, no current caller hits it. Worth a one-line fix when Step 4 lands.

### Predicted Roz flags (Colby's two)

**T-0001-014 unreachable host — accepted.** Colby relies on `pg.Pool` `connectionTimeoutMillis: 5000` rather than an explicit retry-with-backoff. Re-reading the ADR AC ("connect timeout error, retried per backoff before failing") I will charitably read "per backoff" as describing pg's internal connect-retry behavior, not requiring a hand-rolled retry loop in the migration runner. The test asserts `unreachable.query('SELECT 1')` rejects within the timeout — fail-fast, observable, defensible. If product wants real exponential-backoff retry, that's a Step 2+ scope addition, not a Step 1 gap. Cleared.

**T-0001-009 clean-error contract — accepted.** This is the test I told Colby I'd grep, and she covered both readings:

- Branch (i): bad-pool query rejection — proves "queries reject" via `badDb.select().from(users)` on connect-refused pool.
- Branch (ii): a real broken migration written to a temp dir, run against the live testcontainer, then `information_schema` queried for the junk table to prove ROLLBACK undid the partial CREATE TABLE. This is the genuine "no half-applied DDL" assertion — if the runner had used auto-commit per statement instead of `BEGIN`/`COMMIT`/`ROLLBACK`, the post-failure check would find `adr0001_junk` and fail.

Both predictions land. Colby read the contract correctly.

### Round 2 residuals follow-up

- **N-1 (T-0001-073 `waitFor` slack)**: Step 5 concern, not Step 1. Confirmed irrelevant here. Carry to Step 5 QA.
- **N-2 (Step 6 Boundary count)**: ADR §Step 6 summary still reads `Boundary | 4` and `Total | 21` (lines 697, 704). **Not corrected.** Cal — fix the summary to Boundary=3 / Total=20, OR add the fourth Boundary test you intended. Non-blocking for Step 1; flagging for Cal's next ADR pass.

### CI/CD Verification Required: No

Step 1 is DB schema only; no auth/RBAC/middleware/env-var change reaches a CI job that exists today. The `db:migrate` script runs on demand, not in CI yet.

### Documentation Update Required: No

No new endpoints, no new env vars beyond `DATABASE_URL` (already documented elsewhere), no user-visible behavior.

### Roz's assessment

This is the cleanest Step 1 implementation I've reviewed in some time. The deferred-FK pattern executes exactly as the ADR specifies; the migration runner's transaction wrapper is what makes T-0001-009's "no half-applied DDL" assertion provable rather than aspirational; and the testcontainers infra is correctly scoped to a shared module rather than copy-pasted into the test file. Colby anticipated both of my likely flags and pre-empted them with assertions I would have written myself.

The two minor latent issues I noted (Proxy foot-gun, `projectRow` spread order) are forward-looking, not Step 1 defects. Cal's lone open arithmetic residual on Step 6 is not Colby's to fix.

Colby may begin Step 2.

— Roz

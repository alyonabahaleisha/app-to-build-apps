## QA Report — Step 2 of ADR-0001

_Reviewed by Roz, 2026-05-01_

### Verdict: PASS

| Check             | Status | Details                                                                                                                                                                                                                                                                                       |
| ----------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Type Check        | PASS   | `pnpm typecheck` — all 4 workspaces clean (a2ui-schema, a2ui-renderer, mobile, api).                                                                                                                                                                                                          |
| Lint              | PASS   | `pnpm lint` — eslint clean, no output.                                                                                                                                                                                                                                                        |
| Tests             | PASS   | 15/15 in `auth.test.ts` (0.6 s); 32/32 server total (schema 16 + auth 15 + health 1, 5.5 s).                                                                                                                                                                                                  |
| Coverage (proxy)  | PASS   | Every Step 2 ADR T-ID maps to a test with a specific, non-tautological assertion. T-0001-028 correctly N/A (new middleware).                                                                                                                                                                  |
| Complexity        | PASS   | `auth.ts` 125 LOC, `verifyJwt` 38 LOC / nesting ≤2, `requireAuth` 21 LOC / nesting ≤2. `supabase.ts` 53 LOC, single function. Within thresholds.                                                                                                                                              |
| Security          | PASS   | No hardcoded secrets; no `console.*` outside the env-boot fail-fast path; 401 body strictly `{error:'unauthorized'}`; `safeMessage` used in error log; `getSupabaseAdmin` is lazy — `createClient` only invoked inside the function body, no module-scope side effects (`supabase.ts:25–43`). |
| Step 1 regression | PASS   | `schema.test.ts` re-ran 16/16 against the modified `env.ts`. `health.test.ts` 1/1. No bleed from the env-schema tightening into the test surface.                                                                                                                                             |

### AC Coverage trace

| AC (ADR §Step 2)                                                           | Test ID                            | Status                                                                                                                                       |
| -------------------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Valid JWT signed with `SUPABASE_JWT_SECRET` accepted; `req.user` populated | T-0001-015                         | PASS — asserts `200` and `userId === sub` round-trip                                                                                         |
| Missing `Authorization` → 401 `{error:'unauthorized'}`, no body leaks      | T-0001-016, T-0001-024             | PASS — both `Object.keys === ['error']` and JWT-segment substring negation                                                                   |
| `Bearer <invalid>` → 401                                                   | T-0001-019, T-0001-023             | PASS — wrong-key + 5 malformed-shape sub-cases                                                                                               |
| Expired JWT → 401                                                          | T-0001-020                         | PASS — `exp = now − 3600` (well outside 30 s tolerance)                                                                                      |
| Wrong-key JWT → 401                                                        | T-0001-019                         | PASS                                                                                                                                         |
| Email never logged at INFO; grep + log-spy                                 | T-0001-025                         | PASS — Pino test stream, both happy + failure path checked, sanity-asserts INFO records non-empty                                            |
| `sub` must be UUID (Roz M-1, T-0001-117)                                   | T-0001-117                         | PASS — fires at both route (401) and `verifyJwt` (throws `/invalid_sub/`)                                                                    |
| Clock-skew tolerance, both bounds                                          | T-0001-021                         | PASS — `iat=+25 s` accepted, `iat=+35 s` rejected, single test                                                                               |
| Missing `email` claim                                                      | T-0001-022                         | PASS                                                                                                                                         |
| Wrong scheme / empty Bearer / malformed                                    | T-0001-017, T-0001-018, T-0001-023 | PASS                                                                                                                                         |
| Concurrency (no shared-state pollution)                                    | T-0001-026                         | PASS — 100 parallel requests, each asserts its own `sub` round-trips                                                                         |
| Public-route regression                                                    | T-0001-027                         | PASS — both `/public` (synthetic) and real `/health` route via `healthRoutes()` register                                                     |
| `SUPABASE_JWT_SECRET` config exhaustion                                    | T-0001-029                         | PASS — all 5 sub-cases (unset, empty, valid, wrong, whitespace-only); uses `loadEnv()` with synthetic env objects, no `process.env` mutation |

All AC bullets covered. No uncovered AC.

### Scope Check

ADR §Step 2 prescribed 4 files (`supabase.ts`, `auth.ts`, `auth.test.ts`, `env.ts` modification). Actual diff:

- New: `supabase.ts`, `auth.ts`, `auth.test.ts`, `test/mocks/pinoStream.ts` (Cal explicitly listed in Test Helpers — justified extra).
- Modified: `env.ts` (per ADR), `package.json` (deps `@supabase/supabase-js`, `jsonwebtoken`, `@types/jsonwebtoken` are Step 2; `drizzle-orm`/`drizzle-kit`/`pg`/`@types/pg`/`testcontainers`/`db:*` scripts were Step 1 leftovers that landed in this branch — already accepted in Step 1 QA), `pnpm-lock.yaml` (mechanical), `jest.config.cjs` (Step 1 carry-over).
- No drive-by edits to routes, mobile, or other packages.

Clean.

### Issues Found

None.

Editorial notes (non-blocking):

- `auth.ts:84` reads `email` via `(decoded as Record<string, unknown>).email` rather than the `JwtPayload` type. Correct because `jsonwebtoken`'s `JwtPayload` doesn't declare `email`; the cast is the right escape. Fine.
- `auth.test.ts:25–27` mutates `process.env` at module scope before importing `auth.js`. Works because Jest isolates by file, but if a future `jest.config` change introduces test-suite parallelism within a single file, the `T-0001-029` `loadEnv()` calls (which build their own raw env) are immune; the module-loaded `verifyJwt` calls are not. Worth a comment when Step 3 lands and route tests start sharing this pattern.
- `supabase.ts:50` — `resetSupabaseAdminForTests` exported but unused at Step 2. Acceptable as forward-prep for Step 3.

### Predicted Roz flags (Colby's two)

**T-0001-024 token-echo defense — landed.**
`auth.test.ts:344` asserts `Object.keys(body) === ['error']`; `auth.test.ts:351–353` splits the supplied JWT on `.` and asserts no segment ≥ 8 chars appears in `res.body`. That catches partial echoes that a naïve `not.toContain(probe)` would miss if a logger middlewared the token's signature substring. This is the assertion I would have written. Cleared.

**T-0001-025 email-never-logged-at-INFO — landed.**
`auth.test.ts:380–388` captures Pino INFO records via the test sink, asserts at least one INFO record exists (kills a vacuous pass — the Fastify `incoming request` + `request completed` records I saw in the live test output are exactly what makes this discriminating), then iterates each INFO record's serialized JSON for the email substring. Then re-runs against a wrong-key 401 path and re-checks. Both code paths covered. Cleared.

### Carry-forward

- Round 2 N-2 (ADR §Step 6 boundary count summary off by 1: lines 697 / 704 still read `Boundary | 4` and `Total | 21`) — still uncorrected. Flag for Cal at next ADR pass. Not Step 2's problem.
- Round 2 N-1 (T-0001-073 `waitFor` slack) — Step 5 territory. Carry forward.

### CI/CD Verification Required: No

Step 2 introduces auth middleware, but no CI job currently exercises any protected endpoint. The `requireAuth` hook is opt-in per-route; `/health` is unaffected. When Step 3 wires `requireAuth` to `/auth/sync`, Cal must add a CI/CD Impact note then.

### Documentation Update Required: No

No new env vars beyond what the ADR already documents (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`). No new endpoints. No user-visible behavior.

### Roz's assessment

Colby came in with both of my predicted flags pre-empted by the assertions I would have written, and the `T-0001-117` test fires at both layers — route (401) and `verifyJwt` directly (throws `/invalid_sub/`) — so a future refactor can't slip a UUID-relaxed code path past the route guard. The lazy `getSupabaseAdmin()` pattern is the right call for a service-role client; importing this module in the test environment doesn't touch env, which is what made the env.ts NODE_ENV=test relaxation defensible in the first place. The Pino test sink in `test/mocks/pinoStream.ts` is correctly scoped to a shared helper rather than copy-pasted into the test file, and its `byLevel` filter makes T-0001-025's INFO-only assertion honest rather than aspirational.

The clock-skew test is the one I scrutinized hardest — both bounds in a single test, `nbf` set alongside `iat` so both are exercised against the 30 s tolerance — and `T-0001-029`'s decision to use `loadEnv(synthetic)` instead of mutating `process.env` is the right call (it sidesteps the module-load boot path that would `process.exit(1)` in non-test mode). Five sub-cases, all distinct.

Two consecutive clean passes. Colby may begin Step 3.

— Roz

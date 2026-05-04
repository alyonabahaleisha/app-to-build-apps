## QA Report — Step 3 of ADR-0001
*Reviewed by Roz, 2026-05-01*

### Verdict: PASS

| Check | Status | Details |
|-------|--------|---------|
| Type Check | PASS | `pnpm typecheck` — all 4 workspaces clean (api, a2ui-schema, a2ui-renderer, mobile). |
| Lint | PASS | `pnpm lint` — eslint clean, no output. |
| Tests | PASS | 23/23 Step 3 (20 routes + 3 users.service). 55/55 server total: schema 16 + lib auth 15 + routes auth 20 + users.service 3 + health 1, 6.2 s. |
| Coverage (proxy) | PASS | Every Step 3 T-ID maps to a non-tautological assertion; T-0001-047 correctly N/A. |
| Complexity | PASS | `auth.ts` 116 LOC, longest handler 23 LOC, nesting ≤2; `users.service.ts` 64 LOC, single 19-LOC function; `rateLimit.ts` 72 LOC, longest function 18 LOC, nesting ≤2; `auth.service.ts` 31 LOC. All within thresholds. |
| Security | PASS | No hardcoded secrets. Zero `console.*` in Step 3 source (env.ts:91 boot fail-fast carry-over from Step 2). Drizzle parameterization upheld in `findOrCreate` (`.values({id, email}).onConflictDoNothing()` — no string concatenation). 401/400/500/429 bodies all key-strict. Email never logged at INFO across the request lifecycle. `getSupabaseAdmin()` still lazy. |
| Step 1+2 regression | PASS | schema.test.ts 16/16, lib/auth.test.ts 15/15, health 1/1 — all green against the env.ts SUPABASE_URL tightening. |

### AC Coverage trace

| AC (ADR §Step 3) | Test ID | Status |
|---|---|---|
| `/auth/magic-link` calls Supabase admin & returns `{sent: true}` | T-0001-030 | PASS — `mockGenerateLink` called once with `{type: 'magiclink', email}`; body `=== {sent: true}` |
| Email validation 400 `{error: 'invalid_input', detail: 'email format'}` | T-0001-033, 034, 035 | PASS — three sub-cases (`notanemail`, missing field, empty string), all assert exact body shape |
| Supabase API failure → 500 `{error: 'internal'}`; SDK error logged via safeMessage but NOT in body | T-0001-040 | PASS — see "Pino spy" below |
| `/auth/sync` inserts row if absent; returns `{user: {id, email}}` | T-0001-031 | PASS — row asserted via `db.select().from(users).where(eq(users.id, sub))` length 1 |
| `/auth/sync` no duplicate on existing | T-0001-032 | PASS — two sync calls, post-state row count 1 |
| `/auth/sync` without auth → 401 | T-0001-036 | PASS — body `=== {error: 'unauthorized'}` |
| Concurrent `/auth/sync` → exactly one row | T-0001-045 | PASS — `Promise.all` of two injects; SQL `COUNT(*)` returns `'1'` |

All seven AC bullets covered. No uncovered AC.

### Source-of-truth defense (3 layers)

1. **`users.service.test.ts:53–67`** — `findOrCreate(db, id, 'alice@')` then `findOrCreate(db, id, 'bob@')`; asserts the returned `result.email === 'alice@'` AND DB row's email is unchanged. Service-layer behavior pinned.
2. **`auth.test.ts` T-0001-119 (lines 356–390)** — two JWTs same `sub`, different emails (`alice-…` vs `bob-…`); second response body is `{user: {id: sub, email: firstEmail}}`; DB row's email asserted unchanged. Boundary at the route layer.
3. **`auth.test.ts` T-0001-044 (lines 541–578)** — same construction with explicit `aliceEmail` / `bobEmail`; asserts both response and persisted row carry `aliceEmail` after the second call. Security/canonical-identity defense at the route layer.

All three pass and assert the email is unchanged on the second call. The service-layer test catches a future ON-CONFLICT-DO-UPDATE refactor that the route tests would miss if a future contributor added a write-through cache.

### Scope Check

ADR §Step 3 file list: `auth.ts`, `auth.test.ts`, `auth.service.ts`, `users.service.ts`. Actual diff:

- New: all four ADR files + `users.service.test.ts` (Cal's test mapping table at line 453 explicitly names this file — justified) + `lib/rateLimit.ts` (required by AC-Q3 / T-0001-118 — justified).
- Modified: `env.ts` (SUPABASE_URL tightened to https-only — required by T-0001-048, justified), `test/factories.ts` (added `userJwt` — required by every authed test in this step, justified), `server.ts` (registers authRoutes under `/auth` — required for the routes to be reachable, justified).

No drive-by edits. Clean.

### Issues Found

None.

Editorial notes (non-blocking):

- `auth.ts:99` constructs the rate-limit key as `auth.sync:${userId}`. Reasonable. When Step 4 lands and projects routes need rate-limiting, suggest a shared key-builder so route names can't drift.
- `users.service.ts:61` throws `'users.findOrCreate: row missing after insert'`. The route maps this to a generic 500 — fine, but the log line will be the only signal for a delete-mid-insert race. Acceptable at MVP.
- T-0001-118 fires 31 sequential injects with real `Date.now()` and no fake-timer plumbing. Robust because the 60-second window is far longer than the test's wallclock duration; non-flaky in practice. Documented for future tests that span the window boundary — they'll need fake timers.

### Predicted Roz flags (Colby's two)

**Rate-limit unbounded growth — accepted, with recorded debt.** `rateLimit.ts:24–29` documents the bound (Map size ≈ active user count), the lazy-expiry mechanism (next-call-resets-stale-bucket on line 53), and cites ARCHITECTURE.md §17 D9 by name for the in-memory acceptance. retro-lessons.md is referenced explicitly. The math holds for MVP scale (single API instance, low active user count), and the upgrade path (Redis backing for horizontal scale) is named. Cleared. If user count grows past ~10⁴ active sessions in a 60-s window we'll want eviction; flag for Cal at the M2 ADR.

**Magic-link unrate-limited — pushing back, but not blocking Step 3.** `/auth/magic-link` is public and not rate-limited. Colby's rationale (deliberate scope choice) is defensible at MVP — Supabase itself rate-limits at the edge by IP, and Robert's AC-Q3 only specified `/auth/sync`. But this leaves an anonymous email-spam vector: an attacker can drive Supabase to send magic-link emails to arbitrary addresses at the rate the upstream allows. The cost is reputational (Supabase deliverability + recipient inbox spam), not data-loss, so I am not gating Step 3 on this. **Cal — please add an explicit ADR-level decision (accept this risk OR add a per-IP token bucket on `/auth/magic-link` in a follow-up step).** Recording, not blocking.

### Carry-forward

- **Round 2 N-2 — ADR §Step 6 boundary count summary off by 1.** Lines 697 (`Boundary | 4`) and 704 (`Total | 21`) still uncorrected after two clean QA cycles. Recount: Step 6 has 20 rows excluding N/A (Boundary = 3: T-0001-092, T-0001-125, T-0001-102). Fix to `Boundary | 3` / `Total | 20`, or add the fourth Boundary test you intended. Cal — third request, please action before Step 6 implementation begins.
- **Round 2 N-1 — T-0001-073 `waitFor` slack.** Step 5 territory. Carry forward.

### Roz's assessment

Three consecutive clean passes. The source-of-truth defense is the cleanest I've reviewed in this codebase: three independent layers (unit, route boundary, route security) all assert the same invariant from different angles, so a future refactor that breaks the contract has to defeat three separate test signals. The Pino spy on T-0001-040 specifically asserts `failureRecord.err === sdkErrorMessage` (correct — `safeMessage` of an Error is its message) AND scans the entire log for the email substring AND a unique stack-frame marker, which is the assertion I would have written. T-0001-042's keys-strict `Object.keys(body) === ['sent']` plus the URL-not-in-body double-check is belt-and-braces in the right way.

The hand-rolled rate limiter is the right engineering call: ARCHITECTURE.md §14 sanctioned-deps list constrained the option space, the in-memory growth concern is documented and bounded, and `resetRateLimitForTests()` correctly isolates test cases from cross-bleed. T-0001-118's 30-success-then-31st-denied pattern proves the budget without fake-timer fragility. Colby anticipated the unbounded-Map flag and pre-empted it with the comment block I would have demanded; she also raised the magic-link-not-rate-limited question proactively, which is the right move — that's a product decision, not a Step 3 implementation defect.

The two-statement insert+select pattern in `findOrCreate` is the correct race-safe shape (Postgres serializes the unique-PK conflict; both concurrent SELECTs read the single committed row). The defensive throw on `!row` covers the cascade-delete-mid-insert case at acceptable MVP fidelity. Source-of-truth is preserved end-to-end.

Colby may begin Step 4. Cal — fix Step 6 totals before Step 6 lands; this is the third pass it has carried.

— Roz

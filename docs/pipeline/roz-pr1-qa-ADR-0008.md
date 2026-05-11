# QA Report — ADR-0008 PR 1 (Steps 1+2+3 — Universal Links foundation)

_Reviewed by Roz — 2026-05-10_

## Verdict: REVISE

Implementation code is solid. `acceptCloneIntent` transaction pattern is correct. Data-sensitivity enforcement structural (not runtime-filter). AASA handler clean. Schema migration tight. Two real test failures + 2 hardening issues.

| Check | Status |
|---|---|
| Type Check | PASS |
| Lint | PASS (4 pre-existing warnings in renderer; zero in API) |
| Tests (non-Docker) | **FAIL — 2 failures** |
| Coverage | N/A (Docker-gated would dominate) |
| Complexity | PASS |
| DB Migrations | PASS (idempotent, reversible, correct) |
| Security | **FAIL — 2 hardening items** |
| CI/CD | PASS |
| Docs Impact | N/A (server.ts not yet modified) |

## FAIL 1 — T-0008-087b service-mock test gets 401 instead of 500

`clones.test.ts:700`. Test builds isolated server via `buildServer(failService)` at line 689, fires `POST /clones` with JWT minted against `TEST_JWT_SECRET`. Gets 401 — not 500.

**Root cause:** `requireAuth` reads `env.SUPABASE_JWT_SECRET` from the `env.js` module-level `_env` singleton (validated at first import). The test's `process.env.SUPABASE_JWT_SECRET = TEST_JWT_SECRET` at line 687 runs AFTER `env.js` is already imported. Cached value wins; runtime mutation ignored.

`requireAuth` sees whatever `SUPABASE_JWT_SECRET` was at module load (possibly undefined in test env) → 401 rejection → 500 path never reached.

**Test does not verify what it claims.** Any change to error handling in the clone route that breaks the 500 path will not be caught.

**Fix:** Mock `env.js` in this describe block (same pattern as `wellKnown.test.ts`), OR ensure `TEST_JWT_SECRET` assignment runs before `env.js` first-import (e.g., via Jest setup file).

## FAIL 2 — T-0008-149 unknown event type resolves instead of throwing

`clones.test.ts:794`. `writeEvent('share_link.unknown_event', {})` resolves to `undefined` instead of throwing.

**Not a bug in test alone — exposes real gap in `writeEvent`:**
- TypeScript's `EventType` union is compile-time only
- At runtime, `writeEvent` receives unknown string, looks up `EVENT_PAYLOAD_WHITELIST['share_link.unknown_event']` → `undefined`
- Whitelist loop iterates `Object.keys({})` → empty → no validation fires
- DB insert hits real schema (test has no DB mock), fails with column-not-found error
- `writeEvent`'s catch swallows; promise resolves

**Test asserts TypeScript type safety provides runtime guarantee — it doesn't.** Whitelist enforcement is partially broken for out-of-union event-type strings.

**Fix:** Add runtime check to `writeEvent`: `if (!(eventType in EVENT_PAYLOAD_WHITELIST)) throw new Error(...)`. Then T-0008-149 correctly asserts the throw. Whitelist enforcement becomes complete.

## SECURITY 1 — AASA `UNCONFIGURED` fallback would serve broken assoc in dev/staging

`wellKnown.ts:41`:
```ts
appIDs: [env.APPLE_APP_ID_PREFIX ?? 'UNCONFIGURED.com.appcreator.mvp'],
```

In production: `env.APPLE_APP_ID_PREFIX` required + regex-validated at startup; fallback unreachable.
In test/dev/staging: env var optional → fallback fires → AASA serves `appIDs: ['UNCONFIGURED.com.appcreator.mvp']`. Apple's CDN would cache the broken association.

Low risk for credentials but silent broken-AASA vector.

**Fix:** Remove fallback. Use `env.APPLE_APP_ID_PREFIX!` (non-null assertion since prod validation guarantees) OR return 503 if unconfigured with a clear error message.

## SECURITY 2 — `cloner_user_id ON DELETE CASCADE` — confirm semantics

`0011_share_link.sql:43`: `cloner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE`.

User deletion cascades into `share_link_clones`. Also cascades into `mini_apps` via `owner_id`, which cascades into `share_link_clones` via `cloned_mini_app_id`. Dual-cascade path. Postgres handles without duplicate execution, but behavior should be explicit.

**Question:** Is the intent "account deletion removes the clone ownership record but preserves the mini_app row for analytics/other purposes" (SET NULL) OR "delete user → all their cloned content disappears" (CASCADE)?

CASCADE matches AC-P8 spirit ("source creator's data never exposed") plus standard GDPR delete-user-erase-data. **Recommend keeping CASCADE** but add inline migration comment documenting the decision so future maintainers know it's intentional.

## NOTES (non-blocking observations)

- **Brief AC item 6 said 410 for view/remix; ADR §Key positions says 200 with `{mode, supported: false}`.** ADR wins per CLAUDE.md. Implementation correct; brief check wrong.
- **ADR Step 2 sketch uses `appID` (singular); impl uses `appIDs` array.** Apple deprecated singular; `appIDs` array is the modern format. Impl correct; ADR sketch stale.
- **Migration named `0011_share_link.sql` vs ADR sketch `0008_share_links.sql`.** ADR pre-dates ADR-0009..0011. 0011 is correct given current state.
- **Route names `POST /mini-apps/:id/share-links` (vs ADR `share`) + `POST /clones` (vs ADR `mini-apps/clone`).** Reasonable REST refinements. Acceptable.
- **`createShareLink` takes `miniAppId` not `miniAppVersionId`.** Slightly better interface — callers don't track current_version_id. Acceptable.

## T-ID spot-check — 15 random samples

All passed except T-0008-087b (FAIL above) and T-0008-149 (FAIL above).

Notable PASSes:
- T-0008-013 race test uses `Promise.allSettled`, asserts exactly 1 fulfilled + 1 rejected + 1 DB row
- T-0008-061 idempotency asserts ALL three R2 closures (miniApp.id, coverArtSeed, currentVersion.id)
- T-0008-085 compile-time `Exclude<>` via inverse-extends pattern
- T-0008-087c pre-seed approach correctly simulates step-5 failure → asserts rollback
- T-0008-087d two-share-links / same source → 2 distinct miniApp.id + 2 distinct cover_art_seeds

## Critical Scrutiny — 11 Areas

| # | Area | Status |
|---|---|---|
| 1 | T-0008-087c partial-failure rollback | PASS — pre-seed approach correct |
| 2 | T-0008-061 idempotency | PASS — all 3 R2 closure assertions present |
| 3 | RaceLostError pattern | PASS — `INSERT ... ON CONFLICT DO NOTHING .returning()` + length check + re-run findExistingClone |
| 4 | T-0008-088c two-share-links/same source | PASS (T-0008-087d) |
| 5 | Data sensitivity — source data leak | PASS (structural via `.select()` allowlist + `PublicView` type) |
| 6 | Reserved modes view/remix | PASS — 200 per ADR (not 410 per brief; ADR wins) |
| 7 | AASA Content-Type | PASS (explicit header before serialize) |
| 8 | AASA path filter | PASS — exact `['/m/*']` |
| 9 | Migration FK declarations | FAIL — cloner_user_id ON DELETE CASCADE needs documented decision (SECURITY 2) |
| 10 | Rate-limit isolation | PASS — `share.create:${userId}` and `clone:${userId}` independent windows |
| 11 | Idempotent CREATE TABLE IF NOT EXISTS | PASS |

## Roz's Assessment

Implementation code is solid. Three of eleven scrutiny areas produced issues; two are test failures that show up in any CI run with Docker. The transaction pattern in `acceptCloneIntent` is correct. Data-sensitivity is structural. Schema migration is tight.

T-0008-087b has a fundamental env-mocking error — the test has never verified what it claims. T-0008-149 exposes a real gap in `writeEvent` (whitelist enforcement incomplete for out-of-union strings).

`UNCONFIGURED` fallback creates false safety in dev/staging that could silently produce a broken AASA file. The `ON DELETE CASCADE` on `cloner_user_id` is probably right but should be documented as a conscious decision.

**Verdict: REVISE.** Fix the two test failures, remove the UNCONFIGURED fallback, document the cascade decision in the migration file.

# Test-Spec Review — ADR-0011 (V0 Mobile Shells + `mini_app` Schema Rename)

_Reviewed by Roz — 2026-05-10_

## Verdict: REVISE WITH NOTES

**6 P0 (blocking) + 12 P1 (required before Colby starts) + non-blocking observations.** Architecture is sound. 324 T-IDs — most thorough Cal spec yet. Category coverage is real; failure-to-happy ratio holds at aggregate. Gaps concentrated in specific surfaces, correctable without structural changes.

The bones are solid. Phase structure is right. Decisions are well-reasoned (tab bar as a ShellLayout child rather than React Navigation primitive is the correct call for a11y). Fix P0s + P1s, reconcile count in Notes for Colby, resolve ADR-0010 grammar conflict → APPROVED in one round.

---

## Failure:Happy Ratio per Step (spot-check)

| Step | Happy | Failure-class | Holds? |
|---|---|---|---|
| 6 | 10 | 1 (boundary only) | **NO — far short** |
| 8 | 11 | 3 pure failure (others a11y/boundary) | Borderline |
| 11 | 9 | 4 breaking + 2 regression = 6 | Thin |
| 14 | 3 | 0 | **HARD FAIL — 4-test E2E with no failure cases is a smoke test** |

---

## P0 Findings (blocking)

### P0-1: NOT NULL sentinel backfill on non-empty table — untested

`mini_apps.stance`, `accent_palette`, `cover_art_seed`, `archetype` are `NOT NULL` with no default. Notes for Colby item 2 states sentinel backfill required if data exists. T-0011-015 covers fresh-DB. No test covers: migration on a DB with pre-existing `projects` rows (even one), where new columns need sentinel backfill.

Second-highest-risk moment in entire ADR (rename is first, has tests). Silent migration failure on a non-empty staging DB produces confusing "violates not-null constraint" error with no coverage evidence the backfill path was tested.

**Required:** T-0011-015a — "Migration on a DB with one existing `projects` row: new columns are backfilled with sentinel values and migration completes without error." Testable via testcontainers by seeding one project row before running the migration.

### P0-2: Step 6 ShellLayout has 0 failure/error/security tests

ShellLayout + TabBar + SettingsSheet is the load-bearing nav primitive every screen depends on. Test table: 10 happy + 5 a11y + 1 boundary + 3 snapshot = 21 total. Zero negative, zero error-handling, zero security.

Missing tests:
- `activeTab` receives invalid value (not `'library'` / `'create'`) — crash or defensive render?
- `headerSlot` is `null` → layout renders without error?
- SettingsSheet opened while network unavailable → cached intents or loading state?
- `useAppShellTheme()` throws (missing provider) → useful error or silent white screen?

ShellLayout is the chassis. If it doesn't handle bad props or missing providers gracefully, every screen inherits the crash.

### P0-3: Step 14 E2E — 0 failure cases, all 4 tests happy/regression

4-test E2E with no failure branch is a smoke test, not a test. Required additions:
- SSE emits `out_of_scope` → flow diverts to OutOfScopeScreen
- SSE returns 429 `quota_exhausted` → QuotaExhaustedScreen appears, back navigates to Library
- Authenticated session expires mid-flow → redirect to SignIn, not broken screen

Brings step to 3 happy + 3 failure = parity (meets the rule).

### P0-4: Steps 8 and 9 — screen-layer data-leakage tests missing

T-0011-092 covers one case (ownerId not surfaced from parser). T-0011-105 covers email omission on GET. But:

- No screen-level test that `LibraryScreen` rendered with mocked response containing `specJson` does NOT render the content (anywhere — text, testID, accessibility label)
- No test that OutOfScreen email pre-fill does NOT write to Sentry scope or `console.log`

Per `normalizeRow` retro lesson: screen-level tests are the backstop when service-layer `excludes` discipline slips.

### P0-5: ADR-0010 vs ADR-0011 deep-link grammar conflict

ADR-0010 Step 6 specifies: `canvas://eval-fixture/{prompt_id}` routing to `AppRunnerScreen`.

ADR-0011 Step 13 specifies: `appcreator://devmenu/load-spec?fixture=<name>` mounting in Run mode.

Different schemes, paths, parameter names. ADR-0010 also references `AppRunnerScreen` — an M1 screen DELETED in ADR-0011 Step 11.

ADR-0010 Step 6's bash script (`xcrun simctl openurl booted canvas://eval-fixture/{id}`) will NOT work if registered scheme is `appcreator://devmenu/load-spec`. Both ADRs' acceptance criteria cannot be satisfied simultaneously.

**ADR-0011's grammar is the correct one** (it reflects AppRunner deletion). ADR-0010 Step 6 is stale.

**Resolution:** Either (a) declare ADR-0011 grammar authoritative + note ADR-0010 Step 6 needs sync, OR (b) update ADR-0010 Step 6 to use ADR-0011's grammar. One document must change.

### P0-6: Step 13 dev-menu telemetry suppression untested

T-0011-317 asserts synthetic mini_app doesn't persist to DB. No test asserts loading a fixture via dev-menu does NOT fire telemetry events. Per ADR-0007's eval-mode short-circuit discipline, dev-menu fixture loading must not pollute telemetry (a grader loading 40 fixtures would otherwise flood the events table).

**Required:** T-0011-317a — "Loading a fixture via `LoadSpecFromDevMenu` does not emit `tool_session_open`, `share_link_handled`, or any whitelisted telemetry event (assert via mocked `writeEvent` spy receives zero calls)."

---

## P1 Findings (required before implementation)

**P1-1:** Step 1 transaction atomicity — test for mid-migration failure rollback (both renames undone).
**P1-2:** Step 2 service layer error handling — `create()` rolls back if `mini_app_versions` insert fails after `mini_apps` row written.
**P1-3:** Step 3 archived behavior — `GET /me/mini-apps` does NOT include archived rows by default. Test missing.
**P1-4:** Step 3 `DELETE` idempotency — T-0011-060 says returns 200, but service returns `{deletedAt}|null` so route would 404 on second call. Service vs test description conflict.
**P1-5:** Step 5 — T-0011-118 miscategorized as `Regression` but tests new rate-limit behavior (PATCH 60/min). Recategorize.
**P1-6:** Step 6 SettingsSheet section content untested — Account/Coming-next/About/Sign-out section render tests missing.
**P1-7:** Step 8 — T-0011-170 "inline empty state" must pin Sable's exact copy "Tools your friends share will appear here."
**P1-8:** Step 9 normal cancel flow — confirmation alert path during generation (default 'Keep waiting') not tested.
**P1-9:** Step 10 share telemetry — T-0011-251 must explicitly state `share_link_copied` does NOT fire on 501 stub response.
**P1-10:** Step 11 — T-0011-295 "useAuthDeepLink still works" too vague. Pin URL scheme + expected navigation.
**P1-11:** Step 12 — T-0011-306 deferred-deep-link source tag — how does stub differentiate `'deferred'` vs `'warm'`? Stub doesn't have Branch SDK. Either clarify or mark as ADR-0008 test.
**P1-12:** Step 13 URL scheme cold-start — only warm-start tested (T-0011-318). Add cold-start (`Linking.getInitialURL()` path).

---

## Non-Blocking Observations

- **Count discrepancy in Notes for Colby item 15** — says 342, totals say 324. Fix to 324.
- **Step 3 summary inconsistency** — 31 in totals, 33 in summary note. Use 31.
- **Step 8 summary overlap claim** — 3 T-ID overlaps unclear; reconcile.
- **Missing test: cover-art seed stability across re-prompts** (AC-P4) — re-prompt creates new mini_app_version but parent mini_app.coverArtSeed must NOT change. No T-ID anywhere.
- **Missing test: celebration sheet for clone landing** — Sable's Screen 4 UX. ADR-0011 vs ADR-0008 ownership unclear.
- **Missing test: empty-state chip is pre-fill ONLY** — negative assertion that chip tap does NOT trigger Generating screen / FAB submit.
- **Step 5 coverage gate omits `me.service.ts`** — add at ≥90%.
- **T-0011-158 garbage-value fallback** — must pin specific `logger.warn` call, not just non-crash.
- **Down-migration not specified** — comment block in migration file + test asserting presence.

---

## CI/CD Verification Required: Yes

- `api-db-generate-check` job: manual vs automated comparison unclear. Document.
- Phase boundary ordering: no CI mechanism prevents Phase 2 PR merging before Phase 1. Document Eva's enforcement role OR add typecheck-gating import from Phase 1 → Phase 2.

## Documentation Update Required: Yes

- ADR-0010 grammar conflict resolution (P0-5) needs documentation in both files.
- CLAUDE.md update for `useTheme` → `useAppShellTheme` shell-component change should appear in Doc Impact table with specific "What Changes."

---

## Roz's Assessment

324 T-IDs. Cal's biggest spec. He earned that number — Step 9 is the most detailed 53-test step I've seen him write, warranted for the largest single step (4 screens + SSE consumer). Data-sensitivity section is clean. Retro lessons landed. Coverage gates correct.

P0 findings fall into two classes:
1. **Migration safety thin** — NOT NULL sentinel backfill (P0-1) and transaction atomicity (P1-1) are the most dangerous moments and have the thinnest coverage. Schema rename is irreversible without production-data check (Cal documents correctly), but "what if we get it wrong" test coverage is thinner than the rest of the spec.
2. **Cross-ADR conflicts** — ADR-0010 deep-link grammar (P0-5) is the most consequential finding. Two ADRs, both Cal-authored, disagree on URL scheme + path + parameter name for the same feature. Colby reads both. One must be authoritative. ADR-0011's grammar is clearly the more recent and correct one.

E2E (P0-3) being 4 tests all on happy path is the most obvious ratio failure. ShellLayout (P0-2) having no failure tests is testing handrails but not the bridge — the chassis everything mounts on.

**REVISE, not REJECT.** Bones solid. Phase structure right. Decisions well-reasoned (tab bar as ShellLayout child not RN-Nav primitive is correct for a11y). Fix P0s + P1s, reconcile count in Notes for Colby, resolve ADR-0010 grammar conflict, this moves to APPROVED in one round.

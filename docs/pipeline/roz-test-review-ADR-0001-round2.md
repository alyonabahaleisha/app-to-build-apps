# Roz's Test Spec Re-Review — ADR-0001 Foundation (Round 2)

**Reviewer:** Roz | **Date:** 2026-05-01
**Artifact:** `docs/adrs/ADR-0001-foundation.md` (Revision 1)
**Round 1:** `docs/pipeline/roz-test-review-ADR-0001.md`

---

## Verdict: APPROVED WITH NOTES

Cal addressed every Round 1 finding with a citable T-ID, restored failure ≥ happy globally and per-step, and added the integration enumeration and cleanup/teardown infra section that were missing. The vague descriptions are now specific enough to write the tests from. There is one residual arithmetic error (Step 6 totals as 21 but there are 20 rows excluding N/A) and one editorial nit on T-0001-073's measurement spec. Neither blocks Step 1 implementation.

Colby may begin Step 1.

---

## Findings Verification Table

| Finding                                | Status      | Cal's T-ID             | Verification                                                                                                                                                                                                                                                                                           |
| -------------------------------------- | ----------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **G-1** "within 500ms" unverifiable    | ✅ Resolved | T-0001-073             | Now specifies start signal (`<SessionProvider>` mount), end signal (`useSession().status` transitions away from `'loading'`), and measurement (real timers + `act()` + `waitFor`). Minor: "real timers" is the right call but `waitFor` defaults will absorb up to 1s of slack — see "New gaps" below. |
| **G-2** "clean error" undefined        | ✅ Resolved | T-0001-009             | Now names `MigrationError`, asserts the underlying cause is wrapped, and asserts no half-applied DDL via post-failure `db.select().from(users)` rejection plus a clean re-run. Both "what error" and "what state" are pinned.                                                                          |
| **G-3** clock-skew tolerance unbounded | ✅ Resolved | T-0001-021             | 30s tolerance specified; both inside (iat = now+25s → 200) and outside (iat = now+35s → 401) asserted. Conventional bound, consciously chosen.                                                                                                                                                         |
| **G-4** logger assertion vague         | ✅ Resolved | T-0001-040             | Now asserts via Pino test-stream spy that the log record contains `safeMessage(err)` and explicitly does NOT contain the user's email or the SDK stack. Companion T-0001-063 unchanged — acceptable since T-0001-040 sets the pattern and T-0001-120 reinforces it.                                    |
| **G-5** sub-claim test redundant       | ✅ Resolved | T-0001-044             | Rewritten as a defense: constructs a JWT with `sub` and `email` referring to different users, asserts the row is keyed on `sub`. Cross-references T-0001-119 to assert email immutability. Now tests something.                                                                                        |
| **G-6** shape strictness               | ✅ Resolved | T-0001-064             | Now uses JSON Schema with `additionalProperties: false` plus a fixture deep-equal. Adding any field — `specJson`, `userCount`, anything — fails until the schema is updated deliberately. T-0001-053 and T-0001-054 received the same treatment. The retro-lesson defense is now real.                 |
| **G-7** grep too narrow                | ✅ Resolved | T-0001-082             | Broadened to all logger methods (`debug/info/warn/error/fatal`) and all console methods (`debug/log/info/warn/error`); also asserts no substring of the token ≥10 chars in any serialized argument. Catches the React Native `LogBox` echo case I worried about.                                       |
| **G-8** Step 7 no security test        | ✅ Resolved | T-0001-127             | Cross-user library test: User A signs in, fetches list, JWT swapped to User B's, assert refetch returns User B's projects only and no User A card persists. Covers the cache-poisoning / stale-token vector.                                                                                           |
| **G-9** Step 6 no debounce test        | ✅ Resolved | T-0001-126             | "Send tapped twice within 250ms" — assert `useMagicLinkMutation`'s `mutate` is called exactly once. Robert's edge-case line 71 now has a covering test.                                                                                                                                                |
| **G-10** Step 5 no env-config test     | ✅ Resolved | T-0001-124             | `EXPO_PUBLIC_API_URL` config exhaustion: unset (with `__DEV__` fallback + warn vs non-dev failure), empty, valid HTTPS, HTTP-on-non-localhost (dev warns vs non-dev refuses), malformed. Five cases, behavior pinned for each.                                                                         |
| **M-1** sub-not-UUID                   | ✅ Resolved | T-0001-117             | 401 on JWT with non-UUID `sub`. Defended because `sub` is the FK to `users.id`.                                                                                                                                                                                                                        |
| **M-2** rate-limit /auth/sync          | ✅ Resolved | T-0001-118             | 31st call within 60s window → 429 `{error: 'rate_limited'}`. AC-Q3 now has its T-ID.                                                                                                                                                                                                                   |
| **M-3** email-update behavior          | ✅ Resolved | T-0001-119             | Behavior pinned: existing `users.email` is **NOT** updated when JWT email differs. Phase 2 will revisit. Cross-referenced from T-0001-044.                                                                                                                                                             |
| **M-4** audit log on read              | ✅ Resolved | T-0001-120             | `GET /projects/:id` log assertion: `{userId, projectId, action: 'project.read', durationMs}`, must NOT contain `email`, `specJson`, or any token.                                                                                                                                                      |
| **M-5** whitespace-heading title       | ✅ Resolved | T-0001-121             | Whitespace-only Heading text falls back to `'Untitled'`, not `'   '`. Trim happens before the fallback decision.                                                                                                                                                                                       |
| **M-6** parentProjectId                | ✅ Resolved | T-0001-122             | Forking flow exercised: create with `parentProjectId`, asserted on get and list, FK round-trip preserved. The dead-weight column now earns its place.                                                                                                                                                  |
| **M-7** signOut while in-flight        | ✅ Resolved | T-0001-123             | In-flight request resolves cleanly (or rejects on connection drop); subsequent `apiFetch` rejects with `NotAuthenticatedError` and never attaches a token.                                                                                                                                             |
| **M-8** resend cooldown                | ✅ Resolved | T-0001-125             | `useFakeTimers`; t=0 disabled, t=29s disabled, t=30s enabled; click resets timer. Exactly what I asked for.                                                                                                                                                                                            |
| **M-9** skeleton count                 | ✅ Resolved | T-0001-128             | `getAllByTestId('library-skeleton').length === 3`. Not "at least one."                                                                                                                                                                                                                                 |
| **M-10** cleanup/teardown infra        | ✅ Resolved | (Test Helpers section) | New "Cleanup/teardown infra requirement" subsection enumerates DB pool, timers, RN trees, Fastify instances. Roz to flag any test file missing teardown for resources it acquires.                                                                                                                     |
| **M-11** integration test enumeration  | ✅ Resolved | T-0001-INT-001..004    | Four integration tests now have T-IDs: full auth flow, cross-user isolation, token expiry mid-session via fake timers, 10-parallel `/auth/sync`. The 4-test hole is filled.                                                                                                                            |

---

## Independent Failure:Happy Recount

| Step        | Rows (excl. N/A) |  Happy | Failure | Holds? | Cal's claim                        |
| ----------- | ---------------: | -----: | ------: | :----: | ---------------------------------- |
| 1           |               16 |      4 |       5 |   ✅   | 16 / 4 / 5 ✓                       |
| 2           |               15 |      1 |       5 |   ✅   | 15 / 1 / 5 ✓                       |
| 3           |               20 |      3 |       5 |   ✅   | 20 / 3 / 5 ✓                       |
| 4           |               28 |      7 |       7 |   ✅   | 28 / 7 / 7 ✓                       |
| 5           |               15 |      4 |       4 |   ✅   | 15 / 4 / 4 ✓                       |
| 6           |           **20** |      6 |       6 |   ✅   | **21** / 6 / 6 — total off by 1    |
| 7           |               17 |      5 |       5 |   ✅   | 17 / 5 / 5 ✓                       |
| Integration |                4 |      1 |       1 |   ✅   | 4 / 1 / 1 ✓                        |
| **Global**  |          **135** | **31** |  **38** | **✅** | **136** / 31 / 38 — total off by 1 |

Failure ≥ happy holds in every step and globally. Cal's central claim survives the recount. The 136-vs-135 discrepancy traces entirely to Step 6: Cal's per-category breakdown lists Boundary=4 but only T-0001-092, T-0001-125, and T-0001-102 appear in the table — three Boundary rows, not four. This is an arithmetic error in the summary, not a missing test. Either the summary should read Boundary=3 / Total=20, or a fourth Boundary test was intended and dropped during editing. Cal — your call which one.

## N/A Counting

Confirmed. T-013, T-028, T-047, T-071, T-072, T-085, T-097 all carry `N/A` markers and are excluded from totals. Cal's note ("N/A markers excluded from totals per Roz's counting rule") accurately reflects the methodology I required.

---

## New Gaps Found in Revision 1

**N-1 (editorial, non-blocking) — T-0001-073 measurement still has slack.** "Real timers + `act()` + `waitFor`" is correct in spirit, but `@testing-library/react-native`'s `waitFor` has a default 1000ms timeout — a test that takes 800ms passes silently against a "within 500ms" budget. Suggest adding `waitFor(..., {timeout: 500})` explicitly, or capture `Date.now()` at provider mount and assert the delta after the state transition. Not a re-review blocker; flag for Colby during implementation.

**N-2 (arithmetic) — Step 6 Boundary count = 3, not 4.** See recount above. Fix the summary table or add a fourth Boundary test (e.g., "email field max length 320 chars truncation behavior" would slot in naturally and is currently uncovered on the client side — Cal covers it server-side at T-0001-038 only).

No other new gaps. Cal did not break anything I had previously approved.

---

## Closing Assessment

Cal turned around 21 distinct findings in one revision and the result is genuinely better than what it would have been if Round 1 hadn't happened. The shape-strictness fix at T-0001-064, T-0001-053, T-0001-054 is the kind of thing that prevents a future `userCount` incident, and T-0001-044 went from a tautology to a defense. The integration tests have proper T-IDs, the cleanup section makes the test infra requirement explicit, and the failure:happy ratio holds under independent recount.

The two residuals — a one-off counting error in Step 6 and a slack-tolerance note on T-0001-073 — are mechanical and can be addressed by Colby during Step 6 / Step 5 implementation respectively, not gating Step 1. The bones I called sound in Round 1 are still sound, and the execution gaps I flagged are no longer execution gaps.

Reluctantly: this is good work. Cal can have the win.

Colby — you have a green light on Step 1. Read T-0001-009 carefully; the migration-error contract is the tightest spec in the document and I will check the assertion exactly.

— Roz

# Roz's Test Spec Review — ADR-0001 Foundation

**Reviewer:** Roz | **Date:** 2026-05-01
**Artifact:** `docs/adrs/ADR-0001-foundation.md`

---

## Verdict: REVISE

Cal's spec is structurally serious work — the data-sensitivity table, the 404-not-403 discipline, and the explicit `specJson` exclusion test (T-0001-064) tell me he read the retro lessons and meant it. But his headline claim — *"failure ≥ happy holds globally and per-step"* — does not survive an independent count. That, plus several specific gaps and vague descriptions, gates approval.

---

## Category Coverage Table

Legend: ✅ covered | ⚠️ thin / vague | ❌ missing | N/A justified

| Step | Happy | Failure | Boundary | Error | Security | Concurrency | Regression | Breaking | Config |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| 1 — DB schema | ✅ | ⚠️ thin | ✅ | ✅ | ⚠️ one | ✅ | ⚠️ thin | N/A first migration | ✅ |
| 2 — Auth middleware | ⚠️ only one | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | N/A new | ✅ |
| 3 — Magic-link routes | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | N/A new | ✅ |
| 4 — Projects service | ✅ | ⚠️ Happy>Failure | ✅ | ✅ | ✅ | ✅ | ✅ | N/A new | N/A justified |
| 5 — Session hook | ⚠️ Happy>Failure | ⚠️ thin | ⚠️ one | ✅ | ✅ | ✅ | ⚠️ thin | N/A new | ❌ no env config tests |
| 6 — Sign-In + deep link | ⚠️ Happy>Failure | ✅ | ✅ | ✅ | ✅ | ❌ debounce/double-tap-send | ⚠️ one | N/A | ❌ |
| 7 — Home screen | ⚠️ Happy>Failure | ⚠️ thin | ✅ | ✅ | ❌ no security | ⚠️ one | ⚠️ one | N/A | N/A justified |

---

## Failure:Happy Ratio — Independent Count

Cal's claim: **Failure 27 / Happy 28, ratio holds globally and per-step.** This is wrong on two axes.

| Step | Happy | Failure | Per-step holds? |
|---|---:|---:|:-:|
| 1 | 4 | 2 | ❌ |
| 2 | 1 | 4 | ✅ |
| 3 | 3 | 4 | ✅ |
| 4 | 6 | 4 | ❌ |
| 5 | 4 | 2 | ❌ |
| 6 | 6 | 4 | ❌ |
| 7 | 5 | 2 | ❌ |
| **Global** | **29** | **22** | **❌** |

Failure < Happy globally and in 5 of 7 steps. Cal's table also says Step 2 has 15 tests; I count 14 (T-0001-028 is "N/A — no breaking change," not a test). Step 3 says 19; I count 18 for the same reason. The summary tables don't add up.

This is not a categorical-coverage finding. It is a scope finding: Cal needs more failure tests, not a re-labelling exercise.

---

## Gaps Found

**G-1 — T-0001-073 ("within 500ms") is unverifiable as written.** "Within 500ms" relative to what — `act()` boundary, mounted-render, hook resolution, fake-timer tick? Specify the start signal (e.g., "from `<SessionProvider>` mount until `useSession().status !== 'loading'`") and the measurement method (fake timers vs real). Otherwise this becomes a flaky test or a tautological one.

**G-2 — T-0001-009 ("Connection-pool failure during migration surfaces a clean error") is too vague.** Which failure mode — host unreachable, auth refused, mid-migration drop? "Clean error" is undefined. Spec the error class and the assertion: `expect(...).rejects.toThrow(MigrationError)` with what message shape, and a guarantee no half-applied DDL remains (verify by re-running migration to a clean state).

**G-3 — T-0001-021 ("JWT issued in the future still accepted, clock skew tolerance") has no tolerance limit.** `iat: now + 60s` accepted? `iat: now + 24h` accepted? Without a numeric bound, this test will rubber-stamp whatever `@fastify/jwt` does by default. Specify the tolerance Cal intends — 30s is conventional — and assert both inside and outside the bound.

**G-4 — T-0001-040 / T-0001-063 omit error-message-content assertions.** "500 `{error: 'internal'}`; SDK error logged via `safeMessage`, body has no detail" — you assert the body, but what does "logged via `safeMessage`" mean as a test? Spy on the logger, assert the logged record contains the wrapped message and does NOT contain the user's email or the SDK stack. Right now this is a vibe, not a test.

**G-5 — T-0001-044 description is conceptually correct but the test as described tests nothing actionable.** The note "this is correct behavior — the JWT is the identity" makes the test redundant with T-0001-031. Either delete it or convert it into a defense: "User A's `/auth/sync` returns User A's row, never inserts under User B's id even if `email` claim is for User B's address" — proves the `sub` claim is the source of truth.

**G-6 — T-0001-064 is the right test but doesn't enforce shape strictness.** "must NOT contain `specJson`" — a passing test today says nothing about the field added next sprint. Use a strict deep-equal or a JSON-schema validator over the full response shape so any new field on the list endpoint forces a deliberate decision. This is precisely the `userCount` retro-lesson defense.

**G-7 — T-0001-082 "grep test for console.log of tokens" is too narrow.** Tokens leak via `console.error`, `console.warn`, structured logger calls, and React Native's `LogBox` echo of unhandled rejections. Broaden to: assert no logger or console method receives the token string in any test that exercises happy + error paths of the session module.

**G-8 — Step 7 has no security-category test at all.** Even a "library list does not display another user's projects when JWT changes mid-render" test would cover the cross-cutting case. Currently Step 7 trusts the server completely.

**G-9 — Step 6 has no test for "Send tapped twice in rapid succession" (Robert's edge-case table line 71).** AC says debounced; no T-ID asserts only one network call fires. Add it to Step 6.

**G-10 — Step 5 has no env/config test.** `EXPO_PUBLIC_API_URL` (or whatever the client uses) — unset, malformed, pointing at HTTP not HTTPS. Mobile happily ships with a misconfigured base URL.

---

## Independently Identified Missing Tests

| # | Step | Missing test |
|---|---|---|
| M-1 | 2 | JWT with valid signature but `sub` not a UUID → 401 (we use `sub` as FK, malformed FK breaks `/auth/sync`). |
| M-2 | 3 | `POST /auth/sync` rate-limit test — Cal documents 30 req/min/user but no test asserts it on `/auth/sync` specifically. AC-Q3 needs a test. |
| M-3 | 3 | `users.email` updates on subsequent `/auth/sync` if Supabase email changed. Or: assert it does NOT update (whichever is the intended behavior — currently undefined). |
| M-4 | 4 | `GET /projects/:id` audit/log output — does the request log emit `{userId, projectId, action: 'project.read'}` without leaking `specJson` or `email`? Per ADR §J Logger discipline. |
| M-5 | 4 | Title derivation when first-Heading text is whitespace-only — falls back to "Untitled" or fails noisily? Edge case Robert's spec doesn't pin down. |
| M-6 | 4 | `parentProjectId` field exists in schema but no test exercises it on create/list/get. Either test or remove from this ADR's scope. |
| M-7 | 5 | `signOut` while a request is in-flight — does the in-flight request still resolve? Does it still attach a now-revoked token? |
| M-8 | 6 | "Resend" cooldown — Cal predicted I'd flag this. He's right. Add the test: `useFakeTimers`, click Send, advance 29s, assert disabled, advance 1s, assert enabled. |
| M-9 | 7 | Skeleton card count: spec says "3 skeleton cards." Test asserts the count is exactly 3, not "at least one skeleton element." |
| M-10 | All | Cleanup/teardown: any test that opens a DB connection or starts a timer must `afterEach` close it. Not a test — a test-infra requirement that Cal hasn't called out. Otherwise a flaky CI awaits. |
| M-11 | Integration | The four claimed integration tests are referenced in the totals table (`Integration | 4 | 0 | 4`) but never enumerated. Where are T-IDs for the integration scenarios? This is a 4-test hole. |

---

## Retro-Lesson Defenses

| Lesson | Defended? | Evidence |
|---|---|---|
| `normalizeRow` sensitive-field leakage | ✅ Partial. T-0001-064 explicitly excludes `specJson` from list response. Data Sensitivity table tags methods `auth-only`. **Gap:** see G-6 — assertion needs to be shape-strict, not field-absence. |
| `userCount` response-shape discipline | ⚠️ Cal cites Robert's response shapes but the tests don't pin them with a JSON-schema or strict-equal assertion. T-0001-053, T-0001-054 say "with the expected shape" without naming the schema. Add explicit shape contracts. |
| CI/CD blast radius | ⚠️ Acknowledged ("no CI yet"). Acceptable for this ADR. But ADR-0002 and ADR-0003 must not inherit this free pass. Flag for Cal's next ADR. |
| Incomplete tests from ADR-only reading | ✅ Cal cross-references Sable's UX doc and Robert's edge-case table by name. The Step 6 / Step 7 acceptance criteria pull copy from Sable's deck explicitly. Good practice. |

---

## Roz's Assessment

The bones are good. The data-sensitivity table is the kind of artifact that prevents the next `passwordHash` incident, the 404-not-403 distinction is exactly right, and the cross-references back to Sable's copy deck mean the test suite will catch UI drift, not just logic drift. Cal did the homework.

Where it falls short is arithmetic and specificity. The failure-happy claim is wrong — not by one or two, by seven globally and across most steps. That's not a counting error; that's a scope-of-failure-coverage decision Cal needs to make consciously rather than by accident. Several test descriptions ("within 500ms," "clean error," "expected shape") describe an intention rather than a test, and the four integration tests in the totals table never appear with T-IDs. Step 5 has no env-config tests; Step 7 has no security tests; the `parentProjectId` schema column is dead weight in this ADR.

I am not blocking this for theatre. I am blocking because the spec needs five more failure tests, four of the vague descriptions tightened, the integration block enumerated, and the summary tables corrected. Half a day's work for Cal, and the ADR comes back genuinely review-ready. I'd rather spend that half-day now than re-open this conversation when Colby's PR is in flight.

Cal — fix the count, sharpen the descriptions, add the integration enumeration, and I'll re-review in one pass. The structural choices are sound. The execution gaps are mechanical, not architectural.

— Roz

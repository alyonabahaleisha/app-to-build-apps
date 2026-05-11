# Test-Spec Review — ADR-0008 (Universal Links)

_Reviewed by Roz — 2026-05-10_

## Verdict: REVISE WITH NOTES

**1 P0, 5 P1, 4 P2 findings.** Architecture is sound. Idempotency decision is correct. Data-sensitivity model is well-structured. The critical gap is an unspecified transaction boundary in `acceptCloneIntent` that, if not addressed, makes the entire idempotency story a lie under partial failure. Several per-step category-count drifts. Three steps fail the failure≥happy rule at step level. Missing tests in enough places that Colby would hit surprises.

---

## Category Coverage Table

| Step | Happy | Failure | Boundary | Error Handling | Security | Concurrency | Regression | Breaking | Config | Accessibility | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 — Schema | OK | OK | OK | ABSENT | N/A | OK | OK | OK | N/A | N/A | Error handling (DB errors, FK failures) covered as Failure. Acceptable. |
| 2 — AASA | OK | THIN | OK | N/A | OK | N/A | OK | N/A | OK (6 tests) | N/A | Failure=1 (GET-only). |
| 3 — Server endpoints | OK | OK | OK | **ABSENT** | OK | OK | OK | N/A | N/A | N/A | No test for DB error mid-`acceptCloneIntent`, partial-write rollback. |
| 4 — Linking | OK | OK | OK | N/A | N/A | N/A | OK | OK | OK | N/A | Background→foreground not explicitly labeled. |
| 5 — Pending intent | OK | OK | N/A | THIN | OK | OK | OK | N/A | N/A | N/A | Network failure handled (T-0008-129), but no pending-intent expiry test. |
| 6 — Share actions | OK | OK | N/A | **ABSENT** | OK | N/A | OK | OK | N/A | N/A | No test for `Clipboard.setStringAsync` failure. |
| 7 — Telemetry | OK | OK | N/A | N/A | N/A | N/A | OK | N/A | N/A | N/A | OK. |

**Accessibility N/A accepted.** ADR-0008 owns action handlers and data flow; screen-level UX (share affordance, celebration sheet, coachmark) is explicitly ADR-0011's surface.

---

## Failure:Happy Ratio

Aggregate: 41 failure-type vs 39 happy. Passes overall.

Per-step (rule: failure ≥ happy):

- **Step 2:** Failure=1, Happy=5. **FAILS** unless Config exhaustion (6) counts as failure-type. Either merge Config into Failure in the summary or add explicit failure tests.
- **Step 5:** Failure=5, Happy=7. **FAILS.** My recount finds 6 failure-labeled rows but summary says 5. Even with 6, 6<7. Needs one more failure path (e.g., `setPendingClone` when SecureStore unavailable).
- **Step 6:** Failure=3, Happy=4. **FAILS.** Clipboard failure path (P1-1 below) would fix this.

---

## P0 Finding

### P0-1: `acceptCloneIntent` transaction boundary unspecified and untested

ADR-0008 lines 599–616 describe a 5-step service operation: resolve share_link, idempotency check, INSERT mini_app, INSERT mini_app_version, INSERT share_link_clones. Steps 3, 4, and 5 are three separate DB writes. The ADR never wraps them in an explicit DB transaction.

If step 3 (INSERT mini_app) succeeds and step 5 (INSERT share_link_clones) fails:
- Orphan `mini_app` row exists.
- Unique constraint on `(share_link_id, cloner_user_id)` was never written.
- Next clone request for the same (share_id, user_id) attempts to INSERT again, creating a **second** `mini_app` row. Idempotency guarantee collapses silently.

T-0008-070 (race/concurrency) exercises the unique-constraint conflict path, not partial-write. T-0008-061 (idempotent re-clone) assumes the first clone completed cleanly.

**Required:** (a) ADR must declare steps 3–5 execute inside a DB transaction with rollback on any failure. (b) One test must inject a failure between steps 4 and 5 and assert the mini_app row rolls back; a subsequent call creates exactly one mini_app row.

Not theoretical: `expo-secure-store` async, network timeouts, DB deadlocks all happen in production.

---

## P1 Findings (Required)

### P1-1: `Clipboard.setStringAsync` failure path untested (Step 6)

`useCreateShareLinkMutation.onSuccess` calls `Clipboard.setStringAsync(universal_link)`. If it throws: does the success toast still fire? No test covers this. User sees a success toast for a copy that didn't happen.

**Required:** Add a test where `Clipboard.setStringAsync` rejects. Pin the behavior. Also fixes Step 6's failure:happy ratio.

### P1-2: Pending-intent expiry unspecified (Step 5)

ADR specifies `pendingClone.ts` with `setPendingClone` / `popPendingClone` / `clearPendingClone`. Never specifies what happens if user sets a pending clone and signs in 24h later.

**Required:** Cal must explicitly spec the expiry policy. Add one test pinning the decision. If never-expires, document explicitly.

### P1-3: T-0008-062 idempotency doesn't assert cover_art_seed stability (Step 3)

T-0008-061 (idempotent re-clone returns same `mini_app.id`) does NOT assert that the returned `cover_art_seed` is identical on both calls. The design intent is that idempotency returns the existing clone's data — but there's no concrete assertion.

**Required:** Amend T-0008-061 to assert `response.mini_app.cover_art_seed === first_response.mini_app.cover_art_seed`. One assertion. Directly validates idempotency returns the stored row, not a freshly-computed response.

### P1-4: AC-P2 vs T-0008-078 tension unresolved (Step 3)

AC-P2 (canvas-v0.md:374): title fallback is "first 40 chars of prompt." T-0008-078: clone fallback is literal `'Shared tool'` (NOT source prompt — AC-P8). The divergence is intentional but the ADR never documents the AC-P2 deviation.

**Required:** Add a sentence to Step 3's acceptance criteria: "For clones, the title fallback is `'Shared tool'` rather than `first 40 chars of prompt` (AC-P2 fallback policy does not apply to clones — the source prompt is source-owner data per AC-P8). This overrides AC-P2 for the clone creation path." Amend T-0008-078 to remove the misleading "per AC-P2" citation.

### P1-5: Client-side telemetry whitelist extension not tested (Step 7)

`services/api/src/llm/telemetry.ts` is the server-side whitelist. `apps/mobile/src/lib/telemetry.ts` (doesn't exist yet) is the client-side surface. T-0008-136 and T-0008-132 test events emit but neither verifies client-side whitelist enforcement.

**Required:** Add two tests in `apps/mobile/src/lib/telemetry.test.ts` (new): (a) `emit('share_link_copied', {validKeys})` succeeds; (b) `emit('share_link_copied', {invalidKey: 'x'})` throws. Step 7 must add this file to its test mapping.

---

## P2 Findings (Improve Before Ship)

### P2-1: Step 3 per-category summary drift

My recount of T-0008-038..087 vs the Step 3 summary:
| Category | Table says | My count |
|---|---|---|
| Happy | 12 | 11 |
| Failure | 10 | 11 |
| Security | 7 | 8 |
| Regression | 3 | 4 |
| Misc happy | 2 | 1 |

Total stays 50. Per-category breakdown wrong in 4 places. Grand totals (134/18/152) correct. Mechanical recount; fix before handoff.

### P2-2: Two-share-links / same-source-version scenario unspecified (Step 3)

T-0008-046 tests creator side (two share_ids). Cloner side not tested: if a friend is given both link A and link B (both → same source `mini_app_version`), the unique constraint is `(share_link_id, cloner_user_id)` — different share_link_ids, so two clones in the friend's Library.

**Required:** Add a sentence to §Alternatives Considered idempotency rationale: "Two distinct share_links pointing to the same source version create two independent clones in the friend's Library; this is by design (each share_link is its own social object)." Add one test pinning this behavior.

### P2-3: `aasa-smoke.yml` fixture spec insufficient for Eva

CI workflow asserts "body shape matches expected fixture." The expected fixture is not defined. APPLE_APP_ID_PREFIX value not in ADR. Eva can't author this.

**Required:** Add one sentence: "Smoke test reads `APPLE_APP_ID_PREFIX` from workflow environment (same secret as API deploy) and asserts response body's `applinks.details[0].appID` matches exactly." 20-word fix.

### P2-4: Step 5 summary table category drift

T-0008-115, 116, 117, 127, 128, 129 all labeled "Failure" in the table; summary says Failure=5, Misc=1. The Misc=1 appears to be T-0008-129 (network failure → generic toast). Network failure is a Failure test. Merge Misc into Failure (total=6); remove the Misc row. Still doesn't satisfy the ratio (6<7) — add one more failure test (P1-2's pending-intent expiry test could double up here).

---

## Missing Tests (Independent Identification)

1. `acceptCloneIntent` when DB is unavailable — 500 returned, `safeMessage` applied, no partial row left.
2. `createShareLink` when the source `mini_app_version` lookup fails (DB timeout) — 500 path untested.
3. `useUniversalLink` cold-start: `getInitialURL()` returns a non-canvas URL (M1 leftover `appcreator://auth?...`) — parser returns null, hook silently discards.
4. `popPendingClone` when SecureStore is unavailable (async read throws) — module has no try/catch.
5. T-0008-052 asserts `404 share_not_found` status, but no test pins the response body's `error: 'share_not_found'` exact string.
6. T-0008-147 (extra-key throws) covers `share_link.created`. Add parallel for `share_link.clone_accepted`.

---

## CI/CD Verification Required: Yes

`aasa-smoke.yml` is under-specified for Eva. P2-3 fixes it.

App Store Connect Associated Domains capability is correctly flagged as a prerequisite. Add explicit pre-Step-4 checklist entry for Eva.

## Documentation Update Required: Yes

AC-P2 (canvas-v0.md:374) is violated by clone title fallback as designed. ADR must note the deviation per P1-4.

---

## Roz's Assessment

Architecture is correct. Idempotency design is the right call. Data sensitivity model is coherent: `getShareLinkInternal` / `getShareLinkPublicView` / `acceptCloneIntent` distinction well-drawn, `PublicMiniApp` compile-time `Omit<>` guard is the right tool. 20 T-IDs I spot-checked are specific enough to write tests against without reading source.

The P0 is a real gap: ADR specifies idempotency guarantee but the three-insert operation isn't specified as transactional. Without a transaction boundary AND a partial-failure test, Colby writes three sequential inserts; the guarantee holds in happy-path tests but fails at 2am.

P1 findings are individually small but collectively meaningful: title fallback ambiguity will confuse Colby; pending-intent expiry is a product decision required before implementation; client-side whitelist tests required by AC-T1.

152 T-IDs is right-sized. Step 3 at 50 is appropriate for the security-critical path. Step 7 at 9 is defensible.

Cal addresses P0 + P1s + reconciles Step 3 and Step 5 summary tables → re-review. One round expected.

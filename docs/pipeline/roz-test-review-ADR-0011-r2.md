# Test-Spec Review R2 — ADR-0011 (V0 Mobile Shells + `mini_app` Schema Rename)

_Reviewed by Roz — 2026-05-10_

## Verdict: APPROVED WITH NOTES (contingent on one P1 fix)

All 6 P0 and 11 of 12 P1 findings substantively closed. One P1 partially closed (P1-5: category corrected but wrong landing). **One NEW P1 finding discovered (sync_mode sentinel contradiction in Step 1 SQL).** Calibration argument for rendering-scaffold steps accepted. Three P2 observations to fold in.

## R1 Finding Resolution

All 6 P0 + 12 P1 + non-blocking observations addressed per Cal's report. Notable closures:
- **P0-1** sentinel backfill: T-0011-015a (single row) + 015b (5 rows, per-row distinct UUID); SQL block + AC; **defect — see new P1 below**
- **P0-2** ShellLayout: T-0011-141a-d (4 concrete failure scenarios)
- **P0-3** E2E failure cases: T-0011-325 (out_of_scope), 326 (429 quota), 327 (session expiry mid-flow)
- **P0-4** screen-layer leakage: T-0011-170a (LibraryScreen specJson), 231b (OutOfScopeScreen Sentry+console spy)
- **P0-5** ADR-0010 grammar: top-of-file Cross-ADR callout + §Coordination authoritative declaration + T-0011-321a consistency check. Follow-up patch to ADR-0010 itself routed to orchestrator.
- **P0-6** dev-menu telemetry: T-0011-317a (writeEvent spy zero calls; explicit event list)
- **P1-1..P1-12:** All closed with specific T-IDs except P1-5 (category correction landed in wrong bucket — see P2-1)

## New P1 Finding

### sync_mode sentinel contradiction in Step 1 SQL

**Location:** Step 1 SQL block (lines 634-654) + AC line 709 + T-0011-015a.

Contradiction:
- SQL comment (line 637): `sync_mode := 'local'`
- ADD COLUMN (line 642): `ALTER TABLE mini_apps ADD COLUMN sync_mode text DEFAULT 'cloud-private'`
- UPDATE backfill (line 649): `sync_mode = COALESCE(sync_mode, 'local')`
- WHERE clause (lines 650-654): fires only when `sync_mode IS NULL`

**Bug:** Postgres fills all existing rows with `'cloud-private'` immediately upon `ADD COLUMN`. The subsequent `WHERE sync_mode IS NULL` never matches. Backfill to `'local'` never fires. All pre-existing rows receive `'cloud-private'`. AC (line 709) and T-0011-015a both assert `sync_mode = 'local'` — will FAIL.

**Three resolutions available:**
1. Remove `DEFAULT 'cloud-private'` from ADD COLUMN; rows get NULL; COALESCE sets `'local'`. Update T-0011-012.
2. Change COALESCE to `'cloud-private'` to match DEFAULT. Update comment, AC, T-0011-015a.
3. Drop DEFAULT, add separate `UPDATE ... SET sync_mode = 'local' WHERE sync_mode IS NULL`, then `SET NOT NULL`.

Cal must decide which value is semantically correct for rows pre-dating sync.

## P2 Observations (non-blocking)

### P2-1: T-0011-118 and T-0011-119 categorized as Happy

Core assertion is 61st PATCH/GET returning 429. These are Boundary/Negative, not Happy. Inflates Step 5 happy count by 2; understates ratio (reported 1.40; corrected would be 1.67). Directionally favorable but inaccurate. Recategorize as Boundary.

### P2-2: LinkingProvider surface overlap with ADR-0008

ADR-0011 Step 12 defines `LinkingProvider.tsx` with `LinkingHandlers.onCloneLinkOpen`/`onUnsupportedMode`. ADR-0008 Step 4 defines `apps/mobile/src/lib/universalLink.ts` with `useUniversalLink(onActiveLink, onReservedMode)` — parallel `Linking.addEventListener` consumer.

Both modules listen to the same URL space. ADR-0008 doesn't consume `LinkingHandlers` from ADR-0011. Two parallel `addEventListener` calls = double-invocation.

Recommend Cal add one line to §Coordination clarifying whether `LinkingProvider` is the single Linking entrypoint that ADR-0008 wires into, or whether ADR-0008 registers independently.

### P2-3: Notes for Colby item 2 sentinel values inconsistent with SQL

Item 2 says: "backfill with sentinel values `'productive'`, `'focus'`, `'unknown'`, `'list-crud'`." Actual sentinels: `'productive'`, `'neutral'`, `'unknown'`, `'unknown'`. `'focus'` and `'list-crud'` appear nowhere. Holdover from earlier draft. Minor but misleading.

## Decision Points

**1. Per-step ratio for rendering-scaffold steps (10-13): ACCEPTED.**
Cal's frame accurate and transparently reported. Steps 12/13 are stub surfaces (failure paths owned by ADR-0008/0010 consumers). Step 10 happy-heavy because each meatball action / coachmark dismissal is a separate observable. Step 11 at 0.88 within calibration range for deletion-primary step. Aggregate 1.24 holds. Precedent from ADR-0010 R2 Step 1 (0.24) supports this.

**2. All 6 P0 findings: verified closed.**

**3. All 12 P1 findings: 11 closed, 1 partially closed (P1-5 miscategorization → P2-1).** Coverage present; category wrong; not blocking.

**4. ADR-0010 grammar declaration: SUFFICIENT for this PR.** Follow-up patch routed to orchestrator.

**5. Step 1 sentinel backfill: COMPLETE but with sync_mode defect.** Escalated as new P1.

## Roz's Assessment

349 T-IDs. Cal turned REVISE into close-to-approvable in one round. P0s closed cleanly. ShellLayout failure tests concrete. E2E failure branches real. Cross-ADR grammar conflict properly documented.

The sync_mode contradiction is the only thing keeping this from clean APPROVED. Not subtle: comment + COALESCE say `'local'`, DEFAULT effective behavior produces `'cloud-private'`, backfill never runs. T-0011-015a fails at test time if Colby copies the spec. One-line fix — pick a value, make SQL+comment+AC+test consistent.

Rendering-scaffold calibration argument accepted. Cal transparency over manufactured ≥1.0 is correct. Aggregate 1.24 holds.

Deferred ADR-0010 grammar sync should be orchestrator-assigned promptly. T-0011-321a grep check catches code drift, but ADR-0010's own spec misleads whoever authors ADR-0010 PRs until sync lands.

**Fix sync_mode P1 → APPROVED. P2 observations are non-blocking but worth folding in same pass.**

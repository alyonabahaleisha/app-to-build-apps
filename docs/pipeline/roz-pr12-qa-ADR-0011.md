# QA Report — ADR-0011 Step 12 (LinkingProvider)

_Reviewed by Roz — 2026-05-12_

## Verdict: FAIL (F1 ADR criterion divergence + F4 untested regression path)

Wiring is clean: no navigation imperative from outside NavigationContainer, correct `{shareId}` wrapper on mutate, ref guard on replay, no client telemetry writes from provider itself. 16 tests pass.

| Check | Status |
|---|---|
| Type Check | PASS |
| Lint | PASS |
| Tests (LinkingProvider) | PASS — 16/16 |
| Tests (full mobile) | PASS — 542/542 |
| Coverage | WARN — 90.47% stmt / 86.66% branch; sign-out reset path L155 uncovered |
| Security | PASS |

## BLOCKING — F1: ADR acceptance criterion divergence

ADR-0011 line 1169-1171 says: "In this ADR's scope, the registered handlers fire telemetry only (`share_link_handled` with `{mode, shareId_hash}`) and show a 'Coming soon' toast — full handler is ADR-0008."

Implementation does the opposite: authed users → `cloneMutation.mutate({shareId})` immediately (ADR-0008 behavior); unauthed → `setPendingClone`. NO `share_link_handled` telemetry. NO "Coming soon" toast for clone mode (only for reserved modes).

**This is architecturally correct** — ADR-0008 Steps 5+6 shipped the clone flow; stub era is over. But the ADR criterion is stale and needs reconciliation. Either:
- Update ADR-0011 Step 12 criterion to describe what actually shipped (recommended; backlog-clean)
- Add stub fallback when ADR-0008 hooks aren't available (regressive)

Recommend the first. The criterion at L1169-1171 should now read approximately:
> "Registered handlers wire to ADR-0008's clone flow: clone mode → `cloneMutation` (authed) or `setPendingClone` (unauthed); reserved modes → 'Coming soon' toast + no telemetry write at this layer."

## BLOCKING — F4: Sign-out replay reset path uncovered

`LinkingProvider.tsx:154-156`. The `replayFiredRef.current = false` branch (session leaves `authenticated`) has NO test.

Consequence: sign-in (mutation fires) → sign-out → sign-in with NEW pending clone — replay must fire again. Without the test, a regression that drops the reset would silently break multi-session flows. The 3 existing post-SIWA tests only cover single-transition.

**Fix:** Add a test simulating sign-in→sign-out→sign-in→new pending clone. Assert mutation fires both times.

## NOTABLE — F2: `LinkingProvider.handle()` static API missing

ADR L1165: "calling `LinkingProvider.handle('/m/abc/clone')` invokes the registered `onCloneLinkOpen` with `('abc', 'warm')`." Method doesn't exist. Tests work around via mock-capture (valid). ADR criterion update needed alongside F1.

## NOTABLE — F3: T-0011-304 overclaims "logs warning"

`LinkingProvider.test.tsx:252`. Test name claims "malformed URL → does not invoke any handler; logs warning." Body asserts no side effects but never injects a malformed payload. `mockLoggerWarn` never asserted. Test proves only "provider mounts without crashing" (already covered by T-0011-300).

## NOTABLE — F5: `loading → authenticated` cold-start fires `popPendingClone`

`LinkingProvider.tsx:133`. `wasUnauthed` checks `prevStatusRef.current !== 'authenticated'`. On cold-start with a returning signed-in user, status goes `loading → authenticated`; `wasUnauthed = true`, `popPendingClone()` fires every launch. Safe (returns null when empty) but unintended. Either guard with `prevStatusRef.current === 'unauthenticated'` specifically OR document as intentional. No test for `loading → authenticated` path.

## All other scrutiny — PASS

- Auth-gated flows tested: authed → mutate w/ `{shareId}`; unauthed → setPendingClone
- Post-SIWA replay fires once (single-transition path)
- Reserved mode: toast + NO mutation + NO telemetry
- Unmount: no crash
- Test mocks `useUniversalLink` programmatically with real `ParsedUniversalLink` shape
- No client telemetry leak from LinkingProvider

## Scope creep — CLEAN

Only `lib/linking/LinkingProvider.{tsx,test.tsx}` + `App.tsx`. Concurrent DevMenu in `screens/Run/devMenu/` separate.

## Roz's Assessment

Code is correct. ADR criterion is stale. F1 + F4 together justify FAIL — F1 is a doc reconciliation; F4 is a real regression risk for multi-session flows.

**REVISE.** Surgical: update ADR-0011 Step 12 criterion text + add sign-out→sign-in replay test. F3/F5 backlog.

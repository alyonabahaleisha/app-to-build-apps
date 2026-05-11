# QA Report — ADR-0011 Phase 2 PR 1 (SignInScreen, Step 7)

_Reviewed by Roz — 2026-05-10_

## Verdict: REVISE (2 BLOCKING + 5 non-blocking)

Most of the work is solid. AuthProvider interface matches ADR-0013 contract precisely. T-0011-158 logger payload pinned. SIWA stub error code correct + greppable. M1 deletion clean. 222/222 tests pass.

Two blockers: a production auth-swap vector and a Sable accessibility-spec violation. Both surgical.

## BLOCKING — F1: `__setEnvOverrideForTests` ships unguarded to production

`apps/mobile/src/lib/auth/getAuthProvider.ts:72-75` + `index.ts:8`

The function mutates `_testEnvOverride` (module-level state) and force-resets the provider cache. Exported from `index.ts` into the production bundle with zero guard. Any code path or runtime-injected third-party SDK that calls it can silently swap the live auth provider mid-session.

Naming convention (`__` prefix + `ForTests` suffix) is NOT a runtime guard.

**Fix:** Wrap body in `if (process.env.NODE_ENV !== 'production')` OR strip via dead-code elimination plugin OR move to test-only helper module never imported by production code.

`__resetAuthProviderCacheForTests` has the same shape but was ADR-0013 §Decision 6-accepted as the test seam — that precedent stays. `__setEnvOverrideForTests` is new and the more dangerous of the two (mutates provider SELECTION, not just cache).

## BLOCKING — F2: Footer link touch targets 22pt vs ≥44pt Sable spec

`apps/mobile/src/screens/SignIn/SignInScreen.tsx:227, :247`

Terms + Privacy `Pressable` use `hitSlop={4}`. `type-micro` font: 11pt size, 14pt line height. Effective vertical hit target: 14 + 4 + 4 = **22pt**. Sable §Screen 1 Accessibility requires ≥44pt. ARCHITECTURE.md §12 + CLAUDE.md §1 confirm.

T-0011-150 asserts `accessibilityRole="link"` but NOT hit-target geometry. Test gap noted but not blocking for this PR's test file.

**Fix:** `hitSlop={{top: 15, bottom: 15, left: 8, right: 8}}` OR wrap in `minHeight: 44` container.

## Non-blocking findings

### F3: `useMemo` used as side-effect vehicle

`SignInScreen.tsx:80-87` — `useMemo` callback fires `magicLinkProvider.setOnSignInRequested(...)`. React docs warn against this; React 18 Strict Mode may re-run silently; Concurrent Mode scheduler may discard memoized values; React Compiler may optimize across boundary.

**Fix:** Replace with `useEffect(() => { if (isMagicLink) { magicLinkProvider.setOnSignInRequested(...) } }, [isMagicLink])`.

### F4: magicLinkProvider race on concurrent signIn (mitigated by UI)

`magicLinkProvider.ts:50-61` — second `signIn()` call while first pending overwrites `_resolve`/`_reject`. First promise abandoned in perpetual-pending. UI mitigates via `disabled={signingIn}` on Pressable (more reliable than `signingIn` state guard in line 90).

No test covers concurrent `signIn()`. Provider has no internal guard. Not blocking because UI prop is the practical guard.

### F5: logger.warn unconditional console.warn (pre-existing)

`logger.ts:43-46` — `logger.info` gated behind `__DEV__`; `warn` + `error` are NOT. T-0011-158's `auth_provider_invalid` warning fires in production builds via `console.warn` → Sentry breadcrumb. Pre-existing logger behavior (not introduced by this PR), but PR extends signatures + adds production call sites. Backlog.

### F6: T-0011-155 and T-0011-156 are identical

`SignInScreen.test.tsx:330-341` — Both use `renderScreen({env: ''})`. T-0011-155's description says "unset" but tests the empty-string path. True "unset" requires `renderScreen()` with no `env` key (override not set; `process.env.EXPO_PUBLIC_AUTH_PROVIDER` read directly).

One of the two unique cases Cal intended is unexercised. **Fix:** Differentiate the two tests.

### F7: `_onResolved` prop unused (observation)

`EmailEntrySheet.tsx:57-58` — destructured as `_onResolved` with comment that ADR-0013 will wire deep-link token-exchange. Dead surface area; ADR-0013 PR 2 must wire correctly. Not a defect.

## Scrutiny area verdicts (8 areas)

1. **magicLinkProvider deferred-promise** — Mostly sound; race condition F4 mitigated by UI
2. **`__setEnvOverrideForTests` seam** — FAIL (F1)
3. **logger signature extension** — Backward compat verified; F5 production behavior pre-existing
4. **T-0011-158 exact payload** — PASS (`expect.objectContaining` matches Cal R3 prescription)
5. **SIWA stub error code** — PASS (`'siwa_not_yet_implemented'` exact + cause message present)
6. **AuthProvider contract vs ADR-0013** — PASS (exact match on Decision 6 interface)
7. **EmailEntrySheet Gorhom integration** — PASS (panDown, dismissOnClose, hardware back, cooldown, validation, error states all present)
8. **M1 deletion completeness** — PASS

## End-to-end flow verification

Default magic-link flow: wordmark + tagline + "Sign in with email" → tap → EmailEntrySheet → email entry → "Send magic link" → API call → "Check your inbox" + Resend with 30s cooldown. Matches Sable's UX for the email variant.

Expired banner (T-0011-161): `showExpiredBanner` plumbs through correctly.

Footer copy reconstruction across 5 Text nodes matches Sable's spec line 1726 when concatenated.

## Roz's Assessment

Two blockers. F1 is a security concern (production auth-swap vector). F2 is an accessibility regression (22pt vs 44pt). Both surgical.

Rest of the work is solid. AuthProvider interface matches ADR-0013 precisely. T-0011-158 payload assertion pinned. SIWA stub greppable. Magic-link Gorhom integration complete. 222/222 tests pass.

**Fix F1 + F2; recommended fold F3 + F6 same pass; F4 + F5 + F7 are backlog/observations.**

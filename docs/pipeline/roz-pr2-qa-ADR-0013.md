# QA Report — ADR-0013 PR 2 (Step 2 — Mobile siwaProvider fill-in)

_Reviewed by Roz — 2026-05-10_

## Verdict: PASS WITH NOTES

All 10 scrutiny areas PASS. Implementation clean end-to-end. Two minor notes (one coverage gap on a single line, one duplicate test). Ellis can commit.

| Check | Status |
|---|---|
| Type Check | NOTE — 3 errors all in concurrent Library scope (not this PR) |
| Lint | NOTE — 4 errors all in concurrent Library scope (not this PR) |
| Tests | PASS — 32/32 (10 getAuthProvider + 22 siwaProvider) |
| Coverage siwaProvider.ts | PASS — 96.15% stmts / 94.44% branches (above ≥95% ADR gate) |
| Coverage getAuthProvider.ts | PASS — 100% stmts / 81.25% branches |
| Complexity | PASS — no function >CCN 10 |
| Security | PASS |
| Dependencies | PASS — `expo-apple-authentication ~6.4.2` in dependencies (correct location) |

## Scrutiny Areas — All PASS

1. **Email exclusion** — interface, mapping, runtime + compile-time assertion all enforce
2. **R4 compile-time pattern** — single-key inverse-extends; no R3 union-non-distributive issue
3. **Apple SDK error mapping** — `ERR_REQUEST_CANCELED` → AuthCanceledError; everything else → AuthFailedError('siwa_native_failed')
4. **ERR_REQUEST_CANCELED vs background** — comment documents intentional collapsed mapping; T-0013-136 echoes
5. **Dependency** — `expo-apple-authentication ~6.4.2` in dependencies block
6. **Backgrounded fixture comment** — present in 3 locations (provider + mock + test)
7. **moduleNameMapper** — jest.config.js:40 maps to mockExpoAppleAuthentication; 32 tests confirm working
8. **PUBLIC_PATH_PREFIXES** — `/auth/apple` added; `isPublicPath` uses exact-match-or-with-query (no bypass)
9. **Test density spot-check** — 5 random T-IDs verified specific (URL+headers+body separately, instance+code+cause checks, structural log-leak assertion)
10. **T-0013-134/135/136 R2 closures** — all present and concrete

## Security Review

- **identityToken** never logged (T-0013-106 confirms); only in POST body (T-0013-107 path+headers+body separately)
- **Response mapping** explicit field-by-field (no spread) — prevents future field-leakage
- **Public path gating** correct ordering — apiFetch doesn't attempt auth header on sign-in call

Four independent barriers enforce email exclusion (type, interface, mapping, test). Appropriate for privacy-critical field.

## Notes (non-blocking)

### NF-1: siwaProvider.ts:54 `!fullName` branch uncovered

`if (!fullName) return undefined` guard in `buildDisplayName` never exercised. Test cases pass non-null `fullName` objects (T-0013-097 passes `{givenName: null, familyName: null}` — non-null object with null fields). The truly-null-object case comes from Apple on subsequent sign-ins. One-line fix: amend T-0013-097 to include `makeCredential({fullName: null})`.

96.15% statements still exceeds ≥95% ADR gate — non-blocking.

### NF-2: T-0013-089 and T-0013-090 functionally identical

`getAuthProvider.test.ts:66-78` — both pass `''` to `__setEnvOverrideForTests`. Descriptions differ ("unset (undefined)" vs "='') but the test seam can't represent "truly unset" — same code path. Non-blocking, but T-0013-089 tests an unverifiable premise. Same pattern as PR 1 F6 (T-0011-155/156). Backlog.

## Pre-existing Failures (NOT this PR)

`apps/mobile/src/screens/Library/` — 3 typecheck errors + 4 lint errors. Concurrent ADR-0011 Phase 2 PR 2 scope. Zero hits in this PR's auth surface. Attributable to that PR's QA.

## Roz's Assessment

Implementation is clean. Flow correct end-to-end: Apple credential → error classification → POST body (explicit, no spreading) → snake-to-camel mapping (explicit, no spreading) → AuthSignInResult shape with exactly `{accessToken, refreshToken, expiresIn, user: {id, displayName?}}`. Email exclusion enforced at type, interface, mapping, AND test levels — four independent barriers.

The R4 compile-time assertion pattern applies correctly. Single-key inverse-extends form valid for a single field; no carry-over of R3 union bug.

`moduleNameMapper` wiring present and demonstrated working — 32 tests pass without loading native module.

Two notes minor. NF-1 is a single-line test gap on a guard. NF-2 is semantic imprecision in test description.

**Ellis can commit.**

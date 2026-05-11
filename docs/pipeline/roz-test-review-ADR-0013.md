# Test-Spec Review — ADR-0013 (Sign in with Apple)

_Reviewed by Roz — 2026-05-10_

## Verdict: REVISE WITH NOTES

3 P0 + 7 P1 + 5 P2 findings. The spec is revise-able, not a rebuild. Token-validation matrix is Cal's strongest section.

## P0 — Blocks approval

### P0-1: `POST /auth/apple` response shape conflicts with canvas-v0.md

`canvas-v0.md` §API Contracts line 521 specifies: `{access_token, refresh_token, user: {id, display_name}}` with `Excludes: raw email`.

ADR-0013 specifies: `{access_token, refresh_token, expires_in, user: {id, email, display_name}}`.

T-0013-044..046 assert on the ADR shape — will pass on an implementation that leaks `email`. Privacy regression. `canvas-v0.md` is the binding contract.

**Resolution:** Either drop `email` from `user` in the response (update T-0013-044..046), OR escalate to Robert/Alyona to override the product spec with explicit reconciliation in the ADR.

### P0-2: Schema type-export assertion missing

T-0013-079..085 test that the migration SQL applies. None assert that the Drizzle `users.$inferSelect` type includes `appleUserId: string | null`. A migration that adds the column but whose Drizzle schema definition is missing would pass T-0013-079..085 while failing typecheck.

**Resolution:** Add compile-time assertion via `satisfies` or typed assignment.

### P0-3: AC says "seven AppleIdentityErrorCode values" but there are eight

`AppleIdentityErrorCode` union has 8: `malformed`, `signature_invalid`, `kid_unknown`, `expired`, `issuer_mismatch`, `audience_mismatch`, `jwks_unreachable`, `missing_claim`. Test matrix T-0013-004..024 covers all 8. AC text says 7.

**Resolution:** Correct AC to "eight" and enumerate all 8 codes by name.

## P1 — Should fix before PR

- **P1-1:** No `Exclude<>` compile-time assertion that `apple_user_id` never appears in public response shapes.
- **P1-2:** Refresh token sha256 hash algo not justified in §Decision. Token has ~256 bits random entropy; sha256 is fine — but rationale must be in ADR so Colby doesn't "upgrade" to bcrypt and break hash comparison.
- **P1-3:** JWKS concurrent-kid-fetch race not addressed. Trust library OR test debounce explicitly.
- **P1-4:** Step 2 zero Boundary tests. Add at minimum 2 (whitespace-only `displayName`, empty-string `authorizationCode`).
- **P1-5:** Step 4 missing failure test — deprecated route with invalid body, deprecation warn fires before/after Zod rejection.
- **P1-6:** T-0013-073 misidentified in §Data Sensitivity. Cross-reference says T-0013-073 covers Apple Relay non-logging; actually covers `APPLE_SIWA_CLIENT_ID` whitespace rejection. Correct the §Data Sensitivity reference (T-0013-033, T-0013-063 are sufficient).
- **P1-7:** Step 5 ratio 0.75:1 fails hard rule. Add: route-layer telemetry call under EVAL_MODE; missing `failure_code` field whitelist behavior.

## P2 — Recommend before launch

- **P2-1:** App backgrounded mid-SIWA flow → no orphan state. T-0013-110 covers cancellation only.
- **P2-2:** No `AuthProvider.name` property test (used by Settings sheet for provider-appropriate display).
- **P2-3:** T-0011-155..159 vs T-0013-089..094 behavioral overlap. Add cross-reference comment.
- **P2-4:** Coverage gate `appleIdentity.ts` at ≥90% — brief required ≥95% for security boundary. Raise.
- **P2-5:** Route-layer assertion on second-sign-in `user.display_name` preserving captured value. Tighten T-0013-045 description.

## Per-Step Ratios

| Step | Happy | Failure | Ratio | Passes? |
|---|---|---|---|---|
| 1 | 20 | 32 | 1.6:1 | Yes |
| 2 | 7 | 11 | 1.57:1 | Yes (Boundary=0 — P1-4) |
| 3 | 3 | 1 | 0.33:1 | **No** |
| 4 | 1 | 1 | 1.0:1 | Borderline |
| 5 | 4 | 3 | 0.75:1 | **No** (P1-7) |

Step 3 (env-flag config exhaustion) is structurally thin by design but no N/A justification documented.

## Cross-ADR Consistency

- ADR-0011 T-0011-148 contract matches ADR-0013 `siwaProvider` exactly
- ADR-0011 T-0011-155..159 vs T-0013-089..094 — both necessary at respective layers (integration vs unit); add cross-reference comment per P2-3
- ADR-0011 Decision 9 vs ADR-0013 §Decision 6: ADR-0013's parse-once-at-module-load is strictly better than ADR-0011's parse-on-onPress description. No conflict; ADR-0013 is authoritative.
- canvas-v0.md AC-A1/A2/A3 covered (A2 correctly delegated to ADR-0011 Step 6).

## CI/CD Verification Required: Yes

Step 2 acceptance criterion should explicitly include `jest.config.js moduleNameMapper` for `expo-apple-authentication`. Currently buried in CI Impact table — wrong place to catch a missing setup step.

## Documentation Update Required: Yes

- `canvas-v0.md` §API Contracts: resolve P0-1
- `ARCHITECTURE.md` §5 (Ellis, post-landing)
- `docs/product/canvas-v0-reviewer-notes.md`: Step 5 AC4
- ADR-0001 frontmatter deprecation note (Ellis, post-landing)

## Roz's Assessment

118 new + 11 regression tests for an auth-provider swap is appropriate coverage density. Token-validation matrix T-0013-001..024 is the best part — Cal enumerated every Apple-documented failure mode and added two security cases (`alg: 'none'` bypass + symmetric-alg substitution attack). Those tests would catch real CVEs in similar implementations. Concurrency tests T-0013-029..030 for `findOrCreateByAppleSub` are correct and specific.

Three problems:
1. **Response shape conflict with canvas-v0.md** — blocking; needs decision not code fix
2. **"Seven error codes" in AC counting eight in the union** — leads to one code under-tested at the auth boundary
3. **Steps 3 and 5 ratio violations** — Step 5 specifically has two missing negative tests that follow directly from ADR-0007 telemetry architecture; Cal should have caught them

Everything else is P1/P2. Spec is revise-able.

**REVISE WITH NOTES.**

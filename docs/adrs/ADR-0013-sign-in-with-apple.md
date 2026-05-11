# ADR-0013: Sign in with Apple — magic-link → SIWA cutover

_Authored by Cal — 2026-05-10_

## Status

Proposed

## Context

The V0 spec (`docs/product/canvas-v0.md` §AC-A) requires **Sign in with
Apple** as the authentication source on the App Store launch build.
The M1 path (magic-link via Supabase `auth.admin.generateLink`) shipped
in ADR-0001 and remains the only working auth source as of branch
`agent/M2-VS-01`. ADR-0011 (Mobile V0 Shells) **explicitly deferred
SIWA to this ADR** (ADR-0011 §Decision 9): the shell ships against
`EXPO_PUBLIC_AUTH_PROVIDER=magic-link` (default), with a
provider-agnostic `Sign in` button whose `onPress` reads the env flag
and dispatches to either the existing `EmailEntrySheet` or — when the
flag is `apple` — a stubbed `signInWithApple()` placeholder that
ADR-0013 fills in.

> Companion to ADR-0011. ADR-0011 owns the **shell surface**; this
> ADR owns the **provider implementation, server-side identity-token
> validation, and the env-flag flip**. No mobile screen file changes
> between the two ADRs except `signInWithApple()` becoming real and
> the env-flag default flipping from `magic-link` to `apple`.

V0 has **zero production users** (M1 was alpha-only, M2 superseded
before public release per `canvas-v0.md` §0). Magic-link disappears
post-flip; there is no data migration. The user table's `email`
column persists, but for SIWA-issued sessions it stores either a real
email (if the user grants the `email` scope) or Apple's masked relay
address (`<opaque>@privaterelay.appleid.com`).

**Forces.**

- App Store policy 4.8: any third-party social login on iOS requires
  Sign in with Apple alongside. Even if we later add Google/GitHub
  (V0.5+), SIWA must be the V0 default.
- App Store policy 5.1.1(v): an account-creation app must offer
  account deletion. Our existing `DELETE /me` path (V0.5 self-serve)
  is auth-provider agnostic; SIWA does not change that contract.
- Apple identity-token JWTs are signed with rotating RS256 keys
  published at `https://appleid.apple.com/auth/keys`. Validation is
  picky — every reject reason in this ADR's test matrix is a real
  Apple-documented failure mode.
- Risk separation. SIWA carries three orthogonal infra surfaces
  (Apple Developer console, iOS dev-client native module, server-side
  JWKS validation) that all have to be right *before* the flag flips.
  Folding the cutover into ADR-0011 would have made step ordering
  brittle. Isolating it here lets ADR-0011 ship the shell
  independently and lets this ADR ship as a contained
  auth-provider swap.

**What if we do nothing.** ADR-0011 ships with magic-link as the V0
launch auth source. Apple rejects the App Store submission under
4.8/5.1 because the app accepts email-based sign-in without a SIWA
option. V0 launch slips by 1–2 weeks while we retrofit. Hence: ship
SIWA *before* the App Store submission packet is assembled (canvas-v0
week 4–5).

## Decision

Replace the magic-link auth source with **Sign in with Apple**, gated
on the existing `EXPO_PUBLIC_AUTH_PROVIDER` env flag (defaulting to
`magic-link` until this ADR's PRs land; flipping to `apple` on the
final PR). The cutover is the smallest possible blast radius:

1. **iOS package:** `expo-apple-authentication` (Expo-official,
   ships with the dev-client, no extra Pod/native config beyond
   `app.config.ts` plugin entry).
2. **Identity model:** **Apple `sub` is the primary identifier.**
   Add `apple_user_id` (text, unique, nullable) to `users`. Find-or-
   create is keyed on `apple_user_id`, not email. Email is stored
   verbatim from Apple (real or `*@privaterelay.appleid.com`),
   treated as opaque metadata, never logged at INFO, never used as a
   join key. V0 has no production users — no migration script.
3. **Token validation:** Library-driven. Use
   [`apple-signin-auth`](https://www.npmjs.com/package/apple-signin-auth)
   (or equivalent: `verify-apple-id-token`). Hand-rolled JWT validation
   against Apple's JWKS is a footgun (key rotation, kid lookup,
   ES256/RS256 fallback, audience-array vs audience-string). The library
   handles all eight reject reasons in the test matrix.
   **JWKS rotation race handling is the library's responsibility.**
   Apple rotates JWKS keys; when a new `kid` arrives, multiple
   concurrent requests may all miss the cache and race to fetch the
   JWKS endpoint. The chosen library MUST debounce concurrent fetches
   for the same unseen `kid`. **Library selection criterion (Colby
   picks at PR 1):** the candidate library either has explicit tests
   for race-free JWKS fetch behavior in its upstream test suite, OR
   documents debounce semantics in its README. If neither candidate
   qualifies, escalate to Cal before pinning.
4. **Session model unchanged.** SIWA `verifyIdToken` → find-or-create
   user → **issue our own JWT** (HS256 via `SUPABASE_JWT_SECRET`
   reuse, signing on Supabase's behalf via the admin client). Mobile
   stores it in `expo-secure-store` exactly like the magic-link token
   today; downstream `requireAuth` middleware is untouched.
5. **Server route surface:** **New parallel route** `POST /auth/apple`
   alongside the existing `POST /auth/magic-link`. **Server picks
   the handler by URL, not by header.** Client picks the URL by
   reading its env flag. After the flag flip, magic-link route stays
   in the codebase for one release as a safety net; ADR-0013 PR 5
   marks it `@deprecated` and ADR-0013.1 (or a V0.5 cleanup) removes
   it.
6. **Mobile dispatcher contract:** A new `apps/mobile/src/lib/auth/`
   module exposes `getAuthProvider(): AuthProvider` returning one of
   two implementations (`magicLinkProvider` | `siwaProvider`), both
   conforming to the same `AuthProvider` interface. The `SignInScreen`
   button's `onPress` calls `getAuthProvider().signIn()` — no
   `if/else` in the screen. The env flag is parsed once at module
   load.
7. **No magic-link migration.** Zero production users; hard reset is
   acceptable. Documented in §Consequences.

### Why these calls

- **`expo-apple-authentication` over `@invertase/react-native-apple-authentication`:**
  the Expo package is the prebuilt-supported path. Our dev-client
  already includes its native module (Expo SDK 50+). The Invertase
  package would force a Podfile edit and an EAS Build profile change
  per platform; pure cost, no benefit at V0 scope.
- **Apple `sub` over email as primary key:** email collisions across
  Apple Relay regenerations are real (a user can revoke + re-add
  Canvas in Settings, getting a new relay alias but the same `sub`).
  Keying on `sub` makes that round-trip transparent. Email-as-primary
  forces an "is this the same user?" decision the schema can't make
  cleanly.
- **Library token validation:** Apple rotates JWKS keys ~quarterly.
  The library caches keys, handles `kid` lookup, and validates
  `iss`/`aud`/`exp` in one call. Hand-rolling is two days of work for
  a feature that ships once. Cost of a maintained library: ~50 KB of
  bundle on the server side, irrelevant.
- **Two routes (`/auth/magic-link`, `/auth/apple`) over one with a
  `provider` header field:** routing-by-URL gives us cleaner per-route
  rate limits, cleaner Fastify route schemas, and a cleaner
  deprecation path (mark the file `@deprecated`, delete in a follow-
  up). Header-based dispatch concentrates two validation surfaces in
  one handler.
- **Reuse `SUPABASE_JWT_SECRET` for issuing our own JWT to the
  mobile client:** the existing `requireAuth` middleware already
  verifies HS256 tokens against this secret. Issuing the SIWA-flow
  session JWT the same way means **zero changes to `lib/auth.ts`**
  for the SIWA path — the middleware can't tell whether the JWT
  was minted via magic-link redeem or SIWA redeem. The `sub` claim
  must still be our local `users.id` UUID (not Apple's `sub`); SIWA
  flow does the find-or-create *before* issuing the JWT, so the JWT
  payload looks identical to today's.

## Alternatives Considered

### Use `@invertase/react-native-apple-authentication`

- **Upside.** More configurable; can request additional Apple scopes
  not exposed by `expo-apple-authentication`.
- **Downside.** Native module not in the Expo dev-client by default —
  requires `expo-modules-autolinking` plugin gymnastics and EAS Build
  profile edits. At V0 we use only `name` + `email` scopes; we don't
  need the extra surface.
- **Why not.** Pure cost. No benefit at V0.

### Email-as-primary-key, treat Apple Relay as opaque

- **Upside.** Single identity column; legacy code that joins on
  `users.email` keeps working.
- **Downside.** A user revoking + re-granting SIWA may get a different
  Apple Relay alias (`abc@privaterelay.appleid.com` →
  `xyz@privaterelay.appleid.com`) for the same `sub`. We'd silently
  create a duplicate user row, the user's mini-apps disappear, support
  ticket follows.
- **Why not.** Sub is stable per-app-per-user; email is not. Identity
  must key on the stable thing.

### Hybrid: `sub` is unique key, email is upsert key for cross-provider migration

- **Upside.** Lets a future magic-link user "upgrade" to SIWA without
  losing data (matched on email).
- **Downside.** Two upsert keys is a complexity tax for a population
  of zero. We could add it later when (and only if) we restore
  magic-link as a V0.5 alternative provider.
- **Why not.** YAGNI. V0 has no production users; this is hypothetical
  forward-compat for V0.5+.

### Hand-roll Apple identity-token validation

- **Upside.** No third-party library dep on the server.
- **Downside.** Apple's JWKS rotation, `kid` lookup, audience-array
  semantics, and `nonce` field handling are easy to get wrong. Every
  bug here is a latent auth bypass.
- **Why not.** Use a maintained library. The auth boundary is the
  worst place to be clever.

### Server-side dispatch by header (`X-Auth-Provider`) over two routes

- **Upside.** Single handler; route table stays trim.
- **Downside.** Per-route rate-limiting (different budgets for
  /magic-link vs /apple) requires header parsing in the rate limiter.
  Deprecation gets gnarly — you can't 410-Gone the magic-link path
  without disambiguating from the SIWA path on the same URL.
- **Why not.** Two routes is the cleaner cut.

### Bundle the env-flag flip into ADR-0011

- **Upside.** One less ADR.
- **Downside.** ADR-0011 is already 14 steps / 349 T-IDs. Folding
  SIWA in concentrates Apple Developer console infra + JWKS validation
  + new native module + new env var in the largest refactor of the V0
  build. Per ADR-0011 §Decision 9: risk separation is the call.
- **Why not.** Decision already made (ADR-0011 Decision 9). This ADR
  honors that boundary.

## Consequences

### Positive

- **App Store compliance.** Policy 4.8 is satisfied on V0 launch.
- **User identity is stable.** Apple `sub` keys the join; Apple Relay
  email changes don't fragment user accounts.
- **Auth middleware unchanged.** `services/api/src/lib/auth.ts` and
  `requireAuth` continue to verify HS256 JWTs from the
  `SUPABASE_JWT_SECRET` regardless of how the JWT was minted. SIWA
  bug surface is bounded to one new route + one new util.
- **Env-flag gating.** The cutover is reversible — flip
  `EXPO_PUBLIC_AUTH_PROVIDER=magic-link` and the magic-link path
  works again until we delete it. Safety net for the App Store
  submission week.
- **Provider dispatcher contract is real.** Adds a generic
  `AuthProvider` interface that future providers (Google in V0.5+)
  can implement without rewriting `SignInScreen`.

### Negative

- **Apple Developer Portal coordination cost.** Service ID, key
  generation, App ID capability all happen out-of-band by DevOps.
  Spec'd in §Prerequisites.
- **New runtime dep (`apple-signin-auth` or equivalent).** Vetted
  package, small surface, maintained.
- **New env vars** (`APPLE_SIWA_CLIENT_ID`, `APPLE_SIWA_TEAM_ID`,
  `APPLE_SIWA_KEY_ID`, `APPLE_SIWA_PRIVATE_KEY`,
  `EXPO_PUBLIC_AUTH_PROVIDER` — flipped to `apple` post-PR-4).
  All five are added to `services/api/src/lib/env.ts` and to
  `eas.json` build profiles. Config exhaustion tests guard the
  parsing.
- **Hard reset for any non-production user data.** Pre-V0 dev /
  staging users on magic-link must re-sign-in with SIWA; their
  existing `users` row is unreachable (no `apple_user_id`).
  Acceptable per the zero-production-users premise; documented in
  §Risks.
- **Sign-in cancellation UX.** Apple's modal allows the user to cancel
  partway through the consent sheet; mobile must handle the
  `ERR_REQUEST_CANCELED` and `ERR_REQUEST_FAILED` error codes without
  toasting the user as if they failed.

### Risks

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| Apple Developer Service ID misconfigured (audience mismatch) → all sign-ins fail in production | Medium | §Prerequisites covers Service ID + capability + key generation; week-5 staging dry run before App Store submission validates the full round-trip. Token-validation library surfaces `aud_mismatch` cleanly; T-0013-035 covers. |
| Apple revokes Sign-In capability (post-launch) | Very Low | App Store apps with auth-via-Apple don't have their SIWA disabled silently. Apple notifies in advance. Out of scope for V0. |
| User denies the `email` scope; we store the Apple Relay alias as the only contact | High (designed for) | §Identity model — email is metadata, not a join key. Apple Relay alias stored verbatim. Settings sheet (ADR-0011) shows the masked form. No logic depends on a real email. |
| `EXPO_PUBLIC_AUTH_PROVIDER` cache-stale on a TestFlight build that shipped before the env-flag flipped | Low | Env flag is a build-time const in Expo. The flip happens via an EAS profile change + a new TestFlight build. There's no over-the-air mismatch path; T-0013-001..006 (config exhaustion) cover wrong/missing/uppercase values. |
| Pre-existing magic-link sessions in dev/staging stay valid post-flip because their JWTs haven't expired | Medium | Magic-link JWTs are HS256-signed by the same secret; `requireAuth` accepts them. This is *fine* — the dev session is preserved. Only new sign-ins are forced through SIWA. Document explicitly. |
| `apple-signin-auth` (or chosen lib) has a CVE during V0 launch week | Low | Pin to a tagged version in `package.json`; subscribe Eva to Dependabot alerts on the `services/api` workspace. |
| Apple JWKS endpoint outage during sign-in | Very Low | Library caches keys with a 24h TTL. T-0013-040 verifies the cached path is exercised when the JWKS fetch fails. |
| Apple Relay email logged at INFO accidentally (PII leak) | Medium | Audit `req.log.info` calls in the new route; the `safeMessage(err)` wrapper at the route boundary; ESLint rule blocking `console.log` already in place; T-0013-033 (service layer) and T-0013-063 (route layer) explicitly assert the Apple Relay email / identity token is never logged. |

## Prerequisites — Apple Developer + EAS Config

**Owner:** DevOps (Eva). **Due:** end of V0 week 4 (before Step 1 PR
opens). These are out-of-band of any code PR but are referenced from
Step 1 acceptance criteria.

1. **App ID capability.** In Apple Developer Portal → Identifiers →
   App IDs → `com.appcreator.mvp` (or whatever V0 ships under) →
   enable **Sign In with Apple**.
2. **Service ID.** Create a Service ID with identifier
   `com.appcreator.mvp.siwa` (mirrors bundle). This becomes our
   `aud` claim. Configure it under "Sign In with Apple" → "Web
   Authentication Configuration" — though we're not doing web flows,
   the Service ID owns the audience binding.
3. **Sign-In key.** Apple Developer Portal → Keys → "+" → enable Sign
   In with Apple → bind to the App ID. Download the `.p8` private
   key file. **One-time download only** — if it's lost, a new key
   must be generated. DevOps stores the `.p8` in 1Password (or
   equivalent secret manager) and copies it into EAS Secrets +
   server-side env (`APPLE_SIWA_PRIVATE_KEY`).
4. **Key ID + Team ID.** Recorded from the Apple Developer Portal.
   Stored in env (`APPLE_SIWA_KEY_ID`, `APPLE_SIWA_TEAM_ID`).
5. **EAS Build profile** (`eas.json`): development + production
   profiles get `EXPO_PUBLIC_AUTH_PROVIDER=magic-link` until PR 4;
   PR 4 flips production profile to `apple`. Development stays
   `magic-link` for now (developers can opt into `apple` by setting
   the env var locally; T-0013-002 documents).
6. **`app.config.ts`** entry: add `expo-apple-authentication` to the
   plugins array (the package's docs show the snippet). This makes
   the iOS dev-client surface the native modal API.

These steps **don't** happen in any code PR; Eva confirms completion
in the Step 1 PR description.

## Implementation Plan

The plan is five PRs, ordered by dependency. PR 1 (server route) and
PR 2 (mobile provider) can be reviewed in parallel because they share
only the wire contract (frozen here in §API). PR 3 is the env-flag
flip + lint guard. PR 4 is the magic-link deprecation. The plan
**deliberately does not delete** the magic-link route code in any PR;
that's a follow-up cleanup post-launch stability.

### Step 1: Server-side — `POST /auth/apple` route + identity-token verification + find-or-create user

**Files to create / modify:**

- `services/api/src/lib/env.ts` — add four new env entries
  (`APPLE_SIWA_CLIENT_ID`, `APPLE_SIWA_TEAM_ID`, `APPLE_SIWA_KEY_ID`,
  `APPLE_SIWA_PRIVATE_KEY`) with the same `nodeEnv === 'test' ?
  optionalNonEmpty : requiredString(...)` pattern that
  `SUPABASE_JWT_SECRET` uses today.
- `services/api/src/lib/appleIdentity.ts` — new module wrapping the
  token-validation library. Shape:
  ```ts
  export interface AppleIdentityClaims {
    sub: string         // stable Apple user ID
    email: string       // real OR private-relay alias OR empty-string
    emailVerified: boolean
    isPrivateEmail: boolean
  }
  export class AppleIdentityError extends Error {
    readonly code: AppleIdentityErrorCode
  }
  export type AppleIdentityErrorCode =
    | 'malformed'        // not a 3-segment JWT
    | 'signature_invalid'// signature mismatch
    | 'kid_unknown'      // kid not in JWKS
    | 'expired'          // exp in past
    | 'issuer_mismatch'  // iss !== 'https://appleid.apple.com'
    | 'audience_mismatch'// aud !== APPLE_SIWA_CLIENT_ID
    | 'jwks_unreachable' // network failure AND no cached key
    | 'missing_claim'    // sub or other required field absent
  export async function verifyAppleIdentityToken(
    identityToken: string,
  ): Promise<AppleIdentityClaims>
  ```
- `services/api/src/services/users.service.ts` — extend with
  `findOrCreateByAppleSub(db, appleSub, email, displayName?)`. Shape:
  ```ts
  export async function findOrCreateByAppleSub(
    db: Db,
    appleSub: string,
    email: string,        // may be '' or '*@privaterelay.appleid.com'
    displayName?: string, // present only on first sign-in (Apple emits once)
  ): Promise<MirroredUser>
  ```
  Logic: `INSERT ... ON CONFLICT (apple_user_id) DO NOTHING; SELECT
  WHERE apple_user_id = $1`. Race-safe by the same two-statement
  pattern as `findOrCreate`. **Does NOT update email on conflict** —
  identical contract to the magic-link path. Email captured on first
  sign-in, never overwritten. (Apple emits `email` and `name` *only*
  on the first user-grant, never on subsequent sign-ins — design fact,
  not a bug to work around.)
- `services/api/src/services/auth.service.ts` — add
  `issueLocalJwtForUser(user: MirroredUser): Promise<{accessToken,
  refreshToken, expiresIn}>`. Uses `jsonwebtoken.sign` with
  `SUPABASE_JWT_SECRET`, `algorithm: 'HS256'`, payload `{sub: user.id,
  email: user.email}`, `expiresIn: '1h'` (mirrors Supabase's 1h
  default), `aud: 'authenticated'`. Refresh token is a generated
  opaque 32-byte hex string; SIWA flow stores it in a new
  `apple_refresh_tokens` table keyed on the user.
- `services/api/src/routes/auth.ts` — add `POST /auth/apple` handler.
  Body schema:
  ```ts
  const appleSignInBody = z.object({
    identityToken: z.string().min(1).max(4096),
    authorizationCode: z.string().min(1).max(1024).optional(),
    nonce: z.string().min(1).max(64).optional(),
    displayName: z.string().min(1).max(120).optional(), // present on first sign-in only
  })
  ```
  Handler flow:
  1. Zod parse → 400 `invalid_input` on failure.
  2. Per-IP rate-limit: 10/min (same shape as `/auth/sync`).
  3. `verifyAppleIdentityToken(identityToken)` → throw
     `AppleIdentityError` on any reject reason.
  4. `findOrCreateByAppleSub(db, claims.sub, claims.email,
     body.displayName)`.
  5. `issueLocalJwtForUser(user)` → `{accessToken, refreshToken,
     expiresIn}`.
  6. Return `200 {access_token, refresh_token, expires_in, user:
     {id, display_name}}`. **`email` is intentionally excluded from
     the response body** per `canvas-v0.md` §API Contracts (privacy:
     Apple Relay aliases must not appear in HTTP middleware logs,
     Xcode network inspector, etc.). The mobile app can read the
     email from the JWT claims if it needs to display it — the JWT
     is the auth credential, it's already in transit and storage.
  7. On `AppleIdentityError`:
     - `malformed` | `signature_invalid` | `kid_unknown` |
       `audience_mismatch` | `issuer_mismatch` | `missing_claim` →
       `401 {error: 'unauthorized'}` (don't leak which check failed
       — same model as `requireAuth`).
     - `expired` → `401 {error: 'unauthorized', detail: 'token_expired'}`
       — only failure where the client can usefully retry.
     - `jwks_unreachable` → `503 {error: 'internal'}` + log via
       `safeMessage`; transient.
  8. On `users.service` failure → `500 {error: 'internal'}` + log.
- `services/api/src/db/schema.ts` — extend `users`:
  ```ts
  appleUserId: text('apple_user_id').unique(),  // nullable; stable per user-per-app
  displayName: text('display_name'),            // captured first sign-in only
  appleRefreshAt: timestamp('apple_refresh_at', {withTimezone: true}), // last refresh
  ```
  Plus a new table:
  ```ts
  export const appleRefreshTokens = pgTable('apple_refresh_tokens', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, {onDelete: 'cascade'}),
    tokenHash: text('token_hash').notNull().unique(), // sha256 of the opaque token
    createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', {withTimezone: true}),
    expiresAt: timestamp('expires_at', {withTimezone: true}).notNull(),
  })
  ```
  We **hash** the refresh token before storing — a DB compromise
  doesn't yield reusable tokens. `POST /auth/refresh` (new route in
  this step) hashes the incoming token and looks it up.

  **Hash algorithm: SHA-256, not a password KDF.** Refresh tokens are
  32 bytes of cryptographically-random data (~256 bits entropy).
  SHA-256 is the chosen hash algorithm because the input is already
  high-entropy; password-hashing KDFs (Argon2id, bcrypt, scrypt)
  provide no marginal security benefit against brute-force when the
  input space is already 2^256, and they would add unjustified server
  CPU cost on every session validation. Colby: **do not "upgrade"
  this to bcrypt** — it would only break the hash comparison without
  improving security. T-0013-040 asserts `crypto.createHash('sha256')`
  specifically.
- Migration `drizzle/0010_apple_siwa.sql` — adds the three new columns
  on `users` plus the new table. Reviewed and committed by Colby per
  CLAUDE.md §10.

**Acceptance criteria:**

1. New env vars present in `env.ts` and asserted in
   `env.test.ts`'s config-exhaustion suite (test-mode optional;
   non-test required).
2. `POST /auth/apple` returns 200 with `{access_token, refresh_token,
   expires_in, user: {id, display_name}}` shape on happy path —
   `user` has **exactly** the keys `id` and `display_name`, no
   `email` (aligned with `canvas-v0.md` §API Contracts privacy
   stance). `access_token` is a valid HS256 JWT verifiable by
   `verifyJwt` against `SUPABASE_JWT_SECRET`.
3. `verifyAppleIdentityToken` correctly rejects each of the **eight**
   `AppleIdentityErrorCode` values — `malformed`, `signature_invalid`,
   `kid_unknown`, `expired`, `issuer_mismatch`, `audience_mismatch`,
   `jwks_unreachable`, `missing_claim` — at least one test per code,
   with matching HTTP status mapping above. Cross-reference:
   T-0013-004..024 covers all 8 codes (Roz-verified).
4. `findOrCreateByAppleSub` on second-and-later sign-in does NOT
   update `email` or `display_name` (mirrors magic-link contract).
5. `apple_user_id` is `UNIQUE` — concurrent first-sign-ins for the
   same `sub` produce one row, not two (race-safe).
6. Apple Relay email values (`*@privaterelay.appleid.com`) are stored
   verbatim and are NEVER logged at INFO level (asserted with a
   `pino` test logger capture).
7. Migration applies cleanly to a fresh DB and to a DB with existing
   ADR-0011 schema state.
8. **Library selection (Decision §3 criterion):** the chosen token-
   validation library (`apple-signin-auth` or `verify-apple-id-token`)
   documents JWKS fetch debounce semantics OR has explicit upstream
   tests covering race-free concurrent-`kid` fetches. PR 1 description
   records the chosen library, the pinned version, and which of the
   two criteria it satisfies (link to README section or test file).

**Estimated complexity:** Medium-High. The token validation is bounded
once the library choice is made; the new table + refresh route is the
work that drags.

**Data sensitivity table — Step 1 stores:**

| Store Method | Returns | Sensitivity |
| --- | --- | --- |
| `findOrCreateByAppleSub` | `{id, email, createdAt}` | **auth-only** — caller is the SIWA route handler; never returned to clients. Excludes `appleUserId`, `displayName`, `appleRefreshAt`. |
| (route response) | `{id, display_name}` | **public-safe** — the JWT issuance flow surfaces these two fields under `user` to the client. **`email` is deliberately excluded** per `canvas-v0.md` §API Contracts (raw email — including Apple Relay aliases — must never appear in the response body where it could be captured by HTTP middleware logs, Xcode network inspector, or proxy tooling). If the mobile app needs the email, it reads the `email` claim from the JWT (already in transit/storage as the auth credential). Excludes `appleUserId` (treat as internal), `email`, `createdAt`, all event/library data. |
| `verifyAppleIdentityToken` (return type) | `{sub, email, emailVerified, isPrivateEmail}` | **auth-only** — never reaches a route response. Used by the SIWA route handler then discarded. |
| `apple_refresh_tokens` row read | sha256(token), `expires_at`, `revoked_at` | **auth-only** — never serialized to a response. Token plaintext is only ever held in-memory in the issuance flow. |

### Step 2: Mobile-side — `siwaProvider`, `AuthProvider` interface, `getAuthProvider()`

**Files to create:**

- `apps/mobile/src/lib/auth/types.ts`:
  ```ts
  export type AuthProviderName = 'magic-link' | 'apple'
  export interface AuthSignInResult {
    accessToken: string
    refreshToken: string
    expiresIn: number
    // `user.email` is intentionally NOT in this shape (per P0-1 /
    // canvas-v0.md §API Contracts). If the app needs the email, it
    // reads it from the JWT claim.
    user: {id: string; displayName?: string}
  }
  export interface AuthProvider {
    readonly name: AuthProviderName
    signIn(): Promise<AuthSignInResult>
  }
  ```
- `apps/mobile/src/lib/auth/magicLinkProvider.ts` — re-housing of the
  current `useMagicLinkMutation`-derived flow. The provider's
  `signIn()` opens the `EmailEntrySheet` and resolves on successful
  redeem. This is an architectural re-frame of existing logic, NOT a
  rewrite — the inner Supabase calls and the EmailEntrySheet UI are
  unchanged.
- `apps/mobile/src/lib/auth/siwaProvider.ts` — new. Shape:
  ```ts
  import * as AppleAuth from 'expo-apple-authentication'
  import {apiFetch} from '#/lib/api'
  import {logger} from '#/logger'
  import type {AuthProvider, AuthSignInResult} from './types'

  export const siwaProvider: AuthProvider = {
    name: 'apple',
    async signIn(): Promise<AuthSignInResult> {
      let credential
      try {
        credential = await AppleAuth.signInAsync({
          requestedScopes: [
            AppleAuth.AppleAuthenticationScope.FULL_NAME,
            AppleAuth.AppleAuthenticationScope.EMAIL,
          ],
        })
      } catch (err) {
        if ((err as any)?.code === 'ERR_REQUEST_CANCELED') {
          throw new AuthCanceledError()
        }
        throw new AuthFailedError('siwa_native_failed', err)
      }
      if (!credential.identityToken) {
        throw new AuthFailedError('siwa_no_identity_token')
      }
      const displayName = credential.fullName
        ? [credential.fullName.givenName, credential.fullName.familyName]
            .filter(Boolean).join(' ').trim() || undefined
        : undefined
      const body = {
        identityToken: credential.identityToken,
        authorizationCode: credential.authorizationCode ?? undefined,
        displayName,
      }
      try {
        const res = await apiFetch<AuthSignInResult>('/auth/apple', {
          method: 'POST',
          body: JSON.stringify(body),
          headers: {'content-type': 'application/json'},
        })
        return res
      } catch (err) {
        // 401 from server → couldn't validate token; user-facing toast.
        // 503 → transient; let caller decide retry.
        throw new AuthFailedError('siwa_server_rejected', err)
      }
    },
  }
  ```
- `apps/mobile/src/lib/auth/errors.ts`:
  ```ts
  export class AuthCanceledError extends Error { readonly name = 'AuthCanceledError' }
  export class AuthFailedError extends Error {
    readonly code: string
    readonly cause?: unknown
    constructor(code: string, cause?: unknown) { super(code); this.name = 'AuthFailedError'; this.code = code; this.cause = cause }
  }
  ```
- `apps/mobile/src/lib/auth/getAuthProvider.ts`:
  ```ts
  import {logger} from '#/logger'
  import {magicLinkProvider} from './magicLinkProvider'
  import {siwaProvider} from './siwaProvider'
  import type {AuthProvider, AuthProviderName} from './types'

  function readEnvFlag(): AuthProviderName {
    const raw = (process.env.EXPO_PUBLIC_AUTH_PROVIDER ?? '').trim().toLowerCase()
    if (raw === 'apple') return 'apple'
    if (raw === 'magic-link' || raw === '') return 'magic-link'
    logger.warn({event: 'auth_provider_invalid', value: raw, fallback: 'magic-link'},
      'unknown EXPO_PUBLIC_AUTH_PROVIDER value; falling back')
    return 'magic-link'
  }

  let cached: AuthProvider | null = null
  export function getAuthProvider(): AuthProvider {
    if (cached) return cached
    cached = readEnvFlag() === 'apple' ? siwaProvider : magicLinkProvider
    return cached
  }

  /** Test-only seam — reset the memoization between tests. */
  export function __resetAuthProviderCacheForTests(): void { cached = null }
  ```
- `apps/mobile/src/lib/auth/index.ts` — barrel re-exports
  `getAuthProvider`, the error types, and the interface.
- `apps/mobile/src/screens/SignIn/index.tsx` (or `SignInScreen.tsx`
  after ADR-0011 Phase 2 PR lands) — the button's `onPress`:
  ```ts
  const provider = useMemo(() => getAuthProvider(), [])
  const handleSignIn = useCallback(async () => {
    try {
      const result = await provider.signIn()
      await session.redeemToken({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      })
    } catch (err) {
      if (err instanceof AuthCanceledError) return // silent — user dismissed
      toast.show('Couldn't sign in with Apple', {variant: 'error'})
      logger.error('siwa_sign_in_failed', {safeMessage: err})
    }
  }, [provider, session, toast])
  ```
  **Note:** the magic-link path retains its existing
  `EmailEntrySheet` flow because `magicLinkProvider.signIn()`
  internally drives that sheet — `provider.signIn()` is a single
  call site whose internal UX differs by provider. This is what
  ADR-0011 §Decision 9 anticipates ("the button's `onPress` is
  swapped").
- `app.config.ts` — add `expo-apple-authentication` to the `plugins`
  array.
- `apps/mobile/package.json` — add `expo-apple-authentication`
  dependency pinned to the latest SDK-50-compatible version.

**Acceptance criteria:**

1. `getAuthProvider()` returns `siwaProvider` iff
   `EXPO_PUBLIC_AUTH_PROVIDER === 'apple'` (case-insensitive, whitespace-trimmed).
2. Any other value (including unset, `''`, garbage, `'APPLE  '`)
   resolves to `magicLinkProvider`, with a single `logger.warn` for
   "garbage" values only.
3. `siwaProvider.signIn()` resolves to `AuthSignInResult` on the
   happy path.
4. `siwaProvider.signIn()` rejects with `AuthCanceledError` (not a
   generic error) when the user dismisses the Apple consent sheet.
5. `siwaProvider.signIn()` rejects with `AuthFailedError({code:
   'siwa_no_identity_token'})` when Apple returns a credential with
   `identityToken === null` (rare; documented Apple edge case).
6. `siwaProvider.signIn()` rejects with `AuthFailedError({code:
   'siwa_server_rejected'})` on any non-2xx response from
   `POST /auth/apple`.
7. The `SignInScreen` button's `onPress` does NOT show a toast on
   `AuthCanceledError` (user-initiated dismissal is not a failure).
8. The `SignInScreen` button's `onPress` DOES show a toast for any
   `AuthFailedError`.
9. The provider cache is reset between tests by
   `__resetAuthProviderCacheForTests()` — verified by a test that
   sets the env flag mid-test.
10. **`apps/mobile/jest.config.js` `moduleNameMapper`** has an entry
    for `expo-apple-authentication` pointing at
    `apps/mobile/src/testHelpers/mockExpoAppleAuthentication.ts`.
    The native module is not available under Jest (node env), so
    every test importing the package — directly or transitively —
    receives the mock. Hard AC item (promoted from the CI Impact
    table per R1 R0-CI/CD): without this entry, all Step 2 tests
    importing `siwaProvider` fail at module-load with a native-
    module error. PR description must include a screenshot or
    paste of the moduleNameMapper line.

**Estimated complexity:** Medium. The trickiest piece is the cache +
reset surface; the rest is wiring.

### Step 3: Env-flag flip + lint guard

**Files to modify:**

- `apps/mobile/eas.json` — the production build profile sets
  `EXPO_PUBLIC_AUTH_PROVIDER=apple`. Development profile stays at
  `magic-link` (developers opt in with a local override).
- `apps/mobile/.env.example` — add the line
  `EXPO_PUBLIC_AUTH_PROVIDER=magic-link` with a `# 'apple' or
  'magic-link'` comment.
- `apps/mobile/.eslintrc.*` (or repo-root config) — add a `no-restricted-syntax`
  rule blocking direct reads of `process.env.EXPO_PUBLIC_AUTH_PROVIDER`
  outside `apps/mobile/src/lib/auth/getAuthProvider.ts`. Ensures the
  flag is read once at module load, not scattered.
- `apps/mobile/app.config.ts` — confirm
  `expo-apple-authentication` is in the plugins array (added in
  Step 2; verified in Step 3 acceptance criteria).
- `services/api/.env.example` — add the four `APPLE_SIWA_*` env
  vars with placeholder values + comments explaining each.

**Acceptance criteria:**

1. `eas.json` production profile has
   `EXPO_PUBLIC_AUTH_PROVIDER=apple` (asserted in a JSON-shape unit
   test if one exists; otherwise asserted in code review).
2. ESLint rule fires on any `process.env.EXPO_PUBLIC_AUTH_PROVIDER`
   reference outside the auth module.
3. A new TestFlight build produced after this PR shows the Apple
   sign-in flow on cold launch (manual verification, captured in PR
   description with screenshot).

**Estimated complexity:** Low. This is configuration + lint.

### Step 4: Magic-link path deprecation

**Files to modify:**

- `services/api/src/routes/auth.ts` — add a `@deprecated` JSDoc to
  the `POST /magic-link` handler. Add a structured log line on every
  hit, **at route entry, BEFORE the Zod body parse**:
  `logger.warn({event: 'magic_link_deprecated_route_hit', ...}, 'Magic-link route hit post-SIWA cutover')`.
  Ordering is pinned (T-0013-139): the deprecation tap fires on every
  request regardless of body validity, then the Zod parse runs, then
  the handler. Route remains functional — this is a tap, not a sunset.
- `apps/mobile/src/lib/auth/magicLinkProvider.ts` — JSDoc
  `@deprecated`. Tests survive.
- `docs/adrs/ADR-0001-foundation.md` — frontmatter update
  (Status remains Accepted; add a "Deprecated by ADR-0013 PR 5 for
  V0 — see §Status" note). **Ellis** does this update; not Cal.

**Acceptance criteria:**

1. Both `@deprecated` annotations present (TS/JSDoc — IDE surfaces
   them).
2. Magic-link route still returns 200 on a valid request
   (regression — no behavior change).
3. The structured warn log fires on every magic-link route hit.
4. The deprecation does NOT introduce a 410 / 5xx response — that's
   a V0.5 cleanup ADR.

**Estimated complexity:** Low. Pure metadata.

### Step 5: Documentation + observability

**Files to create / modify:**

- `docs/product/canvas-v0-reviewer-notes.md` (drafted by PM
  separately, but this ADR's PR includes one targeted update): the
  "Auth model" section explicitly states **Sign in with Apple, no
  third-party auth providers, account deletion supported.**
- `services/api/src/llm/telemetry.ts` — add three new telemetry
  event types to the whitelist (per ADR-0007 Step 8 carryover):
  `auth.siwa_sign_in_succeeded`, `auth.siwa_sign_in_failed`,
  `auth.siwa_token_validation_failed`. Payload fields:
  - `auth.siwa_sign_in_succeeded`: `{provider}` — required.
  - `auth.siwa_sign_in_failed`: `{provider, failure_code?}` —
    `failure_code` is **optional** (so an unknown-cause failure can
    still be reported without a synthetic code); when present, must
    be one of the `AppleIdentityErrorCode` union values.
  - `auth.siwa_token_validation_failed`: same shape as
    `auth.siwa_sign_in_failed` (`failure_code` optional, constrained
    to the union when present).
  **No email, no `sub`, no token plaintext** — asserted in tests
  (T-0013-125..127). The route MUST emit the telemetry event under
  `EVAL_MODE=true` as well; the ADR-0007 short-circuit handles the
  persistence skip (T-0013-140 pins this).
- `services/api/src/routes/auth.ts` — emit the telemetry events
  at the appropriate handler exits.

**Acceptance criteria:**

1. The three new event types are in the telemetry whitelist; the
   eval-mode short-circuit (ADR-0007 §EVAL_MODE) still suppresses
   DB writes when `EVAL_MODE=true` — but the route handler MUST
   still call `telemetry.write(...)` so that payload validation
   runs (T-0013-140).
2. Failure events MAY include `failure_code` (optional); when
   present, it must be one of the `AppleIdentityErrorCode` union
   values. Whitelist declares the field as optional.
3. No event payload contains email, Apple `sub`, or token plaintext
   (asserted via fixture-based payload inspection in tests).
4. The reviewer notes (`docs/product/canvas-v0-reviewer-notes.md`)
   reference the SIWA auth model.

**Estimated complexity:** Low.

## Out of Scope

Spelled out so reviewers don't ask:

- **Other auth providers** (Google, GitHub, email/password): V0.5+.
- **Two-factor auth:** V0.5+.
- **Social account linking** (Apple + email merge): V0.5+.
- **In-product profile editing** (display name, avatar): V0.5+.
- **Account deletion via SIWA-specific endpoint:** The existing
  account-deletion flow is auth-provider agnostic. No SIWA-specific
  delete endpoint is needed for V0.
- **Server-side cert/key automation:** Manual EAS Secret + env var
  update for V0. V0.5+ may add automation if SIWA's quarterly key
  rotation becomes a chore (it currently does not — Apple's JWKS
  keys are validated dynamically; the *server-side signing key* (the
  `.p8` file) is what's manual, and it rotates on Apple's schedule,
  not ours).
- **Web target / non-iOS clients:** V0 is iOS-only.
- **Migration of dev/staging magic-link users:** Hard reset.

## Comprehensive Test Specification

### Test File Mapping

| Step | Test File | Env |
| --- | --- | --- |
| 1 | `services/api/src/lib/appleIdentity.test.ts` | Jest (node) |
| 1 | `services/api/src/services/users.service.test.ts` (extend) | Jest + testcontainers (Postgres) |
| 1 | `services/api/src/services/auth.service.test.ts` (new) | Jest (node) |
| 1 | `services/api/src/routes/auth.test.ts` (extend) | Jest + Fastify + testcontainers |
| 1 | `services/api/src/lib/env.test.ts` (extend) | Jest (node) |
| 1 | `services/api/src/db/schema.test.ts` (extend) | Jest + testcontainers |
| 2 | `apps/mobile/src/lib/auth/getAuthProvider.test.ts` | Jest |
| 2 | `apps/mobile/src/lib/auth/siwaProvider.test.ts` | Jest (mocks `expo-apple-authentication`) |
| 2 | `apps/mobile/src/screens/SignIn/index.test.tsx` (extend) | Jest + RTL |
| 3 | `apps/mobile/eas.json` review only (no test file; PR-level assertion) | — |
| 3 | ESLint rule test in `apps/mobile/.eslintrc.test.ts` (if exists) or rule snapshot | Jest |
| 4 | `services/api/src/routes/auth.test.ts` (extend) | Jest |
| 5 | `services/api/src/llm/telemetry.test.ts` (extend) | Jest |

### Step 1 Tests — Server-side SIWA route + token validation + identity model

#### Step 1a — `verifyAppleIdentityToken` (token validation)

| ID | Category | Test Description |
| --- | --- | --- |
| T-0013-001 | Happy | Valid RS256 token signed by a test JWKS (Apple-shaped: `iss = 'https://appleid.apple.com'`, `aud = APPLE_SIWA_CLIENT_ID`, `exp` in future, `sub` non-empty, `email = 'user@example.com'`, `email_verified = true`, `is_private_email = false`) → resolves to `{sub: 'apple-sub-001', email: 'user@example.com', emailVerified: true, isPrivateEmail: false}`. |
| T-0013-002 | Happy | Apple Relay alias path: token with `email = 'opq@privaterelay.appleid.com'`, `is_private_email = true` → resolves with `isPrivateEmail: true`, email stored verbatim. |
| T-0013-003 | Happy | Token with empty-string `email` (user denied scope) → resolves with `email: ''`, `emailVerified: false`. |
| T-0013-004 | Failure | `''` (empty string) → throws `AppleIdentityError({code: 'malformed'})`. |
| T-0013-005 | Failure | Non-JWT garbage string `'not.a.jwt'` → throws `AppleIdentityError({code: 'malformed'})`. |
| T-0013-006 | Failure | JWT with only 2 segments → `malformed`. |
| T-0013-007 | Failure | Valid-shape JWT signed by a different key (signature mismatch) → `signature_invalid`. |
| T-0013-008 | Failure | Valid-shape JWT with a `kid` header pointing at a key NOT in the JWKS → `kid_unknown`. |
| T-0013-009 | Failure | Token with `exp` in the past (5s ago) → `expired`. |
| T-0013-010 | Boundary | Token with `exp` = now + 1s → resolves (still valid). |
| T-0013-011 | Boundary | Token with `exp` = now - 1s, but clock-skew tolerance is 30s → resolves (within skew window). Confirms the lib's tolerance default matches our magic-link path. |
| T-0013-012 | Failure | Token with `iss = 'https://malicious.example.com'` → `issuer_mismatch`. |
| T-0013-013 | Failure | Token with missing `iss` claim → `issuer_mismatch`. |
| T-0013-014 | Failure | Token with `aud = 'wrong.audience.id'` → `audience_mismatch`. |
| T-0013-015 | Failure | Token with `aud` as an array `['wrong']` (not containing our client ID) → `audience_mismatch`. |
| T-0013-016 | Boundary | Token with `aud` as an array `['unrelated', APPLE_SIWA_CLIENT_ID]` (our client ID is one of multiple audiences) → resolves. |
| T-0013-017 | Failure | Token missing `sub` claim → `missing_claim`. |
| T-0013-018 | Failure | Token with `sub = ''` (empty) → `missing_claim`. |
| T-0013-019 | Failure | Token with `sub` as a number (not a string) → `missing_claim`. |
| T-0013-020 | Failure | JWKS fetch returns 500 AND no cached key → `jwks_unreachable`. |
| T-0013-021 | Regression | JWKS fetch returns 500 BUT a cached key from a prior request validates the `kid` → resolves (cached path). |
| T-0013-022 | Security | Token with `alg: 'none'` header → `signature_invalid` (NOT a silent pass). |
| T-0013-023 | Security | Token with `alg: 'HS256'` (symmetric, not Apple's pattern) using `APPLE_SIWA_CLIENT_ID` as the secret → `signature_invalid` (the lib must NOT accept symmetric algs against an asymmetric key). |
| T-0013-024 | Security | A 4097-byte token (> max length the route accepts) — verified at the route layer in T-0013-051; here the underlying lib is given a 1MB string → rejects with `malformed` quickly (no DoS via giant tokens). |

#### Step 1b — `findOrCreateByAppleSub` (identity model)

| ID | Category | Test Description |
| --- | --- | --- |
| T-0013-025 | Happy | First sign-in: insert `apple_user_id='apple-sub-101'`, `email='alice@example.com'`, `display_name='Alice Cooper'` → returns a `MirroredUser` with a freshly-generated `users.id` UUID; row exists with all three Apple fields set. |
| T-0013-026 | Happy | Second sign-in with the same `apple_user_id` but a DIFFERENT email (`'alice2@example.com'`) and a DIFFERENT display name → returns the SAME `users.id`; the stored email and display name are UNCHANGED (mirrors magic-link contract). |
| T-0013-027 | Happy | Second sign-in with the same `apple_user_id` and an Apple Relay alias email → stored email unchanged from the first sign-in's value. |
| T-0013-028 | Happy | First sign-in with empty email (`''`) → row stored with `email = ''`; not a failure. |
| T-0013-029 | Concurrency | Two parallel calls with the same `apple_user_id` and the same email → exactly one INSERT commits (Postgres unique-conflict); both calls return the same `users.id`. Row count assert == 1 after both promises resolve. |
| T-0013-030 | Concurrency | Two parallel calls with the same `apple_user_id` and DIFFERENT emails → exactly one INSERT commits; the persisted email is whichever call won the race (undefined which); both return the same `users.id`. |
| T-0013-031 | Failure | `apple_user_id` parameter is empty string → throws `Error('invalid_apple_sub')` before any DB call. |
| T-0013-032 | Failure | DB connection fails mid-INSERT → caller receives the underlying error; no partial state. |
| T-0013-033 | Security | Stored email is `*@privaterelay.appleid.com` → NOT logged at INFO level by `findOrCreateByAppleSub` (asserted via test logger). |
| T-0013-034 | Boundary | `display_name` is the maximum-length string (120 chars) → stored. |
| T-0013-035 | Boundary | `display_name` is `undefined` (second-and-later sign-in, Apple no longer emits name) → first sign-in's value is preserved. |
| T-0013-036 | Regression | Existing `findOrCreate(db, supabaseUserId, email)` (magic-link path) is **not** affected — exhaustive test that the unaltered magic-link flow still passes its existing T-0001-044, T-0001-045, T-0001-119 mirrors. |

#### Step 1c — `issueLocalJwtForUser` + JWT issuance

| ID | Category | Test Description |
| --- | --- | --- |
| T-0013-037 | Happy | For a given `MirroredUser`, returns `{accessToken, refreshToken, expiresIn}` where `accessToken` is an HS256 JWT verifiable by `verifyJwt` (the existing `lib/auth.ts` function). |
| T-0013-038 | Happy | Issued JWT payload has `sub = user.id` (UUID, not the Apple `sub`), `email = user.email`, `aud = 'authenticated'`, `exp = now + 3600s`. |
| T-0013-039 | Happy | Issued refresh token is a 64-char hex string (32-byte hex). |
| T-0013-040 | Happy | Refresh token is persisted to `apple_refresh_tokens` as a sha256 hash, NOT plaintext. |
| T-0013-041 | Boundary | `expiresIn` returned by the function matches the JWT's `exp - iat`. |
| T-0013-042 | Security | The refresh token plaintext is NOT returned in the response of `findOrCreateByAppleSub`; only `issueLocalJwtForUser` knows the plaintext, and it returns it exactly once. |
| T-0013-043 | Regression | Issued JWT verifies against `verifyJwt` using `SUPABASE_JWT_SECRET` — exactly the same path as a magic-link JWT. The middleware can't distinguish provider source. |

#### Step 1d — `POST /auth/apple` route handler

| ID | Category | Test Description |
| --- | --- | --- |
| T-0013-044 | Happy | Valid body with valid `identityToken` (mocked `verifyAppleIdentityToken` resolves to fixture claims) → 200 with `{access_token, refresh_token, expires_in, user: {id, display_name}}` shape. Assert `Object.keys(response.user).sort()` is exactly `['display_name', 'id']` — no `email`, no extra keys. |
| T-0013-045 | Happy | First sign-in fixture captures `display_name = 'Sarah Connor'`; second-sign-in request omits `displayName` (Apple no longer emits it) → 200; response's `user.display_name === 'Sarah Connor'` (exact value, preserved verbatim from the first sign-in row). NOT `null`, NOT the second-sign-in body's omitted field — the stored value. |
| T-0013-046 | Happy | Body where the Apple identity token's `email` claim is an Apple Relay alias (`*@privaterelay.appleid.com`) → 200; the response body does NOT contain the email field at all (per P0-1 / canvas-v0.md §API Contracts). Assert `'email' in response.user === false` AND `JSON.stringify(response).includes('@privaterelay.appleid.com') === false`. The masked alias is persisted in `users.email` (DB row assertion) but never serialized to the response. |
| T-0013-047 | Failure | Empty body → 400 `{error: 'invalid_input', detail: 'identityToken required'}`. |
| T-0013-048 | Failure | Body with `identityToken: ''` → 400 `invalid_input`. |
| T-0013-049 | Failure | Body with `identityToken` of 4097 chars → 400 `invalid_input` (length cap). |
| T-0013-050 | Failure | Body with `displayName` of 121 chars → 400 `invalid_input`. |
| T-0013-051 | Failure | Body with non-string `identityToken` (number) → 400 `invalid_input`. |
| T-0013-052 | Failure | `verifyAppleIdentityToken` throws `AppleIdentityError({code: 'malformed'})` → 401 `{error: 'unauthorized'}` (no detail leak). |
| T-0013-053 | Failure | `verifyAppleIdentityToken` throws `signature_invalid` → 401. |
| T-0013-054 | Failure | `verifyAppleIdentityToken` throws `kid_unknown` → 401. |
| T-0013-055 | Failure | `verifyAppleIdentityToken` throws `expired` → 401 with `detail: 'token_expired'`. |
| T-0013-056 | Failure | `verifyAppleIdentityToken` throws `issuer_mismatch` → 401, no detail. |
| T-0013-057 | Failure | `verifyAppleIdentityToken` throws `audience_mismatch` → 401, no detail. |
| T-0013-058 | Failure | `verifyAppleIdentityToken` throws `missing_claim` → 401, no detail. |
| T-0013-059 | Failure | `verifyAppleIdentityToken` throws `jwks_unreachable` → 503 `{error: 'internal'}` + `safeMessage` log. |
| T-0013-060 | Failure | `findOrCreateByAppleSub` throws (DB down) → 500 `{error: 'internal'}` + log. |
| T-0013-061 | Security | The 401 response body for any of the six terminal-fail codes (T-0013-052..058) is EXACTLY `{error: 'unauthorized'}` or `{error: 'unauthorized', detail: 'token_expired'}` — no claim values, no Apple `sub`, no token echo. |
| T-0013-062 | Security | Request body is logged at `safeMessage` level only — never raw. Asserted via a captured pino transport. |
| T-0013-063 | Security | The `identityToken` is NEVER logged at ANY level (info, error, debug) by this route — captured-transport assertion. |
| T-0013-064 | Security | Successful auth response's `access_token` is HS256 (NOT echoing the Apple identity token). |
| T-0013-065 | Concurrency | 10 parallel `POST /auth/apple` requests for the same Apple `sub` produce: one row in `users` (T-0013-029 mirror at the route layer), one row per request in `apple_refresh_tokens`, all 10 responses succeed. |
| T-0013-066 | Security | Per-IP rate-limit (10/min) → 11th request from the same IP within 60s → 429 `rate_limited`. |
| T-0013-067 | Boundary | Request with `Content-Type: text/plain` (not JSON) → 400 (Fastify-level rejection). |
| T-0013-068 | Regression | Existing `POST /auth/magic-link` route still returns 200 on a valid email — unchanged. |
| T-0013-069 | Regression | Existing `POST /auth/sync` route still returns 200 with a valid bearer — unchanged. |
| T-0013-070 | Regression | `requireAuth` middleware verifies a JWT minted by SIWA flow against `SUPABASE_JWT_SECRET` — exact same `narrowPayload` path as magic-link JWTs. (Validates Decision 4: the middleware can't distinguish.) |
| T-0013-130 | Security | **Negative assertion (P0-1 / canvas-v0.md §API Contracts):** for any happy-path `POST /auth/apple` response — including the Apple Relay fixture (T-0013-046), the empty-email fixture, and the real-email fixture — the serialized response body (`JSON.stringify(reply.body)`) does NOT contain the substring `"email"` ANYWHERE. Iterates over a parameterized fixture set covering all three email shapes (real, relay, empty) plus first-sign-in and second-sign-in cases. Single test, multiple fixtures. |
| T-0013-131 | Boundary | **Compile-time inverse-extends assertion on the public response shape.** A type-level test in `auth.routes.types.test.ts`: a synthetic type `type ResponseUser = z.infer<typeof appleSignInResponseSchema>['user']` is asserted via `type _AssertNoEmail = 'email' extends keyof ResponseUser ? never : true; const _check: _AssertNoEmail = true`. If the schema is ever broadened to include `email`, `'email' extends keyof ResponseUser` resolves to `true`, the assertion type becomes `never`, and `const _check: never = true` fails at typecheck time. (Same pattern direction as ADR-0008 `PublicMiniApp` assertion Roz approved.) |
| T-0013-132 | Boundary | **Compile-time inverse-extends assertions on internal-only field (split per-key).** Two independent type-level tests guarding against either casing of the internal stable identifier appearing on the public response shape. Pattern (both required): `type _AssertNoAppleUserIdCamel = 'appleUserId' extends keyof ResponseUser ? never : true; const _c1: _AssertNoAppleUserIdCamel = true;` AND `type _AssertNoAppleUserIdSnake = 'apple_user_id' extends keyof ResponseUser ? never : true; const _c2: _AssertNoAppleUserIdSnake = true`. Two separate assertions are required because TypeScript evaluates `A \| B extends keyof T` non-distributively — the union form silently passes when only one variant leaks. If either key is added to the public response shape, its respective conditional resolves to `never`, and the corresponding constant assignment fails to compile. Guards against future refactors leaking the internal stable identifier. |

#### Step 1e — env vars (`env.ts` config exhaustion)

| ID | Category | Test Description |
| --- | --- | --- |
| T-0013-071 | Config exhaustion | `APPLE_SIWA_CLIENT_ID` unset in non-test env → `loadEnv` throws. |
| T-0013-072 | Config exhaustion | `APPLE_SIWA_CLIENT_ID = ''` in non-test env → throws. |
| T-0013-073 | Config exhaustion | `APPLE_SIWA_CLIENT_ID = '   '` (whitespace) in non-test env → throws. |
| T-0013-074 | Config exhaustion | `APPLE_SIWA_CLIENT_ID` unset in test env → `loadEnv` succeeds (test relaxation). |
| T-0013-075 | Config exhaustion | All four `APPLE_SIWA_*` env vars present and valid in non-test → `loadEnv` returns env with all four populated. |
| T-0013-076 | Config exhaustion | `APPLE_SIWA_PRIVATE_KEY` with valid `\n`-escaped multiline content (the format EAS/dotenv stores `.p8` files in) → parsed correctly. |
| T-0013-077 | Config exhaustion | `APPLE_SIWA_TEAM_ID = 'TEAMID12'` (8 chars — Apple's actual format) → accepted. |
| T-0013-078 | Config exhaustion | `APPLE_SIWA_KEY_ID = 'KID1234567'` (10 chars — Apple's actual format) → accepted. |

#### Step 1f — schema + migration

| ID | Category | Test Description |
| --- | --- | --- |
| T-0013-079 | Happy | Migration `0010_apple_siwa.sql` applies cleanly to a fresh DB → `users.apple_user_id` column exists with UNIQUE constraint; `apple_refresh_tokens` table exists. |
| T-0013-080 | Happy | Migration applies to a DB with ADR-0011 schema already applied (mini_apps, mini_app_versions, out_of_scope_intent) → no errors, no data loss. |
| T-0013-081 | Failure | Attempt to insert two `users` rows with the same `apple_user_id` → second insert fails with unique-constraint violation. |
| T-0013-082 | Happy | `apple_user_id` is nullable — magic-link users (with `apple_user_id = null`) coexist with SIWA users in the same table. |
| T-0013-083 | Happy | `users.email` is still UNIQUE — no migration removes that constraint. |
| T-0013-084 | Security | `apple_refresh_tokens.token_hash` is UNIQUE — collisions impossible. |
| T-0013-085 | Happy | Migration is fully reversible via the auto-generated DOWN migration (a Drizzle convention; spot-check at PR review time). |
| T-0013-133 | Boundary | **Compile-time assertion (P0-2): Drizzle schema export shape includes the new columns.** A type-level test in `schema.types.test.ts`: `const _assertUsers: typeof users.$inferSelect extends {appleUserId: string \| null; displayName: string \| null; appleRefreshAt: Date \| null} ? true : never = true`. Uses the TypeScript `satisfies`-style pattern. If the SQL migration adds `apple_user_id` but the Drizzle `users` schema definition omits the column (or types it incorrectly), this test fails at typecheck time — closes the gap where migration tests T-0013-079..085 would pass while typecheck silently breaks. Parallel assertion for `apple_refresh_tokens.$inferSelect`. |

#### Step 1 Test Summary

| Category | Count |
| --- | --- |
| Happy | 20 |
| Failure | 32 |
| Boundary | 8 |
| Concurrency | 3 |
| Security | 12 |
| Regression | 6 |
| Config exhaustion | 8 |
| **Total Step 1** | **89** |

**Step 1 happy/failure ratio:** 32 failure : 20 happy = 1.6:1 (passes hard rule).

### Step 2 Tests — Mobile provider + dispatcher

#### Step 2a — `getAuthProvider()` env-flag dispatch

| ID | Category | Test Description |
| --- | --- | --- |
| T-0013-086 | Happy | `EXPO_PUBLIC_AUTH_PROVIDER='apple'` → returns `siwaProvider`. |
| T-0013-087 | Happy | `EXPO_PUBLIC_AUTH_PROVIDER='magic-link'` → returns `magicLinkProvider`. |
| T-0013-088 | Happy | Memoization: two calls within the same module lifetime return the same instance (`===`). |
| T-0013-089 | Config exhaustion | `EXPO_PUBLIC_AUTH_PROVIDER` unset → returns `magicLinkProvider`, no warn log. |
| T-0013-090 | Config exhaustion | `EXPO_PUBLIC_AUTH_PROVIDER=''` → returns `magicLinkProvider`, no warn log. |
| T-0013-091 | Config exhaustion | `EXPO_PUBLIC_AUTH_PROVIDER='APPLE'` (uppercase) → normalizes; returns `siwaProvider`. |
| T-0013-092 | Config exhaustion | `EXPO_PUBLIC_AUTH_PROVIDER='  apple  '` (whitespace) → trims; returns `siwaProvider`. |
| T-0013-093 | Config exhaustion | `EXPO_PUBLIC_AUTH_PROVIDER='garbage'` → returns `magicLinkProvider`; `logger.warn` called once with payload `{event: 'auth_provider_invalid', value: 'garbage', fallback: 'magic-link'}`. |
| T-0013-094 | Config exhaustion | `EXPO_PUBLIC_AUTH_PROVIDER='google'` → fallback to `magicLinkProvider` + warn log (no Google provider exists in V0). |

#### Step 2b — `siwaProvider.signIn()`

| ID | Category | Test Description |
| --- | --- | --- |
| T-0013-095 | Happy | Mocked `AppleAuth.signInAsync` resolves with `{identityToken: 'apple-id-tok', authorizationCode: 'apple-code', fullName: {givenName: 'Jane', familyName: 'Doe'}}`. Mocked `apiFetch('/auth/apple', ...)` returns `{accessToken, refreshToken, expiresIn, user}`. `siwaProvider.signIn()` resolves with the expected `AuthSignInResult`. The POST body sent to `/auth/apple` contains `displayName: 'Jane Doe'`. |
| T-0013-096 | Happy | `fullName.givenName` only → `displayName = 'Jane'` (no trailing space). |
| T-0013-097 | Happy | `fullName.givenName = null`, `fullName.familyName = null` (Apple omits name on second sign-in) → request body has no `displayName` field (undefined, not empty-string). |
| T-0013-098 | Happy | `authorizationCode = null` → request body omits the field. |
| T-0013-099 | Failure | `AppleAuth.signInAsync` rejects with `{code: 'ERR_REQUEST_CANCELED'}` → `siwaProvider.signIn()` rejects with `AuthCanceledError` (NOT `AuthFailedError`). |
| T-0013-100 | Failure | `AppleAuth.signInAsync` rejects with `{code: 'ERR_REQUEST_FAILED'}` → rejects with `AuthFailedError({code: 'siwa_native_failed'})`. |
| T-0013-101 | Failure | `AppleAuth.signInAsync` rejects with an unstructured Error → rejects with `AuthFailedError({code: 'siwa_native_failed'})`. |
| T-0013-102 | Failure | `AppleAuth.signInAsync` resolves with `{identityToken: null}` → rejects with `AuthFailedError({code: 'siwa_no_identity_token'})`. |
| T-0013-103 | Failure | `apiFetch('/auth/apple', ...)` rejects with a 401 response → rejects with `AuthFailedError({code: 'siwa_server_rejected'})`; `cause` carries the API error. |
| T-0013-104 | Failure | `apiFetch` rejects with a network error (`fetch failed`) → rejects with `AuthFailedError({code: 'siwa_server_rejected'})`. |
| T-0013-105 | Failure | `apiFetch` rejects with 503 → rejects with `AuthFailedError({code: 'siwa_server_rejected'})`. |
| T-0013-106 | Security | The `identityToken` is NOT logged at INFO by `siwaProvider.signIn()` — verified via mocked `logger`. |
| T-0013-107 | Security | The `identityToken` is sent ONLY in the POST body, never as a query param or header. |
| T-0013-134 | Boundary | **P1-4 boundary:** `fullName.givenName` is `'   '` (whitespace-only string, not `null`) → `displayName` resolves to `undefined` after `.trim()`, NOT to the literal `'   '`. Assert request body has NO `displayName` key. Same shape for `familyName = '   '`. (Guards against persisting whitespace as a display name.) |
| T-0013-135 | Boundary | **P1-4 boundary:** `AppleAuth.signInAsync` resolves with `authorizationCode = ''` (empty string, distinct from `null`; documented as a rare Apple shape) → request body to `/auth/apple` includes `authorizationCode: ''` (passed through, not coerced to undefined; the server-side Zod schema rejects with 400 via `min(1)`). Asserts the provider does NOT silently coerce or strip empty strings — that decision lives at the API boundary. |
| T-0013-136 | Failure | **P2-1 backgrounded mid-SIWA:** the user backgrounds the app while the Apple consent sheet is presented (iOS sends the app to background; on return the sheet is auto-dismissed). `AppleAuth.signInAsync` rejects with `{code: 'ERR_REQUEST_CANCELED'}` (or whatever code `expo-apple-authentication` reports for backgrounded-dismissal — pinned in the test by reading the package's documented error codes). Provider treats this the same as user-initiated cancellation: rejects with `AuthCanceledError`, no toast, no error log. Fixture comment: if the underlying error code differs from `ERR_REQUEST_CANCELED`, update both the provider's `if` clause and this test together. |
| T-0013-137 | Happy | **P2-2 provider name:** `siwaProvider.name === 'apple'` (`.toBe('apple')`). Guards against a future refactor renaming the constant. (Used by ADR-0011's Settings sheet for provider-appropriate display copy.) |
| T-0013-138 | Happy | **P2-2 provider name:** `magicLinkProvider.name === 'magic-link'` (`.toBe('magic-link')`). |

#### Step 2c — `SignInScreen` integration

| ID | Category | Test Description |
| --- | --- | --- |
| T-0013-108 | Happy | Render with `EXPO_PUBLIC_AUTH_PROVIDER='apple'` → button label is "Sign in with Apple" (or whatever ADR-0011 Step 7 final copy specifies); `onPress` calls `siwaProvider.signIn()` → on success, `session.redeemToken({accessToken, refreshToken})` is invoked. |
| T-0013-109 | Happy | Render with `EXPO_PUBLIC_AUTH_PROVIDER='magic-link'` → button `onPress` opens the EmailEntrySheet (legacy path) — regression of T-0011-147. |
| T-0013-110 | Failure | `siwaProvider.signIn()` rejects with `AuthCanceledError` → NO toast is shown, NO error is logged. The user is left on the SignInScreen. |
| T-0013-111 | Failure | `siwaProvider.signIn()` rejects with `AuthFailedError` → toast `'Couldn't sign in with Apple'` is shown; `logger.error('siwa_sign_in_failed', ...)` fires once with `safeMessage`. |
| T-0013-112 | A11y | Sign-in button has `accessibilityRole="button"` AND `accessibilityLabel="Sign in with Apple"` when `EXPO_PUBLIC_AUTH_PROVIDER='apple'` (regression of T-0011-149). |

#### Step 2 Test Summary

| Category | Count |
| --- | --- |
| Happy | 9 |
| Failure | 12 |
| Boundary | 2 |
| Config exhaustion | 6 |
| Security | 2 |
| A11y | 1 |
| **Total Step 2** | **32** |

**Step 2 happy/failure ratio:** 12 failure : 9 happy = 1.33:1 (passes hard rule). Boundary count = 2 (closes P1-4).

### Step 3 Tests — Env-flag flip + lint guard

| ID | Category | Test Description |
| --- | --- | --- |
| T-0013-113 | Happy | `eas.json` production profile has `EXPO_PUBLIC_AUTH_PROVIDER=apple` (JSON-shape unit test reading `eas.json`). |
| T-0013-114 | Happy | `eas.json` development profile has `EXPO_PUBLIC_AUTH_PROVIDER=magic-link` (developer convenience). |
| T-0013-115 | Failure | ESLint rule fires on a synthetic source `const x = process.env.EXPO_PUBLIC_AUTH_PROVIDER` placed in a non-allowlisted file. |
| T-0013-116 | Happy | ESLint rule allows the read inside `apps/mobile/src/lib/auth/getAuthProvider.ts`. |
| T-0013-117 | Regression | `app.config.ts` has `expo-apple-authentication` in the plugins array (snapshot-tested). |

#### Step 3 Test Summary

| Category | Count |
| --- | --- |
| Happy | 3 |
| Failure | 1 |
| Regression | 1 |
| **Total Step 3** | **5** |

**Step 3 happy/failure ratio:** 1 failure : 3 happy = 0.33:1.
**N/A justification (thin by design):** Step 3 is configuration +
lint guard. The only thing that can go "wrong" at this step is a
non-allowlisted file reading the env flag (T-0013-115) — that's the
single meaningful failure mode. The remaining tests are correctness
checks that configuration values land in the right files (`eas.json`,
`app.config.ts`) — happy-only is appropriate because the failure
modes (typo'd env value, missing plugin entry) are caught at runtime
by Step 1 / Step 2 tests (T-0013-093 garbage value, T-0013-117
plugin snapshot). Step 3 is structurally a thin gate; the hard
ratio rule does not apply to configuration steps with no
behavioral logic. Roz acknowledged Step 3 as "structurally thin by
design" in R1.

### Step 4 Tests — Magic-link deprecation

| ID | Category | Test Description |
| --- | --- | --- |
| T-0013-118 | Regression | `POST /auth/magic-link` with a valid body still returns 200 `{sent: true}` (unchanged behavior). |
| T-0013-119 | Regression | `POST /auth/magic-link` with an invalid email still returns 400 (unchanged). |
| T-0013-120 | Happy | A `logger.warn({event: 'magic_link_deprecated_route_hit', ...}, ...)` fires once per request to `/auth/magic-link`. |
| T-0013-121 | Negative | `POST /auth/magic-link` does NOT return 410 Gone or any other non-200 success — the route is `@deprecated`, not removed. |
| T-0013-139 | Failure | **P1-5 deprecation + invalid body:** `POST /auth/magic-link` with an invalid body (missing `email`, or malformed `email`) → Zod rejects with 400 `invalid_input`. **Ordering pinned:** the deprecation `logger.warn({event: 'magic_link_deprecated_route_hit', ...})` fires **BEFORE** the Zod validation (the warn is a route-entry tap, independent of input validity). Asserts via captured pino transport that both lines appear, with the warn line preceding the 400 response in the request's log scope. |

#### Step 4 Test Summary

| Category | Count |
| --- | --- |
| Happy | 1 |
| Failure | 1 |
| Regression | 2 |
| Negative | 1 |
| **Total Step 4** | **5** |

**Step 4 happy/failure ratio:** 1 failure : 1 happy = 1.0:1 (passes hard rule).

### Step 5 Tests — Observability + reviewer notes

| ID | Category | Test Description |
| --- | --- | --- |
| T-0013-122 | Happy | `telemetry.write('auth.siwa_sign_in_succeeded', {provider: 'apple'})` is accepted by the whitelist (does not throw `EventNotWhitelistedError`). |
| T-0013-123 | Happy | `telemetry.write('auth.siwa_sign_in_failed', {provider: 'apple', failure_code: 'audience_mismatch'})` is accepted. |
| T-0013-124 | Happy | `telemetry.write('auth.siwa_token_validation_failed', {provider: 'apple', failure_code: 'kid_unknown'})` is accepted. |
| T-0013-125 | Negative | `telemetry.write('auth.siwa_sign_in_succeeded', {provider: 'apple', email: 'leak@example.com'})` is REJECTED (payload-field whitelist violation — email not in the allowed key set for this event). |
| T-0013-126 | Negative | `telemetry.write('auth.siwa_sign_in_succeeded', {provider: 'apple', sub: 'apple-sub'})` is REJECTED. |
| T-0013-127 | Negative | `telemetry.write('auth.siwa_sign_in_succeeded', {provider: 'apple', identity_token: '...'})` is REJECTED. |
| T-0013-128 | Regression | With `EVAL_MODE='true'`, `telemetry.write` still validates the SIWA events' payload whitelist but skips the DB insert (mirrors ADR-0007 §EVAL_MODE behavior for other events). |
| T-0013-129 | Happy | `docs/product/canvas-v0-reviewer-notes.md` contains the substring "Sign in with Apple" in its Auth section (string-search test at the docs-lint layer if one exists; otherwise PR-review assertion). |
| T-0013-140 | Failure | **P1-7 route-layer telemetry call under EVAL_MODE=true:** integration-style test. With `EVAL_MODE=true` set, a happy-path `POST /auth/apple` request completes successfully and the route handler **still calls** `telemetry.write('auth.siwa_sign_in_succeeded', {provider: 'apple'})`. The `telemetry.write` function validates the payload against the whitelist (no throw) and then **short-circuits the DB insert** per ADR-0007 §EVAL_MODE. Distinguishes the wrong-but-passing case ("route skipped the call entirely") from the correct case ("route called; `write` validated then skipped persistence"). Asserted by spying on `telemetry.write` (called once with the expected payload) AND asserting zero rows in the `telemetry_events` table after the request. |
| T-0013-141 | Failure | **P1-7 missing `failure_code`:** `telemetry.write('auth.siwa_sign_in_failed', {provider: 'apple'})` — payload omits `failure_code` entirely. **Spec-pin: `failure_code` is OPTIONAL in the whitelist for `auth.siwa_sign_in_failed` and `auth.siwa_token_validation_failed`** (so that an unknown-cause failure can still be telemetered without forcing a synthetic code). The whitelist for these two event types must explicitly declare `failure_code` as an optional key. Assert: the call succeeds (no `EventNotWhitelistedError`, no payload-validation throw). Sibling assertion: calling with an UNKNOWN failure_code value (`{failure_code: 'made_up_code'}`) IS rejected — the optional field, when present, must be one of the `AppleIdentityErrorCode` union values. |

#### Step 5 Test Summary

| Category | Count |
| --- | --- |
| Happy | 4 |
| Failure | 2 |
| Negative | 3 |
| Regression | 1 |
| **Total Step 5** | **10** |

**Step 5 happy/failure ratio:** 2 failure + 3 negative = 5 failure-class tests : 4 happy = **1.25:1** (passes hard rule; closes P1-7). Negative tests count as failure-class for ratio purposes per the project's convention.

### Test Totals

| Step | New | Regression | Total |
| --- | --- | --- | --- |
| 1 | 83 | 6 | 89 |
| 2 | 31 | 1 | 32 |
| 3 | 4 | 1 | 5 |
| 4 | 3 | 2 | 5 |
| 5 | 9 | 1 | 10 |
| **Total** | **130** | **11** | **141** |

**Per-step ratios after R1 revisions:**

| Step | Failure-class | Happy | Ratio | Passes hard rule? |
| --- | --- | --- | --- | --- |
| 1 | 32 (+ 12 security + 8 config-exh + 3 concurrency + 8 boundary) | 20 | 1.6:1 | Yes |
| 2 | 12 (+ 2 security + 6 config-exh + 2 boundary) | 9 | 1.33:1 | Yes (Boundary=2 — closes P1-4) |
| 3 | 1 | 3 | 0.33:1 | N/A by design (configuration step; see Step 3 N/A justification) |
| 4 | 1 (+ 1 negative + 2 regression) | 1 | 1.0:1 | Yes |
| 5 | 2 (+ 3 negative) | 4 | 1.25:1 | Yes (closes P1-7) |

### Test Helpers & Mocks

- **`testHelpers/appleJwks.ts`** (new in `services/api`) — generates
  an RS256 keypair + serves a fake JWKS endpoint via `nock` or
  `msw`. Issues signed test tokens with arbitrary claim shapes for
  T-0013-001..024. Includes a `mintToken({sub, email, exp, iss, aud,
  kid, signWith})` helper.
- **Mock `apple-signin-auth` (or chosen lib) in `appleIdentity.test.ts`**
  only for the JWKS-unreachable case (T-0013-020, T-0013-021); other
  tests use the real lib pointed at the fake JWKS.
- **`testHelpers/mockExpoAppleAuthentication.ts`** (new in
  `apps/mobile`) — Jest mock factory exposing `signInAsync` with
  resolve/reject programmability.
- **`__resetAuthProviderCacheForTests`** in
  `getAuthProvider.ts` — already noted in Step 2 acceptance.
- **Captured pino transport** for log assertions: same pattern as
  `services/api/src/lib/auth.test.ts` uses today (T-0001-025
  pattern).
- **Drizzle migration test environment** — testcontainers pattern
  already used in `schema.test.ts`; T-0013-079..085 reuse.

### Coverage Gates

- **`services/api/src/lib/appleIdentity.ts` — coverage gate ≥95%
  line coverage (raised from the project's standard ≥90% per P2-4).**
  Rationale: this file is the auth-boundary token-validation surface;
  every uncovered branch is a potential auth bypass. Higher gate is
  justified by the security-criticality of the file.
- All other new files in `services/api/src/lib/auth.ts` (extensions),
  `services/api/src/services/*.ts` (extensions),
  `services/api/src/routes/auth.ts` (extensions) must hit ≥**90% line
  coverage** (matches the project's existing `services/api` coverage
  gate).
- All new files in `apps/mobile/src/lib/auth/` must hit ≥**85% line
  coverage** (matches the project's existing `apps/mobile` gate).
- The token-validation library boundary is the worst place for a
  coverage gap — explicit re-assertion that every
  `AppleIdentityErrorCode` value is exercised (T-0013-052..059 + T-
  0013-004..023). Roz reviews this.

### Cross-References

- **ADR-0011 T-0011-148** vs ADR-0013 §Decision 6 `siwaProvider`
  contract: ADR-0011's stubbed `signInWithApple()` is replaced by
  ADR-0013's real `siwaProvider.signIn()`; the `AuthProvider`
  interface in ADR-0013 §Step 2 is the firm contract.
- **ADR-0011 T-0011-155..159** (env-flag config exhaustion at the
  integration layer — `SignInScreen.test.tsx` with stubbed
  `signInWithApple`) vs **ADR-0013 T-0013-089..094** (env-flag
  config exhaustion at the unit layer —
  `getAuthProvider.test.ts` with the real dispatcher): **behavioral
  overlap is intentional.** Different test layers (integration vs
  unit) catch different defect classes. Both are retained. P2-3.
- **ADR-0011 §Decision 9** ("the button's `onPress` is swapped") vs
  ADR-0013 §Decision 6 (parse-once-at-module-load in
  `getAuthProvider()`): ADR-0013's parse-once pattern is the
  authoritative implementation; ADR-0011's earlier
  "parse-on-onPress" description is superseded. No T-ID collision —
  Roz verified at R1 cross-ADR consistency check.
- **canvas-v0.md §API Contracts line 521**: response shape
  `{access_token, refresh_token, user: {id, display_name}}` —
  ADR-0013 (post-R1) honors `Excludes: raw email` verbatim. See
  P0-1, T-0013-130, and the §Data Sensitivity table row for
  `(route response)`.

## UX Requirements (if applicable)

The visual surface is owned by ADR-0011 Step 7 (SignInScreen). This
ADR contributes:

- **Button copy:** "Sign in with Apple" when
  `EXPO_PUBLIC_AUTH_PROVIDER=apple`. The button uses Apple's official
  styling guidelines (white-on-black or black-on-white per stance —
  Sable's existing component honors this). Apple's HIG mandates the
  Apple logo glyph on the button; `expo-apple-authentication` ships
  the `AppleAuthenticationButton` component that handles this, but
  we use our **own** Button component to keep design-system
  consistency (Apple's rules permit a custom button so long as the
  logo + "Sign in with Apple" wording are present).
- **Cancellation behavior:** When the user dismisses the Apple
  consent sheet, the SignInScreen stays mounted with NO toast and NO
  visual change. T-0013-110 enforces this — the user-initiated
  dismissal is not a "failure" UX state.
- **First-sign-in name capture:** If Apple emits a `fullName`
  (only happens on first user-grant), it's sent to the server. The
  user does NOT see a "set your name" screen — the name is captured
  silently. (Future Settings sheet rename UX is V0.5.)

## Data Sensitivity (if stores involved)

| Store Method | Returns | Sensitivity |
| --- | --- | --- |
| `findOrCreateByAppleSub(db, appleSub, email, displayName?)` | `{id, email, createdAt}` (the existing `MirroredUser` shape) | **auth-only** — called only by the SIWA route handler. Excludes `appleUserId`, `displayName`, `appleRefreshAt`. The route serializes **only** `{id, display_name}` (NOT email — see P0-1 / `canvas-v0.md` §API Contracts) under `user` to the client; the SIWA route is the only place `display_name` ever crosses the route boundary. |
| `findOrCreate` (magic-link, existing) | `{id, email, createdAt}` | **auth-only** — unchanged. |
| `verifyAppleIdentityToken(token)` | `{sub, email, emailVerified, isPrivateEmail}` | **auth-only** — never reaches a route response. Used by the SIWA route handler then discarded. Apple `sub` MUST NOT leak to any response or log line. |
| `issueLocalJwtForUser(user)` | `{accessToken, refreshToken, expiresIn}` | **auth-only at the function boundary; public-safe at the route response.** The two tokens are the entire authentication exchange with the client; nothing else from the user record is included. |
| `apple_refresh_tokens` row read (for refresh) | `{userId, tokenHash, expiresAt, revokedAt}` | **auth-only** — never serialized to a response. Token plaintext is never persisted; only the sha256 is. |
| `users` row select (any caller) | `{id, email, createdAt, handle}` (existing) | **auth-only** — unchanged. `apple_user_id` and `display_name` are NEW columns; existing `users.select(...)` patterns DO NOT include them by default. Any caller that wants the new fields must opt in explicitly. |

**Apple Relay email handling — the load-bearing rule:** an email
ending in `@privaterelay.appleid.com` is stored verbatim, **NOT
returned in any response body** (per P0-1), and **never logged at
any level**. The `safeMessage` wrapper at the route boundary handles
INFO log hygiene; T-0013-033 (service-layer non-log) and T-0013-063
(route-layer non-log) enforce that no log line contains the raw
email. (Earlier drafts referenced T-0013-073 here — T-0013-073
actually covers `APPLE_SIWA_CLIENT_ID` whitespace rejection, not log
hygiene; the reference has been corrected.)

## CI/CD Impact

| Job | Config File | Impact | Required Change |
| --- | --- | --- | --- |
| `services/api` unit + integration tests | `.github/workflows/api-tests.yml` (or local equivalent) | New env vars (`APPLE_SIWA_*`) needed for non-test envs only; test mode relaxes them | None — `env.ts` already handles the `nodeEnv === 'test' ? optionalNonEmpty : requiredString` split. |
| `apps/mobile` unit tests | `.github/workflows/mobile-tests.yml` | New mock for `expo-apple-authentication` | Covered as Step 2 AC #10 (hard acceptance criterion); the `jest.config.js` `moduleNameMapper` entry is part of the PR. Promoted from a CI-Impact row to an AC item per R1. |
| Eval-mode CI gate (ADR-0010) | `.github/workflows/eval-gate.yml` | Three new telemetry event types in the whitelist; eval-mode short-circuit must still suppress them | Already covered by ADR-0007's `EVAL_MODE` wiring; T-0013-128 explicitly asserts. |
| EAS Build (production profile) | `eas.json` | New env var `EXPO_PUBLIC_AUTH_PROVIDER=apple` for production; `.p8` private key stored in EAS Secrets | Step 3 of this ADR is the change. DevOps (Eva) confirms in Step 1 PR. |
| Migration check (Drizzle) | `services/api/scripts/check-migrations.ts` (or equivalent) | New migration `0010_apple_siwa.sql` must apply cleanly | T-0013-079..085 explicitly cover. |

## Documentation Impact

| Doc | Path | What Changes |
| --- | --- | --- |
| ADR Index | `.claude/references/adr-index.md` | Ellis inserts the ADR-0013 row (this ADR is on docs-only, no overlap). |
| Canvas V0 spec (§API Contracts) | `docs/product/canvas-v0.md` | No edit required — ADR-0013 (post-R1) now honors the existing canvas-v0.md §API Contracts line 521 response shape (`Excludes: raw email`). The earlier ADR-0013 draft conflicted with this line by returning `user.email`; the R1 revision drops `email` from the response and the conflict is closed. This row documents alignment with the binding product spec; no change to canvas-v0.md itself. |
| Architecture | `ARCHITECTURE.md` | §5 (Users / Auth) gets a one-paragraph paragraph noting SIWA as the V0 auth source; magic-link is `@deprecated`. Ellis on follow-up commit. |
| CLAUDE.md | `CLAUDE.md` | §3 (LLM call pattern) is unaffected. §0 conventions section — no change. A new section §1.5 ("Auth provider dispatch — `getAuthProvider()`") may be added by Ellis to anchor the dispatcher pattern for future V0.5 providers. Not a blocker for this ADR. |
| Reviewer Notes | `docs/product/canvas-v0-reviewer-notes.md` | Step 5 updates the Auth section. |
| ADR-0001 frontmatter | `docs/adrs/ADR-0001-foundation.md` | Add a "Status: Accepted (magic-link path deprecated by ADR-0013 PR 5)" note. Ellis on follow-up. |
| ADR-0011 cross-refs | `docs/adrs/ADR-0011-mobile-v0-shells-and-schema-rename.md` | Already cross-refs ADR-0013 throughout. After ADR-0013 lands, Ellis updates the "ADR-0013 — Sign in with Apple (deferred)" section to "Sign in with Apple (accepted)". |

## Notes for Colby

- **Read CLAUDE.md §3 and §6 before starting.** The "JWT issuance via
  Supabase JWT secret" rule and "401 body shape exactly
  `{error: 'unauthorized'}`" rule are both relevant — don't be
  tempted to leak `AppleIdentityErrorCode` values to the client. The
  one exception is `expired` → 401 with `detail: 'token_expired'`,
  which is the only failure the client can usefully retry on.
- **The token-validation library choice is `apple-signin-auth` (or
  `verify-apple-id-token` — pick after a 30-minute eval). Whichever
  you pick, pin the exact version in `package.json` and note the
  decision in the PR description.** Don't hand-roll. Don't write
  JWKS-fetch logic yourself.
- **`narrowPayload` (existing) and `verifyAppleIdentityToken` (new)
  are independent paths — they validate different JWTs from different
  issuers.** Don't try to share code between them.
- **`findOrCreateByAppleSub` is a COPY of `findOrCreate` with a
  different unique key. NOT a refactor.** Resist the urge to merge
  them; they have different semantics for the email-on-conflict
  contract and different unique keys. Keep them parallel.
- **Apple emits `email` and `fullName` only on first user-grant.**
  Apps cannot trigger re-emission. Treat second-and-later
  sign-ins as having neither. Don't try to "refresh" the user's
  email or name from Apple — there's no API for it.
- **The `apple_refresh_tokens` table is new infrastructure.** When
  the user signs out (existing `signOut()` flow in
  `SessionProvider`), the refresh-token row in this table must be
  marked `revoked_at = now()`. Add this as a follow-up T-ID if you
  realize it's missing from this spec — I haven't enumerated the
  full refresh path because it's a future Step (V0.5).
  For V0: refresh tokens are issued, persisted hashed, but the
  `POST /auth/refresh` endpoint is **out of scope** of this ADR. The
  M1 path uses Supabase's refresh; SIWA in this ADR issues but does
  not consume refresh tokens. **This is OK** because the
  `accessToken` lifetime is 1h and active users will simply re-sign-
  in if they're away longer; V0.5 implements `/auth/refresh` for the
  SIWA flow.
- **Apple Relay alias emails must be treated as opaque.** Don't
  pattern-match them, don't try to "resolve" them. Store the string
  Apple gives you. **Do NOT return it in any response body** (the
  `user` field in the SIWA response excludes `email` per P0-1 —
  `canvas-v0.md` §API Contracts). The email is available to the
  client via the JWT claim. T-0013-033, T-0013-063 (and the new
  negative-assertion T-ID added in this revision) are
  non-negotiable.
- **The `displayName` flow is gentle.** Apple emits `fullName` as
  `{givenName, familyName, namePrefix, ...}`. We construct
  `displayName = [givenName, familyName].filter(Boolean).join(' ').trim() || undefined`.
  T-0013-095..097 are explicit. Don't get fancy — no titles, no
  prefixes.
- **The provider dispatcher (`getAuthProvider`) is memoized once at
  module load.** If a test wants to change the env flag mid-suite,
  it MUST call `__resetAuthProviderCacheForTests()`. T-0013-088
  asserts the cache.
- **The magic-link deprecation in Step 4 is NOT a removal.** Don't
  delete the route, don't delete `magicLinkProvider.ts`, don't
  delete `EmailEntrySheet.tsx`. Just add the `@deprecated` annotations
  and the warn log. The removal is a V0.5 cleanup.
- **`expo-apple-authentication` plugin entry in `app.config.ts`** is
  the only `app.config.ts` change. Don't touch anything else there.
  The native module is already in the Expo SDK 50+ dev-client.

## Coordination

- **ADR-0011 Phase 2** (SignIn shell, ADR-0011 Step 7) lands the
  SignInScreen with the provider-agnostic button surface that calls
  a stubbed `signInWithApple()`. ADR-0013 Step 2 replaces that stub
  with the real implementation. If ADR-0011 Phase 2 hasn't landed
  when ADR-0013 starts, Colby coordinates with the ADR-0011 author
  (likely also Colby) on the SignInScreen file's final shape; the
  `getAuthProvider()` API surface in this ADR is the firm contract.
- **ADR-0008 Universal Links** uses the SIWA sign-in round-trip as
  part of its "pending-intent survival" plumbing (ADR-0008 §4 —
  user taps a clone link, gets routed through Sign-In, comes back
  to a queued clone). ADR-0013's PR 1 (the server route) is the
  blocking dependency. Once `POST /auth/apple` works, ADR-0008 can
  pick up; the pending-intent surface is theirs to design.
- **No file overlap with ADR-0008, ADR-0009, or ADR-0010** in
  flight. ADR-0010 may extend the eval harness to grade SIWA-
  related telemetry events; that's a V0.5 follow-up.
- **Ellis** owns `.claude/references/adr-index.md` insertion. Cal
  does not touch the index in this ADR's PR.

---

> ADR-0013 saved (R1 revision applied — addresses Roz REVISE WITH
> NOTES verdict). **5 steps, 141 total tests (130 new + 11
> regression).** Up from 129 at R0 (+12 T-IDs: 3 P0-fix, 2 P1-1, 1
> P1-2 tighten, 2 P1-4, 1 P1-5, 2 P1-7, 1 P2-1, 2 P2-2, 1 P2-5 fold;
> note — some R1 changes edit existing T-IDs in place rather than
> adding new ones). Per-step ratios all pass except Step 3 (thin by
> design with N/A justification documented).
> Next: Roz reviews the test spec.

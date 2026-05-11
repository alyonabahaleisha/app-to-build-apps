# ADR-0008: Universal Links — Canvas V0 Clone Share Flow

_Authored by Cal — 2026-05-10_

## Status

Proposed

## Context

Canvas V0's growth loop is the Universal Link share (`canvas-v0.md` §1.2,
§Success Metrics). AC-P7..P9 are binding:

- **AC-P7** — `https://canvas.app/m/{share_id}/clone` resolves to a clone
  of the spec on iOS.
- **AC-P8** — a clicker's clone lands in *their* namespace, seeded from
  the source spec; the original creator's data is **never** exposed.
- **AC-P9** — `view` and `remix` are reserved in the URL grammar and
  respond gracefully.

ADR-0005 referenced ADR-0008 as a downstream consumer for the cover-art
share record (§K) but never authored the implementation. ADR-0006
(renderer) and ADR-0007 (LLM cutover) shipped without it. Canvas V0 is
closing out; this is the ADR that converts the spec lines into a
buildable contract.

### Forces

1. **Schema-name mismatch is real.** Current DB tables are `projects` /
   `project_versions` (M1 names). V0 spec specifies `mini_app` /
   `mini_app_version`. ADR-0011 (mobile shells + SIWA + rename) is being
   authored in parallel and owns the rename. ADR-0008 writes its
   migrations against the V0 names and declares ADR-0011 as a blocking
   dependency. Without the rename, the migrations in this ADR cannot
   land. See §Dependencies and the "Conflict surfaced" note in
   §Consequences.

2. **AASA file hosting is a security-sensitive deploy artifact.** Wrong
   `Content-Type`, wrong path, or HTTP-not-HTTPS, and iOS silently
   refuses to associate the domain. iOS's failure mode is "the URL opens
   Safari, no errors logged." We need a serving path inside our deploy
   automation, not on a hand-managed static host.

3. **The clone flow crosses an auth boundary.** When iOS launches Canvas
   from a cold tap of a Universal Link, the app may not have a session.
   AC-P8 requires "authenticated Canvas user." So the link-tap intent
   must survive Sign-In with Apple (ADR-0011's surface). The pending
   intent is a per-device piece of state that lives across an OS-level
   process restart and a SIWA round-trip.

4. **Reserved modes are forward-compatibility, not error handling.** A
   `view` or `remix` link is not malformed — it's a feature we haven't
   shipped. Friends who hold these links today must see a "coming soon"
   surface, not a 404 or a generic error. The URL grammar is part of
   the V0 contract with future V0.5.

5. **Web install-gate page is deferred.** The UX doc describes a
   substantial web surface (Open Graph cover-art PNG rendering,
   Branch SDK deferred-deep-link, install gate page). It's V0.5
   engineering (see §Out of Scope and the per-step deferral notes).
   ADR-0008 ships the iOS clone path; uninstalled-friends-see-App-Store
   is the fallback iOS provides for free when AASA association is set
   up correctly.

### If we do nothing

V0 doesn't ship its growth loop. AC-P7..P9 are not met. The "share rate
≥25%" headline KPI is unmeasurable.

---

## Decision

Ship the iOS-side Universal Link clone flow in 7 implementation steps:

1. **Schema** — add `share_link` and `share_link_clone` tables. Per
   ADR-0005 §K, the share-link row carries the immutable cover-art
   identity (`cover_stance`, `cover_palette`, `cover_icon`,
   `cover_art_seed`). Includes a nullable `revoked_at` column for
   V0.5-without-migration revocation. Foreign-key to `mini_app_versions`
   (immutable source; the share record points at the version that was
   current at share time).
2. **AASA file** — served by the API service itself at
   `https://canvas.app/.well-known/apple-app-site-association` via a
   Fastify route (in-process, not static-file middleware) with
   `Content-Type: application/json`. Path closure `["/m/*"]`, appID
   `TEAMID.com.appcreator.mvp`. Build-time validation runs in CI.
3. **Server endpoints** — `POST /mini-apps/:id/share`,
   `GET /share-links/:share_id` (lookup, returns mode capability without
   leaking source identifiers), `POST /mini-apps/clone {share_id}`,
   reserved-mode handlers, full owner/auth/rate-limit policy.
4. **iOS entitlement + Linking surface** — `associatedDomains:
   ['applinks:canvas.app']` in `app.config.ts`. Top-level
   `useUniversalLink()` hook parsing `/m/:share_id/:mode` from
   `Linking.getInitialURL()` and `Linking.addEventListener('url', ...)`.
5. **Pending-intent persistence** — `pendingClone` module backed by
   `expo-secure-store`. Captures the share intent before SIWA, replays
   it after sign-in. ADR-0011 owns the SIWA flow; ADR-0008 owns the
   pre/post-SIWA intent persistence and replay.
6. **Share affordance + clone landing UX** — wires Sable's meatball →
   Share copy-link flow (host chrome, Run mode) and the celebration
   sheet for friend-side clone-completion. Coachmark + telemetry
   integration. The screen-level UX surface is owned by ADR-0011's host
   shell; ADR-0008 ships the action-level contracts (`createShareLink`,
   `acceptCloneIntent`) the host shell calls.
7. **Tests** — integration tests for the full happy path, reserved-mode
   gracefulness, AASA file validity, idempotency, source-data-leak
   guards, and telemetry whitelist additions.

### Key positions taken

**AASA served by the Fastify API, not a separate static host.** The
AASA file is 200 bytes of JSON, must serve from the apex of `canvas.app`,
and is the load-bearing artifact for AC-P7. Inside the API: deploy
automation already in place, env-aware (production-only path filter is
trivial), TLS terminated upstream, and the file's contents can be
asserted in a unit test against the route handler. Putting it in a
separate Cloudflare/Vercel static site adds a second deploy surface for
one file. Confirms when the next deploy of `canvas.app` is also `services/api`
(per Brief §2.8); if marketing later wants a marketing site at the same
apex, the AASA stays under API control via path-based routing at the
load balancer.

**Share ID = 24-char base62 ksuid.** ADR-0005 §K already locked this.
ksuid is sortable, opaque, non-enumerable, and collision-resistant
without a uniqueness pre-check. We use the `ksuid` npm package
(MIT-licensed; ~5KB).

**Separate `share_link` table, not a column on `mini_apps`.** A version
can have many share-links over time (each rename-or-republish could
mint a new one in V0.5). Revocation must work without a schema
migration. The share-link is the social object — its lifecycle is
distinct from the mini_app's.

**Clone idempotency = same user revisiting their existing clone.**
First tap creates the clone; subsequent taps by the same authed user
navigate to the existing clone. Tracked via `share_link_clone` lookup
table on `(share_link_id, cloner_user_id)` unique constraint. Why:
without this, friends who tap a link twice get two cloned tools in
their Library, which makes Library a junk drawer and breaks the
"second-session return" KPI measurement.

**Reserved modes return 200 with a structured response, not 410.** A
`view` or `remix` URL is not "gone." It's "valid, not yet supported."
The mobile app shows a "coming soon" screen with the source tool's
identity. 410 is the wrong status code for a forward-compatibility
reservation; 410 means "this resource intentionally does not exist."

**Cover art seed on clone is NEW.** Per AC-P4, the cover_art_seed is
immutable per mini_app row, and per ADR-0005 §K, the share record
freezes the source's cover identity for the install-gate page. The
cloner's mini_app is a *different row*, so it gets its own seed
generated at clone time. The friend's iMessage preview shows the
source's frozen identity (from the share record); the friend's Library
card shows their own clone's fresh identity. UX intent (§K rationale)
is preserved.

**Web install-gate page is out of scope for ADR-0008.** That's a static
web app with SSR cover-art PNG rendering, Open Graph metadata, and
Branch SDK plumbing — a separate engineering project. iOS's AASA
fallback (when the app isn't installed, the link opens Safari to the
literal URL) is acceptable for V0. The Safari path will hit a server
404 until the install-gate page is built; that's V0.5 territory. The
schema and server contracts in ADR-0008 are designed so the
install-gate page can attach later without a re-architect.

---

## Alternatives Considered

### Alternative 1: Host AASA on a separate static site (Cloudflare Pages / Vercel)

- **Upside:** Decoupled from API deploy cadence; if the API has a brief
  outage the AASA file stays served; CDN edge caching is automatic.
- **Downside:** Two deploy surfaces for one 200-byte file. Adds an
  external dependency to the iOS-side onboarding path. CI must verify
  parity (file contents match what the API expects). When the team ID
  rotates or bundle ID changes, two places must update.
- **Why not:** AASA at V0 is one file, one shape, one consumer (iOS).
  Premature decoupling. If outage tolerance becomes a real need, we
  promote the file to a CDN later — the contents are the same, the URL
  is the same, the migration is "change the load-balancer rule."

### Alternative 2: Use a custom URL scheme (`canvas://`) instead of Universal Links

- **Upside:** Already proven in M1 (`appcreator://auth?token=...` —
  `apps/mobile/src/lib/deepLink.ts`). No AASA needed. No domain
  ownership question.
- **Downside:** Custom schemes don't survive iMessage's link sniffing
  ("scam link" warnings, hover preview shows the raw scheme), don't get
  rich previews, can't be tapped from a web page. The brief and UX both
  specifically call out Universal Links for the iMessage UX. Custom
  schemes are an internal-tools transport, not a viral share transport.
- **Why not:** The growth loop explicitly depends on a friend tapping a
  link in iMessage that looks like a real URL. Custom schemes are a
  product step backward.

### Alternative 3: Each tap of a clone link creates a new clone (no idempotency)

- **Upside:** Simpler — no `share_link_clone` lookup table; clone is a
  pure function of `(share_id, cloner_user_id, timestamp)`.
- **Downside:** A friend who taps the link twice (e.g., to "show
  someone") gets two cloned tools in their Library. Confusing. The
  second-session return KPI gets diluted: which clone did the friend
  return to?
- **Why not:** The product intent is "the friend's tool lives in their
  Library." One source link → one tool. The data model needs to encode
  that.

**Note on two-share-links / same-source-version (P2-2):** the
idempotency unique constraint is `(share_link_id, cloner_user_id)`,
NOT `(cloner_user_id, source_mini_app_version_id)`. So if owner B
creates `share_link_A` and `share_link_B` for the SAME `mini_app_version`,
and friend A clones both, A's Library gets two independent clones
(different `cover_art_seed`s, different `mini_app.id`s). This is by
design — each share_link is its own social object with its own
provenance (who shared it, when, in what context). Collapsing across
share_links would let B's two distinct social acts merge into one
artifact in A's Library, which loses information A may care about
(e.g., "the link Alice sent me" vs "the link Bob sent me, who also
got it from Alice"). T-0008-087d pins this behavior. If V0.5 wants
cross-share-link dedup, it ships a separate "you already cloned this
tool — open existing?" prompt at the UX layer, not by changing the
DB constraint.

### Alternative 4: 410 for reserved modes; 404 for unknown modes

- **Upside:** Distinguishes "reserved future feature" from "typo in URL"
  via HTTP semantics.
- **Downside:** 410 means "permanently gone, do not retry." Reserved
  modes are explicitly the opposite — "coming, retry later when you
  update the app." Cache layers (CDNs, browsers) treat 410 differently
  from 200 with a structured body.
- **Why not:** Reserved-mode is a feature gate, not a tombstone. 200
  with `{mode, supported: false}` is the right shape.

### Alternative 5: Persist pending-intent in MMKV instead of `expo-secure-store`

- **Upside:** Faster reads (synchronous); MMKV is the M1 default for
  non-secret persistence.
- **Downside:** CLAUDE.md §11 forbids MMKV/AsyncStorage for anything
  that's effectively a token-like resume-the-session payload. The
  pending-clone intent isn't a session token, but it *grants access on
  the next sign-in* — same threat model. Secure-store is the right
  store.
- **Why not:** Defensive default. The share_id itself isn't sensitive,
  but the *paired* intent ("clone this on the next successful sign-in")
  is a one-time capability grant. Defense in depth.

---

## Consequences

### Positive

- AC-P7..P9 fully addressed by buildable contracts.
- Share-link table is forward-compatible with V0.5 features (revocation
  via `revoked_at`; view/remix mode handlers stubbed; install-gate page
  joins via `share_id`).
- AASA hosting is in the API team's blast radius — one deploy surface,
  one set of secrets, one CI job.
- Source creator's data is structurally inaccessible to the cloner.
  The clone server path doesn't expose `source_mini_app_id` or
  `source_owner_id` to the response, ever.
- Reserved modes work today as "coming soon" surfaces — when V0.5 ships
  view/remix, existing links light up automatically.

### Negative

- **Blocked on ADR-0011 (`mini_app` rename + SIWA flow).** ADR-0008's
  migrations cannot land until the V0 schema rename does. ADR-0011 is
  being authored in parallel; the working assumption is that ADR-0011
  lands before ADR-0008's Step 1 begins. If ADR-0011 slips, ADR-0008's
  Step 1 must adapt to current `projects` table names or wait. See
  §Conflict surfaced.
- **App Store Connect capability change required.** The Associated
  Domains entitlement requires a new dev-client build (capability
  changes). DevOps must add `Associated Domains` to the App ID in App
  Store Connect before the first TestFlight build can ship with this
  ADR. Lead time: ~1 day, no engineering cost, but Eva needs to know.
- **Per-device intent persistence is a new mobile surface.** The
  `pendingClone` module is small but introduces a class of bugs
  (intent leaked between accounts on the same device; intent retained
  across sign-out → sign-in-as-different-user). Test spec covers these
  explicitly.
- **Domain ownership is a hard dependency.** §0 risk in canvas-v0.md
  lists this as TBD. If `canvas.app` isn't actually owned by the
  project, AASA can't be served and AC-P7 fails. PM/DevOps owns this;
  ADR-0008 cannot make it true.

### Risks

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| AASA file fails iOS validation silently | Medium | Build-time JSON-shape test + a runtime smoke that fetches the AASA from the deployed API and asserts Content-Type, body shape, and appID match. Eva runs this in the post-deploy smoke. |
| Pending-clone intent grants cross-account access (signs out, signs in as different user, clone happens) | Low | Clear `pendingClone` on sign-out (CLAUDE.md §11's secure-store contract). Test T-0008-072. |
| Same-link-twice creates two clones due to race | Low-Medium | Unique constraint on `share_link_clones (share_link_id, cloner_user_id)` enforces idempotency at the DB layer. Test T-0008-061. |
| `share_id` leak (predictable IDs) | Very Low | ksuid is opaque and non-enumerable by construction. T-0008-040 asserts no sequential pattern across 1000 generated ids. |
| Source creator's `user_id` leaks via clone response | Medium-by-default | Explicit `auth-only`/`public-safe` table per §Data Sensitivity; serialization tests T-0008-085..087 assert the cloner-facing response never contains source identifiers. |
| Domain `canvas.app` not owned by the project | Medium | PM/DevOps owns; out of ADR-0008 scope. ADR is blocked on §Dependencies confirming. |

### Conflict surfaced

**Current schema uses `projects` / `project_versions` (M1 names) and is
on `agent/M2-VS-01` branch.** Canvas V0 (AC-P1, ADR-0005, ADR-0006,
ADR-0007) consistently specifies `mini_app` / `mini_app_version`. The
rename has not landed. ADR-0011 (in flight) owns the rename and the
SIWA migration.

**Resolution path:** ADR-0008 writes against the V0 names. ADR-0011 is
declared a blocking dependency in §Dependencies. ADR-0008's Step 1
migration files reference `mini_apps(id)` and `mini_app_versions(id)`;
they will fail to apply against the current schema. This is intentional
— it forces the dependency order to be honored.

**If ADR-0011 slips past ADR-0008's planned start:** ADR-0008 holds.
Do not retrofit ADR-0008 to write against `projects`. Two sets of
migrations for two table names would compound the cleanup work later.
Eng Lead surfaces to Sponsor if the slip is >1 week.

---

## Implementation Plan

### Step 1: `share_link` + `share_link_clone` schema

**Files to create/modify:**

- `services/api/src/db/schema.ts` — add `shareLinks` and
  `shareLinkClones` table definitions.
- `services/api/migrations/0008_share_links.sql` — new migration.
- `services/api/src/db/index.ts` — re-export new tables.

**Code shape (Drizzle):**

```ts
// services/api/src/db/schema.ts
export const shareLinks = pgTable(
  'share_links',
  {
    // 24-char base62 ksuid, generated app-side via the ksuid npm package.
    // PRIMARY KEY because it's the public identifier in the URL.
    shareId: text('share_id').primaryKey(),
    // FK to mini_app_versions (immutable source — share captures a
    // specific version, not the mutable mini_app pointer).
    miniAppVersionId: uuid('mini_app_version_id')
      .notNull()
      .references(() => miniAppVersions.id, {onDelete: 'cascade'}),
    // Owner — for owner-only revoke (V0.5). Stored now so revoke
    // doesn't need to JOIN through versions.
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, {onDelete: 'cascade'}),
    // Cover-art identity frozen at first share — ADR-0005 §K.
    coverStance: text('cover_stance').notNull(),
    coverPalette: text('cover_palette').notNull(),
    coverIcon: text('cover_icon').notNull(),
    coverArtSeed: text('cover_art_seed').notNull(),
    createdAt: timestamp('created_at', {withTimezone: true})
      .notNull()
      .defaultNow(),
    // V0.5 revocation: nullable; never written in V0.
    revokedAt: timestamp('revoked_at', {withTimezone: true}),
  },
  t => ({
    ownerIdx: index('share_links_owner_idx').on(t.ownerUserId),
    versionIdx: index('share_links_version_idx').on(t.miniAppVersionId),
  }),
)

export const shareLinkClones = pgTable(
  'share_link_clones',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shareLinkId: text('share_link_id')
      .notNull()
      .references(() => shareLinks.shareId, {onDelete: 'cascade'}),
    clonerUserId: uuid('cloner_user_id')
      .notNull()
      .references(() => users.id, {onDelete: 'cascade'}),
    // FK to the clone the user created. ON DELETE CASCADE handles
    // a user deleting their clone — the lookup row goes too.
    clonedMiniAppId: uuid('cloned_mini_app_id')
      .notNull()
      .references(() => miniApps.id, {onDelete: 'cascade'}),
    clonedAt: timestamp('cloned_at', {withTimezone: true})
      .notNull()
      .defaultNow(),
  },
  t => ({
    // Idempotency guard — one clone per (link, user).
    uniqueClone: uniqueIndex('share_link_clones_unique_idx').on(
      t.shareLinkId,
      t.clonerUserId,
    ),
  }),
)
```

**SQL migration (sketch):**

```sql
CREATE TABLE IF NOT EXISTS share_links (
  share_id              text        PRIMARY KEY CHECK (length(share_id) = 24),
  mini_app_version_id   uuid        NOT NULL REFERENCES mini_app_versions(id) ON DELETE CASCADE,
  owner_user_id         uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cover_stance          text        NOT NULL CHECK (cover_stance IN ('productive','expressive')),
  cover_palette         text        NOT NULL CHECK (cover_palette IN ('focus','health','money','social','learn','play')),
  cover_icon            text        NOT NULL,
  cover_art_seed        text        NOT NULL CHECK (length(cover_art_seed) = 32),
  created_at            timestamptz NOT NULL DEFAULT NOW(),
  revoked_at            timestamptz
);
CREATE INDEX IF NOT EXISTS share_links_owner_idx ON share_links(owner_user_id);
CREATE INDEX IF NOT EXISTS share_links_version_idx ON share_links(mini_app_version_id);

CREATE TABLE IF NOT EXISTS share_link_clones (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  share_link_id       text        NOT NULL REFERENCES share_links(share_id) ON DELETE CASCADE,
  cloner_user_id      uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cloned_mini_app_id  uuid        NOT NULL REFERENCES mini_apps(id) ON DELETE CASCADE,
  cloned_at           timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (share_link_id, cloner_user_id)
);
```

**Acceptance criteria:**

- Migration applies cleanly against a `mini_apps`-renamed database
  (ADR-0011 must have landed first; otherwise migration fails — by
  design).
- Drizzle `inferSelect`/`inferInsert` types emit for both tables.
- `share_id` PK length CHECK rejects non-24-char inputs.
- Closed-enum CHECKs on `cover_stance` and `cover_palette` reject
  unknown values.
- Unique constraint on `(share_link_id, cloner_user_id)` prevents
  duplicate clone rows under concurrent insert.

**Estimated complexity:** Medium. Schema is small but the FK choreography
and the dependency on ADR-0011's rename require care.

---

### Step 2: AASA file served by the API

**Files to create/modify:**

- `services/api/src/routes/wellKnown.ts` — new route module.
- `services/api/src/server.ts` — register `wellKnownRoutes`.
- `services/api/src/lib/env.ts` — add `APPLE_APP_ID_PREFIX`
  (`TEAMID.com.appcreator.mvp` — env var because it's environment-
  specific). Validate format: `^[A-Z0-9]{10}\.[a-zA-Z0-9.\-]+$`.

**Code shape:**

```ts
// services/api/src/routes/wellKnown.ts
export async function wellKnownRoutes(server: FastifyInstance) {
  server.get(
    '/.well-known/apple-app-site-association',
    {schema: {response: {200: {type: 'object'}}}},
    async (_req, reply) => {
      // AASA file is sensitive only to its shape, not auth — public.
      reply.header('Content-Type', 'application/json')
      // No 'Cache-Control: no-cache' — Apple's CDN scans this; long-cache
      // values are fine but we keep it short for first-deploy iteration.
      reply.header('Cache-Control', 'public, max-age=3600')
      return {
        applinks: {
          apps: [],
          details: [
            {
              appID: env.APPLE_APP_ID_PREFIX,
              paths: ['/m/*'],
            },
          ],
        },
      }
    },
  )
}
```

**Acceptance criteria:**

- `GET /.well-known/apple-app-site-association` returns 200 with
  `Content-Type: application/json` (NOT `application/octet-stream`,
  NOT `text/json`).
- Body is valid JSON with `applinks.details[0].appID` matching
  `APPLE_APP_ID_PREFIX` env var.
- Body's `applinks.details[0].paths` is exactly `['/m/*']` (closed in
  V0 — only one path pattern).
- No auth required (route bypasses any future auth middleware).
- Route is rate-limit-exempt (Apple CDN polls).
- CI test asserts the response shape against a fixture.

**Estimated complexity:** Low.

---

### Step 3: Server endpoints — share creation, lookup, clone, reserved modes

**Files to create/modify:**

- `services/api/src/routes/shareLinks.ts` — new module
  (`POST /mini-apps/:id/share`, `GET /share-links/:share_id`).
- `services/api/src/routes/clones.ts` — new module
  (`POST /mini-apps/clone`).
- `services/api/src/services/shareLinks.ts` — service layer:
  `createShareLink`, `getShareLinkPublicView`,
  `acceptCloneIntent`.
- `services/api/src/server.ts` — register new routes.
- `services/api/src/llm/telemetry.ts` — add event types
  `share_link.created`, `share_link.clone_accepted`,
  `share_link.reserved_mode_viewed`.

**Code shape:**

```ts
// services/api/src/routes/shareLinks.ts

// AC-P7: create a Universal Link for a mini_app the caller owns.
server.post(
  '/mini-apps/:id/share',
  {preHandler: [requireAuth]},
  async (req, reply) => {
    // 10/min per user (AC-N6); 20/min for the global cap.
    const rl = rateLimit(`share.create:${req.user.id}`, 10, 60_000)
    if (!rl.ok) return reply.code(429).send({error: 'rate_limited'})

    const {id} = req.params
    try {
      const result = await shareLinksService.createShareLink({
        miniAppId: id,
        userId: req.user.id,
      })
      // Public-safe shape — share_id + computed URL only.
      return reply.code(201).send({
        share_id: result.shareId,
        universal_link: `https://canvas.app/m/${result.shareId}/clone`,
      })
    } catch (err) {
      if (err instanceof NotFoundError) return reply.code(404).send({error: 'not_found'})
      if (err instanceof ForbiddenError) return reply.code(403).send({error: 'forbidden'})
      req.log.error({err: safeMessage(err)}, 'share_create_failed')
      return reply.code(500).send({error: 'internal'})
    }
  },
)

// AC-P9: graceful response for view/remix; 200 with capability flag.
server.get(
  '/share-links/:share_id',
  {preHandler: [requireAuth]}, // auth required — we don't expose share lookup to anonymous callers
  async (req, reply) => {
    const {share_id} = req.params
    const link = await shareLinksService.getShareLinkPublicView(share_id)
    if (!link) return reply.code(404).send({error: 'share_not_found'})
    return reply.code(200).send({
      // Public-safe — NEVER include source_mini_app_id, source_owner_id,
      // mini_app_version_id, spec_json.
      share_id: link.shareId,
      cover_stance: link.coverStance,
      cover_palette: link.coverPalette,
      cover_icon: link.coverIcon,
      cover_art_seed: link.coverArtSeed,
      modes: {
        clone: {supported: true},
        view: {supported: false, reason: 'reserved_for_future_version'},
        remix: {supported: false, reason: 'reserved_for_future_version'},
      },
    })
  },
)

// services/api/src/routes/clones.ts
server.post(
  '/mini-apps/clone',
  {
    preHandler: [requireAuth],
    schema: {body: {type: 'object', required: ['share_id'], properties: {
      share_id: {type: 'string', minLength: 24, maxLength: 24},
    }}},
  },
  async (req, reply) => {
    const rl = rateLimit(`clone:${req.user.id}`, 10, 60_000)
    if (!rl.ok) return reply.code(429).send({error: 'rate_limited'})

    const {share_id} = req.body
    try {
      const result = await shareLinksService.acceptCloneIntent({
        shareId: share_id,
        clonerUserId: req.user.id,
      })
      // Idempotent: returns existing clone if user has cloned this link before.
      return reply.code(result.created ? 201 : 200).send({
        mini_app: result.miniApp, // public-safe shape (no source identifiers)
        current_version: result.currentVersion,
      })
    } catch (err) {
      if (err instanceof ShareNotFoundError) return reply.code(404).send({error: 'share_not_found'})
      if (err instanceof RevokedError) return reply.code(410).send({error: 'share_revoked'})
      req.log.error({err: safeMessage(err)}, 'clone_failed')
      return reply.code(500).send({error: 'internal'})
    }
  },
)
```

**Service-layer contract (key invariant for AC-P8):**

```ts
// services/api/src/services/shareLinks.ts
export async function acceptCloneIntent(input: {
  shareId: string
  clonerUserId: string
}): Promise<{mini_app: PublicMiniApp; current_version: PublicVersion; created: boolean}> {
  // 1. Resolve share_link → mini_app_version (INTERNAL ONLY; not in response).
  //    Throws ShareNotFoundError if not found; throws RevokedError if revoked_at set.
  // 2. Check share_link_clones for existing (shareId, clonerUserId) — if found,
  //    return the stored mini_app + version (idempotency; created: false).
  //    No transaction needed for the read path — single SELECT.
  //
  // 3–5. Transactional write — steps 3, 4, 5 MUST execute inside one
  //    db.transaction(...) call. Any failure (DB error, FK violation, unique-
  //    constraint conflict, mid-transaction crash) rolls back ALL three
  //    inserts atomically. Without this boundary, a partial write (mini_app
  //    inserted, share_link_clones insert fails) leaves an orphan row AND
  //    breaks idempotency on the next call — a second clone request would
  //    INSERT another mini_app because the unique-key row was never written.
  //
  //    Pattern (Drizzle — matches projects.service.ts create() at line 186):
  //
  //    return await db.transaction(async tx => {
  //      // 3. INSERT mini_app
  //      const [miniAppRow] = await tx.insert(miniApps).values({
  //        ownerUserId: clonerUserId,
  //        title,                         // see AC: 'Shared tool' fallback for clones
  //        coverArtSeed: freshSeed,       // NEW 32-char hex — clone gets fresh identity
  //        // source_mini_app_id intentionally NOT persisted (AC-P8)
  //      }).returning()
  //      if (!miniAppRow) throw new Error('mini_apps insert returned no row')
  //
  //      // 4. INSERT mini_app_version (spec_json copied; render_hash recomputed)
  //      const [versionRow] = await tx.insert(miniAppVersions).values({
  //        miniAppId: miniAppRow.id,
  //        specJson: sourceVersion.specJson,
  //        renderHash: renderHash(sourceVersion.specJson),
  //      }).returning()
  //      if (!versionRow) throw new Error('mini_app_versions insert returned no row')
  //
  //      await tx.update(miniApps)
  //        .set({currentVersionId: versionRow.id})
  //        .where(eq(miniApps.id, miniAppRow.id))
  //
  //      // 5. INSERT share_link_clones — race protection via unique index.
  //      //    ON CONFLICT DO NOTHING handles the 2-callers-same-millisecond
  //      //    race (T-0008-070); the txn boundary handles partial-write
  //      //    rollback (T-0008-087c).
  //      const conflict = await tx.insert(shareLinkClones).values({
  //        shareLinkId: shareId,
  //        clonerUserId,
  //        clonedMiniAppId: miniAppRow.id,
  //      }).onConflictDoNothing().returning()
  //
  //      if (conflict.length === 0) {
  //        // Race lost — the OTHER concurrent insert won. Roll back this
  //        // txn's mini_app + version (the throw aborts the transaction),
  //        // then the outer caller re-fetches the winner via path (2).
  //        throw new RaceLostError('concurrent_clone_won')
  //      }
  //
  //      return {miniApp: miniAppRow, currentVersion: versionRow, created: true}
  //    })
  //    // Outer caller catches RaceLostError → re-runs path (2) → returns
  //    // the existing clone with created: false. (T-0008-070.)
  //
  // 6. Return public-safe shapes. Never include source_owner_id,
  //    source_mini_app_id, or mini_app_version_id in any field of the
  //    returned objects.
}
```

**Why the transaction boundary is mandatory:** if steps 3 and 4 succeed
but step 5 fails (DB connection reset, lock-wait timeout,
`share_link_clones` table write error), without `db.transaction()` the
new `mini_app` row persists with no `share_link_clones` row pointing at
it. The unique constraint is the idempotency guarantee — so the NEXT
clone request for the same `(share_id, user_id)` would insert a
**second** `mini_app` row, silently doubling the friend's Library.
T-0008-087c injects exactly this failure and asserts rollback.

**Acceptance criteria:**

- `POST /mini-apps/:id/share`:
  - 201 with `{share_id, universal_link}` for the owner.
  - 404 for non-owner / unknown mini_app.
  - 401 for unauthed.
  - 429 for rate-limited.
  - On success, a row exists in `share_links` with `cover_*` fields
    copied from the mini_app's current version, and `mini_app_version_id`
    pointing at the current version.
  - Calling twice on the same mini_app **mints a new share_id each time**
    (V0: links are not revocable, but each share creates a fresh link
    — owner can share multiple times without recycling identity).
- `GET /share-links/:share_id`:
  - 200 with public-safe shape for valid share_id.
  - 404 for unknown share_id.
  - 401 for unauthed.
  - Response never includes `mini_app_version_id`, `source_owner_id`,
    `spec_json`, or any field that could identify the source mini_app.
- `POST /mini-apps/clone`:
  - 201 on first clone for `(share_id, user_id)`; 200 on subsequent
    (idempotent).
  - 404 for unknown share_id. Response body's `error` field is exactly
    the string `'share_not_found'` (T-0008-052b pins this).
  - 410 for revoked share (V0: never fires; tested as a future-proofing
    contract).
  - 401 unauth, 429 rate-limited.
  - Response `mini_app` has the cloner's `owner_user_id`; no source
    identifiers anywhere in the response payload.
  - **Transactional boundary (P0):** the INSERT mini_app, INSERT
    mini_app_version, INSERT share_link_clones writes (steps 3–5 of
    `acceptCloneIntent`) execute inside a single `db.transaction(...)`
    block. ANY failure in any of those statements (DB error, FK
    violation, unique-constraint loss-of-race, connection reset)
    rolls back ALL writes. Without this guarantee, a partial-write
    failure orphans a `mini_app` row and silently breaks the
    `(share_link_id, cloner_user_id)` idempotency invariant — a
    subsequent clone request would create a SECOND `mini_app` row.
    Code shape: see Service-layer contract above (matches
    `projects.service.ts` create() at line ~186).
  - **Clone title fallback (overrides AC-P2):** For clones, the
    title-fallback policy is `'Shared tool'` (literal string), NOT
    `first 40 chars of prompt`. AC-P2's fallback policy does not
    apply to clones because the source's `original_prompt` is
    source-owner data (AC-P8); using it as a clone-title fallback
    would leak the source creator's prompt into the cloner's
    namespace. This explicitly overrides AC-P2 for the clone
    creation path. See `docs/product/canvas-v0.md` AC-P2 — this ADR
    documents the deviation; cross-reference there.
  - **DB unavailable mid-clone:** `acceptCloneIntent` returns 500
    with `safeMessage` applied (no Anthropic SDK internals or stack
    paths leaked); no partial row persists. T-0008-087b covers.
- Reserved-mode handling (AC-P9):
  - Mobile observes `modes.view.supported: false` from
    `GET /share-links/:share_id` and renders the "coming soon" screen.
    Server doesn't route based on the mode in the URL — the mode is a
    client-side intent decoded from the path.

**Estimated complexity:** High. This is the load-bearing step. Source-
identifier leakage is the single highest-risk failure mode and gets
the most test coverage.

---

### Step 4: iOS entitlement + Universal Link handler

**Files to create/modify:**

- `apps/mobile/app.config.ts` — add `ios.associatedDomains:
  ['applinks:canvas.app']`. In `extra`: surface the apple-app-site-
  association expected appID for runtime assertion in dev (the
  client-side smoke).
- `apps/mobile/src/lib/universalLink.ts` — new module:
  `parseUniversalLink(url)`, `useUniversalLink()`.
- `apps/mobile/src/lib/universalLink.test.ts` — pure-parser tests.
- `apps/mobile/src/state/session/useSession.ts` — hook into the
  pending-clone replay (Step 5).

**Code shape:**

```ts
// apps/mobile/src/lib/universalLink.ts
export interface ParsedUniversalLink {
  shareId: string
  mode: 'clone' | 'view' | 'remix'
}

const SHARE_ID_PATTERN = /^[0-9A-Za-z]{24}$/
const RESERVED_MODES = ['view', 'remix'] as const
const ACTIVE_MODES = ['clone'] as const

export function parseUniversalLink(url: string | null): ParsedUniversalLink | null {
  if (!url) return null
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  // AC-P7: must be canvas.app HTTPS.
  if (parsed.protocol !== 'https:' || parsed.host !== 'canvas.app') return null
  // Path: /m/{share_id}/{mode}
  const match = parsed.pathname.match(/^\/m\/([^/]+)\/([^/]+)\/?$/)
  if (!match) return null
  const [, shareId, mode] = match
  if (!SHARE_ID_PATTERN.test(shareId)) return null
  if (!ACTIVE_MODES.includes(mode as 'clone') && !RESERVED_MODES.includes(mode as 'view'|'remix')) {
    return null // unknown mode → null, caller surfaces "invalid link" toast
  }
  return {shareId, mode: mode as ParsedUniversalLink['mode']}
}

export function useUniversalLink(opts: {
  onActiveLink: (link: ParsedUniversalLink) => void
  onReservedMode: (link: ParsedUniversalLink) => void
}) {
  useEffect(() => {
    // Cold start
    Linking.getInitialURL().then(url => {
      const parsed = parseUniversalLink(url)
      if (!parsed) return
      if (ACTIVE_MODES.includes(parsed.mode as 'clone')) opts.onActiveLink(parsed)
      else opts.onReservedMode(parsed)
    })
    // Warm start
    const sub = Linking.addEventListener('url', ({url}) => {
      const parsed = parseUniversalLink(url)
      if (!parsed) return
      if (ACTIVE_MODES.includes(parsed.mode as 'clone')) opts.onActiveLink(parsed)
      else opts.onReservedMode(parsed)
    })
    return () => sub.remove()
  }, [opts])
}
```

**Acceptance criteria:**

- `app.config.ts` declares `applinks:canvas.app` exactly once.
- `parseUniversalLink` rejects non-HTTPS, wrong host, wrong path shape,
  non-24-char share_id, lowercase mode strings other than the closed
  set.
- `useUniversalLink` calls `onActiveLink` exactly once per distinct URL
  on cold start (uses `getInitialURL`).
- On warm start (`Linking.addEventListener('url', ...)`), each new URL
  fires the appropriate callback.
- Reserved-mode URLs fire `onReservedMode`, not `onActiveLink`.
- Unknown-mode URLs (`/m/xxx/junk`) fire neither — silently dropped.

**Estimated complexity:** Medium. The hook composition with SIWA is
described in Step 5; this step ships the pure parser and the Linking
plumbing.

---

### Step 5: Pending-clone intent persistence + post-SIWA replay

**Files to create/modify:**

- `apps/mobile/src/lib/pendingClone.ts` — new module:
  `setPendingClone(shareId)`, `popPendingClone()`,
  `clearPendingClone()`. Backed by `expo-secure-store`.
- `apps/mobile/src/lib/pendingClone.test.ts`.
- `apps/mobile/src/state/queries/clones.ts` — TanStack Query mutation
  for `POST /mini-apps/clone`.
- `apps/mobile/src/state/session/useSession.ts` — call
  `popPendingClone()` on sign-out (clear); on every successful sign-in,
  expose a one-shot promise that the host shell awaits before navigating.

**Code shape:**

```ts
// apps/mobile/src/lib/pendingClone.ts
import * as SecureStore from 'expo-secure-store'

const KEY = 'pendingClone.shareId.v1'

export async function setPendingClone(shareId: string): Promise<void> {
  if (!/^[0-9A-Za-z]{24}$/.test(shareId)) {
    throw new Error('invalid_share_id') // defensive
  }
  await SecureStore.setItemAsync(KEY, shareId)
}

export async function popPendingClone(): Promise<string | null> {
  // SecureStore can fail transiently on cold start (entitlement load race)
  // or in dev-client mocks. Treat any read failure as "no pending intent"
  // — the user can re-tap the link. Don't crash SessionProvider.
  let value: string | null
  try {
    value = await SecureStore.getItemAsync(KEY)
  } catch (err) {
    logger.error('pendingClone_read_failed', {safeMessage: err})
    return null
  }
  if (value) {
    try {
      await SecureStore.deleteItemAsync(KEY)
    } catch (err) {
      logger.error('pendingClone_delete_failed', {safeMessage: err})
      // Read succeeded; surface the value. Worst case: caller pops the
      // same value twice and the idempotency guard on acceptCloneIntent
      // makes the second pop a no-op.
    }
  }
  return value
}

export async function clearPendingClone(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY)
}
```

**Flow:**

1. `useUniversalLink.onActiveLink` is called with a `clone` URL.
2. If session is authed → directly call `useCloneMutation.mutate(shareId)`.
3. If session is NOT authed → `setPendingClone(shareId)`, navigate to
   Sign-In. (SIWA flow itself is owned by ADR-0011.)
4. On successful sign-in → SessionProvider awaits `popPendingClone()`;
   if non-null, fires the clone mutation, then navigates to the new
   mini_app's Run mode. Else navigates to Library as usual.
5. On sign-out → `clearPendingClone()` (defense against
   cross-account leak).

**Pending-intent expiry policy (P1-2 decision):**

**Pending intents NEVER expire.** Cal's pick. Justification:

- Share links themselves have no expiry in V0 (revocation is V0.5 via
  `revoked_at`). A TTL on the pending intent would be tighter than the
  share link's own lifetime — a friend could tap a still-valid link,
  walk away, return 72 hours later to sign in, and the intent would
  have silently expired while the link is still good. That's a worse
  UX than the user re-tapping the link, because there's no signal to
  the user that anything expired.
- Sign-out explicitly clears the intent (T-0008-123) — the device-
  level threat model (someone else uses the device) is handled by
  that, not by a clock-based expiry.
- A successful clone clears the intent (T-0008-130). A failed clone
  does NOT re-persist the intent (T-0008-131; zombie-intent
  prevention).
- Implementation cost: zero. No `setTimeout`, no `expiry_at` field on
  the SecureStore value, no clock-skew tests.

Test pin: T-0008-117b advances time arbitrarily between `setPendingClone`
and `popPendingClone` and asserts the share_id round-trips identically.
This locks the never-expires contract.

**Acceptance criteria:**

- `setPendingClone` rejects malformed share_ids synchronously.
- `popPendingClone` returns and clears atomically (read-then-delete is
  one logical op; cover with a test that asserts the second pop is
  null).
- `popPendingClone` catches SecureStore read errors and returns null
  rather than throwing. (Module wraps the `getItemAsync` call in
  try/catch. T-0008-118b covers — without this guard, a transient
  SecureStore failure crashes the SessionProvider.)
- `clearPendingClone` is idempotent (no error if no value set).
- Sign-out clears the pending intent (T-0008-072 / T-0008-123).
- Sign-in-as-different-user does not replay a previous user's pending
  intent (covered indirectly — sign-out clears; if the user signs in
  without going through the link tap, there's no pending intent to
  replay).
- The clone mutation is called exactly once on replay (T-0008-073).
- If the clone mutation fails (network), the pending intent is NOT
  re-persisted — the user must re-tap the link. (Avoids zombie intents.)
- **Pending intents do not expire.** Set today, pop in 30 days → still
  returns the share_id. The only ways an intent is cleared are: a
  successful pop, an explicit `clearPendingClone()` (e.g. sign-out),
  or the user uninstalling the app (OS-level SecureStore wipe).

**Estimated complexity:** Medium. The state machine is small but
intersects with ADR-0011's SIWA flow; care needed at the boundary.

---

### Step 6: Share affordance + clone landing UX (action surface only)

**Files to create/modify:**

- `apps/mobile/src/state/queries/shareLinks.ts` — TanStack mutation
  for `POST /mini-apps/:id/share`. Returns `{share_id, universal_link}`.
- `apps/mobile/src/lib/api.ts` — wire the new endpoints into the
  client (auth-required paths).
- `apps/mobile/src/screens/Run/ShareSheet.tsx` — minimal action handler
  (copy link to clipboard + haptic + toast). UX details — sheet
  presentation, coachmark, celebration — are owned by ADR-0011's host
  shell; ADR-0008 ships the action handler and the data flow.
- `apps/mobile/src/lib/telemetry.ts` — emit `share_link_copied`,
  `link_clone_opened` events from this surface.

**Code shape:**

```ts
// apps/mobile/src/state/queries/shareLinks.ts
export function useCreateShareLinkMutation() {
  return useMutation({
    mutationFn: (miniAppId: string) =>
      apiClient.post(`/mini-apps/${miniAppId}/share`).json<{
        share_id: string
        universal_link: string
      }>(),
    onSuccess: async ({universal_link}) => {
      // Copy to clipboard FIRST — if it fails, no haptic, no success toast,
      // no telemetry (T-0008-143b). UX details in ADR-0011.
      try {
        await Clipboard.setStringAsync(universal_link)
      } catch (err) {
        logger.error('clipboard_set_failed', {safeMessage: err})
        toast.error("Couldn't copy the link. Long-press the share link to copy manually.")
        return
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      telemetry.emit('share_link_copied', {/* whitelist-validated */})
      toast.success('Link copied')
    },
    onError: (err) => {
      logger.error('share_create_failed', {safeMessage: err})
      toast.error('Couldn\'t create a share link. Try again.')
    },
  })
}

export function useCloneMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (shareId: string) =>
      apiClient.post('/mini-apps/clone', {json: {share_id: shareId}}).json<{
        mini_app: {id: string; title: string; /* ...public-safe shape */}
        current_version: {id: string; spec_json: object; render_hash: string}
      }>(),
    onSuccess: ({mini_app}) => {
      qc.invalidateQueries({queryKey: miniAppsKeys.list()})
      telemetry.emit('link_clone_opened', {/* whitelist-validated */})
      // Navigation to Run mode is owned by ADR-0011's host shell.
    },
    onError: (err) => {
      if ((err as ApiError).status === 404) toast.error('This tool is no longer available.')
      else if ((err as ApiError).status === 410) toast.error('This share link has been revoked.')
      else toast.error('Couldn\'t open the shared tool.')
    },
  })
}
```

**Acceptance criteria:**

- `useCreateShareLinkMutation` calls `POST /mini-apps/:id/share`,
  copies the returned `universal_link` to clipboard, fires the
  `share_link_copied` telemetry event, shows the success toast — IN
  THAT ORDER. If `Clipboard.setStringAsync` rejects, the haptic /
  success toast / telemetry are all skipped and an error toast
  prompting manual copy fires (T-0008-143b). Rationale: success toast
  for a failed copy is worse than the error toast because the user
  may paste a stale clipboard value into iMessage.
- `useCloneMutation` calls `POST /mini-apps/clone`, fires the
  `link_clone_opened` telemetry event, invalidates the Library query.
- 404/410 errors render user-readable toasts; other errors fall
  through to a generic toast.
- Telemetry events use the whitelisted payload shape (see Step 7).
- The mutation does NOT navigate — navigation is ADR-0011's surface.

**Estimated complexity:** Low-Medium.

---

### Step 7: Telemetry whitelist additions + integration tests

**Files to create/modify:**

- `services/api/src/llm/telemetry.ts` — add three new server-side event
  types and their per-type payload whitelists.
- `services/api/src/llm/telemetry.test.ts` — extend coverage.
- `apps/mobile/src/lib/telemetry.ts` — extend the client-side
  event-type union AND the client-side payload whitelist with
  `share_link_copied` and `link_clone_opened`. The client-side
  telemetry module is the user-action surface (AC-T1 naming); the
  server-side telemetry module is the data-state surface.
- `apps/mobile/src/lib/telemetry.test.ts` — **NEW** (P1-5). Mirrors the
  server-side whitelist-enforcement pattern (`telemetry.test.ts` in
  `services/api/src/llm/`). Two new tests below (T-0008-152b, -152c).
- `services/api/src/routes/shareLinks.test.ts` — new integration test
  file covering the full happy + failure matrix.
- `services/api/src/routes/clones.test.ts` — new integration test file.
- `services/api/src/routes/wellKnown.test.ts` — AASA file shape.

**Telemetry additions:**

```ts
// telemetry.ts — append to EventType and EVENT_PAYLOAD_WHITELIST
export type EventType =
  | 'generate.completed'
  | 'generate.invalid_spec'
  | 'generate.out_of_scope'
  | 'out_of_scope_intent_captured'
  // ADR-0008:
  | 'share_link.created'
  | 'share_link.clone_accepted'
  | 'share_link.reserved_mode_viewed'

export const EVENT_PAYLOAD_WHITELIST: Record<EventType, ReadonlyArray<string>> = {
  // ... existing entries ...
  'share_link.created': ['share_id_prefix', 'source_archetype'],
  // source_archetype derived from the version's spec_json; share_id_prefix is
  // the first 4 chars of ksuid (sortable bucket for time-series analytics).
  'share_link.clone_accepted': ['share_id_prefix', 'idempotent_hit', 'source_archetype'],
  'share_link.reserved_mode_viewed': ['share_id_prefix', 'mode'],
} as const
```

**Note on event-name alignment with the spec:** AC-T1 names events
`share_link_copied`, `link_clone_opened`. These are *client-side*
telemetry from `apps/mobile/src/lib/telemetry.ts` (UX surface). The
server-side events above are different: they fire from API routes when
the underlying DB state changes. Both layers emit, with the
client-side names being user-action telemetry and the server-side names
being data-state telemetry. The whitelist applies to the server-side
events; client-side telemetry has its own whitelist (Sentry breadcrumbs
+ Langfuse, per existing M1 patterns).

**Acceptance criteria:**

- All three new event types pass through `writeEvent` with the
  whitelist enforced.
- Unknown payload keys throw `EventPayloadValidationError` synchronously
  (regression: same behavior as existing event types).
- `EVAL_MODE=true` short-circuits the DB insert (regression).
- Integration tests cover the full happy + failure matrix per
  §Test Specification.

**Estimated complexity:** Medium (mostly test surface).

---

## Comprehensive Test Specification

### Test File Mapping

| Step | Test File | Env |
| ---- | --------- | --- |
| 1 | `services/api/src/db/schema.test.ts` (extend) | Jest + pg-mem |
| 1 | `services/api/migrations/0008_share_links.test.sql` | DB migration smoke |
| 2 | `services/api/src/routes/wellKnown.test.ts` (new) | Jest + Fastify inject |
| 3 | `services/api/src/routes/shareLinks.test.ts` (new) | Jest + Fastify inject + DB |
| 3 | `services/api/src/routes/clones.test.ts` (new) | Jest + Fastify inject + DB |
| 3 | `services/api/src/services/shareLinks.test.ts` (new) | Jest + DB |
| 4 | `apps/mobile/src/lib/universalLink.test.ts` (new) | Jest (RN test env) |
| 5 | `apps/mobile/src/lib/pendingClone.test.ts` (new) | Jest + expo-secure-store mock |
| 5 | `apps/mobile/src/state/queries/clones.test.ts` (new) | Jest + RTQ |
| 6 | `apps/mobile/src/state/queries/shareLinks.test.ts` (new) | Jest + RTQ |
| 7 | `services/api/src/llm/telemetry.test.ts` (extend) | Jest |
| 7 | `apps/mobile/src/lib/telemetry.test.ts` (NEW — P1-5) | Jest (RN env) |

### Step 1 Tests — schema + migration

| ID | Category | Test Description |
| --- | --- | --- |
| T-0008-001 | Happy | Insert into `share_links` with all 8 columns + valid 24-char share_id → row persisted. |
| T-0008-002 | Happy | Insert into `share_link_clones` with valid FKs → row persisted, unique constraint not violated for first insert. |
| T-0008-003 | Failure | `share_id` of length 23 → CHECK violation. |
| T-0008-004 | Failure | `share_id` of length 25 → CHECK violation. |
| T-0008-005 | Failure | `cover_stance: 'unknown'` → CHECK violation (closed enum). |
| T-0008-006 | Failure | `cover_palette: 'monochrome'` → CHECK violation. |
| T-0008-007 | Failure | `cover_art_seed` of length 31 (vs required 32) → CHECK violation. |
| T-0008-008 | Failure | `cover_art_seed` of length 33 → CHECK violation. |
| T-0008-009 | Failure | Insert `share_link` with `mini_app_version_id` not in `mini_app_versions` → FK violation. |
| T-0008-010 | Failure | Insert `share_link` with `owner_user_id` not in `users` → FK violation. |
| T-0008-011 | Failure | Insert second `share_link_clones` row with same `(share_link_id, cloner_user_id)` → unique constraint violation. |
| T-0008-012 | Boundary | `share_id` of exact length 24 with all 0-9A-Za-z → inserts cleanly. |
| T-0008-013 | Concurrency | Two parallel inserts of `share_link_clones` with same `(share_link_id, cloner_user_id)` — exactly one succeeds; other gets unique violation. |
| T-0008-014 | Regression | Deleting a `users` row cascades to its `share_links` rows. |
| T-0008-015 | Regression | Deleting a `mini_app_versions` row cascades to its `share_links` rows. |
| T-0008-016 | Regression | Deleting a `mini_apps` row cascades to `share_link_clones` rows referencing it via `cloned_mini_app_id`. |
| T-0008-017 | Regression | Deleting a `share_links` row cascades to `share_link_clones` rows. |
| T-0008-018 | Migration | `migrations/0008_share_links.sql` applies cleanly to a fresh DB. |
| T-0008-019 | Migration | Migration is idempotent — running twice is a no-op (`CREATE TABLE IF NOT EXISTS`). |
| T-0008-020 | Breaking | Migration **fails** if `mini_apps` and `mini_app_versions` tables don't exist (this is by design — ADR-0011 must run first). Confirms the dependency is enforced at the DB layer. |
| T-0008-021 | Boundary | `revoked_at` nullable: insert with NULL is fine; insert with non-NULL is fine (V0 doesn't write it, but the column accepts). |

#### Step 1 Test Summary

| Category | Count |
| --- | --- |
| Happy | 2 |
| Failure | 9 |
| Boundary | 2 |
| Concurrency | 1 |
| Regression | 4 |
| Migration | 2 |
| Breaking | 1 |
| **Total** | **21** |

---

### Step 2 Tests — AASA file

| ID | Category | Test Description |
| --- | --- | --- |
| T-0008-022 | Happy | `GET /.well-known/apple-app-site-association` returns 200. |
| T-0008-023 | Happy | Response header `Content-Type: application/json` exactly (not `application/octet-stream`, not `text/json`). |
| T-0008-024 | Happy | Response body parses as JSON; matches the expected `{applinks: {apps: [], details: [...]}}` shape. |
| T-0008-025 | Happy | `applinks.details[0].appID` equals env `APPLE_APP_ID_PREFIX`. |
| T-0008-026 | Happy | `applinks.details[0].paths` is exactly `['/m/*']`. |
| T-0008-027 | Boundary | Route is reachable WITHOUT an Authorization header (public). |
| T-0008-028 | Security | Route returns the same body for authenticated and unauthenticated callers (no per-user data leak). |
| T-0008-029 | Failure | `POST /.well-known/apple-app-site-association` returns 404 (route is GET-only). |
| T-0008-030 | Config | `APPLE_APP_ID_PREFIX` unset → server startup throws config validation error. |
| T-0008-031 | Config | `APPLE_APP_ID_PREFIX=''` → server startup throws (empty rejected). |
| T-0008-032 | Config | `APPLE_APP_ID_PREFIX='   '` → server startup throws (whitespace rejected). |
| T-0008-033 | Config | `APPLE_APP_ID_PREFIX='lowercase.app'` → server startup throws (regex requires uppercase TEAMID). |
| T-0008-034 | Config | `APPLE_APP_ID_PREFIX='TEAMID12AB.com.appcreator.mvp'` → accepted, normalized as-is. |
| T-0008-035 | Config | `APPLE_APP_ID_PREFIX='TEAMID12AB.com.AppCreator.MVP'` → accepted (bundle ID is case-preserved). |
| T-0008-036 | Regression | Route is rate-limit-exempt — calling 100 times in a second still returns 200. |
| T-0008-037 | Regression | `Cache-Control` header set to a sensible public value (asserts presence + bounded max-age ≤ 86400). |

#### Step 2 Test Summary

| Category | Count |
| --- | --- |
| Happy | 5 |
| Boundary | 1 |
| Security | 1 |
| Failure | 1 |
| Config exhaustion | 6 |
| Regression | 2 |
| **Total** | **16** |

---

### Step 3 Tests — server endpoints

#### `POST /mini-apps/:id/share`

| ID | Category | Test Description |
| --- | --- | --- |
| T-0008-038 | Happy | Owner POST → 201; response body has `share_id` (24 chars, base62) and `universal_link` matching `https://canvas.app/m/{share_id}/clone`. |
| T-0008-039 | Happy | After 201, `share_links` row exists; `mini_app_version_id` matches the mini_app's current_version_id; `cover_*` fields match the version's spec. |
| T-0008-040 | Boundary | Generate 1000 share_links in a loop; no two share_ids are equal; share_ids are all 24 chars; no two consecutive ids share more than 12 leading chars (smoke for ksuid distribution). |
| T-0008-041 | Failure | Non-owner POST → 404 (not 403 — 403 would leak existence). |
| T-0008-042 | Failure | Unknown mini_app_id → 404. |
| T-0008-043 | Failure | Unauthed POST → 401. |
| T-0008-044 | Boundary | Malformed `mini_app_id` (non-UUID) → 400. |
| T-0008-045 | Rate-limit | 11th call in 1 min returns 429 `rate_limited`. |
| T-0008-046 | Idempotency | Two sequential POSTs for the same mini_app return **different** share_ids (V0: each share creates a fresh link; not deduped). |
| T-0008-047 | Security | Response body does NOT contain `mini_app_version_id`, `owner_user_id`, `cover_art_seed`, or `spec_json`. (The cover fields are persisted on the row but not returned in the create response — those go through the public-safe lookup.) |
| T-0008-048 | Regression | When the mini_app's current version updates (re-prompt), an existing share_link's `mini_app_version_id` does **not** change (frozen at share time). |
| T-0008-049 | Telemetry | A `share_link.created` event is written with payload keys exactly `['share_id_prefix', 'source_archetype']`. |

#### `GET /share-links/:share_id`

| ID | Category | Test Description |
| --- | --- | --- |
| T-0008-050 | Happy | Authed GET with valid share_id → 200 with `share_id`, `cover_*` fields, `modes` block. |
| T-0008-051 | Happy | `modes.clone.supported === true`, `modes.view.supported === false`, `modes.remix.supported === false`. |
| T-0008-052 | Failure | Unknown share_id → 404 `share_not_found`. |
| T-0008-053 | Failure | Unauthed GET → 401. |
| T-0008-054 | Boundary | share_id of wrong length (23 chars) → 404 (treated as unknown, not 400 — the route is permissive on shape to avoid enumeration attacks via 400 vs 404 timing). |
| T-0008-055 | Security | Response does NOT contain `mini_app_version_id`, `source_owner_user_id`, `mini_app_id`, or `spec_json`. |
| T-0008-056 | Security | Calling on a share_link from a different owner (caller has no relation to it) still returns 200 — share_id is the cap. |
| T-0008-057 | Regression | Revoked share_link (`revoked_at` non-null) → still returns 200 (V0: revocation surfaces at clone time, not lookup time; this test future-proofs the lookup surface). |
| T-0008-058 | Rate-limit | 11th call in 1 min returns 429. |
| T-0008-059 | Telemetry | A `share_link.reserved_mode_viewed` event is NOT emitted on this route (it's emitted by the mobile client when the user actually views the reserved-mode screen — server can't distinguish a generic lookup from a reserved-mode view). |

#### `POST /mini-apps/clone`

| ID | Category | Test Description |
| --- | --- | --- |
| T-0008-060 | Happy | Authed user A POSTs `{share_id}` for B's share → 201 with `mini_app` (owned by A) + `current_version`. |
| T-0008-061 | Happy | Same A re-posts the same share_id → 200 (idempotent); response `mini_app.id` equals the first response's `mini_app.id`; response `mini_app.cover_art_seed === first_response.mini_app.cover_art_seed` AND response `current_version.id === first_response.current_version.id` (confirms idempotency returns the stored row, not a freshly-computed response — P1-3). |
| T-0008-062 | Happy | Cloned `mini_app.owner_user_id === A.id`; `cloned_mini_app.cover_art_seed !== source.cover_art_seed` (fresh seed). |
| T-0008-063 | Happy | Cloned `current_version.spec_json` is structurally equal to source version's spec_json (clone is a copy). |
| T-0008-064 | Happy | Cloned `current_version.render_hash` is recomputed (equals `sha256(canonicalize(spec_json))`). |
| T-0008-065 | Happy | After clone, `share_link_clones` row exists with `(share_link_id, cloner_user_id, cloned_mini_app_id)`. |
| T-0008-066 | Failure | Unknown share_id → 404 `share_not_found`. |
| T-0008-067 | Failure | Unauthed → 401. |
| T-0008-068 | Failure | Malformed body (`{share_id: 'too-short'}`) → 400. |
| T-0008-069 | Failure | Revoked share (`revoked_at` set; manually set for test) → 410 `share_revoked`. |
| T-0008-070 | Concurrency | A POSTs the same share_id twice in parallel (Promise.all) — exactly one 201 + one 200; one `mini_app` row created; one `share_link_clones` row. (Race protection.) |
| T-0008-071 | Rate-limit | 11 clones in 1 min → 429 on the 11th. |
| T-0008-072 | Security | Cloned `mini_app` response does NOT contain `source_mini_app_id`, `source_owner_user_id`, or `source_version_id` (AC-P8). |
| T-0008-073 | Security | After clone, querying the source owner B's tools (`GET /mini-apps`) returns B's tools unchanged (A's clone did not pollute B's namespace). |
| T-0008-074 | Security | After clone, querying A's `GET /mini-apps` returns A's clone with A's `owner_user_id`. |
| T-0008-075 | Security | Source creator B's prompt (`original_prompt` field on source) does NOT appear anywhere in A's clone response or stored row. |
| T-0008-076 | Security | If A and B are the same user (creator cloning their own link), still creates a new mini_app (clone is allowed; not deduped against source). Edge case: B could test their share by cloning it. |
| T-0008-077 | Boundary | Cloning a share whose source mini_app has been deleted by the source owner — share_link cascade-deleted → 404. |
| T-0008-078 | Regression | Clone title derived from first Heading of the cloned spec; if no Heading, falls back to literal `'Shared tool'` per clone-title-fallback rule (Step 3 §AC — overrides AC-P2 because source's `original_prompt` is source-owner data per AC-P8). |
| T-0008-079 | Regression | Cloned mini_app appears in `GET /mini-apps` for A with `updated_at` = clone time. |
| T-0008-080 | Telemetry | A `share_link.clone_accepted` event is emitted with `idempotent_hit: false` on first clone. |
| T-0008-081 | Telemetry | A `share_link.clone_accepted` event is emitted with `idempotent_hit: true` on second clone. |

#### Service layer — `shareLinksService` direct

| ID | Category | Test Description |
| --- | --- | --- |
| T-0008-082 | Happy | `createShareLink({miniAppId, userId})` returns `{shareId}` and persists row. |
| T-0008-083 | Failure | `createShareLink` with non-owner userId throws `ForbiddenError`. |
| T-0008-084 | Failure | `createShareLink` with unknown miniAppId throws `NotFoundError`. |
| T-0008-085 | Sensitivity | `getShareLinkPublicView` return type does NOT have `miniAppVersionId`, `ownerUserId` fields (compile-time assertion via `Exclude<keyof ReturnType<...>, 'miniAppVersionId' \| 'ownerUserId'>` test). |
| T-0008-086 | Sensitivity | `getShareLinkPublicView` runtime test: serialize the result to JSON; `JSON.parse(JSON.stringify(result))` does NOT contain the strings `miniAppVersionId`, `ownerUserId`, `mini_app_version_id`, `owner_user_id`. |
| T-0008-087 | Sensitivity | `acceptCloneIntent` return type's `mini_app` shape does NOT have any field named `source_*`. |

#### Step 3 — additional tests added in this revision

| ID | Category | Test Description |
| --- | --- | --- |
| T-0008-052b | Failure | Unknown share_id on `POST /mini-apps/clone` → 404 with response body `error` field exactly the string `'share_not_found'` (no trailing punctuation, no Title Case, no error code wrapper — pins the exact contract the mobile client checks at the toast boundary). |
| T-0008-082b | Failure | `createShareLink` when the source `mini_app_version` lookup fails (DB timeout simulated via mocked driver throwing `ConnectionError`) → service throws; route returns 500; `safeMessage` applied; no `share_links` row persisted. |
| T-0008-087b | Failure | `acceptCloneIntent` when the DB is unavailable mid-call (mock `db.transaction` to throw `ConnectionError`) → route returns 500 with `error: 'internal'`; `safeMessage` applied (no SDK paths leaked); no partial row in `mini_apps`, `mini_app_versions`, or `share_link_clones`. |
| T-0008-087c | Failure / P0-1 | **Transactional rollback under partial-failure.** Mock the `tx.insert(shareLinkClones)` call (step 5 of `acceptCloneIntent`) to throw AFTER steps 3 and 4 inserts have written inside the transaction. Assertions: (a) outer call throws; (b) `mini_apps` table has ZERO rows for the cloner; (c) `mini_app_versions` table has ZERO rows for that mini_app; (d) `share_link_clones` table has ZERO rows for `(shareLinkId, clonerUserId)`. Then re-call `acceptCloneIntent` without the mock and assert: exactly ONE `mini_app` row exists for the cloner (proves idempotency is not broken by the prior partial failure). This is the test that pins the §Step 3 transactional-boundary acceptance criterion. |
| T-0008-087d | Happy / P2-2 | **Two-share-links / same-source-version scenario.** Owner B creates `share_link_A` and `share_link_B` for the same `mini_app_version`. Friend A clones both. Assertions: (a) two distinct rows in `share_link_clones`; (b) two distinct `mini_app` rows in A's namespace (different ids, different `cover_art_seed`s); (c) both rows' `current_version.spec_json` equals B's source spec. Each share_link is its own social object — no cross-link idempotency. |

#### Step 3 Test Summary

| Category | Count |
| --- | --- |
| Happy | 12 |
| Failure | 15 |
| Boundary | 4 |
| Security | 8 |
| Concurrency | 1 |
| Rate-limit | 3 |
| Regression | 4 |
| Telemetry | 4 |
| Sensitivity | 3 |
| Idempotency | 1 |
| **Total** | **55** |

_Recount notes (P2-1 fix + revision-add bookkeeping):_ pre-revision
summary had per-category drift against a 50-row body (Happy was 12 vs
actual 11; Failure was 10 vs actual 11; Security was 7 vs actual 8;
Regression was 3 vs actual 4; Misc happy was 2 vs actual 1 —
double-counted the service-layer Happy row). This revision adds 5 tests
(T-0008-052b, -082b, -087b, -087c Failure; T-0008-087d Happy) bringing
the body to 55 rows. The "Misc happy (service)" row has been dropped
because T-0008-082 was double-counted between it and the Happy bucket;
the service-layer Happy is now folded into Happy=12 (route Happy 11 +
service Happy 1). Body total 55; categories sum to 55.

---

### Step 4 Tests — iOS Linking surface

| ID | Category | Test Description |
| --- | --- | --- |
| T-0008-088 | Happy | `parseUniversalLink('https://canvas.app/m/abc...24chars/clone')` → `{shareId, mode: 'clone'}`. |
| T-0008-089 | Happy | `parseUniversalLink(...m/.../view)` → `{shareId, mode: 'view'}`. |
| T-0008-090 | Happy | `parseUniversalLink(...m/.../remix)` → `{shareId, mode: 'remix'}`. |
| T-0008-091 | Failure | `parseUniversalLink(null)` → null. |
| T-0008-092 | Failure | `parseUniversalLink('')` → null. |
| T-0008-093 | Failure | `parseUniversalLink('http://canvas.app/m/.../clone')` → null (HTTPS required). |
| T-0008-094 | Failure | `parseUniversalLink('https://wrong.app/m/.../clone')` → null (wrong host). |
| T-0008-095 | Failure | `parseUniversalLink('https://canvas.app/wrong/abc/clone')` → null (wrong path root). |
| T-0008-096 | Failure | `parseUniversalLink('https://canvas.app/m/short/clone')` → null (share_id too short). |
| T-0008-097 | Failure | `parseUniversalLink('https://canvas.app/m/aaaaaaaaaaaaaaaaaaaaaaaa/junk')` → null (unknown mode). |
| T-0008-098 | Failure | `parseUniversalLink('https://canvas.app/m/aaaa-bbbb-cccc-dddd-eeee-ffff/clone')` → null (dashes — not base62). |
| T-0008-099 | Failure | `parseUniversalLink('https://canvas.app/m//clone')` → null (empty share_id). |
| T-0008-100 | Failure | `parseUniversalLink('https://canvas.app/m/abc...24chars/CLONE')` → null (uppercase mode rejected; modes are case-sensitive). |
| T-0008-101 | Boundary | share_id of exactly 24 chars 0-9A-Za-z → accepted. |
| T-0008-102 | Boundary | Trailing slash on URL (`/m/.../clone/`) → accepted. |
| T-0008-103 | Boundary | URL with query string (`?utm_source=...`) → accepted; query ignored. |
| T-0008-104 | Boundary | URL with fragment (`#x`) → accepted; fragment ignored. |
| T-0008-105 | Failure | URL with extra path segments (`/m/.../clone/extra`) → null. |
| T-0008-106 | Happy | `useUniversalLink` on cold start with active link → `onActiveLink` called exactly once. |
| T-0008-107 | Happy | `useUniversalLink` on cold start with reserved-mode link → `onReservedMode` called exactly once. |
| T-0008-108 | Happy | `useUniversalLink` on warm event with active link → `onActiveLink` called. |
| T-0008-109 | Failure | `useUniversalLink` on warm event with invalid URL → neither callback fires. |
| T-0008-110 | Regression | Same URL fired twice via warm event → callback fires twice (intentional; OS guarantees no duplicate but we don't dedup). |
| T-0008-111 | Regression | `useUniversalLink` unmount cleans up the `Linking.addEventListener` subscription. |
| T-0008-112 | Config | `app.config.ts`'s `ios.associatedDomains` exactly equals `['applinks:canvas.app']` (snapshot test of resolved config). |
| T-0008-113 | Breaking | M1's `appcreator://auth?token=...` custom-scheme parser (`parseAuthDeepLink`) is NOT affected — these are two independent parsers handling two different URL surfaces. Regression test exercises both. |
| T-0008-113b | Failure / missing-test-3 | **`useUniversalLink` cold-start with non-canvas URL.** Mock `Linking.getInitialURL()` to return `'appcreator://auth?token=abc'` (an M1 custom-scheme URL — leftover or sent to the wrong handler). Assertions: `parseUniversalLink` returns null; neither `onActiveLink` nor `onReservedMode` fires. Silent discard — M1's `parseAuthDeepLink` handles that URL on its own pipe. No log, no toast, no telemetry. |

#### Step 4 Test Summary

| Category | Count |
| --- | --- |
| Happy | 8 |
| Failure | 11 |
| Boundary | 4 |
| Regression | 2 |
| Config | 1 |
| Breaking | 1 |
| **Total** | **27** |

---

### Step 5 Tests — pending-clone intent

| ID | Category | Test Description |
| --- | --- | --- |
| T-0008-114 | Happy | `setPendingClone('valid24charshareid000abc')` → reads back with `SecureStore.getItemAsync` to the same value. |
| T-0008-115 | Failure | `setPendingClone('short')` rejects synchronously with `invalid_share_id`. |
| T-0008-116 | Failure | `setPendingClone('')` rejects. |
| T-0008-117 | Failure | `setPendingClone('25charsXXXXXXXXXXXXXXXXXX')` rejects. |
| T-0008-118 | Happy | `popPendingClone()` returns the previously-set value and clears it (second pop returns null). |
| T-0008-119 | Happy | `popPendingClone()` on empty store returns null (no error). |
| T-0008-120 | Happy | `clearPendingClone()` on empty store does not throw (idempotent). |
| T-0008-121 | Happy | `clearPendingClone()` after `setPendingClone` clears the value. |
| T-0008-122 | Security | After `clearPendingClone()`, `popPendingClone()` returns null even if called immediately. |
| T-0008-123 | Security | Sign-out flow calls `clearPendingClone()` (assertion in `useSession.signOut` test). |
| T-0008-124 | Concurrency | Two parallel `popPendingClone()` calls — one returns the value, one returns null (read-then-delete is not strictly atomic; either ordering acceptable; in NO case do both succeed). |
| T-0008-125 | Happy | `useCloneMutation.mutate(shareId)` → 201 path → query invalidation fires once for `miniAppsKeys.list()`. |
| T-0008-126 | Happy | `useCloneMutation` on idempotent (200) path → still invalidates Library. |
| T-0008-127 | Failure | 404 response → toast "This tool is no longer available." fires; mutation does NOT throw to caller. |
| T-0008-128 | Failure | 410 response → toast "This share link has been revoked." fires. |
| T-0008-129 | Failure | Network failure → generic toast; mutation rejects so the caller can retry. |
| T-0008-130 | Regression | After a successful clone via pendingClone replay, `popPendingClone` returns null (already cleared by Step 5 replay flow). |
| T-0008-131 | Regression | A failed clone (network) does NOT re-persist the pending intent — zombie-intent prevention. |
| T-0008-132 | Telemetry | On successful clone, client-side `link_clone_opened` event is emitted (with whitelisted payload). |

#### Step 5 — additional tests added in this revision

| ID | Category | Test Description |
| --- | --- | --- |
| T-0008-117b | Happy / P1-2 | **Pending intents never expire.** Set up `jest.useFakeTimers()` and advance time by 30 days before calling `popPendingClone`. The assertion is that `popPendingClone()` returns the original value regardless of the simulated time gap, confirming no expiry logic has been introduced. If a TTL is added in the future, this test catches the regression. |
| T-0008-118b | Failure / missing-test-4 | **`popPendingClone` when `SecureStore.getItemAsync` throws.** Mock `SecureStore.getItemAsync` to reject with `Error('secure_store_unavailable')`. Assertions: `popPendingClone()` returns `null` (does NOT throw); an error is logged via `logger.error('pendingClone_read_failed', ...)`. SessionProvider does not crash. |
| T-0008-129b | Failure / P2-4 | **`setPendingClone` when `SecureStore.setItemAsync` rejects.** Mock the write to throw. Assertion: `setPendingClone` rejects with the SecureStore error (caller surfaces a toast and aborts the SIWA navigation — the user is then asked to re-tap the link after sign-in). No partial state in SecureStore. |

| T-0008-129c | Failure | **Clone-mutation network error during pendingClone-replay flow.** After SIWA succeeds, `popPendingClone` returns a share_id, `useCloneMutation.mutate(shareId)` fires, but the network fails. Assertions: (a) mutation rejects; (b) generic error toast fires; (c) pending intent is NOT re-persisted (T-0008-131 dependency); (d) `link_clone_opened` telemetry NOT emitted (the clone never completed server-side). Distinct from T-0008-129 in that it covers the post-SIWA replay path specifically (separate code path through SessionProvider, not the direct-tap-while-authed path). |

#### Step 5 Test Summary

| Category | Count |
| --- | --- |
| Happy | 8 |
| Failure | 9 |
| Security | 2 |
| Concurrency | 1 |
| Regression | 2 |
| Telemetry | 1 |
| **Total** | **23** |

_Recount notes (P2-4 fix + revision additions):_ pre-revision summary
had Failure=5 + Misc=1 = 6 against a 19-row body. T-0008-129 was
labeled "Failure" in the body but counted as "Misc" in the summary.
Merged Misc into Failure: true Failure count of the 19-row body was 6.
Then this revision adds 4 new tests:

- T-0008-117b (Happy: never-expires pin — P1-2)
- T-0008-118b (Failure: SecureStore read throws — missing-test-4)
- T-0008-129b (Failure: SecureStore write rejects — P2-4)
- T-0008-129c (Failure: clone-mutation network error in replay path)

Body grows to 23 rows. Categories sum: Happy 7+1=8, Failure 6+3=9,
Security 2, Concurrency 1, Regression 2, Telemetry 1 → 23. Failure:happy
= 9:8 satisfies the ≥ rule.

---

### Step 6 Tests — share + clone action handlers

| ID | Category | Test Description |
| --- | --- | --- |
| T-0008-133 | Happy | `useCreateShareLinkMutation.mutate(miniAppId)` → 201 → Clipboard.setStringAsync called with the returned `universal_link`. |
| T-0008-134 | Happy | After 201, Haptics.impactAsync called with Medium style (matches Sable's spec). |
| T-0008-135 | Happy | After 201, toast.success called with `'Link copied'` (string match). |
| T-0008-136 | Happy | After 201, `share_link_copied` telemetry event emitted with whitelisted payload. |
| T-0008-137 | Failure | 401 response (session expired mid-action) → toast.error generic; Clipboard NOT called. |
| T-0008-138 | Failure | 404 (mini_app deleted between rendering Share button and tapping it) → toast.error generic; Clipboard NOT called. |
| T-0008-139 | Failure | 429 rate-limited → toast.error "Try again in a moment." |
| T-0008-140 | Regression | The mutation does NOT trigger navigation (navigation is owned by the host shell per ADR-0011). |
| T-0008-141 | Regression | `useCloneMutation.mutate(shareId)` invalidates `miniAppsKeys.list()` exactly once. |
| T-0008-142 | Security | Mutation does NOT persist `universal_link` anywhere outside clipboard (no MMKV, no AsyncStorage, no SecureStore). Test asserts no calls to those modules. |
| T-0008-143 | Breaking | Mutation does NOT auto-share via the system share sheet (V0 is copy-only; OS share sheet is V0.5). |
| T-0008-143b | Failure / P1-1 | **`Clipboard.setStringAsync` rejects mid-onSuccess.** Mock `Clipboard.setStringAsync` to throw a rejected promise. **Pinned behavior:** the success toast is NOT fired; instead an error toast `'Couldn\'t copy the link. Long-press the share link to copy manually.'` fires, `Haptics.impactAsync` is NOT called, and the `share_link_copied` telemetry event is NOT emitted (the share_link DB row remains — the server-side `share_link.created` event already fired and is the authoritative record). Rationale: a success toast for a copy that didn't happen breaks the user's mental model — they paste an old clipboard value and send the wrong link. Cost: one extra Promise wrap inside `onSuccess`. |

#### Step 6 Test Summary

| Category | Count |
| --- | --- |
| Happy | 4 |
| Failure | 4 |
| Regression | 2 |
| Security | 1 |
| Breaking | 1 |
| **Total** | **12** |

_Failure:happy ratio after P1-1 fix:_ Failure=4, Happy=4 → satisfies
failure ≥ happy.

---

### Step 7 Tests — telemetry whitelist additions

| ID | Category | Test Description |
| --- | --- | --- |
| T-0008-144 | Happy | `writeEvent('share_link.created', {share_id_prefix: 'aBcD', source_archetype: 'tracker'})` writes a row in `events`. |
| T-0008-145 | Happy | `writeEvent('share_link.clone_accepted', {share_id_prefix, idempotent_hit: false, source_archetype})` writes. |
| T-0008-146 | Happy | `writeEvent('share_link.reserved_mode_viewed', {share_id_prefix, mode: 'view'})` writes. |
| T-0008-147 | Failure | `writeEvent('share_link.created', {share_id: 'full24chars'})` throws `EventPayloadValidationError` — `share_id` (full) is NOT whitelisted; only `share_id_prefix` is. (Privacy: full share_id is the URL token; telemetry takes only the bucket prefix.) |
| T-0008-148 | Documentation | `writeEvent('share_link.clone_accepted', {idempotent_hit: 'string'})` — schema enforces boolean? (No — whitelist is key-name only; runtime type enforcement is the caller's responsibility. This test confirms key-name validation only, not value-type validation. Documents the boundary; the call does NOT throw.) |
| T-0008-149 | Failure | `writeEvent('share_link.unknown_event', {...})` throws — event type not in `EventType` union. |
| T-0008-150 | Regression | EVAL_MODE=true short-circuits DB insert for the new event types (carryover behavior). |
| T-0008-151 | Regression | Existing event types (`generate.completed` etc.) continue to whitelist correctly — no cross-contamination. |
| T-0008-152 | Coverage | All 3 new event types appear in `EVENT_PAYLOAD_WHITELIST` (test enumerates and asserts). |
| T-0008-147b | Failure / missing-test-6 | `writeEvent('share_link.clone_accepted', {share_id_prefix, idempotent_hit: true, source_archetype, extra_key: 'leak'})` throws `EventPayloadValidationError` — parallels T-0008-147 for the `share_link.created` event. Confirms extra-key whitelist enforcement on the clone_accepted event. |
| T-0008-152b | Happy / P1-5 | **Client-side telemetry whitelist — valid keys.** In `apps/mobile/src/lib/telemetry.test.ts`: `telemetry.emit('share_link_copied', {share_id_prefix: 'aBcD', source_archetype: 'tracker'})` succeeds (writes to the client breadcrumb/Langfuse buffer per existing M1 pattern; no throw). Mirrors the server-side T-0008-144 pattern. |
| T-0008-152c | Failure / P1-5 | **Client-side telemetry whitelist — invalid keys.** `telemetry.emit('share_link_copied', {invalid_key: 'x'})` throws `EventPayloadValidationError` (or the client-side equivalent if the existing M1 client-side module uses a different name — match the existing exception). Mirrors the server-side T-0008-147 pattern. Confirms AC-T1's whitelist requirement applies to the client surface, not just the server surface. |
| T-0008-152d | Happy / P1-5 | `telemetry.emit('link_clone_opened', {share_id_prefix, idempotent_hit: false, source_archetype})` succeeds. Parallels T-0008-152b for the second client-side event added by ADR-0008. |
| T-0008-152e | Failure / P1-5 | `telemetry.emit('link_clone_opened', {extra_key: 'x'})` throws. Parallels T-0008-152c for the second client-side event. |

#### Step 7 Test Summary

| Category | Count |
| --- | --- |
| Happy | 5 |
| Failure | 5 |
| Regression | 2 |
| Coverage | 1 |
| Documentation | 1 |
| **Total** | **14** |

_Notes:_ 5 new tests added in this revision (T-0008-147b, 152b, 152c,
152d, 152e). T-0008-148 reclassified from Failure to Documentation
(the call does not throw — whitelist enforces key-names only, and the
test documents that boundary). Failure:happy = 5:5 satisfies the ≥ rule.

---

### Test Totals

| Step | New | Regression | Total |
| --- | --- | --- | --- |
| 1 — schema | 17 | 4 | 21 |
| 2 — AASA | 14 | 2 | 16 |
| 3 — server endpoints | 52 | 3 | 55 |
| 4 — Linking surface | 24 | 3 | 27 |
| 5 — pending intent | 21 | 2 | 23 |
| 6 — action handlers | 10 | 2 | 12 |
| 7 — telemetry | 12 | 2 | 14 |
| **Total** | **150** | **18** | **168** |

_Revision delta vs original ADR-0008:_ +16 new tests (Step 3: +5,
Step 4: +1, Step 5: +4, Step 6: +1, Step 7: +5). Regression count
unchanged. Total grows from 152 → 168.

### Test Helpers & Mocks

- `services/api/test/factories.ts` — extend with `makeShareLink(opts)` and
  `makeShareLinkClone(opts)` helpers. Defaults produce valid rows for
  most tests; tests override specific fields for failure cases.
- `services/api/test/fastifyHarness.ts` — already exists; share-link
  routes hook in via `buildServer()`.
- `apps/mobile/src/__mocks__/expo-secure-store.ts` — extend to support
  the `pendingClone.shareId.v1` key AND a per-test toggle to make
  `getItemAsync` / `setItemAsync` reject (used by T-0008-118b and
  T-0008-129b). Most M1 secure-store tests use a generic in-memory
  mock; verify it doesn't conflict.
- `apps/mobile/src/__mocks__/expo-linking.ts` — new. Mock
  `getInitialURL`, `addEventListener`, `useURL`. M1 has a partial mock
  for `useURL`; this extends it. T-0008-113b drives `getInitialURL`
  with the M1 `appcreator://auth?...` shape.
- `apps/mobile/src/__mocks__/expo-clipboard.ts` — new. Mock
  `setStringAsync` with a per-test toggle to reject (T-0008-143b).
- `apps/mobile/src/__mocks__/expo-haptics.ts` — new. Mock
  `impactAsync`.
- ksuid generation — Step 3 services use the `ksuid` npm package. Tests
  generate ksuids in-line (no mock needed); the package is deterministic
  given a clock so distribution tests are reliable.

### Coverage Gates

- New code in `services/api/src/services/shareLinks.ts` and
  `services/api/src/routes/{shareLinks,clones,wellKnown}.ts` must hit
  ≥95% line coverage and ≥90% branch coverage.
- New code in `apps/mobile/src/lib/universalLink.ts` and `pendingClone.ts`
  must hit ≥95% line coverage (small, pure modules).
- The 21 schema tests in Step 1 are not coverage gates per se but must
  all pass (they're contract assertions on the migration).

---

## UX Requirements (if applicable)

ADR-0008 owns the data flow and action handlers. The screen-level UX is
ADR-0011's surface (host shell, meatball menu, celebration sheet,
coachmark, sign-in resume). The hand-off contract:

- Host shell calls `useCreateShareLinkMutation()` from the meatball
  Share action. The mutation handles clipboard + haptic + toast +
  telemetry. Host shell does NOT need to re-implement these.
- Host shell calls `useCloneMutation()` after `popPendingClone()`
  returns a share_id post-SIWA. The mutation invalidates the Library
  query; host shell handles the celebration sheet + navigation to the
  cloned mini_app's Run mode.
- For reserved-mode links (`view`, `remix`), the
  `useUniversalLink.onReservedMode` callback in the host shell renders
  Sable's "coming soon" screen — that's not ADR-0008's surface, but
  the parsed `ParsedUniversalLink` shape is what the screen receives.

Sable's coachmark + first-launch celebration sheet UX details are
binding for ADR-0011 to implement; ADR-0008 ensures the data and the
intent-replay are in place so the celebration can fire on the right
mount.

---

## Data Sensitivity

| Store Method | Returns | Sensitivity |
| --- | --- | --- |
| `createShareLink({miniAppId, userId})` | `{shareId, universalLink}` | **public-safe** — share_id is the public capability, universal_link is its expansion. NEVER includes mini_app_version_id, source_owner_id, or cover_art_seed. |
| `getShareLinkInternal(shareId)` | `{shareId, miniAppVersionId, ownerUserId, coverStance, coverPalette, coverIcon, coverArtSeed, createdAt, revokedAt}` | **auth-only / internal-only** — used only inside the service layer. NEVER serialized to a response. `miniAppVersionId` and `ownerUserId` are the leak risks (AC-P8). |
| `getShareLinkPublicView(shareId)` | `{shareId, coverStance, coverPalette, coverIcon, coverArtSeed, modes: {clone, view, remix}}` | **public-safe** — explicitly excludes mini_app_version_id, ownerUserId, mini_app_id, spec_json. Used by mobile to render the reserved-mode screen with cover identity. |
| `acceptCloneIntent({shareId, clonerUserId})` | `{mini_app: PublicMiniApp, current_version: PublicVersion, created: boolean}` | **auth-only** (caller's session required). The returned `mini_app` is the **cloner's** new row; NEVER contains source identifiers. `PublicMiniApp` type is `Omit<MiniApp, 'source_*'>` enforced compile-time. |
| `revokeShareLink({shareId, ownerUserId})` | `{revoked: true}` | **V0.5** — not implemented in V0. The schema (`revoked_at` column) supports it without migration. |

**Excluded fields (NEVER in any public-facing response):**

- `share_links.mini_app_version_id`
- `share_links.owner_user_id` (the source creator)
- `share_link_clones.share_link_id` (could be used to find the source via lookup)
- Any field starting with `source_` on the cloner's mini_app (defensive — none should be created in the first place; AC-P8 says source data isn't even persisted on the clone)

**Source-data-leak guard:** `acceptCloneIntent` returns a type
`PublicMiniApp` that is structurally `Omit<MiniApp, 'parentMiniAppId' |
'sourceShareLinkId' | ...>`. There's no `parent_mini_app_id` column on
the cloned `mini_apps` row (intentional — V0 has no "clone lineage"
feature; if we add it in V0.5, the column ships then, and the public
view will need to add a `Omit` for it). Compile-time guard:
T-0008-085 / T-0008-087 assert the type.

---

## CI/CD Impact

| Job | Config File | Impact | Required Change |
| --- | --- | --- | --- |
| `api.yml` (existing) | `.github/workflows/api.yml` (or equivalent) | New routes + migration tested via Jest. | Add new test files to coverage gate. No structural change. |
| `mobile.yml` (existing) | `.github/workflows/mobile.yml` | New `universalLink.ts` + `pendingClone.ts` + queries. | Add new test files. |
| `aasa-smoke.yml` (NEW) | `.github/workflows/aasa-smoke.yml` | Post-deploy smoke. Curls `https://canvas.app/.well-known/apple-app-site-association` from the production deploy and asserts: HTTP 200, Content-Type exact (`application/json`), body parses as JSON, body's `applinks.details[0].appID` matches **exactly** the workflow's `APPLE_APP_ID_PREFIX` env (sourced from the same GitHub Actions secret used by the API deploy — single source of truth), body's `applinks.details[0].paths` is exactly `['/m/*']`. Runs after the API deploy job. ~5s wall-clock. | Eva (DevOps) authors. Triggered on push to main + post-deploy. |
| `eval.yml` (existing — ADR-0007) | unchanged | No impact — eval runs on prompt/protocol surfaces, not on the share-link surface. | None. |
| `codegen-drift.yml` (existing — ADR-0005) | unchanged | No impact — share-link types are not codegen targets. | None. |

**App Store Connect change (NOT a CI/CD job but a DevOps prerequisite):**

- Add **Associated Domains** capability to the App ID for
  `com.appcreator.mvp` in App Store Connect.
- After capability change, a new dev-client build is required
  (`eas build --profile development`). Existing dev-clients won't have
  the entitlement.
- Eva owns; lead time ~1 day.

**Pre-Step-4 checklist for Eva (P2-3):** the following must be true
before Colby starts Step 4 (`apps/mobile/app.config.ts` adds
`associatedDomains`):

- [ ] Associated Domains capability added to the App ID for
      `com.appcreator.mvp` in App Store Connect.
- [ ] Capability change confirmed live (TestFlight build attempt
      should not fail with "missing entitlement").
- [ ] `APPLE_APP_ID_PREFIX` GitHub Actions secret populated with the
      `TEAMID.com.appcreator.mvp` value (used by both API deploy and
      `aasa-smoke.yml`).
- [ ] Domain `canvas.app` confirmed owned by the project (PM/DevOps
      §Negative consequence above) — DNS resolves and HTTPS terminates
      on the API load balancer.

Without these four, the AASA file can serve but iOS will refuse the
association, and Colby's Step 4 will look like it works in dev (custom
scheme path) while silently failing for real Universal Links.

---

## Documentation Impact

| Doc | Path | What Changes |
| --- | --- | --- |
| Product spec | `docs/product/canvas-v0.md` §API Contracts | Append `POST /mini-apps/:id/share`, `GET /share-links/:share_id`, `POST /mini-apps/clone` with their public-safe response shapes. AC-P7/P8/P9 get T-ID references back to `T-0008-*`. |
| Product spec — AC-P2 deviation | `docs/product/canvas-v0.md` AC-P2 (line ~374) | Add a cross-reference note: "Clone-creation path (per ADR-0008) overrides AC-P2's `first 40 chars of prompt` fallback to literal `'Shared tool'` — see ADR-0008 Step 3 §AC for rationale (source prompt is source-owner data per AC-P8)." Two-line addition. Lands in same PR as ADR-0008 Step 3 implementation. (P1-4 fix.) |
| ADR-0005 §Downstream Consumers | `docs/adrs/ADR-0005-canvas-v0-protocol-and-design-system.md` | Add a one-paragraph note: ADR-0008 lands the `share_links` schema referenced in §K. Cover-art identity (`cover_stance`, `cover_palette`, `cover_icon`, `cover_art_seed`) is persisted there exactly as specified. |
| ADR-0011 dependency | `docs/adrs/ADR-0011-mobile-shells-siwa.md` (in flight) | ADR-0011 should declare ADR-0008 as a downstream consumer of its SIWA flow and the `mini_app` rename. The two ADRs are mutually referencing. |
| iOS Info.plist (generated) | `apps/mobile/ios/AppCreator/Info.plist` (via Expo prebuild) | After `app.config.ts` change + prebuild, the `com.apple.developer.associated-domains` entitlement appears in the generated entitlements plist. Not hand-edited. |
| CLAUDE.md §Workspaces | `CLAUDE.md` | One line: `services/api/src/routes/wellKnown.ts` serves the AASA file; do not move without DevOps coordination. |
| ADR index | `.claude/references/adr-index.md` | **Not by Cal.** Ellis owns row insertion post-commit. |

---

## Notes for Colby

1. **The schema-rename dependency on ADR-0011 is real.** Do not attempt
   to write migration `0008_share_links.sql` against the current
   `projects` / `project_versions` tables. If ADR-0011 hasn't landed
   when you pick up Step 1, raise the block via `rn-executor.md`'s
   protocol — don't paper over it.

2. **ksuid library: pin the version.** `ksuid@^3.0.0` is the npm
   package. ADR-0005's spec for the 24-char form uses base62 (their
   default). Verify the package's `KSUID.randomSync().string` produces
   24 chars in base62. Lock the dep.

3. **AASA file: NO trailing newline.** Some HTTP clients add one;
   Apple's parser doesn't care, but the snapshot test must not depend
   on it. Use `JSON.stringify(obj)` exactly, no `\n` appended.

4. **`acceptCloneIntent` is THE security-critical function.** Read AC-P8
   three times before you write it. The response type's TypeScript
   shape is the compile-time guard; the runtime serialization tests
   (T-0008-085..087) are the runtime guard; the `Omit<>` types are the
   IDE-level guard. All three layers are mandatory.

5. **Idempotency via DB unique constraint, not application-level
   check-then-insert.** Use `INSERT ... ON CONFLICT (share_link_id,
   cloner_user_id) DO NOTHING RETURNING id` and re-fetch on conflict.
   The "check then insert" pattern races; the DB constraint doesn't.
   T-0008-070 exercises this.

6. **`expo-secure-store` is async even on read.** `popPendingClone()`
   must `await` the get AND the delete. Doing them in parallel
   (Promise.all) is *not* safe — the delete needs to happen after the
   value is read out, or you lose the value on transient failure.

7. **Linking event listener cleanup.** RN's `addEventListener('url',
   handler)` returns a `{remove: () => void}` subscription. The
   `useUniversalLink` hook MUST return the cleanup function from
   `useEffect` (T-0008-111). M1's `useAuthDeepLink` doesn't have this
   issue because it uses `Linking.useURL()` (no event listener); our
   hook does, so handle the cleanup.

8. **Telemetry payload — `share_id_prefix`, not `share_id`.** The
   first 4 chars of the ksuid are a sortable time bucket (per ksuid's
   construction). The full share_id is a public capability — putting
   it in analytics logs is a privacy leak (anyone with log access
   could replay the URL). Prefix-only.

9. **Don't bake the App Store URL into the app.** When the
   uninstalled-friend fallback is later built (out of scope for
   ADR-0008), the install-gate page is the right surface — not an
   in-app workaround.

10. **iOS Info.plist verification.** After `expo prebuild`, manually
    inspect `apps/mobile/ios/AppCreator/AppCreator.entitlements` for
    the line:
    ```xml
    <key>com.apple.developer.associated-domains</key>
    <array>
      <string>applinks:canvas.app</string>
    </array>
    ```
    If missing, the build will succeed but the Universal Link won't
    open the app. Add the manual check to the Step 4 acceptance
    criteria for your PR.

11. **Test the cold-start path on a real device.** Simulator's
    Universal Link handling is unreliable. The cold-start case
    (`Linking.getInitialURL`) is the one Eva should sanity-check on
    physical hardware before TestFlight submission.

12. **Don't add the OS share sheet in V0.** The brief and Sable's UX
    both say "copy link" — that's the V0 surface. The iOS share sheet
    is a V0.5 follow-up. T-0008-143 enforces.

13. **The `share` action verb stays cut.** ADR-0005 §D / F-4 cut the
    `share` action verb from the renderer. ADR-0008 does not
    reintroduce it. Share lives in host chrome only — meatball menu
    on the Run-mode header. The renderer cannot dispatch a share
    action; this ADR doesn't change that.

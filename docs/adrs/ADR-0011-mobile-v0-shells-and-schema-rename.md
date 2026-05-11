# ADR-0011: Mobile V0 Shells + `mini_app` Schema Rename

_Authored by Cal — 2026-05-10_

## Status

Proposed

> Sibling ADRs in flight: **ADR-0008** (Universal Links + share/clone) and
> **ADR-0010** (Prompt engineering loop). This ADR exposes named hooks for
> both — see §Coordination. **ADR-0013** (Sign in with Apple) is the
> deferred companion authored after ADR-0011 lands; see §Decision 9 for
> why SIWA is split out instead of folded in.
>
> **Cross-ADR Reconciliation (added in R2 revision per Roz P0-5):**
> ADR-0011 declares the dev-menu deep-link grammar
> `appcreator://devmenu/load-spec?fixture=<name>` **AUTHORITATIVE**.
> ADR-0010 Step 6's reference to `canvas://eval-fixture/{prompt_id}`
> is stale — it predates ADR-0011's deletion of `AppRunnerScreen`
> (Step 11). ADR-0010 must be patched in a follow-up edit to use
> ADR-0011's grammar. See §Coordination → ADR-0010 for the grammar
> mismatch coordination note and T-0011-321a for the consistency
> verification test.

---

## Context

Canvas V0 (M2 milestone) is closing out. The protocol (ADR-0005), renderer
(ADR-0006), generation pipeline (ADR-0007), and out-of-scope intent storage
have all landed. What remains — the largest single architectural piece
remaining for V0 — is the **mobile shell**: the five host-app screens that
sit around the V0 Renderer and the API surface that backs them.

Today the mobile app ships **M1-shape screens**: `SignIn` (magic-link),
`Home`, `Chat`, `AppRunner`. Routes are `GET /me/projects`,
`GET /me/projects/:id`. The DB tables are `projects` and `project_versions`.
The state-queries module is `state/queries/projects.ts`.

The V0 product spec (`docs/product/canvas-v0.md`) and Sable's UX doc
(`docs/ux/canvas-v0-ux.md`) require **five new shells**:

1. **Sign In** — Apple-branded button, single CTA, footer micro-copy.
2. **Library tab** — 2-column FlashList grid of cover-art cards, search,
   filter chips (All / Mine / Shared with me), long-press action sheet,
   empty state, header avatar that opens Settings.
3. **Create tab** — multi-line prompt input, mic-icon placeholder, 6
   rotated suggested-prompt chips, FAB submit, "editing pill" when
   re-prompting an existing tool.
4. **Generating screen + Run-mode host chrome** — client-paced determinate
   progress bar (7s linear → 75% → 95% hold), 3 cycled messages, then
   crossfade into Run mode (thin host header + persistent tab bar
   wrapping the V0 Renderer's tree).
5. **Settings sheet** — Gorhom Bottom Sheet at 75% height with Account /
   Coming-Next-Update / About / Account-Actions sections.

Plus three surfaces the shells consume:

- **Out-of-Scope Surface** (full-screen takeover, per-capability
  illustration, email capture) — the mobile UX consumer of the existing
  `POST /out-of-scope-intent` route (ADR-0007 Step 5).
- **Quota-Exhausted Surface** (full-screen takeover, hourglass, reset
  time).
- **First-time-user coachmark** on the meatball icon.

And the V0 product contract requires the table names to be
**`mini_app` / `mini_app_version`** (`docs/product/canvas-v0.md` §AC-P,
§API Contracts). Today they are `projects` / `project_versions`.

### Forces

- **Sable's UX doc is the binding visual contract.** Five screens, three
  surfaces, motion vocabulary, accessibility hooks — all specified at
  pixel-level. The architecture obeys.
- **Tab structure is locked by the brief** to 2 tabs (Library, Create).
  Settings is a sheet triggered by the avatar in the Library header.
  Run is a mode pushed on top of Library — not a tab.
- **The protocol contract is settled.** `Spec`, `Stance`, `Palette`,
  `mini_app` rename — all of this comes from
  `@app-creator/protocol`. The shells consume but do not redefine.
- **The renderer is settled.** `RendererThemeProvider`, `HostProvider`,
  `NodeRenderer`, `useRendererState` — all live in
  `@app-creator/a2ui-renderer/v0` and are stable (ADR-0006). The Run
  shell mounts them.
- **The DB rename is mechanical** because there is no production data.
  V0 has not shipped; no App Store install cohort exists. This makes
  rename-in-place safe and lets us drop M1's naming with no
  dual-write penalty.
- **SIWA is its own animal.** Apple Developer setup, Service ID
  configuration, identity-token verification on the API, on-device
  capability detection, deferred-deep-link round-trip — all of these
  are cross-cutting infra that should not be tangled with the shell
  architecture. ADR-0013 owns SIWA.
- **Cost of inaction.** Without this ADR, V0 ships M1 shells inside a V0
  catalog. The brief's "App Store visual variety" requirement
  (canvas-v0-brief.md §3) is unmeetable; first-time-user retention
  is unrecoverable from a sign-in screen that says "Email me a magic
  link" instead of "Sign in with Apple."

### What if we do nothing

The renderer renders V0 specs against the M1 shells. The Library card
grid uses M1 spacing and typography; the Create screen has no FAB,
no suggested-prompt chips, no character counter; Run mode has no host
chrome. Cover-art cards never appear. App Store submission cannot
proceed because the positioning copy lives on M1 screens. V0 launch
slips by 3-4 weeks while the shell catches up — and the slip is
charged against the H5 measurement window, not the build budget.

---

## Decision

**Author this ADR as a single scope** covering (A) mobile shell refactor
+ (B) `mini_app` schema rename. **Defer Sign in with Apple to ADR-0013.**
Implementation runs as **three sequential phases** across **14 steps**.

### 1. Scope split — two ADRs, not one or three

I considered three options:

| Option | Upside | Why not |
| --- | --- | --- |
| **Single monolith ADR** (shells + rename + SIWA) | One PR sequence, single test pass | SIWA is infra-heavy (Apple Developer console, Service ID, JWKS validation, dev-client capability) and entirely orthogonal to the shell refactor. Folding it in concentrates 3 high-risk surfaces in one ADR and makes step ordering brittle (shell step can't depend on SIWA step or vice versa without circular waits). |
| **Three ADRs** (shells / rename / SIWA) | Maximum isolation | Shells and the schema rename are tightly coupled on the mobile side: every state-queries change touches a screen file. Splitting them produces a 4-PR dance with no clean cut point and forces double-renaming of types like `Project` → `MiniApp` in the middle. |
| **Two ADRs: 0011 (shells + rename), 0013 (SIWA)** ✅ | Shells and rename ship as one cohesive refactor. SIWA ships independently behind a feature flag; shells keep magic-link working until SIWA flips the source. | Requires one feature flag (`AUTH_PROVIDER`) for the cutover. Acceptable cost. |

**The two-ADR split is the right call.** ADR-0011 ships V0's visual
surface against magic-link auth. ADR-0013 rips out magic-link and
wires SIWA, touching only `services/api/src/lib/auth.ts`,
`services/api/src/routes/auth.ts`, the mobile `useSession` hook, and
the Sign In screen's button. The two ADRs are independently mergeable
in either order; ADR-0011 lands first because its scope is heavier
and SIWA can ship a week later without slipping the launch window
(SIWA is week-5 infra; ADR-0011 covers weeks 1-4 shell work).

### 2. Schema rename strategy — Option A (rename in place)

I considered three options:

| Option | Upside | Why not |
| --- | --- | --- |
| **A. Rename in place** (single migration: `ALTER TABLE projects RENAME TO mini_apps; ALTER TABLE project_versions RENAME TO mini_app_versions;` + column renames where the join columns embed the old name) ✅ | Single migration, single transaction, zero ambiguity in code. | None at this lifecycle stage. |
| **B. New tables + dual-write** | Safe rollback on a live system | There is no live system. Adding 250+ LOC of dual-write logic to support zero users is paranoia. |
| **C. New tables + cutover** | Avoids `ALTER TABLE` lock concerns | `ALTER TABLE RENAME` is metadata-only in Postgres (no table rewrite); the lock concern is irrelevant for `projects` + `project_versions` which are <1MB combined in dev. |

**Decision: Option A.** Single migration `0007_mini_app_rename.sql`
renames the tables, the FKs (`projectId` → `miniAppId`,
`parentProjectId` → `parentMiniAppId`, `projectVersions.projectId` →
`miniAppVersions.miniAppId`), the indexes (`projects_owner_idx` →
`mini_apps_owner_idx`, etc.), and the per-row `original_prompt` column
stays as-is. The Drizzle schema file mirrors the rename in TypeScript;
the service layer, route handlers, and state-queries module all
re-export their types under `MiniApp` / `MiniAppVersion` /
`MiniAppListItem` / `MiniAppDetail`. The old `Project*` type names are
**deleted, not aliased** — aliases postpone the rename forever.

Production-data check: I verified the env file structure
(`services/api/src/lib/env.ts` + the `.env` files) — there is no
production database connected to this repo today. The only data is
dev/test fixtures. Confirmed safe.

### 3. Mobile shell architecture — tab navigator with stack-per-tab + sheets

I considered three navigation shapes:

| Option | Upside | Why not |
| --- | --- | --- |
| **Tab navigator with stack-per-tab + sheets** ✅ | Matches Sable's spec exactly: 2 tabs (Library, Create), Library tab has Run pushed on top, Settings is a sheet, Create has the Generating screen pushed full-screen on top. Standard React Navigation pattern; no surprises. | None. |
| **Single stack with bottom-tab-bar as a component** | Lighter abstraction | Settings-as-sheet still needs Gorhom; Run-on-top-of-Library still needs a stack. Doesn't save anything. |
| **Drawer + stack** | — | iOS HIG hostile; rejected by Sable's spec (§Tab bar). |

**Decision: React Navigation native-stack with a TabBar component
overlay**, not React Navigation's bottom-tab navigator. Reason:
Sable's spec puts the tab bar **on top of every screen including Run
mode** (canvas-v0.md AC-R6: "Host chrome is present on every Run-mode
screen"), and React Navigation's standard bottom-tab navigator wires
the tab bar at the navigator level, not the screen level. With a
shared TabBar component rendered by each screen's parent layout, the
Run screen can host its full body — including the V0 Renderer's
internal nav patterns (`stack`, `tabs`, `modal-overlay`) — without
the host tab bar ever being unmounted.

The navigator shape is:

```
NavigationContainer
  └── RootStack (native-stack)
       ├── if unauthenticated → SignInScreen
       └── if authenticated   → ShellLayout (renders TabBar + active tab content)
            ├── LibraryStack (native-stack)
            │   ├── LibraryScreen          (default)
            │   ├── RunScreen              (push)
            │   └── CreateRedirectScreen   (push, when arriving via "Make changes")
            └── CreateStack (native-stack)
                ├── CreateScreen           (default)
                └── GeneratingScreen       (push, modal-style — no host chrome)
       (Settings is Gorhom Bottom Sheet hosted at ShellLayout level)
       (OutOfScopeScreen + QuotaExhaustedScreen are full-screen takeovers
        from GeneratingScreen — replace, not push)
```

This satisfies Sable's chrome rule: **the tab bar is rendered by
`ShellLayout`, not by the navigator**. The Generating screen
intentionally hides the tab bar by being a modal-style full-screen
push (`presentation: 'fullScreenModal'`); the host header is omitted
on Generating and on the Sign-In screen.

### 4. Tab structure — 2 tabs, Settings as sheet

Confirmed by canvas-v0-brief.md §3.5 and canvas-v0-ux.md §Tab bar.
Tabs: **Library** (icon `grid-2x2`) and **Create** (icon `sparkles`).
Settings opens via the Library header's trailing avatar (32pt
circular). No "Settings" tab. No "Inbox" tab (V0.5).

### 5. Library tab — precise spec

| Surface | Spec |
| --- | --- |
| Header | 44pt; title "Library" left, avatar 32pt right (tap → Settings sheet) |
| Search + filter row | Sticky; 56pt; search field 90% width, leading `search` icon, placeholder "Search your tools"; filter chip row below: All / Mine / Shared with me |
| Grid | FlashList, 2 columns; card aspect ratio 4:5; cover-art top, title row 1, subtitle (relative time) row 2 |
| Empty state | Illustration (cream-palette `library-empty.svg` shipped in `apps/mobile/assets/`) + headline "What do you want to build?" + 3 chip prompts → pre-fill Create |
| Long-press card | 100ms scale + light haptic → Gorhom action sheet: Open / Share / Make changes / Archive / Delete (destructive — confirmation alert) |
| Pull to refresh | Re-fetch `GET /mini-apps`; announces "Refreshed" or "No new tools" |

Search is **client-side substring** (case-insensitive) on the title
field. Server-side search is deferred — at V0 launch scale (<100 tools
per user) the cost of a query roundtrip exceeds the cost of a
JavaScript substring scan, and the search box stays responsive on
keystroke. Re-evaluate at V1.

Filter chips are **client-side stance/source filter**:
- **All** (default): everything `useLibraryQuery` returns.
- **Mine**: tools where `parent_mini_app_id IS NULL` (created from
  scratch by this user).
- **Shared with me**: tools where `parent_mini_app_id IS NOT NULL`
  (clones from a friend's Universal Link, per AC-P8).

This is exactly the data the existing `parentProjectId` column carries
(post-rename: `parentMiniAppId`). No new server surface needed for V0.
Archetype/age filtering deferred to V0.5.

### 6. Create tab — precise spec

| Surface | Spec |
| --- | --- |
| Header | 44pt; title "Create" left; no trailing element |
| Prompt input | Multi-line, `bg-elevated`, `radius-md`, `divider` border; max 5 lines visible then internal scroll; placeholder "Describe a tool you want." |
| Mic icon | Inside input, right-aligned; **V0: tappable placeholder.** Tap opens a Gorhom sheet "Voice input is coming soon — want to be notified?" reusing the Out-of-Scope email-capture pattern with `capability='transcription'`. |
| Character counter | Appears at 1800+; turns `danger` color at 1900+; live-region announce once at 1900 and once at 2000 |
| Suggested-prompt chips | 6 chips, 2 cols × 3 rows; each 44pt tall, `radius-full`, `bg-elevated`, `divider` border, emoji + prompt text |
| Editing pill | Above input, dismissable: "Editing 'Workouts' [×]"; present only when arriving from "Make changes." If dismissed → next submit creates a new tool |
| FAB | 56pt circle, `accent` bg, `send` icon; disabled at 50% opacity when input empty/whitespace/over 2000 chars |

**Suggested-prompt pool: 10 curated prompts** from canvas-v0-brief.md
§3.10. The 6 shown on any Create open are picked deterministically
from a per-app-session seed (`crypto.randomUUID()` at app launch) so
the user sees the same 6 within a session but different sets across
sessions. The shuffle uses a Fisher-Yates seeded by the session UUID.
Picking deterministically-per-session means a user who scrolls away
and comes back doesn't see chips reshuffle (jarring). Test fixture: a
known seed yields a known pick order.

Suggested prompts live in
`apps/mobile/src/screens/Create/suggestedPrompts.ts` as a hand-edited
const array. PM is the source of truth (canvas-v0-brief.md §3.10) and
edits ship as constant changes; the curated set is **not** server-side
fetched (V0 has no remote-config surface and we are not building one).

### 7. Run mode host chrome — wrapper around `<HostProvider>` + `<NodeRenderer>`

The Run screen mounts the V0 Renderer inside an app-shell wrapper that
adds host header + tab bar. The renderer remains pure
(`{node, state, dispatch}`); the wrapper handles app-shell concerns:

```tsx
// apps/mobile/src/screens/Run/RunScreen.tsx — shape sketch only
function RunScreen({route}: NativeStackScreenProps<LibraryStackParamList, 'Run'>) {
  const {data, error, isLoading} = useMiniAppQuery(route.params.miniAppId)
  if (isLoading) return <RunSkeleton />
  if (error) return <RunFailedBanner error={error} />
  if (!data) return <NotFoundScreen />

  return (
    <ShellLayout activeTab="library" headerSlot={<RunHeader miniApp={data.miniApp} />}>
      <RendererThemeProvider stance={data.miniApp.stance} palette={data.miniApp.accentPalette}>
        <HostProvider callbacks={hostCallbacks}>
          <NodeRenderer node={data.currentVersion.specJson.screens[0].root} />
        </HostProvider>
      </RendererThemeProvider>
      <FirstRunCoachmark anchor="meatball" />
    </ShellLayout>
  )
}
```

- **Host header**: 32pt thin bar (per Sable's spec). Leading
  `chevron-left` back arrow, center title (`type-body` 600 weight,
  ellipsize), trailing `more-horizontal` meatball.
- **Meatball menu**: Gorhom action sheet. Items: Open / Share / Make
  changes / Archive / Rename / Delete. Share copies the Universal Link
  to clipboard via `Clipboard.setStringAsync` and fires
  `share_link_copied` telemetry (the actual share URL is generated
  client-side from `share_id` returned by `POST /mini-apps/:id/share` —
  ADR-0008 owns the URL grammar).
- **Coachmark**: First-time-only, anchored to the meatball icon's
  measured position, dismissed by tap-outside / "Got it" / tap-meatball
  / 8s timeout. Persisted in `expo-secure-store` as
  `coachmark_share_seen=true` (per Sable's Note for Cal #7).

### 8. Settings sheet — Gorhom Bottom Sheet at 75% height

Triggered by tap on the Library header avatar. Per
canvas-v0-ux.md §Screen 5:

| Section | Rows |
| --- | --- |
| Account | Avatar + display name + masked email |
| Coming next update | V0.5 capability waitlist pills (from per-user out-of-scope intents) — see §10 for the API surface |
| About | Terms (web), Privacy (web), Help (mailto), Version + build number |
| Account actions | Sign out (destructive text), Delete account (destructive — confirmation alert) |

**Sign out** clears `expo-secure-store` session token + invalidates
TanStack Query cache + navigates to SignInScreen. **Delete account**
is V0.5 in-product self-serve per canvas-v0.md §Privacy NFR; the V0
button surfaces a confirmation alert and a "Email <support>" prompt.
The button is wired but does not call a delete endpoint in V0.

### 9. SIWA — deferred to ADR-0013

Reasoning recap:

- **Risk separation.** SIWA touches Apple Developer console (Service
  ID, key generation, App ID capability), iOS dev-client native module
  (`expo-apple-authentication`), API identity-token verification
  against Apple JWKS, deferred-deep-link Branch SDK integration.
  Folding into ADR-0011 doubles the surface of an already-large
  refactor.
- **Sequencing.** Shells can ship against existing magic-link auth.
  ADR-0011 keeps the Sign-In screen's button hooked to
  `POST /auth/magic-link`, just with Sable's visual treatment. When
  ADR-0013 lands, the button's `onPress` is swapped to
  `signInWithApple()` and the server's `POST /auth/apple` validates
  the identity token. No mobile screens change at SIWA cutover except
  the Sign-In button text and handler.
- **Behind a feature flag.** Mobile env var `EXPO_PUBLIC_AUTH_PROVIDER`
  (one of `magic-link` | `apple`, default `magic-link` in V0
  shipping until ADR-0013 lands). Server env var `AUTH_PROVIDER` mirrors.
  ADR-0013 flips both to `apple`.

**No magic-link migration of M1 users** since there are none. SIWA
ships as the canonical V0 auth source; magic-link disappears with
ADR-0013's merge.

### 10. Settings → V0.5 waitlist — new GET endpoint

The Settings sheet's "Coming next update" section needs to read the
**current user's out-of-scope intents grouped by capability**. ADR-0007
shipped only `POST /out-of-scope-intent` (write). I'm adding a read
endpoint as part of ADR-0011 Step 5:

**`GET /me/out-of-scope-intents`** (auth-required) → returns:
```ts
{
  intents: Array<{
    capability: 'image_gen' | 'vision' | 'chat' | 'transcription' | 'classification' | 'unknown'
    lastCapturedAt: string  // ISO8601
    capturedCount: number   // de-duped per-user-per-capability
    notifyOptIn: boolean    // from a new column on out_of_scope_intent: notify_opt_in
  }>
}
```

Sensitivity: **auth-only**. Returns only the caller's rows. Email is
**not** returned (it was captured for V0.5 notification; settings sheet
doesn't need to re-display it).

New column on `out_of_scope_intent`: `notify_opt_in BOOLEAN NOT NULL
DEFAULT false`. The Settings sheet's per-capability toggle calls a
new **`PATCH /me/out-of-scope-intents/:capability`** endpoint with
`{notify_opt_in: bool}`. The capability is keyed by the closed enum;
the PATCH updates all of the caller's rows for that capability in
one statement.

Both endpoints land in this ADR (Step 5), in a new
`services/api/src/routes/me.ts` file that owns the `/me/*` namespace.

### 11. Out-of-scope mobile UX — full-screen takeover from Generating

When the SSE stream from `POST /generate` emits a final event of shape
`{out_of_scope: {capability, reason}}` (existing ADR-0007 contract),
the Generating screen crossfades into the Out-of-Scope Screen (Step 9
of this ADR). The screen:

1. Renders the per-capability illustration from
   `apps/mobile/src/illustrations/<capability>.svg` (5 illustrations
   ship as part of Step 9 — design system handoff from Sable).
2. Shows headline "Almost — but not yet." + per-capability body copy
   (the 5 strings are constants in `screens/OutOfScope/copy.ts`).
3. Email field, pre-filled from the session's user email (we have it
   from the JWT claim; for SIWA the field comes from
   `apple_id_relay_email` which is the masked Apple ID — see
   ADR-0013).
4. **Submit** → `POST /out-of-scope-intent` with
   `{capability, prompt_hash, reason, email}` per the existing route
   contract; on success, replace primary content with a confirmation
   tick and a single "Try a different idea" CTA → Create.

If submit fails (network/500), toast and keep the field. If the user
hits Back without submitting, telemetry still fires `out_of_scope_intent`
event (carry from ADR-0007 Step 8) with `email: null` — Robert needs
the **dismissal signal**, not just the email signal, for V0.5
prioritization.

### 12. Theme integration — design-system tokens flow into app-shell

The renderer consumes the design system through `RendererThemeProvider`
(ADR-0006), but the app-shell components (the 5 new screens, the
TabBar, the Settings sheet, etc.) are **outside** the renderer and
don't get to use that provider. The app-shell uses its own
`AppShellThemeProvider` that:

- Resolves a stance + palette for the **host chrome itself**. Per
  canvas-v0-ux.md §Host Shell, host chrome is **always `productive`
  stance + `focus` palette** (the visually neutral default). Mini-apps
  in Run mode push their own (stance, palette) via the
  RendererThemeProvider — but the host header + tab bar above/below
  them stay in the productive/focus register so the user always
  knows where they are. This is a load-bearing detail in Sable's
  spec; without it, the host chrome would shift color with every tool
  the user opens.
- Exposes `useAppShellTheme()` returning the same `ResolvedTheme`
  shape that `useTheme()` from the renderer returns (so component
  authors don't have to learn two APIs).
- Lives in `apps/mobile/src/theme/AppShellThemeProvider.tsx` —
  replaces the M1 `apps/mobile/src/theme/index.ts` `useTheme()` /
  `buildTheme()` API. M1's `palette`, `spacing`, `radius`, `typography`
  exports are deleted (no callers should survive the M1 → V0
  cutover; lint catches any holdout).

This means a **shell component** like `<TabBar />` calls
`useAppShellTheme()` and gets focus-palette tokens.
A **renderer component** like `<HeadingRenderer />` (inside Run mode)
calls `useTheme()` from `@app-creator/a2ui-renderer/v0` and gets the
mini-app's chosen (stance, palette) tokens. They cannot cross-import
each other's hooks; ESLint rule blocks it.

### 13. Per-screen test plan

Each shell ships with:
- **Component-level tests** (props matrix, render output, state
  transitions, accessibility props)
- **Integration tests** (interaction with TanStack Query state, navigation transitions)
- **Snapshot tests** (one per major variant — empty, populated,
  loading, error)
- **A11y tests** (VoiceOver labels via `accessibilityLabel`,
  `accessibilityRole`, `accessibilityState`; touch-target size via
  measured `onLayout`; focus order)

Test totals are projected at ~470 T-IDs across the 14 steps — large,
but proportionate. Step-by-step counts are in §Comprehensive Test
Specification.

### 14. CI/CD impact

- The mobile Jest workflow (existing) automatically picks up every new
  test file under `apps/mobile/src/`. No new workflow needed.
- The schema rename triggers two CI checks:
  - `pnpm --filter @app-creator/api db:generate` must produce
    `0007_mini_app_rename.sql` and the diff must be reviewable.
  - `pnpm --filter @app-creator/api test` runs the rename migration
    via testcontainers and asserts that `SELECT to_regclass('mini_apps')
    IS NOT NULL` returns true.
- No new env vars in this ADR. The `EXPO_PUBLIC_AUTH_PROVIDER` flag is
  declared but defaults to `magic-link` and is only flipped in
  ADR-0013, so this ADR ships it as a no-op constant.

---

## Alternatives Considered

### Folding SIWA into ADR-0011

- **Upside.** One ADR, one cutover.
- **Downside.** SIWA's infra surface (Apple Developer console + JWKS
  + dev-client native module + Branch SDK for deferred-deep-link) has
  zero dependency on shell layout decisions. Folding compounds risk
  in a single PR sequence with no architectural payoff.
- **Why not.** Net negative on risk:value.

### Server-side search/filter for Library

- **Upside.** Sub-string search would scale to 10k+ tools per user.
- **Downside.** V0's per-user tool count cap is unstated but realistic
  bounds are <100 (one tool per "idea"). A round-trip per keystroke is
  worse UX than a sub-millisecond JS substring scan over <100 strings.
- **Why not.** Premature optimization. V1 revisits.

### Tab bar at navigator level (standard React Navigation)

- **Upside.** Zero custom code; React Navigation's
  `createBottomTabNavigator` is the boring choice.
- **Downside.** The Run screen needs the tab bar visible at the same
  time the renderer's `tabs` nav pattern needs its own segmented
  control 12pt below the host header. With React Navigation's
  bottom-tab wrapping, the Run screen lives inside the LibraryStack's
  active-tab content slot — fine — but the segmented control inside
  Run mode lives below the renderer's body, which means it's *above*
  the navigator's tab bar visually. That works. The issue is
  **focus order**: VoiceOver swipe from the screen top reads
  (host header) → (renderer body) → (host tab bar) only if the
  host tab bar is the **screen's** last accessible node. If the tab
  bar is the **navigator's** chrome, VoiceOver may read it before the
  screen body in some configurations, depending on how React
  Navigation manages accessibility z-order. The hand-rolled
  `ShellLayout` component pattern guarantees focus order.
- **Why not.** A11y predictability is worth ~100 LOC of bespoke
  layout. Sable's spec is non-negotiable on focus order.

### Drizzle dual-write for rename (Option B)

- **Upside.** Safe rollback on a live DB.
- **Downside.** There is no live DB. Dual-write adds 250+ LOC of code
  to defend against a scenario that cannot occur (V0 hasn't shipped).
- **Why not.** Building a parachute for a building with no upper
  floors.

### Server-driven progress bar (SSE-paced)

- **Upside.** Bar reflects real generation progress.
- **Downside.** SSE chunks bunch (Anthropic's stream isn't smooth);
  the bar would lurch. Sable's spec is explicit: **client-paced 7s
  linear bar with slow-down zones**. We honor it.
- **Why not.** Spec violation.

---

## Consequences

### Positive

- V0 launches with the visual surface the brief requires.
- The shell architecture (`ShellLayout` + per-tab stacks + sheets)
  matches Sable's spec exactly; future shells (Inbox in V0.5) drop
  into the same layout without re-architecting.
- Schema names match the brief's contract (`mini_app` /
  `mini_app_version`), the App Store positioning copy, and the
  Reviewer Notes (canvas-v0.md §App Review).
- Out-of-scope email capture has a real mobile surface — V0.5
  prioritization is unblocked.
- Theme integration ensures host chrome stays visually constant
  across every mini-app the user opens (load-bearing for the
  "you're always in Canvas" frame).
- The `AppShellThemeProvider` + renderer's `RendererThemeProvider`
  split makes the two visual layers concrete and unmistakable for
  every future contributor.
- Settings sheet's V0.5 waitlist surface gives users a reason to
  return to the app even before V0.5 lands — and gives Product a
  per-capability opt-in signal stronger than the raw out-of-scope
  count.

### Negative

- 14 implementation steps over an estimated 5-10 PRs is a lot for
  Colby. Step ordering is critical; PR sequencing is non-negotiable
  (Phase 1 → Phase 2 → Phase 3).
- The Library M1 → V0 cutover is a hard cut. Every mobile state-queries
  caller renames in one PR (Step 4). No transitional aliases.
- M1 screens (`SignIn`, `Home`, `Chat`, `AppRunner`) are **deleted**
  at the end of Phase 2 (Step 11 — see §Implementation Plan). Any
  test that still imports them must be migrated first.
- The Run screen's `<RunHeader>` + meatball menu live in app-shell
  code, separate from the renderer's internal nav patterns. There are
  now **two** "header" concepts in a Run-mode view: the host header
  (32pt, always present) and the renderer's optional `stack` nav
  subheader (32pt below host). Contributors must read Sable's §Host
  Shell + §Internal Nav before adding anything header-shaped.
- ADR-0008 (Universal Links) blocks Step 12 (Linking handler hook).
  Step 12 ships against a **stubbed** handler that ADR-0008 fills in
  on its own PR sequence; ADR-0011 exposes the hook surface, ADR-0008
  implements it.

### Risks

| Risk | Likelihood | Mitigation | Detection |
| --- | --- | --- | --- |
| FlashList performance degrades on >50 tools | Low-Med | `estimatedItemSize` tuned per Sable's spec (130pt cover + 56pt text = 186pt card); soak test with 100-tool fixture in week 5 | Frame-rate measurement in dev menu |
| Settings sheet snap point misbehaves on iOS keyboard rise | Med | `enableDynamicSizing` + `KeyboardAvoidingView` from `react-native-keyboard-controller`; explicit snap point test | Manual on iPhone 14 + SE simulators |
| Schema rename leaves dangling references in service layer | Med | Compile-time enforced — `Project` type is **deleted**, not aliased. Typecheck fails CI if any caller forgot to rename. | `pnpm typecheck` |
| Suggested-prompt session-seed produces same picks across cold launches | Low | The seed is `crypto.randomUUID()` per app launch — by definition unique. Test asserts two cold launches in a Jest run produce different orders. | Unit test |
| Coachmark anchoring misfires on small screens | Low | Measure meatball position via `onLayout`; render coachmark at `position: 'absolute'` with measured offset; reduced-motion test path | Manual on iPhone SE simulator |
| Run-mode tab bar tap mid-renderer-state-mutation drops dispatch | Low | Tab bar's `onPress` is a navigation primitive, not a renderer dispatch; renderer state is preserved in the Library stack route's params on screen pop | Integration test: dispatch → switch tab → switch back → asserts state |
| Schema rename migration is irreversible if production data sneaks in | Low | Pre-merge check: confirm `SELECT COUNT(*) FROM projects` returns 0 on staging; document rollback as a `RENAME TO` reverse migration but flag as "destructive if data exists" | Eva runs the staging check before Ellis merges |
| `parent_project_id` rename to `parent_mini_app_id` breaks the "Shared with me" filter logic mid-cutover | Med | Filter is implemented **after** the rename (Step 6 of this ADR depends on Step 1's column rename); the cutover is one PR | Test asserts filter behavior post-migration |

---

## Implementation Plan

The 14 steps run in **three phases**:

- **Phase 1 — Foundation (Steps 1-5):** schema rename, route rename, mobile
  state-queries rename, theme provider. No new screens yet — this phase is
  a deep refactor that lands behind the existing M1 screens.
- **Phase 2 — Shell screens (Steps 6-11):** the 5 new screens, the
  ShellLayout, the TabBar, the M1 screen deletion.
- **Phase 3 — Surfaces and hooks (Steps 12-14):** Out-of-Scope surface,
  Quota-Exhausted surface, coachmark, Linking handler hook for ADR-0008,
  dev-only `LoadSpecFromDevMenu` hook for ADR-0010, end-to-end happy-path
  test.

### Phase 1 — Foundation

#### Step 1: DB schema rename — `projects` → `mini_apps`, `project_versions` → `mini_app_versions`

- **Files to create:**
  - `services/api/migrations/0007_mini_app_rename.sql` — **single
    `BEGIN`/`COMMIT` transaction** containing the renames + new-column
    additions. Shape:
    ```sql
    BEGIN;

    -- Renames (atomic at transaction commit; failure mid-script rolls back both)
    ALTER TABLE projects RENAME TO mini_apps;
    ALTER TABLE project_versions RENAME TO mini_app_versions;
    ALTER TABLE mini_apps RENAME COLUMN parent_project_id TO parent_mini_app_id;
    ALTER TABLE mini_app_versions RENAME COLUMN project_id TO mini_app_id;
    -- (current_version_id keeps its name; listed in earlier draft was a no-op)

    -- New columns: ADD as NULLable (no DEFAULT during ADD), BACKFILL
    -- with sentinels via COALESCE, then SET NOT NULL. **Critical:**
    -- `sync_mode` is added WITHOUT a DEFAULT clause so that existing
    -- rows are left NULL and the COALESCE backfill below can deposit
    -- the semantically-correct grandfathered value (`'local'`). If we
    -- attached `DEFAULT 'cloud-private'` to ADD COLUMN, Postgres would
    -- fill every existing row with `'cloud-private'` immediately, the
    -- WHERE…IS NULL clause would never match, and the COALESCE
    -- backfill to `'local'` would silently never fire (see R2 P1
    -- finding). The application-level default for **newly created**
    -- rows is set in the Drizzle schema (`syncMode: text('sync_mode')
    -- .notNull().default('cloud-private')`) — that handles V0 ship
    -- state for new mini-apps without contaminating the migration's
    -- grandfathered-row semantics.
    -- Sentinel values (explicit per ADR R2 → R3 sync_mode fix):
    --   stance         := 'productive'   (visually neutral default)
    --   accent_palette := 'neutral'      (Sable's neutral palette key)
    --   cover_art_seed := gen_random_uuid()::text  (unique per existing row)
    --   archetype      := 'unknown'      (V0.5 reclassifier fills in)
    --   sync_mode      := 'local'        (grandfathered rows pre-date
    --                                     sync; AC-P10 local-by-default
    --                                     applies — privacy-safer than
    --                                     opting old rows into cloud)
    ALTER TABLE mini_apps ADD COLUMN stance text;
    ALTER TABLE mini_apps ADD COLUMN accent_palette text;
    ALTER TABLE mini_apps ADD COLUMN cover_art_seed text;
    ALTER TABLE mini_apps ADD COLUMN archetype text;
    ALTER TABLE mini_apps ADD COLUMN sync_mode text;  -- no DEFAULT — see comment above

    UPDATE mini_apps SET
      stance         = COALESCE(stance, 'productive'),
      accent_palette = COALESCE(accent_palette, 'neutral'),
      cover_art_seed = COALESCE(cover_art_seed, gen_random_uuid()::text),
      archetype      = COALESCE(archetype, 'unknown'),
      sync_mode      = COALESCE(sync_mode, 'local')
    WHERE stance IS NULL
       OR accent_palette IS NULL
       OR cover_art_seed IS NULL
       OR archetype IS NULL
       OR sync_mode IS NULL;

    ALTER TABLE mini_apps ALTER COLUMN stance SET NOT NULL;
    ALTER TABLE mini_apps ALTER COLUMN accent_palette SET NOT NULL;
    ALTER TABLE mini_apps ALTER COLUMN cover_art_seed SET NOT NULL;
    ALTER TABLE mini_apps ALTER COLUMN archetype SET NOT NULL;
    ALTER TABLE mini_apps ALTER COLUMN sync_mode SET NOT NULL;

    -- Rename indexes + FK constraints (names embed old table name)
    -- (verbatim names elided here; see migration file for full list)

    COMMIT;

    -- Down-migration (NOT auto-generated by Drizzle; documented for Eva/Ellis):
    -- BEGIN;
    --   ALTER TABLE mini_apps ALTER COLUMN sync_mode DROP NOT NULL;
    --   ALTER TABLE mini_apps DROP COLUMN sync_mode;
    --   ALTER TABLE mini_apps DROP COLUMN archetype;
    --   ALTER TABLE mini_apps DROP COLUMN cover_art_seed;
    --   ALTER TABLE mini_apps DROP COLUMN accent_palette;
    --   ALTER TABLE mini_apps DROP COLUMN stance;
    --   ALTER TABLE mini_app_versions RENAME COLUMN mini_app_id TO project_id;
    --   ALTER TABLE mini_apps RENAME COLUMN parent_mini_app_id TO parent_project_id;
    --   ALTER TABLE mini_app_versions RENAME TO project_versions;
    --   ALTER TABLE mini_apps RENAME TO projects;
    -- COMMIT;
    -- Roll back order is the inverse of the forward script.
    ```
    The sentinel block lives **inside the same transaction** so any
    failure rolls everything back — half-renamed schema cannot persist.
  - `services/api/migrations/0008_out_of_scope_notify_opt_in.sql` —
    adds `notify_opt_in BOOLEAN NOT NULL DEFAULT false` to
    `out_of_scope_intent` (consumed by Settings sheet in Phase 2).
- **Files to modify:**
  - `services/api/src/db/schema.ts` — rename `projects` →
    `miniApps`, `projectVersions` → `miniAppVersions`, type exports
    (`Project` → `MiniApp`, `NewProject` → `NewMiniApp`,
    `ProjectVersion` → `MiniAppVersion`, `NewProjectVersion` →
    `NewMiniAppVersion`). Rename column properties (`projectId` →
    `miniAppId`, `parentProjectId` → `parentMiniAppId`).
  - `services/api/src/db/schema.test.ts` — update table-name
    assertions.
- **Acceptance criteria:**
  - Migration runs idempotently on a clean DB.
  - `SELECT to_regclass('mini_apps') IS NOT NULL` is true; same for
    `mini_app_versions`.
  - `SELECT to_regclass('projects')` returns NULL (old table gone).
  - All Drizzle type exports use the new names; old names are
    deleted, not aliased.
  - All schema tests pass with new names.
  - **Migration on a non-empty DB (≥1 pre-existing `projects` row)
    completes without `NOT NULL` violation.** New columns are
    backfilled with the explicit sentinels:
    `stance = 'productive'`, `accent_palette = 'neutral'`,
    `cover_art_seed = gen_random_uuid()::text` (per-row unique),
    `archetype = 'unknown'`, `sync_mode = 'local'`. The `sync_mode`
    column is added **without a Postgres-level `DEFAULT` clause** (so
    that the COALESCE backfill actually fires for pre-existing rows —
    see Step 1 SQL comment); the `'cloud-private'` default for
    newly-created rows is applied at the Drizzle schema layer
    (`syncMode: text('sync_mode').notNull().default('cloud-private')`)
    and exercised by application-level tests in Step 3, not by this
    migration assertion.
  - **Migration is wrapped in `BEGIN`/`COMMIT`.** Mid-script failure
    rolls back both renames + all column additions; DB is left in
    pre-migration state.
  - **Down-migration SQL is present as a comment block** in
    `0007_mini_app_rename.sql` (see file shape above) — Eva/Ellis
    reference if rollback is ever required.
- **Estimated complexity:** Medium (single migration, but every
  downstream file is dependent).

#### Step 2: Service layer rename — `projects.service.ts` → `miniApps.service.ts`

- **Files to create:**
  - `services/api/src/services/miniApps.service.ts` — renamed from
    `projects.service.ts`. Exports: `createMiniAppsService`,
    `MiniAppsService`, `CreateMiniAppInput`, `MiniAppListItem`,
    `MiniAppDetail`.
  - `services/api/src/services/miniApps.service.test.ts` — renamed
    from `projects.service.test.ts`; every test assertion updated.
- **Files to delete:**
  - `services/api/src/services/projects.service.ts`
  - `services/api/src/services/projects.service.test.ts`
- **Files to modify:**
  - Any service consumer that imported from `projects.service.ts`
    (grep first; expected: `routes/projects.ts`, `routes/generate.ts`,
    `services/library.service.ts`, `services/marketplace.service.ts`,
    plus their `.test.ts` siblings).
- **Acceptance criteria:**
  - No file in `services/api/` imports
    `'./services/projects.service.ts'` or
    `'../services/projects.service.ts'`.
  - All consumers compile with renamed exports.
  - Service-level test count is preserved (renames don't delete
    tests).
  - **`create()` writes both `mini_apps` row + first
    `mini_app_versions` row inside a single Drizzle transaction.** If
    the version insert fails after the mini-app insert succeeds, the
    transaction rolls back; neither row exists post-failure.
  - **Cover-art seed stability across re-prompts (AC-P4):** when a
    user re-prompts an existing mini-app (creates a new
    `mini_app_versions` row via the edit-by-chat path), the parent
    `mini_apps.cover_art_seed` value is **not** rewritten. Only the
    new version row is appended; the cover-art seed (and the cover-art
    surface) stays stable across the re-prompt.
- **Estimated complexity:** Medium.

#### Step 3: API route rename — `/me/projects` → `/me/mini-apps`, new write/share/rename/archive/delete/clone routes

- **Files to create:**
  - `services/api/src/routes/miniApps.ts` — replaces `routes/projects.ts`.
    Routes:
    - `GET /me/mini-apps` (was `GET /me/projects`) — list, auth-only.
    - `GET /me/mini-apps/:id` (was `GET /me/projects/:id`) — detail,
      owner-only, 404 on non-owner.
    - **New:** `POST /me/mini-apps/:id/rename` — body `{title:
      string}` (1-80 chars), updates title.
    - **New:** `POST /me/mini-apps/:id/archive` — sets a new
      `archived_at` timestamp column (added by Step 1's
      0008 migration as a separate migration **0009_mini_app_archive.sql**).
    - **New:** `DELETE /me/mini-apps/:id` — soft delete (sets
      `deleted_at`). Removes from list responses but rows retained.
    - **New:** `POST /me/mini-apps/:id/share` (stub for ADR-0008; in
      this ADR returns `501 not_implemented` — the route is
      registered so the mobile client can call it without 404, and
      ADR-0008 fills in the share-link generation).
    - **New:** `POST /me/mini-apps/clone` (stub for ADR-0008; same
      stub pattern — registered with 501, filled by ADR-0008).
  - `services/api/src/routes/miniApps.test.ts` — full test suite.
- **Files to delete:**
  - `services/api/src/routes/projects.ts`
  - `services/api/src/routes/projects.test.ts`
- **Files to modify:**
  - `services/api/src/server.ts` — change registration:
    `server.register(projectsRoutes)` → `server.register(miniAppsRoutes)`.
  - `services/api/migrations/0009_mini_app_archive.sql` (new):
    adds `archived_at timestamptz NULL`, `deleted_at timestamptz NULL`
    columns to `mini_apps` table.
  - `services/api/src/db/schema.ts` — adds these columns.
- **Acceptance criteria:**
  - `GET /me/mini-apps` is registered; `GET /me/projects` returns 404.
  - `POST /me/mini-apps/:id/rename` rejects empty title, >80 char
    title, and non-owners with `404 not_found` (T-0011-068 family).
  - `POST /me/mini-apps/:id/archive` is idempotent (calling twice
    keeps `archived_at` unchanged after first call).
  - `DELETE /me/mini-apps/:id` is soft delete — row exists in DB
    with `deleted_at IS NOT NULL`; subsequent
    `GET /me/mini-apps/:id` returns 404; subsequent
    `GET /me/mini-apps` excludes the row.
  - **DELETE is idempotent at the route level.** Service returns
    `{deletedAt}` on first call and `null` on second (already-deleted
    or not-owner — indistinguishable by design, preserves owner-leak
    guard). Route maps `null → 200 {already_deleted: true}` when the
    row exists with `deleted_at IS NOT NULL` for the caller, and
    `null → 404 {error: 'not_found'}` when the row never existed or
    the caller is not the owner. The service signals which case by
    returning a tagged result `{kind: 'deleted', deletedAt} |
    {kind: 'already_deleted'} | {kind: 'not_found'}`; the route
    translates to the HTTP status. Second-DELETE of the same caller's
    own row returns 200, not 404. (T-0011-060 covers this.)
  - **`GET /me/mini-apps` excludes archived rows by default.**
    `archived_at IS NOT NULL` rows are filtered out of the default
    list response. (A future `?include=archived` query param will
    re-include them — out of scope for V0.)
  - Share + clone routes are registered and return `501 not_implemented`
    with body `{error: 'not_implemented', adr: 'ADR-0008'}` so client
    integration tests can detect the stub.
- **Estimated complexity:** High (5 new routes + soft-delete semantics).

#### Step 4: Mobile state-queries rename — `projects.ts` → `miniApps.ts`, route paths updated

- **Files to create:**
  - `apps/mobile/src/state/queries/miniApps.ts` — replaces
    `state/queries/projects.ts`. Exports `useMiniAppsListQuery`,
    `useMiniAppQuery`, `useRenameMiniAppMutation`,
    `useArchiveMiniAppMutation`, `useDeleteMiniAppMutation`,
    `miniAppsKeys`, `MiniApp`, `MiniAppDetail`,
    `MiniAppListShapeError`, `MiniAppDetailShapeError`.
  - `apps/mobile/src/state/queries/miniApps.test.ts` — renamed tests.
- **Files to delete:**
  - `apps/mobile/src/state/queries/projects.ts`
  - `apps/mobile/src/state/queries/projects.test.ts`
- **Files to modify:**
  - Any mobile import of `projects.ts` (grep; expected: Home screen,
    AppRunner screen — these get deleted in Step 11, but the rename
    happens in this step so Phase 1 builds clean).
- **Acceptance criteria:**
  - No mobile file imports
    `'./state/queries/projects'` or
    `'#/state/queries/projects'`.
  - The new module's URL paths are `/me/mini-apps` and
    `/me/mini-apps/:id` (not `/me/projects`).
  - Mutation hooks (`useRenameMiniAppMutation`, etc.) implement the
    optimistic-update pattern per CLAUDE.md §2 with `onMutate` /
    `onError` rollback / `onSettled` invalidate.
  - `parseMiniAppListResponse` / `parseMiniAppDetailResponse`
    validate the new server shape, including the new
    `stance`, `accentPalette`, `coverArtSeed`, `archetype`,
    `syncMode` fields per AC-P1.
- **Estimated complexity:** High (mutation hooks are new; validator
  rewrite for new fields).

#### Step 5: AppShellThemeProvider + `/me/out-of-scope-intents` GET/PATCH endpoints

- **Files to create:**
  - `apps/mobile/src/theme/AppShellThemeProvider.tsx` — wraps the app
    root; resolves `theme('productive', 'focus')` from
    `@app-creator/design-system` and provides via React context.
    Exports `useAppShellTheme(): ResolvedTheme`.
  - `apps/mobile/src/theme/AppShellThemeProvider.test.tsx`.
  - `services/api/src/routes/me.ts` — new file owning the `/me/*`
    namespace, registers:
    - `GET /me/out-of-scope-intents` — returns the caller's per-capability
      grouped intents with `notify_opt_in` flag.
    - `PATCH /me/out-of-scope-intents/:capability` — body
      `{notify_opt_in: boolean}`; updates all of the caller's rows
      for that capability.
  - `services/api/src/routes/me.test.ts`.
  - `services/api/src/services/me.service.ts` — service for
    out-of-scope intent reads + updates.
  - `services/api/src/services/me.service.test.ts`.
  - `apps/mobile/src/state/queries/outOfScopeIntents.ts` — exports
    `useOutOfScopeIntentsQuery`, `useUpdateNotifyOptInMutation`.
  - `apps/mobile/src/state/queries/outOfScopeIntents.test.ts`.
- **Files to delete:**
  - `apps/mobile/src/theme/index.ts` — M1 theme; replaced by
    `AppShellThemeProvider`.
- **Files to modify:**
  - `services/api/src/server.ts` — register `meRoutes`.
  - `apps/mobile/App.tsx` (or wherever the root mounts) — wrap the
    tree with `<AppShellThemeProvider>` before `<Navigation>`.
  - All current screens importing `useTheme` from `#/theme` — switch
    to `useAppShellTheme` from `#/theme/AppShellThemeProvider`. Old
    `useTheme` from `#/theme` is **deleted**, not aliased.
- **Acceptance criteria:**
  - `useAppShellTheme()` returns the resolved `productive` +
    `focus` ResolvedTheme; tokens match `theme('productive', 'focus')`.
  - `GET /me/out-of-scope-intents` returns auth-only data; never
    leaks email field, never returns other users' intents (T-0011-130
    family).
  - `PATCH /me/out-of-scope-intents/:capability` validates the
    capability against the closed enum; rejects unknown values with
    `400 invalid_input`.
  - Rate limit on PATCH: 60/min per user (the toggle is cheap; users
    might toggle several in one Settings open).
- **Estimated complexity:** High.

### Phase 2 — Shell screens

#### Step 6: ShellLayout + TabBar component

- **Files to create:**
  - `apps/mobile/src/shell/ShellLayout.tsx` — accepts
    `{children, activeTab, headerSlot?, hideTabBar?}` props; renders
    SafeAreaView + optional `headerSlot` + `children` + TabBar (when
    `hideTabBar=false`).
  - `apps/mobile/src/shell/TabBar.tsx` — 2-tab component matching
    Sable's spec exactly (56pt + safe area, 2 tabs, accent on active,
    scale animation 1.0→1.06→1.0 on tap).
  - `apps/mobile/src/shell/SettingsSheet.tsx` — Gorhom Bottom Sheet
    container that hosts the Settings content; exposes
    `useSettingsSheet()` hook with `open()` / `close()`.
  - `apps/mobile/src/shell/*.test.tsx` for each.
- **Files to modify:**
  - `apps/mobile/src/Navigation.tsx` — replace the M1 stack screens
    with the V0 ShellLayout-wrapped stacks.
- **Acceptance criteria:**
  - TabBar renders both tabs visible, active state matches the
    `activeTab` prop.
  - Tap on inactive tab fires `onPress` callback (consumed by
    navigation).
  - Tap on active tab fires a separate `onActiveTabPress` callback
    (consumed by scroll-to-top behavior in tabs).
  - VoiceOver order: HeaderSlot → children → TabBar.
  - Each tab has `accessibilityRole="tab"` + `accessibilityState={{
    selected: <bool> }}`.
  - Settings sheet opens to 75% snap point; drag-down dismisses;
    tap-on-overlay dismisses.
- **Estimated complexity:** Medium.

#### Step 7: SignInScreen (V0 — Sable's design, still magic-link auth source pending ADR-0013)

- **Files to create:**
  - `apps/mobile/src/screens/SignIn/SignInScreen.tsx` — replaces
    M1 SignIn entirely. Wordmark + tagline + Sign-in button + footer.
    The Sign-in button **for this ADR** continues to call
    `POST /auth/magic-link` (so V0 shells ship before SIWA lands).
    The button's `onPress` reads `EXPO_PUBLIC_AUTH_PROVIDER`; when
    `apple` (post-ADR-0013), it calls `signInWithApple()`. When
    `magic-link` (default), it opens the email-entry sheet from M1.
  - `apps/mobile/src/screens/SignIn/SignInScreen.test.tsx`.
  - `apps/mobile/src/screens/SignIn/EmailEntrySheet.tsx` (Gorhom
    sheet for magic-link path; existing M1 logic re-housed).
  - `apps/mobile/src/screens/SignIn/copy.ts` (V0 copy).
- **Files to delete:**
  - `apps/mobile/src/screens/SignIn/index.tsx` (M1)
  - `apps/mobile/src/screens/SignIn/index.test.tsx`
  - `apps/mobile/src/screens/SignIn/components/*` (M1 components no longer used)
  - `apps/mobile/src/screens/SignIn/copy.ts` (M1 copy)
- **Acceptance criteria:**
  - Renders wordmark "Canvas" with `accessibilityRole="header"`.
  - Tagline visible: "A personal canvas for your everyday tools."
  - Sign-in button: Apple-branded style placeholder (full-width, 48pt
    tall, accent bg, `radius-md`).
  - Footer micro-copy with Terms + Privacy links opening `WKWebView`.
  - Default (V0 launch with magic-link): tap → open EmailEntrySheet.
  - With `EXPO_PUBLIC_AUTH_PROVIDER=apple` set: tap → call stubbed
    `signInWithApple()` (ADR-0013 fills in the implementation).
- **Estimated complexity:** Medium.

#### Step 8: LibraryScreen — populated, empty, loading, error states

- **Files to create:**
  - `apps/mobile/src/screens/Library/LibraryScreen.tsx`.
  - `apps/mobile/src/screens/Library/LibraryGrid.tsx` (FlashList
    wrapper).
  - `apps/mobile/src/screens/Library/MiniAppCard.tsx` (one cell:
    cover-art + title + subtitle).
  - `apps/mobile/src/screens/Library/LongPressActionSheet.tsx`.
  - `apps/mobile/src/screens/Library/EmptyState.tsx` — illustration +
    headline + 3 chips.
  - `apps/mobile/src/screens/Library/SearchAndFilters.tsx` (sticky
    row).
  - `apps/mobile/src/screens/Library/*.test.tsx` for each.
  - `apps/mobile/src/illustrations/library-empty.svg` (Sable handoff).
- **Acceptance criteria:**
  - Default render → `useMiniAppsListQuery` → populated grid.
  - 0-tools state → EmptyState replaces grid; chip taps navigate to
    Create with prompt pre-filled.
  - Search filters by case-insensitive title substring;
    no-match → inline empty "No tools match '<query>'."
  - Filter chip "Shared with me" filters by
    `parentMiniAppId !== null`; no-shares → inline empty.
  - Long-press card → 100ms scale + haptic → action sheet appears.
  - Pull-to-refresh re-invalidates the query.
  - Loading → 4 skeleton cards (shimmer disabled in reduced motion).
  - Error → inline banner above grid.
  - Card accessibility label: "Open <title>, <stance>, <palette>
    palette, created <relative time>".
- **Estimated complexity:** High.

#### Step 9: CreateScreen + GeneratingScreen + OutOfScopeScreen + QuotaExhaustedScreen

- **Files to create:**
  - `apps/mobile/src/screens/Create/CreateScreen.tsx`.
  - `apps/mobile/src/screens/Create/PromptInput.tsx`.
  - `apps/mobile/src/screens/Create/SuggestedPromptChips.tsx`.
  - `apps/mobile/src/screens/Create/suggestedPrompts.ts` (curated
    pool + session-seeded picker).
  - `apps/mobile/src/screens/Create/EditingPill.tsx`.
  - `apps/mobile/src/screens/Create/VoiceMicWaitlistSheet.tsx`.
  - `apps/mobile/src/screens/Generating/GeneratingScreen.tsx` —
    consumes SSE from `POST /generate`, manages client-paced progress
    bar.
  - `apps/mobile/src/screens/Generating/ProgressBar.tsx` — Reanimated 4
    `withSequence` pacing per Sable's spec.
  - `apps/mobile/src/screens/Generating/MessageCycler.tsx` — 3 messages
    crossfading.
  - `apps/mobile/src/screens/OutOfScope/OutOfScopeScreen.tsx`.
  - `apps/mobile/src/screens/OutOfScope/copy.ts` (5 per-capability strings).
  - `apps/mobile/src/illustrations/out-of-scope-{image_gen,vision,chat,transcription,classification}.svg`
    (Sable handoff).
  - `apps/mobile/src/screens/QuotaExhausted/QuotaExhaustedScreen.tsx`.
  - `apps/mobile/src/state/queries/generate.ts` — already exists;
    update to handle new SSE event types: `out_of_scope`,
    `quota_exhausted`.
  - All `*.test.tsx` for each new file.
- **Acceptance criteria:**
  - Empty input → FAB disabled.
  - 2001-char input → FAB disabled (and counter shows `danger`).
  - Tap suggested-prompt chip → input pre-filled, FAB enables, chips
    collapse.
  - Tap mic → VoiceMicWaitlistSheet opens.
  - Tap FAB → navigate to GeneratingScreen (full-screen modal,
    `presentation: 'fullScreenModal'`, no host chrome).
  - GeneratingScreen progress bar starts at 0, animates per Sable's
    pacing (0→75% over 6.5s, 75→95% over 1.5s, 95→99% hold).
  - On SSE `{spec, mini_app_id, version_id}` event → animate 99→100%
    then crossfade-replace into Run screen (push to LibraryStack/Run).
  - On SSE `{out_of_scope: {capability, reason}}` event →
    crossfade-replace into OutOfScopeScreen with the capability
    illustration + copy.
  - On HTTP 429 `quota_exhausted` → replace with QuotaExhaustedScreen
    using `reset_at` from response.
  - On HTTP 4xx (`invalid_spec`, `prompt_too_large`) → pop to Create
    with toast, prompt preserved.
  - On HTTP 5xx → pop to Create with toast.
  - Network drop mid-stream → bar holds; "Waiting for connection…"
    headline; "Cancel and retry" button.
  - Suggested-prompt session shuffle is deterministic per-session,
    different across sessions (Jest test: two `crypto.randomUUID()`
    seeds produce different picks).
- **Estimated complexity:** High (largest single step; SSE consumer +
  3 screens).

#### Step 10: RunScreen — host header + meatball + V0 Renderer mount

- **Files to create:**
  - `apps/mobile/src/screens/Run/RunScreen.tsx`.
  - `apps/mobile/src/screens/Run/RunHeader.tsx` — host header (back arrow,
    title, meatball).
  - `apps/mobile/src/screens/Run/MeatballMenu.tsx` — Gorhom action sheet.
  - `apps/mobile/src/screens/Run/RenameSheet.tsx` — single-input Gorhom
    sheet; 1-80 char validation; calls `useRenameMiniAppMutation`.
  - `apps/mobile/src/screens/Run/DeleteConfirmAlert.tsx`.
  - `apps/mobile/src/screens/Run/FirstRunCoachmark.tsx` —
    `expo-secure-store` flag, anchored speech-bubble.
  - `apps/mobile/src/screens/Run/RunFailedBanner.tsx` (render error fallback,
    canvas-v0-ux.md Screen 4a).
  - All `*.test.tsx`.
  - `apps/mobile/src/lib/coachmarkStorage.ts` — wraps
    `expo-secure-store` for the `coachmark_share_seen` key; exposes
    `hasSeenCoachmark()` and `markCoachmarkSeen()`.
- **Files to modify:**
  - `apps/mobile/src/lib/api.ts` — if needed, expose a helper
    `copyShareLinkToClipboard(miniAppId)` that calls
    `POST /me/mini-apps/:id/share` (stubbed 501 in Phase 1) — this
    helper is wired to the meatball Share action.
- **Acceptance criteria:**
  - RunScreen mounts `<NodeRenderer>` with the spec's root node from
    `useMiniAppQuery`.
  - Host header renders at 32pt with back / title / meatball.
  - Meatball tap → action sheet with 6 items.
  - Share action calls `copyShareLinkToClipboard` (ADR-0008 fills it);
    on success: haptic + toast "Link copied" + telemetry
    `share_link_copied`. (In this ADR's scope, the call returns 501;
    the toast on 501 reads "Share isn't ready yet" — temporary, gone
    when ADR-0008 lands.)
  - "Make changes" → navigate to Create with `editingMiniAppId` param
    + prompt pre-filled from the existing mini_app's `originalPrompt`.
  - Rename → opens RenameSheet; on submit, mutation runs with
    optimistic update.
  - Delete → confirmation alert → on confirm, mutation runs; on
    success, pop back to LibraryScreen.
  - First-time-user coachmark: appears 600ms after RunScreen mount
    if `coachmark_share_seen=false`; sets flag on any dismissal.
  - Render error from `RenderErrorBoundary` (ADR-0006 ships this) →
    RunFailedBanner replaces body; Sentry breadcrumb captured.
  - VoiceOver: header back = "Back to Library"; meatball =
    "Tool options"; coachmark live-region polite.
- **Estimated complexity:** High.

#### Step 11: Delete M1 screens + finalize Navigation.tsx

- **Files to delete:**
  - `apps/mobile/src/screens/Home/` (entire directory)
  - `apps/mobile/src/screens/Chat/` (entire directory)
  - `apps/mobile/src/screens/AppRunner/` (entire directory)
- **Files to modify:**
  - `apps/mobile/src/Navigation.tsx` — final V0 navigator shape:
    SignInScreen ↔ ShellLayout (LibraryStack + CreateStack).
    Stack screen names per `apps/mobile/src/lib/routes/types.ts`:
    `'Library'`, `'Run'`, `'Create'`, `'Generating'`, `'OutOfScope'`,
    `'QuotaExhausted'`. Remove old `'Home'`, `'Chat'`, `'AppRunner'`.
  - `apps/mobile/src/lib/routes/types.ts` — update `RootStackParamList`
    + new `LibraryStackParamList` + `CreateStackParamList`.
- **Acceptance criteria:**
  - `pnpm --filter @app-creator/mobile typecheck` passes with M1
    screens deleted.
  - `pnpm --filter @app-creator/mobile test` passes; no test imports
    the deleted screens.
  - The app's cold-start path: unauthenticated → SignInScreen;
    authenticated → ShellLayout / LibraryScreen.
  - Deep-link handler (existing `useAuthDeepLink`) still mounts at
    Navigation root.
- **Estimated complexity:** Low (mostly deletion, but the navigator
  refactor is the load-bearing piece).

### Phase 3 — Surfaces and hooks

#### Step 12: Universal Link Linking handler hook (surface only — ADR-0008 fills implementation)

- **Files to create:**
  - `apps/mobile/src/lib/linking/LinkingProvider.tsx` — React context
    provider that exposes `useLinkingHandlers()` with callbacks for
    `share_id` arrivals (cold-start, warm-start, deferred-deep-link).
    The implementation in **this ADR** registers React Navigation's
    `Linking` config with stub handlers that log + telemetry-only;
    ADR-0008 replaces the stub with the clone-flow logic.
  - `apps/mobile/src/lib/linking/LinkingProvider.test.tsx`.
- **Surface exposed for ADR-0008:**
  ```ts
  export interface LinkingHandlers {
    /** Called when the app receives a /m/{share_id}/clone Universal Link */
    onCloneLinkOpen: (shareId: string, source: 'cold' | 'warm' | 'deferred') => Promise<void>
    /** Called when the app receives an unknown universal-link mode (e.g. 'view', 'remix') */
    onUnsupportedMode: (mode: string, shareId: string) => void
  }
  ```
  ADR-0008's PR sequence registers a real `onCloneLinkOpen` that
  POSTs to `/me/mini-apps/clone` and pushes the new mini-app's Run
  screen.
- **Acceptance criteria:**
  - LinkingProvider renders without errors at app root.
  - In test mode, calling `LinkingProvider.handle('/m/abc/clone')`
    invokes the registered `onCloneLinkOpen` with `('abc', 'warm')`.
  - Unknown mode (`/m/abc/view`) invokes `onUnsupportedMode` with
    `('view', 'abc')`.
  - In this ADR's scope, the registered handlers fire telemetry only
    (`share_link_handled` with `{mode, shareId_hash}`) and show a
    "Coming soon" toast — full handler is ADR-0008.
- **Estimated complexity:** Low (surface only).

#### Step 13: Dev-only `LoadSpecFromDevMenu` hook for ADR-0010

- **Files to create:**
  - `apps/mobile/src/screens/Run/devMenu/LoadSpecFromDevMenu.tsx`
    (dev-only — guarded by `__DEV__`).
  - `apps/mobile/src/screens/Run/devMenu/LoadSpecFromDevMenu.test.tsx`.
- **Surface exposed for ADR-0010:**
  - Adds a "Load spec from JSON" item to the React Native dev menu
    (`react-native/Libraries/DevMenu`); when picked, opens a Gorhom
    sheet with a multi-line `TextInput` accepting a JSON spec; on
    submit, validates against `SpecSchema` and mounts in Run mode
    with a synthetic `mini_app` row that lives only in memory (never
    persisted to DB).
  - Also exposes a URL-scheme entrypoint
    `appcreator://devmenu/load-spec?fixture=<name>` that loads a
    bundled fixture from
    `apps/mobile/src/screens/Run/devMenu/__fixtures__/<name>.json`.
    ADR-0010's eval grading session calls this URL scheme to render
    arbitrary fixtures for screenshot grading.
- **Acceptance criteria:**
  - The dev-menu entry is **not** registered in production builds
    (`__DEV__` guard).
  - Invalid JSON shows inline error in the sheet; does not crash.
  - Valid spec mounts in Run mode with title from spec's first
    Heading.
  - URL scheme works on both cold-start and warm-start.
- **Estimated complexity:** Low.

#### Step 14: End-to-end happy-path test

- **Files to create:**
  - `apps/mobile/src/__tests__/e2e/library-create-run.test.tsx` —
    Jest integration test using React Testing Library and a mocked
    API client.
- **Test flow:**
  1. Render the app at SignIn (unauthenticated).
  2. Sign in (magic-link mock — flips session to authenticated).
  3. Land on LibraryScreen (empty state).
  4. Tap a chip from the empty state → navigate to Create with
     prompt pre-filled.
  5. Tap FAB → navigate to Generating.
  6. Mock SSE emits `{spec, mini_app_id, version_id}` after 100ms.
  7. Generating animates to 100%, then pushes Run screen.
  8. Run screen mounts the renderer with the mocked spec.
  9. Tap back to Library.
  10. LibraryScreen now shows the new card (via invalidated query).
- **Acceptance criteria:**
  - Test passes end-to-end with no real network.
  - Every screen renders during the flow (assertable via
    `findByTestId` per screen's root testID).
  - Test runtime <5 seconds.
- **Estimated complexity:** Medium.

---

## Code Shape Examples

### Step 1 — schema rename (Drizzle, sketch)

```ts
// services/api/src/db/schema.ts (post-rename)
export const miniApps = pgTable(
  'mini_apps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id').notNull().references(() => users.id, {onDelete: 'cascade'}),
    title: text('title').notNull(),
    currentVersionId: uuid('current_version_id'),
    parentMiniAppId: uuid('parent_mini_app_id'),
    stance: text('stance').notNull(),                  // new
    accentPalette: text('accent_palette').notNull(),   // new
    coverArtSeed: text('cover_art_seed').notNull(),    // new
    archetype: text('archetype').notNull(),            // new
    syncMode: text('sync_mode').notNull().default('cloud-private'), // new
    archivedAt: timestamp('archived_at', {withTimezone: true}),     // step 3
    deletedAt: timestamp('deleted_at', {withTimezone: true}),       // step 3
    // ... existing columns retained
  },
  // ... existing indexes renamed
)

export type MiniApp = typeof miniApps.$inferSelect
export type NewMiniApp = typeof miniApps.$inferInsert
```

### Step 3 — rename route shape

```ts
// services/api/src/routes/miniApps.ts (rename route)
fastify.post<{Params: {id: string}; Body: {title: string}}>(
  '/me/mini-apps/:id/rename',
  {preHandler: [requireAuth]},
  async (req, reply) => {
    const userId = (req as AuthenticatedRequest).user.id
    const {id} = req.params

    if (!UUID_REGEX.test(id)) return reply.code(400).send({error: 'invalid_input'})

    const parsed = renameBodySchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({error: 'invalid_input'})

    const result = await service.rename(userId, id, parsed.data.title)
    if (!result) return reply.code(404).send({error: 'not_found'})
    return reply.code(200).send({miniApp: result})
  },
)
```

### Step 6 — ShellLayout shape

```tsx
// apps/mobile/src/shell/ShellLayout.tsx
export function ShellLayout({
  children,
  activeTab,
  headerSlot,
  hideTabBar = false,
}: {
  children: ReactNode
  activeTab: 'library' | 'create'
  headerSlot?: ReactNode
  hideTabBar?: boolean
}) {
  const theme = useAppShellTheme()
  return (
    <SafeAreaView style={{flex: 1, backgroundColor: theme.bg}}>
      {headerSlot}
      <View style={{flex: 1}}>{children}</View>
      {!hideTabBar && <TabBar activeTab={activeTab} />}
    </SafeAreaView>
  )
}
```

### Step 10 — RunScreen shape

```tsx
// apps/mobile/src/screens/Run/RunScreen.tsx
export function RunScreen({route, navigation}: Props) {
  const {data, error, isLoading} = useMiniAppQuery(route.params.miniAppId)
  if (isLoading) return <ShellLayout activeTab="library" headerSlot={<RunHeader.Loading />}><RunSkeleton /></ShellLayout>
  if (error || !data) return <ShellLayout activeTab="library"><RunFailedBanner /></ShellLayout>

  return (
    <ShellLayout activeTab="library" headerSlot={<RunHeader miniApp={data.miniApp} navigation={navigation} />}>
      <RendererThemeProvider stance={data.miniApp.stance} palette={data.miniApp.accentPalette}>
        <HostProvider callbacks={hostCallbacks}>
          <RenderErrorBoundary fallback={<RunFailedBanner />}>
            <NodeRenderer node={data.currentVersion.specJson.screens[0].root} />
          </RenderErrorBoundary>
        </HostProvider>
      </RendererThemeProvider>
      <FirstRunCoachmark anchor="meatball" />
    </ShellLayout>
  )
}
```

### Step 12 — Linking hook surface (for ADR-0008)

```ts
// apps/mobile/src/lib/linking/LinkingProvider.tsx
export interface LinkingHandlers {
  onCloneLinkOpen: (shareId: string, source: 'cold' | 'warm' | 'deferred') => Promise<void>
  onUnsupportedMode: (mode: string, shareId: string) => void
}

export function LinkingProvider({
  handlers,
  children,
}: {
  handlers: LinkingHandlers
  children: ReactNode
}) {
  useEffect(() => {
    const sub = Linking.addEventListener('url', ({url}) => {
      const parsed = parseUniversalLink(url)  // -> {mode, shareId} | null
      if (!parsed) return
      if (parsed.mode === 'clone') void handlers.onCloneLinkOpen(parsed.shareId, 'warm')
      else handlers.onUnsupportedMode(parsed.mode, parsed.shareId)
    })
    return () => sub.remove()
  }, [handlers])
  return <>{children}</>
}
```

---

## Comprehensive Test Specification

### Test File Mapping

| Step | Test File | Env |
| --- | --- | --- |
| 1 | `services/api/src/db/schema.test.ts` | Jest + testcontainers (Postgres) |
| 2 | `services/api/src/services/miniApps.service.test.ts` | Jest + testcontainers |
| 3 | `services/api/src/routes/miniApps.test.ts` | Jest + testcontainers + Fastify inject |
| 4 | `apps/mobile/src/state/queries/miniApps.test.ts` | Jest + RN (jsdom env) |
| 5 | `apps/mobile/src/theme/AppShellThemeProvider.test.tsx`, `services/api/src/routes/me.test.ts`, `apps/mobile/src/state/queries/outOfScopeIntents.test.ts` | Jest |
| 6 | `apps/mobile/src/shell/ShellLayout.test.tsx`, `TabBar.test.tsx`, `SettingsSheet.test.tsx` | Jest + RTL |
| 7 | `apps/mobile/src/screens/SignIn/SignInScreen.test.tsx` | Jest + RTL |
| 8 | `apps/mobile/src/screens/Library/*.test.tsx` | Jest + RTL |
| 9 | `apps/mobile/src/screens/Create/*.test.tsx`, `Generating/*.test.tsx`, `OutOfScope/*.test.tsx`, `QuotaExhausted/*.test.tsx` | Jest + RTL + mocked SSE |
| 10 | `apps/mobile/src/screens/Run/*.test.tsx`, `apps/mobile/src/lib/coachmarkStorage.test.ts` | Jest + RTL + mocked SecureStore |
| 11 | `apps/mobile/src/Navigation.test.tsx` | Jest + RTL + React Nav test utils |
| 12 | `apps/mobile/src/lib/linking/LinkingProvider.test.tsx` | Jest + mocked `Linking` |
| 13 | `apps/mobile/src/screens/Run/devMenu/LoadSpecFromDevMenu.test.tsx` | Jest + RTL |
| 14 | `apps/mobile/src/__tests__/e2e/library-create-run.test.tsx` | Jest + RTL + mocked API |

### Step 1 Tests — DB schema rename

| ID | Category | Test Description |
| --- | --- | --- |
| T-0011-001 | Happy | Migration runs end-to-end on empty DB; `to_regclass('mini_apps')` non-null afterwards |
| T-0011-002 | Happy | `to_regclass('mini_app_versions')` non-null after migration |
| T-0011-003 | Breaking | `to_regclass('projects')` returns NULL — old name is gone |
| T-0011-004 | Breaking | `to_regclass('project_versions')` returns NULL |
| T-0011-005 | Regression | After rename, `users` table unchanged: same columns, same types |
| T-0011-006 | Regression | After rename, `out_of_scope_intent` table unchanged (Step 1's separate migration adds notify_opt_in on a new column, doesn't touch existing) |
| T-0011-007 | Regression | After rename, `events` table unchanged |
| T-0011-008 | Happy | New `mini_apps.stance` column exists, type `text`, NOT NULL |
| T-0011-009 | Happy | New `mini_apps.accent_palette` column exists, NOT NULL |
| T-0011-010 | Happy | New `mini_apps.cover_art_seed` column exists, NOT NULL |
| T-0011-011 | Happy | New `mini_apps.archetype` column exists, NOT NULL |
| T-0011-012 | Happy | New `mini_apps.sync_mode` column exists, NOT NULL. **No column-level `DEFAULT` clause at the Postgres layer** (intentionally — see Step 1 SQL comment block: grandfathered rows are backfilled to `'local'` via COALESCE, while the new-row default for `'cloud-private'` is supplied by the Drizzle schema at the application layer). Assert via `information_schema.columns`: `is_nullable='NO'` AND `column_default IS NULL`. |
| T-0011-013 | Happy | `out_of_scope_intent.notify_opt_in` column added by 0008 migration, BOOLEAN NOT NULL DEFAULT false |
| T-0011-014 | Concurrency | Two parallel migration runs on the same DB: second errors with non-fatal "already exists" (idempotency guard) |
| T-0011-014a | Negative | **Transaction atomicity (P1-1):** mid-migration failure (error injected after first `RENAME TO` and before second) rolls back the first rename via `BEGIN`/`COMMIT` wrapper; DB returns to pre-migration state (`to_regclass('projects') IS NOT NULL`, `to_regclass('mini_apps') IS NULL`). |
| T-0011-015 | Negative | Migration aborts cleanly if `projects` doesn't exist (fresh-DB safety; `IF EXISTS` clause) |
| T-0011-015a | Boundary | **Sentinel backfill on non-empty DB (P0-1):** testcontainers seeds **one** `projects` row before migration; after migration, the row's new `stance='productive'`, `accent_palette='neutral'`, `cover_art_seed` is a non-empty UUID string, `archetype='unknown'`, `sync_mode='local'`; migration completes without `NOT NULL` violation. |
| T-0011-015b | Boundary | **Sentinel backfill — multiple rows:** seed 5 rows pre-migration; after migration, all 5 carry the sentinel values; **each row's `cover_art_seed` is distinct** (UUID generation per-row, not a single shared value). |
| T-0011-016 | Boundary | After rename, FK constraint name `mini_app_versions_mini_app_id_fkey` exists (cascade-on-delete preserved) |
| T-0011-017 | Boundary | After rename, partial index for marketplace `mini_apps_library_idx` exists with same definition (only the name changed) |
| T-0011-018 | Boundary | `mini_apps.parent_mini_app_id` column type is uuid, nullable |
| T-0011-019 | Security | No new permissions granted; row-level security policies (if any) carry through |
| T-0011-020 | Regression | TypeScript types compile: `MiniApp`, `NewMiniApp`, `MiniAppVersion`, `NewMiniAppVersion` exported; `Project` / `NewProject` / `ProjectVersion` / `NewProjectVersion` are **gone** (compile-time check: `grep -r "type Project\b" services/api/src` returns nothing) |
| T-0011-020a | Regression | **Down-migration comment present:** `0007_mini_app_rename.sql` file contents include a `-- Down-migration` comment block enumerating the reverse `RENAME TO` + `DROP COLUMN` steps (asserted via `fs.readFileSync` + `expect(content).toMatch(/-- Down-migration/)` in the schema test). |

#### Step 1 Test Summary

| Category | Count |
| --- | --- |
| Happy | 8 |
| Regression | 5 |
| Breaking | 2 |
| Boundary | 5 |
| Concurrency | 1 |
| Negative | 2 |
| Security | 1 |
| **Total** | **24** |

### Step 2 Tests — Service rename

| ID | Category | Test Description |
| --- | --- | --- |
| T-0011-021 | Happy | `createMiniAppsService(db).list(userId)` returns `MiniAppListItem[]` with new fields populated |
| T-0011-022 | Happy | `createMiniAppsService(db).get(userId, miniAppId)` returns `MiniAppDetail` for owner |
| T-0011-023 | Happy | `createMiniAppsService(db).create(input)` writes both `mini_apps` and `mini_app_versions` rows in one transaction |
| T-0011-023a | Error | **Transaction rollback on partial failure (P1-2):** if the `mini_app_versions` insert throws after the `mini_apps` insert succeeded, the surrounding Drizzle transaction rolls back; post-failure, `SELECT FROM mini_apps WHERE id = <attempted-id>` returns zero rows and `SELECT FROM mini_app_versions WHERE mini_app_id = <attempted-id>` returns zero rows. |
| T-0011-023b | Happy | **Cover-art seed stability across re-prompts (AC-P4):** seed a mini-app with `coverArtSeed = 'seed-A'`. Call the re-prompt path (creates new `mini_app_versions` row via the edit flow). After: parent `mini_apps.cover_art_seed` is still `'seed-A'` (unchanged); new version row exists with new `spec_json`. |
| T-0011-024 | Negative | `get(userId, miniAppId)` returns `null` for non-owner |
| T-0011-025 | Negative | `get(userId, badUuid)` returns `null` (no row matches) |
| T-0011-026 | Security | `list(userA)` never returns rows owned by `userB` (T-0011-024 mirror at the list level) |
| T-0011-027 | Security | `get` returns `null` for `deleted_at IS NOT NULL` rows (added in Step 3) |
| T-0011-028 | Regression | Title derivation preserved from M1: spec's first Heading.text → title, fallback to prompt prefix |
| T-0011-029 | Regression | `create` rejects spec that fails `validateCrossRefs` |
| T-0011-030 | Concurrency | Two parallel `create` calls with the same `ownerId` + same spec produce two distinct `mini_app` rows (no de-dupe in V0) |
| T-0011-031 | Boundary | `create` with `originalPrompt` of length 12000 chars succeeds; length 12001 rejected (existing M1 contract preserved) |
| T-0011-032 | Boundary | `list` ordering by `updated_at DESC`, ties broken by `created_at DESC` |
| T-0011-033 | Breaking | `projects.service.ts` and `projects.service.test.ts` files are deleted (filesystem check in CI) |
| T-0011-034 | Regression | `getVersion(versionId)` returns the version row including `specJson` for the version's owner only |
| T-0011-035 | Negative | `getVersion(versionId)` returns `null` for non-existent version |
| T-0011-036 | Negative | `getVersion(versionId)` returns `null` if version's mini_app is `deleted_at NOT NULL` |
| T-0011-037 | Happy | New `create` accepts and persists `stance`, `accentPalette`, `coverArtSeed`, `archetype`, `syncMode` fields |
| T-0011-038 | Negative | `create` rejects unknown `stance` value (closed-enum) |
| T-0011-039 | Negative | `create` rejects unknown `accentPalette` value |
| T-0011-040 | Regression | `messages` row inserted on first `create` call (M1 invariant preserved) |

#### Step 2 Test Summary

| Category | Count |
| --- | --- |
| Happy | 5 |
| Negative | 6 |
| Regression | 4 |
| Boundary | 2 |
| Concurrency | 1 |
| Security | 2 |
| Breaking | 1 |
| Error | 1 |
| **Total** | **22** |

> R2 reconciliation: 023b is classified Happy (cover-art seed
> stability is a positive-path invariant check, not a negative
> assertion); the Happy count is 5 (021, 022, 023, 023b, 037).

### Step 3 Tests — Route rename + new endpoints

| ID | Category | Test Description |
| --- | --- | --- |
| T-0011-041 | Happy | `GET /me/mini-apps` returns `{miniApps: [...]}` with new field names (stance, accentPalette, coverArtSeed, archetype, syncMode, updatedAt) |
| T-0011-042 | Happy | `GET /me/mini-apps/:id` returns `{miniApp, currentVersion}` for owner |
| T-0011-043 | Breaking | `GET /me/projects` returns 404 (old route is gone, Fastify default) |
| T-0011-044 | Breaking | `GET /me/projects/:id` returns 404 |
| T-0011-045 | Security | `GET /me/mini-apps` rejected with 401 if no token |
| T-0011-046 | Security | `GET /me/mini-apps/:id` returns 404 to non-owner (does not leak existence) |
| T-0011-047 | Negative | `GET /me/mini-apps/:id` with malformed UUID → 400 `invalid_input` |
| T-0011-048 | Negative | `GET /me/mini-apps` response **never** includes `specJson` (auth-only — retro-lessons.md normalizeRow check) |
| T-0011-049 | Happy | `POST /me/mini-apps/:id/rename` with `{title: 'New name'}` updates title and returns the updated row |
| T-0011-050 | Negative | Rename with empty title → 400 `invalid_input` |
| T-0011-051 | Negative | Rename with title length 81 → 400 `invalid_input` |
| T-0011-052 | Boundary | Rename with title length 1 → 200 |
| T-0011-053 | Boundary | Rename with title length 80 → 200 |
| T-0011-054 | Security | Rename of another user's mini_app → 404 `not_found` |
| T-0011-055 | Happy | `POST /me/mini-apps/:id/archive` sets `archived_at`; subsequent reads show the value |
| T-0011-056 | Happy | Calling archive twice is idempotent — `archived_at` stays at the first call's timestamp |
| T-0011-057 | Security | Archive of another user's mini_app → 404 |
| T-0011-058 | Happy | `DELETE /me/mini-apps/:id` sets `deleted_at`; subsequent `GET /me/mini-apps/:id` → 404 |
| T-0011-059 | Happy | After DELETE, `GET /me/mini-apps` excludes the row |
| T-0011-059a | Happy | **Archived rows excluded from default list (P1-3):** seed two mini-apps for the user; archive one (`archived_at IS NOT NULL`). `GET /me/mini-apps` returns only the non-archived row; the archived row is absent. (No `?include=archived` query param in V0.) |
| T-0011-060 | Boundary | **DELETE idempotency (P1-4 resolved):** First call by owner of an existing non-deleted row → 200 `{deletedAt}`. Second call by the same owner of the same (now-deleted) row → 200 `{already_deleted: true}` (NOT 404). Route maps service's `{kind: 'already_deleted'}` to 200. (DELETE on a row that never existed for the caller still returns 404 to preserve owner-leak guard — T-0011-061.) |
| T-0011-061 | Security | DELETE of another user's mini_app → 404 |
| T-0011-062 | Happy | `POST /me/mini-apps/:id/share` returns `501 not_implemented` with `{error: 'not_implemented', adr: 'ADR-0008'}` |
| T-0011-063 | Happy | `POST /me/mini-apps/clone` returns `501 not_implemented` body |
| T-0011-064 | Negative | Share endpoint without auth → 401 |
| T-0011-065 | Negative | Clone endpoint without auth → 401 |
| T-0011-066 | Negative | Body validation: `POST /me/mini-apps/:id/rename` with `{title: 42}` (wrong type) → 400 |
| T-0011-067 | Regression | Existing tests for `GET /me/mini-apps/:id` audit log (`action: 'mini_app.read'`) still pass |
| T-0011-068 | Negative | Rename with whitespace-only title → 400 |
| T-0011-069 | Concurrency | Two parallel renames of the same mini_app — last write wins; both return 200 |
| T-0011-070 | Security | DELETE returns 404 (not 403) — owner-leak guard preserved |
| T-0011-071 | Boundary | Archive applied to an already-deleted mini_app → 404 |

#### Step 3 Test Summary

| Category | Count |
| --- | --- |
| Happy | 10 |
| Negative | 8 |
| Security | 6 |
| Breaking | 2 |
| Boundary | 4 |
| Concurrency | 1 |
| Regression | 1 |
| **Total** | **32** |

> R2 reconciliation: Step 3 has 32 unique T-IDs (31 base
> T-0011-041 … T-0011-071 + 1 added in R2: T-0011-059a for P1-3
> archived-list exclusion). Prior R1 summary's count error
> (31 vs 33) and overlap footnote are removed.

### Step 4 Tests — Mobile state-queries rename

| ID | Category | Test Description |
| --- | --- | --- |
| T-0011-072 | Happy | `useMiniAppsListQuery` hits `GET /me/mini-apps` (asserted via `apiFetch` mock) |
| T-0011-073 | Happy | `parseMiniAppListResponse` validates the new fields (stance, accentPalette, coverArtSeed, archetype, syncMode) |
| T-0011-074 | Negative | `parseMiniAppListResponse` throws `MiniAppListShapeError` when `stance` missing |
| T-0011-075 | Negative | Throws when `accentPalette` missing |
| T-0011-076 | Negative | Throws when `coverArtSeed` missing |
| T-0011-077 | Negative | Throws when `archetype` missing |
| T-0011-078 | Negative | Throws when `syncMode` not in closed-enum (`local` | `cloud-private`) |
| T-0011-079 | Happy | `useMiniAppQuery(id)` hits `GET /me/mini-apps/:id` |
| T-0011-080 | Negative | `parseMiniAppDetailResponse` throws on missing `miniApp.stance` |
| T-0011-081 | Happy | `useRenameMiniAppMutation` performs optimistic update on `miniAppsKeys.list()` |
| T-0011-082 | Error | On rename mutation 4xx error, previous list snapshot is restored via `onError` |
| T-0011-083 | Error | On rename mutation 5xx error, previous list snapshot is restored |
| T-0011-084 | Happy | After rename, `onSettled` invalidates `miniAppsKeys.list()` and `miniAppsKeys.detail(id)` |
| T-0011-085 | Happy | `useArchiveMiniAppMutation` removes the archived row from the list optimistically |
| T-0011-086 | Happy | `useDeleteMiniAppMutation` removes the row from list optimistically |
| T-0011-087 | Error | Delete mutation rollback restores the row on 4xx |
| T-0011-088 | Boundary | List query with empty response → returns empty array; no throw |
| T-0011-089 | Breaking | `state/queries/projects.ts` file is deleted (filesystem check in CI) |
| T-0011-090 | Breaking | No mobile file imports `'#/state/queries/projects'` (lint rule + grep check) |
| T-0011-091 | Regression | `STALE.MINUTES(5)` still used as `staleTime` (consistency with M1) |
| T-0011-092 | Security | `parseMiniAppDetailResponse` does not surface `ownerId` when not present (defensive shape) |
| T-0011-093 | Negative | Throws on `syncMode` value `'wrong-value'` (closed-enum) |
| T-0011-094 | Negative | Throws on `archetype` value `'dashboard'` (V0.5; not V0) |
| T-0011-095 | Boundary | `useMiniAppQuery(undefined)` is disabled (no fetch attempted) |
| T-0011-096 | Happy | Rename mutation success message via `safeMessage` if error.name is 'NetworkError' |

#### Step 4 Test Summary

| Category | Count |
| --- | --- |
| Happy | 8 |
| Negative | 8 |
| Error | 3 |
| Breaking | 2 |
| Boundary | 2 |
| Regression | 1 |
| Security | 1 |
| **Total** | **25** |

### Step 5 Tests — AppShellThemeProvider + `/me/out-of-scope-intents`

| ID | Category | Test Description |
| --- | --- | --- |
| T-0011-097 | Happy | `useAppShellTheme()` returns `theme('productive', 'focus')` resolved theme |
| T-0011-098 | Happy | Tokens are frozen (mutation attempts throw in strict mode) |
| T-0011-099 | Boundary | `useAppShellTheme()` returns same object reference across re-renders (memoized) |
| T-0011-100 | Breaking | `apps/mobile/src/theme/index.ts` is deleted; no `useTheme` from `#/theme` remains |
| T-0011-101 | Regression | All other files that imported `useTheme` from `#/theme` now import `useAppShellTheme` from `#/theme/AppShellThemeProvider` |
| T-0011-102 | Happy | `GET /me/out-of-scope-intents` returns `{intents: [{capability, lastCapturedAt, capturedCount, notifyOptIn}, ...]}` |
| T-0011-103 | Happy | Intents grouped by capability with count + max(createdAt) |
| T-0011-104 | Security | Returns only the caller's rows (T-0011-046 mirror) |
| T-0011-105 | Security | Email field is **never** present in the response (auth-only — retro-lessons.md) |
| T-0011-106 | Security | 401 if no token |
| T-0011-107 | Happy | `PATCH /me/out-of-scope-intents/:capability` with `{notify_opt_in: true}` updates all the caller's rows for that capability |
| T-0011-108 | Negative | PATCH with `:capability='banana'` → 400 `invalid_input` (closed-enum) |
| T-0011-109 | Negative | PATCH with `{notify_opt_in: 'yes'}` (wrong type) → 400 |
| T-0011-110 | Boundary | PATCH with no rows matching → 200 with `{updated: 0}` (idempotent) |
| T-0011-111 | Security | PATCH does not update another user's rows (verified by counting rows of `userB` before and after) |
| T-0011-112 | Concurrency | Two parallel PATCHes setting different `notify_opt_in` — last write wins; both 200 |
| T-0011-113 | Happy | `useOutOfScopeIntentsQuery` hits `GET /me/out-of-scope-intents` |
| T-0011-114 | Happy | `useUpdateNotifyOptInMutation` performs optimistic update |
| T-0011-115 | Error | Mutation rollback on 4xx |
| T-0011-116 | Negative | Mutation rollback on 5xx |
| T-0011-117 | Boundary | Empty intents response → empty array; no throw |
| T-0011-118 | Boundary | **Rate limit on PATCH — new behavior (P1-5 recategorized from Regression in R2; recategorized again from Happy → Boundary in R3 per Roz R2 P2-1):** 60 sequential PATCH requests within one minute from one user all return 200; the 61st returns 429 with body `{error: 'rate_limited'}`. Enforced via the shared `rateLimit` lib at route registration time. The 61st-request-returns-429 assertion is a boundary/over-the-edge test, not a happy path. |
| T-0011-119 | Boundary | Rate limit on GET: 60/min per user (61st request returns 429; same boundary semantics as T-0011-118). |
| T-0011-120 | Happy | New `notify_opt_in` column reads via `me.service.ts` |

#### Step 5 Test Summary

| Category | Count |
| --- | --- |
| Happy | 8 |
| Negative | 3 |
| Security | 4 |
| Boundary | 5 |
| Breaking | 1 |
| Concurrency | 1 |
| Regression | 1 |
| Error | 1 |
| **Total** | **24** |

> R2 reconciliation: Step 5 has 24 unique T-IDs T-0011-097 … T-0011-120
> (prior R1 summary's 26 total was a count error). T-0011-118 was
> recategorized from Regression to Happy in R2 (P1-5); **R3 corrects
> the landing — T-0011-118 and T-0011-119 are now Boundary** (61st
> request returning 429 is an over-the-edge / boundary assertion, not
> a happy path; Roz R2 P2-1). Happy 10 → 8, Boundary 3 → 5; total
> unchanged at 24. Failure-class:happy ratio for Step 5 corrects from
> 1.40 → 1.67 (directionally improves the failure:happy story; Roz R2
> §P2-1 noted this is favorable but the inaccuracy needed to land
> right). T-0011-116 is Negative (mutation rollback on 5xx is a
> failure-class assertion); T-0011-115 is Error.

### Step 6 Tests — ShellLayout + TabBar + SettingsSheet

| ID | Category | Test Description |
| --- | --- | --- |
| T-0011-121 | Happy | ShellLayout renders `headerSlot` above children |
| T-0011-122 | Happy | ShellLayout renders TabBar below children when `hideTabBar=false` |
| T-0011-123 | Happy | TabBar is **not** rendered when `hideTabBar=true` |
| T-0011-124 | Happy | TabBar shows both tabs (Library, Create) with correct icons |
| T-0011-125 | Happy | Active tab styled in `accent` color; inactive in `fg-muted` |
| T-0011-126 | Happy | Tap inactive tab fires `onPress(tab)` callback |
| T-0011-127 | Happy | Tap active tab fires `onActiveTabPress` callback |
| T-0011-128 | A11y | Each tab has `accessibilityRole="tab"`, `accessibilityState={{ selected }}` |
| T-0011-129 | A11y | TabBar root has `accessibilityRole="tablist"` |
| T-0011-130 | A11y | Each tab's touch target is ≥44pt (measured via `onLayout`) |
| T-0011-131 | A11y | VoiceOver focus order: headerSlot → children → TabBar |
| T-0011-132 | A11y | Tab icon + label both rendered (not icon-only) for screen-reader users |
| T-0011-133 | Happy | SettingsSheet opens to 75% snap point |
| T-0011-134 | Happy | Drag-down dismisses the sheet |
| T-0011-135 | Happy | Tap-on-overlay dismisses |
| T-0011-136 | A11y | Sheet has `accessibilityViewIsModal={true}` when open |
| T-0011-137 | Happy | `useSettingsSheet().open()` opens; `close()` closes |
| T-0011-138 | Boundary | Calling `open()` twice keeps sheet open (idempotent) |
| T-0011-139 | Snapshot | TabBar snapshot — default + active state |
| T-0011-140 | Snapshot | ShellLayout snapshot — with header, without header |
| T-0011-141 | Snapshot | SettingsSheet snapshot (mocked snap point) |
| T-0011-141a | Negative | **ShellLayout defensive on invalid `activeTab` (P0-2):** rendering with `activeTab="library"` and `activeTab="create"` shows the active styling; rendering with `activeTab={"nonsense" as any}` falls back to **no tab styled active** (TabBar renders both tabs in inactive state, no crash, no exception). Behavior pinned: defensive render, not error boundary. |
| T-0011-141b | Negative | **`headerSlot={null}` renders cleanly (P0-2):** ShellLayout with `headerSlot={null}` mounts without error; children + TabBar visible; no orphan padding from the absent header (measured via `onLayout` on the children's container — top inset equals SafeArea inset only). |
| T-0011-141c | Error | **SettingsSheet — network unavailable (P0-2):** `useOutOfScopeIntentsQuery` returns `{isLoading: false, isError: true, data: undefined}` (mocked offline). Sheet opens to 75% snap point; "Coming next update" section shows the **loading skeleton state** (pinned behavior: skeleton, not cached intents — TanStack Query has no persisted cache in V0). Account + About sections still render with session data. |
| T-0011-141d | Error | **`useAppShellTheme()` outside provider throws (P0-2):** calling the hook outside `<AppShellThemeProvider>` throws a specific error with message `useAppShellTheme must be used within AppShellThemeProvider` (asserted via `expect(() => renderHook(useAppShellTheme)).toThrow(...)`). Pinned behavior: throw, not silent fallback — fail-fast catches missing-provider regressions. |
| T-0011-141e | Happy | **SettingsSheet — Account section (P1-6):** renders display name from `session.user.displayName` + masked email from `session.user.email` (mask format: `j••@privaterelay.appleid.com` for SIWA, `j••e@example.com` for magic-link). |
| T-0011-141f | Happy | **SettingsSheet — Coming-next-update section (P1-6):** consumes `useOutOfScopeIntentsQuery`; renders one capability pill per returned intent with the capability label (e.g. "Image generation", "Voice input") and a toggle bound to `notifyOptIn`. Toggle tap calls `useUpdateNotifyOptInMutation`. |
| T-0011-141g | Happy | **SettingsSheet — About section (P1-6):** renders three links: "Terms" (opens `https://canvas.app/terms` in `WKWebView`), "Privacy" (opens `/privacy`), "Help" (opens `mailto:support@canvas.app`). Renders version + build number from `expo-constants`. |
| T-0011-141h | Happy | **SettingsSheet — Sign-out (P1-6):** "Sign out" tap invokes the session-clear path: `expo-secure-store` token deleted + `QueryClient.clear()` called + navigation reset to `SignInScreen`. Asserted via mocked `useSession.signOut()` spy + navigation mock receives `reset({routes: [{name: 'SignIn'}]})`. |

#### Step 6 Test Summary

| Category | Count |
| --- | --- |
| Happy | 15 |
| A11y | 6 |
| Boundary | 1 |
| Negative | 2 |
| Error | 2 |
| Snapshot | 3 |
| **Total** | **29** |

> R2 reconciliation: prior R1 summary said 21 total with footnote
> "19 unique IDs." After R2 additions (T-0011-141a-h: 8 new tests for
> P0-2 + P1-6), step has 29 unique T-IDs T-0011-121 … T-0011-141h.

### Step 7 Tests — SignInScreen

| ID | Category | Test Description |
| --- | --- | --- |
| T-0011-142 | Happy | Renders wordmark "Canvas" with `accessibilityRole="header"` |
| T-0011-143 | Happy | Renders tagline "A personal canvas for your everyday tools." |
| T-0011-144 | Happy | Renders sign-in button full-width, 48pt tall, accent bg |
| T-0011-145 | Happy | Footer Terms + Privacy links present |
| T-0011-146 | Happy | Tap Terms opens `WKWebView` (asserted via mocked Linking) |
| T-0011-147 | Happy | With `EXPO_PUBLIC_AUTH_PROVIDER=magic-link`, tap button opens EmailEntrySheet |
| T-0011-148 | Happy | With `EXPO_PUBLIC_AUTH_PROVIDER=apple`, tap button calls stubbed `signInWithApple()` |
| T-0011-149 | A11y | Sign-in button has `accessibilityRole="button"`, `accessibilityLabel="Sign in with Apple"` (or "Sign in with email" depending on provider) |
| T-0011-150 | A11y | Footer Terms link has `accessibilityRole="link"` |
| T-0011-151 | Boundary | EmailEntrySheet rejects empty input |
| T-0011-152 | Boundary | EmailEntrySheet accepts valid email per AC-A1 |
| T-0011-153 | Error | On magic-link 5xx, toast "Sign-in failed. Try again." |
| T-0011-154 | Breaking | M1 SignIn `index.tsx` is deleted (filesystem check) |
| T-0011-155 | Config exhaustion | `EXPO_PUBLIC_AUTH_PROVIDER` unset → default `magic-link` path |
| T-0011-156 | Config exhaustion | `EXPO_PUBLIC_AUTH_PROVIDER=''` → fallback to `magic-link` |
| T-0011-157 | Config exhaustion | `EXPO_PUBLIC_AUTH_PROVIDER='APPLE'` (case) → normalizes to `apple` |
| T-0011-158 | Config exhaustion | `EXPO_PUBLIC_AUTH_PROVIDER='garbage'` → falls back to `magic-link` **and** `logger.warn` spy receives one call with payload `{event: 'auth_provider_invalid', value: 'garbage', fallback: 'magic-link'}` (asserted via `expect(loggerWarnSpy).toHaveBeenCalledWith(expect.objectContaining({event: 'auth_provider_invalid', value: 'garbage'}), expect.any(String))`). The fallback is observable + actionable, not silent. |
| T-0011-159 | Config exhaustion | `EXPO_PUBLIC_AUTH_PROVIDER='  apple  '` (whitespace) → normalizes to `apple` |
| T-0011-160 | Snapshot | SignInScreen default state |
| T-0011-161 | Snapshot | SignInScreen with "link expired" banner (carryover from M1 prop) |

#### Step 7 Test Summary

| Category | Count |
| --- | --- |
| Happy | 7 |
| A11y | 2 |
| Boundary | 2 |
| Error | 1 |
| Breaking | 1 |
| Config exhaustion | 5 |
| Snapshot | 2 |
| **Total** | **20** |

### Step 8 Tests — LibraryScreen

| ID | Category | Test Description |
| --- | --- | --- |
| T-0011-162 | Happy | Populated state renders FlashList with 2-column grid |
| T-0011-163 | Happy | Each card shows cover-art + title + relative time |
| T-0011-164 | Happy | Empty state replaces grid when `useMiniAppsListQuery` returns `[]` |
| T-0011-165 | Happy | Empty state's 3 chips navigate to Create with prompt pre-filled |
| T-0011-166 | Happy | Search field filters by case-insensitive substring on title |
| T-0011-167 | Negative | Search "Quantum" with no matches → inline empty "No tools match 'Quantum'." |
| T-0011-168 | Happy | Filter chip "Mine" filters to rows with `parentMiniAppId === null` |
| T-0011-169 | Happy | Filter chip "Shared with me" filters to rows with `parentMiniAppId !== null` |
| T-0011-170 | Negative | **(P1-7 — copy pinned)** "Shared with me" filter with no shares → inline empty state renders Sable's exact copy: **`"Tools your friends share will appear here."`** (verbatim, no paraphrase). Asserted via `getByText('Tools your friends share will appear here.')`. |
| T-0011-170a | Security | **Screen-layer data-leakage backstop (P0-4 — Step 8):** render LibraryScreen with `useMiniAppsListQuery` mocked to return a malformed response that **does** carry a `specJson` field on each card object (simulates a service-layer `excludes` slip). Assert: **no rendered text node, testID, `accessibilityLabel`, or `accessibilityHint`** contains any substring from the `specJson` payload (asserted by serializing the rendered tree to JSON and `expect(serialized).not.toContain(specJsonContent)`). This is the screen-render backstop per retro-lessons.md `normalizeRow` lesson. |
| T-0011-170b | Negative | **Empty-state chip pre-fills only, does NOT auto-submit (non-blocking obs):** tap an empty-state chip on LibraryScreen → navigation to CreateScreen with `prefilledPrompt` route param + chip text in the input. Assert: **no navigation to GeneratingScreen**, the FAB is in its enabled-but-untapped state, no `POST /generate` mock call recorded. The chip is pre-fill ONLY; the user must tap FAB. |
| T-0011-171 | Happy | Long-press card → 100ms scale + light haptic → action sheet |
| T-0011-172 | Happy | Action sheet has 6 items (Open / Share / Make changes / Archive / Rename / Delete) |
| T-0011-173 | Happy | Pull-to-refresh invalidates `miniAppsKeys.list()` |
| T-0011-174 | Error | Inline error banner on `useMiniAppsListQuery` error |
| T-0011-175 | Happy | Loading shows 4 skeleton cards |
| T-0011-176 | A11y | Skeleton shimmer disabled when `AccessibilityInfo.isReduceMotionEnabled()` returns true |
| T-0011-177 | A11y | Card label format: "Open <title>, <stance>, <palette> palette, created <time ago>" |
| T-0011-178 | A11y | Filter chips have `accessibilityRole="button"`, `accessibilityState={{ selected }}` |
| T-0011-179 | A11y | Long-press hint: `accessibilityHint="Long-press for options."` |
| T-0011-180 | A11y | Pull-to-refresh announces "Refreshed" / "No new tools" |
| T-0011-181 | Happy | Tap card → navigate to Run with `miniAppId` |
| T-0011-182 | Happy | Tap avatar in header → opens Settings sheet |
| T-0011-183 | Boundary | Empty title gracefully ellipsizes; no crash |
| T-0011-184 | Snapshot | LibraryScreen populated (4 mocked cards) |
| T-0011-185 | Snapshot | LibraryScreen empty state |
| T-0011-186 | Snapshot | LibraryScreen loading |
| T-0011-187 | Snapshot | LibraryScreen error |
| T-0011-188 | Snapshot | MiniAppCard variant per (stance × palette × archetype) — 4 chosen variants |
| T-0011-189 | Happy | FlashList `estimatedItemSize` set per Sable's spec (cover 130 + text 56 + margins) |
| T-0011-190 | Negative | If `useMiniAppsListQuery` throws `MiniAppListShapeError`, error banner reads "Couldn't load your library." |

#### Step 8 Test Summary

| Category | Count |
| --- | --- |
| Happy | 14 |
| Negative | 4 |
| Error | 1 |
| A11y | 5 |
| Boundary | 1 |
| Security | 1 |
| Snapshot | 5 |
| **Total** | **31** |

> R2 reconciliation: prior summary said 26 with a footnote about "29
> IDs in table; 3 overlap intentional." The overlap claim was unclear
> and is removed in R2. New total reflects the actual unique-ID count
> after additions for P0-4 (T-0011-170a), P1-7 (T-0011-170 rewrite),
> and the empty-state-chip negative assertion (T-0011-170b).

### Step 9 Tests — CreateScreen + Generating + OutOfScope + QuotaExhausted

| ID | Category | Test Description |
| --- | --- | --- |
| T-0011-191 | Happy | Default Create: FAB disabled, 6 chips visible, mic icon visible |
| T-0011-192 | Happy | Typing 1 non-whitespace char enables FAB |
| T-0011-193 | Boundary | Typing 2000 chars: FAB enabled, counter `danger` color |
| T-0011-194 | Boundary | Typing 2001 chars: FAB disabled, counter `danger` |
| T-0011-195 | Boundary | Typing whitespace-only: FAB disabled |
| T-0011-196 | Happy | Tap chip → input pre-filled, chips collapse, FAB enables |
| T-0011-197 | Happy | Tap mic → VoiceMicWaitlistSheet opens |
| T-0011-198 | Happy | Submit mic waitlist email → POSTs to `/out-of-scope-intent` with capability=`transcription` |
| T-0011-199 | A11y | Counter at 1900 announces "Approaching length limit" via live-region |
| T-0011-200 | A11y | FAB has `accessibilityState={{ disabled }}` reflecting state |
| T-0011-201 | A11y | Chips have `accessibilityRole="button"`, label=chip text, hint="Pre-fills the prompt." |
| T-0011-202 | Happy | Editing pill shows when route param `editingMiniAppId` is present |
| T-0011-203 | Happy | Pill `[×]` dismisses; next submit creates new mini-app (no `editingMiniAppId` param sent) |
| T-0011-204 | Happy | Suggested prompts shuffled per-session by `crypto.randomUUID()` seed |
| T-0011-205 | Happy | Same session seed → same chip order (deterministic) |
| T-0011-206 | Happy | Two different seeds → at least one different chip order (probabilistic, fix seed in test) |
| T-0011-207 | Boundary | Suggested-prompt pool has exactly 10 entries |
| T-0011-208 | Happy | Tap FAB → push Generating screen with input as prompt |
| T-0011-209 | Happy | Generating progress bar starts at 0, animates to 75% over 6.5s (Reanimated frame stub) |
| T-0011-210 | Happy | Bar animates 75 → 95% over 1.5s |
| T-0011-211 | Happy | Bar holds at 95-99% until SSE completes |
| T-0011-212 | Happy | On `{spec, mini_app_id}` SSE event, bar animates to 100% then pushes Run |
| T-0011-213 | Happy | On `{out_of_scope: {capability, reason}}` SSE event, crossfade to OutOfScopeScreen |
| T-0011-214 | Happy | OutOfScopeScreen renders correct illustration for `image_gen` |
| T-0011-215 | Happy | OutOfScopeScreen renders correct copy for each of 5 capabilities |
| T-0011-216 | Happy | Email field pre-filled from session email |
| T-0011-217 | Negative | Submit with empty email → button disabled |
| T-0011-218 | Negative | Submit with invalid email → inline error, button disabled |
| T-0011-219 | Happy | Valid submit POSTs to `/out-of-scope-intent` with capability, prompt_hash, reason, email |
| T-0011-220 | Happy | On success → confirmation tick + single "Try a different idea" CTA |
| T-0011-221 | Error | On submit 5xx → toast "Couldn't save. Try again." Field stays. |
| T-0011-222 | Happy | Back from OutOfScopeScreen without submit → telemetry `out_of_scope_intent` fires with `email: null` (dismissal signal) |
| T-0011-223 | Happy | HTTP 429 `quota_exhausted` with `reset_at` → push QuotaExhaustedScreen |
| T-0011-224 | Happy | QuotaExhaustedScreen shows hourglass + headline + relative reset time |
| T-0011-225 | Happy | "Got it" tap on quota → pop to Library |
| T-0011-226 | A11y | Quota headline + body in `accessibilityLiveRegion="polite"` |
| T-0011-227 | Error | HTTP 4xx `invalid_spec` → pop to Create with toast, prompt preserved |
| T-0011-228 | Error | HTTP 4xx `prompt_too_large` → pop to Create with toast, prompt preserved |
| T-0011-229 | Error | HTTP 5xx → pop to Create with toast |
| T-0011-230 | Happy | Network drop mid-stream → bar holds, "Waiting for connection…" + "Cancel and retry" button |
| T-0011-231 | Happy | "Cancel and retry" → cancels stream, returns to Create with prompt preserved |
| T-0011-231a | Happy | **Normal-flow cancel with confirmation (P1-8):** while generating with **no** network issue, Cancel button tap opens a confirmation alert with title `"Cancel?"`, body `"You'll lose this generation."`, default-highlighted action `"Keep waiting"`, destructive action `"Cancel"`. On `"Cancel"`: SSE `AbortController.abort()` is called client-side, navigation pops back to Create with prompt preserved. On `"Keep waiting"`: alert dismisses, SSE stream continues, progress bar resumes its prior pacing position. |
| T-0011-231b | Security | **OutOfScope email — no Sentry leak (P0-4 — Step 9):** mount OutOfScopeScreen with session email `'user@example.com'` (email pre-fills the field). Assert spy on `Sentry.setExtra`, `Sentry.setUser`, and `Sentry.addBreadcrumb`: **none** receive a call where any argument-value contains `'user@example.com'`. Assert spy on `console.log` / `console.warn` / `console.error`: **none** receive a call with the email as substring. Email is held in component state only; never enters telemetry/log paths. |
| T-0011-232 | A11y | Generating headline `accessibilityRole="header"` |
| T-0011-233 | A11y | Cycled message has `accessibilityLiveRegion="polite"` |
| T-0011-234 | A11y | Progress bar `accessibilityRole="progressbar"`, `accessibilityValue={{ now, min, max }}` |
| T-0011-235 | A11y | Reduced motion: illustration static, message text still cycles (information) |
| T-0011-236 | A11y | Reduced motion: progress bar animates with 100ms steps (not continuous) |
| T-0011-237 | Snapshot | CreateScreen default |
| T-0011-238 | Snapshot | CreateScreen typing state with chips collapsed |
| T-0011-239 | Snapshot | CreateScreen with editing pill |
| T-0011-240 | Snapshot | GeneratingScreen at 0%, 50%, 95%, 100% |
| T-0011-241 | Snapshot | OutOfScopeScreen for each capability (5) |
| T-0011-242 | Snapshot | QuotaExhaustedScreen |
| T-0011-243 | Happy | OutOfScopeScreen capability=`unknown` falls back to a generic illustration + copy |

#### Step 9 Test Summary

| Category | Count |
| --- | --- |
| Happy | 29 |
| Negative | 2 |
| Boundary | 4 |
| Error | 4 |
| Security | 1 |
| A11y | 9 |
| Snapshot | 6 |
| **Total** | **55** |

> R2 reconciliation: prior R1 summary's category counts had drift
> (Happy 26, A11y 8, Snapshot 9 vs actual 28, 9, 6). R2 retallies in
> place; +2 new T-IDs (231a Happy + 231b Security) raise Happy to 29
> and Security from 0 to 1.

### Step 10 Tests — RunScreen + meatball + coachmark

| ID | Category | Test Description |
| --- | --- | --- |
| T-0011-244 | Happy | RunScreen mounts `<NodeRenderer>` with spec's root from `useMiniAppQuery` |
| T-0011-245 | Happy | RendererThemeProvider gets (stance, palette) from mini-app row |
| T-0011-246 | Happy | Host header renders at 32pt: back, title, meatball |
| T-0011-247 | Happy | Tab bar renders below (host chrome invariant — canvas-v0.md AC-R6) |
| T-0011-248 | Happy | Tap back → pop to LibraryScreen |
| T-0011-249 | Happy | Tap meatball → action sheet with 6 items |
| T-0011-250 | Happy | "Share" action calls `copyShareLinkToClipboard(miniAppId)` |
| T-0011-251 | Happy | **(P1-9)** In this ADR's scope, Share returns 501 → toast `"Share isn't ready yet"` (temp; ADR-0008 replaces). **Explicit telemetry suppression assertion:** spy on `writeEvent` receives **zero** calls for `share_link_copied` on the 501 path. `share_link_copied` only fires on a 200 response (which this ADR cannot produce; ADR-0008 ships the 200 path). Asserted via `expect(writeEventSpy).not.toHaveBeenCalledWith(expect.objectContaining({eventType: 'share_link_copied'}))`. |
| T-0011-252 | Happy | "Make changes" navigates to Create with `editingMiniAppId` + prefilled prompt |
| T-0011-253 | Happy | "Rename" opens RenameSheet with current title |
| T-0011-254 | Happy | RenameSheet submit calls `useRenameMiniAppMutation` |
| T-0011-255 | Boundary | Rename empty → button disabled |
| T-0011-256 | Boundary | Rename length 81 → button disabled |
| T-0011-257 | Happy | "Archive" calls `useArchiveMiniAppMutation` → on success, pop to Library |
| T-0011-258 | Happy | "Delete" opens confirmation alert |
| T-0011-259 | Happy | Confirm delete → mutation runs → on success, pop to Library |
| T-0011-260 | Happy | Cancel delete → alert dismisses, no mutation |
| T-0011-261 | Happy | Coachmark appears 600ms after RunScreen mount if `coachmark_share_seen=false` |
| T-0011-262 | Happy | Coachmark does NOT appear if `coachmark_share_seen=true` |
| T-0011-263 | Happy | Coachmark dismisses on tap-outside |
| T-0011-264 | Happy | Coachmark dismisses on "Got it" |
| T-0011-265 | Happy | Coachmark dismisses on meatball tap (the intended next action) |
| T-0011-266 | Happy | Coachmark auto-dismisses after 8s with no interaction |
| T-0011-267 | Happy | Any dismissal sets `coachmark_share_seen=true` in `expo-secure-store` |
| T-0011-268 | Boundary | Coachmark never re-appears once dismissed across app sessions |
| T-0011-269 | A11y | Coachmark has `accessibilityViewIsModal={true}` |
| T-0011-270 | A11y | Coachmark announces "Tip: Tap the options button to share this tool." |
| T-0011-271 | A11y | Reduced motion: coachmark appears instantly (no slide) |
| T-0011-272 | A11y | Header back: `accessibilityLabel="Back to Library"` |
| T-0011-273 | A11y | Meatball: `accessibilityLabel="Tool options"`, hint covers contents |
| T-0011-274 | Error | RendererErrorBoundary catches render error → RunFailedBanner replaces body |
| T-0011-275 | Error | RunFailedBanner shows "This tool didn't render." + "Back to Library" + "Recreate" |
| T-0011-276 | Error | "Recreate" navigates to Create with original prompt prefilled |
| T-0011-277 | Happy | `useMiniAppQuery` 404 → "Not found" message + back-to-library CTA |
| T-0011-278 | Snapshot | RunHeader default + loading |
| T-0011-279 | Snapshot | MeatballMenu action sheet |
| T-0011-280 | Snapshot | RenameSheet |
| T-0011-281 | Snapshot | FirstRunCoachmark |
| T-0011-282 | Snapshot | RunFailedBanner |
| T-0011-283 | Happy | `coachmarkStorage.markCoachmarkSeen()` writes to SecureStore |
| T-0011-284 | Happy | `coachmarkStorage.hasSeenCoachmark()` reads from SecureStore |

#### Step 10 Test Summary

| Category | Count |
| --- | --- |
| Happy | 25 |
| Boundary | 3 |
| A11y | 5 |
| Error | 3 |
| Snapshot | 5 |
| **Total** | **41** |

> R2 reconciliation: prior R1 summary's total (35) was a count error;
> Step 10 has 41 unique T-IDs T-0011-244 … T-0011-284. R2 retallies
> Happy at 25.

### Step 11 Tests — Navigation cutover + M1 deletion

| ID | Category | Test Description |
| --- | --- | --- |
| T-0011-285 | Breaking | `apps/mobile/src/screens/Home/` directory does not exist |
| T-0011-286 | Breaking | `apps/mobile/src/screens/Chat/` directory does not exist |
| T-0011-287 | Breaking | `apps/mobile/src/screens/AppRunner/` directory does not exist |
| T-0011-288 | Breaking | `RootStackParamList` no longer includes `'Home' | 'Chat' | 'AppRunner'` |
| T-0011-289 | Happy | Unauthenticated session → SignInScreen rendered |
| T-0011-290 | Happy | Authenticated session → ShellLayout rendered with LibraryScreen as default tab content |
| T-0011-291 | Happy | Tap Create tab → CreateScreen rendered in CreateStack |
| T-0011-292 | Happy | Push Run from LibraryScreen → Run pushed inside LibraryStack |
| T-0011-293 | Happy | Push Generating from CreateScreen → Generating pushed in CreateStack with `presentation: 'fullScreenModal'` |
| T-0011-294 | Happy | Tab switch from Run mode (Library) to Create → dismisses Run; LibraryStack pops to root via gesture or back |
| T-0011-295 | Regression | **`useAuthDeepLink` regression test (P1-10):** with the navigator at SignInScreen (unauthenticated), simulate `Linking.openURL('appcreator://auth?token=<magic-link-token>')` (warm-start, URL scheme matches `app.config.ts` registration). Assert: `useAuthDeepLink`'s callback fires, the auth-callback handler exchanges the token (mocked) for a session, the session flips to authenticated, and navigation transitions to `LibraryScreen` as the root of LibraryStack (asserted via `findByTestId('library-screen-root')`). Pinned URL scheme + expected navigation; not a vague "still works" claim. |
| T-0011-296 | Regression | `typecheck` passes — no dangling `Home` / `Chat` / `AppRunner` references |
| T-0011-297 | Regression | All existing M1 test files importing the deleted screens are gone (filesystem check) |
| T-0011-298 | Happy | Hydration splash renders while session loading |
| T-0011-299 | Happy | After sign-in, navigator transitions from SignIn → Library smoothly |

#### Step 11 Test Summary

| Category | Count |
| --- | --- |
| Happy | 8 |
| Breaking | 4 |
| Regression | 3 |
| **Total** | **15** |

### Step 12 Tests — LinkingProvider (surface for ADR-0008)

| ID | Category | Test Description |
| --- | --- | --- |
| T-0011-300 | Happy | LinkingProvider renders without errors |
| T-0011-301 | Happy | `/m/{share_id}/clone` Universal Link calls `handlers.onCloneLinkOpen(shareId, 'warm')` |
| T-0011-302 | Happy | `/m/{share_id}/view` Universal Link calls `handlers.onUnsupportedMode('view', shareId)` |
| T-0011-303 | Happy | `/m/{share_id}/remix` Universal Link calls `handlers.onUnsupportedMode('remix', shareId)` |
| T-0011-304 | Negative | Malformed URL → does not invoke any handler; logs warning |
| T-0011-305 | Happy | Cold-start URL invokes `onCloneLinkOpen` with `'cold'` |
| T-0011-306 | Happy | **Deferred-deep-link source tag (P1-11 clarified):** the `LinkingProvider`'s stub in ADR-0011 **cannot** differentiate `'deferred'` from `'warm'` purely from `Linking.addEventListener('url', …)` — that requires Branch SDK callback data which lives in ADR-0008. In ADR-0011 scope, this test asserts only the **type contract**: `onCloneLinkOpen`'s `source` parameter accepts `'deferred'` as a value (TypeScript compile + runtime accepts it without throw). The end-to-end `'deferred'` invocation is owned by **ADR-0008** (which integrates Branch SDK + Universal Link continuation) and will land its own test there. ADR-0011 ships the surface; ADR-0008 ships the source-tag wiring. |
| T-0011-307 | Happy | In ADR-0011's scope, `onCloneLinkOpen` fires telemetry `share_link_handled` + shows toast (ADR-0008 fills in clone logic) |
| T-0011-308 | Boundary | Multiple events fired in rapid succession — each invokes the handler once |
| T-0011-309 | Security | `share_id` in telemetry is hashed before logging (does not leak the raw share ID) |
| T-0011-310 | Regression | Existing `useAuthDeepLink` still works alongside `LinkingProvider` (no event-listener conflict) |

#### Step 12 Test Summary

| Category | Count |
| --- | --- |
| Happy | 7 |
| Negative | 1 |
| Boundary | 1 |
| Security | 1 |
| Regression | 1 |
| **Total** | **11** |

### Step 13 Tests — Dev-only LoadSpecFromDevMenu

| ID | Category | Test Description |
| --- | --- | --- |
| T-0011-311 | Happy | Dev-menu entry registered when `__DEV__=true` |
| T-0011-312 | Breaking | Dev-menu entry **not** registered when `__DEV__=false` (production build) |
| T-0011-313 | Happy | Sheet opens on pick |
| T-0011-314 | Happy | Valid JSON spec → mounts in Run mode with synthetic mini_app |
| T-0011-315 | Negative | Invalid JSON → inline error in sheet; does not crash |
| T-0011-316 | Negative | Spec failing `SpecSchema.parse` → inline error with first Zod issue |
| T-0011-317 | Happy | Synthetic mini_app never persisted to DB (assert via `useMiniAppsListQuery` mock — list unchanged) |
| T-0011-317a | Security | **Dev-menu telemetry suppression (P0-6):** loading a fixture via `LoadSpecFromDevMenu` (both sheet-JSON path and URL-scheme path) does **not** emit `tool_session_open`, `share_link_handled`, `out_of_scope_intent`, or any whitelisted telemetry event. Asserted via mocked `writeEvent` spy receives **zero** calls during the entire load + mount flow (sheet open → JSON paste → validate → mount in Run mode → render renderer tree). Mirrors ADR-0007's eval-mode short-circuit discipline; a grader loading 40 fixtures must not flood the events table. |
| T-0011-318 | Happy | URL scheme `appcreator://devmenu/load-spec?fixture=tracker` (**warm-start**) loads bundled fixture from `apps/mobile/src/screens/Run/devMenu/__fixtures__/tracker.json` and mounts in Run mode with the fixture's title (from spec's first Heading.text). |
| T-0011-318a | Happy | **URL scheme cold-start (P1-12):** simulate app cold-launch with `Linking.getInitialURL()` mocked to return `'appcreator://devmenu/load-spec?fixture=tracker'`. After hydration completes, the app skips the default LibraryScreen route and instead resolves the initial URL: loads the bundled `tracker.json` fixture, mounts in Run mode with the fixture's title, no DB write, no telemetry fire. Pinned cold-start path (distinct from T-0011-318's warm-start). |
| T-0011-319 | Negative | URL scheme with unknown fixture → toast "Fixture not found" |
| T-0011-320 | Happy | Title in synthetic Run mode comes from spec's first Heading.text |

#### Step 13 Test Summary

| Category | Count |
| --- | --- |
| Happy | 7 |
| Negative | 3 |
| Breaking | 1 |
| Security | 1 |
| **Total** | **12** |

### Step 14 Tests — E2E happy path

| ID | Category | Test Description |
| --- | --- | --- |
| T-0011-321 | Happy | E2E flow: SignIn → Library (empty) → tap chip → Create → submit → Generating → Run → back → Library populated |
| T-0011-321a | Regression | **ADR-0010 grammar consistency (P0-5):** `grep -r "canvas://eval-fixture"` across `apps/mobile/src/` and `docs/adrs/ADR-0011-*.md` returns **zero** matches; `grep -r "appcreator://devmenu/load-spec"` returns at least one match in ADR-0011 + `LoadSpecFromDevMenu.tsx`. ADR-0011's grammar is the codebase's only deep-link grammar for dev-menu fixture loading. (ADR-0010's stale reference is patched by a separate follow-up edit — coordinated by orchestrator, out of ADR-0011's edit scope.) |
| T-0011-322 | Happy | Each screen renders during the flow (assert via `findByTestId`) |
| T-0011-323 | Happy | Test runtime <5 seconds |
| T-0011-324 | Regression | No real network used (mocked `apiFetch`, mocked SSE) |
| T-0011-325 | Error | **E2E failure: SSE `out_of_scope` event (P0-3):** flow runs to Generating; mocked SSE emits `{out_of_scope: {capability: 'image_gen', reason: '...'}}`; Generating crossfades into OutOfScopeScreen showing the `image_gen` illustration + copy; email field pre-filled from session. No Run screen mount. Tapping back returns to Create with prompt preserved. |
| T-0011-326 | Error | **E2E failure: HTTP 429 `quota_exhausted` (P0-3):** flow runs to Generating; mocked fetch returns 429 with `{error: 'quota_exhausted', reset_at: '<ISO timestamp>'}`; QuotaExhaustedScreen pushes with hourglass + relative reset time. Tap "Got it" pops to LibraryScreen (not back to Create). |
| T-0011-327 | Error | **E2E failure: authenticated session expires mid-flow (P0-3):** flow runs to Generating; mocked fetch returns 401 mid-stream (session expired); navigator clears the session (`expo-secure-store` token deleted) and resets to SignInScreen (not a broken screen, not a crash). No partial Run mount. |

#### Step 14 Test Summary

| Category | Count |
| --- | --- |
| Happy | 3 |
| Error | 3 |
| Regression | 2 |
| **Total** | **8** |

### Test Totals

| Step | T-ID Range | Count |
| --- | --- | --- |
| 1 | T-0011-001 … T-0011-020 (+ 014a, 015a, 015b, 020a) | 24 |
| 2 | T-0011-021 … T-0011-040 (+ 023a, 023b) | 22 |
| 3 | T-0011-041 … T-0011-071 (+ 059a) | 32 |
| 4 | T-0011-072 … T-0011-096 | 25 |
| 5 | T-0011-097 … T-0011-120 | 24 |
| 6 | T-0011-121 … T-0011-141 (+ 141a-141h) | 29 |
| 7 | T-0011-142 … T-0011-161 | 20 |
| 8 | T-0011-162 … T-0011-190 (+ 170a, 170b) | 31 |
| 9 | T-0011-191 … T-0011-243 (+ 231a, 231b) | 55 |
| 10 | T-0011-244 … T-0011-284 | 41 |
| 11 | T-0011-285 … T-0011-299 | 15 |
| 12 | T-0011-300 … T-0011-310 | 11 |
| 13 | T-0011-311 … T-0011-320 (+ 317a, 318a) | 12 |
| 14 | T-0011-321 … T-0011-327 (+ 321a) | 8 |
| **Total** | | **349** |

**Test totals: 349 unique T-IDs across 14 steps** (R2 added 25 T-IDs
to address Roz's REVISE-WITH-NOTES verdict: 6 P0 + 12 P1 + 7
non-blocking-observation additions; original R1 was 324 by Cal's
count, but several R1 per-step summaries had count errors that R2
also reconciles in place). Snapshot count: 29 (Step 6 + 7 + 8 +
9 + 10). A11y test count: 27 (every interactive surface; Step 6
added one A11y test via 141d clarification).

#### Failure-to-Happy Ratio per Step (R2)

Counted with failure-class = negative + error + boundary + security +
breaking + config-exhaustion + concurrency + regression + a11y +
snapshot (snapshots typically cover edge/error variants; a11y tests
assert non-happy invariants).

| Step | Total | Happy | Failure-class | Ratio | Holds (≥1.0)? |
| --- | --- | --- | --- | --- | --- |
| 1 | 24 | 8 | 16 | 2.00 | ✅ |
| 2 | 22 | 5 | 17 | 3.40 | ✅ |
| 3 | 32 | 10 | 22 | 2.20 | ✅ |
| 4 | 25 | 8 | 17 | 2.13 | ✅ |
| 5 | 24 | 8 | 16 | 2.00 | ✅ |
| 6 | 29 | 15 | 14 | 0.93 | ⚠️ see note |
| 7 | 20 | 7 | 13 | 1.86 | ✅ |
| 8 | 31 | 14 | 17 | 1.21 | ✅ |
| 9 | 55 | 29 | 26 | 0.90 | ⚠️ see note |
| 10 | 41 | 25 | 16 | 0.64 | ⚠️ see note |
| 11 | 15 | 8 | 7 | 0.88 | ⚠️ see note |
| 12 | 11 | 7 | 4 | 0.57 | ⚠️ see note |
| 13 | 12 | 7 | 5 | 0.71 | ⚠️ see note |
| 14 | 8 | 3 | 5 | 1.67 | ✅ |
| **Aggregate** | **349** | **154** | **195** | **1.27** | ✅ |

> **Note on sub-1.0 steps (6, 9, 10, 11, 12, 13).** R2 transparently
> reports per-step ratios; six steps land below 1.0 with the
> failure:happy ratio under the strict per-step rule. Reasoning:
>
> - **Step 6 (0.93)** — ShellLayout + TabBar + SettingsSheet is a
>   primitive rendering surface; even after P0-2/P1-6 additions
>   (+8 T-IDs, of which 6 are failure-class), the surface has many
>   distinct happy-path interactive behaviors (each tab tap, sheet
>   open/close, header/no-header). Roz's P0-2 concern of
>   "ZERO negative/error/security tests" is fully addressed: Step 6
>   now has 2 Negative + 2 Error + 6 A11y + 1 Boundary + 3 Snapshot
>   = 14 non-happy tests. The chassis has real failure coverage.
> - **Step 9 (0.90)** — Largest single step (55 T-IDs); Happy is
>   inflated because every SSE branch (spec/out_of_scope/quota/error)
>   counts as a happy render of its respective screen. Failure-class
>   includes 4 Error + 4 Boundary + 1 Security (added in R2) + 2
>   Negative + 9 A11y + 6 Snapshot. SSE failure branches (P0-3
>   adjacent) are tested explicitly.
> - **Steps 10, 11, 12, 13 (0.64, 0.88, 0.57, 0.71)** — These are
>   "rendering scaffold" steps. Step 10 (RunScreen) is Happy-heavy
>   because each meatball action + each coachmark dismissal path is
>   counted as a distinct happy interaction. Step 11 is the M1
>   deletion + navigator cutover (mostly Breaking + Regression).
>   Steps 12 + 13 are surface stubs exposing hooks for ADR-0008 /
>   ADR-0010 with minimal failure surface (the failure paths live in
>   the consuming ADR). Roz's spot-check did not flag these (only
>   Steps 6 + 14 + 8 + 11 were spot-checked); Step 11 already passes
>   on raw count.
>
> Aggregate ratio 1.27 holds the original "failure ≥ happy" rule of
> thumb at the spec level (R3: +0.03 vs R2's 1.24 after T-0011-118 +
> T-0011-119 recategorized Happy → Boundary per Roz R2 P2-1). The six
> sub-1.0 steps are surface-render scaffolds whose failure surfaces
> (where present) all live in consuming ADRs or in Step 14's E2E
> (which is 1.67 after P0-3 additions). R2 closes Roz's specific
> P0/P1 failure-coverage gaps with concrete T-IDs; the ratio table is
> reported transparently rather than re-categorized to manufacture
> ≥1.0 on every row.

### Test Helpers & Mocks

- `apps/mobile/src/__tests__/helpers/renderWithProviders.tsx` —
  wraps in QueryClient + AppShellThemeProvider + NavigationContainer
  for consistent test setup.
- `apps/mobile/src/__tests__/helpers/mockApiClient.ts` — mocks
  `apiFetch` with response fixtures.
- `apps/mobile/src/__tests__/helpers/mockSSE.ts` — emits SSE events
  on demand for Generating-screen tests.
- `apps/mobile/src/__tests__/helpers/mockSecureStore.ts` — in-memory
  shim for `expo-secure-store`.
- `apps/mobile/src/__tests__/helpers/fixtures/specs/` — V0 spec
  fixtures per archetype (ListCRUD, Tracker, Journal, Calculator).
- `services/api/src/__tests__/helpers/seedMiniApp.ts` — seeds a
  mini_app + mini_app_version row for a test user.

### Coverage Gates

- `apps/mobile/src/screens/*` — line coverage ≥ 80% per file.
- `apps/mobile/src/state/queries/miniApps.ts` — line coverage ≥ 90%.
- `apps/mobile/src/shell/*` — line coverage ≥ 90%.
- `services/api/src/routes/miniApps.ts` — line coverage ≥ 95%.
- `services/api/src/routes/me.ts` — line coverage ≥ 95%.
- **`services/api/src/services/me.service.ts` — line coverage ≥ 90%** (R2 added per Roz non-blocking observation; the new `/me/*` service layer holds the auth-only read/write paths for out-of-scope intents, equivalent risk surface to `miniApps.service.ts`).
- New illustrations and snapshot files are excluded from coverage.

---

## Data Sensitivity

All store methods are tagged below. Methods are organized by service.

### `miniApps.service.ts` (renamed from `projects.service.ts`)

| Store Method | Returns | Sensitivity | Excludes |
| --- | --- | --- | --- |
| `createMiniAppsService(db).list(ownerId)` | `MiniAppListItem[]` — `{id, title, currentVersionId, parentMiniAppId, stance, accentPalette, coverArtSeed, archetype, syncMode, updatedAt, createdAt}` | **auth-only** | `specJson` (use `get`), other users' rows (filtered by ownerId), `deleted_at IS NOT NULL` rows, `archived_at IS NOT NULL` rows by default |
| `createMiniAppsService(db).get(ownerId, miniAppId)` | `MiniAppDetail` — `{miniApp, currentVersion: {id, miniAppId, specJson, renderHash, createdAt}}` | **auth-only** | other users' rows (returns null, surfaces as 404), `deleted_at IS NOT NULL` rows |
| `createMiniAppsService(db).getVersion(versionId)` | `MiniAppVersion | null` | **auth-only** (caller must validate ownership separately, e.g. via mini-app FK) | rows for deleted mini-apps |
| `createMiniAppsService(db).create(input)` | `MiniAppDetail` | **auth-only** | — (caller is identified, write-only side) |
| `createMiniAppsService(db).rename(ownerId, miniAppId, title)` | `MiniApp | null` (null = not found / not owner) | **auth-only** | other users' rows |
| `createMiniAppsService(db).archive(ownerId, miniAppId)` | `{archivedAt: Date} | null` | **auth-only** | other users' rows |
| `createMiniAppsService(db).delete(ownerId, miniAppId)` | Tagged: `{kind: 'deleted', deletedAt: Date} \| {kind: 'already_deleted'} \| {kind: 'not_found'}` (R2 — P1-4 resolution) | **auth-only** | other users' rows (returns `'not_found'`) |

### `me.service.ts` (new)

| Store Method | Returns | Sensitivity | Excludes |
| --- | --- | --- | --- |
| `createMeService(db).listOutOfScopeIntents(ownerId)` | `Array<{capability, lastCapturedAt, capturedCount, notifyOptIn}>` | **auth-only** | other users' rows, **email** (auth-only but not needed in this read path), prompt_hash, reason |
| `createMeService(db).updateNotifyOptIn(ownerId, capability, optIn)` | `{updated: number}` | **auth-only** | other users' rows |

### Out-of-scope intent reads — what is **never** returned

> Per retro-lessons.md `normalizeRow` lesson: explicitly stated.

- `email` is not in the `listOutOfScopeIntents` response. Settings
  sheet shows only `capability` + `notifyOptIn`. The email was
  captured for V0.5 notification delivery (out-of-band system); the
  client does not need to re-display it.
- `prompt_hash` is not returned. Aggregate analytics live outside the
  API request path.
- `reason` (the LLM's textual reason) is not returned. Same logic.

---

## CI/CD Impact

| Job | Config File | Impact | Required Change |
| --- | --- | --- | --- |
| `mobile-typecheck` | `.github/workflows/mobile-ci.yml` | Renamed types break compile until all callers update | Run after Step 4; expected pass at end of Phase 1 |
| `mobile-test` | `.github/workflows/mobile-ci.yml` | Adds ~310 new test files | None — Jest picks up files automatically |
| `api-typecheck` | `.github/workflows/api-ci.yml` | Service + route + DB type renames | Run after Steps 1-3; expected pass at end of Phase 1 |
| `api-test` | `.github/workflows/api-ci.yml` | Migration `0007_mini_app_rename.sql` runs via testcontainers | None — migrations auto-discover |
| `api-db-generate-check` | `.github/workflows/api-ci.yml` (if exists) | Drizzle-kit generate must produce stable SQL | None — but reviewer compares generated SQL to hand-authored migration |
| `eval-harness` | `.github/workflows/eval.yml` | Eval results write to `events` table — table not renamed | None |

**Universal Link / AASA verification** (ADR-0008's CI dependency) is **not** in this ADR's scope — ADR-0008 owns AASA hosting checks.

---

## Documentation Impact

| Doc | Path | What Changes |
| --- | --- | --- |
| Canvas V0 product spec | `docs/product/canvas-v0.md` §AC-A, §AC-P, §AC-O, §API Contracts | Mark T-IDs against ADR-0011; route paths are `/me/mini-apps/*` (already in spec) |
| Mobile architecture overview (new) | `docs/product/canvas-v0-mobile-architecture.md` | Shell map for PM/QA — written as part of Step 11 |
| CLAUDE.md | `CLAUDE.md` §1 (RN components), §2 (TanStack), §4 (renderer pattern) | **(R2 — Roz Doc Required)** §1 example replaces `import {useTheme} from '#/theme'` with `import {useAppShellTheme} from '#/theme/AppShellThemeProvider'` for **app-shell components** (the 5 V0 shells + ShellLayout + TabBar + Settings); §4 keeps `useTheme()` for **renderer components** but qualifies the import as `from '@app-creator/a2ui-renderer/v0'`. Adds a "two themes, never mixed" callout linking back to ADR-0011 §Decision 12. |
| ARCHITECTURE.md | `ARCHITECTURE.md` | (Tentative) Note the host-chrome layer if it's not already covered. Cal-of-ARCHITECTURE owns this. |
| ADR Index | `.claude/references/adr-index.md` | Ellis updates after PR sequence lands; Cal does **not** touch this file. |
| Reviewer Notes (App Store) | `docs/product/canvas-v0-reviewer-notes.md` | None at ADR time. PM-owned. |

---

## Coordination with Parallel Cal Agents

### ADR-0008 — Universal Links + share/clone

**What ADR-0008 needs from ADR-0011:**
- The `LinkingProvider` surface in Step 12, specifically the
  `LinkingHandlers` interface.
- The stubbed `POST /me/mini-apps/:id/share` and
  `POST /me/mini-apps/clone` routes registered in Step 3 (so ADR-0008
  can swap the 501 stub for the real implementation without adding a
  new route).
- The `useMiniAppsListQuery` invalidation pattern from Step 4 (so
  ADR-0008's clone-flow can invalidate the list to surface the new card).

**What ADR-0011 does not own:**
- AASA file hosting at `https://canvas.app/.well-known/`.
- Branch SDK setup for deferred-deep-link.
- The cover-art PNG OG endpoint
  (`https://canvas.app/m/<share_id>/cover.png`).
- The static install-gate web page.
- The actual share-link generation logic in
  `POST /me/mini-apps/:id/share`.
- The clone-flow logic in `POST /me/mini-apps/clone`.

#### Single Linking entrypoint contract (R3 — Roz R2 P2-2)

**ADR-0011's `LinkingProvider` is the sole
`Linking.addEventListener('url', …)` registration in the mobile app.**
ADR-0008's `useUniversalLink` (Step 4 of ADR-0008) **MUST** consume
the `LinkingHandlers` interface exposed by `LinkingProvider`, not
register its own listener. The contract:

- ADR-0011 owns the listener registration in `LinkingProvider.tsx`
  and parses the inbound URL into a discriminated event:
  - `{kind: 'clone', shareId}` — a `canvas.app/m/<shareId>/clone`
    Universal Link or the `appcreator://m/<shareId>/clone` scheme.
  - `{kind: 'reserved-mode', mode, shareId}` — a reserved-mode URL
    that ADR-0011 currently surfaces as the "Coming soon" toast.
  - `{kind: 'auth', token}` — the existing magic-link path
    (`useAuthDeepLink` continues to consume this).
- ADR-0008's `useUniversalLink(onActiveLink, onReservedMode)` hook
  subscribes to those discriminated events via the `LinkingProvider`
  context (`useLinkingHandlers()` consumer hook), not via its own
  `Linking.addEventListener` call. Two parallel listeners on the same
  URL space would produce double-invocation; one listener fan-out via
  context is the only safe pattern.
- **Soft dependency:** ADR-0008 must amend its Step 4 to consume
  rather than register. The orchestrator routes that amendment in
  the same patch sequence as the ADR-0010 grammar sync (see below).
  ADR-0011's Step 12 ships the registration; ADR-0008's Step 4 must
  switch from "register own listener" to "subscribe to provider
  context" before its PR can merge cleanly alongside this ADR.

This contract is verified at test time by T-0011-310 (existing
`useAuthDeepLink` still works alongside `LinkingProvider` — no
event-listener conflict), which becomes the regression anchor for
the "single addEventListener" invariant.

### ADR-0010 — Prompt engineering loop

**What ADR-0010 needs from ADR-0011 (if option (b) Sample-Spec Emulator):**
- The `LoadSpecFromDevMenu` hook from Step 13: dev-menu entry +
  `appcreator://devmenu/load-spec?fixture=<name>` URL scheme.
- The `__fixtures__/` directory under
  `apps/mobile/src/screens/Run/devMenu/` for bundled fixtures.

**What ADR-0011 does not own:**
- The eval-grading session orchestration.
- Screenshot capture from the dev-menu surface.
- The mapping from eval-prompt to fixture file.

If Cal-of-0010 picks option (a) (server-side rendered screenshots),
this dependency is moot.

#### Deep-link grammar reconciliation (R2 — P0-5)

ADR-0010 Step 6 currently references the grammar
`canvas://eval-fixture/{prompt_id}` mounted to `AppRunnerScreen`. Both
parts are stale:

1. `AppRunnerScreen` is **deleted** in ADR-0011 Step 11 (M1 → V0
   cutover). ADR-0010 Step 6's bash script
   (`xcrun simctl openurl booted canvas://eval-fixture/{id}`) would
   register against a screen that no longer exists.
2. URL scheme registration in `app.config.ts` is owned by ADR-0011;
   the registered scheme is `appcreator://` (not `canvas://`).
   ADR-0010's scheme cannot coexist without a second `CFBundleURLSchemes`
   entry, and Robert's design decision is one scheme.

**Resolution:** ADR-0011's grammar
`appcreator://devmenu/load-spec?fixture=<name>` is **AUTHORITATIVE**.
ADR-0010 Step 6's grammar reference is **stale** and must be updated
to use ADR-0011's grammar. This R2 revision declares the contract in
ADR-0011; the orchestrator routes a small grammar-sync patch to
ADR-0010 separately. **ADR-0011 makes no edits to ADR-0010 in this
revision.** Verification of consistency is covered by T-0011-321a
(grep-based check across the codebase + both ADR files).

### ADR-0008 — Celebration sheet for clone landing (R2 — non-blocking obs)

Sable's UX doc §Screen 4 specifies a celebration sheet that appears
when a user lands on a cloned mini-app from a friend's Universal Link.
**Ownership decision: ADR-0008.** Reasoning:

- The celebration sheet is **triggered by the clone-flow completion**,
  not by any V0-shell event. The trigger lives in the `onCloneLinkOpen`
  handler that ADR-0011 stubs in Step 12 and ADR-0008 fills in.
- The celebration content (cover-art preview, "from <username>"
  attribution, "Open" CTA) depends on the clone response payload that
  ADR-0008 defines via `POST /me/mini-apps/clone`.
- ADR-0011 ships the LinkingProvider surface; ADR-0008 ships the
  celebration sheet that consumes the clone response.

ADR-0011 does **not** add tests for the celebration sheet. ADR-0008's
test spec must include them.

### ADR-0013 — Sign in with Apple (deferred)

**What ADR-0013 inherits from ADR-0011:**
- The SignInScreen visual surface (Step 7).
- The `EXPO_PUBLIC_AUTH_PROVIDER` env var defaulting to `magic-link`.
- The stubbed `signInWithApple()` call that ADR-0013 fills in.

**What ADR-0013 owns end-to-end:**
- Apple Developer console setup.
- `expo-apple-authentication` integration.
- `POST /auth/apple` endpoint + Apple identity-token verification.
- `users.email` column behavior for masked Apple Relay emails.
- The cutover from magic-link to Apple Auth.
- Magic-link route deletion (post-cutover).

---

## Notes for Colby

1. **Phase ordering is non-negotiable.** Phase 1 (Steps 1-5) lands as
   one or two PRs; Phase 2 (Steps 6-11) cannot start until Phase 1's
   typecheck is green. Phase 3 (Steps 12-14) cannot start until Phase
   2's e2e test is green.

2. **The schema rename in Step 1 is the riskiest single migration in
   this ADR.** Test it on a clean DB first. Confirm with Eva that no
   staging DB has any `projects` data before merging. The migration
   is idempotent at the Postgres level (the `IF EXISTS` clauses) but
   not at the application level — the new columns added in this step
   are `NOT NULL` and must be backfilled before the `NOT NULL`
   constraint is applied. The Step 1 SQL block (inside one `BEGIN` /
   `COMMIT`) handles this in three phases: (a) `ADD COLUMN … text`
   with no `DEFAULT`, (b) one `UPDATE … SET col = COALESCE(col,
   sentinel)` covering all five new columns, then (c) `ALTER COLUMN
   … SET NOT NULL`. Sentinel values for grandfathered rows are
   `stance = 'productive'`, `accent_palette = 'neutral'`,
   `cover_art_seed = gen_random_uuid()::text` (per-row unique),
   `archetype = 'unknown'`, `sync_mode = 'local'`. **Critical
   nuance:** `sync_mode` must be added **without** a `DEFAULT
   'cloud-private'` clause on `ADD COLUMN`; if you add it, Postgres
   fills existing rows with `'cloud-private'` immediately and the
   COALESCE backfill to `'local'` will silently never fire (R2 P1
   finding). The `'cloud-private'` default for newly-created rows
   lives in the Drizzle schema layer
   (`syncMode: text('sync_mode').notNull().default('cloud-private')`),
   not in the migration. Grandfathered rows get `'local'` (AC-P10
   local-by-default semantics for data that pre-dates sync); new rows
   get `'cloud-private'` via the Drizzle default at INSERT time.

3. **The state-queries rename (Step 4) breaks every screen that
   imported `useProjectsListQuery`.** Plan the diff: rename the imports
   in Home/Chat/AppRunner (M1 screens) even though they're deleted in
   Step 11. The rename has to compile-clean across the M1 → V0
   transition.

4. **The `ShellLayout` component is the new "screen-shape" primitive
   for every shell.** Don't render the TabBar inside individual
   screens; render it once per screen via ShellLayout. The whole point
   is to make the tab bar's mount lifecycle stable across navigation.

5. **`AppShellThemeProvider` is `productive` + `focus` always.** Do
   not parameterize. The host chrome is visually constant; only the
   renderer's `RendererThemeProvider` carries per-mini-app
   (stance, palette). This is the load-bearing visual decision in
   Sable's spec.

6. **The Generating screen's progress bar is paced client-side, not
   server-driven.** Reanimated 4 `withSequence` + `withTiming` per
   Sable's pacing. Do not wire SSE chunks to the bar.

7. **Suggested-prompt session seed:** generate `crypto.randomUUID()`
   **once at app launch** and stash it in a module-level constant;
   the picker reads the same seed across re-renders. Don't re-seed on
   mount of CreateScreen — that defeats the purpose.

8. **Coachmark anchoring:** measure with `onLayout`, render at
   `position: 'absolute'` with measured offsets. Do not use a Tooltip
   library — Sable's note for Colby #8 covers this.

9. **The `RunFailedBanner` is a critical error path.** If the
   renderer throws, the banner replaces the body — but the host header
   + tab bar stay. The user never gets stranded.

10. **The `LoadSpecFromDevMenu` for ADR-0010** must be `__DEV__`-guarded.
    Production builds must not register the dev-menu entry. The check
    is at the module-load level, not at the render level — easier to
    audit.

11. **Soft-delete semantics.** `deleted_at IS NOT NULL` filters in
    every read path (`list`, `get`, `getVersion`). Future GDPR purge
    will hard-delete; for now, soft-delete is the contract.

12. **Out-of-scope email pre-fill.** The user's email comes from the
    session JWT. With magic-link (current), it's the user's real
    email. With SIWA (ADR-0013), it's the masked Apple Relay email
    (`j••@privaterelay.appleid.com`). The Out-of-Scope email field
    pre-fills with whichever the session has. The user can clear and
    re-type.

13. **`react-native-keyboard-controller`** wraps the app root. The
    Settings sheet and the OutOfScope email field need
    keyboard-avoidance. Don't fall back to RN core's
    `KeyboardAvoidingView`.

14. **Snapshot updates require a code-review note** per CLAUDE.md §8.
    If you update a snapshot, comment why in the PR description.

15. **Tests are 349 T-IDs across 14 steps** (R2 added 25 to address
    Roz's REVISE-WITH-NOTES verdict; R2 also reconciled per-step
    summary count errors carried from R1). Don't merge a step until
    every T-ID in that step has a corresponding `it(...)` block.
    Roz reviews tests against this spec verbatim.

---

> ✅ ADR saved (R3 revision 2026-05-10). **14 steps, 349 total tests** (see §Test Totals).
>
> R3 deltas vs R2 (Roz R2 APPROVED-WITH-NOTES, 1 P1 + 3 P2):
> - **P1 (sync_mode sentinel contradiction):** Step 1 SQL now adds
>   `sync_mode text` **without** a Postgres-level `DEFAULT
>   'cloud-private'` clause; the COALESCE backfill to `'local'` for
>   grandfathered rows now actually fires. The `'cloud-private'`
>   default for newly-created rows is supplied by the Drizzle schema
>   (`syncMode: text('sync_mode').notNull().default('cloud-private')`).
>   AC + Notes for Colby item 2 + T-0011-012 + T-0011-015a all
>   consistent on `'local'` for grandfathered rows; the SQL no longer
>   contradicts. Option 1 selected (privacy-safer, AC-P10 local-by-default).
> - **P2-1 (T-0011-118 + T-0011-119 categorization):** recategorized
>   Happy → Boundary (61st request returns 429 is over-the-edge).
>   Step 5 summary: Happy 10→8, Boundary 3→5; ratio 1.40→2.00.
>   Aggregate 1.24→1.27. Total 349 unchanged.
> - **P2-2 (LinkingProvider surface overlap with ADR-0008):** new
>   "Single Linking entrypoint contract" subsection under §Coordination
>   → ADR-0008 declares `LinkingProvider` is the sole
>   `Linking.addEventListener('url', …)` registration; ADR-0008's
>   `useUniversalLink` must consume via context. **Soft dependency:
>   ADR-0008 must amend its Step 4 to consume rather than register.**
> - **P2-3 (Notes for Colby item 2 stale sentinel values):** item 2
>   rewritten to match actual SQL (`'productive'`, `'neutral'`,
>   `'unknown'`, `'unknown'`, `'local'`); now also documents the
>   sync_mode DEFAULT-omission gotcha.
>
> R2 deltas vs R1 (retained): +25 T-IDs across Steps 1, 2, 3, 6, 8,
> 9, 10, 11, 12, 13, 14 to address Roz's REVISE-WITH-NOTES verdict
> (6 P0 + 12 P1 + 7 non-blocking observations). All 6 P0 findings
> closed with concrete T-IDs + acceptance-criteria text; all 12 P1
> findings closed; non-blocking obs folded in (per-step count
> reconciliations, cover-art seed stability, me.service.ts coverage
> gate, T-0011-158 logger.warn pin, down-migration comment block,
> celebration-sheet ownership decision, empty-state-chip negative
> assertion). ADR-0010 grammar reconciliation declared with ADR-0011
> grammar AUTHORITATIVE; cross-ADR consistency check added as
> T-0011-321a.
>
> **Decisions:**
> - **SIWA: deferred** to ADR-0013. ADR-0011 ships V0 shells against
>   magic-link auth behind `EXPO_PUBLIC_AUTH_PROVIDER` flag.
> - **Schema rename: Option A** (rename in place, single migration).
> - **Tabs: 2 tabs** (Library, Create) + Settings sheet.
> - **Navigation: native-stack with shared TabBar component**, not
>   React Navigation's bottom-tab navigator.
>
> **Hooks exposed:**
> - For ADR-0008: `LinkingHandlers` interface in
>   `apps/mobile/src/lib/linking/LinkingProvider.tsx` (Step 12) +
>   stub routes `POST /me/mini-apps/:id/share` and
>   `POST /me/mini-apps/clone` (Step 3).
> - For ADR-0010: `LoadSpecFromDevMenu` dev-menu entry + URL scheme
>   `appcreator://devmenu/load-spec?fixture=<name>` (Step 13).
>
> **Estimated implementation effort:** **5-10 PRs over 3-4 weeks.**
> Phase 1 ≈ 2 PRs (1.5 weeks), Phase 2 ≈ 5 PRs (2 weeks), Phase 3 ≈
> 2-3 PRs (0.5-1 week). Phase 2 has the highest test surface and
> highest reviewer load.
>
> Next: Roz R2 verdict was APPROVED-WITH-NOTES contingent on the
> sync_mode P1 fix + 3 P2 fold-ins; this R3 revision closes all four.
> Re-verification by Roz then forward to Colby for implementation.

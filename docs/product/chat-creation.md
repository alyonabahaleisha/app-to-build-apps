# Feature Spec: Chat → Generate → Publish (Maker Marketplace)

**Author:** Robert (CPO) | **Date:** 2026-05-02
**Status:** Draft — Pending Review
**Supersedes:** Marketplace cut in `docs/product/app-creation-poc.md` (Phase 3 → v1).

> Child spec of `docs/product/app-creation-poc.md`. Inherits all NFRs, the
> error envelope `{error: string, detail?: unknown}`, the rate-limit budget
> (30 req/min/user), the auth model (Supabase JWT, magic-link), and the A2UI
> 10-component catalog from the umbrella spec. Where this document conflicts
> with the umbrella, **this document wins** and the umbrella ACs called out
> in §"Umbrella reconciliation" below are deprecated.

---

## The Problem

ADR-0001 shipped auth and an empty library. The maker can sign in, see "no
apps yet," and that's it. The riskiest piece of the POC — *can the LLM
reliably produce a usable mini-app from one sentence?* — is still untested
in production.

But the umbrella spec frames the Library as a private collection. That model
under-uses the most powerful asset of a chat-driven app builder: **other
makers' work**. A maker staring at a blank chat input and a "describe an app
idea…" placeholder has no scaffolding for *what good looks like*. They type
"a calculator" and get something boring. They never come back.

A Library that is also a Marketplace solves this — first-time makers see
what other people built, get inspired, tap **Remix**, and ship their first
real attempt within minutes instead of starting from a cold prompt. The
maker becomes a community member, not a solo user. The conversion loop is:
**browse → inspire → remix → publish → become someone else's inspiration**.

**Cost of inaction.** Every week we don't have the chat→generate→publish
loop running with internal testers is a week of unfalsified assumptions
about the LLM's reliability, the loading-state UX, the "magic" of
`describe → it appears`, and whether makers actually publish their work.
≈$30k/week opportunity cost (umbrella carryover) plus an unbounded later
rewrite if any of these assumptions break.

## Who Is This For

| Persona | Need | Current Workflow | Pain Point |
|---|---|---|---|
| **The Maker** *(primary)* | Turn an idea into a usable app, see what others built, get noticed | Idea sits in Notes; never built | Cold prompt is paralyzing; no proof "this thing works"; no audience |
| **The Browser-Maker** *(consumer side, but still a maker)* | Open the app, see what's possible, find a starting point for their own idea | First-run library is empty (under ADR-0001) | "What is this app even *for*?" — abandons before first prompt |

**Out of persona for v1:** Pure consumers (people who only want to *use*
others' apps without making any). Q1 of discovery cut this — at 20 testers,
"both" means "neither, well." Re-evaluate post-launch if Library
engagement >>> publish rate (signal that consumers are showing up uninvited).

## Business Value

- **Business driver:** Validate the willingness-to-engage hypothesis. The
  POC's deepest unknown is *not* "does the LLM work" (it does, in eval) but
  *will makers publish their work and remix others'*. If yes, the
  marketplace is the engine of M2 (memory, edit-by-chat) — every published
  app becomes a memory anchor and an edit candidate. If no, we know to
  invest in private-first onboarding before community.
- **Impact scope:** Internal TestFlight, ≤20 testers, 7-day soak. ≥10 of
  them complete one full create→publish loop.
- **Cost of delay:** Same $30k/week as umbrella, plus: every week without
  Library/Browse data is a week of guessing on Phase 2 priorities.
- **Success metrics:** see KPIs below.

### KPIs

| Metric | Definition | Target | Measurement |
|---|---|---|---|
| **Generation success rate** | % of `/generate` calls that return a Zod-valid spec | ≥80% on 30-prompt eval; ≥85% in tester sample | Server event `generation_succeeded`/`generation_failed`; PostHog funnel |
| **p95 generation latency** | Server-time from request received to final SSE event sent | ≤120s (umbrella: 90s; tightened budget +30s for thinking phase) | OTel span on `/generate` |
| **Crash-free sessions** | % of mobile sessions ending without a fatal | ≥99% | Sentry over 7-day rolling window |
| **Publish-through rate** | % of successfully generated projects published within 60 min of generation | ≥30% on tester sample | Server event `app_published` joined to `generation_succeeded` |
| **Library engagement** | % of testers tapping into ≥1 Library item per week | ≥70% | `library_item_viewed` event by user |
| **Remix conversion** | % of Library detail views that result in a Remix tap (per session) | ≥15% | `remix_started` / `library_item_viewed` |

If publish-through-rate is <15%, publish friction is too high — re-evaluate
the publish sheet. If remix conversion is <5%, the inspiration loop is
broken — re-evaluate Library tile design (probably attribution/title legibility).

## User Stories

- As a Maker, I describe an app idea in chat and within ~90s I see a
  rendered app in AppRunner — proof that the loop works.
- As a Maker, after generation, my app saves to my private drafts. When I'm
  ready, I tap **Publish**. A sheet asks me to pick a handle (pre-filled),
  and one tap later my app is on the public Library.
- As a Browser-Maker, I open the app and the home tab shows the public
  Library — recent apps from other makers, by handle, with title and a
  preview tile. I scroll, tap one, and see the rendered app.
- As a Browser-Maker viewing someone else's app, I can interact with it —
  toggle toggles, increment counters — but my taps don't persist across
  visits. I'm sampling, not using.
- As a Browser-Maker, when I see an app I like, I tap **Remix**. The Chat
  screen opens with the original prompt pre-filled and editable, attributed
  ("remixed from @lucy"). When I generate, my new project links back to
  Lucy's via `parent_project_id`.
- As a Maker, I can unpublish my app at any time — it disappears from the
  Library but my drafts copy stays.
- As any authenticated user, I can sign out and back in (different device,
  same email) and find both my drafts and the public Library exactly as I
  left them.

## User Flow

### Happy path: maker → publish → remix loop

1. **Sign-in.** Maker A taps the magic link; lands on Home, which shows two
   tabs: **Library** (default) and **My drafts**. Library is empty (cold
   start) or shows seeded examples (see §Risks: cold-start seeding).
2. **First prompt.** Maker A taps "✨ Create new app" → Chat screen.
3. **Type → Send.** Maker A types *"a tip splitter for my coffee shop"*
   and taps Send.
4. **Two-stage thinking UX.** Loading bubble cycles:
   - 0–first-thinking-event: *"Thinking about your idea…"* (Anthropic
     extended-thinking phase).
   - first-tool-event–done: *"Building your app…"* (tool-use phase).
   - State changes are driven by **real server events** via SSE on
     `/generate`, not a client timer.
5. **Render.** Within ~60–120s, navigate to AppRunner. The app is rendered.
   Maker A taps the toggles, increments the counter — works locally.
6. **Save state.** Project is already saved as `visibility: 'private'`. Top
   bar shows: ← back arrow, title (auto-derived), trailing **Publish**
   button.
7. **Publish.** Maker A taps Publish → bottom sheet: *"Publish as `alyona`?
   You can change your handle here."* with one editable text field
   pre-filled. Maker A accepts → sheet dismisses with success toast → tile
   on the Library tab now shows the app, attributed.
8. **Browse → remix.** Maker B opens the app, lands on Library tab, scrolls,
   sees Maker A's tip splitter, taps it. AppRunner loads in **try-mode**
   (see §"AppRunner modes" below). Maker B taps the buttons; works.
9. **Remix tap.** Maker B taps **Remix**. Chat opens with prompt pre-filled
   *"a tip splitter for my coffee shop"* and an attribution chip ("remixed
   from @alyona") above the input.
10. **Maker B edits & sends.** *"a tip splitter that supports multiple
    currencies."* The new project lists `parent_project_id = <A's project>`.
    On publish, its tile shows "remixed from @alyona."

### Unhappy paths

- **Empty / overlong prompt** (1–2000 chars validated server-side): Send
  disabled below 1 char, inline error at 1900+, hard-rejected at 2000+.
- **LLM emits malformed spec** (Zod parse fails): server returns 400
  `{error: 'invalid_spec', detail}`; mobile shows toast *"I couldn't turn
  that into an app. Try a different idea."* Project is **not** saved. Chat
  preserves the prompt for editing.
- **Anthropic 429:** server retries 2× with exponential backoff (1s, 2s);
  if still 429 → 503 `{error: 'rate_limited'}`; toast *"We're a bit busy
  right now. Try again in a minute."*
- **Anthropic transport error:** server returns 500 `{error: 'internal'}`;
  same toast as malformed spec but without retry suggestion. Sentry alert
  fires.
- **SSE connection drops mid-generation:** client treats as a transport
  error after 30s of silence (no events). Project state on server: if the
  Anthropic call completed and validated, the project is saved as private —
  user finds it in My drafts on next refresh. Toast: *"Connection lost. We
  saved your draft — check My drafts."*
- **Publish: handle taken:** server returns 400 `{error: 'handle_taken'}`;
  sheet shows inline error *"Handle taken. Try another."*.
- **Publish: invalid handle** (regex `^[a-z0-9-]{3,20}$` — lowercase
  alphanumeric + dashes only, 3–20 chars): server returns 400
  `{error: 'invalid_handle'}`; sheet shows inline error.
- **Remix: parent unpublished or deleted:** Remix endpoint still works
  (parent fetch by ID, not by visibility). Browser sees a "this maker
  unpublished the original" banner above the prompt input but the prompt is
  preserved.
- **Try-mode renderer error** (spec corrupt or component unsupported):
  AppRunner shows the umbrella's render-error fallback ("This app didn't
  render correctly. [Back to Library]"). P0 instrumentation event:
  `render_failed` with project_id and render_hash.
- **Browse offline:** Library tab shows last-cached items from TanStack
  Query (read-only); top banner *"You're offline. Some content may be
  stale."*; tap-into-detail disabled. Generation disabled offline.
- **Closed-app-mid-generation:** Anthropic call completes server-side; on
  next foreground, mobile syncs `/me/projects` and the result is in My
  drafts (or visible if the user explicitly published — but auto-publish is
  not on in v1, so it stays private).

### AppRunner modes (cross-cutting)

AppRunner is invoked in three contexts. Each has different state and CTAs:

| Mode | Entry | State | Top-bar CTAs | Persistence |
|---|---|---|---|---|
| **Owner-edit** | Maker opens own draft from My drafts | `state = renderer's hydrated state for this user`, persisted across visits in client tier-3 user storage (MMKV scoped by user ID, see ARCHITECTURE.md §5) | ← back, **Publish** (if private) or **Unpublish** (if public) | Per user, persistent |
| **Try** | Browser taps a Library item | `state = {}`, ephemeral, dropped on screen exit | ← back, **Remix** | None — no writes |
| **Owner-public-view** | Maker reopens own already-published app | Same as Owner-edit | ← back, **Unpublish** | Per user, persistent |

Try-mode and Owner-modes share a renderer; they differ only in initial
state and which CTAs are visible. Cal's renderer doesn't need to know the
difference — the host (AppRunner) hands it the right `state` and `dispatch`.

## Edge Cases & Error Handling

| Scenario | Behavior |
|---|---|
| Browser tries to publish someone else's project | 403 `{error: 'forbidden'}`. Should be unreachable from UI — Publish CTA only shows for owners. Logged as a security event if it ever fires. |
| Browser tries to GET `/library/:id` for a private project they don't own | 404 `{error: 'not_found'}` (not 403 — don't leak existence). |
| Maker publishes, then deletes account (Phase 2 GDPR flow) | Out of scope at v1. Documented in §Risks. |
| Library has 0 public projects (week-1 cold start) | Empty state: *"No public apps yet — be the first to publish."* Big "Create new app" CTA. |
| Library has 100+ public projects (unlikely at 20 testers, but…) | Cursor-paginated, 20 per page. Scrolling triggers next-page fetch. |
| Two simultaneous Publish taps on the same project | Server idempotent — second call is a no-op (already public). |
| Publish on a project that was never successfully generated (zombie row) | Should be unreachable; server returns 400 `{error: 'invalid_state'}` if it occurs. |
| User has `users.handle = null` and tries `/library` queries | Read paths don't require a handle. Handle is required only on Publish. |
| Handle uniqueness race (two users pick same handle simultaneously) | First commit wins. Loser gets `{error: 'handle_taken'}` and re-prompts. |
| Remix-of-a-remix-of-a-remix (chain depth) | Allowed at v1. `parent_project_id` is single-pointer; the chain is implicit. UI shows only the immediate parent attribution, not the full chain. |
| Maker prompts contain PII (emails, real names) | Maker's responsibility. Publish sheet warns: *"Publishing exposes the words you typed to other makers."* Phase 2: optional one-line summary instead of raw prompt. |

## Acceptance Criteria

### Generation (sharpens umbrella AC-G1 through AC-G10)

- [ ] **AC-CG-G1**: Authenticated user can submit a prompt (1–2000 chars) on
      Chat. Empty/overlong rejected client-side and server-side.
- [ ] **AC-CG-G2**: Server calls Claude `claude-sonnet-4-6` with extended
      thinking enabled (`thinking: {type: 'enabled', budget_tokens: ≥4000}`)
      and `tool_choice: {type: 'tool', name: 'produce_app_spec'}`.
      Free-text JSON is rejected.
- [ ] **AC-CG-G3**: System prompt is split into static + cacheable catalog
      blocks (`cache_control: {type: 'ephemeral'}` on catalog).
- [ ] **AC-CG-G4**: Server emits SSE events on `/generate` in this order:
      `thinking_started` → (Anthropic thinking phase runs) →
      `building_started` → (tool-use phase runs) →
      `done` (with the spec + project metadata) **or** `error` (with code).
- [ ] **AC-CG-G5**: Server validates LLM tool input against
      `A2UISpecSchema`. On success, persists project as `visibility:
      'private'` and returns 200 via SSE `done` event. On failure, emits
      `error` with `{code: 'invalid_spec', detail: <flattened zod issues>}`
      and does **not** persist.
- [ ] **AC-CG-G6**: Server enforces `max_tokens: 8000` output, refuses
      input >12000 chars (system+messages) with 400
      `{error: 'prompt_too_large'}`.
- [ ] **AC-CG-G7**: Anthropic transport error → 500
      `{error: 'internal'}`; logs `safeMessage(err)`; never leaks SDK stack
      or prompt content.
- [ ] **AC-CG-G8**: Anthropic 429 → server retries 2× with exponential
      backoff (1s, 2s); if still 429 → 503 `{error: 'rate_limited'}`.
- [ ] **AC-CG-G9**: Server hashes `user_id` and passes as
      `metadata.user_id` on every Anthropic call.
- [ ] **AC-CG-G10**: Generation success rate ≥80% on the 30-prompt eval
      set. p95 latency ≤120s (server-time, including thinking phase).
- [ ] **AC-CG-G11**: A `/generate` request including `parent_project_id`
      links the new project via the same column. Provenance is preserved
      whether the parent is currently public or private.

### Publish & Library

- [ ] **AC-CG-P1**: `POST /projects/:id/publish` requires owner JWT; sets
      `visibility = 'public'` and `published_at = now()`. Idempotent
      (re-publish is a no-op). Returns 200 with the updated project.
- [ ] **AC-CG-P2**: First publish for a user without a handle fails with
      400 `{error: 'handle_required'}` unless body includes
      `{handle: <valid>}`. Subsequent publishes auto-use the stored handle.
- [ ] **AC-CG-P3**: Handle validation: regex `^[a-z0-9-]{3,20}$`; unique
      across `users.handle`. Conflict → 400 `{error: 'handle_taken'}`.
- [ ] **AC-CG-P4**: `POST /projects/:id/unpublish` sets `visibility =
      'private'` and `published_at = null`. Project's spec, history, and
      remix children are unaffected.
- [ ] **AC-CG-P5**: `GET /library` returns public projects, cursor-paginated
      (default 20, max 50), ordered by `published_at DESC`. Includes
      `parent` summary (id, author_handle, title) when applicable.
      Excludes `spec_json` (clients fetch detail on tap-in).
- [ ] **AC-CG-P6**: `GET /library/:id` returns the public project +
      current_version + `original_prompt` + `parent` summary. 404 for
      private/non-existent (don't leak existence to non-owners).
- [ ] **AC-CG-P7**: `GET /me/projects` returns the user's projects
      (private + public), ordered by `updated_at DESC`. Includes
      `visibility` and `published_at`.

### AppRunner modes

- [ ] **AC-CG-A1**: Owner mode shows top-bar CTA **Publish** (when
      private) or **Unpublish** (when public). Browser-Try mode shows
      top-bar CTA **Remix**.
- [ ] **AC-CG-A2**: Try-mode initializes the renderer with `state = {}`,
      drops state on screen exit, never writes to MMKV.
- [ ] **AC-CG-A3**: Owner-mode persists state in MMKV scoped by user ID
      (per ARCHITECTURE.md §5 tier 3). Cross-user data isolation: a
      browser opening someone else's draft (impossible via UI; only via
      direct URL manipulation) gets 404 from `/library/:id`.
- [ ] **AC-CG-A4**: Renderer error in any mode shows the umbrella's
      render-error fallback. Logged as `render_failed` event with
      project_id, render_hash, mode.

### Remix loop

- [ ] **AC-CG-R1**: Tapping Remix on a Library item navigates to Chat with
      the prompt pre-filled (from `original_prompt`), an attribution chip
      visible above the input ("remixed from @lucy"), and a hidden state
      `parent_project_id` carried into the next `/generate` call.
- [ ] **AC-CG-R2**: The new project's `parent_project_id` is set in the DB
      and surfaced on its Library tile (when published) as "remixed from
      @lucy".
- [ ] **AC-CG-R3**: If the parent has been unpublished or deleted by the
      time of remix, the Chat screen still loads with the prompt and shows
      a one-line banner: *"The original was removed."* The new project
      still saves with `parent_project_id` pointing at the (now-private or
      missing) original — for provenance.

### Identity

- [ ] **AC-CG-I1**: First publish by a user shows a publish sheet with one
      editable handle field, pre-filled from the email local-part
      (sanitized to match the regex). User can edit before confirming.
- [ ] **AC-CG-I2**: Stored handle is immutable at v1 (can't be changed
      after first publish). Documented in §Risks; revisit Phase 2.
- [ ] **AC-CG-I3**: No profile pages. Tapping a handle anywhere does
      nothing. Phase 2 candidate.

### Cold-start seeding (`@example` handle)

- [ ] **AC-CG-S1**: A reserved system user with `users.handle = 'example'`
      and a sentinel `users.email` is provisioned via DB seed migration.
      The `@example` user has no auth credentials and cannot be signed
      into; its only purpose is to own seed projects.
- [ ] **AC-CG-S2**: Seed migration creates 5–10 hand-picked apps owned by
      `@example`, each with `visibility: 'public'`, `published_at` set to
      a back-dated timestamp older than any real maker's first publish, so
      seed apps sit at the bottom of the feed and real maker apps surface
      above them as soon as anyone publishes. Spec_json for each is
      hand-authored against the A2UI schema (validated in CI by the same
      `A2UISpecSchema` the runtime uses) — *not* generated by the LLM, so
      seeds are deterministic and reproducible.
- [ ] **AC-CG-S3**: Library tiles owned by `@example` show a small
      "featured" badge to disambiguate seed content from real maker work
      — protects against tester confusion ("did the LLM make this?"). The
      visual is Sable's call.

### Quality / cross-cutting (carryover from umbrella, sharpened)

- [ ] **AC-CG-Q1**: All log output PII-safe. The `original_prompt` is
      **stored** (it's product data) but never logged at INFO. Langfuse
      records it in traces (intentional). Email never logged.
- [ ] **AC-CG-Q2**: WCAG AA contrast in light + dark; VoiceOver labels on
      every interactive shell element including the publish sheet,
      attribution chip, Remix CTA.
- [ ] **AC-CG-Q3**: Rate limits per route per user: 30/min on
      `/generate`; 60/min on `/projects/:id/publish` and
      `/projects/:id/unpublish`; 120/min on `GET /library`,
      `GET /library/:id`, `GET /me/projects`.
- [ ] **AC-CG-Q4**: 30-prompt eval set runs in CI on every PR touching
      `services/api/src/llm/` or `packages/a2ui-schema/`.
- [ ] **AC-CG-Q5**: All `/library*` endpoints return only public-eligible
      data; private projects of other users are never observable through
      any endpoint other than the owner's `/me/projects`.

## Scope

### In Scope (v1 / this slice)

- Chat screen with prompt input, two-stage SSE-driven loading state, error
  toasts, and Remix prompt pre-fill via query params.
- `POST /generate` with extended thinking + forced tool use; SSE response.
- Server saves successful generations as `visibility: 'private'`.
- Publish sheet (handle picker on first publish only).
- `POST /projects/:id/publish`, `POST /projects/:id/unpublish`.
- `GET /library` (public feed, cursor-paginated).
- `GET /library/:id` (public project detail).
- `GET /me/projects` (replaces and renames the umbrella's `GET /projects`).
- Library + My-drafts tabs on Home (replaces single-list Home).
- AppRunner modes: Owner (with Publish/Unpublish), Try (ephemeral state +
  Remix CTA), Owner-public (with Unpublish).
- 30-prompt eval harness with binary structural assertions + manual escape
  hatch.
- Cold-start seed: `@example` system user + 5–10 hand-authored seed apps
  in a DB seed migration (AC-CG-S1–S3).

### Phase 2 (post-POC, still M1 if budget allows)

- Edit-by-chat (`/edit` with JSON Patch tool).
- Spec streaming (currently SSE only carries phase events; spec content is
  one-shot in the `done` event).
- Profile pages (`/u/:handle`).
- Handle changes (rename + redirects).
- Push notifications on remix-of-my-app.
- Project delete (with confirmation; cascades remix children to keep
  parent_project_id pointing at the deleted ID for provenance).
- Like / favorite / save-for-later on Library items.
- Cold-start seeding (system-authored examples).

### Explicitly Out of Scope

- Pure consumer experience (Q1 cut).
- Install/save someone else's app to my library to use persistently (Q3 cut).
- Comments, follows, or any social-graph primitive.
- Moderation tooling (abuse reports, takedowns, NSFW classifier). Phase 2
  if engagement justifies. At 20 internal testers, manual triage by Robert.
- Payments / IAP / Stripe.
- Web or Android targets.
- Apple/Google sign-in (magic-link only at MVP).
- Edit history / version timeline UI (versions are stored; no UI to browse
  them at v1).
- Public share URLs ("share this app via link to a non-tester"). The
  Library is in-app only; even a published app is invisible to the public
  internet.
- Offline-first / PWA / installable web apps.

## Umbrella reconciliation

Umbrella spec ACs that are **deprecated by this document**:

| Umbrella AC | Status | Replacement |
|---|---|---|
| AC-P4 (`GET /projects` returns the current user's projects) | Deprecated | `GET /me/projects` (AC-CG-P7) + `GET /library` (AC-CG-P5) |
| AC-P5 (404 to non-owners on `GET /projects/:id`) | Deprecated | `GET /library/:id` returns public detail; `/me/projects/:id` returns owner detail; cross-paths 404 |
| Umbrella scope: "Marketplace (publish, browse, fork) — out of scope Phase 3+" | Superseded | This document, v1 |
| Umbrella scope: "Streaming generation (SSE) — Phase 2" | Partial supersede | SSE is in scope for **phase events** (`thinking_started`, `building_started`, `done`). Spec-content streaming remains Phase 2. |

A one-line note will be added at the top of `app-creation-poc.md`
referencing this document.

## API Contracts

All endpoints require `Authorization: Bearer <jwt>` unless noted.
Error envelope: `{error: string, detail?: unknown}`. Codes: `invalid_input`
(400), `unauthorized` (401), `forbidden` (403), `not_found` (404),
`invalid_spec` (400), `prompt_too_large` (400), `invalid_handle` (400),
`handle_required` (400), `handle_taken` (400), `invalid_state` (400),
`rate_limited` (429 client / 503 upstream), `internal` (500).

| Endpoint | Auth | Returns | Excludes |
|---|---|---|---|
| `POST /generate` | JWT | **SSE stream** of events: `{type: 'thinking_started'}` → `{type: 'building_started'}` → `{type: 'done', project: {id, title, current_version_id, parent_project_id\|null, visibility: 'private', original_prompt, created_at}, spec: A2UISpec, render_hash, thinking_duration_ms, generation_duration_ms}`. On error: `{type: 'error', code, detail?}` then close. | thinking trace text, server prompt content, error stack, other users' data |
| `POST /projects/:id/publish` | JWT, owner | `{project: {id, title, visibility: 'public', published_at, author_handle, parent_project_id\|null, render_hash}}` | other users' project data, server prompts |
| `POST /projects/:id/unpublish` | JWT, owner | `{project: {id, visibility: 'private', published_at: null, ...}}` | (same) |
| `GET /library?cursor=&limit=` | JWT | `{items: [{id, title, author_handle, published_at, render_hash, parent: {id, author_handle, title}\|null}], next_cursor: string\|null}` | `spec_json`, private projects, `original_prompt` (in detail endpoint), other users' private projects |
| `GET /library/:id` | JWT | `{project: {id, title, author_handle, published_at, original_prompt, parent: {id, author_handle, title}\|null}, current_version: {id, spec_json, render_hash, created_at}}` | thinking trace, server prompts, other users' private projects |
| `GET /me/projects` | JWT | `{items: [{id, title, visibility, published_at\|null, updated_at, current_version_id, parent_project_id\|null, render_hash}]}` | `spec_json`, other users' projects |
| `GET /me/projects/:id` | JWT, owner | `{project: {…full owner-visible fields including original_prompt, visibility, parent_project_id}, current_version: {id, spec_json, render_hash, created_at}}` | thinking trace, server prompts, other users' projects |

**Excluded from every response (across all endpoints):**
`service_role_key`, `jwt_secret`, `anthropic_api_key`, raw email addresses
(authors are addressed by handle only — email is observable solely via the
caller's own JWT claims), Anthropic thinking-trace text, internal model
names, internal Langfuse trace IDs.

## Non-Functional Requirements

- **Performance:**
  - p95 `/generate` ≤120s server-time including extended thinking.
  - p95 `/library` and `/me/projects` ≤500ms.
  - p95 `/library/:id` ≤500ms.
  - Library scroll: 20-item pages render in <100ms (skeleton during fetch).
- **Security:**
  - JWT validation on every authenticated route.
  - Tokens in `expo-secure-store` only.
  - Rate limits per AC-CG-Q3.
  - Server input validation via Zod on every POST body.
  - Handle uniqueness enforced by DB unique constraint, not just app code.
- **Accessibility:** WCAG 2.1 AA. VoiceOver on every interactive surface
  including the publish sheet (handle field, confirm/cancel),
  attribution chips, Remix CTA, Try-mode interactive controls. Hit targets
  ≥44×44pt. Reduced-motion respected on the two-stage loading transition.
- **Privacy:**
  - `original_prompt` stored as product data; never logged at INFO.
  - Email never appears in application logs or API responses (only in JWT
    claims observable to the user themselves).
  - Publish sheet warns: *"Publishing exposes the words you typed."*
  - GDPR account-deletion deferred to Phase 2 (umbrella carryover).

## Dependencies

| Dependency | Status | Owner |
|---|---|---|
| ADR-0001 shipped (auth, schema, Home shell) | Done | n/a |
| Renderer (full A2UI catalog, all 4 actions) | Pending — ADR-0003 in umbrella's slicing; this spec presumes it lands **before or with** the marketplace UX, since browse/try/remix all require rendering. **See §Risks: cross-ADR sequencing.** | Cal to re-slice |
| Anthropic API key with extended thinking enabled | Done (key present); confirm extended thinking access | Engineering — verify in spike |
| Supabase project + JWT secret | Done (umbrella) | n/a |
| 30 eval prompts written | Not yet | Robert — drafts during build, refines with user |
| EAS dev-client build with current native deps | Done as of 2026-05-02 (the user just ran one) | n/a |
| Apple Developer enrollment | Pending | User — required for ADR-0003 / TestFlight, not for this slice (sim is sufficient) |

## Risks & Open Questions

| Risk | Likelihood | Mitigation |
|---|---|---|
| **Cross-ADR sequencing.** This spec presumes the renderer exists. Cal's umbrella slicing has Generation in 0002 and Renderer in 0003. The Marketplace UX described here (Browse, Try, Remix) is non-functional without the renderer. | High | **Cal must re-slice**: either pull renderer forward into the same slice as Generation, or split this spec across two ADRs (0002 = Generate + Publish endpoints + My-drafts list; 0003 = Renderer + Library tab + Try + Remix). My recommendation as PM: split. ADR-0002 ships the loop with private-only drafts; ADR-0003 ships the public Library on top once the renderer is in. |
| LLM emits invalid specs faster than we can iterate the system prompt. | Medium | Tighten system prompt against eval set; extended thinking should *help* coverage (the model deliberates before emitting); per-component example shots in catalog. Cap catalog at 10. |
| Library is empty at week 1 (cold start). | High | **Confirmed 2026-05-02:** seed with 5–10 hand-picked example apps from the eval set, attributed to handle `@example` (system-owned user, no auth). Published on db init via a seed script. See AC-CG-S1–S3. |
| Extended thinking cost overrun. | Medium | Per-engineer per-day spend cap at $30 (was $20 in umbrella; +50% for thinking). Track per-tester per-day in PostHog. |
| Handle squatting (a tester picks `@admin`). | Low | Reserve a small list (`admin`, `system`, `official`, `support`, `app`, `creator`) as DB-seeded forbidden handles. Document. |
| Maker publishes app whose prompt contains PII. | Medium | Publish sheet warning copy. Phase 2: optional summary instead of raw prompt. |
| SSE on `/generate` adds infrastructure complexity vs. one-shot HTTP. | Low | The umbrella architecture already mandates SSE for streaming (CLAUDE.md §7). We're using SSE for a *narrower* case (phase events only, ~3 events per generation). Cal owns the implementation; my product call is "no fake-progressing client timer." |
| Immutable handles annoy users. | Low | Documented limitation; revisit if ≥20% of testers ask. Phase 2 work item. |
| Remix-chain depth (A→B→C→D) gets visually confusing. | Low | At v1, only direct parent attribution shown. Full chain UI is Phase 2. |
| Two testers pick the same handle simultaneously. | Very low | DB unique constraint catches it; UX retries. |
| Browser sees an app that was unpublished mid-tap. | Low | Library list is cached client-side for 60s; tap → 404 from `/library/:id` → toast *"That app was just removed."* Back to Library. |

**Open questions (need answers before Cal can re-slice cleanly):**

1. **ADR sequencing** — split as I recommended (0002 = Generate + private drafts + Publish endpoint; 0003 = Renderer + Library/Browse/Try/Remix UX), or pull renderer forward into 0002 and ship the whole loop as one ADR? Cal's call once he reads this.
2. **Cancel-mid-generation** — the umbrella says cancel is Phase 2; the loading state UX (Sable's existing doc) shows a non-interactive spinner. Is that acceptable in v1, or do we want a real cancel button? My recommendation: **Phase 2** stands.

## Timeline Estimate

Assuming ADR-0001 is done (it is), and Cal splits this spec across two ADRs:

| Phase | Effort | Dependencies |
|---|---|---|
| Cal re-slice + ADR-0002 (Generate + private drafts + Publish endpoint, no UI for browse) | 1 day | This spec approved |
| ADR-0002 implementation (Colby): SSE `/generate`, extended thinking, save private, publish endpoint, handle column, Chat screen UI, two-stage loading state, eval harness | 4 days | ADR-0002 |
| Eval harness 30-prompt run + tuning | 1.5 days | All endpoints done |
| ADR-0003 (Renderer + Library/Browse/Try/Remix + AppRunner modes) | 1 day | ADR-0002 merged |
| ADR-0003 implementation: 10-component renderer, AppRunner three modes, Library tab + tile + cursor pagination, Try-mode ephemeral state, Remix prompt pre-fill, attribution chip | 4 days | ADR-0003 |
| TestFlight build + submit | 0.5 day | Apple Dev ready |
| Internal-tester soak (parallel to other M1 work) | 7 days wall-clock | Build available to ≥3 testers |
| **Total dev** | **~12 days** | |

Wall-clock with Apple Dev enrollment slip + buffer: ~3 weeks. If Cal opts
to bundle everything in one ADR instead of splitting, dev time is
unchanged but the merge gate is later (riskier).

## Notes for Cal

- **Re-slice is your call.** My strong PM preference is to split this into
  two ADRs as scoped above — the rationale is in §Risks. Take the input
  and decide what merges cleanest.
- **SSE on `/generate`** is a real ask. Three events: `thinking_started`,
  `building_started`, `done` (with payload) — plus `error`. The spec
  payload is one-shot in `done`; we're not streaming spec content. Pick
  the cheapest server impl that gives the client honest phase signals.
- **Extended thinking budget** is `≥4000` tokens. Tune against the eval
  set — if 4k doesn't move the needle vs. one-shot, drop the thinking
  config and adjust the user-perceived UX to single-stage. (Robert
  signs off on the UX fallback if the data justifies it.)
- **Two-tab Home** changes the navigator. Sable's UX doc (`Screen 2:
  Home (Library)`) was written for the umbrella's single-list model. Flag
  back to Sable for a tab-bar update before implementation.
- **`parent_project_id` already exists** on the umbrella's projects schema.
  No migration needed for the column; new columns: `visibility`,
  `published_at`, `original_prompt`, plus `users.handle`.
- **Handle uniqueness** must be a DB-level UNIQUE constraint, not
  application-only. Race conditions during simultaneous first-publishes
  must surface as `handle_taken`, not as silent corruption.
- **`/library*` reads must filter on `visibility = 'public'`** at the SQL
  level, not at the application level. Index on `(visibility,
  published_at DESC)` for the feed query.
- **Try-mode renderer must NOT call any state-persistence side effect.**
  Pass an in-memory dispatch and discard on unmount. AC-CG-A2 verifies.

---

> ✅ Feature spec saved to `docs/product/chat-creation.md`
>
> **Next step:** Hand to Cal (`/architect`) to re-slice ADR-0002 and ADR-0003
> against this spec. Sable should also see this — the two-tab Home and the
> three AppRunner modes need a UX pass before Cal locks the implementation.
> If the user wants the loop in front of testers fastest, run them in
> parallel: Sable on the UX delta, Cal on the data-model + endpoint
> sequencing.

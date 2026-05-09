# Feature Spec: Canvas V0

**Author:** Robert (CPO) | **Date:** 2026-05-07
**Status:** **Draft — BLOCKED on Sponsor reconciliation** (see §0)
**Source:** `docs/product/canvas-v0-brief.md` (cross-functional decision brief)
**Hypothesis under test:** H5 (carried forward from M2; see `docs/product/hypothesis-tracker.md`)
**Predecessor:** M2 (`docs/product/M2-milestone.md`) — partially superseded; see §0.
**Successor:** Canvas V0.5 (post-launch; informed by V0 user signal)

> Spec is **not** a re-litigation of the brief — the brief locked the cross-
> functional decisions and this document converts them to a buildable contract
> with KPIs, acceptance criteria, API surface, and an App Review package.
> Where the spec adds testable detail beyond the brief, it is called out
> inline. Where the spec **conflicts** with prior shipped work (ADR-0004),
> §0 surfaces it for explicit Sponsor decision before any V0 build begins.

---

## 0. Reconciliation with ADR-0004 / M2 — **decision required before build**

Canvas V0 as scoped in the brief is **not compatible** with M2 / ADR-0004
on five concrete dimensions. This is a scope redirect, not a refinement.
Sponsor (Alyona) must sign off on supersession before any V0 build work
begins, because the inheritance question changes the work plan materially.

| Dimension                | M2 / ADR-0004 (currently shipped on `agent/M2-VS-01`)                                                 | Canvas V0 (this spec)                                                                       | Reconciliation needed                                                                |
| ------------------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Pipeline shape           | Two-stage **Plan → Build** (Haiku planner + Sonnet builder), p95 ≤90s                                 | **Single-call Sonnet**, total latency 7–9s (p95 target derived: ≤12s — see §AC-G)           | V0 explicitly retires the planner stage. ADR-0004 Steps 5–6 become legacy.           |
| Edit pipeline            | `/edit` route with RFC 6902 patch tool (ADR-0004 Step 7)                                              | **No edit pipeline.** Modifications happen by re-prompting from scratch                     | V0 retires `/edit`. ADR-0004 Step 7 becomes legacy.                                  |
| Component catalog        | 16 components (M1's 10 + M2's +6 budget)                                                              | **28 components**, fully re-organized into 7 tiers                                          | V0 replaces the catalog wholesale. The M2 +6 budget is moot.                         |
| Archetype taxonomy       | 8 archetypes (`docs/product/M2-archetype-taxonomy.md`)                                                | **4 archetypes**: ListCRUD, Tracker, Journal, Calculator                                    | V0 narrows. Dashboard, Social, InfoDisplay, Game become out-of-scope (V0.5+).        |
| Distribution & cohort    | Alpha-only via TestFlight (n ≥ 50, ≥2 weeks); **no App Store submission**                             | **Public App Store launch** in week 6 with Universal Link share                             | This is the largest redirect: V0 is a public launch, not an alpha cohort experiment. |
| Telemetry / eval harness | Telemetry module + eval harness shipped (ADR-0004 Steps 8–9), archetype-labeled against 8 archetypes  | Telemetry kept; eval set must be re-authored against 4 archetypes; targets re-baselined     | Re-author eval. Keep telemetry surface (Sponsor decision: salvage vs. retire).       |

### Sponsor decision required (one of three paths)

1. **Supersede** — Canvas V0 replaces M2 in flight. ADR-0004 Steps 5–7 are
   legacy code; we keep them building but stop investing. The eval harness
   and telemetry from Steps 8–9 are inherited and re-targeted to 4 archetypes.
   M2 milestone brief is annotated **superseded by Canvas V0**.
   *(This is the path the brief implies; recommended if the V0 launch story is real.)*
2. **Sequence** — Finish M2 to its sign-off (week 7 H5 review), then start
   Canvas V0 as a new milestone. Push public launch by ~5 weeks.
   *(Lowest risk for product hygiene; highest risk for whatever forced the V0 redirect.)*
3. **Revise the brief** — V0 keeps M2's two-stage pipeline and `/edit`,
   reuses 8 archetypes, ships the planner. The brief is wrong and needs PM
   to push back on the architects who wrote it.
   *(Only viable if the planner+edit work in `agent/M2-VS-01` is the right architecture for a public launch and the brief authors didn't know it was already built.)*

### Recommended path: **Supersede.**

- The brief was authored by the cross-functional Canvas team after the M2
  pipeline shipped; it explicitly knows what it's cutting.
- Sticking with the planner adds ~80s to the latency budget the brief
  treats as load-bearing for the public-launch UX (7–9s vs. 90s is a
  different product).
- `/edit` is real engineering surface that costs cycles in the next 6
  weeks; the brief's "re-prompt to edit" is acceptable at V0 because
  the cost of regeneration (~$0.10) is sub-bug-fix.
- M2's H5 hypothesis carries forward into V0 as a public-launch question,
  not an alpha-cohort one. The metrics get harder; the question is the
  same.

### What to do until reconciled

- This spec is **frozen at Draft** until §0 is signed off.
- No `/architect` handoff for the V0 schema or renderer until the path is
  picked. Sable can begin design work against the brief in parallel
  because the design system is decoupled from the pipeline question.
- M2 continues to build on `agent/M2-VS-01` until §0 is signed; we don't
  delete shipped work in anticipation of a decision.

> **Owner:** Robert (PM). **Decision-maker:** Alyona Yanuchek (Sponsor),
> with Eng Lead and Design Lead co-signers.
> **Decision due:** **2026-05-12** (next business week).

---

## Decision

Ship **Canvas**, a native iOS app that converts a plain-language prompt into a
working, shareable mini-app in 7–9 seconds, in a 6-week build window
culminating in App Store submission. V0 proves the loop on **four
archetypes** (ListCRUD, Tracker, Journal, Calculator), a **closed
28-component catalog**, a **single-call Sonnet pipeline**, and a
**Universal Link share flow** with `clone` mode only.

V0 is creator-funded (no friend-fallback billing) and ships **light mode,
iOS only, English only**. The on-device summarize feature is the only
runtime AI capability; everything else (vision, image gen, chat) is V0.5
and is gated by **out-of-scope prompt capture** that drives V0.5
prioritization on real signal.

## Rationale

- M1 proved generation works in eval. M2 was building toward H5 alpha
  measurement on an internal cohort. Canvas V0 is the **public** version
  of the same H5 question — a generation product can win retention at
  the quality bar — at the scale where the answer matters.
- The 4-archetype scope is deliberately narrow: it's the smallest set
  that lets a stranger type a plausible prompt and get a coherent,
  visually defensible result. Going wider before this works is paper.
- The 28-component catalog is wider than M2's 16 because the brief is
  not gated on alpha-cohort measurement — it's gated on **public-launch
  visual variety**. The ~12 visual registers (2 stances × 6 palettes) are
  the load-bearing variable for "doesn't feel monotonous in a TestFlight
  parade."
- Single-call Sonnet costs latency vs. the M2 planner, but at 4 archetypes
  the planner's routing value is marginal, and 7–9s end-to-end is the
  consumer-product latency budget the brief treats as binding for
  retention. If quality on 4 archetypes falls short, the M2 planner is a
  documented week-of-work fallback (see §Risks).
- "Personal canvas for your everyday tools" framing is **load-bearing
  for App Store review**; positioning copy guardrails are codified in §App
  Review.

## Guardrails

- **Positioning is non-negotiable.** Internal docs, marketing copy, App
  Store metadata, in-app strings, and Reviewer Notes use **canvas /
  tool / space**. Never **app builder, no-code, AI app generator, code
  generation**. PM owns review of every external string before
  submission. Violations are a P0 launch blocker.
- **Closed registries are non-negotiable.** Components (28), action verbs
  (13), AI tasks (1), stances (2), palettes (6), nav patterns (4), field
  types (6) are closed enums in the schema. The LLM cannot widen them.
  Adding a registry entry requires App Store update.
- **Nine architectural invariants** (brief §2.1) are inviolable. Any
  proposal that touches one escalates to Sponsor.
- **No code crosses the network.** No webview renders generated UI. The
  schema is data; renderers are pre-bundled. This is the App Store
  defense; it cannot be cut for any reason.
- **Out-of-scope prompts capture intent, not failures.** When a prompt
  hits a V0.5 capability, V0 returns the structured "want to be
  notified?" path, not a generation attempt. This is testable (§AC-O).
- **Quotas: creator-funded, hard-stop at limit.** No friend-fallback
  billing in V0. Hitting the limit is a tested unhappy path, not a
  surprise.

## Ask / Next Steps

| Owner                      | Action                                                                                                                       | Due           |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------- |
| **Sponsor (Alyona)**       | Sign off on §0 reconciliation path (Supersede / Sequence / Revise). This unblocks all other work.                            | **2026-05-12** |
| **Robert (PM)**            | After §0 signed: hand off to Sable (`/ux`) for UX design spec; finalize App Review submission package; recruit beta testers. | 2026-05-13    |
| **Sable (UX)**             | Design spec for 28 components, 2 stances × 6 palettes, host shell, Create flow, Library, Run surface.                        | End of week 1 |
| **Cal (Architect)**        | After §0 + UX: ADR for V0 schema (`packages/protocol/spec.zod.ts`), single-call pipeline, renderer wholesale rewrite.        | End of week 1 |
| **Robert (PM)**            | Curated suggested-prompt set v1.0 (10 prompts, all within V0 archetypes); rotation policy.                                   | End of week 1 |
| **Robert (PM)**            | Reviewer Notes draft, demo account contents (3 mini-apps), positioning copy audit checklist.                                 | End of week 4 |
| **Sponsor + Eng + Design** | App Review readiness review (1-day external Guideline audit).                                                                | Week 5        |

---

## The Problem

People have personal-tool ideas — a workout tracker, a packing checklist, a
mood journal, a tip splitter — and the gap between *thinking* it and
*having it on their phone* is a wall of skills they don't have. M1 proved
the loop in eval; M2 is testing it in alpha. **Canvas V0 takes the same loop
public**, with a quality bar high enough that a stranger downloads the app,
types one sentence, and gets something they're willing to share with a
friend within 7–9 seconds.

The wall isn't generation reliability anymore (H3 validated). The wall is
**whether the output is good enough that the user comes back** (H5) and
**good enough that they share it** — and the latter is the V0 growth loop.
If a user generates a tool and never shares the Universal Link, V0 is a
demo. If they share, V0 is a product.

**Cost of inaction.** Every week V0 doesn't ship is a week where the M2
two-stage pipeline accrues maintenance debt against an alpha-cohort
hypothesis we now want to test publicly. The opportunity cost is the
public-launch growth loop we don't have.

## Who Is This For

| Persona                    | Need                                                                                | Current workflow                                        | Pain point                                                                                                               |
| -------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **The Idea-Maker**         | Turn a personal-tool idea into a working iOS mini-app within a single sitting       | Lists ideas in Notes; never builds them                 | The gap between "I want a habit tracker" and "I have a habit tracker on my phone" is too tall to clear without code      |
| **The Friend-Recipient**   | Receive a Universal Link from a friend, install Canvas, get the tool with own data  | Friend describes the tool verbally; never gets to use it | Tools that live in one person's notebook can't spread; sharing is the social motivation that makes the maker want to make |

**Out of persona for V0:**
- **Small-business owners** (multi-user, real backends, payments — V1+).
- **Power users / aspiring devs** (would want code export — never).
- **The pure consumer** (only wants to use, never make — re-evaluate
  post-launch from share/install ratio).

## Business Value

- **Business driver:** Validate H5 (quality threshold drives retention) at
  **public scale**. Carryover from M2 with the cohort definition changed
  from "alpha invitees" to "App Store install cohort."
- **Impact scope:** Public iOS launch. Realistic week-1 install volume is
  TBD by marketing, but the metrics are designed to read at any scale ≥500
  installs.
- **Cost of delay:** ≈$30k/week opportunity cost (PM + 1.5 eng + 0.5
  design at burn rate) plus continuing maintenance load on the M2
  planner stack we're retiring.
- **Success metric:** see §Success Metrics. The headline metric is
  **second-session return ≥40%** carried forward from M2's H5
  measurement, with the additional public-launch metrics of share rate,
  friend-conversion, and out-of-scope volume.

## User Stories

- As an **Idea-Maker**, I describe a personal tool in plain text and see a
  working mini-app within 7–9 seconds, so the gap between idea and tool is
  one sentence wide.
- As an **Idea-Maker**, I see realistic seed data on first open of my
  tool, so it feels usable immediately and I don't have to enter five
  example items just to see what the thing does.
- As an **Idea-Maker**, I share my tool by tapping the meatball menu →
  Share → copy link, so the social motivation that made me want to make
  it actually pays off.
- As a **Friend-Recipient**, I tap a Universal Link, install Canvas if I
  don't have it, and the friend's tool appears in my Library with my own
  fresh seeded copy, so I can use the tool the same way the maker did.
- As an **Idea-Maker**, when I type a prompt that needs a capability V0
  doesn't have ("design my outfit"), I get a clear "coming next update —
  want to be notified?" path instead of a broken generation.
- As an **Idea-Maker**, I can re-prompt my tool to make changes; the
  meatball menu offers "Make changes," pre-fills my original prompt, and
  regenerates on submit.

## User Flow

### Happy path — Idea-Maker first generation

1. User installs Canvas from the App Store, opens it, signs in with Apple.
2. Lands on Library tab (empty state: "What do you want to build?" with
   three example prompts).
3. Taps **Create** tab. Sees prompt input + 6 rotated suggested prompts.
4. Types "Track my daily workouts." Submits.
5. Loading screen with witty messages cycles for 7–9 seconds.
6. Tool launches in Run mode: heading "Workouts," list of 5 seeded
   example workouts ("Morning run – 3.2 mi," etc.), FAB to add new.
7. User adds an entry, marks one complete, scrolls.
8. After ~30s of interaction, taps Library; tool card now appears.
9. (Days later) User reopens the tool from Library; data is preserved.

### Happy path — Friend-Recipient

10. Idea-Maker taps meatball menu → Share. System copies a Universal Link
    to clipboard, shows confirmation toast.
11. Idea-Maker pastes the link into iMessage to a friend.
12. Friend taps the link.
13a. **If friend has Canvas installed:** Canvas opens, the mini-app
     appears in their Library, launches in Run mode with a fresh seeded
     copy.
13b. **If friend doesn't have Canvas:** iOS opens the App Store via the
     install-gate page on canvas.app, friend installs and opens; on first
     open, the deferred-deep-link plumbing ensures the mini-app is in
     their Library.

### Re-prompt-to-edit path

14. Idea-Maker taps meatball menu → "Make changes." Returns to Create
    screen with original prompt pre-filled and editable.
15. Edits prompt, submits. New generation runs (7–9s); replaces the
    current spec; existing data attempts to migrate (best-effort: matching
    field names + types preserve; new fields seeded; removed fields
    dropped with a one-time "fields changed" toast).

### Unhappy paths

| Path                                                           | Behavior                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Out-of-scope prompt ("design my outfit")                       | Generator returns structured `out_of_scope` response with capability tag (`vision \| image_gen \| chat \| transcription \| classification`). UI shows "This would need [capability]. That's coming next update — want to be notified?" with email capture inline.        |
| Prompt empty / >2000 chars                                     | Submit disabled inline; no request fires.                                                                                                                                                                                                                              |
| Generation produces structurally invalid spec                  | Server returns 400 `invalid_spec`; UI shows "I couldn't turn that into a tool. Try a different idea." Original prompt preserved on Create screen.                                                                                                                       |
| Generation succeeds but exceeds creator's daily quota          | Hard-stop. UI shows "You've hit today's limit. Resets tomorrow." No friend-fallback billing in V0.                                                                                                                                                                       |
| Anthropic 5xx / transport error                                | Server retries 2× backoff; if still failing → 503 `internal`. UI: "Something went wrong on our end. Try again in a moment." Prompt preserved.                                                                                                                            |
| Anthropic 429                                                  | Same retry. After retries: 503 `rate_limited`. UI: "We're a bit busy right now. Try again in a minute."                                                                                                                                                                  |
| Universal Link tapped but Canvas not installed                 | iOS routes to App Store; install-gate page on canvas.app shows "Install Canvas to open this tool." On first launch post-install, deferred-deep-link delivers the mini-app to the new user's Library.                                                                    |
| Universal Link tapped, Canvas installed, but link is malformed | Generic "This link doesn't work" screen. No crash.                                                                                                                                                                                                                       |
| User on iPhone < 14 / iOS < 26 generates a tool with summarize | Tool renders fully; the summarize-using component (e.g., a `ListSummary`) hides itself or shows the raw content. No error, no upsell.                                                                                                                                  |
| Friend opens cloned tool, fills with own data, then "Make changes" | Friend gets a fresh regeneration; their data attempts the same best-effort migration the creator gets. (V0: no creator-pushed updates to friend clones.)                                                                                                                |
| App killed mid-generation                                      | On reopen: Library tab; in-progress generation is **not** resumed (the user can re-submit). Server discards orphan generations after a 60s response timeout.                                                                                                            |
| Sign in with Apple cancelled                                   | User stays on Sign-In screen.                                                                                                                                                                                                                                          |
| Friend taps a link to a tool whose creator was account-deleted | Generic "This tool is no longer available" screen. (V0: cloned copies live in friends' namespaces and survive creator deletion; future deep-link resolutions for new clones don't.)                                                                                     |

## Edge Cases & Error Handling

| Scenario                                                                       | Behavior                                                                                                                            |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Prompt is whitespace-only                                                      | Submit disabled.                                                                                                                    |
| Prompt > 2000 chars                                                            | Inline length-error; submit disabled.                                                                                               |
| User hammers Submit                                                            | Debounced; only one in-flight generation per user.                                                                                  |
| LLM emits a spec with unknown component type                                   | Zod parse fails → 400 `invalid_spec`; structured error `{detail: {field, expected, actual}}`. Mobile shows generic toast; no retry. |
| LLM emits an action verb not in the closed set                                 | Same as above (closed-enum violation surfaces via Zod).                                                                             |
| LLM emits a collection with no seed data                                       | Server-side validator rejects → 400 `invalid_spec` with `detail.reason: 'collection_missing_seed'`. Generator must retry once internally before surfacing. |
| LLM emits a collection field of unsupported type                               | Same closed-enum rejection.                                                                                                         |
| LLM omits required `aiProcess` task fallback content                           | Validator requires fallback; rejection surfaces same path.                                                                          |
| Generation succeeds but `render_hash` of the persisted spec doesn't match the canonical re-hash | Server-side guardrail: 500 `internal`; spec not persisted. (Catches canonicalization bugs.)                                          |
| Universal Link with unknown `mode` (e.g., `view`, `remix`)                     | V0: graceful "This share mode isn't supported in this version yet" screen. URL is reserved; not blocked.                            |
| Two friends open the same Universal Link from same device (account-switch)    | V0: clone is namespaced to the signed-in user. Switching accounts produces a fresh clone in the second account's Library.           |
| User has 50+ tools in Library                                                  | Grid scrolls; FlashList. No pagination; flag if perf suffers in week 5 review.                                                      |
| User renames tool to empty / >80 chars                                         | Inline validation; rename rejected.                                                                                                 |

## Acceptance Criteria

### Auth (`AC-A`)

- [ ] **AC-A1** Sign in with Apple completes; subsequent app opens are signed in.
- [ ] **AC-A2** Sign-out clears local session; subsequent open lands on Sign-In.
- [ ] **AC-A3** Server returns 401 to authenticated routes called without a valid token.

### Generation (`AC-G`)

- [ ] **AC-G1** Authenticated user can submit a prompt (1–2000 chars) on Create.
- [ ] **AC-G2** Server calls Claude (`claude-sonnet-4-6`) with the
      `produce_app_spec` tool force-selected via `tool_choice`. Free-text JSON paths are removed.
- [ ] **AC-G3** System prompt is split: static block (non-cacheable) +
      catalog block (`cache_control: {type: 'ephemeral'}`).
- [ ] **AC-G4** Server validates LLM tool input against
      `@app-creator/protocol`'s `AppSpecSchema`. Success → 200; failure → 400
      `invalid_spec` with structured `detail`.
- [ ] **AC-G5** Server enforces `max_tokens: 8000`. Inputs exceeding the
      coarse 12000-char gate return 400 `prompt_too_large`.
- [ ] **AC-G6** Anthropic transport error → 500 `internal` with
      `safeMessage(err)`; never leaks SDK stack or prompt content.
- [ ] **AC-G7** Anthropic 429 → 2× backoff retry (1s, 2s); still 429 → 503 `rate_limited`.
- [ ] **AC-G8** `metadata.user_id` is hashed; raw user ID is never sent to Anthropic.
- [ ] **AC-G9** Generation success rate ≥**90%** on a 100-prompt
      archetype-balanced eval set (25 prompts × 4 archetypes). No
      archetype below 80%. (Re-baselined from M2's 85% / 75% on broader
      taxonomy; brief tightens because catalog is wider but archetype
      surface is narrower.)
- [ ] **AC-G10** **p95 generation latency ≤12s** server-side; p50 ≤9s.
      (The "7–9s" quoted in the brief is a UX target; the SLO is
      latency-budget-aligned.)
- [ ] **AC-G11** Pipeline is **single-call** — no planner stage. ADR-0004
      Plan→Build code paths are removed or feature-flagged off.
- [ ] **AC-G12** Streaming SSE response shape matches existing
      `/generate` route contract; client renders the loading state for the
      duration and full-mounts on completion (no progressive render in V0).

### Out-of-scope detection (`AC-O`)

- [ ] **AC-O1** When generation infers a capability outside V0 (image
      gen, vision, chat, transcription, classification), generator returns
      tool input `{type: 'out_of_scope', capability: <enum>, reason:
      <string>}` instead of a spec. Capability enum is closed.
- [ ] **AC-O2** Mobile renders the structured "want to be notified?" path
      with email capture; on submit, server stores `(user_id,
      capability, prompt_hash, timestamp)` in `out_of_scope_intent`.
- [ ] **AC-O3** Out-of-scope events emit a telemetry record routable to
      the V0.5 prioritization dashboard.
- [ ] **AC-O4** Eval harness runs an out-of-scope-detection set: 30
      prompts (6 per capability × 5) where every prompt MUST be detected
      as out-of-scope, not generated. Detection precision ≥95%.
- [ ] **AC-O5** Eval harness runs an out-of-scope-false-positive set: 30
      in-scope prompts that brush against capabilities ("a photo diary
      for my dog" — uses `image` field, not vision; "a daily affirmation
      list" — text content only). False-positive rate ≤5%.

### Persistence & sharing (`AC-P`)

- [ ] **AC-P1** Successful generation creates `mini_app` row (owner,
      title, current_version_id, stance, accent_palette,
      cover_art_seed) and `mini_app_version` row (spec_json, render_hash,
      created_at) in a single transaction.
- [ ] **AC-P2** Title is auto-derived from the spec's first Heading;
      fallback to first 40 chars of prompt.
- [ ] **AC-P3** `render_hash = sha256(canonicalize(spec_json))`. Two
      clients fetching the same version produce byte-equal canonical render.
- [ ] **AC-P4** Cover art seed is stored at create time and is immutable
      (so the card identity is stable across re-prompts).
- [ ] **AC-P5** GET `/mini-apps` returns the current user's library
      ordered by `updated_at` DESC.
- [ ] **AC-P6** GET `/mini-apps/:id` returns 404 to non-owners; 200 with
      project + current version for the owner.
- [ ] **AC-P7** Sharing produces a Universal Link
      `https://canvas.app/m/{share_id}/clone` that resolves to a clone
      of the spec when tapped on iOS.
- [ ] **AC-P8** Tapping a `clone`-mode link by an authenticated Canvas
      user creates a new `mini_app` row in their namespace seeded from the
      original spec; original creator's data is **never** exposed.
- [ ] **AC-P9** Modes `view` and `remix` are reserved in the URL grammar
      and respond gracefully (§Edge Cases).
- [ ] **AC-P10** Cloud-private sync mode persists each user's data to
      their namespace; friends opening clones receive their own seeded copy.
- [ ] **AC-P11** Local sync mode persists to device only; signing out clears.

### Render (`AC-R`)

- [ ] **AC-R1** All 28 catalog components render correctly in light mode
      across both stances (productive, expressive).
- [ ] **AC-R2** Each component honors its required and documented optional
      props from the schema. Snapshot test per component per stance.
- [ ] **AC-R3** Reopening a saved tool produces a render tree byte-equal
      to the first render — verified by snapshot test against `render_hash`.
- [ ] **AC-R4** All 13 action verbs execute correctly via the renderer's
      dispatcher: `set, update, reset, addItem, removeItem, updateItem,
      clearCollection, navigate, back, capture, share, toast, aiProcess`.
- [ ] **AC-R5** Polish-critical UI uses the mandatory libraries (Reanimated 4,
      Gorhom Bottom Sheet, native-stack, FlashList, Expo Image, Keyboard
      Controller). Lint rule blocks bare-RN `Animated`, `FlatList`, JS-driven sheets.
- [ ] **AC-R6** Host chrome (header + tab bar) is present on every Run-mode
      screen. Mini-apps cannot hide it; a test harness verifies.
- [ ] **AC-R7** All 4 internal nav patterns (`none`, `stack`, `tabs`,
      `modal-overlay`) render correctly.

### AI runtime (`AC-AI`)

- [ ] **AC-AI1** `aiProcess(summarize)` calls Apple Foundation Models
      on iOS 26+ Pro devices; returns deterministic-ish summary text.
- [ ] **AC-AI2** On unsupported devices, components depending on
      summarize hide gracefully or show raw content. No crash, no upsell.
- [ ] **AC-AI3** No mini-app code path makes a direct network call. All
      AI invocations go through the host's dispatcher.

### Quotas (`AC-Q`)

- [ ] **AC-Q1** Daily generation quota per creator is enforced server-side; tunable.
- [ ] **AC-Q2** Quota exhaustion returns 429 `quota_exhausted` with
      `{reset_at: ISO8601}`. UI shows hard-stop messaging; no friend-fallback path.
- [ ] **AC-Q3** On-device summarize calls do **not** consume server quota.
- [ ] **AC-Q4** Per-user generation rate-limit (separate from quota): 10 req/min.

### Telemetry & metrics (`AC-T`)

- [ ] **AC-T1** Events emitted on every `generate`, `share_link_copied`,
      `link_clone_opened`, `out_of_scope_intent`, `tool_session_open`,
      `tool_session_30s_interaction`, `summarize_invoked`,
      `quota_exhausted`. Whitelist enforced (carryover from ADR-0004 Step 8).
- [ ] **AC-T2** Cohort analytics produce the six §Success Metrics from
      raw events without bespoke queries.
- [ ] **AC-T3** Eval-mode short-circuit (carryover) prevents eval runs
      from polluting product telemetry.

### App Review readiness (`AC-AR`)

- [ ] **AC-AR1** Reviewer Notes document complete and committed to repo
      (`docs/product/canvas-v0-reviewer-notes.md`).
- [ ] **AC-AR2** Demo account credentials provisioned, pre-loaded with 3
      mini-apps spanning 3 archetypes.
- [ ] **AC-AR3** Positioning copy audit complete — no instance of
      forbidden phrasing in App Store metadata, in-app strings, or
      Reviewer Notes.
- [ ] **AC-AR4** Pre-submission Guideline audit by external reviewer (1
      day, week 5).
- [ ] **AC-AR5** App Store metadata, screenshots (5), preview video
      complete and committed.

### Quality / NFR (`AC-N`)

- [ ] **AC-N1** WCAG 2.1 AA contrast in light mode across both stances
      and all 6 palettes; verified via automated contrast scan.
- [ ] **AC-N2** All interactive elements expose VoiceOver labels.
- [ ] **AC-N3** Touch targets ≥44pt enforced by component implementations.
- [ ] **AC-N4** Dynamic Type "Large" supported (extra-large+ deferred).
- [ ] **AC-N5** Crash-free sessions ≥99.5% on TestFlight beta soak (n ≥ 30, ≥1 week pre-submit).
- [ ] **AC-N6** All POST endpoints rate-limited per §AC-Q4 (10/min) plus a coarse global limit (60/min).
- [ ] **AC-N7** Tokens stored only in `expo-secure-store`. Lint rule blocks MMKV/AsyncStorage for token keys.
- [ ] **AC-N8** PII never logged. `safeMessage(err)` used at every `services/api` route boundary.
- [ ] **AC-N9** Eval set runs in CI on every PR touching `services/api/src/llm/`, `packages/protocol/`, or `packages/a2ui-renderer/components/`.

## Scope

### In Scope (V0)

- Sign in with Apple
- Library tab (grid, search, filter chips, long-press actions, empty state)
- Create tab (prompt input, voice mic affordance, 6 rotated suggested prompts, generation flow)
- Run mode (mini-app render with persistent host chrome)
- Settings sheet (sign-out, account info, V0.5 waitlist subscriptions)
- Universal Link share — `clone` mode only
- 28 components × 2 stances × 6 palettes (light mode only)
- 13 action verbs (closed)
- 4 internal nav patterns (closed)
- Single-call Sonnet pipeline with tool-forced spec output
- Out-of-scope detection (5 capabilities)
- Re-prompt-to-edit (regeneration, no in-place edit)
- 1 AI task at runtime: `summarize` on Apple Foundation Models
- 2 sync modes: `local`, `cloud-private`
- Eval harness re-targeted to 4 archetypes (100 prompts) + 30-prompt
  out-of-scope detection set + 30-prompt out-of-scope false-positive set
- App Store submission

### V0.5 (post-launch, prioritized by V0 user signal)

- Image generation, vision, transcription, classification
- Chat threads / conversational archetypes
- Charts, dashboards, financial primitives
- In-place edit pipeline (RFC 6902)
- Cloud-shared collections, real-time multi-user
- Friend-fallback billing
- Inbox tab, notifications, activity feed
- User-overridable accent palette
- Stance override per screen
- Dark mode, third stance, RTL, full Dynamic Type
- Android

### Explicitly Out of Scope (V0 and V0.5)

- Code export / "see the source"
- Voice-driven generation (mic icon is V0; STT is V0.5)
- Real third-party integrations (Calendar, Health, Plaid)
- Web target
- Multi-account on one device
- Custom component types beyond the 28-component catalog (capability change → App Store update required)

### M2 / ADR-0004 supersession

If §0 path = **Supersede**, the following M2 / ADR-0004 surfaces are
**legacy and not built upon in V0**:

- Two-stage Plan→Build pipeline (`services/api/src/llm/pipeline/`)
- `/edit` route + `produceAppSpecPatch` tool
- M2 16-component catalog
- 8-archetype taxonomy (kept as reference for V0.5 scoping)

These are not deleted in the V0 build window — they're left dormant until
post-launch cleanup, which is a V0.5 chore.

## API Contracts

| Endpoint                                | Auth                    | Returns                                                                      | Excludes                                                              |
| --------------------------------------- | ----------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `POST /auth/apple`                      | callback token          | `{access_token, refresh_token, user: {id, display_name}}`                    | raw email, Apple identity token, service role keys                    |
| `POST /generate`                        | required JWT            | SSE stream; final event `{spec: AppSpec, share_id}` OR `{out_of_scope: {capability, reason}}` OR `{error, detail?}` | server prompts, error stacks, other users' data                       |
| `POST /out-of-scope-intent`             | required JWT            | `{captured: true}`                                                           | other users' intents                                                  |
| `GET /mini-apps`                        | required JWT            | `{mini_apps: Array<{id, title, updated_at, current_version_id, stance, accent_palette, cover_art_seed}>}` | other users' tools, full spec_json (use detail endpoint)              |
| `GET /mini-apps/:id`                    | required JWT, owner     | `{mini_app, current_version: {id, spec_json, render_hash, created_at}}`      | other users' data                                                     |
| `POST /mini-apps/:id/share`             | required JWT, owner     | `{universal_link: 'https://canvas.app/m/{share_id}/clone'}`                  | sharable link for other users' tools                                  |
| `POST /mini-apps/clone`                 | required JWT            | body `{share_id}` → `{mini_app, current_version}` (now in caller's namespace) | source creator's data                                                 |
| `POST /mini-apps/:id/rename`            | required JWT, owner     | `{mini_app}`                                                                 | —                                                                     |
| `POST /mini-apps/:id/archive`           | required JWT, owner     | `{archived: true}`                                                           | —                                                                     |
| `DELETE /mini-apps/:id`                 | required JWT, owner     | `{deleted: true}`                                                            | —                                                                     |
| `GET /quota`                            | required JWT            | `{daily_limit, used_today, reset_at: ISO8601}`                               | —                                                                     |

**Error envelope (all endpoints):** `{error: string, detail?: unknown}`.
Codes: `invalid_input` (400), `unauthorized` (401), `forbidden` (403),
`not_found` (404), `invalid_spec` (400), `prompt_too_large` (400),
`out_of_scope` (200 — not an error; structured response),
`rate_limited` (503), `quota_exhausted` (429), `internal` (500).

**Excluded from all responses:** `service_role_key`, `jwt_secret`,
`anthropic_api_key`, raw email addresses (only in JWT claims), other
users' data, internal pipeline timing details.

**Spec contract:** schema source of truth is
`packages/protocol/spec.zod.ts` (per brief §2.5). LLM tool
`input_schema` is generated from the same Zod source. Hand-edits to
`packages/protocol/generated/` are blocked in CI.

---

## App Review Submission Package (PM-owned)

This is the load-bearing artifact for App Store approval. PM owns it
end-to-end. Lives at `docs/product/canvas-v0-reviewer-notes.md` (drafted
week 4) and bundled into App Store Connect submission notes at week 6.

### Reviewer Notes contents

1. **Positioning statement** — the "personal canvas for everyday
   tools" framing in 2 sentences. Reviewer reads this first.
2. **Component inventory** — all 28 with screenshots from the design
   system. "Every UI element a user sees was reviewed and shipped with
   this build."
3. **Action verb inventory** — 13 verbs, what they do, sample uses.
4. **AI capability inventory** — single capability (`summarize`) on
   Apple Foundation Models on-device only. Sample input/output.
5. **Capabilities-cannot-grow statement** — verbatim:
   > "All capabilities ship with this build. User prompts compose
   > layouts from this fixed toolkit; they cannot introduce new
   > components, action verbs, AI tasks, or visual primitives. Adding
   > any of these requires a new build submitted for review."
6. **No-code-over-network statement** — explicit: "The LLM produces a
   structured JSON description (a 'spec'). The spec is interpreted by a
   pre-bundled native renderer using the components above. No
   JavaScript, executable code, or webview is downloaded or executed
   from the server."
7. **Three example mini-apps** — screenshots of generated output for one
   prompt per archetype (Tracker, Journal, Calculator, ListCRUD).
8. **Demo account credentials** — pre-seeded so the reviewer doesn't
   wait through generation.
9. **Direct contact** — email + phone for App Review questions; PM is
   the named contact.

### Demo account contents

- Username: `appstore-demo@canvas.app` (or per Apple guidance).
- 3 pre-loaded mini-apps:
  - **Workout Tracker** (Tracker archetype, productive stance, health palette)
  - **Trip Packing Checklist** (ListCRUD archetype, productive stance, focus palette)
  - **Daily Mood Journal** (Journal archetype, expressive stance, social palette)
- Each has 5–7 days of seeded entries so the tool feels lived-in.
- Settings: account is on a build with summarize disabled (so reviewer
  on a non-Pro test device sees graceful degradation, not a crash).

### Positioning copy guardrails

| Forbidden                            | Required                                |
| ------------------------------------ | --------------------------------------- |
| "app builder"                        | "make a tool / build a canvas"          |
| "no-code"                            | "describe in plain language"            |
| "generate apps"                      | "generate tools / generate canvases"    |
| "AI app generator"                   | "personal canvas powered by AI"         |
| "code generation" / "writes code"   | "produces a structured layout"          |
| "build apps with AI"                | "build tools with AI"                   |
| "compile" / "deploy" / "publish app" | "share / share a link / clone a tool"   |

PM audits every external string against this table before submission.
**One violation in App Store metadata is a P0 launch blocker.** A
violation in marketing copy is a P1 (gates public messaging launch).

---

## Success Metrics

Six metrics, all instrumented from week 1, baseline measured before any
public-facing iteration. Four are headline KPIs; two are diagnostic.

### Headline KPIs (four)

| KPI                       | Definition                                                                                                          | Measurement                                                                          | Target                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------- |
| **Activation**            | % of installs that complete one Create flow (first generate succeeds)                                               | `tool_session_open` event with `creation_flow=true` ÷ `app_install`, 7d window       | ≥**60%** in week 4 of public launch |
| **Magic moment**          | % of first-time users who interact with their generated tool for >30 seconds                                        | `tool_session_30s_interaction` ÷ `tool_session_open` (first session per user)        | ≥**70%**                            |
| **Share rate**            | % of created tools that get a Universal Link copied within 7 days of creation                                       | `share_link_copied` ÷ `mini_app_created`, 7d rolling                                 | ≥**25%** (carried from M2 H5)       |
| **Second-session return** | % of generated tools reopened ≥1 time within 7 days of creation, by the creator                                     | `tool_session_open` with `is_owner=true` keyed by `(user_id, mini_app_id)`, 7d window | ≥**40%** (carried from M2 H5)       |

### Diagnostic KPIs (two)

| KPI                        | Definition                                                                                                            | Measurement                                                                          | Target                              |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------- |
| **Friend conversion**      | % of received Universal Links that result in a Canvas install                                                         | App Store / SKAdNetwork attribution + Branch / Adjust deep-link match                | ≥**15%** week 4 onwards             |
| **Out-of-scope volume**    | % of prompts that hit V0.5 capabilities, broken down by capability                                                    | `out_of_scope_intent` events grouped by `capability`                                 | **No target — this is signal**     |

### Measurement methodology

- **Cohort definition:** rolling 7-day install cohorts.
- **Reporting cadence:** dashboard updates daily; weekly product review.
- **Pre-launch baseline:** TestFlight-beta cohort (n ≥ 30, week 5–6) sets
  pre-public baselines for all six metrics. Public launch shifts to the
  install cohort definition.
- **Statistical significance:** headline KPIs gate scaling decisions
  only at n ≥ 500 install cohort (Wilson score interval, 95% CI).
- **H5 disconfirmation rule (carried from M2):** if rubric score and
  second-session return are uncorrelated on the install cohort
  (Spearman |ρ| < 0.2 over n ≥ 500), or if return rate plateaus <25%
  even on the rubric-top quartile of generations, V0 is declared a
  **disconfirmation of H5 at public scale** rather than a failed launch.
  This framing is briefed to Sponsor before submission.

### Out-of-scope volume — V0.5 prioritization rule

The five capability tags in `out_of_scope_intent` (image_gen, vision,
chat, transcription, classification) ranked by **% of all prompts that
trigger them in the first 4 weeks** post-launch are the V0.5 build
queue, not a designed-from-scratch roadmap. **Top capability >2× the
next gets first build.** Each waitlist email is one user signal, not
five — dedupe at user level.

---

## Out-of-Scope Prompt Handling — Testable Rules

Brief §1.5 specifies the UX. This section makes detection testable.

### Capability taxonomy (closed)

| Capability tag    | Triggers (non-exhaustive prompt patterns)                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------------------------- |
| `image_gen`       | "generate an image / picture / outfit / avatar / wallpaper / logo / sticker"                                    |
| `vision`          | "identify / recognize / scan a photo / what is this plant / read this text from a photo"                        |
| `chat`            | "talk to me about / a chatbot for / converse with / interview me about"                                         |
| `transcription`   | "voice notes / transcribe my voice / convert speech to text / record and turn into"                             |
| `classification`  | "categorize my receipts / sort emails by sentiment / detect mood from photo"                                    |

### Detection contract

- Generator's tool surface includes a second tool: `out_of_scope` with
  schema `{capability: enum(...), reason: string}`. The system prompt
  instructs the model: "If the prompt requires a capability not in the
  V0 catalog, call `out_of_scope` instead of `produce_app_spec`."
- Tool choice is `auto` between the two tools (the only place V0 deviates
  from `tool_choice: {type: 'tool', name: '…'}`).
- Mobile renders the structured "want to be notified?" path on
  `out_of_scope`. Email captured; intent stored.

### Eval gates

- **Detection set:** 30 prompts (6 per capability), all should detect.
  Detection precision ≥**95%**.
- **False-positive set:** 30 in-scope prompts that brush against
  capabilities ("photo diary for my dog" — uses `image` field type;
  "daily affirmation list" — text only). False-positive rate ≤**5%**.
- Both eval sets in CI per §AC-N9.

### Why the closed taxonomy

If the LLM invents a sixth capability tag, V0.5 prioritization is noise.
Closed enums force consistent telemetry. A genuinely-novel
out-of-scope prompt that doesn't match the five tags is logged with
`capability: 'unknown'` (separate analytics bucket; week-4 review
decides if a new tag needs adding for V0.5).

---

## Non-Functional Requirements

- **Performance.** p95 `/generate` latency ≤12s; p50 ≤9s. p95
  `/mini-apps` (list) ≤500ms. p95 `/mini-apps/:id` ≤300ms. App cold
  start ≤2.5s on iPhone 14.
- **Security.** TLS everywhere. JWT validation on every authenticated
  route. Tokens in `expo-secure-store` only (lint-enforced — §AC-N7).
  Rate limit: 10 req/min per user on `/generate`; 60 req/min global on
  reads. Server input validation via Zod on every POST body. AASA file
  served correctly for Universal Links; AppLinks domain locked to
  `canvas.app`.
- **Accessibility.** WCAG 2.1 AA contrast in both stances × all 6
  palettes. VoiceOver labels on every interactive element. ≥44pt
  targets. Dynamic Type up to "Large." No reliance on color alone.
  Reduced motion deferred to V0.5.
- **Privacy.** Sign in with Apple. Email logged only via JWT claims, never
  application logs. User prompts logged only to Langfuse (intentional;
  not double-logged). GDPR account-deletion by request via support email
  in V0; in-product self-serve deferred to V0.5.
- **Reliability.** Crash-free ≥99.5% on TestFlight beta soak before
  submit. Server uptime ≥99.5% during launch month.
- **Observability.** Telemetry whitelist (carryover from ADR-0004 Step
  8). Eval-mode short-circuit (carryover). Anthropic calls wrapped in
  Langfuse `trace`. Sentry for client crashes.

## Dependencies

| Dependency                                                                                                       | Status               | Owner                  |
| ---------------------------------------------------------------------------------------------------------------- | -------------------- | ---------------------- |
| **§0 reconciliation signed off**                                                                                | **BLOCKING — open** | Sponsor (Alyona)       |
| Apple Developer Program — already enrolled (M1)                                                                  | Done                 | —                      |
| iOS Bundle ID + ASC App Record + Universal Links domain (`canvas.app`)                                          | TBD                  | DevOps                 |
| AASA file deployed at `https://canvas.app/.well-known/apple-app-site-association`                                | TBD week 1           | DevOps                 |
| Static install-gate page at `https://canvas.app/m/...`                                                           | TBD week 1           | Marketing + DevOps     |
| Sign in with Apple configured in ASC and on the API                                                              | TBD week 1           | DevOps + Backend       |
| Postgres for spec persistence + per-user namespaces                                                              | Inherited from M1    | —                      |
| S3-equivalent for user uploads / captured images                                                                 | TBD week 2           | DevOps                 |
| `packages/protocol/spec.zod.ts` schema source of truth                                                          | TBD week 1           | Cal (architect)        |
| `packages/design-system/` (tokens, icons)                                                                       | TBD week 1           | Sable (UX) + Mobile    |
| `react-native-ai-apple` package integration (Apple Foundation Models)                                           | TBD week 2           | Mobile                 |
| Mandatory polish libraries pinned in `apps/mobile/package.json` (Reanimated 4, Gorhom Sheet, FlashList, etc.)   | Partially in M1      | Mobile                 |
| Eval set re-authoring for 4 archetypes (100 prompts) + out-of-scope sets (60 prompts)                            | Week 1–2             | Robert + AI Eng        |
| External App Review Guideline audit (1 day)                                                                      | Week 5               | Robert (book external) |

## Risks & Open Questions

| Risk                                                                                                | Likelihood   | Mitigation                                                                                                                                                                                                                                                                                                              |
| --------------------------------------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **§0 reconciliation drags past 2026-05-12, compresses build**                                       | High         | Sponsor decision is the single critical-path item; PM personally drives. If unresolved by 2026-05-13, slip launch by 1 week per day of delay.                                                                                                                                                                          |
| **Single-call quality on 4 archetypes is below bar**                                                | Medium-High  | Week 5 dedicated to prompt iteration. Pre-week-5 generation testing on 100 archetype-balanced prompts. Curated suggested prompts prevent first-impression failures. **Fallback:** reintroduce M2's planner stage in week 6 (1 week of work; ships V0.1 if needed).                                                  |
| **Apple rejects under 2.5.2 ("apps that create or change other apps")**                            | Medium       | Positioning audit. Reviewer Notes. Demo account. No webview. External Guideline audit week 5. The brief's framing is the primary mitigation; this spec hardens it.                                                                                                                                                     |
| **Polish review reveals issues that take >1 day to fix**                                            | Medium       | Mandatory polish libraries used from week 1, not added at the end. Per-component QA during weeks 3–4. UX has launch veto.                                                                                                                                                                                              |
| **Universal Links plumbing slips**                                                                  | Low-Medium   | Allocated week 1; tracked weekly. Fallback: copy-paste-link share flow without deep linking — friend pastes link, app opens to a paste-link affordance on Library. Worse UX, ships.                                                                                                                                    |
| **28-component catalog produces visually monotonous output**                                        | Medium       | 12 visual registers (2 stances × 6 palettes). UX validates variety on week 5 across 4 archetypes × 2 stances × 6 palettes. If <8 distinct visual registers come through generation, palette assignment policy gets revised.                                                                                            |
| **Apple Foundation Models integration unstable**                                                    | Low          | Graceful degradation already designed in. If summarize doesn't work in V0, components hide; rest of app unaffected.                                                                                                                                                                                                    |
| **Out-of-scope detection hits high false-positive rate**                                            | Medium       | Eval gate per §AC-O5 (≤5%). If gate fails, threshold tunes by capability tag; can ship with a higher false-positive rate on `transcription` (lower-priority capability) than on `image_gen`.                                                                                                                          |
| **Quota exhaustion is the most-frequent unhappy path post-launch**                                  | Medium       | Daily limit tunable; default starts generous (~20/day) and tightens. Hard-stop UX shipped from week 3. V0.5 ships paid plan.                                                                                                                                                                                            |
| **Friend-clone path is dominant install vector and Universal Links break for any reason**         | Medium       | Universal Links + AASA tested in beta on 5 device/OS combinations. Fallback: link includes a fallback `?fallback_share_id=…` query param the install-gate page reads to show a "this tool is waiting for you" CTA.                                                                                                  |
| **H5 disconfirmation at public scale**                                                              | Inherent     | This is the H5 question. Disconfirmation is the most-valuable result V0 can produce if true. Sponsor briefed; framing in §Success Metrics. Public launch with disconfirmation reads as "we ran the experiment honestly" not "we shipped a flop."                                                                       |

### Open questions

1. **Who signs off the §0 path?** Per memory: Alyona is M2 Sponsor. Confirm she's also Canvas V0 Sponsor.
2. **`canvas.app` domain — owned?** Brief assumes; PM to confirm with DevOps before week 1.
3. **App Store account — Anthropic-owned or new?** App Review submission depends on this.
4. **External App Review auditor identified?** Book in week 4 for week-5 slot.
5. **Voice mic affordance on Create — STT in V0 or just placeholder?** Brief is ambiguous; spec defaults to placeholder (tappable, opens "voice input coming soon"), making it part of the V0.5 capture surface.
6. **Cover art generation deterministic from seed, or LLM?** Brief implies deterministic from seed — a stance + accent + icon composition. Spec adopts deterministic.

## Timeline

| Week | Focus                                                                                       | Deliverables                                                                                                                              |
| ---- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **0** | **§0 reconciliation + foundation**                                                          | Sponsor signs §0. Domain + AASA + Sign in with Apple + protocol package scaffold. PM curated prompts v1.0 + eval set re-authoring begins. |
| **1** | Schema + design system + host shell                                                         | `spec.zod.ts` lands. UX design spec for 28 components. Library + Create + Run shells. Universal Links plumbing.                           |
| **2–4** | Renderer + action dispatcher + collection store + Foundation Models bridge + generation | All 28 components implemented and reviewed. 13-verb dispatcher. End-to-end happy path on 1 archetype by week 3.                            |
| **5** | E2E pipeline + out-of-scope detection + prompt iteration + UX rendering review              | All 4 archetypes generate at quality bar. Out-of-scope detection gates passing. UX validates 12 visual registers.                          |
| **6** | Bug fix + polish review + App Store submission                                              | Crash-free ≥99.5% on TestFlight beta. 1-day polish review. Submission to App Store.                                                       |

## Notes for Sable (UX)

- Brief §3 is binding. This spec doesn't add visual decisions.
- Two distinct UI layers. Don't blur:
  1. **Host chrome** — Library, Create, Run-mode header, settings sheet.
     Calm, neutral, productive. Notion-/Linear-class restraint.
  2. **Renderer components** — the 28-component catalog. The visual
     treatment of each is the *only* visual treatment generated tools
     will ever have. Pick carefully.
- **Empty states matter most.** First-run Library empty state is the
  screen most users see first. Designed to invite, not depress.
- **Cover art generation policy.** Deterministic from
  `(stance, accent_palette, semantic_icon)`. UX defines the composition
  formula; PM doesn't override.
- **Loading state is 7–9 seconds** every time. Witty messages cycled.
  3 messages × ~3s = 9s. Don't rely on indeterminate progress bar.
- **Polish acceptance** is your veto on launch. Use it.
- Send the design spec to PM + Cal for review **before** Cal starts
  the renderer ADR. Typed prop signatures aligned to schema is the
  blocking dependency.

## Notes for Cal (Architect)

- Brief §2 is binding. This spec doesn't add architecture decisions.
- **§0 reconciliation gates your work.** Don't start the V0 ADR until
  Sponsor signs path. If path = Supersede, M2 ADR-0004 Steps 5–7 are
  legacy; you write a new ADR for V0 single-call pipeline + 28-component
  renderer. If path = Sequence, you don't start V0 until M2 sign-off.
- **Schema source of truth: `packages/protocol/spec.zod.ts`.** ~300–450
  lines hand-edited Zod. CI rejects hand-edits to `generated/`. One
  schema, no strict/permissive split.
- **All Anthropic calls go through `services/api/src/llm/`.** No SDK
  in route handlers (existing rule).
- **Prompt caching is mandatory.** Catalog block is the cache target;
  first system block is non-cacheable. Standard pattern.
- **Tool-use is forced for `produce_app_spec`** but `tool_choice: 'auto'`
  between `produce_app_spec` and `out_of_scope`. This is the *one*
  deviation from the "always force a single tool" rule and it's load-
  bearing for §AC-O.
- **No /edit route in V0.** Re-prompt-to-edit goes through /generate
  with a new prompt; the old `mini_app_version` is left in place as
  history; the new generation creates a new `mini_app_version` row and
  becomes `current_version_id`. Data migration is best-effort
  field-name + type matching server-side at version-flip time.
- **Renderer is sandbox.** Pure function of `{node, state, dispatch}`. No
  `useEffect`, no fetch, no eval. Actions limited to the 13 verbs.
- **render_hash** = sha256 of canonical spec JSON. Reused from M1.
- **AI dispatcher** is one place. The `aiProcess` action verb dispatches
  to a closed task enum; in V0 only `summarize` exists; routing is
  Apple Foundation Models or graceful hide.
- **Sub-slicing.** This spec is medium-large. Cal's call whether the
  ADR splits (e.g., schema → renderer → generation → universal-links →
  out-of-scope detection). I'd rather see 3 ADRs than one cram.

---

> ✅ Feature spec saved to `docs/product/canvas-v0.md`
>
> **BLOCKED:** §0 reconciliation. Sponsor (Alyona) decision required by **2026-05-12**.
>
> **Next step (after §0 signed):** Hand to Sable (`/ux`) for the UX design spec.
>
> Sable's spec is the input to Cal's (`/architect`) ADR for the V0 schema and renderer.

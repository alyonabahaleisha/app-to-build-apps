# Feature Spec: Edit-by-Chat
**Author:** Robert (CPO) | **Date:** 2026-05-03
**Status:** Draft — Pending Architecture Review
**Parent specs:** `docs/product/app-creation-poc.md` (line 148, Phase 2 list); `docs/product/chat-creation.md` (line 372, Phase 2 list).
**Triggering signal:** User question post-ADR-0003 ship: *"are we able to enhance the app in the chat?"*

## Decision

**Yes — ship edit-by-chat as ADR-0004, before the Library/marketplace slice.**

The maker's iteration loop (idea → app → tweak → ship) is the core value prop. The renderer just landed; without edit, "tweak" means "regenerate from scratch and lose what you liked." That's not a product. Library/marketplace is a social-discovery layer that's only valuable *after* makers can iterate to something worth shipping.

Cal's `pipeline-state.md` placeholder for ADR-0004 (Library & Ship) gets re-sliced into:
- **ADR-0004 (Edit-by-Chat)** — this spec.
- **ADR-0005 (TestFlight & Ship)** — pull "Ship" out of the Library slice, ship it standalone. Getting any app onto a real device is the next maker need after iteration.
- **ADR-0006 (Library & Marketplace)** — browse, Try, Remix. The social layer, last.

## Rationale

| Lens | Read |
|---|---|
| GM | Maker iteration is the core JTBD. "Make the buttons green" is the test of whether this is a real product. Without edit, every regen is a coin flip on whether the model produces something better than before. |
| CDO | Edit unlocks ship-worthy outputs. The Library is empty without ship-worthy outputs. Library-first inverts the demand pyramid. |
| CIO | Architecture for edit-by-chat is already designed (ARCHITECTURE.md path, CLAUDE.md §3 names the Anthropic tool `produce_app_spec_patch`). No discovery on the technical pattern; just the product slice. |
| CEO | User asked. That's revealed-preference signal worth more than internal sequencing instinct. |

**Impact × Confidence ÷ Effort:**
- Edit-by-chat: I=5, C=4, E=3 → score 6.7
- Library & marketplace: I=4, C=3, E=4 → score 3.0
- TestFlight ship: I=4, C=5, E=2 → score 10.0

(TestFlight scores higher than edit on this rubric, but the user's question revealed a sequencing preference that overrides the rubric. TestFlight ships next as ADR-0005.)

**Top 3 drivers for edit-first:**
1. User explicitly asked. Highest-quality signal in this product cycle.
2. Edit completes the maker loop; without it, "describe an app, get a real app" is one-shot — closer to a parlor trick than a product.
3. Architecture already designed. Effort is implementation, not discovery.

## The Problem

A maker generates a Pomodoro Timer. The buttons should be a different color. The completed-sessions counter should default to 5, not 0. They want a "Long Break" duration alongside the existing two.

Current options:
1. Regenerate from scratch with a new prompt that tries to specify all the details. Loses the parts they liked.
2. Stop. Ship the imperfect app or abandon it.

Both options are wrong. Real apps are iterated. The product needs a third option: **type the change, see it applied.**

**Cost of inaction:** Every generated app is a one-shot. Makers who like 80% of the output have to choose between accepting the 20% they don't like or throwing the whole thing away. The library will never accumulate apps that feel finished.

## Who Is This For

| Persona | Need | Current Workflow | Pain Point |
|---|---|---|---|
| Maker who just generated an app | Tweak one thing without losing the rest | Regenerate from scratch with a longer prompt | Loses parts they liked; gambles every regen |
| Maker iterating toward "ship-worthy" | Multiple rounds of small fixes converging on done | None — abandon or accept | Iteration is the work of making something real |
| Beta tester giving feedback | Try modifications quickly to see if something works | None — no edit primitive | Can't test ideas without committing to a full regen |

## Business Value

- **Business driver:** Retention. Makers who ship one app and quit don't validate the product hypothesis. Makers who iterate to something they're proud of stick.
- **Impact scope:** All 20 internal testers. Estimated 60%+ of generated apps will receive ≥1 edit within 7 days of creation, based on prior-art generative tooling.
- **Cost of delay:** Every week without edit, makers' demo apps stay 80%-baked. The Library (when it ships) accumulates 80%-baked apps. The product feels worse than it is.
- **Success metric:** **% of generated projects that receive ≥1 successful edit within 7 days.** Target ≥60%. Measured via `events` table (`prompt_submitted` events with `edit:true` flag, joined to `projects.created_at`). Reviewed weekly.

## User Stories

- **As a maker**, I want to type a follow-up message in the same chat where I created the app, so that I can refine the app without abandoning my context.
- **As a maker**, I want my edit to update the app I'm looking at, so that I see the result without navigating away.
- **As a maker**, I want my edit history preserved (versions on the project), so that I can recover if an edit goes wrong (UI for version browsing is Phase 2; backing data is here at v1).
- **As a maker**, I want the AppRunner to re-render with the new spec automatically when an edit completes, so that the loop closes inside the AppRunner I'm already in.

## User Flow (Happy Path)

1. Maker has an open AppRunner showing their Pomodoro Timer.
2. They tap **Edit** in the AppRunner top bar (NEW affordance — Sable's call on placement).
3. Chat re-opens scoped to this project. The chat history shows their original prompt + a system message: *"Editing 🍅 Pomodoro Timer — describe what to change."*
4. They type *"make the buttons green and add a long break duration setting"* and tap Send.
5. SSE-driven loading state (matches the existing /generate pattern): *"Reading the change…" → "Updating your app…"*. Latency target: p95 ≤45s.
6. AppRunner remounts with the new spec. Buttons are green. New "Long Break Duration" Counter appears in the Settings view.
7. Toast: *"Updated. Tap Edit again to keep iterating."*
8. The chat scoped to this project preserves the back-and-forth: original prompt, AI ack, edit prompt, AI ack. Maker can chain edits.

## Edge Cases & Error Handling

| Case | Behavior |
|---|---|
| Edit produces invalid spec (Zod validation fails server-side) | SSE emits `error` event with `code='invalid_spec'`. Toast: *"Couldn't apply that change. Try rephrasing."* The previous spec stays mounted; no data loss. |
| Edit changes catalog component types in ways the renderer can't handle (shouldn't happen — catalog is locked at 10) | Same as invalid_spec. The renderer's error boundary (ADR-0003 §F) catches at render time as a P0 fallback. |
| User submits a second edit while the first is in flight | UI prevents (Send button disabled while `phase === 'building'`). Same in-flight guard as `/generate` (T-0002-146). |
| User navigates away mid-edit | Server completes the edit and persists the new version regardless (matches `/generate` behavior — ADR-0002 §O). On next AppRunner open, they see the new spec. |
| Edit prompt is empty or whitespace | Send button stays disabled. |
| Edit prompt > 2000 chars | Same constraint as `/generate`. 400 `invalid_input`. |
| baseVersionId is stale (someone — somehow — edited from another device) | 409 `version_conflict`. Toast: *"This app was updated elsewhere. Reopen to see the latest."* (Defensive — we don't expect concurrent multi-device editing at 20-tester scale, but the constraint is cheap.) |
| Model interprets the prompt destructively (deletes content the user didn't mean to remove) | No automatic protection at v1. User can manually recreate. Phase 2: undo affordance + version-history UI. |
| Long-press on AppRunner body for a tap-to-edit on a specific element | Out of scope. |

## Acceptance Criteria

- [ ] **AC-EC-G1:** `POST /me/projects/:id/edit` accepts `{prompt: string, baseVersionId: string}`, returns the new project + currentVersion. Auth-required, owner-only.
- [ ] **AC-EC-G2:** Server uses Anthropic with `tool_choice: {type: 'tool', name: 'produce_app_spec_patch'}`. Tool emits an RFC 6902 JSON Patch. Server applies patch via `fast-json-patch` with `mutate: false`, validates result via `A2UISchema.parse`, persists as new `project_versions` row.
- [ ] **AC-EC-G3:** New version is created atomically with `projects.current_version_id` update inside one transaction.
- [ ] **AC-EC-G4:** SSE events: `reading_started` → `building_started` → `done | error`. Same shape as `/generate` (`done` payload includes `{project, currentVersion, render_hash, generation_duration_ms}`).
- [ ] **AC-EC-G5:** Patch application failures (RFC 6902 invalid path, type mismatch) → `error` event with `code='invalid_spec'`. New version NOT persisted. Old version remains current.
- [ ] **AC-EC-G6:** baseVersionId mismatch → 409 `version_conflict`. No state change.
- [ ] **AC-EC-G7:** AppRunner re-renders with the new spec on `done` — same `useA2UIState` hook re-mounts with the new spec identity (already wired in ADR-0003 — this AC just verifies the flow lands).
- [ ] **AC-EC-G8:** Chat screen scoped-to-project mode: opens with project context, shows original prompt + edit history, sends to `/me/projects/:id/edit` instead of `/generate`.
- [ ] **AC-EC-G9:** AppRunner top-bar Edit affordance visible in Owner mode (private OR public). Sable specifies placement and copy.
- [ ] **AC-EC-G10:** Edit eval harness: 10 prompts pairing a base spec + an edit instruction. Pass rate ≥80% (binary: produces a valid spec, the change is structurally evident — heading text changed, button color attribute changed, counter added — manual scoring acceptable for v1).
- [ ] **AC-EC-K1 (KPI):** ≥60% of generated projects receive ≥1 successful edit within 7 days of creation. Measured via events table.
- [ ] **AC-EC-K2 (KPI):** p95 `/edit` latency ≤45s. Measured via server traces.
- [ ] **AC-EC-K3 (KPI):** Edit success rate ≥85% (server-validated specs / total /edit calls). Failures: `invalid_spec`, `prompt_too_large`, `version_conflict`. Measured via events.
- [ ] **AC-EC-K4 (KPI):** Edit-undo rate ≤25% — % of edits where the user creates another edit within 2 minutes that reverses or rewords the prior. High = LLM not understanding directives. Measured via events.

## Scope

### In Scope (v1 — this ADR)

- `POST /me/projects/:id/edit` endpoint — JSON Patch tool, full SSE flow.
- Chat screen scoped-to-project mode (preserves chat history per project).
- AppRunner Edit affordance.
- AppRunner re-mounts on edit completion.
- Project version history persists every edit (data only — no UI to browse).
- 10-prompt edit eval harness.

### Phase 2 (Enhanced — next slice or later)

- Edit history UI ("View earlier versions" in AppRunner).
- One-tap undo (revert to prior `current_version_id`).
- Diff visualization in chat ("Changed: Button colors → green; Added: Long Break Counter").
- Edit prompt suggestions ("Make it darker", "Add a settings page", "Simpler").
- Tap-to-edit on specific UI elements.
- Memory: edits learn user style preferences across projects.
- Multi-turn conversation context (LLM sees the last N edits + responses, not just current spec).

### Explicitly Out of Scope

- Real-time collaborative editing (Phase 4+).
- Voice or image input for edits.
- Branch/fork an edit timeline (linear history at v1).
- Patch preview with accept/reject UI before commit.
- Server-side merge conflict resolution beyond version-id check.

## API Contracts

| Endpoint | Auth | Returns | Excludes |
|---|---|---|---|
| `POST /me/projects/:id/edit` | required JWT, owner only | **SSE stream** of events: `{type:'reading_started'}` → `{type:'building_started'}` → `{type:'done', project: {id, title, current_version_id, updated_at}, currentVersion: {id, spec_json, render_hash, created_at}, generation_duration_ms}`. On error: `{type:'error', code, detail?}` then close. | thinking trace, server prompt content, error stacks, other users' data, original_prompt of OTHER projects |

**Request body schema:** `{prompt: string (1..2000 chars), baseVersionId: uuid}`.

**Error codes:**
- `invalid_input` (400) — body validation failure.
- `prompt_too_large` (400) — total tokens (system + catalog + spec + prompt) exceeds 14K (higher than /generate's 12K because the existing spec is included).
- `invalid_spec` (400) — patch applied but result fails Zod.
- `version_conflict` (409) — baseVersionId is not the current version.
- `not_found` (404) — project doesn't exist or caller isn't owner (don't leak).
- `unauthorized` (401) — missing/invalid JWT.
- `rate_limited` (503) — Anthropic 429 after retries.
- `internal` (500) — generic.

**Excluded from all responses:** server prompts, thinking trace, raw email, `service_role_key`, `anthropic_api_key`.

## Non-Functional Requirements

- **Performance:** p95 `/edit` ≤45s (target — model has more context, less generation work). p99 ≤90s (matches `/generate` ceiling).
- **Security:** Auth-gated, owner-only. Same `requireAuth` pattern as ADR-0001/0002. The full spec being sent to Anthropic is not new exposure (we already send specs in /generate via system prompt context); existing PII rules apply.
- **Privacy:** Edit prompts stored in `messages` table with `role='user'` (carryover from ADR-0002 messages persistence). Not double-logged in app logs (Langfuse handles eval persistence).
- **Accessibility:** Edit affordance must have `accessibilityRole="button"` + `accessibilityLabel="Edit this app"`. Chat screen scoped-to-project keeps existing accessibility patterns.
- **Cost:** Per-edit cost ~1.5–2× per-generation cost (longer input prompt — includes existing spec). $30/engineer/day Anthropic cap from umbrella spec applies. If edit eval iteration burns >$10/day per engineer, add aggressive prompt caching for the spec content.

## Dependencies

- ADR-0002 (`/generate` flow) — `/edit` reuses the SSE pattern, the rate-limit middleware, the messages table, the `events` infrastructure, and the version-row creation logic.
- ADR-0003 (Renderer) — the user-visible result of an edit. Without the renderer, edits are invisible.
- Anthropic SDK — `messages.stream()` with `tool_choice` already used in ADR-0002. Same pattern.
- `fast-json-patch` library — already a workspace dep per CLAUDE.md §3 + §9. No new install.

## Risks & Open Questions

| Risk | Likelihood | Mitigation |
|---|---|---|
| Patch tool emits invalid RFC 6902 (paths that don't exist in the spec) | Medium | Validate-and-revert: applyPatch returns errors → emit `invalid_spec` SSE → don't persist. Eval harness includes 3 prompts that test patch validity. |
| Resulting spec passes RFC 6902 but fails Zod (introduces invalid component types or actions) | Medium | Server re-validates via `A2UISchema.parse` after patch application. Same handling — `invalid_spec`, don't persist. |
| Model reverts unrelated parts of the app while making the requested change | Medium | Force `tool_choice: produce_app_spec_patch`. The patch format inherently produces minimal diffs. If model insists on full-spec replacement after 3 turns, fall back to "regenerate" UX with a system message. |
| Edit history grows unbounded (every save = new `project_versions` row) | Low | At 20 testers + ~10 edits per project = ~2000 rows over a month. Negligible. Vacuum logic deferred to Phase 3. |
| Cost overrun on eval iteration | Medium | Cap edit-eval-harness Anthropic spend at $5/engineer/day. Cap base prompt with cache_control: ephemeral on the spec content. |
| Cal designs a multi-turn LLM conversation that consumes too much context | Low (Cal is risk-averse) | Constraint to Cal: each `/edit` call sends ONLY current spec + new edit prompt. No prior edit prompts. Cal can argue against this in the ADR if he disagrees. |

**Open questions for Cal:**
1. Should `/edit` use a separate Anthropic system prompt from `/generate`, or share? Sharing saves prompt-cache hits; separating gives edit-specific guidance ("make minimal patches").
2. The `messages` table from ADR-0002 already stores user prompts. Should `/edit` write to it, and if so, with what `role` value? (Probably `role='user'` with no special edit flag — a prompt is a prompt.)
3. What's the SSE event sequence exactly? `/generate` had `thinking_started`, `building_started`. For `/edit` I propose `reading_started` (model is reading the existing spec) → `building_started` (emitting the patch). Cal's call.

**Open questions for Sable:**
1. Where does the Edit affordance live in AppRunner top bar? Next to Publish? Replacing it in non-published mode?
2. Chat screen scoped-to-project mode — visual delta from "create new app" mode? Pre-filled placeholder text? Different background tint?
3. What does the loading state copy say? "Reading your idea" reused from /generate, or distinct?

## Timeline Estimate

| Phase | Effort | Dependencies |
|---|---|---|
| ADR-0004 design (Cal) | 1 day | This spec, Sable UX delta |
| Sable UX delta for Edit affordance + chat scoped mode | 0.5 day | This spec |
| Backend `/edit` endpoint + edit tool | 1.5 days | ADR-0002 patterns |
| Mobile chat scoped-to-project mode | 1 day | ADR-0002 chat patterns |
| Mobile AppRunner Edit affordance + remount on done | 0.5 day | ADR-0003 hook patterns |
| Edit eval harness (10 prompts) | 0.5 day | ADR-0002 eval patterns |
| QA scoped passes (Roz × 4 steps) | 1 day | — |
| **Total** | **~6 days** | — |

## Sequence Decision (for Cal's revision of `pipeline-state.md`)

Replace Cal's current ADR-0004 placeholder ("Library & Ship") with three slices:

| ADR | Title | Owner | Why this order |
|---|---|---|---|
| 0004 | Edit-by-Chat | Cal next | User asked. Closes the maker loop. |
| 0005 | TestFlight & Ship | Cal after 0004 | First real-device delivery. Required for any user-visible test. |
| 0006 | Library & Marketplace | Cal after 0005 | Social-discovery layer. Only valuable once apps are ship-worthy and shippable. |

Cal: please update `pipeline-state.md` row 28+ when you start ADR-0004.

## Notes for Cal

1. **Patch tool design.** The architecture in CLAUDE.md §3 commits to `produce_app_spec_patch` emitting RFC 6902. Don't second-guess this — it's already the locked pattern. Your design work is the SSE event sequence, the patch validation pipeline, the version-conflict detection, and the messages-table integration.

2. **Constraint: each `/edit` call is stateless re: chat history.** The LLM sees the current spec + the new edit prompt. Not the previous edit prompts. This keeps the prompt small and the model's context cohesive. Multi-turn context is Phase 2 if metrics show edits drift.

3. **Reuse, don't refactor.** ADR-0002's `generateAppSpec` function in `services/api/src/llm/` is the model. Your `editAppSpec` function lives next to it, shares the SSE wrapper, the rate-limit middleware, the metadata hashing, the Langfuse trace shape. Don't introduce parallel infra.

4. **Re-render is free.** ADR-0003's `useA2UIState` already remounts state when spec identity changes (T-0003-013b locks this). Your AppRunner edit-flow integration is just "mutate the project query cache to include the new currentVersion → React Query refetches → useA2UIState sees a new spec object → state resets → renderer re-mounts." No new mount/unmount logic.

5. **No diff UI in v1.** I know it's tempting. Don't. The user's mental model is "type a change, see it applied." Diff-and-confirm is friction without a proven need. If post-launch metrics show high edit-undo rate (>25% — AC-EC-K4), reconsider in a Phase 2 ADR.

6. **The chat scoped-to-project mode is a real UX delta.** Sable owns this design. Don't merge with Chat.tsx's create-new-app mode in code — they're sibling modes of the same screen, controlled by a route param.

7. **`messages` table already exists** (ADR-0001 schema). ADR-0002 inserts user prompts into it on `/generate`. `/edit` writes to the same table with the same `role='user'` pattern. The project_id FK ties the edit prompt to the right project. No new schema.

## Ask / Next Steps

| Owner | Action | Due |
|---|---|---|
| Sable | UX delta for AppRunner Edit affordance + Chat scoped-to-project mode | 2026-05-04 |
| Cal | Draft ADR-0004 (Edit-by-Chat) per this spec + Sable's UX | 2026-05-05 |
| Cal | Revise `docs/pipeline/pipeline-state.md` to insert ADR-0005 (TestFlight) and ADR-0006 (Library) rows; delete the "Library & Ship" placeholder | as part of ADR-0004 |
| Roz | Test-spec review of ADR-0004 before Colby starts | 2026-05-05 |
| Colby | Implement ADR-0004 step-by-step | 2026-05-06+ |

---

> ✅ Feature spec saved to `docs/product/edit-by-chat.md`
>
> **Next step:** Hand to Sable (`/ux`) for the UX delta on AppRunner Edit affordance + Chat scoped-to-project mode. Sable's output feeds Cal's ADR-0004 draft.

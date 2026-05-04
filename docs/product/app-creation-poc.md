# Feature Spec: App Creation POC

**Author:** Robert (CPO) | **Date:** 2026-05-01
**Status:** Draft — Pending Review (partly superseded — see note)

> **Update 2026-05-02 — Marketplace pivot.** The "Marketplace
> (publish, browse, fork)" entry under §Explicitly Out of Scope is
> **superseded** by `docs/product/chat-creation.md`, which brings a v1
> maker-only marketplace into M1 scope. Several umbrella ACs are
> deprecated by the child spec — see its §"Umbrella reconciliation."
> The rest of this document still stands as the parent rationale.

## The Problem

People have app ideas — a tip splitter for their coffee shop, a habit tracker for their morning routine, a one-page calculator for their hobby — and the gap between *thinking* the idea and *having a working app* is a wall of skills they don't have. Twelve weeks of YouTube tutorials, $5k for a freelancer, or it never gets built. That's the pain.

This POC proves the loop that defeats the wall: a non-technical person types their idea in chat, an LLM produces a structured spec from a fixed component catalog, the mobile app renders it, and the app is **theirs** — saved to their account, openable later, demoable to a friend.

If the loop works reliably, the rest of the M1 vision (memory, edit-by-chat, marketplace) becomes incremental work on a real foundation. If it doesn't, every later milestone is paper.

**Cost of inaction:** Every week we don't have a working chat → render loop is a week of architectural assumptions accumulating without empirical pressure. The longer we wait, the more we'll have to throw out when the LLM doesn't behave the way the spec says it should.

## Who Is This For

| Persona | Need | Current Workflow | Pain Point |
|---------|------|------------------|------------|
| **The Idea-Maker** (personal individual) | Turn an app idea into a usable mini-app within a single sitting | Lists ideas in Notes, never builds them, or pays a freelancer for the simple ones | The gap between "I want this" and "I can show this to someone" is too tall to clear without code skills. The friction kills the idea. |

**Out of persona for this POC:** Small-business owners (Phase 2 — H1 hypothesis validation). Power users / aspiring devs (different mental model — they'd want code export, which is post-MVP).

## Business Value

- **Business driver:** Revenue (validates the willingness-to-pay hypothesis from the program plan: do idea-makers convert at ≥8% to a paid plan?). Compliance / regulatory: none for this slice.
- **Impact scope:** Single-user demo. Volume will be one engineer testing on a simulator + a small invitation list on TestFlight (≤20 testers).
- **Cost of delay:** ≈ $30k/week in opportunity cost (1 engineer, 0.5 designer, 0.5 PM at burn rate, plus delayed validation of every downstream M1 hypothesis).
- **Success metric:** Generation success rate ≥80% on the 30-prompt internal eval set. p95 generation latency ≤90s. Crash-free ≥99% on the testers' devices.

## User Stories

- As an idea-maker, I sign in with a magic-link email so I can save my apps to my account and use them across sessions.
- As an idea-maker, I describe an app idea in plain text in chat so I can see something that looks and behaves like an app, without writing code.
- As an idea-maker, I see my previously created apps in a library so I can revisit them, demo them, or pick up where I left off.
- As an idea-maker, I tap a saved app in the library and it opens looking and behaving exactly the way it did when I created it, so I trust it as "real."
- As an idea-maker, I can sign out and back in (different device, same email) and find my apps still there, so I trust the system enough to keep using it.

## User Flow

### Happy Path

1. User installs the App Creator from TestFlight, opens it, sees a Sign-In screen.
2. User enters their email; receives a magic link in email; taps the link; the app opens already signed in.
3. User lands on a Home screen with a "Create new app" button and (initially) an empty library.
4. User taps "Create new app," lands on a Chat screen with a prompt input.
5. User types: *"Make me a morning routine tracker — three habits I can check off, with a streak counter."* Taps Send.
6. App shows a loading state (skeleton + a brief "thinking" message). Within ~30s, navigates to AppRunner.
7. AppRunner displays the rendered app: a heading, three checkable items (Toggle), a streak counter (Counter). User can tap toggles, increment the counter — interactions work locally.
8. User taps "Done" / back arrow → returns to Home; the new app is now in the library with a generated title.
9. User taps the saved app → AppRunner opens with the *same* rendered UI, identical to first creation.
10. User signs out, signs in again (or on a different iOS device with same email), opens the library — apps are restored.

### Unhappy Paths

- **Magic link expired:** "This link expired. [Request new]" — non-blocking, user requests fresh link.
- **Empty / too-long prompt:** Send button stays disabled until length is in range.
- **LLM returns a malformed spec:** Toast: "I couldn't turn that into an app. Try a different idea." User stays on Chat with the prompt preserved.
- **Server transport error:** Toast: "Something went wrong on our end. Try again in a moment." User stays on Chat with the prompt preserved.
- **Anthropic 429 rate limit:** Server retries up to 2× with exponential backoff. If still 429: toast: "We're a bit busy right now. Try again in a minute."
- **Network offline at any step:** Toast: "You're offline. Reconnect to continue." Send button disabled while offline.
- **Save failure (DB write fails after generation succeeds):** The spec stays in memory and renders this session, but the library save retries silently in the background and surfaces a toast on second failure: "Couldn't save this one. [Retry]"
- **Closed-browser-mid-flow:** Magic-link tap resumes auth; otherwise app reopen restores Home.

## Edge Cases & Error Handling

| Scenario | Behavior |
|---|---|
| User taps Send with whitespace-only prompt | Send disabled; no request fires |
| Prompt is 2001+ chars | Inline error message under input; Send disabled |
| User taps Send twice in rapid succession | Second tap is debounced; only one request in flight |
| LLM emits a tool input that fails A2UISpecSchema parse | Server returns 400 `{error: 'invalid_spec'}`; mobile shows generic toast; no retry |
| LLM emits a spec containing a component type not in the catalog | Caught by Zod parse → same as invalid_spec |
| Spec contains an action `set` with no matching input id | Server returns 400 `{error: 'invalid_spec', detail: 'unresolved targetId'}` |
| User has 0 apps in library | "No apps yet — describe one to get started." Big CTA. |
| User has 50+ apps in library | Library scrolls, no pagination yet; flag if performance suffers |
| User is signed in on two devices simultaneously | Last-write-wins on project metadata; specs are immutable per version |
| User deletes account in Supabase manually | Next auth attempt fails cleanly; no zombie data accessible |

## Acceptance Criteria

### Auth
- [ ] AC-A1: User can request a magic link with a valid email; receives it within 60s; tapping it opens the app and shows them signed in.
- [ ] AC-A2: Sign-out clears local session; subsequent app opens land on Sign-In until a new magic link is consumed.
- [ ] AC-A3: An expired magic link surfaces a clear "[Request new]" affordance; no silent failure.
- [ ] AC-A4: All authenticated requests carry a Supabase JWT; server returns 401 to any authenticated route called without one.

### Generation
- [ ] AC-G1: Authenticated user can submit a prompt (1–2000 chars) on the Chat screen.
- [ ] AC-G2: Server calls Claude (`claude-sonnet-4-6`) with the `produce_app_spec` tool force-selected via `tool_choice`; free-text JSON is rejected.
- [ ] AC-G3: System prompt is split into a static segment + a catalog segment marked `cache_control: {type: 'ephemeral'}` for prompt caching.
- [ ] AC-G4: Server validates LLM tool input against `A2UISpecSchema`. On success, returns 200 with the spec; on failure, returns 400 `{error: 'invalid_spec', detail: <flattened zod issues>}`.
- [ ] AC-G5: Server enforces `max_tokens: 8000`. If input system+messages exceed 12000 chars (coarse pre-check), returns 400 `{error: 'prompt_too_large'}`.
- [ ] AC-G6: Anthropic transport error → server returns 500 `{error: 'internal'}`; logs `safeMessage(err)`; never leaks SDK stack or prompt content.
- [ ] AC-G7: Anthropic 429 → server retries up to 2× with exponential backoff (1s, 2s); if still 429 → 503 `{error: 'rate_limited'}`.
- [ ] AC-G8: Server hashes the user_id and passes it as `metadata.user_id` on every Anthropic call.
- [ ] AC-G9: Generation success rate ≥80% on the 30-prompt eval set. (POC bar; launch bar is 85%.)
- [ ] AC-G10: p95 generation latency ≤90s on the eval set.

### Persistence
- [ ] AC-P1: On successful generation, server creates a `projects` row (owner, title, current_version_id) and a `project_versions` row (spec_json, render_hash) in a single transaction.
- [ ] AC-P2: Project title is auto-derived from the spec — first Heading text, or the first 40 chars of the user's prompt if no Heading.
- [ ] AC-P3: `render_hash = sha256(canonicalize(spec_json))`; two clients fetching the same project_version produce a byte-equal canonical render.
- [ ] AC-P4: GET /projects returns the current user's projects ordered by `updated_at` DESC.
- [ ] AC-P5: GET /projects/:id returns 404 for non-owners; 200 with the project + current version for the owner.
- [ ] AC-P6: User can sign out and back in on a different device; library is restored from Supabase.

### Render
- [ ] AC-R1: All 10 catalog components render correctly: `Heading, Text, Image, Button, TextInput, Toggle, Counter, List, Form, Container`.
- [ ] AC-R2: Each component honors its required and documented optional props from `ARCHITECTURE.md §6`.
- [ ] AC-R3: Each component has a snapshot test covering its props matrix.
- [ ] AC-R4: Reopening a saved app produces a render tree byte-equal to the first render — verified by snapshot test using `render_hash` as the cache key.
- [ ] AC-R5: All four supported actions execute correctly in the renderer's local state machine: `set`, `increment`/`decrement`, `toast`, `navigate`.

### iOS / TestFlight
- [ ] AC-I1: App builds successfully via `eas build --platform ios --profile production`.
- [ ] AC-I2: App passes `eas submit --platform ios --latest` and processes in App Store Connect.
- [ ] AC-I3: App is available to ≥3 internal testers via TestFlight internal group, no Apple beta review required.
- [ ] AC-I4: Crash-free sessions ≥99% during a 1-week internal-tester soak.

### Quality
- [ ] AC-Q1: All log output is PII-safe (no raw email, no JWTs, no full prompt text via `logger.info`). Validated via grep over the diff.
- [ ] AC-Q2: WCAG AA contrast in light + dark themes; VoiceOver labels on every interactive shell element.
- [ ] AC-Q3: All POST endpoints rate-limited to 30 req/min/user.
- [ ] AC-Q4: 30-prompt eval set runs in CI on every PR that touches `services/api/src/llm/` or `packages/a2ui-schema/`.

## Scope

### In Scope (POC)
- Magic-link auth via Supabase
- Chat screen + AppRunner screen + Home (library) screen + Sign-In screen
- POST /generate (Anthropic call → A2UI spec)
- POST /projects + GET /projects + GET /projects/:id (Supabase Postgres)
- Full A2UI renderer (10 components, all 4 action types)
- Eval harness with 30 prompts (manual scoring acceptable for POC)
- TestFlight internal-only build path
- iOS only, English only, light + dark themes

### Phase 2 (post-POC, still M1)
- Memory layer (facts table + embeddings, recall in subsequent prompts)
- Edit-by-chat (POST /edit with JSON Patch tool, server-side validate + apply)
- Streaming generation (SSE)
- Push notifications on generation complete
- Project delete with confirmation

### Explicitly Out of Scope (Phase 3+)
- Marketplace (publish, browse, fork)
- Payments (Apple IAP, Stripe)
- Real third-party integrations (Calendar, Health, Plaid)
- Public share URLs / web renderer
- Android, web targets
- Apple/Google sign-in (magic-link only at MVP)
- Multi-account on one device
- Voice input
- Tap-to-edit on generated UI elements
- Custom component types beyond the 10-component catalog

## API Contracts

| Endpoint | Auth | Returns | Excludes |
|---|---|---|---|
| POST /auth/magic-link | none | `{sent: true}` | (Supabase handles delivery) |
| POST /auth/verify | callback token | `{access_token, refresh_token, user}` | password hashes (not used), service role keys |
| POST /generate | required JWT | `{spec: A2UISpec}` on 200; `{error, detail?}` on 4xx/5xx | server prompts, error stacks, other users' data |
| POST /projects | required JWT | `{project: Project, version: ProjectVersion}` | spec_json from other users |
| GET /projects | required JWT | `{projects: Array<{id, title, updated_at, current_version_id}>}` | other users' projects, full spec_json (use detail endpoint) |
| GET /projects/:id | required JWT, must be owner | `{project, current_version: {id, spec_json, render_hash, created_at}}` | other users' data |

**Error response shape (all endpoints):** `{error: string, detail?: unknown}`. Codes: `invalid_input` (400), `unauthorized` (401), `forbidden` (403), `not_found` (404), `invalid_spec` (400), `prompt_too_large` (400), `rate_limited` (503), `internal` (500).

**Excluded from all responses:** `service_role_key`, `jwt_secret`, `anthropic_api_key`, raw email addresses in payload bodies (only in JWT claims), and `email_hash` for non-self users.

## Non-Functional Requirements

- **Performance:** p95 /generate ≤90s; p95 /projects ≤500ms; p95 /generate first-byte ≤1s once streaming lands (Phase 2).
- **Security:** TLS everywhere (Supabase + EAS managed). JWT validation on every authenticated route. Tokens stored in `expo-secure-store` only — never AsyncStorage / MMKV. Rate limiting per user per route (30/min). Server input validation via Zod on every POST body.
- **Accessibility:** WCAG 2.1 AA. VoiceOver labels on every interactive element. Hit targets ≥44×44 pt. Reduced motion respected. Light + dark themes.
- **Privacy:** Email addresses logged only via JWT claims, never application logs. Generated app content not duplicated in application logs (Langfuse stores prompts intentionally for eval; we don't double-log). GDPR account-deletion flow deferred to Phase 2.

## Dependencies

| Dependency | Status | Owner |
|---|---|---|
| Apple Developer Program ($99) | Not yet enrolled | User — start today, 1-2 day verification |
| iOS Bundle ID + ASC App Record | Not created | User — once Apple Dev approves |
| Apple Team ID + ASC App ID | Not extracted | User — share with engineering once available |
| Supabase project | Not created | User — create + share URL/keys |
| Supabase: pgvector enabled | Not done | User — Database → Extensions → vector |
| Supabase: magic-link auth configured | Default works | User — verify in Supabase dashboard |
| Anthropic API key | Done (rotated) | User — already in `services/api/.env` |
| EAS account | Not yet | User — `eas login` after engineering kicks off the first dev build |
| 30 eval prompts written | Not yet | PM (Robert) — drafts during build, refines with user |

## Risks & Open Questions

| Risk | Likelihood | Mitigation |
|---|---|---|
| LLM emits invalid specs faster than we can iterate the system prompt | Medium | Tighten system prompt iteratively against the eval set; force tool_choice; add per-component example shots. Lock the catalog at 10 — don't let it grow during this slice. |
| Apple Developer enrollment slips | Medium | Start enrollment today. Worst case, the build path is verifiable via simulator builds and we ship to TestFlight in a follow-up. |
| Supabase free-tier limits during eval runs | Low | 30-prompt eval is well within free tier. Add cost monitoring before any external testing. |
| Renderer state-management complexity for `Form` + nested `Container` | Medium | Cal scopes the state model carefully in the ADR. Snapshot tests cover the state-action matrix. |
| LLM cost overrun during eval iteration | Medium | Cache the system prompt aggressively (already in §4 of ARCHITECTURE.md). Cap per-engineer per-day Anthropic spend at $20 via the Anthropic console. |

**Open questions (need answers before Cal can write a complete ADR):**

1. **Auth token storage on simulator:** does `expo-secure-store` work on iOS Simulator? (Believed yes; verify in spike.)
2. **Project title generation:** auto-derive from spec heading vs. ask the user to confirm at save time? Spec says auto; user can override later (Phase 2 capability).
3. **Streaming the LLM response in this slice:** No (per scope cut). One-shot response. SSE in Phase 2.
4. **Eval harness scoring:** binary pass/fail by structural assertions (must contain ≥1 Heading, must use only catalog types, must validate against schema), with a manual-judgment escape hatch for prompts where the LLM's interpretation is debatable.

## Timeline Estimate

| Phase | Effort | Dependencies |
|---|---|---|
| UX (Sable) | 0.5 day | This spec approved |
| Mockup mode (Colby) — wired to mock data | 1 day | UX doc |
| User UAT (you, in browser) | 0.5 day | Mockup ready |
| ADR (Cal) | 1 day | UAT approved + this spec |
| Auth + magic link | 1 day | Supabase ready |
| /generate endpoint + eval harness | 1.5 days | Anthropic key (done) |
| A2UI renderer (10 components) | 2 days | nothing |
| Persistence (projects + versions) | 1 day | Supabase ready |
| Library + AppRunner integration | 1 day | persistence done |
| TestFlight build + submit | 0.5 day | Apple Dev ready |
| Eval harness 30-prompt run + tuning | 1.5 days | All endpoints done |
| **Total** | **~11.5 days** | All prereqs ready by day 0 |

If Apple Dev takes 3 days to verify and Supabase takes a day to set up, real wall-clock is ~14 calendar days assuming no surprises.

## Notes for Sable

- This is **iOS native** — your design happens in iOS conventions, not web. Bottom sheets, not modals. Haptics on success states. Safe area insets on every screen.
- **Two distinct UI layers** to design — don't blur them:
  1. **App-shell** (Sign-In, Home/library, Chat, AppRunner header) — your work.
  2. **A2UI renderer components** (Heading, Text, Button, etc.) — your work *also*, but these are constrained to the 10-component catalog. The visual treatment of a `Button` here is the *only* button style users will see in their generated apps. Pick carefully.
- **Empty states matter most** here — the empty library is the screen most users see first. Design it to be inviting, not depressing.
- **Streaming generation is Phase 2** — design this slice's loading state for "user waits 30s." Make it not feel like a stuck spinner. Skeleton, progress messages, dots, whatever feels honest.
- **Color palette + typography** — pick now. Light + dark both. WCAG AA contrast.

## Notes for Cal

- **Two-layer split is binding** — see `ARCHITECTURE.md §6`. Renderer code lives only in `packages/a2ui-renderer/`. App-shell components live in `apps/mobile/src/components/`. They never share files.
- **All Anthropic calls go through `services/api/src/llm/anthropic.ts`** (`ARCHITECTURE.md §4`). No exceptions, no SDK calls in route handlers.
- **Prompt caching is mandatory** for the catalog block. The catalog is ~3K tokens of stable system prompt — perfect cache candidate.
- **Tool-use is forced**, not parsed from free text. `tool_choice: {type: 'tool', name: 'produce_app_spec'}`. No JSON-mode parsing.
- **Renderer is sandbox**: pure functions of `{node, state, dispatch}`. No `useEffect`, no fetch, no eval, no JS execution. Actions limited to the closure: `set`, `increment`/`decrement`, `toast`, `navigate`.
- **render_hash** = SHA-256 of canonical spec JSON (sorted keys, no whitespace). The "reopen → identical render" acceptance is verified by snapshot test against this hash.
- **Token budget**: 8K output, 12K input. Refuse before calling — don't truncate.
- **Sub-slicing**: the spec is large by Robert's slicing standards. If you think the ADR should split into 3-4 ADRs (auth+infra → generate → persistence → render+library), say so. I'd rather see it split than crammed.

---

> ✅ Feature spec saved to `docs/product/app-creation-poc.md`
>
> **Next step:** Hand to Sable (`/ux`) for UX design.

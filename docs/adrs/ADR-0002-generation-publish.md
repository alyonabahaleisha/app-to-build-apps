# ADR-0002: Generation, Publish API, Eval Harness

_Authored by Cal — 2026-05-02_

## Status

Proposed

## Context

ADR-0001 shipped auth, DB schema, the projects service (read paths), and the mobile shell up through Sign-In + Home. The `/generate` endpoint, the renderer body, and the Marketplace are unimplemented.

Robert's child spec `docs/product/chat-creation.md` (2026-05-02) supersedes the umbrella's Phase-3 marketplace cut and brings the maker community surface forward into M1. Sable's child UX `docs/ux/chat-creation-ux.md` (2026-05-02) describes the visual delta — two-tab Home, three AppRunner modes, publish bottom-sheet, two-stage SSE loading state, remix flow.

The renderer is currently a skeleton: `packages/a2ui-renderer/src/render.tsx` only handles `Heading` and `Text` (lines 38–43). The full 10-component catalog is unimplemented.

Three forces push toward sub-slicing into ADR-0002 + ADR-0003:

1. **Eval-gate isolation.** The 30-prompt eval harness with extended thinking + tool use is its own test gate (≥80% pass on Zod-valid + deep-validated specs). Bundling it with renderer + AppRunner three-mode UX puts a passing eval at risk of being held up by an unrelated React Native bug. Eval owns its merge point.

2. **Renderer is a real slice.** Building 10 components (Toggle, Counter, Form, Container nested layouts, etc.) with snapshot tests per props matrix is multiple days of work. It blocks the Library/Try/Remix UX (no rendering = no marketplace), but doesn't block the Generation API or the Maker's own Publish flow. Different blast radius, different ADR.

3. **Per Robert's note:** _"ADR-0002 and ADR-0003 will be drafted after 0001 lands — not preemptively. We learn things during 0001 that will sharpen 0002."_ That convention extends here: write 0002, ship 0002, then sharpen 0003 against what we learned (eval pass rate, real generation latencies, schema friction). Don't preemptively design 0003.

> **What if we do nothing (don't write this ADR):** the engineer wires `/generate` against a single Anthropic call, skips extended thinking ("we'll add it later"), persists prompts and visibility ad hoc, and discovers two weeks later that the SSE protocol the mobile app expects doesn't match the wire format the server emits. That's the failure mode this ADR exists to prevent.

## Decision (this ADR)

Build **Generation, Publish API, and the Eval Harness**. Mobile shell additions: SSE-driven two-stage loading on Chat; AppRunner Owner-mode top bar with Publish/Unpublish CTA; first-publish bottom-sheet with handle picker. The full A2UI renderer, the two-tab Home, the Try mode, the Remix flow, the FAB, and TestFlight ship are deferred to **ADR-0003 (sketched at the end of this ADR; drafted post-0002).**

### Architectural choices, with rationale and ARCHITECTURE.md citations

#### A. Schema additions live on existing tables; no new tables (per ARCHITECTURE.md §5)

`users.handle` (text, UNIQUE, nullable, populated lazily on first publish). `projects.visibility` (text + CHECK), `projects.published_at` (timestamptz, nullable), `projects.original_prompt` (text NOT NULL DEFAULT ''). The umbrella's `parent_project_id` column already exists from ADR-0001 Step 1; we wire it without further migration.

Why not a separate `published_projects` table? It would require joining on every Library read and every publish/unpublish. The visibility flag on `projects` matches how Postgres-backed publish/unpublish is universally modeled and lets `/library` use a partial index for the common case.

#### B. Visibility is `text` + CHECK, not `pgEnum` (consistency with `messages.role`)

`messages.role` already uses text + value-set discipline at the application layer. Postgres ENUM types are awkward to extend (`ALTER TYPE ADD VALUE` is not transactional in older versions, and Drizzle schema reflection is rough on enums). Text + CHECK gives us flexibility for Phase 2's `unlisted` value at zero refactor cost.

#### C. SSE on `/generate` for phase events (per ARCHITECTURE.md §4, CLAUDE.md §7)

Three event types: `thinking_started`, `building_started`, `done` (+ `error`). The wire format is text/event-stream with `data: <JSON>\n\n` framing and a `data: [DONE]\n\n` sentinel. Distinct from the umbrella's deferred _content_ streaming — we stream **only phase events**, not LLM tokens. The `done` event carries the full validated spec + project metadata in one payload.

Server taps Anthropic's streaming API (`messages.stream()`). The phase transition `thinking_started → building_started` is observable from Anthropic's streamed `content_block_start` events: type `thinking` for the thinking block, type `tool_use` for the tool call. Server emits `thinking_started` _immediately_ on request acceptance (so the client never sees a blank loading state); it emits `building_started` on the first `content_block_start` event with type `tool_use`.

#### D. Extended thinking with `budget_tokens: 4000`, `tool_choice` forced (per Robert AC-CG-G2)

`thinking: {type: 'enabled', budget_tokens: 4000}` paired with `tool_choice: {type: 'tool', name: 'produce_app_spec'}`. The model deliberates inside the thinking block, then emits the spec via the forced tool. Output cap stays at `max_tokens: 8000` (umbrella ARCHITECTURE.md §4). Total token budget is bounded: 12K input (system + catalog + messages, pre-checked at the route), 8K output, 4K thinking — the thinking budget is _separate_ from the output budget per Anthropic's API contract.

#### E. Anthropic SDK 0.30.1 supports streaming + extended thinking + tool use simultaneously

Verified against the existing `package.json` dep. The SDK's `messages.stream()` returns an async iterator over `MessageStreamEvent` objects; we filter for `content_block_start` (phase boundaries), `content_block_delta` (accumulate tool input deltas), `message_stop` (tool input final). No SDK upgrade required.

#### F. Auto-derived title carries from ADR-0001 (`deriveTitle` in `services/api/src/services/projects.service.ts:103`)

No change. The function already handles the heading-traversal + 60-char-trim + ellipsis case the umbrella spec required.

#### G. Original prompt stored on `projects`, not derived from `messages` (per Robert's spec)

The umbrella schema has a `messages` table for chat history. Robert's child spec says `original_prompt` lives on `projects`. We honor the spec — denormalize the prompt onto the project row. Reads of `/library/:id` don't have to join `messages` to surface the prompt to remixers. The `messages` table still gets the user's prompt as a row (for future memory/edit features per umbrella AC-G2 carryover).

#### H. `@example` is a real `users` row with `handle = 'example'` and a sentinel email

Sentinel email: `example@reserved.localhost`. The Supabase auth flow has no path to issue tokens for this UUID, so the user cannot be signed into. The local `users` mirror just exists as a foreign-key target for seed projects. This is simpler than a special-case "system project owner" shape.

#### I. Reserved handles list is application-side (services/api/src/lib/reservedHandles.ts)

Six entries: `admin`, `system`, `official`, `support`, `app`, `creator`. Plus `example` (the seed user owns this; no real maker can claim it). DB-level UNIQUE catches the @example collision; application-level list catches the rest _before_ hitting the DB and gives a meaningful error code (`handle_reserved`).

#### J. Handle availability check is a separate `GET /handles/check?h=<handle>` endpoint

Cheaper than a "publish dry-run." Returns `{available: bool, reason?: 'taken'|'reserved'|'invalid'}` based on regex + reserved list + DB unique. No transaction. Rate-limited at 60/min/user (debounce-friendly — the publish sheet pings on every keystroke after 500ms).

#### K. Routes rename: `/projects/*` → `/me/projects/*` (per Robert AC-CG-P7 supersede)

Breaking change to ADR-0001's routes. ADR-0001 is shipped but not in production use; mobile callers update in lockstep. The mobile API client already lives in one place (`apps/mobile/src/state/queries/projects.ts`), so the rename is mechanical.

#### L. Library endpoints (`GET /library`, `GET /library/:id`) added with cursor pagination on `(published_at DESC, project_id)` for stable ordering across ties

Why cursor and not offset? Because `published_at` is non-unique (two publishes in the same millisecond are possible — unlikely at 20 testers, defensive long-term), offset-pagination drifts. Cursor is `base64({published_at, project_id})`; the SQL is `WHERE (published_at, id) < (cursor)` ordered by both columns DESC.

#### M. Partial index on `(visibility, published_at DESC) WHERE visibility = 'public'`

The `/library` query is the only consumer of `visibility = 'public'` rows; making the index partial keeps it small (most projects will be private) and the query planner uses it without conditions. Also the only index where `published_at` matters for ordering; the existing `projects_owner_idx` covers `/me/projects`.

#### N. `publish` and `unpublish` are idempotent

Re-publishing a public project: 200, no state change, no `published_at` update (we don't bump on re-publish — `published_at` is "first publish time at the current visibility cycle"). Unpublishing a private project: 200, no state change. This matches Robert's AC-CG-P1, AC-CG-P4 and protects against client retries on flaky networks.

#### O. SSE response is _not_ aborted when the client disconnects

The `/generate` handler keeps the Anthropic call alive until completion regardless of client connection state. On completion, the project still persists. This matches umbrella's "cancel-during-generation" behavior (Sable's UX): the user finds their project in My apps on next refresh. Implementation: the SSE handler ignores `req.raw.on('close')`; the Anthropic stream consumption proceeds inside its own promise. We log `client_disconnect_during_generate` for observability.

#### P. Eval harness invokes the in-process generation function, not over HTTP

`services/api/eval/run.ts` imports `generateAppSpec` directly from the LLM module, bypasses the SSE wrapper, runs against Anthropic with the same model + prompt + tool. Output: a JSON report (`eval/results/<timestamp>.json`) with per-prompt `{prompt, success, thinking_duration_ms, generation_duration_ms, error?}`. CI gate: pass rate < 80% → exit 1.

#### Q. `@gorhom/bottom-sheet` added to ARCHITECTURE.md §14 sanctioned mobile deps

Per Sable's UX ask. v5.x for RN 0.76 compatibility. Pulls in `react-native-reanimated` (already a transitive dep via React Navigation v7) and `react-native-gesture-handler` (already transitive via React Navigation). The lib handles keyboard avoidance, focus trap, swipe-down dismissal, and a11y modal-marking out of the box. Rolling our own would be three days of low-leverage work.

## Alternatives Considered

### Alternative 1: Bundle Generation + Renderer + Marketplace UX into one ADR

- **Upside:** Single merge gate. No orphan state where the API exists but the UI doesn't consume it.
- **Downside:** ~12 days of work in one PR. Eval failures would block UI work; UI bugs would block eval iteration. The blast radius spans backend, mobile, schema, infra. ARCHITECTURE.md §17 D7 (no CD pipeline) means a single failed merge stalls everything.
- **Why not:** Two ADRs let us ship Generation + Publish behind a feature-complete-but-cosmetically-stub'd UI (what 0002 does), validate the eval gate empirically, then build the marketplace UX on a known-working LLM pipeline (what 0003 does). Three independent merge gates beat one big one (the same argument ADR-0001 used to split itself out of the umbrella).

### Alternative 2: Skip extended thinking; use a single non-streaming Anthropic call

- **Upside:** Simpler server code. No SSE infra. ~30s latency instead of ~60–120s.
- **Downside:** Sable's UX explicitly relies on real server-emitted phase events for the loading state ("Thinking…" → "Building…"). Without extended thinking, we'd revert to the umbrella's three-timer cosmetic fiction — exactly the pattern Robert called out and rejected (Q5 of his discovery).
- **Why not:** Honesty in the loading UX is worth the +20s latency. The 30-prompt eval also benefits from extended thinking — early Anthropic data suggests 5–15% pass-rate uplift on structured-output prompts. We can drop extended thinking later if eval data shows it doesn't help; we can't _add_ it later without a redo.

### Alternative 3: NDJSON instead of SSE for phase events

- **Upside:** Simpler client (split-on-newline). One less Content-Type spec to debug.
- **Downside:** SSE is the umbrella architecture's chosen streaming primitive (CLAUDE.md §7). We already have `eventsource-parser` as a sanctioned dep (ARCHITECTURE.md §14). NDJSON would be a parallel mechanism for marginal benefit.
- **Why not:** Use the primitive that's already sanctioned and tested. Pattern consistency wins over marginal cleanup.

### Alternative 4: Rolling our own bottom sheet instead of `@gorhom/bottom-sheet`

- **Upside:** No new dep. Full control.
- **Downside:** Keyboard avoidance, focus trap, swipe-down, a11y modal-marking — all four would be handled wrong on the first pass. We'd ship subtle bugs that Roz catches later.
- **Why not:** Cal's bias against UI-kit deps doesn't extend to single-purpose primitives. `@gorhom/bottom-sheet` is a focused library that does one thing well. Sanction it.

### Alternative 5: Stream LLM content (not just phase events)

- **Upside:** Sub-second time-to-first-byte. UI can render skeletons earlier.
- **Downside:** A2UI specs aren't streamable in any meaningful sense — the renderer needs the full validated tree. Streaming partial JSON to the client would let the client render unvalidated content (security/correctness risk) or hold it in a buffer (no visible benefit).
- **Why not:** Phase 2 (umbrella). Out of scope. Sticking to phase-events-only.

### Alternative 6: Persist seed projects via a TypeScript script run at deploy, not a SQL migration

- **Upside:** Seeds can be authored against the live `A2UISpecSchema` and validated at write time.
- **Downside:** The "deploy script" doesn't exist yet (ARCHITECTURE.md §17 D7 — no CD pipeline). Creating one for seed-only purposes is overkill; the migration approach is one-time-on-init.
- **Why not:** SQL migration is simpler now. We can convert to a TS-driven seed in Phase 2 if we add more seed apps and want schema validation at author time. For 5–10 hand-authored specs, Zod-validate them in CI against the schema (one Jest test per seed) and call it done.

## Consequences

### Positive

- ADR-0002 ships a complete chat-create-publish loop that's testable end-to-end via the eval harness without any UI glue.
- The renderer staying skeleton in 0002 is _expected_ — owners see partial renders for their generated apps. Acceptable for internal-only validation.
- ADR-0003's design surface is constrained: it's "build the renderer + tabbed Home + three AppRunner modes," not "design the marketplace from scratch." Smaller blast radius.
- Eval harness running in CI (PRs touching `services/api/src/llm/` or `packages/a2ui-schema/`) gives us a regression net for system prompt changes.

### Negative

- A maker who publishes in 0002 sees their public app in the Library _only after ADR-0003 ships_. The Library tab doesn't exist in 0002. This is documented in the publish toast ("Published to Library") and accepted; the maker has confidence their app is public even though they can't browse it yet.
- The renderer producing "[Unimplemented: Toggle]" placeholders for non-Heading/Text components is awkward in 0002 internally. Mitigated: the eval harness validates spec _structure_, not rendered output, so the gate is unaffected. Internal testers will see partial renders and can give feedback on copy/loading UX without renderer-related noise.
- `@example` user with sentinel email `example@reserved.localhost` is a defensive shape — if Supabase ever syncs `auth.users` against our local mirror and treats the @example row as a real auth user, we have a small surface for misuse. Accepted; documented in §17 D10 below.
- Renaming `/projects` → `/me/projects` is a breaking change to ADR-0001's routes. Mobile updates in lockstep. No prod users.

### Risks

| Risk                                                                                                                   | Likelihood            | Mitigation                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Anthropic streaming + tool use + extended thinking has subtle quirks the SDK 0.30.1 hasn't documented                  | Medium                | Step 3 includes a manual smoke test against a single prompt before SSE wrapping. Document any discovered quirks in Notes for Colby.                                                                                               |
| Extended thinking budget of 4K is too low and pass rate drops                                                          | Medium                | Step 10 (eval harness) is the gate. If pass rate <80%, raise budget to 6K and re-run. Robert is on the hook for the call-to-disable if the data justifies.                                                                        |
| Handle uniqueness race between two simultaneous first-publishes                                                        | Low                   | DB UNIQUE constraint catches it. Application surfaces 409 / `handle_taken`. T-0002-052 verifies the race.                                                                                                                         |
| Client disconnects mid-generation; project still persists; user is confused next refresh                               | Low                   | Acceptable per umbrella behavior. Server-side log `client_disconnect_during_generate` for observability. T-0002-035 verifies persistence works regardless.                                                                        |
| Seed projects' specs use catalog components the renderer doesn't yet handle (everything except Heading + Text in 0002) | High _(but accepted)_ | Internal testers will see "[Unimplemented: <Type>]" for seeds in any rare 0002-only AppRunner viewing. Library tab isn't shipped in 0002, so the impact is bounded to direct-URL access. ADR-0003 fixes by shipping the renderer. |
| `@gorhom/bottom-sheet` v5.x + RN 0.76 compatibility issue surfaces during integration                                  | Low                   | Step 9 has an explicit smoke-test acceptance criterion. If incompatible, fall back to a `Modal`-based bottom-sheet (uglier, but unblocks).                                                                                        |
| Eval harness costs (Anthropic API spend) overrun on iteration                                                          | Medium                | $30/engineer/day cap from Robert's spec. Manual override only with explicit approval.                                                                                                                                             |

## Implementation Plan

### Step 1: Schema additions + library partial index

- **Files to create**:
  - `services/api/migrations/0003_marketplace_columns.sql` — adds `users.handle` (text UNIQUE nullable), `projects.visibility` (text NOT NULL DEFAULT 'private' CHECK in {private,public}), `projects.published_at` (timestamptz nullable), `projects.original_prompt` (text NOT NULL DEFAULT ''), and `CREATE INDEX projects_library_idx ON projects (visibility, published_at DESC, id) WHERE visibility = 'public'`.
- **Files to modify**:
  - `services/api/src/db/schema.ts` — add the four columns + index marker; export updated types.
- **Acceptance criteria**:
  - Migration runs cleanly on a fresh db (testcontainers).
  - Migration runs cleanly against an ADR-0001-migrated db (no data loss; existing rows get default values).
  - Idempotent: re-running is a no-op.
  - `users.handle` column allows nulls but enforces UNIQUE on non-null values.
  - `projects.visibility` CHECK constraint rejects values outside {'private','public'}.
  - `projects_library_idx` exists and is `partial` (visible in `\d projects` output).
- **Estimated complexity:** Low.

**Code shape:**

```sql
-- 0003_marketplace_columns.sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS handle text UNIQUE;
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS original_prompt text NOT NULL DEFAULT '';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints
                 WHERE constraint_name = 'projects_visibility_chk') THEN
    ALTER TABLE projects ADD CONSTRAINT projects_visibility_chk
      CHECK (visibility IN ('private', 'public'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS projects_library_idx
  ON projects (visibility, published_at DESC, id)
  WHERE visibility = 'public';
```

```ts
// services/api/src/db/schema.ts — patch
export const projects = pgTable('projects', {
  // ... existing columns ...
  visibility: text('visibility').notNull().default('private'),
  publishedAt: timestamp('published_at', {withTimezone: true}),
  originalPrompt: text('original_prompt').notNull().default(''),
})
export const users = pgTable('users', {
  // ... existing columns ...
  handle: text('handle').unique(),
})
```

---

### Step 2: `@example` seed user + 5–10 seed projects

- **Files to create**:
  - `services/api/migrations/0004_example_seeds.sql` — INSERT the @example user (`id = '00000000-0000-0000-0000-000000000001'`, `email = 'example@reserved.localhost'`, `handle = 'example'`) + 5–10 hand-authored seed projects with valid spec_json, `visibility='public'`, `published_at` back-dated to '2020-01-01' (well before any real maker publish — they sit at the bottom of the feed).
  - `services/api/src/lib/reservedHandles.ts` — exports `RESERVED_HANDLES = ['admin','system','official','support','app','creator','example']` and a `isReservedHandle(handle: string): boolean` helper.
- **Files to modify**:
  - `services/api/src/services/projects.service.ts` — none directly; the seeds use SQL.
  - `services/api/src/db/schema.test.ts` — add a Jest test that loads each seed spec from `migrations/0004_example_seeds.sql` (fixture-style) and validates against `A2UISpecSchema` + `deepValidateSpec`.
- **Acceptance criteria**:
  - Seed migration runs cleanly on a fresh db.
  - Idempotent: re-running is a no-op (`INSERT ... ON CONFLICT DO NOTHING`).
  - All seed spec_json values pass `A2UISpecSchema.parse` and `deepValidateSpec` (verified by Jest).
  - `@example` user is unloginable: querying `auth.users` (Supabase) for the sentinel email returns nothing — only the local mirror has the row.
  - `users.handle = 'example'` is in `RESERVED_HANDLES`.
  - `RESERVED_HANDLES` includes `admin`, `system`, `official`, `support`, `app`, `creator`, `example`.
- **Estimated complexity:** Medium (5–10 hand-authored specs; Robert co-authors).

**Code shape:**

```sql
INSERT INTO users (id, email, handle, created_at)
VALUES ('00000000-0000-0000-0000-000000000001', 'example@reserved.localhost', 'example', '2020-01-01')
ON CONFLICT (id) DO NOTHING;

INSERT INTO projects (id, owner_id, title, visibility, published_at, original_prompt, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001',
   'Tip splitter', 'public', '2020-01-01', 'A tip splitter for my favorite coffee shop',
   '2020-01-01', '2020-01-01')
ON CONFLICT (id) DO NOTHING;
-- + project_versions row with hand-authored spec_json …
```

---

### Step 3: Anthropic LLM module + tool definition + cacheable system prompt

- **Files to create**:
  - `services/api/src/llm/anthropic.ts` — singleton SDK client with API key from env (`ANTHROPIC_API_KEY`). Throws on missing key at module load. No call sites instantiate the SDK directly.
  - `services/api/src/llm/tools/produceAppSpec.ts` — exports the tool definition: `{name: 'produce_app_spec', description, input_schema}` derived from the Zod `A2UISpecSchema` (use `zod-to-json-schema`).
  - `services/api/src/llm/prompts/system.ts` — exports `SYSTEM_PROMPT_STATIC` and `SYSTEM_PROMPT_CATALOG` strings; the latter has component examples and is the cache target.
  - `services/api/src/llm/generate.ts` — exports `generateAppSpec({userId, prompt, parentPromptContext?})` async generator yielding `{type: 'thinking_started'} | {type: 'building_started'} | {type: 'done', spec}` events. Wraps the Anthropic streaming call.
- **Files to modify**:
  - `services/api/package.json` — add `zod-to-json-schema` as a runtime dep.
- **Acceptance criteria**:
  - `anthropic.ts` throws `EnvMissingError` if `ANTHROPIC_API_KEY` is unset/empty/whitespace-only at module load.
  - The tool definition's `input_schema` strictly equals the JSON Schema rendering of `A2UISpecSchema` (snapshot test).
  - `generateAppSpec` yields events in order: `thinking_started` (synchronously before the first await), `building_started` (when Anthropic streams the first `tool_use` block), `done` (with the validated spec).
  - On invalid Anthropic tool input (Zod parse fails), the function throws `InvalidSpecError(code: 'invalid_spec', detail: <flattened zod issues>)`.
  - On Anthropic 429, retries 2× with exponential backoff (1s, 2s); if still 429, throws `RateLimitedError`.
  - On other Anthropic transport errors, throws `AnthropicTransportError(safeMessage)`.
  - System prompt is split: `system: [{type: 'text', text: SYSTEM_PROMPT_STATIC}, {type: 'text', text: SYSTEM_PROMPT_CATALOG, cache_control: {type: 'ephemeral'}}]`.
  - `metadata.user_id` is `sha256(userId).slice(0, 16)` (hashed; never raw).
  - `max_tokens: 8000`, `thinking: {type: 'enabled', budget_tokens: 4000}`, `tool_choice: {type: 'tool', name: 'produce_app_spec'}`.
- **Estimated complexity:** High.

**Code shape:**

```ts
// services/api/src/llm/generate.ts
export async function* generateAppSpec(opts: {
  userId: string
  prompt: string
  parentPromptContext?: string
}): AsyncGenerator<GenerateEvent, void> {
  yield {type: 'thinking_started'}
  let buildingEmitted = false
  const stream = anthropic.messages.stream({...})
  for await (const event of stream) {
    if (!buildingEmitted && event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
      yield {type: 'building_started'}
      buildingEmitted = true
    }
  }
  const final = await stream.finalMessage()
  const toolBlock = final.content.find((b) => b.type === 'tool_use')
  if (!toolBlock) throw new InvalidSpecError('invalid_spec', 'no tool_use block')
  const spec = A2UISpecSchema.parse(toolBlock.input)
  yield {type: 'done', spec}
}
```

---

### Step 4: SSE `/generate` route — wire LLM, persist, emit events

- **Files to create**:
  - `services/api/src/routes/generate.ts` — POST `/generate`. Validates body (`{prompt: string(1-2000), parent_project_id?: uuid}`). Pre-checks input length ≤ 12000 chars. Auth-gates via `requireAuth`. Rate-limits at 30/min/user. Opens SSE response. Calls `generateAppSpec`, streams phase events as `data: <JSON>\n\n`. On `done`: persists project (visibility='private', original_prompt = input prompt, parent_project_id passed through), emits `{type: 'done', project: {id, title, visibility, ...}, spec, render_hash, thinking_duration_ms, generation_duration_ms}`, then `data: [DONE]\n\n`. On error: emits `{type: 'error', code, detail?}`, then `data: [DONE]\n\n`.
- **Files to modify**:
  - `services/api/src/services/projects.service.ts` — `create()` accepts `originalPrompt` parameter, persists to the new column. (Also note: `create()`'s existing transaction now writes `original_prompt`; backward-compat with ADR-0001 callers requires defaulting to '' if not provided.)
  - `services/api/src/server.ts` — register the new route.
- **Acceptance criteria**:
  - Happy: full SSE stream emits `thinking_started` → `building_started` → `done` → `[DONE]`. Project persisted with visibility='private', original_prompt set.
  - Error event for: `invalid_input` (Zod body parse), `prompt_too_large` (>12000 chars input), `invalid_spec` (Anthropic emits malformed spec), `rate_limited` (Anthropic 429 after retries → 503 status header + error event), `internal` (other transport errors).
  - Server-Sent Events headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`, `Connection: keep-alive`.
  - Client disconnect mid-stream: server completes the Anthropic call, persists the project, logs `client_disconnect_during_generate` with `userId, projectId`. The user finds the project in their library on next refresh.
  - `parent_project_id` provided → server fetches parent's `original_prompt` and includes it in the `parentPromptContext` system message addition. The new project's `parent_project_id` column is set.
  - `metadata.user_id` is hashed (not raw).
  - Original prompt is stored in `projects.original_prompt` AND a `messages` row is INSERTed for the user prompt (umbrella memory carryover).
  - Auth-gated: 401 without JWT.
  - Rate-limited: 31st request in a minute → 429 with retry-after header.
- **Estimated complexity:** High.

**Code shape:**

```ts
fastify.post('/generate', {preHandler: [requireAuth]}, async (req, reply) => {
  const body = GenerateBodySchema.parse(req.body)
  if (totalInputLength(body) > 12000) return reply.code(400).send({error: 'prompt_too_large'})
  reply.raw.setHeader('Content-Type', 'text/event-stream')
  // ... other SSE headers ...
  try {
    for await (const event of generateAppSpec({...})) {
      if (event.type === 'done') {
        const project = await projectsService.create({
          ownerId: userId,
          spec: event.spec,
          originalPrompt: body.prompt,
          parentProjectId: body.parent_project_id,
        })
        reply.raw.write(`data: ${JSON.stringify({type: 'done', project: project.summary, ...})}\n\n`)
      } else {
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`)
      }
    }
  } catch (err) {
    reply.raw.write(`data: ${JSON.stringify({type: 'error', code: codeOf(err), detail: detailOf(err)})}\n\n`)
  }
  reply.raw.write('data: [DONE]\n\n')
  reply.raw.end()
})
```

---

### Step 5: Publish / Unpublish endpoints + handle endpoints

- **Files to create**:
  - `services/api/src/routes/marketplace.ts` — `POST /projects/:id/publish` (body `{handle?: string}`), `POST /projects/:id/unpublish`, `POST /users/me/handle` (body `{handle: string}`), `GET /handles/check?h=<string>`.
  - `services/api/src/services/marketplace.service.ts` — `publish({userId, projectId, handle?})`, `unpublish({userId, projectId})`, `setHandle({userId, handle})`, `checkHandle(handle)`.
- **Files to modify**:
  - `services/api/src/server.ts` — register routes.
- **Acceptance criteria**:
  - `POST /projects/:id/publish`: requires owner JWT. Sets `visibility='public'`, `published_at=now()`. Idempotent. If user has no handle, body must include `{handle}`; sets `users.handle` atomically.
  - Body without handle when user has none → 400 `{error: 'handle_required'}`.
  - Body with invalid handle (regex `^[a-z0-9-]{3,20}$`) → 400 `{error: 'invalid_handle'}`.
  - Body with reserved handle → 400 `{error: 'handle_reserved'}`.
  - Body with taken handle → 400 `{error: 'handle_taken'}`.
  - Non-owner publishing someone else's project → 404 `{error: 'not_found'}` (per AC-CG-Q5: never reveal existence).
  - `POST /projects/:id/unpublish`: owner-only; sets `visibility='private'`, `published_at=null`. Idempotent.
  - `POST /users/me/handle`: validates regex + reserved + uniqueness. Once set, cannot be changed (PATCH on existing handle returns 400 `{error: 'handle_immutable'}`).
  - `GET /handles/check?h=<string>`: returns `{available: bool, reason?: 'taken'|'reserved'|'invalid'}`. Idempotent. No DB transaction.
  - All four endpoints rate-limited: 60/min/user (publish/unpublish), 30/min/user (set handle), 60/min/user (check).
  - Handle race-loss: simultaneous first-publish from two users with same `handle` body — DB UNIQUE constraint catches one; route returns 400 `handle_taken` to the loser; no state corruption.
- **Estimated complexity:** Medium.

**Code shape:**

```ts
async function publish(input: {userId: string; projectId: string; handle?: string}) {
  return await db.transaction(async tx => {
    const project = await tx.select().from(projects).where(eq(projects.id, input.projectId))
    if (!project[0] || project[0].ownerId !== input.userId) throw new NotFoundError()
    if (project[0].visibility === 'public') return project[0] // idempotent
    if (input.handle) {
      validateHandle(input.handle) // throws InvalidHandle | ReservedHandle
      try {
        await tx.update(users).set({handle: input.handle}).where(eq(users.id, input.userId))
      } catch (err) {
        if (isUniqueViolation(err)) throw new HandleTakenError()
        throw err
      }
    } else {
      const user = await tx
        .select({handle: users.handle})
        .from(users)
        .where(eq(users.id, input.userId))
      if (!user[0]?.handle) throw new HandleRequiredError()
    }
    return await tx
      .update(projects)
      .set({visibility: 'public', publishedAt: new Date()})
      .where(eq(projects.id, input.projectId))
      .returning()[0]
  })
}
```

---

### Step 6: Library endpoints (`GET /library`, `GET /library/:id`)

- **Files to create**:
  - `services/api/src/routes/library.ts` — `GET /library?cursor&limit`, `GET /library/:id`.
  - `services/api/src/services/library.service.ts` — `list({cursor?, limit})`, `get(projectId)`.
- **Files to modify**:
  - `services/api/src/server.ts` — register routes.
- **Acceptance criteria**:
  - `GET /library`: returns `{items: [...], next_cursor: string|null}` of public projects. Default limit 20, max 50, min 1.
  - Cursor is base64-encoded `{published_at: string, project_id: uuid}`. `WHERE (published_at, id) < (cursor)` for stable pagination across ties.
  - Items shape: `{id, title, author_handle, published_at, render_hash, parent: {id, author_handle, title} | null}`. Excludes `spec_json`, `original_prompt`, `owner_id`, `email`.
  - Joins `users` for `author_handle`. Joins parent `projects + users` (LEFT JOIN, optional) for parent attribution.
  - `GET /library/:id`: returns `{project: {id, title, author_handle, published_at, original_prompt, parent: {...} | null}, current_version: {id, spec_json, render_hash, created_at}}`.
  - Returns 404 for non-existent OR private projects (don't leak existence).
  - 401 without JWT.
  - Rate limit 120/min/user (read-heavy).
  - Excluded from every response: raw email, `owner_id`, `service_role_key`.
- **Estimated complexity:** Medium.

**Code shape:**

```ts
// library.service.ts
export async function list({
  cursor,
  limit,
}: {
  cursor?: string
  limit: number
}): Promise<LibraryListResult> {
  const decoded = cursor ? decodeCursor(cursor) : null
  const rows = await db
    .select({
      id: projects.id,
      title: projects.title,
      author_handle: users.handle,
      published_at: projects.publishedAt,
      render_hash: projectVersions.renderHash,
      parent_id: parent.id,
      parent_handle: parentAuthor.handle,
      parent_title: parent.title,
    })
    .from(projects)
    .innerJoin(users, eq(projects.ownerId, users.id))
    .innerJoin(projectVersions, eq(projects.currentVersionId, projectVersions.id))
    .leftJoin(parent, eq(projects.parentProjectId, parent.id))
    .leftJoin(parentAuthor, eq(parent.ownerId, parentAuthor.id))
    .where(
      and(
        eq(projects.visibility, 'public'),
        decoded
          ? sql`(${projects.publishedAt}, ${projects.id}) < (${decoded.publishedAt}, ${decoded.projectId})`
          : undefined,
      ),
    )
    .orderBy(desc(projects.publishedAt), desc(projects.id))
    .limit(limit + 1)
  const hasMore = rows.length > limit
  return {
    items: rows.slice(0, limit).map(toLibraryItem),
    next_cursor: hasMore ? encodeCursor(rows[limit - 1]) : null,
  }
}
```

---

### Step 7: Route renames `/projects` → `/me/projects`; mobile API client update

- **Files to create**: none.
- **Files to modify**:
  - `services/api/src/routes/projects.ts` — rename `GET /projects` → `GET /me/projects`; rename `GET /projects/:id` → `GET /me/projects/:id`.
  - `apps/mobile/src/state/queries/projects.ts` — update query function paths.
  - `apps/mobile/src/state/queries/projects.test.ts` — update test mock paths.
- **Acceptance criteria**:
  - New paths return the same response shapes as the old paths.
  - Old paths return 404 (Fastify default for unregistered routes).
  - Mobile queries successfully fetch under new paths.
- **Estimated complexity:** Low.

---

### Step 8: Mobile Chat — two-stage SSE-driven loading state

- **Files to create**:
  - `apps/mobile/src/state/queries/generate.ts` — `useGenerateMutation()` that opens a fetch ReadableStream POST to `/generate`, parses SSE via `eventsource-parser`, exposes `phase: 'thinking' | 'building' | 'done' | 'error' | 'idle'` and `result?: {project, spec}`.
  - `apps/mobile/src/screens/Chat/components/RemixChip.tsx` — sticky pill above input, dismissible.
- **Files to modify**:
  - `apps/mobile/src/screens/Chat/index.tsx` — stub from ADR-0001; build out to spec.
  - `apps/mobile/src/screens/Chat/components/LoadingBubble.tsx` — copy by phase; 30s stall fallback.
- **Acceptance criteria**:
  - Sending a prompt opens an SSE stream; `phase` transitions on real server events.
  - Loading bubble copy: "Thinking about your idea…" while phase='thinking'; "Building your app…" while phase='building'; "Still working…" if no transition for 30s.
  - On `error` event, error bubble appears with message mapped from error code (per umbrella copy table extended in Sable's UX delta).
  - On `done`, navigates to AppRunner with the new project.
  - SSE connection drop > 30s of silence → toast "Connection lost. We saved your draft — check My apps" and pop to Home.
  - Live-region: announces "Thinking about your idea" once on phase=thinking entry, "Building your app" once on phase=building entry, "Your app is ready" on phase=done.
  - Remix chip: appears above input when navigation params include `parentProjectId` and `prefilledPrompt`. Dismissible (× clears params + chip). Carries `parent_project_id` into the next /generate call.
- **Estimated complexity:** High.

**Code shape:**

```ts
// useGenerateMutation
export function useGenerateMutation() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<GenerateResult | null>(null)
  const stallTimerRef = useRef<NodeJS.Timeout | null>(null)
  const generate = useCallback(async (input: {prompt: string; parentProjectId?: string}) => {
    setPhase('thinking')
    const res = await fetch(url, {method: 'POST', headers, body: JSON.stringify(input)})
    const parser = createParser(event => {
      if (event.type !== 'event' || event.data === '[DONE]') return
      const data = JSON.parse(event.data)
      if (data.type === 'thinking_started') {
        armStallTimer()
        setPhase('thinking')
      }
      if (data.type === 'building_started') {
        armStallTimer()
        setPhase('building')
      }
      if (data.type === 'done') {
        clearStallTimer()
        setPhase('done')
        setResult(data)
      }
      if (data.type === 'error') {
        clearStallTimer()
        setPhase('error')
        setError(data)
      }
    })
    // ... read loop, feed parser ...
  }, [])
  return {phase, result, generate}
}
```

---

### Step 9: Mobile AppRunner Owner-mode — top-bar Publish/Unpublish + bottom sheet

- **Files to create**:
  - `apps/mobile/src/screens/AppRunner/components/PublishSheet.tsx` — `@gorhom/bottom-sheet` content with first-time handle field + subsequent variant.
  - `apps/mobile/src/components/HandleField.tsx` — composite: `@` prefix + `TextInput` + inline validation indicator.
  - `apps/mobile/src/components/Pill.tsx` — atomic pill (Featured / Published / muted).
  - `apps/mobile/src/state/queries/marketplace.ts` — `usePublishMutation`, `useUnpublishMutation`, `useCheckHandleQuery`, `useSetHandleMutation`.
- **Files to modify**:
  - `apps/mobile/src/screens/AppRunner/index.tsx` — add Owner-mode top bar with Publish/Unpublish CTA; mount sheet on tap. (Try mode + Owner-public additions deferred to ADR-0003.)
  - `apps/mobile/package.json` — add `@gorhom/bottom-sheet`, `react-native-reanimated`, `react-native-gesture-handler`.
  - `ARCHITECTURE.md` §14 — add `@gorhom/bottom-sheet` to sanctioned mobile deps.
- **Acceptance criteria**:
  - Owner-mode AppRunner shows Publish CTA when `visibility='private'`, Unpublish CTA when `visibility='public'`.
  - Tap Publish → opens bottom sheet. First-time variant renders if `users.handle` is null; otherwise subsequent variant.
  - Handle field debounced availability check (500ms); inline indicator shows ✓ Available / ✗ Taken / ✗ Reserved / ✗ Invalid.
  - Pre-fill: server returns suggested handle from `GET /me/handle/suggest` (sanitized email local-part); client uses it as initial value.
  - Submit disabled until: regex passes + availability check returns Available + no in-flight check.
  - Submit success → sheet dismisses with toast "✓ Published to Library"; top-bar CTA swaps to Unpublish.
  - Race-loss on submit (server returns `handle_taken` despite client check): inline error in sheet, field re-focuses.
  - Tap Unpublish → iOS `ActionSheetIOS.showActionSheetWithOptions` with destructive-styled "Unpublish"; on confirm, `POST /unpublish`, top-bar CTA swaps to Publish.
- **Estimated complexity:** High.

---

### Step 10: Eval harness + CI integration

- **Files to create**:
  - `services/api/eval/run.ts` — loads `eval/prompts.json`, calls `generateAppSpec` directly per prompt, validates output, writes `eval/results/<timestamp>.json`. Exits 1 if pass rate < 80%.
  - `services/api/eval/prompts.json` — 30 prompts authored by Robert.
  - `services/api/eval/structuralAssertions.ts` — checks: ≥1 view, only catalog component types, all action targets resolve, depth ≤ 8, render_hash deterministic on re-canonicalization.
  - `.github/workflows/eval.yml` — runs `pnpm --filter @app-creator/api eval` on PRs touching `services/api/src/llm/` or `packages/a2ui-schema/`.
- **Files to modify**:
  - `services/api/package.json` — `eval` script already exists from ADR-0001 placeholder; verify it points at `tsx eval/run.ts`.
- **Acceptance criteria**:
  - Running `pnpm eval` against 30 prompts produces a JSON report.
  - Pass rate ≥ 80% on the Robert-authored prompt set.
  - Each result includes `thinking_duration_ms`, `generation_duration_ms`, `success: bool`, `error?: string`.
  - CI workflow runs on the trigger paths; fails on pass rate < 80%.
  - CI workflow caches `node_modules` to keep run time < 5 min.
  - Anthropic API key sourced from GitHub Actions secrets (not committed).
- **Estimated complexity:** Medium.

---

## Comprehensive Test Specification

### Test File Mapping

| Step | Test File                                                              | Env                               |
| ---- | ---------------------------------------------------------------------- | --------------------------------- |
| 1    | `services/api/src/db/schema.test.ts`                                   | testcontainers Postgres           |
| 1    | `services/api/migrations/0003_marketplace_columns.test.ts`             | testcontainers Postgres           |
| 2    | `services/api/migrations/0004_example_seeds.test.ts`                   | testcontainers Postgres           |
| 2    | `services/api/src/lib/reservedHandles.test.ts`                         | Jest unit                         |
| 3    | `services/api/src/llm/generate.test.ts`                                | Jest unit + Anthropic mock        |
| 3    | `services/api/src/llm/tools/produceAppSpec.test.ts`                    | Jest unit                         |
| 3    | `services/api/src/llm/anthropic.test.ts`                               | Jest unit                         |
| 4    | `services/api/src/routes/generate.test.ts`                             | Jest + supertest + Anthropic mock |
| 5    | `services/api/src/services/marketplace.service.test.ts`                | testcontainers Postgres           |
| 5    | `services/api/src/routes/marketplace.test.ts`                          | Jest + supertest                  |
| 6    | `services/api/src/services/library.service.test.ts`                    | testcontainers Postgres           |
| 6    | `services/api/src/routes/library.test.ts`                              | Jest + supertest                  |
| 7    | `services/api/src/routes/projects.test.ts` (existing — modified)       | Jest + supertest                  |
| 7    | `apps/mobile/src/state/queries/projects.test.ts` (existing — modified) | Jest                              |
| 8    | `apps/mobile/src/state/queries/generate.test.ts`                       | Jest + msw                        |
| 8    | `apps/mobile/src/screens/Chat/index.test.tsx`                          | jest-expo + RTL                   |
| 8    | `apps/mobile/src/screens/Chat/components/RemixChip.test.tsx`           | jest-expo + RTL                   |
| 8    | `apps/mobile/src/screens/Chat/components/LoadingBubble.test.tsx`       | jest-expo + RTL                   |
| 9    | `apps/mobile/src/screens/AppRunner/components/PublishSheet.test.tsx`   | jest-expo + RTL                   |
| 9    | `apps/mobile/src/components/HandleField.test.tsx`                      | jest-expo + RTL                   |
| 9    | `apps/mobile/src/state/queries/marketplace.test.ts`                    | Jest + msw                        |
| 10   | `services/api/eval/run.test.ts`                                        | Jest unit                         |
| 10   | `services/api/eval/structuralAssertions.test.ts`                       | Jest unit                         |

---

### Step 1 Tests — Schema additions

| ID         | Category   | Test Description                                                                                                                                                        |
| ---------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-0002-001 | Happy      | Migration 0003 runs cleanly on a fresh db; subsequent `\d users` shows `handle` column with UNIQUE constraint                                                           |
| T-0002-002 | Happy      | Migration 0003 runs cleanly against an ADR-0001-migrated db; existing rows get `visibility='private'`, `published_at=null`, `original_prompt=''`                        |
| T-0002-003 | Boundary   | Re-running migration 0003 is a no-op (idempotent)                                                                                                                       |
| T-0002-004 | Boundary   | `users.handle` allows null (existing rows preserved)                                                                                                                    |
| T-0002-005 | Boundary   | `users.handle` UNIQUE catches duplicate non-null inserts (raise unique_violation)                                                                                       |
| T-0002-006 | Security   | `projects.visibility` CHECK rejects `'unlisted'`, `'PUBLIC'`, `''`, `null` (the column is NOT NULL) — only `'private'` and `'public'` accepted                          |
| T-0002-007 | Happy      | Index `projects_library_idx` exists post-migration; `EXPLAIN` on `SELECT … WHERE visibility='public' ORDER BY published_at DESC LIMIT 20` uses the index                |
| T-0002-008 | Boundary   | `projects.original_prompt` accepts empty string (default) and 10000-char value                                                                                          |
| T-0002-009 | Regression | All ADR-0001 schema tests still pass (T-0001-001…T-0001-013)                                                                                                            |
| T-0002-010 | Negative   | `ALTER TABLE projects DROP COLUMN visibility` would break Step 6 — verified by attempting `INSERT INTO projects … visibility='public'` after migration; the row inserts |

#### Step 1 Test Summary

| Category   | Count |
| ---------- | ----- |
| Happy      | 3     |
| Boundary   | 3     |
| Security   | 1     |
| Regression | 1     |
| Negative   | 1     |
| **Total**  | **9** |

---

### Step 2 Tests — Seed migration + reserved handles

| ID         | Category   | Test Description                                                                                                                                             |
| ---------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T-0002-011 | Happy      | Migration 0004 inserts @example user with handle='example'                                                                                                   |
| T-0002-012 | Happy      | Migration 0004 inserts ≥5 seed projects with `visibility='public'`, `published_at='2020-01-01'`, owner_id=@example                                           |
| T-0002-013 | Happy      | Each seed project's spec_json passes `A2UISpecSchema.parse`                                                                                                  |
| T-0002-014 | Happy      | Each seed project's spec_json passes `deepValidateSpec` (depth ≤ 8, all action targets resolve, all view ids resolve)                                        |
| T-0002-015 | Boundary   | Re-running migration 0004 is idempotent (`ON CONFLICT DO NOTHING`)                                                                                           |
| T-0002-016 | Security   | @example user has email `'example@reserved.localhost'`; this email format is filtered from any Supabase admin signup flow (no real domain owns `.localhost`) |
| T-0002-017 | Security   | Signing in as @example via Supabase magic-link returns no JWT (the email is unroutable; no magic link arrives)                                               |
| T-0002-018 | Happy      | `RESERVED_HANDLES` includes: admin, system, official, support, app, creator, example                                                                         |
| T-0002-019 | Boundary   | `isReservedHandle('admin')` returns true; `isReservedHandle('Admin')` returns true (case-insensitive); `isReservedHandle('admin1')` returns false            |
| T-0002-020 | Negative   | `isReservedHandle('')` returns false (empty isn't reserved; it's invalid — caught upstream by regex)                                                         |
| T-0002-021 | Regression | Existing ADR-0001 migrations 0001 + 0002 still apply after 0003 + 0004                                                                                       |

#### Step 2 Test Summary

| Category   | Count  |
| ---------- | ------ |
| Happy      | 5      |
| Boundary   | 2      |
| Security   | 2      |
| Negative   | 1      |
| Regression | 1      |
| **Total**  | **11** |

---

### Step 3 Tests — Anthropic LLM module

| ID         | Category          | Test Description                                                                                                                                                        |
| ---------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-0002-022 | Config exhaustion | `ANTHROPIC_API_KEY` unset → module load throws `EnvMissingError`                                                                                                        |
| T-0002-023 | Config exhaustion | `ANTHROPIC_API_KEY=''` → throws `EnvMissingError`                                                                                                                       |
| T-0002-024 | Config exhaustion | `ANTHROPIC_API_KEY='   '` (whitespace only) → throws `EnvMissingError`                                                                                                  |
| T-0002-025 | Config exhaustion | `ANTHROPIC_API_KEY='sk-ant-...'` (valid format) → loads cleanly                                                                                                         |
| T-0002-026 | Config exhaustion | `ANTHROPIC_API_KEY='garbage'` (no format check at module load) → loads cleanly; first call returns Anthropic auth error                                                 |
| T-0002-027 | Happy             | `produceAppSpecTool.input_schema` snapshot matches `zodToJsonSchema(A2UISpecSchema)`                                                                                    |
| T-0002-028 | Happy             | `generateAppSpec` yields `thinking_started` synchronously (before first `await`)                                                                                        |
| T-0002-029 | Happy             | `generateAppSpec` yields `building_started` when mocked Anthropic stream emits `content_block_start` with type `tool_use`                                               |
| T-0002-030 | Happy             | `generateAppSpec` yields `done` with parsed spec from valid mocked tool input                                                                                           |
| T-0002-031 | Failure           | Mocked Anthropic emits malformed tool input (missing required field) → `generateAppSpec` throws `InvalidSpecError(code: 'invalid_spec', detail: <flat zod issues>)`     |
| T-0002-032 | Failure           | Mocked Anthropic emits no tool_use block → throws `InvalidSpecError('no_tool_use')`                                                                                     |
| T-0002-033 | Failure           | Mocked Anthropic 429 response → retries 2× with exponential backoff (1s, 2s), throws `RateLimitedError` if still 429                                                    |
| T-0002-034 | Failure           | Mocked Anthropic 500 response → throws `AnthropicTransportError` with `safeMessage(err)` (no SDK stack leakage)                                                         |
| T-0002-035 | Security          | Anthropic call payload includes `metadata.user_id = sha256(userId).slice(0,16)`, NOT raw userId                                                                         |
| T-0002-036 | Security          | Anthropic call payload's system block array has `cache_control: {type: 'ephemeral'}` on the catalog block, absent on the static block                                   |
| T-0002-037 | Security          | API key never appears in any logged output — `safeMessage(err)` strips the SDK error message that may include the key                                                   |
| T-0002-038 | Boundary          | Anthropic call has exactly `max_tokens: 8000`, `thinking.budget_tokens: 4000`, `tool_choice: {type: 'tool', name: 'produce_app_spec'}`                                  |
| T-0002-039 | Negative          | `generateAppSpec` MUST NOT yield two `building_started` events even if Anthropic stream emits multiple `tool_use` blocks (only first triggers; subsequent are silenced) |

#### Step 3 Test Summary

| Category          | Count  |
| ----------------- | ------ |
| Happy             | 4      |
| Failure           | 4      |
| Boundary          | 1      |
| Security          | 3      |
| Config exhaustion | 5      |
| Negative          | 1      |
| **Total**         | **18** |

---

### Step 4 Tests — SSE /generate route

| ID         | Category    | Test Description                                                                                                                                                                                           |
| ---------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-0002-040 | Happy       | POST `/generate` with valid prompt → SSE stream emits in order: `thinking_started`, `building_started`, `done`, then `[DONE]`                                                                              |
| T-0002-041 | Happy       | Successful generation persists project with `visibility='private'`, `original_prompt=<input.prompt>`, `parent_project_id=null` (no parent provided)                                                        |
| T-0002-042 | Happy       | `done` event payload includes `{project: {id, title, visibility, ...}, spec, render_hash, thinking_duration_ms, generation_duration_ms}`                                                                   |
| T-0002-043 | Happy       | A `messages` row is INSERTed with `role='user'`, `content=<input.prompt>`, `project_id=<new project id>` (umbrella memory carryover)                                                                       |
| T-0002-044 | Happy       | `parent_project_id` provided → server fetches parent's `original_prompt` and the new project links to parent via `parent_project_id` column                                                                |
| T-0002-045 | Failure     | Body without prompt → 400 `{error: 'invalid_input'}` (no SSE stream opened)                                                                                                                                |
| T-0002-046 | Failure     | Prompt > 2000 chars → 400 `{error: 'invalid_input'}`                                                                                                                                                       |
| T-0002-047 | Failure     | Total input (system + catalog + messages) > 12000 chars → 400 `{error: 'prompt_too_large'}`                                                                                                                |
| T-0002-048 | Failure     | Anthropic emits invalid tool input → SSE emits `error` event with `code='invalid_spec'`, then `[DONE]`. Project is NOT persisted (T-0002-049 verifies count)                                               |
| T-0002-049 | Negative    | After T-0002-048 fires, `SELECT COUNT(*) FROM projects WHERE owner_id=<user>` is unchanged from before the failed call                                                                                     |
| T-0002-050 | Failure     | Anthropic 429 (after retries) → SSE emits `error` event with `code='rate_limited'`; HTTP status header is 503                                                                                              |
| T-0002-051 | Failure     | Generic Anthropic transport error → SSE emits `error` event with `code='internal'`. Logged via `safeMessage(err)`; raw err message NOT in response or in INFO logs                                         |
| T-0002-052 | Boundary    | Empty prompt (1 char `' '` — whitespace) → 400 `invalid_input` (server-side trim + length check)                                                                                                           |
| T-0002-053 | Boundary    | Exactly 2000-char prompt → accepted                                                                                                                                                                        |
| T-0002-054 | Boundary    | Exactly 12000-char total input (1-char prompt + 11999 catalog) → rejected as `prompt_too_large` (boundary is exclusive) — verified at boundary -1 = accepted                                               |
| T-0002-055 | Concurrency | Client disconnects 1s into Anthropic call → server completes Anthropic call, persists project, logs `client_disconnect_during_generate`; project visible via `GET /me/projects`                            |
| T-0002-056 | Concurrency | Two simultaneous /generate calls from same user → both succeed independently (no shared state); both projects persist; rate-limit accounts both against the per-user bucket                                |
| T-0002-057 | Security    | SSE response NEVER contains thinking trace text (only the four event types) — verified by mocking Anthropic to emit a thinking block with text "this is a secret" and asserting it's not in the SSE output |
| T-0002-058 | Security    | SSE Content-Type is `text/event-stream`; `Cache-Control: no-cache`; `X-Accel-Buffering: no` — verified by inspecting response headers                                                                      |
| T-0002-059 | Security    | Auth-gated: 401 on missing JWT (no SSE opened)                                                                                                                                                             |
| T-0002-060 | Security    | `parent_project_id` referencing a private project NOT owned by the caller → 404 `{error: 'not_found'}` (don't leak existence). Same as private project's behavior elsewhere.                               |
| T-0002-061 | Security    | `parent_project_id` referencing a public project owned by anyone → accepted; new project links via `parent_project_id`                                                                                     |
| T-0002-062 | Security    | Rate-limited: 31st call within 60s by same user → 429; previous 30 still produce normal SSE responses                                                                                                      |
| T-0002-063 | Negative    | SSE response MUST NOT include the raw user prompt text in Anthropic-call telemetry (Langfuse handles that; our application logs do not duplicate)                                                          |
| T-0002-064 | Regression  | Pre-existing ADR-0001 routes (`/health`, `/auth/sync`) remain unaffected                                                                                                                                   |

#### Step 4 Test Summary

| Category    | Count  |
| ----------- | ------ |
| Happy       | 5      |
| Failure     | 5      |
| Boundary    | 3      |
| Concurrency | 2      |
| Security    | 6      |
| Negative    | 2      |
| Regression  | 1      |
| **Total**   | **24** |

---

### Step 5 Tests — Publish/Unpublish + Handle endpoints

| ID         | Category    | Test Description                                                                                                                                                                                                                                              |
| ---------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-0002-065 | Happy       | `POST /projects/:id/publish` with no `users.handle` set + body `{handle: 'alyona'}` → sets handle + flips visibility=public + sets published_at                                                                                                               |
| T-0002-066 | Happy       | `POST /projects/:id/publish` with `users.handle` already set + no body handle → flips visibility=public + sets published_at                                                                                                                                   |
| T-0002-067 | Happy       | Re-publish (project already public) → 200, no published_at update, no state change                                                                                                                                                                            |
| T-0002-068 | Happy       | `POST /projects/:id/unpublish` on public project → flips visibility=private + sets published_at=null                                                                                                                                                          |
| T-0002-069 | Happy       | Re-unpublish (project already private) → 200, no state change                                                                                                                                                                                                 |
| T-0002-070 | Failure     | Publish without handle when user has none → 400 `{error: 'handle_required'}`                                                                                                                                                                                  |
| T-0002-071 | Failure     | Publish with handle `'AB'` (2 chars) → 400 `{error: 'invalid_handle'}`                                                                                                                                                                                        |
| T-0002-072 | Failure     | Publish with handle `'a'.repeat(21)` (21 chars) → 400 `{error: 'invalid_handle'}`                                                                                                                                                                             |
| T-0002-073 | Failure     | Publish with handle `'has space'` → 400 `{error: 'invalid_handle'}`                                                                                                                                                                                           |
| T-0002-074 | Failure     | Publish with handle `'CAPS'` → 400 `{error: 'invalid_handle'}`                                                                                                                                                                                                |
| T-0002-075 | Failure     | Publish with handle `'-startswith-dash'` → 400 `{error: 'invalid_handle'}` (regex requires letter/digit start; we'll use `^[a-z0-9][a-z0-9-]{1,18}[a-z0-9]$` — Cal note: tightened from spec's plain `^[a-z0-9-]{3,20}$` to disallow leading/trailing dashes) |
| T-0002-076 | Failure     | Publish with reserved handle `'admin'` → 400 `{error: 'handle_reserved'}`                                                                                                                                                                                     |
| T-0002-077 | Failure     | Publish with reserved handle `'Admin'` (case mixed) → 400 `{error: 'handle_reserved'}`                                                                                                                                                                        |
| T-0002-078 | Failure     | Publish with handle `'example'` → 400 `{error: 'handle_reserved'}` (the @example seed user owns it)                                                                                                                                                           |
| T-0002-079 | Failure     | Publish with handle already taken by another user → 400 `{error: 'handle_taken'}`                                                                                                                                                                             |
| T-0002-080 | Failure     | Publish someone else's project → 404 `{error: 'not_found'}` (don't reveal existence)                                                                                                                                                                          |
| T-0002-081 | Failure     | Publish a project that doesn't exist → 404 `{error: 'not_found'}`                                                                                                                                                                                             |
| T-0002-082 | Boundary    | Handle exactly 3 chars `'abc'` → accepted                                                                                                                                                                                                                     |
| T-0002-083 | Boundary    | Handle exactly 20 chars → accepted                                                                                                                                                                                                                            |
| T-0002-084 | Boundary    | Handle with internal dashes `'al-yo-na'` → accepted                                                                                                                                                                                                           |
| T-0002-085 | Concurrency | Two simultaneous first-publish requests from different users with same handle body → first commits, second receives 400 `handle_taken`; both projects' visibility state is consistent (only the winner is public)                                             |
| T-0002-086 | Concurrency | Two simultaneous publish requests from same user on same project → both return 200; published_at is set once                                                                                                                                                  |
| T-0002-087 | Concurrency | Publish then immediately unpublish (race) → final state is consistent (last-write-wins on visibility); published_at is null after unpublish                                                                                                                   |
| T-0002-088 | Security    | `users.handle` UPDATE is atomic in the publish transaction (no half-state where handle is set but visibility didn't flip)                                                                                                                                     |
| T-0002-089 | Security    | `POST /users/me/handle` on a user that already has a handle → 400 `{error: 'handle_immutable'}`                                                                                                                                                               |
| T-0002-090 | Security    | `POST /users/me/handle` is auth-gated; 401 without JWT                                                                                                                                                                                                        |
| T-0002-091 | Happy       | `GET /handles/check?h=alyona` (available) → 200 `{available: true}`                                                                                                                                                                                           |
| T-0002-092 | Happy       | `GET /handles/check?h=alyona` (taken) → 200 `{available: false, reason: 'taken'}`                                                                                                                                                                             |
| T-0002-093 | Happy       | `GET /handles/check?h=admin` (reserved) → 200 `{available: false, reason: 'reserved'}`                                                                                                                                                                        |
| T-0002-094 | Happy       | `GET /handles/check?h=AB` (invalid) → 200 `{available: false, reason: 'invalid'}`                                                                                                                                                                             |
| T-0002-095 | Boundary    | `GET /handles/check?h=` (empty) → 400 `{error: 'invalid_input'}` (querystring required)                                                                                                                                                                       |
| T-0002-096 | Negative    | Publish endpoint MUST NOT return raw email in the response body — verified by inspecting the JSON response                                                                                                                                                    |
| T-0002-097 | Negative    | Publish endpoint MUST NOT return `original_prompt` in the response body (it's stored, not returned on this endpoint)                                                                                                                                          |
| T-0002-098 | Regression  | ADR-0001 `/auth/sync` upsert still works (creates a `users` row with handle=null, default values for new columns)                                                                                                                                             |

#### Step 5 Test Summary

| Category    | Count  |
| ----------- | ------ |
| Happy       | 9      |
| Failure     | 12     |
| Boundary    | 4      |
| Concurrency | 3      |
| Security    | 4      |
| Negative    | 2      |
| Regression  | 1      |
| **Total**   | **35** |

---

### Step 6 Tests — Library endpoints

| ID         | Category    | Test Description                                                                                                                                             |
| ---------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T-0002-099 | Happy       | `GET /library` returns seed projects + any published maker projects, ordered by `published_at DESC`                                                          |
| T-0002-100 | Happy       | `GET /library` items include `author_handle` (from join), exclude `spec_json`, exclude raw email, exclude `owner_id`                                         |
| T-0002-101 | Happy       | `GET /library?limit=5` returns ≤5 items + `next_cursor`                                                                                                      |
| T-0002-102 | Happy       | Following the `next_cursor` returns the next page; cursor-based pagination is stable across publish/unpublish events between pages                           |
| T-0002-103 | Happy       | `GET /library/:id` returns project + current_version + author handle + parent (if remixed)                                                                   |
| T-0002-104 | Happy       | Project with `parent_project_id` set returns `parent: {id, author_handle, title}` populated                                                                  |
| T-0002-105 | Happy       | Project without `parent_project_id` returns `parent: null`                                                                                                   |
| T-0002-106 | Failure     | `GET /library/:id` for a private project → 404 `{error: 'not_found'}` (don't leak existence)                                                                 |
| T-0002-107 | Failure     | `GET /library/:id` for a non-existent project → 404                                                                                                          |
| T-0002-108 | Failure     | `GET /library?limit=51` → 400 `{error: 'invalid_input'}` (max 50)                                                                                            |
| T-0002-109 | Failure     | `GET /library?limit=0` → 400 `{error: 'invalid_input'}` (min 1)                                                                                              |
| T-0002-110 | Failure     | `GET /library?cursor=garbage` → 400 `{error: 'invalid_input'}` (cursor doesn't decode)                                                                       |
| T-0002-111 | Boundary    | `GET /library` empty (no public projects, seeds were deleted) → 200 `{items: [], next_cursor: null}`                                                         |
| T-0002-112 | Boundary    | `GET /library` with exactly `limit` items → `next_cursor: null` (no more)                                                                                    |
| T-0002-113 | Boundary    | `GET /library` with `limit + 1` items → first `limit` returned, `next_cursor` set                                                                            |
| T-0002-114 | Concurrency | Project unpublished between page 1 and page 2 fetch → cursor's `WHERE (published_at, id) <` clause excludes the unpublished project; user sees a stable feed |
| T-0002-115 | Concurrency | New publish during pagination → does NOT appear retroactively in already-fetched pages (stable cursor semantics)                                             |
| T-0002-116 | Security    | `GET /library` MUST NOT return private projects — verified by creating a private project and checking it's absent                                            |
| T-0002-117 | Security    | `GET /library` MUST NOT return `spec_json` — verified by checking response body schema                                                                       |
| T-0002-118 | Security    | `GET /library` MUST NOT return raw email — verified by absence of `email` field in any item                                                                  |
| T-0002-119 | Security    | `GET /library/:id` MUST NOT return server prompt content or thinking trace — verified by absence of those fields                                             |
| T-0002-120 | Security    | `GET /library/:id` for a private project owned by the caller → still 404 (the endpoint serves PUBLIC; owners use `GET /me/projects/:id`)                     |
| T-0002-121 | Security    | Auth-gated: 401 on missing JWT                                                                                                                               |
| T-0002-122 | Negative    | `GET /library` MUST NOT include `original_prompt` in items — only the detail endpoint surfaces the prompt                                                    |
| T-0002-123 | Regression  | `EXPLAIN` on the library list query uses `projects_library_idx` (the partial index)                                                                          |

#### Step 6 Test Summary

| Category    | Count  |
| ----------- | ------ |
| Happy       | 7      |
| Failure     | 5      |
| Boundary    | 3      |
| Concurrency | 2      |
| Security    | 6      |
| Negative    | 1      |
| Regression  | 1      |
| **Total**   | **25** |

---

### Step 7 Tests — Route renames

| ID         | Category   | Test Description                                                                        |
| ---------- | ---------- | --------------------------------------------------------------------------------------- |
| T-0002-124 | Happy      | `GET /me/projects` returns the same shape as the umbrella's `GET /projects` did         |
| T-0002-125 | Happy      | `GET /me/projects/:id` returns the same shape as the umbrella's `GET /projects/:id` did |
| T-0002-126 | Breaking   | `GET /projects` returns 404 (no longer registered)                                      |
| T-0002-127 | Breaking   | `GET /projects/:id` returns 404 (no longer registered)                                  |
| T-0002-128 | Regression | All ADR-0001 tests targeting `/projects/*` are updated to `/me/projects/*` and pass     |
| T-0002-129 | Happy      | Mobile `useProjectsListQuery` calls the new path                                        |
| T-0002-130 | Happy      | Mobile `useProjectQuery` calls the new path                                             |

#### Step 7 Test Summary

| Category   | Count |
| ---------- | ----- |
| Happy      | 4     |
| Breaking   | 2     |
| Regression | 1     |
| **Total**  | **7** |

---

### Step 8 Tests — Mobile Chat with two-stage SSE loading

| ID         | Category    | Test Description                                                                                                                                                                                                  |
| ---------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-0002-131 | Happy       | `useGenerateMutation()` sets `phase: 'thinking'` synchronously on `generate()` invocation                                                                                                                         |
| T-0002-132 | Happy       | On SSE `building_started` event, `phase` transitions to `'building'`                                                                                                                                              |
| T-0002-133 | Happy       | On SSE `done` event, `phase: 'done'`, `result` populated                                                                                                                                                          |
| T-0002-134 | Happy       | Loading bubble copy: `phase='thinking'` → "Thinking about your idea…"                                                                                                                                             |
| T-0002-135 | Happy       | Loading bubble copy: `phase='building'` → "Building your app…"                                                                                                                                                    |
| T-0002-136 | Happy       | Stall: 30s without phase transition → copy becomes "Still working…"                                                                                                                                               |
| T-0002-137 | Happy       | Stall timer clears on phase transition (no spurious "Still working…" once moved on)                                                                                                                               |
| T-0002-138 | Happy       | On `done`, navigation pushes AppRunner with project id                                                                                                                                                            |
| T-0002-139 | Failure     | SSE `error` event with `code='invalid_spec'` → error bubble shows "Hmm, I couldn't turn that into an app. Try a different idea."                                                                                  |
| T-0002-140 | Failure     | SSE `error` event with `code='rate_limited'` → error bubble shows "We're a bit busy right now. Try again in a minute."                                                                                            |
| T-0002-141 | Failure     | SSE silence > 30s after no events → toast "Connection lost. We saved your draft — check My apps" + pop to Home                                                                                                    |
| T-0002-142 | Boundary    | RemixChip: appears when route has `parentProjectId` and `prefilledPrompt` params                                                                                                                                  |
| T-0002-143 | Boundary    | RemixChip: dismissed via × → params cleared, chip removed, parent_project_id NOT included in next /generate                                                                                                       |
| T-0002-144 | Security    | `useGenerateMutation` sends Authorization header with current session JWT                                                                                                                                         |
| T-0002-145 | Negative    | Loading bubble MUST NOT cycle through three messages on a client timer (no fake-progress fiction) — verified by mocking SSE silence and asserting copy stays on phase-1 message until server emits the next event |
| T-0002-146 | Concurrency | Calling `generate()` while previous call is in-flight → second call rejected (`{error: 'in_flight'}`); UI shows the existing generation                                                                           |
| T-0002-147 | Regression  | Existing Chat ADR-0001 stub behavior superseded; back arrow during loading still triggers the umbrella's confirmation alert                                                                                       |

#### Step 8 Test Summary

| Category    | Count  |
| ----------- | ------ |
| Happy       | 8      |
| Failure     | 3      |
| Boundary    | 2      |
| Security    | 1      |
| Concurrency | 1      |
| Negative    | 1      |
| Regression  | 1      |
| **Total**   | **17** |

---

### Step 9 Tests — Mobile AppRunner Owner-mode + PublishSheet

| ID         | Category    | Test Description                                                                                                     |
| ---------- | ----------- | -------------------------------------------------------------------------------------------------------------------- |
| T-0002-148 | Happy       | AppRunner Owner-mode shows Publish CTA when `visibility='private'`                                                   |
| T-0002-149 | Happy       | AppRunner Owner-mode shows Unpublish CTA when `visibility='public'`                                                  |
| T-0002-150 | Happy       | Tap Publish → bottom sheet opens; first-time variant renders if `users.handle` is null                               |
| T-0002-151 | Happy       | First-time sheet pre-fills handle field from `GET /me/handle/suggest` response                                       |
| T-0002-152 | Happy       | Subsequent variant: handle already set, sheet renders without field, copy reads "You'll publish as @{handle}."       |
| T-0002-153 | Happy       | Handle field debounced 500ms; check fires once per stable input                                                      |
| T-0002-154 | Happy       | Inline indicator: ✓ Available / ✗ Taken / ✗ Reserved / ✗ Invalid                                                     |
| T-0002-155 | Happy       | Submit publishes; sheet dismisses; toast "✓ Published to Library"; top-bar swaps to Unpublish                        |
| T-0002-156 | Failure     | Network error during publish → inline error in sheet, sheet stays open                                               |
| T-0002-157 | Failure     | Race-loss `handle_taken` from server → inline error, field re-focuses                                                |
| T-0002-158 | Failure     | Submit disabled until: regex passes + check returns Available + no in-flight check                                   |
| T-0002-159 | Boundary    | iPhone SE: sheet content does not cover the keyboard when handle field focused                                       |
| T-0002-160 | Concurrency | Publish in flight, user taps back → confirmation alert (carries from umbrella's cancel-during pattern)               |
| T-0002-161 | Security    | Sheet's a11y: `accessibilityViewIsModal: true`, focus trapped inside                                                 |
| T-0002-162 | Security    | Handle field a11y: `accessibilityHint` describes immutability                                                        |
| T-0002-163 | Negative    | Sheet MUST NOT pre-fill the handle field on subsequent (non-first) publishes — only first-time variant has the field |
| T-0002-164 | Regression  | Owner-mode AppRunner top bar still has the back arrow with umbrella's "Back to library" a11y label                   |

#### Step 9 Test Summary

| Category    | Count  |
| ----------- | ------ |
| Happy       | 8      |
| Failure     | 3      |
| Boundary    | 1      |
| Concurrency | 1      |
| Security    | 2      |
| Negative    | 1      |
| Regression  | 1      |
| **Total**   | **17** |

---

### Step 10 Tests — Eval harness + CI

| ID         | Category    | Test Description                                                                                                                                |
| ---------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| T-0002-165 | Happy       | Running `pnpm eval` against 30 prompts produces a valid JSON report with 30 entries                                                             |
| T-0002-166 | Happy       | Each report entry contains `{prompt, success, thinking_duration_ms, generation_duration_ms, error?}`                                            |
| T-0002-167 | Happy       | Pass rate ≥ 80% on the Robert-authored prompt set                                                                                               |
| T-0002-168 | Happy       | Structural assertions verify: ≥1 view, only catalog component types, action targets resolve, depth ≤ 8, render_hash matches re-canonicalization |
| T-0002-169 | Failure     | If pass rate < 80%, harness exits 1                                                                                                             |
| T-0002-170 | Boundary    | Empty prompts.json → harness exits 1 with `{error: 'no_prompts'}`                                                                               |
| T-0002-171 | Concurrency | Harness runs prompts sequentially (not in parallel — Anthropic per-key rate limit risk; ~2 minutes wall-clock for 30 prompts)                   |
| T-0002-172 | Security    | Harness output JSON does NOT include the user's API key, raw thinking trace, or any prompt content under a key starting with `internal_`        |
| T-0002-173 | Regression  | CI workflow runs on PRs touching `services/api/src/llm/` or `packages/a2ui-schema/`; runs after typecheck + unit tests pass                     |

#### Step 10 Test Summary

| Category    | Count |
| ----------- | ----- |
| Happy       | 4     |
| Failure     | 1     |
| Boundary    | 1     |
| Concurrency | 1     |
| Security    | 1     |
| Regression  | 1     |
| **Total**   | **9** |

---

### Test Totals

| Step       | New     | Regression | Total   |
| ---------- | ------- | ---------- | ------- |
| 1          | 8       | 1          | 9       |
| 2          | 10      | 1          | 11      |
| 3          | 18      | 0          | 18      |
| 4          | 23      | 1          | 24      |
| 5          | 34      | 1          | 35      |
| 6          | 24      | 1          | 25      |
| 7          | 6       | 1          | 7       |
| 8          | 16      | 1          | 17      |
| 9          | 16      | 1          | 17      |
| 10         | 8       | 1          | 9       |
| **Totals** | **163** | **9**      | **172** |

### Test Helpers & Mocks

- **Anthropic streaming mock** — a fixture-based `AnthropicMockStream` that yields a configurable sequence of `MessageStreamEvent`s. Used by Step 3 + Step 4 tests. Lives in `services/api/test/mocks/anthropic.ts`.
- **Testcontainers Postgres** — already established in ADR-0001. Migration suite runs on each test container; truncate-between-tests pattern carries.
- **MSW (Mobile Service Worker)** for mobile API mocking — needs adding to `apps/mobile/devDependencies`. Steps 8 + 9 use it.
- **`@testing-library/react-native`** — already in `apps/mobile/devDependencies`. Carries from ADR-0001.
- **Eventsource-parser test harness** — reuses the production `eventsource-parser` to feed mocked SSE streams into `useGenerateMutation`. Step 8.

### Coverage Gates

- Backend: ≥85% line coverage on `services/api/src/llm/`, `services/api/src/routes/generate.ts`, `services/api/src/services/marketplace.service.ts`, `services/api/src/services/library.service.ts`.
- Mobile: ≥80% on `apps/mobile/src/state/queries/generate.ts`, `apps/mobile/src/state/queries/marketplace.ts`, `apps/mobile/src/screens/Chat/`, `apps/mobile/src/screens/AppRunner/components/PublishSheet.tsx`.
- The eval harness's JSON report is itself a coverage signal — every prompt is a test case.

---

## UX Requirements

Sable's `docs/ux/chat-creation-ux.md` is the source of truth. Implementation aligned with:

- **Two-stage loading state** (Sable's "Screen 3: Chat — what changes — A. Two-stage loading"): SSE-driven, copy "Thinking about your idea…" → "Building your app…", 30s stall fallback "Still working…", reduced motion = crossfade.
- **Remix chip** (Sable's "Screen 3: Chat — what changes — B. Remix attribution chip"): pill above input, dismissible, slide-in animation.
- **Publish bottom-sheet** (Sable's "Screen 5: Publish bottom-sheet"): first-time variant with handle field, subsequent variant without. iOS modal with focus trap.
- **AppRunner Owner-mode CTAs** (Sable's "Screen 4: AppRunner — Mode A / Mode B"): top-bar Publish (private) or Unpublish (public, destructive-styled).

ADR-0003 will own: two-tab Home, three AppRunner modes (Try mode), Library tile, FAB, Featured pill, Published pill on My apps tile, Remix flow entry from Try mode.

---

## Data Sensitivity

| Store Method                                               | Returns                                                                                                                                                  | Sensitivity                                     | Excludes                                                                                                |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `projectsService.create`                                   | `{project, currentVersion}` (incl. `original_prompt`)                                                                                                    | auth-only                                       | —                                                                                                       |
| `projectsService.list` (renamed: `myProjectsService.list`) | `ProjectListItem[]` (no spec_json)                                                                                                                       | auth-only — owner-scoped                        | `spec_json`, `email`, `owner_id`                                                                        |
| `projectsService.get`                                      | `{project, currentVersion}` (full incl. `original_prompt`)                                                                                               | auth-only — owner-only                          | `email` of owner (never returned)                                                                       |
| `marketplaceService.publish`                               | `{project: {id, visibility, published_at, ...}}`                                                                                                         | auth-only                                       | `email`, `original_prompt` (in response) — only DB-side stored                                          |
| `marketplaceService.unpublish`                             | `{project: {id, visibility, published_at: null}}`                                                                                                        | auth-only                                       | `email`, `original_prompt`                                                                              |
| `marketplaceService.setHandle`                             | `{user: {id, handle}}`                                                                                                                                   | auth-only — self-only                           | `email`, `created_at`                                                                                   |
| `marketplaceService.checkHandle`                           | `{available, reason?}`                                                                                                                                   | public-safe                                     | nothing leaked — handle isn't sensitive, response doesn't include the queried handle in error responses |
| `libraryService.list`                                      | `{items: [{id, title, author_handle, published_at, render_hash, parent: {...} \| null}], next_cursor}`                                                   | public-safe (auth still required for the route) | `spec_json`, `email`, `owner_id`, `original_prompt`                                                     |
| `libraryService.get`                                       | `{project: {id, title, author_handle, published_at, original_prompt, parent: {...} \| null}, current_version: {id, spec_json, render_hash, created_at}}` | public-safe (read-only of public projects)      | `email`, `owner_id`, thinking trace                                                                     |

**Sensitivity discipline:** every method's TypeScript return type explicitly omits sensitive fields (per the umbrella `normalizeRow` retro-lesson). The `libraryService.list` and `libraryService.get` results have a different return shape from the owner-scoped reads — there is no shared "ProjectRow" type that could accidentally leak owner-only fields into a public response. T-0002-100, T-0002-117, T-0002-119 verify.

---

## CI/CD Impact

| Job                 | Config File                           | Impact                                                                                                        | Required Change                                                                                           |
| ------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `typecheck`         | `.github/workflows/ci.yml` (existing) | Picks up new files automatically                                                                              | None                                                                                                      |
| `unit-tests`        | `.github/workflows/ci.yml` (existing) | New tests run automatically                                                                                   | None                                                                                                      |
| `eval`              | `.github/workflows/eval.yml` (NEW)    | Runs `pnpm --filter @app-creator/api eval` on PRs touching `services/api/src/llm/` or `packages/a2ui-schema/` | Create the workflow file. Configure `ANTHROPIC_API_KEY` as a GitHub Actions secret. Cache `node_modules`. |
| `db-migration-test` | `.github/workflows/ci.yml` (existing) | Runs new migrations 0003 + 0004 in testcontainers                                                             | None — testcontainers spin-up handled                                                                     |

**Eval workflow shape:**

```yaml
# .github/workflows/eval.yml
name: eval
on:
  pull_request:
    paths:
      - 'services/api/src/llm/**'
      - 'packages/a2ui-schema/**'
jobs:
  eval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: {node-version: 20, cache: pnpm}
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @app-creator/api eval
        env:
          ANTHROPIC_API_KEY: ${{secrets.ANTHROPIC_API_KEY}}
```

**Cost note:** ~30 prompts × ~$0.05/prompt = ~$1.50 per eval run. Triggered only on relevant-paths PRs; safe for monthly budget.

---

## Documentation Impact

| Doc                               | Path                      | What Changes                                                                                                                                                                                                                                              |
| --------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ARCHITECTURE.md`                 | repo root                 | §14 — add `@gorhom/bottom-sheet` to mobile sanctioned deps. §17 — add D9 (in-memory rate limiter — already noted in ADR-0001), D10 (`@example` user is local-mirror only, Supabase auth.users does not have a corresponding row; documented compat note). |
| `CLAUDE.md`                       | repo root                 | §3 — extend SSE example to show the phase-event pattern (`thinking_started`/`building_started`/`done`). §4 — note that `tool_choice` plus `thinking` are paired on `/generate`.                                                                           |
| `.claude/references/adr-index.md` | (Ellis updates on commit) | Add ADR-0002 row with tags `llm, supabase, mobile-shell, infra, tests`.                                                                                                                                                                                   |
| `docs/product/chat-creation.md`   | docs/product/             | After ADR-0002 lands, mark Open Question #1 (ADR sequencing) as resolved with "Split — see ADR-0002 + ADR-0003."                                                                                                                                          |

---

## Notes for Colby

The high-leverage tactical reads:

1. **Anthropic streaming + thinking + tool use simultaneously is novel.** Verify with a single manual smoke test before wiring the SSE wrapper. Use the SDK's `messages.stream()` async iterator. Watch for `content_block_start` events with `content_block.type === 'tool_use'` — that's the phase-2 trigger. The first `content_block_start` of type `thinking` is informational; we already emit `thinking_started` synchronously on request acceptance, so don't gate on it.
2. **`stream.finalMessage()` waits for the full response** and is your easiest path to the validated tool input. Read events for the phase emit, then `await stream.finalMessage()` for the buildable spec.
3. **SSE close on the Fastify side**: `reply.raw.write(...)` for events, `reply.raw.end()` to close. Don't `return` from the handler before `end()`; Fastify will close the stream prematurely.
4. **Client disconnect detection**: don't bother. Let the Anthropic call complete; persist the project. The umbrella's "cancel-during" pattern carries.
5. **The `messages` table** still gets the user prompt as a row (umbrella memory carryover). One INSERT per `/generate` success. This is independent of the `projects.original_prompt` denormalization — both happen.
6. **`@gorhom/bottom-sheet` requires Reanimated 3 + Gesture Handler 2** — both should be transitive deps from React Navigation. Verify on a fresh `pnpm install` that the iOS build still succeeds. If not, escalate; we may need to surface the deps as direct.
7. **iOS dev-client rebuild required** for new native deps (`@gorhom/bottom-sheet` pulls in native code via Reanimated). Run `eas build --profile development` after Step 9 lands; the user has already rebuilt their dev-client today (per session context), so this is one more rebuild, not a setup-from-scratch.
8. **Handle regex** is `^[a-z0-9][a-z0-9-]{1,18}[a-z0-9]$` (tightened from spec's plain `^[a-z0-9-]{3,20}$` to disallow leading/trailing dashes). Document in the field's helper text: "3–20 chars · letters, numbers, dashes · can't start or end with a dash."
9. **DB-level UNIQUE constraint** on `users.handle` is the source of truth for race wins. App-level "is it available?" checks are advisory; the publish endpoint must catch `unique_violation` and translate to `handle_taken` regardless of what the check said milliseconds earlier.
10. **Cursor encoding**: `base64url(JSON.stringify({published_at: '<ISO>', project_id: '<uuid>'}))`. Decode + validate format strictly; reject any cursor that doesn't decode to that exact shape with a 400.
11. **`messages` insert in /generate route**: do this after the project is persisted, in the same transaction (the projectsService.create already opens a transaction — add the messages insert inside it).
12. **`useGenerateMutation` connection management**: hold the `AbortController` so navigation-away can abort the fetch. The server-side request continues regardless (per §O); client just stops listening.
13. **Stall timer**: use `setTimeout` with 30000ms, reset on every received SSE event (any type). Use `useRef` for the timer handle; clear on unmount.
14. **Test seed specs**: when authoring the 5–10 seed projects, keep them simple. Use only Heading + Text + Button (with a no-op `toast` action). The renderer in 0002 doesn't render anything else, but the seeds need to be A2UISpecSchema-valid for ADR-0003. Don't over-engineer the seeds — they're tutorials.
15. **Migration ordering**: 0003 (columns) then 0004 (seeds). The seeds migration depends on the `visibility` column existing.
16. **Don't accidentally include `email` in any JSON response.** This is the umbrella's normalizeRow lesson again. Every endpoint's response shape is explicitly listed in §"API Contracts" of `docs/product/chat-creation.md` and §"Data Sensitivity" of this ADR. Verify each endpoint's response with a test that asserts the JSON doesn't have `email`.

---

## Sketch for ADR-0003 (deferred — drafted post-0002 ship)

For Sable and Robert: this is an architectural sketch, not a binding plan. The full ADR gets drafted after 0002 ships and we know what we learned.

**Scope:**

- Full A2UI renderer: 10 components, all 4 actions, snapshot-tested per props matrix
- AppRunner three modes (Owner-private, Owner-public, Try with banner + FAB)
- Two-tab Home (Library + My apps) with segmented control + tab persistence
- Library tile component (4 variants per Sable's spec)
- Library tab queries `useLibraryInfiniteQuery` (cursor pagination — endpoint already shipped in 0002)
- Remix flow: Try-mode FAB tap → Chat with chip pre-attached
- Auto-tab-switch after generation (via navigation parameter)
- Render-error fallback (P0 instrumentation)
- TestFlight build + submit (umbrella ADR-0001 had this for Phase 3, now a real shipping milestone)
- Cancel-mid-generation: Phase 2 stands per Robert's open-question call.

**Estimated complexity:** 5–6 days dev. Roughly even split between renderer (2–3 days) and the marketplace UX (2–3 days).

**Open questions to revisit before drafting:**

- Will the eval harness in 0002 surface any prompt-engineering needs that affect renderer (e.g., catalog gaps)?
- Do internal testers respond positively to the publish flow? If publish-rate is low, redesign the post-generation prompt before adding browse on top.
- Did `@gorhom/bottom-sheet` integration go cleanly? If not, swap for ADR-0003's other modal needs.

---

> ✅ ADR saved. **10 steps, 172 total tests** (163 new + 9 regression).
>
> **Next:** Roz reviews the test spec.

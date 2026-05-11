# ADR-0007: LLM Generation Pipeline Cutover to V0

_Authored by Cal — 2026-05-07_

## Status

Proposed

## Context

ADR-0005 (protocol + design system) and ADR-0006 (renderer) shipped. The
mobile renderer is V0-only. `src/legacy/` is deleted. 1632 tests pass.
**The chat-to-app path is broken** because three server-side layers still
emit M1 specs that the V0 renderer rejects:

1. **Planner system prompt** (`services/api/src/llm/prompts/planner.ts`) —
   describes the M1 10-component catalog. Contains a stale comment "Until
   ADR-0005 ships, navigation is realized via Button + navigate action"
   (ADR-0005 shipped at `51de20a`).

2. **Builder system prompt** (`services/api/src/llm/prompts/system.ts`) —
   instructs the LLM: "Use only the 10 catalog components: Heading, Text,
   Image, Button, TextInput, Toggle, Counter, List, Form, Container."
   Lines 117–179 contain two example specs emitting `Container` / `Counter`
   / `Toggle` — pure M1 shapes.

3. **Builder tool** (`services/api/src/llm/generate.ts:1`):

   ```ts
   import {A2UISpecSchema, type A2UISpec, type Plan} from '@app-creator/a2ui-schema'
   ```

   That's M1 schema. `tools/produceAppSpec.ts` feeds `A2UISpecSchema` as the
   tool's JSON Schema; `tool_choice` forces the LLM to emit M1 shape on
   every call.

The render-time behavior is now: V0 `<Renderer>` mounts an M1 spec →
`SpecSchema.parse()` throws → `<RenderErrorBoundary>` catches → user sees
the generic error fallback. The user-facing flow is dead until ADR-0007
ships.

Canvas V0 brief §0 (Sponsor signed 2026-05-07) and `docs/product/canvas-v0.md`
§0 lock the supersession path:

- **Single-call Sonnet pipeline** (§2.3) — collapses ADR-0004's two-stage
  Plan → Build pipeline.
- **No `/edit` route** (§1.4) — re-prompt-to-edit goes through `/generate`.
- **28-component catalog, 12 action verbs, 4 archetypes** — `@app-creator/protocol`
  is the schema source of truth.
- **Out-of-scope prompt capture** (§1.5, §AC-O) — a closed-enum capability
  taxonomy (`image_gen, vision, chat, transcription, classification`)
  with email-capture UX.
- **Telemetry whitelist + eval-mode short-circuit carry forward** —
  ADR-0004 Step 8/9 plumbing keeps working under new event types.

ADR-0006 closure left a paperwork item: amend `.claude/references/adr-index.md`
and ADR-0004's status to Superseded. ADR-0007 does that.

### What if we do nothing

Public launch ships with the chat-to-app path broken. Every "Create" tap
hits the error boundary. The renderer demonstrates correctly via the
DevDemoPicker (`__DEV__` only) but real users can't generate. Out-of-scope
detection — load-bearing for V0.5 prioritization — doesn't exist. Eval
harness measures M1 quality on a 8-archetype taxonomy that no longer matches
production. **Public launch is impossible.**

### Prior art reviewed

- **ADR-0004** — two-stage Plan → Build pipeline. The pipeline orchestrator
  (`pipeline.ts`), planner (`planner.ts`, `prompts/planner.ts`,
  `tools/producePlan.ts`), and edit route (`routes/edit.ts`,
  `tools/produceAppSpecPatch.ts`) all get deleted here. Telemetry
  whitelist (Step 8) and eval-mode short-circuit (Step 9) carry forward
  with updated event types.
- **ADR-0005** — `@app-creator/protocol` is the V0 schema source. Generated
  JSON Schema is the LLM tool's `input_schema`. `validateCrossRefs` runs
  after `SpecSchema.parse`.
- **ADR-0006** — renderer accepts `Spec` from protocol. AppRunner mounts
  hardcoded SAMPLE_SPEC today (ADR-0007 deferral). Step 7 of this ADR
  removes that fallback in favor of real generated specs.
- **`.claude/references/retro-lessons.md`** — `normalizeRow` lesson governs
  the new `out_of_scope_intent` table's column visibility. Server-side
  validation error messages MUST NOT echo LLM-emitted strings to clients
  (Data Sensitivity note in `packages/protocol/src/validate.ts`).

### Constraints

These shape every decision below:

1. **Forced `tool_choice` exception** (CLAUDE.md §3, ARCHITECTURE.md §6).
   The general rule is `tool_choice: {type: 'tool', name: '…'}` to guarantee
   structured output. **ADR-0007 deviates exactly once**: V0 uses
   `tool_choice: 'auto'` over a 2-tool array (`produce_app_spec` and
   `out_of_scope`) per canvas-v0.md "Notes for Cal" — out-of-scope
   detection is load-bearing for §AC-O.
2. **Extended thinking + `tool_choice` rejected by Anthropic.** Carried over
   from ADR-0004 §A; the model emits no thinking trace in this pipeline.
   `tool_choice: 'auto'` doesn't change the rule — any tool-forcing
   variant (including `'auto'` with required tool call) is incompatible
   with thinking.
3. **`max_tokens: 8000` cap** on builder output (CLAUDE.md §3).
4. **All Anthropic calls in `services/api/src/llm/`** (CLAUDE.md §3).
5. **SSE streaming protocol unchanged** for `/generate`. ADR-0006 §G mobile
   chat UI consumes `thinking_started`, `building_started`, `done`, `error`,
   `[DONE]`. ADR-0007 **adds** `out_of_scope` as a new event type.
6. **Schema source: `@app-creator/protocol`.** Hand-edits to `generated/`
   are blocked in CI. No dual strict/permissive split.
7. **Server never returns LLM-emitted strings to clients.** Validation
   error responses include only the closed-enum `code`, never the
   `message` or `path` (which can echo LLM emissions like collection IDs,
   slot names, screen IDs). See `packages/protocol/src/validate.ts`
   Data Sensitivity note.

### Inconsistency I'm closing as part of this ADR

The brief and `canvas-v0.md` §AC-R4 both say "13 action verbs" but the
protocol implements 12 — F-04 cut `share` (host-meatball-only). ADR-0006
flagged this; the brief was not amended. ADR-0007's Documentation
Impact patches `canvas-v0-brief.md` §1.7 + §2.4 and `canvas-v0.md`
§AC-R4 to 12.

---

## Decision

Replace the entire LLM generation pipeline with a **single-call V0 pipeline**:

- One Anthropic call per generation (Sonnet 4.6).
- `tool_choice: 'auto'` over two tools: `produce_app_spec` (emits `Spec`
  from `@app-creator/protocol`) and `out_of_scope` (emits a closed-enum
  capability tag plus a short reason string).
- SSE streaming preserved; new `out_of_scope` event type for the
  second tool.
- Validation: `SpecSchema.parse` → `validateCrossRefs`. Both failure
  modes surface as `invalid_spec` with closed-enum codes (never raw
  messages or LLM-emitted paths) in the response.
- Planner deleted. Pipeline orchestrator deleted. Edit route deleted.
  Eval harness re-authored.

The 7 implementation steps below decompose this work. Step 3 through Step 5
land together as the production cutover (no half-state where `/generate`
emits V0 but the route writes M1).

### Architectural choices, with rationale

#### A. Single-call pipeline (no planner)

Canvas V0 brief §2.3 is explicit; Sponsor signed off 2026-05-07. With 4
archetypes (not 8) and a closed 28-component / 12-verb / 4-archetype schema
enforced via `tool_choice`, the planner's archetype-routing value is
marginal. The planner stage costs ~5s of latency that the brief treats as
load-bearing for the 7–9s public-launch UX target.

**Counter-argument I considered.** 28 components is more emission choices
than M1's 10. Won't the LLM need help structuring the output? The help comes
from three places, none of which require a separate planner LLM call:

1. **The tool's JSON Schema** (generated from `SpecSchema`) constrains every
   field to a closed enum or a regex'd string.
2. **The cached catalog block** in the system prompt names each archetype's
   typical structure (ListCRUD: stack nav, one screen with List+FAB, one
   detail screen; Calculator: none nav, one screen, no collections; etc.).
3. **Four few-shot examples** drawn from `packages/protocol/test/fixtures.demo.ts`
   show the canonical shape per archetype.

The planner's outputs (archetype, screens, navigation) are now
**fields on the spec itself**: `Spec.archetype`, `Spec.navigation`,
`Spec.screens`. The model decides them inline. No round-trip.

**Risk.** Single-call quality on 4 archetypes is below bar. Mitigation
per canvas-v0.md §Risks: dedicated week 5 prompt iteration; eval gate at
≥90% overall / ≥80% per archetype; documented fallback to reintroduce a
planner if needed (1 week of work — ships in V0.1 not V0).

#### B. Edit pipeline deleted

Canvas V0 brief §1.4 is explicit. Re-prompt-to-edit goes through `/generate`
with a new prompt; the previous `project_versions` row stays as history;
the new generation creates a new row and flips `projects.current_version_id`.

**Implication for data migration.** Re-prompt creates a new spec version.
The user's mini-app data (collection rows) needs best-effort migration to
the new spec's collection field set. canvas-v0.md "Notes for Cal" calls
this out as a `projects.service.ts` concern (apply migration when
`current_version_id` flips). This ADR specifies the migration policy
inline but the implementation lives in projectsService — Step 4
deliverable.

**Migration policy:** field-by-field on each collection: keep rows where
the collection ID matches; preserve fields where (name, type) match;
drop fields not in the new spec; seed new fields from the new spec's
`seedData[0]`'s default. If the new spec drops a collection entirely,
drop the data. One toast on next open: "Your tool changed. Some fields
were updated." UX-owned copy.

This is real engineering surface — the brief's "best-effort migration"
is not a single-line change. I considered making it strict ("drop all
data on edit") but the canvas-v0.md happy path §"Re-prompt-to-edit"
treats it as best-effort. Best-effort it is.

#### C. Builder uses two tools with `tool_choice: 'auto'`

This is the load-bearing deviation from CLAUDE.md §3's force-single-tool
rule. canvas-v0.md "Notes for Cal" calls it out explicitly.

```ts
const response = await anthropic.messages.stream({
  model: 'claude-sonnet-4-6',
  max_tokens: 8000,
  metadata: {user_id: hashUserId(opts.userId)},
  system: [
    {type: 'text', text: SYSTEM_PROMPT_STATIC},
    {type: 'text', text: SYSTEM_PROMPT_CATALOG, cache_control: {type: 'ephemeral'}},
  ],
  tools: [produceAppSpecTool, outOfScopeTool],
  tool_choice: 'auto',  // ← the deviation
  messages: [{role: 'user', content: prompt}],
})
```

**Why not two separate calls.** A two-call shape (first call: "is this
in scope?"; second call: "generate the spec") costs an extra round-trip
on every request, plus latency on the cache-miss path. The
`tool_choice: 'auto'` pattern lets the model decide in one shot.

**Why not a single tool that emits a discriminated union.** Anthropic's
`tool_choice` only forces selection of the *tool*; it doesn't validate
the discriminator inside the tool's input. A combined tool would let the
model emit invalid combinations (e.g., "out_of_scope" type but missing
`capability`). Two tools force the model to pick one and emit a
schema-valid input. This is the same reason ADR-0006 has separate
NodeRenderer arms per component instead of one discriminated component.

**Risk.** The model picks the wrong tool. Two eval gates measure this
(§AC-O4 detection ≥95%, §AC-O5 false-positive ≤5%). Step 7 owns these.

#### D. JSON Schema generation: ship the protocol's full schema

`tools[].input_schema` is generated from `SpecSchema` via
`zodToJsonSchema(SpecSchema, {target: 'jsonSchema7'})`. The generated
schema is large — estimated 4000–5000 tokens. It's sent as part of the
`tools` parameter on every request and **cannot be cached** (Anthropic's
prompt cache only applies to `system` blocks with `cache_control`).

**Token budget analysis** (per request, after first warm cache):

| Block | Tokens | Cached? |
|---|---|---|
| Static system block | ~400 | No (every request) |
| Catalog block | ~5000 | Yes (after first request) |
| Tool definitions (JSON Schema) | ~5000 | No (every request) |
| User prompt (cap 2000 char) | ≤500 | No |
| **Total input per request** | **~10,900 tokens** | — |

Anthropic Sonnet 4.6 input limit is 200K tokens; we're at 5%. Cost-wise,
~$0.03 per generation on input alone (Sonnet input rate). Output adds
~$0.04 (8000 tokens × output rate). **~$0.07 per generation** — matches
the brief's $0.05–$0.10 estimate.

**Alternatives I considered:**

1. **Per-archetype tool definitions** (4 tools, one per archetype with
   archetype-specific schema subsets). Cleaner per-tool but breaks
   `tool_choice: 'auto'` semantics — the model would need a meta-decision
   ("which archetype") before the tool decision ("which tool"). And it
   duplicates 90% of the schema across the 4 variants. **Rejected** —
   complexity not worth the marginal token savings.
2. **Hand-trimmed JSON Schema** (delete unused union arms from the
   generated output). Brittle: a future protocol change could regress
   the trim. **Rejected** — the generated schema is the canonical
   contract; trimming creates a second source of truth.
3. **Schema in cached system block, not tools.** Anthropic doesn't
   provide schema enforcement on text blocks — `tool_choice` is the
   only enforcement surface. **Rejected** by API constraint.

**Going with the generated schema as-is.** Step 1 includes a
load-bearing token-budget test so any future schema bloat fails CI.

#### E. System prompt structure: static + cacheable catalog (~5000 tokens)

Current M1 catalog is ~600 tokens for 10 components. V0 catalog is 28
components plus archetypes plus nav rubric plus action verbs plus
binding kinds plus 4 few-shot examples. ~5000 tokens is the budget.

Cached block contents:

- Archetype guidance (4 archetypes × when-to-use × typical structure)
- Navigation rubric (4 patterns × when × typical archetype)
- 28-component catalog (one paragraph each: props, when to use)
- 12 action verb reference (verb × when to use)
- Binding system (5 kinds with concrete examples)
- Stance + palette picker rules (productive/expressive × 6 palettes)
- Out-of-scope detection rules (5 capability tags + boundary cases)
- 4 archetype-anchored few-shot examples (condensed from
  `packages/protocol/test/fixtures.demo.ts`)

Anthropic's prompt cache holds the catalog block as long as the request's
system block prefix matches exactly. The static block (~400 tokens) is
sent every request; the catalog block is the cache target.

**Few-shot examples are condensed.** Inlining the full `fixtures.demo.ts`
specs (~1500 tokens each, 6000 tokens for 4 examples) blows the budget.
Step 2 produces condensed examples (~400 tokens each, 1600 total) that
emphasize the shape pattern without verbose body content.

#### F. Error envelope: closed-enum codes, no LLM-emitted strings

`validateCrossRefs` returns 12 closed-enum codes (`unknown_collection`,
`field_type_mismatch`, etc.). Each error carries a `message` and `path`
that **echo LLM emissions** (collection IDs, slot names, screen IDs).
Per `packages/protocol/src/validate.ts` Data Sensitivity note, those
fields are server-side-only.

`SpecSchema.parse` Zod issues are similar: paths can include LLM-emitted
slot keys (e.g., `initialState.myCustomSlot`). The `flattenZodIssues`
helper in `util.ts` currently returns `{path: string, message: string}`
arrays — both leak-prone.

**Decision: route returns only codes.**

```ts
type ErrorResponse =
  | {error: 'invalid_input'}
  | {error: 'invalid_spec'; detail: {kind: 'zod'; codes: string[]} | {kind: 'cross_ref'; codes: ValidationErrorCode[]}}
  | {error: 'prompt_too_large'}
  | {error: 'rate_limited'}
  | {error: 'internal'}
```

The mobile client maps `codes[]` to user-friendly copy ("Some references
in the generated spec don't match"). Codes are bounded and safe to
return — the closed enums are checked into the protocol package.

#### G. Database migration story

Two concerns:

1. **`plan_json` column on `project_versions`.** ADR-0004 added it.
   ADR-0007 retires the planner. Options:

   **A) Drop the column.** Breaking. Existing rows lose data. Service
   code must change.

   **B) Keep the column, deprecate read paths.** Backwards-compatible.
   M1/M2 rows stay readable. V0 rows write `NULL`. No migration runs.

   **C) Migrate alpha-cohort rows to V0 specs.** Requires running a new
   generation per existing project. Cost prohibitive at any reasonable
   alpha scale.

   **Going with B.** The column stays for legacy reads. ADR-0007 stops
   writing to it. A V1 cleanup ADR can drop the column when no rows
   reference it. This is the conservative path; the read-path code
   ignoring `plan_json` is a one-line change in projectsService.

2. **Existing `spec_json` rows are M1-shape.** After ADR-0007, new rows
   are V0. The renderer rejects M1 via `SpecSchema.parse`; the error
   boundary catches.

   **Going with "alpha specs expire."** On user-open of an old project,
   the renderer throws → error boundary catches → user sees a "This tool
   needs to be re-created" message with a tap-to-recreate CTA that calls
   `/generate` with the saved `original_prompt`. UX surface in error
   boundary (ADR-0006 §G — already wired). This ADR specifies the
   policy; no code change needed beyond the error message copy (Sable
   task).

   This isn't a great UX for any real alpha user. The mitigation: V0 is
   pre-public-launch; alpha cohort is small; the regenerate flow is the
   same 7–9s the user already accepts. We will not silently regenerate
   on read because (a) it's user content; (b) it changes the
   `render_hash` and `cover_art_seed` invariants
   (canvas-v0.md §AC-P3, §AC-P4).

#### H. Out-of-scope detection: new table + new endpoint

canvas-v0.md §AC-O2 specifies "server stores `(user_id, capability,
prompt_hash, timestamp)` in `out_of_scope_intent`."

**Table** (Step 5):

```sql
CREATE TABLE out_of_scope_intent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  capability text NOT NULL CHECK (capability IN (
    'image_gen', 'vision', 'chat', 'transcription', 'classification', 'unknown'
  )),
  prompt_hash text NOT NULL CHECK (length(prompt_hash) = 64),  -- sha256 hex
  reason text NOT NULL CHECK (length(reason) <= 200),
  email text CHECK (email IS NULL OR length(email) <= 320),
  created_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX out_of_scope_intent_capability_idx ON out_of_scope_intent (capability, created_at DESC);
CREATE INDEX out_of_scope_intent_user_idx ON out_of_scope_intent (user_id, created_at DESC);
```

**Endpoint** (Step 5): `POST /out-of-scope-intent`. Auth required.
Inserts row. Returns `{captured: true}`. Telemetry event
`out_of_scope_intent_captured` fires.

**Why `prompt_hash` and not raw prompt:** PII protection. The full
prompt lives in Langfuse traces; the DB stores a sha256 hash. Dedupes
"same user submitted same prompt twice" without leaking content into
analytics consumers. The hash is computed server-side at `/generate`
time (the LLM's `out_of_scope` tool input doesn't have it). Mobile
client passes `prompt_hash` back when submitting the email-capture form.

Two-step flow:

1. **Detection** (`/generate`): LLM calls `out_of_scope`; SSE emits
   `out_of_scope` event with `{capability, reason, prompt_hash}`;
   server writes telemetry event `generate.out_of_scope`. No row in
   `out_of_scope_intent` yet.
2. **Capture** (`/out-of-scope-intent`): user taps "Notify me"; mobile
   POSTs `{capability, prompt_hash, reason, email}`; server inserts row.

If the user dismisses without submitting, only the telemetry event
fires. The detection rate (numerator: detections, denominator: all
prompts) and capture rate (numerator: captures, denominator: detections)
are both first-class metrics for V0.5 prioritization.

#### I. Telemetry: rename `EVAL_MODE`, drop planner/edit events

Current: `PLAN_BUILD_EVAL_MODE='true'` short-circuits DB inserts in
`writeEvent`. Rename to `EVAL_MODE`. Same plumbing.

Event types after ADR-0007:

**Kept (semantics unchanged):**

| Event Type | Allowed Payload Keys |
|---|---|
| (none from ADR-0004 — all renamed or deleted) | |

**Deleted (with the planner/edit pipeline):**

- `plan.completed`, `plan.timeout_fallback`, `plan.invalid_fallback`,
  `plan.unknown_fallback`, `plan.transport_fallback`
- `build.completed`, `build.conformance_fallback`
- `edit.completed`, `edit.patch_out_of_scope_fallback`

**Added:**

| Event Type | Allowed Payload Keys |
|---|---|
| `generate.completed` | `generationId, archetype, screens_count, navigation, generation_duration_ms` |
| `generate.invalid_spec` | `generationId, error_kind` (`'zod' \| 'cross_ref'`)`, code_count` |
| `generate.out_of_scope` | `generationId, capability, reason_length` |
| `out_of_scope_intent_captured` | `capability, has_email` (boolean) |

Whitelist enforcement (Step 6) rejects unknown keys per event type.
Adding a key requires updating the whitelist in `telemetry.ts`.

#### J-pre. `parentPromptContext` parameter — preserved from M1

The M1 `generateAppSpec` accepts `parentPromptContext?: string` for the
"build similar to" flow: when a user generates from a parent project's
remix surface, the parent's `original_prompt` is passed as additional
context. V0 preserves this surface unchanged.

**Behavior:**

- `generateAppSpec({userId, prompt, parentPromptContext})` builds the user
  message as: `"Original app prompt: ${parentPromptContext}\n\nNew request: ${prompt}"`.
  When `parentPromptContext` is undefined, the user message is just `prompt`.
- The `parent_project_id` ACL on `/generate` (Step 4) resolves the parent
  project and feeds its `original_prompt` into `parentPromptContext` —
  this is the integration path. Same as M1.
- The 12,000-char gate (`MAX_TOTAL_INPUT_CHARS` in `routes/generate.ts`)
  applies to the combined `prompt + parentPromptContext` total, not to
  the user prompt alone. The prompt cap is 2,000 chars (`GenerateBodySchema`);
  parentPromptContext can push the combined total over 12,000 if the
  parent's `original_prompt` was long.

**Tests** (Step 3 and Step 4 — see Test Spec):

- T-0007-178 (Step 3): `generateAppSpec({prompt: 'p', parentPromptContext: 'orig'})`
  passes a user message containing both strings (Anthropic SDK call inspection).
- T-0007-179 (Step 4): a prompt of 2,000 chars + parentPromptContext from a
  parent project's 11,000-char `original_prompt` triggers `prompt_too_large`
  on the combined size — verifying T-0007-076 is reachable.

#### J. Streaming SSE: add `out_of_scope` event, preserve everything else

Current `/generate` SSE wire protocol (ADR-0002 §C):

```
event: data: {type: 'thinking_started'}
event: data: {type: 'building_started'}
event: data: {type: 'done', project: {...}, spec: {...}, render_hash: '...'}
event: data: [DONE]
```

ADR-0007 adds `out_of_scope`:

```
event: data: {type: 'thinking_started'}
event: data: {type: 'building_started'}
event: data: {type: 'out_of_scope', capability: 'vision', reason: '...', prompt_hash: '...'}
event: data: [DONE]
```

Mobile client renders the "want to be notified?" form on `out_of_scope`.
**No project is persisted** on out-of-scope detection — the spec was
never generated.

On invalid spec or transport error, the existing `{type: 'error',
code, detail?}` envelope holds.

#### K. AppRunner sample-spec fallback removal

ADR-0006 Step 11 cutover wired AppRunner to mount a hardcoded
SAMPLE_SPEC (the Milestone B fixture) because real generated specs
weren't yet V0-shape. ADR-0007 Step 7 removes that fallback. AppRunner
loads the user's actual project spec from `useProjectQuery` (or
equivalent), and the V0 renderer renders it directly.

The DevDemoPicker stays — it's `__DEV__`-only, useful for testing
without making generation calls.

---

## Alternatives Considered

### Alternative 1: Keep the two-stage pipeline (revise the brief)

**Upside:** No deletion sweep. Reuses ADR-0004's investment.

**Downside:**

- Brief §2.3 explicitly cuts the planner; Sponsor signed off.
- 7–9s latency target requires single-call.
- 4 archetypes doesn't need planner-level routing.

**Why not.** The brief is the source of truth. Reopening it would
require Sponsor re-decision and a 1-week slip per canvas-v0.md
"Risks → §0 reconciliation drags past 2026-05-12."

### Alternative 2: Single-call with `tool_choice: {type: 'tool', name: 'produce_app_spec'}` (force just the spec tool)

**Upside:** Matches the canonical CLAUDE.md §3 pattern. No deviation.

**Downside:** No place for out-of-scope detection without a separate
LLM call. Either:

- A pre-generation LLM call asks "is this in scope?" — doubles latency.
- A heuristic regex on the prompt — high false-positive, high
  false-negative; brittle.

**Why not.** Out-of-scope detection is canvas-v0.md §AC-O — load-
bearing for V0.5 prioritization. The `tool_choice: 'auto'` deviation
costs nothing in code complexity and gives the model a single,
schema-enforced choice. The CLAUDE.md §3 rule is "structured output
is non-negotiable"; `tool_choice: 'auto'` over two tools still
guarantees structured output (the model picks one), just from a
2-element set instead of a 1-element set.

### Alternative 3: Server-side migration of M1 → V0 specs at read time

**Upside:** Alpha cohort sees no breakage.

**Downside:**

- Silent regeneration changes user content without consent.
- `render_hash` invariant breaks (different bytes for the same project).
- `cover_art_seed` would shift on regeneration.
- Generation costs ~$0.07; doing it lazily at read time is wasted
  budget.

**Why not.** Alpha cohort is small and pre-public-launch. The cost of
"re-create your tool" UX is one-time per user; the cost of silent
regeneration is permanent inconsistency in the data model.

---

## Consequences

### Positive

- The chat-to-app path works end-to-end. Users generate V0 specs that
  the V0 renderer renders.
- Single-call latency target (7–9s p50) achievable; planner overhead gone.
- Out-of-scope detection feeds V0.5 prioritization with real signal.
- ADR-0004's two-stage code retires; ~1500 lines of pipeline complexity
  removed.
- Eval harness measures the right things on the right taxonomy.
- Telemetry whitelist + eval-mode short-circuit (ADR-0004 Step 8/9
  carryover) keep working; only event types change.
- One renderer for both the generated path and the demo path —
  SAMPLE_SPEC fallback removed.

### Negative

- Alpha cohort M1 specs stop working. Users with existing projects see
  the error boundary on next open. UX-owned re-create flow lands as
  copy + tap-to-recreate CTA.
- Edit-by-chat regresses to full regeneration. Latency budget (7–9s)
  is acceptable per the brief; cost per edit (~$0.07) is acceptable
  pre-paid-plan.
- Two-tool `tool_choice: 'auto'` is a documented deviation from
  CLAUDE.md §3's "force a single tool" rule. The deviation is bounded
  (one place in the codebase) and tested (Step 3 + Step 7 eval gates).
- Public surface: `/edit` endpoint removed. Mobile client must be
  updated in lockstep (re-prompt-to-edit hits `/generate`).
- Token budget per request grows (~10,900 tokens vs. M1's ~3,500).
  Cost per generation rises from ~$0.02 to ~$0.07 — well within the
  brief's $0.05–$0.10 estimate.

### Risks

- **Single-call quality drops** vs. two-stage. Mitigated by week-5
  prompt iteration. Documented fallback: reintroduce planner in week 6
  (1 week of work, ships V0.1).
- **JSON Schema bloat** as the protocol evolves. Step 1 has a load-
  bearing token-budget test that fails CI if `tools[].input_schema` grows
  past the budget.
- **`tool_choice: 'auto'` quality** — the model picks the wrong tool.
  Eval gates §AC-O4 (≥95% detection) and §AC-O5 (≤5% false-positive)
  catch this. If gates fail at week 5, threshold tunes by capability
  (image_gen and vision are priority; transcription can ship with a
  higher false-positive).
- **Alpha cohort backlash** on M1 specs expiring. Sample size is small
  (≤50 alpha users per canvas-v0.md §0); the impact is bounded. UX
  copy is the surface area.

### CI/CD impact

| Job | Config | Impact | Required Change |
|---|---|---|---|
| `services/api` typecheck | `tsconfig.json` | Schema imports change from `@app-creator/a2ui-schema` to `@app-creator/protocol`. Failing typechecks signal incomplete migration. | Step 3 closes; Step 6 removes the workspace dep. |
| `services/api` lint | `eslint.config.mjs` | Deleted files removed from lint inputs automatically. | No change. |
| `services/api` test | `jest.config.cjs` | Test surface shrinks (planner.test.ts, pipeline.test.ts, edit.test.ts gone). New tests in Steps 1–7. | Step 6 deletes; Steps 1–7 add. |
| Eval workflow | `.github/workflows/eval.yml` | Mode references `--mode=legacy` etc. → `--mode=v0`, new mode `--mode=out-of-scope-detection`. Threshold values change. | Step 7. |
| Mobile typecheck/test | `apps/mobile/jest.config.js` | No change directly. The `useGenerateMutation` hook's SSE consumer needs to handle the new `out_of_scope` event type. | Step 4 (mobile contract change in same PR as route change). |

### Documentation impact

| Doc | Path | What Changes |
|---|---|---|
| ADR-0007 | `docs/adrs/ADR-0007-llm-v0-cutover.md` | NEW |
| ADR-0004 status | `docs/adrs/ADR-0004-plan-build-pipeline.md` | Status → Superseded by ADR-0007 |
| ADR index | `.claude/references/adr-index.md` | Add ADR-0007 row; update ADR-0004 status |
| Canvas V0 brief | `docs/product/canvas-v0-brief.md` | §1.7 "13 action verbs" → 12; §2.4 Registry 2 verb count + drop `share` row |
| Canvas V0 spec | `docs/product/canvas-v0.md` | §AC-R4 "13 action verbs" → 12 (drop `share`) |
| README | `README.md` (if it documents `/edit`) | Remove `/edit` reference if present |
| API contract docs | (none formalized; canvas-v0.md §API Contracts is canonical) | Update `/generate` SSE event types; remove `/edit` row; add `/out-of-scope-intent` row |

---

## Implementation Plan

7 steps. Steps 1–2 are parallel-safe (tools + system prompt have no
dependency on each other). Steps 3–5 land in one PR (no half-state).
Steps 6–7 are post-cutover cleanup.

### Step 1: V0 tools + JSON schema generation

**Files to create/modify:**

- `services/api/src/llm/tools/produceAppSpec.ts` — rewrite to import
  `SpecSchema` from `@app-creator/protocol`. Description updated for V0
  (mention archetype, stance, palette, seed data requirement).
- `services/api/src/llm/tools/outOfScope.ts` — NEW. Tool definition
  with `capability` (closed enum) and `reason` (string ≤200 chars)
  input schema.
- `services/api/src/llm/tools/produceAppSpec.test.ts` — rewrite (M1
  schema gone).
- `services/api/src/llm/tools/outOfScope.test.ts` — NEW.

**Code shape:**

```ts
// produceAppSpec.ts
import {zodToJsonSchema} from 'zod-to-json-schema'
import {SpecSchema} from '@app-creator/protocol'

export const produceAppSpecTool = {
  name: 'produce_app_spec' as const,
  description: 'Produce a structured V0 app spec describing the requested tool. ' +
    'Use the 28-component catalog and 12 action verbs. Choose archetype, ' +
    'stance, and palette appropriate to the prompt. Every collection must ' +
    'include realistic seedData (3–5 rows; no lorem ipsum). Every screen ' +
    'and component node must have a unique lowercase id. initialScreenId ' +
    'must reference an existing screen.id.',
  input_schema: zodToJsonSchema(SpecSchema, {target: 'jsonSchema7'}) as Record<string, unknown>,
}
```

```ts
// outOfScope.ts
import {z} from 'zod'

export const OutOfScopeCapabilitySchema = z.enum([
  'image_gen', 'vision', 'chat', 'transcription', 'classification', 'unknown',
])
export type OutOfScopeCapability = z.infer<typeof OutOfScopeCapabilitySchema>

// Zod source for the JSON Schema below — also used at SSE emission time
// for defense-in-depth re-validation (T-0007-181).
export const OutOfScopeInputSchema = z.object({
  capability: OutOfScopeCapabilitySchema,
  reason: z.string().min(1).max(200),
}).strict()
export type OutOfScopeInput = z.infer<typeof OutOfScopeInputSchema>

export const outOfScopeTool = {
  name: 'out_of_scope' as const,
  description: 'Call this instead of produce_app_spec when the user prompt requires ' +
    'a capability not in the V0 catalog: image generation, vision (photo analysis), ' +
    'chat (conversational), voice transcription, or AI classification. ' +
    'Provide the matching capability tag and a brief reason (≤200 chars).',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['capability', 'reason'],
    properties: {
      capability: {
        type: 'string',
        enum: ['image_gen', 'vision', 'chat', 'transcription', 'classification', 'unknown'],
      },
      reason: {type: 'string', minLength: 1, maxLength: 200},
    },
  } as const,
}
```

**Acceptance criteria:**

- `produceAppSpecTool.name === 'produce_app_spec'`.
- `produceAppSpecTool.input_schema` validates all 4 demo specs from
  `packages/protocol/test/fixtures.demo.ts` via an Ajv pass.
- `outOfScopeTool.name === 'out_of_scope'`.
- `outOfScopeTool.input_schema` accepts a valid out-of-scope input
  (`{capability: 'vision', reason: '...'}`) and rejects unknown
  capabilities.
- JSON-stringified sum of both tool definitions stays under the budget
  (see T-0007-010).
- Generated JSON Schema includes all 28 component type literals and
  all 12 action verb type literals (regression).

**Estimated complexity:** Low.

### Step 2: V0 system prompt rewrite

**Files to create/modify:**

- `services/api/src/llm/prompts/system.ts` — rewrite.

**Structure:**

```ts
export const SYSTEM_PROMPT_STATIC = `\
You are Canvas, an app builder that produces native iOS mini-apps. When the
user describes an idea, you produce a V0 spec via the produce_app_spec tool —
OR you call the out_of_scope tool if the user's request needs a capability
that V0 doesn't have.

Rules:
- Use only the 28 catalog components and 12 action verbs from the schema.
- Choose archetype from: ListCRUD, Tracker, Journal, Calculator.
- Choose stance (productive or expressive) and palette (focus, health, money,
  social, learn, play) appropriate to the archetype + content.
- Every collection MUST include realistic seedData (3–5 rows). No lorem ipsum.
- Every screen and component node MUST have a unique id (lowercase, snake_case).
- initialScreenId MUST reference an existing screen.id.
- Never reply with plain text or raw JSON. Always call a tool.
- Never ask clarifying questions. Make a reasonable interpretation.
- If the prompt needs a V0.5 capability (image generation, vision, chat,
  transcription, classification), call out_of_scope instead of produce_app_spec.
`

export const SYSTEM_PROMPT_CATALOG = `\
## Archetype Guidance
... 4 archetypes × structure × when to use

## Navigation Patterns
... 4 patterns × when × archetype affinity

## Component Catalog (28 components)
... 28 components, one paragraph each (key props + when to use)

## Action Verbs (12)
... verb × when × example

## Binding System (5 kinds)
... literal | state | collectionField + 2 typed bindings (image, date)

## Stance + Palette Rules
... productive/expressive × 6 palettes × content cues

## Out-of-Scope Capabilities
... 5 capabilities × example triggers × boundary cases

## Examples
... 4 archetype-anchored condensed specs (drawn from fixtures.demo.ts)
`
```

**Acceptance criteria:**

- `SYSTEM_PROMPT_STATIC` mentions both tool names and instructs choice
  between them.
- `SYSTEM_PROMPT_CATALOG` mentions all 4 archetypes, all 28 component
  names, all 12 action verb names, all 5 binding kinds, all 5 out-of-
  scope capability tags.
- No mention of M1-only components (Text, Image, TextInput, Toggle,
  Counter, Form, Container) — those are removed from V0.
- No mention of `Plan` or `produce_plan` (M2 references gone).
- `SYSTEM_PROMPT_CATALOG.length <= 25,000` chars (~6,250 tokens) —
  cached block budget.
- `SYSTEM_PROMPT_STATIC.length <= 2,000` chars (~500 tokens) — non-
  cached block budget.

**Estimated complexity:** Medium. The 4 condensed examples are the
detail work; the rest is direct transcription from the protocol package
+ canvas-v0-brief.md §3.

### Step 3: generate.ts cutover — single-call with two tools

**Files to create/modify:**

- `services/api/src/llm/generate.ts` — rewrite. Drop M1 imports. Replace
  `A2UISpecSchema` with `SpecSchema` + `validateCrossRefs`. Drop `plan`
  parameter and `Plan` type. Add `outOfScopeTool` to `tools` array.
  Change `tool_choice` to `'auto'`. Add `out_of_scope` event type to the
  generator's yield union. Discriminate on `tool_use.name`. Update
  telemetry events.
- `services/api/src/llm/errors.ts` — `InvalidSpecError.detail` type
  changes to `{kind: 'zod' | 'cross_ref'; codes: string[]}`. Drop
  `PlannerInvalidError`, `PlannerTimeoutError`, `PlannerTransportError`,
  `PlanConformanceError`, `PatchOutOfScopeError` (these go in Step 6 but
  the type change lands here).
- `services/api/src/llm/util.ts` — `flattenZodIssues` rewrite: returns
  `string[]` of codes only (no `path`, no `message`).
- `services/api/src/llm/generate.test.ts` — rewrite for V0 surface.

**Code shape:**

```ts
import {SpecSchema, validateCrossRefs, type Spec} from '@app-creator/protocol'
import {anthropic} from './anthropic.js'
import {produceAppSpecTool} from './tools/produceAppSpec.js'
import {outOfScopeTool, OutOfScopeInputSchema, type OutOfScopeInput} from './tools/outOfScope.js'
import {SYSTEM_PROMPT_STATIC, SYSTEM_PROMPT_CATALOG} from './prompts/system.js'
import {InvalidSpecError, RateLimitedError, AnthropicTransportError} from './errors.js'
import {writeEvent} from './telemetry.js'
import {hashUserId, sleep, flattenZodIssues, sha256Hex} from './util.js'
import {randomUUID} from 'crypto'

export type ThinkingStartedEvent = {type: 'thinking_started'}
export type BuildingStartedEvent = {type: 'building_started'}
export type DoneSpecEvent = {
  type: 'done'
  spec: Spec
  generationId: string
  thinking_duration_ms: number
  generation_duration_ms: number
}
export type OutOfScopeEvent = {
  type: 'out_of_scope'
  generationId: string
  capability: OutOfScopeInput['capability']
  reason: string
  prompt_hash: string  // sha256 of the user prompt
  thinking_duration_ms: number
  generation_duration_ms: number
}
export type GenerateEvent = ThinkingStartedEvent | BuildingStartedEvent | DoneSpecEvent | OutOfScopeEvent

export async function* generateAppSpec(opts: {
  userId: string
  prompt: string
  parentPromptContext?: string
}): AsyncGenerator<GenerateEvent, void> {
  const generationId = randomUUID()
  const promptHash = sha256Hex(opts.prompt)
  const requestStart = Date.now()
  yield {type: 'thinking_started'}

  let buildingEmitted = false
  let phase2Start = 0
  let attempts = 0

  while (attempts < 3) {
    try {
      const stream = anthropic.messages.stream({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        metadata: {user_id: hashUserId(opts.userId)},
        system: [
          {type: 'text', text: SYSTEM_PROMPT_STATIC},
          {type: 'text', text: SYSTEM_PROMPT_CATALOG, cache_control: {type: 'ephemeral'}},
        ],
        tools: [produceAppSpecTool, outOfScopeTool] as any,
        tool_choice: 'auto' as any,
        messages: buildMessages(opts),
      })

      for await (const event of stream) {
        if (!buildingEmitted &&
            event.type === 'content_block_start' &&
            event.content_block.type === 'tool_use') {
          phase2Start = Date.now()
          yield {type: 'building_started'}
          buildingEmitted = true
        }
      }

      const final = await stream.finalMessage()
      if (phase2Start === 0) phase2Start = Date.now()

      const toolBlock = final.content.find(b => b.type === 'tool_use')
      if (!toolBlock) throw new InvalidSpecError('no_tool_use')

      // Discriminate on tool name
      if (toolBlock.name === 'out_of_scope') {
        // Defense-in-depth re-validation at SSE emission boundary (T-0007-181).
        // Anthropic's input_schema is the primary gate, but a synthetic 201-char
        // reason or schema-mismatch bug could bypass it; the explicit Zod parse
        // here throws InvalidSpecError before any user-visible content is emitted.
        let input: OutOfScopeInput
        try {
          input = OutOfScopeInputSchema.parse(toolBlock.input)
        } catch (zerr) {
          throw new InvalidSpecError('invalid_spec', {
            kind: 'zod',
            codes: flattenZodIssues(zerr),
          })
        }
        writeEventSafe('generate.out_of_scope', {
          generationId,
          capability: input.capability,
          reason_length: input.reason.length,
        })
        yield {
          type: 'out_of_scope',
          generationId,
          capability: input.capability,
          reason: input.reason,
          prompt_hash: promptHash,
          thinking_duration_ms: phase2Start - requestStart,
          generation_duration_ms: Date.now() - phase2Start,
        }
        return
      }

      if (toolBlock.name === 'produce_app_spec') {
        // Zod parse
        let parsed: Spec
        try {
          parsed = SpecSchema.parse(toolBlock.input)
        } catch (zerr) {
          writeEventSafe('generate.invalid_spec', {
            generationId,
            error_kind: 'zod',
            code_count: flattenZodIssues(zerr).length,
          })
          throw new InvalidSpecError('invalid_spec', {
            kind: 'zod',
            codes: flattenZodIssues(zerr),
          })
        }
        // Cross-ref validation
        const crossRef = validateCrossRefs(parsed)
        if (!crossRef.ok) {
          writeEventSafe('generate.invalid_spec', {
            generationId,
            error_kind: 'cross_ref',
            code_count: crossRef.errors.length,
          })
          throw new InvalidSpecError('invalid_spec', {
            kind: 'cross_ref',
            codes: crossRef.errors.map(e => e.code),  // codes only — no path, no message
          })
        }
        writeEventSafe('generate.completed', {
          generationId,
          archetype: parsed.archetype,
          screens_count: parsed.screens.length,
          navigation: parsed.navigation,
          generation_duration_ms: Date.now() - phase2Start,
        })
        yield {
          type: 'done',
          spec: parsed,
          generationId,
          thinking_duration_ms: phase2Start - requestStart,
          generation_duration_ms: Date.now() - phase2Start,
        }
        return
      }

      // Unknown tool name — should not happen with tool_choice: 'auto' over a closed array
      throw new InvalidSpecError('unknown_tool')
    } catch (err: unknown) {
      const sdkErr = err as {status?: number}
      if (sdkErr?.status === 429 && attempts < 2) {
        attempts++
        await sleep(attempts === 1 ? 1000 : 2000)
        continue
      }
      if (err instanceof InvalidSpecError) throw err
      if (sdkErr?.status === 429) throw new RateLimitedError()
      throw new AnthropicTransportError(safeMessage(err))
    }
  }
  throw new RateLimitedError()
}

function writeEventSafe(type: ..., payload: any) {
  // Telemetry: catch + log internally; never throw out of writeEvent
  writeEvent(type, payload).catch(err => log.error(...))
}
```

**Acceptance criteria:**

- `generateAppSpec` yields `thinking_started` synchronously before first
  await.
- Yields `building_started` on first `content_block_start` of type
  `tool_use`.
- On `tool_use.name === 'produce_app_spec'` with valid spec: yields
  `done` with parsed `Spec` (typed as protocol's `Spec`, not M1's `A2UISpec`).
- On `tool_use.name === 'produce_app_spec'` with invalid spec (Zod
  fail): throws `InvalidSpecError` with `detail.kind === 'zod'` and
  `detail.codes` containing only string codes (no LLM-emitted paths).
- On `tool_use.name === 'produce_app_spec'` with valid Zod but failing
  cross-ref: throws `InvalidSpecError` with `detail.kind === 'cross_ref'`.
- On `tool_use.name === 'out_of_scope'`: yields `out_of_scope` with
  capability + reason + prompt_hash.
- `tool_choice: 'auto'` is set; tools array has exactly 2 elements.
- `max_tokens: 8000`. `metadata.user_id` is hashed.
- 429 retry: 2 retries with 1s+2s backoff. After: `RateLimitedError`.
- Other transport errors: `AnthropicTransportError`.
- Telemetry events fire: `generate.completed`, `generate.invalid_spec`,
  `generate.out_of_scope`. Whitelist validates payloads.
- No raw user prompt in any error detail or telemetry payload.

**Estimated complexity:** High. The Zod issue filtering is non-trivial.
The `tool_choice: 'auto'` typing requires SDK type-cast workarounds
(noted in code shape via `as any`). The error shape change ripples through
errors.ts and util.ts.

### Step 4: /generate route + projectsService migration

**Files to create/modify:**

- `services/api/src/routes/generate.ts` — drop `runPipeline` import; use
  `generateAppSpec` directly. Drop `plan` from `done` event payload.
  Add `out_of_scope` SSE event handling. Update error envelope shape.
- `services/api/src/services/projects.service.ts` — `create()` signature:
  drop `plan` parameter. Type of `spec` changes from `A2UISpec` to
  `Spec` from protocol. Use `renderHash` from `@app-creator/protocol`
  (not `lib/canonical.ts` — that was M1's). Replace `deepValidateSpec`
  call with `validateCrossRefs` (Zod parse already happened in
  generate.ts; this is a defensive re-validation at the service boundary).
  Implement best-effort field migration for `applyEdit` ... **wait** —
  applyEdit is being deleted in Step 6. The migration story for
  re-prompt-to-edit lives in `create()` via a new `parentVersionId`
  parameter. See note below.
- `services/api/src/services/projects.service.test.ts` — update for V0
  surface.
- `services/api/src/routes/generate.test.ts` — update.
- `services/api/src/lib/canonical.ts` — delete (M1's canonicalize; V0
  uses `packages/protocol/src/canonical.ts` via the re-export).

**Code shape:**

```ts
// projects.service.ts
import {SpecSchema, validateCrossRefs, renderHash, type Spec} from '@app-creator/protocol'

export interface CreateProjectInput {
  ownerId: string
  spec: Spec
  originalPrompt?: string
  parentProjectId?: string
  /**
   * V0: when set, this generation is a re-prompt-to-edit. The new spec
   * replaces the parent's current_version_id, and the service applies
   * best-effort data migration (per ADR-0007 §B).
   * When absent: fresh creation.
   */
  parentVersionId?: string
}

export async function create(input: CreateProjectInput): Promise<ProjectDetail> {
  // 1. Defensive re-validation (Zod + cross-ref)
  const parsed = SpecSchema.parse(input.spec)
  const crossRef = validateCrossRefs(parsed)
  if (!crossRef.ok) {
    throw new ValidationError('invalid_spec', crossRef.errors.map(e => e.code))
  }

  // 2. Compute renderHash from canonicalized spec
  const hash = renderHash(parsed)

  // 3. (If re-prompt) Migrate collection data from parent version
  let migratedData: Record<string, any[]> | undefined
  if (input.parentVersionId) {
    migratedData = await migrateCollectionData(input.parentVersionId, parsed)
  }

  // 4. Single transaction: project + project_version
  ...
}
```

**Best-effort migration helper** (`migrateCollectionData`):

```ts
async function migrateCollectionData(parentVersionId: string, newSpec: Spec): Promise<Record<string, any[]>> {
  const parentVersion = await db.select().from(projectVersions).where(eq(projectVersions.id, parentVersionId)).limit(1)
  if (parentVersion.length === 0) return {}
  const parentSpec = SpecSchema.safeParse(parentVersion[0].specJson)
  if (!parentSpec.success) return {}  // parent was M1; nothing to migrate

  const result: Record<string, any[]> = {}
  for (const newColl of newSpec.collections) {
    const parentColl = parentSpec.data.collections.find(c => c.id === newColl.id)
    if (!parentColl) continue  // new collection; use seedData (not migrated here)
    // Filter to fields that exist in both (by name and type)
    const compatibleFields = newColl.fields.filter(nf =>
      parentColl.fields.some(pf => pf.name === nf.name && pf.type.type === nf.type.type)
    )
    if (compatibleFields.length === 0) continue
    // For each parent row, project to compatible fields
    const migratedRows = parentColl.seedData.map(row => {
      const projected: Record<string, any> = {}
      for (const f of compatibleFields) {
        if (row[f.name] !== undefined) projected[f.name] = row[f.name]
      }
      return projected
    })
    result[newColl.id] = migratedRows
  }
  return result
}
```

**Note.** The migrated data is currently used only for telemetry
(canvas-v0.md "best-effort migration" is policy; the actual store of
collection rows is mobile-side in this V0 cut). The mobile renderer
hydrates collections from `spec.collections[].seedData` on first open.
**This migration scaffolding is here for V0.5 when collection rows
persist server-side.** For V0, the helper is a no-op stub that returns
an empty object — but the contract is wired so V0.5 can flip it on
without changing the route.

Make this explicit in Notes for Colby.

**Acceptance criteria:**

- POST `/generate` with valid prompt: SSE stream emits
  `thinking_started`, `building_started`, `done` with project metadata.
- POST `/generate` with prompt triggering out-of-scope: SSE emits
  `out_of_scope` event; **no project persisted**.
- POST `/generate` no longer accepts `plan` in body (no schema field).
- POST `/generate` `done` event payload no longer includes `plan` field.
- Cross-ref errors surface as `invalid_spec` with `detail.kind === 'cross_ref'`.
- Mobile SSE consumer handles `out_of_scope` event (Step 4 also patches
  `apps/mobile/src/state/queries/generate.ts` — the hook that consumes the
  stream).
- 401 / 400 / 403 / 404 / 429 envelope unchanged.
- Project title: derived from spec's first Heading text (any screen),
  fallback to first 40 chars of prompt.
- `project_versions.plan_json` is NULL on all V0 inserts.
- `renderHash` matches `packages/protocol/src/canonical.ts` (not M1's
  `lib/canonical.ts`).

**Estimated complexity:** Medium-High. The route + service + mobile
consumer all change in lockstep. The migration stub is small but the
contract design matters for V0.5.

### Step 5: out_of_scope_intent table + endpoint

**Files to create/modify:**

- `services/api/migrations/0006_out_of_scope_intent.sql` — NEW.
- `services/api/src/db/schema.ts` — add `outOfScopeIntent` table.
- `services/api/src/services/outOfScope.service.ts` — NEW. Single method
  `captureIntent({userId, capability, promptHash, reason, email?})`.
- `services/api/src/services/outOfScope.service.test.ts` — NEW.
- `services/api/src/routes/outOfScope.ts` — NEW. POST
  `/out-of-scope-intent`.
- `services/api/src/routes/outOfScope.test.ts` — NEW.
- `services/api/src/index.ts` (or wherever routes register) — wire the
  new route plugin.

**Migration:**

```sql
CREATE TABLE out_of_scope_intent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  capability text NOT NULL CHECK (capability IN (
    'image_gen', 'vision', 'chat', 'transcription', 'classification', 'unknown'
  )),
  prompt_hash text NOT NULL CHECK (length(prompt_hash) = 64),
  reason text NOT NULL CHECK (length(reason) <= 200),
  email text CHECK (email IS NULL OR length(email) <= 320),
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX out_of_scope_intent_capability_idx ON out_of_scope_intent (capability, created_at DESC);
CREATE INDEX out_of_scope_intent_user_idx ON out_of_scope_intent (user_id, created_at DESC);
```

**Acceptance criteria:**

- Migration creates the table with all CHECK constraints active.
- POST `/out-of-scope-intent` with valid body: 200 `{captured: true}`;
  one row inserted.
- Auth required: 401 if no JWT.
- Body validation: rejects capability outside the closed enum;
  prompt_hash failing `/^[a-f0-9]{64}$/` (lowercase-only, exactly 64 hex
  chars — matches `sha256Hex` canonical form; uppercase and mixed-case
  rejected as `invalid_input`); reason > 200 chars; email > 320 chars
  or malformed.
- Email optional: NULL accepted.
- `user_id` is the authenticated user, never client-provided.
- Rate limit: 30/min/user on counter `oos-intent:${userId}` (separate
  from `generate:` counter).
- Telemetry: `out_of_scope_intent_captured` event fires with
  `{capability, has_email}`.
- Concurrent inserts produce distinct rows.

### Data Sensitivity

| Service Method | Returns | Sensitivity |
|---|---|---|
| `outOfScopeService.captureIntent` | `void` | `auth-only` — the row is owner-bound and not exposed via any read endpoint in V0. Aggregate read paths (for V0.5 prioritization analytics) live outside the API request path. |

**Estimated complexity:** Low. Standard new-table-plus-endpoint pattern.

### Step 6: Deletion sweep + telemetry/env cleanup

**Files to delete:**

- `services/api/src/llm/planner.ts`
- `services/api/src/llm/planner.test.ts`
- `services/api/src/llm/prompts/planner.ts`
- `services/api/src/llm/pipeline.ts`
- `services/api/src/llm/pipeline.test.ts`
- `services/api/src/llm/tools/producePlan.ts`
- `services/api/src/llm/tools/producePlan.test.ts`
- `services/api/src/llm/tools/produceAppSpecPatch.ts`
- `services/api/src/llm/tools/produceAppSpecPatch.test.ts`
- `services/api/src/llm/serializePlan.ts`
- `services/api/src/llm/serializePlan.test.ts` (if exists)
- `services/api/src/llm/patchValidation.ts`
- `services/api/src/llm/patchValidation.test.ts`
- `services/api/src/routes/edit.ts`
- `services/api/src/routes/edit.test.ts`
- `services/api/src/services/specValidation.ts` (M1 deep validator)
- `services/api/src/services/specValidation.test.ts`
- `services/api/src/lib/canonical.ts` (M1's; replaced by protocol's)

**Files to modify:**

- `services/api/src/llm/telemetry.ts` — drop `plan.*`, `build.*`,
  `edit.*` event types from `EventType` union and `EVENT_PAYLOAD_WHITELIST`.
  Add `generate.completed`, `generate.invalid_spec`, `generate.out_of_scope`,
  `out_of_scope_intent_captured`.
- `services/api/src/llm/telemetry.test.ts` — update.
- `services/api/src/lib/env.ts` — drop `PLAN_BUILD_PIPELINE_PERCENT`,
  `PLAN_BUILD_PIPELINE_SHADOW`, `PLAN_BUILD_EVAL_MODE`. Add `EVAL_MODE`.
  Drop the contradictory-state check (lines 95–102).
- `services/api/package.json` — remove `@app-creator/a2ui-schema` from
  dependencies (still in workspace; just not consumed by services/api).
- `services/api/test/mocks/anthropic.ts` — drop M1 type imports;
  rewrite mocks against V0 surface.
- `services/api/test/factories.ts` — rewrite spec factories against V0
  schema (`@app-creator/protocol`).
- `services/api/scripts/generate-seed-sql.ts` — rewrite or delete (M1
  seed script).
- `services/api/src/index.ts` (or main app entry) — drop edit route
  registration; drop `runPipeline` reference.
- `services/api/src/services/projects.service.ts` — drop `applyEdit`
  method; drop `getVersion` if only used by edit (re-check usage).
- `.claude/references/adr-index.md` — mark ADR-0004 as **Superseded
  by ADR-0007**. Add ADR-0007 row.
- `docs/adrs/ADR-0004-plan-build-pipeline.md` — status header → Superseded.

**Acceptance criteria:**

- All listed files do not exist on disk.
- `grep -rn "from '@app-creator/a2ui-schema'" services/` returns no
  matches in non-coverage paths.
- `grep -rn "from '.*planner'" services/` returns no matches.
- `grep -rn "from '.*pipeline'" services/` returns no matches.
- `grep -rn "from '.*serializePlan'" services/` returns no matches.
- `EVENT_PAYLOAD_WHITELIST` contains only the 4 V0 event types.
- `env.ts` does not reference `PLAN_BUILD_*`.
- `EVAL_MODE` env var read by telemetry's short-circuit.
- ADR-0004 status: Superseded.
- adr-index.md ADR-0007 row exists.
- All previously-passing tests outside the deleted files still pass.

### Documentation Impact

| Doc | Path | What Changes |
|---|---|---|
| `docs/product/canvas-v0-brief.md` | §1.7 | "List of 13 action verbs" → 12 |
| `docs/product/canvas-v0-brief.md` | §2.4 Registry 2 | Verb count 13 → 12; drop `share` from the table (`Device` row becomes "capture" only) |
| `docs/product/canvas-v0.md` | §AC-R4 | "13 action verbs" → 12; drop `share` from verb list |
| ADR-0004 | header | Status: Accepted → Superseded by ADR-0007 (2026-05-07) |
| `.claude/references/adr-index.md` | row | ADR-0004 status update; ADR-0007 row added |

**Estimated complexity:** Medium. The deletion sweep is largely
mechanical but the workspace dep removal and the test-factory rewrites
require care.

### Step 7: Eval harness migration + CI update

**Files to modify:**

- `services/api/eval/prompts.ts` — rewrite. 160 prompts: 100 archetype-
  balanced (25 × 4), 30 detection (6 × 5), 30 false-positive.
- `services/api/eval/run.ts` — rewrite. New modes: `v0`,
  `out-of-scope-detection`, `out-of-scope-false-positive`. Drop `legacy`,
  `planner`, `new`, `shadow`.
- `services/api/eval/scoreArchetype.ts` — rewrite as V0 archetype
  comparison (spec.archetype === expected_archetype). The shadow-mode
  heuristic is gone; archetype is now an explicit spec field.
- `services/api/eval/run.test.ts` — rewrite.
- `.github/workflows/eval.yml` (or equivalent) — update mode references.
  Add `--mode=out-of-scope-detection` as a separate CI job. Path filters
  trigger on `services/api/src/llm/`, `packages/protocol/`, or
  `packages/a2ui-renderer/src/v0/components/`.

**`prompts.ts` structure:**

```ts
export const ARCHETYPE_PROMPTS: PromptEntry[] = [
  // 25 ListCRUD prompts
  // 25 Tracker prompts
  // 25 Journal prompts
  // 25 Calculator prompts
]

export const OUT_OF_SCOPE_DETECTION_PROMPTS: DetectionEntry[] = [
  // 6 prompts for each of 5 capabilities = 30
  // Each prompt explicitly invokes that capability
]

export const OUT_OF_SCOPE_FALSE_POSITIVE_PROMPTS: FalsePositiveEntry[] = [
  // 30 in-scope prompts that brush against capabilities
  // Each has expected_archetype + brushes_against capability tag
]
```

**Acceptance criteria:**

- `prompts.ts` exports 100 archetype prompts (25 per archetype).
- `prompts.ts` exports 30 detection prompts (6 per capability).
- `prompts.ts` exports 30 false-positive prompts.
- `--mode=v0` asserts SpecSchema.parse + validateCrossRefs +
  archetype match per prompt; threshold ≥90% overall, ≥80% per archetype.
- `--mode=out-of-scope-detection` asserts tool_use is `out_of_scope`
  with matching capability; threshold ≥95%.
- `--mode=out-of-scope-false-positive` asserts tool_use is
  `produce_app_spec` (not `out_of_scope`); threshold ≤5% false-positive.
- `EVAL_MODE=true` set at top of `run.ts` before any module reads env.
- Default mode (no flag): `v0`.
- Unknown mode: exits 1 with usage message.
- Results JSON written to `services/api/eval/results/{timestamp}-{mode}.json`.
- Results JSON does not contain raw prompts (only `prompt_id`).
- CI workflow runs `--mode=v0` on every PR touching the relevant paths.

**Estimated complexity:** Medium-High. The prompt re-authoring is real
PM work (Robert + AI Eng); the harness rewrite is mechanical but
substantial.

---

## Comprehensive Test Specification

### Test File Mapping

| Step | Test File | Env |
|---|---|---|
| 1 | `services/api/src/llm/tools/produceAppSpec.test.ts` | Node (Jest) |
| 1 | `services/api/src/llm/tools/outOfScope.test.ts` | Node (Jest) |
| 2 | `services/api/src/llm/prompts/system.test.ts` | Node (Jest) |
| 3 | `services/api/src/llm/generate.test.ts` | Node (Jest, mocked Anthropic SDK) |
| 4 | `services/api/src/routes/generate.test.ts` | Node (Jest, Fastify supertest) |
| 4 | `services/api/src/services/projects.service.test.ts` | Node (Jest, containerized Postgres) |
| 4 | `apps/mobile/src/state/queries/generate.test.ts` | Mobile workspace (Jest, RNTL, mocked fetch) — T-0007-101 only; runs under `pnpm --filter @app-creator/mobile test` |
| 5 | `services/api/src/routes/outOfScope.test.ts` | Node (Jest, Fastify supertest) |
| 5 | `services/api/src/services/outOfScope.service.test.ts` | Node (Jest, containerized Postgres) |
| 5 | `services/api/src/db/schema.test.ts` | Node (Jest, DB migration smoke) |
| 6 | `services/api/src/llm/telemetry.test.ts` | Node (Jest) |
| 6 | `services/api/src/lib/env.test.ts` | Node (Jest) |
| 6 | `services/api/test/deletion-sweep.test.ts` (NEW — filesystem + grep assertions) | Node (Jest) — uses `fs.existsSync` for file-existence; uses `execSync('grep -rn ...')` guarded by `process.platform !== 'win32'` (cross-platform note: skip with `.todo` on Windows CI — out of scope, V0 dev is macOS/Linux) |
| 7 | `services/api/eval/run.test.ts` | Node (Jest, mocked Anthropic SDK) |
| 7 | `services/api/eval/prompts.test.ts` | Node (Jest — counts + enum constraints) |

### Step 1 Tests

| ID | Category | Description |
|---|---|---|
| T-0007-001 | Happy | `produceAppSpecTool.input_schema` validates `DEMO_SPEC_LIST_CRUD` via Ajv with zero errors |
| T-0007-002 | Happy | All 4 demo specs (`DEMO_SPEC_LIST_CRUD`, `DEMO_SPEC_TRACKER`, `DEMO_SPEC_JOURNAL`, `DEMO_SPEC_CALCULATOR`) validate against the tool's input_schema |
| T-0007-003 | Failure | A spec missing required `archetype` field fails Ajv validation with `archetype` named in the error |
| T-0007-004 | Failure | A spec with `archetype: 'Garbage'` (not in enum) fails Ajv validation |
| T-0007-005 | Failure | A spec with `version: 2` (not literal 1) fails Ajv validation |
| T-0007-006 | Boundary | `produceAppSpecTool.name === 'produce_app_spec'` (const literal — guards rename) |
| T-0007-007 | Boundary | `produceAppSpecTool.description.length` ≤ 500 |
| T-0007-008 | Happy | `outOfScopeTool.input_schema` validates `{capability: 'vision', reason: 'identifies plants from photos'}` |
| T-0007-009 | Failure | `outOfScopeTool.input_schema` rejects `{capability: 'unicorn', reason: 'x'}` |
| T-0007-010 | Failure | `outOfScopeTool.input_schema` rejects reason of 201 chars (>200 cap) |
| T-0007-011 | Boundary | `outOfScopeTool.input_schema` accepts reason exactly 200 chars |
| T-0007-012 | Boundary | `outOfScopeTool.input_schema` rejects empty reason (minLength: 1) |
| T-0007-013 | Boundary | `outOfScopeTool.name === 'out_of_scope'` |
| T-0007-014 | Boundary | `outOfScopeTool.input_schema` `additionalProperties: false` — `{capability: 'vision', reason: 'x', extra: 'y'}` is rejected |
| T-0007-015 | Regression | The generated JSON Schema includes all 28 component type literals in some discriminator: `Screen, Section, Stack, Row, Card, Heading, Body, Caption, TextField, NumberField, DateField, Picker, Switch, Stat, Badge, Chip, Avatar, List, ListItem, SwipeableRow, EmptyState, LoadingState, ConditionalSection, ListSummary, MediaTray, ImagePicker, Button, FAB` |
| T-0007-016 | Regression | The generated JSON Schema includes all 12 action verb type literals: `set, update, reset, addItem, removeItem, updateItem, clearCollection, navigate, back, capture, toast, aiProcess` |
| T-0007-017 | Regression | The generated JSON Schema does NOT include `share` as an action verb literal (F-04 cut) |
| T-0007-018 | Config exhaustion (budget) | `JSON.stringify(produceAppSpecTool).length + JSON.stringify(outOfScopeTool).length` ≤ 25,000 chars (~6,250 tokens; budget headroom over the ~5,000-token estimate). Hard ceiling fails CI on schema bloat |
| T-0007-019 | Boundary (module-cache invariant) | Repeated imports of `produceAppSpec.ts` and `outOfScope.ts` return identical object references (`import x from`; `import y from` → `x === y` for the tool definitions). The module cache guarantees this; no `Object.freeze()` call is required. Test does NOT assert `Object.isFrozen()` — that is an unrelated guarantee. |

#### Step 1 Test Summary

| Category | Count |
|---|---|
| Happy | 3 |
| Failure | 5 |
| Boundary | 7 |
| Regression | 3 |
| Config exhaustion | 1 |
| **Total** | **19** |

### Step 2 Tests

| ID | Category | Description |
|---|---|---|
| T-0007-020 | Happy | `SYSTEM_PROMPT_STATIC` mentions `produce_app_spec` and `out_of_scope` tool names |
| T-0007-021 | Happy | `SYSTEM_PROMPT_STATIC` instructs choice between the two tools ("call out_of_scope instead") |
| T-0007-022 | Regression | `SYSTEM_PROMPT_CATALOG` mentions all 4 archetypes (ListCRUD, Tracker, Journal, Calculator) — at least once each |
| T-0007-023 | Regression | `SYSTEM_PROMPT_CATALOG` mentions all 28 component names (parametrized loop) |
| T-0007-024 | Regression | `SYSTEM_PROMPT_CATALOG` mentions all 12 action verb names (parametrized) |
| T-0007-025 | Regression | `SYSTEM_PROMPT_CATALOG` mentions all 5 binding kinds: `literal, state, collectionField, image, date` |
| T-0007-026 | Regression | `SYSTEM_PROMPT_CATALOG` mentions all 5 out-of-scope capabilities |
| T-0007-027 | Boundary | `SYSTEM_PROMPT_CATALOG.length` ≤ 25,000 chars |
| T-0007-028 | Boundary | `SYSTEM_PROMPT_STATIC.length` ≤ 2,000 chars |
| T-0007-029 | Breaking change | Catalog does NOT mention M1-only components: `Text, Image, TextInput, Toggle, Counter, Form, Container` (parametrized) |
| T-0007-030 | Breaking change | Catalog does NOT mention `Plan` or `produce_plan` |
| T-0007-031 | Breaking change | Catalog does NOT contain the stale "Until ADR-0005 ships" comment |
| T-0007-032 | Regression | Catalog mentions all 4 nav patterns: `none, stack, tabs, modal-overlay` |
| T-0007-033 | Regression | Catalog mentions both stances: `productive, expressive` |
| T-0007-034 | Regression | Catalog mentions all 6 palettes: `focus, health, money, social, learn, play` |
| T-0007-035 | Happy | Catalog includes at least 4 example specs (heuristic: 4 occurrences of `"type":"Screen"`) |

#### Step 2 Test Summary

| Category | Count |
|---|---|
| Happy | 3 |
| Boundary | 2 |
| Regression | 8 |
| Breaking change | 3 |
| **Total** | **16** |

### Step 3 Tests

| ID | Category | Description |
|---|---|---|
| T-0007-036 | Happy | `generateAppSpec({userId, prompt})` with mocked SDK returning valid `produce_app_spec` tool_use yields `done` with parsed `Spec` typed against protocol's `Spec` |
| T-0007-037 | Happy | With mocked tool_use of `out_of_scope`, yields `out_of_scope` event with `capability`, `reason`, `prompt_hash` (sha256 of prompt) |
| T-0007-038 | Happy | Yields `thinking_started` synchronously before first await inside the generator |
| T-0007-039 | Happy | Yields `building_started` on first SDK `content_block_start` event with `content_block.type === 'tool_use'` |
| T-0007-040 | Failure | Mocked tool_use of `produce_app_spec` with `{archetype: 'Garbage'}` → throws `InvalidSpecError` with `detail.kind === 'zod'` |
| T-0007-041 | Failure | Mocked tool_use of `produce_app_spec` with a Zod-valid spec but a `navigate` action whose `target` doesn't exist → throws `InvalidSpecError` with `detail.kind === 'cross_ref'` and `detail.codes` includes `'unknown_screen'` |
| T-0007-042 | Failure | Mocked SDK response with no tool_use block → throws `InvalidSpecError('no_tool_use')` |
| T-0007-043 | Failure | Mocked tool_use with `name: 'phantom_tool'` (neither `produce_app_spec` nor `out_of_scope`) → throws `InvalidSpecError('unknown_tool')` |
| T-0007-044 | Error handling | Mocked SDK 429 → retries with 1s + 2s backoff (sleep called twice) → still 429 → throws `RateLimitedError` |
| T-0007-045 | Error handling | Mocked SDK 500 → throws `AnthropicTransportError` |
| T-0007-046 | Boundary | Mocked stream params: `tool_choice: 'auto'` (not `{type: 'tool', name: '...'}`) |
| T-0007-047 | Boundary | Mocked stream params: `tools` array contains exactly 2 entries (`produce_app_spec`, `out_of_scope`) |
| T-0007-048 | Boundary | Mocked stream params: `max_tokens: 8000` |
| T-0007-049 | Boundary | Mocked stream params: `metadata.user_id` is `hashUserId(opts.userId)`, not the raw `opts.userId` |
| T-0007-050 | Boundary | Mocked stream params: system array has 2 blocks, second with `cache_control: {type: 'ephemeral'}` |
| T-0007-051 | Security | `InvalidSpecError.detail.codes` is `string[]` (no message, no path, no LLM-emitted slot/collection/screen IDs). Test: feed a spec with cross-ref errors referencing a custom slot name `'mySecretSlot'`; assert `'mySecretSlot'` is NOT in the error detail JSON |
| T-0007-052 | Security | User prompt does NOT appear in any error detail (parametrized over `InvalidSpecError` variants) |
| T-0007-053 | Security | User prompt does NOT appear in any telemetry event payload |
| T-0007-054 | Regression | `metadata.user_id` is sha256-hashed, never raw |
| T-0007-055 | Concurrency | Two concurrent `generateAppSpec` calls with different userIds produce independent telemetry events (distinct `generationId`s) |
| T-0007-056 | Happy (telemetry) | On `done` with valid spec, writes `generate.completed` event with payload keys `{generationId, archetype, screens_count, navigation, generation_duration_ms}` |
| T-0007-057 | Happy (telemetry) | On `out_of_scope`, writes `generate.out_of_scope` event with `{generationId, capability, reason_length}` |
| T-0007-058 | Failure (telemetry) | On `InvalidSpecError` (Zod), writes `generate.invalid_spec` with `{generationId, error_kind: 'zod', code_count}` |
| T-0007-059 | Failure (telemetry) | On `InvalidSpecError` (cross-ref), writes `generate.invalid_spec` with `{generationId, error_kind: 'cross_ref', code_count}` |
| T-0007-060 | Failure (telemetry) | Telemetry write failure does NOT block generation (writeEvent rejected → log + continue) |
| T-0007-061 | Config exhaustion | `EVAL_MODE='true'` → telemetry validation runs but DB insert is skipped (mirrors ADR-0004 Step 8 T-0004-103) |
| T-0007-062 | Config exhaustion | `EVAL_MODE='TRUE'` (uppercase) → does NOT short-circuit (case-sensitive — matches existing behavior) |
| T-0007-063 | Config exhaustion | `EVAL_MODE=''` (empty) → does NOT short-circuit |
| T-0007-064 | Config exhaustion | `EVAL_MODE='false'` → does NOT short-circuit |
| T-0007-065 | Config exhaustion | `EVAL_MODE` unset → does NOT short-circuit |
| T-0007-066 | Breaking change | `generateAppSpec()` signature does NOT accept `plan` parameter (TS compile would fail if attempted; runtime ignores extras) |
| T-0007-067 | Breaking change | `done` event payload does NOT contain `plan` field |
| T-0007-068 | Regression | `thinking_duration_ms` and `generation_duration_ms` are still present in `done` and `out_of_scope` event payloads (preserve M1 contract) |
| T-0007-178 | Happy | `generateAppSpec({prompt: 'p', parentPromptContext: 'orig'})` constructs the user message as `'Original app prompt: orig\n\nNew request: p'`. Inspect the messages array passed to `anthropic.messages.stream`. When `parentPromptContext` is undefined, message content equals `prompt` verbatim. |
| T-0007-181 | Security | `out_of_scope` SSE event's `reason` field is re-validated ≤ 200 chars at SSE emission time. Synthetic mocked tool input with 201-char reason (bypassing SDK input_schema enforcement) MUST throw `InvalidSpecError('invalid_spec', {kind: 'zod', codes: ['too_big']})`. Silent truncation on a security boundary is forbidden. |
| T-0007-182 | Regression | SSE wire protocol: the `out_of_scope` path terminates with `data: [DONE]\n\n` (same terminator as the `done` path). `/generate` route always closes the stream cleanly regardless of which tool fires. |

#### Step 3 Test Summary (post round-2)

| Category | Count |
|---|---|
| Happy | 7 |
| Failure | 7 |
| Boundary | 5 |
| Error handling | 2 |
| Security | 4 |
| Regression | 3 |
| Concurrency | 1 |
| Config exhaustion | 5 |
| Breaking change | 2 |
| **Total** | **36** |

### Step 4 Tests

| ID | Category | Description |
|---|---|---|
| T-0007-069 | Happy | POST `/generate` with valid prompt (mocked SDK → valid `produce_app_spec` tool_use): SSE stream emits `thinking_started`, `building_started`, `done` with project metadata; `done.spec` is a `Spec` from protocol |
| T-0007-070 | Happy | POST `/generate` triggering `out_of_scope` tool: SSE emits `out_of_scope` event; **no row inserted** in `projects` or `project_versions` |
| T-0007-071 | Happy | `done.project.title` derived from spec's first Heading text |
| T-0007-072 | Happy | `done.render_hash` matches `renderHash(spec)` from `@app-creator/protocol` (not from `lib/canonical.ts`) |
| T-0007-073 | Failure | POST `/generate` without auth: 401 `unauthorized`, no SSE stream opened |
| T-0007-074 | Failure | POST `/generate` with empty body: 400 `invalid_input`, no SSE |
| T-0007-075 | Failure | POST `/generate` with prompt 2001 chars: 400 `invalid_input`, no SSE |
| T-0007-076 | Failure | POST `/generate` with prompt that pushes input over 12,000 chars: 400 `prompt_too_large`, no SSE |
| T-0007-077 | Failure | Mocked InvalidSpecError (Zod): SSE emits `error` event with `{code: 'invalid_spec', detail: {kind: 'zod', codes: [...]}}`; `detail.codes` is `string[]`; no `message` field; no LLM-emitted strings |
| T-0007-078 | Failure | Mocked InvalidSpecError (cross-ref): SSE emits `error` with `{code: 'invalid_spec', detail: {kind: 'cross_ref', codes: [...]}}` |
| T-0007-079 | Failure | Mocked AnthropicTransportError: SSE emits `error` with `{code: 'internal'}`, `statusCode: 500` |
| T-0007-080 | Failure | Mocked RateLimitedError: SSE emits `error` with `{code: 'rate_limited'}`, `statusCode: 503` |
| T-0007-081 | Failure | Rate limit exceeded: 429 `rate_limited` with `Retry-After`, no SSE |
| T-0007-082 | Boundary | `parent_project_id` of a public project → resolves; `parent_project_id` of owner's private → resolves; unowned private → 404; nonexistent → 404 |
| T-0007-083 | Regression | SSE wire protocol: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`, `Connection: keep-alive` |
| T-0007-084 | Regression | Each SSE event is `data: <json>\n\n` |
| T-0007-085 | Regression | Terminator is `data: [DONE]\n\n` |
| T-0007-086 | Regression | Client disconnect mid-generation: server keeps streaming; project persisted; `client_disconnect_during_generate` logged at INFO |
| T-0007-087 | Security | Error response (any code) does NOT contain raw prompt |
| T-0007-088 | Security | Error response does NOT contain LLM-emitted strings (custom slot names, screen IDs, collection IDs) |
| T-0007-089 | Security | Error response does NOT contain a stack trace |
| T-0007-090 | Breaking change | POST `/generate` body schema does NOT contain a `plan` field; if sent, it's silently dropped (Zod strict mode in body schema) |
| T-0007-091 | Breaking change | `done` event payload does NOT include `plan` field |
| T-0007-092 | Breaking change | `done` event payload **does** include `generationId` (new in V0; client uses for log correlation) |
| T-0007-093 | Breaking change | Title fallback CHANGES from ADR-0001's `"Untitled"` to "first 40 chars of `originalPrompt`, whitespace-trimmed, then truncated with `…` suffix if longer." Covered exhaustively by T-0007-099. This T-ID is the breaking-change marker; T-0007-099 carries the behavioral assertion. |
| T-0007-094 | Happy (service) | `projectsService.create({ownerId, spec, originalPrompt})` returns `ProjectDetail`; inserts one row in `projects`, one in `project_versions` |
| T-0007-095 | Happy (service) | `projectsService.create` computes `renderHash` from `@app-creator/protocol` (not from M1's `lib/canonical.ts`). Verify by hash byte-equality against a known fixture |
| T-0007-096 | Regression (service) | `project_versions.plan_json` is NULL on V0 inserts |
| T-0007-097 | Failure (service) | `projectsService.create` re-validates the spec server-side; a spec that passes `SpecSchema.parse` but fails `validateCrossRefs` throws |
| T-0007-098 | Breaking change (service) | `projectsService.create` signature does NOT accept `plan` parameter |
| T-0007-099 | Boundary (service) | Title derivation algorithm is locked: walk `spec.screens[0].root` depth-first, return the first `Heading.text` (whitespace-trimmed). Fallback to first 40 chars of `originalPrompt` (whitespace-trimmed, then truncated, plus "…" suffix if truncation occurred per ADR-0001 T-0001-059). Decision: `screens[0]`, not `screens[initialScreenId]`, to keep title independent of nav state. Test cases: (a) Heading in screens[0].root → use it; (b) screens[0].root has no Heading but screens[1].root does → fall back to prompt (screens[1] not consulted); (c) no Heading anywhere + prompt longer than 40 chars → first 40 chars + "…"; (d) no Heading + prompt ≤ 40 chars → full prompt, no ellipsis; (e) no Heading + empty prompt → literal `"Untitled"` |
| T-0007-100 | Concurrency (service) | Two concurrent `create` calls produce distinct project IDs and version IDs |
| T-0007-101 | Mobile contract | `apps/mobile/src/state/queries/generate.ts` SSE consumer handles `out_of_scope` event type; mobile contract test asserts the event is parsed and surfaced to UI |
| T-0007-179 | Boundary | POST `/generate` with `prompt` of 2000 chars + `parent_project_id` resolving to a parent whose `original_prompt` is 11000 chars: combined input exceeds 12000-char gate → 400 `prompt_too_large`, no SSE. Verifies T-0007-076 is reachable in production (via parentPromptContext composition). |
| T-0007-180 | Boundary | `migrateCollectionData(parentVersionId, newSpec)` in V0 returns `{}` regardless of inputs. Cases: (a) parent version with collections, new spec with overlapping collections → `{}`; (b) nonexistent parent version → `{}`; (c) parent version with M1-shape `specJson` → `{}`. Locks the V0 stub so V0.5's flip-on is detected when this test starts failing. |

#### Step 4 Test Summary (post round-2)

| Category | Count |
|---|---|
| Happy | 6 |
| Failure | 10 |
| Boundary | 4 |
| Regression | 5 |
| Security | 3 |
| Breaking change | 5 |
| Concurrency | 1 |
| Mobile contract | 1 |
| **Total** | **35** |

### Step 5 Tests

| ID | Category | Description |
|---|---|---|
| T-0007-102 | Happy | Migration creates `out_of_scope_intent` table; all CHECK constraints active (capability enum, prompt_hash length, reason length, email length) |
| T-0007-103 | Happy | POST `/out-of-scope-intent` with valid body returns 200 `{captured: true}`; row inserted |
| T-0007-104 | Happy | POST with `email: null` (omitted): row inserted with NULL email |
| T-0007-105 | Failure | POST without auth: 401 |
| T-0007-106 | Failure | POST with capability `'unicorn'`: 400 `invalid_input` |
| T-0007-107 | Failure | POST with `prompt_hash` of 63 hex chars: 400 |
| T-0007-108 | Failure | POST with `prompt_hash` of 65 hex chars: 400 |
| T-0007-109 | Failure | POST with `prompt_hash` containing non-hex chars: 400 |
| T-0007-110 | Failure | POST with `reason` of 201 chars: 400 |
| T-0007-111 | Failure | POST with `reason` empty: 400 |
| T-0007-112 | Failure | POST with malformed email (`'not-an-email'`): 400 |
| T-0007-113 | Failure | POST with `email` of 321 chars: 400 |
| T-0007-114 | Boundary | `reason` exactly 200 chars: accepted |
| T-0007-115 | Boundary | `prompt_hash` of 64 hex chars: accepted |
| T-0007-116 | Boundary | `email` exactly 320 chars: accepted |
| T-0007-117 | Security | `user_id` in inserted row is the authenticated user, NOT any value the client could supply |
| T-0007-118 | Security | Client cannot specify `id`, `user_id`, or `created_at` (those columns are server-managed) |
| T-0007-119 | Concurrency | Two concurrent inserts produce distinct rows |
| T-0007-120 | Failure | Rate limit exceeded: 429 |
| T-0007-121 | Happy (telemetry) | On successful insert, writes `out_of_scope_intent_captured` event with `{capability, has_email}` |
| T-0007-122 | Config exhaustion | `EVAL_MODE='true'`: telemetry validation runs, DB insert still happens for the `out_of_scope_intent` row (eval-mode applies to telemetry only, not to user-data writes) |
| T-0007-123 | Regression | Capability enum in DB CHECK matches the closed enum in `outOfScopeTool` (both include `'unknown'`) |
| T-0007-183 | Regression | `prompt_hash` determinism round-trip: given prompt P, `sha256Hex(P)` computed in `generateAppSpec` (the value emitted in the SSE `out_of_scope` event via `mockOutOfScope({...prompt: P})`) equals the hash accepted by `/out-of-scope-intent` when POSTed back from the test. Catches encoding-mismatch bugs (utf-8 vs utf-16; normalize forms; pre-hash whitespace handling). |
| T-0007-185 | Boundary | `/out-of-scope-intent` `prompt_hash` validation enforces lowercase-only sha256: accepts `[a-f0-9]{64}` exactly. Cases: (a) 64-char lowercase hex → 200 `{captured: true}`; (b) 64-char uppercase hex `[A-F0-9]{64}` → 400 `invalid_input`; (c) 64-char mixed-case → 400; (d) any non-hex char → 400. Locks canonical form to `sha256Hex`'s lowercase output. |

#### Step 5 Test Summary (post round-2)

| Category | Count |
|---|---|
| Happy | 4 |
| Failure | 10 |
| Boundary | 4 (+1: T-185) |
| Security | 2 |
| Concurrency | 1 |
| Config exhaustion | 1 |
| Regression | 2 (+1: T-183 prompt_hash determinism) |
| **Total** | **24** |

### Step 6 Tests

| ID | Category | Description |
|---|---|---|
| T-0007-124 | Breaking change | `services/api/src/llm/planner.ts` does not exist |
| T-0007-125 | Breaking change | `services/api/src/llm/planner.test.ts` does not exist |
| T-0007-126 | Breaking change | `services/api/src/llm/prompts/planner.ts` does not exist |
| T-0007-127 | Breaking change | `services/api/src/llm/pipeline.ts` does not exist |
| T-0007-128 | Breaking change | `services/api/src/llm/pipeline.test.ts` does not exist |
| T-0007-129 | Breaking change | `services/api/src/llm/tools/producePlan.ts` does not exist |
| T-0007-130 | Breaking change | `services/api/src/llm/tools/produceAppSpecPatch.ts` does not exist |
| T-0007-131 | Breaking change | `services/api/src/llm/serializePlan.ts` does not exist |
| T-0007-132 | Breaking change | `services/api/src/llm/patchValidation.ts` does not exist |
| T-0007-133 | Breaking change | `services/api/src/routes/edit.ts` does not exist |
| T-0007-134 | Breaking change | `services/api/src/services/specValidation.ts` does not exist |
| T-0007-135 | Breaking change | `services/api/src/lib/canonical.ts` does not exist |
| T-0007-135a | Breaking change | `services/api/src/llm/tools/producePlan.test.ts` does not exist |
| T-0007-135b | Breaking change | `services/api/src/llm/tools/produceAppSpecPatch.test.ts` does not exist |
| T-0007-135c | Breaking change | `services/api/src/llm/serializePlan.test.ts` does not exist (if it existed pre-Step-6) |
| T-0007-135d | Breaking change | `services/api/src/llm/patchValidation.test.ts` does not exist |
| T-0007-135e | Breaking change | `services/api/src/routes/edit.test.ts` does not exist |
| T-0007-135f | Breaking change | `services/api/src/services/specValidation.test.ts` does not exist |
| T-0007-136 | Breaking change | `grep -rn "from '@app-creator/a2ui-schema'" services/api/src` returns zero matches |
| T-0007-137 | Breaking change | `grep -rn "from '@app-creator/a2ui-schema'" services/api/test` returns zero matches |
| T-0007-138 | Breaking change | `grep -rn "from '@app-creator/a2ui-schema'" services/api/eval` returns zero matches |
| T-0007-139 | Breaking change | `services/api/package.json` does NOT list `@app-creator/a2ui-schema` in `dependencies` |
| T-0007-140 | Breaking change | `EVENT_PAYLOAD_WHITELIST` does NOT contain keys for: `plan.completed`, `plan.timeout_fallback`, `plan.invalid_fallback`, `plan.unknown_fallback`, `plan.transport_fallback`, `build.completed`, `build.conformance_fallback`, `edit.completed`, `edit.patch_out_of_scope_fallback` |
| T-0007-141 | Regression | `EVENT_PAYLOAD_WHITELIST` contains keys for: `generate.completed`, `generate.invalid_spec`, `generate.out_of_scope`, `out_of_scope_intent_captured` |
| T-0007-142 | Regression | Each new event type's whitelist matches the actual call site (parametrized: dispatch each event with whitelisted keys, expect no throw; with unknown key, expect `EventPayloadValidationError`) |
| T-0007-143 | Breaking change | `env.ts` does NOT define `PLAN_BUILD_PIPELINE_PERCENT`, `PLAN_BUILD_PIPELINE_SHADOW`, `PLAN_BUILD_EVAL_MODE` |
| T-0007-144 | Regression | `env.ts` defines `EVAL_MODE` with `z.enum(['true', 'false']).default('false')` |
| T-0007-145 | Regression | `EVAL_MODE='true'` triggers telemetry short-circuit |
| T-0007-146 | Breaking change | `env.ts` does NOT contain the contradictory-state check (lines 95–102 of M1 — no shadow + percent=100 conflict) |
| T-0007-147 | Breaking change | `services/api/src/index.ts` (or main app entry) does NOT register the `/me/projects/:projectId/edit` route |
| T-0007-148 | Regression | After deletion sweep, `pnpm --filter @app-creator/api test` passes with zero failures across these kept files (parametrized — each is a discrete assertion): `services/api/src/llm/generate.test.ts`, `services/api/src/llm/anthropic.test.ts`, `services/api/src/llm/telemetry.test.ts`, `services/api/src/llm/tools/produceAppSpec.test.ts`, `services/api/src/llm/tools/outOfScope.test.ts`, `services/api/src/llm/prompts/system.test.ts`, `services/api/src/routes/generate.test.ts`, `services/api/src/routes/outOfScope.test.ts`, `services/api/src/routes/auth.test.ts`, `services/api/src/routes/library.test.ts`, `services/api/src/routes/marketplace.test.ts`, `services/api/src/routes/projects.test.ts`, `services/api/src/routes/health.test.ts`, `services/api/src/services/projects.service.test.ts`, `services/api/src/services/outOfScope.service.test.ts`, `services/api/src/services/library.service.test.ts`, `services/api/src/services/marketplace.service.test.ts`, `services/api/src/services/users.service.test.ts`, `services/api/src/services/auth.service.test.ts`, `services/api/src/db/schema.test.ts`, `services/api/src/lib/env.test.ts`. Verified by running `pnpm --filter @app-creator/api test --listFailures` post-merge; output must be empty. |
| T-0007-149 | Breaking change | `.claude/references/adr-index.md` shows ADR-0004 status: **Superseded by ADR-0007** |
| T-0007-150 | Regression | `.claude/references/adr-index.md` contains a row for ADR-0007 with appropriate tags (`llm, prompts, generation, v0`) |
| T-0007-151 | Breaking change | `docs/adrs/ADR-0004-plan-build-pipeline.md` status header reads "Superseded" |
| T-0007-184 | Breaking change | After deletion sweep: POST `/me/projects/:projectId/edit` returns **404** (route not registered). Live runtime test against the running API; complements the source-level T-0007-147 (route file unregistered). Verifies the deletion is observable at the API boundary, not just in source. |

#### Step 6 Test Summary (post round-2)

| Category | Count |
|---|---|
| Breaking change | 29 (22 original + 6 .test.ts file existence T-135a..f + T-184 live-404) |
| Regression | 6 |
| **Total** | **35** |

### Step 7 Tests

| ID | Category | Description |
|---|---|---|
| T-0007-152 | Happy | `prompts.ts` exports `ARCHETYPE_PROMPTS` with exactly 100 entries |
| T-0007-153 | Boundary | `ARCHETYPE_PROMPTS` has exactly 25 entries per archetype (4 × 25 = 100) |
| T-0007-154 | Regression | Each `ARCHETYPE_PROMPTS` entry's `expected_archetype` is in the closed set `[ListCRUD, Tracker, Journal, Calculator]` |
| T-0007-155 | Happy | `prompts.ts` exports `OUT_OF_SCOPE_DETECTION_PROMPTS` with exactly 30 entries |
| T-0007-156 | Boundary | `OUT_OF_SCOPE_DETECTION_PROMPTS` has exactly 6 entries per capability (5 × 6 = 30) |
| T-0007-157 | Regression | Each detection prompt's `expected_capability` is in the closed enum (5 capabilities, no `unknown` in this set) |
| T-0007-158 | Happy | `prompts.ts` exports `OUT_OF_SCOPE_FALSE_POSITIVE_PROMPTS` with exactly 30 entries |
| T-0007-159 | Regression | Each false-positive prompt has both `expected_archetype` (the in-scope archetype) and `brushes_against` (capability tag) |
| T-0007-160 | Happy | `run.ts --mode=v0` against the 100 archetype prompts (mocked SDK returning valid specs): exits 0 if pass rate ≥90% and per-archetype ≥80% |
| T-0007-161 | Failure | `run.ts --mode=v0` with mocked failures pushing pass rate to 85%: exits 1 with `FAIL: ...` message |
| T-0007-162 | Failure | `run.ts --mode=v0` with all ListCRUD prompts failing (overall 75%): exits 1; per-archetype check fires |
| T-0007-163 | Happy | `run.ts --mode=out-of-scope-detection` against 30 prompts (mocked SDK returns `out_of_scope` tool_use with matching capability): exits 0 if detection ≥95% |
| T-0007-164 | Failure | `run.ts --mode=out-of-scope-detection` with 28/30 detected (93%): exits 1 |
| T-0007-165 | Happy | `run.ts --mode=out-of-scope-false-positive` against 30 prompts (mocked SDK returns `produce_app_spec`): exits 0 if false-positive ≤5% |
| T-0007-166 | Failure | `run.ts --mode=out-of-scope-false-positive` with 3/30 falsely-detected (10%): exits 1 |
| T-0007-167 | Boundary | `run.ts` default mode (no `--mode` flag): runs `v0` mode |
| T-0007-168 | Failure | `run.ts --mode=garbage`: exits 1 with usage message |
| T-0007-169 | Regression | Source-level assertion: `fs.readFileSync('services/api/eval/run.ts', 'utf8')` and assert the first non-blank, non-comment, non-empty line is exactly `process.env['EVAL_MODE'] = 'true'` (or equivalent assignment to `'true'`). NOT a runtime check — a runtime check would pass regardless of ordering and miss the bug. ADR-0004 Step 9 has the same pattern; reuse the helper. |
| T-0007-170 | Boundary | Results JSON is written to `services/api/eval/results/{ISO-timestamp}-{mode}.json` |
| T-0007-171 | Security | Results JSON's `per_prompt` entries do NOT contain raw `prompt` field; only `prompt_id` is exposed |
| T-0007-172 | Regression | Results JSON includes `summary` (pass rate / accuracy / detection rate) and `per_prompt` array |
| T-0007-173 | Breaking change | `run.ts` does NOT have `--mode=legacy`, `--mode=planner`, `--mode=new`, or `--mode=shadow` |
| T-0007-174 | Regression | `scoreArchetype.ts` matches V0 spec.archetype field directly (no heuristic inference); given a `Spec` with `archetype: 'Tracker'`, returns `'Tracker'` |
| T-0007-175 | CI | `.github/workflows/eval.yml` triggers on PRs touching `services/api/src/llm/**`, `packages/protocol/**`, `packages/a2ui-renderer/src/v0/components/**` |
| T-0007-176 | CI | The eval CI job runs `--mode=v0` (the threshold gate) |
| T-0007-177 | Concurrency | `run.ts` processes prompts sequentially (no parallel SDK calls — matches ADR-0004 Step 9 to avoid rate-limit storms) |

### Round-2 Additions Index (audit pointer only — descriptions live in the Step Tests tables above)

| T-ID | Step | Located in |
|---|---|---|
| T-0007-135a..f | 6 | Step 6 Tests (inline) |
| T-0007-178 | 3 | Step 3 Tests (inline) |
| T-0007-179 | 4 | Step 4 Tests (inline) |
| T-0007-180 | 4 | Step 4 Tests (inline) |
| T-0007-181 | 3 | Step 3 Tests (inline) |
| T-0007-182 | 3 | Step 3 Tests (inline) |
| T-0007-183 | 5 | Step 5 Tests (inline) |
| T-0007-184 | 6 | Step 6 Tests (inline) |
| T-0007-185 | 5 | Step 5 Tests (inline) |

**Total after round-2 additions: 191 T-IDs.** Original 177 + 14 added:

- T-135a through T-135f (6 deletion `.test.ts` file existence checks — Step 6)
- T-178 through T-185 (8 round-2 additions — Steps 3, 4, 5, 6)

Per-step changes:

- Step 3: 33 → 36 (T-178, T-181, T-182 added)
- Step 4: 33 → 35 (T-179, T-180 added)
- Step 5: 22 → 24 (T-183, T-185 added)
- Step 6: 28 → 35 (T-135a..f + T-184 added)

Steps 1, 2, 7 unchanged.

**Round-2 additions are inlined into their respective Step Tests tables above (not in this section alone). This block is a pointer-only audit index.**

#### Step 7 Test Summary

| Category | Count |
|---|---|
| Happy | 6 |
| Failure | 5 |
| Boundary | 4 |
| Regression | 6 |
| Breaking change | 1 |
| Security | 1 |
| Concurrency | 1 |
| CI | 2 |
| **Total** | **26** |

### Test Totals (post round-2)

| Step | New | Regression carried forward | Total |
|---|---|---|---|
| 1 | 19 | 0 | 19 |
| 2 | 16 | 0 | 16 |
| 3 | 36 | 0 | 36 |
| 4 | 35 | 0 | 35 |
| 5 | 24 | 0 | 24 |
| 6 | 35 | 0 | 35 |
| 7 | 26 | 0 | 26 |
| **Total** | **191** | **0** | **191** |

**Category distribution recount (round-2 totals):**

Summed strictly from the Step Summary tables below:

| Category | Step 1 | Step 2 | Step 3 | Step 4 | Step 5 | Step 6 | Step 7 | Total |
|---|---|---|---|---|---|---|---|---|
| Happy | 3 | 3 | 7 | 6 | 4 | 0 | 6 | **29** |
| Failure | 5 | 0 | 7 | 10 | 10 | 0 | 5 | **37** |
| Boundary | 7 | 2 | 5 | 4 | 4 | 0 | 4 | **26** |
| Error handling | 0 | 0 | 2 | 0 | 0 | 0 | 0 | **2** |
| Security | 0 | 0 | 4 | 3 | 2 | 0 | 1 | **10** |
| Regression | 3 | 8 | 3 | 5 | 2 | 6 | 6 | **33** |
| Concurrency | 0 | 0 | 1 | 1 | 1 | 0 | 1 | **4** |
| Config exhaustion | 1 | 0 | 5 | 0 | 1 | 0 | 0 | **7** |
| Breaking change | 0 | 3 | 2 | 5 | 0 | 29 | 1 | **40** |
| Mobile contract | 0 | 0 | 0 | 1 | 0 | 0 | 0 | **1** |
| CI | 0 | 0 | 0 | 0 | 0 | 0 | 2 | **2** |
| **Total** | **19** | **16** | **36** | **35** | **24** | **35** | **26** | **191** |

Negative-pattern (Failure + Breaking change + Security): **37 + 40 +
10 = 87**.

Happy-pattern: **29**.

Ratio: **3:1 negative-leaning** — above the 1:1 rule of thumb.

### Test Helpers & Mocks

- **`mockAnthropicSDK`** — already exists in `services/api/test/mocks/anthropic.ts`.
  Rewrite for V0: drop M1 imports, generate fixtures from `@app-creator/protocol`.
  Provide helpers:
  - `mockProduceAppSpec(spec)` — yields a complete SSE stream ending in `done` with `spec`.
  - `mockOutOfScope({capability, reason, prompt})` — yields a complete SSE stream
    ending in `out_of_scope` with the given capability, reason, AND `prompt_hash`
    computed as `sha256Hex(prompt)`. The `prompt` parameter is required so T-0007-183
    (round-trip determinism) can assert that the hash emitted by the mock matches
    `sha256Hex(prompt)` computed independently in the test.
  - `mockNoToolUse()` — yields a response with no tool_use block.
  - `mockTransportError(status)` — rejects with an SDK error of the given status.
- **`mockEnv`** — set/unset `EVAL_MODE`. Mirror `mockPlanBuildEvalMode` from M1.
- **`makeValidSpec`** — factory in `services/api/test/factories.ts`. Returns
  a valid V0 `Spec` from the 4 demo fixtures with optional overrides.
- **`makeInvalidSpec`** — variants for Zod failures and cross-ref failures.
- **`makeOutOfScopeInput`** — `{capability, reason}` with valid defaults.

### Coverage Gates

- New V0 surface (`services/api/src/llm/generate.ts`, `prompts/system.ts`,
  `tools/produceAppSpec.ts`, `tools/outOfScope.ts`, `routes/outOfScope.ts`,
  `services/outOfScope.service.ts`): ≥ 90% lines, ≥ 80% branches.
- Telemetry (`services/api/src/llm/telemetry.ts`): kept at existing
  threshold (set by ADR-0004 Step 8).
- Route `/generate`: ≥ 90% lines (carryover from ADR-0002).
- Eval harness: ≥ 80% (the modes themselves are tested via the harness's
  own test file).

---

## UX Requirements

Sable owns the surface; ADR-0007 names the integration points:

- **Out-of-scope detection UX** — when the `out_of_scope` SSE event fires,
  mobile renders a form: capability description + email field (optional) +
  "Notify me" button + dismiss. Copy per canvas-v0.md §AC-O2. On submit,
  POST `/out-of-scope-intent` with `{capability, prompt_hash, reason,
  email}`. On dismiss, the screen returns to Create.
- **M1 spec expiration UX** — when the renderer rejects an existing
  M1-shape spec, the error boundary shows "This tool needs to be
  re-created. Tap to re-create from your original prompt." Copy and
  illustration owned by Sable; tap action calls `/generate` with the
  saved `original_prompt`.
- **`/edit` removal UX** — the meatball "Make changes" affordance still
  exists; it routes through the existing Create flow with the original
  prompt pre-filled (canvas-v0.md User Flow §"Re-prompt-to-edit path").
  No client-side change needed beyond removing the now-unused edit
  surface; the mobile chat-edit flow is already wired against `/generate`
  in V0 thinking.

---

## Data Sensitivity

| Service Method | Returns | Sensitivity |
|---|---|---|
| `generateAppSpec()` (LLM module) | `AsyncGenerator<GenerateEvent>` | `auth-only` — events contain user-bound `generationId`. `spec` payload is owner-data. Error envelopes filtered: only closed-enum codes returned (no LLM-emitted strings) |
| `projectsService.create({ownerId, spec, originalPrompt})` | `ProjectDetail` | `auth-only` — full spec + version is owner-only. `original_prompt` is owner-only. List endpoints continue to exclude `specJson` per ADR-0001 |
| `outOfScopeService.captureIntent({userId, capability, promptHash, reason, email?})` | `void` | `auth-only` — the row is owner-bound. No read endpoint in V0; aggregate analytics live outside the request path. `prompt_hash` is opaque (sha256); `email` is PII (stored, never returned via API) |
| `outOfScopeService` (none) | — | No `get` or `list` method in V0. Read access for V0.5 prioritization analytics is via a separate analytics path (Langfuse or Postgres analytics user) — out of scope here |
| `flattenZodIssues(err)` | `string[]` (codes only) | `public-safe` — the codes are bounded enums. **MUST NOT** be expanded to return `path` or `message` |
| **`out_of_scope` SSE event `reason` field** | `string` ≤ 200 chars (LLM-emitted, user-visible) | **DOCUMENTED EXCEPTION** to "no LLM-emitted strings to clients" rule (Constraint §7). The `reason` is intentionally surfaced to the mobile client for UX display ("This would need vision — coming next update"). Length is capped at 200 chars by the tool's `input_schema` (Step 1, T-0007-010) AND re-validated at SSE emission time (T-0007-181, Step 3). The risk: a user's prompt containing PII could be echoed into `reason` by the LLM. Mitigations: (a) 200-char cap limits surface area; (b) `reason` is shown in-app only, never logged; (c) prompt_hash (not raw prompt) is what server stores. **No further filtering at the API boundary** — the field passes through verbatim. |

**Excluded from all responses:**

- LLM-emitted strings (collection IDs, slot names, screen IDs, field names) — would leak via Zod path or cross-ref message
- Raw user prompt (only in Langfuse traces, never in DB or API responses)
- Stack traces and SDK error details (filtered via `safeMessage`)
- Other users' specs, intents, or telemetry events
- `out_of_scope_intent` rows (no read endpoint in V0)

---

## CI/CD Impact

| Job | Config File | Impact | Required Change |
|---|---|---|---|
| `services/api typecheck` | `services/api/tsconfig.json` | Schema imports change; failing typecheck signals incomplete migration | Step 3 closes the cutover; Step 6 removes the workspace dep |
| `services/api lint` | `services/api/eslint.config.mjs` | Deleted files removed automatically | None |
| `services/api test` | `services/api/jest.config.cjs` | Test surface shrinks (planner.test.ts, pipeline.test.ts, edit.test.ts gone); new tests in Steps 1–7 | Step 6 deletes; Steps 1–7 add |
| Eval workflow | `.github/workflows/eval.yml` | Mode references update; new mode `out-of-scope-detection`; thresholds change | Step 7 |
| Mobile typecheck/test | `apps/mobile/jest.config.js` | `useGenerateMutation`'s SSE consumer handles new `out_of_scope` event | Step 4 (mobile contract change in same PR as route change) |

---

## Notes for Colby

### Step ordering — strict and not

- **Steps 1 and 2 are parallel-safe.** Land them in any order, including
  same PR. They have no dependency on each other.
- **Steps 3 + 4 + 5 land together in one PR.** Half-states (V0 generate.ts
  with M1 route, or V0 route without `out_of_scope_intent` table) are not
  shippable. Single coordinated change.
- **Step 6 must follow Step 3 + 4 + 5.** Deletion requires the new path to
  work in CI.
- **Step 7 follows Step 6.** Re-authoring the eval set against deleted
  code is wasted effort.

### Things that look like they should be done but aren't

1. **The `migrateCollectionData` stub in projectsService.** I specified
   the shape but it's a no-op for V0. Mobile-side persistence handles V0
   collection data. The stub is here so V0.5 can flip it on without
   re-shaping `create()`. Don't actually compute the migration in V0 —
   return `{}`. Document the deferral inline.

2. **`scoreArchetype.ts` heuristic deletion.** The M1 file infers archetype
   from a spec by walking nodes. In V0, `archetype` is an explicit field on
   `Spec`. The function collapses to `return spec.archetype`. Keep the file
   for the eval harness but the body shrinks to one line.

3. **Mobile chat-edit flow.** ADR-0006 already removed the edit affordance
   from the mobile chat UI (the V0 cutover at Step 11). Confirm before
   Step 6 that no mobile code path still references `/edit`. If it does,
   that's a Step 4 fix (mobile-side), not a Step 6 fix.

### Things that will surprise you

1. **`tool_choice: 'auto'` type-cast.** The Anthropic SDK 0.92.0 types may
   not have a clean variant for `'auto'` when `tools` has multiple
   entries. ADR-0004 needed `as any` casts for `tool_choice: {type: 'tool', name: '...'}`
   (see generate.ts:124). Same dance here. Annotate with `// eslint-disable-next-line @typescript-eslint/no-explicit-any` and a comment pointing at this ADR's §C.

2. **The SSE consumer in mobile is a separate codepath from the renderer.**
   ADR-0006 work was inside the renderer. Step 4 of this ADR adds the
   `out_of_scope` event handler in `apps/mobile/src/state/queries/generate.ts`
   (the hook that consumes the SSE stream). Tests for that live in
   `apps/mobile/src/state/queries/generate.test.ts`.

3. **`flattenZodIssues` signature change is breaking.** It currently
   returns `Array<{path: string, message: string, code: string}>`. After
   ADR-0007 it returns `string[]` (codes only). Every call site must
   update. Grep before deleting the old shape.

4. **`writeEvent` payload validation runs even in EVAL_MODE.** That's the
   point — eval-mode catches whitelist violations during eval runs (when
   the call sites are exercised heavily) without writing to the analytics
   DB. Make sure the new event types' whitelists are correct on the first
   commit; eval will catch you fast.

5. **Sub-step coupling in Step 4.** The route, service, and mobile SSE
   consumer all change. The route changes are obvious; the service
   change (drop `plan`) is obvious; the mobile change (handle
   `out_of_scope`) is easy to forget. Land all three in one commit.

6. **The contradictory-state check in env.ts** (`PERCENT=100 + SHADOW=true`
   rejected) protects ADR-0004's correctness. After deletion of the env
   vars in Step 6, that check goes too. Don't leave a now-dead constraint.

### Sequencing recommendation for the implementer

Suggested PR shape:

- **PR 1** = Step 1 + Step 2 + Step 5 (the table + endpoint can land
  independently because nothing else depends on it; useful to land first
  for shape feedback).
- **PR 2** = Step 3 + Step 4 (the cutover — generate.ts + routes + service
  + mobile SSE handler in one shot).
- **PR 3** = Step 6 (deletion).
- **PR 4** = Step 7 (eval).

PR 2 is the largest and most consequential. Plan for review time.

### What to escalate

- The condensed few-shot examples in Step 2 are real prompt-engineering
  work. If they don't produce passing eval results on the first
  threshold run, escalate before iterating; the brief allocated week-5
  buffer for this and the planner-fallback path is a documented
  safety net.
- If `tool_choice: 'auto'` produces wrong-tool selection at >5% rate
  on eval (Step 7 §AC-O5 false-positive ≤5% threshold), escalate.
  Possible mitigations: tighten system prompt language; add explicit
  out-of-scope examples in the catalog block. Don't change the
  architecture; tune the prompt.
- If the JSON Schema bloats past T-0007-018's budget, escalate. The
  protocol schema is the canonical source — bloat usually signals
  unwarranted union complexity. Trim at the schema level, not by
  hand-pruning the generated output.

# ADR-0004: Plan → Build Generation Pipeline

_Authored by Cal — 2026-05-05_

## Status

**Accepted** — Sponsor (Alyona) signed off 2026-05-05. Roz test-spec review: rev-0 returned REVISE → rev-1 closed 9 of 11 findings → rev-2 sharpened T-0004-121 (schema-derived key walk) and T-0004-122 (explicit `for await` collection). **Roz APPROVED rev-2 on 2026-05-05.** Both gates closed. Ready for Colby to begin Step 1.

### Roz findings (rev-1) — closed by this revision

| Finding                                                                                                                                              | Severity | Resolution                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------- |
| `/library/:id` `plan_json` leak claim was uncovered (T-0002-119 cannot cover a column that didn't exist when it was written) — `normalizeRow` lesson | **P0**   | Added T-0004-121. Data Sensitivity table updated to remove the false T-0002-119 carryover claim.         |
| `runPipeline(PERCENT=0)` byte-for-byte regression claim was only tested at route level, not at module level                                          | **P0**   | Added T-0004-122 (module-level snapshot).                                                                |
| T-0004-082 had an "or" formulation that allowed an implementation passing only one of two paths                                                      | High     | Split into T-0004-082a (SDK honors signal) and T-0004-082b (SDK swallows signal; Promise.race fallback). |
| T-0004-107 said "verifies" without specifying the assertion                                                                                          | High     | Rewritten to specify per-event-type rejection assertion.                                                 |
| `key_components: z.array(z.string())` allowed empty string elements (real schema bug, not just test gap)                                             | Medium   | Schema fixed to `.min(1)` on element. T-0004-118 added.                                                  |
| `target_paths: ['/']` (root pointer) would functionally disable scope guard                                                                          | Medium   | Schema refined to reject root-only paths. T-0004-119 added.                                              |
| `role` max length boundary uncovered                                                                                                                 | Medium   | T-0004-117 added.                                                                                        |
| Step 4 failure-ratio violation (4 happy : 1 negative)                                                                                                | Medium   | T-0004-125 added (`getVersion` not-found).                                                               |
| Shadow-mode DB-down behavior on `writeEvent` uncovered                                                                                               | Medium   | T-0004-120 added.                                                                                        |
| SHADOW env var: empty string and whitespace cases uncovered                                                                                          | Low      | T-0004-123, T-0004-124 added.                                                                            |
| `writeEvent` whitelist tested only on `plan.completed`, not on other event types                                                                     | Low      | T-0004-116 added (build.completed specifically).                                                         |

### Resolutions to open questions (Sponsor 2026-05-05)

| OQ   | Resolution                                                                                                                                                                          |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OQ-1 | **Defer Langfuse.** Telemetry via `events` table for M2. Revisit at M3.                                                                                                             |
| OQ-2 | **Default Haiku 4.5 on planner.** Swap-to-Sonnet decision deferred to Phase-B data. One-line change in `services/api/src/llm/models.ts` if needed.                                  |
| OQ-3 | **`target_paths` (positive allow-list) confirmed.** Renames the brief's `target_node_ids` + `do_not_touch_allowlist` to a single field with stricter semantics (forbid-by-default). |
| OQ-4 | **Per-model caches confirmed.** ~1.5× cost vs. M1 accepted; Anthropic-side constraint, not a discretionary choice.                                                                  |
| OQ-5 | **Edit cancellation follows `/generate` rule** — client disconnect does not abort generation; new version persists; user finds it on next refresh. Consistency with ADR-0002 §O.    |
| OQ-6 | **$500 Phase-B Anthropic spend cap.** Daily check on `events.duration_ms` aggregations. Eva (DevOps) to confirm dashboard wiring before Phase B starts.                             |

## Context

M1 shipped a single-call generation pipeline (ADR-0002): user prompt →
Anthropic Sonnet with forced `tool_choice` on `produce_app_spec` →
A2UI spec → render. It works for single-screen apps. It does not scale
to M2's targets:

- **SO-1 (structural coherence)** — ≥80% of generations produce ≥2 screens with appropriate navigation. M1 has no place to _decide_ nav before the spec is being written.
- **SO-3 (breadth across 8 archetypes, ≥75% per-archetype floor)** — M1 has no archetype routing; the model picks "what kind of app this is" implicitly while it's also picking components and content.
- **SO-4 (edit preservation, ≥90%)** — M1 has no edit endpoint. When we add one as a single-call patch generator, asking one LLM call to simultaneously _understand intent_ and _emit a JSON Patch_ is the failure mode that today's M1 blueprint would inherit.

The M2 milestone brief (`docs/product/M2-milestone.md` §Architectural
Anchor, Sponsor-approved 2026-05-05) locks the architectural shift to a
two-stage **Plan → Build** pipeline:

1. **Plan stage** — small/fast LLM call. Decides archetype, screens,
   navigation, and (on edits) edit-intent. Catalog- and rubric-aware.
   Cannot emit an A2UI spec.
2. **Build stage** — heavyweight LLM call. Renders the plan into an A2UI
   spec or RFC 6902 patch. Cannot override archetype, screens, or
   navigation.

> **What if we do nothing (don't write this ADR):** the engineer wires
> multi-screen generation against the existing single-call path,
> discovers in week 4 that SO-4 edit preservation is unreachable because
> intent and patch are tangled in one LLM call, and we either (a)
> retrofit a planner under deadline pressure with no migration plan, or
> (b) ship M2 with edit preservation at ~70% and quietly miss SO-4.
> That's the failure mode this ADR exists to prevent.

### Constraints inherited from M1 (and discovered the hard way)

These shape every decision below:

1. **Forced `tool_choice` is non-negotiable** (CLAUDE.md §3, ARCHITECTURE.md §6). It is how we guarantee structured output. The model never emits free-text JSON.
2. **Extended thinking + forced `tool_choice` is rejected by the Anthropic API.** ADR-0002 §D claimed they could be combined; M1 implementation discovered they cannot (`services/api/src/llm/generate.ts:93-101`, where thinking was stripped). **Neither the planner nor the builder may use extended thinking** in this ADR.
3. **Anthropic prompt cache is per-model, not per-process.** A cached block on Sonnet is _not_ a cache hit on Haiku. The brief's claim that "both calls share the cached catalog block" cannot be implemented as written — they are separate caches. We treat them as such (§F below).
4. **`max_tokens: 8000` cap on builder output** (CLAUDE.md §3). Planner is much smaller (≤1500).
5. **All Anthropic calls go through `services/api/src/llm/`** (CLAUDE.md §3). No SDK instantiation at route handlers.
6. **A2UI schema is unchanged.** The plan schema is a _new_ contract that lives next to A2UI.

### Prior art reviewed

- **ADR-0001-foundation.md** — auth, schema, projects service. Stays load-bearing; we add a column to `project_versions` (Step 4) and otherwise leave foundation intact.
- **ADR-0002-generation-publish.md** — current generation pipeline. We extend; we do **not** replace. M1 single-call path remains the fallback (§F-3).
- **ADR-0003-renderer.md** — A2UI renderer. Untouched by this ADR; navigation primitives (TabBar, StackHeader, Modal) are a separate ADR (ADR-0005, future).
- **`.claude/references/retro-lessons.md`** — the `normalizeRow` and `userCount` lessons drive the Data Sensitivity table below. The "incomplete tests from ADR-only reading" lesson drives test categories.

---

## Decision

Build a **Plan → Build pipeline** as an **additive** generation path,
gated by feature flag and percent rollout, with the M1 single-call path
preserved as fallback. Both stages are one-shot tool calls (no
streaming on planner; existing SSE on builder unchanged). The plan is
persisted on `project_versions` as a nullable `plan_json` column.

### Architectural choices, with rationale

#### A. Pipeline orchestrator lives in `services/api/src/llm/pipeline.ts`

A new module that imports `producePlan` (Step 2) and the existing
`generateAppSpec` (M1) and `generateAppSpecConditioned` (Step 3,
plan-aware variant). The orchestrator is the only thing routes call;
routes never branch between planner-on/planner-off — that decision
lives inside the orchestrator.

Why a new module rather than expanding `generate.ts`? Because the
orchestrator's job is _routing and fallback_, not LLM mechanics. Mixing
the two inside `generate.ts` is exactly the tangle the Plan → Build
split is supposed to fix at the LLM layer; we're not going to recreate
it at the module layer.

#### B. Planner uses `claude-haiku-4-5-20251001`; one-shot, no thinking

Tool: `produce_plan` (Step 1) with forced `tool_choice`. `max_tokens: 1500`.
12 s wall-clock timeout (2 s buffer over the 10 s p95 budget).

Why Haiku and not Sonnet? Cost and latency. Plan reasoning is
short-form and structured — Haiku 4.5 is sufficient at <1/4 the cost
and ~5 s typical latency. If eval shows Haiku is insufficient, we swap
to Sonnet at the planner level via a single config knob (§K). Default
to Haiku; document the override.

Why not extended thinking on the planner? See constraint 2 — Anthropic
rejects thinking with forced `tool_choice`. Forced tool choice is
non-negotiable because the plan is the contract we condition the
builder on. We cannot accept a planner that emits free-text reasoning
that the builder must parse.

#### C. Builder is `claude-sonnet-4-6`; existing streaming SSE preserved

Tool: existing `produce_app_spec` for full generation; new
`produce_app_spec_patch` (Step 7) for edits. `max_tokens: 8000`. 90 s
wall-clock timeout (10 s buffer over the 80 s p95 budget). Streams as
today.

The builder's only change vs. M1 is _plan injection_ (§D). Otherwise
SSE protocol, error envelope, retry behavior, rate limit, and prompt-
size guard are unchanged.

#### D. Plan injected as a third **system block**, not a fake assistant message

This is the meaningful design choice in §3 of the brief. I went with
the system-block approach. Three reasons:

1. **Cache hit on the catalog still holds.** The catalog block has
   `cache_control: {type: 'ephemeral'}` (Step 3 of ADR-0002, currently
   `services/api/src/llm/generate.ts:106-112`). If we inject the plan
   _before_ the catalog, every per-request plan invalidates the cache
   for the catalog. If we inject the plan _after_ the catalog as a
   third system block (uncached), the catalog cache hit survives — the
   prompt cache matches by exact prefix up to the cached block, so a
   variable suffix doesn't break it.
2. **No conversation faking.** Synthesizing an assistant turn ("Here's
   the plan: …") followed by a synthetic user turn ("Now build it") is
   awkward and potentially confusing to the model. The system slot is
   the natural home for "rules for this generation."
3. **Keeps `messages` clean.** The mobile client's chat history (the
   `messages` table) is the user-visible conversation. Plan content
   does not belong there.

Concretely:

```ts
system: [
  {type: 'text', text: BUILDER_STATIC}, // unchanged from M1
  {type: 'text', text: SYSTEM_PROMPT_CATALOG, cache_control: {type: 'ephemeral'}}, // unchanged
  {type: 'text', text: serializePlan(plan)}, // new, per-request, uncached
]
```

The builder's static prompt is amended (Step 3) with the rule:

> If a plan block is present, you MUST honor it. The output spec MUST
> have exactly `plan.screens.length` views, with view ids matching
> `plan.screens[].id`, and the navigation pattern that the plan
> specifies. Do not invent extra screens; do not collapse screens.

#### E. Builder output is validated against the plan at parse time

After Zod-parsing the spec, a _plan-conformance check_ runs:

- `spec.views.length === plan.screens.length`
- `spec.views.map(v => v.id).sort()` deep-equals `plan.screens.map(s => s.id).sort()`
- `spec.initialViewId === plan.screens[0].id`
- For `plan.navigation === 'none'`: zero `navigate` actions in the spec
- For `plan.navigation in {stack, tabs, tabs+stack, modal-overlay}`: at least one `navigate` action wired (renderer-level nav primitives ship in ADR-0005; M2-pre-ADR-0005, navigation is realized via `Button` + `navigate` action — already supported in the M1 catalog and renderer)

On conformance failure, the builder is re-prompted **once** with a
diagnostic message ("Your spec did not conform to the plan: <reason>.
Fix the spec to match `plan.screens` exactly."). On second failure,
return `plan_violation` error to the caller. No silent retries; no
plan-mutation to match the spec.

#### F. Plan and build use _separate_ cached system blocks

The brief asked me to "share the cached catalog block on both calls."
That's not how Anthropic prompt cache works — cache scope is per model.
A cache hit on Sonnet is invisible to a Haiku call.

The slimming opportunity: the planner does not need the full catalog
prose with examples (3000 tokens of `SYSTEM_PROMPT_CATALOG`). It needs
the **archetype taxonomy + nav rubric + a 1–2-line summary of each
catalog primitive** so it knows what's emittable without dictating
_how_ to emit it.

Concretely:

```ts
// Planner system blocks (Haiku cache):
[
  {type: 'text', text: PLANNER_STATIC},      // ~300 tokens, uncached
  {type: 'text', text: PLANNER_CONTEXT,      // ~1200 tokens, ephemeral cached
   cache_control: {type: 'ephemeral'}},
]

// Builder system blocks (Sonnet cache, unchanged):
[
  {type: 'text', text: BUILDER_STATIC},                        // ~500 tokens, uncached
  {type: 'text', text: SYSTEM_PROMPT_CATALOG,                  // ~3000 tokens, ephemeral cached
   cache_control: {type: 'ephemeral'}},
  {type: 'text', text: serializePlan(plan)},                   // ~400 tokens, per-request, uncached
]
```

Cost comparison vs. M1:

| Item                           | M1 single-call         | Plan→Build                                     |
| ------------------------------ | ---------------------- | ---------------------------------------------- |
| Sonnet input tokens (cached)   | 3000 (catalog)         | 3000 (catalog, same cache hit on warm session) |
| Sonnet input tokens (uncached) | ~500 (static) + prompt | ~500 + ~400 (plan) + prompt                    |
| Sonnet output tokens           | ≤8000                  | ≤8000                                          |
| Haiku input tokens (cached)    | 0                      | 1200 (planner context, separate cache)         |
| Haiku input tokens (uncached)  | 0                      | ~300 + prompt                                  |
| Haiku output tokens            | 0                      | ≤1500                                          |

Net: ~1.5× cost of M1 single-call (Sonnet portion ~unchanged + Haiku
portion is a small fraction of Sonnet pricing). Sponsor accepted.

#### G. Plan persisted as `plan_json` column on `project_versions`, nullable

Schema decision (Step 4):

```ts
export const projectVersions = pgTable('project_versions', {
  // existing columns unchanged
  planJson: jsonb('plan_json'), // nullable
})
```

Why a column on `project_versions` rather than a separate
`project_version_plans` table?

1. The plan is 1:1 with the version (every plan-driven version has
   exactly one plan; no version has multiple plans). A separate table
   adds a join with no payoff.
2. `project_versions` is already write-once-immutable; the plan
   inherits the same lifecycle.
3. Existing code reads `project_versions` by `id` to load a spec for
   the AppRunner; appending the plan to that read is one less query
   when edit-preservation logic needs it (SO-4).

Why nullable?

- The M1 single-call fallback path (§F-3 below, archetype = `unknown`)
  produces versions with no plan — `plan_json IS NULL` is the explicit
  signal that this version came from the legacy path.
- ADR-0001 produced rows pre-this-ADR; they remain `plan_json IS NULL`
  forever. No backfill.

For analytics, archetype distribution is queried via the `events`
table (Step 8 telemetry), not via JSONB introspection on
`project_versions`. The two consumers are separate; we don't denormalize.

> **Data sensitivity:** the plan is _not_ PII. It contains the
> archetype label, screen sketches, navigation choice, and (on edits)
> a list of paths. The user's prompt is **not** stored in the plan
> (the prompt lives in `projects.original_prompt` per ADR-0002 §G and
> in `messages`, never duplicated into `plan_json`). See Data
> Sensitivity table below.

#### F-3. The M1 single-call path remains alive as fallback

Kept-alive triggers (any one fires the legacy single-call):

1. Feature flag `PLAN_BUILD_PIPELINE_PERCENT=0` and
   `PLAN_BUILD_PIPELINE_SHADOW=false` (Phase A: code shipped, never
   exercised live).
2. Percent-routing miss: `hash(userId) mod 100 >= PLAN_BUILD_PIPELINE_PERCENT`.
3. Planner returns `archetype: 'unknown'`.
4. Planner timeout (12 s) — fall back, log `plan_timeout_fallback`.
5. Planner emits a Zod-invalid plan after 1 retry — fall back, log
   `plan_invalid_fallback`.
6. Plan-conformance failure on the builder after 1 retry — fall back,
   log `plan_conformance_fallback`. (This is the loud failure: the
   plan was valid but the builder couldn't honor it. Worth a separate
   alert.)

The fallback path runs the existing `generateAppSpec` from
`services/api/src/llm/generate.ts` unchanged. Result is persisted with
`plan_json IS NULL`.

This is **load-bearing for SO-5**. M2 must not regress M1's success
rate. The fallback is the safety net that guarantees we don't.

#### H. Edit flow uses path-based intent (not node-id-based)

Robert's brief specified `target_node_ids[]`. I'm pushing back, with
rationale: the A2UI schema makes `id` _optional_ on most nodes
(`Heading`, `Text`, `Image`, `Button`, `List`, `Form`, `Container`).
Only `TextInput`, `Toggle`, `Counter` require `id`. We cannot address
arbitrary nodes by id without first injecting ids into the spec — and
injecting ids on every node post-generation is a separate workstream
that broadens this ADR's blast radius.

Path-based intent uses RFC 6901 JSON Pointer paths
(e.g. `/views/0/root/children/2`). Pointers are unambiguous against an
existing spec, work for all node types, and align with the RFC 6902
patch ops the builder is already going to emit. Since edits are
single-shot ("apply this edit to _this_ spec"), pointer fragility under
concurrent mutation is not a concern.

Plan schema (edits):

```ts
edit_intent?: {
  target_paths: string[],   // JSON pointers; builder MAY touch only descendants of these
}
```

The builder's emitted patch is validated: every patch op's `path` (and
`from` for `move`/`copy`) must be **equal to or a descendant of** at
least one entry in `target_paths`. Any op outside is rejected. On
rejection: re-prompt builder once with the diagnostic ("Patch op at
<path> violates edit_intent.target_paths"); on second failure, return
`patch_out_of_scope` error. The user retries; we do not silently retry.

This collapses the brief's `target_node_ids` + `do_not_touch_allowlist`
into a single field with positive semantics ("only these paths"). It's
strictly more conservative — anything outside is forbidden by default,
which is the right default for SO-4.

#### I. Planner has its own `traceId`; builder's `traceId` references it

Both stages emit `events` rows (Step 8). Each generation has a single
`generationId` (UUID) that ties planner.completed and build.completed
together. The `events.payload_json` carries `{generationId, archetype,
screens_count, navigation, duration_ms}` for both events.

Langfuse SDK is **not** added in this ADR. CLAUDE.md §3 references
`trace()` aspirationally; no Langfuse import exists in the codebase
today (verified). Adding it is its own decision (cross-org
observability vendor); deferring to a future ADR. Local `events` rows
are sufficient for D1 (analytics instrumentation) — Data/Analytics
queries `events` directly.

#### J. Latency budget enforcement is wall-clock + AbortSignal, not Anthropic-side

`AbortController` with `setTimeout(controller.abort(), 12_000)` for the
planner; `90_000` for the builder. Anthropic SDK 0.92.0 honors
`AbortSignal` on `messages.create` and `messages.stream`. On abort:
the inflight HTTP request is closed, the SDK throws an abort error,
the orchestrator catches and falls back (planner) or surfaces
`generation_timed_out` (builder).

Why not Anthropic-side `timeout` param? The SDK has it, but it's
total-request-budget, not per-stage. Our budgets are per stage. Use
AbortController for fine control.

#### K. Two new env vars, no model overrides

```
PLAN_BUILD_PIPELINE_PERCENT  — 0..100, integer string. Default '0'.
                               hash(userId) mod 100 < PERCENT routes
                               to plan-build; otherwise legacy single-call.
PLAN_BUILD_PIPELINE_SHADOW   — 'true' | 'false'. Default 'false'.
                               If true: planner runs on every request,
                               result is logged to events, but the
                               legacy single-call result is what the
                               client receives. (Phase B.)
```

No env override for planner/builder model. Hard-coded constants in
`services/api/src/llm/models.ts`. If we need to swap models, that's
a code change with a code review, not an env tweak. Reduces blast
radius of misconfiguration.

#### L. No `generationId` table; use `events.payload_json.generationId` for joins

The `events` table is already the analytics audit log (ADR-0001). Add
two new event types: `plan.completed`, `build.completed`. No schema
migration; both write into existing `events.payload_json`.

If analytics needs cross-stage joins later (e.g., "for which generations
did the plan archetype not match the resulting spec's de-facto
archetype?"), they SELF-JOIN `events` on
`payload_json->>'generationId'`. No new table.

---

## Alternatives Considered

### Alternative 1: Replace the M1 single-call path entirely (no fallback)

- **Upside:** Simpler. One code path. No flag, no percent routing, no fallback bookkeeping.
- **Downside:** SO-5 says "zero P0 bugs in 2-week internal dogfood." If the planner is buggy in a way we don't catch in eval, every generation breaks until we revert. There's no safety net. The migration plan (Phase A → B → C) requires the legacy path to coexist.
- **Why not:** Risk-averse delivery (architect skill default). The legacy path costs us almost nothing — it's already shipped, already tested, already in CI. Keeping it alive is the cheap insurance.

### Alternative 2: Plan injected as a fake assistant turn in `messages`

- **Upside:** Aligns with Anthropic's tool-use idioms (tool results in messages, not system).
- **Downside:** Synthesizing turns the user didn't speak is dishonest to the model and to debugging. The `messages` table on our side stores actual conversation; a synthetic plan turn would muddy that line. Also: the plan is a _constraint_, not _content_ — system block is the natural slot.
- **Why not:** §D rationale. System block (after the cached catalog) is the right home.

### Alternative 3: Single LLM call with a multi-step "plan then spec" prompt

- **Upside:** No second API call. Cost and latency stay closer to M1. No orchestration.
- **Downside:** This is what M1 already is, plus a longer prompt. The model still tangles intent and structure inside a single tool call. The whole point of Plan → Build is the _separation_ into two structured artifacts, each Zod-validated. A "step-by-step" single call is theatrical reasoning, not architectural reasoning.
- **Why not:** Doesn't reach SO-4. The whole rationale falls apart.

### Alternative 4: Plan stored in a separate `project_version_plans` table

- **Upside:** Clean separation. Easier to add per-archetype index for analytics.
- **Downside:** Adds a join on every spec read. The plan is 1:1 with the version; the table buys nothing meaningful.
- **Why not:** §G rationale. Column wins on simplicity and the analytics path goes through `events` regardless.

### Alternative 5: Use node IDs (not paths) for edit-intent, with mandatory ID injection on every generation

- **Upside:** Edit-intent reads more naturally ("change the third button").
- **Downside:** Requires changing the A2UI schema (or post-generation injection that bloats specs). Either is a bigger change than M2 needs. ID injection has its own correctness story (collisions, stability across versions).
- **Why not:** §H rationale. JSON Pointer paths are unambiguous and aligned with RFC 6902 patches the builder already emits. Node-id schema work can be a future ADR if SO-4 numbers say it's needed.

### Alternative 6: Add Langfuse for tracing in this ADR

- **Upside:** Vendor-grade observability. Distributed tracing, cost dashboards, prompt versioning.
- **Downside:** New SaaS dependency. Auth/secret management. Separate procurement. The `events` table covers our M2 needs (D1 analytics) without it.
- **Why not:** Defer. Not in this ADR's blast radius. CLAUDE.md §3 referencing `trace()` is aspirational; we update the doc to clarify (Documentation Impact below).

### Alternative 7: Sonnet for both planner and builder

- **Upside:** Higher plan quality on hard prompts.
- **Downside:** ~3–4× planner cost; ~2× planner latency. The plan task is structured and short — Haiku is right-sized.
- **Why not:** §B rationale. Default Haiku; treat Sonnet-on-planner as an eval-driven decision (open question OQ-2 below).

---

## Consequences

### Positive

- **SO-1, SO-3, SO-4 become reachable.** Architecture matches what the metrics demand.
- **Debuggability** improves dramatically. Every multi-screen generation has a structured plan we can read, replay, and grade independently of the spec.
- **Migration plan is reversible at every stage.** Feature flag + percent rollout means a regression at 10% is a 10%-blast-radius bug; we revert with one env-var change.
- **Eval-time replay** becomes possible. Future ADRs (especially SO-4 work in ADR-0007) can replay the same plan against a tweaked builder prompt and grade builder regressions in isolation.
- **The legacy single-call path stays in CI** as the fallback. We do not lose M1's regression coverage.

### Negative

- **Two LLM calls instead of one.** Cost ~1.5× per generation. Sponsor accepted. Cost dashboards in the `events` table will show the actual delta within Week 4 of M2.
- **Two more env vars to manage.** `PLAN_BUILD_PIPELINE_PERCENT` and `PLAN_BUILD_PIPELINE_SHADOW`. Both have safe defaults (0 / false). Misconfiguration risk: setting `PERCENT=100` while `SHADOW=true` is contradictory; we document and validate at boot (Step 5).
- **Plan-conformance failures are a new failure mode.** A plan-valid+spec-valid pair that doesn't match each other is a hole in our generation logic that didn't exist in M1. Mitigated by §E re-prompt + the §F-3 fallback. We measure conformance failure rate as a first-class metric.
- **The `generate.ts` async generator interface is unchanged at the SSE layer**, but the orchestrator wraps it with a different pre-step. Test isolation discipline matters more (see §Test Spec): Step 5 gets its own integration tests; planner unit tests do not exercise the builder.

### Risks

| Risk                                                                                                                            | Likelihood              | Mitigation                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Haiku 4.5 plan quality is insufficient and SO-3 archetype routing accuracy <85%                                                 | Medium                  | OQ-2 — first eval gate is a planner-only run on the 30-prompt M1 set + the new 150-prompt M2 set. If <85% archetype accuracy, swap to Sonnet on planner via the model-constants change (one PR).                                                                                                                            |
| Plan-conformance re-prompt loop runs hot (~10% of generations need a retry) and bumps p95 over 90 s                             | Medium                  | T-0004-072/073 measure retry rate. If retry rate >5% sustained, Robert decides whether to (a) tighten the planner prompt's screen-sketch fidelity (often the cause), or (b) drop the conformance check and fall back instead.                                                                                               |
| Plan column on `project_versions` adds row size; jsonb indexing isn't free if a future feature wants archetype-by-jsonb queries | Low                     | We don't query `plan_json` in any hot path. Analytics goes through `events`. If a need emerges, add a generated column or a partial index. Not in this ADR.                                                                                                                                                                 |
| AbortSignal not propagated through Anthropic SDK 0.92.0 cleanly                                                                 | Low                     | T-0004-082 explicitly tests abort behavior. If the SDK swallows the abort, we wrap the call in a `Promise.race([sdkCall, timeoutReject])` instead. Document the discovery.                                                                                                                                                  |
| Phase B "shadow" mode doubles Anthropic spend during dual-shadow weeks                                                          | Medium _(but accepted)_ | Capped to internal traffic during Phase B (Phase B = pre-alpha dogfood). Robert pre-approved up to $500 of shadow-mode spend in the M2 budget. Step 8's `events` rows track per-day cost.                                                                                                                                   |
| `events` row volume explosion (two events per generation × eval runs of 150 prompts × N iterations)                             | Low                     | `events` already has indexes on `(event_type, created_at)`. Eval runs use a flag (`PLAN_BUILD_EVAL_MODE=true`) that skips DB writes for events; eval results are written to `services/api/eval/results/<timestamp>.json` instead.                                                                                           |
| ADR-0005 (renderer + nav primitives) lands later than expected, planner emits TabBar plans the builder cannot render            | High _(but contained)_  | Until ADR-0005 ships, the planner is told (in `PLANNER_CONTEXT`) that the _only_ navigation realization is `Button` + `navigate` action. When ADR-0005 ships, `PLANNER_CONTEXT` is updated in lockstep. The plan schema is forward-compatible: `navigation: 'tabs'` is meaningful regardless of which renderer realizes it. |

---

## Implementation Plan

Nine steps, ordered by dependency. Steps 1–4 are foundational and
independent. Step 5 wires them. Steps 6–7 are user-facing endpoints.
Step 8 is telemetry. Step 9 is eval.

### Step 1: Plan schema + planner tool definition

- **Files to create**:
  - `packages/a2ui-schema/src/plan.ts` — Zod schemas: `PlanArchetypeSchema` (closed enum: 8 archetypes + `unknown`), `PlanNavigationSchema` (`none | stack | tabs | tabs+stack | modal-overlay`), `PlanScreenSchema` (`{id, role, purpose, key_components}`), `PlanEditIntentSchema` (`{target_paths: string[]}`), `PlanSchema` (full plan with `version: 1`, `archetype`, `screens` (1–4), `navigation`, optional `edit_intent`).
  - `services/api/src/llm/tools/producePlan.ts` — Anthropic tool definition; `input_schema` derived from `PlanSchema` via `zod-to-json-schema`. Description text directs the model to choose the most fitting archetype and emit screens with stable string ids.
- **Files to modify**:
  - `packages/a2ui-schema/src/index.ts` — re-export `PlanSchema`, `Plan`, `PlanArchetype`.
  - `packages/a2ui-schema/src/index.test.ts` — add Plan schema validation tests.

**Acceptance criteria**:

- `PlanSchema.parse({version: 1, archetype: 'Calculator', screens: [{id: 'main', role: 'home', purpose: 'enter inputs', key_components: ['Form','Button']}], navigation: 'none'})` succeeds.
- `archetype` outside the 9-element closed set fails with a Zod issue at path `['archetype']`.
- `screens.length > 4` fails.
- `screens.length === 0` fails.
- `navigation === 'none'` is allowed only when `screens.length === 1` (superRefine).
- `edit_intent.target_paths` requires non-empty array of strings; each string must start with `/`.
- The tool's `input_schema` round-trips: `JSON.parse(JSON.stringify(producePlanTool.input_schema))` deep-equals the original (snapshot test).
- Plan can be Zod-parsed in <1 ms (snapshot perf check).

**Estimated complexity:** Low.

**Code shape:**

```ts
// packages/a2ui-schema/src/plan.ts
import {z} from 'zod'

export const PLAN_VERSION = 1 as const

export const PlanArchetypeSchema = z.enum([
  'ListCRUD',
  'Tracker',
  'Calculator',
  'Journal',
  'Dashboard',
  'SocialFeed',
  'InfoDisplay',
  'SimpleGame',
  'unknown',
])

export const PlanNavigationSchema = z.enum(['none', 'stack', 'tabs', 'tabs+stack', 'modal-overlay'])

export const PlanScreenSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]{0,31}$/), // stable, lowercase
  role: z.string().min(1).max(40),
  purpose: z.string().min(1).max(200),
  // Element .min(1) prevents empty-string component names (rev-1, Roz).
  key_components: z.array(z.string().min(1)).min(1).max(8),
})

export const PlanEditIntentSchema = z.object({
  // Refinement rejects root-only pointer ('/') — would functionally disable
  // the scope guard since every path is a descendant of root (rev-1, Roz).
  target_paths: z
    .array(
      z
        .string()
        .startsWith('/')
        .refine(p => p !== '/', 'root pointer disables scope guard'),
    )
    .min(1)
    .max(20),
})

export const PlanSchema = z
  .object({
    version: z.literal(PLAN_VERSION),
    archetype: PlanArchetypeSchema,
    screens: z.array(PlanScreenSchema).min(1).max(4),
    navigation: PlanNavigationSchema,
    edit_intent: PlanEditIntentSchema.optional(),
  })
  .superRefine((plan, ctx) => {
    if (plan.navigation === 'none' && plan.screens.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "navigation 'none' requires exactly one screen",
        path: ['navigation'],
      })
    }
    const ids = new Set(plan.screens.map(s => s.id))
    if (ids.size !== plan.screens.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'screen ids must be unique',
        path: ['screens'],
      })
    }
  })
export type Plan = z.infer<typeof PlanSchema>
```

---

### Step 2: Planner module + planner prompt

- **Files to create**:
  - `services/api/src/llm/prompts/planner.ts` — exports `PLANNER_STATIC` (assistant role + plan rules) and `PLANNER_CONTEXT` (archetype taxonomy, nav rubric, slim catalog summary). Slim catalog is one-line-per-component (10 lines today; updated in lockstep with ADR-0005).
  - `services/api/src/llm/planner.ts` — exports `producePlan(opts: {userId, prompt, currentSpec?, currentPlan?, signal?: AbortSignal}): Promise<Plan>`. Calls Anthropic Haiku with forced `tool_choice` on `produce_plan`. Returns the validated plan or throws `PlannerInvalidError | PlannerTimeoutError | PlannerTransportError`.
  - `services/api/src/llm/models.ts` — exports `PLANNER_MODEL = 'claude-haiku-4-5-20251001' as const` and `BUILDER_MODEL = 'claude-sonnet-4-6' as const`. One file, hard-coded; documents the model swap as a code change.
- **Files to modify**:
  - `services/api/src/llm/errors.ts` — add `PlannerInvalidError`, `PlannerTimeoutError`, `PlannerTransportError`, `PlanConformanceError`, `PatchOutOfScopeError`. Each has a stable `code`.

**Acceptance criteria**:

- `producePlan({userId, prompt: 'tip splitter calculator'})` returns a `Plan` with `archetype === 'Calculator'`, `screens.length === 1`, `navigation === 'none'` on a happy-path mocked Anthropic response.
- On Anthropic 429 after retries (same retry policy as M1: 2 attempts, 1 s + 2 s backoff), throws `PlannerTransportError` (not `RateLimitedError` — keep planner errors namespaced for fallback decisions).
- On Zod-invalid plan, calls Anthropic **once** more with a diagnostic; on second invalid, throws `PlannerInvalidError` with `detail: <flattened zod issues>`.
- On `signal.aborted` (12 s timeout from caller): throws `PlannerTimeoutError`.
- `metadata.user_id` is hashed (sha256, first 16 chars) — same hash function as `generate.ts:29`.
- `system: [{type: 'text', text: PLANNER_STATIC}, {type: 'text', text: PLANNER_CONTEXT, cache_control: {type: 'ephemeral'}}]`.
- `tool_choice: {type: 'tool', name: 'produce_plan'}`. `tools: [producePlanTool]`. `max_tokens: 1500`. `model: PLANNER_MODEL`.
- For edit calls (`currentSpec` and `currentPlan` provided): the messages array carries the prior plan (as a human-readable JSON), the prior spec (as a human-readable JSON), and the user's edit prompt. Three messages: `assistant: <prior plan JSON>`, `assistant: <prior spec JSON>`, `user: <edit prompt>` — actual model input via `messages` array.
- No streaming. `anthropic.messages.create()`, not `.stream()`.

**Estimated complexity:** Medium.

**Code shape:**

```ts
// services/api/src/llm/planner.ts
export async function producePlan(opts: {
  userId: string
  prompt: string
  currentSpec?: A2UISpec
  currentPlan?: Plan
  signal?: AbortSignal
}): Promise<Plan> {
  const messages = buildPlannerMessages(opts)
  let attempts = 0
  let lastError: unknown
  while (attempts < 2) {
    try {
      const response = await anthropic.messages.create(
        {
          model: PLANNER_MODEL,
          max_tokens: 1500,
          metadata: {user_id: hashUserId(opts.userId)},
          system: [
            {type: 'text', text: PLANNER_STATIC},
            {type: 'text', text: PLANNER_CONTEXT, cache_control: {type: 'ephemeral'}},
          ],
          tools: [producePlanTool] as any,
          tool_choice: {type: 'tool', name: 'produce_plan'},
          messages: attempts === 0 ? messages : [...messages, diagnosticTurn(lastError)],
        },
        {signal: opts.signal},
      )
      const toolBlock = response.content.find(b => b.type === 'tool_use')
      if (!toolBlock) throw new PlannerInvalidError('no_tool_use')
      return PlanSchema.parse(toolBlock.input)
    } catch (err) {
      if (isAbortError(err)) throw new PlannerTimeoutError()
      if (err instanceof ZodError) {
        lastError = err
        attempts++
        continue
      }
      // 429 retries handled by underlying client retry policy here (mirrors generate.ts)
      throw mapPlannerTransportError(err)
    }
  }
  throw new PlannerInvalidError('invalid_plan', flattenZodIssues(lastError))
}
```

---

### Step 3: Builder plan-conditioning + plan-conformance check

- **Files to create**:
  - `services/api/src/llm/specValidation.ts` already exists (used in M1); add `validatePlanConformance(spec: A2UISpec, plan: Plan): {ok: true} | {ok: false; reason: string}`.
- **Files to modify**:
  - `services/api/src/llm/prompts/system.ts` — add `BUILDER_STATIC` rule paragraph: "If a plan block follows the catalog, it MUST be honored verbatim — exactly `plan.screens.length` views with matching ids; navigation as specified." Existing `SYSTEM_PROMPT_STATIC` kept as-is but renamed to `BUILDER_STATIC` (or kept with a new export for clarity); `SYSTEM_PROMPT_CATALOG` unchanged.
  - `services/api/src/llm/generate.ts` — add `plan?: Plan` to `generateAppSpec` opts. When `plan` is provided: append a third system block `{type: 'text', text: serializePlan(plan)}` (uncached). After Zod parse but before yielding `done`, call `validatePlanConformance`; on failure, re-prompt the builder once with a diagnostic turn; on second failure, throw `PlanConformanceError`. The legacy code path (no `plan`) is unchanged byte-for-byte except for the rename.

**Acceptance criteria**:

- Existing M1 callers (no `plan` arg) hit the same code path with no behavioral diff. Snapshot tests for the existing tool definition pass unchanged.
- With `plan: {archetype: 'Calculator', screens: [{id: 'main', ...}], navigation: 'none'}`, the builder is sent a third system block containing a JSON-serialized plan; `messages.create` `system` array has length 3.
- `validatePlanConformance(spec, plan)` returns `{ok: false, reason: 'view_count_mismatch'}` when `spec.views.length !== plan.screens.length`.
- `validatePlanConformance` returns `{ok: false, reason: 'view_id_mismatch'}` when ids don't match.
- `validatePlanConformance` returns `{ok: false, reason: 'navigation_violation'}` when `plan.navigation === 'none'` but the spec has any `navigate` action.
- After one re-prompt round with diagnostic, if the spec still fails conformance, `generateAppSpec` throws `PlanConformanceError(reason)`.
- `serializePlan(plan)` produces deterministic output (snapshot test).

**Estimated complexity:** Medium.

**Code shape:**

```ts
// services/api/src/llm/specValidation.ts
export function validatePlanConformance(
  spec: A2UISpec,
  plan: Plan,
): {ok: true} | {ok: false; reason: string} {
  if (spec.views.length !== plan.screens.length) return {ok: false, reason: 'view_count_mismatch'}
  const specIds = new Set(spec.views.map(v => v.id))
  for (const s of plan.screens)
    if (!specIds.has(s.id)) return {ok: false, reason: `view_id_mismatch:${s.id}`}
  if (spec.initialViewId !== plan.screens[0].id) return {ok: false, reason: 'initial_view_mismatch'}
  if (plan.navigation === 'none' && hasNavigateAction(spec))
    return {ok: false, reason: 'navigation_violation'}
  return {ok: true}
}
```

---

### Step 4: DB migration — `plan_json` on `project_versions`

- **Files to create**:
  - `services/api/migrations/0005_plan_json.sql`:
    ```sql
    ALTER TABLE project_versions
      ADD COLUMN IF NOT EXISTS plan_json jsonb;
    ```
  - `services/api/migrations/0005_plan_json.test.ts` — testcontainer test asserting (a) fresh-DB migrate succeeds, (b) ADR-0001-migrated DB migrate succeeds without data loss, (c) idempotent (re-run is no-op).
- **Files to modify**:
  - `services/api/src/db/schema.ts` — add `planJson: jsonb('plan_json')` to `projectVersions` (nullable; no default).
  - `services/api/src/services/projects.service.ts` — `create()` and the future `applyEdit()` (Step 7) accept optional `plan: Plan`; if provided, write to `plan_json`. If absent, leave NULL. Update return shape to include `planJson` (nullable) for callers that need it.

**Acceptance criteria**:

- Migration runs cleanly on fresh and migrated DBs (testcontainer).
- Idempotent re-run is a no-op.
- `projects.service.create({...})` writes `plan_json` when `plan` arg is provided; writes `NULL` otherwise.
- `projects.service.getVersion(versionId)` returns `planJson` field (nullable).
- Existing `project_versions` rows have `plan_json IS NULL` after migration (no backfill).

**Estimated complexity:** Low.

> **Data sensitivity note for §Data Sensitivity below:** `plan_json` is
> `public-safe` for the version's owner (returned via `/me/projects/:id`)
> but is **excluded** from the public `/library/:id` response (Step 7 of
> ADR-0002). It is owner-context only: a remix uses `original_prompt`,
> not `plan_json`.

---

### Step 5: Pipeline orchestrator + env-flag gating

- **Files to create**:
  - `services/api/src/llm/pipeline.ts` — exports `runPipeline(opts: {userId, prompt, parentPromptContext?, currentSpec?, currentPlan?}): AsyncGenerator<GenerateEvent, void>`. Reads `PLAN_BUILD_PIPELINE_PERCENT` and `PLAN_BUILD_PIPELINE_SHADOW` from env. Decides routing by `hash(userId) mod 100 < PERCENT`. On planner success: runs builder with plan; yields events. On planner timeout / invalid / unknown archetype: falls back to legacy `generateAppSpec`. On plan-conformance failure after re-prompt: falls back. In shadow mode: runs both, yields legacy events to the client, writes `events` rows for both.
- **Files to modify**:
  - `services/api/src/lib/env.ts` — add `PLAN_BUILD_PIPELINE_PERCENT` (z.coerce.number().int().min(0).max(100), default 0) and `PLAN_BUILD_PIPELINE_SHADOW` (z.enum(['true','false']).default('false')). Validate at boot; reject contradictory state (PERCENT=100 + SHADOW=true) at boot with a clear error message.

**Acceptance criteria**:

- With `PERCENT=0, SHADOW=false`: pipeline is byte-for-byte equivalent to `generateAppSpec` for any input. Existing snapshots pass.
- With `PERCENT=100, SHADOW=false`: every request goes through planner→builder.
- With `PERCENT=10, SHADOW=false`: ~10% of unique userIds hit the new path. `hash(userId) mod 100 < 10` is the exact rule, deterministic per user (i.e., a given user is _always_ in or out, no flapping).
- With `PERCENT=0, SHADOW=true`: every request runs planner _and_ legacy, returns legacy result, writes plan event with `mode: 'shadow'`.
- Boot rejects `PERCENT=100, SHADOW=true` with `EnvInvalidError` (new error).
- On planner timeout: orchestrator falls back to legacy; `events` row written with `event_type: 'plan.timeout_fallback'`.
- On `archetype: 'unknown'`: same fallback; `event_type: 'plan.unknown_fallback'`.
- On plan-conformance failure post-retry: `event_type: 'build.conformance_fallback'`.
- Orchestrator never throws an error type the route doesn't already handle (it surfaces `PlannerInvalidError`, `PlannerTimeoutError`, etc., for visibility but the legacy fallback catches before they reach the route — verified by integration test).
- Default 12 s `AbortController` timeout on planner; 90 s on builder. Both wired through the SDK call.

**Estimated complexity:** High.

**Code shape:**

```ts
// services/api/src/llm/pipeline.ts
export async function* runPipeline(opts: PipelineOpts)
  : AsyncGenerator<GenerateEvent, void> {
  const generationId = randomUUID()
  const useNew = shouldUseNewPipeline(opts.userId)
  const shadowMode = env.PLAN_BUILD_PIPELINE_SHADOW === 'true'

  if (!useNew && !shadowMode) {
    yield* generateAppSpec(opts)  // legacy, byte-for-byte
    return
  }

  const plannerSignal = AbortSignal.timeout(12_000)
  let plan: Plan | null
  try {
    plan = await producePlan({...opts, signal: plannerSignal})
    await writeEvent('plan.completed', {generationId, archetype: plan.archetype, ...})
  } catch (err) {
    plan = null
    await writeEvent(plannerErrorEventType(err), {generationId, error: err.code})
  }

  if (shadowMode) {
    yield* generateAppSpec(opts)  // ship legacy result; planner result already logged
    return
  }

  if (plan === null || plan.archetype === 'unknown') {
    yield* generateAppSpec(opts)
    return
  }

  try {
    yield* generateAppSpec({...opts, plan})  // Step 3 conditioning
  } catch (err) {
    if (err instanceof PlanConformanceError) {
      await writeEvent('build.conformance_fallback', {generationId, reason: err.reason})
      yield* generateAppSpec(opts)
      return
    }
    throw err
  }
}
```

---

### Step 6: `/generate` route wires the orchestrator

- **Files to modify**:
  - `services/api/src/routes/generate.ts` — import `runPipeline` from `pipeline.ts`; call `runPipeline` instead of `generateAppSpec` directly. SSE protocol unchanged. Body shape unchanged. Persistence in step 7 of the route handler now passes `plan` to `projectsService.create()` when the version came from the new path; `null` otherwise.

**Acceptance criteria**:

- All existing M1 SSE tests for `/generate` pass without modification when env defaults to `PERCENT=0, SHADOW=false`. Specifically: T-0002-035 (SSE happy path), T-0002-045/046/047 (pre-flight 4xx), T-0002-058 (SSE headers), T-0002-057 (no thinking trace in SSE).
- When the new path produces the spec, `done` event payload now includes `plan: Plan | null` field — additive, optional client-side. Existing clients ignore it.
- `project_versions.plan_json` is populated when the new path was used; NULL when legacy path was used.
- T-0004-060 (new test): `events` table has exactly two new rows per generation when `PERCENT=100, SHADOW=false`: `plan.completed` and `build.completed`. None when legacy path was used.

**Estimated complexity:** Low (route is thin; orchestration moved up to pipeline.ts).

---

### Step 7: New `/edit` route — single-intent edits with patch validation

- **Files to create**:
  - `services/api/src/routes/edit.ts` — `POST /me/projects/:projectId/edit`. Body: `{prompt: string(1-2000)}`. Auth-gated. Same rate limit as `/generate` (30/min/user) on a separate counter (`edit:${userId}`). Loads current spec + current plan from `project_versions`; calls `runPipelineEdit(opts)` (extension of Step 5's pipeline for edits — produces plan with `edit_intent`, then builder with patch tool). Validates patch against `target_paths`. Applies patch via `fast-json-patch` (CLAUDE.md §9, `mutate: false`). Re-validates A2UI spec. Persists a new `project_versions` row with the new spec, render_hash, and updated plan. Returns `{version_id, render_hash, plan}` on success.
  - `services/api/src/llm/tools/produceAppSpecPatch.ts` — Anthropic tool: `produce_app_spec_patch` with `input_schema` derived from `JsonPatchSchema` (already exists in `packages/a2ui-schema`). Tool description directs the model to emit only ops touching paths within `edit_intent.target_paths`.
  - `services/api/src/llm/patchValidation.ts` — `validatePatchAgainstIntent(patch: JsonPatch, targetPaths: string[]): {ok: true} | {ok: false; offendingOp: number; reason: string}`. Implements the path-descendancy rule.
- **Files to modify**:
  - `services/api/src/llm/pipeline.ts` — add `runPipelineEdit(opts)` that mirrors `runPipeline` but takes `currentSpec`, `currentPlan` and a builder branch that uses the patch tool with the patch validator + 1 retry.
  - `services/api/src/services/projects.service.ts` — add `applyEdit(versionId, newSpec, plan)`: writes a new `project_versions` row, updates `projects.current_version_id`, returns the new detail.

**Acceptance criteria**:

- Happy: `POST /me/projects/:id/edit` with `{prompt: 'change the title to "Morning Routine"'}` returns 200 with new `version_id`. New `project_versions.plan_json.edit_intent.target_paths` contains the path of the edited heading; the patch op `path` matches.
- A patch with an op touching a path outside `target_paths` is rejected; on second rejection, returns 422 with `{error: 'patch_out_of_scope'}`.
- Body validation (length, missing prompt) returns 400 plain JSON, no SSE.
- Auth bypass attempt: editing another user's project returns 404 (ownership check via `projects.owner_id === user.id`).
- Editing a project with `plan_json IS NULL` (legacy single-call result): planner is run with `currentPlan = null`; the legacy spec is fed to the planner alongside the edit prompt. The planner reconstructs a plan implicitly. (Test: T-0004-088.)
- Concurrency: two simultaneous `/edit` requests on the same project both succeed in writing `project_versions` rows; `projects.current_version_id` is updated to the _latest_ committed version (last writer wins). Test T-0004-089.
- Rate limit: 30/min/user on a counter separate from `/generate`'s. Test T-0004-090.
- The mobile client receives the new spec in the response body; SSE is **not** used on edits in this ADR (deferred to a future ADR if streaming-edit UX is desired).

**Estimated complexity:** High.

**Code shape:**

```ts
// services/api/src/llm/patchValidation.ts
export function validatePatchAgainstIntent(
  patch: JsonPatch,
  targetPaths: string[],
): {ok: true} | {ok: false; offendingOp: number; reason: string} {
  for (let i = 0; i < patch.length; i++) {
    const op = patch[i]
    if (!isPathWithinAny(op.path, targetPaths))
      return {ok: false, offendingOp: i, reason: `op.path '${op.path}' outside intent`}
    if ((op.op === 'move' || op.op === 'copy') && op.from && !isPathWithinAny(op.from, targetPaths))
      return {ok: false, offendingOp: i, reason: `op.from '${op.from}' outside intent`}
  }
  return {ok: true}
}

function isPathWithinAny(path: string, allowed: string[]): boolean {
  return allowed.some(a => path === a || path.startsWith(a + '/'))
}
```

---

### Step 8: Telemetry — `events` rows for plan + build stages

- **Files to create**:
  - `services/api/src/llm/telemetry.ts` — `writeEvent(eventType, payload, ctx)`. Wraps the `events` table insert. Validates `payload` does not contain raw prompt text or PII (whitelist of allowed keys per event type). On insert failure, logs at ERROR but does **not** throw — telemetry never blocks generation.
- **Files to modify**:
  - `services/api/src/llm/pipeline.ts` — call `writeEvent` at the four telemetry points (`plan.completed`, `plan.timeout_fallback`, `plan.invalid_fallback`, `plan.unknown_fallback`, `build.completed`, `build.conformance_fallback`).
- **No `events` schema migration.** New event types reuse the existing `payload_json` column.

**Acceptance criteria**:

- `events.event_type` enumerated set (documented in code, not in DB): `plan.completed`, `plan.timeout_fallback`, `plan.invalid_fallback`, `plan.unknown_fallback`, `build.completed`, `build.conformance_fallback`.
- `payload_json` for `plan.completed`: `{generationId, archetype, screens_count, navigation, mode: 'live'|'shadow', plan_duration_ms}`. **Must not** contain `prompt`, `user_email`, or any free-text user content.
- `writeEvent` failure (DB down) logs ERROR with `safeMessage` but the generation succeeds. Test T-0004-094.
- Whitelist enforcement: passing a payload key outside the whitelist throws (caught upstream, logged ERROR). Test T-0004-095. This is the §Security guarantee against accidental PII writes.

**Estimated complexity:** Medium.

---

### Step 9: Eval harness — planner-only mode + dual-shadow mode

- **Files to modify**:
  - `services/api/eval/run.ts` — add `--mode=planner|legacy|new|shadow` flag.
    - `legacy`: existing M1 harness, unchanged.
    - `planner`: runs `producePlan` only, scores per-prompt archetype against a human-labeled archetype in `eval/prompts/<archetype>/*.json`. CI gate: ≥85% archetype-match accuracy on the M1 30-prompt set + the 150-prompt M2 set (when authored).
    - `new`: runs `runPipeline` with `PERCENT=100, SHADOW=false`. Scores spec validity (Zod-pass) and plan-conformance.
    - `shadow`: runs both legacy and new on each prompt; logs both; reports the diff (archetype the planner chose vs. the de-facto archetype implied by the legacy spec).
  - `services/api/eval/results/` — add `<timestamp>-planner.json`, `<timestamp>-shadow.json` outputs.

**Acceptance criteria**:

- `pnpm --filter @app-creator/api eval -- --mode=planner` runs against the 30-prompt M1 set; outputs per-prompt match/miss + summary stats.
- `--mode=new` is a strict superset of `--mode=legacy` (every legacy assertion still applies; plan-conformance assertions added).
- `--mode=shadow` writes a diff report; CI does **not** fail on shadow-mode mismatches (it's diagnostic, not gating). CI gate is `--mode=new`.
- Eval mode sets `PLAN_BUILD_EVAL_MODE=true` env var; Step 8's `writeEvent` skips DB inserts when this is set (eval runs against a fresh testcontainer DB; we don't pollute analytics).
- Existing CI workflow that triggers eval on `services/api/src/llm/` or `packages/a2ui-schema/` changes still triggers it; the workflow is amended to run `--mode=new` when `PLAN_BUILD_PIPELINE_PERCENT > 0` is the default in `services/api/.env.example`.

**Estimated complexity:** Medium.

---

## Comprehensive Test Specification

### Test File Mapping

| Step | Test File                                                                                                 | Env                                 |
| ---- | --------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| 1    | `packages/a2ui-schema/src/plan.test.ts`                                                                   | none                                |
| 1    | `services/api/src/llm/tools/producePlan.test.ts`                                                          | none                                |
| 2    | `services/api/src/llm/planner.test.ts`                                                                    | mocked Anthropic                    |
| 3    | `services/api/src/llm/specValidation.test.ts` (extend) + `services/api/src/llm/generate.test.ts` (extend) | mocked Anthropic                    |
| 4    | `services/api/migrations/0005_plan_json.test.ts` + `services/api/src/db/schema.test.ts` (extend)          | testcontainer pg                    |
| 5    | `services/api/src/llm/pipeline.test.ts`                                                                   | mocked Anthropic + testcontainer pg |
| 6    | `services/api/src/routes/generate.test.ts` (extend)                                                       | testcontainer pg                    |
| 7    | `services/api/src/routes/edit.test.ts` (new) + `services/api/src/llm/patchValidation.test.ts`             | testcontainer pg + mocked Anthropic |
| 8    | `services/api/src/llm/telemetry.test.ts`                                                                  | testcontainer pg                    |
| 9    | `services/api/eval/run.test.ts` (extend)                                                                  | mocked Anthropic                    |

### Step 1 Tests — Plan schema + tool definition

| ID         | Category   | Test Description                                                                                                                                                                                                     |
| ---------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-0004-001 | Happy      | `PlanSchema.parse({version: 1, archetype: 'Calculator', screens: [{id: 'main', role: 'home', purpose: 'enter inputs', key_components: ['Form','Button']}], navigation: 'none'})` succeeds and returns the same shape |
| T-0004-002 | Happy      | Plan with 4 screens + `navigation: 'tabs+stack'` parses                                                                                                                                                              |
| T-0004-003 | Happy      | Plan with `edit_intent: {target_paths: ['/views/0/root/children/2']}` parses                                                                                                                                         |
| T-0004-004 | Negative   | `archetype: 'Calculatr'` (typo) fails at path `['archetype']`                                                                                                                                                        |
| T-0004-005 | Negative   | `archetype: 'Game'` (not the canonical `SimpleGame`) fails — closed enum                                                                                                                                             |
| T-0004-006 | Negative   | `screens: []` fails (min 1)                                                                                                                                                                                          |
| T-0004-007 | Negative   | `screens` length 5 fails (max 4)                                                                                                                                                                                     |
| T-0004-008 | Negative   | `navigation: 'sidebar'` fails (closed enum)                                                                                                                                                                          |
| T-0004-009 | Negative   | `screens` with duplicate `id` fails via superRefine                                                                                                                                                                  |
| T-0004-010 | Negative   | `navigation: 'none'` with 2 screens fails via superRefine                                                                                                                                                            |
| T-0004-011 | Negative   | `screens[0].id = 'Main'` fails (uppercase rejected by regex)                                                                                                                                                         |
| T-0004-012 | Negative   | `screens[0].id = '1main'` fails (must start with letter)                                                                                                                                                             |
| T-0004-013 | Boundary   | `screens[0].id` of length 32 succeeds; length 33 fails                                                                                                                                                               |
| T-0004-014 | Boundary   | `screens[0].purpose` of length 200 succeeds; 201 fails                                                                                                                                                               |
| T-0004-015 | Boundary   | `screens[0].key_components` length 8 succeeds; 9 fails                                                                                                                                                               |
| T-0004-016 | Boundary   | `edit_intent.target_paths` length 20 succeeds; 21 fails                                                                                                                                                              |
| T-0004-017 | Negative   | `edit_intent.target_paths: ['views/0']` (no leading slash) fails                                                                                                                                                     |
| T-0004-018 | Regression | Tool `input_schema` round-trips via JSON.stringify+parse identically (snapshot)                                                                                                                                      |
| T-0004-019 | Security   | Plan parse never throws on extra unknown keys; they are stripped silently (Zod default) — protects against LLM emitting bonus fields                                                                                 |
| T-0004-020 | Regression | `index.ts` re-exports `PlanSchema` and `Plan`; `import {PlanSchema}` from `@app-creator/a2ui-schema` resolves                                                                                                        |
| T-0004-117 | Boundary   | `screens[0].role` of length 40 succeeds; length 41 fails (rev-1)                                                                                                                                                     |
| T-0004-118 | Negative   | `screens[0].key_components: ['']` (empty-string element) fails the element-level `.min(1)` rule (rev-1)                                                                                                              |

#### Step 1 Test Summary

| Category       | Count             |
| -------------- | ----------------- |
| Happy          | 3                 |
| Negative       | 10                |
| Boundary       | 5                 |
| Security       | 1                 |
| Regression     | 2                 |
| Concurrency    | N/A (pure schema) |
| Error handling | N/A (pure schema) |
| **Total**      | **22**            |

### Step 2 Tests — Planner module

| ID         | Category       | Test Description                                                                                                                               |
| ---------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| T-0004-021 | Happy          | `producePlan({userId, prompt: 'tip splitter'})` against mock returns `{archetype: 'Calculator', screens.length: 1, navigation: 'none'}`        |
| T-0004-022 | Happy          | Edit-mode `producePlan({userId, prompt: 'change title', currentSpec, currentPlan})` includes `currentPlan` and `currentSpec` in messages array |
| T-0004-023 | Happy          | `metadata.user_id` is sha256(userId).slice(0,16) — never raw                                                                                   |
| T-0004-024 | Happy          | System array is exactly `[PLANNER_STATIC, PLANNER_CONTEXT]` with `cache_control: ephemeral` on the second block                                |
| T-0004-025 | Happy          | `tool_choice: {type: 'tool', name: 'produce_plan'}`, `max_tokens: 1500`, `model: PLANNER_MODEL`                                                |
| T-0004-026 | Negative       | Anthropic returns no `tool_use` block → throws `PlannerInvalidError('no_tool_use')`                                                            |
| T-0004-027 | Negative       | Anthropic returns Zod-invalid plan; planner retries once; second-time success returns plan                                                     |
| T-0004-028 | Negative       | Anthropic returns Zod-invalid plan twice; planner throws `PlannerInvalidError` with detail                                                     |
| T-0004-029 | Error handling | Anthropic 429 once → underlying retry; happy 2nd attempt returns plan                                                                          |
| T-0004-030 | Error handling | Anthropic 429 sustained → throws `PlannerTransportError`                                                                                       |
| T-0004-031 | Error handling | Anthropic 500 → `PlannerTransportError`                                                                                                        |
| T-0004-032 | Error handling | `signal.aborted` mid-call → throws `PlannerTimeoutError`                                                                                       |
| T-0004-033 | Boundary       | Plan with 1 screen + `navigation: 'none'` round-trips to mock and back                                                                         |
| T-0004-034 | Boundary       | Plan with 4 screens + `navigation: 'tabs+stack'` round-trips                                                                                   |
| T-0004-035 | Security       | Planner's `messages` for an edit call includes prior plan/spec but **does not** echo any system prompt content (audit log diff)                |
| T-0004-036 | Security       | Planner output never written to logs at INFO level (no prompt content in log lines per AC-CG-Q1 carryover)                                     |
| T-0004-037 | Regression     | `EnvMissingError` still raised at module load if `ANTHROPIC_API_KEY` absent (planner reuses M1 client)                                         |
| T-0004-038 | Negative       | Diagnostic-turn message correctly cites the prior failure (snapshot match)                                                                     |

#### Step 2 Test Summary

| Category       | Count                                     |
| -------------- | ----------------------------------------- |
| Happy          | 5                                         |
| Negative       | 4                                         |
| Error handling | 4                                         |
| Boundary       | 2                                         |
| Security       | 2                                         |
| Regression     | 1                                         |
| Concurrency    | N/A (mocked Anthropic; covered in Step 5) |
| **Total**      | **18**                                    |

### Step 3 Tests — Builder plan-conditioning + conformance

| ID         | Category   | Test Description                                                                                                                 |
| ---------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------- |
| T-0004-039 | Happy      | `generateAppSpec({...})` with no `plan` arg: byte-for-byte identical to M1 (snapshot of `messages.create` payload)               |
| T-0004-040 | Happy      | With `plan` arg: system array length is 3 (static + catalog + plan-block)                                                        |
| T-0004-041 | Happy      | `serializePlan(plan)` deterministic (snapshot)                                                                                   |
| T-0004-042 | Happy      | Builder spec passes `validatePlanConformance` → `done` event yields normally                                                     |
| T-0004-043 | Negative   | `validatePlanConformance` returns `{ok: false, reason: 'view_count_mismatch'}` when spec has 2 views and plan has 1              |
| T-0004-044 | Negative   | Same when plan has 2 and spec has 1                                                                                              |
| T-0004-045 | Negative   | `view_id_mismatch` when spec uses `home` but plan uses `main`                                                                    |
| T-0004-046 | Negative   | `initial_view_mismatch` when `spec.initialViewId` is not `plan.screens[0].id`                                                    |
| T-0004-047 | Negative   | `navigation_violation` when `plan.navigation === 'none'` but spec has any `navigate` action (anywhere in node tree)              |
| T-0004-048 | Negative   | Builder fails conformance once → re-prompt → succeeds (mock)                                                                     |
| T-0004-049 | Negative   | Builder fails conformance twice → throws `PlanConformanceError(reason)`                                                          |
| T-0004-050 | Boundary   | `validatePlanConformance` with single-view spec and single-screen plan, `navigation: 'none'`, no navigate actions → `{ok: true}` |
| T-0004-051 | Security   | Plan-block content does not leak into SSE `done` payload's `spec` field — only the spec is emitted                               |
| T-0004-052 | Regression | Existing M1 SSE event order (thinking_started → building_started → done) preserved when no plan supplied                         |
| T-0004-053 | Regression | Existing M1 InvalidSpecError on bad Zod-parse still thrown (plan path doesn't swallow it)                                        |

#### Step 3 Test Summary

| Category   | Count  |
| ---------- | ------ |
| Happy      | 4      |
| Negative   | 7      |
| Boundary   | 1      |
| Security   | 1      |
| Regression | 2      |
| **Total**  | **15** |

### Step 4 Tests — DB migration

| ID         | Category | Test Description                                                                                                                                                    |
| ---------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-0004-054 | Happy    | Fresh DB → run all migrations → `\d project_versions` shows `plan_json jsonb`                                                                                       |
| T-0004-055 | Happy    | ADR-0001-migrated DB → run 0005 → existing `project_versions` rows have `plan_json IS NULL`, no data loss                                                           |
| T-0004-056 | Boundary | Re-running 0005 is a no-op (`ADD COLUMN IF NOT EXISTS`)                                                                                                             |
| T-0004-057 | Happy    | `projects.service.create({...plan: validPlan})` writes `plan_json` populated                                                                                        |
| T-0004-058 | Happy    | `projects.service.create({...plan: undefined})` writes `plan_json: NULL`                                                                                            |
| T-0004-059 | Negative | `projects.service.create({...plan: invalidShape})` — TypeScript-prevented at compile time; runtime test ensures Zod parse before DB write                           |
| T-0004-125 | Negative | `projects.service.getVersion(versionId)` where versionId is a valid UUID but no row exists returns `null` (documents the contract; rev-1 — closes Step 4 ratio gap) |

#### Step 4 Test Summary

| Category  | Count |
| --------- | ----- |
| Happy     | 4     |
| Boundary  | 1     |
| Negative  | 2     |
| **Total** | **7** |

### Step 5 Tests — Pipeline orchestrator

| ID          | Category          | Test Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-0004-060  | Config exhaustion | `PLAN_BUILD_PIPELINE_PERCENT` unset → defaults to `0`; legacy path used                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| T-0004-061  | Config exhaustion | `PLAN_BUILD_PIPELINE_PERCENT=''` (empty) → boot rejects with EnvInvalidError                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| T-0004-062  | Config exhaustion | `PLAN_BUILD_PIPELINE_PERCENT=' 50 '` (whitespace) → coerced to 50                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| T-0004-063  | Config exhaustion | `PLAN_BUILD_PIPELINE_PERCENT=101` → boot rejects (out of range)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| T-0004-064  | Config exhaustion | `PLAN_BUILD_PIPELINE_PERCENT=-1` → boot rejects                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| T-0004-065  | Config exhaustion | `PLAN_BUILD_PIPELINE_PERCENT=abc` → boot rejects                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| T-0004-066  | Config exhaustion | `PLAN_BUILD_PIPELINE_SHADOW` unset → defaults to `'false'`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| T-0004-067  | Config exhaustion | `PLAN_BUILD_PIPELINE_SHADOW='True'` (case) → boot rejects (z.enum is case-sensitive; document explicitly)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| T-0004-068  | Config exhaustion | `PLAN_BUILD_PIPELINE_SHADOW='true'`, `PERCENT=100` → boot rejects (contradictory state)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| T-0004-069  | Config exhaustion | `PLAN_BUILD_PIPELINE_SHADOW='true'`, `PERCENT=0` → boots successfully (shadow Phase B)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| T-0004-123  | Config exhaustion | `PLAN_BUILD_PIPELINE_SHADOW=''` (empty string) → boot rejects with EnvInvalidError (rev-1)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| T-0004-124  | Config exhaustion | `PLAN_BUILD_PIPELINE_SHADOW=' true '` (whitespace-padded) → boot rejects (z.enum is exact-match; document explicitly) (rev-1)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| T-0004-070  | Happy             | `PERCENT=100, SHADOW=false`: planner ran, builder ran with plan, `events` rows for `plan.completed` + `build.completed`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| T-0004-071  | Happy             | `PERCENT=0, SHADOW=true`: planner ran, builder ran legacy, `events` row for `plan.completed` with `mode: 'shadow'`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| T-0004-072  | Happy             | `PERCENT=10`: deterministic per-userId — same userId always routes the same way across calls                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| T-0004-073  | Happy             | `PERCENT=10` over 1000 distinct userIds: ~100 ± 30 hit new path (chi-square OK)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| T-0004-074  | Negative          | Planner timeout (12s mock-aborted) → fallback to legacy; `plan.timeout_fallback` event                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| T-0004-075  | Negative          | Planner returns archetype `'unknown'` → fallback; `plan.unknown_fallback` event                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| T-0004-076  | Negative          | Planner Zod-fails twice → fallback; `plan.invalid_fallback` event                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| T-0004-077  | Negative          | Plan-conformance fails after retry → fallback; `build.conformance_fallback` event; legacy result returned to client                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| T-0004-078  | Error handling    | Builder times out at 90s on the new path → `generation_timed_out` surfaced (no fallback, since the legacy path would also be slow)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| T-0004-079  | Error handling    | Anthropic 429 on planner → retried (handled in Step 2) → eventual fallback if retries exhausted                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| T-0004-080  | Security          | `events` rows from Step 5 never contain prompt text or PII (whitelist-enforced in Step 8)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| T-0004-081  | Concurrency       | 50 parallel `runPipeline` calls with same userId at `PERCENT=50` — half route to new path, half to legacy, deterministically                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| T-0004-082a | Error handling    | SDK honors `AbortSignal`: mock the SDK's `messages.create` to reject with an abort error when `signal.aborted === true`; verify `producePlan` throws `PlannerTimeoutError` after 12s (rev-1, split from 082)                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| T-0004-082b | Error handling    | SDK swallows `AbortSignal`: mock the SDK to ignore the signal and never resolve; verify the orchestrator's `Promise.race` wrapper throws `PlannerTimeoutError` within 12s ± 500ms (rev-1, split from 082 — covers the SDK-discovery fallback path documented in Notes for Colby #5)                                                                                                                                                                                                                                                                                                                                                               |
| T-0004-122  | Regression        | Module-level byte-for-byte: with `env: {PERCENT:'0', SHADOW:'false'}`, **collect all yielded values from `runPipeline({...})` into an array via `for await...of`, collect all yielded values from `generateAppSpec({...})` (called directly on the same input) into a second array via `for await...of`, then assert the two arrays are deeply equal**. Snapshot at the orchestrator module level, not the route level. The for-await collection is what catches an orchestrator that inserts an event before/after `yield*` — partial collection (e.g., snapshotting only `done`) would tautologically pass and is forbidden (rev-1 + rev-2, P0) |

#### Step 5 Test Summary

| Category          | Count                      |
| ----------------- | -------------------------- |
| Config exhaustion | 12                         |
| Happy             | 4                          |
| Negative          | 4                          |
| Error handling    | 4 (082 split into 082a/b)  |
| Concurrency       | 1                          |
| Security          | 1                          |
| Regression        | 1 (T-0004-122 added rev-1) |
| **Total**         | **27**                     |

### Step 6 Tests — `/generate` route

| ID         | Category   | Test Description                                                                                           |
| ---------- | ---------- | ---------------------------------------------------------------------------------------------------------- |
| T-0004-083 | Regression | All ADR-0002 `/generate` tests (T-0002-035, T-0002-045–062) pass unmodified with `PERCENT=0, SHADOW=false` |
| T-0004-084 | Happy      | With `PERCENT=100`: `done` SSE event payload has `plan: Plan` field populated                              |
| T-0004-085 | Happy      | `project_versions.plan_json` populated when new path was taken                                             |
| T-0004-086 | Happy      | `project_versions.plan_json IS NULL` when legacy path was taken                                            |
| T-0004-087 | Security   | `done` SSE event never carries planner-internal trace text (planner output is structured-only)             |

#### Step 6 Test Summary

| Category   | Count                                          |
| ---------- | ---------------------------------------------- |
| Regression | 1 (umbrella; expanded to ~25 underlying tests) |
| Happy      | 3                                              |
| Security   | 1                                              |
| **Total**  | **5** new + 25 inherited                       |

### Step 7 Tests — `/edit` route + patch validation

| ID         | Category    | Test Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T-0004-088 | Happy       | `POST /me/projects/:id/edit` with `{prompt: 'change the title'}` returns 200 with new `version_id`; `project_versions.plan_json.edit_intent.target_paths` is set; spec changed only at the target path                                                                                                                                                                                                                                                                                                                   |
| T-0004-089 | Concurrency | Two simultaneous edits on the same project: both create new versions; `projects.current_version_id` ends up at the latest committed                                                                                                                                                                                                                                                                                                                                                                                      |
| T-0004-090 | Negative    | 31st edit in a minute returns 429 `rate_limited`                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| T-0004-091 | Negative    | Edit on another user's project returns 404                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| T-0004-092 | Negative    | Empty prompt returns 400                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| T-0004-093 | Negative    | Builder emits patch op outside `target_paths` once → re-prompt → succeeds                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| T-0004-094 | Negative    | Builder emits patch op outside `target_paths` twice → returns 422 `patch_out_of_scope`                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| T-0004-095 | Negative    | Builder emits patch with `move` whose `from` is outside `target_paths` → rejected                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| T-0004-096 | Boundary    | Patch `path` exactly equal to a `target_paths` entry: allowed                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| T-0004-097 | Boundary    | Patch `path` is a strict descendant: allowed                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| T-0004-098 | Boundary    | Patch `path` is a parent of a target: rejected                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| T-0004-099 | Negative    | Resulting spec fails `A2UISpecSchema.parse` after applying patch → returns 422 `invalid_spec`                                                                                                                                                                                                                                                                                                                                                                                                                            |
| T-0004-100 | Happy       | Editing a project with `plan_json IS NULL` (legacy version): planner reconstructs implicit plan; new edit succeeds                                                                                                                                                                                                                                                                                                                                                                                                       |
| T-0004-101 | Security    | Edit response never echoes the prompt or any planner trace                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| T-0004-102 | Regression  | `validatePatchAgainstIntent` unit tests cover (a) empty patch, (b) single op exact-match, (c) descendant, (d) sibling rejection, (e) parent rejection, (f) move both endpoints checked, (g) copy both endpoints checked, (h) test op (no value) checked                                                                                                                                                                                                                                                                  |
| T-0004-119 | Boundary    | `PlanEditIntentSchema.parse({target_paths: ['/']})` fails — root-only pointer rejected by the refinement (rev-1, prevents scope-guard bypass)                                                                                                                                                                                                                                                                                                                                                                            |
| T-0004-121 | Security    | **`GET /library/:id` for a project generated via the new pipeline (with `plan_json` populated) returns a response body that does not contain `plan_json`, `planJson`, or any key defined anywhere in `PlanSchema` (derive the forbidden key set programmatically from the Zod schema's shape — top-level + recursive — so future PlanSchema additions are auto-covered).** Walks the JSON response tree exhaustively; fails on any matching key. Closes the `normalizeRow` lesson for the new column (rev-1 + rev-2, P0) |

#### Step 7 Test Summary

| Category    | Count                                        |
| ----------- | -------------------------------------------- |
| Happy       | 2                                            |
| Negative    | 7                                            |
| Boundary    | 4 (T-0004-119 added rev-1)                   |
| Concurrency | 1                                            |
| Security    | 2 (T-0004-121 added rev-1)                   |
| Regression  | 1 (umbrella; ~8 underlying validation tests) |
| **Total**   | **17**                                       |

### Step 8 Tests — Telemetry

| ID         | Category       | Test Description                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T-0004-103 | Happy          | `writeEvent('plan.completed', {generationId, archetype, ...})` inserts a row into `events` with the right shape                                                                                                                                                                                                                                                                                                                      |
| T-0004-104 | Negative       | `writeEvent('plan.completed', {prompt: 'leak'})` — `prompt` not in whitelist → throws (caught by orchestrator, logged ERROR, generation continues)                                                                                                                                                                                                                                                                                   |
| T-0004-105 | Negative       | `writeEvent('plan.completed', {user_email: '...'})` — same                                                                                                                                                                                                                                                                                                                                                                           |
| T-0004-106 | Error handling | DB down during `writeEvent` → logged ERROR with `safeMessage`; generation succeeds                                                                                                                                                                                                                                                                                                                                                   |
| T-0004-107 | Boundary       | **For each of the 6 event types** (`plan.completed`, `plan.timeout_fallback`, `plan.invalid_fallback`, `plan.unknown_fallback`, `build.completed`, `build.conformance_fallback`): call `writeEvent(type, {<key_not_in_that_type's_whitelist>: 'x'})` and assert it throws `EventPayloadValidationError`. Also assert each type's whitelist is exported from `telemetry.ts` so analytics consumers have a contract (rev-1, was vague) |
| T-0004-108 | Regression     | `events.payload_json` never empty for these event types (always at least `{generationId, ...}`)                                                                                                                                                                                                                                                                                                                                      |
| T-0004-116 | Negative       | `writeEvent('build.completed', {prompt: 'leak'})` rejects under **`build.completed`'s** whitelist specifically — not just inherited from `plan.completed`'s whitelist (rev-1; prevents whitelist drift across event types)                                                                                                                                                                                                           |
| T-0004-120 | Error handling | Shadow mode + DB down: planner completes, `writeEvent('plan.completed', ...)` fails; orchestrator catches the telemetry error, logs ERROR, then yields the legacy `generateAppSpec` result to the client. Client receives `done` event normally (rev-1; verifies "telemetry never blocks generation" claim from §I)                                                                                                                  |

#### Step 8 Test Summary

| Category       | Count                      |
| -------------- | -------------------------- |
| Happy          | 1                          |
| Negative       | 3 (T-0004-116 added rev-1) |
| Error handling | 2 (T-0004-120 added rev-1) |
| Boundary       | 1                          |
| Regression     | 1                          |
| **Total**      | **8**                      |

### Step 9 Tests — Eval harness extension

| ID         | Category   | Test Description                                                                                                  |
| ---------- | ---------- | ----------------------------------------------------------------------------------------------------------------- |
| T-0004-109 | Happy      | `eval/run.ts --mode=planner` outputs per-prompt match/miss + summary                                              |
| T-0004-110 | Happy      | `--mode=new` runs full pipeline; output matches `--mode=legacy` schema plus new fields (plan, conformance_status) |
| T-0004-111 | Happy      | `--mode=shadow` writes a side-by-side diff                                                                        |
| T-0004-112 | Boundary   | `--mode=invalid_value` exits non-zero with usage                                                                  |
| T-0004-113 | Negative   | CI gate: `--mode=new` exit-1 on <80% pass rate (matches M1 gate)                                                  |
| T-0004-114 | Negative   | `--mode=planner` exit-1 on <85% archetype-match accuracy (new gate)                                               |
| T-0004-115 | Regression | `PLAN_BUILD_EVAL_MODE=true` causes Step 8's `writeEvent` to skip DB inserts                                       |

#### Step 9 Test Summary

| Category   | Count |
| ---------- | ----- |
| Happy      | 3     |
| Boundary   | 1     |
| Negative   | 2     |
| Regression | 1     |
| **Total**  | **7** |

### Test Totals (rev-1)

| Step      | New     | Regression (existing-must-survive) | Total                       |
| --------- | ------- | ---------------------------------- | --------------------------- |
| 1         | 20      | 2                                  | 22                          |
| 2         | 17      | 1                                  | 18                          |
| 3         | 13      | 2                                  | 15                          |
| 4         | 6       | 1                                  | 7                           |
| 5         | 25      | 2                                  | 27                          |
| 6         | 4       | 1                                  | 5 (+~25 inherited M1 tests) |
| 7         | 16      | 1                                  | 17                          |
| 8         | 7       | 1                                  | 8                           |
| 9         | 6       | 1                                  | 7                           |
| **Total** | **114** | **12**                             | **126** new + ~25 inherited |

**Rev-1 delta:** +11 tests (10 added, 1 split into two). +1 schema fix
(`key_components` element `.min(1)`, root-pointer rejection). All changes
trace to specific Roz findings in the Status table.

### Test Helpers & Mocks

- `services/api/test/mocks/anthropic.ts` already exists for M1; extend with:
  - `mockPlannerResponse(plan: Plan)` — returns a fake `messages.create` response with the plan as a `tool_use` block.
  - `mockPlannerError(status: number)` — fakes 429/500/abort.
  - `mockBuilderConformanceFailure(reason: string)` — builder returns a spec that violates plan conformance.
- Test pg containers reused from M1 setup. No new infra.

### Coverage Gates

- Per CLAUDE.md, jest `--coverage` is enabled; per-package thresholds remain at the M1 levels (lines/statements/branches/functions ≥ 85%). New code in `packages/a2ui-schema/src/plan.ts` and `services/api/src/llm/{planner,pipeline,patchValidation,telemetry}.ts` must hit ≥ 90% line coverage (raised because each is a small, well-bounded module).

---

## UX Requirements

None for this ADR. The pipeline is server-side; no UX surface changes
in M2's first slice. The `done` SSE event gains an optional `plan`
field (Step 6 AC) which the mobile client currently ignores. Sable
(`/ux`) will pick up UX work for ADR-0005 (renderer + nav primitives)
and for the in-app feedback path; this ADR does not require Sable
involvement.

---

## Data Sensitivity

| Store Method                                          | Returns                                                                                                                 | Sensitivity                                                                                                                                                                                                                                                                              |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `projectsService.create({plan})`                      | `{project, currentVersion}` where `currentVersion.planJson` is the stored Plan or null                                  | **owner-only** — `plan_json` is not surfaced via `/library/:id` (public read). **Verified by T-0004-121** (exhaustive recursive key-walk on the public response). The earlier rev-0 claim that this was covered by T-0002-119 was wrong — that test predates the column. (rev-1, Roz P0) |
| `projectsService.applyEdit(versionId, newSpec, plan)` | `{project, currentVersion}` same shape                                                                                  | **owner-only**                                                                                                                                                                                                                                                                           |
| `projectsService.getVersion(versionId)`               | `{specJson, planJson, renderHash, createdAt}`                                                                           | **owner-only**; called only from auth-gated routes                                                                                                                                                                                                                                       |
| `runPipeline(opts)`                                   | `AsyncGenerator<GenerateEvent>`; `done.spec` is the spec; **the plan does not appear in SSE done events to non-owners** | The mobile owner client receives `done.plan` for owner-context use only; `/library/:id` (public consumer) reads from a different service path that excludes `planJson`                                                                                                                   |
| `runPipelineEdit(opts)`                               | non-streaming response `{version_id, render_hash, plan}`                                                                | **owner-only**; `/me/projects/:id/edit` is authn-gated                                                                                                                                                                                                                                   |
| `writeEvent(type, payload)`                           | `void`                                                                                                                  | Whitelist-enforced: each event type has a fixed key list; raw prompt, email, free-text user content **never** in `events.payload_json`                                                                                                                                                   |

**Key carryovers from prior ADRs:**

- `original_prompt` not logged at INFO (ADR-0002 §G + AC-CG-Q1) — still applies.
- `thinking_trace` text never in SSE — still applies; reinforced by T-0004-051, T-0004-087, T-0004-101.
- `events.payload_json` PII-scrubbed (ARCHITECTURE.md §9) — Step 8 whitelist enforces this.

---

## CI/CD Impact

| Job                | Config File                         | Impact                                                                                                                                                                                                                                                                    | Required Change                                                                                                                                                                                             |
| ------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `eval` workflow    | `.github/workflows/eval.yml` (M1)   | Eval triggers on changes to `services/api/src/llm/**` or `packages/a2ui-schema/**`. New code lives there → already triggered. **However** the eval mode currently is `legacy`; we want `--mode=new` to be the gate when `PLAN_BUILD_PIPELINE_PERCENT > 0` is the default. | Update workflow `run` line: `pnpm --filter @app-creator/api eval -- --mode=new`. The existing 80% pass threshold is preserved. Eval cost dashboard: ~2× during shadow weeks (Phase B). Robert pre-approved. |
| `typecheck` matrix | `.github/workflows/ci.yml`          | `packages/a2ui-schema` adds `plan.ts`; tsc must pass                                                                                                                                                                                                                      | None — already runs `pnpm typecheck` over the workspace.                                                                                                                                                    |
| `lint`             | same                                | New files must pass eslint                                                                                                                                                                                                                                                | None                                                                                                                                                                                                        |
| `test` matrix      | same                                | New tests in 5 workspaces (a2ui-schema + api + …)                                                                                                                                                                                                                         | None — already runs `pnpm test`. The new tests bring CI runtime up by ~5–7 s based on M1 baseline; acceptable.                                                                                              |
| Migration test     | `services/api/migrations/*.test.ts` | New `0005_plan_json.test.ts` runs in the same suite                                                                                                                                                                                                                       | None                                                                                                                                                                                                        |

---

## Documentation Impact

| Doc                             | Path                                                | What Changes                                                                                                                                                                                                                                                 |
| ------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Architecture / LLM call pattern | `CLAUDE.md` §3                                      | Add a sub-section "Plan → Build pipeline" under §3 with the three-system-block layout for the builder, and the planner pattern. Note that the existing `trace()` reference is aspirational; update to clarify telemetry goes through `events` table for now. |
| LLM modules                     | `services/api/src/llm/README.md` (new short readme) | Module map: `anthropic.ts` (singleton), `models.ts` (constants), `planner.ts`, `generate.ts`, `pipeline.ts`, `patchValidation.ts`, `telemetry.ts`, `tools/` (produceAppSpec, produceAppSpecPatch, producePlan), `prompts/` (system, planner).                |
| ADR index                       | `.claude/references/adr-index.md`                   | Append ADR-0004 entry: tags `llm`, `pipeline`, `m2`, `edit`, `feature-flag`, `migration`.                                                                                                                                                                    |
| Hypothesis tracker              | `docs/product/hypothesis-tracker.md`                | No change required — H5 measurement is unchanged by the pipeline shape.                                                                                                                                                                                      |
| M2 milestone brief              | `docs/product/M2-milestone.md`                      | After Sponsor sign-off on this ADR, the §Architectural Anchor's "Plan → Build ADR (Cal, /architect) becomes the first M2 build dependency" line gets updated to reference ADR-0004 by number.                                                                |

---

## Migration Plan (Steps to Production)

| Phase                               | Env state                   | What runs                                                                                             | DoD                                                                                                                                                                                                | Rollback trigger                                                                                                                                                          |
| ----------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** — Code shipped, never live    | `PERCENT=0, SHADOW=false`   | All Steps 1–9 merged. New code paths exist, not exercised. Legacy path is unchanged.                  | All 115 new tests + 25 inherited M1 tests green in CI. Eval `--mode=legacy` ≥ 80% as before.                                                                                                       | n/a                                                                                                                                                                       |
| **B** — Dual-shadow (internal only) | `PERCENT=0, SHADOW=true`    | Planner runs on every internal-tester `/generate`. Result logged to `events`. Legacy result returned. | Internal cohort runs ≥ 1 week. `events` show planner-archetype distribution; manual labeling on a 30-prompt sample shows ≥ 85% archetype-match accuracy. Eval `--mode=shadow` reports stable diff. | Planner archetype accuracy < 70% on the labeled sample → stay in Phase B; tune `PLANNER_CONTEXT`; re-test.                                                                |
| **C-1** — 10% live                  | `PERCENT=10, SHADOW=false`  | New pipeline serves 10% of users (deterministic per userId).                                          | 1 week in production. SO-1 (multi-screen rate) ≥ 70% on the 10% cohort. SO-3 archetype accuracy ≥ 80%. p95 latency on the 10% cohort ≤ 90 s. Plan-conformance fallback rate < 5%.                  | Any of: SO-1 < 50%, SO-3 < 70%, p95 > 100 s, fallback rate > 15% → set `PERCENT=0`.                                                                                       |
| **C-2** — 50% live                  | `PERCENT=50, SHADOW=false`  | 50% of users on new pipeline.                                                                         | Same gates as C-1, sustained for 1 week.                                                                                                                                                           | Same triggers as C-1.                                                                                                                                                     |
| **C-3** — 100% live                 | `PERCENT=100, SHADOW=false` | All users on new pipeline.                                                                            | All M2 SO-1/SO-3/SO-4 KPIs hit per `M2-milestone.md` Acceptance Criteria.                                                                                                                          | If a regression is found post-100%, revert to C-2 by setting `PERCENT=50`. The fallback path inside the orchestrator means no individual user request is silently broken. |

Each phase is a single env-var change deploy. No code re-deploy required to roll back.

---

## Open Questions (Punting Inline)

| ID   | Question                                                                                                                                                                       | Owner                 | Why deferred                                                                                                                    |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| OQ-1 | Should we add Langfuse tracing in this ADR?                                                                                                                                    | Robert (PM)           | New SaaS dependency; out of this ADR's blast radius. Recommended: defer; revisit when M3 brings cross-org observability.        |
| OQ-2 | If Phase-B archetype accuracy < 85% with Haiku, do we swap planner to Sonnet (~3× cost) or tune `PLANNER_CONTEXT` and stay on Haiku?                                           | Robert + Sponsor      | Data-driven decision. The model swap is a one-line change in `models.ts`. Recommend waiting on Phase B numbers before deciding. |
| OQ-3 | The brief said "do_not_touch_allowlist"; this ADR uses `target_paths` (positive allow-list) with rationale (§H). Confirm the rename.                                           | Robert                | Naming-only; semantics are stricter (forbid by default).                                                                        |
| OQ-4 | The brief said both calls share the cached catalog block. This ADR uses _separate_ cached blocks per model (§F). Confirm the cost framing — the ~1.5× number remains accurate. | Robert + Sponsor      | The constraint is Anthropic-side (cache is per model). Cost change vs. the brief's framing is small.                            |
| OQ-5 | Cancellation semantics on `/edit`: if the client disconnects mid-edit, do we still persist?                                                                                    | Robert                | M2 default suggested: yes (consistent with `/generate` per ADR-0002 §O). Confirm.                                               |
| OQ-6 | Eval CI cost during shadow weeks (~2× spend). Currently the M1 cap is $30/engineer/day (ADR-0002 risks). Raise during Phase B?                                                 | Eva (DevOps) + Robert | Recommend a $500 Phase-B Anthropic spend cap, with a daily check on `events.duration_ms` aggregations.                          |

---

## Notes for Colby

1. **Do not start coding before Roz reviews the test spec.** This ADR's gate is the test review (architect skill default) — Cal stays available to revise on Roz's feedback before you touch code.
2. **Steps 1, 2, 4 are independent** and can be done in parallel across PRs. Step 3 depends on Step 1. Step 5 depends on Steps 1–4. Steps 6–9 depend on Step 5. Recommended PR order: 1+4 first (schema + migration), then 2+3, then 5, then 6+7 (parallel), then 8, then 9.
3. **The legacy `generateAppSpec` is byte-for-byte preserved.** Don't refactor it. If Step 3's plan-arg addition tempts a refactor, resist — the orchestrator handles routing.
4. **Path-handling for JSON Pointer** (Step 7): use the `fast-json-patch` library's path utilities; do not roll our own pointer parsing. The library handles `~0` (`~`) and `~1` (`/`) escaping.
5. **AbortSignal wiring on the SDK** (Step 5 / Step 2): the SDK 0.92 docs say `signal` is supported on `messages.create` and `messages.stream`. **Smoke-test it manually before integration.** If the SDK does not honor abort, fall back to a `Promise.race` wrapper and document the discovery in the file's header comment (ADR-0002 §3 set this precedent for thinking + tool_choice).
6. **Hashing userId for routing** (Step 5): use a fast non-cryptographic hash (e.g., `xxhash` if cheap, or `crypto.createHash('md5').update(userId).digest()` and read first 4 bytes as a uint32). Don't use `sha256` — overkill, and we hash this on every request. M1's `hashUserId` is `sha256` because it's for Anthropic metadata privacy; that's a different concern (PII obfuscation).
7. **Anthropic SDK `metadata.user_id`** is hashed for _the planner call too_ (Step 2 AC). Same hash function as `generate.ts:29`. Re-use, don't duplicate.
8. **Plan serialization** (Step 3 `serializePlan`): use `JSON.stringify(plan, null, 2)` for the system-block content. Pretty-printed is more diffable in traces; the model handles it fine. Snapshot test pins the format.
9. **Eval mode** (Step 9): the `PLAN_BUILD_EVAL_MODE` env var is a Step-8 read — telemetry skips DB writes when it's set. Don't add it as a check to other modules; one read site only.
10. **Rate limit counter** for `/edit` (Step 7): use the same `rateLimit()` helper M1 uses but with a separate key prefix (`edit:${userId}`). Do not share with `/generate`'s counter.

---

## Handoff

> ✅ ADR-0004 saved to `docs/adrs/ADR-0004-plan-build-pipeline.md`.
> **9 steps, 115 new tests + 25 inherited M1 tests = 140 total tests covering 6 categories.**
>
> **Per Robert's brief and architect skill defaults, two parallel gates open now:**
>
> 1. **Roz** — review the comprehensive test spec (Steps 1–9). Standard architect-skill gate. Cal revises if Roz finds gaps before Colby starts coding.
> 2. **Robert + Sponsor (Alyona)** — review the architectural decisions, especially the four open questions (OQ-1 through OQ-6) where Robert's brief was rewritten with rationale (per-model caches, `target_paths` naming, langfuse defer, planner model choice).
>
> Both gates can run concurrently. Colby does not start until both close.
>
> After both gates close, the build queue per Robert's brief is:
> ADR-0004 implementation → analytics instrumentation (D1) → multi-screen renderer + nav primitives (ADR-0005, D5/D6) → edit-preservation deepening (D7, may need ADR-0007) → in-app feedback path → alpha distribution.

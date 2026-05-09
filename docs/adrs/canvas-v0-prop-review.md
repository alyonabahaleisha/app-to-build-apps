# Canvas V0 — Architectural Review (Cal)

_Authored 2026-05-07 — pre-§0 review. Not a canonical ADR. Authoring of
ADR-0005..0008 is gated on Sponsor (Alyona) signing canvas-v0.md §0 by
2026-05-12._

This note answers Robert's three asks in `canvas-v0.md`:

1. My §0 opinion (Supersede / Sequence / Revise).
2. A prop-signature audit of Sable's UX spec for Zod codegen viability.
3. A confirmed/revised ADR sub-slicing.

Plus a fourth section — **architectural concerns to raise to Robert
*now***, before §0 signs. Cal's job is to push back when push-back is
cheaper now than later. Three of these would change the brief if Sponsor
agrees; two would just change my ADR scope.

---

## 1. §0 reconciliation — my recommendation: **Supersede**

I agree with Robert. Three reasons, in order of weight.

**A. The latency budget is the product.** ADR-0004 ships at p95 ≤90s
because the alpha-cohort H5 question tolerated 90s. Canvas V0's brief
treats 7–9s as load-bearing for retention and share-rate — that's not
the same product, and it's not reachable from the two-stage architecture
without retiring the planner. p50 ≤9s with a planner stage is
arithmetically impossible; Haiku alone is ~5s typical, before Sonnet
even starts.

**B. The brief authors knew what they were cutting.** ADR-0004 was
accepted 2026-05-05; the brief was authored 2026-05-07 by the same
cross-functional team. This isn't a parallel-discovered conflict —
it's an explicit redirection. The decision the team made (consumer
public-launch H5) is theirs to make; my job is to point out the
inheritance question, which Robert already did in §0.

**C. ADR-0004's *kept* surfaces are the load-bearing ones, and they
already got Roz approval.** Telemetry whitelist (Step 8) and eval-mode
short-circuit (Step 9) carry forward verbatim — those were the
expensive pieces to design, not the planner. The planner orchestrator
and `/edit` route are ~3 days of code each; rewriting them in V0 if we
ever need them back is cheap. Sticking with M2 to "preserve" them is
expensive in a way that retiring them isn't.

**What I'm explicitly *not* recommending: Sequence.** Running M2 to
sign-off then starting V0 takes the launch to ~12 weeks. That's the
scope drift the brief is trying to prevent.

### Caveat — one Sponsor question worth surfacing

If marketing has a hard public-launch date that 6 weeks doesn't comfortably
clear, Sequence is the safer call. A delayed public launch with a
correctly-validated alpha is better than a rushed public launch with a
broken H5 measurement. Robert should confirm with Alyona that 6 weeks
is real, not aspirational. **I'm not asking the architects to push back
the timeline; I'm asking the Sponsor to confirm it's actually 6 weeks.**

---

## 2. Prop-signature audit (≤1 page) — friction points for Zod codegen

Most of Sable's 28 component prop signatures land cleanly in Zod. The
seven friction points below need resolution before ADR-0005 (protocol
schema) can be authored. None are blockers; all are clarifications.

| # | Friction | Where | Fix |
|---|---|---|---|
| **F-1** | **State-bound `value` props are ambiguous in spec vs runtime.** TextField/NumberField/DateField/Picker/Switch/ImagePicker carry `value` props in Sable's spec. The spec must distinguish *literal initial value* from *binding to a state slot or collection field*. | Inputs tier (5), `ImagePicker`, action `set` target | Schema introduces a `Binding` discriminated union: `{kind: 'literal', value}`, `{kind: 'state', slot}`, `{kind: 'collectionField', collection, field}`. Inputs carry `valueBinding: Binding`, not `value: T`. Resolves at render time. |
| **F-2** | **Runtime-only props on Button (`loading`, `disabled`) are in the spec.** `loading` and `disabled` are state, not structure. The spec shouldn't declare a permanently-disabled button. | `Button` | Remove `loading` from schema entirely (renderer derives from action's pending dispatch). `disabled` becomes a `Binding<boolean>` — same `Binding` machinery as F-1. |
| **F-3** | **Polymorphic `leading`/`trailing` slots on ListItem are typed as a union including "Icon".** No `Icon` component exists in the 28-component catalog; Sable uses semantic icon name strings everywhere else. | `ListItem`, `SwipeableRow` | Schema models slot as `z.discriminatedUnion('kind', [{kind:'avatar', node:Avatar}, {kind:'badge', node:Badge}, {kind:'icon', name:IconName}, {kind:'none'}])`. "Icon" is a slot kind, not a component. |
| **F-4** | **The `share` action verb has no params and no documented target.** Sable's design treats Share as a host-meatball-only action. If `share` is in the closed verb set but no spec component invokes it, the verb is a phantom. | Action verb registry | Either: (a) remove `share` from the spec verb set — Share is host-only, not spec-driven, OR (b) define `share` to mean "share *this tool* via Universal Link" and accept it on `Button.action` as well as the meatball. I prefer (a): cleaner semantics, the meatball never invokes the dispatcher anyway. **Robert decides; either is fine architecturally.** |
| **F-5** | **80-icon enum is fine in Zod but verbose in the LLM tool `input_schema`.** Each of the 80 icon names becomes a separate option string in the JSON schema sent to the model. ~2KB of pure enum noise on every generation. | `IconName` enum | Codegen the enum from `packages/design-system/icons/index.ts` (single source). The model sees the names but doesn't see option-by-option descriptions; the system prompt block names the 80 icons in 1 paragraph instead. |
| **F-6** | **Cross-reference constraints (`MediaTray.imageField` references a field on `MediaTray.collectionId`).** Zod can express via `.refine()` but the validator needs the full spec to resolve cross-refs. | `MediaTray`, `ListSummary`, action verbs that reference collections | Two-pass validation: (1) Zod parse for shape, (2) post-parse cross-reference check via a small validator in `packages/protocol/validate.ts`. Both run server-side on `/generate`; LLM sees only the Zod shape. |
| **F-7** | **Recursive children types** (`Stack.children`, `Section.children`, `Card.children`) reference the full component union including themselves. | Layout tier | Standard Zod `z.lazy()` + manual TS type alias. Workable but means `z.infer<>` doesn't fully materialize — Cal pre-declares `type Node = ...` and the schema returns `z.ZodType<Node>`. |

### Out-of-band: cover-art determinism (not a prop signature, but related)

Sable spec'd cover art as deterministic from `(stance, palette, icon, seed)`,
rendered both client-side (RN SVG) and server-side (PNG for OG). This
isn't a Zod problem but is a contract-with-the-schema problem: every
input that affects cover art must be persisted on the share record so
the install-gate page can reproduce the cover. The spec already
captures `cover_art_seed`; I'll add to ADR-0005 that **stance, palette,
icon, AND seed are all persisted on the share record at first
generation, and are immutable across re-prompts**. Cover art identity
survives re-prompt only if all four are immutable. Sable said only
`seed` was immutable; I'll push back: if a re-prompt flips palette,
the friend's iMessage preview drifts from the maker's Library card,
which breaks the social object's identity. **Recommend: lock all four
at first share, decouple share-record cover-art from spec
stance/palette/icon for V0.**

---

## 3. ADR sub-slicing — confirming Sable's 4-ADR plan

I confirm her 4-ADR slicing with one tightening on dependencies and one
explicit list of what each ADR retires from ADR-0004.

| ADR | Title | Owns | Depends on | Est. complexity |
|---|---|---|---|---|
| **0005** | Canvas V0 protocol & design system | `packages/protocol/spec.zod.ts`, `packages/protocol/validate.ts`, `packages/design-system/tokens.ts`, `packages/design-system/theme.ts`, `packages/design-system/coverArt.ts`, `packages/design-system/icons/` | §0 sign-off | Medium (~2 days author, 2 days Roz) |
| **0006** | Canvas V0 renderer (28 components + dispatcher + AI bridge) | `packages/a2ui-renderer/` wholesale rewrite, 13-verb dispatcher, `react-native-ai-apple` bridge | ADR-0005 | High (3+ weeks; the long pole) |
| **0007** | Canvas V0 generation (single-call + out-of-scope detection + telemetry retarget) | `services/api/src/llm/generate.ts` (rewritten), `out_of_scope` second tool, system prompt for 28-cat + 4-archetype, eval harness retarget, telemetry events update | ADR-0005 | High (1.5–2 weeks; latency + out-of-scope eval are the unknowns) |
| **0008** | Canvas V0 sharing (Universal Links + install-gate + clone) | AASA file, `POST /mini-apps/:id/share`, `POST /mini-apps/clone`, install-gate webpage (separate deploy target), Branch SDK, OG image route, deferred deep-link delivery, celebration sheet | ADR-0005 (cover art for OG), ADR-0006 (rendering cloned tools) | Medium-High (~1.5 weeks; install-gate is a separate codebase) |

**Critical path.** ADR-0005 → blocks everything → must land Week 1.
ADR-0006 starts Week 2, runs through Week 5. ADR-0007 starts Week 2 in
parallel; latency + out-of-scope eval iteration is its tail risk and
needs Week 5 buffer. ADR-0008 starts Week 3 once schema is stable.

### What ADR-0007 retires from ADR-0004 (Supersede path)

| Surface | Disposition |
|---|---|
| `services/api/src/llm/pipeline.ts` orchestrator | Retired (single-call path is direct via `generate.ts`) |
| `produce_plan` tool + schema | Retired |
| Plan-conformance validator | Retired |
| Planner system prompt | Retired |
| `produce_app_spec_patch` tool + `/edit` route | Retired |
| `plan_json` column on `project_versions` | **Kept (deprecated writes; legacy reads only).** Migration to drop is a V0.5 chore — alpha cohort data lives there. |
| Feature flag `PLAN_BUILD_PERCENT` | Retired (always off; remove env var) |

### What ADR-0007 keeps from ADR-0004

| Surface | Disposition |
|---|---|
| Telemetry whitelist module (Step 8) | **Kept verbatim.** Add new V0 events to whitelist (canvas-v0.md AC-T1). |
| Eval-mode short-circuit (Step 9) | **Kept verbatim.** Eval prompts retargeted: 100 prompts × 4 archetypes + 30-prompt out-of-scope + 30-prompt false-positive. |
| `produce_app_spec` tool | Kept; schema upgraded to V0 28-component spec. |
| Roz's full ADR-0004 test spec | Mostly retired (planner-specific), but the eval-harness and telemetry tests are reused with updated event/whitelist names. |

**No deletes in V0 build window.** Retired surfaces stay in the codebase
with a deprecation comment until a post-launch cleanup ADR (V0.5).
Deleting in flight risks accidentally pulling thread on something that's
still wired.

---

## 4. Architectural concerns to raise to Robert *now*

Three of these would change the brief if Sponsor agrees; two would just
change my ADR scope. Surfacing pre-§0 because pushing back at ADR time
is too late.

### Concern A — The 7–9s latency budget is aggressive on a 28-component catalog

**This is the biggest concern.** M1's single-call path hit p95 ~90s on a
**10-component catalog**. The brief writes 7–9s on a **28-component catalog**.
Catalog block is now ~10K tokens (estimate); a typical 1–2 screen tool
with seed data is 3–5K output tokens; at 50–80 tok/s that's 38–100s of
output time alone, before TTFT.

Realism check on `AC-G10` (p95 ≤12s, p50 ≤9s):

- Cache hits on the catalog block (ephemeral cache_control) help TTFT but
  don't help output speed.
- Output tokens drop if seed data is scoped tightly (e.g., 5 seed entries
  not 15) — but the brief mandates "realistic" content.
- Streaming SSE plus full-mount-on-completion (canvas-v0.md AC-G12) means
  the user experience can absorb tail latency *visually* (the loading
  screen carries them) but the wall-clock metric still holds.

**My recommendation:** **Week-0 latency spike** before ADR-0007 is
authored. Take Sable's 28-component catalog draft, write a placeholder
system prompt, generate 20 specs across 4 archetypes, measure actual
p50/p95. **Pass criterion: p95 ≤15s on the spike.** If the spike misses,
two paths:

1. Relax `AC-G10` to p95 ≤20s and accept that the brief's "7–9s" is a
   marketing target, not a hard SLO. The loading-screen choreography
   already accommodates 9s+ tail latency.
2. Reintroduce a Plan→Build pipeline (in V0 form: Haiku planner picks
   archetype + screen count + initial seed-data spec, Sonnet builder
   produces the full A2UI spec). This would invalidate my §0 Supersede
   recommendation — bring back the planner if latency demands.

I'd prefer (1) at the brief level, but Sponsor should know option (2)
exists if needed.

### Concern B — Out-of-scope detection (`tool_choice: 'auto'`) is the riskiest unproven piece

Brief frames it as straightforward. It isn't. Detection precision ≥95%
*and* false-positive ≤5% on a 30+30 prompt set is achievable but
requires real prompt-engineering iteration. The closed 5-capability
taxonomy helps; auto tool choice with two well-described tools helps;
but the model's bias to "try to make something" cuts against detecting
out-of-scope.

**My recommendation:** **Week-0 prompt-engineering spike** alongside
the latency spike. Same shape: 60 prompts (30 detection + 30
false-positive), measure detection precision and FP rate. Pass: ≥90%
detection, ≤10% FP at spike (not the AC bar — the AC bar is week-5
target). If spike misses, ADR-0007 needs to budget more iteration time
or relax AC-O4/AC-O5.

### Concern C — Cover-art determinism across Node and React Native is not free

Sable's spec is correct on intent. Implementation has 4 places where
divergence creeps in:

1. **Seeded PRNG.** Must use a pure-JS implementation (e.g., `seedrandom`)
   on both runtimes; native PRNG differs.
2. **SVG attribute serialization.** `react-native-svg` and `@resvg/resvg-js`
   serialize attributes in different orders and with different precision
   on floats. Need a canonicalization pass.
3. **Lucide icon path resolution.** Lucide-react-native and lucide
   (Node) ship the same icons; double-check version pin matches.
4. **Number formatting.** `0.5` vs `.5` vs `0.50000` differ across
   serializers; round to 3-decimal precision before SVG attribute write.

ADR-0005 needs a concrete determinism contract + golden-snapshot tests
that run on both Node (Jest) and RN (jest-expo). **Add to ADR-0005
test spec: 10 cover-art golden tests, each asserting byte-identical
SVG output across both runtimes for the same `(stance, palette, icon,
seed)` inputs.**

### Concern D — Re-prompt-to-edit edge cases (small, but un-spec'd)

canvas-v0.md AC-P (re-prompt flow) and Sable's user flow handle the happy
path. Three edge cases need spec language before ADR-0007:

1. **Re-prompt produces an out-of-scope.** Existing tool stays untouched;
   user sees out-of-scope surface; no `mini_app_version` row created.
   Robert's spec is silent; my proposal: explicit AC: re-prompt failures
   never modify the existing tool.
2. **Re-prompt fails validation (`invalid_spec`).** Same: existing tool
   stays untouched.
3. **Re-prompt drops the editing-pill before submit.** User wants to
   create a new tool from the same prompt. Currently Sable's design says
   "next submission creates a *new* tool" — clarify: a *clone* of the
   original tool with the new spec, or a wholly new tool? My read: wholly
   new tool, no parent_id, no shared `mini_app_id`. Robert to confirm.

These are 1-paragraph clarifications, not blockers.

### Concern E — Schema versioning isn't free, and V0 should keep one door open

The brief locks V0 at 4 archetypes. The M2 work locked an 8-archetype
taxonomy. If V0.5 ever wants to widen back to 8 (likely — the M2 archetypes
were sound), the V0 schema should reserve the M2 archetype names so
adding `Dashboard` or `Social` later is an enum-widening, not a breaking
change.

**My recommendation:** in `packages/protocol/spec.zod.ts`, the
`archetype` field is `z.enum(['ListCRUD', 'Tracker', 'Journal',
'Calculator'])` for V0 — but the brief's "no SemVer in V0" rule means
we need to think now about how V0.5 widens it. Three options:

1. Add a `protocolVersion: '1.0'` field, version-gate validation. Costs
   a bit of schema complexity; future-proof.
2. Keep the enum tight and accept that V0.5 ships a breaking schema
   change (handled by App Store update — protocol is bundled, not
   served).
3. Keep the enum tight + reserve unknown archetype values as `unknown`
   (LLM emits, server rejects, telemetry captures) — same pattern M2
   already used.

I prefer (3): minimal V0 surface, V0.5 widens by lifting the enum, no
versioning ceremony required because the protocol is bundled with the
app build (per brief invariant #9: capabilities require App Store
update).

---

## Summary

- **§0:** I recommend **Supersede**, with one caveat (Sponsor confirms 6 weeks is real, not aspirational).
- **Prop signatures:** 7 friction points, all resolvable in ADR-0005. Most-impactful: F-1 `Binding` discriminated union for state-bound props; F-3 ListItem slot kinds; F-4 the `share` verb question.
- **ADR slicing:** 4 ADRs as Sable proposed. Critical path: ADR-0005 Week 1; ADR-0006 + 0007 Weeks 2–5 in parallel; ADR-0008 Weeks 3–5.
- **Concerns to raise:** **A** (latency spike) and **B** (out-of-scope eval spike) need Week 0 work *before* ADR-0007. **C** (cover-art determinism) is an ADR-0005 test-spec issue. **D** and **E** are 1-paragraph clarifications.

I'll wait on Sponsor's §0 decision before authoring ADR-0005..0008. If
Sponsor picks Supersede and accepts Concerns A and B as Week-0 spikes,
I can have ADR-0005 in draft by 2026-05-14.

— Cal

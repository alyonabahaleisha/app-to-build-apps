# ADR-0005: Canvas V0 — Protocol & Design System

_Authored by Cal — 2026-05-07_

## Status

**Accepted (rev-2 + 1-line patch).** Sponsor (Alyona) signed canvas-v0.md §0 = **Supersede**
on 2026-05-07. ADR-0004 surfaces (planner, `/edit`, patch tool) become
legacy on this ADR's merge; the telemetry whitelist (Step 8) and
eval-mode short-circuit (Step 9) carry forward verbatim into ADR-0007.
F-4 from the prop-review note is locked: the `share` action verb is
**cut** from the spec — Share is host-meatball-only.

Roz test-spec review history:
- **rev-0 → rev-1** (2026-05-08): REVISE. 2 P0s, 5 Highs, 6 Mediums, 3 Lows, 5 missing tests. All closed in rev-1. F-12 (radius count) Sponsor-ruled at 5.
- **rev-1 → rev-2** (2026-05-08): APPROVE WITH NOTES. All P0/High findings genuinely closed; 2 material new findings (NV-1 Step 10 file-path inconsistency, NV-3 Binding<state>.slot schema-consistency gap) and 3 minor (NV-2 stale ratio table, NV-4 totals arithmetic, NV-5 ID numbering note). This rev-2 revision closes all 5 NV-* findings.

**Awaiting Roz rev-2 review.** Expected fast — all rev-2 changes are surgical: file-path alignment, shared `SlotNameSchema` between `Binding<*>.slot` and `Spec.initialState` keys (with parameterized regex-failure tests), arithmetic/numbering cleanup.

### Roz findings (rev-0) — closed by this revision

| Finding | Severity | Resolution |
|---|---|---|
| **F-01** Cover-art cross-runtime snapshot trap | **P0** | T-0005-243..254 expanded to 12 fixtures (was 10) covering all 2×6 stance/palette combos. Added T-0005-255 — explicit cross-file SVG-string extraction + byte-equal assertion that runs in CI after both Jest (Node) and jest-expo (RN) suites complete. The 5th failure mode (snapshot-file format divergence) is now explicit. |
| **F-02** `share` codegen-level guard | **P0** | Added T-0005-187a (Step 7): asserts `generated/json-schema.json` does not contain the string `"share"` in any verb type enum or schema definition. T-0005-039 still covers schema-level rejection. |
| **F-03** T-0005-178 behavioral coverage | High | Rewritten: test suite collects observed `ValidationErrorCode` values across all live `validateCrossRefs()` calls and asserts set equality with the closed enum. Not a `Object.values().length` inspection. |
| **F-04** Multi-error accumulation | High | Added T-0005-174a (4 simultaneous violations across 4 categories all surface) and T-0005-176a (errors at depth 5+ on two separate subtrees both surface with correct paths). |
| **F-05** Codegen-drift simulation fidelity | High | T-0005-185 replaced with the byte-identical reproducibility check (T-0005-180 covers); the workflow-level enforcement is documented as validated by `codegen-drift.yml` itself. T-0005-186 sharpened to YAML-file inspection. |
| **F-06** T-0005-152 nesting-depth misalignment | High | Rewritten: Zod accepts arbitrarily deep nesting; the cap lives in `validateCrossRefs()` (Step 6 T-0005-173). Step 5 confirms the structural side; Step 6 confirms the bound. |
| **F-07** Step 7 ratio | High | Added T-0005-183a — `gen-docs.ts` emits non-empty paragraph for each of 28 components (parameterized). Brings Step 7 to 5 failure vs. 4 happy. |
| **F-08** Step 8 count off-by-one | Medium | Range extended to T-0005-189..200 (12 IDs covering 12 stance/palette combos). Happy count corrected to 17; downstream IDs (199 → 201 onward for security) shifted; total 33 holds. |
| **F-09** Per-input binding-kind tests | Medium | Added T-0005-072a/b/c — `TextField` × all 3 binding kinds. Step 4 Notes for Colby includes a parameterization comment for the other 5 input components. |
| **F-10** Max-size seed payload boundary | Medium | Added T-0005-064a — 50 rows × 20 fields × max-len strings parses in <500ms. Proves the "worst-case parse cost is bounded" claim. |
| **F-11** Layer 4 (productive gradient) placement | Medium | **Layer 4 lives in the renderer (ADR-0006), not `coverArt.ts`.** It's a Library-card overlay, not a cover-art identity element. T-0005-262's allowed-attribute set unchanged. Documented in §J and Step 10 ACs. |
| **F-12** Radius count | Medium | **Sponsor-locked at 5** (`radius-none, sm, md, lg, full`). Brief's "4" was a count typo for the 5 named values. Step 1 ACs updated; Documentation Impact gains a note that canvas-v0-brief.md §3.2 patches in a follow-up. |
| **F-13** Verb count = 12 codegen guard | Medium | Added T-0005-187b — `generated/json-schema.json` action verb enum has exactly 12 members. Consequences notes ADR-0006 will update canvas-v0.md AC-R4 (13 → 12). |
| **F-14** T-0005-150 description note | Low | Description expanded: "Calculator with 0 collections is valid at schema level; cross-ref validator only checks seed data on collections that exist." |
| **F-15** Error-path action-level test | Low | Added T-0005-176b — error path on action target reads `['screens', 0, 'root', 'children', 1, 'action', 'collection']`. |
| **F-16** Icon size rejection mechanism | Low | T-0005-231 description specifies: TypeScript compile-time enforcement only (the `size` prop is a literal-union type `16 | 20 | 24 | 32`); runtime guard not required because TS prevents the call site. |
| **MT-1** initialState non-BindingValue | Add-inline | Added T-0005-150a — `SpecSchema.parse({initialState: {slot: {nested: 'object'}}})` fails. |
| **MT-2** initialState slot key length | Add-inline | Added T-0005-150b in Step 5 (Zod-parse failure, not validator failure) — `SpecSchema.parse({initialState: {<65-char-key>: ...}})` fails. **Architectural call:** slot-name length is a shape constraint; keeps the cross-ref validator at exactly 12 error codes. |
| **MT-3** coverArt empty-path runtime guard | Add-inline | Added T-0005-256 — `coverArt({icon: <name with empty ICON_PATHS entry>})` throws named error. |
| **MT-4** Collection self-reference | Add-inline | **Allowed at schema; cross-ref validator allows self-reference.** Use case: a Workouts collection referencing a parent-Workout for "rep of" tracking. Documented in Step 3 ACs. Added T-0005-057a — self-referencing `targetCollectionId === id` parses; cross-ref validator returns ok. |
| **MT-5** theme() returns frozen output | Add-inline | Added T-0005-218a — `theme()` returns `Object.freeze`'d output; mutating the returned object throws in strict mode and never affects subsequent calls. |
| **Sensitivity** validateCrossRefs error row | (Roz note) | Added a row to the Data Sensitivity table — error returns reveal spec structure (not user PII), `public-safe` for logging, ADR-0007 should gate verbatim return to end-users. |

### Roz findings (rev-1 → rev-2) — closed by this revision

| Finding | Severity | Resolution |
|---|---|---|
| **NV-1** Step 10 file paths inconsistent with test table | Material | Step 10 "Files to create" updated: removed rev-0 artifact `__snapshots__/coverArt.test.ts.snap`; aligned Node store to `__node-snapshots__/coverArt.test.ts.snap` and added RN store `__rn-snapshots__/coverArt.rn.test.ts.snap`. ACs updated to "12 fixtures" (was 10). Test Helpers section updated to "12 cover-art golden inputs" (was 10). |
| **NV-3** `Binding<state>.slot` and `initialState` keys used different schemas | Material | Promoted `SlotNameSchema = z.string().min(1).max(64).regex(/^[a-z][a-zA-Z0-9_]{0,63}$/)` to a shared export in `binding.ts`. Both `Binding<*>.slot` (Step 2) and `Spec.initialState` keys (Step 5) now use the same schema. Step 2 ACs and code shape updated. Added T-0005-036a — parameterized regex-failure test across all 5 binding types (`StringBinding`, `NumberBinding`, `BooleanBinding`, `DateBinding`, `ImageBinding`) with `slot: '1numericStart'`. +5 tests. |
| **NV-2** Stale ratio table for Steps 4, 7, 10 | Minor | Ratio table updated to rev-2 actuals: Step 4 (50 vs. 40), Step 7 (4 vs. 7 — F-07 closed), Step 10 (25 vs. 21). Behavioral-collapse rule annotated where ratios inverted at raw count. |
| **NV-4** Totals arithmetic 289+15 ≠ 308 | Minor | Breaking-change tests folded into "New" column per Roz's recommendation. New column now includes the 3 breaking tests in Step 2 and 1 in Step 4. New + Regression = Total per row, and column sums match the grand total. **rev-2 total: 313 tests** (298 new + 15 regression). |
| **NV-5** T-0005-256 ID base reuse | Minor | Added a numbering note to the Step 10 test table header explaining T-0005-256 is the 12th RN golden and T-0005-256a/b/c are independent tests sharing the base by insertion-adjacency. Future revisions should renumber rather than continue suffix-stacking. |

This ADR depends on canvas-v0.md §0 sign-off and is the foundation for
ADR-0006 (renderer), ADR-0007 (generation), and ADR-0008 (Universal
Links). It does not depend on the Week-0 latency or out-of-scope
spikes; those gate ADR-0007.

## Context

Canvas V0 ships a public iOS launch in 6 weeks: a user describes a
personal tool, an LLM emits a structured spec from a closed catalog,
and a native renderer mounts it in 7–9 seconds (canvas-v0.md
`AC-G10` p95 ≤12s). The brief locks five closed registries —
components (28), action verbs (12 after F-4 cut), AI tasks (1), stances
(2), palettes (6) — plus a token surface and a deterministic cover-art
formula. The LLM picks names from those registries; it never picks
hex, px, ms, font sizes, or anything else. The protocol is the contract
that enforces this.

The existing `packages/a2ui-schema/` was authored for M1's 10-component
catalog and extended for M2's plan + JSON-patch tools. It cannot be
extended into V0's 28-component shape without becoming the kind of
schema that's hard to reason about and easy to break: stance-locked
tokens, palette-resolved tokens, state-bound bindings, polymorphic
slots, recursive children, cross-reference invariants, closed icon
enums, and seeded SVG generation are V0 concerns that don't sit on top
of M1's flat shape. **A new package is the cheaper move.**

`packages/a2ui-schema/` stays in the tree for legacy reads of M2 alpha
data; nothing in V0 imports from it once ADR-0007 lands. `packages/protocol/`
is the new source of truth.

`packages/design-system/` is also new — it carries token resolutions,
the theme function, the 80-icon catalog, and the cover-art deterministic
generator. The brief calls out this split (§2.6). The split is meaningful
because the LLM sees only the *names* of tokens (which live in protocol);
the resolution to hex / pt / ms is a renderer/host concern (which lives
in design-system).

> **What if we do nothing (don't write this ADR):** the engineer reaches
> for `packages/a2ui-schema/index.ts` to add 28 components, discovers
> three days in that the M1 schema has no place for stance-or-palette
> resolution, no place for typed collections with seed data, no place
> for state bindings vs. literal values, no place for cross-reference
> validation, and either (a) bolts these on, producing a schema that
> doesn't match the protocol the brief locked, or (b) starts the new
> package late — losing a week of ADR-0006 / ADR-0007 parallelism that
> the 6-week budget can't afford.
>
> That's the failure mode this ADR exists to prevent.

### Constraints

These shape every decision below:

1. **The protocol is the LLM contract.** The model never picks free-form
   values; everything it emits is a closed-enum name or a structurally-
   typed shape. `tool_choice` is forced (CLAUDE.md §3) — single tool in
   V0; the second `out_of_scope` tool ships in ADR-0007 and uses
   `tool_choice: 'auto'`. ADR-0005 ships a single-tool input_schema.
2. **Schema source of truth is `packages/protocol/spec.zod.ts`,
   hand-edited Zod, ~300–450 lines.** Codegen targets in
   `packages/protocol/generated/` are derived; CI rejects hand-edits.
   (canvas-v0-brief.md §2.5.)
3. **The protocol is bundled, not served.** Capability changes require
   App Store update (canvas-v0-brief.md §2.1 invariant #9). No SemVer
   protocol versioning in V0; bump-by-build instead.
4. **`packages/protocol/` depends on nothing else in the workspace.**
   It's the bottom of the dependency graph. `packages/design-system/`
   depends on `packages/protocol/` (imports enum names). The renderer
   (ADR-0006) and the API (ADR-0007) both depend on both.
5. **Cover-art generation must be byte-identical across Node and React
   Native.** Same `(stance, palette, icon, seed)` → same SVG string,
   no exceptions. This is the social-object-identity invariant from
   canvas-v0-ux.md §Universal Link install-gate.
6. **The retro lessons apply** (`.claude/references/retro-lessons.md`):
   every store method gets a Data Sensitivity row; every endpoint gets
   a response shape; every env var gets config-exhaustion tests.

### Prior art reviewed

- **ADR-0001** — auth + DB schema. Untouched by this ADR; the
  `mini_apps` and `mini_app_versions` tables are V0-renamed
  `projects` / `project_versions`, but that rename is ADR-0007's
  surface (it owns the route/store layer and the new column for
  `cover_art_seed`).
- **ADR-0003** — A2UI renderer. Untouched. ADR-0006 supersedes its
  catalog wholesale.
- **ADR-0004** — Plan→Build pipeline. **Surfaces retired by ADR-0007**:
  planner orchestrator, `/edit` route, `produce_app_spec_patch`,
  planner system prompt, `produce_plan` tool. **Surfaces kept verbatim
  by ADR-0007**: telemetry whitelist module, eval-mode short-circuit.
  ADR-0005 doesn't touch any of these — they're ADR-0007's scope.
- **`packages/a2ui-schema/src/index.ts`** — read for cross-reference
  patterns (`.superRefine`, `z.lazy`, `z.discriminatedUnion`,
  canonicalization). The new package reuses these patterns wholesale;
  no new Zod tricks.
- **`packages/a2ui-schema/src/canonical.ts`** — `canonicalize` and
  `renderHash` are reused verbatim; the new package re-exports them
  via the package root (no separate `canonical` subpath needed).

## Decision

Build **two new packages** —

1. `packages/protocol/` — the V0 schema, validator, and codegen.
2. `packages/design-system/` — token resolutions, icons, cover-art.

— in **10 implementation steps**, each independently testable and
mergeable. ADR-0005 retires no surface in this build window; legacy
`packages/a2ui-schema/` stays for M2 alpha reads until V0.5 cleanup.

### Architectural choices, with rationale

#### A. Two packages, not one — protocol owns names, design-system owns resolutions

The protocol carries enum *names*: `'focus'`, `'productive'`,
`'health'`, `'dumbbell'`, `'space-md'`, etc. The design-system carries
the *resolution* of those names to concrete values: hex codes, pt
spacings, ms durations, Lucide SVG paths.

Why this split is non-negotiable for V0:

1. **The LLM doesn't need hex.** If the schema carried `accent: '#5B8F4D'`,
   the LLM could (and would) emit invented hex values. By giving the
   model only the name `'health'`, the resolution is owned by us — and
   the contrast guarantees in canvas-v0-ux.md §Palette System hold.
2. **Light + dark + future themes.** V0 is light-mode only, but the
   resolver pattern means V0.5 dark mode is a function-output change,
   not a schema change. If hex lived in the schema, every existing
   spec would need to be re-emitted for dark mode.
3. **Server vs. client cover-art.** The server renders cover art to
   PNG for OG images (Node + `@resvg/resvg-js`); the client renders
   inline SVG (RN + `react-native-svg`). Both consume the same
   `coverArt(stance, palette, icon, seed)` function from design-system.
   If the resolution lived in protocol, server and client would need
   the protocol package — which they do anyway, but the resolution
   leakage would force LLM-served strings to carry stance-knowledge
   they shouldn't have.

The dependency graph:

```
@app-creator/protocol ──(depends on)──> nothing
@app-creator/design-system ──(depends on)──> @app-creator/protocol
@app-creator/a2ui-renderer ──(depends on)──> protocol + design-system   [ADR-0006]
services/api ──(depends on)──> protocol + design-system                 [ADR-0007]
apps/mobile ──(depends on)──> protocol + design-system + renderer       [ADR-0006/7]
```

#### B. Schema organized by concern, not by component

`packages/protocol/spec.zod.ts` is one file. (Multiple files would
fragment the LLM input_schema codegen and create import cycles among
the discriminated unions.) Inside the file, sections in this order:

1. **Token name enums** — `ColorToken`, `SpaceToken`, `RadiusToken`,
   `TypeRole`, `Elevation`, `MotionCurve`, `IconName` (80-value enum
   loaded from a generated module — see Step 9).
2. **Stance / Palette / Archetype / Navigation / Tone enums** —
   closed, V0-tight, with reserved `'unknown'` on Archetype only
   (concern E from prop-review).
3. **`Binding<T>` discriminated unions** — `StringBinding`,
   `NumberBinding`, `BooleanBinding`, `DateBinding`, `ImageBinding`.
   Resolves F-1 from prop-review.
4. **Action verb discriminated union** — 12 verbs, each its own
   `z.object({ type: z.literal(...), ... })`. Resolves F-4 (cut
   `share`).
5. **Field type + Collection schema** — closed field types, seed-row
   shape, sync-mode enum.
6. **Component schemas** — 28 components, grouped by tier (layout,
   typography, inputs, display, lists, compound, actions). Resolves F-2
   (no runtime-only props), F-3 (slot kinds).
7. **Screen + Spec top-level schema** — recursive children via
   `z.lazy()` + manual `Node` type alias. Resolves F-7. Includes
   navigation pattern + per-pattern conformance via `.superRefine`.
8. **Re-exports** — `canonicalize`, `renderHash` from a copy of
   `canonical.ts` (or a re-export from the legacy package; my pick is
   a copy — see §H).

#### C. `Binding<T>` is the answer to "value vs. binding" tension

Sable's UX spec carries `value` props on inputs. The schema needs to
distinguish *literal initial value* from *bound to state slot* from
*bound to collection field*. A naïve `value: T` doesn't express this;
a discriminated union does:

```ts
// SlotNameSchema — shared between Binding<state>.slot AND initialState keys
// (closes Roz NV-3 / MT-2 schema-consistency: a slot referenced by a
// binding must be a structurally-valid initialState key, enforced at
// Zod parse, not deferred to the cross-ref validator).
export const SlotNameSchema = z.string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-zA-Z0-9_]{0,63}$/)

const StringBinding = z.discriminatedUnion('kind', [
  z.object({kind: z.literal('literal'), value: z.string()}),
  z.object({kind: z.literal('state'), slot: SlotNameSchema}),
  z.object({kind: z.literal('collectionField'),
            collectionId: z.string().min(1).max(64),
            field: z.string().min(1).max(64)}),
])
```

`initialState` (Step 5) uses the same `SlotNameSchema` for record keys.
A `Binding<state>` referencing a structurally-invalid slot name fails
Zod parse on the binding side, not on a downstream cross-ref check —
the architectural premise of MT-2 is preserved: slot-name structure
(length AND regex) is a shape constraint, enforced at parse time.

Inputs (`TextField`, `NumberField`, etc.) carry
`valueBinding: StringBinding` instead of `value: string`. Resolves F-1.

#### D. Action verbs are 12, not 13 — `share` is host-only

Per F-4 (resolved by Sable + Sponsor): the `share` verb has no
in-spec invocation. The host meatball owns sharing. Cutting it
collapses an ambiguous schema entry and one fewer dispatcher branch
in the renderer. The closed verb set:

| # | Verb | Params |
|---|---|---|
| 1 | `set` | `target: string` (state slot), `value: BindingValue` |
| 2 | `update` | `collection: string`, `itemId: string`, `patch: Record<string, BindingValue>` |
| 3 | `reset` | `target: string` (state slot) |
| 4 | `addItem` | `collection: string`, `item: Record<string, BindingValue>` |
| 5 | `removeItem` | `collection: string`, `itemId: string` |
| 6 | `updateItem` | `collection: string`, `itemId: string`, `patch: Record<string, BindingValue>` |
| 7 | `clearCollection` | `collection: string`, `confirmText?: string` |
| 8 | `navigate` | `target: string` (screen id) |
| 9 | `back` | (no params) |
| 10 | `capture` | `target: string` (state slot for image ref) |
| 11 | `toast` | `message: string`, `tone?: Tone` |
| 12 | `aiProcess` | `task: 'summarize'`, `collection: string`, `prompt: string`, `target: string` |

`BindingValue` is `string | number | boolean` (not the full
`Binding<T>` — actions emit literal values to slots; bindings live on
the *consuming* component).

#### E. Recursive children via `z.lazy()` + manual type alias (F-7)

Standard Zod recursion. The TS type is hand-declared because `z.infer`
can't resolve recursive references; the schema is typed as
`z.ZodType<Node>`:

```ts
export type Node =
  | {type: 'Heading'; text: string; level?: 1|2|3; align?: Align}
  | {type: 'Body'; ...}
  | ...
  | {type: 'Stack'; gap?: SpaceToken; align?: Align; children: Node[]}
  | {type: 'Card'; ...; children: Node[]}
  ;

export const NodeSchema: z.ZodType<Node> = z.lazy(() =>
  z.discriminatedUnion('type', [HeadingSchema, BodySchema, /* ... */, StackSchema, CardSchema])
)
```

Same pattern as `A2UINodeSchema` in legacy. Max nesting depth enforced
post-Zod in the cross-reference validator (§G): `MAX_NESTING_DEPTH = 8`.

#### F. ListItem polymorphic slots are `kind`-discriminated (F-3)

The slot is not a component; it's a slot *kind* that may carry a
component or a name. Closed union:

```ts
const SlotSchema = z.discriminatedUnion('kind', [
  z.object({kind: z.literal('none')}),
  z.object({kind: z.literal('icon'), name: IconNameSchema}),
  z.object({kind: z.literal('avatar'), node: AvatarSchema}),
  z.object({kind: z.literal('badge'), node: BadgeSchema}),
])
```

Used by `ListItem.leading`, `ListItem.trailing`, `SwipeableRow.leading`,
`SwipeableRow.trailing`. The renderer (ADR-0006) reads `.kind` and
dispatches.

#### G. Two-pass validation: Zod shape + cross-reference validator (F-6)

Zod alone cannot express "this `collectionId` references a collection
that exists in the same spec." A second pass walks the parsed spec and
checks:

1. Every `collectionId` referenced by a component or action exists.
2. Every `field` referenced (`MediaTray.imageField`, `Action.update.patch`
   keys, etc.) is declared on the named collection.
3. Every screen id referenced by `navigate` actions exists in `screens`.
4. Every `state` slot referenced by `Binding<state>` is declared in
   `initialState` OR auto-derivable from a `set`/`reset` action target
   in the same spec.
5. `initialScreenId` ∈ `screens.map(s => s.id)`.
6. For `tabs` navigation: number of declared tabs matches number of
   screens (≤4).
7. For `none` navigation: exactly one screen.
8. Seed-data rows: every row's keys are a subset of the collection's
   field names; every required field is present; every field's type
   matches.
9. Max nesting depth ≤ 8 across all screens' root nodes.
10. No duplicate ids (component `id`, screen `id`, collection `id`,
    state `slot`).

The validator lives in `packages/protocol/validate.ts`. Returns
`{ok: true, spec}` or `{ok: false, errors: ValidationError[]}` where
`ValidationError` is `{path: (string|number)[], message: string,
code: string}`. The error code is a closed enum with one value per
check (e.g., `unknown_collection`, `field_type_mismatch`, etc.) —
critical for ADR-0007 telemetry to log structured failure modes.

Why two passes and not one giant `superRefine`? Two reasons:

1. **Performance.** Zod's `superRefine` runs after parse; if the spec
   has 200 nodes, walking the tree twice (once for parse, once for
   refine) is fine. But with 10 cross-ref checks and a recursive shape,
   collapsing them into `superRefine` produces stack traces that are
   hard to debug. A separate validator with named checks is far
   easier to maintain.
2. **Reusability.** ADR-0007 wants to call the validator after the LLM
   emits a spec — Zod has parsed shape, but we want named cross-ref
   errors as telemetry tags. Easier to call `validateCrossRefs(spec)`
   than to interpret Zod issue codes.

Order: `parse(rawSpec) → validateCrossRefs(parsed)`. Both must succeed
to pass.

#### H. Canonicalization — copy, don't re-export from legacy

`canonicalize` and `renderHash` from `packages/a2ui-schema/src/canonical.ts`
are 26 lines and pure. The new package gets a copy at
`packages/protocol/src/canonical.ts`, exported via the package root.

Why a copy and not a re-export? Because the legacy package will be
deleted in V0.5 cleanup; re-exporting forces protocol to keep a
dependency on a deprecated package across V0. Copy now, delete the
legacy file when the legacy package goes. Boring choice; correct
choice.

#### I. Codegen runs at build time, CI guards drift

Three codegen scripts in `packages/protocol/scripts/`:

1. `gen-json-schema.ts` → emits `packages/protocol/generated/json-schema.json`.
   Uses `zod-to-json-schema` (already in `services/api/`). The output
   is the LLM tool input_schema for `produce_app_spec`; ADR-0007
   imports it.
2. `gen-types.ts` → emits `packages/protocol/generated/types.ts`. Mostly
   `z.infer<>` for non-recursive types + manual interface declarations
   for recursive `Node`. Hand-rolled — `zod-to-ts` adds a runtime dep
   for marginal value.
3. `gen-docs.ts` → emits `packages/protocol/generated/docs.md`. One
   section per token / component / action verb. ADR-0007's prompt
   builder concatenates this into the cacheable catalog block.

Build-time invocation: `pnpm --filter @app-creator/protocol codegen`.
CI: `.github/workflows/codegen-drift.yml` runs the codegen, then
`git diff --exit-code packages/protocol/generated/`. Non-empty diff
→ fail.

Why CI guard and not a `prebuild` hook? Because the prebuild hook
lives on the developer's box; CI guard catches the engineer who
hand-edited the generated file thinking it was the source. The
retro-lessons.md "incomplete tests" lesson applies — assume the
discipline isn't there, and let CI enforce.

#### J. Cover-art determinism contract — three pieces

Concern C from prop-review. The contract:

1. **Pure-JS PRNG:** `seedrandom@3.0.5` (no native bindings; same on
   Node and RN). Pinned in package.json; renovate locked.
2. **Lucide path lookup table:** generated at build time from
   `lucide-static` (which ships SVG path strings). Output:
   `packages/design-system/icons/paths.json` — one entry per icon
   name, pinned to a Lucide version. Adding the same icon name from
   a different Lucide version is a P0 break (cover art changes for
   the same `(stance, palette, icon, seed)` tuple).
3. **SVG canonical serialization:** alphabetical attribute order;
   3-decimal float precision (`.toFixed(3)` on every numeric);
   single-quote attribute values consistently; no leading/trailing
   whitespace; `\n` between sibling elements but not within an element.

`packages/design-system/coverArt.ts` is the function:

```ts
export function coverArt(input: CoverArtInput): string {
  const {stance, palette, icon, seed} = input
  const rng = seedrandom(sha256(seed))
  // ... 3 shapes from 6-shape vocabulary, positioned/rotated by rng,
  //     icon centered, stance/palette resolved to colors via theme(),
  //     emitted as canonical SVG string
}
```

Returns a string (canonical SVG). Both Node and RN consume the
string — Node passes it to `@resvg/resvg-js`, RN passes it to
`<SvgXml />` from `react-native-svg`. Byte-identical output across
runtimes is the hard contract.

**Layer 4 (Sable's productive-only title gradient) lives in the renderer
(ADR-0006), not in `coverArt.ts`.** The gradient is a Library-card
overlay that improves title legibility against the cover image; it is
not part of the cover-art identity. If it lived in `coverArt.ts`, the
canonical SVG would carry `<defs>`, `<linearGradient>`, and `<stop>`
elements that the install-gate page's PNG render needs to handle —
and the install-gate page does not show a title overlay (the title
appears below the cover, not on top of it). Keeping Layer 4 in the
renderer separates "cover-art identity" (immutable, shared by Library
card and install-gate page) from "card chrome" (rendering context,
Library-only). T-0005-262's allowed-attribute set therefore excludes
gradient-related attributes; if a future renderer change pushes Layer 4
into `coverArt.ts`, the test must be updated.

#### K. Cover-art share-record persistence — lock all four at first generation

From prop-review §2 out-of-band. The share record on `mini_apps`
(ADR-0007's table — schema decision noted here for downstream):

| Column | Type | Notes |
|---|---|---|
| `share_id` | `text` (24 char ksuid) | Public, opaque, stable across re-prompts |
| `cover_stance` | `text` | Frozen at first share |
| `cover_palette` | `text` | Frozen at first share |
| `cover_icon` | `text` | Frozen at first share |
| `cover_art_seed` | `text` (32 char hex) | Frozen at first share |

Re-prompts that flip stance/palette/icon **do not** mutate these
columns. The current spec's stance/palette/icon may differ from the
share record's; the install-gate page renders the share record's
cover art (immutable), the in-app Library card renders the current
spec's cover art (mutable on re-prompt). This trades visual
consistency for social-object-identity stability — friends who
already have the link see the cover they were originally invited
to.

Why this is the right call: the social object's stability matters
more than spec-cover synchronization. A friend who got "Workouts —
green leaf icon" via iMessage and sees "Workouts — purple book icon"
in the Library has every right to think the share is broken. The
opposite (friend's link still shows the original cover, my Library
shows the new one) is closer to "I tweaked it, the friend's copy is
the original" — coherent.

#### L. Closed enums are exhaustive in tests

For each closed enum (Stance, Palette, Archetype, Navigation, Tone,
ColorToken, SpaceToken, RadiusToken, TypeRole, Elevation, MotionCurve,
IconName, ActionVerbType, FieldType, SyncMode, BindingKind, SlotKind,
NavPattern), every value gets a happy-path parse test, and at least
one neighboring invalid value gets a rejection test. The IconName
enum (80 values) is parameterized — one test per value — so a
removed-by-accident icon is caught at CI time, not at first generation.

#### M. CI/CD impact — additive, not breaking

Two new CI jobs:

1. `codegen-drift.yml` — runs on PR changes to `packages/protocol/**`.
   Re-runs codegen, diffs `generated/`. ~30s wall-clock.
2. (Existing) `eval.yml` — **no change in this ADR**. ADR-0007 will
   add `packages/protocol/**` and `packages/design-system/**` to the
   path filter when the LLM tool input_schema migrates to the new
   schema. Until ADR-0007 lands, the eval workflow runs against
   `packages/a2ui-schema/` unchanged.

No existing job breaks because nothing in `services/api/` or
`apps/mobile/` imports from the new packages until ADR-0006 / ADR-0007
explicitly switch.

#### N. Documentation — `generated/docs.md` is the only new doc

The protocol doc generator emits `packages/protocol/generated/docs.md`
— one paragraph per token, component, action verb. ADR-0007 imports
it into the LLM system prompt. **No standalone protocol README in
this ADR**; the schema *is* the documentation, with type comments and
the generated docs.md as the LLM-reading surface.

CLAUDE.md updates: add `packages/protocol/` and `packages/design-system/`
to the workspaces list (currently mentions only `a2ui-schema` and
`a2ui-renderer`). One-line change. ADR-0007's PR description carries
the supersession note for `a2ui-schema`; ADR-0005 just adds the new
packages.

## Alternatives Considered

### Alternative 1: Extend `packages/a2ui-schema/` instead of creating `packages/protocol/`

- **Upside:** No new package to set up; CI configs and `tsconfig`
  references already point at it; no rename is needed.
- **Downside:** The legacy schema's discriminated unions are M1-shaped
  (10 components, 5 verbs). Extending them to V0's shape (28
  components, 12 verbs, bindings, slots, recursion with depth check,
  cross-ref validator, codegen) means the file becomes ~800 lines of
  mixed-vintage code. Any reader has to know "the M1 part is here,
  the V0 part is there, the M2 part was retired but lingers." Two
  years from now, nobody knows which is current.
- **Why not:** A new package is ~1 day of pnpm scaffolding; the
  alternative is a permanent maintainability tax.

### Alternative 2: Single `packages/protocol/` package that owns *both* schema and design tokens

- **Upside:** One package to depend on; one import path; one place
  for "the V0 contract."
- **Downside:** The LLM sees only the protocol; if hex / pt / ms live
  in the same package, they leak into the codegen targets unless we
  add filtering. Filter logic is bug-bait. And the renderer + host
  shell *want* a separate import surface for design tokens — the
  schema is rarely read at runtime; the tokens are read on every
  render.
- **Why not:** The LLM-vs-renderer split is the architectural seam;
  packaging should mirror it.

### Alternative 3: Generate the schema from a YAML / JSON spec

- **Upside:** Easier for non-engineers (UX, PM) to read and edit.
  Could codegen the Zod, the docs, the json-schema, and the TS types
  from a single source-of-truth YAML.
- **Downside:** Adds a meta-layer between the team and the schema.
  Zod's TypeScript-native expressivity (`z.discriminatedUnion`,
  `z.lazy`, `z.refine`) doesn't survive the round-trip. Anything more
  complex than a flat object loses fidelity. Plus the generator
  itself is a new piece of code to maintain.
- **Why not:** Hand-edited Zod is the right substrate; readability is
  a pleasing side effect.

### Alternative 4: Skip the cross-reference validator (rely on Zod alone)

- **Upside:** Simpler — one validation pass.
- **Downside:** Zod's `superRefine` can express cross-refs, but with
  2–3 levels of nested checks the error paths become inscrutable. ADR-0007
  needs structured error codes for telemetry; Zod issue codes don't
  carry semantic meaning for cross-ref violations.
- **Why not:** Two passes is the boring, correct shape. Not over-engineered;
  exactly fits the problem.

### Alternative 5: Skip codegen — write `json-schema.json` and `types.ts` by hand

- **Upside:** Simpler workflow; no CI guard needed.
- **Downside:** The schema is the single source of truth for the LLM
  tool input_schema. Hand-maintained derived files drift instantly
  the moment someone adds a token. The retro-lessons.md "incomplete
  tests from ADR-only reading" lesson is a generalization of this —
  "the discipline isn't there at the keyboard; let the toolchain
  enforce."
- **Why not:** ~3 small scripts and a CI job is a pittance.

### Alternative 6: Lock cover-art generation to the server only (no in-app SVG)

- **Upside:** No runtime determinism contract; server is the only
  cover-art renderer; mobile fetches a PNG.
- **Downside:** Mobile fetches a PNG per Library card on every cold
  start. Library load time degrades. Plus the PNG cache invalidates on
  re-prompt. Plus the install-gate page already needs server-side
  PNG; client-side SVG is the natural Library-card path because it's
  zero network and re-renderable across themes.
- **Why not:** The brief's design philosophy is "calm, native";
  fetching cover PNGs on every launch is the opposite. The
  determinism contract is a one-time engineering cost; the runtime
  benefit is permanent.

## Consequences

### Positive

- **One closed contract** for the LLM, the validator, the renderer,
  and the host. The protocol is the seam; nothing crosses it
  unstructured.
- **Deterministic cover art** survives re-prompts, theme changes, and
  the server/client split. The install-gate page works; the Library
  card works; the iMessage rich preview works.
- **Codegen + CI guard** prevents drift between the source-of-truth
  Zod and the LLM-facing json-schema / TS types / docs.md.
- **Two-pass validation** produces structured error codes that
  ADR-0007 logs as telemetry tags. Generation failure modes become
  observable.
- **No breaking change to existing M2 alpha data.** `packages/a2ui-schema/`
  stays; `mini_app_versions` rows from M2 still parse.
- **ADR-0006 / 0007 / 0008 unblock immediately** on this ADR's merge.
  The 6-week budget holds.
- **F-13 cross-reference handled.** canvas-v0.md AC-R4 currently lists 13
  verbs (includes `share`); ADR-0005 cuts `share` for 12. Resolution path:
  ADR-0006 (renderer) owns the dispatcher and will update AC-R4 in its
  Documentation Impact section. ADR-0005 stays correct as-is — the
  protocol's 12-verb enum is the source of truth.
- **F-12 brief radius typo handled.** canvas-v0-brief.md §3.2 says "Radii: 4"
  but lists 5 names. Sponsor ruled at 5 (Sable's reading). PM patches the
  brief in a follow-up commit; ADR-0005 doesn't depend on the brief
  amendment landing first.

### Negative

- **Two new packages** ≈ two new `tsconfig.build.json` files, two
  package.jsons, two jest configs. ~1 day of scaffolding (Step 1
  + Step 8); annoying but bounded.
- **Codegen workflow** adds a CI job and a `pnpm codegen` step in the
  developer loop. Engineers will occasionally forget; CI will catch.
- **Cover-art determinism** is a real engineering contract with 4
  failure modes (PRNG, attribute order, float precision, icon path
  source). Tested with golden snapshots, but a Lucide major-version
  bump would silently change covers — pin and document.
- **`packages/a2ui-schema/`** sits in the tree as legacy code. V0.5
  cleanup deletes it. Until then, it's a "don't add to this" area;
  developers may briefly confuse the two during ADR-0006 / 0007
  development.

### Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Cover-art SVG drifts byte-for-byte across Node and RN runtimes despite the contract | Medium | 10 golden snapshots run on both Jest (Node) and Jest-Expo (RN). Snapshot file is checked into `packages/design-system/__snapshots__/`. CI on both runtimes. |
| Lucide major version bump silently changes icon paths | Low-Medium | `lucide-static` pinned; renovate ignored on this dep; bump is a deliberate ADR-bumped change |
| Cross-reference validator misses an invariant the LLM exploits | Medium | Validator covers 10 named checks (§G); each is a test. Regression: when ADR-0007 prompt iteration uncovers a new failure mode, add a check + a test before relaxing prompt |
| Hand-edited `generated/` slips past CI | Low | CI guard runs codegen + diff; non-zero-exit on diff. Local reviewer skim catches the rest |
| Schema becomes hard to read at 450 lines | Low | Sectioned by concern (§B); type aliases for repeating shapes; inline comments at section boundaries. Roz reviews for readability before approval |
| `packages/protocol/` import cycle with `packages/design-system/` | Low | Protocol depends on nothing; design-system depends on protocol; tsconfig project references enforce |
| Cover-art seed collision (two tools accidentally hash to the same shape layout) | Low — visual only | KSUID seed is 24-char base62 ≈ 142 bits of entropy; collision odds at any plausible scale are zero |
| Adversarial spec triggers DoS via deeply-nested or oversized payload | Low | All schema bounds enforced by Zod (max 4 screens, max 8 collections, max 50 seed rows per collection, max 20 fields per collection, max 64 char IDs, max 200 char Heading text, max nesting depth 8 enforced by validator). Worst-case parse cost is bounded; a malicious LLM output cannot exhaust server memory. |

### Rollback path

ADR-0005 is purely additive. The two new packages are not consumed by
`services/api/` or `apps/mobile/` until ADR-0006 / ADR-0007 land.
Rollback procedure if the ADR is reverted post-merge:

1. Revert the merge commit. `pnpm install` to drop the workspace
   references.
2. The legacy `packages/a2ui-schema/` and existing renderer / generation
   code paths are untouched and continue to operate.
3. The new `.github/workflows/codegen-drift.yml` is deleted with the
   revert; no other CI changes to undo.
4. No data migration needed; no DB schema changes in this ADR.

Rollback is "safe up to the point that ADR-0006 / ADR-0007 imports
land." Once a downstream ADR consumes the new packages, rollback
becomes a coordinated revert of multiple ADRs — flagged for Roz at
that ADR's pressure-test.

## Implementation Plan

10 steps. Each step is a single PR. Order: protocol scaffold first (Step 1)
because nothing else builds without `tsconfig.build.json`; design-system
scaffold (Step 8) is independent of protocol completeness — it can start
once `packages/protocol/src/tokens.ts` (Step 1) lands. Practically:
Steps 1–7 land in week 1 (protocol); Steps 8–10 land in week 1–2
(design-system) in parallel with ADR-0006 starting on the renderer.

### Step 1: `packages/protocol/` package scaffold + token-name and core enums

**Files to create:**

- `packages/protocol/package.json` (mirror a2ui-schema's structure: pnpm, exports, scripts)
- `packages/protocol/tsconfig.json`
- `packages/protocol/tsconfig.build.json`
- `packages/protocol/jest.config.js`
- `packages/protocol/src/index.ts` (re-exports)
- `packages/protocol/src/tokens.ts` (token-name enums)
- `packages/protocol/src/enums.ts` (Stance, Palette, Archetype, Navigation, Tone, FieldType, SyncMode, BindingKind, SlotKind, NavPattern)
- `packages/protocol/src/canonical.ts` (copy from a2ui-schema)
- `packages/protocol/src/index.test.ts` (smoke + enum coverage)

**Acceptance criteria:**

- `pnpm --filter @app-creator/protocol typecheck` passes
- `pnpm --filter @app-creator/protocol test` passes
- All token-name enums export with the values from canvas-v0-ux.md §Token Surface (color: 12, space: 6, **radius: 5 — Sponsor-locked at 5 (`radius-none, sm, md, lg, full`); the brief's "4" was a count typo for the 5 named values**, type: 6, elevation: 3, motion: 4)
- `Stance = 'productive' | 'expressive'`, `Palette = 'focus' | 'health' | 'money' | 'social' | 'learn' | 'play'`, `Archetype = 'ListCRUD' | 'Tracker' | 'Journal' | 'Calculator' | 'unknown'`
- `canonicalize` and `renderHash` exported, bytewise-identical output to legacy package on a 100-key fixture object

**Estimated complexity:** Low

**Code shape:**

```ts
// packages/protocol/src/tokens.ts
import {z} from 'zod'

export const ColorTokenSchema = z.enum([
  'bg', 'bg-elevated', 'bg-overlay',
  'fg', 'fg-muted', 'fg-faint',
  'divider', 'accent', 'accent-fg',
  'success', 'warning', 'danger',
])
export type ColorToken = z.infer<typeof ColorTokenSchema>

export const SpaceTokenSchema = z.enum([
  'space-none', 'space-xs', 'space-sm', 'space-md', 'space-lg', 'space-xl',
])
// ... and so on for radius, type, elevation, motion
```

### Step 2: `Binding<T>` + Action verb discriminated union

**Files to create / modify:**

- `packages/protocol/src/binding.ts` (StringBinding, NumberBinding, BooleanBinding, DateBinding, ImageBinding)
- `packages/protocol/src/actions.ts` (12-verb discriminated union)
- `packages/protocol/src/binding.test.ts`
- `packages/protocol/src/actions.test.ts`

**Acceptance criteria:**

- Each `Binding<T>` is a 3-branch discriminated union on `kind`: `'literal'`, `'state'`, `'collectionField'`
- Each binding's `value` (for `literal`) matches the underlying T
- **`SlotNameSchema` exported from `binding.ts`** and used by both `Binding<*>.slot` (this step) and `Spec.initialState` keys (Step 5). Schema: `z.string().min(1).max(64).regex(/^[a-z][a-zA-Z0-9_]{0,63}$/)`. Closes NV-3 / MT-2: slot-name structure is a shape constraint enforced at Zod parse on both surfaces.
- Action verb union has exactly 12 members; `share` is absent; `T-0005-XXX` test asserts cardinality
- Each verb's params validated independently (e.g., `aiProcess.task: 'summarize'` is the only allowed value in V0)

**Estimated complexity:** Low

**Code shape:**

```ts
// packages/protocol/src/binding.ts
// Shared with Spec.initialState keys (Step 5) — closes NV-3 / MT-2.
export const SlotNameSchema = z.string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-zA-Z0-9_]{0,63}$/)

export const StringBindingSchema = z.discriminatedUnion('kind', [
  z.object({kind: z.literal('literal'), value: z.string()}),
  z.object({kind: z.literal('state'), slot: SlotNameSchema}),
  z.object({kind: z.literal('collectionField'), collectionId: z.string().min(1).max(64), field: z.string().min(1).max(64)}),
])
```

### Step 3: Field types + Collection schema + seed validation

**Files to create:**

- `packages/protocol/src/collection.ts`
- `packages/protocol/src/collection.test.ts`

**Acceptance criteria:**

- `FieldTypeSchema` is `z.discriminatedUnion('type', [...string, number, boolean, date, image, reference])`; `reference` carries `targetCollectionId`
- `CollectionSchema` carries `id`, `name`, `fields: Field[]` (1–20), `seedData: Row[]` (1–50), `syncMode: 'local' | 'cloud-private'`
- Field name regex: `^[a-z][a-zA-Z0-9_]{0,63}$`
- Collection id regex: `^[a-z][a-zA-Z0-9_]{0,63}$`
- Seed-row validation: every row's keys ⊆ collection field names; required fields all present (deferred to Step 6 cross-ref validator)
- **Self-referential collections allowed** (per MT-4 decision): a collection's `reference`-type field with `targetCollectionId === <own id>` parses at schema and is accepted by the cross-ref validator. The renderer dispatcher resolves circular references via id; spec authors are responsible for breaking cycles in seed data.

**Estimated complexity:** Low-Medium

**Code shape:**

```ts
// packages/protocol/src/collection.ts
export const FieldTypeSchema = z.discriminatedUnion('type', [
  z.object({type: z.literal('string')}),
  z.object({type: z.literal('number')}),
  z.object({type: z.literal('boolean')}),
  z.object({type: z.literal('date')}),
  z.object({type: z.literal('image')}),
  z.object({type: z.literal('reference'), targetCollectionId: z.string().min(1).max(64)}),
])
```

### Step 4: 28 component schemas, grouped by tier

**Files to create:**

- `packages/protocol/src/components/layout.ts` (5: Screen, Section, Stack, Row, Card)
- `packages/protocol/src/components/typography.ts` (3: Heading, Body, Caption)
- `packages/protocol/src/components/inputs.ts` (5: TextField, NumberField, DateField, Picker, Switch)
- `packages/protocol/src/components/display.ts` (4: Stat, Badge, Chip, Avatar)
- `packages/protocol/src/components/lists.ts` (5: List, ListItem, SwipeableRow, EmptyState, LoadingState)
- `packages/protocol/src/components/compound.ts` (4: ConditionalSection, ListSummary, MediaTray, ImagePicker)
- `packages/protocol/src/components/actions.ts` (2: Button, FAB)
- `packages/protocol/src/components/slot.ts` (Slot discriminated union for ListItem leading/trailing)
- `packages/protocol/src/components/index.ts` (re-exports + Node type alias placeholder)
- `packages/protocol/src/components/<tier>.test.ts` (one test file per tier)

**Acceptance criteria:**

- Each of 28 components is a Zod object schema with the props from canvas-v0-ux.md §Component Specs
- `Button` has no `loading` prop; `disabled: BooleanBinding | undefined` (resolves F-2)
- `ListItem.leading` and `ListItem.trailing` are `SlotSchema` (resolves F-3)
- All `value` props on inputs are `Binding<T>` (resolves F-1)
- `share` action verb is absent from every component's `action` field's allowed verbs (resolves F-4)
- All component `id` fields use the same regex as collection ids
- `MAX_NESTING_DEPTH = 8` constant exported (used by Step 6 validator)

**Estimated complexity:** Medium-High (28 components; volume more than complexity)

**Code shape:**

```ts
// packages/protocol/src/components/inputs.ts
export const TextFieldSchema = z.object({
  id: z.string().regex(/^[a-z][a-zA-Z0-9_]{0,63}$/),
  type: z.literal('TextField'),
  label: z.string().min(1).max(80),
  placeholder: z.string().max(80).optional(),
  valueBinding: StringBindingSchema,
  multiline: z.boolean().optional(),
  keyboardType: z.enum(['default', 'email-address', 'url']).optional(),
  maxLength: z.number().int().positive().max(2000).optional(),
  optional: z.boolean().optional(),
})
```

### Step 5: Top-level Spec + Screen + recursive Node

**Files to create:**

- `packages/protocol/src/spec.zod.ts` (top-level Spec, Screen, Node alias, NavPattern conformance)

**Acceptance criteria:**

- `Spec` has: `version: 1`, `archetype: ArchetypeSchema`, `stance: StanceSchema`, `palette: PaletteSchema`, `coverIcon: IconNameSchema`, `navigation: NavPatternSchema`, `screens: Screen[]` (1–4), `initialScreenId: string`, `collections: Collection[]` (0–8), `initialState?: z.record(SlotNameSchema, BindingValueSchema)` where `SlotNameSchema = z.string().min(1).max(64).regex(/^[a-z][a-zA-Z0-9_]{0,63}$/)` — the same regex/length as `Binding<state>.slot` (per MT-2 architectural call: slot-name length is a shape constraint enforced at Zod parse, not at validator)
- `Screen` has: `id`, `title?` (for stack subheader / tab label), `root: Node`
- `NodeSchema` is `z.lazy()` over the discriminated union of all 28 components
- `.superRefine` on Spec checks: `initialScreenId` ∈ screens (other cross-refs are Step 6)
- Type alias `export type Node = ...` carries the recursive shape for `z.ZodType<Node>` (resolves F-7)

**Estimated complexity:** Medium

**Code shape:**

```ts
// packages/protocol/src/spec.zod.ts
export type Node =
  | { type: 'Heading'; ... }
  | { type: 'Stack'; gap?: SpaceToken; align?: Align; children: Node[] }
  | ... // 26 more

export const NodeSchema: z.ZodType<Node> = z.lazy(() =>
  z.discriminatedUnion('type', [
    HeadingSchema, BodySchema, /* ... */ FabSchema,
  ])
)

export const ScreenSchema = z.object({
  id: z.string().regex(/^[a-z][a-zA-Z0-9_]{0,63}$/),
  title: z.string().max(40).optional(),
  root: NodeSchema,
})

export const SpecSchema = z.object({
  version: z.literal(1),
  archetype: ArchetypeSchema,
  stance: StanceSchema,
  palette: PaletteSchema,
  coverIcon: IconNameSchema,
  navigation: NavPatternSchema,
  screens: z.array(ScreenSchema).min(1).max(4),
  initialScreenId: z.string(),
  collections: z.array(CollectionSchema).max(8),
  initialState: z.record(SlotNameSchema, BindingValueSchema).optional(), // SlotNameSchema imported from binding.ts — closes NV-3
}).superRefine((spec, ctx) => {
  const ids = new Set(spec.screens.map(s => s.id))
  if (!ids.has(spec.initialScreenId)) {
    ctx.addIssue({code: z.ZodIssueCode.custom, message: 'initialScreenId not in screens', path: ['initialScreenId']})
  }
})
```

### Step 6: Cross-reference validator (`validate.ts`)

**Files to create:**

- `packages/protocol/src/validate.ts`
- `packages/protocol/src/validate.test.ts`

**Acceptance criteria:**

- `validateCrossRefs(spec): ValidatorResult` runs the 10 named checks from §G
- `ValidatorResult = {ok: true, spec: Spec} | {ok: false, errors: ValidationError[]}`
- `ValidationError = {path: (string|number)[], message: string, code: ValidationErrorCode}`
- `ValidationErrorCode` is a closed enum: `unknown_collection`, `unknown_field`, `field_type_mismatch`, `unknown_screen`, `unknown_state_slot`, `seed_field_missing`, `seed_field_extra`, `seed_required_missing`, `nav_screen_count_mismatch`, `none_nav_multiple_screens`, `nesting_too_deep`, `duplicate_id`
- All checks return early on first failure within their concern; the function returns *all* errors across concerns (don't stop on first error globally — Roz wants the whole list)

**Estimated complexity:** Medium

**Code shape:**

```ts
// packages/protocol/src/validate.ts
export type ValidationErrorCode =
  | 'unknown_collection' | 'unknown_field' | 'field_type_mismatch'
  | 'unknown_screen' | 'unknown_state_slot'
  | 'seed_field_missing' | 'seed_field_extra' | 'seed_required_missing'
  | 'nav_screen_count_mismatch' | 'none_nav_multiple_screens'
  | 'nesting_too_deep' | 'duplicate_id'

export type ValidationError = {
  path: (string | number)[]
  message: string
  code: ValidationErrorCode
}

export type ValidatorResult =
  | {ok: true; spec: Spec}
  | {ok: false; errors: ValidationError[]}

export function validateCrossRefs(spec: Spec): ValidatorResult {
  const errors: ValidationError[] = []
  // ... 10 checks accumulate into errors
  return errors.length ? {ok: false, errors} : {ok: true, spec}
}
```

### Step 7: Codegen + CI guard

**Files to create:**

- `packages/protocol/scripts/gen-json-schema.ts`
- `packages/protocol/scripts/gen-types.ts`
- `packages/protocol/scripts/gen-docs.ts`
- `packages/protocol/scripts/index.ts` (orchestrator: runs all 3)
- `packages/protocol/generated/.gitkeep`
- `.github/workflows/codegen-drift.yml`
- `packages/protocol/package.json` updates: add `codegen` script, dev-dep on `zod-to-json-schema`

**Acceptance criteria:**

- `pnpm --filter @app-creator/protocol codegen` produces 3 files in `generated/`
- All 3 files are reproducible (running twice produces identical output)
- `gen-docs.ts` emits a markdown file with one section per token type, component, action verb (60+ sections)
- `codegen-drift.yml` workflow runs on PR, fails on `git diff --exit-code packages/protocol/generated/` non-empty
- `.gitignore` does NOT exclude `generated/` (it's checked in for the LLM tool input_schema)

**Estimated complexity:** Low-Medium

**Code shape:**

```ts
// packages/protocol/scripts/gen-json-schema.ts
import {SpecSchema} from '../src/spec.zod.js'
import {zodToJsonSchema} from 'zod-to-json-schema'
import * as fs from 'node:fs'

const json = zodToJsonSchema(SpecSchema, {target: 'jsonSchema7', name: 'Spec'})
fs.writeFileSync('packages/protocol/generated/json-schema.json', JSON.stringify(json, null, 2) + '\n')
```

### Step 8: `packages/design-system/` package scaffold + tokens.ts + theme.ts

**Files to create:**

- `packages/design-system/package.json` (depends on `@app-creator/protocol`)
- `packages/design-system/tsconfig.json`
- `packages/design-system/tsconfig.build.json`
- `packages/design-system/jest.config.js`
- `packages/design-system/src/index.ts`
- `packages/design-system/src/tokens.ts` (resolution constants)
- `packages/design-system/src/theme.ts` (`theme(stance, palette)` → `ResolvedTheme`)
- `packages/design-system/src/theme.test.ts` (12 contrast pairs, 12 visual registers)
- `packages/design-system/src/tokens.test.ts`

**Acceptance criteria:**

- `tokens.ts` exports concrete values for: 6 spacing pts, 5 radii pts, 6 type roles per stance (size/line-height/weight/tracking), 3 elevation shadow recipes, 4 motion curves
- Per stance, 10 stance-locked colors (canvas-v0-ux.md table); per stance × palette, `accent` and `accent-fg` (canvas-v0-ux.md table — 12 pairs)
- `theme(stance, palette)` returns a `ResolvedTheme` object with all token names → values for the (stance, palette) combination
- All 12 `accent`/`accent-fg` pairs verified ≥4.5:1 contrast (test asserts via a contrast helper)
- `tokens.ts` does NOT export `Stance` or `Palette` types — it imports them from `@app-creator/protocol`

**Estimated complexity:** Low-Medium

**Code shape:**

```ts
// packages/design-system/src/theme.ts
import type {Stance, Palette, ColorToken} from '@app-creator/protocol'

const stanceColors = {
  productive: { bg: '#FAFAF7', 'bg-elevated': '#FFFFFF', /* ... */ },
  expressive: { bg: '#FBF8F3', /* ... */ },
} as const

const accentByPalette = {
  productive: { focus: '#4F46E5', health: '#0E9F6E', /* ... */ },
  expressive: { focus: '#5B53D9', /* ... */ },
} as const

export function theme(stance: Stance, palette: Palette): ResolvedTheme {
  return {
    ...stanceColors[stance],
    accent: accentByPalette[stance][palette],
    'accent-fg': accentFgByPalette[stance][palette],
    spacing: SPACING,
    radii: RADII,
    type: TYPE_BY_STANCE[stance],
    elevation: ELEVATION,
    motion: MOTION,
  }
}
```

### Step 9: 80-icon module + Lucide path lookup

**Files to create:**

> **Implementation correction (2026-05-08, Roz Step 9 Finding 2):** the original "Files to create" placement put icon names + paths in `packages/design-system/`. That violated §A's "protocol depends on nothing" rule, because protocol's `spec.zod.ts` consumes `IconNameSchema` for `coverIcon`. Corrected placement (cycle-safe): names + paths + codegen live in **`packages/protocol/`**; the RN `<Icon>` component lives in `packages/design-system/`.

- `packages/protocol/src/icons/names.ts` (80-name string list + `IconNameSchema`)
- `packages/protocol/src/icons/paths.ts` (generated; name → SVG path string)
- `packages/protocol/src/icons/index.ts` (re-exports)
- `packages/protocol/scripts/gen-icon-paths.ts` (build-time codegen from `lucide-static`)
- `packages/protocol/src/icons/icons.test.ts`
- `packages/design-system/src/icons/component.tsx` (RN component: `<Icon name="..." size={24} color="..." />` — imports `IconName` type from `@app-creator/protocol`)
- `packages/design-system/src/icons/index.ts` (re-exports)
- `packages/design-system/src/icons/icons.test.ts`
- Add `lucide-static` to `packages/protocol/` dependencies (pinned exact)
- Add `lucide-react-native` to `packages/design-system/` dependencies (pinned exact, same major as lucide-static)

**Acceptance criteria:**

- All 80 icon names from canvas-v0-ux.md §Iconography are present
- `paths.ts` is generated by `pnpm --filter @app-creator/design-system gen-icons`; checked into git
- Each icon name has a non-empty SVG path string
- `Icon` component renders Lucide RN icon at any of {16, 20, 24, 32} px and any color from `theme()`
- Codegen validates: every name in `names.ts` resolves to a Lucide name; missing → fail with named error

**Estimated complexity:** Low (lucide-static is well-trodden)

**Code shape:**

```ts
// packages/design-system/scripts/gen-icon-paths.ts
import * as lucide from 'lucide-static'
import {ICON_NAMES} from '../src/icons/names.js'

const paths: Record<string, string> = {}
for (const name of ICON_NAMES) {
  const lucideKey = name.replace(/-./g, m => m[1].toUpperCase())  // 'chevron-left' -> 'chevronLeft'
  if (!(lucideKey in lucide)) throw new Error(`Lucide missing icon: ${name}`)
  paths[name] = (lucide as Record<string, string>)[lucideKey]
}
fs.writeFileSync('.../paths.ts', `export const ICON_PATHS = ${JSON.stringify(paths, null, 2)} as const\n`)
```

### Step 10: `coverArt.ts` deterministic SVG composition + golden snapshots

**Files to create:**

- `packages/design-system/src/coverArt.ts`
- `packages/design-system/src/coverArt.test.ts` (Node-runtime test — Jest)
- `packages/design-system/src/coverArt.rn.test.ts` (RN-runtime test — jest-expo)
- `packages/design-system/__node-snapshots__/coverArt.test.ts.snap` (12 Node golden SVGs, checked in)
- `packages/design-system/__rn-snapshots__/coverArt.rn.test.ts.snap` (12 RN golden SVGs, checked in)

**Acceptance criteria:**

- `coverArt({stance, palette, icon, seed}): string` returns a canonical SVG string
- Same inputs → byte-identical output across **12 fixed test cases (covering all 12 visual registers — every (stance, palette) combination)**. Per F-01 expansion vs. rev-0's 10 fixtures.
- Implementation uses `seedrandom@3.0.5` (pinned)
- 6-shape vocabulary: circle, square, rounded-square, triangle, ribbon, arc — each with a canonical SVG path template
- Output is canonical: alphabetical attributes, `.toFixed(3)` floats, `\n` between siblings
- Test runs on Node (Jest, `coverArt.test.ts`) and on RN-runtime (`jest-expo`, `coverArt.rn.test.ts`)
- **Both runtimes produce the same 12 SVG strings byte-for-byte**, verified by T-0005-256a (cross-file SVG-string extraction + byte-equal assertion across all 12 matched pairs)

**Estimated complexity:** Medium-High (the determinism contract is the hard part)

**Code shape:**

```ts
// packages/design-system/src/coverArt.ts
import seedrandom from 'seedrandom'
import {sha256} from './hash.js'  // Node + RN-safe pure JS impl
import {ICON_PATHS} from './icons/paths.js'
import {theme} from './theme.js'

export type CoverArtInput = {
  stance: Stance
  palette: Palette
  icon: IconName
  seed: string  // 32-char hex
}

export function coverArt(input: CoverArtInput): string {
  const {stance, palette, icon, seed} = input
  const rng = seedrandom(sha256(seed))
  const t = theme(stance, palette)

  const shapes = pickShapes(rng, 3)  // 3 from 6-shape vocabulary
  const positions = shapes.map(s => placeShape(s, rng, CARD_W, CARD_H))

  return canonicalSVG([
    backgroundLayer(t['bg-elevated']),
    ...positions.map(p => shapeElement(p, t.accent, stance === 'productive' ? 0.12 : 0.24)),
    iconCircleLayer(t.bg),
    iconElement(ICON_PATHS[icon], t.accent),
  ])
}
```

---

## Comprehensive Test Specification

### Test File Mapping

| Step | Test File | Env |
|---|---|---|
| 1 | `packages/protocol/src/index.test.ts`, `tokens.test.ts`, `enums.test.ts`, `canonical.test.ts` | Node (jest) |
| 2 | `packages/protocol/src/binding.test.ts`, `actions.test.ts` | Node (jest) |
| 3 | `packages/protocol/src/collection.test.ts` | Node (jest) |
| 4 | `packages/protocol/src/components/layout.test.ts`, `typography.test.ts`, `inputs.test.ts`, `display.test.ts`, `lists.test.ts`, `compound.test.ts`, `actions.test.ts`, `slot.test.ts` | Node (jest) |
| 5 | `packages/protocol/src/spec.test.ts` | Node (jest) |
| 6 | `packages/protocol/src/validate.test.ts` | Node (jest) |
| 7 | `packages/protocol/scripts/codegen.test.ts` | Node (jest) |
| 8 | `packages/design-system/src/tokens.test.ts`, `theme.test.ts` | Node (jest) |
| 9 | `packages/design-system/src/icons/icons.test.ts` | Node (jest) |
| 10 | `packages/design-system/src/coverArt.test.ts` (Node), `coverArt.rn.test.ts` (RN-style) | Node + RN-jest |

### Step 1 Tests

| ID | Category | Test Description |
|---|---|---|
| T-0005-001 | Happy | `ColorTokenSchema.parse('accent')` succeeds and returns `'accent'` |
| T-0005-002 | Happy | `ColorTokenSchema.parse('bg-elevated')` succeeds |
| T-0005-003 | Failure | `ColorTokenSchema.parse('primary')` fails with Zod error (legacy M1 name) |
| T-0005-004 | Failure | `ColorTokenSchema.parse('accent-bg')` fails (typo of `accent-fg`) |
| T-0005-005 | Boundary | `ColorTokenSchema.parse('')` fails |
| T-0005-006 | Boundary | `ColorTokenSchema.parse(null)` fails |
| T-0005-007 | Happy (parameterized) | All 12 `ColorToken` values parse |
| T-0005-008 | Happy (parameterized) | All 6 `SpaceToken` values parse |
| T-0005-009 | Happy (parameterized) | All 5 `RadiusToken` values parse (incl. `radius-none`) |
| T-0005-010 | Happy (parameterized) | All 6 `TypeRole` values parse |
| T-0005-011 | Happy (parameterized) | All 3 `Elevation` values parse |
| T-0005-012 | Happy (parameterized) | All 4 `MotionCurve` values parse |
| T-0005-013 | Happy | `StanceSchema.parse('productive')` succeeds |
| T-0005-014 | Happy | `StanceSchema.parse('expressive')` succeeds |
| T-0005-015 | Failure | `StanceSchema.parse('neutral')` fails |
| T-0005-016 | Happy (parameterized) | All 6 `Palette` values parse |
| T-0005-017 | Happy | `ArchetypeSchema.parse('Calculator')` succeeds |
| T-0005-018 | Happy | `ArchetypeSchema.parse('unknown')` succeeds (reserved) |
| T-0005-019 | Failure | `ArchetypeSchema.parse('Dashboard')` fails (M2 archetype, V0.5+) |
| T-0005-020 | Happy | `NavPatternSchema.parse('none')` succeeds |
| T-0005-021 | Happy (parameterized) | All 4 NavPattern values parse |
| T-0005-022 | Happy | `FieldType` discriminated union parses each variant (string/number/bool/date/image/reference) |
| T-0005-023 | Failure | `FieldType.parse({type: 'array'})` fails |
| T-0005-024 | Happy | `SyncMode.parse('local')` and `'cloud-private'` both pass; `'cloud-shared'` fails |
| T-0005-025 | Regression | `canonicalize({z: 1, a: 2})` returns `'{"a":2,"z":1}'` (sorted keys) |
| T-0005-026 | Regression | `renderHash` of a fixture object equals the legacy package's hash on the same object |
| T-0005-027 | Boundary | `canonicalize` of nested object (3 levels) sorts keys at every level |

#### Step 1 Test Summary

| Category | Count |
|---|---|
| Happy | 16 |
| Failure | 5 |
| Boundary | 3 |
| Regression | 3 |
| **Total** | **27** |

### Step 2 Tests

| ID | Category | Test Description |
|---|---|---|
| T-0005-028 | Happy | `StringBindingSchema.parse({kind: 'literal', value: 'hello'})` succeeds |
| T-0005-029 | Happy | `StringBindingSchema.parse({kind: 'state', slot: 'username'})` succeeds |
| T-0005-030 | Happy | `StringBindingSchema.parse({kind: 'collectionField', collectionId: 'workouts', field: 'name'})` succeeds |
| T-0005-031 | Failure | `StringBindingSchema.parse({kind: 'literal', value: 42})` fails (number for string binding) |
| T-0005-032 | Failure | `StringBindingSchema.parse({kind: 'state', slot: ''})` fails (min length) |
| T-0005-033 | Failure | `StringBindingSchema.parse({kind: 'collectionField'})` fails (missing collectionId, field) |
| T-0005-034 | Failure | `StringBindingSchema.parse({kind: 'invalid'})` fails |
| T-0005-035 | Boundary | `StringBindingSchema.parse({kind: 'state', slot: 'a'.repeat(64)})` succeeds at max length |
| T-0005-036 | Boundary | `StringBindingSchema.parse({kind: 'state', slot: 'a'.repeat(65)})` fails over-length |
| T-0005-036a | Failure (NV-3) | `StringBindingSchema.parse({kind: 'state', slot: '1numericStart'})` fails — `SlotNameSchema` regex requires lowercase-letter start. Confirms `Binding<state>.slot` uses the shared `SlotNameSchema`, not a plain `z.string().min(1).max(64)`. Mirror tests for `NumberBindingSchema`, `BooleanBindingSchema`, `DateBindingSchema`, `ImageBindingSchema` follow the same pattern (parameterize across all 5 binding types — 5 tests in one parameterized block). |
| T-0005-037 | Happy | `NumberBinding`, `BooleanBinding`, `DateBinding`, `ImageBinding` each parse `literal` variant |
| T-0005-038 | Happy | All 12 action verb literals parse with valid params |
| T-0005-039 | Failure | `ActionSchema.parse({type: 'share'})` **fails** (F-4 cut — regression for the brief) |
| T-0005-040 | Boundary | Action verb union has exactly 12 members (assert union shape size) |
| T-0005-041 | Failure | `ActionSchema.parse({type: 'set', target: 'slot1'})` fails missing `value` |
| T-0005-042 | Failure | `ActionSchema.parse({type: 'set', target: 'slot1', value: {kind: 'literal'}})` fails missing nested `value` |
| T-0005-043 | Happy | `ActionSchema.parse({type: 'aiProcess', task: 'summarize', collection: 'mood', prompt: 'sum it', target: 'summary'})` succeeds |
| T-0005-044 | Failure | `ActionSchema.parse({type: 'aiProcess', task: 'translate', ...})` fails (only 'summarize' in V0) |
| T-0005-045 | Failure | `ActionSchema.parse({type: 'navigate'})` fails missing `target` |
| T-0005-046 | Happy | `ActionSchema.parse({type: 'back'})` succeeds (no params) |
| T-0005-047 | Failure | `ActionSchema.parse({type: 'back', target: 'home'})` fails (extra param rejected via `.strict()`) |
| T-0005-048 | Boundary | `ActionSchema.parse({type: 'toast', message: ''})` fails (min 1) |
| T-0005-049 | Boundary | `ActionSchema.parse({type: 'toast', message: 'a'.repeat(200), tone: 'success'})` succeeds at max |
| T-0005-050 | Failure | `ActionSchema.parse({type: 'toast', message: 'hi', tone: 'fancy'})` fails (closed Tone enum) |
| T-0005-051 | Security | `ActionSchema.parse({type: 'toast', message: '<script>alert(1)</script>'})` succeeds (renderer escapes; schema allows arbitrary string content) |
| T-0005-052 | Breaking | `ActionSchema.parse({type: 'increment', targetId: 'foo'})` fails (legacy M1 verb removed) |
| T-0005-053 | Breaking | `ActionSchema.parse({type: 'decrement', targetId: 'foo'})` fails (legacy M1 verb removed) |
| T-0005-054 | Concurrency | Parsing the same action 1000 times in parallel produces identical results (purity check) |

#### Step 2 Test Summary

| Category | Count |
|---|---|
| Happy | 7 |
| Failure | 16 (+5 NV-3 T-0005-036a parameterized over 5 binding types) |
| Boundary | 5 |
| Security | 1 |
| Breaking | 2 |
| Concurrency | 1 |
| **Total** | **32** |

### Step 3 Tests

| ID | Category | Test Description |
|---|---|---|
| T-0005-055 | Happy | `FieldTypeSchema.parse({type: 'string'})` succeeds |
| T-0005-056 | Happy | All 6 field types parse via discriminated union |
| T-0005-057 | Happy | `FieldTypeSchema.parse({type: 'reference', targetCollectionId: 'authors'})` succeeds |
| T-0005-058 | Failure | `FieldTypeSchema.parse({type: 'reference'})` fails (missing targetCollectionId) |
| T-0005-059 | Failure | `FieldTypeSchema.parse({type: 'json'})` fails (closed enum) |
| T-0005-060 | Happy | `CollectionSchema.parse({id: 'workouts', name: 'Workouts', fields: [{name: 'date', type: {type: 'date'}, required: true}], seedData: [{date: '2026-05-07'}], syncMode: 'local'})` succeeds |
| T-0005-061 | Failure | Collection id with uppercase fails regex |
| T-0005-062 | Failure | Collection id starting with digit fails regex |
| T-0005-063 | Failure | Field name `'_private'` fails regex (must start with lowercase letter) |
| T-0005-064 | Boundary | Collection with 20 fields succeeds; 21 fails |
| T-0005-065 | Boundary | Collection with 50 seed rows succeeds; 51 fails |
| T-0005-066 | Boundary | Collection with 0 fields fails (min 1) |
| T-0005-067 | Boundary | Collection with 0 seed rows fails (min 1 — every collection has at least one seed row per brief §2.4) |
| T-0005-068 | Failure | `SyncMode.parse('cloud-shared')` fails (V0 has only local + cloud-private) |
| T-0005-069 | Happy | Field name max 64 chars succeeds; 65 fails |
| T-0005-057a | Happy (MT-4) | `CollectionSchema` with a `reference` field where `targetCollectionId === id` (self-reference) parses; cross-ref validator (Step 6) returns `ok`. Use case: a Workouts collection with a "rep of" parent-Workout reference. **Decision: self-reference allowed.** |
| T-0005-064a | Boundary (F-10) | Max-size collection: 50 rows × 20 fields × 64-char string values × 64-char field names parses successfully and `Date.now()` delta ≤ 500ms (proves the "worst-case parse cost is bounded" claim in §Risks) |

#### Step 3 Test Summary

| Category | Count |
|---|---|
| Happy | 5 |
| Failure | 6 |
| Boundary | 6 |
| **Total** | **17** |

### Step 4 Tests

Component schemas — one happy + one failure per component (28 × 2 = 56), plus targeted boundary, breaking-change, and slot-discriminator tests.

| ID | Category | Test Description |
|---|---|---|
| T-0005-070 | Happy | `ScreenSchema.parse({id: 's1', type: 'Screen', padding: 'space-lg', safeArea: 'both', children: []})` succeeds |
| T-0005-071 | Failure | `ScreenSchema.parse({id: 's1', type: 'Screen'})` fails (missing children) |
| T-0005-072a..072r | Happy (F-09 parameterized — 6 input components × 3 binding kinds = 18 tests) | Every input component (`TextField`, `NumberField`, `DateField`, `Picker`, `Switch`, `ImagePicker`) parses with each binding kind (`literal`, `state`, `collectionField`). 18 tests total; parameterized via Jest's `test.each`. Confirms every input component's `valueBinding` field uses the shared `Binding<T>` schemas, not a hardcoded literal-only variant. **Type fixtures per component:** TextField → `StringBinding`, NumberField → `NumberBinding`, DateField → `DateBinding`, Picker → `StringBinding`, Switch → `BooleanBinding`, ImagePicker → `ImageBinding`. |
| T-0005-072..097 | Happy (parameterized) | Each of 28 components parses with required-prop fixture (one fixture per component, generated from canvas-v0-ux.md). |
| T-0005-098..125 | Failure (parameterized) | Each of 28 components fails parsing with one required prop omitted |
| T-0005-126 | Failure | `Button.parse({label: 'X', action: <valid>, loading: true})` fails — `loading` not in schema (F-2 regression) |
| T-0005-127 | Happy | `Button.parse({label: 'X', action: <valid>, disabled: {kind: 'literal', value: true}})` succeeds (BooleanBinding) |
| T-0005-128 | Failure | `Button.parse({label: 'X', action: <valid>, disabled: true})` fails — `disabled` requires Binding (F-2 regression) |
| T-0005-129 | Happy | `ListItem.leading` accepts `{kind: 'icon', name: 'star'}` |
| T-0005-130 | Happy | `ListItem.leading` accepts `{kind: 'avatar', node: <Avatar fixture>}` |
| T-0005-131 | Happy | `ListItem.leading` accepts `{kind: 'badge', node: <Badge fixture>}` |
| T-0005-132 | Happy | `ListItem.leading` accepts `{kind: 'none'}` |
| T-0005-133 | Failure | `ListItem.leading: {kind: 'stat', node: <Stat>}` fails (Stat not allowed in slot kinds) |
| T-0005-134 | Failure | `ListItem.leading: {kind: 'icon', name: 'invalid-icon'}` fails (closed icon enum) |
| T-0005-135 | Boundary | `Heading.text` max 200 chars succeeds; 201 fails |
| T-0005-136 | Boundary | `Picker.options` 12-element array succeeds; 13 fails |
| T-0005-137 | Boundary | Component `id` max 64 chars succeeds; 65 fails |
| T-0005-138 | Failure | `TextField.maxLength: 0` fails (positive integer) |
| T-0005-139 | Failure | `TextField.maxLength: 2001` fails (max 2000) |
| T-0005-140 | Failure | Component types not in the 28-component catalog fail (e.g., `type: 'Counter'` from M1 — regression) |
| T-0005-141 | Happy | `MAX_NESTING_DEPTH` constant equals 8 |

#### Step 4 Test Summary

| Category | Count |
|---|---|
| Happy | 50 (+18 F-09 binding-kind parameterized tests across 6 input components × 3 binding kinds) |
| Failure | 35 |
| Boundary | 4 |
| Breaking | 1 (T-0005-140) |
| **Total** | **90** |

### Step 5 Tests

| ID | Category | Test Description |
|---|---|---|
| T-0005-142 | Happy | Minimal valid Spec parses (1 screen, 1 collection, no initialState) |
| T-0005-143 | Happy | 4-screen Spec with `tabs` navigation parses |
| T-0005-144 | Failure | Spec with 5 screens fails (max 4) |
| T-0005-145 | Failure | Spec with 0 screens fails |
| T-0005-146 | Failure | Spec missing `version` fails |
| T-0005-147 | Failure | Spec with `version: 2` fails (V0 is v1) |
| T-0005-148 | Failure | Spec with `initialScreenId: 'unknown'` fails superRefine |
| T-0005-149 | Boundary | Spec with 8 collections succeeds; 9 fails |
| T-0005-150 | Boundary (F-14 note) | Spec with 0 collections succeeds (Calculator archetype: no collections). Note: cross-ref validator (Step 6) only checks seed data on collections that exist; 0-collection specs skip that check entirely. |
| T-0005-150a | Failure (MT-1) | `SpecSchema.parse({initialState: {greeting: {nested: 'object'}}})` fails — `BindingValueSchema` is `string \| number \| boolean`; an object value is rejected by Zod |
| T-0005-150b | Failure (MT-2) | `SpecSchema.parse({initialState: {[long65CharKey]: 'value'}})` fails — `initialState` is typed as `z.record(SlotNameSchema, BindingValueSchema)` where `SlotNameSchema = z.string().min(1).max(64)`. Closes the BindingState slot-name (≤64) ↔ initialState-key length consistency. **Architectural decision:** slot-name length is a shape constraint, not a cross-reference; keep the cross-ref validator at exactly 12 error codes. |
| T-0005-151 | Happy | Recursive Node: Stack containing Stack containing Card succeeds |
| T-0005-152 | Happy (F-06 rewrite) | `SpecSchema.parse()` accepts a Spec with a Node nested 9 levels deep — confirming Zod imposes no nesting limit at the schema layer; the `MAX_NESTING_DEPTH = 8` cap is enforced by `validateCrossRefs()` (Step 6 T-0005-173). Step 5 confirms structural acceptance; Step 6 confirms the bound. |
| T-0005-153 | Happy | `coverIcon: 'dumbbell'` succeeds; all 80 icon names succeed (parameterized) |
| T-0005-154 | Failure | `coverIcon: 'unknown-icon'` fails (closed enum) |
| T-0005-155 | Happy | `Spec.parse(...)` returns spec with `Node` typing exposed |
| T-0005-156 | Regression | `canonicalize(spec)` produces sorted-key JSON |

#### Step 5 Test Summary

| Category | Count |
|---|---|
| Happy | 7 (+1 F-06 reclassification of T-0005-152 from Boundary to Happy) |
| Failure | 7 (+1 MT-1 T-0005-150a, +1 MT-2 T-0005-150b) |
| Boundary | 2 (-1 T-0005-152 reclassified) |
| Regression | 1 |
| **Total** | **17** |

### Step 6 Tests

| ID | Category | Test Description |
|---|---|---|
| T-0005-157 | Happy | Valid spec passes both Zod parse and `validateCrossRefs` |
| T-0005-158 | Failure | `unknown_collection`: Component references `collectionId: 'missing'` not in `spec.collections` |
| T-0005-159 | Failure | `unknown_field`: `MediaTray.imageField: 'photo'` references a field not in named collection |
| T-0005-160 | Failure | `field_type_mismatch`: `MediaTray.imageField` references a field of type `string`, not `image` |
| T-0005-161 | Failure | `unknown_screen`: `navigate` action targets a screen id not in `spec.screens` |
| T-0005-162 | Failure | `unknown_state_slot`: `Binding<state>` references a slot not in `initialState` and not auto-derivable |
| T-0005-163 | Happy | State slot auto-derivable from `set`/`reset` action target — no error |
| T-0005-164 | Failure | `seed_field_missing`: seed row missing a required field |
| T-0005-165 | Failure | `seed_field_extra`: seed row has a key not in the collection's fields |
| T-0005-166 | Failure | `seed_required_missing`: collection has required field `name` but seed row omits it |
| T-0005-167 | Failure | `nav_screen_count_mismatch`: `tabs` navigation but spec has 1 screen |
| T-0005-168 | Failure | `none_nav_multiple_screens`: `none` navigation but spec has 2 screens |
| T-0005-169 | Failure | `nesting_too_deep`: 9-level nested Stack fails |
| T-0005-170 | Failure | `duplicate_id`: two screens with same `id` |
| T-0005-171 | Failure | `duplicate_id`: collection id collides with screen id |
| T-0005-172 | Failure | `duplicate_id`: component `id` collides with state slot |
| T-0005-173 | Happy | Stack at depth 8 passes; depth 9 fails |
| T-0005-174 | Happy | Multiple errors: spec with both `unknown_collection` and `unknown_screen` returns 2 errors (validator does not stop on first) |
| T-0005-174a | Happy (F-04) | 4 simultaneous violations across 4 different categories (`duplicate_id` + `unknown_collection` + `nesting_too_deep` + `seed_field_extra`) all surface in `result.errors`; `result.errors.length === 4`; codes set equals `{'duplicate_id', 'unknown_collection', 'nesting_too_deep', 'seed_field_extra'}` |
| T-0005-175 | Boundary | Empty error list when valid: `validateCrossRefs(validSpec).errors.length === 0` |
| T-0005-176 | Failure | Error path on collection ref: `errors[0].path` deep-equals `['screens', 0, 'root', 'children', 1, 'collectionId']` for a `MediaTray` referencing `unknown` |
| T-0005-176a | Failure (F-04) | Errors at depth 5+ on two separate subtrees: spec has an unknown-collection ref at `['screens', 0, 'root', 'children', 1, 'collectionId']` AND an unknown-screen ref at `['screens', 1, 'root', 'children', 0, 'children', 2, 'action', 'target']`. Both surface; both paths are exact |
| T-0005-176b | Failure (F-15) | Error path on action target: `errors[0].path` deep-equals `['screens', 0, 'root', 'children', 1, 'action', 'collection']` for an `addItem` action referencing an unknown collection |
| T-0005-177 | Concurrency | `validateCrossRefs` is pure: 100 parallel calls on same spec produce identical errors (deep-equal `errors` arrays) |
| T-0005-178 | Coverage (F-03 rewrite) | Behavioral coverage: the test suite collects observed `code` values across all live `validateCrossRefs()` calls (via Jest's afterAll hook accumulating from a shared collector); on suite completion asserts the observed-code set equals the closed `ValidationErrorCode` enum exactly. Fails if any code is missing OR if a code observed at runtime is not in the enum (catches silent code-name drift). Not a `Object.values().length` shape inspection — a real-call coverage test. |

#### Step 6 Test Summary

| Category | Count |
|---|---|
| Happy | 6 (+1 F-04 T-0005-174a) |
| Failure | 16 (+1 F-04 T-0005-176a, +1 F-15 T-0005-176b) |
| Boundary | 1 |
| Concurrency | 1 |
| Coverage | 1 (T-0005-178 — F-03 rewritten as behavioral, still counts in this category) |
| **Total** | **25** |

### Step 7 Tests

| ID | Category | Test Description |
|---|---|---|
| T-0005-179 | Happy | `pnpm codegen` exits 0 and produces 3 files in `generated/` |
| T-0005-180 | Regression | Codegen is reproducible: running twice produces byte-identical files |
| T-0005-181 | Happy | `generated/json-schema.json` is valid JSON Schema 7 |
| T-0005-182 | Happy | `generated/types.ts` exports `Spec`, `Screen`, `Node`, `Action`, `Collection` |
| T-0005-183 | Happy | `generated/docs.md` has ≥60 sections (one per token / component / verb) |
| T-0005-183a | Failure (F-07) | `gen-docs.ts` emits a non-empty paragraph for each of 28 components — parameterized over component name; `docs.md` is parsed and asserted that each component's section has at least one body paragraph (not just a header). Catches the silent-empty-doc failure mode where a component is added to the schema without JSDoc and the generated section is a heading with no description. |
| T-0005-184 | Failure | Removing a Lucide icon from `lucide-static` and re-running codegen → fails with named error |
| T-0005-185 | Regression (F-05 replacement) | Codegen output is byte-stable: `pnpm codegen` produces identical files on consecutive runs (already T-0005-180; T-0005-185 retired as redundant simulation). The real codegen-drift enforcement is the workflow itself (`codegen-drift.yml` runs `pnpm codegen` then `git diff --exit-code`) — validated by the workflow's first PR, not by a unit-test simulation. **Test description:** assert T-0005-180 still holds; comment in the test file referencing the workflow as the production guard. |
| T-0005-186 | Config (F-05 sharpened) | YAML inspection: `.github/workflows/codegen-drift.yml` exists; the file's `on.push.paths` (and `on.pull_request.paths`) array contains the literal string `'packages/protocol/**'`; the `jobs.<name>.steps` array contains a step running `pnpm codegen` followed by `git diff --exit-code packages/protocol/generated`. Read the YAML, parse, assert. Not a regex on raw text. |
| T-0005-187a | Failure (F-02) | Codegen-level `share` regression guard: `JSON.stringify(generated/json-schema.json)` does NOT contain the substring `"share"` anywhere in the action verb enum or any verb-discriminator schema. Closes the F-4 loop at the LLM-facing surface (T-0005-039 covers schema-level rejection). |
| T-0005-187b | Boundary (F-13) | Codegen verb-count guard: `generated/json-schema.json` action verb discriminated union has exactly 12 members; assert by walking the JSON schema and counting `{type: 'string', const: <verb-name>}` entries within the `Action` definition. Catches accidental verb addition or removal at the codegen surface. |

#### Step 7 Test Summary

| Category | Count |
|---|---|
| Happy | 4 |
| Failure | 3 (+1 F-07 T-0005-183a, +1 F-02 T-0005-187a) |
| Boundary | 1 (+1 F-13 T-0005-187b) |
| Regression | 2 (T-0005-180 + T-0005-185 reframed; was 1 + 1 Breaking) |
| Config | 1 (T-0005-186 sharpened) |
| **Total** | **11** |

Step 7 ratio after rebalance: 4 happy vs. 7 negative. Roz's F-07 closed.

### Step 8 Tests

| ID | Category | Test Description |
|---|---|---|
| T-0005-187 | Happy | `theme('productive', 'focus')` returns object with `bg: '#FAFAF7'` |
| T-0005-188 | Happy | `theme('expressive', 'health')` returns object with `accent: '#4A7438'` (revised from `#5B8F4D` 2026-05-08 — see UX doc revision note) |
| T-0005-189..198 | Happy (parameterized) | First 10 of 12 (stance, palette) combinations resolve to the canvas-v0-ux.md table values |
| T-0005-198a | Happy (F-08 reconciliation) | productive×play resolves to the canvas-v0-ux.md table values (was missing from the T-189..198 range) |
| T-0005-198b | Happy (F-08 reconciliation) | expressive×play resolves to the canvas-v0-ux.md table values (closes the 12-combo coverage) |
| T-0005-199..210 | Security | Each of 12 `accent`/`accent-fg` pairs has ≥4.5:1 contrast (WCAG AA body) |
| T-0005-211 | Failure | `theme('neutral', 'focus')` throws (closed Stance) |
| T-0005-212 | Failure | `theme('productive', 'rainbow')` throws (closed Palette) |
| T-0005-213 | Happy | `tokens.SPACING['space-md'] === 12` |
| T-0005-214 | Happy | `tokens.RADII['radius-full'] === 9999` (and `tokens.RADII` has exactly 5 entries per F-12 Sponsor ruling: `radius-none, radius-sm, radius-md, radius-lg, radius-full`) |
| T-0005-215 | Happy | `tokens.MOTION['motion-snappy']` includes `duration: 150` |
| T-0005-216 | Regression | `tokens.TYPE_BY_STANCE.productive.body` matches canvas-v0-ux.md (16/24/400/0) |
| T-0005-217 | Regression | `tokens.TYPE_BY_STANCE.expressive.display` matches canvas-v0-ux.md (36/44/500/-0.6) |
| T-0005-218 | Regression | `theme()` does NOT export Stance or Palette types — they import from `@app-creator/protocol` (typecheck-only test) |
| T-0005-218a | Happy (MT-5) | `theme(stance, palette)` returns an `Object.freeze`'d object: `Object.isFrozen(theme('productive', 'focus')) === true`. Mutating the returned object throws in strict mode and never affects subsequent `theme()` calls (call `theme()` twice; mutate the first; assert the second is unaffected). Documented architectural choice: theme returns a fresh frozen object every call — safe for caller mutation attempts; trivially cheap given the small token count. |

#### Step 8 Test Summary

| Category | Count |
|---|---|
| Happy | 18 (15 base + 2 F-08 reconciliation T-198a/b + 1 MT-5 T-218a) |
| Failure | 2 |
| Security (contrast) | 12 |
| Regression | 3 |
| **Total** | **35** |

Step 8 ID range now goes T-187..218 + T-198a/b + T-218a, so Step 9 starts cleanly at T-219.

### Step 9 Tests

| ID | Category | Test Description |
|---|---|---|
| T-0005-219 | Happy | `IconNameSchema.parse('chevron-left')` succeeds |
| T-0005-220 | Happy (parameterized) | All 80 icon names parse |
| T-0005-221 | Failure | `IconNameSchema.parse('not-an-icon')` fails |
| T-0005-222 | Happy | `ICON_PATHS['chevron-left']` is a non-empty SVG path string |
| T-0005-223 | Happy (parameterized) | All 80 icons have non-empty paths |
| T-0005-224 | Regression | Lucide pinned version: `lucide-static` package.json version matches the snapshot |
| T-0005-225 | Failure | Codegen with missing icon: `lucide-static` lacks `xyz` → `gen-icon-paths` exits non-zero |
| T-0005-226 | Happy | `<Icon name="star" size={24} color="#000" />` renders without error |
| T-0005-227 | Boundary | `<Icon size={16} />` and `<Icon size={32} />` both render |
| T-0005-228 | Boundary | `Object.keys(ICON_PATHS).length === 80` (exact count assert — catches accidental rename or removal) |
| T-0005-229 | Failure | An entry in `ICON_NAMES` not present in `ICON_PATHS` fails the codegen integrity assert |
| T-0005-230 | Security | `ICON_PATHS` contains only canonical SVG path characters (regex `^[MmLlHhVvCcSsQqTtAaZz0-9\s,.\-]+$`) — guards against path injection if Lucide ever ships path-string with unexpected chars |
| T-0005-231 | Failure (F-16 sharpened) | `<Icon size={9} />` is rejected at **TypeScript compile time**: `size` is typed as the literal-union `16 \| 20 \| 24 \| 32`. Test is a `// @ts-expect-error` block in a `.ts` test file (jest does not run TS errors as runtime failures, but `tsc --noEmit` over the test file produces a TS2322 error if removed; the test file's `// @ts-expect-error` directive flips the error into a passing assertion). No runtime guard needed; TS prevents the call site. |

#### Step 9 Test Summary

| Category | Count |
|---|---|
| Happy | 5 |
| Failure | 4 |
| Boundary | 2 |
| Security | 1 |
| Regression | 1 |
| **Total** | **13** |

### Step 10 Tests

12 golden snapshots × 2 runtimes (Node + RN-jest) + supporting tests + cross-runtime parity assertions.

> **NV-5 numbering note:** T-0005-256 is the 12th RN-jest golden snapshot (last entry in the T-245..256 range). T-0005-256a, T-0005-256b, T-0005-256c are independent tests inserted at this point in the spec for the cross-runtime SVG-string equality assertion (256a), the CI orchestration check (256b), and the MT-3 empty-path runtime guard (256c). They share the numeric base 256 only because they were inserted adjacent to T-256 during rev-1; they are unrelated to T-256 itself. Future revisions should renumber rather than continue suffix-stacking on 256.

| ID | Category | Test Description |
|---|---|---|
| T-0005-232 | Happy | `coverArt({stance: 'productive', palette: 'focus', icon: 'list', seed: '0xa1...'})` returns canonical SVG |
| T-0005-233..244 | Happy (golden, Node — F-01 expanded to 12 fixtures) | **12 fixture inputs covering all 2 stances × 6 palettes** → 12 byte-identical SVG snapshots stored at `packages/design-system/__node-snapshots__/coverArt.test.ts.snap`. Each fixture pairs a representative archetype-canonical icon with its (stance, palette) pair: productive×{focus, health, money, social, learn, play} + expressive×{focus, health, money, social, learn, play}. Closes the F-01 fixture-coverage claim. |
| T-0005-245..256 | Happy (golden, RN-jest — F-01 expanded to 12 fixtures) | Same 12 fixture inputs → byte-identical snapshots stored at `packages/design-system/__rn-snapshots__/coverArt.rn.test.ts.snap`. The two snapshot directories are deliberately separate to avoid Jest's runtime-specific snapshot-file format collisions. |
| T-0005-256a | Regression (F-01 cross-runtime SVG-string equality — explicit) | **Cross-runtime SVG-string extraction + byte-equal assertion.** A standalone Node-runtime test reads the 12 Node snapshots and the 12 RN snapshots from disk, parses the snapshot file format (Jest serializes snapshots as a `.snap` file with `exports['<test name>'] = <serialized value>`), extracts the SVG string value from each entry, asserts byte-equal across the matched pairs (all 12). Closes the F-01 5th failure mode (snapshot-file format divergence masking SVG content divergence). The CI workflow also runs this test as a job in `codegen-drift.yml` (or a sibling workflow) — both Jest suites must run before this test runs. **Test fails loudly on any of:** missing snapshot file, mismatched fixture count, unequal extracted SVG string for any of 12 fixtures. |
| T-0005-256b | Regression (F-01 CI orchestration) | YAML inspection: a CI workflow (either `codegen-drift.yml` or a new `cover-art-runtime-parity.yml`) runs the Node `coverArt.test.ts` suite, the RN `coverArt.rn.test.ts` suite, then T-0005-256a as a final assertion. Read the YAML, parse the `jobs.<n>.steps` array, assert presence of all three steps in order. |
| T-0005-257 | Failure | `coverArt({stance: 'invalid', ...})` throws with named error |
| T-0005-258 | Failure | `coverArt({palette: 'rainbow', ...})` throws with named error |
| T-0005-259 | Failure | `coverArt({icon: 'made-up-icon', ...})` throws with named error |
| T-0005-256c | Failure (MT-3) | `coverArt()` runtime guard for empty path: a synthetic test where `ICON_PATHS['some-icon']` is mutated to an empty string at test-runtime (or a mock `paths.json` is loaded), then `coverArt({icon: 'some-icon', ...})` is called — must throw with `Error('coverArt: empty path for icon "some-icon"; gen-icons codegen integrity broken')`. The guard runs even though the codegen step (T-0005-229) catches the broken path at build time — defense-in-depth. |
| T-0005-260 | Failure | `coverArt({seed: undefined, ...})` throws |
| T-0005-261 | Boundary | `seed: ''` throws (must be 32 char hex) |
| T-0005-262 | Boundary | `seed: '0xnotahex'` throws (regex validation) |
| T-0005-263 | Boundary | `seed` exactly 32 hex chars succeeds; 31 fails; 33 fails |
| T-0005-264 | Boundary | `seed` with uppercase hex chars rejected (regex `/^[0-9a-f]{32}$/`) |
| T-0005-265 | Security | `seed` does not affect SVG element count, only positions/rotations (asserts shape count == 3 for any seed across 100 random seeds) |
| T-0005-266 | Security | Output SVG contains only the closed allowed-attribute set (`x`, `y`, `cx`, `cy`, `r`, `width`, `height`, `rx`, `ry`, `d`, `transform`, `fill`, `fill-opacity`, `stroke`, `stroke-width`, `viewBox`, `xmlns`, `version`, `font-family`, `font-size`) — no `script`, `onclick`, `style`. **Note:** Layer 4 (productive title gradient) is a renderer concern (per §J update), so gradient-related attributes (`linearGradient`, `defs`, `stop`, `stop-opacity`) are intentionally NOT in the allowed set. |
| T-0005-267 | Boundary | Shape vocabulary is exactly 6 entries (constant export count assert) |
| T-0005-268 | Regression | Same `(stance, palette, icon, seed)` produces identical output across 1000 calls (PRNG determinism, no shared state) |
| T-0005-269 | Regression | SVG output is canonical: alphabetical attribute order, `.toFixed(3)` floats with trailing-zero strip, `\n` between siblings |
| T-0005-270 | Regression | `coverArt(input)` does not mutate `input` (input object frozen and re-checked after call) |
| T-0005-271 | Concurrency | 100 parallel `coverArt()` calls with different seeds produce 100 distinct SVGs (no shared state mutation) |
| T-0005-272 | Concurrency | 100 parallel `coverArt()` calls with the same `(stance, palette, icon, seed)` produce 100 byte-identical SVGs |
| T-0005-273 | Breaking | `seedrandom` package version pinned in package.json (regex assert on lock file equals `3.0.5`) |
| T-0005-274 | Breaking | `lucide-static` major version locked (renovate-ignored); bump requires ADR review |

#### Step 10 Test Summary

| Category | Count |
|---|---|
| Happy | 25 (T-232 + 12 Node goldens + 12 RN goldens) |
| Failure | 5 (4 invalid-input + 1 MT-3 empty-path) |
| Boundary | 5 |
| Security | 2 |
| Regression | 5 (T-256a + T-256b + 3 base) |
| Concurrency | 2 |
| Breaking | 2 |
| **Total** | **46** |

Step 10 ratio under the parameterized-collapse rule (Roz accepted): behavioral happy = 1 (T-232) + 1 (12 Node goldens collapsed) + 1 (12 RN goldens collapsed) = 3; behavioral negative = 5 + 5 + 2 + 2 = 14. Ratio holds emphatically.

### Test Totals (rev-2)

Breaking-change tests are counted in "New" per Roz NV-4 — they're new tests
in this ADR; the breaking-change category is a tag, not a separate column.
The arithmetic adds up: New + Regression = Total per row, and the column
totals match the grand total.

| Step | New | Regression | Total |
|---|---|---|---|
| 1 | 24 | 3 | 27 |
| 2 | 32 (24 base + 3 breaking + 5 NV-3 T-0005-036a parameterized over 5 binding types) | 0 | 32 |
| 3 | 17 (+2: F-10 T-064a, MT-4 T-057a) | 0 | 17 |
| 4 | 90 (89 base + 18 F-09 T-072a..072r + 1 breaking) | 0 | 90 |
| 5 | 16 (+2: MT-1 T-150a, MT-2 T-150b) | 1 | 17 |
| 6 | 25 (+3: F-04 T-174a, F-04 T-176a, F-15 T-176b) | 0 | 25 |
| 7 | 9 (+3: F-07 T-183a, F-02 T-187a, F-13 T-187b) | 2 (T-180, T-185 reframed) | 11 |
| 8 | 32 (+3: F-08 T-198a/b, MT-5 T-218a) | 3 | 35 |
| 9 | 12 | 1 | 13 |
| 10 | 41 (+7: F-01 +2 Node fixtures, F-01 +2 RN fixtures, F-01 cross-runtime T-256a, F-01 CI orchestration T-256b, MT-3 T-256c) | 5 (2 new for F-01 cross-runtime — counted in Regression because they guard the determinism contract) | 46 |
| **Total (rev-2)** | **298** | **15** | **313** |

Verifying arithmetic: 298 + 15 = 313. ✓ (NV-4 closed.)

Test count delta from rev-1: **+5 tests** (308 → 313). All from NV-3 — the
parameterized regex-failure block in Step 2 across 5 binding types.

Test count delta from rev-0: **+43 tests** across 10 steps. All Roz P0/High
findings have a test response; all 5 missing tests added; NV-1 file paths
realigned; NV-3 schema-consistency closed with `SlotNameSchema` shared
between `Binding<*>.slot` and `Spec.initialState` keys.

Per-step failure-vs-happy ratios (rev-2 — NV-2 corrected):

| Step | Happy | Negative (failure / boundary / security / breaking) | Negative ≥ Happy? |
|---|---|---|---|
| 1 | 16 | 11 | Below; closed-enum parameterization inflates happy. Acceptable per Roz judgement (behavioral collapse: 4 vs. 11). |
| 2 | 7 | 24 (was 19; +5 NV-3) | ✓ |
| 3 | 5 | 12 | ✓ |
| 4 | 50 | 40 | Below at raw count; ✓ under behavioral collapse (32 + 6 collapsed binding-kinds = 38 vs. 40). Roz accepted this in rev-1 review §F-09. |
| 5 | 7 | 9 | ✓ |
| 6 | 6 | 19 | ✓ |
| 7 | 4 | 7 (was 4; F-07 closed) | ✓ — NV-2 corrected |
| 8 | 18 | 14 contrast (security) + 2 fail = 16 | Below at raw count; ✓ under behavioral collapse (5 vs. 16). |
| 9 | 5 | 8 | ✓ |
| 10 | 25 | 21 (was 16; F-01 expansion to 12 fixtures) | Below at raw count; ✓ under behavioral collapse (3 vs. 21) — Roz accepted in rev-1 review §F-09 / Step 10. |

NV-2 closed: Steps 4, 7, 10 ratio entries updated from rev-0 numbers to
rev-2 actuals.

### Test Helpers & Mocks

- `packages/protocol/test/fixtures.ts` — canonical valid Spec fixture, plus per-component minimal fixtures (28). Imported by Steps 4, 5, 6 tests.
- `packages/protocol/test/contrast.ts` — WCAG contrast ratio helper. Imported by Step 8 tests.
- `packages/design-system/test/coverArtFixtures.ts` — **12 cover-art golden inputs** (one per (stance, palette) combination per F-01 expansion).
- `packages/design-system/test/svgRendererRN.ts` — RN-jest harness: renders `react-native-svg` `<SvgXml />` to its canonical string output, used by Step 10 RN tests.
- No external service mocks — these are pure-schema and pure-function tests.

### Coverage Gates

- Per-package `pnpm test --coverage` ≥ 95% lines, branches, functions for `packages/protocol/src/` (excluding `generated/`).
- Per-package coverage ≥ 90% for `packages/design-system/src/`.
- Step 10 golden-snapshot files are checked into git; CI fails on snapshot drift unless explicitly updated by `pnpm test -- -u` and committed.

---

## UX Requirements

UX scope is in `docs/ux/canvas-v0-ux.md`. ADR-0005 implements:

- All token surfaces from §Token Surface (12 colors × 2 stances × 6 palettes; 6 spacing; 5 radii; 6 type roles; 3 elevations; 4 motion curves; 80 icons)
- Stance + palette resolution from §Stance System and §Palette System
- Cover-art composition formula from §Generated Cover Art Composition Formula

ADR-0005 does NOT implement:

- Component rendering (ADR-0006)
- Action verb dispatch / feedback contract (ADR-0006)
- Loading state choreography (ADR-0006 / ADR-0007 split)
- Out-of-scope surface (ADR-0006 visual; ADR-0007 detection)
- Universal Link install-gate page (ADR-0008)

## Data Sensitivity

ADR-0005 introduces no stores. The Spec is parsed, validated, and either
accepted or rejected — never persisted by this ADR. ADR-0007 owns
persistence.

| Module | Returns | Sensitivity |
|---|---|---|
| `parse(rawSpec)` (via Zod schemas) | `Spec` (valid) or `ZodError` | `public-safe` — Spec contains no secrets. Zod errors reveal field paths and expected types; safe to log via `safeMessage()`. |
| `validateCrossRefs(spec)` (success) | `{ok: true, spec}` | `public-safe` — Spec is the LLM's structural emission; no user PII path through here in V0 (collections carry seed data only, not user data; user data is per-namespace runtime state owned by ADR-0007's persistence layer). |
| `validateCrossRefs(spec)` (failure — Roz F-add row) | `{ok: false, errors: ValidationError[]}` where each `ValidationError = {path, message, code}` | `public-safe` for **server logging** (path reveals spec structure, not user data). **NOT public-safe for verbatim return to end users in production** — error messages may include collection IDs, field names, screen IDs from the model's emission, which leak the LLM's internal naming. ADR-0007 must gate this: route handler returns the structured `code` to the client and logs the full error server-side; the `message` and `path` are logged only. Documented for ADR-0007 to enforce. |
| `coverArt({stance, palette, icon, seed})` | canonical SVG string | `public-safe` — emitted SVG is for public install-gate page; no user data in the output. |
| `theme(stance, palette)` | `ResolvedTheme` (concrete tokens, frozen) | `public-safe` — no secrets in theme tokens. Per MT-5 the returned object is `Object.freeze`'d so caller mutation cannot affect subsequent calls. |

**Design system tokens are explicitly public surface.** They ship in the
mobile app bundle; an attacker has them. The hex codes are not secret.
This is documented to prevent the retro-lessons.md normalizeRow pattern
where someone adds a "Notes — internal hex" field assuming privacy.

## CI/CD Impact

| Job | Config File | Impact | Required Change |
|---|---|---|---|
| `Eval` | `.github/workflows/eval.yml` | None this ADR | ADR-0007 will add `packages/protocol/**` and `packages/design-system/**` to path filter |
| `Codegen Drift` (NEW) | `.github/workflows/codegen-drift.yml` | New | Step 7 creates this workflow. Triggers on `packages/protocol/**`. Steps: install → `pnpm codegen` → `git diff --exit-code packages/protocol/generated/`. |
| `Cover Art Runtime Parity` (NEW — F-01) | `.github/workflows/cover-art-runtime-parity.yml` (or extension to `codegen-drift.yml` — Colby's call) | New | Step 10 creates this workflow. Triggers on `packages/design-system/src/coverArt.ts`, `packages/design-system/src/icons/paths.ts`, `packages/design-system/__node-snapshots__/**`, `packages/design-system/__rn-snapshots__/**`. Steps: install → run Node `coverArt.test.ts` → run RN `coverArt.rn.test.ts` → run T-0005-256a (cross-runtime SVG-string equality). Fails the PR if the 12 Node snapshots' extracted SVG strings do not byte-equal the 12 RN snapshots' extracted SVG strings. This is the F-01 P0 closure at the workflow level — the unit test alone catches in-runtime divergence; the workflow catches cross-runtime divergence. |

Workspace-level commands (`pnpm typecheck`, `pnpm lint`, `pnpm test`)
auto-pick-up new packages via `pnpm -r --parallel`. No config change
needed in root `package.json`. **Per Roz's CI/CD note:** the implicit
typecheck pass on a clean install is covered by Step 1's acceptance
criterion `pnpm --filter @app-creator/protocol typecheck` passes; same
for Step 8's `pnpm --filter @app-creator/design-system typecheck`. If
either tsconfig is malformed, the existing workspace `typecheck` job
fails — no new CI surface needed.

## Documentation Impact

| Doc | Path | What Changes |
|---|---|---|
| `CLAUDE.md` | `CLAUDE.md` (workspaces section, line ~25) | Add `packages/protocol/` and `packages/design-system/` to the workspaces list. ~2-line change. |
| `ARCHITECTURE.md` | `ARCHITECTURE.md` (if it references the schema package) | None unless a §-specific update is needed; defer to Agatha if the doc-plan exists |
| `.claude/references/adr-index.md` | `.claude/references/adr-index.md` | New row for ADR-0005; tags: `protocol`, `design-system`, `schema`, `tests` (already added in rev-0). |
| `packages/protocol/generated/docs.md` | (generated) | Auto-generated by Step 7; one section per token / component / verb |
| **`docs/product/canvas-v0-brief.md`** §3.2 | `docs/product/canvas-v0-brief.md` | **Follow-up patch (F-12 Sponsor ruling 2026-05-08):** the radii table currently reads "4 — none, sm, md, lg, full" which is 5 names against a count of 4. Patch the count to "5 — none, sm, md, lg, full." Small, non-controversial; does not gate ADR-0005 merge. PM owns the patch. |
| **`docs/product/canvas-v0.md`** §AC-R4 | `docs/product/canvas-v0.md` | **Follow-up update (F-13):** the spec currently says "All 13 action verbs execute correctly..." with `share` in the list. ADR-0005 cuts `share` (F-4 from prop-review). canvas-v0.md AC-R4 must update to "All 12 action verbs..." dropping `share`. **Owner: ADR-0006 (renderer)** — the renderer dispatcher is the consumer of the verb set, so the AC change lives with the renderer ADR rather than this one. ADR-0006 must include this patch in its Documentation Impact section. |

## Notes for Colby

1. **Step 1 first; nothing else builds without it.** Get the package
   scaffold landed (`tsconfig`, `jest`, `package.json`) before starting
   Step 2. `pnpm install` to wire workspace references after package.json
   is created.

2. **`packages/protocol/` depends on nothing in the workspace.** If you
   find yourself reaching for a workspace import, stop — the protocol
   is the bottom of the dependency graph, and importing from above
   creates a cycle.

3. **`Binding<T>` is the most-used pattern in this ADR.** Build it once
   in Step 2, reuse it in Steps 4 (input components) and 6 (validator).
   Don't redefine it inline anywhere.

4. **Slot polymorphism on ListItem is `kind`-discriminated, not type-discriminated.**
   The slot's `kind` (`'icon' | 'avatar' | 'badge' | 'none'`) is what
   the renderer reads to pick a render path; the slot is *not* a wrapper
   around a Node. Don't conflate.

5. **`share` action verb is cut.** If you find yourself adding it back
   "for symmetry" — don't. The brief and Sponsor cut it. Share is
   host-meatball-only; the meatball doesn't go through the dispatcher.

6. **Cover-art determinism is the hardest part of Step 10.** Three
   gotchas:
   - PRNG must be `seedrandom@3.0.5` exactly. Pin in package.json.
     Lock the lock file. Do not `npm i seedrandom` (uses latest);
     `pnpm add seedrandom@3.0.5` (exact).
   - SVG attribute order: alphabetical, every time. Write a small helper
     `canonicalAttrs(o: Record<string, string>): string` that sorts and
     formats; use it everywhere; don't trust template strings.
   - Float precision: `.toFixed(3)`. Then trim trailing zeros and
     trailing decimal points (`'3.000'` → `'3'`, `'3.140'` → `'3.14'`).
     Make a helper; use it everywhere.

7. **Lucide icon paths come from `lucide-static`** at codegen time. Do
   NOT import from `lucide-react-native` in Node (it has RN-only deps).
   The naming difference is `chevron-left` (kebab in our enum) →
   `chevronLeft` (camel in Lucide's exports). The codegen handles the
   mapping; if you add an icon, add it to `names.ts` first, then run
   `gen-icons` — never the other way around.

8. **Cross-ref validator returns ALL errors, not just the first.** Roz
   wants the full list per call so a downstream consumer can show
   multiple violations at once. Implement as accumulation, not
   short-circuit-on-first.

9. **`canonicalize` and `renderHash` are *copied* from `a2ui-schema`.**
   Don't import from `a2ui-schema`; that package is legacy. Copy the
   file (it's 26 lines). Pure functions, no side effects.

10. **Generated files are checked in.** `packages/protocol/generated/` is
    NOT gitignored. The CI guard verifies the codegen output matches
    the checked-in files. If you regenerate, commit the new output.

11. **Test fixtures live in `packages/protocol/test/fixtures.ts`.**
    Build the canonical Spec fixture in Step 4 (after components are
    defined) and reuse it in Steps 5, 6. Don't duplicate.

12. **Use `.strict()` on Zod object schemas where appropriate** — F-2
    (no extra props) requires schemas to reject `loading` on Button,
    which means strict mode. The default Zod behavior is to *strip*
    unknown keys silently; we want them rejected as errors. Apply
    `.strict()` to all 28 component schemas.

13. **The cover-art share-record persistence note in §K is for ADR-0007**;
    you don't add a `mini_apps` table column in this ADR. Just preserve
    the contract in the cover-art function: outputs are deterministic
    given inputs. ADR-0007 will hand the inputs from the share record.

14. **Snapshot updates require explicit reviewer commentary.** If a
    Step 10 golden snapshot changes, the PR must include in the
    description: (a) why the SVG changed, (b) confirmation the change
    is intentional. CI doesn't auto-pass updated snapshots.

15. **CLAUDE.md update at the end:** add the two new packages to the
    workspaces list. One small commit.

---

> 🔄 **ADR-0005 rev-2 saved.** **10 steps, 313 tests** (298 new + 15 regression).
>
> **Round 2 closures vs. Roz rev-1 review (APPROVE WITH NOTES):**
> - **NV-1 (material, gating):** Step 10 file paths realigned with test table — `__node-snapshots__/coverArt.test.ts.snap` and `__rn-snapshots__/coverArt.rn.test.ts.snap`; rev-0 `__snapshots__/` artifact removed; "Files to create" updated; ACs and Test Helpers updated to 12 fixtures.
> - **NV-3 (material, gating):** `SlotNameSchema` (regex + length) promoted to a shared export from `binding.ts`. Both `Binding<*>.slot` (Step 2) and `Spec.initialState` keys (Step 5) now use it. Step 2 code shape and ACs updated. Added T-0005-036a — parameterized regex-failure test across all 5 binding types (+5 tests).
> - **NV-2 (minor):** Ratio table updated to rev-2 actuals for Steps 4, 7, 10.
> - **NV-4 (minor):** Totals arithmetic reconciled — breaking-change tests folded into "New" column. 298 + 15 = 313. ✓
> - **NV-5 (minor):** Numbering note added to Step 10 test table header for T-0005-256 vs. T-0005-256a/b/c.
>
> **Test count delta:** +5 tests vs. rev-1 (308 → 313). All from NV-3.
>
> **Architectural calls preserved from rev-1** (Layer 4 in renderer, MT-2 slot-name as shape constraint, MT-4 self-reference allowed, MT-5 theme freeze) — unchanged.
>
> **Roz rev-2 review (round 3): APPROVE WITH NOTES.** Verdict at `docs/pipeline/roz-test-review-ADR-0005-round3.md`. NV-1, NV-2, NV-4, NV-5 all CLOSED. NV-3 was 80% done — Step 5 code shape still used `z.string()` despite Step 2 code shape, Step 2 ACs, Step 5 ACs, and T-0005-036a all referencing `SlotNameSchema`. **Roz's one-line residual fix applied directly to Step 5 code shape line 907**: `z.record(z.string(), ...)` → `z.record(SlotNameSchema, ...)`. NV-3 fully CLOSED.
>
> **Final verdict: APPROVE.** All NV-* findings closed. Colby cleared to start Step 1 of 10 — protocol package scaffold + token enums.

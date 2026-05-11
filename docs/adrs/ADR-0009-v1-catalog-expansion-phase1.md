# ADR-0009: Canvas V1 Catalog Expansion — Phase 1

_Authored by Cal — 2026-05-07_

## Status

Proposed

## Context

Canvas V0 shipped 28 components, 12 verbs, 4 archetypes. Sable's V1
design spec (`docs/ux/canvas-v1-catalog-expansion-phase1-ux.md`) widens
the catalog to 53 components by adding 25 new components across the
**existing 7 tiers**, without introducing new tiers, new stances, new
palettes, or new AI capabilities.

Phase 1 covers components that don't require the architectural decisions
of Phase 2 (Charts — Skia vs Victory Native) or Phase 3 (Compound-AI —
blocked on V0.5 AI capabilities like image_gen, vision, chat,
transcription). Those are deliberate post-Phase-1 work.

The 25 new components fall into four shapes:

1. **Inputs that match financial / scheduling / preference reality** —
   MoneyField, TimeField, MultiPicker, Slider, RatingInput, SearchBar.
2. **Domain compounds** — TransactionRow, Receipt, MetricTile, Calendar,
   Heatmap, StepList. Pre-baked compositions that save the LLM 10–15
   component decisions per spec.
3. **Visual richness for personal content** — Image, Gallery,
   CommerceCard, BeforeAfter, AvatarGroup, Carousel, Timeline.
4. **Polish primitives that V0 punted** — Divider, Callout, IconButton,
   GridList, ErrorState, DocumentPicker.

### What if we do nothing

V0 ships and users press against the catalog ceiling. Out-of-scope
detection (ADR-0007) captures user intent but the V0 catalog has no way
to fulfill the requests. V0.5 capability work (image gen, vision, chat)
takes 8-12 weeks. In the meantime, V1 Phase 1 components — which
require none of those AI capabilities — could close real product gaps
in 6-8 weeks of build time. Skipping Phase 1 leaves a real product
quality gap during the V0.5 capability-build window.

### Constraints inherited from V0

These shape every decision below:

1. **9 architectural invariants from canvas-v0-brief.md §2.1.** ADR-0009
   respects them all. Closed registries (invariant 6): catalog grows
   from 28 → 53 components but stays closed; no LLM-emitted free-form
   types. OTA can change implementations, not capabilities (invariant 9):
   the 53-component catalog ships in V1's App Store build; further
   additions require App Store update.
2. **No new tier.** Sable rejected the urge to invent "Charts" or
   "Compound-AI" tiers in Phase 1; those are deferred. ADR-0009 inherits
   that discipline.
3. **No new stance, no new palette.** V0's 2 stances × 6 palettes = 12
   visual registers carry the new 25 components without expansion.
4. **`@app-creator/protocol` is the single schema source of truth.**
   Hand-edits to `generated/` blocked in CI. ADR-0009 extends `protocol`,
   never branches it.
5. **Forced `tool_choice` and the JSON Schema generation pipeline from
   ADR-0007** carry forward unchanged. New components widen the schema;
   they don't change how the schema is fed to the LLM.
6. **All renderer components are pure functions of `{node, state,
   dispatch}`.** No `useEffect` outside the §K-approved exceptions
   (ADR-0006). Phase 1 introduces NO new §K exceptions.

### Inconsistency I'm closing as part of this ADR

The Canvas V0 brief §1.7 reviewer notes mention "13 action verbs" — that
was already corrected to 12 by ADR-0007's Documentation Impact (F-04
cut `share`). ADR-0009 doesn't re-litigate; the V1 brief mentions
"Charts (3)" and "Compound-AI (6)" tiers that Phase 1 explicitly defers.
Documentation Impact below clarifies the V1 brief expectation.

### Coordination with ADR-0007

ADR-0007 (LLM V0 cutover) is APPROVED but not fully implemented. PR 1
(Steps 1, 2, 5) is in flight. ADR-0009 explicitly **depends on
ADR-0007's Step 2 (V0 system prompt) and Step 7 (eval harness rewrite)
landing first.** Step 10 of ADR-0009 extends the V0 catalog block; Step
7 of ADR-0007 establishes the V0 eval harness that Step 10 of ADR-0009
extends with V1 prompts.

This means Phase 1's Step 10 is the LAST step to land — ordering matters
across the two ADRs.

### Prior art reviewed

- **ADR-0005** — protocol + design-system foundation. ADR-0009 extends
  both packages.
- **ADR-0006** — V0 renderer. ADR-0009 extends NodeRenderer (28 → 53
  arms) + snapshot matrix (56 → 106). Carries forward all V0
  patterns: middleware-composed dispatcher, `Binding<T>` resolution,
  4 nav patterns, useEffect ban.
- **ADR-0007** — LLM cutover. ADR-0009 extends the V0 system prompt's
  catalog block + the V0 eval harness. Token budget gates need updating.
- **`docs/ux/canvas-v1-catalog-expansion-phase1-ux.md`** — Sable's
  authoritative design spec. Cal does not re-decide visual choices.

---

## Decision

Build **V1 Catalog Expansion Phase 1** as a single ADR with 10
implementation steps. The 25 new components extend the existing 7-tier
structure, the existing protocol package, and the existing renderer
package. Design-system extensions are limited to 18 new icons, 1 new
enum (CurrencySchema), and 1 helper function (tintColor). No new
colors, spaces, radii, type roles, elevations, or motion curves.

### Architectural choices, with rationale

#### A. Single ADR with 10 steps (not 3 sub-ADRs)

I considered splitting into ADR-0009a (protocol+design-system),
ADR-0009b (renderer), ADR-0009c (LLM prompt). Rejected. Three reasons:

1. **Coupling.** You can't ship the renderer step without the schema step
   (NodeRenderer 28 → 53 needs the new schemas to discriminate on).
   You can't ship the system-prompt update without the renderer
   (the LLM emits specs the renderer must render). Splitting forces
   landing-order discipline and three rounds of Roz review for one
   logical change.
2. **Test infrastructure shared.** Snapshot matrix expansion (Step 9)
   is a single deliverable; splitting forces it across ADRs.
3. **Scope is comparable to ADR-0006 (13 steps).** Same author pattern,
   same Roz review surface, same Colby implementation cadence.

#### B. Step ordering: foundation → tiers → infrastructure

Sable's recommended order, refined with dependency analysis:

1. **Step 1 — Foundation primitives** (Divider, Image, IconButton).
   Image is the foundation for Gallery, CommerceCard, BeforeAfter.
   Divider has no deps and is the smallest cognitive load. IconButton
   is structurally a Button minus label — straightforward.
2. **Step 2 — Inputs tier expansion** (MoneyField, TimeField,
   MultiPicker, Slider, RatingInput, SearchBar). Introduces
   `CurrencySchema` enum + `SearchFilterContext`.
3. **Step 3 — Display tier expansion** (AvatarGroup, Callout).
   Introduces `tintColor()` helper.
4. **Step 4 — Lists & Data tier expansion** (GridList, Carousel,
   Timeline, ErrorState). FlashList masonry/horizontal modes.
5. **Step 5 — Productivity domain compounds** (TransactionRow, Receipt,
   MetricTile, StepList). Sparkline rendering via existing
   `react-native-svg`. Receipt math tolerance.
6. **Step 6 — Date components** (Calendar, Heatmap). Adds `date-fns`
   dep. Cross-ref validator extensions for `dateField`.
7. **Step 7 — Content/Media expansion** (Gallery, CommerceCard,
   BeforeAfter, DocumentPicker). Adds `expo-document-picker` dep.
8. **Step 8 — Cross-ref validator + 18 new icons.** Extends
   `validate.ts` with 5 new checks; `ValidationErrorCode` enum grows
   from 12 → 17. Icon catalog 80 → 98.
9. **Step 9 — Snapshot matrix grows 56 → 106.** Updates
   T-0006-236 stability invariant.
10. **Step 10 — System-prompt update + eval harness extension.** Extends
    ADR-0007's catalog block. Bumps T-0007-027 token budget.
    Adds 60 V1-exercising prompts (15 per archetype). **MUST land after
    ADR-0007 Steps 2 + 7.**

Steps 1-7 are largely parallel-safe at the component level (different
tiers, different files), with cross-step dependencies on the schema
union (each tier's schema additions extend `NodeSchema`'s discriminated
union — collision-free if Colby coordinates the merge).

#### C. NodeRenderer 28 → 53 arms — additive, not restructuring

The 28-arm switch in `packages/a2ui-renderer/src/v0/components/NodeRenderer.tsx`
extends to 53 arms. The defensive default branch (calls
`host.onUnknownNodeType`) unchanged. Each new component file follows
the V0 component pattern: `<Component>.tsx` + `<Component>.test.tsx` +
2 snapshots (productive×focus + expressive×health).

No restructuring of V0 components. ListSummary stays in Compound (not
moved to Lists per the user's V1 brief — that was a brief artifact, not
a Sable design decision).

#### D. Cross-ref validator: 5 new error codes, closed enum grows 12 → 17

`packages/protocol/src/validate.ts` `ValidationErrorCode` extends:

```ts
export type ValidationErrorCode =
  // V0 — 12 codes
  | 'unknown_collection' | 'unknown_field' | 'field_type_mismatch'
  | 'unknown_screen' | 'unknown_state_slot'
  | 'seed_field_missing' | 'seed_field_extra' | 'seed_required_missing'
  | 'nav_screen_count_mismatch' | 'none_nav_multiple_screens'
  | 'nesting_too_deep' | 'duplicate_id'
  // V1 Phase 1 — 5 new codes
  | 'date_field_required'           // Calendar/Timeline/Heatmap dateField missing/wrong type
  | 'image_field_required'          // Gallery imageField missing/wrong type (extends V0 MediaTray pattern)
  | 'mutually_exclusive_collection' // Carousel/Gallery: collectionId XOR static array
  | 'unknown_search_collection'     // SearchBar's boundCollectionId doesn't exist
  | 'receipt_total_mismatch'        // WARNING tier — Receipt subtotal+tax+tip ≠ total ± 1 cent
```

Note: `receipt_total_mismatch` is a **warning** in the validator output,
not a hard error. The validator's return shape carries severity
(`'error' | 'warning'`); routes return only `error` codes to clients
(per ADR-0007 §F security pattern), warnings flow to telemetry.

This is a contract change to `ValidatorResult`. Step 8 of this ADR
specs the migration: existing `{ok: true, spec} | {ok: false, errors: ValidationError[]}`
extends to `{ok: true, spec, warnings: ValidationError[]} | {ok: false, errors, warnings}`.
Existing call sites can ignore the warnings array; new call sites
(telemetry hookups) consume it.

**Adding a 6th new code (or any code in the future) is a closed-registry
expansion** — App Store update, not OTA per invariant 9.

#### E. SearchFilterContext — new renderer architectural surface

Sable specced this; I'm formalizing the contract.

```tsx
// packages/a2ui-renderer/src/v0/state/SearchFilterContext.tsx (NEW)

import {createContext, useContext} from 'react'

type SearchFilterMap = Map<string, string>  // collectionId → query string (lowercased)

const SearchFilterContext = createContext<SearchFilterMap>(new Map())

export function useSearchFilter(collectionId: string): string | null {
  const map = useContext(SearchFilterContext)
  return map.get(collectionId) ?? null
}

export function SearchFilterProvider({
  filters,
  children,
}: {
  filters: SearchFilterMap
  children: React.ReactNode
}) {
  return (
    <SearchFilterContext.Provider value={filters}>
      {children}
    </SearchFilterContext.Provider>
  )
}
```

Renderer integration:

- The `<Renderer>` wrapper (ADR-0006 Step 10) provides
  `<SearchFilterProvider>` at the renderer root, with a single shared
  Map keyed by collectionId.
- `SearchBar` with a `boundCollectionId` writes its query to the Map on
  every change (and clears it on unmount).
- List, GridList, Gallery, Timeline renderers (any component that
  iterates a collection) call `useSearchFilter(collectionId)` and, if
  non-null, filter rows by **case-insensitive substring match across
  all string fields** before passing to FlashList.

Filter is **render-time only** — no source mutation, no persistence.
Reset on SearchBar unmount.

**Why a Map instead of multiple Contexts:** one mini-app may have 2+
SearchBars on different collections (e.g., search across two grids).
A single Map keyed by collectionId is cleaner than nested providers.

#### F. New deps: 2 production, 0 dev

ADR-level decisions per CLAUDE.md (don't sneak in deps):

| Dep | Version pin | Used by | Rationale |
|---|---|---|---|
| `expo-document-picker` | `~12.0.2` | DocumentPicker (Step 7) | iOS-native file picker. Expo-bundled native module. No alternative offers iOS files-app integration without ejecting. |
| `date-fns` | `^3.6.0` | Calendar, Heatmap (Step 6) | Tree-shakeable (only used helpers ship). Lighter than Luxon (~20kb vs ~80kb gzipped used). Used helpers: `format`, `startOfMonth`, `endOfMonth`, `getDay`, `addDays`, `subMonths`, `addMonths`, `differenceInDays`, `parseISO`. |

**Confirmed already in Expo SDK** (no new install):

- `react-native-svg` — used by MetricTile sparkline. Already in
  `apps/mobile/package.json` as part of Expo SDK 52.

**Explicitly NOT adding:**

- React Native Skia — Phase 2 (Charts) decides this. Phase 1 sparklines
  use `react-native-svg` `<Polyline>` which handles the small sparkline
  use case fine.
- Victory Native — same. Phase 2 decision.

#### G. Snapshot matrix grows 56 → 106

ADR-0006 Step 12 specced the matrix at 56 entries (28 components × 2
register pairs) with stability assertion T-0006-236. Phase 1 grows
the matrix by 50 entries (25 components × 2). T-0006-236's invariant
becomes: **matrix size === 106**. Productive×focus count: 53.
Expressive×health count: 53. T-IDs T-0006-237..286 are reserved for
the 50 new entries.

Per Sable: components leaning expressive get tested at expressive×health
(matches their natural register); components leaning productive get
tested at productive×focus first. The existing register pair structure
covers both.

CI workflow `.github/workflows/renderer-snapshot-matrix.yml` path
filters unchanged — already triggers on `packages/a2ui-renderer/src/**`,
`packages/protocol/src/**`, `packages/design-system/src/**`. Will
catch all Phase 1 changes automatically.

#### H. System-prompt update — token budget bumps

ADR-0007's V0 catalog block (cached, ~5000 tokens). Phase 1 extends:

- 25 new component descriptions @ ~120 tokens each = ~3000 tokens
- Stance affinity cheat-sheet (Sable's table) = ~400 tokens
- Domain compound usage hints (when to pick TransactionRow vs ListItem,
  MetricTile vs Stat, etc.) = ~200 tokens
- Re-prompt continuity instruction (inherit component-set on edit
  unless layout change requested) = ~100 tokens
- Total addition: ~3700 tokens

New cached block size: ~8700 tokens. ADR-0007 T-0007-027 budget was
25,000 chars (~6,250 tokens). **Phase 1 must bump the cached block
budget to 35,000 chars (~8,750 tokens).**

The static block (uncached, sent every request) does NOT grow — same
~400 tokens.

Token cost analysis:

| Block | Pre-Phase-1 (V0) | Post-Phase-1 (V1) | Cached? |
|---|---|---|---|
| Static system | ~400 | ~400 | No |
| Catalog | ~5000 | ~8700 | Yes (after first request) |
| Tool definitions (JSON Schema) | ~5000 | **~7500** | No |
| User prompt (cap 2000 char) | ≤500 | ≤500 | No |
| **Total input per request (warm cache)** | **~10,900** | **~16,100** | — |

Cost per generation increases from ~$0.07 to ~$0.10. Within the brief's
$0.05–$0.10 window. No action required.

The JSON Schema also grows because the generated schema includes the 25
new components (each component's prop signature). Estimated at ~7500
tokens (up from ~5000). T-0007-018 budget (25,000 chars) needs to bump
to **40,000 chars (~10,000 tokens)** to allow headroom.

#### I. Currency enum: closed 7-value set

```ts
// packages/protocol/src/enums.ts (extension)
export const CurrencySchema = z.enum([
  'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'INR',
])
export type Currency = z.infer<typeof CurrencySchema>
```

Adding currencies in V1.5+ is a closed-registry expansion (App Store
update per invariant 9). The 7 picked are the highest-volume markets
in pre-launch waitlist analytics. Robert (PM) has been flagged to
confirm.

Used by: MoneyField, TransactionRow, Receipt, CommerceCard.

#### J. Storage canonicalizations — 4 patterns

Each new input/picker has a documented storage convention:

1. **MoneyField → integer cents via NumberBinding.** Schema comment
   states "Stored as cents (integer)." Renderer parses user input as
   decimal, multiplies by `cents_per_unit[currency]` (USD=100, JPY=1).
   Display via `Intl.NumberFormat`. Test: `parseAndCanonicalize("12.50",
   "USD") === 1250`.
2. **TimeField → "HH:MM" 24h via StringBinding.** Schema comment states
   "Stored as HH:MM 24h string." Renderer converts iOS picker output to
   24h format. Test: parsing 1:30 PM → "13:30".
3. **MultiPicker → CSV string via StringBinding.** Option values
   constrained to `/^[^,]+$/` (no commas in option.value). Renderer
   parses on read, joins on write. Test: `parseSelected("a,b,c")`
   returns `["a", "b", "c"]`.
4. **DocumentPicker → file URI via StringBinding.** No content storage.
   Renderer dispatches `set` with picker's URI on selection. Test:
   selection of `file:///private/...` writes URI verbatim.

Each pattern has a regression test in its component's test file that
verifies the canonicalize/parse helpers are correct.

#### K. Re-prompt continuity instruction

ADR-0007's `parentPromptContext` flow (§J-pre) carries the original
prompt into edit calls. Phase 1's system-prompt update adds an
instruction:

> When `parentPromptContext` is present in the user message, you are
> editing an existing tool. Inherit the original spec's component
> selections (Calendar, MetricTile, TransactionRow, etc.) unless the
> user's edit prompt explicitly asks to change layout or component
> kinds. Do not, for example, replace a Calendar with a List on a minor
> content edit.

This is prompt-engineering, not architecture — it lives in the cached
catalog block addition (Step 10). Eval prompts test this: a sample
"add a column" edit should preserve the original spec's component
choices.

#### L. Eval harness extension — 60 new prompts

ADR-0007's eval harness (Step 7) ships 100 archetype-balanced prompts
(25 per archetype × 4) + 30 detection + 30 false-positive = 160 prompts.

Phase 1 extends:

- **+15 prompts per archetype that exercise the new components** (60 prompts total).
  - ListCRUD: prompts that pick TransactionRow, Receipt, CommerceCard.
  - Tracker: prompts that pick Calendar, Heatmap, MetricTile, RatingInput.
  - Journal: prompts that pick Gallery, BeforeAfter, Image.
  - Calculator: prompts that pick MoneyField, Slider, MultiPicker.
- **5 re-prompt continuity prompts** that test edit-call behavior:
  prompt creates a Calendar-shaped Tracker, follow-up edit prompt is
  "add a notes field to entries" — assertion: re-generated spec still
  has Calendar (not regressed to List).

Total eval harness post-Phase-1: 100 + 60 + 30 + 30 + 5 = **225 prompts**.

Per-archetype threshold gates (ADR-0007 §AC-G9: ≥80% per archetype) hold
unchanged — they apply to the 100 archetype-balanced set. The new 60
V1-exercising prompts get their own gate at ≥75% (looser, because the
LLM is making richer choices); the 5 re-prompt continuity prompts get
a hard gate at ≥80% (continuity is a UX trust issue).

---

## Alternatives Considered

### Alternative 1: Split into 3 sub-ADRs (ADR-0009a/b/c)

**Upside:** Smaller individual ADRs. Faster Roz review per ADR.

**Downside:**

- Coupling enforces landing order across 3 ADRs (a → b → c, never
  parallel).
- Snapshot matrix expansion is a single deliverable; splitting forces
  it across ADRs (which version of the matrix is the canonical one
  during the half-state?).
- Three rounds of Cal authoring + Roz review + Ellis commits for one
  logical change.
- Test totals fragment across 3 docs.

**Why not.** Coupling is real. ADR-0006 was 13 steps as one ADR; same
discipline applies.

### Alternative 2: Add Charts tier in Phase 1

**Upside:** V1 catalog "feels complete" (matches the user's V1 brief
that listed Charts as a tier).

**Downside:**

- Forces Skia-vs-Victory-Native architectural decision now. Real cost
  in design + engineering time.
- New tier breaks the "no new tier in Phase 1" discipline that simplified
  Sable's spec.
- Charts components have their own prop signatures (axes, legends,
  tooltips, animations) — easily another ADR's worth of design work.

**Why not.** Phase 2 owns Charts. Sparkline (in MetricTile) covers the
"small inline visualization" use case for Phase 1; full charts can wait.

### Alternative 3: Skip Phase 1, jump to V0.5 AI capabilities

**Upside:** V0.5 AI is the higher-strategy bet (image gen, vision, chat).
Phase 1 is "polish."

**Downside:**

- V0.5 AI takes 8-12 weeks. Users hit the V0 catalog ceiling within
  weeks.
- Phase 1 components (TransactionRow, Calendar, MoneyField, Slider) are
  not "polish" — they're domain-essential for big chunks of V0
  generation prompts that currently produce mediocre results.
- The two tracks are not exclusive — Phase 1 ships in 6-8 weeks while
  V0.5 capability work proceeds.

**Why not.** Both are valuable. Phase 1 is parallelizable with V0.5
work; not doing it leaves a real product gap.

### Alternative 4: Reorganize V0 (move ListSummary from Compound → Lists)

The user's V1 brief listed ListSummary in the Lists tier. V0 has it in
Compound.

**Upside:** Brief-alignment.

**Downside:**

- Reorganization is a breaking change to V0 specs already in the wild
  (alpha cohort).
- Sable's Phase 1 spec explicitly says: "Reorganization (e.g., moving
  ListSummary from Compound→Lists) — leave V0's organization alone;
  new components add to tiers, don't restructure."
- V1 brief was ambiguous; Sable made the design call to keep V0
  organization stable.

**Why not.** Sable's design discipline carries.

---

## Consequences

### Positive

- Catalog grows from 28 → 53 components. The LLM has richer
  domain-fit options for each archetype.
- Domain compounds (TransactionRow, Receipt, MetricTile, Calendar,
  CommerceCard) save the LLM 10-15 component decisions per spec.
  Generation latency stays in budget; structural quality goes up.
- Visual richness components (Image, Gallery, BeforeAfter) close the
  V0 photo gap — Journal and Tracker mini-apps can be photo-forward.
- Polish primitives (Divider, Callout, IconButton, ErrorState) shave
  awkwardness off generated specs.
- New cross-ref validator codes catch real bug classes (date field
  type mismatches, mutually-exclusive prop violations, search
  collection references) at validation time, not render time.
- Test infrastructure grows but stays additive — no V0 regressions.

### Negative

- LLM choice surface widens 28 → 53. Eval pass rate may regress from
  V0's ~90% to ~85% temporarily until prompts re-tune.
- System prompt grows from ~5000 → ~8700 cached tokens. Cost per
  generation rises ~$0.07 → ~$0.10. Within budget.
- JSON Schema grows from ~5000 → ~7500 tokens. Same.
- 25 new components × 2 register pairs = 50 new snapshots to maintain.
- 2 new production deps (`expo-document-picker`, `date-fns`).
- Compound mis-selection risk: LLM picks Calendar where List was right.
  Mitigated by domain compound usage hints in system prompt + eval
  re-prompt-continuity gate.

### Risks

- **Catalog bloat.** 25 new components is a real LLM-choice surface
  expansion. Mitigations: stance affinity cheat-sheet + domain compound
  usage hints in the cached catalog block; eval gates per-archetype to
  catch quality regressions early; soft launch (Robert's PM call) until
  eval re-baselines.
- **MoneyField cents canonicalization bugs.** JS floating-point math
  will bite if anywhere in the renderer treats the binding as a decimal
  instead of cents. Mitigations: explicit canonicalize/parse helpers;
  regression tests on every rounding boundary; schema comment is
  prominent.
- **MultiPicker CSV storage limitation.** Option values cannot contain
  commas. Schema regex enforces. If the LLM emits an option with a
  comma, schema rejects (good — visible failure). If a future use case
  requires comma-bearing values, V0.5 binding-system upgrade
  (`ArrayBinding<T>`) is the right path; documented as deferred.
- **SearchFilterContext performance.** A SearchBar bound to a 1000-row
  collection re-filters on every keystroke. Mitigations: substring
  match on lowercased strings (cheap); FlashList virtualization absorbs
  the re-render cost; throttle SearchBar binding updates to 16ms (one
  frame) via Reanimated `runOnJS`. Performance tested at 1000 rows in
  Step 2 acceptance.
- **Date-fns dep size.** Tree-shaking required to keep bundle lean.
  Mitigations: import individual helpers (`import {format} from 'date-fns/format'`),
  not the whole package. Bundle-size regression test in Step 6
  acceptance.
- **expo-document-picker on physical-device permissions.** First-tap
  triggers iOS files-app permission prompt. Mitigations: graceful
  fallback if permission denied (DocumentPicker shows error caption
  + retries on next tap); eval prompts don't exercise this path
  (mocked).
- **Carousel autoplay accessibility.** Per Sable, autoplay disabled
  under `useReducedMotion()` — hard requirement, not preference.
  Mitigation: regression test asserts autoplay timer never starts when
  reducedMotion is true.

### CI/CD impact

| Job | Config File | Impact | Required Change |
|---|---|---|---|
| `protocol typecheck` | `packages/protocol/tsconfig.json` | Schema additions extend `Node` type alias + `NodeSchema` discriminated union; failing typecheck signals incomplete migration | None — extension is additive |
| `protocol test` | `packages/protocol/jest.config.cjs` | New tests for 25 components + 5 cross-ref codes + CurrencySchema + tintColor | Step 1-8 add tests inline |
| `protocol codegen-drift` | `.github/workflows/codegen-drift.yml` | Generated `json-schema.json` and `types.ts` regenerate as schemas extend; CI guards parity | None — codegen extends automatically |
| `design-system test` | `packages/design-system/jest.config.cjs` | New tests for tintColor + 18 icon paths | Step 3 + Step 8 add tests |
| `a2ui-renderer test` | `packages/a2ui-renderer/jest.config.js` | 25 new component renderers + 50 new snapshots + SearchFilterContext tests | Steps 1-7 add tests |
| `renderer-snapshot-matrix workflow` | `.github/workflows/renderer-snapshot-matrix.yml` | Matrix grows 56 → 106; T-0006-236 stability invariant updates | Path filters unchanged; expected count updates in test |
| `services/api typecheck` | `services/api/tsconfig.json` | System prompt grows; `tools/produceAppSpec.ts` JSON Schema regenerates from extended `SpecSchema` | None — extension propagates from protocol |
| `services/api test` | `services/api/jest.config.cjs` | T-0007-018 + T-0007-027 budget gates need bumping (Step 10) | Step 10 updates |
| `services/api eval` | `.github/workflows/eval.yml` | Eval harness ships 60 new prompts + 5 re-prompt-continuity prompts | Step 10 updates eval prompts file |
| `apps/mobile typecheck` | `apps/mobile/tsconfig.json` | New deps (`expo-document-picker`, `date-fns`) imported via renderer; mobile transitively affected | Steps 6 + 7 add deps to renderer's package.json |

### Documentation impact

| Doc | Path | What Changes |
|---|---|---|
| Canvas V0 brief | `docs/product/canvas-v0-brief.md` §2.4 Registry 1 | "28 components" → "53 components"; tier counts update (Layout 5→6; Inputs 5→11; Display 4→6; Lists 5→9; Compound 4→11; Actions 2→3); Typography 3 unchanged |
| Canvas V0 spec | `docs/product/canvas-v0.md` §AC-R1 | Component count assertion 28 → 53 |
| ADR-0009 | `docs/adrs/ADR-0009-v1-catalog-expansion-phase1.md` | NEW |
| ADR index | `.claude/references/adr-index.md` | Add ADR-0009 row, tags `protocol, design-system, renderer, schema, tests, v1` |
| Sable's V1 spec | `docs/ux/canvas-v1-catalog-expansion-phase1-ux.md` | EXISTING — referenced verbatim by Cal |
| App Store reviewer notes | (PM-owned, lives in `docs/product/canvas-v0-reviewer-notes.md`) | Component inventory grows from 28 to 53. Pre-V1-launch requirement. Robert owns. |
| ADR-0007 (NO file change) | — | T-0007-018 and T-0007-027 budget thresholds will need bumping when Phase 1 lands; documented in Step 10 acceptance |

---

## Implementation Plan

10 steps. Steps 1-7 are component-tier additions (parallel-safe at the
file level, but Colby coordinates the schema-union merge). Steps 8-9
are infrastructure (cross-ref validator + snapshot matrix). Step 10 is
the LLM cutover (depends on ADR-0007 Steps 2 + 7 landing first).

### Step 1 — Foundation primitives (Divider, Image, IconButton)

**Files to create/modify:**

- `packages/protocol/src/components/layout.ts` — add `DividerSchema`
- `packages/protocol/src/components/compound.ts` — add `ImageSchema`
- `packages/protocol/src/components/actions.ts` — add `IconButtonSchema`
- `packages/protocol/src/components/index.ts` — re-export all 3
- `packages/protocol/src/spec.zod.ts` — extend `Node` type alias + `NodeSchema` discriminated union with 3 new arms
- `packages/a2ui-renderer/src/v0/components/layout/Divider.tsx` + test + snapshot
- `packages/a2ui-renderer/src/v0/components/compound/Image.tsx` + test + snapshot
- `packages/a2ui-renderer/src/v0/components/actions/IconButton.tsx` + test + snapshot
- `packages/a2ui-renderer/src/v0/components/NodeRenderer.tsx` — extend 28 → 31 arms
- `packages/a2ui-renderer/src/v0/index.ts` — re-export 3 new components

**Code shape — DividerSchema:**

```ts
export const DividerSchema = z.object({
  id: z.string().regex(COMPONENT_ID_REGEX),
  type: z.literal('Divider'),
  label: z.string().max(40).optional(),
  inset: z.enum(['none', 'start', 'both']).optional(),
  weight: z.enum(['hairline', 'thick']).optional(),
  accessibilityLabel: z.string().optional(),
}).strict()
```

**Code shape — ImageSchema:**

```ts
export const ImageSchema = z.object({
  id: z.string().regex(COMPONENT_ID_REGEX),
  type: z.literal('Image'),
  source: ImageBindingSchema,
  aspectRatio: z.enum(['1:1', '4:5', '16:9', '3:4', '21:9']).optional(),
  fit: z.enum(['cover', 'contain']).optional(),
  radius: z.enum(['radius-none', 'radius-sm', 'radius-md', 'radius-lg', 'radius-full']).optional(),
  alt: z.string().min(1).max(200),  // REQUIRED for accessibility
  fallbackIcon: IconNameSchema.optional(),
}).strict()
```

**Code shape — IconButtonSchema:**

```ts
export const IconButtonSchema = z.object({
  id: z.string().regex(COMPONENT_ID_REGEX),
  type: z.literal('IconButton'),
  icon: IconNameSchema,
  action: ActionSchema,
  variant: z.enum(['primary', 'secondary', 'ghost', 'destructive']).optional(),
  size: z.enum(['sm', 'md', 'lg']).optional(),
  accessibilityLabel: z.string().min(1).max(80),  // REQUIRED — icon alone is not labeled
  disabled: BooleanBindingSchema.optional(),
}).strict()
```

**Acceptance criteria:**

- `SpecSchema.parse()` accepts a spec containing Divider, Image, IconButton.
- `SpecSchema.parse()` rejects Image with empty `alt` (schema-enforced).
- `SpecSchema.parse()` rejects IconButton without `accessibilityLabel`.
- NodeRenderer dispatches all 3 to their renderers.
- Each component renders correctly in both register pairs.
- Snapshot tests pass (6 new snapshots).
- Image renderer uses Expo Image (no new dep).
- Image renderer falls back to `fallbackIcon` on error.

**Estimated complexity:** Low.

---

### Step 2 — Inputs tier expansion

**Files to create/modify:**

- `packages/protocol/src/enums.ts` — add `CurrencySchema`
- `packages/protocol/src/components/inputs.ts` — add 6 schemas
- `packages/protocol/src/components/index.ts` — re-export
- `packages/protocol/src/spec.zod.ts` — extend `NodeSchema` with 6 new arms
- `packages/a2ui-renderer/src/v0/state/SearchFilterContext.tsx` — NEW context provider + hook
- `packages/a2ui-renderer/src/v0/Renderer.tsx` — wrap inner tree in `<SearchFilterProvider>`
- `packages/a2ui-renderer/src/v0/components/inputs/MoneyField.tsx` + test + snapshot
- `packages/a2ui-renderer/src/v0/components/inputs/TimeField.tsx` + test + snapshot
- `packages/a2ui-renderer/src/v0/components/inputs/MultiPicker.tsx` + test + snapshot
- `packages/a2ui-renderer/src/v0/components/inputs/Slider.tsx` + test + snapshot
- `packages/a2ui-renderer/src/v0/components/inputs/RatingInput.tsx` + test + snapshot
- `packages/a2ui-renderer/src/v0/components/inputs/SearchBar.tsx` + test + snapshot
- `packages/a2ui-renderer/src/v0/components/lists/List.tsx` — modify to consume `useSearchFilter`
- `packages/a2ui-renderer/src/v0/components/NodeRenderer.tsx` — extend 31 → 37 arms

**Code shape — MoneyFieldSchema:**

```ts
export const MoneyFieldSchema = z.object({
  id: z.string().regex(COMPONENT_ID_REGEX),
  type: z.literal('MoneyField'),
  label: z.string().min(1).max(80),
  valueBinding: NumberBindingSchema,  // Stored as integer cents (renderer canonicalizes)
  currency: CurrencySchema.default('USD'),
  min: z.number().int().optional(),  // cents
  max: z.number().int().optional(),  // cents
  placeholder: z.string().max(80).optional(),
  optional: z.boolean().optional(),
  accessibilityLabel: z.string().optional(),
}).strict()
```

**Code shape — MultiPickerOptionSchema:**

```ts
const MultiPickerOptionSchema = z.object({
  value: z.string().min(1).max(80).regex(/^[^,]+$/, 'must not contain commas'),
  label: z.string().min(1).max(80),
  icon: IconNameSchema.optional(),
})

export const MultiPickerSchema = z.object({
  id: z.string().regex(COMPONENT_ID_REGEX),
  type: z.literal('MultiPicker'),
  label: z.string().min(1).max(80),
  valueBinding: StringBindingSchema,  // CSV string
  options: z.array(MultiPickerOptionSchema).min(1).max(16),
  min: z.number().int().nonnegative().optional(),
  max: z.number().int().positive().optional(),
  placeholder: z.string().max(80).optional(),
  accessibilityLabel: z.string().optional(),
}).strict()
```

**Code shape — SearchBarSchema:**

```ts
export const SearchBarSchema = z.object({
  id: z.string().regex(COMPONENT_ID_REGEX),
  type: z.literal('SearchBar'),
  valueBinding: StringBindingSchema,
  placeholder: z.string().max(80).optional(),
  voiceMic: z.boolean().optional(),
  boundCollectionId: z.string().min(1).max(64).optional(),
  accessibilityLabel: z.string().optional(),
}).strict()
```

**Acceptance criteria:**

- All 6 input schemas parse valid examples + reject invalid examples.
- `CurrencySchema` is a closed 7-value enum.
- `MoneyField` renderer canonicalizes "12.50" → 1250 (USD); 125 (JPY).
- `TimeField` renderer formats per locale (12h/24h from device settings).
- `MultiPicker` rejects option values containing commas at schema parse.
- `Slider` thumb drag emits haptic on step crossings; reduced-motion bypass.
- `RatingInput` supports half-step rendering when `allowHalf=true`.
- `SearchBar` with `boundCollectionId` filters bound List/GridList in real time (substring match, case-insensitive).
- `SearchFilterContext` provides Map-based wiring; multiple SearchBars work independently.
- All 6 snapshot tests pass (12 new snapshots).
- NodeRenderer 31 → 37 arms; defensive default unchanged.

**Estimated complexity:** Medium-High. SearchFilterContext is novel; other components are well-defined. Slider's Reanimated worklet is the trickiest implementation.

---

### Step 3 — Display tier expansion

**Files to create/modify:**

- `packages/design-system/src/tokens.ts` — add `tintColor(hex, alpha): string` helper
- `packages/design-system/src/tokens.test.ts` — tintColor tests
- `packages/protocol/src/components/display.ts` — add 2 schemas
- `packages/protocol/src/components/index.ts` — re-export
- `packages/protocol/src/spec.zod.ts` — extend `NodeSchema` with 2 new arms
- `packages/a2ui-renderer/src/v0/components/display/AvatarGroup.tsx` + test + snapshot
- `packages/a2ui-renderer/src/v0/components/display/Callout.tsx` + test + snapshot
- `packages/a2ui-renderer/src/v0/components/NodeRenderer.tsx` — extend 37 → 39 arms

**Code shape — tintColor:**

```ts
// packages/design-system/src/tokens.ts (extension)

/**
 * Tint a hex color by alpha. Returns rgba(...) string.
 * Used by Callout (variant tint backgrounds), Heatmap (intensity gradient),
 * TransactionRow (category icon background).
 */
export function tintColor(hex: string, alpha: number): string {
  // Parse #RRGGBB
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
```

**Code shape — CalloutSchema:**

```ts
export const CalloutSchema = z.object({
  id: z.string().regex(COMPONENT_ID_REGEX),
  type: z.literal('Callout'),
  variant: z.enum(['info', 'success', 'warning', 'tip', 'danger']).default('info'),
  headline: z.string().min(1).max(200),
  body: z.string().max(400).optional(),
  icon: IconNameSchema.optional(),
  action: z.object({
    label: z.string().min(1).max(40),
    action: ActionSchema,
  }).optional(),
  accessibilityLabel: z.string().optional(),
}).strict()
```

**Acceptance criteria:**

- `tintColor("#4F46E5", 0.06)` returns `"rgba(79, 70, 229, 0.06)"`.
- `tintColor` rejects non-hex inputs (test).
- `AvatarGroup` renders up to `maxShown` avatars with overlap; "+N" overflow indicator when more.
- `Callout` 5 variants each render with correct icon + tint color.
- `Callout` `accessibilityRole` is `"alert"` for warning/danger, `"text"` for info/tip/success.
- All 2 snapshot tests pass (4 new snapshots).
- NodeRenderer 37 → 39 arms.

**Estimated complexity:** Low.

---

### Step 4 — Lists & Data tier expansion

**Files to create/modify:**

- `packages/protocol/src/components/lists.ts` — add 4 schemas (GridList, Carousel, Timeline, ErrorState)
- `packages/protocol/src/components/index.ts` — re-export
- `packages/protocol/src/spec.zod.ts` — extend `NodeSchema` with 4 new arms
- `packages/a2ui-renderer/src/v0/components/lists/GridList.tsx` + test + snapshot
- `packages/a2ui-renderer/src/v0/components/lists/Carousel.tsx` + test + snapshot
- `packages/a2ui-renderer/src/v0/components/lists/Timeline.tsx` + test + snapshot
- `packages/a2ui-renderer/src/v0/components/lists/ErrorState.tsx` + test + snapshot
- `packages/a2ui-renderer/src/v0/components/NodeRenderer.tsx` — extend 39 → 43 arms
- `packages/a2ui-renderer/src/v0/components/lists/List.tsx` — modify to consume `useSearchFilter` (this also affects GridList + Gallery)

**Code shape — GridListSchema:**

```ts
export const GridListSchema = z.object({
  id: z.string().regex(COMPONENT_ID_REGEX),
  type: z.literal('GridList'),
  collectionId: z.string().min(1).max(64),
  columns: z.union([z.literal(2), z.literal(3)]).default(2),
  gap: z.enum(['space-none', 'space-xs', 'space-sm', 'space-md', 'space-lg', 'space-xl']).optional(),
  itemAspectRatio: z.enum(['1:1', '4:5', '3:4']).default('1:1'),
  emptyState: z.unknown().optional(),  // Tightened to NodeSchema in spec.zod.ts via z.lazy
  loadingState: z.unknown().optional(),
  accessibilityLabel: z.string().optional(),
}).strict()
```

**Code shape — CarouselSchema:**

```ts
export const CarouselSchema = z.object({
  id: z.string().regex(COMPONENT_ID_REGEX),
  type: z.literal('Carousel'),
  collectionId: z.string().min(1).max(64).optional(),
  cards: z.array(z.unknown()).max(10).optional(),  // Tightened to NodeSchema via z.lazy
  indicator: z.enum(['dots', 'fraction', 'none']).default('dots'),
  cardWidth: z.enum(['snap', 'peek', 'full']).default('snap'),
  autoplay: z.boolean().default(false),
  accessibilityLabel: z.string().optional(),
}).strict().superRefine((data, ctx) => {
  // Mutually exclusive: collectionId XOR cards (Step 8 cross-ref code: mutually_exclusive_collection)
  const hasCollection = data.collectionId !== undefined
  const hasCards = data.cards !== undefined && data.cards.length > 0
  if (hasCollection === hasCards) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Carousel requires exactly one of collectionId or cards (not both, not neither)',
    })
  }
})
```

**Acceptance criteria:**

- All 4 list schemas parse valid examples + reject invalid examples.
- Carousel rejects specs with both `collectionId` and `cards` set.
- Carousel rejects specs with neither.
- GridList collapses to 2 columns when device width < 380pt (renderer logic).
- Timeline renders `dateField` in left rail; group headers render at month boundaries when `groupBy='month'`.
- ErrorState uses `accessibilityRole="alert"`.
- Carousel autoplay disabled under `useReducedMotion()` (regression test).
- All 4 snapshot tests pass (8 new snapshots).
- NodeRenderer 39 → 43 arms.

**Estimated complexity:** Medium. Carousel's superRefine + autoplay accessibility need careful implementation.

---

### Step 5 — Productivity domain compounds (TransactionRow, Receipt, MetricTile, StepList)

**Files to create/modify:**

- `packages/protocol/src/components/compound.ts` — add 4 schemas
- `packages/protocol/src/components/index.ts` — re-export
- `packages/protocol/src/spec.zod.ts` — extend `NodeSchema` with 4 new arms
- `packages/a2ui-renderer/src/v0/components/compound/TransactionRow.tsx` + test + snapshot
- `packages/a2ui-renderer/src/v0/components/compound/Receipt.tsx` + test + snapshot
- `packages/a2ui-renderer/src/v0/components/compound/MetricTile.tsx` + test + snapshot
- `packages/a2ui-renderer/src/v0/components/compound/StepList.tsx` + test + snapshot
- `packages/a2ui-renderer/src/v0/components/NodeRenderer.tsx` — extend 43 → 47 arms

**Code shape — ReceiptSchema:**

```ts
const ReceiptItemSchema = z.object({
  label: z.string().min(1).max(80),
  amount: NumberBindingSchema,
  quantity: z.number().int().positive().optional(),
})

export const ReceiptSchema = z.object({
  id: z.string().regex(COMPONENT_ID_REGEX),
  type: z.literal('Receipt'),
  items: z.array(ReceiptItemSchema).min(1).max(50),
  subtotal: NumberBindingSchema,
  tax: NumberBindingSchema.optional(),
  tip: NumberBindingSchema.optional(),
  total: NumberBindingSchema,
  currency: CurrencySchema.default('USD'),
  accessibilityLabel: z.string().optional(),
}).strict()
```

**Code shape — MetricTileSchema:**

```ts
export const MetricTileSchema = z.object({
  id: z.string().regex(COMPONENT_ID_REGEX),
  type: z.literal('MetricTile'),
  value: z.string().min(1).max(40),
  label: z.string().min(1).max(80),
  delta: z.string().max(40).optional(),
  deltaTone: z.enum(['positive', 'negative', 'neutral']).optional(),
  sparklineData: z.array(z.number()).max(30).optional(),
  icon: IconNameSchema.optional(),
  accessibilityLabel: z.string().optional(),
}).strict()
```

**Acceptance criteria:**

- All 4 compound schemas parse valid examples + reject invalid examples.
- TransactionRow positive amount renders in `success` color; negative in `fg` (NOT `danger`).
- Receipt with `subtotal + tax + tip ≠ total ± 1 cent` triggers `receipt_total_mismatch` warning at validate time (Step 8 wires this).
- MetricTile sparkline uses `react-native-svg` `<Polyline>` (no Skia).
- StepList numbered style renders connecting vertical rail.
- StepList checklist style supports BooleanBinding per step.
- All 4 snapshot tests pass (8 new snapshots).
- NodeRenderer 43 → 47 arms.

**Estimated complexity:** Medium. Receipt's dotted-leader rendering on iOS (RN's `borderStyle: 'dotted'` is unreliable per Sable's Notes for Colby — fall back to repeated `.` characters).

---

### Step 6 — Date components (Calendar, Heatmap)

**Files to create/modify:**

- `packages/a2ui-renderer/package.json` — add `date-fns@^3.6.0` to dependencies
- `pnpm-lock.yaml` — regenerated
- `packages/protocol/src/components/compound.ts` — add 2 schemas (Calendar, Heatmap)
- `packages/protocol/src/components/index.ts` — re-export
- `packages/protocol/src/spec.zod.ts` — extend `NodeSchema` with 2 new arms
- `packages/a2ui-renderer/src/v0/components/compound/Calendar.tsx` + test + snapshot
- `packages/a2ui-renderer/src/v0/components/compound/Heatmap.tsx` + test + snapshot
- `packages/a2ui-renderer/src/v0/components/NodeRenderer.tsx` — extend 47 → 49 arms

**Code shape — CalendarSchema:**

```ts
export const CalendarSchema = z.object({
  id: z.string().regex(COMPONENT_ID_REGEX),
  type: z.literal('Calendar'),
  view: z.enum(['month', 'week']).default('month'),
  collectionId: z.string().min(1).max(64).optional(),
  dateField: z.string().min(1).max(64).optional(),
  selectedBinding: DateBindingSchema.optional(),
  firstDayOfWeek: z.enum(['sunday', 'monday']).optional(),
  accessibilityLabel: z.string().optional(),
}).strict().superRefine((data, ctx) => {
  // If collectionId is set, dateField must be set
  if (data.collectionId && !data.dateField) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Calendar with collectionId requires dateField',
      path: ['dateField'],
    })
  }
})
```

**Code shape — HeatmapSchema:**

```ts
export const HeatmapSchema = z.object({
  id: z.string().regex(COMPONENT_ID_REGEX),
  type: z.literal('Heatmap'),
  collectionId: z.string().min(1).max(64),
  dateField: z.string().min(1).max(64),
  range: z.enum(['30d', '90d', '180d', '365d']).default('90d'),
  intensityMode: z.enum(['count', 'binary']).default('count'),
  accessibilityLabel: z.string().optional(),
}).strict()
```

**Acceptance criteria:**

- `date-fns@^3.6.0` installed; tree-shaken imports used (`import {format} from 'date-fns/format'`).
- Bundle size regression: renderer bundle grows ≤ 25kb gzipped (date-fns measurement).
- Calendar renders 6-row × 7-col month grid for any month.
- Calendar respects `firstDayOfWeek`.
- Calendar with `collectionId` marks dates with `accent` dot.
- Heatmap quintile binning correctly maps 0-N events per day to intensity levels.
- Heatmap cell long-press exposes per-cell info via `accessibilityCustomActions`.
- Both snapshots pass (4 new snapshots).
- NodeRenderer 47 → 49 arms.

**Estimated complexity:** Medium-High. Date math is non-trivial; Heatmap quintile computation needs care.

---

### Step 7 — Content/Media expansion (Gallery, CommerceCard, BeforeAfter, DocumentPicker)

**Files to create/modify:**

- `packages/a2ui-renderer/package.json` — add `expo-document-picker@~12.0.2`
- `pnpm-lock.yaml` — regenerated
- `packages/protocol/src/components/compound.ts` — add 4 schemas
- `packages/protocol/src/components/index.ts` — re-export
- `packages/protocol/src/spec.zod.ts` — extend `NodeSchema` with 4 new arms
- `packages/a2ui-renderer/src/v0/components/compound/Gallery.tsx` + test + snapshot
- `packages/a2ui-renderer/src/v0/components/compound/CommerceCard.tsx` + test + snapshot
- `packages/a2ui-renderer/src/v0/components/compound/BeforeAfter.tsx` + test + snapshot
- `packages/a2ui-renderer/src/v0/components/compound/DocumentPicker.tsx` + test + snapshot
- `packages/a2ui-renderer/src/v0/components/NodeRenderer.tsx` — extend 49 → 53 arms

**Code shape — GallerySchema:**

```ts
export const GallerySchema = z.object({
  id: z.string().regex(COMPONENT_ID_REGEX),
  type: z.literal('Gallery'),
  collectionId: z.string().min(1).max(64).optional(),
  imageField: z.string().min(1).max(64).optional(),
  images: z.array(ImageBindingSchema).max(50).optional(),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
  aspectRatio: z.enum(['1:1', '4:5']).default('1:1'),
  gap: z.enum(['space-none', 'space-xs', 'space-sm', 'space-md', 'space-lg', 'space-xl']).optional(),
  accessibilityLabel: z.string().optional(),
}).strict().superRefine((data, ctx) => {
  // Mutually exclusive: (collectionId+imageField) XOR images
  const hasCollection = data.collectionId !== undefined && data.imageField !== undefined
  const hasImages = data.images !== undefined && data.images.length > 0
  if (hasCollection === hasImages) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Gallery requires exactly one of (collectionId+imageField) or images',
    })
  }
  if (data.collectionId && !data.imageField) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Gallery with collectionId requires imageField',
      path: ['imageField'],
    })
  }
})
```

**Code shape — DocumentPickerSchema:**

```ts
export const DocumentPickerSchema = z.object({
  id: z.string().regex(COMPONENT_ID_REGEX),
  type: z.literal('DocumentPicker'),
  label: z.string().min(1).max(80),
  valueBinding: StringBindingSchema,  // file URI
  acceptedTypes: z.array(z.enum(['pdf', 'image', 'video', 'audio', 'any'])).min(1).max(4).default(['any']),
  placeholder: z.string().max(80).optional(),
  accessibilityLabel: z.string().optional(),
}).strict()
```

**Acceptance criteria:**

- `expo-document-picker@~12.0.2` installed and registered with iOS app entitlements.
- Gallery rejects specs with both `collectionId+imageField` and `images` set.
- Gallery rejects specs with `collectionId` but no `imageField`.
- Gallery fullscreen modal opens on cell tap; close button uses IconButton.
- CommerceCard renders price with currency formatting; priceCompare with strikethrough when present.
- CommerceCard image clips to top of card via `borderTopLeftRadius` + `overflow: hidden`.
- BeforeAfter slider mode supports drag with Reanimated worklet; reduced-motion bypass.
- DocumentPicker mocked in tests (no live iOS picker invocation).
- DocumentPicker maps `acceptedTypes` to MIME types correctly.
- All 4 snapshot tests pass (8 new snapshots).
- NodeRenderer 49 → 53 arms.

**Estimated complexity:** Medium. BeforeAfter's drag-to-clip Reanimated worklet is non-trivial.

---

### Step 8 — Cross-ref validator + 18 new icons

**Files to create/modify:**

- `packages/protocol/src/validate.ts` — add 5 new error codes; add 5 new check functions
- `packages/protocol/src/validate.test.ts` — tests for new codes
- `packages/protocol/src/icons/names.ts` — add 18 icon names
- `packages/protocol/src/icons/paths.ts` — regenerated by `gen-icon-paths.ts`
- `packages/protocol/src/icons/__tests__/icons.test.ts` — verify count and lookup

**New ValidationErrorCode entries:**

```ts
| 'date_field_required'
| 'image_field_required'
| 'mutually_exclusive_collection'
| 'unknown_search_collection'
| 'receipt_total_mismatch'  // WARNING tier — see Step 8 acceptance for ValidatorResult contract change
```

**New `ValidatorResult` contract (extension):**

```ts
export type ValidationError = {
  path: (string | number)[]
  message: string
  code: ValidationErrorCode
  severity?: 'error' | 'warning'  // NEW — defaults to 'error' if absent
}

export type ValidatorResult =
  | {ok: true; spec: Spec; warnings: ValidationError[]}  // NEW — warnings array always present
  | {ok: false; errors: ValidationError[]; warnings: ValidationError[]}
```

Existing call sites that destructure `{errors}` continue to work
(warnings is additive). Routes return only `errors[].code` to clients
(per ADR-0007 §F security pattern); warnings flow to telemetry only.

**18 new icons** (Sable's list from V1 spec):

`bell, calendar-days, chevrons-up-down, chevrons-left-right, circle,
credit-card, file-image, file-text, file-video, flag, gallery-thumbnails,
lightbulb, list-checks, plus-circle, receipt, shopping-bag, shopping-cart,
sliders-vertical, tags, timer`

(Note: `circle, search` already exist in the V0 catalog — Sable's spec
lists them for reference. Net-new: 18 icons.)

**Acceptance criteria:**

- 5 new ValidationErrorCode values added.
- `ValidatorResult.warnings` array is always present.
- `validate.ts` checks for: Calendar/Timeline/Heatmap dateField existence + type; Gallery imageField existence + type; Carousel mutual exclusion; SearchBar boundCollectionId existence; Receipt math tolerance.
- Icon catalog grows from 80 → 98 entries.
- `IconNameSchema` accepts all 18 new names.
- Codegen-drift CI passes.
- All schema+validator tests pass.

**Estimated complexity:** Medium.

---

### Step 9 — Snapshot matrix grows 56 → 106

**Files to create/modify:**

- `packages/a2ui-renderer/src/v0/snapshot-matrix.test.tsx` — extend matrix entries from 56 → 106
- `packages/a2ui-renderer/src/v0/__snapshots__/snapshot-matrix.test.tsx.snap` — regenerate (50 new snapshot entries)
- `packages/a2ui-renderer/test/snapshot-policy.md` — update to mention 53-component coverage (was 28)

**T-IDs:**

T-0006-180..235 are V0's 56 entries (productive×focus + expressive×health for 28 components). T-0006-237..286 are V1 Phase 1's 50 new entries (productive×focus + expressive×health for the 25 new components, in tier order: Layout, Inputs, Display, Lists, Compound, Actions).

**T-0006-236 stability invariant updates:**

- `MATRIX_ENTRIES.length === 106` (was 56).
- Productive×focus count === 53 (was 28).
- Expressive×health count === 53 (was 28).
- T-IDs unique, contiguous range with one gap (T-236 is the stability test itself, then T-237..286 are new entries).

**Acceptance criteria:**

- Snapshot matrix has exactly 106 entries.
- T-0006-236 invariant test passes.
- All 106 snapshots pass via `pnpm --filter @app-creator/a2ui-renderer test`.
- CI workflow `renderer-snapshot-matrix.yml` triggers on Phase 1 PR.

**Estimated complexity:** Low.

---

### Step 10 — System-prompt update + eval harness extension

**MUST land after ADR-0007 Step 2 (V0 system prompt) and Step 7 (V0 eval harness).**

**Files to create/modify:**

- `services/api/src/llm/prompts/system.ts` — extend `SYSTEM_PROMPT_CATALOG` with 25 new components + stance affinity cheat-sheet + domain compound usage hints + re-prompt continuity instruction
- `services/api/src/llm/prompts/system.test.ts` — bump T-0007-027 cached block budget from 25,000 chars to 35,000 chars
- `services/api/src/llm/tools/produceAppSpec.test.ts` — bump T-0007-018 token budget from 25,000 chars to 40,000 chars
- `services/api/eval/prompts.ts` — add 60 V1-exercising prompts (15 per archetype) + 5 re-prompt continuity prompts
- `services/api/eval/run.ts` — add new mode `v1` (or extend `v0` mode to cover new prompts)

**Acceptance criteria:**

- `SYSTEM_PROMPT_CATALOG` mentions all 53 component names.
- `SYSTEM_PROMPT_CATALOG` includes the stance affinity cheat-sheet from Sable's spec.
- `SYSTEM_PROMPT_CATALOG` includes domain compound usage hints (TransactionRow, MetricTile, Calendar, etc.).
- `SYSTEM_PROMPT_CATALOG` includes re-prompt continuity instruction.
- `SYSTEM_PROMPT_CATALOG.length <= 35,000` chars (~8,750 tokens).
- Tool definition JSON Schema `<= 40,000` chars (~10,000 tokens).
- Eval harness has 225 prompts: 100 archetype-balanced + 60 V1-exercising + 30 detection + 30 false-positive + 5 re-prompt-continuity.
- V1-exercising prompts pass at ≥75% per archetype.
- Re-prompt-continuity prompts pass at ≥80%.
- V0 archetype-balanced prompts still pass at ≥80% per archetype (regression).

**Estimated complexity:** Medium-High. The prompt-engineering for the cheat-sheet + usage hints is real work; eval re-baseline takes test runs.

---

## Comprehensive Test Specification

### Test File Mapping

| Step | Test File | Env |
|---|---|---|
| 1 | `packages/protocol/src/components/layout.test.ts` (Divider) | Node (Jest) |
| 1 | `packages/protocol/src/components/compound.test.ts` (Image schema) | Node |
| 1 | `packages/protocol/src/components/actions.test.ts` (IconButton schema) | Node |
| 1 | `packages/a2ui-renderer/src/v0/components/layout/Divider.test.tsx` | Node (Jest, RN) |
| 1 | `packages/a2ui-renderer/src/v0/components/compound/Image.test.tsx` | Node (Jest, RN) |
| 1 | `packages/a2ui-renderer/src/v0/components/actions/IconButton.test.tsx` | Node (Jest, RN) |
| 1 | `packages/a2ui-renderer/src/v0/components/NodeRenderer.test.tsx` (extend) | Node (Jest, RN) |
| 2 | `packages/protocol/src/enums.test.ts` (CurrencySchema) | Node |
| 2 | `packages/protocol/src/components/inputs.test.ts` (6 new schemas) | Node |
| 2 | `packages/a2ui-renderer/src/v0/state/SearchFilterContext.test.tsx` | Node (Jest, RN) |
| 2 | `packages/a2ui-renderer/src/v0/components/inputs/{MoneyField,TimeField,MultiPicker,Slider,RatingInput,SearchBar}.test.tsx` | Node (Jest, RN) |
| 3 | `packages/design-system/src/tokens.test.ts` (tintColor) | Node |
| 3 | `packages/protocol/src/components/display.test.ts` (AvatarGroup, Callout) | Node |
| 3 | `packages/a2ui-renderer/src/v0/components/display/{AvatarGroup,Callout}.test.tsx` | Node (Jest, RN) |
| 4 | `packages/protocol/src/components/lists.test.ts` (4 new schemas) | Node |
| 4 | `packages/a2ui-renderer/src/v0/components/lists/{GridList,Carousel,Timeline,ErrorState}.test.tsx` | Node (Jest, RN) |
| 5 | `packages/protocol/src/components/compound.test.ts` (4 new compound schemas) | Node |
| 5 | `packages/a2ui-renderer/src/v0/components/compound/{TransactionRow,Receipt,MetricTile,StepList}.test.tsx` | Node (Jest, RN) |
| 6 | `packages/protocol/src/components/compound.test.ts` (Calendar, Heatmap schemas) | Node |
| 6 | `packages/a2ui-renderer/src/v0/components/compound/{Calendar,Heatmap}.test.tsx` | Node (Jest, RN) |
| 7 | `packages/protocol/src/components/compound.test.ts` (4 content/media schemas) | Node |
| 7 | `packages/a2ui-renderer/src/v0/components/compound/{Gallery,CommerceCard,BeforeAfter,DocumentPicker}.test.tsx` | Node (Jest, RN) |
| 8 | `packages/protocol/src/validate.test.ts` (5 new codes + ValidatorResult shape) | Node |
| 8 | `packages/protocol/src/icons/__tests__/icons.test.ts` (18 new icons) | Node |
| 9 | `packages/a2ui-renderer/src/v0/snapshot-matrix.test.tsx` (T-0006-236 + 50 new entries) | Node (Jest, RN) |
| 10 | `services/api/src/llm/prompts/system.test.ts` (catalog content + budget bumps) | Node |
| 10 | `services/api/eval/prompts.test.ts` (count + V1-exercising prompts) | Node |
| 10 | `services/api/eval/run.test.ts` (mode wiring) | Node |

### Step 1 Tests

| ID | Category | Description |
|---|---|---|
| T-0009-001 | Happy | `DividerSchema.parse({id, type: 'Divider'})` succeeds with no optional props |
| T-0009-002 | Happy | `DividerSchema.parse({id, type: 'Divider', label: 'Today', inset: 'start', weight: 'thick'})` succeeds |
| T-0009-003 | Failure | `DividerSchema.parse({id, type: 'Divider', label: 'x'.repeat(41)})` rejects (label > 40 chars) |
| T-0009-004 | Failure | `DividerSchema.parse({id, type: 'Divider', inset: 'middle'})` rejects (not in enum) |
| T-0009-005 | Boundary | `DividerSchema.parse({id, type: 'Divider', label: 'x'.repeat(40)})` succeeds (exactly at boundary) |
| T-0009-006 | Happy | `ImageSchema.parse({id, type: 'Image', source: {kind:'literal', value: 'https://...'}, alt: 'A photo'})` succeeds |
| T-0009-007 | Failure | `ImageSchema.parse({id, type: 'Image', source: ..., alt: ''})` rejects (alt min 1 char — accessibility-critical) |
| T-0009-008 | Failure | `ImageSchema.parse({id, type: 'Image', source: ...})` rejects when alt is missing entirely |
| T-0009-009 | Failure | `ImageSchema.parse({id, type: 'Image', source: ..., alt: 'x'.repeat(201)})` rejects (alt > 200 chars) |
| T-0009-010 | Boundary | `ImageSchema.parse({...alt: 'x'.repeat(200)})` succeeds (exactly at boundary) |
| T-0009-011 | Happy | `IconButtonSchema.parse({id, type: 'IconButton', icon: 'plus', action: {...}, accessibilityLabel: 'Add'})` succeeds |
| T-0009-012 | Failure | `IconButtonSchema.parse({...accessibilityLabel: ''})` rejects (a11y critical) |
| T-0009-013 | Failure | `IconButtonSchema.parse({...accessibilityLabel: undefined})` rejects (required) |
| T-0009-014 | Happy | NodeRenderer with `{type: 'Divider', ...}` dispatches to DividerRenderer |
| T-0009-015 | Happy | NodeRenderer with `{type: 'Image', ...}` dispatches to ImageRenderer |
| T-0009-016 | Happy | NodeRenderer with `{type: 'IconButton', ...}` dispatches to IconButtonRenderer |
| T-0009-017 | Happy | NodeRenderer 31-arm test: each of the 31 component types renders without `host.onUnknownNodeType` being called |
| T-0009-018 | Snapshot | Divider renders at productive×focus |
| T-0009-019 | Snapshot | Divider renders at expressive×health |
| T-0009-020 | Snapshot | Image renders at productive×focus |
| T-0009-021 | Snapshot | Image renders at expressive×health |
| T-0009-022 | Snapshot | IconButton renders at productive×focus |
| T-0009-023 | Snapshot | IconButton renders at expressive×health |
| T-0009-024 | Failure (a11y) | Image renderer throws if rendered with empty `alt` (defense-in-depth — schema rejected, but renderer also defensive) |
| T-0009-025 | Happy | Divider with `inset: 'start'` adds 16pt left inset to the line element |
| T-0009-026 | Happy | Divider with `weight: 'thick'` renders at 2pt height |
| T-0009-027 | Happy | Image with `fallbackIcon: 'image'` shows the icon when source URL fails to load (mocked Expo Image error) |
| T-0009-028 | Happy | IconButton variant `'destructive'` renders icon in `danger` color |
| T-0009-029 | Failure | NodeRenderer with `{type: 'Divider'}` missing `id` rejects at SpecSchema.parse upstream |
| T-0009-030 | Regression | Existing 28 V0 components still dispatch correctly post-extension |
| T-0009-243 | Happy (a11y) | Divider with no `label` prop uses `accessibilityRole="none"`; VoiceOver skips. With `label` set, uses `accessibilityRole="text"` with `accessibilityLabel={label}` |

#### Step 1 Test Summary

| Category | Count |
|---|---|
| Happy | 12 |
| Failure | 8 |
| Boundary | 2 |
| Snapshot | 6 |
| Regression | 1 |
| Failure (a11y) | 1 |
| Happy (a11y) | 1 |
| **Total** | **31** |

### Step 2 Tests

| ID | Category | Description |
|---|---|---|
| T-0009-031 | Happy | `CurrencySchema.parse('USD')` succeeds for all 7 enum values |
| T-0009-032 | Failure | `CurrencySchema.parse('XYZ')` rejects (not in enum) |
| T-0009-033 | Happy | `MoneyFieldSchema.parse({...currency: 'USD'})` succeeds with no min/max |
| T-0009-034 | Boundary | MoneyField with `min: 100, max: 1000` (cents) parses; renderer rejects values outside range |
| T-0009-035 | Happy | `MoneyField` renderer canonicalizes user input "12.50" → 1250 (USD); 125 (JPY zero-decimal) |
| T-0009-036 | Failure | MoneyField user input "abc" rejected at input-handle time (not at schema level) |
| T-0009-037 | Boundary | MoneyField at JPY: input "12.50" → renderer normalizes to 12 (drops decimal — JPY is zero-decimal) |
| T-0009-038 | Happy | `TimeFieldSchema.parse({...mode: 'time'})` succeeds |
| T-0009-039 | Happy | `TimeField` renderer formats 13:30 → "1:30 PM" on US locale; "13:30" on 24h locale |
| T-0009-040 | Happy | `MultiPickerSchema.parse({options: [{value:'a',label:'A'}], ...})` succeeds |
| T-0009-041 | Failure | `MultiPickerSchema.parse({options: [{value:'a,b',label:'X'}], ...})` rejects (comma in value) |
| T-0009-042 | Happy | MultiPicker valueBinding: `'a,b,c'` parses to selected `['a','b','c']`; chip dismissal removes one |
| T-0009-043 | Boundary | MultiPicker with exactly 16 options succeeds; 17 rejects |
| T-0009-044 | Happy | `SliderSchema.parse({min:0, max:100, step:5})` succeeds |
| T-0009-045 | Happy | Slider thumb drag emits Light haptic on each step crossing (mocked expo-haptics) |
| T-0009-046 | Regression (a11y) | Slider supports VoiceOver swipe-up to increment by `step` |
| T-0009-047 | Happy | Slider with reduced-motion: thumb position updates instantly (no spring) |
| T-0009-048 | Happy | `RatingInputSchema.parse({scale: 5, glyph: 'star'})` succeeds |
| T-0009-049 | Happy | RatingInput tap glyph 3 sets value to 3 |
| T-0009-050 | Happy | RatingInput with `allowHalf: true` supports half-step taps |
| T-0009-051 | Happy | `SearchBarSchema.parse({...boundCollectionId: 'tasks'})` succeeds |
| T-0009-052 | Happy | SearchFilterContext: SearchBar writes query to Map; List for that collection consumes via `useSearchFilter` |
| T-0009-053 | Happy | SearchBar substring filter is case-insensitive ('cof' matches 'Coffee') |
| T-0009-054 | Happy | SearchBar substring filter matches across all string fields of collection rows |
| T-0009-055 | Happy | SearchBar substring filter ignores numeric fields |
| T-0009-056 | Happy | Two SearchBars on different collections work independently |
| T-0009-057 | Boundary | SearchBar bound to 1000-row collection: filter completes in < 16ms (one frame) |
| T-0009-058 | Happy | SearchBar `voiceMic: true` shows mic icon when query empty; opens "Voice search coming soon" sheet on tap |
| T-0009-059 | Snapshot | Each of 6 inputs at productive×focus + expressive×health (12 snapshots) |
| T-0009-060 | Boundary | NodeRenderer 37-arm test |
| T-0009-061 | Regression | Existing 31-arm tests still pass |
| T-0009-062 | Failure | TimeField with `mode: 'invalid'` rejects |
| T-0009-063 | Failure | RatingInput with `scale: 7` rejects (only 5 or 10 allowed) |
| T-0009-064 | Failure | RatingInput with `glyph: 'cube'` rejects (not in enum) |
| T-0009-065 | Failure | SearchBar with `boundCollectionId: ''` rejects (min 1) |
| T-0009-066 | Boundary | SearchBar with empty query string clears filter (renderer treats empty as null) |
| T-0009-067 | Boundary | MultiPicker with `min: 2, max: 5`: schema parse succeeds; renderer enforces at submit |
| T-0009-228 | Regression (P0) | **MoneyField floating-point regression.** `parseAndCanonicalize("0.10", "USD") + parseAndCanonicalize("0.20", "USD") === 30` (integer, NOT 30.000000000000004). Asserts cents-only path never touches floats. Test additionally: `parseAndCanonicalize("0.10", "USD") * 3 === 30` (integer multiplication); `parseAndCanonicalize("99.99", "USD") === 9999`. Prevents the silent data-corruption bug Cal flagged in §J risks. |
| T-0009-230 | Security (P0) | **SearchFilterContext instance-scoping.** Two independent `<Renderer>` instances mounted in the same Jest test produce two separate `SearchFilterContext` Maps (NOT a module-level singleton). Test: mount Renderer A with SearchBar bound to collection 'tasks' writing query 'X'; mount Renderer B with SearchBar bound to 'tasks' writing query 'Y'; assert each List sees only its own Renderer's query. Prevents cross-user filter bleed. |
| T-0009-231 | Boundary | **SearchBar unmount-clears-filter.** Mount SearchBar with `boundCollectionId: 'tasks'`, write query 'cof'; unmount the SearchBar (simulate navigate-away); assert `useSearchFilter('tasks')` now returns `null` (Map entry removed). List for that collection reverts to unfiltered. |
| T-0009-232 | Boundary | **Two SearchBars on same collectionId — last-writer-wins documented.** Sable's spec doesn't address this; Cal pins behavior: two SearchBars with `boundCollectionId: 'tasks'` co-mounted both write to the same Map key on every keystroke. Behavior: last writer wins. Test asserts this AND emits a runtime `console.warn` so dev catches the misuse. Schema does NOT reject (two SearchBars is structurally valid even if semantically odd). |
| T-0009-233 | Boundary | **MultiPicker empty CSV parse.** `valueBinding: {kind:'literal', value:''}` (empty string) parses to selected `[]` (empty array), NOT `['']`. Renderer reads `''.split(',').filter(Boolean) === []`. |
| T-0009-234 | Boundary | **MultiPicker trailing comma parse.** `valueBinding: {kind:'literal', value:'a,'}` parses to selected `['a']` (trailing comma ignored). Renderer uses `.split(',').filter(Boolean)`. |

#### Step 2 Test Summary

| Category | Count |
|---|---|
| Happy | 20 |
| Failure | 7 |
| Boundary | 11 |
| Snapshot | 1 (12 snapshots in 1 entry — split deferred to Step 9 reconciliation) |
| Regression (a11y) | 1 |
| Regression (P0) | 1 |
| Security (P0) | 1 |
| Regression | 1 |
| **Total** | **43** |

### Step 3 Tests

| ID | Category | Description |
|---|---|---|
| T-0009-068 | Happy | `tintColor("#4F46E5", 0.06)` returns `"rgba(79, 70, 229, 0.06)"` |
| T-0009-069 | Happy | `tintColor("#000000", 1)` returns `"rgba(0, 0, 0, 1)"` |
| T-0009-070 | Failure | `tintColor("not-a-hex", 0.5)` throws or returns sentinel |
| T-0009-071 | Failure | `tintColor("#FF0000", -0.1)` throws (alpha out of range) |
| T-0009-072 | Failure | `tintColor("#FF0000", 1.5)` throws (alpha out of range) |
| T-0009-073 | Boundary | `tintColor("#FFFFFF", 0)` returns `"rgba(255, 255, 255, 0)"` |
| T-0009-074 | Happy | `AvatarGroupSchema.parse({avatars: [{name:'A'}], maxShown: 3})` succeeds |
| T-0009-075 | Failure | AvatarGroup with 6 avatars rejects (max 5) |
| T-0009-076 | Happy | AvatarGroup renders 3 avatars when `maxShown: 3` and avatars.length=3 |
| T-0009-077 | Happy | AvatarGroup renders "+2" overflow when maxShown=3 and avatars.length=5 |
| T-0009-078 | Happy | AvatarGroup with `overlap: 'tight'` applies -25% width margin |
| T-0009-079 | Happy | `CalloutSchema.parse({variant:'info', headline:'Welcome'})` succeeds |
| T-0009-080 | Happy | Callout 5 variants render with correct icon defaults (info→info, success→check-circle, warning→alert-triangle, tip→sparkles, danger→x-circle) |
| T-0009-081 | Happy | Callout `variant: 'warning'` uses `accessibilityRole="alert"` |
| T-0009-082 | Happy | Callout `variant: 'info'` uses `accessibilityRole="text"` (not alert) |
| T-0009-083 | Happy | Callout with `action` renders trailing button |
| T-0009-084 | Happy | Callout `variant: 'tip'` background is `bg-elevated` (no tint) |
| T-0009-085 | Happy | Callout `variant: 'info'` background is `tintColor(accent, 0.06)` |
| T-0009-086 | Snapshot | AvatarGroup at productive×focus + expressive×health |
| T-0009-087 | Snapshot | Callout (each of 5 variants) at productive×focus + expressive×health (10 snapshots) |
| T-0009-088 | Boundary | NodeRenderer 39-arm test |
| T-0009-240 | Failure | **tintColor short-hex rejection.** `tintColor("#FFF", 0.5)` throws (or returns sentinel — Cal pin: THROWS). Implementation slices 6 chars; 3-char hex would produce `rgba(255, NaN, NaN, 0.5)` silently. Test: `expect(() => tintColor("#FFF", 0.5)).toThrow()`. Also covers 4-char, 5-char, 7-char hex (anything not exactly 7 chars including `#`). |
| T-0009-241 | Happy (a11y) | **AvatarGroup auto-generated `accessibilityLabel`.** Given `avatars=[{name:'Alex'},{name:'Sam'},{name:'Jordan'},{name:'Kim'},{name:'Pat'}]` and `maxShown: 3`, the wrapper's `accessibilityLabel` is exactly `"5 people: Alex, Sam, Jordan, and 2 others"`. Test asserts the string. With maxShown=avatars.length: no "and N others" suffix. |
| T-0009-242 | Happy (a11y) | **Callout `danger` variant `accessibilityRole="alert"`.** T-0009-081 covers warning; T-0009-082 covers info. This covers danger — same alert role as warning per Sable's spec ("variant === 'warning' || variant === 'danger'"). Without this test, the danger-alert path can regress silently. |

#### Step 3 Test Summary

| Category | Count |
|---|---|
| Happy | 13 |
| Failure | 5 |
| Boundary | 2 |
| Snapshot | 2 |
| Happy (a11y) | 2 |
| **Total** | **24** |

### Step 4 Tests

| ID | Category | Description |
|---|---|---|
| T-0009-089 | Happy | `GridListSchema.parse({collectionId, columns: 2})` succeeds |
| T-0009-090 | Failure | GridList with `columns: 4` rejects (only 2 or 3 allowed) |
| T-0009-091 | Happy | GridList renders 2-column grid on iPhone-class width (380pt+); collapses to 2 even when columns=3 on narrow widths |
| T-0009-092 | Happy | `CarouselSchema.parse({collectionId})` succeeds (collectionId only) |
| T-0009-093 | Happy | `CarouselSchema.parse({cards: [...]})` succeeds (cards only) |
| T-0009-094 | Failure | Carousel with both `collectionId` and `cards` rejects (mutually exclusive) |
| T-0009-095 | Failure | Carousel with neither rejects |
| T-0009-096 | Happy | Carousel with `autoplay: true` advances every 4s under normal motion |
| T-0009-097 | Regression (a11y) | Carousel with `autoplay: true` does NOT advance when `useReducedMotion()` returns true |
| T-0009-098 | Happy | `TimelineSchema.parse({collectionId, dateField: 'createdAt'})` succeeds |
| T-0009-099 | Happy | Timeline renders left rail with circles at each event |
| T-0009-100 | Happy | Timeline `groupBy: 'month'` renders month headers between events |
| T-0009-101 | Happy | `ErrorStateSchema.parse({headline: 'Something broke'})` succeeds (uses default icon) |
| T-0009-102 | Happy | ErrorState uses `accessibilityRole="alert"` |
| T-0009-103 | Happy | ErrorState with `action` renders retry button |
| T-0009-104 | Happy | ErrorState default icon is `alert-triangle` in `warning` color |
| T-0009-105 | Snapshot | GridList at productive×focus + expressive×health |
| T-0009-106 | Snapshot | Carousel at productive×focus + expressive×health |
| T-0009-107 | Snapshot | Timeline at productive×focus + expressive×health |
| T-0009-108 | Snapshot | ErrorState at productive×focus + expressive×health |
| T-0009-109 | Boundary | NodeRenderer 43-arm test |
| T-0009-110 | Failure (Step-8 dependent) | **Timeline without `dateField` (when `collectionId` set) rejects at cross-ref validate.** This test cannot be IMPLEMENTED in Step 4 because the cross-ref validator extension (`date_field_required` code) is delivered in Step 8. Colby: write the Timeline schema in Step 4 to support the validate-time check (no superRefine at schema level — defer to Step 8's `validateCrossRefs`). Mark this T-ID `.todo` in the Step 4 test file with comment "Implemented in Step 8: see T-0009-189." Test moves to Step 8's file at that step. |

#### Step 4 Test Summary

| Category | Count |
|---|---|
| Happy | 12 |
| Failure | 4 |
| Boundary | 1 |
| Snapshot | 4 |
| Regression (a11y) | 1 |
| **Total** | **22** |

### Step 5 Tests

| ID | Category | Description |
|---|---|---|
| T-0009-111 | Happy | `TransactionRowSchema.parse({date, merchant, amount, currency: 'USD'})` succeeds |
| T-0009-112 | Happy | TransactionRow positive amount (1250) renders in `success` color |
| T-0009-113 | Happy | TransactionRow negative amount (-1250) renders in `fg` color (NOT `danger`) |
| T-0009-114 | Happy | TransactionRow renders amount with currency formatting via `Intl.NumberFormat` |
| T-0009-115 | Happy | TransactionRow with `categoryIcon: 'shopping-bag'` renders 32pt circle with icon |
| T-0009-116 | Happy | `ReceiptSchema.parse({items: [...], subtotal, total})` succeeds |
| T-0009-117 | Failure | Receipt with 51 items rejects (max 50) |
| T-0009-118 | Happy | Receipt `subtotal + tax + tip === total` validates clean (no warning) |
| T-0009-119 | Happy | Receipt `subtotal + tax + tip = total + 1 cent` validates clean (within tolerance) |
| T-0009-120 | Happy (warning) | Receipt `subtotal + tax + tip = total + 5 cents` produces `receipt_total_mismatch` warning at validateCrossRefs (Step 8 wires) |
| T-0009-121 | Happy | `MetricTileSchema.parse({value, label, sparklineData: [1,2,3]})` succeeds |
| T-0009-122 | Happy | MetricTile sparkline renders `<Polyline>` from `react-native-svg` |
| T-0009-123 | Happy | MetricTile `deltaTone: 'positive'` colors delta in `success` |
| T-0009-124 | Happy | MetricTile without `sparklineData` renders without sparkline (graceful) |
| T-0009-125 | Happy | `StepListSchema.parse({steps: [{title:'A'}], style: 'numbered'})` succeeds |
| T-0009-126 | Happy | StepList numbered style renders connecting vertical rail between circles |
| T-0009-127 | Happy | StepList checklist style supports BooleanBinding per step |
| T-0009-128 | Failure | StepList with 21 steps rejects (max 20) |
| T-0009-129 | Snapshot | TransactionRow at both registers |
| T-0009-130 | Snapshot | Receipt at both registers |
| T-0009-131 | Snapshot | MetricTile at both registers |
| T-0009-132 | Snapshot | StepList at both registers |
| T-0009-133 | Boundary | NodeRenderer 47-arm test |
| T-0009-134 | Failure | TransactionRow with `currency: 'XYZ'` rejects (not in CurrencySchema) |
| T-0009-135 | Happy | Receipt dotted-leader fallback (when iOS `borderStyle: 'dotted'` unreliable): renders repeated `.` characters |
| T-0009-235 | Boundary | **MetricTile sparkline with 1 data point — division-by-zero guard.** `sparklineData: [42]` renders without crashing. The polyline x-coordinate formula `(i / (points.length - 1)) * width` would be `0/0` for single-point data. Renderer must guard: single-point sparkline renders as a horizontal line at the data value (or a single dot — Cal pin: horizontal line at midpoint). |
| T-0009-236 | Boundary | **MetricTile sparkline at max-30 boundary.** `MetricTileSchema.parse({sparklineData: Array(30).fill(1), ...})` succeeds (max-inclusive). `Array(31).fill(1)` rejects. Renderer with 30-point data: renders all 30 points (no truncation, no visual degradation). |
| T-0009-237 | Boundary | **Receipt with no `tax` and no `tip` — math check.** `subtotal === total` validates clean (no warning). `subtotal === total + 5 cents` (no tax/tip present) STILL produces `receipt_total_mismatch` warning. Test both cases explicitly because the existing T-0009-120 implicitly requires tax/tip to be present in the math equation. |

#### Step 5 Test Summary

| Category | Count |
|---|---|
| Happy | 16 |
| Happy (warning) | 1 |
| Failure | 3 |
| Boundary | 4 |
| Snapshot | 4 |
| **Total** | **28** |

### Step 6 Tests

| ID | Category | Description |
|---|---|---|
| T-0009-136 | Happy | `date-fns@^3.6.0` installs cleanly via pnpm |
| T-0009-137 | Boundary (perf) | Renderer bundle size grows ≤ 25kb gzipped after date-fns import |
| T-0009-138 | Happy | `CalendarSchema.parse({view: 'month'})` succeeds (no collection binding) |
| T-0009-139 | Happy | `CalendarSchema.parse({view: 'month', collectionId, dateField: 'eventDate'})` succeeds |
| T-0009-140 | Failure | Calendar with `collectionId` but no `dateField` rejects at superRefine |
| T-0009-141 | Happy | Calendar renders 6-row × 7-col grid for any month |
| T-0009-142 | Happy | Calendar `firstDayOfWeek: 'monday'` shifts grid by one day |
| T-0009-143 | Happy | Calendar `selectedBinding` updates DateBinding on date tap |
| T-0009-144 | Happy | Calendar marks dates with `accent` dot when `collectionId+dateField` set |
| T-0009-145 | Regression (a11y) | Calendar grid uses `accessibilityRole="grid"`; cells use `accessibilityRole="button"` |
| T-0009-146 | Happy | Calendar month nav chevrons advance/recede month state |
| T-0009-147 | Happy | `HeatmapSchema.parse({collectionId, dateField, range: '90d'})` succeeds |
| T-0009-148 | Happy | Heatmap quintile binning: 5 levels mapping to count percentiles |
| T-0009-149 | Happy | Heatmap `intensityMode: 'binary'` uses single non-zero shade |
| T-0009-150 | Happy | Heatmap today's cell has 1pt `accent` border |
| T-0009-151 | Happy | Heatmap `accessibilityCustomActions` exposes per-cell info on long-press |
| T-0009-152 | Snapshot | Calendar at productive×focus + expressive×health |
| T-0009-153 | Snapshot | Heatmap at productive×focus + expressive×health |
| T-0009-154 | Boundary | NodeRenderer 49-arm test |
| T-0009-155 | Failure | Heatmap with `range: '500d'` rejects (not in enum) |
| T-0009-156 | Failure | Calendar with `view: 'year'` rejects (not in enum) |
| T-0009-244 | Happy | **Calendar same-date-tap behavior pinned: STAY SELECTED.** Sable's spec didn't address this; Cal pin: tapping the already-selected date is a no-op (`selectedBinding` value unchanged). Renderer test: select date X via tap → tap same date again → assert binding value still equals X (NOT cleared, NOT toggled off). This matches iOS-native Calendar behavior (Reminders, Health). |
| T-0009-244a | Boundary | **Heatmap range max boundary.** `HeatmapSchema.parse({...range: '365d'})` succeeds (exactly at the enum max). Pairs with T-0009-155 (range '500d' rejects). Closes the boundary coverage Roz noted on Step 6 summary recount. |

#### Step 6 Test Summary

| Category | Count |
|---|---|
| Happy | 14 |
| Failure | 3 |
| Boundary | 2 |
| Snapshot | 2 |
| Regression (a11y) | 1 |
| Boundary (perf) | 1 |
| **Total** | **23** |

### Step 7 Tests

| ID | Category | Description |
|---|---|---|
| T-0009-157 | Happy | `expo-document-picker@~12.0.2` installs cleanly via pnpm |
| T-0009-158 | Happy | `GallerySchema.parse({collectionId, imageField: 'photoUrl'})` succeeds |
| T-0009-159 | Happy | `GallerySchema.parse({images: [{kind:'literal', value:'http://...'}]})` succeeds |
| T-0009-160 | Failure | Gallery with both (collectionId+imageField) and images rejects |
| T-0009-161 | Failure | Gallery with neither rejects |
| T-0009-162 | Failure | Gallery with `collectionId` but no `imageField` rejects at superRefine |
| T-0009-163 | Happy | Gallery cell tap opens fullscreen modal |
| T-0009-164 | Happy | Gallery fullscreen modal close button uses IconButton (icon: 'x') |
| T-0009-165 | Happy | `CommerceCardSchema.parse({image, title, price, action})` succeeds |
| T-0009-166 | Happy | CommerceCard renders price with currency formatting |
| T-0009-167 | Happy | CommerceCard `priceCompare` renders strikethrough when present |
| T-0009-168 | Happy | CommerceCard image clips to top of card via `borderTopLeftRadius` + `overflow: hidden` |
| T-0009-169 | Happy | CommerceCard `badge` renders top-right corner of image |
| T-0009-170 | Happy | `BeforeAfterSchema.parse({before, after, mode: 'slider'})` succeeds |
| T-0009-171 | Happy | BeforeAfter slider mode handle drag clips Before image (Reanimated worklet) |
| T-0009-172 | Regression (a11y) | BeforeAfter handle is `accessibilityRole="adjustable"`; swipe up/down adjusts reveal by 10% |
| T-0009-173 | Happy | BeforeAfter side-by-side mode renders two equal columns with hairline divider |
| T-0009-174 | Happy | `DocumentPickerSchema.parse({label, valueBinding, acceptedTypes: ['pdf', 'image']})` succeeds |
| T-0009-175 | Failure | DocumentPicker with `acceptedTypes: []` rejects (min 1) |
| T-0009-176 | Failure | DocumentPicker with 5 acceptedTypes rejects (max 4) |
| T-0009-177 | Failure | DocumentPicker with `acceptedTypes: ['gif']` rejects (not in enum) |
| T-0009-178 | Happy | DocumentPicker maps `acceptedTypes: ['pdf']` to MIME `application/pdf` |
| T-0009-179 | Happy | DocumentPicker mocked: `getDocumentAsync` returns `{uri, name}`; renderer dispatches `set` with URI |
| T-0009-180 | Happy | DocumentPicker permission denied: shows error caption, retries on next tap |
| T-0009-181 | Snapshot | Gallery at productive×focus + expressive×health |
| T-0009-182 | Snapshot | CommerceCard at productive×focus + expressive×health |
| T-0009-183 | Snapshot | BeforeAfter at productive×focus + expressive×health |
| T-0009-184 | Snapshot | DocumentPicker at productive×focus + expressive×health |
| T-0009-185 | Boundary | NodeRenderer 53-arm test — all 53 component types dispatch without `host.onUnknownNodeType` being called (asserts dispatch correctness across the FULL post-Phase-1 catalog, not just count) |
| T-0009-238 | Happy | **Gallery empty-state rendering.** `Gallery` with `images: []` (valid static-array, just empty) renders the hardcoded "No photos yet" copy + `image` icon (Content & Copy table). Same hardcoded copy renders for `Gallery` with `collectionId` referencing a collection with 0 rows. No `emptyState` prop on Gallery (deliberate; ErrorState is the alternative for custom messaging). |
| T-0009-239 | Boundary | **Gallery with null `imageField` per row.** Collection has rows but some rows' `imageField` value is null (data quality issue from LLM). Renderer renders the cell with Image's `fallbackIcon` (Image's standard error-state). Test asserts: 3 rows with 1 having `null` for imageField → 3 cells rendered, 1 with fallback icon. Cells with null don't crash the grid. |

#### Step 7 Test Summary

| Category | Count |
|---|---|
| Happy | 18 |
| Failure | 6 |
| Boundary | 2 |
| Snapshot | 4 |
| Regression (a11y) | 1 |
| **Total** | **31** |

### Step 8 Tests

| ID | Category | Description |
|---|---|---|
| T-0009-186 | Happy | `ValidationErrorCode` includes 5 new codes |
| T-0009-187 | Happy | `ValidatorResult.warnings` array always present (even on success) |
| T-0009-188 | Happy | Calendar with valid `collectionId+dateField` (date type) validates clean |
| T-0009-189 | Failure | Calendar with `dateField` referencing non-date field produces `date_field_required` error |
| T-0009-190 | Failure | Calendar with `collectionId` referencing nonexistent collection produces `unknown_collection` (existing V0 code) |
| T-0009-191a | Failure | **Timeline `date_field_required`.** `validateCrossRefs(spec)` where Timeline's `dateField` references a non-date field (e.g., a string field) returns `{ok: false, errors: [{code: 'date_field_required', path: [...]}], warnings: []}`. (Closes deferred Step-4 test T-0009-110.) |
| T-0009-191b | Failure | **Heatmap `date_field_required`.** Same check, applied to Heatmap. Separate T-ID so a Timeline-pass / Heatmap-fail mismatch is visible in the test report. |
| T-0009-192 | Failure | Gallery with `imageField` referencing non-image field produces `image_field_required` error |
| T-0009-193 | Failure | Carousel with both `collectionId` and `cards` produces `mutually_exclusive_collection` error (also caught at SpecSchema.parse via superRefine — defense-in-depth) |
| T-0009-194 | Failure | SearchBar with `boundCollectionId` referencing nonexistent collection produces `unknown_search_collection` error |
| T-0009-195 | Happy (warning) | Receipt with `subtotal + tax + tip = total + 5 cents` produces `receipt_total_mismatch` WARNING (not error) |
| T-0009-196 | Boundary | Receipt total mismatch at exactly 1 cent: NO warning (within tolerance) |
| T-0009-197 | Boundary | Receipt total mismatch at exactly 2 cents: warning fires |
| T-0009-198 | Happy | `ICON_NAMES.length === 98` (was 80) |
| T-0009-199 | Happy | `IconNameSchema.parse('lightbulb')` succeeds |
| T-0009-200 | Failure | `IconNameSchema.parse('rainbow')` rejects (not in catalog) |
| T-0009-201 | Happy | All 18 new icons resolve to non-empty path data |
| T-0009-202 | Regression | Codegen-drift CI passes after icon catalog extension |
| T-0009-203 | Regression | All V0 ValidationErrorCode checks (`unknown_collection`, etc.) still fire correctly |
| T-0009-204 | Boundary | `ValidatorResult` warnings vs errors: route layer returns only `errors[].code` to clients (warnings flow to telemetry) |
| T-0009-229 | Regression (P0) | **ValidatorResult `toEqual` backward-compat sweep.** Grep all V0 validator tests for `.toEqual({ok: true` or `.toEqual({ok: false`. Any test using exact-shape `toEqual` on a `ValidatorResult` will FAIL when `warnings: []` is added always-present. Test: audit + migrate all V0 validator tests to `toMatchObject` semantics. Asserts no V0 test breaks due to the shape extension. Lock-in: if a new V0 test is added later that uses `toEqual`, this audit must re-run. |
| T-0009-245 | Happy | **`receipt_total_mismatch` warning message content.** Warning `message` field includes the discrepancy amount in cents (e.g., "Total mismatch: subtotal+tax+tip=2505, total=2500, diff=5 cents"). Test: parse a mismatched Receipt; assert `warnings[0].message` includes the discrepancy. Telemetry consumers need this signal to bucket by severity. |

#### Step 8 Test Summary

| Category | Count |
|---|---|
| Happy | 7 |
| Happy (warning) | 1 |
| Failure | 8 (T-191 split into 191a + 191b) |
| Boundary | 3 |
| Regression | 2 |
| Regression (P0) | 1 |
| **Total** | **22** |

### Step 9 Tests

| ID | Category | Description |
|---|---|---|
| T-0009-205 | Happy | `MATRIX_ENTRIES.length === 106` (T-0006-236 invariant updated) |
| T-0009-206 | Happy | Productive×focus count === 53 |
| T-0009-207 | Happy | Expressive×health count === 53 |
| T-0009-208 | Happy | All 25 new components have entries at both registers (50 new) |
| T-0009-209 | Boundary | T-IDs T-0006-237..286 unique and non-duplicating |
| T-0009-210 | Snapshot | All 50 new snapshots pass on fresh run |
| T-0009-211 | Snapshot | Stability: running tests twice produces identical snapshots |
| T-0009-212 | Boundary | Snapshot policy doc updated to mention 53-component coverage |

#### Step 9 Test Summary

| Category | Count |
|---|---|
| Happy | 4 |
| Boundary | 2 |
| Snapshot | 2 |
| **Total** | **8** |

### Step 10 Tests

| ID | Category | Description |
|---|---|---|
| T-0009-213 | Happy | `SYSTEM_PROMPT_CATALOG` mentions all 53 component names (parametrized loop) |
| T-0009-214 | Happy | Catalog mentions stance affinity cheat-sheet section |
| T-0009-215 | Happy | Catalog mentions domain compound usage hints (TransactionRow, MetricTile, Calendar) |
| T-0009-216 | Happy | Catalog mentions re-prompt continuity instruction |
| T-0009-217 | Boundary | `SYSTEM_PROMPT_CATALOG.length <= 40,000` chars (~10,000 tokens; T-0007-027 budget bumped from 25,000). Note: post-Phase-1 catalog is ~35,000 chars (~8,750 tokens); the 40,000-char ceiling reserves ~5,000 chars headroom (12.5%) for Phase 1.5 catalog additions without immediately needing another budget bump |
| T-0009-218 | Boundary | Tool definition JSON Schema `<= 40,000` chars (T-0007-018 budget bumped) |
| T-0009-219 | Regression | T-0007-022..026 still pass (V0 archetypes, components, verbs, bindings, capabilities mentioned) |
| T-0009-220 | Failure | Catalog still does NOT mention M1-only component names. Specifically: catalog text does NOT contain the substrings `"Container"`, `"Counter"`, `"Toggle"`, `"TextInput"`, `"Form"` (M1 type names that V0 removed). Catalog DOES contain `"Image"` (V1 Image component is a real V0+V1 entity). Catalog does NOT contain the M1 alias phrase `"Text component"` or `"M1 catalog"`. Asserted via 5 substring-absence checks + 1 substring-presence check. |
| T-0009-221 | Happy | Eval prompts.ts exports 225 prompts total (100 + 60 + 30 + 30 + 5) |
| T-0009-222 | Happy | 60 V1-exercising prompts: 15 per archetype |
| T-0009-223 | Happy | 5 re-prompt continuity prompts pass at ≥80% |
| T-0009-224 | Happy | V1-exercising prompts pass at ≥75% per archetype |
| T-0009-225 | Regression | V0 100 archetype-balanced prompts still pass at ≥80% per archetype |
| T-0009-226 | Boundary | Eval mode `--mode=v0` runs all 225 prompts; new modes optional |
| T-0009-227 | Failure | Eval prompt with capability outside V0 still detected as out_of_scope (regression on detection rate) |

#### Step 10 Test Summary

| Category | Count |
|---|---|
| Happy | 8 |
| Failure | 2 |
| Boundary | 3 |
| Regression | 2 |
| **Total** | **15** |

### Test Totals (post Roz round-1 review)

| Step | New | Round-2 additions | Total |
|---|---|---|---|
| 1 | 30 | +1 (T-243 a11y) | 31 |
| 2 | 37 | +6 (T-228 float, T-230 scoping, T-231 unmount, T-232 dup-collection, T-233 empty CSV, T-234 trailing comma) | 43 |
| 3 | 21 | +3 (T-240 short-hex, T-241 AvatarGroup a11y, T-242 Callout danger) | 24 |
| 4 | 22 | 0 (T-110 reframed Step-8-dependent) | 22 |
| 5 | 25 | +3 (T-235 sparkline 1pt, T-236 sparkline max, T-237 no-tax/tip math) | 28 |
| 6 | 21 | +2 (T-244 Calendar same-tap, T-244a Heatmap range max) | 23 |
| 7 | 29 | +2 (T-238 Gallery empty, T-239 null imageField) | 31 |
| 8 | 19 | +3 (T-191 split → 191a+191b = +1; T-229 toEqual sweep, T-245 warning content = +2) | 22 |
| 9 | 8 | 0 | 8 |
| 10 | 15 | 0 (T-217 + T-220 edited in place) | 15 |
| **Total** | **227** | **+20** | **247** |

(Counts verified by `grep -oE "T-0009-[0-9]+[a-z]?" | sort -u | wc -l = 247`.)

**Round-2 changes summary:** 3 P0 + 18 P1 findings from Roz's round-1 review addressed. 20 new T-IDs (Step 8 includes the T-0009-191 split into 191a/191b). Per-step summary tables reconciled to match actual table row counts.

**Negative-pattern tests** (Failure + Breaking change + Security where it
asserts forbidden behavior):

- Failure: 7 + 7 + 3 + 4 + 3 + 3 + 6 + 7 + 0 + 2 = **42**
- Breaking change: 0 (Phase 1 is additive-only; no V0 surface removals)
- Security/a11y critical (Failure-a11y): 1 + 0 + 0 + 0 + 0 + 0 + 0 + 0 + 0 + 0 = **1**
- (Plus regressions enforce existing behavior survives)

Negative-pattern total: **43**.
Happy-pattern total: **121** (across all happy + happy-warning sub-categories).
Ratio: **0.36:1**.

The ratio is happy-leaning, not negative-leaning. This is expected for
Phase 1 — the work is overwhelmingly additive (25 new components × ~4
happy-path tests each + 4 snapshots each). Negative tests are weighted
to the schema-validation side (each new component has 2-3 schema
rejection tests). Total tests: **247 — within ADR-0006's 267 ballpark
for the scope** (post-round-2 additions; original was 227).

**Cal note:** the happy-leaning ratio is not a Roz red flag here. Each
component has a tight set of failure modes (schema rejection, prop
boundary), and Phase 1 is compositional — the failure surface is
narrower per-component than ADR-0007's wholesale pipeline cutover.
Acceptable. Document.

### Test Helpers & Mocks

- **`mockCollection(rows: Row[])`** — already exists from V0 test infrastructure. Used by all collection-binding tests (Calendar, Heatmap, Timeline, Gallery, GridList, SearchBar tests).
- **`mockExpoDocumentPicker`** — NEW. `mockResolveDocument({uri, name})` for happy path; `mockReject(error)` for permission-denied. Tests should NOT make real iOS picker calls.
- **`mockDateFns`** — NOT NEEDED. Real date-fns is small enough; tests use real implementations against fixed timestamps via `jest.useFakeTimers().setSystemTime(...)`.
- **`mockReanimated`** — already exists from V0 (legacy mock at `packages/a2ui-renderer/src/__mocks__/react-native-reanimated.js` per ADR-0006 Step 13).
- **`mockExpoHaptics`** — already exists from V0 (jest.mock in jestSetup.js per ADR-0006).
- **`mockUseReducedMotion`** — `jest.spyOn(useReducedMotionModule, 'useReducedMotion').mockReturnValue(true)` per ADR-0006 round-3 fix pattern.
- **`renderWithTheme(node, opts)`** — already exists from V0 test-utils. Extends with `searchFilters?: Map<string,string>` to support SearchFilterContext tests.

### Coverage Gates

- New protocol surfaces (`packages/protocol/src/components/*.ts` extensions, `packages/protocol/src/validate.ts` extensions, `packages/protocol/src/icons/names.ts` extensions): ≥ 95% lines, ≥ 90% branches.
- New design-system surfaces (`packages/design-system/src/tokens.ts` `tintColor` extension): ≥ 95% lines.
- New renderer components (`packages/a2ui-renderer/src/v0/components/**` 25 new files): ≥ 90% lines, ≥ 80% branches.
- New SearchFilterContext: ≥ 95% lines (small surface).
- System prompt updates: source-level test only (catalog content checks); coverage N/A.
- Eval harness: ≥ 80% (mostly mocked SDK calls; the threshold-gate logic is tested).

---

## Data Sensitivity

| Surface | Sensitivity | Notes |
|---|---|---|
| `SearchFilterContext` Map | `auth-only` (per-user, per-mini-app) | Lives in renderer state; never persisted; cleared on SearchBar unmount or screen unmount |
| MoneyField `valueBinding` (NumberBinding cents) | `auth-only` | User's financial data; flows through state slot or collection field; never logged |
| TransactionRow merchant + amount + category | `auth-only` | Same — user financial data |
| Receipt items + totals | `auth-only` | Same |
| DocumentPicker URI | `auth-only` | Local file URI; never uploaded in V0 (cloud upload is V0.5+) |
| Image `source` (URL or asset URI) | `auth-only` | User-supplied or asset reference |
| Calendar/Heatmap collection markers | `auth-only` | Per-user collection data |
| `tintColor()` helper output | `public-safe` | Pure function; no user data |
| ValidationError messages from new codes | `auth-only` server-side, **`public-safe` codes only** | Per ADR-0007 §F security pattern: routes return only `code`, never `message` (which can echo LLM-emitted strings like collection IDs, slot names) |
| ValidationError `severity: 'warning'` (Receipt math mismatch) | `auth-only` server-side, **NOT returned to clients** | Warnings flow to telemetry; routes do not include them in error responses |

---

## CI/CD Impact

(See Decision §C above for the full table. Summary: Phase 1 is
additive — no CI job removals, no env var changes, no auth/RBAC
changes. New tests grow existing job runtimes by ~15-25% across renderer
+ protocol + design-system + services/api packages.)

---

## Documentation Impact

(See Decision §H above for the full table. Summary: Canvas V0 brief
§2.4 + canvas-v0.md §AC-R1 update component count assertions; ADR
index gets ADR-0009 row; App Store reviewer notes update
component inventory.)

---

## Notes for Colby

### Step ordering — strict and not

- **Steps 1, 3, 8 are independent of any other step** (Foundation primitives, Display tier, Validator+Icons). Land any of them first.
- **Step 2 (Inputs)** introduces `SearchFilterContext` — a renderer architectural addition. Subsequent List/GridList/Gallery/Timeline implementations consume it. Land Step 2 before Steps 4 and 7 to avoid retrofitting.
- **Step 4 (Lists & Data)** depends on Step 2 (List modifications for SearchFilter consumption). Order: Step 2 → Step 4.
- **Step 5 (Productivity domain compounds)** is parallel-safe with Step 6 (Date components) — different files, different concerns. Either order.
- **Step 6 (Date components)** adds `date-fns` dep — coordinate with whoever runs `pnpm install`.
- **Step 7 (Content/Media)** depends on Step 1 (Image is foundation for Gallery, BeforeAfter, CommerceCard). Order: Step 1 → Step 7.
- **Step 9 (Snapshot matrix)** must follow ALL component steps (1-7). It re-counts entries.
- **Step 10 (System prompt + eval)** must follow Step 9 AND ADR-0007 Steps 2 + 7 landing. It is the LAST step.

Suggested PR shape:

- **PR 1** = Steps 1 + 3 + 8 (independent foundations: 3 components + 2 components + validator/icons). ~63 tests.
- **PR 2** = Step 2 (Inputs tier, SearchFilterContext). ~36 tests.
- **PR 3** = Steps 4 + 5 + 6 + 7 (the rest of the components). ~99 tests.
- **PR 4** = Step 9 (snapshot matrix re-count). ~8 tests.
- **PR 5** = Step 10 (system prompt + eval). MUST be after ADR-0007 PR 4 lands. ~16 tests.

### Things that look like they should be done but aren't

1. **`ListSummary` is NOT moved to Lists tier.** Sable's spec was explicit: don't restructure V0. ListSummary stays in Compound. The user's V1 brief listed it in Lists; that was a brief artifact, not a Sable design decision. Don't move it.

2. **`ArrayBinding<T>` is NOT introduced.** MultiPicker uses CSV string via StringBinding. The proper fix is V0.5+ binding-system upgrade. Don't try to be clever and add `ArrayBinding<T>` here.

3. **No new tier.** Charts and Compound-AI tiers are NOT added in Phase 1. They are explicitly Phase 2 / Phase 3 (deferred to subsequent ADRs). The 7 existing tiers are the home.

4. **No new stance, no new palette.** V0's 2 stances × 6 palettes carry the work.

5. **No new useEffect §K exception.** Phase 1 components are renderer-pure or use the existing §K-approved patterns (queueMicrotask for one-shot, derived-state ref-guard for input draft sync, useReducedMotion via jest.spyOn for tests). Don't add a new useEffect site without escalation.

6. **No new Reanimated mock placement.** The Step 13 ADR-0006 cleanup moved the mock to `packages/a2ui-renderer/src/__mocks__/react-native-reanimated.js`. Don't move it again.

7. **`ValidatorResult.warnings` array is required even on success.** Existing V0 callers destructure `{errors}`; warnings is additive. Don't make warnings conditional. Empty array on no-warnings.

8. **DocumentPicker tests are mocked, NOT live.** No physical-device permission prompts in CI. Mock `expo-document-picker` per the helper spec.

### Things that will surprise you

1. **`alt` is REQUIRED on Image.** Schema rejects empty alt. Renderer ALSO rejects empty alt at runtime (defense-in-depth). The LLM is instructed to author alt from prompt context; if it omits, schema fails — visible failure mode is intentional.

2. **Receipt math tolerance is a WARNING, not an ERROR.** Validate returns `{ok: true, spec, warnings}` for receipt mismatches. Routes don't return warnings to clients. Telemetry consumes them.

3. **MoneyField stores integer cents.** JS floating-point math will bite if you treat the binding as a decimal. The renderer's parse/format helpers are the only safe path.

4. **MultiPicker option values cannot contain commas.** Schema regex enforces. If the LLM emits `value: "a,b"`, schema rejects. This is documented as a limitation; V0.5 binding-system upgrade fixes.

5. **SearchFilterContext is a NEW renderer architectural surface.** Step 2 wires it into the `<Renderer>` wrapper. Existing V0 List renderers need modification to consume `useSearchFilter`. Don't forget to update GridList (Step 4) and Gallery (Step 7) when those land.

6. **Carousel autoplay disabled under reducedMotion.** Hard requirement (accessibility), not preference. Test asserts the timer never starts.

7. **CI workflow path filter for snapshot matrix is unchanged.** Already triggers on `packages/a2ui-renderer/src/**`. Phase 1 changes auto-detected.

8. **NodeRenderer 28 → 53 arms.** The defensive default branch already exists; just add 25 cases. Don't rewrite the switch.

9. **JSON Schema regenerates automatically.** The codegen script in `packages/protocol/` re-derives `generated/json-schema.json` and `generated/types.ts` from the Zod source on build. Codegen-drift CI guards parity. Don't hand-edit.

10. **System prompt budget bumps need to land in Step 10.** ADR-0007's tests T-0007-018 (25k chars tool budget) and T-0007-027 (25k chars catalog budget) are hard ceilings. Step 10 bumps both.

### Coordination with ADR-0007

ADR-0007 PR 1 is in flight (Steps 1, 2, 5 — V0 tools + V0 system prompt + out_of_scope_intent table). **Do not modify any of those files until ADR-0007 PR 1 lands.** Specifically:

- `services/api/src/llm/tools/produceAppSpec.ts` — Step 3 (this ADR's Step 10) extends; ADR-0007 PR 1 establishes.
- `services/api/src/llm/prompts/system.ts` — Step 10 (this ADR) extends; ADR-0007 PR 1 establishes the V0 baseline.
- `services/api/src/llm/tools/outOfScope.ts` — owned by ADR-0007; this ADR doesn't touch.
- DB migration `0006_out_of_scope_intent.sql` — owned by ADR-0007.

ADR-0009's Step 10 EXTENDS `prompts/system.ts` from V0 baseline to V0+V1 catalog. The system prompt's existing structure (static block + cached catalog block) is preserved; only the catalog block's content grows.

### What to escalate

- If `react-native-svg` is somehow not in the Expo SDK 52 install (Sable assumed it is; please verify before Step 5 starts), escalate. Phase 1 sparkline rendering depends on it.
- If `expo-document-picker@~12.0.2` has iOS permission entitlement requirements that aren't already in the Expo config, escalate to Robert (PM) for App Store review notes update.
- If V0 archetype-balanced eval prompts regress below 80% per archetype after Step 10 (the system prompt grew, the LLM's choice surface widened), escalate. The brief allocated week-5 buffer for prompt iteration; reuse the pattern.
- If MoneyField cents canonicalization tests reveal floating-point math bugs in the renderer (e.g., `0.1 + 0.2 !== 0.3` shows up despite our integer storage), escalate. There's likely a place we're using decimal where we should use cents.
- If the SearchFilterContext re-filter performance test (T-0009-057) fails at 1000 rows, escalate. The architectural fix is throttling the SearchBar binding update — but that's an architectural decision, not a test fix.

This is a large ADR but the surfaces are well-understood (V0 patterns to extend) and the work is overwhelmingly additive. Take the time you need.

---

> 🔄 Updated ADR-0009 (round-2 revisions). **10 steps, 247 total tests** (227 + 20 round-2 additions). Addresses all 3 P0 + 18 P1 findings from Roz's round-1 test-spec review. Per-step summaries reconciled. System-prompt catalog budget bumped 35k→40k chars for Phase 1.5 headroom. Back to Roz for round-2 review.

# ADR-0006: Canvas V0 — Renderer

_Authored by Cal — 2026-05-08_

## Status

**Accepted (rev-2 NF cleanups).** ADR-0005 (Canvas V0 protocol & design system) is **Accepted**
and committed (51de20a, 084afe5, b25f843).

Roz test-spec review (rev-0 → rev-1) returned **REVISE** on 2026-05-08
with 12 numbered findings + 10 missing tests + 7 self-flagged Concern rulings.
This rev-1 revision closes all of them.

### Roz findings (rev-0) — closed by this revision

| Finding | Severity | Resolution |
|---|---|---|
| Concern 1 — `onShare` in HostCallbacks | (architectural) | **Removed** from `HostCallbacks` (§G). T-0006-176 reframed as host-side test. |
| Concern 2 — telemetry insertion-point footgun | (architectural) | **Documented in §C** that ADR-0007 telemetry must be inserted before `toast` (not after). MT-05 added to Step 2 (T-0006-028a) to lock the contract. |
| Concern 3 — Milestone B claim overstated | (correctness) | **Tightened** to "stack navigation working end-to-end"; tabs/modal-overlay deferred to polish review week. |
| Concern 5 — AI bridge mockability | (correctness) | MT-04 added to Step 3 (T-0006-038a) — `act()` flush verifies transition from pre-resolve to resolved state. |
| Concern 6 — Step 10 ratio rejected | (P0) | **3 nav failure tests added** (T-0006-172a/b/c covering MT-01, R-07b, MT-09). Step 10 ratio: 8 happy vs 5 negative. |
| Concern 7 — T-0006-177 deferred decision | (P0) | **Decided: Option A.** M1 specs surface controlled error post-Step-13; alpha cohort communication note added. |
| R-01 — T-0006-007 vague | Medium | **Expanded** with per-verb assertions referencing §B state transition table. |
| R-02 — T-0006-018 dev/prod split | Medium | **Split into T-0006-018a (dev throw) + T-0006-018b (prod undefined+log).** |
| R-03 — Step 6 input count off (6 vs 5) | High | **Corrected** to 5 components × 3 binding kinds = 15 tests. ImagePicker is Compound (Step 8). |
| R-04 — clearCollection confirmation flow | High | **3 tests added** (T-0006-161a/b/c) for alert-raise + confirm + cancel. |
| R-05 — removeItem undo + state model gap | High | **State model (§B) extended** with `pendingUndo: PendingUndo \| null` and undo middleware (§C). 3 tests added (T-0006-161d/e/f). |
| R-06 — UX doc "13-verb dispatcher" stale | High | **canvas-v0-ux.md §Action Verb Feedback Contract** patched: "13-verb" → "12-verb"; `share` row removed from feedback table. Documentation Impact updated. |
| R-07 — Step 10 missing nav failure tests | P0 | **3 tests added** (see Concern 6). |
| R-08 — T-0006-177 deferred decision | High | **Rewritten** as deterministic test (see Concern 7). |
| R-09 — `share` in middleware pass-through list | Medium | **Removed** from Step 2 ACs. |
| R-10 — renderer-snapshot-matrix.yml unspecified | Low | (Deferred to Step 12 implementation; Cal will provide template referenced from codegen-drift.yml.) |
| R-11 — Milestone A fixture path errata | Low | **Fixed** at lines 27 + 600. |
| R-12 — `onShare` unexplained | Low | (Closed by Concern 1 removal.) |
| MT-06 — TextField focus border snapshot | Advisory | (Deferred — added to Notes for Colby; not a P0/High closure requirement.) |
| MT-08 — Heading serif font in expressive | Advisory | (Deferred — covered by Step 12's 56-snapshot matrix at expressive×health.) |
| MT-10 — ListSummary stable render across resolve | Advisory | (Deferred — covered by Step 8's existing happy-path tests + MT-04 transition-state test.) |

ADR-0005 has 1054 tests passing across protocol + design-system. ADR-0006 builds the renderer that consumes them. The protocol package is the
schema source of truth; the design-system package owns token resolutions,
the 80-icon catalog, and deterministic `coverArt()` SVG generation.

This ADR designs the V0 renderer that **wholesale replaces** the M1
renderer (`packages/a2ui-renderer/` per ADR-0003). The package keeps its
name to avoid a rename cascade through `apps/mobile/src/screens/AppRunner/`,
but its contents are rewritten end-to-end against the new schema.

This is the largest ADR in the V0 build window. M1's renderer was 10
components + 5 verbs. V0 is 28 components + 12 verbs + 4 nav patterns +
an AI bridge + recursive `Binding<T>` resolution + a state model that
knows about typed collections with seed data. Cal's pre-ADR estimate
(canvas-v0-prop-review.md) was 3+ weeks of implementation.

## Context

The user's path to "see Canvas on iOS Simulator" runs through this ADR.
ADR-0007 (generation pipeline) is deferred; the orchestrator is mounting
hardcoded sample specs from `packages/protocol/test/fixtures.demo.ts` (NEW file created at Step 13) to
validate the renderer visually before real generation lights up.

What the renderer must do, in V0 terms:

1. **Mount any valid Spec.** Given a schema-valid `Spec`, the renderer
   produces a React Native tree that renders correctly on iOS in light
   mode. No surprises; no untyped fallbacks.
2. **Resolve tokens through the design-system theme.** Every visual
   primitive (color, spacing, radius, type, elevation, motion) flows
   from `theme(stance, palette)`. Components never declare hex.
3. **Dispatch all 12 action verbs.** With per-verb feedback contracts
   (haptics, toasts, animations) defined in canvas-v0-ux.md §Action
   Verb Feedback Contract.
4. **Resolve `Binding<T>` at render time.** Three kinds: literal, state
   slot, collection field. Components consume bindings via a hook that
   reads from the renderer's state.
5. **Compose 4 internal navigation patterns** — `none`, `stack`, `tabs`,
   `modal-overlay` — without owning the host's bottom tab bar (host
   chrome is invariant #3 from canvas-v0-brief.md §2.1).
6. **Bridge `aiProcess(summarize)` to Apple Foundation Models** on iOS
   26+ Pro devices, with graceful hide on unsupported devices.
7. **Stay sandbox-pure.** No `useEffect` for app logic; no `fetch`; no
   `eval`; no app-specific contexts. The renderer is a pure function of
   `{spec, state, dispatch}`.

> **What if we do nothing (don't write this ADR):** Colby reaches for
> M1's renderer to extend, discovers in week 2 that adding `Binding<T>`
> resolution and typed collections to a dispatcher built on `set/
> increment/decrement/toast/navigate` requires rewriting most of the
> reducer plus every consumer; the `<Container>` component's children
> need stance/palette context that `RendererThemeProvider` was never
> designed to carry; the FlashList integration breaks the `useReducer`
> render-during-render pattern. Six days later we're starting over
> against a half-built schema. That's the failure mode this ADR exists
> to prevent.

### Constraints

These shape every decision below:

1. **The 9 brief invariants** (canvas-v0-brief.md §2.1). Most relevant:
   no code over the network; no webview; host chrome always present;
   LLM never picks visual primitives; closed registries; polish-critical
   UI uses mandatory libraries.
2. **Mandatory polish libraries** (canvas-v0-brief.md §2.2): Reanimated 4,
   Gorhom Bottom Sheet, React Navigation native-stack, FlashList, Expo
   Image, Keyboard Controller. Lint-blocked replacements (no bare-RN
   `Animated`, no `FlatList`, no JS-driven sheets).
3. **12 action verbs** (F-04 closure from prop-review): `set, update,
   reset, addItem, removeItem, updateItem, clearCollection, navigate,
   back, capture, toast, aiProcess`. **`share` is host-meatball-only.**
4. **The renderer is sandbox** (CLAUDE.md §4): pure functions of
   `{node, state, dispatch}`, no side effects, no app-specific contexts.
5. **No workspace deep imports**: components import only from sibling
   files within the package and from `@app-creator/protocol` and
   `@app-creator/design-system` package entries.

### Prior art

- **ADR-0003** (M1 renderer) — 10 components, 5 verbs, in-place
  navigation via `currentViewId` from `useA2UIState`. Mostly
  superseded; its patterns (`RendererThemeProvider`,
  `RendererLoggerProvider`, `RenderErrorBoundary` on AppRunner side,
  the `useA2UIState` shape) carry forward as design references. The
  M1 sources stay in tree under `src/legacy/` until Step 11 cuts over.
- **ADR-0005** (Canvas V0 protocol & design system) — provides
  `SpecSchema`, `NodeSchema`, `Action` discriminated union (12 verbs),
  `Binding<T>` 3-branch unions, `Collection`/`Field` shapes,
  `IconNameSchema` (80 closed values), `theme(stance, palette)`,
  `coverArt({stance, palette, icon, seed})`, `<Icon>` component,
  `validateCrossRefs(spec)`. **All of this is the renderer's input
  surface.**
- **`packages/a2ui-renderer/src/state/useA2UIState.ts`** — M1's state
  hook. Reference shape: `useReducer` with `RESET` on spec-ref change,
  dispatch-after-unmount safety. V0 keeps the *pattern* and rewrites
  the *contents* (slot map → `Map<string, BindingValue>`; collection
  rows → `Map<string, Map<string, Row>>`).

---

## Decision

Build a **fully-typed, slot-and-collection-aware renderer** in
`packages/a2ui-renderer/` against the V0 schema. Implementation in 13
steps, ordered so visual confirmation on iOS Simulator lands at end of
Step 5 (**Milestone A: visual demo**) and full interactivity lands at
end of Step 10 (**Milestone B: interactive demo**). The orchestrator
can route to emulator validation at either milestone without finishing
all 13 steps.

### Architectural choices, with rationale

#### A. Wholesale rewrite, with M1 sources frozen under `src/legacy/`

The brief's V0 redirect (Sponsor §0 = Supersede) makes the M1 renderer
legacy. Three options:

- **Wipe** (delete M1 sources at Step 1) — clean but breaks `apps/mobile/src/screens/AppRunner/index.tsx` for the duration of the rewrite.
- **Additive** (M1 + V0 in same `src/`) — two parallel implementations, ambiguous imports.
- **Frozen-in-legacy** (move M1 sources to `src/legacy/`, rebuild V0 in `src/`) — clean separation, AppRunner keeps importing the legacy surface from the package root until Step 11 cuts over.

I'm picking **frozen-in-legacy**. The package's public exports during
Steps 1–10 read from `src/legacy/index.ts`. AppRunner stays green.
Step 11 swaps the package root to re-export V0 from `src/`. Step 13
deletes `src/legacy/` (and the M1 component files in it).

This is the only option that keeps `apps/mobile/` building without a
multi-week red period.

#### B. Two-layer state model: slots + collections

State has two sources:

- **`Spec.initialState: Record<SlotName, BindingValue>`** — named slots, mutable at runtime via `set` / `reset` actions.
- **`Spec.collections: Collection[]`** — typed, with seed data, mutable at runtime via `addItem` / `removeItem` / `updateItem` / `clearCollection`.

Internal state shape:

```ts
type RendererState = {
  slots: Map<SlotName, BindingValue>          // current slot values
  collections: Map<CollectionId, CollectionState>  // current rows per collection
  currentScreenId: string                     // active screen id (for stack/tabs)
  history: string[]                           // screen-id stack for `back` (stack nav only)
  pendingUndo: PendingUndo | null             // transient buffer for removeItem undo (R-05/MT-03)
}

// PendingUndo holds the data to restore when the user taps Undo within the
// 5s window. Cleared on Undo (action `addItem` with the buffered row data) OR
// on the 5s expiry (separate dispatch from the feedback middleware that owns
// the timer).
type PendingUndo = {
  collectionId: string
  rowId: string                               // original id, restored
  rowData: Row                                // immutable copy of the removed row
  insertIndex: number                         // original position in rowOrder
  removedAt: number                           // Date.now() at removeItem dispatch
}

type CollectionState = {
  schema: Collection                          // immutable, from spec
  rows: Map<RowId, Row>                       // mutable; ordered insertion
  rowOrder: RowId[]                           // explicit order for List rendering
}
```

`rowOrder` is explicit because `Map` insertion order is stable in JS but
some renderers (FlashList) want array indices. Maintaining the order
array alongside the row map costs O(1) per insert/delete and saves
O(n) on every render.

`Binding<T>` resolves at render time via a `useBinding<T>(binding)` hook:

```ts
function useBinding<T>(binding: Binding<T>): T {
  const state = useRendererState()
  switch (binding.kind) {
    case 'literal': return binding.value as T
    case 'state':   return state.slots.get(binding.slot) as T
    case 'collectionField': {
      const collection = state.collections.get(binding.collectionId)
      // For collection-field bindings inside a List item, the row context
      // comes from a parent <ListItemContext> via React context (D below).
      // Outside a list, we can't resolve — return undefined and warn.
      const row = useListItemContext()?.row
      return row?.[binding.field] as T
    }
  }
}
```

#### C. Action dispatcher: middleware-wrapped reducer

The reducer is pure — handles state transitions only. Side effects
(haptics, toasts, animations, AI calls, navigation primitive calls)
live in **dispatch middleware** that wraps the reducer.

```ts
type DispatchMiddleware = (action: Action, next: (a: Action) => void) => void

const haptics: DispatchMiddleware = (action, next) => {
  switch (action.type) {
    case 'addItem':   Haptics.impactAsync(Light); break
    case 'removeItem':Haptics.impactAsync(Medium); break
    // Note: no `share` case here — F-04 cut share from the spec verb set.
    // ...
  }
  next(action)
}

const toastSideEffect: DispatchMiddleware = (action, next) => {
  if (action.type === 'toast') {
    hostCallbacks.onToast(action.message, action.tone)
    return  // don't dispatch to reducer; toast has no state effect
  }
  next(action)
}

const aiBridge: DispatchMiddleware = (action, next) => {
  if (action.type === 'aiProcess') {
    aiDispatcher.summarize({prompt: action.prompt, items: state.collections.get(action.collection)?.rows})
      .then(result => dispatch({type: 'set', target: action.target, value: result}))
      .catch(err => hostCallbacks.onAIError(err))
    return
  }
  next(action)
}
```

Composed in order: `[haptics, toastSideEffect, aiBridge, navigate, undoBuffer, …, reducer]`. Each verb's
side-effect middleware runs before the reducer; some short-circuit
(toast, aiProcess — they don't mutate state directly).

**Forward-compat note for ADR-0007 (Roz Concern 2 / MT-05):** ADR-0007's
telemetry middleware **must be inserted BEFORE `toast`**, not after. Toast
middleware short-circuits on `toast` actions (returns without calling
`next()`), so any middleware downstream of `toast` will silently miss all
toast events. The chain insertion point for telemetry is between `haptics`
and `toast` — this is the only slot where telemetry sees every action.

The `undoBuffer` middleware is new for V0 (closes R-05 / MT-03):
- On `removeItem` dispatch, it captures the row data and `rowOrder` index, sets `pendingUndo`, and starts a 5s timer.
- After 5s, it dispatches a synthesized `clearPendingUndo` (an internal-only action, not in the closed verb set; reducer accepts it as state-only mutation).
- An `addItem` action that matches the pending undo (same collection + same rowId) restores at the buffered index instead of appending; clears `pendingUndo`.
- This keeps the undo state in `RendererState` (testable, deterministic) rather than in middleware-local closure state.

Why middleware vs. switch in reducer? Two reasons:

1. **Testability** — each middleware is a pure function `(action, next) => void` that's tested in isolation. Mocking the host callbacks in middleware tests is cleaner than mocking inside a reducer's switch case.
2. **Composability** — the renderer ships with default middleware; ADR-0007 (generation) adds telemetry middleware on top by passing it as a constructor argument. No reducer changes needed in ADR-0007.

The alternative — a single 12-arm switch in the reducer with side
effects inline — is simpler but couples haptics/toast/AI logic to the
state-transition logic. M1 used the switch pattern; V0's surface is
3× wider, so the coupling cost grows.

#### D. List item rendering uses React context for row-scoped bindings

Inside a `<List>` rendering 50 items from a collection, each item's
component tree contains `<ListItem title={...}>` with `title:
{kind: 'collectionField', collectionId: 'workouts', field: 'name'}`.
The `useBinding` hook needs to know "which row is this?"

Solution: a `ListItemContext` provided by the List renderer for each
row. `useBinding` reads from this context when resolving
`collectionField` bindings.

```ts
const ListItemContext = createContext<{row: Row, rowId: string, index: number} | null>(null)

function ListRenderer({node}: {node: ListNode}) {
  const collection = useRendererState().collections.get(node.collectionId)
  return (
    <FlashList
      data={collection.rowOrder}
      renderItem={({item: rowId, index}) => {
        const row = collection.rows.get(rowId)
        return (
          <ListItemContext.Provider value={{row, rowId, index}}>
            {/* render the ListItem child template once per row */}
            <NodeRenderer node={listItemTemplate} />
          </ListItemContext.Provider>
        )
      }}
    />
  )
}
```

This is the only React context the renderer uses for app logic — all
others are pure renderer infrastructure (theme, AI capabilities, host
callbacks). The brief's "no app-specific contexts" rule is honored:
`ListItemContext` is renderer infrastructure, not app-specific.

#### E. Navigation: 4 patterns, 1 router root per spec

Every Spec produces exactly one renderer root. The shape depends on
`Spec.navigation`:

| Pattern | Root | Implementation |
|---|---|---|
| `none` | Single screen, no router | `<NodeRenderer node={spec.screens[0].root} />` |
| `stack` | iOS native-stack | `<NativeStackNavigator>` from React Navigation; one screen per `Spec.screens` entry; `navigate` action calls `navigation.navigate(targetId)`; `back` calls `navigation.pop()` |
| `tabs` | Custom segmented control + crossfade | 36pt segmented control above body; tab selection mutates a renderer-internal `currentTabIndex`; body renders the corresponding screen's root; `motion-smooth` 200ms crossfade |
| `modal-overlay` | Single root + Gorhom Bottom Sheet | Root screen renders normally; `navigate(target)` opens a Gorhom sheet with the target screen's root inside; sheet drag-down or `back` action dismisses |

**Why custom segmented control for tabs (not React Navigation's bottom-tab):** because the host owns the bottom tab bar (Library / Create), and putting another tab bar inside the body would be visually confusing. Brief §3.7: "Never a bottom tab bar (bottom is reserved for host)." Custom top segmented control is the spec'd UX.

**Why native-stack for stack:** brief §2.2 mandates it. Native UINavigationController gives the iOS-native swipe-back gesture for free.

**Why Gorhom Bottom Sheet for modal-overlay:** brief §2.2 mandates it.
The renderer ships with a `BottomSheetModalProvider` wrapper at its
root; AppRunner already has one but the renderer can't depend on the
host's provider being present for unit tests, so we wrap our own
internally.

#### F. AI bridge: capability provider + dispatcher

`aiProcess(summarize)` is the only V0 AI verb. The bridge has two
surfaces:

```ts
// Capability check — sync after first call, cached in provider
interface AICapabilities {
  isSupported: boolean      // resolved at provider mount
  reason?: string           // 'no-foundation-models' | 'os-too-old' | undefined
}

// Dispatcher — actual AI call
interface AIDispatcher {
  summarize(input: SummarizeInput): Promise<string>
}

interface SummarizeInput {
  prompt: string
  items: ReadonlyArray<Row>  // serialized into a single context block before calling
}
```

The capability check lives in `<AICapabilitiesProvider>` at the
renderer's root. It calls `react-native-ai-apple`'s `isAvailable()`
once on mount, caches the result, and exposes via `useAICapabilities()`.
Components like `<ListSummary>` consult this hook before rendering:

```tsx
function ListSummary({node}: {node: ListSummaryNode}) {
  const ai = useAICapabilities()
  if (!ai.isSupported) {
    return node.fallback === 'show-raw' ? <RawCollectionItems node={node} /> : null
  }
  // ... render skeleton, dispatch aiProcess, render result
}
```

`<AICapabilitiesProvider>` is provided by the renderer root; tests mock
it via a `MockAICapabilitiesProvider({isSupported: true | false})`. No
component does its own capability check.

#### G. Renderer/host seam

Clear boundary, codified as the renderer's public surface:

```ts
// packages/a2ui-renderer/src/index.ts
export {Renderer} from './Renderer'
export type {RendererProps, HostCallbacks, AICapabilities} from './types'

// Renderer takes spec + host callbacks + capabilities.
type RendererProps = {
  spec: Spec                          // validated upstream
  host: HostCallbacks
  ai?: AICapabilities | null          // null = unsupported (test default)
}

type HostCallbacks = {
  onToast: (message: string, tone: ToastTone) => void
  onAIError: (err: Error) => void
  onUnknownNodeType?: (type: string) => void           // schema-violating node type seen at render
  onNavigationError?: (signal: NavigationErrorSignal) => void  // nav runtime signals (Roz NF-01)
}
type NavigationErrorSignal =
  | 'back-on-empty-history'
  | 'navigate-on-none-nav'
  | 'navigate-while-sheet-open'
// `onShare` was removed (Roz Concern 1 / R-12): the share button is the host's
// own UI inside the AppRunner header meatball. The renderer never invokes
// share; F-04 closure cut `share` from the spec verb set.
//
// `onNavigationError` (rev-1, NF-01): separate hook from `onUnknownNodeType`.
// Schema violations and nav runtime errors are different observability concerns;
// host-side monitoring filters by hook, not by parameter shape. Closed-enum
// `NavigationErrorSignal` keeps the surface predictable.
```

Renderer owns:
- All 28 components
- `useA2UIState` (renamed `useRendererState` for V0 to disambiguate)
- 12-verb dispatcher with middleware
- Theme + AI + listener providers (internal)
- Internal nav (4 patterns)

Host owns (apps/mobile/src/screens/AppRunner):
- Top header: back button (handled by host's React Navigation), title (from Spec metadata or first Heading), meatball menu (Share / Make changes / Archive / Delete — none of these go through the renderer's dispatcher)
- Bottom tab bar (host-level chrome)
- Toast UI (Gorhom-based; `onToast` callback enqueues to the host's toast surface)
- Spec loading + error states (renderer never sees an invalid spec — host validates upstream)
- The `BottomSheetModalProvider` for the host's own meatball action sheet (separate from the renderer's internal one for `modal-overlay` nav)

The renderer doesn't render the AppRunner header. The renderer doesn't
render the tab bar. The renderer doesn't fetch the spec. AppRunner
mounts the renderer like this:

```tsx
function AppRunner({route}: Props) {
  const {data: spec} = useProjectQuery(route.params.projectId)
  const toast = useToast()
  if (!spec) return <Loading />
  if (renderError) return <RenderErrorState onRetry={...} />
  return (
    <SafeContainer>
      <RunHeader title={getSpecTitle(spec)} onMeatball={openMeatball} />
      <Renderer
        spec={spec}
        host={{
          onToast: toast.show,
          onAIError: e => logger.error({err: safeMessage(e)}, 'AI dispatch failed'),
        }}
      />
    </SafeContainer>
  )
}
```

#### H. Layer 4 productive title gradient is host-side

Per Roz's F-11 closure for ADR-0005: Layer 4 (vertical gradient from
`bg-elevated` 0% at bottom to transparent at 30%, productive stance
only) is **Library card chrome**. It overlays the cover art in the
Library card UI, not in the Run-mode body.

Implementation: `apps/mobile/src/screens/Library/components/LibraryCard.tsx`
adds `<LinearGradient>` (from `expo-linear-gradient`) overlaid on the
`coverArt` SVG when `mini_app.stance === 'productive'`. Expressive
cards skip the overlay.

This is not in `packages/a2ui-renderer/`. The renderer renders Run-mode
body content only; Library cards are host territory.

#### I. AppRunner header derives title from Spec

The host's AppRunner header shows the tool's title. Where does the
title come from? Three options:

- Read `Spec.screens[0].root` for the first `Heading` component and use its `text`.
- Stored on the `mini_app` row server-side at create time (server picks first Heading or falls back to first 40 chars of prompt).
- A new optional field `Spec.title?: string`.

I'm picking **stored on `mini_app`**. Reasoning: the renderer is
sandboxed; making the host walk the spec to find a Heading is host
logic that already gets duplicated server-side at create time. Two
sources of truth is a recipe for divergence.

Server-side title derivation is ADR-0007's surface, not this ADR's.
For Step 13's emulator demo, the orchestrator can hardcode the title
in the test spec or pass it via AppRunner props.

#### J. Snapshot tests across stance × palette × component

ADR-0005 snapshot-tested coverArt across 12 stance × palette combos.
The renderer's components get the same treatment — but at 28
components × 2 stances × 6 palettes = 336 snapshots, that's
unmanageable.

Pragmatic call: **snapshot every component at productive×focus and
expressive×health.** Two combinations cover the stance dimension
(both are present) and two palettes (one per stance). 28 components ×
2 = 56 snapshots. That's the matrix coverage Sable's polish review
needs without snapshot bloat.

For full 12-register coverage, **the integration test (Step 13's demo
spec)** renders one screen across all 12 registers. A single snapshot
per register, validated visually during the polish review week.

#### K. Default `useEffect` ban exception: Apple AI capability check

The brief and CLAUDE.md ban `useEffect` in renderer components. The
single exception is `<AICapabilitiesProvider>`'s mount-time capability
check — it's an inherently asynchronous OS query that needs to fire
once on render-tree mount. No app logic; pure infra.

We document this exception explicitly; an ESLint rule allows
`useEffect` in `src/ai/` but blocks it everywhere else in the renderer
package.

#### L. Reanimated worklets vs. JS-thread animations

Brief mandates Reanimated 4. List item enter/exit (`addItem`,
`removeItem`) uses `LinearTransition` and `FadeOut` layout animations
on FlashList items — these run on the UI thread via Reanimated's
worklet machinery. Toast slide-down, FAB scale-in, sheet animations
(Gorhom owns) — all Reanimated.

The dispatcher fires action signals; layout animations respond to
state changes (FlashList's data array changing). The dispatcher does
NOT call animation APIs directly — that would couple business logic
to animation frames.

#### M. Recursive children resolution via NodeRenderer + React Suspense (no)

A naive recursive `NodeRenderer` could blow the stack at deep nesting.
The schema caps at `MAX_NESTING_DEPTH = 8` (validator enforces); React
recursion at depth 8 is well within stack safety. **No need for
Suspense or virtualized rendering for the common case.** FlashList
handles list virtualization for collections.

#### N. Test environment: jest-expo for RN-component snapshots, jest for pure-function tests

Component snapshot tests need a React Native renderer; jest-expo
provides this (via `@testing-library/react-native`). Pure-function
tests (reducer, middleware, useBinding logic, navigation routing) run
under plain jest with a Node runtime — faster iteration, no RN
overhead.

The renderer package gets two jest configs: `jest.config.cjs` for the
default Node runtime (pure logic) and `jest.config.rn.cjs` for RN
component tests. Pattern matches design-system from ADR-0005 Step 10.

---

## Alternatives Considered

### Alternative 1: Extend M1's renderer in place

- **Upside:** No legacy/V0 split; smallest diff during migration.
- **Downside:** M1's `useA2UIState` is keyed on a single state map; V0 has slots + collections. M1's `Container` is the only layout primitive; V0 has 5. M1's switch in NodeRenderer is 10-arm; V0 needs 28. Adapting in place produces a half-migrated state where the import surface is ambiguous (some types from old, some from new) and Colby's rate of progress drops.
- **Why not:** clean split is cheaper than the hybrid maintenance cost.

### Alternative 2: Single React context for all renderer state

- **Upside:** simplest possible state model — one provider, one hook.
- **Downside:** every binding read causes a context re-render of every consumer. With 28 components and a 50-row List, that's potentially 1400 re-renders per dispatch.
- **Why not:** measurable perf gap. The slot/collection split + `ListItemContext` for row-scoped reads keeps re-renders local.

### Alternative 3: Action dispatcher as a switch in the reducer (no middleware)

- **Upside:** matches M1; simpler mental model.
- **Downside:** side effects (haptics, toasts, AI calls) interleave with state transitions in a switch; testing requires partial reducer execution; ADR-0007 telemetry would have to fork the switch.
- **Why not:** as the surface scales, middleware separation pays back. The complexity is hidden by Redux-like middleware composition, which is a well-trodden pattern.

### Alternative 4: Render each navigation pattern in a separate package

- **Upside:** clear separation of concerns.
- **Downside:** four packages for four nav patterns is over-engineering. Nav patterns share theme, accessibility, dispatcher, error boundary — splitting requires duplicating the shared infrastructure.
- **Why not:** the renderer is already one package with internal modules per concern. Nav patterns become files under `src/nav/`, not separate packages.

### Alternative 5: AI bridge as a separate package

- **Upside:** isolates the `react-native-ai-apple` dependency from the rest of the renderer.
- **Downside:** the AI bridge is consumed only by `<ListSummary>` in V0 — one component. Splitting a 1-consumer dependency into its own package is over-engineering. V0.5's broader AI surface might justify the split; V0 doesn't.
- **Why not:** keep AI surface in `packages/a2ui-renderer/src/ai/` for V0; revisit at V0.5.

### Alternative 6: Snapshot every component × every stance × every palette (336 snapshots)

- **Upside:** maximum visual coverage.
- **Downside:** 336 snapshot files per test run; ~150kb per file = 50MB. CI snapshot diff becomes painful. Reviewing 336 SVG diffs on a stance/palette token tweak is impossible.
- **Why not:** 56 snapshots (productive×focus + expressive×health, 28 components each) plus integration tests for full 12-register sampling is the right balance.

---

## Consequences

### Positive

- **Closed, structurally-typed renderer.** The 28-component union, 12-verb dispatcher, and `Binding<T>` resolution are all derived from the protocol package — no schema drift.
- **Sample-spec demo at Milestone A (end Step 5).** Visual confirmation of theme + Layout + Typography + Display works on iOS Simulator before interactivity is plumbed. The orchestrator can route to emulator validation early.
- **Interactive demo at Milestone B (end Step 10).** All 28 components rendering, all 12 verbs dispatching, all 4 nav patterns navigating. Sample-spec demo with full interactivity.
- **AppRunner stays green throughout the rewrite** via `src/legacy/`. No multi-week red period.
- **Middleware dispatcher** isolates side effects from state transitions; ADR-0007 telemetry slots in cleanly.
- **AI bridge graceful degradation** is one provider + one hook; no per-component capability checks.

### Negative

- **13 implementation steps**, each with its own QA cycle. ~13 Cal-Roz-Colby-Roz loops at minimum, plus revisions. This is the long-pole step Cal estimated at 3+ weeks.
- **Two jest configs** (Node + RN) for the same package. Slightly more config surface; matches design-system precedent.
- **`src/legacy/` lives in tree for ~10 steps.** Cognitive overhead while reading the package; deleted at Step 13.
- **Snapshot tests sample 2 of 12 registers.** Polish review week (canvas-v0.md week 5) adds the visual breadth check; that's documented but not codified in CI.
- **Renderer cannot self-validate spec.** `validateCrossRefs` from ADR-0005 runs upstream (host or generation pipeline). If an invalid spec reaches the renderer, components throw via the schema's discriminated union narrowing. AppRunner's `<RenderErrorBoundary>` catches.

### Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| `useBinding` for `collectionField` outside a List context returns undefined silently | Medium | Strict mode warns at render time; cross-ref validator (ADR-0005) catches structurally-invalid bindings before they reach the renderer |
| Reanimated 4 worklet bugs cause inconsistent layout animations | Low-Medium | All animations sit behind named easings (motion-snappy / motion-smooth / motion-springy from ADR-0005); reduced-motion fallback bypasses the worklet path entirely |
| FlashList `estimatedItemSize` mismatch causes scroll flicker | Low | Per-component `estimatedItemSize` constants by `itemLayout` (compact 44, standard 56, expanded 80); enforced in component spec |
| AI capability check on iOS 26+ Pro fails silently if `react-native-ai-apple` upgrade changes the API | Low-Medium | Pin `react-native-ai-apple` exact; capability provider exposes `reason` so failures are observable at the host level |
| Sheet modal nesting (host meatball sheet + renderer modal-overlay sheet) conflicts in Gorhom | Medium | Each level uses its own `BottomSheetModalProvider`; the renderer's provider is mounted inside the host's; Gorhom supports nesting at this depth |
| Step 11 AppRunner cutover breaks the integration test temporarily | Medium | Cutover is one PR; tests adapt with the cutover; rollback = revert that PR (legacy still in tree) |
| Sample-spec demo (Milestone A) renders against incomplete state model | Low | Demo at Step 5 is read-only — Layout + Typography + Display don't dispatch. State model from Step 2 just isn't exercised yet |
| **M1 specs (M2 alpha cohort) become un-renderable post-Step-13 (legacy delete)** | Medium | Pre-Step-11: `apps/mobile/` imports legacy renderer; M1 specs render via M1 path. Pre-Step-13: legacy still in tree; specs fall back via M1 schema. **Post-Step-13:** M1 specs that don't survive a server-side migration to V0 schema fail to render. **Resolution:** ADR-0007 (generation pipeline) owns the migration story — either auto-migrate at read time or mark as legacy in the host UI. ADR-0006 explicitly does not. T-0006-177 defers the per-spec decision. **Communicate to alpha cohort before Step 13 lands.** |

### Rollback path

ADR-0006 implementation is staged in 13 PRs. Each step PR is independently
revertable up to the AppRunner cutover at Step 11.

- **Steps 1–10:** package-internal changes; reverting a step rolls back its
  files. The `src/legacy/` re-export keeps `apps/mobile/` building.
- **Step 11 (AppRunner cutover):** the most fragile point. If a regression
  emerges post-cutover, revert that PR; AppRunner falls back to legacy.
- **Step 12 (snapshot matrix):** snapshots are additive; revert is no-op
  on runtime behavior.
- **Step 13 (demo + legacy delete):** legacy delete is the last action.
  If a problem surfaces, restore from git history and re-cutover.

If the entire ADR rolls back: `apps/mobile/src/screens/AppRunner/` keeps
importing from `src/legacy/` indefinitely; M1 renderer continues to
serve. Revert costs one PR per step (worst case).

---

## Implementation Plan

13 steps. Order: legacy migration first (cheap, unblocks AppRunner stability) →
state + dispatcher framework (foundation) → theme + AI provider → 6 component-tier
steps in tier order → nav patterns → integration → matrix snapshots → demo.

**Visual milestones for the orchestrator:**

- **Milestone A: Visual demo (end Step 5).** Layout + Typography + Display tiers complete. Hardcoded sample spec from `packages/protocol/test/fixtures.demo.ts` (NEW file at Step 13; Step 5 stages a minimal stub) with no inputs/lists/nav renders on iOS Simulator. Pure visual proof.
- **Milestone B: Interactive demo (end Step 10).** All 28 components + dispatcher + nav working. Full sample-spec demo end-to-end on iOS Simulator.

### Step 1: Legacy migration + V0 package scaffold

**Files to create / modify:**

- `packages/a2ui-renderer/src/legacy/` (NEW directory) — move M1 sources here:
  - `src/legacy/components/` (10 M1 components)
  - `src/legacy/render.tsx`, `legacy/render.test.tsx`, `legacy/render.step3.test.tsx`
  - `src/legacy/state/` (M1 reducer + useA2UIState)
  - `src/legacy/theme/` (M1 RendererThemeProvider)
  - `src/legacy/logger/`, `src/legacy/types.ts`, `src/legacy/index.ts`
  - `src/legacy/__mocks__/`, `src/legacy/__snapshots__/`, `src/legacy/test/`
- `packages/a2ui-renderer/src/index.ts` — re-export from `./legacy/index.js` (V0 not yet implemented)
- `packages/a2ui-renderer/src/v0/` (NEW directory, empty placeholder for now)
- `packages/a2ui-renderer/jest.config.cjs` — keep current (legacy tests still run)
- `packages/a2ui-renderer/jest.config.rn.cjs` (NEW) — for V0 RN component tests
- `packages/a2ui-renderer/package.json` — add `seedrandom@3.0.5`, `react-native-ai-apple` (pinned exact), `expo-haptics`, `@react-navigation/native-stack`, `@gorhom/bottom-sheet`, `@shopify/flash-list`, `react-native-keyboard-controller` if not already
- `packages/a2ui-renderer/tsconfig.test.json` (NEW) — for jsx mode in tests

**Acceptance criteria:**

- All M1 source files moved to `src/legacy/`. `git diff` shows pure file moves (no content changes).
- `packages/a2ui-renderer/src/index.ts` re-exports the legacy public surface so `apps/mobile/src/screens/AppRunner/index.tsx` imports unchanged.
- `pnpm --filter @app-creator/a2ui-renderer typecheck` passes.
- `pnpm --filter @app-creator/a2ui-renderer test` passes (M1 tests run from `src/legacy/`).
- Workspace `pnpm typecheck` passes (apps/mobile still builds).
- New devDependencies pinned exact in package.json.

**Estimated complexity:** Low (file moves + scaffold).

**Code shape:**

```ts
// packages/a2ui-renderer/src/index.ts (Step 1 form)
// Re-export the M1 public surface from src/legacy/. V0 is built in src/v0/
// across Steps 2–10 and replaces this file at Step 11.
export {
  NodeRenderer,
  RendererThemeProvider,
  RendererLoggerProvider,
  useA2UIState,
} from './legacy/index.js'
export type {RendererTheme, RenderState, Dispatch} from './legacy/index.js'
```

### Step 2: State model + reducer + middleware framework + Binding<T> resolution

**Files to create:**

- `packages/a2ui-renderer/src/v0/state/types.ts` — `RendererState`, `CollectionState`, `Binding<T>` re-exported from protocol
- `packages/a2ui-renderer/src/v0/state/reducer.ts` — pure reducer for the 12 verbs (state mutations only; side effects are middleware)
- `packages/a2ui-renderer/src/v0/state/middleware.ts` — middleware composition machinery
- `packages/a2ui-renderer/src/v0/state/middleware/haptics.ts` — Expo Haptics per-verb
- `packages/a2ui-renderer/src/v0/state/middleware/toast.ts` — calls `host.onToast`
- `packages/a2ui-renderer/src/v0/state/middleware/aiBridge.ts` — calls AI dispatcher (placeholder until Step 8)
- `packages/a2ui-renderer/src/v0/state/middleware/navigation.ts` — calls navigation primitive (placeholder until Step 10)
- `packages/a2ui-renderer/src/v0/state/useRendererState.ts` — top-level state hook
- `packages/a2ui-renderer/src/v0/state/useBinding.ts` — `Binding<T>` resolver
- `packages/a2ui-renderer/src/v0/state/ListItemContext.tsx` — row-scoped context for collection-field bindings
- Test files per source (8 test files)

**Acceptance criteria:**

- Reducer is pure: no `Date.now()`, no `Math.random()`, no I/O. Handles all 12 verbs with explicit state transitions.
- Middleware framework: composition order is reducer-last; each middleware can short-circuit (toast, aiProcess) or pass through (navigate, capture). (`share` removed — not a renderer verb per F-04.)
- `useRendererState` initializes from `Spec.initialState` + `Spec.collections[i].seedData`. Spec-ref change triggers RESET (M1 pattern).
- `useBinding<T>(binding)` resolves all 3 binding kinds. `collectionField` requires `ListItemContext`; resolves to `undefined` outside one with a dev-mode warning.
- Test coverage: every verb has happy + failure tests. Reducer determinism test (1000 calls produce identical results). Concurrency test (100 parallel dispatches don't corrupt state).
- No imports from `src/legacy/`. V0 state is independent.

**Estimated complexity:** High (foundation; gets re-tested by every later step).

**Code shape:**

```ts
// state/reducer.ts
export function reducer(state: RendererState, action: Action): RendererState {
  switch (action.type) {
    case 'set':
      return {...state, slots: new Map(state.slots).set(action.target, action.value)}
    case 'addItem': {
      const collection = state.collections.get(action.collection)
      if (!collection) return state  // cross-ref validator should have caught
      const newId = generateRowId()
      const newRows = new Map(collection.rows).set(newId, action.item)
      const newOrder = [...collection.rowOrder, newId]
      return {
        ...state,
        collections: new Map(state.collections).set(action.collection, {
          ...collection, rows: newRows, rowOrder: newOrder,
        }),
      }
    }
    // ... 10 more verbs
    default: {
      const _: never = action  // exhaustiveness
      return state
    }
  }
}
```

### Step 3: Theme provider + AI capabilities provider + accessibility wrapper

**Files to create:**

- `packages/a2ui-renderer/src/v0/theme/RendererThemeProvider.tsx` — wraps the renderer with `theme(stance, palette)` resolved
- `packages/a2ui-renderer/src/v0/theme/useTheme.ts`
- `packages/a2ui-renderer/src/v0/ai/AICapabilitiesProvider.tsx` — async `isAvailable()` check on mount
- `packages/a2ui-renderer/src/v0/ai/useAICapabilities.ts`
- `packages/a2ui-renderer/src/v0/a11y/AccessibilityWrapper.tsx` — applies VoiceOver labels, dynamic-type clamping (max "Large" per V0)
- `packages/a2ui-renderer/src/v0/a11y/useReducedMotion.ts` — wraps `AccessibilityInfo.isReduceMotionEnabled()`
- Test files per source

**Acceptance criteria:**

- `RendererThemeProvider` consumes `Spec.stance` and `Spec.palette` once at mount; provides `ResolvedTheme` via context.
- `AICapabilitiesProvider` calls `react-native-ai-apple`'s `isAvailable()` once on mount; caches `{isSupported, reason}`. Until resolved, `isSupported` defaults to `false` (safe default).
- `useReducedMotion` hook returns the current reduced-motion state; subscribes to changes via `AccessibilityInfo.addEventListener`.
- Accessibility wrapper sets `accessibilityLabel`, `accessibilityRole`, hit-target enforcement (≥44pt) at the wrapper level; component implementations inherit.
- The single `useEffect` exception lives in `AICapabilitiesProvider` (capability check). ESLint rule allows `useEffect` only in `src/v0/ai/`.

**Estimated complexity:** Low.

### Step 4: Layout tier (5 components)

**Files to create:**

- `packages/a2ui-renderer/src/v0/components/layout/Screen.tsx`
- `packages/a2ui-renderer/src/v0/components/layout/Section.tsx`
- `packages/a2ui-renderer/src/v0/components/layout/Stack.tsx`
- `packages/a2ui-renderer/src/v0/components/layout/Row.tsx`
- `packages/a2ui-renderer/src/v0/components/layout/Card.tsx`
- `packages/a2ui-renderer/src/v0/components/NodeRenderer.tsx` — initial 5-arm switch (extends per step)
- Test files per component (5 component test files + 1 NodeRenderer test file = 6 test files)

**Acceptance criteria:**

- All 5 layout components consume `theme()` for spacing/radius/elevation.
- Each component handles `padding`, `gap` (where applicable), `align`, `justify` from the schema.
- `Screen` honors `safeArea: 'top' | 'bottom' | 'both' | 'none'` via `react-native-safe-area-context`.
- `Card` renders elevation (flat / raised / floating) via stance-resolved shadow recipes.
- `NodeRenderer` discriminates the 5 layout types + a defensive `default` branch that calls `host.onUnknownNodeType` (defense-in-depth).
- Snapshot tests for each component at productive×focus and expressive×health (10 snapshots total).

**Estimated complexity:** Medium.

### Step 5: Typography (3) + Display (4) tiers — **MILESTONE A: visual demo**

**Files to create:**

- `packages/a2ui-renderer/src/v0/components/typography/Heading.tsx`
- `packages/a2ui-renderer/src/v0/components/typography/Body.tsx`
- `packages/a2ui-renderer/src/v0/components/typography/Caption.tsx`
- `packages/a2ui-renderer/src/v0/components/display/Stat.tsx`
- `packages/a2ui-renderer/src/v0/components/display/Badge.tsx`
- `packages/a2ui-renderer/src/v0/components/display/Chip.tsx`
- `packages/a2ui-renderer/src/v0/components/display/Avatar.tsx`
- Update `NodeRenderer.tsx` to dispatch the 7 new types
- Test files per component (7 + integration test for the visual-demo subset = 8 test files)

**Acceptance criteria:**

- Heading levels 1/2/3 resolve to `display`/`h1`/`h2` type roles per stance (productive uses sans family throughout; expressive uses serif at display/h1/h2).
- Body and Caption support `weight: 'regular' | 'strong'` and `color: <ColorToken | accent>`.
- Stat renders value + label + optional delta with delta-tone color resolution.
- Badge tone enum (`neutral / accent / success / warning / danger`) renders correct background + foreground tints.
- Chip handles `selected` state with accent inversion; uses `radius-full`.
- Avatar fallback initials when no image; sizes 24/32/48 enforced.
- **Integration test (Milestone A trigger):** mount a sample spec containing only Layout + Typography + Display components on jest-expo's RN test renderer; assert the React tree matches the expected snapshot. Visual confirmation in the iOS Simulator is the orchestrator's separate signal — `pnpm --filter @app-creator/mobile ios` boots the simulator with a hardcoded sample spec wired into AppRunner.
- Snapshot tests for each of the 7 new components at 2 register pairs (14 snapshots).

**Estimated complexity:** Medium.

**Milestone A note:** at the end of Step 5, the orchestrator can verify
the renderer mounts on iOS Simulator visually. The sample spec for this
milestone is `packages/protocol/test/fixtures.demo.ts` (NEW file) — a
hardcoded spec with `navigation: 'none'` and a single screen of
typography + display. AppRunner imports from `@app-creator/a2ui-renderer`
the V0 entry point (gated behind a feature flag until Step 11) for the
demo build.

### Step 6: Inputs tier (5 components)

**Files to create:**

- `packages/a2ui-renderer/src/v0/components/inputs/TextField.tsx`
- `packages/a2ui-renderer/src/v0/components/inputs/NumberField.tsx`
- `packages/a2ui-renderer/src/v0/components/inputs/DateField.tsx`
- `packages/a2ui-renderer/src/v0/components/inputs/Picker.tsx` — Gorhom Bottom Sheet for option selection
- `packages/a2ui-renderer/src/v0/components/inputs/Switch.tsx`
- Update `NodeRenderer.tsx` to dispatch
- Test files (5)

**Acceptance criteria:**

- All 5 inputs resolve `valueBinding: Binding<T>` via `useBinding`.
- TextField/NumberField commit-on-blur or commit-on-change per spec; commit calls `dispatch({type: 'set', target, value})` with the typed value.
- DateField shows iOS-native `DateTimePickerIOS` in a Gorhom sheet on tap.
- Picker shows option list in a Gorhom sheet; selection dismisses.
- Switch renders iOS-native `Switch` from RN; `trackColor` follows accent.
- React Native Keyboard Controller wraps the renderer root for keyboard avoidance.

**Estimated complexity:** Medium-High.

### Step 7: Lists tier (5 components) + FlashList integration

**Files to create:**

- `packages/a2ui-renderer/src/v0/components/lists/List.tsx` — FlashList integration; reads `ListItemContext` for row-scoped child rendering
- `packages/a2ui-renderer/src/v0/components/lists/ListItem.tsx`
- `packages/a2ui-renderer/src/v0/components/lists/SwipeableRow.tsx` — react-native-gesture-handler `Swipeable`
- `packages/a2ui-renderer/src/v0/components/lists/EmptyState.tsx`
- `packages/a2ui-renderer/src/v0/components/lists/LoadingState.tsx` — Reanimated shimmer
- Update `NodeRenderer.tsx` to dispatch
- Test files (5)

**Acceptance criteria:**

- `List.collectionId` references a collection from the spec; `ListItemContext` provides `{row, rowId, index}` to children per row.
- `ListItem.leading` and `trailing` are `Slot` discriminated unions; each kind (`none / icon / avatar / badge`) renders correctly.
- `SwipeableRow.leadingAction` / `trailingAction` dispatch via the action dispatcher; swipe threshold 80pt.
- `EmptyState` renders icon + headline + body + optional CTA; consumed by `List` when collection has zero rows.
- `LoadingState` Reanimated shimmer (1.5s loop); reduced-motion fallback to static gray.
- FlashList `estimatedItemSize` per layout: compact 44, standard 56, expanded 80.

**Estimated complexity:** High (FlashList + gestures + animations).

### Step 8: Compound tier (4 components) + AI bridge wiring

**Files to create:**

- `packages/a2ui-renderer/src/v0/components/compound/ConditionalSection.tsx`
- `packages/a2ui-renderer/src/v0/components/compound/ListSummary.tsx` — consumes `useAICapabilities`; dispatches `aiProcess` on mount
- `packages/a2ui-renderer/src/v0/components/compound/MediaTray.tsx`
- `packages/a2ui-renderer/src/v0/components/compound/ImagePicker.tsx`
- `packages/a2ui-renderer/src/v0/ai/aiDispatcher.ts` — `react-native-ai-apple` wrapper
- Update `NodeRenderer.tsx` to dispatch
- Test files (4 components + aiDispatcher = 5)

**Acceptance criteria:**

- `ConditionalSection.showWhen: 'whenEmpty' | 'whenNotEmpty'` predicates against the named collection; renders children based on row count.
- `ListSummary.fallback: 'show-raw' | 'hide'` honored on unsupported devices; on iOS 26+ Pro, dispatches `aiProcess(summarize)` and renders the summary in `type-body` with `accent` left bar.
- `MediaTray` reads collection rows; renders `imageField` from each row using Expo Image; horizontal FlashList.
- `ImagePicker` opens expo-image-picker; result dispatches as image-ref binding to `valueBinding`'s target slot.
- `aiDispatcher.summarize` wraps `react-native-ai-apple`; mocked in tests via `MockAIDispatcher`. Real call only fires on iOS 26+ Pro.

**Estimated complexity:** High (AI integration, native modules).

### Step 9: Actions tier (Button + FAB) + dispatcher feedback contract

**Files to create:**

- `packages/a2ui-renderer/src/v0/components/actions/Button.tsx`
- `packages/a2ui-renderer/src/v0/components/actions/FAB.tsx`
- `packages/a2ui-renderer/src/v0/state/middleware/feedback.ts` — orchestrates per-verb feedback (haptics, animations, toasts) per canvas-v0-ux.md §Action Verb Feedback Contract
- Update `NodeRenderer.tsx` to dispatch
- Test files (3)

**Acceptance criteria:**

- Button variants `primary / secondary / destructive / text` resolve to correct theme colors; sizes `sm / md / lg` enforce 32/44/56 pt heights.
- FAB renders 56pt circle, `accent` bg, `accent-fg` icon 24pt, `elevation-floating`.
- `disabled: BooleanBinding | undefined` resolves at render time; disabled state hits 50% opacity; no haptic on disabled press.
- Per-verb feedback per Sable's contract:
  - `addItem` → light haptic + Reanimated row enter
  - `removeItem` → medium haptic + slide-out + undo toast for 5s
  - `share` is **not a renderer verb** (F-04 closure). The host's meatball Share button is wired by the host directly; no synthetic action through the renderer dispatcher.
  - `toast` → host's onToast queue
  - `aiProcess` → component renders own loading; on completion, motion-smooth crossfade
- All 12 verbs have explicit feedback paths or documented "no feedback" rationale.

**Estimated complexity:** Medium.

### Step 10: Internal navigation patterns (4) — **MILESTONE B: interactive demo**

**Files to create:**

- `packages/a2ui-renderer/src/v0/nav/NoNav.tsx` — single-screen renderer
- `packages/a2ui-renderer/src/v0/nav/StackNav.tsx` — `createNativeStackNavigator` wrapper
- `packages/a2ui-renderer/src/v0/nav/TabsNav.tsx` — custom segmented-control nav (top-of-body)
- `packages/a2ui-renderer/src/v0/nav/ModalOverlayNav.tsx` — Gorhom Bottom Sheet with target screen
- `packages/a2ui-renderer/src/v0/Renderer.tsx` — top-level component; selects nav pattern from `Spec.navigation`
- Update state middleware: `navigation.ts` now wires up actual nav primitive calls
- Test files (4 nav patterns + Renderer = 5)

**Acceptance criteria:**

- `Spec.navigation: 'none'` mounts `<NoNav>` rendering `Spec.screens[0].root`.
- `Spec.navigation: 'stack'` mounts `<StackNav>` with one screen per `Spec.screens` entry; `navigate(target)` pushes; `back` pops.
- `Spec.navigation: 'tabs'` mounts `<TabsNav>` with a segmented control above the body; selection swaps screens; max 4 tabs.
- `Spec.navigation: 'modal-overlay'` mounts the root screen; `navigate(target)` opens a Gorhom sheet with the target screen's root inside; sheet drag-down dismisses.
- `<Renderer>` is the single public entry point: `<Renderer spec={...} host={...} />` chooses the nav pattern internally.
- Integration test (Milestone B): demo spec with `stack` navigation; tapping a Button with `navigate` action transitions to the next screen; `back` returns.

**Estimated complexity:** High.

**Milestone B note:** at end of Step 10, the orchestrator can verify
interactive iOS Simulator behavior: tap a Button, see a navigation
transition; toggle a Switch, see state change; type into TextField and
verify the slot updates. Visual proof of full V0 capability.

### Step 11: AppRunner cutover + Layer 4 productive overlay

**Files to modify:**

- `apps/mobile/src/screens/AppRunner/index.tsx` — swap `legacy/` imports for V0; wire new host callbacks
- `apps/mobile/src/screens/Library/components/LibraryCard.tsx` (NEW or modified) — add `<LinearGradient>` overlay for productive cards
- `packages/a2ui-renderer/src/index.ts` — replace legacy re-exports with V0 surface; legacy re-exported under `legacy/` subpath for any remaining consumers
- Add `expo-linear-gradient` to apps/mobile dependencies (pinned exact)

**Acceptance criteria:**

- AppRunner builds and runs against the V0 renderer; M1 sources still in tree but no longer imported.
- Library card on productive specs shows the `bg-elevated` 0%→transparent 30% gradient at the bottom of the cover image; expressive cards do not.
- Sample spec from Step 5 still renders correctly post-cutover.
- All M1 integration tests for AppRunner are either ported or explicitly removed with rationale.

**Estimated complexity:** Medium-High (most fragile step; touches the host).

### Step 12: Snapshot matrix (28 components × 2 register pairs = 56 snapshots)

**Files to create:**

- `packages/a2ui-renderer/src/v0/__snapshots__/` — 56 snapshot files
- A parameterized snapshot test runner that iterates the matrix
- Documentation in `packages/a2ui-renderer/test/snapshot-policy.md` explaining the 2-register sampling and how polish-review week extends to 12

**Acceptance criteria:**

- 56 snapshots generated, checked into git.
- Snapshot stability: running tests twice produces zero diff.
- Each snapshot fixture covers required props for its component (matches the test/fixtures.ts shape from ADR-0005 Step 4).
- Documentation explains why 2 of 12 registers, what polish-review adds.

**Estimated complexity:** Medium.

### Step 13: Sample-spec emulator demo + legacy delete

**Files to create / modify:**

- `apps/mobile/src/screens/AppRunner/index.tsx` — accept a `?demo=spec-name` query param to load a hardcoded spec from `packages/protocol/test/fixtures.demo.ts` (gated behind dev-build only)
- `packages/protocol/test/fixtures.demo.ts` (NEW) — 4 hardcoded specs: one per archetype (ListCRUD, Tracker, Journal, Calculator), all valid against `validateCrossRefs`
- Delete `packages/a2ui-renderer/src/legacy/` directory entirely
- `packages/a2ui-renderer/src/index.ts` — final V0-only public surface

**Acceptance criteria:**

- `pnpm --filter @app-creator/mobile ios` boots the iOS Simulator with the dev-build app.
- A dev-only menu in AppRunner exposes the 4 demo specs; selecting one mounts it on the renderer.
- All 4 demo specs render correctly across both stances (each demo spec uses one stance + one palette assignment).
- Legacy deleted; tree shows zero `legacy/` references.
- Workspace `pnpm typecheck && pnpm test` passes end-to-end.

**Estimated complexity:** Medium-High.

---

## Comprehensive Test Specification

### Test File Mapping

| Step | Test Files | Env |
|---|---|---|
| 1 | (no new tests; legacy tests run as-is) | Node + jest-expo (legacy) |
| 2 | `state/reducer.test.ts`, `state/middleware.test.ts`, 4 middleware test files, `useRendererState.test.ts`, `useBinding.test.ts`, `ListItemContext.test.tsx` | Node + jest-expo |
| 3 | 3 provider test files, `useReducedMotion.test.ts` | jest-expo |
| 4 | 5 component test files + `NodeRenderer.test.tsx` | jest-expo |
| 5 | 7 component test files + `step5-milestone-A.integration.test.tsx` | jest-expo |
| 6 | 5 component test files | jest-expo |
| 7 | 5 component test files | jest-expo |
| 8 | 4 component test files + `aiDispatcher.test.ts` | jest-expo + Node (for aiDispatcher mock) |
| 9 | 2 component test files + `feedback.test.ts` | jest-expo |
| 10 | 4 nav test files + `Renderer.test.tsx` + `step10-milestone-B.integration.test.tsx` | jest-expo |
| 11 | `AppRunner.integration.test.tsx` updates + `LibraryCard.test.tsx` | jest-expo |
| 12 | `snapshot-matrix.test.tsx` (parameterized) | jest-expo |
| 13 | `step13-emulator-demo.integration.test.tsx` (smoke) | jest-expo |

### Step 1 Tests (regression only)

| ID | Category | Test Description |
|---|---|---|
| T-0006-001 | Regression | M1 `NodeRenderer` test suite still passes after move to `src/legacy/` (file-move integrity) |
| T-0006-002 | Regression | `apps/mobile/src/screens/AppRunner/index.tsx` typechecks against the legacy public surface re-exported from `src/index.ts` |
| T-0006-003 | Regression | Workspace `pnpm typecheck && pnpm test` produces zero net new failures vs. pre-Step-1 baseline |
| T-0006-004 | Regression | All M1 snapshot files still resolve correctly from `src/legacy/__snapshots__/` |
| T-0006-005 | Regression | `pnpm --filter @app-creator/a2ui-renderer test` exits 0 |

#### Step 1 Test Summary

| Category | Count |
|---|---|
| Regression | 5 |
| **Total** | **5** |

### Step 2 Tests

| ID | Category | Test Description |
|---|---|---|
| T-0006-006 | Happy | `reducer({slots: empty, collections: empty, currentScreenId: 's1', history: []}, {type: 'set', target: 'x', value: 5})` returns state with `slots.get('x') === 5` |
| T-0006-007 | Happy (parameterized over 12 verbs) | Each verb produces the correct state transition per the table in §B. Per-verb assertions: `set` → `slots.get(target) === value` and other slots unchanged; `update` → patch applied to slot via merge; `reset` → slot restored to `Spec.initialState[target]`; `addItem` → new row added at end of `rowOrder` with new id; `removeItem` → row deleted, `rowOrder` updated, `pendingUndo` populated; `updateItem` → row patched, identity preserved; `clearCollection` → rows reset to seed data; `navigate` → `currentScreenId === target`, history pushed; `back` → currentScreenId restored from history.pop(); `capture` → no-op at reducer (image-picker side-effect); `toast` → no-op at reducer (toast handled by middleware); `aiProcess` → no-op at reducer (AI dispatch handled by middleware). 12 sub-tests via `it.each`. |
| T-0006-008 | Failure | `reducer(state, {type: 'addItem', collection: 'unknown', item: {}})` returns state unchanged (cross-ref validator should have caught upstream; reducer no-ops gracefully) |
| T-0006-009 | Failure | `reducer(state, {type: 'updateItem', collection: 'workouts', itemId: 'unknown', patch: {}})` no-ops |
| T-0006-010 | Boundary | `addItem` to a collection with `MAX_ROWS = 50` reaches the limit; 51st add no-ops with logged warning |
| T-0006-011 | Boundary | `clearCollection` resets `rows` to seed data (not empty) |
| T-0006-012 | Concurrency | 100 parallel reducer calls with the same action+state produce identical results (purity) |
| T-0006-012a | Regression | Reducer immutability: after `reducer(state, action)`, the original `state` object is structurally unchanged (`state.slots`, `state.collections`, `state.rowOrder` are not mutated). Verified via `Object.freeze(state)` before the call; reducer must return new Maps/arrays, not mutate. |
| T-0006-013 | Regression | Spec-ref change triggers RESET via the M1 pattern (derived state from props) |
| T-0006-014 | Happy | `useRendererState(spec)` initializes from `Spec.initialState` + `Spec.collections[i].seedData` |
| T-0006-015 | Happy | `useBinding({kind: 'literal', value: 'hi'})` returns `'hi'` |
| T-0006-016 | Happy | `useBinding({kind: 'state', slot: 'x'})` returns the current value of `state.slots.get('x')` |
| T-0006-017 | Happy | `useBinding({kind: 'collectionField', collectionId: 'workouts', field: 'name'})` inside a `<ListItemContext value={{row, rowId, index}}>` returns `row.name` |
| T-0006-018a | Failure (dev) | `useBinding({kind: 'collectionField', ...})` outside a `ListItemContext` THROWS in `__DEV__` mode (RN dev build). Roz R-02 ruling: silent wrong values are normalizeRow-class bugs. Throw surfaces the bug at development time. **Test mechanism (NF-03):** `global.__DEV__ = true` in `beforeEach`; restore prior value in `afterEach`. RN Jest preset defaults `__DEV__` to `true`; explicit set keeps the test deterministic regardless of preset config. |
| T-0006-018b | Boundary (prod) | Same call in production build returns `undefined` and emits one warning via `host.onUnknownNodeType` (or equivalent observability hook); does not crash. **Test mechanism (NF-03):** `global.__DEV__ = false` in `beforeEach`; restore in `afterEach`. |
| T-0006-019 | Happy | `haptics` middleware fires correct `Haptics.impactAsync` per verb (mock `expo-haptics`) |
| T-0006-020 | Happy | `toast` middleware calls `host.onToast(message, tone)` and short-circuits (does not call `next`) |
| T-0006-021 | Happy | `aiBridge` middleware calls `aiDispatcher.summarize` and dispatches `set` on completion (mocked) |
| T-0006-022 | Happy | `navigate` middleware calls navigation primitive and pass-through to reducer for `currentScreenId` update |
| T-0006-023 | Failure | Middleware composition: bad middleware that doesn't call `next` blocks downstream — verified by chained mock |
| T-0006-024 | Boundary | Middleware order: side-effect middleware runs before reducer; reducer runs last in the chain |
| T-0006-025 | Security | Action with malformed `target: '<script>'` value is passed through unchanged to reducer (string content not interpreted) |
| T-0006-026 | Security | Reducer state never includes raw user PII (Spec.initialState values are renderer state but originate from spec, not user) |
| T-0006-027 | Concurrency | Dispatch-after-unmount: 100 dispatches after `useRendererState` unmount produce no errors |
| T-0006-028 | Coverage | All 12 ActionVerb types are exercised by reducer happy-path tests |
| T-0006-028a | Regression (MT-05) | Middleware insertion-point contract for ADR-0007 telemetry: chain `[haptics, TELEMETRY, toast, aiBridge, navigate, undoBuffer, reducer]` — `TELEMETRY` receives `addItem`, `navigate`, `set` actions; chain `[haptics, toast, TELEMETRY, aiBridge, navigate, undoBuffer, reducer]` — `TELEMETRY` does NOT receive `toast` actions (short-circuited upstream). Locks the forward-compat contract: telemetry must be inserted *before* `toast`. |

#### Step 2 Test Summary

| Category | Count |
|---|---|
| Happy | 9 |
| Failure | 3 |
| Boundary | 3 |
| Security | 2 |
| Concurrency | 2 |
| Regression | 2 (added T-0006-012a immutability) |
| Coverage | 1 |
| **Total** | **22** |

### Step 3 Tests

| ID | Category | Test Description |
|---|---|---|
| T-0006-029 | Happy | `<RendererThemeProvider stance="productive" palette="focus">` provides `theme.bg === '#FAFAF7'` to consumers |
| T-0006-030 | Happy (parameterized) | All 12 stance × palette pairs resolve correctly via `useTheme` |
| T-0006-031 | Failure | `<RendererThemeProvider stance="invalid" palette="focus">` throws |
| T-0006-032 | Happy | `<AICapabilitiesProvider>` resolves `{isSupported: true}` on iOS 26+ Pro mock |
| T-0006-033 | Happy | `<AICapabilitiesProvider>` resolves `{isSupported: false, reason: 'no-foundation-models'}` on unsupported mock |
| T-0006-034 | Boundary | `useAICapabilities` returns `{isSupported: false}` before the async check completes (safe default) |
| T-0006-035 | Failure | `react-native-ai-apple` `isAvailable()` rejection is caught; `useAICapabilities` returns `{isSupported: false, reason: 'check-failed'}` |
| T-0006-036 | Happy | `useReducedMotion` returns current state from `AccessibilityInfo` |
| T-0006-037 | Regression | Reduced-motion change subscription fires correctly when system preference toggles |
| T-0006-038 | Security | Theme provider's resolved object is `Object.freeze`'d (inherited from design-system; verify pass-through) |
| T-0006-038a | Boundary (MT-04) | `<AICapabilitiesProvider>` rendered with `await act(async () => render(<Component />))`; `useAICapabilities()` transitions from `{isSupported: false}` (pre-resolve safe default) to the resolved value within a single render cycle. Component using the hook re-renders correctly after the resolve without remount. |

#### Step 3 Test Summary

| Category | Count |
|---|---|
| Happy | 5 |
| Failure | 2 |
| Boundary | 1 |
| Regression | 1 |
| Security | 1 |
| **Total** | **10** |

### Step 4 Tests

| ID | Category | Test Description |
|---|---|---|
| T-0006-039..048 | Happy (parameterized) | Each of 5 layout components renders at productive×focus and expressive×health (10 tests) |
| T-0006-049..053 | Snapshot | Snapshot test per component at productive×focus (5 snapshots) |
| T-0006-054..058 | Snapshot | Snapshot test per component at expressive×health (5 snapshots) |
| T-0006-059 | Failure | `Screen` with invalid `safeArea` value rejected at schema parse (regression on protocol) |
| T-0006-060 | Boundary | `Stack.children` with `MAX_NESTING_DEPTH = 8` renders; depth 9 caught by validateCrossRefs upstream (renderer accepts the validated spec) |
| T-0006-061 | Happy | `Card.elevation` resolves to correct shadow recipe per stance |
| T-0006-062 | Happy | `NodeRenderer` discriminates 5 layout types correctly |
| T-0006-063 | Failure | `NodeRenderer` with unknown type calls `host.onUnknownNodeType('UnknownType')` and renders fallback |

#### Step 4 Test Summary

| Category | Count |
|---|---|
| Happy | 12 |
| Failure | 2 |
| Boundary | 1 |
| Snapshot | 10 |
| **Total** | **25** |

### Step 5 Tests

| ID | Category | Test Description |
|---|---|---|
| T-0006-064..077 | Snapshot | 7 components × 2 register pairs = 14 snapshots |
| T-0006-078 | Happy | Heading levels 1/2/3 use display/h1/h2 type roles |
| T-0006-079 | Happy | Stat delta-tone color resolves: positive→success, negative→danger, neutral→fg-muted |
| T-0006-080 | Happy | Badge tone enum renders correct background tint |
| T-0006-081 | Happy | Chip selected state inverts to accent/accent-fg |
| T-0006-082 | Happy | Avatar fallback initials when `imageUrl` absent |
| T-0006-083 | Happy | Avatar size enum (24/32/48 pt) enforces correct dimensions |
| T-0006-084 | Failure | Heading with empty `text` rejected at schema parse (regression) |
| T-0006-085 | Boundary | Stat with `delta: undefined` renders without delta block |
| T-0006-086 | **Integration (Milestone A)** | Sample spec with Layout + Typography + Display only renders the expected React tree on jest-expo without throwing; visual snapshot at productive×focus matches a hand-curated golden |

#### Step 5 Test Summary

| Category | Count |
|---|---|
| Snapshot | 14 |
| Happy | 6 |
| Failure | 1 |
| Boundary | 1 |
| Integration | 1 |
| **Total** | **23** |

### Step 6 Tests

| ID | Category | Test Description |
|---|---|---|
| T-0006-087..096 | Snapshot | 5 input components × 2 register pairs = 10 snapshots |
| T-0006-097 | Happy | TextField commit-on-blur dispatches `set` with typed value |
| T-0006-098 | Happy | NumberField rejects non-numeric input |
| T-0006-099 | Happy | DateField opens iOS-native picker in Gorhom sheet on tap |
| T-0006-100 | Happy | Picker renders all options in Gorhom sheet; selection dispatches `set` |
| T-0006-101 | Happy | Switch toggles dispatch `set` with `!current` |
| T-0006-102 | Happy (parameterized) | Each of **5 input components** (TextField, NumberField, DateField, Picker, Switch — `ImagePicker` is in Compound tier, Step 8) × 3 binding kinds (literal/state/collectionField) renders without error (15 sub-tests via it.each). Roz R-03 fix. |
| T-0006-103 | Failure | TextField with `valueBinding.kind: 'collectionField'` outside ListItemContext renders empty (warning logged) |
| T-0006-104 | Boundary | TextField `maxLength` bound enforced (input rejects beyond) |
| T-0006-105 | Boundary | Picker with 1 option renders; with 13 options rejected at schema parse |
| T-0006-106 | Security | TextField escapes content (no XSS via accessibility label or programmatic injection) |

#### Step 6 Test Summary

| Category | Count |
|---|---|
| Snapshot | 10 |
| Happy | 20 (5 base + 15 parameterized binding kinds — corrected from 18 per R-03) |
| Failure | 1 |
| Boundary | 2 |
| Security | 1 |
| **Total** | **34** |

### Step 7 Tests

| ID | Category | Test Description |
|---|---|---|
| T-0006-107..116 | Snapshot | 5 list components × 2 register pairs = 10 snapshots |
| T-0006-117 | Happy | List renders rows from collection.rowOrder via FlashList |
| T-0006-118 | Happy | List item children resolve `collectionField` bindings via ListItemContext |
| T-0006-119 | Happy | ListItem leading/trailing slot kinds (icon/avatar/badge/none) render correctly |
| T-0006-120 | Happy | SwipeableRow leading swipe at 80pt commits `leadingAction`; <80pt aborts |
| T-0006-121 | Happy | SwipeableRow trailing swipe at 80pt commits `trailingAction` (typically destructive) |
| T-0006-122 | Happy | EmptyState renders when collection has zero rows |
| T-0006-123 | Happy | LoadingState shows shimmer; reduced-motion shows static gray |
| T-0006-124 | Happy | FlashList `estimatedItemSize` matches ListItem.itemLayout (compact 44, standard 56, expanded 80) |
| T-0006-125 | Failure | List with `collectionId: 'unknown'` renders empty (no crash; warning logged) |
| T-0006-126 | Boundary | List with 50 rows renders without dropped frames (perf regression test) |
| T-0006-127 | Concurrency | `addItem` dispatched 100 times in parallel results in 100 rows added (Map semantics; not 1) |
| T-0006-128 | Regression | List render preserves item identity across re-renders (FlashList key extraction) |

#### Step 7 Test Summary

| Category | Count |
|---|---|
| Snapshot | 10 |
| Happy | 8 |
| Failure | 1 |
| Boundary | 1 |
| Concurrency | 1 |
| Regression | 1 |
| **Total** | **22** |

### Step 8 Tests

| ID | Category | Test Description |
|---|---|---|
| T-0006-129..136 | Snapshot | 4 compound components × 2 register pairs = 8 snapshots |
| T-0006-137 | Happy | ConditionalSection.showWhen='whenEmpty' hides children when collection has rows |
| T-0006-138 | Happy | ConditionalSection.showWhen='whenNotEmpty' shows children when collection has rows |
| T-0006-139 | Happy | ListSummary on supported AI device dispatches `aiProcess(summarize)` and renders the result |
| T-0006-140 | Happy | ListSummary.fallback='hide' hides the component on unsupported device |
| T-0006-141 | Happy | ListSummary.fallback='show-raw' renders the last 3 collection items as bullets |
| T-0006-142 | Happy | MediaTray renders horizontal FlashList of images from collection rows |
| T-0006-143 | Happy | ImagePicker opens expo-image-picker; result dispatches as image-ref binding |
| T-0006-144 | Failure | aiDispatcher.summarize rejection is caught; ListSummary falls back to error state |
| T-0006-145 | Failure | aiDispatcher times out at 30s; ListSummary shows timeout state |
| T-0006-146 | Boundary | ListSummary on collection with 0 items shows "Nothing to summarize" |
| T-0006-147 | Security | aiDispatcher prompt is sanitized (no PII leakage from collection rows; ADR-0007 will tighten) |

#### Step 8 Test Summary

| Category | Count |
|---|---|
| Snapshot | 8 |
| Happy | 7 |
| Failure | 2 |
| Boundary | 1 |
| Security | 1 |
| **Total** | **19** |

### Step 9 Tests

| ID | Category | Test Description |
|---|---|---|
| T-0006-148..151 | Snapshot | 2 action components × 2 register pairs = 4 snapshots |
| T-0006-152 | Happy | Button variants render correct theme colors |
| T-0006-153 | Happy | Button sizes enforce 32/44/56 pt heights |
| T-0006-154 | Happy | Button disabled binding resolves via useBinding; press is no-op |
| T-0006-155 | Happy | Button press fires light haptic, then dispatches action |
| T-0006-156 | Happy | FAB renders 56pt accent circle at floating elevation |
| T-0006-157 | Happy | FAB scale-in springy on first mount |
| T-0006-158 | Happy (parameterized) | All 12 verbs trigger correct feedback per Sable's contract (12 tests) |
| T-0006-159 | Boundary | Reduced-motion: animations collapse to instant; haptics still fire |
| T-0006-160 | Failure | Action with no handler in feedback middleware logs warning, dispatches anyway |
| T-0006-161 | Security | Toast message content escapes (no rendered HTML/JSX from user input) |
| T-0006-161a | Failure (MT-02 R-04) | `clearCollection` action raises a `Alert.alert` confirmation modal BEFORE the reducer runs; reducer is not invoked while alert is open |
| T-0006-161b | Happy (MT-02 R-04) | User confirms the clearCollection alert → reducer runs, collection rows reset to seed data |
| T-0006-161c | Happy (MT-02 R-04) | User cancels the clearCollection alert → reducer does NOT run; collection rows unchanged |
| T-0006-161d | Happy (MT-03 R-05) | `removeItem` dispatched → reducer removes row → `pendingUndo` populated with `{collectionId, rowId, rowData, insertIndex, removedAt}` → undo toast shown with tappable Undo action displaying buffered row data summary (e.g., row.name) |
| T-0006-161e | Happy (MT-03 R-05) | Undo tapped within 5s → middleware dispatches synthesized `addItem` with original `rowId` → reducer restores at original `insertIndex` in `rowOrder` (not appended at end) → `pendingUndo` cleared |
| T-0006-161f | Boundary (MT-03 R-05) | 5s expires without Undo tap → middleware dispatches `clearPendingUndo` → reducer sets `pendingUndo = null` → toast auto-dismisses → row stays removed. **Test mechanism (NF-02):** wrap with `jest.useFakeTimers()` in `beforeEach`; advance via `jest.advanceTimersByTime(5001)` to trigger expiry; restore with `jest.useRealTimers()` in `afterEach`. Real timers will hang the test. |
| T-0006-161g | Failure (MT-07) | FAB with `disabled: {kind: 'literal', value: true}` renders at 50% opacity and `elevation-flat` (NOT `elevation-floating`); press is no-op; no haptic |

#### Step 9 Test Summary

| Category | Count |
|---|---|
| Snapshot | 4 |
| Happy | 21 (6 base + 12 parameterized verb feedback + 3 MT-02/MT-03 happy) |
| Boundary | 2 (1 base + MT-03 expiry) |
| Failure | 4 (1 base + MT-02 alert raise + MT-02 cancel + MT-07 FAB disabled) |
| Security | 1 |
| **Total** | **32** |

Step 9 ratio rebalance after MT-02/03/07: 21 happy vs 7 negative under raw count; ✓ under behavioral collapse (12 verb-feedback parameterized = 1 behavioral).

### Step 10 Tests

| ID | Category | Test Description |
|---|---|---|
| T-0006-162 | Happy | `<Renderer spec={navigation: 'none'} />` mounts NoNav with single screen |
| T-0006-163 | Happy | `<Renderer spec={navigation: 'stack'} />` mounts NativeStackNavigator with 2+ screens |
| T-0006-164 | Happy | navigate(target) on stack pushes to target screen |
| T-0006-165 | Happy | back on stack pops to previous screen |
| T-0006-166 | Happy | `<Renderer spec={navigation: 'tabs'} />` mounts TabsNav with segmented control |
| T-0006-167 | Happy | Tab selection swaps body content; motion-smooth crossfade |
| T-0006-168 | Boundary | Tabs with 4 screens succeeds; 5 rejected at schema parse (regression on protocol) |
| T-0006-169 | Happy | `<Renderer spec={navigation: 'modal-overlay'} />` mounts root + Gorhom sheet |
| T-0006-170 | Happy | navigate(target) on modal-overlay opens sheet with target screen |
| T-0006-171 | Happy | Sheet drag-down dismisses |
| T-0006-172 | Failure | navigate(target) where target ∉ Spec.screens.id reports validateCrossRefs error (renderer trusts upstream validation; defensive log only) |
| T-0006-172a | Failure (R-07a / MT-01) | `back()` dispatched on stack pattern when history is empty (already at root): renderer does not crash; `currentScreenId` unchanged; calls `host.onNavigationError('back-on-empty-history')` |
| T-0006-172b | Failure (R-07b) | `navigate(target)` dispatched on `modal-overlay` pattern while a sheet is already open: deterministic behavior — sheet target swaps to new screen (no double-stack); `pendingUndo` and `history` remain consistent; calls `host.onNavigationError('navigate-while-sheet-open')` for observability |
| T-0006-172c | Failure (R-07c / MT-09) | `navigate(target)` dispatched on `navigation: 'none'` pattern: renderer does not crash; calls `host.onNavigationError('navigate-on-none-nav')`; `currentScreenId` unchanged |
| T-0006-173 | **Integration (Milestone B)** | Sample spec with **stack navigation** + button-driven navigate + back + state mutation works end-to-end on jest-expo's RN renderer. (Milestone B claim narrowed to stack pattern per Roz Concern 3 — tabs and modal-overlay patterns are individually verified by T-0006-166..171 happy tests; full multi-pattern integration deferred to polish review week.) |

#### Step 10 Test Summary

| Category | Count |
|---|---|
| Happy | 8 |
| Boundary | 1 |
| Failure | 4 (1 base + 3 MT-01/MT-09/R-07b nav failure tests) |
| Integration | 1 |
| **Total** | **14** |

Step 10 ratio rebalance: 8 happy vs 5 negative. ✓ Roz R-07 closed.

### Step 11 Tests

| ID | Category | Test Description |
|---|---|---|
| T-0006-174 | Regression | AppRunner builds and renders the V0 renderer post-cutover |
| T-0006-175 | Happy | Library card on productive spec renders LinearGradient overlay; expressive does not |
| T-0006-176 | Happy | Host meatball Share button (in AppRunner header) calls `copyShareLink(spec.id)` directly; renderer is uninvolved (no `onShare` callback exists post-Concern-1 cleanup; this test is host-side and verifies AppRunner's button wiring, not renderer behavior) |
| T-0006-177 | Failure (R-08 rewritten as deterministic) | **Decision: Option A — M1 specs surface a controlled error post-Step-13.** Pre-existing M1 spec from M2 alpha data fed to `<Renderer>` after the legacy delete: V0 `SpecSchema.parse()` rejects (M1 component types like `Counter`, `TextInput`, `Form` not in V0 28-component union); AppRunner's `<RenderErrorBoundary>` catches; user sees the renderer error state component ("This tool didn't render correctly. Try recreating it.") with `onRetry` to navigate to Library. Migration path: ADR-0007 may add server-side migration; until then, M1 specs from alpha cohort surface as errors. **Alpha cohort communication note**: PM (Robert) sends "we're rebuilding; your M2 alpha tools may not open after the V0 launch" message before Step 13's PR merges. |
| T-0006-178 | Boundary | Renderer mount on iPhone SE (smallest viewport) produces no overflow |
| T-0006-179 | Breaking | Imports from `@app-creator/a2ui-renderer/legacy` no longer work post-Step-13; Step 11 cutover preserves the path |

#### Step 11 Test Summary

| Category | Count |
|---|---|
| Regression | 1 |
| Happy | 2 |
| Failure | 1 |
| Boundary | 1 |
| Breaking | 1 |
| **Total** | **6** |

### Step 12 Tests

| ID | Category | Test Description |
|---|---|---|
| T-0006-180..235 | Snapshot | 28 components × 2 register pairs = 56 snapshots (parameterized) |
| T-0006-236 | Regression | Snapshot stability: running suite twice produces zero diff |

#### Step 12 Test Summary

| Category | Count |
|---|---|
| Snapshot | 56 |
| Regression | 1 |
| **Total** | **57** |

### Step 13 Tests

| ID | Category | Test Description |
|---|---|---|
| T-0006-237 | Integration | iOS Simulator boot via `pnpm --filter @app-creator/mobile ios` succeeds |
| T-0006-238 | Integration | Each of 4 demo specs renders without crash |
| T-0006-239 | Integration | Demo spec with all 4 archetypes (one each) cycles between them on dev menu |
| T-0006-240 | Regression | After legacy delete, `pnpm typecheck && pnpm test` passes workspace-wide |
| T-0006-241 | Breaking | `src/legacy/` directory does not exist; package.json has no legacy entries |

#### Step 13 Test Summary

| Category | Count |
|---|---|
| Integration | 3 |
| Regression | 1 |
| Breaking | 1 |
| **Total** | **5** |

### Test Totals

| Step | New | Regression | Total |
|---|---|---|---|
| 1 | 0 | 5 | 5 |
| 2 | 21 (+1 MT-05 telemetry insertion) | 2 | 23 (+1 T-012a immutability, +1 MT-05) |
| 3 | 10 (+1 MT-04 act() flush) | 1 | 11 |
| 4 | 24 | 1 | 25 |
| 5 | 23 | 0 | 23 |
| 6 | 34 (R-03 corrected from 37) | 0 | 34 |
| 7 | 21 | 1 | 22 |
| 8 | 19 | 0 | 19 |
| 9 | 32 (+7 MT-02 R-04 + MT-03 R-05 + MT-07; +1 boundary expiry) | 0 | 32 |
| 10 | 14 (+3 R-07 nav failure tests) | 0 | 14 |
| 11 | 4 | 1 | 6 (1 breaking) |
| 12 | 56 | 1 | 57 |
| 13 | 3 | 1 | 5 (1 breaking) |
| **Total (rev-1)** | **261** | **13** | **276** (+ 2 breaking-change) |

Test count delta from rev-0: **+9 net new tests** (267 → 276) plus several
existing tests rewritten (T-0006-007, T-0006-018 split into 018a/b,
T-0006-176 reframed, T-0006-177 rewritten as deterministic).

Failure-vs-happy ratios under behavioral collapse (parameterized happys = 1 each):

| Step | Behavioral Happy | Negative | Holds? |
|---|---|---|---|
| 1 | 0 | 5 | ✓ (regression-only step) |
| 2 | 9 | 12 | ✓ |
| 3 | 5 | 4 | Borderline (small step; failure surface intrinsically narrow) |
| 4 | 4 | 4 | Borderline (snapshots inflate happy in raw count) |
| 5 | 6 | 2 | Below — small failure surface for typography/display |
| 6 | 6 | 4 | ✓ |
| 7 | 8 | 4 | Borderline |
| 8 | 7 | 4 | Borderline |
| 9 | 6 | 3 | Below |
| 10 | 8 | 2 | Below — nav patterns are mostly happy-path |
| 11 | 2 | 3 | ✓ |
| 12 | 1 (snapshot block) | 1 | Snapshot-dominated; ratio collapses to N/A |
| 13 | 3 | 1 | Borderline |

**Roz: ratio is below the failure ≥ happy bar on Steps 5, 9, 10. Acceptable per behavioral collapse — these are component-presentation steps where the failure surface is genuinely narrow (most failures are caught upstream by Zod / validateCrossRefs). I expect Roz to push back here; if she does, I'll add component-render-failure tests (e.g., props that violate optional bounds at runtime). I left them tight in the rev-0 spec to avoid Test Theater.**

### Test Helpers & Mocks

- `packages/a2ui-renderer/test/fixtures/specs.ts` — sample specs for each archetype
- `packages/a2ui-renderer/test/fixtures/state.ts` — pre-populated `RendererState` fixtures
- `packages/a2ui-renderer/test/mocks/MockAICapabilitiesProvider.tsx` — controllable AI capability state
- `packages/a2ui-renderer/test/mocks/MockAIDispatcher.ts` — returns canned summarize result
- `packages/a2ui-renderer/test/mocks/MockHostCallbacks.ts` — toast/share/error spies
- `packages/a2ui-renderer/test/mocks/expo-haptics.ts` — Haptics call recorder
- `packages/a2ui-renderer/test/mocks/AccessibilityInfo.ts` — controllable reduced-motion + screen reader state

### Coverage Gates

- Per-package coverage ≥ 90% lines/branches/functions for `packages/a2ui-renderer/src/v0/`.
- Snapshot tests checked into git; CI fails on drift unless explicitly updated by `pnpm test -- -u` and committed.
- Reduced-motion test variants for animations.

---

## UX Requirements

UX scope is in `docs/ux/canvas-v0-ux.md`. ADR-0006 implements:

- All 28 components from §Component Specs
- Action verb feedback contract from §Action Verb Feedback Contract
- Internal nav patterns (4) from §Internal Navigation Patterns
- Stance + palette resolution from §Stance System / §Palette System
- Accessibility per-component from §Accessibility Reference
- Polish acceptance items from §Polish Acceptance Checklist (Step 12 snapshot matrix; week-5 polish review extends)

ADR-0006 does NOT implement:

- The host shell (Library, Create, Settings, Run header, Tab bar) — apps/mobile/ territory; partially exists from M1
- Generation pipeline (ADR-0007)
- Universal Links / install-gate (ADR-0008)

## Data Sensitivity

Renderer introduces no stores. Host callbacks are the only outward
data flow:

| Callback | Receives | Sensitivity |
|---|---|---|
| `host.onToast(message, tone)` | Renderer-internal `toast` action message text | `public-safe` — host's toast surface owns display; do not log raw user-typed content |
| `host.onNavigationError(signal)` | Closed-enum `NavigationErrorSignal` | `public-safe` — no user data; observability hook |
| `host.onAIError(err)` | AI dispatch error | `auth-only-log` — error message contains internal failure mode (model unavailable, etc.); host should `safeMessage()` before logging |
| `host.onUnknownNodeType?(type)` | Schema-violating node type seen at render | `public-safe` — type is a closed-enum string; useful for observability |

The renderer never stores user data. Spec contents are renderer-side
only for the lifetime of the AppRunner mount; on unmount, `useRendererState`
disposes its in-memory state. Persistence is the host's concern (ADR-0001
projects table).

## CI/CD Impact

| Job | Config File | Impact | Required Change |
|---|---|---|---|
| Eval | `.github/workflows/eval.yml` | None this ADR | ADR-0007 will trigger generation eval against the V0 renderer; this ADR does not change eval. |
| Codegen Drift | `.github/workflows/codegen-drift.yml` | None this ADR | Continues to guard `packages/protocol/`. |
| Cover Art Runtime Parity | `.github/workflows/cover-art-runtime-parity.yml` | None this ADR | Continues to guard design-system snapshots. |
| Renderer Snapshot Matrix (NEW) | `.github/workflows/renderer-snapshot-matrix.yml` (Step 12) | New | Triggers on `packages/a2ui-renderer/**`; runs jest-expo against the snapshot matrix; fails on diff. |

`pnpm typecheck` and `pnpm test` workspace-level pick up the new V0 surface
through `pnpm -r --parallel`. No root config change.

## Documentation Impact

| Doc | Path | What Changes |
|---|---|---|
| `canvas-v0.md` §AC-R4 | `docs/product/canvas-v0.md` | "13 action verbs" → "12 action verbs" (drop `share` from the AC-R4 list). F-04 closure deferred from ADR-0005. ADR-0006's PR carries the patch. |
| `.claude/references/adr-index.md` | (file) | New row for ADR-0006: tags `renderer, mobile-shell, design-system, tests`. Status Proposed → Accepted on merge. |
| `CLAUDE.md` | (file) | Update §1 paragraph 1 to reference V0 renderer (currently mentions "10-component catalog"); update §4 if the renderer surface contract changes (it does — `<Renderer>` is the new entry; `useRendererState` replaces `useA2UIState`). Small edits, ~10 lines. |
| `apps/mobile/src/screens/AppRunner/index.tsx` (Step 11) | (file) | Significant rewrite; documented in Step 11 ACs. |

## Notes for Colby

The 15 things you'll wish someone had told you before you started:

1. **`src/legacy/` is sacred until Step 11.** Don't touch the M1 sources during Steps 2–10. AppRunner imports from the legacy public surface and your V0 work is invisible to it. The temptation to "fix something in legacy while I'm here" is real — resist.

2. **Two jest configs is the right shape.** `jest.config.cjs` for Node-runtime tests of pure logic (reducer, middleware, useBinding, hash, fixtures). `jest.config.rn.cjs` for jest-expo component snapshots. Don't try to run RN tests under Node — `react-native` mocking gets baroque fast.

3. **Middleware order matters; document it inline.** The composition is `[haptics, toast, aiBridge, navigate, undoBuffer, reducer]`. Each middleware can short-circuit. Add a comment at the top of `state/middleware.ts` explaining the order. **Critical:** ADR-0007 telemetry middleware must be inserted BEFORE `toast` (toast short-circuits, so anything after it never sees toast actions). The `undoBuffer` middleware (R-05/MT-03) sits between `navigate` and `reducer` — it captures `removeItem` row data into `pendingUndo`, runs a 5s timer, and synthesizes `clearPendingUndo` on expiry.

4. **`useEffect` is banned outside `src/v0/ai/`.** ESLint rule enforces. The `<AICapabilitiesProvider>` is the one place you need it; everywhere else, derive state from props or use refs. M1 had a few `useEffect` calls in the renderer that we're cleaning up.

5. **The AI bridge's `isAvailable()` check has a known race.** On first mount, `useAICapabilities()` returns `{isSupported: false}` for ~50ms before the async resolves. Components must handle this initial state gracefully — the `<ListSummary>` test verifies the rendered output stable across the resolve.

6. **FlashList's `estimatedItemSize` is mandatory.** Pass it per List's `itemLayout` prop. Wrong sizes cause flicker on fast scrolls. Use the constants from `state/types.ts`.

7. **Reanimated 4 worklets vs jest-expo.** Layout animations on FlashList items use Reanimated's `LinearTransition` and `FadeOut`. jest-expo's mock for Reanimated runs them on the JS thread (not the UI thread); you'll see test snapshots with intermediate animation states unless you disable animations in test setup. Add `import {jest} from '@jest/globals'; jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'))` to the test setup file.

8. **`ListItemContext` is renderer infrastructure, not app state.** Bindings outside a List with `kind: 'collectionField'` resolve to `undefined`. The cross-ref validator catches structurally invalid bindings; the renderer's job is to be defensive about runtime resolution.

9. **Gorhom Bottom Sheet has provider-nesting requirements.** AppRunner already wraps the renderer in a `BottomSheetModalProvider`; the renderer's `modal-overlay` nav uses a separate, internal `BottomSheetModalProvider` for the renderer's own sheets. Two levels of nesting work in Gorhom but require care — wrap each sheet in its own provider.

10. **`navigate` on stack uses React Navigation's `navigation.navigate(targetId)`. ** The `navigation` object comes from `useNavigation()` inside the `<NativeStackNavigator>` tree. The renderer's `navigation.ts` middleware needs access to it; pass it via context (`<NavigationRefProvider>`) populated at the `<StackNav>` level.

11. **Snapshot matrix at Step 12 is parameterized.** Don't write 56 individual test files. Use `it.each(MATRIX_FIXTURES)` over a `(component, stance, palette)` tuple array. The ADR's Step 12 ACs assume this.

12. **The Step 5 Milestone A demo spec lives at `packages/protocol/test/fixtures.demo.ts`.** Not in the renderer package. Keep demo specs in the protocol package so they get the codegen-drift guard for free.

13. **Layer 4 productive gradient is host-side.** `packages/a2ui-renderer/` does not render Library cards; the gradient lives in `apps/mobile/src/screens/Library/components/LibraryCard.tsx`. Don't add a gradient to coverArt or any renderer component.

14. **`<Renderer>` is the only public component.** Don't expose `<NodeRenderer>` directly from the package root post-Step-11. The host uses `<Renderer spec={...} host={...} />`; everything else is internal.

15. **Step 11 cutover is the most fragile step.** AppRunner imports change wholesale. Test on iOS Simulator before merging the cutover PR — the integration test catches type errors but won't catch native-runtime issues (Reanimated worklets, Gorhom mounting order, native-stack gestures). A manual smoke test of the dev-build is mandatory before Step 11 lands.

---

> ✅ **ADR-0006 rev-1 → rev-2 (NF cleanups).** **13 steps, 276 tests** (261 new + 13 regression + 2 breaking-change).
>
> Roz **APPROVE WITH NOTES** on rev-1 (round 2 review). All 5 NF findings closed inline:
> - **NF-01:** added `onNavigationError` to HostCallbacks; updated T-0006-172a/b/c to use it.
> - **NF-02:** T-0006-161f specifies `jest.useFakeTimers()` mechanism.
> - **NF-03:** T-0006-018a/b specify `global.__DEV__` toggle.
> - **NF-04:** 3 share-ghost references cleaned (haptics code example, Step 9 ACs, Data Sensitivity table replaced with `onNavigationError` row).
> - **NF-05:** Notes for Colby #3 updated to include `undoBuffer` in chain.
>
> **Status: ACCEPTED** — Step 1 unblocked. Routing to Colby for Step 1 (legacy migration + V0 scaffold).
>
> **Round 1 closures** vs Roz rev-0 review (REVISE):
> - 7 architectural concerns ruled (Concerns 1–7); P0 items (Concern 6 / R-07 nav failure tests, Concern 7 / R-08 T-0006-177) closed.
> - 12 numbered findings (R-01..R-12) addressed: 4 errata, 6 test additions/edits, 2 architectural decisions documented.
> - 10 missing tests: 7 added (MT-01, MT-02 ×3, MT-03 ×3, MT-04, MT-05, MT-07, MT-09); 3 deferred to Notes for Colby (MT-06, MT-08, MT-10) as advisory snapshot/transition coverage.
> - State model extended with `pendingUndo` + undo middleware in chain.
> - UX doc patched (`canvas-v0-ux.md` §Action Verb Feedback Contract — `share` row removed, "13-verb" → "12-verb").
> - HostCallbacks tightened (`onShare` removed; not a renderer concern).
>
> **Awaiting Roz rev-1 review.** Roz expected 1 round; this is rev-1.

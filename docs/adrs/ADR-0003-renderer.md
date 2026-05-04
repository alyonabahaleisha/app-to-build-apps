# ADR-0003: A2UI Renderer — Full Catalog, Action Dispatcher, View State Engine
*Authored by Cal — 2026-05-02. Round 2 revision — 2026-05-02 (Roz feedback applied).*

## Status
Proposed (Round 2 — addresses Roz's REVISE verdict from `docs/pipeline/roz-test-review-ADR-0003.md`)

### Round 2 Changelog

| Roz item | Resolution | Where |
|---|---|---|
| **R-1** Numeric totals wrong | Recounted all steps; new total **158** (152 new + 6 regression). Added Round-2 deltas note under Test Totals. | Test Totals table |
| **R-2** Failure tests missing in Steps 2/3/6/7 | Added T-0003-038b (Step 2 unknown-type fallback), T-0003-050b (Step 3 Image bad URL), T-0003-088b/c (Step 6 TextInput non-string state), T-0003-103c (Step 7 non-field in fields), T-0003-095b (Step 6 Toggle missing id). Failure-category count rose from 4 to 11. | Steps 2, 3, 6, 7 tables |
| **R-3** T-0003-059 used old (action,state) signature | Rewrote description to use `dispatch(node.action)` and cite §D. | Step 4 table |
| **R-4** Warn-log payloads not asserted (PII risk) | T-0003-012, T-0003-013, T-0003-095, T-0003-088c each now assert payload shape AND that the actual mismatched value is NOT in the log. | Steps 1, 6 tables |
| **R-5** Programmatic Button → Counter clamp untested | Added T-0003-076b: a Button outside the Counter UI with `action: increment(c, 100)` on `max:50` clamps to 50. The central rationale of §I now has a direct test. | Step 5 table |
| **R-6** No workspace-boundary lint rule | Added T-0003-006b (lint-rule existence test) + new CI/CD Impact row for `pnpm lint` enforcing `no-restricted-imports` patterns. | Step 1 table + CI/CD Impact |
| **R-7** ~30 snapshot claim inconsistent with table | Enumerated each snapshot as a discrete T-ID with `a/b/c` suffixes. **29** named snapshot T-IDs across Steps 2–7 (Step 2: 7, Step 3: 8, Step 4: 3, Step 5: 4, Step 6: 5, Step 7: 2). Dropped the "~30" rollup phrasing. | Steps 2–7 tables + Consequences |
| **R-8** T-0003-110 vague on fallback copy | Pinned exact strings: "This app didn't render correctly.", "Try recreating it.", "Back to library". | Step 8 table |
| **R-9** Counter at-min snapshot missing | Added T-0003-079b (at-min, − disabled) and T-0003-080b (custom step mid-range). Counter snapshots now match Step 5's acceptance criteria. | Step 5 table |
| **N-1** useA2UIState re-mount with different spec | Added T-0003-013b. Locked decision: state resets on spec identity change. | Step 1 table |
| **N-2** Form `submitAction` without `submitLabel` | Added T-0003-103b. Locked: `submitLabel` controls visibility regardless of action presence. | Step 7 table |
| **N-3** AppRunner non-happy regression branches | Added T-0003-115b/c (loading + error states). | Step 8 table |
| **N-4** TextInput focus border (Sable line 402) | Added T-0003-088d + T-0003-090b snapshot. | Step 6 table |
| **N-5** Breaking-change analysis for Dispatch sig | Added T-0003-021b explaining why TS function compatibility makes this non-breaking. | Step 1 table |



## Context

ADR-0002 shipped the chat-create-publish loop end-to-end. The pipeline produces valid A2UI specs (verified — four successful generations on 2026-05-02 yielded multi-view, stateful specs with Container/Heading/Text/Button/Counter/Image), persists them, and exposes them through `/me/projects` and the Owner-mode AppRunner. **What the user sees in AppRunner today is "[Unimplemented: Container]" and nothing else** because `packages/a2ui-renderer/src/render.tsx` only handles `Heading` and `Text` (lines 38–43). Every spec the model produces wraps content in a `Container` at the root, so the renderer hits its fallback and stops.

This ADR closes that gap. It is scoped to **rendering and interacting with A2UI specs in the existing AppRunner host**. It does not add new screens, new tabs, or new modes. The Library tab, browse-by-handle, AppRunner Try/Remix modes, and TestFlight pipeline are deferred to **ADR-0004 (Library & Ship)**.

Three forces shape this slice:

1. **Robert's product spec already enumerates the renderer requirements.** AC-R1 through AC-R5 (`docs/product/app-creation-poc.md` lines 116–120) name all 10 components, the 4 action types, the snapshot-test discipline, and the byte-equal-render invariant. This is execution, not discovery.

2. **Sable's UX has detailed per-component visual treatment** (`docs/ux/app-creation-poc-ux.md` §A2UI Catalog Visual Treatment, lines 396–407). Every component has token-driven styling, every action has feedback semantics. The renderer doesn't get to invent its own visuals — it follows that table verbatim.

3. **The schema is the contract** (`packages/a2ui-schema/src/index.ts`). Exactly 10 component types, exactly 5 action types (`set`, `increment`, `decrement`, `toast`, `navigate`). The renderer's job is to be a faithful interpreter of that contract — no more, no less.

> **What if we do nothing (don't write this ADR):** Colby looks at AppRunner's existing reducer, decides to inline the rest of the renderer in `apps/mobile/src/screens/AppRunner/`, and we ship a renderer that's structurally tied to one host. ADR-0004 (Try mode in a different mode-shape; Library tile previews) then has to fork the rendering logic, and the workspace boundary in ARCHITECTURE.md §6 silently dies. That's the failure mode this ADR exists to prevent.

## Decision

Build the **complete A2UI renderer in `packages/a2ui-renderer/`** — all 10 catalog components, all 5 action types, multi-view navigation, and a single state engine that AppRunner consumes via a hook. AppRunner's current in-screen reducer (`apps/mobile/src/screens/AppRunner/index.tsx:50–120`) moves into the renderer package as a reusable hook. The renderer remains a pure function of `{node, state, dispatch}` per ARCHITECTURE.md §6 — no app-specific contexts, no side effects, no refs outside the spec. Theme tokens reach the renderer through a small `RendererThemeProvider` that the host installs at AppRunner mount.

### Architectural choices, with rationale and citations

#### A. State engine lives in the renderer package, not in AppRunner (per ARCHITECTURE.md §6 + Sable Notes-for-Cal #1)

A `useA2UIState(spec)` hook in `packages/a2ui-renderer/src/state/` returns `{state, dispatch, currentViewId, navigate}`. AppRunner imports it and stops owning the reducer.

- **Why move it?** ADR-0004 ships Try mode (browser viewing another user's app). Try mode and Owner mode share the engine; both will mount the same renderer. Centralizing the state contract now means ADR-0004 doesn't refactor the reducer out of AppRunner — it just calls `useA2UIState` with `{persistKey: undefined}` instead of `{persistKey: projectId}`.
- **Why a hook, not a Map-with-subscribers store?** Sable Notes-for-Cal #1 picks the lighter option for M1. `useReducer` + a `Record<id, A2UIValue>` snapshot per render is simpler than a subscription primitive and matches the existing AppRunner shape. We can introduce subscribers in Phase 2 only if `Form` performance under deep nesting forces it.
- **Initial state seeding:** `useA2UIState` initializes from `spec.initialState ?? {}` — closes a gap in the current AppRunner reducer (which starts with an empty `Map`).

#### B. View navigation: replace, not push/pop (no history stack at M1)

`navigate(viewId)` switches `currentViewId`. The previous view is unmounted; its state values persist in the same shared state record. There is no view history. Tapping back from AppRunner exits the rendered app entirely.

- **Why no history?** Sable's UX doesn't show a renderer-internal back button. The AppRunner top-bar back chevron is the *only* nav primitive at M1. Adding renderer-internal history requires a UI affordance we don't have a design for.
- **What happens on `navigate(viewId)` with an unknown viewId?** No-op. Log via the renderer's logger sink (Step 1) at `warn` level, do not throw. Same posture as the existing AppRunner dispatcher's `navigate` no-op (`apps/mobile/src/screens/AppRunner/index.tsx:114–116`).
- **What about state persistence across nav?** A2UI state is keyed by `id`, not by view. `Toggle.id="dark_mode"` keeps its value across views by design — that's the spec contract.

#### C. Theme reaches the renderer via a RendererThemeProvider (per Sable Notes-for-Cal: "renderer accepts theme as a context provided by the host app")

The renderer cannot import from `apps/mobile/src/theme/` (CLAUDE.md §0 workspace boundary). It defines its own `RendererTheme` shape (subset of mobile's tokens — only what the catalog needs) and a Context. AppRunner converts `useTheme()` into a `RendererTheme` and wraps the rendered tree in `<RendererThemeProvider value={...}>`.

- **Why a context, not props?** Threading theme through every recursive `NodeRenderer` doubles the render signature for marginal benefit. Sable explicitly sanctions context for theme.
- **Why not import the mobile theme?** Workspace cycle. `packages/a2ui-renderer` cannot depend on `apps/mobile`. It also keeps the renderer reusable in a future web host.
- **Renderer theme shape (locked at M1):** `{spacing: Spacing, radius: Radius, palette: Palette, typography: Typography}` — same keys as mobile's, narrower types (only what the 10 components consume).

#### D. Components are pure functions; the dispatcher is the *only* interaction primitive (per ARCHITECTURE.md §6 Rule)

Every component file in `packages/a2ui-renderer/src/components/<Type>.tsx` exports a default that takes `{node, state, dispatch}` (plus `theme` from context). No `useEffect`, no `useNavigation`, no `useTheme()` from app-shell. Interactive components (`Button`, `Counter`, `TextInput`, `Toggle`, `Form`) wire `onPress`/`onChangeText`/`onValueChange` to a single `dispatch(action)` call.

- **Closed action set:** `set | increment | decrement | toast | navigate`. The renderer never executes arbitrary code.
- **Dispatch signature change:** the existing `Dispatch = (action, state) => void` in `packages/a2ui-renderer/src/types.ts` simplifies to `Dispatch = (action) => void`. The `state` argument was informational only — the host's reducer always read state from its own closure, never from this parameter. The current AppRunner (`apps/mobile/src/screens/AppRunner/index.tsx:99–120`) is the only caller, and removing the unused arg is a 4-line internal change. Components still receive `state` as a prop (for *display* — Counter reads `state[node.id]` to show the current value), but they don't pass it back when dispatching.
- **Toast action goes UP, not down (per Sable Notes-for-Cal #2):** the renderer's `dispatch` calls a `toast` callback supplied by the host. The renderer doesn't render its own toast UI. This already works in AppRunner (`toast.show(action.message)` at line 112) — Step 1 just preserves the contract when the dispatcher moves into the package.
- **State is stored as a `Map<string, A2UIValue>` internally, exposed as a frozen `Record<string, A2UIValue>` to components.** Map prevents accidental prototype pollution from spec-author-controlled `targetId` keys (`__proto__`, `constructor`, etc.); the frozen record at the boundary keeps components from mutating state directly. T-0003-022 enforces.

#### E. Components live at `packages/a2ui-renderer/src/components/` — one file per type

Per ARCHITECTURE.md §6: `packages/a2ui-renderer/components/`. The current package puts source under `src/`, so the actual path is `packages/a2ui-renderer/src/components/<Type>.tsx`. Same intent.

- **Why one file per type?** Matches the existing `apps/mobile/src/components/` shape and lets snapshot tests live alongside (`<Type>.test.tsx`). No god-files, no `components/index.ts` barrel — `render.tsx` does the type-discriminated switch.
- **Snapshot tests are mandatory** (CLAUDE.md §4 + AC-R3). One snapshot per props variant per component, **each enumerated as its own T-ID** in the test tables (no "covers many variants" rollups — each failable assertion is a row). Updates require an explicit reviewer note (CLAUDE.md §8).

#### F. Render-error fallback at AppRunner, not inside the renderer (per Sable UX line 307 + chat-creation-ux line 444)

If `render({spec, …})` throws, AppRunner catches via an Error Boundary and shows the apologetic copy: *"This app didn't render correctly. Try recreating it. [Back to library]"*. P0 instrumentation: emit `render_failed` event with `project_id`, `render_hash`, `mode`.

- **Why outside the renderer?** Error boundaries need React class components; the renderer stays a function. AppRunner is the natural host since it owns the navigation primitive (Back).
- **What can throw?** Schema mismatches the renderer doesn't know how to handle (we keep an `[Unimplemented: <Type>]` *visible* fallback for any type the discriminator misses — defense in depth, but Step 1 removes the catch-all branch since we ship all 10).
- **`navigate` to bad viewId does NOT trip the boundary** — see C. Boundary triggers on schema/runtime exceptions, not action no-ops.

#### G. Render determinism: locked by AC-R4 via two **distinct** test axes

The renderer must be a pure deterministic function of (spec, state). Same inputs → same React tree. No `Math.random`, no `Date.now()`, no entropy. Step 8 has two test families that lock different invariants:

1. **Render-stability** (T-0003-113a, T-0003-113b): render the same fixture spec twice into separate `react-test-renderer` hosts → `JSON.stringify(toJSON())` of each is byte-equal. This catches "we accidentally added entropy or non-deterministic React internals."
2. **Spec-canonicalization** (T-0003-114a, T-0003-114b): compute `renderHash(spec)` against a hash committed as a fixture file. This catches "we accidentally changed how we canonicalize specs (sort order, whitespace, etc.)."

These test different things. The render hash is on the *spec*, the deep-equal is on the *rendered tree*. Both must hold for AC-R4 to be locked. Two fixtures (Pomodoro + Tip Splitter, both real generations from 2026-05-02) defend against single-fixture passing-by-design. Future schema additions that add a new component type will ship with their own fixtures + hashes per the 5-step gate in ARCHITECTURE.md §6.

#### H. Form.submitAction wires through the dispatcher, not a separate callback

`Form` has an optional `submitAction: A2UIAction`. When `Form.submitLabel` button is pressed, the renderer calls `dispatch(submitAction, state)`. If `submitAction` is undefined, the submit button is hidden (per Sable §A2UI Catalog Visual Treatment line 406).

- **Why not a synthetic `submit` action type?** Schema doesn't have one. Reusing the closed action set keeps the surface small.
- **Validation?** Out of scope at M1. The submit just fires whatever action the spec author specified. Sable's UX line 406 doesn't describe inline validation — that's Phase 2.

#### I. Counter actions: inc/dec respect `min`/`max` by **clamping** (not no-op)

`Counter` schema has optional `min`, `max`, `step`. The component renders `−` and `+` buttons that dispatch `increment`/`decrement` with `by: step ?? 1`. The state engine's `INCREMENT`/`DECREMENT` reducer cases (currently in AppRunner lines 66–75) move into `useA2UIState` and gain bounds-checking: if the next value would exceed `max`, **clamp to `max`**; if it would fall below `min`, **clamp to `min`**. If the current value is already at the boundary, return state unchanged (referential equality preserved — no needless re-render).

- **Why clamp, not no-op?** A `Button.action: increment(counter_id, 100)` from a "+ Add 100" button on a counter with `max: 50` should land you at 50, not at the previous value. Clamping is the user-friendlier semantic and matches mobile UI conventions for steppers.
- **Why bound at the engine, not the component?** A programmatic `Button.action: increment(counter_id, 5)` fires through the same dispatch path as Counter's own `+`. The bound is on the state, not the UI element. Either entry point gets the clamp.
- **What does the Counter button do at boundary?** Disabled visually + dispatch is a no-op (current value already at bound). Matches Sable §A2UI Catalog Visual Treatment line 404.

##### §I.1 Bounds wiring (resolves Roz Step-1 QA Issue 1)

The reducer's `INCREMENT`/`DECREMENT` cases accept `{min?, max?}` on the internal action. The `A2UIAction` (spec-level) `increment`/`decrement` types do **not** carry bounds — they only carry `{targetId, by?}`, since bounds belong to the Counter node, not the action.

The hook is where bounds get injected. **Locked decision for Step 5:** `useA2UIState` builds a `Map<targetId, {min?, max?, step?}>` (the `counterBoundsMap`) by walking `spec.views` once on mount, memoized with `useMemo([spec])`. The map is rebuilt only when `spec` identity changes (already a state-reset trigger per T-0003-013b). Inside the hook's dispatch translation:

```ts
case 'increment': {
  const bounds = counterBoundsMap.get(action.targetId)
  internalDispatch({
    type: 'INCREMENT',
    id: action.targetId,
    by: action.by ?? bounds?.step ?? 1,
    min: bounds?.min,
    max: bounds?.max,
  })
  break
}
```

This means:
- A programmatic `Button.action: increment(counter_id, 100)` on a Counter with `max: 50` clamps to 50 ✓ (bounds resolved from the spec at action time).
- Dispatching to a `targetId` that isn't a Counter id: bounds map returns `undefined`, the action fires unbounded — same posture as before, no regression.
- Default `by` falls back to the Counter's `step` first, then to 1 (matches existing `step ?? 1` semantics).

**Why this option (Roz's option (c)-with-pre-computed-map) over (a) Counter-wraps-dispatch:** option (a) requires every Counter component instance to re-derive bounds from its own node and wrap the dispatch — but that doesn't help programmatic Button-driven dispatches that don't originate inside a Counter render. The bounds belong to the spec, not to the UI surface that emits the action. Option (c) puts the lookup in the only place that knows about the whole spec.

**Step 5 implementation note:** Colby's Step 5 work adds the `counterBoundsMap` build + the dispatch translation enrichment. Step 5 also adds a Step-1-amendment test (T-0003-011-hook-clamp) that re-asserts T-0003-011's behavior at the hook level (currently the hook-level test at `useA2UIState.test.tsx` line 148 documents the gap; Step 5 closes it).

#### J. `set` action with type-mismatched value: ignored, logged in dev (defensive)

`set("counter_id", "hello")` where `counter_id` was previously a number → logged as `a2ui_set_type_mismatch` at `warn`, state unchanged. Same posture for `set("toggle_id", 5)`. The schema validates spec-level types, but spec-author bugs in `Button.action.value` aren't catchable at validation time (the value is `string|number|boolean|null` — Zod can't constrain "must match the target's type").

- **Why not throw?** Throw → render-error fallback → user-visible failure for a spec-author bug. Logging keeps the app usable.
- **Why warn-log, not silently drop?** During eval-harness runs we want this signal. It's a generation-quality signal: "the LLM is producing actions whose values don't match their target's type."

#### K. Renderer logger sink: passed in via context, defaults to no-op

The renderer is a workspace package; it can't import from `apps/mobile/src/logger`. We expose a `RendererLogger` context (`{warn(msg, fields), error(msg, fields)}`). AppRunner injects the mobile logger; tests inject a Jest spy.

- **Why not silently swallow?** Generation-quality and runtime-anomaly signals are useful for the eval harness and Sentry forwarding.
- **Why not Pino directly?** Workspace boundary; Pino is server-only. The renderer logger is structural — one method per level — to keep the contract tiny.

#### L. Component package adds `@testing-library/react-native` for interaction tests

Renderer package's `package.json` currently only has `react-test-renderer` — fine for snapshots, insufficient for "tap the Counter `+` button → assert dispatch fires with `increment`." Step 1 adds `@testing-library/react-native@^12` (already pinned in `apps/mobile/package.json`).

- **Why not stub the gesture system manually?** RN's gesture system has subtle quirks that change between RN minor versions. RTL maintains the abstraction.
- **Already sanctioned?** Yes — used in `apps/mobile/src/screens/AppRunner/components/PublishSheet.test.tsx`.

#### M. `pipeline-state.md` placeholder split: ADR-0003 = renderer; ADR-0004 = library + ship

The placeholder name `ADR-0003-render-ship.md` in `docs/pipeline/pipeline-state.md` line 27 conflates two slices. Step 8 of this ADR includes a small chore: rename the row to `ADR-0003 (Renderer)` pointing at `docs/adrs/ADR-0003-renderer.md` (this file), and add a new pending row: `ADR-0004 (Library & Ship) | Cal | ⬜ pending | docs/adrs/ADR-0004-library-and-ship.md`.

- **Why now?** It's a one-line edit that prevents downstream confusion. Ellis doesn't have to remember.
- **Why not a separate ADR?** It's a doc edit, not a decision worth its own ADR.

## Alternatives Considered

### Alternative 1: Inline the renderer in `apps/mobile/src/screens/AppRunner/`

- **Upside:** No workspace boundary to manage. AppRunner reducer + components in one place.
- **Downside:** Violates ARCHITECTURE.md §6 ("two distinct component layers — do not conflate them"). ADR-0004 Try mode would have to either fork the renderer or re-extract it later. The two-layer boundary is the most-cited rule in the codebase for a reason.
- **Why not:** Architecture rule is binding. Re-extracting later is more painful than building it cleanly now. The schema package is already extracted; extracting the renderer matches that posture.

### Alternative 2: Subscriber-store state primitive instead of `useReducer`

- **Upside:** Surgically re-renders only the components whose state changed. Better for `Form` with 20 `TextInput`s.
- **Downside:** Builds a Notion-grade state primitive in M1. Sable Notes-for-Cal #1 explicitly says "this is M1, not Notion." We don't have evidence of a real perf problem yet — a Pomodoro Timer's 5-key state record re-renders a 20-node tree in <1ms.
- **Why not:** Premature. M1 wants the lighter option. Phase 2 can swap if a real `Form` benchmark trips a 60fps threshold.

### Alternative 3: Component-prop theme instead of context

- **Upside:** Components are dependency-injection-pure. Trivial to test in isolation.
- **Downside:** Every recursive `NodeRenderer` call has to thread `theme` through. Doubles the API surface for marginal gain.
- **Why not:** Sable explicitly OK'd context-as-injection for theme. Components stay pure of *app-specific* contexts; a renderer-owned theme context is fair game.

### Alternative 4: Render-error catch *inside* the renderer

- **Upside:** Renderer is self-contained; the host doesn't need to install an Error Boundary.
- **Downside:** React Error Boundaries are class components. The renderer stays a function. Co-locating error UI also pulls Sable's render-error copy + the Back button into the renderer package, which then needs navigation knowledge it shouldn't have.
- **Why not:** Hosting concern stays at the host. Same pattern as Sentry's `withErrorBoundary` — boundary lives at app layer, not in pure-function packages.

### Alternative 5: Ship a subset (e.g., Container + Image + Button + Heading + Text), defer Form/List/Toggle/Counter/TextInput to ADR-0004

- **Upside:** Smaller PR, faster merge.
- **Downside:** Robert's AC-R1 says all 10. The eval harness running in CI will start producing specs that exercise `Counter` and `Toggle` (we already see them in real generations). A partial renderer means continued "[Unimplemented: <Type>]" for a subset of generated apps — same problem we have today, just smaller. Mid-ADR partial state is worse than fully done or fully deferred.
- **Why not:** Scope-creep concerns are real, but in this case the floor is "all 10." We're better off shipping the full set and being disciplined about *not* expanding into ADR-0004 territory (Library, Try, Remix).

### Alternative 6: Render to a non-RN intermediate (e.g., headless React + adapters)

- **Upside:** Future-proofs for a web host.
- **Downside:** M1 is iOS-only (ARCHITECTURE.md §13). The web host doesn't exist and isn't on the roadmap until the renderer has proven itself.
- **Why not:** YAGNI. The schema is already serialization-ready; if a web renderer materializes, it can re-implement the same `(node, state, dispatch) => ReactElement` contract in DOM terms.

## Consequences

### Positive
- AppRunner becomes a *real* app surface: generated apps display and behave per Sable's spec. The "[Unimplemented: Container]" fallback is gone.
- All four interactive primitives (`Button`, `Counter`, `Toggle`, `TextInput`) drive a single dispatcher → eval prompts that exercise them now produce visible-and-poke-able apps. AC-R5 closes.
- The renderer becomes a portable workspace package. ADR-0004's Try mode mounts the same package with `useA2UIState({persistKey: undefined})`. No fork risk.
- AC-R4 (byte-equal-render-on-reopen) is locked by a snapshot test against `render_hash`, so future changes can't silently drift.
- ARCHITECTURE.md §6's two-layer rule survives — the renderer is its own package, the catalog stays closed at 10, the dependency graph is one-way (mobile → renderer → schema).

### Negative
- AppRunner's existing reducer is replaced by an imported hook. That's a breaking change to AppRunner's internals, but the contract surface (top-bar CTA, render call, BottomSheet placement) is identical. The diff is internal.
- `pipeline-state.md` and `ARCHITECTURE.md` ADR-tag list both gain entries. Ellis has another one-line edit on commit.
- Snapshot tests are brittle by design — every legitimate visual change requires an `--updateSnapshot` and a reviewer note. The exact snapshot count is enumerated in the test tables: **29 named snapshot T-IDs across Steps 2–7** (Step 2: 7, Step 3: 8, Step 4: 3, Step 5: 4, Step 6: 5, Step 7: 2), each one a discrete failable assertion. That's the price of AC-R4.
- The renderer logger sink is a new mini-contract. It exists because the workspace boundary forbids importing the mobile logger directly. A small price for cleanliness.

### Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Existing AppRunner integration tests (`apps/mobile/src/screens/AppRunner/index.test.tsx`) break when the in-screen reducer moves into the renderer package | High | Step 8's first task is to update those tests to mock the new `useA2UIState` import boundary. Test count delta is tracked. |
| RN Switch (Toggle) doesn't honor `trackColor` reliably across iOS versions | Low | Sable Notes-for-Colby #3 already calls this out — wrap in row container with explicit 56pt min-height; Step 6 follows that pattern. |
| `react-test-renderer`'s `toJSON()` output for `Animated.View` (Counter scale animation) varies by RN minor version, breaking snapshots | Medium | Mock `react-native-reanimated` in Jest setup (already done in `apps/mobile`'s jest config); render Counter with `useReducedMotion` returning `true` in tests for deterministic output. |
| `Form` recursion + `set` actions trigger re-renders that exceed 60fps on a Pomodoro-sized tree | Low | Sable Notes-for-Colby #8 caps depth at 8. Step 1's `useA2UIState` returns a memoized state record; React 19 compiler optimizes the per-node closures. If a real measurement shows trouble, fall back to subscriber-store (Alternative 2) in a follow-up ADR. |
| `navigate` to a non-existent viewId silently breaks user flows ("nothing happens") | Medium | Step 1 logs at warn. If the eval harness in ADR-0004 starts catching this pattern, we add stricter spec validation (every `navigate` action's `viewId` must exist in `spec.views`). For M1 it's a render-time defensive no-op. |
| Renderer determinism breaks because RN's internal id-gen for `Switch`/`TextInput` includes randomness in some versions | Medium | Step 8's determinism test renders into `react-test-renderer` (no native bridge) and compares `toJSON()` — RN internals don't appear there. If a future test environment exposes an entropy source, mock `Math.random` and `Date.now` at the test's `beforeAll`. |
| `@testing-library/react-native` version drift between `apps/mobile` and `packages/a2ui-renderer` | Low | Pin the same major version (`^12.4.0`) in both `package.json` files. CI's `pnpm typecheck` catches mismatched type peers. |

## Implementation Plan

> Each step is mergeable on its own. Steps 1–7 each unlock one concrete capability; Step 8 makes everything visible to the user.

### Step 1: State engine + theme provider + render-error infrastructure

- **Files to create:**
  - `packages/a2ui-renderer/src/state/useA2UIState.ts` — hook returning `{state, currentViewId, dispatch}`.
  - `packages/a2ui-renderer/src/state/reducer.ts` — pure reducer for `SET | INCREMENT | DECREMENT | NAVIGATE` internal action types (the closed renderer-internal vocabulary, distinct from spec-level `A2UIAction`).
  - `packages/a2ui-renderer/src/theme/RendererThemeProvider.tsx` — Context provider + `useRendererTheme()` hook + `RendererTheme` type.
  - `packages/a2ui-renderer/src/logger/RendererLoggerProvider.tsx` — Context provider with no-op default; `useRendererLogger()` hook.
- **Files to modify:**
  - `packages/a2ui-renderer/src/types.ts` — extend `RendererTheme` with the locked shape (spacing/radius/palette/typography).
  - `packages/a2ui-renderer/src/index.ts` — export `useA2UIState`, `RendererThemeProvider`, `RendererLoggerProvider`, `RendererTheme`.
  - `packages/a2ui-renderer/package.json` — add `@testing-library/react-native@^12.4.0` to devDependencies.
- **Acceptance criteria:**
  - `useA2UIState(spec)` seeds state from `spec.initialState ?? {}`.
  - `dispatch({type: 'set', targetId: 'x', value: 7}, state)` yields next state with `state.x === 7`.
  - `dispatch({type: 'increment', targetId: 'c', by: 2})` increments by 2; default `by` is 1; clamps to `max` if the next value would exceed it; if already at `max`, returns referentially-equal state (no re-render).
  - `dispatch({type: 'decrement', targetId: 'c'})` decrements by 1; clamps to `min` symmetrically.
  - `dispatch({type: 'toast', message: 'hi'}, state)` calls the toast callback supplied via `useA2UIState` options; does not mutate state.
  - `dispatch({type: 'navigate', viewId: 'settings'}, state)` updates `currentViewId` if `viewId` exists in `spec.views`; otherwise no-op + warn log.
  - `set` with type-mismatched value relative to prior typeof: state unchanged + warn log (`a2ui_set_type_mismatch`).
  - `RendererThemeProvider` exposes a default-light theme if no value is provided (defensive).
  - `useRendererLogger()` returns a no-op logger if no provider is mounted.
  - The reducer is a pure function — same inputs produce same output, no mutation of input state object (proven by deep-equality assertion with frozen input).
- **Code shape:**
  ```ts
  // useA2UIState.ts
  export function useA2UIState(
    spec: A2UISpec,
    opts?: {onToast?: (msg: string) => void},
  ): {state: RenderState; currentViewId: string; dispatch: Dispatch} { /* ... */ }

  // reducer.ts
  type InternalAction =
    | {type: 'SET'; id: string; value: A2UIValue}
    | {type: 'INCREMENT'; id: string; by: number; min?: number; max?: number}
    | {type: 'DECREMENT'; id: string; by: number; min?: number; max?: number}
    | {type: 'NAVIGATE'; viewId: string};
  type InternalState = {state: RenderState; currentViewId: string};
  export function reducer(s: InternalState, a: InternalAction): InternalState { /* ... */ }
  ```
- **Estimated complexity:** Medium.

### Step 2: Container + List

- **Files to create:**
  - `packages/a2ui-renderer/src/components/Container.tsx`
  - `packages/a2ui-renderer/src/components/Container.test.tsx`
  - `packages/a2ui-renderer/src/components/List.tsx`
  - `packages/a2ui-renderer/src/components/List.test.tsx`
- **Files to modify:**
  - `packages/a2ui-renderer/src/render.tsx` — add `Container` and `List` cases to the discriminated switch; remove the catch-all `[Unimplemented: ...]` for these types (keep for the still-unimplemented ones).
- **Acceptance criteria:**
  - `Container` renders a `View` with `flexDirection: row|column`, mapping `padding`/`gap`/`align`/`justify` from spec values to flexbox via theme tokens.
  - `Container` recurses into `children: A2UINode[]` rendering each via the same `NodeRenderer`.
  - `List` renders a vertical stack with `md` gap by default. `separator: true` interleaves `1px` `bg.subtle` lines instead of gap.
  - Both honor accessibility: `Container` and `List` do not add roles (they're layout); their children carry their own roles.
  - Snapshot tests cover: Container with `direction: row`, `direction: column`, each padding/gap level, each align/justify; List with separator on/off.
- **Code shape:**
  ```tsx
  export function ContainerRenderer({node, state, dispatch}: NodeProps<A2UIContainerNode>) {
    const theme = useRendererTheme();
    const style = {
      flexDirection: node.direction,
      padding: theme.spacing[node.padding ?? 'none'],
      gap: theme.spacing[node.gap ?? 'none'],
      alignItems: alignMap[node.align ?? 'stretch'],
      justifyContent: justifyMap[node.justify ?? 'start'],
    };
    return (
      <View style={style}>
        {node.children.map((child, i) => (
          <NodeRenderer key={i} node={child} state={state} dispatch={dispatch} />
        ))}
      </View>
    );
  }
  ```
- **Estimated complexity:** Medium.

### Step 3: Image + Heading + Text (display primitives)

- **Files to create:**
  - `packages/a2ui-renderer/src/components/Image.tsx` + test
- **Files to modify:**
  - `packages/a2ui-renderer/src/components/Heading.tsx` (extracted from current inline `render.tsx` case) + test
  - `packages/a2ui-renderer/src/components/Text.tsx` (extracted) + test
  - `packages/a2ui-renderer/src/render.tsx` — replace inline cases with imports from `./components/`.
- **Acceptance criteria:**
  - `Heading` honors `level: 1|2|3` per Sable §A2UI Catalog Visual Treatment line 398: level 1 = display + padding-top: lg; level 2 = heading1 + padding-top: md; level 3 = heading2 + padding-top: sm. Always `accessibilityRole="header"`.
  - `Text` honors `weight: bold` (body-strong) and `color: muted | destructive`.
  - `Image` uses RN `Image`, applies `aspectRatio` if set, falls back to `maxHeight: 240` with `bg.subtle` letterbox if not. `alt` becomes `accessibilityLabel`.
  - Image doesn't error on a 404'd URL — RN's default behavior (broken-image placeholder) is acceptable; Sable's UX line 400 doesn't specify a custom error state for M1.
- **Estimated complexity:** Low.

### Step 4: Button + dispatcher integration test

- **Files to create:**
  - `packages/a2ui-renderer/src/components/Button.tsx` + test
- **Files to modify:**
  - `packages/a2ui-renderer/src/render.tsx` — add Button case.
- **Acceptance criteria:**
  - `Button` renders a `Pressable` with `accessibilityRole="button"` and `accessibilityLabel={node.label}` (Sable Notes-for-Colby #9).
  - Variant styling per Sable line 401: primary → `bg.primary` + `primaryFg`; secondary → `bg.subtle` + `text.primary` + `border.subtle`; destructive → `bg.destructive` + `destructiveFg`. Padding 12pt vertical / 20pt horizontal, `radius: md`.
  - Pressed state: `style={({pressed}) => [..., pressed && {opacity: 0.92}]}` — close enough to "8% darken" without an overlay.
  - Haptic on press: `Haptics.impactAsync(ImpactFeedbackStyle.Light)` from `expo-haptics`. Wrapped in try/catch (Haptics throws on simulators without haptic hardware).
  - On press: `dispatch(node.action, state)`. The dispatcher then routes to the host's toast/state/navigate.
  - **Negative test:** Button with no action defined in schema (`action` is required, so this case is impossible at the schema level — no test needed; document why in a comment).
  - **Negative test:** Button whose `action.type === 'navigate'` to an unknown viewId fires the warn log path, doesn't throw.
- **Code shape:**
  ```tsx
  export function ButtonRenderer({node, state, dispatch}: NodeProps<A2UIButtonNode>) {
    const theme = useRendererTheme();
    const variantStyle = variantStyles[node.variant ?? 'primary'](theme);
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={node.label}
        onPress={() => {
          try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
          dispatch(node.action);
        }}
        style={({pressed}) => [styles.base, variantStyle, pressed && {opacity: 0.92}]}
      >
        <Text style={[theme.typography.bodyStrong, {color: variantStyle.color}]}>
          {node.label}
        </Text>
      </Pressable>
    );
  }
  ```
- **Estimated complexity:** Medium.

### Step 5: Counter

- **Files to create:**
  - `packages/a2ui-renderer/src/components/Counter.tsx` + test
- **Files to modify:**
  - `packages/a2ui-renderer/src/render.tsx` — add Counter case.
  - `packages/a2ui-renderer/src/state/useA2UIState.ts` — **add `counterBoundsMap` (per §I.1)**: walk `spec.views` once via `useMemo([spec])` to build `Map<targetId, {min?, max?, step?}>`. In the dispatch translation for `increment`/`decrement`, look up bounds and enrich the internal action with `{min, max}` and the `step`-driven default `by`. Closes Roz's Step-1 QA Issue 1 — the dispatch-layer bounds gap.
  - `packages/a2ui-renderer/src/state/useA2UIState.test.tsx` — relabel the Step-1 line-148 doc-of-gap test (currently mis-labeled T-0003-011) to **T-0003-011-hook-gap** and add **T-0003-011-hook-clamp** asserting the new clamp behavior end-to-end at the hook level.
- **Acceptance criteria:**
  - Counter renders a row: `−` button (square 44pt, secondary variant), value (heading2 style, center, min-width 60pt), `+` button (square 44pt, secondary variant). Label above (caption style + text.muted).
  - Value reads from `state[node.id]` as number (default `min ?? 0` if undefined).
  - `+` press → `dispatch({type: 'increment', targetId: node.id, by: node.step ?? 1}, state)`. `−` press → matching decrement.
  - At `value === max`: `+` is disabled (`accessibilityState={{disabled: true}}`); same for `−` at `value === min`.
  - `accessibilityLabel` follows Sable line 322: `"<label>, current value <n>"`. `accessibilityActions` array includes `increment` and `decrement` (RN A11y standard).
  - Haptic on inc/dec (light impact, wrapped per Step 4).
  - **No scale animation in M1** — Sable's UX line 413 mentions it, but Notes-for-Colby #7 says "Reduced-motion check first" and we don't want to ship a flaky reduced-motion check at the M1 boundary. Phase 2 polish.
  - Snapshot tests: zero state, mid-range state, at-min state (− disabled), at-max state (+ disabled), with custom `step`.
- **Estimated complexity:** Medium.

### Step 6: TextInput + Toggle

- **Files to create:**
  - `packages/a2ui-renderer/src/components/TextInput.tsx` + test
  - `packages/a2ui-renderer/src/components/Toggle.tsx` + test
- **Files to modify:**
  - `packages/a2ui-renderer/src/render.tsx` — add cases.
- **Acceptance criteria:**
  - **TextInput:** RN `TextInput` with label above (caption style), `placeholder` from prop, `multiline` switches to a 5-line max with internal scroll. On `onChangeText`: `dispatch({type: 'set', targetId: node.id, value: text}, state)`. Value reads from `state[node.id]` (string default `''`). Border focus turns `palette.primary`. `accessibilityLabel` = `node.label`.
  - **Toggle:** RN `Switch` wrapped in a row container (Sable Notes-for-Colby #3). Label on left, switch on right, full-width row, `min-height: 56pt`. Reads `state[node.id]` as boolean (default `node.defaultValue ?? false`). On change: `dispatch({type: 'set', targetId: node.id, value: nextBool}, state)`. `accessibilityRole="switch"`, label from `node.label`.
  - **Both:** Snapshot tests cover labelled, unlabelled (where allowed), placeholder/no-placeholder, multiline-on/off (TextInput), default-on/off (Toggle).
- **Estimated complexity:** Medium.

### Step 7: Form

- **Files to create:**
  - `packages/a2ui-renderer/src/components/Form.tsx` + test
- **Files to modify:**
  - `packages/a2ui-renderer/src/render.tsx` — add Form case.
- **Acceptance criteria:**
  - Form renders a vertical stack with `md` gap. Each field in `fields: A2UINode[]` recurses through `NodeRenderer`.
  - If `submitLabel` is set: a primary full-width Button below. On press: `dispatch(submitAction, state)` if `submitAction` is set; otherwise the button is hidden.
  - Form does NOT inject its own state — fields' `id`s drive state directly via the existing dispatcher. Form is a layout + submit primitive.
  - `formId` is reserved for future Phase 2 form-level events; M1 doesn't read it but the schema requires it.
  - Snapshot tests: empty fields (just submit), single TextInput + submit, mixed fields (TextInput + Toggle + Counter) + submit, no submit.
- **Estimated complexity:** Low.

### Step 8: AppRunner integration + render-error fallback + determinism test + pipeline-state edit

- **Files to create:**
  - `apps/mobile/src/screens/AppRunner/RenderErrorBoundary.tsx` (class component) + test.
  - `packages/a2ui-renderer/src/render.test.tsx` — determinism test using a real fixture spec (load the Pomodoro fixture from `services/api/eval/fixtures/` if present, otherwise inline a representative multi-view spec in the test).
- **Files to modify:**
  - `apps/mobile/src/screens/AppRunner/index.tsx` — replace the in-screen reducer (`ownerStateReducer`, `dispatchOwnerState`, `ownerState`, `ownerDispatch`, the `Map<string, A2UIValue>` machinery) with a single `useA2UIState(spec, {onToast: toast.show})` call. Wrap the `<ScrollView>` body in `<RendererThemeProvider>` and `<RenderErrorBoundary>`. Wire `currentViewId` through.
  - `apps/mobile/src/screens/AppRunner/index.test.tsx` — update tests for the new import boundary; mock `useA2UIState` for the deterministic-host shape.
  - `docs/pipeline/pipeline-state.md` — rename row 27 to point at `ADR-0003-renderer.md` with the new title; insert a new row for ADR-0004.
  - `.claude/references/adr-index.md` — add the ADR-0003 row with tags `a2ui, mobile-shell`.
- **Acceptance criteria:**
  - AppRunner renders the saved Pomodoro spec end-to-end on the iOS simulator: title + state-driven `25:00` heading + 3 working buttons (Start/Pause/Reset firing toasts) + a Counter (label + value + working `+`/`−`).
  - `useA2UIState`'s seeded `currentViewId` matches `spec.initialViewId` on mount.
  - `navigate(viewId)` action driven by a Button switches the rendered view in-place; previous view's mounted components unmount.
  - Render-error boundary catches a forced-throw inside a child component and shows: icon + heading "This app didn't render correctly." + body "Try recreating it." + button "Back to library" (taps `navigation.goBack()`). Emits one log at `error` level: `render_failed` with `{projectId, renderHash, mode}` (mode is `'owner'` for ADR-0003 scope; ADR-0004 will widen).
  - Determinism test: load fixture spec → render twice into separate `react-test-renderer` hosts → `toJSON()` of each is `JSON.stringify`-equal → asserted hash matches a fixture hash file.
  - `pipeline-state.md` and `adr-index.md` reflect the ADR-0003/0004 split.
- **Estimated complexity:** High (because it's the integration step + the test refactor).

## Comprehensive Test Specification

### Test File Mapping

| Step | Test File | Env |
|---|---|---|
| 1 | `packages/a2ui-renderer/src/state/reducer.test.ts` | jest (node) |
| 1 | `packages/a2ui-renderer/src/state/useA2UIState.test.tsx` | jest (rtl) |
| 1 | `packages/a2ui-renderer/src/theme/RendererThemeProvider.test.tsx` | jest (rtl) |
| 1 | `packages/a2ui-renderer/src/logger/RendererLoggerProvider.test.tsx` | jest (rtl) |
| 2 | `packages/a2ui-renderer/src/components/Container.test.tsx` | jest (rtr) |
| 2 | `packages/a2ui-renderer/src/components/List.test.tsx` | jest (rtr) |
| 3 | `packages/a2ui-renderer/src/components/Heading.test.tsx` | jest (rtr) |
| 3 | `packages/a2ui-renderer/src/components/Text.test.tsx` | jest (rtr) |
| 3 | `packages/a2ui-renderer/src/components/Image.test.tsx` | jest (rtr) |
| 4 | `packages/a2ui-renderer/src/components/Button.test.tsx` | jest (rtl) |
| 5 | `packages/a2ui-renderer/src/components/Counter.test.tsx` | jest (rtl) |
| 6 | `packages/a2ui-renderer/src/components/TextInput.test.tsx` | jest (rtl) |
| 6 | `packages/a2ui-renderer/src/components/Toggle.test.tsx` | jest (rtl) |
| 7 | `packages/a2ui-renderer/src/components/Form.test.tsx` | jest (rtl) |
| 8 | `packages/a2ui-renderer/src/render.test.tsx` | jest (rtr) |
| 8 | `apps/mobile/src/screens/AppRunner/index.test.tsx` (modified) | jest (rtl) |
| 8 | `apps/mobile/src/screens/AppRunner/RenderErrorBoundary.test.tsx` | jest (rtl) |

(rtr = react-test-renderer; rtl = @testing-library/react-native)

### Step 1 Tests — State engine, theme, logger

| ID | Category | Test Description |
|---|---|---|
| T-0003-001 | Happy | `useA2UIState({spec})` returns initial state seeded from `spec.initialState`; missing `initialState` → empty record |
| T-0003-002 | Happy | `currentViewId` initializes to `spec.initialViewId` |
| T-0003-003 | Happy | `dispatch({type:'set', targetId:'x', value:7})` produces next state with `state.x === 7` |
| T-0003-004 | Happy | `dispatch({type:'increment', targetId:'c', by:2})` increments by 2 |
| T-0003-005 | Happy | `dispatch({type:'increment', targetId:'c'})` (no `by`) defaults to 1 |
| T-0003-006 | Happy | `dispatch({type:'decrement', targetId:'c', by:3})` decrements by 3 |
| T-0003-006b | Security | **Workspace boundary lint rule fires at runtime** (R-6 / Roz NF-2). Programmatic ESLint integration test using `ESLint.lintText()` (from `eslint` API) loaded with `packages/a2ui-renderer/.eslintrc.cjs`. The test runs lint against a fixture string containing each forbidden import pattern (`import {useTheme} from '#/theme'`, `import x from 'apps/mobile/foo'`, `import x from '#/lib/api'`, etc., one per pattern). For each pattern, asserts at least one ESLint message with `ruleId === 'no-restricted-imports'`. Also runs lint on a control string with a permitted import (e.g., `import {z} from 'zod'`) and asserts zero messages. If the config is deleted, weakened, or scoped wrong, this test fails — verifying enforcement, not just file existence. |
| T-0003-007 | Happy | `dispatch({type:'toast', message:'hi'})` invokes `opts.onToast('hi')` and does not mutate state |
| T-0003-008 | Happy | `dispatch({type:'navigate', viewId:'settings'})` updates `currentViewId` when `'settings'` exists in `spec.views` |
| T-0003-009 | Boundary | `increment` on a Counter with `state.c === max` returns referentially-equal state (`Object.is(prev, next) === true`) — no needless re-render |
| T-0003-010 | Boundary | `decrement` on a Counter with `state.c === min` returns referentially-equal state |
| T-0003-011 | Boundary | `increment` past `max` (e.g., `state.c=8, by:5, max:10`) clamps to `max:10` (per §I; locked semantic) |
| T-0003-011b | Boundary | `decrement` past `min` (e.g., `state.c=2, by:5, min:0`) clamps to `min:0` |
| T-0003-012 | Negative | `set` with `value` of different `typeof` than current `state[targetId]` warn-logs `a2ui_set_type_mismatch` with payload `{targetId, expectedType, actualType}` and returns state unchanged. **Log payload MUST NOT include the actual mismatched `value`** (it could be a TextInput's password contents) — verified by inspecting the spy call's first-arg fields. |
| T-0003-013 | Negative | `navigate` to unknown viewId warn-logs `a2ui_navigate_unknown_view` with payload `{viewId, knownViewIds: string[]}` and returns state unchanged. **Log payload MUST NOT include the full `spec` or any node content** — verified by spy call inspection. |
| T-0003-013b | Negative | `useA2UIState` called twice with different `spec` values (re-mount simulation) returns *fresh* state for the new spec; stale keys from the first spec do NOT carry into the second. Locked decision: state resets on spec identity change (referential), not on deep equality. |
| T-0003-013c | Negative | `dispatch` invoked after the host component unmounts is a no-op (does not throw, does not warn, does not update an unmounted reducer). Defends against haptic-promise resolving after navigate-back. |
| T-0003-014 | Negative | Reducer does NOT mutate input state object (assert with `Object.freeze(prev.state)` and verify the dispatch returns `next` without throwing) |
| T-0003-015 | Negative | `dispatch` with an unknown internal action type returns state unchanged (defensive against future schema additions before reducer catches up) |
| T-0003-016 | Concurrency | Two synchronous dispatches in the same tick (`dispatch(a); dispatch(b)`) produce a state record reflecting both — no lost-update |
| T-0003-017 | Happy | `RendererThemeProvider` exposes the provided theme via `useRendererTheme()` |
| T-0003-018 | Failure | `useRendererTheme()` outside the provider returns the default-light fallback (no throw) |
| T-0003-019 | Happy | `RendererLoggerProvider` exposes the provided logger via `useRendererLogger()` |
| T-0003-020 | Failure | `useRendererLogger()` outside the provider returns a no-op logger (calling `.warn` doesn't throw) |
| T-0003-021 | Regression | Existing `render({spec, state, dispatch})` API surface is unchanged (function signature, exported types) — verified by importing from index and asserting types compile |
| T-0003-021b | Breaking | `Dispatch` type narrows from `(action, state) => void` → `(action) => void`. **TS function compatibility**: a `(action) => void` callback IS assignable to a slot expecting `(action, state) => void` (extra parameters in declared types are allowed). Therefore this is **not a breaking change at the type level**. Test asserts: importing the new `Dispatch` and assigning a one-arg function compiles; assigning a two-arg function still compiles (TS variance rules); calling `oldDispatch(action)` and `oldDispatch(action, state)` both run, the second-arg value is ignored. Documented decision: AppRunner removes the unused `_state` arg in Step 8, no other callers exist. |
| T-0003-022 | Security | Reducer never reads or writes properties outside the schema-defined keys (e.g., `dispatch({type:'set', targetId:'__proto__', value:'pwn'})` — verify Object's prototype is unchanged after). Internal storage uses `Map<string, A2UIValue>`, not a plain object, to defend at the data-structure level. |

#### Step 1 Test Summary
| Category | Count |
|---|---|
| Happy | 10 |
| Failure | 2 |
| Boundary | 4 |
| Negative | 6 |
| Concurrency | 1 |
| Regression | 1 |
| Breaking | 1 |
| Security | 2 |
| **Total** | **27** |

> ID scheme: T-0003-001..022 with `b`/`c` suffixes for sibling tests (e.g., T-0003-011b pairs with T-0003-011 for inc/dec symmetry; T-0003-013b/c are useA2UIState-remount and dispatch-after-unmount sister cases). The suffixed IDs preserve readability instead of renumbering the whole spec on Round 2.

---

### Step 2 Tests — Container + List

| ID | Category | Test Description |
|---|---|---|
| T-0003-023 | Happy | Container `direction:'row'` renders a View with `flexDirection:'row'` |
| T-0003-024 | Happy | Container `direction:'column'` → `flexDirection:'column'` |
| T-0003-025 | Happy | Container `padding:'lg'` → resolved to `theme.spacing.lg` (24) |
| T-0003-026 | Happy | Container `gap:'md'` → resolved to `theme.spacing.md` (16) |
| T-0003-027 | Happy | Container `align:'center'` → `alignItems:'center'`; same for start/end/stretch |
| T-0003-028 | Happy | Container `justify:'between'` → `justifyContent:'space-between'`; same for start/center/end |
| T-0003-029 | Boundary | Container with empty `children:[]` renders an empty View; no crash |
| T-0003-030 | Happy | Container recurses: nested Container → recursive `NodeRenderer` calls produce the expected tree |
| T-0003-031 | Boundary | Container nested 5 levels deep renders correctly (well below depth-8 cap) |
| T-0003-032a | Snapshot | Container snapshot: row + start + none padding + none gap |
| T-0003-032b | Snapshot | Container snapshot: row + center + lg padding + md gap |
| T-0003-032c | Snapshot | Container snapshot: column + stretch + sm padding + sm gap |
| T-0003-032d | Snapshot | Container snapshot: column + end + md padding + lg gap |
| T-0003-032e | Snapshot | Container snapshot: row + between (justify) + md padding |
| T-0003-033 | Happy | List `items:[Heading, Text, Heading]` renders with `md` gap |
| T-0003-034 | Happy | List `separator:true` interleaves a 1px `bg.subtle` View between items |
| T-0003-035 | Boundary | List with single item: no separator rendered |
| T-0003-036 | Boundary | List with empty items: empty View, no crash |
| T-0003-037a | Snapshot | List snapshot: 3 items + separator off (default md gap) |
| T-0003-037b | Snapshot | List snapshot: 3 items + separator on (no gap, 1px lines) |
| T-0003-038 | Negative | Container does NOT add `accessibilityRole` (it's layout-only); children carry their own roles |
| T-0003-038b | Failure | Switch in `NodeRenderer` is exhaustive: a node with a runtime-injected unknown `type` (forced via `as any` cast bypassing Zod) falls through to a defensive `[Unimplemented: <type>]` Text fallback that does NOT throw. Documented behavior: Step 2 keeps a final default branch for defense-in-depth even though all 10 catalog types are implemented. |
| T-0003-038c | Negative | Container with `key={i}` for children: when `children` array length increases (new node appended), existing nodes don't lose their identity — verified by observing that already-set state for a child's `id` persists across the re-render. (Index-as-key is acceptable here because A2UI children are positionally addressed; this test locks that interpretation.) |

#### Step 2 Test Summary
| Category | Count |
|---|---|
| Happy | 9 |
| Boundary | 4 |
| Snapshot | 7 |
| Negative | 2 |
| Failure | 1 |
| **Total** | **23** |

---

### Step 3 Tests — Image + Heading + Text

| ID | Category | Test Description |
|---|---|---|
| T-0003-039 | Happy | Heading `level:1` → display typography + padding-top: lg + `accessibilityRole:'header'` |
| T-0003-040 | Happy | Heading `level:2` → heading1 typography + padding-top: md |
| T-0003-041 | Happy | Heading `level:3` → heading2 typography + padding-top: sm |
| T-0003-042 | Happy | Heading without `level` defaults to level 1 (per Sable line 398 implication; document the default in the test name) |
| T-0003-043 | Happy | Text without props uses body typography + `text.primary` |
| T-0003-044 | Happy | Text `weight:'bold'` → bodyStrong typography |
| T-0003-045 | Happy | Text `color:'muted'` → `text.muted` |
| T-0003-046 | Happy | Text `color:'destructive'` → `text.destructive` |
| T-0003-047 | Happy | Image with `aspectRatio: 1.5` renders Image with that aspect ratio locked |
| T-0003-048 | Happy | Image without `aspectRatio` falls back to `maxHeight: 240` + bg.subtle letterbox |
| T-0003-049 | Happy | Image with `alt: "Sunset"` exposes `accessibilityLabel: "Sunset"` |
| T-0003-050 | Boundary | Image with `aspectRatio: 0.5` (portrait) — locked aspect ratio |
| T-0003-050b | Failure | Image with malformed/unreachable URL (`src: 'https://invalid.example.invalid/x.png'`) does NOT throw and does NOT trip the Render Error Boundary. RN's default broken-image placeholder is acceptable; verify by mocking `Image.onError` and asserting the component still renders. |
| T-0003-050c | Boundary | Heading with `level` outside 1/2/3 (forced via `as any` cast bypassing Zod): defaults to level 1. Defensive against schema-evolution drift. |
| T-0003-051a | Snapshot | Heading level 1 snapshot |
| T-0003-051b | Snapshot | Heading level 2 snapshot |
| T-0003-051c | Snapshot | Heading level 3 snapshot |
| T-0003-052a | Snapshot | Text default snapshot |
| T-0003-052b | Snapshot | Text bold + muted snapshot |
| T-0003-052c | Snapshot | Text destructive snapshot |
| T-0003-053a | Snapshot | Image with aspectRatio + alt snapshot |
| T-0003-053b | Snapshot | Image without aspectRatio (letterbox fallback) snapshot |
| T-0003-054 | Regression | Existing `render({spec})` calls with Heading + Text (the only types implemented in ADR-0002) still produce identical trees post-extraction (assert via snapshot equality with ADR-0002's snapshot) |

#### Step 3 Test Summary
| Category | Count |
|---|---|
| Happy | 11 |
| Boundary | 2 |
| Snapshot | 8 |
| Failure | 1 |
| Regression | 1 |
| **Total** | **23** |

---

### Step 4 Tests — Button + dispatcher integration

| ID | Category | Test Description |
|---|---|---|
| T-0003-055 | Happy | Button renders with `accessibilityRole:'button'` and `accessibilityLabel` from `node.label` |
| T-0003-056 | Happy | Button `variant:'primary'` (default) → bg.primary + primaryFg styling |
| T-0003-057 | Happy | Button `variant:'secondary'` → bg.subtle + text.primary + border |
| T-0003-058 | Happy | Button `variant:'destructive'` → bg.destructive + destructiveFg |
| T-0003-059 | Happy | Press fires `dispatch(node.action)` exactly once with the new single-arg signature (per §D dispatch-signature change) |
| T-0003-060 | Happy | Press with `action:{type:'toast'}` triggers the toast callback supplied to `useA2UIState` |
| T-0003-061 | Happy | Press with `action:{type:'set', targetId:'x', value:'hi'}` produces next state with `x:'hi'` |
| T-0003-062 | Happy | Press with `action:{type:'navigate', viewId:'view2'}` switches `currentViewId` if view exists |
| T-0003-063 | Negative | Press with `action:{type:'navigate', viewId:'nonexistent'}` warn-logs and is a no-op |
| T-0003-064 | Boundary | Pressed state opacity transition does not throw; snapshot in pressed state matches |
| T-0003-065 | Failure | Haptics throwing (mocked) is caught silently — Button still fires the dispatch |
| T-0003-066a | Snapshot | Button primary + label snapshot |
| T-0003-066b | Snapshot | Button secondary + label snapshot |
| T-0003-067 | Snapshot | Button destructive + label snapshot |
| T-0003-068 | Security | Button `accessibilityLabel` is exactly `node.label` — no synthesis or string concatenation that could mask the original (Sable Notes-for-Colby #9) |
| T-0003-068b | Failure | Button with `variant` set to a runtime-injected unknown string (forced via `as any` cast bypassing Zod): falls back to `variant: 'primary'` styling without throwing. Defends against `variantStyles[unknownKey]` returning `undefined` and crashing on `.color`. |

#### Step 4 Test Summary
| Category | Count |
|---|---|
| Happy | 8 |
| Negative | 1 |
| Boundary | 1 |
| Failure | 2 |
| Snapshot | 3 |
| Security | 1 |
| **Total** | **16** |

---

### Step 5 Tests — Counter

| ID | Category | Test Description |
|---|---|---|
| T-0003-069 | Happy | Counter renders three elements: −, value, + |
| T-0003-070 | Happy | Value reads from `state[node.id]`; defaults to `min ?? 0` if state has no entry |
| T-0003-071 | Happy | `+` press dispatches `{type:'increment', targetId:node.id, by:node.step ?? 1}` |
| T-0003-072 | Happy | `−` press dispatches `{type:'decrement', targetId:node.id, by:node.step ?? 1}` |
| T-0003-073 | Happy | Counter with custom `step:5`: + dispatches with `by:5` |
| T-0003-074 | Boundary | At `value === max`: + button is disabled (`accessibilityState.disabled === true`); pressing it is a no-op |
| T-0003-075 | Boundary | At `value === min`: − button is disabled |
| T-0003-076 | Boundary | Counter with `min:0, max:10, step:3`: increment from 9 clamps to 10 (matches Step 1 §I clamp semantic; not 12, not 9-no-op) |
| T-0003-076b | Boundary | **Programmatic Button → Counter clamp** (the central rationale of §I): a `Button` node with `action: {type:'increment', targetId:'c', by:100}` on a Counter `{min:0, max:50, currentValue:45}` → state clamps to `c:50` (not 145, not 45-no-op). Tests that the clamp lives in the state engine, not in Counter's own `+`-button handler. |
| T-0003-076c | Boundary | Counter with no `min` and no `max`: increment from 999 by 1 yields 1000 (unbounded — schema allows both to be undefined). Defends against treating undefined bounds as 0. |
| T-0003-077 | Happy | `accessibilityLabel` is `"<label>, current value <n>"` per Sable line 322 |
| T-0003-078 | Happy | `accessibilityActions` includes `increment` and `decrement` action names |
| T-0003-079a | Snapshot | Counter at zero (mid-range, no boundary) |
| T-0003-079b | Snapshot | Counter at-min boundary (− disabled) |
| T-0003-080 | Snapshot | Counter at max boundary (+ disabled) |
| T-0003-080b | Snapshot | Counter with custom `step:5` mid-range |
| T-0003-081 | Failure | Haptics throwing on inc/dec is caught silently |

#### Step 5 Test Summary
| Category | Count |
|---|---|
| Happy | 7 |
| Boundary | 5 |
| Snapshot | 4 |
| Failure | 1 |
| **Total** | **17** |

---

### Step 6 Tests — TextInput + Toggle

| ID | Category | Test Description |
|---|---|---|
| T-0003-082 | Happy | TextInput renders label above input, both visible |
| T-0003-083 | Happy | TextInput `placeholder` shown when `state[id]` is empty |
| T-0003-084 | Happy | TextInput `multiline:true` allows up to 5 lines before scroll |
| T-0003-085 | Happy | `onChangeText('foo')` dispatches `{type:'set', targetId:id, value:'foo'}` |
| T-0003-086 | Happy | TextInput value reflects `state[id]` (controlled); state update propagates back |
| T-0003-087 | Happy | TextInput `accessibilityLabel === node.label` |
| T-0003-088 | Boundary | TextInput with `state[id]` of 0 (number) renders empty (we render strings only) — defensive |
| T-0003-088b | Failure | TextInput with `state[id]` of `null` renders empty without throwing |
| T-0003-088c | Failure | TextInput with `state[id]` of `boolean` renders empty + warn-logs `a2ui_textinput_type_mismatch` with payload `{id, expectedType:'string', actualType:'boolean'}` (no actual value in log per §G-4 PII rule) |
| T-0003-088d | Happy | TextInput on focus: border color transitions to `palette.primary` (Sable line 402) — verified by capturing focus event and asserting style snapshot |
| T-0003-089 | Snapshot | TextInput labelled + placeholder snapshot |
| T-0003-090 | Snapshot | TextInput multiline snapshot |
| T-0003-090b | Snapshot | TextInput focused-state snapshot (border = primary) |
| T-0003-091 | Happy | Toggle renders a row container ≥56pt min-height (Sable Notes-for-Colby #3) |
| T-0003-092 | Happy | Toggle reads `state[id]` as boolean; defaults to `defaultValue ?? false` |
| T-0003-093 | Happy | Switch flip dispatches `{type:'set', targetId:id, value:nextBool}` |
| T-0003-094 | Happy | Toggle `accessibilityRole:'switch'` and label exposed |
| T-0003-095 | Boundary | Toggle reading `state[id]` of non-boolean: coerces to false, warn-logs `a2ui_toggle_type_mismatch` with payload `{id, expectedType:'boolean', actualType}` — log payload MUST NOT include the actual value (§G-4 PII rule) |
| T-0003-095b | Failure | Toggle node with missing `id` (forced via `as any` cast bypassing Zod required-field check): renders a disabled Switch + warn-logs `a2ui_toggle_missing_id`. Does NOT throw (Error Boundary should not trip on schema-shape violations introduced post-validation). |
| T-0003-096 | Snapshot | Toggle on + label snapshot |
| T-0003-097 | Snapshot | Toggle off + label snapshot |

#### Step 6 Test Summary
| Category | Count |
|---|---|
| Happy | 11 |
| Boundary | 2 |
| Snapshot | 5 |
| Failure | 3 |
| **Total** | **21** |

---

### Step 7 Tests — Form

| ID | Category | Test Description |
|---|---|---|
| T-0003-098 | Happy | Form renders fields in order with `md` gap |
| T-0003-099 | Happy | Form with `submitLabel:'Save'` and `submitAction` renders a primary button at bottom |
| T-0003-100 | Happy | Submit press fires `dispatch(submitAction, state)` |
| T-0003-101 | Happy | Form fields' state values reflect dispatch updates from individual fields |
| T-0003-102 | Boundary | Form with `submitLabel` set but `submitAction` undefined: button is hidden (Sable line 406) |
| T-0003-103 | Boundary | Form with empty `fields:[]` and submit: button still renders (defensive — submit-only forms exist) |
| T-0003-103b | Boundary | Form with `submitAction` defined but `submitLabel` undefined: NO submit button is rendered (per §H — `submitLabel` controls visibility regardless of action presence). |
| T-0003-103c | Failure | Form with a non-field node in `fields` (e.g., a `Heading` node — schema permits this since `fields: A2UINode[]`): renders the Heading inline as a regular field-row child without throwing. Documents the permissive-rendering interpretation; future M2 may tighten the schema. |
| T-0003-104a | Snapshot | Form with TextInput + Toggle + Counter + submit snapshot |
| T-0003-104b | Snapshot | Form with no submit (submitLabel undefined) snapshot |
| T-0003-105 | Negative | Form does NOT inject its own `formId` keyed state at M1 — the field `id`s are the keys (verify state shape) |

#### Step 7 Test Summary
| Category | Count |
|---|---|
| Happy | 4 |
| Boundary | 3 |
| Snapshot | 2 |
| Failure | 1 |
| Negative | 1 |
| **Total** | **11** |

---

### Step 8 Tests — AppRunner integration + render-error + determinism

| ID | Category | Test Description |
|---|---|---|
| T-0003-106 | Happy | AppRunner mounts the renderer for a saved spec; the rendered tree contains expected nodes (Heading "Pomodoro Timer", Counter at sessions=0, three Buttons) |
| T-0003-107 | Happy | AppRunner's old in-screen reducer is removed (assert by inspecting that `useA2UIState` is the imported source of state) — protects against partial migration |
| T-0003-108 | Happy | Toast action from a Button reaches AppRunner's `toast.show()` (already wired; verify it survives the refactor) |
| T-0003-109 | Happy | Navigate action switches `currentViewId` and the rendered tree changes to the new view's root |
| T-0003-110 | Happy | RenderErrorBoundary catches a forced-throw in a child component and renders the fallback. **Asserts exact strings** (Sable line 307): heading `"This app didn't render correctly."`, body `"Try recreating it."`, button label `"Back to library"`. Pinning exact copy prevents UX drift. |
| T-0003-111 | Happy | RenderErrorBoundary's "Back to library" CTA calls `navigation.goBack()` |
| T-0003-112 | Happy | `render_failed` event is logged with `{projectId, renderHash, mode:'owner'}` when boundary fires |
| T-0003-113a | Happy | Determinism (render-stability): render Pomodoro fixture twice into separate `react-test-renderer` hosts → `toJSON()` deep-equal. Tests AC-R4's "render is stable across mounts." |
| T-0003-113b | Happy | Determinism (render-stability, second fixture): same test against the Tip Splitter fixture (project `74b0f451-…` from 2026-05-02). Two distinct fixtures defend against single-fixture passing-by-design. |
| T-0003-114a | Happy | Determinism (canonical-spec): `renderHash(pomodoroSpec)` matches the expected fixture hash committed to `packages/a2ui-renderer/src/test/fixtures/specs/pomodoro.hash`. Tests spec-canonicalization stability (a different concern from T-0003-113 — that's about render output; this is about the spec's canonical form). |
| T-0003-114b | Happy | Determinism (canonical-spec, second fixture): same against `tipSplitter.hash`. |
| T-0003-115a | Regression | Existing AppRunner tests (top-bar Publish CTA, Unpublish action sheet, BottomSheet open) still pass with the renderer refactor |
| T-0003-115b | Regression | AppRunner loading-state branch (isLoading=true) still renders the ActivityIndicator without engaging the renderer — verifies the refactor doesn't change non-happy render paths |
| T-0003-115c | Regression | AppRunner error-state branch (project fetch error) still renders the "Project not found." message without engaging the renderer or RenderErrorBoundary |
| T-0003-116 | Regression | `apps/mobile/src/screens/AppRunner/index.test.tsx` mocks the renderer cleanly (the mock surface is now `useA2UIState` + `<NodeRenderer>`, not the old in-screen reducer) — assert mock cardinality |
| T-0003-117 | Negative | RenderErrorBoundary does NOT trip on `navigate` to unknown viewId (state engine no-op, not a thrown error) |
| T-0003-118 | Security | Render-error fallback does NOT include the spec's content in the user-visible copy (no leak of original prompt or LLM output) |
| T-0003-119 | Security | Render-error log payload does NOT include raw spec JSON or `original_prompt` — only `{projectId, renderHash, mode}` |
| T-0003-120 | Doc | `docs/pipeline/pipeline-state.md` row 27 points to `ADR-0003-renderer.md`; new row added for ADR-0004 |
| T-0003-121 | Doc | `.claude/references/adr-index.md` includes ADR-0003 row with tags `a2ui, mobile-shell` |

#### Step 8 Test Summary
| Category | Count |
|---|---|
| Happy | 11 |
| Regression | 4 |
| Negative | 1 |
| Security | 2 |
| Doc | 2 |
| **Total** | **20** |

---

### Test Totals (Round 2 — Roz revisions applied)

| Step | New | Regression | Total |
|---|---|---|---|
| 1 | 26 | 1 | 27 |
| 2 | 23 | 0 | 23 |
| 3 | 22 | 1 | 23 |
| 4 | 16 | 0 | 16 |
| 5 | 17 | 0 | 17 |
| 6 | 21 | 0 | 21 |
| 7 | 11 | 0 | 11 |
| 8 | 16 | 4 | 20 |
| **Total** | **152** | **6** | **158** |

Round-2 deltas (from Round 1's 117+5=122): +35 new, +1 regression. Sources: R-2 (Failure tests across Steps 2/3/6/7 added 6 tests), R-4 (PII payload assertions added in-place to 3 existing tests, no row count change), R-5 (programmatic Button→Counter clamp +1), R-7 (snapshot enumeration added 12 rows to Steps 2/3/4/5/6/7), R-8 (no row change — strings pinned in T-0003-110), R-9 (at-min snapshot +1), N-1 to N-5 (added 12 mostly Failure/Negative). Failure-category count rose from 4 to **11** across Steps 1/2/3/4/5/6/7. Cal accepts that for a renderer ADR the dominant failure mode is "MUST NOT mutate / MUST NOT throw" — covered by **Negative** tests (count = 11). Combined Negative+Failure = 22 vs Happy = ~75 — the right framing for a deterministic-pure-function package, where Failure-as-runtime-error is rarer than Negative-as-invariant-violation.

### Test Helpers & Mocks

- **`react-native-reanimated`** — mock via the standard Jest setup file (already in `apps/mobile/jest.config.js`; copy/import into `packages/a2ui-renderer/jest.config.js`).
- **`expo-haptics`** — mock module to a stubbed `impactAsync` that resolves immediately. Tests that assert haptic-throw-tolerance override the mock to throw.
- **Theme fixture** — `packages/a2ui-renderer/src/test/fixtures/theme.ts` exports a deterministic light theme to wrap component render calls. All component tests use this.
- **Spec fixtures** — `packages/a2ui-renderer/src/test/fixtures/specs/` — at least one fixture per: single-view-simple, multi-view, deep-Container-nesting, full-form, the canonical Pomodoro Timer (copy from `services/api/eval/specs/` if present, otherwise inline). Used by Step 8's determinism test and by component tests as needed.
- **`render` host helper** — `packages/a2ui-renderer/src/test/renderWithProviders.tsx` wraps the renderer with `RendererThemeProvider`, `RendererLoggerProvider` (Jest-spy logger), and a synthetic dispatcher. Used by every component test.
- **Logger spy** — Jest mock function passed to `RendererLoggerProvider` so that `warn`/`error` calls are assertable.

### Coverage Gates

- **Renderer package:** ≥90% statement coverage, ≥85% branch coverage. Enforced by `pnpm --filter @app-creator/a2ui-renderer test --coverage` in CI.
- **Determinism test (T-0003-113, T-0003-114):** P0 gate. If it fails, the merge is blocked.
- **Snapshot tests:** `--ci --ci-fail-fast` flags during merge — accidental snapshot updates fail the build.

---

## UX Requirements

All from `docs/ux/app-creation-poc-ux.md` §A2UI Catalog Visual Treatment (lines 396–407) and §Action Feedback (lines 411–414):

- **Per-component visual:** see the Step descriptions above; each cites the exact UX line.
- **Action feedback at M1:**
  - `set` on TextInput: field updates visually (controlled value).
  - `set` on Counter / `increment` / `decrement`: number updates instantly. **No scale animation in M1** (Phase 2 polish).
  - `set` on Toggle: native iOS switch animation.
  - `toast`: handled by the host's existing `useToast()` queue; renderer just dispatches up.
  - `navigate`: view switches in-place. No transition animation in M1.
- **Render-error fallback:** Sable line 307 — icon + heading "This app didn't render correctly." + body "Try recreating it." + button "Back to library".

## Data Sensitivity

The renderer doesn't talk to stores. It receives a spec + state from the host and renders. There are no store methods to tag.

| Surface | Sensitivity |
|---|---|
| `useA2UIState({spec})` | Reads spec + state in-memory only. Never persists. |
| `RendererLogger` calls | `auth-only` payloads only — must never include raw spec content, `original_prompt`, or PII. Step 8's T-0003-119 enforces. |
| `render_failed` event payload | `{projectId, renderHash, mode}` — no PII. ADR-0004 may extend with `viewId` once Try mode lands. |

## CI/CD Impact

| Job | Config File | Impact | Required Change |
|---|---|---|---|
| `pnpm test` (workspace) | `package.json` root scripts | Adds the new renderer tests to the suite | None — test file globbing picks them up |
| `pnpm typecheck` (workspace) | `package.json` root scripts | New types in `packages/a2ui-renderer/src/index.ts` | None — workspace `--filter` picks them up |
| `pnpm lint` (workspace) | `.eslintrc.cjs` (root) + `packages/a2ui-renderer/.eslintrc.cjs` (new) | **Workspace boundary enforcement (R-6 from Roz Round 1).** The renderer package must NOT import from `apps/mobile/`. | **Step 1 adds** a `packages/a2ui-renderer/.eslintrc.cjs` with `no-restricted-imports` rules forbidding patterns: `apps/mobile/**`, `#/theme`, `#/lib/*`, `#/state/*`, `#/components/*`, `#/screens/*`. CI's `pnpm lint` flags violations. T-0003-006b (lint-rule existence test) verifies the file is checked-in and the patterns are present. |
| `apps/mobile` jest | `apps/mobile/jest.config.js` | AppRunner test diff (Step 8) requires the same `react-native-reanimated` mock that `packages/a2ui-renderer` will use | Step 1 ensures both jest configs use the same mock module |
| Eval harness CI | `.github/workflows/eval.yml` (TBD; ADR-0002 deferred) | None directly — eval validates spec structure, not rendered output | None |
| TestFlight job (TBD) | n/a (not yet) | None — ADR-0004 territory | None |

If no CI eval workflow exists yet from ADR-0002, this ADR doesn't add one. The renderer's correctness is unit-tested locally via the suite above.

## Documentation Impact

| Doc | Path | What Changes |
|---|---|---|
| ADR index | `.claude/references/adr-index.md` | Add row for ADR-0003 with tags `a2ui, mobile-shell` |
| Pipeline state | `docs/pipeline/pipeline-state.md` | Rename row 27 ("ADR-0003 Render & Ship") to "ADR-0003 (Renderer)"; add ADR-0004 row |
| ARCHITECTURE.md | `ARCHITECTURE.md` §6 + §17 | Mark renderer as "shipped" in §17 D-list (if there's a D-entry for "renderer is skeleton"); no §6 changes — schema is unchanged |
| Renderer package README | `packages/a2ui-renderer/README.md` (new) | Brief note: what's in here, the `(node, state, dispatch) => ReactElement` contract, the four sanctioned action types, how to add a component (the 5-step gate from ARCHITECTURE.md §6 Rule) — but do NOT duplicate the full ARCHITECTURE.md §6 content; link to it. |
| CLAUDE.md | (no change) | §4 already documents the renderer's pure-function contract. |

## Notes for Colby

1. **Order matters.** Step 1 unblocks every other step. Steps 2–7 can technically interleave, but I'd ship them in order (Container first, then display, then interactive) — that way the integration test in Step 8 has a real spec to render at every stage.

2. **The existing AppRunner reducer is the model.** Lines 50–120 of `apps/mobile/src/screens/AppRunner/index.tsx` already implement set/increment/decrement/toast (navigate is a no-op there). The migration in Step 1 is mostly a copy + add view-nav + add bounds-checking + add type-mismatch logging. Don't redesign the reducer logic — preserve its observable behavior.

3. **Theme tokens are exhaustive in `apps/mobile/src/theme/index.ts`.** The `RendererTheme` shape in Step 1 should mirror those keys exactly — same names, same types — so the AppRunner conversion at Step 8 is a one-line `<RendererThemeProvider value={useTheme()}>` (after a type assertion if names match). If a renderer-only theme key emerges, add it to both — don't fork.

4. **Workspace boundary discipline.** The renderer cannot import `#/theme`, `#/logger`, `#/lib/api`, `#/state/...`, or anything from `apps/mobile`. Period. If you find yourself wanting to, the answer is "add a context to the renderer package and inject from AppRunner."

5. **Pomodoro is the canonical fixture.** The Pomodoro spec we generated on 2026-05-02 (project id `a7a8c4a8-e78c-4b47-95ef-39ec004f5568` — fetch via `curl -H "Authorization: Bearer dev-bypass" http://127.0.0.1:3030/me/projects/a7a8c4a8-...`) exercises Container + Heading + Text + Button + Counter across 2 views with 5 state keys. Save its `current_version.spec_json` to `packages/a2ui-renderer/src/test/fixtures/specs/pomodoro.json` and use it in Step 8's determinism test. The corresponding `render_hash` from the same DB row is your fixture hash.

6. **RTL versus react-test-renderer.** Snapshot tests for non-interactive components (Heading, Text, Image, Container, List) are fine with `react-test-renderer` (lighter). Interactive component tests (Button, Counter, TextInput, Toggle, Form) need `@testing-library/react-native` for `fireEvent.press` etc. Use the right tool per file — both are sanctioned.

7. **`expo-haptics` is async.** `Haptics.impactAsync(...)` returns a Promise that can reject silently on simulators without haptic hardware. The Step 4 + 5 try/catch wrapper is mandatory. Don't `await` it — the user's tap shouldn't wait on a haptic.

8. **The render-error boundary's "Back to library" button** is a `Pressable`, not a renderer-package primitive. It lives in `apps/mobile/src/screens/AppRunner/RenderErrorBoundary.tsx` and uses the same shell-Button styling as the existing error states in SignIn/Home for consistency. Don't import the A2UI renderer's Button — that's a different package's component, with different semantics.

9. **Don't ship motion polish in M1.** The Sable UX line 526 mentions Counter scale animation (1.0→1.1→1.0). Defer to Phase 2. Reduced-motion polish is its own slice; the M1 renderer is intentionally still. The ADR risks table notes this; don't be the one to grow scope at implementation time.

10. **Determinism is sacred.** No `Math.random`, no `Date.now()`, no `useId()`, no entropy in the renderer or any component. If a future component genuinely needs a unique id (e.g., for `accessibilityIdentifier`), derive it from the spec's `node.id` field. Step 8's T-0003-114 test will catch any drift.

11. **No edit-by-chat in this ADR.** The chat-edit flow with JSON Patches (CLAUDE.md §3 Edit-by-chat) is not in scope here. The renderer has nothing to do with patches; it just renders whatever spec the host hands it. ADR-0005 (or whenever Phase 2 starts) owns the edit flow.

12. **AppRunner integration test refactor is the painful part of Step 8.** The current test suite mocks the in-screen reducer's behavior. After the refactor, mocks should target `useA2UIState` (mock its return value) and `<NodeRenderer>` (replace with a sentinel). Read `apps/mobile/src/screens/AppRunner/index.test.tsx` first — there's ~400 lines of test setup that need careful diff. Budget time.

13. **`react-native-reanimated` mock.** If the existing mobile mock doesn't apply cleanly to the renderer package (different jest config), replicate it. Don't try to load the real Reanimated runtime in node-env Jest — it'll fail.

14. **Pipeline state edit is a chore.** Step 8 includes a one-line edit to `docs/pipeline/pipeline-state.md`. Ellis will commit it as part of the same change set; don't open a separate PR.

15. **What "done" looks like:** open the iOS simulator, sign in via skip-auth, tap any of the four projects we generated on 2026-05-02 (Tip Splitter, Welcome to Serenity, Daily Water Tracker, Pomodoro Timer) → AppRunner displays the actual rendered app, you can tap buttons, increment counters, type into inputs, toggle toggles. Record a 30-second screen capture and link it in the QA notes for Roz.

16. **T-ID suffix clarification (Roz NF-4):** the `a/b/c` suffix scheme groups related cases under one base T-ID where the relationship is obvious (e.g., T-0003-079a is zero-state Counter snapshot, T-0003-079b is at-min Counter snapshot — same component, paired snapshot family). Two pairings are *not* thematic and you should treat them as separate cases:
    - `T-0003-080` (at-max Counter snapshot) ≠ `T-0003-080b` (custom-step Counter snapshot mid-range). 080b is a separate snapshot, not a variant of 080.
    - `T-0003-090` (TextInput multiline snapshot) ≠ `T-0003-090b` (TextInput focused-state snapshot). Same caveat.
    Don't try to make them share fixtures or render setup — they're different scenarios.

17. **T-0003-006b is a runtime ESLint integration test (Roz NF-2):** the test uses `ESLint.lintText()` from the `eslint` package's programmatic API. The `eslint` CJS module is already a workspace dep at the root; you can import it from a Jest file. Don't try to read `.eslintrc.cjs` yourself and parse it — the lint rule must actually fire on a forbidden-import fixture, not just exist. There's a code-shape example in the standard ESLint API docs; the test ends up ~30 lines.

---

> ✅ ADR-0003 Round 2 (post-Roz) saved to `docs/adrs/ADR-0003-renderer.md`. **8 steps, 158 total tests (152 new + 6 regression).** Roz Round 2 verdict: **APPROVED WITH NOTES** (`docs/pipeline/roz-test-review-ADR-0003-round2.md`). All 9 required revisions + 5 nice-to-haves applied; 3 residual editorial fixes (Failure count corrected to 11, snapshot count corrected to 29, T-0003-006b reshaped from file-existence check to runtime ESLint integration test) applied post-review.
>
> Test spec approved. Colby is up next.

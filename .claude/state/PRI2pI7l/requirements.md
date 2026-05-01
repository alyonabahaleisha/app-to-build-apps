# Technical Requirements — Quick-react bar on posts (PRI2pI7l)

> Mode: REQUIREMENTS (architect first pass). This is the HOW, grounded in the codebase. No execution plan, no file-by-file diffs — that is the next architect pass.

## 0. TL;DR

Quick-react is a net-new, flag-gated, non-atproto surface. It composes three new UI primitives (bar / popover / a11y picker), a new chip in `PostControls`, a gesture entry-point, one new TanStack Query module, a **client-only** persisted store keyed by `(did, postUri)` (AC-9's "cross-device" language contradicts ticket-level statement that atproto/federation is out of scope — reconciled below), a new analytics event family, and a new GrowthBook feature flag.

All code is **co-located in a single top-level feature directory** `src/features/quickReact/`, consistent with the `features/liveNow/` and `features/liveEvents/` precedents (see `src/features/liveNow/index.tsx:1` and `src/features/liveEvents/context.tsx:1`). A single non-feature touchpoint is required: `src/components/PostControls/index.tsx` gets a mount slot for the chip and (web) the React button.

---

## 1. Module Placement

### 1.1 Decision: `src/features/quickReact/`

```
src/features/quickReact/
├── index.ts                               # Barrel export: QuickReactChip, QuickReactBarTrigger, useQuickReactsEnabled, ...
├── constants.ts                           # Emoji set, timings, flag name, storage keys
├── types.ts                               # ReactionEmoji union, ReactionRecord, analytics surface enum
├── context.tsx                            # Provider/hook for viewer reactions map + debounced write controller
├── storage.ts                             # MMKV-backed per-account store (see §3)
├── analytics.ts                           # Event emission helpers (hashPostUri, logBarOpen, ...)
├── hooks/
│   ├── useQuickReactsEnabled.ts           # Flag + session + session gating
│   ├── useReducedMotion.ts                # Thin wrapper over #/state/a11y or reanimated's useReducedMotion (one path, not both)
│   └── useViewerReaction.ts               # Query hook; returns {emoji | undefined, isPending, isError}
├── queries/
│   └── reactions.ts                       # TanStack Query hooks: useViewerReactionQuery, useWriteReactionMutation
├── components/
│   ├── QuickReactChip/
│   │   ├── index.tsx                      # Shared (chip renders same on native/web, but tap wiring differs)
│   │   ├── index.web.tsx                  # Web override: click opens popover
│   │   └── chipAnimation.ts               # Shared layout/entrance helpers
│   ├── QuickReactBar/
│   │   ├── index.tsx                      # Native (Animated/Reanimated overlay over post body)
│   │   └── index.web.tsx                  # Noop; web never renders the bar
│   ├── QuickReactPopover/
│   │   ├── index.web.tsx                  # Web-only popover anchored to React button
│   │   └── index.tsx                      # Native noop
│   ├── QuickReactPicker/
│   │   └── index.tsx                      # Shared; uses Dialog.Outer / Dialog.ScrollableInner
│   ├── QuickReactBarTrigger/
│   │   ├── index.tsx                      # Native: LongPressGestureHandler wrapper; yields to children
│   │   └── index.web.tsx                  # Web: hover detector + React button + popover orchestration
│   ├── QuickReactButton/
│   │   ├── index.web.tsx                  # Web React button (Button primitive)
│   │   └── index.tsx                      # Native noop
│   └── QuickReactA11yAction.ts            # Returns accessibilityActions entry + onAccessibilityAction handler
├── README.md                              # (Optional) architecture overview inside the feature
└── __tests__/
    ├── storage.test.ts
    ├── debounce.test.ts
    ├── hashPostUri.test.ts
    ├── useQuickReactsEnabled.test.ts
    └── QuickReactPicker.test.tsx
```

### 1.2 Justification

- CLAUDE.md, "Components vs Screens vs Features": *"Features are higher-level modules that may include context, data fetching, components, and utilities related to a specific feature e.g. `/features/liveNow`. They don't neatly fit into components or screens and often span multiple screens."* Quick-react spans two screens (feed + thread), owns its own data layer, gestures, and analytics — textbook features candidate.
- Precedent: `src/features/liveNow/` contains `index.tsx`, `components/`, and cross-screen banners/dialogs (see `src/features/liveEvents/context.tsx:1`). Quick-react matches this shape.
- Not putting individual parts in `src/components/` because:
  - `QuickReactBar`, `QuickReactPopover`, `QuickReactPicker`, `QuickReactChip` are **co-dependent** — all need the same `context`, `storage`, `analytics` helpers. Splitting them across `src/components/` would create back-references into a feature directory anyway.
  - CLAUDE.md: *"avoid having 'god files' with too much unrelated logic"* — but also *"keep related code together."* These four components are the definition of related.
- Not putting it in `src/state/queries/` because the feature has UI, gestures, and a11y — not purely data-layer.
- The single exception is the `PostControls` mount slot (see §2.4).

### 1.3 Platform file grouping pattern (CLAUDE.md)

Each component that has platform-specific logic uses the **directory + `index.platform.tsx`** pattern preferred in CLAUDE.md: *"rather than having `Component.tsx`, `Component.web.tsx`, and `Component.native.tsx` in the same directory, we prefer to have a `Component/` directory with `index.tsx`, `index.web.tsx`, and `index.native.tsx`."* This keeps same-feature variants adjacent and visually signals "this component branches by platform."

Components that are purely shared (e.g., `QuickReactPicker`, which wraps `Dialog`, which already platform-branches) get a single `index.tsx`.

---

## 2. Component Tree

### 2.1 Composition diagram

```
PostFeedItem.tsx                                     (existing, src/view/com/posts/PostFeedItem.tsx:1)
├── QuickReactBarTrigger               (NEW; wraps post-body View)
│   ├── <gesture handler> (native)     or  <hover detector> (web, via QuickReactButton)
│   └── children = existing post body
├── ... (existing embeds, moderation, etc.)
├── PostControls                       (modified, src/components/PostControls/index.tsx:43)
│   ├── Reply / Repost / Like          (unchanged)
│   ├── QuickReactChip                 (NEW — rendered between Like and Bookmark per UX §3.2)
│   ├── QuickReactButton (web only)    (NEW — leading edge per UX §4.2; hidden when flag off)
│   ├── Bookmark / Share / Menu        (unchanged)
│   └── <accessibilityActions>         (extended — picks up the "react" action from feature)
│
├── QuickReactBar                      (NEW; portal/overlay; only mounted when bar opens, native only)
├── QuickReactPopover                  (NEW; only mounted when popover opens, web only; anchors to QuickReactButton)
└── QuickReactPicker                   (NEW; Dialog modal; mounted lazily when a11y action fires)
```

### 2.2 Component responsibilities and props

#### `QuickReactBarTrigger`

Wraps the post body; owns the "open the bar/popover" decision.

```
type QuickReactBarTriggerProps = {
  postUri: string
  postCid: string
  surface: 'feed' | 'thread'
  children: React.ReactNode
  // Children receive the press-in visual via context (post card dimming during 0-400ms window)
}
```

- **Native** (`index.tsx`): renders `LongPressGestureHandler` from `react-native-gesture-handler` with `minDurationMs={400}` (AC-4). Uses `simultaneousHandlers` with the feed's `FlatList` / `ScrollView` pan handler. On activation → open `QuickReactBar` anchored at press location. Children pass through untouched so existing tap/press behaviors (navigate to detail) keep working below the long-press threshold.
- **Web** (`index.web.tsx`): renders its children and a sibling `QuickReactButton` managed by a small hover-intent state machine (200 ms sustained hover before showing button; 150 ms delay on hover-out, per UX §4.2). For touch-web (media query `(hover: none)`, detected via `web({'@media ...': {}})` in ALF), the React button is **always rendered**; the hover state machine is bypassed.

#### `QuickReactBar` (native only)

Floating overlay pill anchored to the press location. Visual spec: UX §2.3.

```
type QuickReactBarProps = {
  postUri: string
  surface: 'feed' | 'thread'
  anchor: {x: number; y: number}
  currentEmoji: ReactionEmoji | undefined   // for pre-selection highlight
  onSelect: (emoji: ReactionEmoji | null) => void   // null = remove (re-tap selected)
  onDismiss: () => void
}
```

- Uses `react-native-reanimated` for animations (see `src/lib/custom-animations/LikeIcon.tsx:5` for the existing `useReducedMotion` pattern).
- Calls `useHaptics()('Light')` on select (not on open, not on scrub; UX §9.2).
- Rendered via the existing portal pattern (consider `Dialog.Outer`'s portal host — investigate at plan time; absolute positioned `View` in a top-level portal is sufficient).

#### `QuickReactPopover` (web only)

Radix-style popover anchored to the `QuickReactButton`. Reuses the `Menu`/popover primitives already used by web post menus (see `src/components/PostControls/PostMenu/index.tsx:1`). Visual spec: UX §2.4.

```
type QuickReactPopoverProps = {
  postUri: string
  surface: 'feed' | 'thread'
  anchorRef: React.RefObject<HTMLElement>
  currentEmoji: ReactionEmoji | undefined
  onSelect: (emoji: ReactionEmoji | null) => void
  onDismiss: () => void
}
```

Focus trap, Escape handling, outside-click, and keyboard arrow nav (AC-7) are implemented here. Pattern: consult `Menu.Root` primitives for focus management; likely simpler to write a dedicated `Popover` using `@radix-ui/react-popover` (already transitively available via Menu) with a 1×4 grid of `role="menuitem"` buttons.

#### `QuickReactPicker` (a11y picker, cross-platform)

Dialog-backed accessible picker (AC-11). Reuses `src/components/Dialog/index.tsx` (native bottom sheet) and `src/components/Dialog/index.web.tsx` (web modal) — zero platform branching inside this component.

```
type QuickReactPickerProps = {
  control: Dialog.DialogControlProps
  postUri: string
  surface: 'feed' | 'thread'
  currentEmoji: ReactionEmoji | undefined
  onSelect: (emoji: ReactionEmoji | null) => void
}
```

- Header: `Dialog.Header` + `Dialog.HeaderText` with `_(msg\`React to post\`)`.
- Body: four emoji rows + conditional "Remove reaction" row (only if `currentEmoji` is defined).
- Each row calls `control.close(() => onSelect(emoji))` — **callback form is required** per CLAUDE.md footgun note: *"Always use `control.close(() => ...)` when performing actions after closing a dialog."* (See `src/components/Menu/index.tsx:151` for the reference pattern.)

#### `QuickReactChip`

Inline pill in `PostControls` showing the viewer's current emoji. Visual spec: UX §3.3.

```
type QuickReactChipProps = {
  postUri: string
  surface: 'feed' | 'thread'
  // Pulls its own emoji from useViewerReaction(postUri) — no emoji prop
}
```

- If no reaction and flag is ON: renders nothing (returns null).
- If reaction: renders emoji in a pill. Tap (native) or click (web) opens bar/popover anchored to the chip. Long-press on native ALSO opens the bar (UX §4.4) — both paths converge on the same "open bar for this post" action.
- Exposes `accessibilityLabel={_(msg\`Reacted with ${label}. Activate to change or remove.\`)}` (UX §12.2).

#### `QuickReactButton` (web only)

```
type QuickReactButtonProps = {
  postUri: string
  surface: 'feed' | 'thread'
  isVisible: boolean              // controlled by QuickReactBarTrigger hover state
  onOpenPopover: (anchor: HTMLElement) => void
}
```

Thin wrapper over `Button` primitive with the `Emoji` icon from `src/components/icons/Emoji.tsx` (UX §13). Always uses `Button` `size="small"` / `shape="round"` to hit the 44-pt target.

### 2.3 Modifications to `PostControls`

`src/components/PostControls/index.tsx` (lines 43–362):

1. At the top of the controls render (around `src/components/PostControls/index.tsx:209`), inject `QuickReactBarTrigger` **outside** of `PostControls` — the trigger wraps the whole post body in `PostFeedItem` and thread post components, not `PostControls` itself. `PostControls` is only modified for the chip and web button.
2. Insert `<QuickReactChip postUri={post.uri} surface={surface}>` between the Like button block (ends around line 312) and the `<View />` spacer (line 314). Chip renders nothing when flag is off or when there is no reaction — zero-footprint in the OFF state (AC-15).
3. Insert `<QuickReactButton ... />` (web only) between the Like block and the Bookmark/Share/Menu block. Leading-edge of controls per UX §3.2.
4. Extend `accessibilityActions` on the outer `View` to include the "react" action (via a helper from the feature). This is non-trivial — `PostControls`' outer `View` may not currently have `accessibilityActions`. Verify at plan time; if not, the `accessibilityActions` attaches to the **parent** `PostFeedItem`/thread-post wrapper. This is the canonical a11y entry (UX §5.1).
5. Thread these via **two new props** on `PostControls`:
   - `surface?: 'feed' | 'thread'` (required when flag is ON; optional for back-compat)
   - `postThreadgate` already exists; reuse.

Thread post component (`src/screens/PostThread/components/ThreadItemAnchor.tsx`, `ThreadItemPost.tsx`, `ThreadItemTreePost.tsx`) renders `PostControls` with `logContext='PostThreadItem'`. Pass `surface='thread'`. `PostFeedItem` passes `surface='feed'`.

### 2.4 Out-of-scope component touches

Per AC-8, only `PostFeedItem` (`src/view/com/posts/PostFeedItem.tsx`) and the three thread-item components above render the feature. All other callers of `PostControls` pass no `surface` prop and get the no-op behavior. This naturally excludes:

- Quote embeds (`src/components/Post/Embed/*` — do not wrap `QuickReactBarTrigger`).
- Notification items (`src/view/com/notifications/*`).
- Search result previews.
- Feed generator previews.

The architect MUST verify at plan time that none of these call `PostControls` with `surface='feed'` by accident — default `undefined` surface prop guarantees inertness.

---

## 3. Data Model

### 3.1 Reconciling the "cross-device" contradiction in the spec

- **AC-9**: *"persists across restarts AND devices for the account."*
- **Explicit out-of-scope**: atproto lexicon, federation, firehose.
- **Spec §Dependencies** says: *"Since atproto lexicon is explicitly out of scope, this must be a Bluesky-owned service (e.g., an appview-side table). Confirm ownership before arch plan."* → `ac_check.json` flags this as an open question for the reporter.

The parent agent's prompt explicitly resolves this: **"client-only storage (AC-9 says no atproto for v0)."** The requirements document adopts this interpretation:

- v0 storage is **client-only MMKV, per-account**. "Cross-device" is downgraded to "cross-session on the same device." This is captured as a **known v0 gap** (see §12 Out of Scope and §11 Risks).
- The storage interface is designed so that it can be swapped for a server query/mutation in v1 without changing component code — all reads go through `useViewerReactionQuery`, all writes through `useWriteReactionMutation`. v1 simply swaps the `queryFn`/`mutationFn` bodies.

### 3.2 Reaction record shape

```ts
// src/features/quickReact/types.ts
export type ReactionEmoji = 'heart' | 'fire' | 'eyes' | 'joy'

export type ReactionRecord = {
  postUri: string              // full at:// URI
  emoji: ReactionEmoji
  updatedAt: number            // epoch ms; for TTL + cache reconciliation
}

export type ReactionsMap = Record<string /* postUri */, ReactionRecord>
```

### 3.3 Storage backend: account-scoped MMKV

The codebase has a first-class per-account MMKV store at `src/storage/index.ts:145`:

```ts
export const account = new Storage<[string /* did */], Account>({id: 'bsky_account'})
```

Add a new key `quickReactions` to `src/storage/schema.ts` `Account` type:

```ts
// src/storage/schema.ts additions
export type Account = {
  searchTermHistory?: string[]
  // ...existing...
  quickReactions?: {
    version: 1
    reactions: ReactionsMap
    lastPrunedAt?: number
  }
}
```

Writes go through a `storage.ts` module inside the feature that wraps `account.set([did, 'quickReactions'], ...)` and `account.get([did, 'quickReactions'])`. Listeners via `account.addOnValueChangedListener` enable cross-component chip updates without a manual pub/sub (pattern from `src/storage/index.ts:81`).

**Why MMKV, not AsyncStorage / persisted schema?**
- AsyncStorage (`src/state/persisted/index.ts:1`) holds the single `BSKY_STORAGE` blob, not suited for per-post reads at feed-scroll frequency. Each read would parse the entire schema.
- `src/storage/index.ts:145` `account` MMKV instance is already DID-scoped, synchronous, listener-capable, and used for similar per-account caches (`searchTermHistory`, `searchAccountHistory`). Perfect fit.
- A new persisted-preferences slice would require a version bump and is overkill; reactions are not preferences.

### 3.4 TTL and cap (pruning policy)

Local-only storage should not grow unbounded. Policy:

- **Cap**: 500 records per account. When exceeded, prune oldest 100 by `updatedAt` on the next write. Implemented in `storage.ts`.
- **TTL**: none at the record level in v0 (reactions are not expected to expire). Capacity-based eviction only.
- **Migration**: the `version: 1` field on the stored object allows a breaking migration later by bumping the version and discarding or transforming on read.

### 3.5 Query cache shape (TanStack Query)

Two representations exist simultaneously:

1. **MMKV** (source of truth for reads): `account[did, 'quickReactions']`.
2. **TanStack Query cache** (in-memory projection for reactive UI + optimistic updates):

```ts
// Query key factory pattern — CLAUDE.md canonical pattern
const reactionsQueryKeyRoot = 'quickReactions'

// Per-viewer reactions map — one query for the whole account,
// indexed into by postUri at selector time. Avoids N feed queries.
export const createViewerReactionsQueryKey = (args: {did: string}) =>
  createQueryKey(reactionsQueryKeyRoot, args)
// NOTE: persistedVersion intentionally NOT set — TanStack Query is a
// cache, MMKV is the source of truth. See src/state/queries/util.ts:28.
```

Per-post reads use `select` on the single map query:

```ts
export function useViewerReaction({postUri}: {postUri: string}) {
  const {did} = useSession()
  return useQuery({
    queryKey: createViewerReactionsQueryKey({did}),
    queryFn: async () => readAccountReactions(did),
    staleTime: STALE.INFINITY,    // MMKV doesn't go stale; listener triggers refresh
    select: (map) => map[postUri],
  })
}
```

Why one map, not one-query-per-post: feed shows 30+ posts. 30 query subscriptions + 30 independent reads is wasteful when MMKV read is synchronous. One map, many `select`s, zero refetches.

---

## 4. State Management

### 4.1 TanStack Query vs. Context vs. MMKV

| Concern | Primitive | Rationale |
|---|---|---|
| Reaction persistence | MMKV (`account` scope) | Synchronous, per-DID, listener-capable. |
| Reactive per-post `emoji?` | TanStack Query with `select` | Canonical pattern per CLAUDE.md; single query per account, selectors per post. |
| Bar-open / popover-open state | Local component state | Only lives inside the wrapping `QuickReactBarTrigger`. |
| Debounced-write controller | Feature-level Context (`context.tsx`) | Needs to survive across `PostFeedItem` unmount (scroll offscreen) — a Map keyed by `postUri` held above the feed row. |
| Feature flag value | `useAnalytics().features.enabled(...)` | Existing primitive; see `src/Navigation.tsx:1042`. Wrapped in `useQuickReactsEnabled()` for ergonomics. |

### 4.2 Optimistic update strategy (AC-16, AC-17)

The interaction between optimistic updates and debounce is the subtlest part of the feature. Canonical flow:

1. **User selects emoji `E` at time t0.**
2. Component calls `quickReactController.schedule(postUri, E)`.
3. Controller immediately:
   - Writes `{postUri, emoji: E, updatedAt: t0}` to MMKV.
   - Calls `queryClient.setQueryData(createViewerReactionsQueryKey({did}), oldMap => ({...oldMap, [postUri]: record}))`.
   - UI re-renders within one frame; chip animates in. Achieves AC-16's 100 ms bar.
   - Starts / resets a 2-second trailing timer for `postUri`.
4. **User selects emoji `F` at time t1 < t0 + 2s.**
5. Controller overwrites MMKV + cache with `F`; resets timer.
6. **At t_last + 2s** the timer fires; controller calls the mutation with the final emoji `F`.
7. **On mutation success**: no-op. Cache already has `F`; MMKV already has `F`.
8. **On mutation failure** (network error / 5xx / offline / AbortError):
   - Revert to `lastKnownValue` (captured before the first write in this debounce window).
   - Update MMKV and cache to the pre-change state.
   - Show `Toast.show(_(msg\`Couldn't save reaction\`), {type: 'warning'})` using `src/components/Toast`.
   - **No retry** (AC-16 explicit).
9. **Canceling a pending debounce** on post deletion / unmount / sign-out: controller exposes `cancel(postUri)`.

**Debounce semantics (AC-17)**:

- **Trailing only** (per `ac_check.json` question `Is the 2s debounce trailing-only, or leading+trailing?` — "Trailing-only assumed" per `ac_check.json:106`).
- **Window**: 2000 ms.
- **Scope**: per `postUri`. Two different posts do not debounce against each other.
- **Reset on every selection** within the window.
- **Implementation**: a `Map<string, NodeJS.Timeout>` inside the feature context. On selection: `clearTimeout(existing); setTimeout(flush, 2000)`. Pending flushes are also cleared on `cancel()` and on context unmount.

### 4.3 Cache invalidation

- MMKV listener (`account.addOnValueChangedListener`) triggers `queryClient.invalidateQueries({queryKey: createViewerReactionsQueryKey({did})})` on every write — this handles multi-tab scenarios and cross-component coordination.
- On sign-out: clear the in-memory query cache entry. MMKV for the signed-out DID is retained (leave it; user may sign back in).
- On account switch: `did` changes, `createViewerReactionsQueryKey` changes, TanStack Query refetches automatically against the new DID's MMKV record.

### 4.4 Why not React Context alone?

Two reasons to keep TanStack Query in the loop even though source-of-truth is MMKV:

1. The `select` pattern gives per-post subscriptions for free; a Context + Map would re-render every subscriber on every write.
2. Future v1 migration to server-side storage is a zero-component-change swap.

---

## 5. Feature Flag

### 5.1 Use existing GrowthBook primitive

Codebase pattern: `useAnalytics().features.enabled(...)` is the established primitive. Examples:

- `src/Navigation.tsx:1042` — `ax.features.enabled(ax.features.AATest)`
- `src/components/dms/dialogs/NewChatDialog.tsx:28` — `ax.features.enabled(ax.features.GroupChatsEnable)`
- `src/lib/hooks/useIsBskyTeam.ts:8` — `ax.features.enabled(ax.features.IsBskyTeam)`

GrowthBook is already wired (`src/analytics/features/index.ts:34`), refreshes runtime (`refresh()` at `src/analytics/features/index.ts:56`), caches in MMKV (`src/analytics/features/index.ts:10`), and publishes attribute-based gating.

### 5.2 Add the flag enum

Extend `src/analytics/features/types.ts:1`:

```ts
export enum Features {
  // ...existing...
  QuickReactionsV0 = 'quick_reactions_v0',
}
```

### 5.3 Ergonomic hook

```ts
// src/features/quickReact/hooks/useQuickReactsEnabled.ts
export function useQuickReactsEnabled(): boolean {
  const ax = useAnalytics()
  const {hasSession} = useSession()
  return hasSession && ax.features.enabled(ax.features.QuickReactionsV0)
}
```

Key invariant (per AC-15, UX §1.6): this hook is called at every entry point — `QuickReactBarTrigger`, `QuickReactChip`, `QuickReactButton`, `QuickReactA11yAction`, `QuickReactPicker` — and returning false means **render nothing, attach nothing, fetch nothing, log nothing**. The hook is the first line of every render; no query or analytics call happens before it short-circuits.

### 5.4 Runtime flip

GrowthBook's `refresh()` is already called on app lifecycle events. Because the flag is evaluated per-render and components subscribe to the analytics context, a flag flip causes a re-render of post rows naturally. No additional plumbing needed. UX §8.7 (mid-interaction flip) is handled because `QuickReactBar` also checks the flag on each render and unmounts itself when it flips off.

### 5.5 Why not Statsig / a new primitive?

- Statsig exists only as legacy stubs in `src/state/session/logging.ts:68` ("*Stubs, previously used to log session errors to Statsig.*"). It is not a live primitive.
- Introducing a new boolean preference in `src/state/persisted/schema.ts` would require a user-facing settings toggle, which is out of scope for v0 (this is a *server-side* experimental gate, not a user preference).
- GrowthBook satisfies every AC-15 requirement: default OFF, runtime-flippable, experiment-capable, cohort-assignable.

---

## 6. Platform-Specific File Layout

Per CLAUDE.md preference *"rather than having `Component.tsx`, `Component.web.tsx`, and `Component.native.tsx` in the same directory, we prefer to have a `Component/` directory with `index.tsx`, `index.web.tsx`, and `index.native.tsx`."*

| Component | Split |
|---|---|
| `QuickReactBarTrigger/` | `index.tsx` (native long-press) + `index.web.tsx` (hover + button) |
| `QuickReactBar/` | `index.tsx` (native overlay) + `index.web.tsx` (stub, returns null) |
| `QuickReactPopover/` | `index.web.tsx` (the popover) + `index.tsx` (stub, returns null) |
| `QuickReactButton/` | `index.web.tsx` (the button) + `index.tsx` (stub, returns null) |
| `QuickReactChip/` | `index.tsx` (shared base) + `index.web.tsx` (web override only if needed for click semantics) |
| `QuickReactPicker/` | `index.tsx` (shared; uses `Dialog` which already branches) |
| `QuickReactA11yAction.ts` | single file; platform differences are in how the action is attached to the row, not in this helper |
| `storage.ts` | single file; MMKV works identically on native and web (via `@bsky.app/react-native-mmkv`) |
| `queries/reactions.ts` | single file |
| `hooks/*.ts` | single files each |
| `analytics.ts` | single file |
| `context.tsx` | single file |

No `.ios.tsx` / `.android.tsx` splits are needed — iOS and Android share the native implementation. Haptic differences (iOS Heavy vs. Android forced-Light) are already handled inside `src/lib/haptics.ts:18`.

---

## 7. Analytics (AC-18)

### 7.1 URI hash function

- **Algorithm**: SHA-256 of the `postUri` string, truncated to the first 16 hex characters.
- **Primitive**: use Web Crypto on web (`crypto.subtle.digest`); on native, use `expo-crypto`'s `digestStringAsync(CryptoDigestAlgorithm.SHA256, uri)`. An existing shim at `src/platform/crypto.ts:7` exposes `crypto` for web; `expo-crypto` is not currently in `package.json` (plan-time verify) — alternative: a pure-JS sha256 impl via `@noble/hashes/sha2` if expo-crypto is unavailable, to avoid adding a native dependency. Either way, the hash lives in `analytics.ts` behind `hashPostUri(uri: string): Promise<string>`.
- **Rationale**: 64 bits of output is ample for analytics cohorting without being reversible; truncation is the standard privacy-preserving pattern.

### 7.2 Events

Three events, registered in `src/analytics/metrics/types.ts`:

```ts
'quickReaction:barOpen': {
  uriHash: string
  surface: 'feed' | 'thread'
  entryPoint: 'longPress' | 'hoverClick' | 'chip' | 'a11yAction'
  flagVariant: 'on' | 'off'            // always 'on' at emit time, but required per AC-18
  logContext: 'FeedItem' | 'PostThreadItem'
}
'quickReaction:select': {
  uriHash: string
  emoji: ReactionEmoji
  surface: 'feed' | 'thread'
  flagVariant: 'on'
  logContext: 'FeedItem' | 'PostThreadItem'
  isChange: boolean                      // true if viewer had a different emoji before
}
'quickReaction:remove': {
  uriHash: string
  previousEmoji: ReactionEmoji
  surface: 'feed' | 'thread'
  flagVariant: 'on'
  logContext: 'FeedItem' | 'PostThreadItem'
  removalMethod: 'reTapSelected' | 'pickerRemoveRow'
}
```

### 7.3 Emission points

- `barOpen`: emitted in `QuickReactBarTrigger`, `QuickReactChip`, `QuickReactA11yAction`, and `QuickReactButton` handlers, via a single `analytics.ts` helper so the payload is constructed identically.
- `select`: emitted in the controller's `schedule()` entry, before the MMKV write.
- `remove`: emitted in the controller's `schedule(null)` path.

### 7.4 `platform` and `flagVariant` fields

- `platform` is already attached by the analytics base context (see `src/analytics/index.tsx:100` — `platform: Platform.OS`). No need to set it per-event.
- `flagVariant`: include explicitly; defaults to `'on'` at emission since code only runs when flag is on. Kept on the payload for future-proofing (experiment variants beyond simple on/off).

---

## 8. Debounce Semantics (AC-17) — Formal Spec

- **Type**: trailing-edge debounce (no leading flush).
- **Window**: 2000 ms, resets on every selection for the same `postUri`.
- **Scope**: keyed on `postUri`. Independent timers for different posts.
- **Flushing triggers**:
  - Timer elapses → fire mutation with the most recent emoji for that postUri.
  - User navigates away from the feed/thread that contains this post → flush immediately (emit pending write so it is not lost). Handled via the feature context's unmount.
  - App is backgrounded → flush immediately on `AppState.change` to `background`. Guards against write loss if the OS kills the app.
  - User signs out → cancel all pending flushes (don't flush — different auth context).
  - Post is deleted → cancel (the write would 404 anyway).
- **Zero-mutation guarantee**: if the user re-selects the same emoji before the timer fires, the debounce still resets; but if the net-effect is the same emoji as was already on the server, the final mutation is still sent — simpler semantics beat micro-optimization for v0.
- **Interaction with optimistic update**: optimistic update is **synchronous** on every selection; debounce only affects the network write.

---

## 9. Dependencies & Abstractions to Reuse

| Need | Reuse | Source |
|---|---|---|
| Bottom-sheet / modal for a11y picker | `Dialog.Outer` / `Dialog.ScrollableInner` / `Dialog.Handle` / `Dialog.Close` | `src/components/Dialog/index.tsx`, CLAUDE.md Dialog pattern |
| Web popover focus/outside-click | Consider `Menu` primitives; fall back to a dedicated popover | `src/components/Menu/index.tsx`, `src/components/PostControls/PostMenu/index.tsx` |
| Button + icon | `Button`, `ButtonIcon`, `ButtonText` | `src/components/Button`; CLAUDE.md Button section |
| Toast | `Toast.show` | `src/components/Toast`; referenced at `src/components/PostControls/index.tsx:31` |
| Typography | `Text`, `<Trans>`, `msg()`, `useLingui` | `src/components/Typography`, `@lingui` |
| Haptics | `useHaptics()` | `src/lib/haptics.ts:8` — already respects `useHapticsDisabled` (AC-5) |
| Emoji icon | `Emoji` icon | `src/components/icons/Emoji.tsx` |
| Check / X / Trash icons | `CircleCheck`, `CircleX`, `Trash` from `src/components/icons/` | UX §13 |
| Theme atoms | `atoms as a`, `useTheme`, `web`, `native`, `ios`, `android`, `platform`, `useBreakpoints` | `#/alf` |
| Reduced motion | `useReducedMotion` from `react-native-reanimated` (`src/lib/custom-animations/LikeIcon.tsx:5` pattern) OR `useA11y().reduceMotionEnabled` (`src/state/a11y.tsx:13`) | Pick one in plan phase; recommend reanimated's for parity with existing animations |
| MMKV storage | `account` Storage instance | `src/storage/index.ts:145` |
| TanStack Query helpers | `createQueryKey`, `STALE.INFINITY` | `src/state/queries/util.ts:28`, `src/state/queries/index.ts` |
| Feature flag | `useAnalytics().features.enabled` | `src/analytics/index.tsx:230` |
| Analytics metric | `ax.metric(...)` | `src/analytics/index.tsx:56` |
| Post shadow / viewer.like | `usePostShadow` | `src/state/cache/post-shadow.ts` — reactions must be **shadow-independent** (AC-3) |
| Gesture handling (native) | `LongPressGestureHandler` from `react-native-gesture-handler` | Already a dep; used elsewhere in feed |
| Portal / overlay on native | TBD at plan time; candidates: `Dialog`'s portal host, or a new `View` at screen root | — |

### 9.1 New dependencies

None required. Verify at plan time:

- `expo-crypto` is in `package.json` (existing `expo-*` ecosystem); if not, use `@noble/hashes` pure-JS.
- `react-native-gesture-handler` is already a dep (used throughout feed).

---

## 10. Test Strategy

### 10.1 Unit tests (Jest)

- `storage.test.ts`: MMKV read/write round-trip, 500-cap eviction, per-DID isolation, version field preservation, migration placeholder.
- `debounce.test.ts`: single selection fires one mutation after 2 s; three selections within window fire one mutation with the last emoji; selections on different postUris are independent; cancel() on post delete stops flush; background flush fires immediately.
- `hashPostUri.test.ts`: deterministic output, 16-char length, differs across different URIs, stable across runs.
- `useQuickReactsEnabled.test.ts`: returns false without session; returns false when flag off; returns true when both on; re-renders on flag flip.
- `QuickReactPicker.test.tsx`: renders four emoji rows when no prior reaction; shows selected state + "Remove" row when reaction present; picker.close callback form is used (regression against CLAUDE.md footgun); each row label is Lingui-wrapped (no raw strings).
- `QuickReactChip.test.tsx`: renders null when no reaction; renders emoji pill when reaction exists; tap/click opens bar; accessibilityLabel announces current reaction.
- `reactions.test.ts` (queries): optimistic setQueryData reflects immediately; failed mutation reverts; debounced write sends the final emoji.

### 10.2 Integration tests

- `PostControls` renders chip slot without changes to existing behavior when flag is off. Regression: Like / Repost / Reply / Bookmark / Share are unaffected (AC-3: independence from Like).
- Long-press gesture on `PostFeedItem` does not trigger quick-react when flag is off; existing long-press behaviors (if any) are preserved.
- Screen-reader a11y action is absent when flag is off; present when flag is on.

### 10.3 E2E / smoke (Detox if present — verify at plan time)

- Happy-path native long-press → select → chip appears → persists across app relaunch.
- Happy-path web hover → click → select → chip appears.
- Happy-path a11y action (both platforms) → dialog opens → select → chip appears.
- Flag off → no chip, no button, no a11y action.
- Offline → optimistic chip → failure toast → chip reverts.

### 10.4 AC → test mapping (pre-sketch for the next architect pass)

Every AC-1..AC-18 can be covered; detailed mapping belongs in `plan.json` test_strategy field. For this requirements pass, the principle is:

- AC-1, AC-2: query/mutation unit tests; reactions.test.ts.
- AC-3: PostControls regression test.
- AC-4, AC-5: native integration test with gesture handler mock.
- AC-6, AC-7: web integration test with user-event.
- AC-8: surface-scope unit tests — `surface` prop gating.
- AC-9: storage unit tests + cross-restart E2E.
- AC-10: PostControls render snapshot shows no count, no other-user reactions.
- AC-11: QuickReactPicker accessibility tests.
- AC-12: reduced-motion branch tests for each animated component.
- AC-13: lint rule + render-tree test: no hard-coded strings in any feature file (script searches for non-Lingui `Text` children).
- AC-14: RTL render tests; verify order reversal and anchor mirroring.
- AC-15: `useQuickReactsEnabled.test.ts` + integration: when false, zero render output, zero MMKV read, zero analytics call.
- AC-16: debounce.test.ts failure path; optimistic revert timing test using fake timers.
- AC-17: debounce.test.ts.
- AC-18: analytics.test.ts asserting event name, payload shape, hash presence.

---

## 11. Risk Register

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | **Cross-device persistence gap.** AC-9 requests "across devices" but spec out-of-scope excludes atproto. v0 is device-local only. | Med | Document explicitly. Plan a v1 swap. Communicate in-product (not in v0 UI per spec). Abstract read/write behind query/mutation so swap is component-free. |
| R2 | **Gesture conflict on native post body.** Long-press collides with text-select on web (resolved by using hover on web), image viewer, link cards, author avatar nav. | High | Wire `LongPressGestureHandler` to a *sub-container* inside `PostFeedItem` that contains only author block + text, excluding `Embed`, author avatar link, link preview. Use `waitFor`/`simultaneousHandlers` with pan handler to guard against accidental activation while scrolling (UX §4.5). |
| R3 | **Touch-web hover is unreliable.** AC-6 specifies hover but some users are on touch-capable laptops. | Med | Always-visible React button when `(hover: none)` matches (UX §4.2 recommendation). |
| R4 | **Flag checked too late.** A query fires before `useQuickReactsEnabled()` check → network call leaks when flag is OFF → violates AC-15. | High | Every component's first line is `if (!enabled) return null`. No hooks (including `useQuery`) are called before the gate. Pattern enforced by code review + a linting pass. |
| R5 | **Debounce + optimistic + change-of-mind race.** Final selection must win; chip must reflect latest; mutation must carry final emoji. | High | Single centralized controller; all optimistic writes funnel through `schedule()`. Tests cover rapid-change scenarios with fake timers. |
| R6 | **Post deleted / user navigates away while debounce pending.** Could result in stale mutations against missing posts. | Med | Flush-on-unmount + cancel on delete (see §8). |
| R7 | **MMKV cap growth.** 500-record cap is a guess; heavy users may blow past it. | Low | Monitor analytics `barOpen` to `select` ratio; adjust cap in v1 if needed. |
| R8 | **`accessibilityActions` may not be on the post row wrapper.** If it's buried inside `PostControls`, attaching "react" to the right level is non-trivial. | Med | Verify at plan time on `src/view/com/posts/PostFeedItem.tsx`; likely need to add `accessibilityActions` to the outer `Link`/`View`. |
| R9 | **Haptic fires even in flag-off state if not gated.** | Low | `useHaptics()` is only called inside gated components; fine. |
| R10 | **Bundler platform split of `QuickReactBar`.** A stub `.web.tsx` returning null must exist or the bundler will fail on web. | Low | Explicitly create stub files per §6. |
| R11 | **Analytics PII leak.** URI carries author handle/DID in `at://did:.../...` form; including raw URI in analytics violates the spec's intent. | Med | Hash the URI (§7.1). Unit test asserts no raw URI appears in any quick-reaction event. |
| R12 | **GrowthBook race at first launch.** App can boot with GrowthBook still initializing (`TIMEOUT_INIT = 500` per `src/analytics/features/index.ts:30`). | Low | First render may return `enabled: false` until init completes (acceptable per spec). Document the behavior. |
| R13 | **Flag-flip mid-interaction drops chip without telling user.** | Low | UX §8.7 accepts silent teardown. |
| R14 | **React Compiler and gesture handler refs.** React Compiler may over-optimize callbacks passed to `LongPressGestureHandler`. | Low | Gesture handler's props are stable; React Compiler handles memoization automatically; no proactive `useMemo`/`useCallback` per CLAUDE.md. |

---

## 12. Out of Scope for v0

Explicit from ticket + spec + UX (all deferred to v1+):

1. **atproto lexicon / federation / firehose** — reactions are not stored in the user's repo, not broadcast to the firehose, not visible to other clients.
2. **Cross-device sync** — downgraded to same-device-cross-restart in v0 per parent agent resolution.
3. **Aggregate counts** (e.g., "12 🔥") — not rendered anywhere (AC-10).
4. **Other-users reactions** — the chip shows only the viewer's own emoji (AC-10).
5. **Reacted-by-viewer indicator for author** — not in author-facing notifications.
6. **Author notifications** — no push or in-app notification on reaction.
7. **Custom emoji set / skin tones** — fixed to `{heart, fire, eyes, joy}` (AC-1).
8. **Swipe gesture** — long-press + hover only (AC-4, AC-6).
9. **Moderation controls** specific to reactions — reactions piggyback on post moderation only.
10. **Like button refactor** — Like remains independent (AC-3).
11. **Reactions in composer / reply flow**.
12. **Reactions on DMs, profiles, lists, feed generators**.
13. **Quote, embed, search-result, notification-item surfaces** (AC-8).
14. **Retry on failure** — explicit "no retry loop" (AC-16).
15. **Long-press on web** — explicitly not a web trigger (UX §4.2).
16. **Scrub haptics on native** — rejected by design as too noisy (UX §9.2).

---

## 13. Open Questions Still Pending Reporter

Carried from `ac_check.json` (not blocking planning, but will shape plan.json):

1. AC-4: gesture target area on media (text/metadata only vs. include media). Design recommendation: text/metadata only.
2. AC-6: touch-web fallback (always-visible vs. long-press parity). Design recommendation: always-visible.
3. AC-9: cross-device storage ownership. **Parent agent resolved: client-only MMKV in v0.** Document explicitly as v1 deferred.
4. AC-15: feature-flag system. **Resolved here: GrowthBook via `useAnalytics().features.enabled()` + `Features.QuickReactionsV0` enum.**
5. AC-17: trailing vs. leading+trailing debounce. **Resolved: trailing-only** (§8).
6. AC-18: URI hash algorithm. **Proposed: SHA-256 truncated to 16 hex chars** (§7.1).

---

## 14. Inventory: Files the Next Architect Pass Will Touch

Preview of files for `plan.json` `files_allowlist`:

**New files** (all in `src/features/quickReact/`):
- `src/features/quickReact/index.ts`
- `src/features/quickReact/constants.ts`
- `src/features/quickReact/types.ts`
- `src/features/quickReact/context.tsx`
- `src/features/quickReact/storage.ts`
- `src/features/quickReact/analytics.ts`
- `src/features/quickReact/hooks/useQuickReactsEnabled.ts`
- `src/features/quickReact/hooks/useReducedMotion.ts` (or skip and use reanimated's directly)
- `src/features/quickReact/hooks/useViewerReaction.ts`
- `src/features/quickReact/queries/reactions.ts`
- `src/features/quickReact/components/QuickReactChip/index.tsx`
- `src/features/quickReact/components/QuickReactChip/index.web.tsx` (if needed)
- `src/features/quickReact/components/QuickReactBar/index.tsx`
- `src/features/quickReact/components/QuickReactBar/index.web.tsx`
- `src/features/quickReact/components/QuickReactPopover/index.web.tsx`
- `src/features/quickReact/components/QuickReactPopover/index.tsx`
- `src/features/quickReact/components/QuickReactPicker/index.tsx`
- `src/features/quickReact/components/QuickReactBarTrigger/index.tsx`
- `src/features/quickReact/components/QuickReactBarTrigger/index.web.tsx`
- `src/features/quickReact/components/QuickReactButton/index.web.tsx`
- `src/features/quickReact/components/QuickReactButton/index.tsx`
- `src/features/quickReact/components/QuickReactA11yAction.ts`
- `src/features/quickReact/__tests__/storage.test.ts`
- `src/features/quickReact/__tests__/debounce.test.ts`
- `src/features/quickReact/__tests__/hashPostUri.test.ts`
- `src/features/quickReact/__tests__/useQuickReactsEnabled.test.ts`
- `src/features/quickReact/__tests__/QuickReactPicker.test.tsx`

**Modified files**:
- `src/components/PostControls/index.tsx` — chip + web button mount points; accessibilityActions wire-up (if at this level); new `surface` prop.
- `src/view/com/posts/PostFeedItem.tsx` — wrap post body with `QuickReactBarTrigger`; pass `surface='feed'` to `PostControls`; attach accessibilityActions for the react action.
- `src/screens/PostThread/components/ThreadItemAnchor.tsx` — same, `surface='thread'`.
- `src/screens/PostThread/components/ThreadItemPost.tsx` — same.
- `src/screens/PostThread/components/ThreadItemTreePost.tsx` — same.
- `src/analytics/features/types.ts` — add `QuickReactionsV0 = 'quick_reactions_v0'`.
- `src/analytics/metrics/types.ts` — add three `quickReaction:*` events.
- `src/storage/schema.ts` — add `quickReactions` key to `Account` type.
- `src/App.native.tsx` / `src/App.web.tsx` — mount the feature context provider high in the tree if context is cross-screen (or keep context per-screen; plan-time decision).

**Total estimate**: ~27 new files, ~9 modified files.

---

## 15. Architectural Principles This Document Commits To

1. **Feature directory ownership.** Everything quick-react is `src/features/quickReact/` except the three mount-point touches.
2. **Flag-first gating.** No hook runs before `useQuickReactsEnabled()` short-circuits.
3. **MMKV source of truth, Query cache projection.** One query per account with selectors per post.
4. **Trailing debounce, centralized controller.** One `Map`-backed scheduler; all writes funnel through it.
5. **Dialog for a11y, not a bespoke modal.** `control.close(() => action)` callback form strictly observed.
6. **ALF atoms + theme atoms, no hex.** All colors via tokens.
7. **Every user-facing string via Lingui.** No exceptions (AC-13).
8. **Platform directory split** per CLAUDE.md preferred pattern.
9. **React Compiler-friendly code.** No proactive `useMemo`/`useCallback`.
10. **v0 client-only, v1 server-ready.** Query/mutation abstraction lets server-backed storage land later without component surgery.

# ADR — Quick-react bar on posts (PRI2pI7l)

> Status: Accepted (planning phase)
> Date: 2026-04-13
> Scope: v0 of a flag-gated, non-federated emoji reaction feature on PostFeedItem and thread post components.

## Context

Users today can engage with a post via Like (binary), Reply (full composer), or Quote (publishes to their timeline). There is no low-friction way to express an emotional reaction ("funny", "hype", "watching"), so a majority of feed impressions go without an engagement signal. The Quick-react ticket (PRI2pI7l) introduces a four-emoji picker (heart, fire, eyes, joy) reached via a platform-native gesture (native long-press, web hover+click, a11y action everywhere). v0 is explicitly non-federated and behind a GrowthBook feature flag.

The 18 ACs impose a specific shape on the design:

- Gesture + a11y parity (AC-4, AC-6, AC-7, AC-11)
- Zero-footprint flag-off state (AC-15)
- Optimistic <100ms update with trailing 2s debounce and revert-on-failure, no retry (AC-16, AC-17)
- Cross-surface scope limited to PostFeedItem + thread post components (AC-8)
- Device-persistent viewer-only chip (AC-9, AC-10)
- Full Lingui + RTL + reduced-motion coverage (AC-12, AC-13, AC-14)

The codebase already provides strong primitives for each of these: MMKV per-account Storage (`src/storage/index.ts:145`), GrowthBook feature flags (`src/analytics/features/index.ts:34`), TanStack Query with `createQueryKey` (`src/state/queries/util.ts:28`), Dialog + Menu + Button + Toast components, Lingui `msg`/`<Trans>`, `useHaptics` respecting system prefs (`src/lib/haptics.ts:18`), and the `features/liveNow` precedent for self-contained feature modules.

The prior architect pass produced a requirements document anchoring the module to `src/features/quickReact/`, confirming client-only MMKV storage for v0, choosing GrowthBook for the flag, and identifying the seven new components. This ADR records the load-bearing decisions that follow from that analysis.

## Decision

### D1. Feature module at `src/features/quickReact/`

Everything quick-react-specific lives inside a single feature directory, matching the `features/liveNow` precedent. Three non-feature touchpoints only: `PostControls` (chip + web button mount), `PostFeedItem` + three `ThreadItem*` components (gesture wrapper + a11y action), plus two schema additions (`src/analytics/features/types.ts`, `src/analytics/metrics/types.ts`, `src/storage/schema.ts`) and two app-root mounts for the provider (`src/App.native.tsx`, `src/App.web.tsx`).

**Alternatives considered**:
- Scatter across `src/components/` (bar, chip, picker) + `src/state/queries/` (reactions) + `src/lib/` (debounce). Rejected: the parts are co-dependent on shared types, storage, and analytics helpers; splitting creates circular-looking imports and hurts discoverability (CLAUDE.md: *"keep related code together"*).
- Put it in `src/state/queries/` only. Rejected: feature has UI, gestures, and a11y — not purely data-layer.

**Consequences**: one new feature directory (precedented); clear ownership; single barrel import path (`#/features/quickReact`). Slight overhead of an extra directory level vs. inlining into `components/`.

### D2. Client-only MMKV storage with server-swap abstraction

AC-9 says "persists across restarts and devices," but atproto/federation is out-of-scope per the ticket. The parent agent resolved this by downgrading "devices" to "same-device-cross-restart" in v0. Storage lives on the existing per-DID MMKV `account` instance (`src/storage/index.ts:145`) under a new `quickReactions` key on the `Account` schema. Reads and writes are abstracted behind `useViewerReactionsQuery` and `useWriteReactionMutation`, so v1 can swap to a server-backed query/mutation without touching any component.

**Alternatives considered**:
- AsyncStorage via `src/state/persisted/index.ts`. Rejected: single blob parse per read; unsuitable for feed-scroll frequency.
- A new persisted preferences slice with a version bump. Rejected: reactions are not preferences; overkill.
- Server endpoint in v0. Rejected: out-of-scope per ticket; no approved service owner.

**Consequences**: true cross-device sync is deferred to v1 — known gap, documented. Per-feed-row reads are synchronous (<1ms). Server swap path is documented and test-covered. Storage cap (500 records, oldest-100 eviction) prevents unbounded growth.

### D3. TanStack Query as reactive projection over MMKV

Source of truth is MMKV; TanStack Query holds a single per-account map keyed by `createViewerReactionsQueryKey({did})`. Per-post consumers use `select: map => map[postUri]` instead of N queries. MMKV's `addOnValueChangedListener` invalidates the query, keeping multi-component subscribers in sync.

**Alternatives considered**:
- React Context with a Map. Rejected: every subscriber re-renders on every write; no per-post memoization primitive; no zero-component swap path to server in v1.
- One query per postUri. Rejected: 30+ feed rows would mean 30+ subscriptions and 30+ reads when a single synchronous MMKV read would do.

**Consequences**: one query key per account; selector-based per-post reactivity; automatic account-switch handling via the `did` parameter; zero-change v1 swap to network queryFn.

### D4. Trailing-only 2s debounce via a single per-postUri scheduler

A feature-level Provider (mounted at app root) owns a `Map<postUri, {timer, lastKnown}>` scheduler. Every selection calls `schedule(postUri, emoji)`, which synchronously updates MMKV and the query cache (optimistic, <100ms — satisfies AC-16), then sets a trailing 2s timer. Subsequent selections within the window reset the timer. On flush, the mutation fires with the final emoji. On failure, state reverts to `lastKnown` and a Toast shows `_(msg\`Couldn't save reaction\`)`. No retry.

Flush triggers: timer elapse, component unmount of the owning screen, `AppState` background (guards against OS-kill data loss), post deletion (cancel-not-flush), sign-out (cancel).

**Alternatives considered**:
- Leading + trailing debounce. Rejected: sends an initial request that may be contradicted immediately; `ac_check.json` resolves trailing-only.
- No optimistic update. Rejected: violates AC-16's 100ms bar.
- Retry on failure. Rejected: AC-16 explicit "no retry loop."
- Per-component debounce. Rejected: post scrolls out of the viewport mid-debounce would lose pending writes. Provider at app-root survives feed unmount.

**Consequences**: AC-16 and AC-17 met in one centralized place; `cancel` and `flush` handled consistently; complexity concentrated in one testable module.

### D5. GrowthBook flag via existing `useAnalytics().features.enabled()` primitive

Add `QuickReactionsV0 = 'quick_reactions_v0'` to the `Features` enum (`src/analytics/features/types.ts`). A single ergonomic hook `useQuickReactsEnabled()` combines the flag check with `useSession().hasSession`. The hook is called at the very top of every feature entry component; when false, the component returns null before any other hook runs — guaranteeing zero network and zero analytics side effects when OFF (AC-15).

**Alternatives considered**:
- Statsig. Rejected: codebase has only legacy stubs (`src/state/session/logging.ts:68`); not live.
- New persisted-preference boolean. Rejected: this is a server-side experiment gate, not a user preference; no user-facing toggle in v0.
- Inline `ax.features.enabled(...)` everywhere. Rejected: scattering the session-gate logic duplicates the check and risks missing one site.

**Consequences**: runtime-flippable without reinstall (GrowthBook's `refresh()` already wired at `src/analytics/features/index.ts:56`); first-launch race returns `false` until GrowthBook inits (acceptable); single-site change to flip the feature on.

### D6. Shared `QuickReactPicker` (Dialog) is the canonical a11y entry point

Rather than bolting an accessibility action onto the visual long-press bar, AC-11 is satisfied by a dedicated `Dialog.Outer` + `Dialog.ScrollableInner` picker. The `accessibilityActions` array on the post-row wrapper includes `{name: 'react', label: _(msg\`React to post\`)}`; activating it opens the picker. The picker reuses existing Dialog infrastructure (`src/components/Dialog/index.tsx` native bottom sheet + `index.web.tsx` web modal), so focus trap, Escape handling, and outside-click dismiss are free.

Selection uses `control.close(() => onSelect(emoji))` callback form (CLAUDE.md footgun: *"Always use `control.close(() => ...)` when performing actions after closing a dialog"*), preventing races with post-close state updates.

**Alternatives considered**:
- Reuse the long-press bar for screen readers. Rejected: the bar's drag-scrub affordance has no screen-reader analog; a list of buttons is the correct shape.
- A bespoke popover. Rejected: Dialog already handles focus management, platform branching, Handle/Close, and localized header.

**Consequences**: one shared picker covers native + web + screen reader + keyboard paths; a11y is first-class, not an afterthought; all labels pass through Lingui so AC-13 is structurally enforced.

### D7. Platform split via directory + `index.platform.tsx`

Every platform-branching component (`QuickReactBar`, `QuickReactPopover`, `QuickReactButton`, `QuickReactBarTrigger`, `QuickReactChip`) uses a directory with `index.tsx` and `index.web.tsx` siblings — matching the CLAUDE.md preference over flat `Component.web.tsx` alongside `Component.tsx`. Components that render nothing on one platform export a typed stub returning `null` so the bundler never fails on import.

`QuickReactPicker` uses a single `index.tsx` because it wraps `Dialog`, which already platform-branches internally.

**Alternatives considered**:
- Flat `Component.native.tsx` / `Component.web.tsx` at the same level as `Component.tsx`. Rejected: weaker visual signal of platform branching; CLAUDE.md explicitly prefers the directory pattern.
- Runtime `Platform.OS` checks inside one file. Rejected: bundles dead code for the other platform and commingles unrelated logic.

**Consequences**: clear platform boundaries; zero risk of accidentally importing a native gesture library into the web bundle; slightly more files (13 .tsx files for 7 components) with explicit stubs.

### D8. `PostControls` minimal integration via an optional `surface` prop

`src/components/PostControls/index.tsx` gains one new prop: `surface?: 'feed' | 'thread'`. When undefined (default), no chip or button is rendered — existing callers (quote embeds, search previews, notification items, feed-generator previews) stay pristine, automatically satisfying AC-8. Only `PostFeedItem` and the three `ThreadItem*` components pass the prop. The `QuickReactBarTrigger` wrapper lives on those caller components, not inside `PostControls` (the trigger wraps the entire post body, which is outside `PostControls`' scope).

The Like / Reply / Repost / Bookmark / Share buttons are untouched — AC-3 (Like independence) is satisfied by strictly additive changes.

**Alternatives considered**:
- Modify every caller of `PostControls` to add a chip. Rejected: explodes the touched-file list unnecessarily; in-scope callers already know which surface they are.
- Make `PostControls` render the chip unconditionally if a reaction exists. Rejected: would leak the feature onto out-of-scope surfaces (AC-8) and ignore the flag-off state (AC-15).

**Consequences**: minimal, safe integration; scope discipline is enforced by the prop's optionality; the trigger wrapper stays at the screen/list-item level where the post body is defined.

## Consequences (cross-cutting)

**Gained**:
- All AC are mapped to concrete files and tests (see plan.json test_strategy.ac_mapping).
- Feature is flag-gated at the hook level; OFF state is provably zero-footprint.
- v0 ships quickly on device-local MMKV; v1 swaps to server storage without component surgery.
- A11y is first-class via the shared picker.
- Centralized debounce controller means the failure/race scenarios are covered in one place.

**Lost / tradeoffs**:
- No true cross-device sync in v0 — a documented gap (see ticket out-of-scope list).
- Adds ~27 new files (inevitable given the component inventory the AC dictate).
- QuickReactProvider must be mounted at app root; if omitted, the scheduler silently no-ops. Mitigated by an assertion in the provider when it's first consumed.

**Known future work for v1**:
- Server-backed storage (likely Bluesky appview table) swap behind the existing query/mutation abstraction.
- Aggregate counts / other-user reactions (explicitly out of scope for v0 per AC-10).
- Possible Like/Reactions unification (out of scope).

## References

- Ticket: `/Users/Alyona_Yanuchek/AIProjects/ticket-to-deliver2/social-app/.claude/state/PRI2pI7l/ticket.json`
- Spec: `/Users/Alyona_Yanuchek/AIProjects/ticket-to-deliver2/social-app/.claude/state/PRI2pI7l/spec.md`
- UX: `/Users/Alyona_Yanuchek/AIProjects/ticket-to-deliver2/social-app/.claude/state/PRI2pI7l/ux.md`
- Requirements: `/Users/Alyona_Yanuchek/AIProjects/ticket-to-deliver2/social-app/.claude/state/PRI2pI7l/requirements.md`
- Plan: `/Users/Alyona_Yanuchek/AIProjects/ticket-to-deliver2/social-app/.claude/state/PRI2pI7l/plan.json`
- Codebase anchors: `src/features/liveNow/index.tsx:1`, `src/storage/index.ts:145`, `src/analytics/features/index.ts:34`, `src/state/queries/util.ts:28`, `src/components/Dialog/index.tsx`, `src/components/PostControls/index.tsx:43`, `src/lib/haptics.ts:8`, `src/components/Menu/index.tsx:151`

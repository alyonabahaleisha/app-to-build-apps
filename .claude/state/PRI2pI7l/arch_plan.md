# Architecture Plan: Quick-react bar on posts (PRI2pI7l) — v0

> **Scope of this doc**: Architecture spec + testable technical ACs for the v0
> scope proposed on the Trello card:
> - Fixed 4-emoji set: heart, fire, eyes, laugh
> - Long-press on native / hover-reveal on web
> - One reaction per user per post; independent of Like
> - Feed + thread surfaces only
> - No federation, no notifications, Statsig-gated
>
> **This is an architecture spec, not a binding execution plan.** No code is
> written. A formal `plan.json` with `files_allowlist` is produced in the
> `PLANNING` phase after PM/product sign-off on the v0 shape.

---

## 1. Data Model — v0 Decision

### Decision: **Local-only, device-scoped, per-account persistence.**

v0 reactions are stored on-device in MMKV (`#/storage`) under an account-scoped
key. No network write, no lexicon, no appview change.

### Rationale — the three candidates

| Option | Pro | Con | Verdict |
|---|---|---|---|
| **A. New lexicon** (`app.bsky.feed.reaction`) | Canonical, federates, author-visible | Multi-team (atproto spec + appview + ozone + notifications); 6-8 weeks minimum; PDS coordination; moderation surface design | Rejected for v0. Correct long-term path for v1. |
| **B. Piggyback on Like** | Zero new backend | Breaks Like semantics; other clients see garbled likes; cannot support "change reaction"; violates principle of least surprise for federation consumers | Rejected outright. Pollutes an existing lexicon. |
| **C. Local-only (per-account MMKV)** | Ships in days; no backend risk; no federation concerns; clean flag gate; lets us validate the gesture + emoji set UX before we spend protocol capital | No cross-device sync; no aggregation across users; zero author signal; "reaction" is misleading at an ecosystem level — this is a *private bookmark-with-emoji* | **Selected for v0.** |

### Implications and honest caveats

- **v0 is a private UX experiment, not a social feature.** Only the reacting
  user sees their own reaction. Aggregate counts across users are impossible
  without a backend — explicitly out of scope.
- **Cross-device**: a user who reacts on iPhone will not see their reaction on
  the web. This is acceptable for a flag-gated experiment; it must be noted in
  any internal release notes and rollout channel.
- **Clearing**: reactions stored locally must be cleared on logout (see
  `src/state/persisted/index.ts:54` `clearStorage` for the account-teardown
  pattern) and on account switch.
- **Persistence key layout** (extends `src/storage/schema.ts:71` `Account`):
  - Scope: `account` storage (`src/storage/index.ts:145`), keyed by DID.
  - New field on `Account`: `quickReactions?: Record<string, ReactionEmoji>`
    where the key is the post URI and the value is one of the 4 emoji tokens.
  - Rationale for co-locating on `Account` rather than a new top-level storage
    instance: aligns with existing patterns (search history, last-selected
    feed), and reuses the per-DID scoping the storage already provides.

### Emoji encoding

- Store the emoji as a short **token** (`'heart' | 'fire' | 'eyes' | 'laugh'`),
  not the grapheme. This insulates us from emoji variation-selector / platform
  rendering drift and makes v1 migration to a lexicon (which will almost
  certainly use tokens) a rename-only change.

---

## 2. Module Placement

### Feature directory: `src/features/quickReactions/`

This is a macro-feature bridging state, a gesture wrapper, a picker dialog, and
a post-card overlay. It spans both feed and thread surfaces. Per
`CLAUDE.md` guidance on `/features`, this is the correct home.

```
src/features/quickReactions/
├── index.tsx                         # Public API: <QuickReactionTrigger>, useQuickReaction
├── components/
│   ├── QuickReactionBar.tsx          # The 4-emoji row UI (shared)
│   ├── QuickReactionTrigger/
│   │   ├── index.tsx                 # Default: re-exports native
│   │   ├── index.native.tsx          # Long-press gesture wrapper
│   │   └── index.web.tsx             # Hover-reveal wrapper
│   ├── QuickReactionPickerDialog.tsx # A11y picker (screen-reader path)
│   └── QuickReactionBadge.tsx        # Small badge shown on post card if user has reacted
├── state/
│   ├── useQuickReaction.ts           # Read hook (TanStack Query, see §3)
│   └── useQuickReactionMutation.ts   # Write hook (optimistic)
├── lib/
│   ├── emojis.ts                     # The 4-emoji token constants + labels
│   └── gate.ts                       # Statsig gate wrapper (see §5)
└── README.md                         # Scope, v0 caveats, v1 migration path
```

### Integration point

- `src/components/PostControls/index.tsx` renders the post action row for
  feed and thread. We do **not** add a visible button there in v0 — the
  trigger is the post body itself. Instead, the post card wrapper (the View
  that contains the post body + controls) is wrapped by
  `<QuickReactionTrigger>`. Candidate wrap sites:
  - Feed: the post item root in `src/view/com/post/Post.tsx` or the newer
    card wrapper if one exists.
  - Thread: the post-thread-item root in `src/screens/PostThread/`.
- The visible affordance on web (hover-revealed smile-plus icon) is rendered
  positioned absolutely inside `QuickReactionTrigger/index.web.tsx` — it does
  not need to live inside `PostControls`.

### Why not `src/components/`?

`/components/` is for shared, reusable, platform-agnostic primitives (Button,
Dialog, Menu). QuickReactions carries feature-specific state (MMKV schema,
gate logic, emoji set) and is not reusable elsewhere. `/features/` is the
right home per the project guide.

### Why not `src/screens/`?

No new route is added in v0. Correct.

---

## 3. State Layer

### Pattern: **TanStack Query over MMKV**, not raw `useState`.

Matches the CLAUDE.md guidance ("TanStack Query for server state ... React
Context for UI preferences") and — more importantly — gives us the same
optimistic-update / cache-invalidation ergonomics as the real `useLikeMutation`
(`src/state/queries/like.ts:5`) and `useBookmarkMutation`
(`src/state/queries/bookmarks/useBookmarkMutation.ts:24`). When v1 swaps MMKV
for an XRPC call, only the `queryFn` / `mutationFn` bodies change. Consumers do
not.

### Query key

```ts
// src/features/quickReactions/state/useQuickReaction.ts
const quickReactionQueryKeyRoot = 'quickReaction'

export const createQuickReactionQueryKey = (args: {did: string; postUri: string}) =>
  createQueryKey(quickReactionQueryKeyRoot, args)
```

- Uses `createQueryKey` from `src/state/queries/util.ts:28`.
- No `persistedVersion` needed — MMKV is the source of truth; TanStack is
  just a shared cache with subscribe/invalidate.

### Read hook

```ts
export function useQuickReactionQuery({postUri}: {postUri: string}) {
  const {currentAccount} = useSession()
  return useQuery({
    queryKey: createQuickReactionQueryKey({did: currentAccount?.did ?? '', postUri}),
    queryFn: () => account.get([currentAccount!.did, 'quickReactions'])?.[postUri] ?? null,
    staleTime: STALE.INFINITY,          // MMKV-backed; only mutation invalidates
    enabled: !!currentAccount?.did,
  })
}
```

### Mutation hook

```ts
export function useQuickReactionMutation() {
  const qc = useQueryClient()
  const {currentAccount} = useSession()

  return useMutation({
    mutationFn: async ({postUri, emoji}: {postUri: string; emoji: ReactionEmoji | null}) => {
      const did = currentAccount!.did
      const current = account.get([did, 'quickReactions']) ?? {}
      if (emoji === null) delete current[postUri]
      else current[postUri] = emoji
      account.set([did, 'quickReactions'], current)
    },
    onMutate: async ({postUri, emoji}) => {
      // Optimistic: set cache immediately, return rollback ctx
      const key = createQuickReactionQueryKey({did: currentAccount!.did, postUri})
      await qc.cancelQueries({queryKey: key})
      const previous = qc.getQueryData(key)
      qc.setQueryData(key, emoji)
      return {previous, key}
    },
    onError: (_err, _vars, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.previous)
    },
    onSettled: (_data, _err, {postUri}) => {
      qc.invalidateQueries({
        queryKey: createQuickReactionQueryKey({did: currentAccount!.did, postUri}),
      })
    },
  })
}
```

### Why not stash on `PostShadow`?

`PostShadow` (`src/state/cache/post-shadow.ts:21`) is a per-render-tree
ephemeral shadow for optimistic post-view mutations (like, repost, bookmark).
It is not persisted, and adding a new field would entangle v0 with every
consumer of `usePostShadow`. v0 reactions are purely a local overlay — keep
them out of the shadow. (v1 will likely add a `reactions` field to `PostShadow`
when the lexicon lands.)

---

## 4. Platform Split

### Native (iOS + Android): long-press gesture

- Implementation: `react-native-gesture-handler` `Gesture.LongPress()` with
  `minDuration: 400ms`, wrapped in `GestureDetector`. Pattern established at
  `src/view/com/lightbox/ImageViewing/components/ImageItem/ImageItem.ios.tsx:11`.
- Trigger zone: the post body (text + embed region), *excluding* the existing
  `PostControls` row. This avoids colliding with long-press on Like/Reply
  icons which iOS users already use for accessibility actions.
- On trigger: play haptic via `useHaptics()` (`src/components/PostControls/index.tsx:14`),
  present `QuickReactionBar` as an overlay positioned above the finger (fallback
  below if near top of screen).
- **Gesture conflict**: iOS system text-selection long-press on selectable
  post text. Mitigation: the post body in feed views is not selectable by
  default; in thread view, we defer to text selection on text nodes and only
  attach the long-press to the post chrome (avatar/surrounding padding). This
  must be validated in design review.

### Web: hover-reveal affordance

- An absolutely-positioned "smile-plus" icon button in the top-right of the
  post card, visibility controlled by `:hover` on the card container (CSS via
  `web(...)` style util from `#/alf`, see `CLAUDE.md` Styling section).
- Click opens a popover containing `QuickReactionBar`. Implementation options,
  in preference order:
  1. Reuse `ContextMenu` primitive (`src/components/ContextMenu/index.web.tsx`)
     — already popover-capable, a11y-audited.
  2. Fall back to `Dialog` (`src/components/Dialog/index.web.tsx`) if the
     ContextMenu API is too opinionated.
- **Keyboard**: the icon is focusable; `Enter` / `Space` opens the popover;
  arrow keys move focus between the 4 emoji; `Enter` / `Space` selects;
  `Escape` closes. This is non-negotiable for the a11y AC.

### Screen reader (both platforms): accessible picker dialog

- `QuickReactionTrigger` exposes an `accessibilityActions=[{name: 'react',
  label: 'React to post'}]` on both platforms.
- Activating the action (VoiceOver rotor / TalkBack local context menu / web
  AT) opens `QuickReactionPickerDialog`, a standard `Dialog` with 4 labelled
  buttons: "Heart", "Fire", "Eyes", "Laugh" (translated via Lingui `msg`).
- Dialog close uses the `control.close(callback)` pattern per
  `CLAUDE.md` footgun section.

---

## 5. Statsig Feature-Flag Integration

### Honest finding

**Statsig is not currently integrated in this codebase.** Grep across
`/src` for `statsig`, `useGate`, `useFeatureGate`, `featureGate`,
`@statsig` returns no implementation (only a single comment in
`src/state/session/logging.ts:69` saying Statsig *was* used and may be
revived, and a Sentry integration stub in `node_modules`). The ticket's
"Statsig flag" directive is aspirational.

### v0 plan: internal flag via device storage + wrapper hook

Encapsulate the gate check behind a single hook so we can swap in Statsig
later without touching feature code:

```ts
// src/features/quickReactions/lib/gate.ts
export function useQuickReactionsGate(): boolean {
  // v0: device-storage toggle (dev/demo/internal only)
  const [devMode] = useStorage(device, ['devMode'])
  return devMode === true
}
```

- **Gate name (for future Statsig)**: `quick_reactions_v0`
- **Default**: `false` for all users. Enabled only when `devMode` is true
  in device storage, which is itself internal (`src/storage/hooks/dev-mode.ts`).
- **When Statsig is introduced**: replace the body of `useQuickReactionsGate`
  with the Statsig call. No other file changes.

### Rollout expectation

- v0 ships behind `devMode`. Not visible to end users.
- Flag flip to a Statsig-managed rollout happens in a follow-up ticket, after
  the team integrates Statsig client SDK.

---

## 6. Optimistic Update + Error Path

Because v0 writes are local-only (synchronous MMKV), the "optimistic" path is
effectively instant. Still, we model it via TanStack Query's
`onMutate` / `onError` / `onSettled` so that v1 (network-backed) is a drop-in
replacement.

| Scenario | Behavior |
|---|---|
| User taps emoji X (no prior reaction) | UI updates immediately (cached query flips). MMKV write is synchronous. No toast. |
| User taps emoji X, then emoji Y before any animation completes | Second mutation supersedes; `onMutate` captures current cache; `onSettled` invalidates. No double-write — MMKV `set` is idempotent. |
| User taps same emoji twice (toggle-off) | Mutation called with `emoji: null`; record removed from MMKV. |
| MMKV write throws (disk full, corruption) | `onError` rollback restores previous cache value. Show `Toast.show` with generic failure. Log via `logger.error` with `safeMessage` (per `useBookmarkMutation` pattern at `src/state/queries/bookmarks/useBookmarkMutation.ts:58`). |
| User logs out mid-gesture | `enabled: !!currentAccount?.did` short-circuits the query; mutation no-ops if no session. |
| Post deleted (tombstone) | v0 is local-only; the reaction record persists harmlessly in MMKV. The badge is only rendered from `usePostShadow` on live post views, so a tombstoned post simply doesn't render it. A periodic GC task (out of scope for v0) will eventually prune stale entries. |
| Offline | Irrelevant to v0 — writes are local. (v1 gets a queue.) |

---

## 7. Test Strategy

### Tiers

1. **Jest unit tests** — state hooks (`useQuickReactionQuery`,
   `useQuickReactionMutation`), MMKV schema, emoji token mapping, gate hook.
2. **Jest component tests** — `QuickReactionBar` rendering, a11y labels,
   keyboard navigation on web. Use existing component-test patterns (search
   `**/*.test.tsx`). No E2E-grade gesture simulation.
3. **Maestro E2E (native + web)** — long-press on a feed post opens the bar;
   hover on a web feed post reveals the icon; selecting an emoji persists
   across app restart.
4. **Manual smoke** — screen-reader path on iOS (VoiceOver) and Android
   (TalkBack), plus NVDA/VoiceOver on web.

### AC-to-test mapping

Acceptance criteria are derived from the v0 scope on the Trello card. Each AC
has a unique ID `ACv0-N` to be copied into `ac_check.json` if this architecture
is approved.

| AC ID | Acceptance Criterion | Test Tier | Test Case |
|---|---|---|---|
| ACv0-1 | Fixed emoji set is exactly `[heart, fire, eyes, laugh]`; tokens not graphemes | Unit | `emojis.ts` exports a frozen 4-element tuple; snapshot test |
| ACv0-2 | Long-press (>=400ms) on native post body opens the bar | E2E (native) | Maestro `longPress` on `post-body` testID |
| ACv0-3 | Hover on web post reveals react icon; click opens bar | E2E (web) + component | Component: hover state toggles visibility; E2E: click flow |
| ACv0-4 | Selecting an emoji persists across app restart | E2E | Maestro: react, kill app, relaunch, assert badge shown |
| ACv0-5 | One reaction per user per post; selecting a second replaces the first | Unit | Mutation test: write A then B, assert MMKV has only B |
| ACv0-6 | Tapping current reaction removes it | Unit | Mutation with `emoji: null`; assert entry deleted |
| ACv0-7 | Reactions independent of Like — reacting does not call `like()`; liking does not set a reaction | Unit + component | Spy on `useLikeMutation`; assert zero calls from reaction flow |
| ACv0-8 | Feature is hidden unless `devMode` is true (v0 gate) | Component | Render post with gate off: trigger wrapper is a no-op pass-through |
| ACv0-9 | Screen reader exposes a "React to post" action that opens an accessible picker dialog | Manual + component | Component: `accessibilityActions` prop includes `react`; manual: VoiceOver / TalkBack / NVDA smoke |
| ACv0-10 | Keyboard-only web users can reach, open, navigate (arrows), and select (Enter) the bar | Component + E2E (web) | Component: focus trap test; E2E: Tab to icon, Enter, ArrowRight, Enter |
| ACv0-11 | Bar and picker appear correctly in light/dark themes, at all breakpoints, and in RTL | Component (visual) + manual | Screenshot tests under `light`, `dark`, `gtMobile=false/true`, `I18nManager.isRTL=true` |
| ACv0-12 | Reactions cleared on logout and on account switch | Unit | After calling `clearStorage` / account-switch reducer, `account.get([did, 'quickReactions'])` returns `undefined` |
| ACv0-13 | Badge on post card is rendered only on feed and thread surfaces; not on embeds/quote posts | Component | Render `QuickReactionBadge` conditionally via surface context; snapshot per surface |
| ACv0-14 | MMKV write failure does not break UI; cache rolls back; error is logged | Unit | Mock `account.set` to throw; assert `onError` rollback and `logger.error` called |
| ACv0-15 | Rapid emoji switching (A -> B within 50ms) does not corrupt state | Unit | Two mutations in quick succession; final state is B |
| ACv0-16 | Reduced-motion setting disables bar reveal animation | Manual + component | Read `disableAutoplay`/reduced-motion pref; assert `Reanimated` layout transitions are skipped |
| ACv0-17 | All user-facing strings go through Lingui `msg()` / `<Trans>` | Lint + review | ESLint rule on the feature directory; review in PR |
| ACv0-18 | No federation, no notification, no server write in v0 | Integration | Network-layer spy: zero XRPC calls originate from any quickReactions module |

### 9-category coverage cross-check

1. Happy path — ACv0-2, -3, -4
2. Failure/Negative — ACv0-14 (storage error)
3. Boundary — ACv0-5 (one-per-post), ACv0-15 (rapid switching)
4. Error handling — ACv0-14
5. Security — ACv0-18 (no accidental network), ACv0-12 (account data isolation)
6. Concurrency — ACv0-15
7. Regression — ACv0-7 (Like unaffected), ACv0-13 (doesn't bleed into embeds)
8. Breaking change — N/A for v0 (gated); migration path to v1 is additive
9. Config exhaustion — ACv0-8 (gate), ACv0-11 (theme/breakpoint/RTL), ACv0-16 (reduced motion)

---

## 8. Explicit Out-of-Scope (v0)

These are **deferred to v1** or later and must not creep into the v0 build:

- Federation / AT Protocol lexicon (`app.bsky.feed.reaction` or similar).
- Server-side aggregation; per-emoji counts across users.
- Post-author notifications on reaction.
- Author-visible "who reacted" list (analog of liked-by).
- Custom emoji / picker expansion beyond the 4.
- Reactions on comments, quote posts, feed generators, DM messages.
- Moderation surface: labeling, reporting, muting of reactions.
- Third-party client / non-Bluesky appview compatibility.
- Cross-device sync (even for the same account).
- Analytics beyond a single client-side event (`quickReaction:set` with emoji
  token) fired through the existing `useAnalytics` surface
  (`src/components/PostControls/index.tsx:32`) — KPIs requiring server data
  are out of scope.

---

## 9. Risk Register — Top 3

### R1. **"Reactions" that only the user sees will be perceived as broken.**
- **Likelihood**: high if shipped to end users, low while gated to `devMode`.
- **Impact**: high. Shipping a private feature labelled "reactions" will
  generate support volume and bad press ("my reactions don't show to my
  friends"). Messaging + the gate are the only mitigations.
- **Mitigation**: (a) keep the gate default false; (b) label the feature in
  UI as something less socially-loaded than "reaction" if it ever reaches
  internal dogfood (proposed internal string: "Quick note"); (c) write
  clear internal release notes that v0 is a UX validation, not a social
  primitive.

### R2. **Gesture collisions on native, especially iOS text selection and existing long-press menus.**
- **Likelihood**: medium. The feed post body is currently non-selectable in
  most contexts, but the thread view exposes text selection, and iOS has
  system-level long-press behaviors (accessibility, haptic touch) that can
  race with our handler.
- **Impact**: medium. Users unable to select quoted text, or accidental
  reactions triggered by a11y gestures.
- **Mitigation**: constrain the long-press trigger zone to post chrome
  (avatar + surrounding padding) rather than the text node; `simultaneousWith`
  the existing pan/scroll gestures; `minDuration: 400` (longer than system
  haptic touch); gate review with QA on iOS + Android hardware before any
  rollout beyond `devMode`.

### R3. **"Local-only storage" assumption quietly becomes a data-loss bug on device replacement, account switch, or logout.**
- **Likelihood**: certain — this is the defined behavior.
- **Impact**: low now (data is private and experimental), but will become a
  support issue if v0 is ever turned on for real users.
- **Mitigation**: (a) `clearStorage` path must clear `quickReactions` — this
  is enforced by storing on the existing `account` MMKV instance whose
  lifecycle is already tied to session teardown; (b) add a unit test
  (ACv0-12) asserting the reaction is gone after logout; (c) never enable
  the gate for real users without a server-backed successor.

---

## 10. References (file:line)

- Post action row: `src/components/PostControls/index.tsx:43`
- Existing mutation with optimistic + error handling pattern:
  `src/state/queries/bookmarks/useBookmarkMutation.ts:24`
- Simpler mutation pattern (Like): `src/state/queries/like.ts:5`
- Post shadow (not used here, but referenced): `src/state/cache/post-shadow.ts:21`
- Query key helper: `src/state/queries/util.ts:28`
- MMKV storage (device + account scopes): `src/storage/index.ts:140`
- Account storage schema (where v0 field is added): `src/storage/schema.ts:71`
- Persisted-state clear-on-logout: `src/state/persisted/index.ts:54`
- Long-press gesture reference: `src/view/com/lightbox/ImageViewing/components/ImageItem/ImageItem.ios.tsx:11`
- Context menu primitive (web popover candidate): `src/components/ContextMenu/index.web.tsx`
- Dialog close callback footgun: `CLAUDE.md` "Dialog Close Callback (Critical)"
- Statsig stub comment (confirms not integrated today):
  `src/state/session/logging.ts:69`
- Feature directory exemplars: `src/features/liveNow/`, `src/features/liveEvents/`

---

## 11. Open Questions for Product / Design (before PLANNING phase)

Even within the narrowed v0 scope, the following are unresolved and must be
answered before a binding `plan.json` is written:

1. Does v0 ship with a visible on-post badge showing the user's own reaction
   (my recommendation: yes, tiny emoji overlay on bottom-right of post
   media or next to author name)? Or is the reaction entirely invisible
   except during the picker interaction?
2. Should the bar appear on quote-post embeds inside a post? (Default
   answer: **no** — matches "feed + thread only" wording.)
3. Confirmation that `devMode` is an acceptable proxy for the Statsig gate
   until Statsig is actually integrated.
4. Copy for the screen-reader accessible action label — "React to post" or
   something else? Must be finalized for translation extraction.

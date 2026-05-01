# Architecture Spec: Streaks + Lightweight Gamification (v0)

Ticket: Trello i9KLo7kw
Scope: (A) Daily-visit streak indicator, (B) Weekly "your week on Bluesky" recap.

---

## 1. Platform Reality Check (AT Protocol)

- AT Protocol has **no lexicon** for streaks, visit-day counters, or weekly rollups today. There is no `app.bsky.gamification.*` namespace and no `bskyAppUpsertNux`-equivalent for counter state beyond small enum NUXes (`src/state/queries/nuxs/definitions.ts`).
- The `bskyAppState` preferences bucket used by `useNuxs` (`src/state/queries/nuxs/index.ts`) stores small opaque NUX blobs. It is not suitable for an unbounded, cross-device, tamper-resistant streak counter.
- Existing atproto endpoints relevant to v0 recap:
  - `agent.getAuthorFeed` — used today in `src/lib/api/feed/author.ts:31` and `src/view/com/posts/PostFeed.tsx`. Returns paginated `FeedViewPost` including own posts + reposts with engagement counters embedded in `post.likeCount`, `post.repostCount`, `post.replyCount`.
  - `agent.app.bsky.graph.getFollowers` — used in `src/state/queries/profile-followers.ts:31`. Returns paginated followers but **no joined-at timestamp** per follow edge — edge timestamps are not exposed by the public API.
- There is no push notification infra for on-demand content-pushes in this repo today. `expo-notifications` does not appear; the codebase uses FCM/APNs server-originated notifications via `agent.app.bsky.notification.*` (see `src/state/queries/notifications/util.ts`). There is no client-side `Notifications.scheduleNotificationAsync`.

**Implication**: v0 must be **client-local with device-side reconciliation**. Server-side primitives are a v1+ conversation that requires a lexicon PR upstream.

---

## 2. Data Model — Streak (A)

### Recommendation: client-local, account-scoped MMKV, with best-effort cross-device reconciliation

Store per-account in the existing `account` MMKV scope at `src/storage/index.ts:145` and extend the `Account` type in `src/storage/schema.ts:72`.

### Schema (add to `src/storage/schema.ts`)

```ts
export type StreakStore = {
  version: 1
  // ISO date string (YYYY-MM-DD) anchored to the zone captured at that visit
  lastVisitDay: string
  // IANA zone (e.g. "America/Los_Angeles") captured at lastVisit
  lastVisitZone: string
  // Consecutive days including lastVisitDay
  currentStreak: number
  // Longest streak the user has ever hit on this account (across devices, best-effort)
  longestStreak: number
  // Millisecond epoch of last write — used for cross-device merge tiebreak
  lastVisitAt: number
  // Dismissal/celebration gating
  lastCelebratedStreak?: number
}

export type Account = {
  // ...existing fields
  streak?: StreakStore
}
```

### Why client-local v0

1. No lexicon exists. Shipping blocked on an upstream atproto PR is not v0.
2. Streak data is low-consequence (cosmetic retention nudge). Client-local drift is acceptable.
3. The existing `quickReact` feature uses the exact same pattern (`src/features/quickReact/storage.ts:22-80`) — precedent for "client-local now, server-swap later" is already established.

### Cross-device reconciliation (v0, best-effort)

Since account-scoped MMKV is **device-local**, two devices for the same DID will diverge. v0 reconciliation story:

1. On session start (after `useSession` resolves), if `bskyAppState.nuxs` contains a namespaced entry `streak:v1:{lastVisitDay,lastVisitAt,currentStreak}` (serialized JSON ≤ ~300 bytes — within NUX data budget), merge with local using:
   - If remote `lastVisitAt > local.lastVisitAt`, adopt remote `lastVisitDay`, `currentStreak`.
   - If same day in either zone, keep `max(currentStreak)`.
2. On every streak write, schedule a debounced (30 s) `agent.bskyAppUpsertNux` with the compact blob, mirroring the pattern in `src/state/queries/nuxs/index.ts:102`.
3. This is documented as best-effort: if a user posts from iPhone at 23:59 PT and opens Web at 02:30 ET next day (still the same PT day), we will not double-count; we use the stored `lastVisitZone` to re-derive the boundary.

### Timezone handling

- Anchor: **device timezone at moment of check** via `Intl.DateTimeFormat().resolvedOptions().timeZone`.
- Rule: a visit counts for a new streak day iff the local calendar date (in `lastVisitZone`) has advanced by exactly 1. Advance > 1 day resets to 1. Advance 0 is a no-op.
- Edge case (travel): if the device zone changes between visits, re-derive "yesterday" in the **stored** `lastVisitZone`, not the new zone. This prevents a LAX→NRT traveler from losing a streak because the new local date looks 2 days ahead.
- DST: handled natively by IANA zone arithmetic (no UTC-offset math).

### Module placement

```
src/features/streaks/
  index.ts                    # public exports
  types.ts                    # StreakStore, StreakSnapshot
  storage.ts                  # read/write to account MMKV (mirrors features/quickReact/storage.ts)
  logic.ts                    # pure date math: computeNextStreak(prev, now, zone)
  context.tsx                 # StreakProvider — runs visit-tick on foreground
  hooks/
    useStreak.ts              # returns current snapshot, subscribes to MMKV
    useStreakTick.ts          # fires on AppState 'active' + session change
  queries/
    remoteSync.ts             # debounced bskyAppUpsertNux write + read merge
  components/
    StreakIndicator.tsx       # the visible pill/flame
    StreakIndicator.web.tsx   # optional hover tooltip variant
  __tests__/
    logic.test.ts
    storage.test.ts
```

Follow exactly the shape of `src/features/quickReact/` (storage, context, hooks, components, tests). That feature explicitly documents "v0 client-only; v1 may swap to a server-backed store" (`src/features/quickReact/storage.ts:9`) — same posture here.

### Tick trigger

- On foreground via `AppState.addEventListener('change', ...)` — exact pattern used in `src/features/quickReact/context.tsx:153` and `src/state/messages/events/index.tsx:70`.
- On successful session resolution (one-shot effect gated on `hasSession`).
- On `focus` window event on web (covered by `AppState` polyfill in RN Web, already used in `src/lib/react-query.tsx:90`).

---

## 3. Data Model — Weekly Recap (B)

### Recommendation: **client-computed on-demand**, memoized for the week via TanStack Query

No server-side precomputation is feasible without a new atproto endpoint.

### Computation (pseudo-code, implemented in `src/state/queries/weeklyRecap.ts`)

```
windowStart = startOfDay(now - 7d, zone)
windowEnd   = now

postsThisWeek = []
cursor = undefined
while (cursor !== null && pagesFetched < MAX_PAGES):
  page = await agent.getAuthorFeed({actor: did, limit: 50, cursor, filter: 'posts_no_replies'})
  for item in page.feed:
    if item.post.author.did !== did: continue            // filter out reposts of others
    if AppBskyFeedDefs.isReasonRepost(item.reason): continue
    indexedAt = Date.parse(item.post.indexedAt)
    if indexedAt < windowStart: break outer
    postsThisWeek.push(item.post)
  cursor = page.cursor

metrics = {
  postCount: postsThisWeek.length,
  topPost: maxBy(postsThisWeek, p =>
    (p.likeCount ?? 0) + 2*(p.repostCount ?? 0) + (p.replyCount ?? 0)),
  // followers delta is approximate — see caveat below
  followersDelta: null | number,
  totalLikes, totalReposts, totalReplies,
}
```

### Followers: honest approximation

`agent.app.bsky.graph.getFollowers` returns followers in follow-recency order but **does not expose `createdAt` per edge** publicly. There is no way to accurately compute "new followers this week" from current public APIs.

Two honest options for v0, pick **Option A**:

- **Option A (recommended)**: Snapshot `followersCount` from `agent.getProfile` each day (or on recap-open) into `Account.streak` extended as `Account.followersSnapshot: {count, capturedAt}[]` (ring buffer of last 14 days). Recap shows `count(today) − count(7 days ago snapshot)`. First-ever recap shows "—" with copy "Follow growth available next week". This is transparent to the user and doesn't over-promise accuracy.
- Option B (rejected): Fetch followers list and diff against a prior cached list. Breaks at scale (50k-follower accounts = ~1700 API calls), expensive, still doesn't give you edge timestamps — only set delta. Fails for users with rapid follow/unfollow churn.

### TanStack Query shape

```ts
// src/state/queries/weeklyRecap.ts
const recapQueryKeyRoot = 'weeklyRecap'
export const createWeeklyRecapQueryKey = (args: {did: string, weekIso: string}) =>
  createQueryKey(recapQueryKeyRoot, args, {persistedVersion: 1})

export function useWeeklyRecapQuery({did}: {did: string}) {
  const agent = useAgent()
  const weekIso = getIsoWeek(new Date())                  // "2026-W15"
  return useQuery({
    queryKey: createWeeklyRecapQueryKey({did, weekIso}),
    queryFn: async () => computeRecap(agent, did),
    staleTime: STALE.HOURS.ONE,                           // one hour is enough
    gcTime: 1000 * 60 * 60 * 24 * 14,                     // keep 2 weeks
    enabled: !!did,
  })
}
```

Follows the query conventions documented in `CLAUDE.md` and implemented in `src/state/queries/profile-followers.ts`. `persistedVersion: 1` allows the payload to survive an app cold-start without refetch.

### Module placement

```
src/features/weeklyRecap/
  index.tsx                   # barrel
  types.ts
  logic.ts                    # pure aggregation fns (unit-testable)
  hooks/
    useWeeklyRecap.ts         # wraps useQuery
    useRecapTrigger.ts        # decides whether to show dialog
  components/
    RecapDialog/index.tsx     # Dialog.Outer + pages (Dialog pattern, CLAUDE.md)
    RecapDialog/pages/Posts.tsx
    RecapDialog/pages/Followers.tsx
    RecapDialog/pages/TopPost.tsx
    RecapCardInline.tsx       # optional inline variant on Home
  __tests__/
    logic.test.ts
    useRecapTrigger.test.tsx
```

### Dialog usage

Use `src/components/Dialog` with the `control.close(cb)` pattern documented in `CLAUDE.md` (footgun section) and implemented in `src/components/Menu/index.tsx:151`. Any post-close navigation ("see top post") must use the callback form.

---

## 4. Recap Trigger — Recommendation

**On-demand foreground poll + once-per-week auto-present.**

No background scheduling exists today. No `expo-notifications` module is present; push is entirely server-originated through atproto's notification service (no self-originated local notifications). Background fetch on iOS requires TaskManager registration we don't have.

Feasible v0 trigger:

1. `useRecapTrigger` runs on foreground (AppState `active`) and on session start.
2. Gates: (a) feature flag on, (b) `hasSession`, (c) today is Monday in device zone **or** user has gone ≥7 days since `lastRecapShownAt`, (d) `lastRecapDismissedWeek !== currentWeekIso`.
3. Opens the `RecapDialog` once. Dismissal writes `{lastRecapShownAt, lastRecapDismissedWeek}` to `account` storage so it does not re-prompt.
4. Manual entry point: tapping the streak indicator opens a menu with "See your week" as one of the options (satisfies the "always accessible" UX principle).

Rejected alternatives:
- Push notification: requires new atproto notification reason + PDS-side scheduler. Not v0.
- Background cron: no `expo-task-manager` in the repo today. Adding it expands platform surface area materially.
- Server-sent on-login banner: requires a new preference-service endpoint. Not v0.

---

## 5. Streak Indicator — Where It Renders

- Surface: left of the avatar slot on the bottom bar on native (`src/view/shell/bottom-bar/BottomBar.tsx`), and in the left-nav header on web (`src/view/shell/desktop/LeftNav.tsx`).
- Single source component `src/features/streaks/components/StreakIndicator.tsx` imported in both shells.
- Tap behavior: opens a small menu (`src/components/Menu`) with: "Current streak: N days", "Longest: M days", "See your week" (opens Recap dialog), "About streaks" (link to docs), "Turn off streaks" (writes a preference).
- Accessibility: `accessibilityLabel={_(msg`Daily streak: ${n} days. Tap for details.`)}`.
- Hide conditions: logged out, `hasSession === false`, feature flag off, user has disabled.

---

## 6. Preferences & Feature Flag

### New preference (local only for v0)

Add `streaksEnabled?: boolean` to `src/state/persisted/schema.ts` (default `true`) with a matching hook in `src/state/preferences/streaks.tsx` modeled exactly on `src/state/preferences/autoplay.tsx`.

### Feature flag

Gate name: `streaks_v0`. Default state: **off for all users, on for internal / dev builds**.

There is no Statsig/LaunchDarkly present in the repo today. Use the same pattern as `src/storage/hooks/dev-mode.ts` / `demo-mode.ts` (a Device-scoped boolean flipped via a hidden Settings toggle), plus a build-time constant `IS_DEV || IS_TESTFLIGHT` default. If the team has an unlisted gate service, wire it here — the hook `useStreaksFeatureEnabled()` is the single choke point.

---

## 7. Offline Behavior

- Streak: MMKV is synchronous and offline-safe. Visit-tick runs purely from the device clock; no network needed. Remote NUX sync is fire-and-forget; failure is swallowed (offline = best-effort merge on next foreground).
- Recap: requires network. Offline state renders a skeleton + "Reconnect to see your week" empty state. TanStack Query's `networkMode: 'online'` (default) handles this; cached recap from the same `weekIso` is served stale-while-offline via `persistedVersion: 1`.

---

## 8. Out of Scope for v0

- Server-side streak primitive / atproto lexicon. Deferred to v1.
- Cross-device perfect reconciliation. Best-effort only via NUX blob.
- Precise "new followers this week" (requires edge timestamps from API). Using snapshot-delta approximation.
- Leaderboards, social sharing of streaks, freeze / streak-repair mechanic.
- Push notification for recap.
- Localized start-of-week (Sunday vs Monday). v0 uses Monday globally. Localization follow-up.
- Streaks for logged-out users.
- Shareable recap image generation (Twitter-style wrapped card).
- Historical backfill — streak starts at 1 on first ticked visit post-launch.

---

## 9. Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|------------|--------|------------|
| 1 | **Timezone / DST bugs cause silent streak losses.** User travels LAX→NRT and the next "day" check mis-fires; or DST fall-back creates a 25-hour day that looks like no-advance. | High | Medium (user trust hit) | Pure-function `logic.ts` with exhaustive unit tests covering DST forward, DST backward, travel across IDL, zone not resolvable (fallback to UTC). Store `lastVisitZone` and always derive "yesterday" in that zone. |
| 2 | **Followers delta is inaccurate** because atproto does not expose per-edge timestamps. Users notice discrepancy with profile count and file bugs. | High | Medium | Explicit copy: "Followers this week" uses snapshot delta with tooltip "Based on daily snapshots — may differ from total". First-week recap shows "—". Document clearly in feature README. |
| 3 | **`getAuthorFeed` pagination cost for prolific posters**: an account posting 200+ times/week may require 4-5 paged calls per recap compute. Multiplied by cold-open retries this can spike PDS load. | Medium | Medium | `MAX_PAGES = 6`, cap at `limit: 100`, short-circuit loop as soon as `indexedAt < windowStart`. Cache with `staleTime: STALE.HOURS.ONE` and `persistedVersion: 1`. Consider backend `getAuthorFeed` filter flag (`filter: 'posts_no_replies'`) to halve payload. |

Secondary watch-list (not top 3 but named):
- MMKV quota on web (IndexedDB-backed via `@bsky.app/react-native-mmkv` shim) — streak payload is < 500 B so not a concern.
- NUX blob size for remote sync — keep serialization < 300 B, test with schema validator.
- Feature flag leak — `streaks_v0` must be checked in a single `useStreaksFeatureEnabled` hook, not duplicated.

---

## 10. Test Strategy (tiered)

| AC | Tier | Target |
|----|------|--------|
| Streak increments by 1 on consecutive-day visit in same zone | Jest unit | `features/streaks/logic.test.ts::computeNextStreak happy` |
| Streak holds (no double-count) on same-day re-open | Jest unit | `logic.test.ts::sameDayNoOp` |
| Streak resets on ≥2-day gap | Jest unit | `logic.test.ts::gapResets` |
| DST forward (spring) does not break streak | Jest unit | `logic.test.ts::dstForward` |
| DST backward (fall) does not double-count | Jest unit | `logic.test.ts::dstBackward` |
| Travel LAX→NRT preserves streak | Jest unit | `logic.test.ts::travelZoneChange` |
| Offline streak tick persists to MMKV | Jest unit | `storage.test.ts::writePersists` |
| Streak indicator renders with correct count & a11y label | RTL component | `StreakIndicator.test.tsx` |
| Streak indicator hidden when flag off / logged out | RTL component | `StreakIndicator.test.tsx::gating` |
| Streak indicator hidden when user preference disabled | RTL component | `StreakIndicator.test.tsx::pref` |
| Recap query filters posts to window | Jest unit | `weeklyRecap/logic.test.ts::windowFilter` |
| Top post is computed by weighted engagement | Jest unit | `logic.test.ts::topPostRanking` |
| Recap handles zero posts this week | Jest unit | `logic.test.ts::emptyWeek` |
| Recap dialog renders pages, close-callback navigation works | RTL component | `RecapDialog.test.tsx` — mock `Dialog.useDialogControl` |
| Recap trigger opens once per week and not again after dismiss | RTL hook | `useRecapTrigger.test.tsx` |
| Feature flag off disables indicator, dialog, trigger | RTL integration | `streaks.integration.test.tsx` |
| Smoke: cold-start on iOS/Android/Web shows indicator when flag on | E2E (Maestro / smoke harness if present) | manual verification matrix in test plan |

---

## 11. Summary of Files Touched (for downstream planning)

Created:
- `src/features/streaks/**` (feature module, ~12 files)
- `src/features/weeklyRecap/**` (feature module, ~10 files)
- `src/state/preferences/streaks.tsx`
- `src/state/queries/weeklyRecap.ts`

Modified:
- `src/storage/schema.ts` — extend `Account` with `streak`, `followersSnapshot`, `lastRecapShownAt`
- `src/state/persisted/schema.ts` — add `streaksEnabled?: boolean`
- `src/state/preferences/index.tsx` — re-export the hook
- `src/view/shell/bottom-bar/BottomBar.tsx` — render `<StreakIndicator />`
- `src/view/shell/desktop/LeftNav.tsx` — render `<StreakIndicator />`
- `src/App.native.tsx`, `src/App.web.tsx` — mount `StreakProvider`, `RecapTrigger`

No changes to `src/Navigation.tsx` or `src/lib/routes/types.ts` — the recap is a dialog, not a route.

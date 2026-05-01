# ADR — Streaks + Lightweight Gamification (ticket i9KLo7kw)

## Context

Ship a humane, client-local daily-visit streak indicator and a once-per-ISO-week "Your week on Bluesky" recap. Both default-on but permanently opt-out-able; entirely device-local (tier 3 MMKV) with zero protocol debt. Surfaces live in the Home header/left rail (streak), the Notifications tab list header (recap card), a full-screen Recap route, a PastRecaps route, and a new `ActivityAndRecap` Settings sub-screen. A single GrowthBook flag `StreaksAndRecapEnable` gates every call-site. Streaks follow the `quickReact` precedent (`src/features/quickReact/**`) so the team already has a sanctioned template.

## Decision

1. **Single combined feature directory at `src/features/activityAndRecap/`.** The streak indicator and the weekly recap are strictly-coupled at the storage, settings, gating, and analytics layers (same flag, same Settings screen, same Account-scoped MMKV namespace); they are the same product surface mechanically. Co-locating them in one feature matches `src/features/quickReact/` and avoids a synthetic split. Subdirectories: `storage/`, `hooks/`, `components/` (with `StreakIndicator/index.{native,web}.tsx` per CLAUDE.md platform pattern), `queries/`, `reducer/`, `__tests__/`.
2. **Screens under `src/screens/`** per CLAUDE.md "new screens" rule: `src/screens/Recap/`, `src/screens/PastRecaps/`, `src/screens/Settings/ActivityAndRecap/` (matching the existing `src/screens/Settings/ContentAndMediaSettings.tsx:35` pattern).
3. **Persistence tier 3 (Account MMKV).** Extend `Account` in `src/storage/schema.ts:72` with three optional fields: `streak?: StreakStore`, `followerSnapshots?: FollowerSnapshot[]` (ring buffer, max 35), `activityAndRecap?: {showStreak?: boolean; showRecap?: boolean; dismissedRecapWeekIds?: string[]; recapCardFirstShown?: Record<string,number>}`. All reads/writes via `account` export from `src/storage/index.ts:145` — never `MMKV` directly. Per-account toggles (AC-X2) use `useStorage(account, [did, 'activityAndRecap'])` (`src/storage/index.ts:102`).
4. **Pure reducer `computeNextStreak`** with UTC monotonic guard (>20h), IANA tz day anchor, and silent grace bookkeeping. Lives in `src/features/activityAndRecap/reducer/computeNextStreak.ts` with exhaustive unit tests — zero RN dependencies.
5. **TanStack Query for recap** via `createQueryKey('weeklyRecap', {did, weekIso}, {persistedVersion: 1})` (`src/state/queries/util.ts:28`). `staleTime: STALE.HOURS.ONE`, `gcTime: GCTIME.INFINITY`, 6-page `getAuthorFeed` cap, 2/hr auto-retry budget, `enabled` gate implements AC-B11 (toggle off ⇒ zero XRPC).
6. **Placement.**
   - Streak indicator — mount inside the right-hand `Layout.Header.Slot` of `HomeHeaderLayoutMobile` (`src/view/com/home/HomeHeaderLayoutMobile.tsx:76`) and the right-hand control row of `HomeHeaderLayoutDesktopAndTablet` (`src/view/com/home/HomeHeaderLayout.web.tsx:54`). This is the closest existing anchor to "home header near drawer avatar / web left-rail under profile row" that exists in the actual shell today; a left-nav profile-row slot does not exist in this repo.
   - Recap card — wire into the `ListHeaderComponent` prop of `NotificationFeed` (`src/view/com/notifications/NotificationFeed.tsx:44,185`) when `filter === 'all'`. Requires a surgical edit to `src/view/screens/Notifications.tsx:268` to pass the card. Legacy `src/view/` touch is justified: the surgical `ListHeaderComponent` hookup avoids migrating the whole Notifications screen.
7. **Top-post embed** renders via the existing `Post` component at `src/view/com/post/Post.tsx:1` — it's the single-post renderer used outside thread contexts. Moderation fallback (AC-B10) is implemented in the Recap screen by iterating the ranked-candidate list until a non-tombstoned post renders.
8. **Qualifying-visit detector** builds on `useOnAppStateChange` (`src/lib/appState.ts:15`) + `useIsFocused` on the Home tab + a 30-second contiguous timer. Feed render signal reads from `feedFeedback.onItemSeen` via a new context callback hung off `PostFeed` (`src/view/com/posts/PostFeed.tsx:936`). If wiring onItemSeen into our detector requires a prop drill we don't want to pay for, we fall back to "first mount of PostFeed in Home tab" — still satisfies ≥1 feed render per A1.
9. **Account-removal cleanup** — extend `removeAccount` in `src/state/session/index.tsx:294` alongside the existing `clearAgeAssuranceDataForDid(account.did)` call, by adding a sibling `clearActivityAndRecapDataForDid({did})` export from the feature.
10. **Feature flag** registered as `StreaksAndRecapEnable = 'streaks_and_recap:enable'` in `src/analytics/features/types.ts:1` with an `// owner: @growth, remove by: 2026-10-01` comment. Consumed through a central `useStreaksAndRecapEnabled()` hook mirroring `src/features/quickReact/hooks/useQuickReactsEnabled.ts:12` — every consumer calls it at the top and early-returns `null` (zero-footprint on flag-off).

## Alternatives considered

- **Two separate features (`streaks/` and `weeklyRecap/`).** Rejected: they share the flag, the settings screen, the storage namespace, and the analytics events; splitting doubles the import graph with no isolation gain.
- **Tier 1 `persisted` for the settings toggles.** Rejected: `persisted` is global-per-install, violating AC-X2 "per-account local persistence". Account MMKV is the correct tier.
- **A new top-level `src/streaks/` directory.** Rejected by CLAUDE.md "No new top-level subdirectories" rule and by the existing `/features` pattern (`src/features/quickReact/`, `src/features/liveEvents/`).
- **Custom AppState listener instead of `useOnAppStateChange`.** Rejected to avoid leak risk; the existing hook already handles subscription cleanup (`src/lib/appState.ts:17`).
- **Server-side recap computation / lexicon record.** Hard-rejected by G9 and the ticket scope boundary.
- **Push/email/widget for recap.** Hard-rejected by B7 / G1; `expo-notifications` is not in the bundle.

## Consequences

**Positive.**
- One feature module → one PR → one revert lever.
- All flag-off code paths provably render `null` before any network or storage side effect.
- Tier 3 storage means account switch/removal behavior is almost free.
- Pure reducer shape makes the most-load-bearing logic (A2–A5) cheapest to unit-test.
- Lingui wrapping, dialog-close callback pattern, and React Compiler awareness are codified in CLAUDE.md and reused — no new infra.

**Negative / tradeoffs.**
- Touches the legacy `src/view/screens/Notifications.tsx` (§17 debt item 1 acknowledges this). Mitigated by limiting the edit to passing `ListHeaderComponent`.
- Follower delta is approximate (no atproto edge timestamps; R2). Labeled "new followers this week" and clamped ≥ 0. Product sign-off required pre-GA.
- Feed-render signal depends on `feedFeedback` internals; if the cleanest hook isn't exposable, we degrade to a mount-based ≥1-render proxy. Noted in step S4.
- Streak storage schema is additive on `Account`. If we ever migrate to a server record, we carry dead local fields until deprecated.
- LoC budget ~1100–1400 lines — above the 800-LoC "large" threshold. Flagged.

## Files touched (summary)

- **Extends.** `src/storage/schema.ts`, `src/analytics/features/types.ts`, `src/analytics/metrics/types.ts`, `src/lib/routes/types.ts`, `src/routes.ts`, `src/Navigation.tsx`, `src/state/session/index.tsx`, `src/view/screens/Notifications.tsx`, `src/view/com/home/HomeHeaderLayoutMobile.tsx`, `src/view/com/home/HomeHeaderLayout.web.tsx`, `src/screens/Settings/ContentAndMediaSettings.tsx`.
- **Creates.** Feature tree under `src/features/activityAndRecap/**` (storage, reducer, hooks, queries, components, analytics, tests); screens `src/screens/Recap/**`, `src/screens/PastRecaps/**`, `src/screens/Settings/ActivityAndRecap/**`.

Exhaustive per-file list lives in `plan.json.files_allowlist` — that list is binding for the scope-guard hook.

# Feature Spec — Streaks + Lightweight Gamification (ticket i9KLo7kw)

## Problem statement

Daily-habit surfaces are a proven retention lever (Snapchat, Duolingo), but most implementations lean on loss-aversion, push spam, and social pressure that run counter to Bluesky's ethos. We want the retention signal without the dark patterns: a low-visual-weight daily-visit indicator and a once-a-week "your week on Bluesky" recap, both client-local, default-on, one screen from a permanent opt-out, and with zero protocol debt (no new lexicon, no PDS record). Success is measured in D7 retention lift and recap CTR while keeping opt-out rates under 10% — if users flinch, we've already failed the humane-first constraint.

## Surfaces

This feature ships three surfaces:

1. **Streak indicator + explainer dialog** (AC group A)
   - Small flame-and-integer indicator.
   - Native: home header near drawer avatar. Web: left-rail under profile row.
   - Home tab only. Hidden when `streak < 2`, logged-out, or opted-out.
   - Tap opens a Dialog (`src/components/Dialog`) showing current + longest + rules + grace-day footnote + link to Settings. No share CTA.

2. **Weekly recap card + full-screen recap route** (AC group B)
   - Dismissible card pinned atop the Notifications tab on Monday >= 06:00 device-local, for the prior ISO week (Mon–Sun).
   - Card tap navigates to a new `Recap` route (full-screen), rendering three metrics and the top post via existing post components.
   - 7-day auto-expiry; past 4 weeks available under Settings.

3. **Settings -> Activity & recap sub-screen** (AC group X)
   - Two toggles, both ON by default: "Show daily streak", "Show weekly recap".
   - Past recaps list (4-week rolling window).
   - <1s effect, no restart required.

## Scope

### In scope (v0)
- Client-local streak state per-DID (lastVisitDay, lastVisitZone, currentStreak, longestStreak, lastVisitAt).
- Weekly recap computation: posts authored count, net-new-followers (clamped >=0), top post by `likes + reposts + replies`.
- Recap card on Notifications tab; full-screen recap route; past-recaps list in Settings.
- Settings sub-screen with two local toggles.
- Feature-flag gate via GrowthBook (`Features` enum).
- Lingui wrapping for all user-visible strings.

### Out of scope (v0)
- Streak freezes, purchases, restoration.
- Sharing, leaderboards, friend streaks.
- Badges, trophies, levels, XP.
- Push, email, OS widget, app-icon badges.
- Server-side record, new lexicon, PDS persistence, cross-device sync.
- Metrics beyond the 3 specified.
- Streak indicator on tabs other than Home.
- Editorial content in recap.

## Guardrails (behavioral — not testable ACs)

These constrain **how** the feature is built, not **what** it does:

- **G1 No loss-aversion.** No "streak about to break" copy, no countdown timers, no push reminders.
- **G2 Silent grace.** One missed day is forgiven without any UI acknowledgment — no "you saved it!" celebration.
- **G3 Low visual weight.** Flame glyph + integer. No animation, haptic, or sound on increment.
- **G4 Hidden below day 2.** Indicator does not render at streak = 0 or 1.
- **G5 No social pressure.** No leaderboards, no friend-streak features, no share affordance.
- **G6 No passive-engagement metrics.** Don't log time-spent or scroll counts to satisfy this feature.
- **G7 No re-engagement for churned users.** Zero-visit week produces no recap card, no push, no email.
- **G8 Default-on with prominent opt-out.** One screen deep + a Settings link inside the streak explainer sheet.
- **G9 Client-local only.** No new lexicon, no PDS record. Feature is fully reversible with no protocol debris.
- **G10 Opt-out is permanent.** If a user toggles off, we do not re-prompt to re-enable.

## Acceptance criteria (with test-plan sketch)

### Streak (A1–A10)
- **A1** — Qualifying visit = 30s foregrounded on Home + >=1 feed render; same-day dups don't double-increment. *Test:* integration test mocking AppState + feed-render event; assert single increment per day.
- **A2** — Consecutive-day increment by exactly 1; persists across restarts. *Test:* seed storage with day-1 state, advance to day+1, assert 2; kill/reload app, assert 2.
- **A3** — Silent grace day: one missed day forgiven; grace visible only in explainer sheet. *Test:* unit test reducer with missed=1; assert streak unchanged, assert `grace_used` flag true; UI test asserts no celebration toast.
- **A4** — Reset to 1 after >=2 consecutive missed days. *Test:* unit test missed=2 -> streak=1 on next qualifying visit.
- **A5** — tz change never decreases; max 1 increment per 20 wall-clock hrs (UTC monotonic guard). *Test:* unit tests simulating tz hops (UTC+14 -> UTC-12) and a 15hr interval with local midnight crossing — both blocked.
- **A6** — Placement correct per platform; `accessibilityLabel="{n}-day Bluesky streak"`; `testID="streakIndicator"`; Home tab only. *Test:* Maestro flow asserts element on Home, absent on other tabs.
- **A7** — Hidden when logged-out, opted-out, or streak < 2. *Test:* integration tests for each state.
- **A8** — Tap opens Dialog with current + longest + rules + grace + Settings link. No share CTA. *Test:* Maestro flow; assert absence of share button by testID.
- **A9** — No network request carries streak data. *Test:* integration test intercepts XRPC calls, asserts no `streak`/`lastVisit` fields in any body.
- **A10** — Per-DID; account switch swaps; account removal clears. *Test:* integration with two mock DIDs; switch, assert displayed value matches switched account; remove account, assert storage cleared.

### Recap (B1–B12)
- **B1** — Monday >=06:00 local if >=1 qualifying visit in prior ISO week. *Test:* unit test trigger logic with mocked `Date` + `Intl.DateTimeFormat().resolvedOptions().timeZone`.
- **B2** — Three metrics: posts authored, net new followers, top post by likes+reposts+replies. *Test:* integration with fixture feed + profile; assert computed values.
- **B3** — Card tap -> full-screen Recap route embedding top post via existing post components. *Test:* Maestro navigation + component snapshot.
- **B4** — Zero-posts empty copy exact match; negative follower delta clamped to 0. *Test:* unit + snapshot.
- **B5** — Dismissible; 4-week rolling "Past recaps" in Settings. *Test:* e2e dismiss + settings list.
- **B6** — Auto-expires after 7 days. *Test:* unit with mocked clock.
- **B7** — No push / email / widget. *Test:* manual review + grep guard (`expo-notifications` not imported by feature code).
- **B8** — `getAuthorFeed` + `getProfile` for own DID; manual Retry button; auto-retry capped at 2/hr. *Test:* integration with mocked agent; assert retry budget.
- **B9** — RTL, long strings, screen reader, reduced-motion, large text all render. *Test:* manual a11y inspector pass + snapshot in RTL locale.
- **B10** — Moderation fallback: deleted/hidden top post -> next-highest; none -> empty copy. *Test:* integration with fixture containing a tombstoned post.
- **B11** — "Show weekly recap" OFF prevents computation entirely. *Test:* integration; assert query is `enabled: false` when toggle off; assert zero XRPC calls.
- **B12** — Client-only compute; analytics carry booleans only. *Test:* unit asserts analytics payload shape matches `Events` union and contains no metric *values*, only booleans like `has_posts`, `has_top_post`.

### Cross-surface (X1–X6)
- **X1** — Settings sub-screen, both toggles ON by default, <1s effect, no restart. *Test:* Maestro flow.
- **X2** — Per-account local persistence; no atproto prefs sync. *Test:* integration — toggle on account A, switch to B, assert B defaults; grep guard for `agent.app.bsky.actor.putPreferences` in feature code (must be absent).
- **X3** — No NUX / modal / interstitial on first install. *Test:* fresh-install Maestro flow.
- **X4** — No numerical badges on app icon / tab bar / drawer. *Test:* manual review + grep guard for `setApplicationIconBadgeNumber`.
- **X5** — All user-visible strings Lingui-wrapped. *Test:* `yarn intl:extract` diff must include all new strings; ESLint rule / grep for raw strings in feature files.
- **X6** — Feature-flaggable via existing gating to disable remotely. *Test:* integration toggles the flag off, asserts indicator + card absent and no computation occurs.

## Non-functional requirements

- **i18n (§11).** All user-visible strings go through `_(msg\`...\`)` or `<Trans>`. No hardcoded English. Include plural forms for the "{n}-day streak" label.
- **Accessibility (§12).** `accessibilityLabel` + `accessibilityHint` on indicator, card, and toggles. `testID` on indicator, card, recap screen. Verify under: RTL locales, reduced-motion, dynamic type / large text, and screen readers (VoiceOver + TalkBack). Respect `useReducedMotion` for any transitions on the recap screen.
- **Feature flag (§10, §13).** Add `StreaksAndRecapEnable` (or similar) to the `Features` enum in `src/analytics/features/types.ts`. **Include an owner + expected removal date in a comment per §10 rule, e.g. `// owner: @growth, remove by: 2026-10-01 (post-KPI readout)`.** Gate both streak indicator rendering and recap computation. When flag flips off remotely, running computations should short-circuit on next foreground.
- **Analytics (§9).** New events in `src/analytics/metrics/types.ts`:
  - `streak:indicatorShown` (no value)
  - `streak:explainerOpened` (no value)
  - `streak:optOut` / `streak:optIn`
  - `recap:cardShown` `{has_posts: boolean, has_top_post: boolean, has_follower_delta: boolean}`
  - `recap:cardTapped`
  - `recap:cardDismissed`
  - `recap:optOut` / `recap:optIn`
  - **No metric values** in payloads (B12). Only booleans and enum-ish states.
- **Observability (§7).** Use `logger` only — no `console.*`. `logger.error('recap compute failed', {safeMessage: err})` in the recap query's error path. Never log DID, handle, or post content in error metadata.
- **Networking (§4).** Recap uses TanStack Query `useInfiniteQuery` or a capped `useQuery` around `agent.app.bsky.feed.getAuthorFeed` (cap 6 pages, short-circuit on `indexedAt < windowStart`) + `agent.app.bsky.actor.getProfile`. No raw `fetch`. Query key via `createQueryKey('weeklyRecap', {did, weekIso}, {persistedVersion: 1})`. `staleTime: STALE.HOURS.ONE`.
- **Persistence (§5).** Streak state is **tier 3 Account state** — MMKV scoped by DID via `src/storage`. Follower-count ring buffer (daily snapshots) also tier 3. Toggles stored via `src/state/preferences/<name>.tsx` backed by tier-1 `persisted` or tier-3 `account` MMKV (account-scoped). **Never** `import {MMKV}` directly; go through `src/storage` (§5 rule).
- **UI layering (§6).** Use `#/alf` atoms + `#/components/Dialog`, `#/components/Button`, `#/components/Typography`. Put the new Recap screen in `src/screens/Recap/` with co-located components. Put the Settings sub-screen in `src/screens/Settings/ActivityAndRecap/` (or equivalent, to match existing Settings structure). Do **not** add to `src/view/` (§1 rule).
- **Navigation (§2).** Add `ActivityAndRecap` and `Recap` to `CommonNavigatorParams` in `src/lib/routes/types.ts`; register path in `src/routes.ts`; wire into `src/Navigation.tsx`.
- **Platform-specific code (§13).** Streak-indicator placement differs native vs web — use the `Component/index.{native,web}.tsx` folder pattern, not sibling files.

## Open questions

Non-blocking; architect can proceed with the documented defaults but flag any reversal back to product:

- **Q_B2_posts** — "Posts authored": single combined count vs split (posts / replies / reposts)? **Default:** single combined count. Data schema should not preclude a later split.
- **Q_B2_followers** — atproto has no per-edge follow timestamps; we compute "net change" from a daily follower-count snapshot ring buffer. Accept this as v0 (labeled "new followers this week" with >=0 clamp per B4)?
- **Q_B1_trigger** — Monday 06:00 local missed (offline/backgrounded): does card appear later in the same week, or only at the exact trigger? **Default:** first foreground at or after Monday 06:00 local within the 7-day window.
- **Q_A1_dwell** — 30s foregrounded: contiguous or cumulative across same-day sessions? **Default:** contiguous while Home is the active surface.
- **Q_naming** — Ticket Q9 raises whether to rename "streak" to something less dark-pattern-coded ("daily visits"). UX/product decision; does not block architecture.

## Dependencies

- Session (`useAgent`, `useSession`) — §3.
- TanStack Query — §4.
- `src/storage` account-tier MMKV — §5.
- ALF + existing primitives — §6.
- Lingui — §11.
- GrowthBook feature flag — §10.
- Homegrown analytics client — §9.
- React Navigation route registration — §2.

## Risks

- **R1 Timezone / DST** silently corrupting streaks. Mitigation: UTC monotonic guard (A5) + device IANA tz anchor.
- **R2 Follower delta inaccuracy** — no atproto edge timestamps; snapshot ring buffer is lossy if the user skips weeks. Mitigation: clamp to >=0, label "net change", accept imprecision.
- **R3 `getAuthorFeed` pagination cost** for prolific posters. Mitigation: 6-page cap, short-circuit on `indexedAt < windowStart`, `staleTime: 1h`, manual retry + 2/hr auto-retry budget (B8).
- **R4 Feature flag stranding** — §10 debt note: flags have no owner/expiry metadata. Must add the owner + removal-date comment when registering the flag (§13 debt item 7).

# Requirements — Streaks + Lightweight Gamification (ticket i9KLo7kw)

Architect: technical contract for the PLANNING phase. Not source code. Not an execution plan.
Scope grounded in: `ticket.json`, `ac_check.json`, `spec.md`, `ux.md`, `ARCHITECTURE.md`, `CLAUDE.md`.

---

## 1. Scope & non-goals

**Scope.** Ship a humane, client-local daily-visit streak indicator plus a once-per-ISO-week "Your week on Bluesky" recap, behind a GrowthBook feature flag, with a one-screen Settings page that defaults both toggles ON. Surfaces live in the Home chrome (streak) and Notifications tab (recap card) + full-screen Recap route + Settings sub-screen. State is entirely device-local, DID-scoped MMKV (ARCHITECTURE.md §5 tier 3) and TanStack Query cache (tier 4). No atproto lexicon, no PDS record, no cross-device sync (G9, AC-A9, AC-X2).

**Explicit non-goals (v0).** No streak freezes / purchases / restoration; no sharing; no leaderboards or friend streaks; no badges / trophies / XP; no push / email / OS widget / app-icon badges (AC-X4, AC-B7); no server-side record / new lexicon / PDS persistence (G9); no streak indicator outside the Home tab (AC-A6); no cross-device sync; no editorial content in recap; no "about-to-break" warnings (G1); no celebration on grace-day use (G2); no re-prompt after opt-out (G10).

---

## 2. Data model

Three persisted surfaces + one in-memory session signal.

### 2.1 StreakStore (tier 3 Account MMKV, scoped by DID)

Extension to `Account` in `src/storage/schema.ts:72` (follow the existing `quickReactions?: ReactionsStore` pattern — `src/storage/schema.ts:88`). All fields optional so missing = "never visited":

```ts
// added to Account
streak?: StreakStore
```

```ts
// new type co-located with feature
export type StreakStore = {
  version: 1                      // schema version for forward-compat
  currentStreak: number           // 0 after fresh install / post-reset
  longestStreak: number           // high-water mark, never decreases
  lastVisitDay: string            // 'YYYY-MM-DD' in lastVisitZone
  lastVisitZone: string           // IANA tz, e.g. 'America/New_York' (A5)
  lastVisitAtUtcMs: number        // UTC epoch ms — the monotonic guard anchor (A5)
  graceUsedForCurrentStreak: boolean // set true when we forgive 1 missed day (A3, G2)
}
```

**Why this shape.**
- `lastVisitDay` + `lastVisitZone` together give us a stable "yesterday in the user's tz" computation that survives travel/DST (A5, R1).
- `lastVisitAtUtcMs` enforces the >20h UTC monotonic guard (A5) independently of local-time manipulation.
- `graceUsedForCurrentStreak` is the **only** grace-day surface (G2 — visible in explainer dialog, nowhere else).
- `version: 1` lets us evolve the shape without wiping streaks; bump on breaking change.

**Persistence tier.** Tier 3 account-scoped MMKV via `src/storage/index.ts:145` (`account`). Never touch `MMKV` directly (ARCHITECTURE.md §5 Rule; §17 debt item 4). Reads/writes via `account.get([did, 'streak'])` / `account.set([did, 'streak'], ...)`.

**Account switch / removal (AC-A10).** MMKV is already DID-scoped — switching accounts swaps the backing key automatically. Account removal must call `account.remove([did, 'streak'])` in the same code path that clears other account-scoped storage. **Open:** verify whether there is an existing "on account remove" cleanup site; if not, call out in PLANNING.

### 2.2 Follower snapshot ring buffer (tier 3 Account MMKV)

Supports B2 "net new followers". atproto has no per-edge follow timestamps (R2), so we approximate via daily snapshots:

```ts
// added to Account
followerSnapshots?: FollowerSnapshot[]   // ring buffer, max 35 entries (~5 weeks)
```

```ts
export type FollowerSnapshot = {
  day: string      // 'YYYY-MM-DD' local
  count: number    // followersCount from getProfile at capture time
}
```

Capture runs at most once per local day on qualifying visit, as a side-effect of the streak reducer. Ring-bounded to 35 entries. Net delta for a given ISO week = `snapshotAt(weekEnd) - snapshotAt(weekStart)`, clamped >=0 (AC-B4).

### 2.3 Dismissed weekIds (tier 3 Account MMKV)

Per-weekId dismissal for the recap card (AC-B5, ux.md §8 open question 7):

```ts
dismissedRecapWeekIds?: string[]  // ISO week IDs, max 8 (trimmed)
```

Small bounded array avoids unbounded growth. Week IDs are "YYYY-Www" (e.g. `2026-W15`).

### 2.4 Recap query

TanStack Query (ARCHITECTURE.md §4), new file `src/features/streaksRecap/queries/weeklyRecap.ts` (or co-located under the feature — decide in PLANNING).

- Query key: `createQueryKey('weeklyRecap', {did, weekIso}, {persistedVersion: 1})` — see `src/state/queries/util.ts:28`.
- `staleTime: STALE.HOURS.ONE`.
- `gcTime: GCTIME.INFINITY` (required when `persistedVersion` is set — see `src/state/queries/util.ts:47`).
- `enabled`: `hasSession && featureFlagOn && recapToggleOn && weekIso != null` (AC-B11 gates computation entirely).

Payload shape:

```ts
export type WeeklyRecap = {
  weekIso: string                 // 'YYYY-Www'
  windowStart: string             // ISO datetime, Monday 00:00 local
  windowEnd: string               // ISO datetime, Sunday 23:59:59 local
  postsCount: number              // combined count — see ambiguity Q_B2_posts default
  followerDelta: number           // clamped >=0 per AC-B4
  topPost: {uri: string; cid: string} | null  // null = moderation fallback exhausted
  fetchedAtUtcMs: number
}
```

Only `uri` + `cid` persist in the cache for `topPost`. The Recap screen re-fetches full post via existing post components (AC-B3) so we inherit moderation filtering at render time.

### 2.5 Settings preferences (tier 1 persisted)

Two toggles; mirror the `autoplay` pattern at `src/state/preferences/autoplay.tsx` (Provider + `useX`/`useSetX` hooks, backed by `persisted.write` / `persisted.onUpdate`).

```ts
// added to src/state/persisted schema
showStreakIndicator: boolean      // default true  (AC-X1)
showWeeklyRecap: boolean          // default true  (AC-X1)
```

**Per-account scope.** AC-X2 says "per-account local persistence". `persisted` is the global/tier-1 layer, not per-account. Two options:
- **Option A (preferred):** store in tier 3 Account MMKV (`account`) keyed by DID, with a preference module that reads/writes via `useStorage` (`src/storage/index.ts:102`). Matches AC-X2 exactly.
- **Option B:** use tier 1 `persisted` and accept that the toggle applies per-install, not per-account. Rejected — violates AC-X2.

PLANNING decision: Option A. Module lives at `src/state/preferences/streaks-recap.tsx` but the reader/writer delegates to `account.get/set` scoped to `currentAccount.did`. Re-render on DID switch is handled by the session `useDid()` change cascading into the provider.

### 2.6 In-memory dwell timer (no persistence)

A11 session-level counter (resets each foreground). Not stored; lives in a feature-scoped context provider (see §3).

---

## 3. Day-boundary & anti-manipulation rules (A1–A5)

### 3.1 Qualifying visit — measurable definition (A1)

A "qualifying visit" is **all three** true in a single foreground session while the active tab is Home:

1. `AppState.currentState === 'active'` for a contiguous ≥30 seconds (default per ambiguity Q_A1_dwell: contiguous, not cumulative).
2. At least one feed-item render event fires during that window.
3. `hasSession === true`.

**Hooks to build on (verified):**
- `useAppState()` / `useOnAppStateChange()` at `src/lib/appState.ts:15` — canonical AppState hook. Use this; do not add `AppState.addEventListener` directly.
- Feed render signal: `src/view/com/posts/PostFeed.tsx` is the Home feed renderer. It already dispatches render/scroll signals for feed-feedback. **Uncertain**: the exact event name to subscribe to. PLANNING must verify whether `PostFeed` exposes a callback prop like `onItemSeen` / whether `state/feed-feedback.tsx` emits an event we can tap. If neither is surfaced cleanly, fall back to: "first render of `PostFeed` on Home tab" (mount event) — coarser but satisfies the ≥1 render requirement.
- Tab state: `useNavigationTabState` at `src/lib/hooks/useNavigationTabState.ts`.

**30s contiguity.** A plain `setTimeout(30_000)` started on AppState = active + Home active, cancelled on AppState change / tab change. Single active timer per session; restart on re-foreground (not cumulative — default per Q_A1_dwell).

### 3.2 Day anchor (A5, R1)

- Day string = `Intl.DateTimeFormat('en-CA', {timeZone: currentZone}).format(new Date())` → `YYYY-MM-DD`.
- `currentZone = Intl.DateTimeFormat().resolvedOptions().timeZone` (IANA).
- Never use UTC for the day anchor. Never use profile-declared tz.
- DST: a 25-hour day still presents one `YYYY-MM-DD` under `en-CA`; a 23-hour spring-forward day likewise. Correct by construction.

### 3.3 Reducer (pure, testable — A2/A3/A4/A5)

`computeNextStreak(prev: StreakStore | undefined, now: {utcMs, zone, localDay}): StreakStore` — pure function, no side effects. The reducer is where all the logic gets exhaustively unit-tested (AC-A5).

Pseudo-rules (prose, not code):

1. **UTC monotonic guard.** If `prev.lastVisitAtUtcMs` exists and `now.utcMs - prev.lastVisitAtUtcMs < 20 * 3600 * 1000`, return `prev` unchanged. (Blocks "tz hop to increment" abuse; A5.)
2. **Same-day dedupe (A1).** If `prev.lastVisitDay === now.localDay`, return `prev` unchanged (but still update `lastVisitAtUtcMs` so the guard ratchets).
3. **Consecutive day (A2).** If `prev.lastVisitDay` is the calendar day immediately before `now.localDay` in `prev.lastVisitZone`, `currentStreak += 1`, clear `graceUsedForCurrentStreak`.
4. **One day skipped → silent grace (A3, G2).** If exactly one calendar day was skipped AND `graceUsedForCurrentStreak === false`, keep `currentStreak` unchanged, set `graceUsedForCurrentStreak = true`.
5. **Two+ days skipped OR grace already used (A4).** `currentStreak = 1`, `graceUsedForCurrentStreak = false`.
6. **First visit ever (`prev == null`).** `currentStreak = 1`, `graceUsedForCurrentStreak = false`.
7. **Tz regression (A5).** Computing "days since last visit" uses `prev.lastVisitZone` for the prior-day arithmetic, then converts to `now.zone` for the new record. Never let a westward tz shift (e.g. EWR→LAX) cause a decrement.
8. `longestStreak = max(longestStreak, currentStreak)`. Always update `lastVisitDay`, `lastVisitZone`, `lastVisitAtUtcMs`.

### 3.4 Trigger

A `useStreakTracker()` hook mounted high in the tree (inside the signed-in shell, gated on `featureFlagOn && hasSession`) runs the reducer once per qualifying visit. Must also run on cold start if the last-visit delta already qualifies (e.g. user was offline but backgrounded for 2 days — we only increment once on next qualifying foreground visit).

---

## 4. Recap computation contract (B1–B12)

### 4.1 Trigger (B1)

Driven by `useAppState()` (`src/lib/appState.ts:22`):

- On foreground transition, compute `now` in local tz.
- If `now.localTime >= Monday 06:00 local` AND `priorWeekHadQualifyingVisit` AND `dismissed` does not include `priorWeekIso` AND card is not auto-expired AND `showWeeklyRecap === true` → trigger query prefetch.
- Q_B1_trigger default (ambiguity): first foreground at-or-after Monday 06:00 local within the 7-day expiry window makes the card available. If the device is offline / closed through Monday, card appears on Tuesday, etc., up to Sunday 23:59.

"priorWeekHadQualifyingVisit" = the StreakStore has `lastVisitAtUtcMs` within `[priorMonday00:00, priorSunday23:59]` local, or (weaker) `currentStreak >= 1 && lastVisitDay` falls in that window. Decide in PLANNING; the stronger version requires a "weekly visit counter" we don't otherwise need.

### 4.2 ISO week (B1)

Week ID `YYYY-Www` via date-fns `getISOWeek` / `getISOWeekYear` (already sanctioned, ARCHITECTURE.md §14). Week starts Monday 00:00 local, ends Sunday 23:59:59.999 local. The 06:00 delay is purely a surface-visibility gate — not a window shift.

### 4.3 Data source + pagination bound (B8, R3)

Two XRPC calls via `useAgent()`:

- `agent.app.bsky.feed.getAuthorFeed({actor: did, filter: 'posts_with_replies', limit: 50, cursor})` — paginate up to **6 pages** (300 posts max per R3). Short-circuit as soon as the oldest item's `indexedAt < windowStart`. Do not continue once the window is exhausted.
- `agent.app.bsky.actor.getProfile({actor: did})` — to capture `followersCount` for the snapshot ring buffer (§2.2). Single call.

**Retry budget (B8).** Manual "Try again" button = unlimited user-initiated (bypasses budget). Automatic retries capped at 2 per wall-clock hour per weekIso, tracked in an in-memory `{weekIso, retries, windowStart}` object + MMKV-persisted backoff marker. TanStack Query `retry` option alone is insufficient (resets on remount); we wrap the queryFn with our own budget gate that throws "retry budget exhausted" → TanStack caches the error.

### 4.4 Metric computation (B2, B4, B10)

- **Posts authored.** Default (Q_B2_posts): **single combined count** of `getAuthorFeed` items where `indexedAt ∈ window` AND `authorDid === ownDid` AND `post` is one of: original post, reply (by self), repost (by self). Wrapped in a helper so we can split later (posts/replies/reposts) without schema break.
- **Net new followers (Q_B2_followers).** `max(0, snapshotAt(weekEnd).count - snapshotAt(weekStart).count)` (B4 clamp). If either snapshot missing (new install, short account age), degrade: use oldest-available snapshot as floor; if still none, surface `0` and omit from preview line. **Labeled "new followers this week"** (user-visible), described as "net change" in code comments — imprecision is explicitly accepted in v0 (R2). Open for product sign-off.
- **Top post.** Among in-window authored posts, rank by `likeCount + repostCount + replyCount`. Tiebreaker (Q3 default): **newer** wins. Moderation fallback (B10): when resolving the top post in the Recap screen via existing post components, if the fetch returns a tombstone / mod-hidden result, fall back client-side to the next candidate in the ranked list. If all candidates are hidden → `topPost = null` → empty copy per B4.
- **Zero-posts empty copy (B4).** Exact string: `No posts this week — that's fine.` Do **not** reword.

### 4.5 Suppression (G7, B1)

Zero-qualifying-visits week → no recap card rendered AND no query fires. The trigger predicate gates computation; this is not a query-level empty response.

### 4.6 Auto-expiry (B6)

Card hides when `now > firstShownAt + 7 days` for that weekId. `firstShownAt` persisted in tier 3 MMKV alongside dismissals:

```ts
recapCardFirstShown?: Record<string, number>  // weekIso → UTC ms
```

Dismissal (B5) and auto-expiry produce identical surface behavior (card hidden for that weekId); they persist separately so we can measure dismissal rate without conflating with expiry.

### 4.7 "Past recaps" (B5)

4-week rolling window. The PastRecaps screen lists up to 4 entries derived from: the current weekIso going back 4 ISO weeks. Each entry links to `Recap({weekId})`. No separate storage — each entry re-runs the query via its own key (cache hit if still warm, re-fetches if stale).

---

## 5. Surfaces

Five UI surfaces, mapped to ux.md §2–§3.

| # | Surface | Data needs | Gating | AC |
|---|---------|------------|--------|-----|
| 1 | Native Home header `StreakIndicator` | `currentStreak`, feature flag, session, toggle, active tab | flag + session + toggle + streak≥2 + Home active | A6, A7, G3, G4 |
| 2 | Web left-rail `StreakIndicator` | same as #1 | same | A6, A7 |
| 3 | `StreakExplainerDialog` (shared) | `currentStreak`, `longestStreak`, `graceUsedForCurrentStreak` | opens from #1/#2 only | A8, G2 |
| 4 | Notifications tab `WeeklyRecapCard` | `WeeklyRecap` payload, dismissed set, firstShown map | flag + session + recap toggle + trigger predicate | B1, B4, B5, B6, B11 |
| 5 | Full-screen `RecapScreen` route + `PastRecapsScreen` + Settings `ActivityAndRecapSettings` | `WeeklyRecap` payload + top-post via existing post components | flag + session; Settings row also hidden when flag off (ux.md §7) | B3, B10, X1 |

Top-post embed component (ux.md §8 open question 1): **confirm in PLANNING** which existing post component (`FeedItem` vs `PostThreadItem` vs `src/components/FeedItem` if it exists) renders a single post without requiring thread context. Grep-verify before committing.

---

## 6. Feature gating (X6) — four gates, one flag

New flag in `src/analytics/features/types.ts:1` (reuse enum at file:1): **`StreaksAndRecapEnable = 'streaks_and_recap:enable'`**. Add owner + remove-by comment per ARCHITECTURE.md §10 Rule and §17 debt item 7:

```ts
// owner: @growth, remove by: 2026-10-01 (post-KPI readout)
StreaksAndRecapEnable = 'streaks_and_recap:enable',
```

Access via `ax.features.enabled(ax.features.StreaksAndRecapEnable)` — pattern matches `src/features/liveNow/index.tsx:62` and `src/features/quickReact/hooks/useQuickReactsEnabled.ts:16`.

Centralize the gate in a hook: `useStreaksAndRecapEnabled()` in `src/features/streaksRecap/hooks/useStreaksAndRecapEnabled.ts`. Calling code must invoke this at the very top of entry components and early-return `null` so flag-off is provably zero-footprint (pattern per `useQuickReactsEnabled`).

**Four gates, one flag (ux.md §8 open question 8):**

| Gate | Surface | Behavior when flag OFF |
|------|---------|------------------------|
| G_indicator | StreakIndicator (native + web) | returns `null` |
| G_card | WeeklyRecapCard | returns `null` AND query never fires |
| G_route | `Recap` + `PastRecaps` screens | routes registered (deep-link parity) but screen renders redirect-to-Home / not-found |
| G_settings | ActivityAndRecap row in ContentAndMediaSettings | row hidden (avoids user confusion per ux.md) |

Short-circuit precedence: flag → session → toggle → state. All four gates must also short-circuit computation paths (AC-B11 requires toggle-off to prevent computation entirely; the flag-off case is stricter).

---

## 7. i18n & a11y contract (X5, B9, A6)

### 7.1 i18n

- Every user-visible string via `msg\`…\`` + `_()` OR `<Trans>` (ARCHITECTURE.md §11 Rule; CLAUDE.md §i18n).
- Pluralization via `plural()` — accessibilityLabel `{n}-day Bluesky streak` must pluralize. See copy deck in ux.md §4 (e.g. `_(plural(count, {one: '1-day Bluesky streak', other: '#-day Bluesky streak'}))`).
- Do not run `yarn intl:extract` locally — CI handles it (CLAUDE.md §Essential Commands).
- **Forbidden strings (guardrail-enforced absences):** no "keep it going", "don't lose your streak", "visit tomorrow" (G1); no "you saved it!" / grace-celebration copy (G2); no share CTA (G5, AC-A8); no "post more next week" nudge (G6, B4).

### 7.2 a11y (per-surface)

- **StreakIndicator.** `accessibilityRole="button"`, pluralized label, hint `Opens your streak details.`, `testID="streakIndicator"`, `hitSlop={HITSLOP_10}`. No `AccessibilityInfo.announceForAccessibility` on increment (G3 applies to SR too).
- **ExplainerDialog.** `Dialog.ScrollableInner` label surfaces to SR; group the big number block with a single `accessibilityLabel` so it reads "4 days" not "4, days". `testID="streakExplainerDialog"`. Settings link uses `control.close(() => navigation.navigate('ActivityAndRecap'))` — **non-negotiable dialog-close callback** (CLAUDE.md footgun; ARCHITECTURE.md §6 Rule).
- **WeeklyRecapCard.** Combined label e.g. `Weekly recap: {posts} posts, {followers} new followers. Opens full recap.`. Separate focusable dismiss button. `testID="weeklyRecapCard"`. `useReducedMotion()` gates the opacity fade → `opacity-only` branch.
- **RecapScreen.** Per-metric pluralized a11y labels; reuses Layout.Screen SR focus pattern; `testID="recapScreen"` + per-card.
- **ActivityAndRecap settings.** Toggle primitives own a11y; `testID="activityRecapShowStreakToggle"` + `…ShowRecapToggle` + `…PastRecapsLink`.

### 7.3 Non-functional coverage (B9)

Verified under: RTL (Arabic/Hebrew), long strings, screen readers (VoiceOver + TalkBack), reduced-motion (`useReducedMotion`), dynamic type / large text, light + dark themes, offline (indicator continues; card hidden / cached as appropriate).

---

## 8. Risks + open questions

### 8.1 Inherited technical risks

- **R1 Timezone / DST.** Mitigated via (a) IANA tz anchor for day string, (b) UTC monotonic guard (>20h) in the reducer, (c) never decrement on westward tz shift.
- **R2 Follower-delta inaccuracy.** Accepted. Snapshot ring buffer + `max(0, …)` clamp + label "net change" in internal docs. User-facing label `new followers this week` per ux.md §4 — product sign-off required.
- **R3 getAuthorFeed pagination cost.** Mitigated via 6-page cap, early short-circuit on `indexedAt < windowStart`, `staleTime: 1h`, 2/hr retry budget.

### 8.2 Ambiguities from ac_check.json — proposed defaults for PLANNING

| ID | Ambiguity | Proposed default | Blocks PLANNING? |
|----|-----------|------------------|------------------|
| AC-B2 (posts) | single combined count vs split | **Single combined count** (posts + replies + reposts), helper-wrapped for later split | No |
| AC-B2 (followers) | follower-delta method | **Daily snapshot ring buffer**, `max(0, end-start)`, labeled `new followers this week` | No — but flag product for sign-off |
| AC-B1 | offline through Mon 06:00 local | **First foreground at-or-after Mon 06:00 local within 7-day window** | No |
| AC-A1 | 30s contiguous vs cumulative | **Contiguous** while Home is active | No |

### 8.3 New open questions (PLANNING must resolve)

1. **Feed render signal.** Does `PostFeed` / `state/feed-feedback.tsx` expose an `onItemSeen` or equivalent we can subscribe to? If not, coarsen A1 to "mount of PostFeed on Home active tab" — still satisfies the ≥1-render requirement, but weaker. See `src/view/com/posts/PostFeed.tsx`, `src/state/feed-feedback.tsx`.
2. **Top-post embed component.** Pick one of `FeedItem` / `PostThreadItem` / equivalent; confirm it works in a standalone context (no thread ancestor).
3. **Notifications slot.** Does the Notifications screen expose a header slot? If not, add one (surgical change to `src/view/screens/Notifications.tsx` — note this touches legacy `src/view/`, an exception with justification per ARCHITECTURE.md §1).
4. **Account-removal cleanup site.** Where does existing per-account MMKV get cleared on account removal? Streak + snapshots + dismissals must be cleared there too (AC-A10).
5. **Past-recaps 4-week window intersects with 5-week snapshot buffer.** Size-reconcile: keep snapshot buffer ≥ 35 days to cover any past-recap recomputation.

### 8.4 Non-blocking product questions (unchanged from ticket)

Q3 (tiebreaker: newer), Q4 (combined count), Q6 (opt-out default), Q7 (4-week retention), Q8 (analytics pipeline), Q9 (rename "streak"). Documented defaults above; leadership can reverse pre-GA.

---

## 9. Test strategy

Expanding ac_check's 8 unit / 11 integration / 6 e2e / 3 manual breakdown. Listed as representative test names per tier; PLANNING produces the final test_strategy mapping.

### 9.1 Unit (8) — pure logic, no RN

- `computeNextStreak: first visit → currentStreak=1, longest=1` (A2)
- `computeNextStreak: consecutive day → +1` (A2)
- `computeNextStreak: 1 day missed → grace used, streak unchanged` (A3)
- `computeNextStreak: 2 days missed → reset to 1` (A4)
- `computeNextStreak: tz hop EWR→LAX on same local day → no increment` (A5)
- `computeNextStreak: <20h UTC delta blocked regardless of local date` (A5)
- `isRecapAvailable: Mon 05:59 local returns false, 06:01 returns true given prior-week visit` (B1)
- `rankTopPost: equal engagement tiebreaker = newer` (B2, Q3 default)
- Bonus: `followerDelta: clamps negative to 0` (B4), `clampRingBuffer: caps at 35 entries`

### 9.2 Integration (11) — component + hook, mocked agent

- `useStreakTracker: qualifying visit increments exactly once per day` (A1, A2)
- `useStreakTracker: dwell <30s does not increment` (A1)
- `StreakIndicator: hidden when logged out` (A7)
- `StreakIndicator: hidden when opted out (toggle off)` (A7, X1)
- `StreakIndicator: hidden when streak < 2` (A7, G4)
- `StreakIndicator: hidden outside Home tab` (A6)
- `Account switch: streak swaps per-DID` (A10)
- `Account removal: streak cleared` (A10)
- `Network spy: no XRPC body contains 'streak' or 'lastVisit' field` (A9)
- `Recap query: enabled=false when showWeeklyRecap off → zero XRPC calls` (B11)
- `Recap query: getAuthorFeed paginates ≤6 pages, short-circuits on indexedAt<windowStart` (B8, R3)
- `Recap query: auto-retry budget exhausts at 2/hr, manual retry bypasses` (B8)
- `Recap: moderation fallback promotes next-highest post on tombstone` (B10)
- `Settings toggles: persist per-account, no atproto putPreferences call` (X2)
- `Feature flag off: indicator + card both absent, recap query does not fire` (X6)
- `Analytics: recap:cardShown carries only booleans, no metric values` (B12)

### 9.3 E2E (6) — Maestro flows

- `streak-indicator-shows-on-home` (A6)
- `streak-explainer-dialog-open-then-settings-link` (A8) — covers dialog-close callback footgun
- `weekly-recap-card-tap-opens-recap-screen` (B3)
- `recap-card-dismiss-persists-within-week` (B5)
- `activity-and-recap-settings-toggle-round-trip` (X1)
- `fresh-install-no-nux-no-interstitial` (X3)

### 9.4 Manual (3)

- **B7:** grep guard confirms `expo-notifications` not imported by feature code; manual cross-platform observation confirms no push, email, or widget.
- **B9:** a11y inspector pass — VoiceOver + TalkBack + reduced motion + XXL dynamic type + RTL locale snapshot.
- **X4:** confirm no `setApplicationIconBadgeNumber` / tab-bar-badge / drawer-badge API is called by this feature.

---

## 10. Out-of-scope but adjacent

Noted; defer unless PLANNING finds them blocking:

- **ARCHITECTURE.md §17 debt item 4** — `src/analytics/features/index.ts:10` instantiates `MMKV` directly. Our feature correctly uses the `account` wrapper; the existing debt stays.
- **§17 debt item 1** — Notifications screen lives in `src/view/screens/Notifications.tsx` (legacy). Adding a header slot for the recap card is a surgical touch of legacy code. Justify in the PR description; do not migrate the whole screen.
- **§17 debt item 3** — general `console.*` leakage; not touched unless introduced by our own code (`logger` only).
- **§17 debt item 10** — sibling `.web.tsx` vs directory pattern. Our new components follow the directory pattern (CLAUDE.md §Platform-Specific Code), so no new debt.
- **AccountSettings `onAccountRemove` plumbing** — if a centralized cleanup hook does not exist, we add a callsite rather than inventing a new event bus. PLANNING documents which file.

---

## Citations (existing patterns we reuse)

- Storage schema / Account type — `src/storage/schema.ts:72`, `src/storage/schema.ts:88` (existing `quickReactions` pattern)
- Storage instance — `src/storage/index.ts:140`, `src/storage/index.ts:145`
- `useStorage` hook — `src/storage/index.ts:102`
- Feature-flag access pattern — `src/features/quickReact/hooks/useQuickReactsEnabled.ts:12`, `src/features/liveNow/index.tsx:62`
- Preference module pattern — `src/state/preferences/autoplay.tsx:1`
- Query key factory — `src/state/queries/util.ts:28`, persistedVersion option `src/state/queries/util.ts:47`
- AppState hooks — `src/lib/appState.ts:15`, `src/lib/appState.ts:22`
- Features enum — `src/analytics/features/types.ts:1`
- Routes type registry — `src/lib/routes/types.ts:56` (ContentAndMediaSettings, next to which we add `ActivityAndRecap`, `PastRecaps`, `Recap`)
- Notifications screen (legacy, target of header slot) — `src/view/screens/Notifications.tsx`

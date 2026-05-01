# Streaks + Lightweight Gamification — v0 Acceptance Criteria

**Ticket:** Trello `i9KLo7kw` — "Streaks + lightweight gamification"
**Source desc:** "Surface a small streak indicator for daily visits and a weekly 'your week on Bluesky' recap (posts, new followers, top-engagement post). Proven retention lever from Snapchat/Duolingo."
**Surfaces bundled:** (A) Daily-visit streak indicator, (B) Weekly "your week on Bluesky" recap.

---

## 0. Product decisions for v0 (read first)

These are the normative answers the AC reference. Flagged for reporter confirmation in "Open Questions" if marked `?`.

| Decision | v0 answer |
|---|---|
| What counts as a "visit" | A **qualifying session**: app foregrounded while signed in, for **>= 30 seconds continuous**, with at least **one feed item rendered** (Home, Following, Discover, or a custom feed). Background pushes, login-only opens, and crashes under 30s do **not** count. |
| Visit day boundary | A rolling **local calendar day** in the device's current IANA timezone at the moment the qualifying session occurs. Day = midnight-to-midnight local. |
| Streak break rule | Streak resets to 0 if **two consecutive local days** pass with no qualifying visit. I.e. missing one day is forgiven as a silent grace day; missing two breaks the streak. No "streak freeze" purchase mechanic in v0. |
| Timezone changes | If the device timezone changes, the new TZ applies from that moment forward. Retroactive days are not recomputed. A user cannot gain a streak day by manually changing TZ backward — server (or client with signed timestamp) enforces monotonic day counter. |
| Offline days | Offline visits count locally; streak state is reconciled on next online sync. If only the client has the record, client state is the source of truth. |
| Streak indicator placement | **Native (iOS/Android):** small flame icon + day count next to the avatar in the left drawer trigger area of the home header (see `src/view/shell`). **Web:** same icon in the left-rail sidebar under the profile entry. Tapping opens a simple explainer sheet. No badge on the tab bar in v0. |
| Recap delivery | **In-app card** pinned to top of the Notifications tab on the anchor day, plus a **dedicated full-screen "Your week on Bluesky" route** (`/recap/weekly/:weekId`) reachable from the card. **No push notification and no email in v0.** |
| Recap cadence | Weekly, generated for the prior ISO week (Mon–Sun). Card appears **Monday any time after 06:00 device-local** and persists for 7 days or until dismissed. |
| Opt-in posture | **On by default for both streak and recap**, with a single settings toggle per surface under Settings → Content & Media → "Activity & recap." Opt-out disables the indicator and suppresses the recap card. |
| Privacy / storage | v0 is **client-local only**. Streak counter and recap inputs are computed on-device from data the client already has (session start events, `getAuthorFeed` for own posts, follower delta via `getProfile` snapshot, engagement counts already on each post). Nothing new is written to the PDS. No shareable artifact in v0. |

---

## 1. Acceptance Criteria — Surface A: Daily-visit streak indicator

**AC-A1.** Given a signed-in user on iOS, Android, or Web, when the app has been foregrounded for a continuous `>= 30s` and at least one feed item has rendered, then the client records a qualifying visit for the current local calendar day. A second qualifying session on the same local day does not increment the counter.

**AC-A2.** Given the user had a qualifying visit yesterday (local day N-1) and has a qualifying visit today (N), then the visible streak count increments by exactly 1 and persists across app restarts on the same device.

**AC-A3.** Given the user last had a qualifying visit on local day N-2 (i.e. exactly one day skipped), when they have a qualifying visit on day N, then the streak count **remains the same as on day N-2** (grace day applied) and no increment occurs. A subtle UI affordance ("grace day used") is shown in the streak explainer sheet only, not in the header.

**AC-A4.** Given the user's last qualifying visit was on local day N-3 or earlier, when they next have a qualifying visit, then the streak count resets to 1.

**AC-A5.** Given the user changes the device timezone, then the streak counter never decreases as a result of the change and never increments by more than one per 20 elapsed wall-clock hours (anti-manipulation invariant). This is verified by a client-side monotonic guard using UTC timestamp of last-count-increment.

**AC-A6.** On iOS and Android, the streak indicator renders in the home header near the drawer-trigger avatar with a flame glyph and an integer day count, visible only on the Home tab. On Web, it renders in the left-rail navigation under the profile row. On all platforms the element has `accessibilityLabel` = `"{n}-day Bluesky streak"` (localized via Lingui) and a `testID` of `streakIndicator`.

**AC-A7.** The streak indicator is hidden entirely when the user is logged out, when the user has opted out in Settings, and when the current streak count is `< 2` (avoids nagging new users on day 1).

**AC-A8.** Tapping/clicking the streak indicator opens a Dialog (bottom sheet on native, modal on web via `#/components/Dialog`) showing: current streak length, longest streak on this device, plain-language explanation of how visits count, a grace-day indicator if one has been used in the current streak, and a link to the Settings toggle. The dialog does **not** contain any "share your streak" CTA in v0.

**AC-A9.** Streak data is stored in the device's persisted storage only (extension of `src/state/persisted/schema.ts`). No atproto record is written, no lexicon is introduced, and no network request containing streak data is sent to bsky.social or the user's PDS.

**AC-A10.** If the user has multiple accounts in the app, each account has an independent streak counter keyed by `did`. Switching accounts swaps the displayed streak. Logging out of an account retains its streak locally (so re-login restores it) but clears it on full account removal.

---

## 2. Acceptance Criteria — Surface B: Weekly "Your week on Bluesky" recap

**AC-B1.** On any Monday after 06:00 device-local time, given the user has been signed in for `>= 1` qualifying visit during the prior ISO week (Mon 00:00 to Sun 23:59 local), the client generates a recap object for that week and displays a recap card pinned at the top of the Notifications tab.

**AC-B2.** The recap card shows exactly three metrics for the prior week: (1) posts authored by the user (top-level posts + replies + reposts, counted separately if space allows, otherwise a single "posts" number), (2) net new followers (followers count at week-end minus followers count at week-start), (3) a single "top post" — the user's own post from that week with the highest `likeCount + repostCount + replyCount`.

**AC-B3.** Tapping the card navigates to a full-screen route `Recap` (registered in `src/Navigation.tsx`) that reuses `Layout.Screen` and renders the same three metrics plus the embedded top post via existing post components. The screen has a back affordance consistent with other stack screens on each platform.

**AC-B4.** If the user had zero posts in the prior week, the "top post" slot is replaced with a neutral, non-shaming message ("No posts this week — that's fine.") and does **not** suggest posting more. If the user had zero net-new followers, the number is shown as `0` without decoration; negative deltas are clamped to display `0` but the true delta is stored for analytics.

**AC-B5.** The recap card is dismissible via a close button. Once dismissed, it does not reappear for the same `weekId`. A dismissed recap is still accessible via a "Past recaps" entry inside Settings → Activity & recap for the last 4 weeks.

**AC-B6.** The recap card disappears automatically 7 days after it first appeared, even if not dismissed, to prevent stale content.

**AC-B7.** The recap is **not** delivered via push notification, email, or OS widget in v0. No code path enqueues a push or writes to notification settings.

**AC-B8.** Recap input data is fetched on-demand using existing atproto APIs (`app.bsky.feed.getAuthorFeed`, `app.bsky.actor.getProfile`) scoped to the signed-in user's own DID. No new lexicon is introduced. If any API call fails, the card shows a compact error state with a manual "Retry" action and does not auto-retry more than twice per hour.

**AC-B9.** The recap card and screen render correctly with: RTL locales, long Lingui translations, screen reader enabled (each metric is a separate accessible element with a descriptive label), reduced motion (no celebratory animation autoplays), and large text (metrics scale, no clipping).

**AC-B10.** The recap respects moderation state: if the computed "top post" has been deleted, hidden by the user, or taken down since the week ended, the slot falls back to the next-highest-engagement post. If no eligible post remains, the zero-posts copy from AC-B4 applies.

**AC-B11.** A single setting "Show weekly recap" under Settings → Activity & recap controls whether the card appears. When off, the client still **does not** compute recap inputs (to avoid unnecessary API calls and to honor user intent).

**AC-B12.** Recap values are computed on-device; no derived recap payload is sent to Bluesky servers or written to the user's PDS. Analytics events (if any) include only boolean engagement flags (`recapViewed`, `recapDismissed`, `recapTopPostTapped`) — no metric values.

---

## 3. Acceptance Criteria — Cross-surface / settings / platform

**AC-X1.** A new Settings sub-screen "Activity & recap" exists under Settings → Content & Media, with two toggles: "Show daily visit streak" (default on) and "Show weekly recap" (default on). Toggles take effect within one second of change without requiring app restart.

**AC-X2.** Both toggles persist locally per-account and survive app reinstall only if the user has device-level backup enabled. They are **not** synced via atproto preferences in v0 (no lexicon change).

**AC-X3.** On first install after this feature ships, neither surface shows any onboarding modal, NUX, or interstitial. Discovery is passive.

**AC-X4.** No part of this feature introduces numerical badges on the app icon, the bottom tab bar, or the drawer item, to preserve the existing notification-badge semantics.

**AC-X5.** All user-facing strings are wrapped with `msg()` / `<Trans>` and added to locale files. No string is hardcoded in English.

**AC-X6.** The feature is feature-flaggable via an existing gating mechanism so it can be disabled remotely without a release.

---

## 4. Out of scope for v0

- Streak freezes, purchasable saves, streak restoration.
- Sharing a streak or recap to a profile, DM, or external network.
- Leaderboards, friend streaks, mutual streaks (Snapchat-style).
- Badges, trophies, levels, XP, or any cumulative achievement system.
- Push notifications or email for the recap.
- Server-side streak record, new lexicon, or PDS persistence.
- Recap metrics beyond the three specified (no impressions, no engagement rate, no profile views).
- Streak indicator on tabs other than Home.
- Syncing streak across devices.
- Editorial content inside the recap ("most-liked post of the week globally", etc.).

---

## 5. KPIs (success metrics)

**User-facing / retention:**
1. **D1 and D7 retention lift for cohorts exposed to the streak indicator vs. holdout**, measured over the first 60 days post-launch. Target: statistically significant lift of `>=1.5%` at D7 without a measurable increase in uninstall rate.
2. **Recap card CTR** (card → full recap screen) among users who see it. Target: `>= 20%` Monday-of-week CTR.
3. **Opt-out rate for each surface** within 14 days of first exposure. Guardrail metric — if either exceeds `10%`, the default-on posture is reconsidered.

**Technical:**
4. Recap generation p95 latency on-device `<= 800ms` over Wi-Fi and `<= 2s` on slow-3G.
5. Streak indicator render does not increase Home-tab cold-start TTI by more than `15ms` on a mid-tier Android device.
6. Zero increase in API error rate from `getAuthorFeed` (recap uses existing pagination).

---

## 6. Guardrails (Bluesky brand / ethos tensions)

Bluesky's public positioning emphasizes user agency and avoiding dark patterns. Snapchat/Duolingo streaks are cited in the ticket but are also the canonical examples of engagement-coercive design. Guardrails:

**G1.** **No loss aversion UI.** The indicator never warns the user their streak is "about to break," never shows a countdown timer, and never sends a "don't lose your streak" push. v0 ships with no push at all (AC-B7).

**G2.** **Silent grace day.** A missed day is forgiven without the user being told in the header — they see the explainer only if they open the sheet (AC-A3). This prevents the Duolingo-style "you saved your streak!" dopamine loop.

**G3.** **Low visual weight.** Flame icon + small integer, not an animated, colored, or celebratory badge. No haptic on streak increment. No sound.

**G4.** **Hidden below 2 days.** The streak indicator does not appear until day 2 (AC-A7) so new users are not primed into a commitment on day 1.

**G5.** **No social pressure.** No leaderboards, no friend streaks, no share-to-profile mechanic. Streak is personal, local, and invisible to others.

**G6.** **No engagement-inflating metrics in recap.** The three recap metrics are deliberately simple and measurable by the user (posts, followers, top post). We avoid "time spent," "scrolls," or anything that rewards passive consumption.

**G7.** **No-op for disengaged users.** If the user has no qualifying visits in a week, no recap is generated and no re-engagement card appears (AC-B1). We do not try to win back churned users with gamification.

**G8.** **Default-on with easy, prominent opt-out.** Settings toggle is one screen deep and labeled plainly. An in-sheet "turn this off" link exists in the streak explainer (AC-A8).

**G9.** **Client-local only.** No new lexicon, no PDS record, no server-side state (AC-A9, AC-B12). This keeps the feature reversible and outside the federated protocol surface; if we later decide it's inconsistent with Bluesky's ethos, we remove it without leaving protocol debris.

**G10.** **No dark-pattern resurfacing.** If the user turns a surface off, we do not re-prompt to re-enable via NUX, tooltip, or dialog — ever.

---

## 7. atproto implications

- **No lexicon exists** for streaks, visits, or weekly recaps in `app.bsky.*` or `com.atproto.*`. v0 deliberately avoids introducing one.
- Streak state is a **client concern** stored in `src/state/persisted/schema.ts` (new sub-object, e.g. `activity: { streaks: { [did]: {...} }, recap: {...} }`). Schema version bump required.
- Recap metrics are **computed client-side** using existing authenticated XRPC calls the client already makes. No new server endpoints.
- **Federation consideration:** if the user's PDS is self-hosted (`isSelfHosted` on the account schema), the recap must still work as long as `getAuthorFeed` and `getProfile` respond. Verified via AC-B8 error handling.
- **DID changes / handle changes** do not affect the streak since it's keyed by `did`, not `handle`.
- If a future v1 moves streaks server-side, the chosen key should remain `did`-scoped and the lexicon should be authored under `app.bsky.actor.*` or a new `app.bsky.gamification.*` namespace — but this is explicitly out of scope here.

---

## 8. Open questions for the reporter

1. **Visit definition threshold.** Is 30 seconds + one feed render the right bar, or should it be simpler (any foreground)? Simpler = easier to reason about, harder = more honest.
2. **Streak indicator placement on Web.** Left rail vs. top header — this choice is reversible but we want a call before design spec.
3. **Top-post tiebreaker.** If two own-posts tie on `likeCount + repostCount + replyCount`, do we prefer newer or older? v0 draft assumes newer.
4. **"Posts" count composition.** Combined number or three sub-numbers (posts / replies / reposts)? v0 draft leaves this to design.
5. **Holdout cohort for KPI measurement.** Is the growth team able to run a 10% holdout for 60 days, or do we ship 100% and compare pre/post?
6. **Opt-in vs. opt-out default.** Draft says opt-out (on by default). Product leadership should confirm given Bluesky's ethos; opt-in would be more conservative but substantially reduce KPI signal.
7. **Recap "Past recaps" retention.** 4 weeks rolling local storage — acceptable, or longer/shorter?
8. **Analytics vendor.** Do we have an approved event pipeline that can receive `recapViewed` / `recapDismissed` without violating the privacy posture in G9?
9. **Do we want a brand-appropriate alternative to "streak"?** The word itself is borrowed from the dark-pattern canon; a softer label (e.g. "daily visits") could be considered.

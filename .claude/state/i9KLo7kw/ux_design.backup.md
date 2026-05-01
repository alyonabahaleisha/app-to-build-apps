# UX Spec — Streaks + Lightweight Gamification

Ticket: Trello i9KLo7kw
Author: Designer subagent
Scope: two surfaces — (A) daily-visit streak indicator, (B) weekly "Your week on Bluesky" recap.
Grounded in: ALF atoms/tokens (`#/alf`), existing shell (`src/view/shell/...`), existing Dialog/Menu/Button components, Lingui i18n, existing `Flame_Stroke2_Corner1_Rounded` icon at `src/components/icons/Flame.tsx`.

Design thesis: Bluesky's brand voice is calm, federated, and user-respecting. Gamification must therefore be **optional, humane, and quiet**. We are not Duolingo; we should not shame, hassle, or exploit loss-aversion. Think "a nice little thing you can notice" rather than "a thing that follows you into your dreams."

---

## 1. User Journey

### 1.1 Streak indicator — baseline journey
1. User signs in and opens the app on day 1. A streak quietly begins (no fanfare, no toast).
2. On day 2, user opens app. Streak becomes `2`. Indicator now shows a numeric badge.
3. User taps indicator → opens a compact **Streak detail sheet** (Dialog) explaining what the streak represents, how to turn it off, and a 7-day week dot calendar.
4. If user misses a day, streak resets to `1` on the next visit. No punitive copy.
5. User can disable streaks entirely from the Streak detail sheet or Settings → "Appearance & activity".

### 1.2 Weekly recap — baseline journey
1. Sunday rolls over to Monday in the user's local timezone.
2. On the user's **next app open after Monday 00:00 local**, a lightweight **recap card** appears pinned at the top of the Home feed (dismissible, one-time for that week). A matching entry lands in Notifications. (No push notifications in v0 — see §11.)
3. Tapping the card opens the **Recap screen** (`/recap/2026-W15`) with week stats: posts, new followers, top-engagement post.
4. User can share (opt-in, generates a static image — see §8) or dismiss.
5. If the week had zero activity, an honest empty-state shows ("You didn't post this week — that's fine. Here's what happened around you.") with no shaming.

### 1.3 Branching
- **Opted-out user**: no indicator, no recap card, no entry in Notifications. Period.
- **New account <7 days old**: no recap yet. First recap is only shown once a user has had at least one *full* Mon–Sun week of membership.
- **Private-by-default markets / minors**: share artboard is hidden (see §8 privacy).

### 1.4 Platform differences
- **iOS / Android (native)**: streak indicator lives in the mobile Home header next to the Feeds icon. Streak detail uses `Dialog` (bottom sheet).
- **Web (desktop)**: streak indicator lives in the left nav rail next to the user's profile row. Streak detail uses `Dialog` (modal).
- **Web (mobile viewport)**: same as native mobile placement (Home header).

---

## 2. Screen Inventory

### New
- `screens/Recap/index.tsx` — the full weekly recap screen, route `Recap` with param `{weekId: string}` (ISO week, e.g. `2026-W15`).
- `screens/Recap/components/RecapCard.tsx` — the pinned feed card.
- `components/Streak/StreakIndicator.tsx` — the chrome indicator (native + web variants behind a directory).
- `components/Streak/StreakDetailDialog.tsx` — detail sheet using `Dialog`.
- `components/Streak/StreakShareCard.tsx` (v0.5, deferred) — social-share artboard renderer.

### Modified
- `src/view/com/home/HomeHeaderLayoutMobile.tsx` — add streak slot to the header.
- `src/view/shell/desktop/LeftNav.tsx` — add streak row above the "Settings" link.
- `src/view/screens/Notifications/...` — add a non-push "Your week on Bluesky is ready" entry row.
- `src/screens/Settings/AppearanceSettings` (or closest existing) — add toggle "Show streaks and weekly recap".

### Untouched but referenced
- `src/components/Dialog/` — reused as-is.
- `src/components/Menu/` — not used in v0.

---

## 3. State Matrix

### 3.1 Streak indicator states
| State | Visual | Copy (a11y label) | Notes |
| --- | --- | --- | --- |
| **hidden** | nothing | — | user opted out, or <24h old account |
| **first-day** | flame icon only, no number, dimmed (`t.atoms.text_contrast_medium`) | "New streak started today" | no number shown until day 2 |
| **active (N ≥ 2)** | flame icon + number in a pill | "{N}-day streak" | number uses `a.text_sm` `a.font_bold` |
| **at-risk** | flame icon + number, with a small clock accent (reuse `Clock` icon) — **no countdown timer, no red** | "{N}-day streak. Visit today to keep it going." | only shown in the *detail sheet*, not the chrome indicator. See §13. |
| **broken (just reset to 1)** | flame icon + `1` | "Streak reset. Today is day 1." | no toast, no popup. Quiet. |
| **loading** | skeleton pill (matching atoms `a.rounded_full`, width ~40) | "Loading streak" | from `LoadingPlaceholder` pattern |
| **offline** | last-known cached value, rendered slightly dimmed | "{N}-day streak (offline)" | append "(offline)" in detail only |
| **milestone (7/30/100)** | flame with a subtle `primary_500` tint + number | "{N}-day streak — milestone reached" | animation described §9 |

### 3.2 Recap card (feed) states
| State | Visual | Copy |
| --- | --- | --- |
| **loading** | skeleton card | — |
| **empty week** (no posts, no new followers) | quiet card, no numbers, honest line | "A quiet week. See what else happened → " |
| **populated** | numeric stats + thumbnail of top post | "Your week on Bluesky" |
| **error** | card hidden entirely; fallback to a tiny "Recap unavailable" row in Notifications | — |
| **offline** | card hidden; show cached recap if we have it | — |
| **partial** (we have posts count but top post couldn't be resolved) | show the stats that exist; omit missing block cleanly with no error text | — |

### 3.3 Recap screen states
Same six states. Empty-state for a user with zero activity **never** says "you missed…" or "you're falling behind". It says something like "A calm week. Here's what your follows were up to." (copy in §7).

---

## 4. Component Inventory

### Reused (do not reinvent)
- `Button`, `ButtonText`, `ButtonIcon` from `#/components/Button` (solid `primary`, `secondary`, `secondary_inverted`)
- `Dialog.Outer / Dialog.Handle / Dialog.ScrollableInner / Dialog.Header / Dialog.HeaderText / Dialog.Close` from `#/components/Dialog`
- `Text`, `H1`, `H2`, `P` from `#/components/Typography`
- `Layout.Screen`, `Layout.Header.Outer`, `Layout.Header.Slot` from `#/components/Layout`
- `Link` from `#/components/Link`
- `Toggle` from `#/components/forms/Toggle` (for settings opt-out)
- `LoadingPlaceholder` from `#/view/com/util/LoadingPlaceholder`
- `Flame_Stroke2_Corner1_Rounded` — already exists at `src/components/icons/Flame.tsx`
- `Clock`, `Calendar`, `Celebrate`, `Heart2`, `Bubble` icons — already exist in `src/components/icons/`
- `UserAvatar` from `#/view/com/util/UserAvatar`

### New
- **`StreakIndicator`** — pill-shaped pressable. Props: `count`, `state`, `onPress`. Renders flame icon + number. Tapping opens `StreakDetailDialog`.
- **`StreakDetailDialog`** — `Dialog` with: current streak number, 7-dot week calendar (filled/empty circles, `a.rounded_full`), explanatory copy, "Turn off streaks" link, share button (deferred to v0.5).
- **`RecapCard`** — feed card. Shows week label, 3 stat chips (posts / new followers / top post), "Open" CTA.
- **`RecapStatTile`** — internal recap block: label + big number + small sparkline (optional v0.5; v0 is just the number).
- **`RecapTopPost`** — thumbnail of top-engagement post, max 2 lines of text, reactions count row.
- **`RecapScreen`** — the full surface.
- Optional v0.5: `StreakShareCard`, `RecapShareCard` — 1080×1920 image composition for system share sheet.

**Rule check**: we considered adding a new `Badge` component for the streak number — rejected, we use a plain `Text` inside a pill built from existing atoms (`a.rounded_full`, `a.px_sm`, `a.py_2xs`). No new primitives.

---

## 5. Interaction Patterns

| Action | Behavior |
| --- | --- |
| Tap streak indicator | Opens `StreakDetailDialog` |
| Long-press streak indicator (native) | Haptic `Light` + same as tap (parity with existing profile btn pattern in `BottomBar.tsx:135`) |
| Hover streak indicator (web) | Tooltip "{N}-day streak — tap for details" |
| Tap recap card | Navigates to Recap screen |
| Tap recap card "✕" | Dismisses for that week only (persisted per `weekId`) |
| Pull-to-refresh on Recap screen | Re-fetches the weekly rollup |
| Back from Recap screen | Returns to previous screen (native stack) / closes tab (web) |
| Tap "Share" on Recap (v0.5) | Opens system share sheet (native) / `navigator.share` or download (web) |
| Keyboard (web) | `Esc` closes StreakDetailDialog; `Tab` cycles through recap stats; `Enter` on recap card navigates |

---

## 6. Navigation Flow

### Entry points
- **Streak**: chrome indicator (Home header native, LeftNav desktop). No deep-link needed.
- **Recap**:
  1. Pinned feed card (primary path)
  2. Notifications feed row
  3. Deep link `bsky.app/recap/2026-W15` (web) / `bsky://recap/2026-W15` (native)

### Exits
- Streak dialog → close via `Dialog.Close` (web), swipe-down `Dialog.Handle` (native), backdrop tap.
- Recap screen → back button (native header), `Esc` or back arrow (web), or swipe-back gesture (iOS).

### Integration
- New route `Recap` in `src/routes.ts` under `CommonNavigatorParams`:
  `Recap: {weekId: string}`.
- Registered in `Navigation.tsx` as a stack screen (not a tab).

---

## 7. Copy Deck (all Lingui-wrapped)

All strings wrapped with `msg\`...\`` via `_(...)` or `<Trans>`.

### Streak indicator
- **Accessibility label (active)**: `_(plural(count, {one: '# day streak', other: '# day streak'}))` → Lingui handles the number substitution; short form intended for screen readers.
- **Accessibility hint**: `_(msg\`Double tap to see streak details.\`)`
- **Tooltip (web)**: `_(msg\`${count}-day streak\`)`

### Streak detail dialog
- **Title**: `<Trans>Your streak</Trans>`
- **Big number label**: `<Trans>days in a row</Trans>`
- **Explainer**: `<Trans>You've opened Bluesky every day for {count} days. We track this locally — you can turn it off any time.</Trans>`
- **This week header**: `<Trans>This week</Trans>` with 7 dots labelled Mon–Sun
- **Turn-off CTA**: `<Trans>Turn off streaks</Trans>`
- **First-day copy**: `<Trans>Day one. Nothing to prove — come back when you want.</Trans>`
- **Broken copy**: `<Trans>Back to day one. No big deal.</Trans>`
- **At-risk copy (only inside dialog)**: `<Trans>You haven't checked in today. Your streak is still going if you open Bluesky before midnight.</Trans>` — **notice: no countdown, no red, no "don't lose it".**

### Recap card
- **Header**: `<Trans>Your week on Bluesky</Trans>`
- **Subheader with date range**: `<Trans>{startDate} – {endDate}</Trans>`
- **CTA**: `<Trans>Open recap</Trans>`
- **Dismiss a11y**: `_(msg\`Dismiss weekly recap\`)`
- **Empty-week variant**: `<Trans>A quiet week. Here's what happened around you.</Trans>`

### Recap screen
- **Title**: `<Trans>Your week on Bluesky</Trans>`
- **Posts stat**: `_(plural(posts, {one: '# post', other: '# posts'}))`
- **New followers stat**: `_(plural(followers, {one: '# new follower', other: '# new followers'}))`
- **Top post section**: `<Trans>Your most-engaged post</Trans>`
- **Empty top post**: `<Trans>No posts this week — that's fine.</Trans>`
- **Zero activity empty**: `<Trans>You didn't post this week. Nothing to fix.</Trans>`
- **Turn off**: `<Trans>Turn off weekly recap</Trans>`

### Error
- `<Trans>Recap unavailable right now. Try again later.</Trans>`

**Length budget**: all strings must fit German +30% and Japanese/Chinese +0/-20%. Recap card on narrow iPhone SE viewport (320pt content width) must not wrap "Your week on Bluesky" to 3 lines in German ("Deine Woche auf Bluesky" ≈ 22 chars — fits).

---

## 8. Iconography

| Use | Icon | Source | Notes |
| --- | --- | --- | --- |
| Streak | `Flame_Stroke2_Corner1_Rounded` | `src/components/icons/Flame.tsx` | already exists |
| At-risk adornment (detail only) | `Clock` | `src/components/icons/Clock.tsx` | subtle, `text_contrast_medium` |
| Week calendar dots | N/A (drawn with atoms) | — | filled circle = visited |
| Milestone | `Celebrate` | `src/components/icons/Celebrate.tsx` | only on Recap screen milestone line |
| Recap posts stat | `Bubble` | `src/components/icons/Bubble.tsx` | |
| Recap followers stat | `Growth` or `Group` | `src/components/icons/Growth.tsx` | |
| Recap top-post stat | `Heart2` | `src/components/icons/Heart2.tsx` | |
| Share (v0.5) | `ArrowShareRight` | `src/components/icons/ArrowShareRight.tsx` | |
| Dismiss card | `CircleX` | `src/components/icons/CircleX.tsx` | |

**RTL**: none of the above need mirroring (flame/clock/bubble/heart are bidi-neutral). The `ArrowShareRight` icon does need RTL mirroring — use the `style={{transform: [{scaleX: isRTL ? -1 : 1}]}}` pattern already used elsewhere.

---

## 9. Animation & Motion

All animation is **opt-out via reduced motion**. Use `useReducedMotion()` hook (check `src/lib/hooks/` or the existing pattern) and gate animations behind it.

### Streak indicator
- **Idle**: static.
- **Daily increment (first render of the day)**: single 600ms flame color fade from `text_contrast_medium` → `primary_500` → `text` *once* per day. If reduced motion: just render the final color.
- **Milestone (7/30/100 only)**: a one-shot `Celebrate` icon micro-bounce (200ms `spring`, `targetScale: 1.06`) + optional haptic `Success` on native. Reduced motion: no bounce, no haptic. No confetti. No sound. No fullscreen moment.

### Streak detail dialog
- Uses the built-in `Dialog` enter/exit (bottom sheet rise native; modal fade web). No additional motion.

### Recap card
- Enter animation: 250ms fade + 4pt translateY. Reduced motion: no translate.

### Recap screen
- Stat tiles stagger-in at 40ms intervals (max 3 × 40ms = 120ms). Reduced motion: no stagger, all at once.

Use `native()` / `web()` utilities for platform-specific implementation:
- native: Reanimated `withSpring`
- web: CSS `transition: transform 250ms ease-out`

---

## 10. Theming

All colors via tokens — **zero hardcoded hex**.

| Element | Light | Dark | Token |
| --- | --- | --- | --- |
| Flame (idle) | `t.atoms.text_contrast_medium` | same | |
| Flame (active, ≥ day 2) | `t.palette.primary_500` | `t.palette.primary_500` | primary is blue in brand — we intentionally avoid orange/red to dodge the "Snapchat shame-flame" aesthetic |
| Flame (milestone) | `t.palette.primary_500` with a subtle `primary_100` glow via `shadowColor` (native) | `primary_600` with `primary_900` glow | |
| Streak number | `t.atoms.text` | `t.atoms.text` | |
| Indicator pill bg | `t.atoms.bg_contrast_25` | `t.atoms.bg_contrast_25` | |
| Recap card bg | `t.atoms.bg` | `t.atoms.bg` | |
| Recap card border | `t.atoms.border_contrast_low` | `t.atoms.border_contrast_low` | |
| Recap stat number | `t.atoms.text` | | `a.text_2xl` + `a.font_bold` |
| Recap stat label | `t.atoms.text_contrast_medium` | | `a.text_sm` |
| At-risk clock | `t.atoms.text_contrast_medium` | — | **not red.** See §13. |

**Colorblind considerations**: streak states are differentiated by **icon + number + copy**, never by color alone. Milestone is marked with the `Celebrate` icon plus copy, not just a hue shift.

---

## 11. Accessibility Specification (mandatory)

### Screen reader
- Streak indicator is a single focusable element with `accessibilityRole="button"` and a label like `{N}-day streak`. Double-tap announces hint "Open streak details".
- When streak state changes during the session (e.g. day rolls over while app is open), we fire an `AccessibilityInfo.announceForAccessibility()` with "Streak is now {N} days" **only on milestone days (7/30/100)**, not every day. Non-milestone days: silent update.
- Recap card announces: "Your week on Bluesky recap is ready. Double tap to open."
- Recap screen: stats read in order: posts → new followers → top post. Each stat has a combined label like "You made 12 posts this week".

### Focus order
- Streak dialog: Close button → streak number → week calendar dots (skip as group, announced once as "This week, 5 of 7 days visited") → Turn off → dismiss.
- Recap screen: back → title → each stat in order → top post → share → turn off.

### Dynamic Type / large text
- All text uses `#/components/Typography` primitives which respect system font scaling.
- Streak pill must grow vertically (not clip) when text scales to 200%. Use `a.flex_row` + `a.align_center` — not fixed heights.
- Recap stat number uses `a.text_2xl` — at XXL accessibility sizes (~310%) we gracefully drop to a single-column stat stack.

### Reduced motion
- All animations in §9 honor `useReducedMotion()`. Milestone bounce, stagger, fade — all have static fallbacks.

### Hit targets
- Streak indicator minimum 44×44 pt (use `hitSlop` if visual pill is smaller). Matches `HITSLOP_10` pattern already used in header.
- Recap card dismiss "✕" must be 44×44 pt with icon at 16pt centered.

### Color contrast
- Primary number on indicator pill bg: ≥ 4.5:1 (WCAG AA body).
- Flame icon on bg: not a text requirement but we still aim 3:1.
- **No color-only state differentiation** (see §10).

### RTL
- Streak pill: flex-row; in RTL the number goes to the left of the flame. Use ALF's built-in LTR/RTL handling via React Native's `I18nManager`.
- Recap stats: laid out vertically so no horizontal mirroring needed.
- Week calendar dots: Mon–Sun order flips to Sun–Mon in RTL locales (follow locale `firstDayOfWeek`).
- Recap card arrow/CTA: `ArrowShareRight` icon mirrored in RTL.

---

## 12. Delivery Moment & Empty States (Recap-specific)

### When does the recap appear?
**Recommendation: on next app open *after* Monday 00:00 user-local.**
- Rationale: no timezone surprises, no weekend push during user's Sunday family time.
- Weeks roll Mon–Sun (ISO-8601 week). Week `2026-W15` covers Apr 6 – Apr 12.
- The card is generated server-side overnight Sun→Mon UTC and fetched when the user opens.
- If the user doesn't open the app until Thursday, the card for `W15` still appears (one-shot) — but if the next week (`W16`) has already completed, we show **the most recent** week, not a queue.

### What if they don't open for 3 weeks?
- We show exactly one recap: the most recent completed week. No backlog.
- Notifications feed may contain up to 3 entries (one per week) for completeness, but dated clearly.

### Empty states
- **Zero posts, zero new followers, zero engagement**: recap screen shows a single honest block. "A quiet week. Nothing happening isn't a problem." Copy in §7. No suggestion to post more. No graphs of zeroes.
- **No recap exists yet** (new account): Notifications has no entry; no card appears. User is not told "you don't qualify yet" — absence is the message.

### Push notifications
- **v0: no push notifications.** The recap arrives in-app. This is deliberate anti-dark-pattern: we don't ping users to come check their stats.
- Future (v1+): if we ever do push, it must be opt-in during onboarding, not opt-out.

---

## 13. Anti-dark-pattern / humane-design stance (testable)

This is a retention feature. It must not feel like one. The following are **testable** UX acceptance criteria:

| AC-ID | Criterion | How to test |
| --- | --- | --- |
| H-1 | No countdown timer is ever displayed ("5 hours to keep your streak"). | grep the final build for time-remaining copy; manual QA of at-risk state. |
| H-2 | Streak broken never uses red, ⚠️, skulls, crying emojis, or loss-aversion copy ("You lost it!"). | QA review of broken-state strings in all 30+ locales. |
| H-3 | No fullscreen celebration moment. Milestones are max one icon + 200ms bounce + one haptic. | Visual review at day 7/30/100. |
| H-4 | No push notification in v0. | Audit push registration code — no new categories added. |
| H-5 | No streak-freeze / streak-restore monetization hooks exist in v0 code. | Code review. |
| H-6 | User can disable both streak and recap from a single obvious toggle in Settings, and the toggle hides all UI within one app session. | Manual test of toggle → home header, nav, notifications should not show streak/recap. |
| H-7 | Empty/zero-activity states never use the words "missed", "failed", "behind", "lost". | String audit. |
| H-8 | Streak data is computed from existing session-open events; we do **not** introduce a new "daily check-in" mechanic that requires a tap to count. Opening the app is sufficient. | Spec review + product sign-off. |
| H-9 | Recap does not rank the user against other users ("You posted more than 72% of people!"). | Recap screen visual QA. |
| H-10 | At-risk state never appears in the chrome indicator — only inside the opt-in detail sheet. | UI inspection; chrome renderer only has `idle` / `active` / `milestone` branches. |
| H-11 | Nothing in this feature uses `setTimeout`/polling to "threaten" a reset as the clock approaches midnight. | Code review. |
| H-12 | On first-day state, copy explicitly tells the user they don't need to come back. | String check: "Nothing to prove — come back when you want." |

---

## 14. Sharing — v0 recommendation

**Recommendation: defer sharing to v0.5. Ship v0 without a share button.**

Rationale:
- Share artboards invite status-comparison behavior that runs against the humane stance.
- If we do add it, **must be opt-in**, **must not auto-include user's @handle** (user toggles whether handle appears), **must not include follower count in a boastful way**, and **must be a static image export** (not a deep link that reveals profile analytics).
- v0.5 artboard sketch: 1080×1920, dark or light variant, Bluesky logo bottom-right, one big number (streak N or "X posts this week"), handle opt-in at the top.
- Privacy controls for v0.5:
  - Toggle: "Include my handle in shared images" (default OFF).
  - Toggle: "Include my avatar in shared images" (default OFF).
  - Follower count never appears in shared images.
- Native: `expo-sharing` or system share sheet. Web: `navigator.share()` with PNG blob, fallback to download.

---

## 15. Settings integration

One toggle group in `Settings → Appearance & activity`:

- **Show streaks** (default ON — see note below)
- **Show weekly recap** (default ON)
- **Use streaks and recap for analytics** (default OFF — we do not track engagement metrics from these surfaces beyond anonymous counters)

**Default note**: recommended default is ON because the feature is valuable; but the toggle must be reachable in ≤ 2 taps from the streak detail sheet ("Turn off streaks" link → jumps directly into the settings row). This satisfies H-6.

---

## 16. Acceptance criteria (UX-testable summary)

- **UX-AC-1**: Streak indicator renders in Home header (mobile/native) and LeftNav (desktop web) with a minimum 44×44 hit target.
- **UX-AC-2**: Streak indicator uses `Flame_Stroke2_Corner1_Rounded` icon and `t.palette.primary_500` for active state; never uses hardcoded hex.
- **UX-AC-3**: All 8 streak states in §3.1 render correctly and have screen-reader labels.
- **UX-AC-4**: All streak/recap copy strings are wrapped in Lingui `msg` or `<Trans>` and pluralize correctly for English `one/other`.
- **UX-AC-5**: Recap card appears at most once per ISO week per user, on next open after Monday 00:00 local time.
- **UX-AC-6**: Recap screen renders all six states in §3.2 including honest zero-activity empty state with no shaming copy.
- **UX-AC-7**: All animations honor reduced-motion; milestone has a static fallback.
- **UX-AC-8**: A single Settings toggle disables the entire feature and removes all UI within the session.
- **UX-AC-9**: All anti-dark-pattern criteria H-1 through H-12 in §13 pass.
- **UX-AC-10**: Feature renders correctly in dark + light themes and in RTL locales (Arabic, Hebrew).
- **UX-AC-11**: No push notification code paths are added in v0.
- **UX-AC-12**: No share button ships in v0 (deferred to v0.5).

---

## 17. Open questions (for PM / coordinator)

1. **Does the backend support a weekly rollup query?** This spec assumes a `getWeeklyRecap({weekId, did})` AppView endpoint. If not, scope balloons.
2. **What counts as a "visit" for streak purposes?** This spec assumes "session opened in the foreground for ≥ 2 seconds in user's local day". Needs engineering sign-off.
3. **Do we persist streak locally, server-side, or both?** Local-only is more privacy-respecting but loses sync across devices; server-side is sync-friendly but leaks one more signal. Recommend: compute client-side from existing session events; optional opt-in sync.
4. **Minor-account policy**: should streaks be suppressed for under-18 users by default? Recommend yes; follow existing Age Assurance flags (`useAgeAssurance`).
5. **Notifications feed entry count**: exactly one recap entry, or rolling three weeks? Recommend one.
6. **Localization of week boundaries**: US convention is Sun–Sat; ISO is Mon–Sun. Recommend ISO globally, adjust week-dot labels per locale.

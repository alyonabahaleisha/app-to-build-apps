# UX Spec — Streaks + Weekly Recap (ticket i9KLo7kw)

Author: Designer subagent
Scope: (1) streak indicator in Home header / left rail, (2) streak explainer dialog, (3) Notifications-tab recap card, (4) full-screen recap route, (5) `Settings → Content & Media → Activity & recap` sub-screen.
Grounded in: ALF atoms (`#/alf`), existing `Dialog` / `Button` / `Typography` / `SettingsList` primitives, Lingui i18n (CLAUDE.md §Typography, §i18n). Existing `Flame_Stroke2_Corner1_Rounded` icon lives at `/Users/Alyona_Yanuchek/AIProjects/ticket-to-deliver2/social-app/src/components/icons/Flame.tsx` — **reuse, do not introduce a new asset.**

> Humane-first: every choice below is driven by guardrails G1–G10 in the ticket and spec §Guardrails. Anywhere this UX could have become loss-aversive, social, or noisy, we chose silence.

---

## 1. Design goals

1. **Humane-first.** No countdown, no "don't lose it", no shame-framing, no social pressure. If the user's behavior changes because of this feature, it should be because the surface was pleasant, not because we manufactured anxiety (G1, G5, G7).
2. **Low visual weight.** The streak is a 16pt flame + integer; the recap is a single dismissible card, not a takeover. Nothing animates to draw the eye; nothing uses the attention-grabbing `negative` palette (G3).
3. **Reversible.** One Settings sub-screen, both toggles default ON, <1s effect, with an opt-out link also inside the explainer dialog. Opt-out is permanent — we never ask again (G8, G10).
4. **Progressive disclosure.** Rules, longest streak, and grace-day status live **only** in the explainer dialog. The header shows `flame N` and nothing else (G2, G4).
5. **Client-local, platform-native.** No push, no email, no badge, no app-icon count. The feature feels like part of the app chrome, not a product growth overlay (AC-X4, AC-B7).

---

## 2. Information architecture

```
Home tab
├── Header (native)           ── [StreakIndicator] ← tap opens StreakExplainerDialog
│
Desktop web shell
├── LeftNav profile row       ── [StreakIndicator] (below profile, above nav list)
│
Notifications tab
├── [WeeklyRecapCard]          ── pinned atop list Mon ≥06:00 local when eligible
│       └─ tap → screens/Recap
│
screens/
├── Recap/                     ── full-screen route `Recap` (new in CommonNavigatorParams)
│   └── weekId param
└── Settings/
    └── ContentAndMediaSettings  (existing)
        └── row "Activity & recap" → screens/Settings/ActivityAndRecap/  (new)
            ├── Toggle: Show streak
            ├── Toggle: Show weekly recap
            └── row "Past recaps"  → screens/Settings/PastRecaps/  (new, 4-week rolling)
```

Navigation registrations required (handed off to architect):
- `CommonNavigatorParams.ActivityAndRecap: undefined`
- `CommonNavigatorParams.PastRecaps: undefined`
- `CommonNavigatorParams.Recap: {weekId: string}`

Entry points:
- **Streak**: chrome indicator only (no deep link, no notifications feed entry).
- **Recap**: (a) card on Notifications tab, (b) Settings → Activity & recap → Past recaps, (c) deep link `bsky.app/recap/:weekId` for parity with existing deep-linked routes. No push, no email (AC-B7).

Exits:
- Dialog closes: `Dialog.Handle` swipe (native) / `Dialog.Close` (web) / backdrop tap. Settings-nav exit uses `control.close(() => navigation.navigate(...))` pattern (CLAUDE.md footgun — this is **non-negotiable**).
- Recap screen: native back / web back arrow / iOS swipe-back.

---

## 3. Component inventory

### 3.1 `StreakIndicator`

**Location (platform split via directory pattern — CLAUDE.md §Platform-Specific Code):**
```
src/components/Streak/StreakIndicator/
├── index.tsx          # shared render; accepts a `slot` prop telling it which context
├── index.native.tsx   # wires into HomeHeaderLayoutMobile
└── index.web.tsx      # wires into LeftNav (desktop-web breakpoint) and
                       # HomeHeaderLayout.web.tsx fallback for mobile-web viewport
```

Visibility predicate (implemented once in shared hook `useIsStreakVisible()`):
`hasSession && !optedOut && currentStreak >= 2 && activeTab === 'Home' && featureFlagOn` (AC-A6, AC-A7, G4).

**Wireframe (native Home header, LTR):**
```
┌────────────────────────────────────────────────────────────┐
│ [avatar]  Feeds bar . . . . . . . . . . . . . . . [🔥 4] │
└────────────────────────────────────────────────────────────┘
```

**Wireframe (desktop web, left rail, LTR):**
```
┌──────────────────────┐
│ [avatar] @handle     │
│ 🔥 4  (streak row)   │
│──────────────────────│
│ Home                 │
│ Search               │
│ Notifications        │
│ ...                  │
└──────────────────────┘
```

**Atoms / primitives:**
- Pressable wrapper: `Button` with `variant="ghost"`, `color="secondary"`, `size="tiny"`, `shape="default"` — this gives us the 44×44 hit target CLAUDE.md Accessibility best practice demands.
- Flame icon: `Flame_Stroke2_Corner1_Rounded` at 16pt (native header) / 18pt (web left rail).
- Number: `<Text style={[a.text_sm, a.font_semibold, t.atoms.text]}>`.
- Layout: `a.flex_row`, `a.align_center`, `a.gap_2xs`. `a.flex_row` is RTL-safe — React Native flips it under `I18nManager.isRTL`.

**Colors (theme tokens only — CLAUDE.md §Styling):**
- Flame tint: `t.atoms.text_contrast_high` (intentionally *not* `t.palette.primary_500`; we want the indicator to read as neutral chrome, not a brand accent, per G3).
- Number: `t.atoms.text`.
- No background fill — the indicator is an icon+text pair, not a pill. A pill draws the eye. Bare chrome does not.

**State variants:**

| State | Render | Notes |
| --- | --- | --- |
| hidden | returns `null` | streak<2, opted out, logged out, or non-Home tab (AC-A7) |
| active (n≥2) | `🔥 {n}` | only visible state in chrome |
| loading (first mount, storage hydrating) | `null` | no skeleton — do not flash chrome during <100ms hydration |
| error (storage read failed) | `null` | silent fail; logger.error without PII (spec §Observability) |
| reduced motion | identical to active — there is no motion to disable here (G3) |
| RTL | `{n} 🔥` (flex-row auto-mirrors) | number on the right in LTR, on the left in RTL |
| offline | identical to active | streak is 100% client-local (AC-A9), so offline ≡ online |

**a11y contract (AC-A6):**
- `role="button"`
- `accessibilityLabel`: `_(plural(count, {one: '1-day Bluesky streak', other: '#-day Bluesky streak'}))` — ticket text says `{n}-day Bluesky streak`; pluralizing preserves correctness under CLDR forms (AC-X5).
- `accessibilityHint`: `_(msg\`Opens your streak details.\`)`
- `testID="streakIndicator"` (AC-A6).
- `hitSlop={HITSLOP_10}` (from `#/lib/constants`).
- When the streak increments **while the app is open** (day-rollover mid-session), do **not** call `AccessibilityInfo.announceForAccessibility()`. G3 says no celebration; that rule applies to screen readers too.

---

### 3.2 `StreakExplainerDialog`

**Location:** `src/components/Streak/StreakExplainerDialog.tsx` (platform-agnostic — `Dialog` already resolves bottom-sheet vs modal).

**Opened by:** `StreakIndicator.onPress → control.open()`.
Uses `Dialog.useDialogControl()` (CLAUDE.md §Dialog).

**Wireframe:**
```
┌───────────────────────────────────────────────┐
│ [Dialog.Handle]         (native only)         │
│ [Dialog.Close]          (web only, top-left)  │
│                                               │
│  Your streak                                  │
│                                               │
│             🔥                                │
│             4                                 │
│           days                                │
│                                               │
│  Longest: 12 days                             │
│                                               │
│  Bluesky counts one streak day when you open │
│  the app. One missed day is fine — the count │
│  keeps going. Two missed days resets it.     │
│                                               │
│  [ grace-day line, conditional — see below ] │
│                                               │
│  ──────────────────────────────────────────── │
│   Activity & recap settings  ›               │
│  ──────────────────────────────────────────── │
└───────────────────────────────────────────────┘
```

**Atoms / primitives:**
- `Dialog.Outer`, `Dialog.Handle` (native), `Dialog.ScrollableInner label={_(msg\`Your streak\`)}`, `Dialog.Close` (web), `Dialog.Header`, `Dialog.HeaderText`.
- Big number block: `<Text style={[a.text_5xl, a.font_bold, t.atoms.text, a.text_center]}>{count}</Text>` with flame icon above (28pt, centered) and "days" label below (`a.text_md`, `t.atoms.text_contrast_medium`).
- Longest-streak row: `a.text_sm`, `t.atoms.text_contrast_medium`.
- Rules paragraph: `<P>` from `#/components/Typography`; max 3–4 sentences; plain-language.
- Grace-day status: only rendered when `graceUsedForCurrentStreak === true`. Copy is neutral — see Copy Deck. **This is the only place grace-day is ever surfaced** (G2).
- Settings link: existing `Link` / `Button` row, label `<Trans>Activity & recap settings</Trans>` + chevron, uses `control.close(() => navigation.navigate('ActivityAndRecap'))` (CLAUDE.md footgun).
- **No share button, no "keep it going" CTA, no countdown, no calendar-of-days widget** (G1, G5; AC-A8).

**State variants:**

| State | Render |
| --- | --- |
| default (grace not used) | big number + longest + rules + settings link |
| grace-used this streak | above + 1 extra line: `<Trans>One missed day this streak, which is fine.</Trans>` |
| longest == current | longest-row omitted (avoid the redundant "Longest: 4 days" when current is 4) |
| reduced motion | Dialog's own enter/exit already respects reduced motion; no extra motion here |
| RTL | layout mirrors naturally; chevron in the Settings link flips via ALF's existing icon-mirror pattern |
| loading | never shown; dialog only opens when indicator is visible, i.e. data already hydrated |
| error | if storage read fails after dialog opens, show a quiet line: `<Trans>We couldn't load your streak right now.</Trans>` — no retry button (transient; user can close and reopen) |

**a11y contract (AC-A8):**
- `Dialog.ScrollableInner` auto-announces the `label` prop to screen readers.
- Focus order: Close → Title → number+days block (grouped as a single label "4 days") → longest → rules → grace (if present) → Settings link.
- `testID="streakExplainerDialog"`.
- Big number should read as "4 days" to the screen reader, not "4", then "days" — combine with `accessibilityLabel` on the parent `View`.
- Settings link: `accessibilityRole="link"`, `accessibilityHint={_(msg\`Goes to Activity & recap settings.\`)}`.

---

### 3.3 `WeeklyRecapCard`

**Location:** `src/screens/Recap/components/WeeklyRecapCard.tsx` (co-located with Recap screen — CLAUDE.md §Project Structure).

**Where it renders:** pinned as the first list item on the Notifications tab feed, above all notification rows. Implemented via a header slot in the existing notifications list, not by injecting into the notifications data array (keeps notification-read-state logic clean).

**Trigger predicate (architect to implement):** ISO-week boundary crossed AND `Date.now()` local-time ≥ Monday 06:00 AND prior ISO week had ≥1 qualifying visit AND user has not dismissed *this specific weekId* AND card has not auto-expired (7 days since first appearance for this weekId) AND recap toggle is ON (AC-B1, B5, B6, B11, G7).

**Wireframe:**
```
┌────────────────────────────────────────────┐
│ Your week on Bluesky       Apr 6–12    [✕] │
│                                            │
│  12 posts · 3 new followers · 1 top post  │
│                                            │
│                  [ Open recap ]            │
└────────────────────────────────────────────┘
```

**Atoms / primitives:**
- Outer: `View` with `a.rounded_md`, `a.border`, `t.atoms.border_contrast_low`, `t.atoms.bg`, `a.p_lg`, `a.mx_md`, `a.my_sm`.
- Title: `<Text style={[a.text_md, a.font_bold, t.atoms.text]}>`.
- Date range: `<Text style={[a.text_sm, t.atoms.text_contrast_medium]}>`.
- Preview line: `<Text style={[a.text_sm, t.atoms.text_contrast_medium]}>` with localized separator `·` (middle dot is bidi-neutral — safe for RTL).
- CTA: `<Button color="primary" size="small" label={_(msg\`Open recap\`)}>`.
- Dismiss: `<Button variant="ghost" color="secondary" size="tiny" shape="round" label={_(msg\`Dismiss weekly recap\`)}>` with `XIcon` (check `#/components/icons/Times` or existing close icon).

**State variants:**

| State | Render |
| --- | --- |
| loading | skeleton card with `a.rounded_md` outer + 3 lines of gray blocks; no copy strings |
| populated (any posts OR followers OR top-post) | wireframe above; preview line joins the non-zero metrics |
| zero posts AND zero followers AND no top post | `Trans` preview copy: `<Trans>A quiet week.</Trans>` — CTA still says Open recap (full screen has the empty-state explanation) |
| error (compute failed 2+ times in last hour) | card hidden entirely; no error toast (AC-B8 auto-retry cap is 2/hr) |
| offline | card hidden — no cached variant; computation re-runs next foreground (AC-B11 coverage: when toggle off, no compute at all) |
| dismissed for this weekId | card hidden until next weekId; dismissal does **not** apply globally (AC-B5) |
| auto-expired | card hidden, no "expired" indicator (AC-B6) |
| reduced motion | card still fades in 120ms, but **opacity-only** branch (no translate) — CLAUDE.md `useReducedMotion()` gate |
| RTL | layout mirrors; `Apr 6–12` date range uses locale-specific `Intl.DateTimeFormat` range formatter |

**a11y contract (AC-B9):**
- Outer container: `accessibilityRole="button"`, `accessibilityLabel={_(msg\`Weekly recap: ${posts} posts, ${followers} new followers. Opens full recap.\`)}`.
- `testID="weeklyRecapCard"`.
- Dismiss button: separate focusable element, `accessibilityLabel={_(msg\`Dismiss weekly recap\`)}`, `hitSlop={HITSLOP_10}`.
- Dismiss does not trap focus — tapping it removes the card from the list; focus moves to the next notification row (React Native default).

---

### 3.4 `RecapScreen`

**Location:** `src/screens/Recap/index.tsx` with co-located components (CLAUDE.md §Project Structure — subdirectory pattern for complex screens).

**Route:** `CommonNavigatorParams.Recap: {weekId: string}`. Registered in `src/routes.ts` and `src/Navigation.tsx` as a stack screen (not a tab).

**Layout uses `Layout.Screen` + `Layout.Header` pattern** (matches other full-screen routes like Notifications settings).

**Wireframe:**
```
┌───────────────────────────────────────────────┐
│ [<]  Your week on Bluesky                     │
│───────────────────────────────────────────────│
│                                               │
│   Apr 6 – Apr 12, 2026                       │
│                                               │
│   ┌─────────────────────────────────────┐    │
│   │ Posts                               │    │
│   │ 12                                  │    │
│   └─────────────────────────────────────┘    │
│   ┌─────────────────────────────────────┐    │
│   │ New followers                       │    │
│   │ 3                                   │    │
│   └─────────────────────────────────────┘    │
│   ┌─────────────────────────────────────┐    │
│   │ Top post                            │    │
│   │ [existing Post component]           │    │
│   └─────────────────────────────────────┘    │
│                                               │
└───────────────────────────────────────────────┘
```

**Atoms / primitives:**
- `Layout.Screen`, `Layout.Header.Outer`, `Layout.Header.BackButton`, `Layout.Header.Title` (platform-consistent back; native shows chevron, web shows back arrow per existing Header conventions).
- Week range: `<Text style={[a.text_md, t.atoms.text_contrast_medium, a.px_md, a.pt_md]}>` — formatted via `Intl.DateTimeFormat(locale, {dateStyle: 'medium'}).formatRange(...)`.
- Metric cards (3): `View` with `a.rounded_md`, `a.border`, `t.atoms.border_contrast_low`, `a.p_lg`, `a.mx_md`, `a.my_xs`.
- Metric label: `a.text_sm`, `t.atoms.text_contrast_medium`.
- Metric number: `a.text_4xl`, `a.font_bold`, `t.atoms.text`.
- Top-post container: renders the existing `FeedItem` / `PostThreadItem` from `src/view/com/posts/` or `src/components/FeedItem` — **architect to confirm exact export**; designer requires reuse, not a fresh post renderer (AC-B3).
- No "share", no "post another!" CTA, no "last week's stats" comparison (G5, G6).

**State variants:**

| State | Render |
| --- | --- |
| loading | three skeleton metric cards; header shown |
| populated | all three metrics + embedded top post |
| zero-posts (AC-B4) | Posts card shows `0`; top-post card is replaced by a single `<P>` with: `<Trans>No posts this week — that's fine.</Trans>` (exact string per AC-B4) |
| zero-followers-delta | New followers card shows `0` (clamped per AC-B4) |
| top post deleted/hidden (AC-B10) | fall back to next-highest engagement post; top-post card re-renders silently |
| no qualifying posts at all (AC-B10) | top-post card replaced by empty copy |
| error | full-screen empty-state block: icon `CircleInfo`, copy `<Trans>We couldn't load this recap.</Trans>`, button `<Trans>Try again</Trans>` (manual retry per AC-B8) |
| offline | if query has cached data, show cached; else same as error state |
| partial (metrics ok, top post failed) | show metrics; top-post card shows fallback empty copy (not an error) |
| reduced motion | no stagger-in on the three cards; all render at once (AC-B9) |
| RTL | metric cards stack vertically — no horizontal mirror needed; week-range formatter uses locale |
| large text (XXL) | metric number wraps to new line if needed; card height grows; no clipping |

**a11y contract (AC-B3, AC-B9):**
- `Layout.Screen` sets screen-read focus on the header title on mount.
- Each metric card: `accessibilityRole="text"`, combined label e.g. `_(plural(posts, {one: 'You made 1 post this week.', other: 'You made # posts this week.'}))`.
- Follower card: `_(plural(followers, {one: '1 new follower this week.', other: '# new followers this week.'}))`.
- Top-post card: inherits post component's existing a11y (already handled by reused Post primitive).
- `testID="recapScreen"`, metric cards `testID="recapPostsCard"`, `"recapFollowersCard"`, `"recapTopPostCard"`.
- Retry button in error state: `accessibilityLabel={_(msg\`Try loading recap again\`)}`.

---

### 3.5 `ActivityAndRecapSettingsScreen`

**Location:** `src/screens/Settings/ActivityAndRecap.tsx` (follows existing `ContentAndMediaSettings.tsx` pattern).

**Parent entry:** added as a new row inside `ContentAndMediaSettings` (spec §UI layering), under the existing rows. Icon suggestion: `Flame_Stroke2_Corner1_Rounded` reused, or `CalendarDays` if available — architect to verify.

**Wireframe:**
```
┌───────────────────────────────────────────────┐
│ [<]  Activity & recap                         │
│───────────────────────────────────────────────│
│                                               │
│   ┌─────────────────────────────────────┐    │
│   │  Show streak                 [ON/OFF]│    │
│   └─────────────────────────────────────┘    │
│   ┌─────────────────────────────────────┐    │
│   │  Show weekly recap           [ON/OFF]│    │
│   └─────────────────────────────────────┘    │
│                                               │
│   Past recaps                            ›    │
│                                               │
│   Streak and recap are stored only on this    │
│   device. No data is shared.                  │
└───────────────────────────────────────────────┘
```

**Atoms / primitives:**
- `SettingsList.Container`, `SettingsList.Group`, `SettingsList.Item`, `SettingsList.ItemIcon`, `SettingsList.ItemText` from `src/screens/Settings/components/SettingsList.tsx` (reused).
- Two `Toggle` rows from `#/components/forms/Toggle`, same pattern as `useAutoplayDisabled` in `ContentAndMediaSettings.tsx`.
- "Past recaps" row: `SettingsList.LinkItem` (or equivalent Link inside SettingsList) → navigates to `PastRecaps` screen.
- Footer note: small `<Text style={[a.text_xs, t.atoms.text_contrast_medium, a.px_lg]}>` clarifying local-only storage (reinforces user trust, AC-A9, AC-X2).

**State variants:**

| State | Render |
| --- | --- |
| both ON (default) | as above |
| streak OFF | toggle reflects OFF; on next render, `StreakIndicator` returns null (AC-X1 <1s effect) |
| recap OFF | toggle reflects OFF; stops computation entirely (AC-B11); existing cached recap query is invalidated |
| loading | toggles render with current persisted value; no spinner (MMKV reads are synchronous) |
| error | toggle writes cannot fail at this tier; if storage throws, log + keep UI optimistic until next render |
| reduced motion | no changes (toggles already use platform-native micro-animations) |
| RTL | SettingsList already RTL-safe |
| large text | rows grow in height; no clipping |

**a11y contract (AC-X1, AC-X5):**
- Toggles: `accessibilityRole="switch"`, `accessibilityLabel` + state value handled by the `Toggle` primitive.
- `testID="activityRecapShowStreakToggle"`, `"activityRecapShowRecapToggle"`, `"activityRecapPastRecapsLink"`.
- Past recaps row: `accessibilityRole="link"`, `accessibilityHint={_(msg\`Opens list of past weekly recaps.\`)}`.

**Sibling screen — `PastRecapsScreen`:**
- Location: `src/screens/Settings/PastRecaps.tsx`.
- Lists up to 4 rows (4-week rolling window, AC-B5), each row: week range label + chevron → navigates to `Recap` with that `weekId`.
- Empty state (new account <4 weeks): `<Trans>No past recaps yet.</Trans>`.
- Reuses `SettingsList.Item` pattern.

---

## 4. Copy deck (all Lingui-wrapped, AC-X5)

All strings use `msg\`...\`` via `_()` for attribute strings, or `<Trans>` for rendered JSX. Grouped by surface.

### Streak indicator

```ts
// accessibilityLabel — AC-A6 exact text
_(plural(count, {
  one: '1-day Bluesky streak',
  other: '#-day Bluesky streak',
}))

// accessibilityHint
_(msg`Opens your streak details.`)
```

### Streak explainer dialog

```tsx
// Dialog.ScrollableInner label
_(msg`Your streak`)

// Title
<Trans>Your streak</Trans>

// Big-number label (below the integer)
<Trans>days</Trans>

// Combined big-number a11y
_(plural(count, {one: '1 day', other: '# days'}))

// Longest row (only when longest > current)
<Trans>Longest: {longest} days</Trans>
// plural-correct variant
_(plural(longest, {one: 'Longest: 1 day', other: 'Longest: # days'}))

// Plain-language rules — 3 short sentences (G1: no loss-aversion)
<Trans>Bluesky counts one streak day each day you open the app. One missed day is fine — the count keeps going. Two missed days in a row resets it.</Trans>

// Grace-day line (conditional; G2 — the ONLY place grace is surfaced)
<Trans>One missed day this streak, which is fine.</Trans>

// Settings link
<Trans>Activity & recap settings</Trans>
_(msg`Goes to Activity & recap settings.`) // accessibilityHint

// Error (rare — storage read post-open)
<Trans>We couldn't load your streak right now.</Trans>
```

**Explicitly NOT included (guardrail-enforced absences):**
- No "keep it going" / "don't lose your streak" / "visit tomorrow" copy (G1).
- No "you saved it!" / "grace day used!" celebration copy (G2).
- No share CTA (AC-A8, G5).
- No countdown / "X hours left today" (G1).

### Weekly recap card

```tsx
// Header
<Trans>Your week on Bluesky</Trans>

// Date range (locale-formatted at render time)
// e.g. "Apr 6–12" via Intl.DateTimeFormat(locale).formatRange(start, end)

// Preview line — joined with middle dot (bidi-neutral)
_(plural(posts, {one: '1 post', other: '# posts'}))  // only included if >0
_(plural(followers, {one: '1 new follower', other: '# new followers'}))  // only if >0
<Trans>1 top post</Trans>  // only if top post exists

// Zero-metrics preview fallback
<Trans>A quiet week.</Trans>

// CTA
<Trans>Open recap</Trans>

// Dismiss a11y
_(msg`Dismiss weekly recap`)

// Card a11y label
_(msg`Weekly recap: ${postsLabel}, ${followersLabel}. Opens full recap.`)
```

### Weekly recap screen

```tsx
// Header title
<Trans>Your week on Bluesky</Trans>

// Week range (formatted)
// via Intl.DateTimeFormat

// Posts metric
<Trans>Posts</Trans>
// a11y combined
_(plural(posts, {one: 'You made 1 post this week.', other: 'You made # posts this week.'}))

// New followers metric
<Trans>New followers</Trans>
// a11y combined
_(plural(followers, {one: '1 new follower this week.', other: '# new followers this week.'}))

// Top post metric label
<Trans>Top post</Trans>

// Zero-posts empty (AC-B4 EXACT wording)
<Trans>No posts this week — that's fine.</Trans>

// No-top-post-found fallback (AC-B10)
<Trans>No posts this week — that's fine.</Trans>

// Error state
<Trans>We couldn't load this recap.</Trans>
<Trans>Try again</Trans>
_(msg`Try loading recap again`)  // a11y label
```

**Explicitly NOT included:**
- No "post more next week" nudge (G6, AC-B4).
- No "you posted more than X% of users" comparison (G5).
- No time-spent / scroll / "read X posts" metrics (G6).

### Settings → Activity & recap

```tsx
// Parent row in ContentAndMediaSettings
<Trans>Activity & recap</Trans>

// Sub-screen header
<Trans>Activity & recap</Trans>

// Toggle labels
<Trans>Show streak</Trans>
<Trans>Show weekly recap</Trans>

// Past recaps row
<Trans>Past recaps</Trans>

// Storage clarification footer (trust-builder; reinforces AC-A9, AC-X2)
<Trans>Streak and recap are stored only on this device. No data is shared.</Trans>

// PastRecaps screen
<Trans>Past recaps</Trans>  // title
<Trans>No past recaps yet.</Trans>  // empty state
// Row label — locale-formatted week range
```

**Deliberately NOT included:** no "Are you sure?" confirmation on toggle-off (G8, G10 — opt-out must be frictionless; do not re-prompt).

---

## 5. Platform differences

| Concern | Native (iOS/Android) | Web (desktop ≥gtMobile) | Web (mobile viewport) |
| --- | --- | --- | --- |
| Streak indicator placement | Home header, right of Feeds bar, near drawer avatar | Left rail, directly under profile row | Home header (same as native — uses `index.web.tsx` with breakpoint guard) |
| Dialog presentation | Bottom sheet (`Dialog.Outer` on native) + `Dialog.Handle` | Modal (`Dialog.Outer.web`) + `Dialog.Close` (X top-left) | Modal, same as desktop web |
| Settings navigation from dialog | `control.close(() => navigation.navigate('ActivityAndRecap'))` — callback pattern required (CLAUDE.md footgun) | Same callback pattern | Same |
| Recap screen back affordance | iOS chevron-left or Android back; iOS swipe-back gesture | Back arrow in `Layout.Header`; browser back works | Back arrow |
| Recap card pinned location | Notifications tab, above list | Notifications tab (same list component) | Same |
| Card hover state | n/a | `web({cursor: 'pointer'})` + subtle bg shift on hover via `:hover` pseudo (use ALF's web utility) | n/a |
| Haptic on increment | **none** (G3 forbids it) | n/a | n/a |
| Keyboard shortcuts | n/a | `Esc` closes dialog (handled by Dialog primitive); `Enter` on focused card opens recap | n/a |
| Tooltip on indicator hover | n/a | none — tooltip would be noise; the tap-to-open dialog is enough | n/a |

**File structure (CLAUDE.md §Platform-Specific Code — directory pattern, not sibling files):**
```
src/components/Streak/StreakIndicator/
  index.tsx          # platform-agnostic logic + shared render
  index.native.tsx   # mounts into HomeHeaderLayoutMobile
  index.web.tsx      # mounts into LeftNav + HomeHeaderLayout.web
```
Runtime branching on `IS_WEB` / `IS_NATIVE` is **only** permitted where ALF's `native()` / `web()` style helpers are insufficient.

---

## 6. Accessibility checklist (per-surface, AC-B9 + AC-A6)

| Criterion | StreakIndicator | ExplainerDialog | RecapCard | RecapScreen | Settings |
| --- | --- | --- | --- | --- | --- |
| Screen reader label | ✓ `{n}-day Bluesky streak` | ✓ Dialog label + grouped number | ✓ combined label | ✓ per-metric combined labels | ✓ Toggle primitives handle it |
| Screen reader hint | ✓ | ✓ on settings link | ✓ implicit in role+label | ✓ retry button | ✓ past-recaps row |
| Focus order defined | trivial (single element) | Close → title → number → longest → rules → grace → Settings | card → dismiss (two focusables) | back → title → posts → followers → top post | back → title → toggle1 → toggle2 → past recaps |
| 44×44 hit targets | ✓ via `HITSLOP_10` + `Button` tiny | ✓ Dialog primitives | ✓ card body + separate dismiss | ✓ back button | ✓ SettingsList defaults |
| Dynamic type scales | ✓ flex-row grows | ✓ scrollable inner | ✓ wraps | ✓ stacks to 1-col at XXL | ✓ SettingsList rows grow |
| Reduced motion | no motion at all (G3) | Dialog honors it | opacity-only fade | no stagger | no motion |
| RTL | ✓ flex-row auto | ✓ chevron mirrors via ALF | ✓ date range via locale | ✓ cards stack vertically | ✓ SettingsList RTL-safe |
| Color contrast ≥4.5:1 | `t.atoms.text` + `text_contrast_high` — verified in both themes | ✓ | ✓ | ✓ | ✓ |
| No color-only signal | icon + number | icon + text + number | text-only | text + number + post | text + toggle state |
| testID | `streakIndicator` | `streakExplainerDialog` | `weeklyRecapCard` | `recapScreen` + per-card | `activityRecap*` |

---

## 7. Edge cases

| Case | Behavior | AC / guardrail |
| --- | --- | --- |
| User opts out mid-week | Indicator disappears within 1s; recap card also hides; no farewell toast | AC-X1, G8 |
| User opts out then opts back in | Respected, but no onboarding re-prompt; streak state may have reset if gap >1 day | G10 |
| Account switch | Streak + recap swap per-DID; previous account's data untouched in MMKV | AC-A10, AC-X2 |
| Account removed | Account-scoped MMKV is cleared; no orphan state | AC-A10 |
| Logged out | All surfaces hidden; no recap computation runs | AC-A7, AC-B11 (by extension) |
| Timezone change (travel, DST) | UTC monotonic guard prevents regression; UI never shows "you lost a day" | AC-A5, G1 |
| DST fall-back (25-hour day) | Device-local day boundary still governs; 20-hour UTC guard absorbs the extra hour safely | AC-A5 |
| Offline during Monday 06:00 | Card appears on first foreground after Mon 06:00 within the 7-day window (ac_check ambiguity Q_B1, resolved per spec default) | AC-B1 |
| Top post was deleted between compute and view | Screen falls back to next-highest-engagement post on re-fetch; if query data is stale, show cached, then update | AC-B10 |
| Top post is moderation-hidden (labels) | Treated same as deleted; use next-highest | AC-B10 |
| Zero-posts week | Posts card shows `0`, top-post slot shows empty copy. Recap card still appears (because the week had visits) — spec is clear that "qualifying visit" is the gate, not "posted content". | AC-B4, G7 |
| Zero-visit week | No recap card appears **at all** for that week | G7, AC-B1 |
| Streak = 1 | Indicator hidden; dialog not reachable (no entry point) | AC-A7, G4 |
| Grace day just used | Indicator still shows current streak number; only the dialog surfaces the grace-used line | G2 |
| Feature flag off remotely | Both surfaces hidden on next foreground; Settings sub-screen also hidden (architect: gate the Settings row too — if the flag is off, Settings has no row, avoiding user confusion) | AC-X6 |
| User taps recap card while offline | Navigate to Recap screen; if query has cached data show it; else error state with Try again button | AC-B8 |
| Recap retry exhausted (2/hr budget) | Error state shows Try again button; if user taps, manual retry bypasses the auto-retry budget | AC-B8 |
| Large text (XXL accessibility size) | Streak indicator grows; Recap metrics wrap; SettingsList rows grow — all tested via Dynamic Type | AC-B9 |
| RTL locale (Arabic, Hebrew) | Layout auto-mirrors; date ranges formatted via locale; no manual flips needed in these components | AC-B9 |
| First foreground ever (fresh install, never visited) | No streak indicator (streak=0), no recap card (no prior week data), no NUX prompt | AC-X3, G4 |
| Day 1 of new streak | No indicator (streak=1 < 2), no dialog, no copy ever shown | G4, AC-A7 |

---

## 8. Open questions for the architect

These are UX-adjacent ambiguities that require engineering input, listed in priority order:

1. **Top-post embed component choice.** AC-B3 says "via existing post components." The codebase has multiple candidates (`FeedItem`, `PostThreadItem`, etc.). Architect: pick the one that renders correctly without requiring a reply context or thread gate, and document the choice. This affects whether the Recap screen needs any wrapper component.

2. **Notifications-tab slot mechanism.** The recap card pins above the notifications list. Does the notifications screen currently expose a header slot, or do we need to add one? If we need to inject into the data array, notification-read-state must not be corrupted. Designer prefers a dedicated header slot.

3. **ContentAndMediaSettings row ordering.** The new "Activity & recap" row needs a position. Suggest: bottom of the existing list, so we don't shift users' muscle memory for existing rows. Confirm with architect.

4. **Icon for "Activity & recap" Settings row.** Reuse `Flame_Stroke2_Corner1_Rounded`, or choose a calendar/graph icon? Flame has semantic overlap with the streak indicator (could feel redundant). Architect: verify what's available in `#/components/icons/` and pick the one that reads as "weekly overview," not "streak."

5. **ISO-week formatter locale coverage.** `Intl.DateTimeFormat.formatRange` exists in all supported RN/web runtimes — confirm Hermes engine version in the project supports it, else fall back to two single-date renders joined by an en-dash.

6. **Flame icon color in dark theme.** Designer chose `t.atoms.text_contrast_high` to keep the indicator neutral. If product wants a brand accent, switch to `t.palette.primary_500` — but this pushes against G3. Architect: flag to product if they disagree.

7. **Recap card dismissal persistence.** Per-weekId dismissal requires a small persisted set (≤4 weekIds in the 4-week window). Architect: confirm the storage tier (account-scoped MMKV, same as streak state) and key naming.

8. **Feature-flag gating depth.** AC-X6 requires remote disable. Gate the indicator, gate the card, gate the Recap route (show 404-equivalent or redirect home?), gate the Settings sub-screen row. Four gates, one flag — confirm short-circuit precedence.

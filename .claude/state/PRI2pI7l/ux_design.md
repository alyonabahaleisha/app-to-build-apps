# UX Spec: Quick-React Bar on Posts (PRI2pI7l)

> Status: v0 UX spec, grounded in ALF and existing Bluesky Social App patterns.
> Scope per Trello v0 proposal: fixed 4-emoji set (❤️ 🔥 👀 😂), long-press on native / hover-reveal on web, independent of Like, one reaction per user per post, surfaces = feed + thread only, screen-reader "React to post" action opens an accessible picker.
> This document deliberately does **not** resolve protocol/data-model questions — see `ac_check.json`. It assumes that the client exposes:
> - `viewer.reaction` on a post view (`'love' | 'fire' | 'eyes' | 'laugh' | null`),
> - `reactions` aggregate counts per emoji,
> - mutations `setReaction(emoji)` / `clearReaction()` with optimistic update support analogous to `usePostLikeMutationQueue`.
>
> All colors are theme tokens (`t.atoms.*`, `t.palette.*`). All user-facing strings are shown in Lingui `msg`/`<Trans>` form.

---

## 1. User Journey

### Entry points (all surfaces for v0)
- Feed item (`FeedItem`, timeline, search, feed generators rendered as feed).
- Thread view — both the focused parent post and each reply rendered in `PostThread`.

Reactions do **not** appear on v0 on: notifications rows, quote-post embeds, lightbox, DMs.

### Happy path — native (iOS / Android)

1. User is scrolling the feed. A post card is rendered with the standard `PostControls` row (reply, repost, like, bookmark, share, menu).
2. User long-presses **anywhere on the post body** (text, embed, media container) for **≥ 350 ms**.
3. At ~150 ms a soft haptic "charging" pulse fires (`useHaptics()` light impact) and the post begins a subtle press-scale (`scale: 0.99`) so the user knows the gesture is tracking.
4. At the 350 ms threshold:
   - A strong haptic "confirm" fires (medium impact, same pattern as current context menu).
   - The **Quick-React Bar** slides/fades into view, anchored **above** the post's action row (i.e. above the Reply/Repost/Like row), horizontally centered on the long-press origin and clamped inside the post card bounds.
   - The 4 emoji are visible, evenly spaced.
5. User slides their finger (still-pressed) over an emoji — it grows ("peek" scale 1.25) and a small caption chip appears above it showing the emoji's translated label ("Love", "Fire", "Watching", "Haha").
6. User lifts finger over the target emoji → that reaction is committed (optimistic, like-mutation-queue semantics). The bar dismisses with a quick fade.
7. The post now shows a **reaction chip** in the `PostControls` row between Like and Bookmark (see §3).

### Happy path — web

1. User is scrolling the feed. Post card is rendered with the standard action row.
2. On pointer hover over the post card, a **Quick-React trigger** (smiley-plus icon) fades in inside the action row, to the **right of the Like button and left of Bookmark**. It is always present in the DOM but visually hidden (opacity 0) until hover or focus.
3. Keyboard users reach it via Tab — on focus, the trigger becomes visible (focus ring).
4. On click / Enter / Space, a **Quick-React Popover** opens anchored to the trigger (flip-up if near viewport bottom). It contains the 4 emoji as pressable buttons.
5. User clicks an emoji → reaction committed, popover closes.
6. Post now shows the reaction chip in the same slot (the smiley-plus trigger is replaced by the committed emoji chip; see §3).

### Alternative / edge paths

- **Change reaction**: Repeating the long-press or clicking the chip on web opens the bar with the current choice visually highlighted; tapping a different emoji swaps the reaction. Tapping the same emoji (or a dedicated "Remove" action, see §4) removes it.
- **Cancel mid-gesture (native)**: Dragging off the bar and lifting outside any emoji dismisses with no write and a light haptic "cancel" tick.
- **Logged-out**: The trigger / long-press opens the standard "Sign in to continue" prompt (same pattern as `useRequireAuth()` used by Like).
- **Offline**: Native gesture still works; the mutation queue optimistically applies and retries (existing like-queue pattern). If it fails terminally, see §3 error state.
- **Post deleted between gesture start and commit**: We swallow the write silently and show a Toast "Post was deleted" (`Toast.show`).
- **Long-press collision with text selection on web**: Web does not use long-press for reactions, so no collision. Native already has no text-selection long-press on post bodies (they are `Text` with `selectable={false}` by default in `RichText`).
- **Long-press collision with existing post context menu**: See §5 "Conflict resolution".

---

## 2. Screen Inventory

New or modified surfaces for v0:

| Screen / view | Path | Change |
|---|---|---|
| Feed item | existing `src/view/com/posts/FeedItem.tsx` (and any wrapping) | add long-press gesture on post body; render reaction chip in `PostControls` |
| Post thread | existing `src/screens/PostThread/` | same treatment |
| Post controls row | `src/components/PostControls/index.tsx` | add reaction chip slot; on web add hover-reveal trigger |
| New: Quick-React Bar (native) | `src/components/PostControls/QuickReactBar/index.tsx` | native popover anchored over post on long-press |
| New: Quick-React Popover (web) | `src/components/PostControls/QuickReactBar/index.web.tsx` | web hover/click popover |
| New: Quick-React Picker Dialog | `src/components/PostControls/QuickReactBar/PickerDialog.tsx` | accessible dialog used by screen-reader path and by keyboard fallback; platform-rendered via `Dialog.Outer` (bottom sheet native, modal web) |
| New: Reaction chip | `src/components/PostControls/QuickReactBar/ReactionChip.tsx` | persistent chip in action row showing user's reaction |

No new full-screen routes. No navigation changes.

---

## 3. State Matrix

The state matrix below covers the three UI surfaces that render reaction state: the **reaction chip**, the **quick-react bar/popover**, and the **accessible picker dialog**.

### 3a. Reaction chip (in `PostControls` row)

| State | Native | Web |
|---|---|---|
| **Loading (initial mount)** | Chip slot renders a `Skele.Pill` width ~44 (matches Like). | Same. |
| **Empty (no reaction yet)** | Chip slot is absent on native. The long-press gesture opens the bar instead. Aggregate counts (if any) may show a compact "Reactions" pill only if `totalReactions > 0`. | Slot renders a subtle smiley-plus trigger icon (opacity 0 → 1 on hover/focus of the post card). Color `t.atoms.text_contrast_medium`. |
| **Populated (user has reacted)** | Chip renders: the chosen emoji + count of same-emoji reactions on the post. Background `t.palette.primary_50` in light / `t.palette.primary_975` in dark; border `t.palette.primary_500` at 1px; text color `t.atoms.text`. Radius `a.rounded_full`. Padding `a.px_sm a.py_2xs`. Gap `a.gap_xs`. | Same chip visual. Hover state bumps background to `t.palette.primary_100` / `t.palette.primary_950`. |
| **Error (write failed, non-network)** | Chip briefly animates a shake (native) or border pulse (web), then reverts to previous state. `Toast.show(_(msg\`Couldn't react. Try again.\`), 'xmark')`. | Same. |
| **Offline** | Chip applies optimistically with a low-opacity sync indicator (e.g. a 2px dashed border over the chip) until the queue drains. Tapping again while pending is a no-op. | Same; on web we show a subtle tooltip "Reacting…" on hover. |
| **Partial (aggregate counts unknown)** | Chip renders the emoji without a count. No placeholder zeros. | Same. |

### 3b. Quick-React Bar / Popover (the picker affordance)

| State | Native | Web |
|---|---|---|
| **Loading** | N/A — bar is presentational; it opens instantly from local data. | Same. |
| **Empty** | Always 4 emoji; never empty. | Same. |
| **Populated** | Row of 4 emoji buttons inside a pill container. Background `t.atoms.bg_contrast_25` with 12% black shadow on native (`platform({ios: shadowOpacity 0.12})`), radius `a.rounded_full`, padding `a.px_sm a.py_xs`, gap `a.gap_xs`. Each emoji is 36×36 logical px touch target but visually ~28px glyph. Currently selected emoji has a `t.palette.primary_500` ring (2px). | Same visual but in a `Popover`/floating-ui element with web elevation (`a.shadow_md`). |
| **Error** (`setReaction` fails) | Bar dismisses, chip reverts, Toast shows. | Same. |
| **Offline** | Bar opens normally; commits are queued. | Same. |
| **Partial (emoji glyph fails to render)** | Fallback text label "Love" / "Fire" / "Watching" / "Haha" renders inside the button using `a.text_sm a.font_semibold`. This covers older Android devices without the glyph. | Same. |

### 3c. Accessible Picker Dialog (screen-reader + keyboard fallback)

| State | Native (bottom sheet) | Web (centered modal) |
|---|---|---|
| **Loading** | Dialog content shows a `<Loader />` centered while mutation in flight. | Same. |
| **Empty** | Always 4 options. | Same. |
| **Populated** | `Dialog.Outer` → `Dialog.Handle` → `Dialog.ScrollableInner` with `Dialog.Header` "React to post". Body: a vertical list of 4 `ToggleButton` rows, each with the emoji glyph + translated label + checkmark if selected. A fifth row "Remove reaction" appears iff the user currently has one. | `Dialog.Outer` with `Dialog.Close` (X) in the top-left. Same body layout. |
| **Error** | Inline error message under the list, red text `t.palette.negative_500`, plus a retry action. | Same. |
| **Offline** | Dialog closes optimistically; Toast confirms "Reaction saved". | Same. |

---

## 4. Component Inventory

**Existing, reused as-is:**
- `Dialog.Outer`, `Dialog.Handle`, `Dialog.ScrollableInner`, `Dialog.Header`, `Dialog.HeaderText`, `Dialog.Close` — for the accessible picker (`src/components/Dialog/`).
- `Button`, `ButtonIcon`, `ButtonText` — for the web hover trigger and dialog actions (`src/components/Button.tsx`).
- `Text`, typography system — for the fallback labels (`src/components/Typography.tsx`).
- `Toast.show` — for error and offline confirmations (`src/components/Toast/`).
- `Skele.Pill` — for loading placeholder (`src/components/Skeleton.tsx`).
- `ToggleButton` — used inside the picker dialog (if the existing one does not fit, the picker can use plain `Button` rows with `role=radio`; see open questions in §12).
- `useHaptics` — for native haptic patterns (`src/lib/haptics.ts`).
- `useRequireAuth` — logged-out gating (`src/state/session`).
- `useAnalytics` — event logging.
- `ContextMenu` primitives from `src/components/ContextMenu/` — the native long-press + measurement + Reanimated patterns here are the right reference; we do **not** reuse it wholesale because the reaction bar is a different shape and does not need the full menu contract, but the gesture detection module and `captureRef` pattern are reusable.

**New components (v0):**

| Component | Purpose | Rough API |
|---|---|---|
| `QuickReactBar` (native) | Floating bar opened by long-press over a post. Owns the gesture, haptics, and commit. | `<QuickReactBar postUri currentReaction onReact onRemove anchorMeasurement />` |
| `QuickReactPopover` (web) | Floating picker opened by hover/click/keyboard on the trigger. | `<QuickReactPopover control postUri currentReaction onReact onRemove />` |
| `QuickReactTrigger` (web) | The hover-reveal smiley-plus icon in `PostControls`. | `<QuickReactTrigger postUri onOpen />` |
| `ReactionChip` | Persistent chip showing user's reaction + same-emoji count in `PostControls`. | `<ReactionChip emoji count onPress onLongPress />` |
| `QuickReactPickerDialog` | Accessible fallback picker (screen reader / keyboard / "more" tap). | `<QuickReactPickerDialog control currentReaction onReact onRemove />` |
| `useQuickReactMutationQueue` | Optimistic queue analogous to `usePostLikeMutationQueue`. | Hook. (Owned by "coder" — flagged here because UX assumes its existence.) |

**Rule enforced:** we reuse `Dialog` for the accessible picker rather than inventing a new modal. We reuse `PostControls` layout rather than introducing a second action row.

---

## 5. Interaction Patterns

### Native gesture model (iOS + Android)

- **Target:** the post card body. Implemented as a `Gesture.LongPress()` on the outermost post content view (above `PostControls` — the gesture does **not** cover the action row, so Like/Reply/etc. keep their normal tap).
- **Activation duration:** 350 ms. Matches current context-menu long-press feel.
- **Max pointer movement before activation:** 10 logical px (`maxDistance: 10`). Beyond this we treat it as a scroll and cancel.
- **Scroll collision:** While the gesture is below the activation threshold, `requireExternalGestureToFail` on the FlatList scroll gesture so a scroll attempt wins. After activation, the post card freezes scroll.
- **Haptic cadence:**
  - t=0: none.
  - t=150 ms: light impact (`useHaptics(/*intensity*/ 'light')`) as an "arming" cue.
  - t=350 ms (activation): medium impact.
  - On emoji hover inside the bar: selection tick (`selectionAsync` equivalent).
  - On commit: light impact.
  - On cancel: no haptic (or a single soft tick to acknowledge).
- **Slide-to-pick (drag):** from the long-press origin, the user can keep pressing and slide up into the bar to pick an emoji without lifting. Lifting outside any emoji cancels.
- **Tap-to-pick (post-activation):** after the bar appears the user may also lift their finger first, then tap a single emoji. The bar auto-dismisses after 4 s of inactivity or on tap outside.
- **Conflict resolution with existing post long-press (e.g. context menu on media/link):** if the long-press originates on an embed that has its own context menu (image, external link card), the embed's menu wins. The quick-react bar is specifically attached to the **text body** of the post. Decision rule: `QuickReactBar` gesture is `Gesture.Simultaneous(…).requireExternalGestureToFail(embedContextMenuGesture)` — embed context menus take priority.

### Web interaction model

- **Primary trigger:** the hover-revealed smiley-plus `QuickReactTrigger` in the action row. On hover of the **post card** (not just the trigger), opacity transitions from 0 → 1 over 120 ms. On pointer leave it returns to 0 over 200 ms.
- **Keyboard trigger:** the trigger is a real focusable `Button` with `aria-label={_(msg\`React to post\`)}`. Tab order places it immediately after Like. Enter/Space opens the popover.
- **Right-click:** not used for v0 (avoids collision with browser's native context menu and with any future app context menu).
- **Hover intent delay:** 120 ms to prevent flicker when the cursor grazes the card.
- **Popover dismiss:** click outside, Escape key, or selecting an emoji.
- **Mouse-only users without hover capability (touch laptops):** the action row always has a visible `QuickReactTrigger` on coarse-pointer viewports (`@media (hover: none) { opacity: 1 }`).

### Change / remove reaction

- **Native, user has a reaction:** long-press again → bar opens with the current emoji highlighted. Picking the same one clears it; picking a different one swaps. Additionally, tapping the persistent `ReactionChip` acts as a shortcut: single tap clears (with a confirmation Toast including an "Undo" action, 5 s window). Long-pressing the chip re-opens the bar.
- **Web, user has a reaction:** the hover trigger is visually replaced by the `ReactionChip`. Clicking the chip opens the popover with the current emoji highlighted. A dedicated "Remove reaction" row appears at the bottom of the popover.
- **Accessible path, user has a reaction:** the picker dialog shows a "Remove reaction" row at the bottom with icon `Trash`.

### Pull-to-refresh / other gestures

- Reactions do not affect pull-to-refresh. The long-press gesture is on the post card, not on the scroll view.

---

## 6. Navigation Flow

No new routes. All interactions happen within the existing feed/thread screens.

- **Enter:** user is already on the feed or thread. No deep link.
- **Exit:** dismissing the bar / popover / dialog returns to the same screen with identical scroll position.
- **Dialog closing callbacks:** per `CLAUDE.md` footgun, any state changes scheduled after closing the picker dialog (e.g. opening a login prompt for logged-out users) use `control.close(() => ...)`.

---

## 7. Copy Deck

All strings wrapped in Lingui (`msg` for imperative, `<Trans>` for JSX). Short keys; translators get full context from surrounding Dialog header.

| Key / use | Source string | Notes |
|---|---|---|
| Trigger aria-label (web) | `msg\`React to post\`` | Screen-reader name for the smiley-plus button. |
| Bar container a11y label | `msg\`Reactions\`` | Landmark/region label on the floating bar. |
| Emoji "love" | `msg\`Love\`` | Label for ❤️. Used as tooltip and SR label. |
| Emoji "fire" | `msg\`Fire\`` | Label for 🔥. |
| Emoji "eyes" | `msg\`Watching\`` | Label for 👀. "Watching" reads more clearly than "eyes" for SR users. |
| Emoji "laugh" | `msg\`Haha\`` | Label for 😂. |
| Remove row | `msg\`Remove reaction\`` | In the dialog + popover. |
| Chip a11y label (with count) | `plural(count, { one: '# person reacted with ${label}', other: '# people reacted with ${label}' })` | E.g. "3 people reacted with Love". |
| Dialog title | `msg\`React to post\`` | `Dialog.HeaderText`. |
| Dialog description (visually hidden but read by SR) | `msg\`Choose a reaction to add to this post. You can remove or change it later.\`` | Description prop on Dialog.Outer. |
| Toast: success add | `msg\`Reacted with ${label}\`` | After commit. |
| Toast: success remove | `msg\`Reaction removed\`` | With optional "Undo" action. |
| Toast: error generic | `msg\`Couldn't react. Try again.\`` | Non-network error. |
| Toast: error deleted post | `msg\`This post was deleted\`` | When the write 404s. |
| Toast: offline queued | `msg\`Reaction saved. Will sync when online.\`` | Uses existing offline queue copy where available. |
| Login prompt | (reused) | Whatever `useRequireAuth()` already shows. |

**i18n notes for translators:**
- "Watching" vs "Eyes": translators may need to pick whichever idiom maps to 👀 in their language.
- German labels may be ~30 % longer — the bar must not truncate; if necessary the dialog rows can wrap.
- CJK labels are typically shorter; tooltip chip widths should be flexible (`minWidth: 48`, `maxWidth: 140`).
- All emoji labels are **localizable** — they are not the Unicode CLDR emoji names verbatim.

---

## 8. Iconography

| Use | Icon | Source |
|---|---|---|
| Web hover trigger | `FaceSmilePlus` or similar "react" glyph | Likely doesn't exist yet; falls back to `Plus` inside a smiley circle, or add one to `src/components/icons/`. If no ready-made icon, start with the literal ❤️ from the set as a starter emoji with a "+" badge. |
| Remove reaction row | `Trash` | Existing `src/components/icons/Trash`. |
| Loading | `Loader` | Existing. |

No directional icons → **no RTL mirroring needed** for icons. The emoji glyphs are not mirrored.

---

## 9. Animation & Motion

All animations defined with Reanimated on native and CSS/framer-style transitions on web. All respect `AccessibilityInfo.isReduceMotionEnabled()` / `prefers-reduced-motion`.

### Bar entry (native)

- Translate Y from `+8` → `0` and opacity `0` → `1`, spring `{damping: 18, stiffness: 220}`.
- Duration effective ~180 ms.
- Reduced motion: skip translate, 80 ms opacity fade only.

### Bar exit (native)

- Opacity `1` → `0` over 120 ms, translateY `0` → `+4`.
- Reduced motion: 80 ms opacity only.

### Emoji hover peek (native)

- Target emoji scales `1` → `1.25`, neighbor emoji scale `0.95`, over 100 ms spring.
- Reduced motion: no scale; instead an outline ring appears.

### Popover (web)

- `opacity` + `transform: translateY(-4px) → 0` over 120 ms, `cubic-bezier(0.2, 0, 0, 1)`.
- Reduced motion: opacity only.

### Chip commit pulse

- On commit, chip scales `1 → 1.1 → 1` over 180 ms with a soft haptic on native.
- Reduced motion: a single color pulse of the border (`t.palette.primary_500` → `t.palette.primary_300` → original) with no scale.

### Count roll

- Existing `CountWheel` is **not reused for v0** (count format in chip is a plain number; CountWheel is like-specific). If the same animation is desired, revisit in v1.

---

## 10. Theming

All colors resolved through `useTheme()`. No hex literals.

| Element | Light | Dark |
|---|---|---|
| Bar container bg | `t.atoms.bg_contrast_25` | `t.atoms.bg_contrast_25` |
| Bar container shadow | `platform({ios: {shadowOpacity: 0.12}, android: {elevation: 8}, web: a.shadow_md})` | Same opacity / elevation; on dark the shadow is barely visible, which is correct. |
| Bar emoji selected ring | `t.palette.primary_500` | `t.palette.primary_500` |
| Chip bg (has reaction) | `t.palette.primary_50` | `t.palette.primary_975` |
| Chip border | `t.palette.primary_500` at 1px | same |
| Chip text | `t.atoms.text` | `t.atoms.text` |
| Web hover trigger default | `t.atoms.text_contrast_medium` | `t.atoms.text_contrast_medium` |
| Web hover trigger hover | `t.atoms.text` | `t.atoms.text` |
| Dialog separator | `t.atoms.border_contrast_low` | `t.atoms.border_contrast_low` |
| Error text | `t.palette.negative_500` | `t.palette.negative_400` |

All tested in both themes. Contrast spot-checks (see §11) confirm WCAG AA.

---

## 11. Accessibility Specification (Mandatory)

### Screen reader

- Post card already has an `accessibilityLabel` describing the post. We **do not** add the reaction gesture as part of that label (gestures are inaccessible to VoiceOver/TalkBack).
- We add a standard `accessibilityAction` of name `react` and localized label `msg\`React to post\`` to the post card. On iOS VoiceOver this shows up in the rotor / custom-actions menu; on Android TalkBack in the local context menu. Selecting it opens `QuickReactPickerDialog`.
- Additionally the persistent `ReactionChip` (when the user has reacted) is a focusable element with label `msg\`Your reaction: ${emojiLabel}. Activate to change or remove.\``.
- On web, the smiley-plus trigger is always in the DOM (opacity-hidden when not hovered) with `aria-label={_(msg\`React to post\`)}`. It is a real `<button>`. The popover uses `role="dialog"` `aria-modal="false"` `aria-label="Reactions"` with each emoji as a `<button role="menuitemradio">` and `aria-checked` reflecting current state.
- The picker dialog uses existing `Dialog` a11y (it already sets `accessibilityViewIsModal` on native and `role=dialog` + focus trap on web).

### Focus order (web)

Within a post card the focus order is:
1. Author handle
2. Post body (if it has focusable content: links, hashtags, media)
3. Reply
4. Repost
5. Like
6. **Quick-React trigger** (new)
7. Bookmark
8. Share
9. More menu

Within the popover: each emoji button in visual order, then "Remove reaction" (if present), then an implicit close action via Escape.

### Dynamic Type / large text

- All text labels in the picker dialog use the theme's type system (`a.text_md`), which scales with `allowFontScaling`.
- Emoji glyphs do not scale by OS text setting (they are rendered as text but usually clamp); we set `allowFontScaling` and cap at 1.3× via `maxFontSizeMultiplier={1.3}` so that 200 % dynamic type does not blow out the 36 × 36 button.
- At the largest supported setting, the bar container wraps to two rows on very narrow phones (< 320 logical px wide). Confirm in QA.

### Reduced motion

- See §9 for per-animation fallbacks.
- Reduced motion **does not** disable the haptic on native — haptics are non-visual and are a helpful redundancy.

### Hit targets

- Every emoji button: 44 × 44 logical px hit box (via `hitSlop={HITSLOP_10}` on a 36 × 36 visual, giving at least 56 × 56 effective).
- Web trigger button: 32 × 32 visual, `padding: 6` to reach 44 × 44.
- Picker dialog rows: 48 px tall each.
- `ReactionChip`: minimum 44 × 32, `hitSlop={HITSLOP_10}`.

### Color contrast (WCAG AA)

- Chip text on `primary_50` bg: `t.atoms.text` resolves to near-black in light; AA-passes. In dark, `text` on `primary_975` also passes.
- Error text uses `negative_500` (light) / `negative_400` (dark) — both pass AA against page bg.
- Selected ring on the bar: `primary_500` on `bg_contrast_25` — passes AA for 3:1 non-text contrast.

### RTL support

- The bar's emoji order is a culturally-ordered preference ranking, not a reading-direction list. **Emoji order is NOT mirrored under RTL.** ❤️ 🔥 👀 😂 remains the canonical order in Arabic/Hebrew.
- The bar's position relative to the action row is unchanged (always above the action row, centered on long-press origin).
- The web popover flips its anchor/arrow correctly under `I18nManager.isRTL` / CSS `direction: rtl`.
- The picker dialog vertical list is unaffected by RTL.
- Icon for "Remove reaction" (Trash) is not directional, so not mirrored.

### Gesture-gated action trap mitigation

Per the spec §Risks, a gesture-only primary action is an a11y anti-pattern. Mitigation is explicit:
- Screen readers and keyboard users have the **picker dialog** as a first-class path, not a fallback.
- Automated tests (coder's concern, noted here) should assert that the `react` accessibility action exists on every post card.

---

## 12. Open UX Questions / Out of Scope

### Unresolved (flag to PM)

1. **Aggregate display model.** Do we show *only* the user's own reaction on the chip, or stacked emoji + total count (Slack/iMessage style)? This spec assumes "only the user's reaction with its per-emoji count"; a stacked bar is v1.
2. **Count scope.** Is `count` in the chip the count of users who reacted with the **same emoji**, or the total reactions regardless of emoji? This spec assumes same-emoji.
3. **Undo window.** 5 s Toast-undo is chosen for remove; confirm with product.
4. **Tooltip label on native bar.** Shown above the hovered emoji — is the copy "Love / Fire / Watching / Haha" final?
5. **Third reactor perspective.** How does viewer A see viewer B's reaction in v0? This is a spec question, not a UX-only one — assumed invisible until aggregate display lands.

### Explicitly out of scope for v0 (documented to prevent scope creep)

- Custom emoji picker or full Unicode keyboard access.
- Per-user emoji set customization.
- Reaction stickers, animated reactions, Lottie.
- Reactions on comments / replies as a distinct surface treatment (replies are posts in v0 and will inherit the same gesture; but reactions inside DMs are out).
- Reactions in notifications (both as a reason and as a surface).
- Reactions on quote-post embeds.
- "Who reacted" viewer screen (analog of `PostLikedBy`).
- Reactions in the lightbox / media viewer.
- Right-click context menu as a trigger on web.
- Integration with existing post context menu on native media embeds.
- CountWheel-style animated count roll.
- Replacing / merging with the Like button.
- Notifying the author when someone reacts.
- Federation / appview compat visuals.
- Statsig gating UX (assumed to be transparent to the user; no UI).

---

## 13. UX Acceptance Criteria (Testable)

Each criterion is written to be executable by a human QA or — where reasonable — an e2e test.

### Gesture & trigger

1. **AC-G1 (iOS, Android):** Long-pressing the body of a post in the feed for ≥ 350 ms opens the Quick-React Bar above the post's action row within 200 ms of activation.
2. **AC-G2 (iOS, Android):** Long-pressing for < 350 ms then lifting does NOT open the bar and does NOT fire a reaction.
3. **AC-G3 (iOS, Android):** At ~150 ms into the press a light haptic fires; at activation a medium haptic fires; on commit a light haptic fires. Haptics are suppressed if the OS haptics setting is off.
4. **AC-G4 (iOS, Android):** A vertical scroll gesture that starts on a post does NOT trigger the bar.
5. **AC-G5 (iOS, Android):** Long-pressing on an image embed opens the embed's existing context menu, not the reaction bar.
6. **AC-G6 (Web):** On pointer hover over a post card, the Quick-React trigger fades in within 200 ms; on pointer leave it fades out within 300 ms.
7. **AC-G7 (Web):** The Quick-React trigger is reachable via Tab after the Like button; Enter/Space opens the popover.
8. **AC-G8 (Web):** Escape or click-outside dismisses the popover without committing.

### Selection & commit

9. **AC-S1:** Selecting any of ❤️/🔥/👀/😂 optimistically shows a `ReactionChip` within 16 ms (next frame) of release.
10. **AC-S2:** If the server write fails (non-network), the chip reverts within 2 s and a Toast "Couldn't react. Try again." appears.
11. **AC-S3:** If the server write fails because the post was deleted, the chip reverts and the post card enters its standard "deleted post" state; no chip is shown.
12. **AC-S4:** While offline, selecting a reaction still shows the chip and queues the write; the queue drains on reconnect.
13. **AC-S5:** Selecting a second emoji while a first is pending does not produce two writes; the final commit is the last-selected emoji.

### Change & remove

14. **AC-C1:** Re-opening the bar when the user already has a reaction highlights the current emoji with a `primary_500` ring.
15. **AC-C2:** Tapping the same emoji as the current reaction clears it.
16. **AC-C3:** Tapping a different emoji swaps the reaction in a single network call (not remove + add).
17. **AC-C4:** On web, the "Remove reaction" row in the popover appears iff the user has a reaction, and clearing it closes the popover.

### Accessibility

18. **AC-A1:** Every post card exposes an accessibility action named "react" with label `"React to post"` (localized). Invoking it via VoiceOver/TalkBack rotor opens the picker dialog.
19. **AC-A2:** The picker dialog announces its title "React to post" on open and traps focus.
20. **AC-A3:** Keyboard-only web users can complete a reaction using Tab → Enter → Arrow keys → Enter.
21. **AC-A4:** With `prefers-reduced-motion: reduce` (web) or OS reduce-motion (native), the bar/popover open/close uses only opacity fades; no translate or scale animations play.
22. **AC-A5:** All emoji buttons have accessible names equal to their translated label ("Love", "Fire", "Watching", "Haha").
23. **AC-A6:** The persistent `ReactionChip` exposes an accessible name of the form "Your reaction: Love. Activate to change or remove.".
24. **AC-A7:** All interactive elements have a hit box of at least 44 × 44 logical px.
25. **AC-A8:** Body text contrast in chip, bar, and dialog passes WCAG AA (4.5:1) in both light and dark themes.

### i18n / RTL

26. **AC-I1:** Under RTL (Arabic, Hebrew locales), the bar's emoji order remains ❤️ 🔥 👀 😂 left-to-right and the bar horizontally centers on long-press origin (not mirrored).
27. **AC-I2:** Under RTL, the picker dialog's list items render with text right-aligned (inherited from `I18nManager`), and the selection checkmark flips to the left side.
28. **AC-I3:** All user-facing strings are wrapped with `msg\`…\`` / `<Trans>` and appear in the extracted `.po` files after `yarn intl:extract`.

### Theming

29. **AC-T1:** The bar, popover, chip, and dialog render with only `useTheme()` tokens (visually verified by theme toggle; no hex or rgba literals in the implementation).
30. **AC-T2:** Switching theme while the bar is open does not visually desync (bar rebuilds against the new theme).

### Surfaces

31. **AC-V1:** The gesture and trigger are available on feed items and on thread posts (both focused and replies), and NOT on notifications, quote-post embeds, or DMs.

### Auth

32. **AC-U1:** Triggering the gesture / clicking the trigger while logged out opens the sign-in prompt (`useRequireAuth()`) and does NOT optimistically show a reaction.

---

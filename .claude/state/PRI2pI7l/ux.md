# UX Design — Quick-react bar on posts (PRI2pI7l)

> Source ticket: `/Users/Alyona_Yanuchek/AIProjects/ticket-to-deliver2/social-app/.claude/state/PRI2pI7l/ticket.json`
> Spec: `/Users/Alyona_Yanuchek/AIProjects/ticket-to-deliver2/social-app/.claude/state/PRI2pI7l/spec.md`
> AC coverage: all 18 AC addressed below; each section cross-references the AC it satisfies.

This document describes the *experience* of the Quick-react feature. It does not specify data layer, endpoint shape, or internal state machines — those belong to the architect. The designer's job is to make the interaction feel native on each platform, fully accessible, and completely invisible when the flag is OFF.

Emoji set (fixed for v0): `heart` ❤️, `fire` 🔥, `eyes` 👀, `joy` 😂. Order is left-to-right in LTR locales; mirrored in RTL (AC-14). Labels are localized (AC-13).

---

## 1. User Journey

### 1.1 Happy path — native, long-press (AC-4, AC-5, AC-9, AC-16)

1. User scrolls the home feed. Post body (author block + text content area) of a `PostFeedItem` is in view. No new affordance is visible on the post — discovery is gesture-driven, matching iMessage Tapback precedent.
2. User presses and holds on the post body for ≥400 ms.
3. At ≈350 ms the post card lightly dims (opacity 0.92) to preview the activating press; at 400 ms the post card is "held" and the reaction bar springs up immediately above the post (or below, if space-constrained — see §8).
4. A single selection-type haptic fires at bar-open (subtle, distinct from the lighter selection haptic on confirm).
5. Without lifting, the user drags their finger across the four emoji. As each emoji is crossed, it scales up to 1.15× (emoji under-finger) while neighbors return to 1.0×. This is the "scrubbing" affordance.
6. User releases on one of the emoji.
7. A light-impact haptic fires (AC-5, via `src/lib/haptics.ts` → `useHaptics('Light')`).
8. Bar dismisses with a 120 ms fade/scale-down. Within 100 ms of release, a chip appears inline in the post controls row showing the selected emoji (AC-9, AC-16).
9. Request is debounced 2 s (AC-17); if the user long-presses again within 2 s and picks a different emoji, the chip updates optimistically and only the final selection is written.

### 1.2 Happy path — web, hover + click (AC-6, AC-7)

1. Pointer enters a `PostFeedItem`. After 200 ms of sustained hover anywhere on the post card, a small "React" button fades in at the leading edge of the post controls row (same row as Reply/Repost/Like/Share; see §3 for position).
2. Pointer leaves the card → button fades out after 150 ms (prevents flicker).
3. User clicks the React button. Popover opens anchored to the button, 4 emoji in a row. Focus moves to the first emoji (see §1.4 for keyboard).
4. User clicks an emoji. Popover dismisses; chip appears in post controls row.
5. Outside click or Escape dismisses the popover without selecting (AC-6).

### 1.3 Change / remove (AC-2)

- **Change**: user re-opens the bar, picks a different emoji. Chip updates to the new emoji. One debounced write fires 2 s after the last change (AC-17).
- **Remove**: user re-opens the bar and taps/releases on the *currently selected* emoji. The chip animates out (opacity + width collapse). This path is discoverable because the currently selected emoji is visually distinguished in the bar (see §2.5).

### 1.4 Screen-reader / keyboard journey (AC-11, AC-7)

- **Screen reader (native VoiceOver / TalkBack)**: when focus lands on a post, the user hears the existing post announcement. A custom accessibility action "React to post" is exposed alongside existing actions (Like, Reply, Repost). Activating the action opens an **accessible picker** (a standard `Dialog.Outer` bottom sheet on native, see §5) rather than the visual long-press bar. This is the canonical a11y entry point — not an afterthought.
- **Web keyboard**: Tab order is `… → React button → Like → Repost → Reply → Share → …` within the post's controls. `Enter` or `Space` on the React button opens a popover; focus lands on the first emoji option. `ArrowRight`/`ArrowLeft` (mirrored in RTL) moves focus between emoji. `Enter` / `Space` selects. `Escape` closes. Focus returns to the React button on close.

### 1.5 Failure & offline path (AC-16)

1. User selects ❤️. Chip appears instantly (within 100 ms).
2. Debounced request fires 2 s later; network is down or server errors (non-2xx).
3. Chip reverts (animates back out with the same exit animation as the remove path).
4. A non-blocking toast appears: "Couldn't save reaction" via `src/components/Toast`. No retry button, no persistent banner, no blocking modal.
5. User's next interaction fires a fresh request; no background retry loop.

### 1.6 Flag-off path (AC-15)

- When `quick_reactions_v0` flag is OFF (default): the long-press gesture does nothing (existing behavior unchanged), the web hover React button never renders, the "React to post" a11y action is absent from post actions, and no related network or analytics call is made. The feature is invisible.
- Runtime flag flip: when the flag flips ON while the app is running, the affordances activate on the next render of a `PostFeedItem`. No reinstall or cold start required.

---

## 2. Screen Inventory & Bar Anatomy

### 2.1 Affected surfaces (AC-8)

**In scope** (feature renders here when flag is ON):
- `PostFeedItem` at `/Users/Alyona_Yanuchek/AIProjects/ticket-to-deliver2/social-app/src/view/com/posts/PostFeedItem.tsx`
- Thread post component(s) — specific component to be pinned by the architect (likely `src/view/com/post-thread/*`)

**Explicitly excluded**:
- Quote embeds
- Search result previews
- Notification list items
- Feed generator previews
- Profile screens, lists, DMs, composer/reply flow

### 2.2 Component inventory

| Component | Source | Status |
| --- | --- | --- |
| `Dialog.Outer` / `Dialog.ScrollableInner` | `src/components/Dialog` | **Reuse** — used for the screen-reader accessible picker (§5) |
| `Menu.*` primitives | `src/components/Menu` | **Consider** for web popover — shares outside-click and Escape handling |
| `Button`, `ButtonIcon`, `ButtonText` | `src/components/Button` | **Reuse** for the web React button and the Done button in the a11y picker |
| `Toast` | `src/components/Toast` | **Reuse** for the failure toast (§1.5) |
| `Text`, `Trans` / `msg` | `src/components/Typography`, `@lingui` | **Reuse** for all labels |
| `useHaptics` | `src/lib/haptics.ts` | **Reuse** for selection haptic (AC-5) |
| `Emoji` icon | `src/components/icons/Emoji.tsx` | **Reuse** for the web React button glyph |
| `PostControls` row | `src/components/PostControls/index.tsx` | **Modify** — add chip slot and (web) React button |
| `QuickReactBar` | NEW | Native long-press bar (overlay + emoji row) |
| `QuickReactPopover` | NEW (web) | Hover/click popover; thin wrapper around `Menu` or a Popover primitive |
| `QuickReactPicker` | NEW (a11y) | Dialog-based picker for screen reader users (§5) |
| `QuickReactChip` | NEW | Chip showing viewer's selected emoji inline with `PostControls` |

> Rule: reuse before inventing. The three `QuickReact*` components are genuinely new — no existing component offers a press-and-hold emoji scrubber or an inline chip tied to a single post.

### 2.3 Bar anatomy — native (`QuickReactBar`)

- **Position**: floats above the post card, horizontally centered on the initial touch point, offset −12 px vertically so it sits just above the content. Flips below the post when the touch point is within 120 px of the top of the screen (§8).
- **Container**: rounded pill. `a.rounded_full`, padding `a.px_md` / `a.py_sm`. Elevation via a subtle drop shadow on web; native uses `t.atoms.shadow_md` pattern if available, otherwise a semi-opaque background with a 1-px border `t.atoms.border_contrast_low`.
- **Background**: `t.atoms.bg` (opaque; must be opaque to read against any post/media content behind it). Border: `t.atoms.border_contrast_low`.
- **Size**: emoji tap targets are 44×44 pt each (hit target minimum), visually rendered as 32-pt emoji glyphs centered in 44-pt touch regions. Spacing between emoji: `a.gap_sm` (8 pt). Total bar width ≈ 4 × 44 + 3 × 8 + 2 × 16 = 224 pt. Height: 56 pt.
- **Entrance animation** (default): scale 0.8 → 1.0 + opacity 0 → 1 over 180 ms, ease-out. Emoji stagger: each emoji fades in 20 ms after the previous.
- **Entrance animation** (reduced motion, AC-12): instant opacity 0 → 1 over 100 ms. No scale, no stagger, no translate.
- **Scrub highlight**: the emoji currently under the finger scales to 1.15× (reduced-motion: instead, draw a 1-pt `t.palette.primary_500` ring around the hovered emoji).
- **Exit animation** (default): scale 1.0 → 0.8 + opacity 1 → 0 over 120 ms, ease-in.
- **Exit animation** (reduced motion): opacity 1 → 0 over 100 ms.

### 2.4 Bar anatomy — web (`QuickReactPopover`)

- **Anchor**: the "React" button at the leading edge of the `PostControls` row. In RTL, the popover anchors from the mirrored edge (AC-14).
- **Container**: rounded pill popover, same visual language as native bar — `a.rounded_full`, `a.px_md`, `a.py_sm`, `t.atoms.bg`, 1-pt `t.atoms.border_contrast_low`, subtle drop shadow via `web({boxShadow: '...'})`.
- **Size**: same 4-emoji layout, but 36-pt glyphs with 32-pt targets (web standard — mouse is more precise than finger). Keyboard/touch still gets 44-pt hit region via extended padding.
- **Animation**: same opacity-only fallback under `prefers-reduced-motion`.
- **Dismissal**: outside click, Escape, route change, or selecting an emoji.
- **Hover delay**: 200 ms sustained hover to reveal the React button (not the popover — the popover only opens on click). Button fade-out delay: 150 ms after pointer leaves, to tolerate small pointer excursions.

### 2.5 Selected-state rendering inside the bar

When the viewer has an existing reaction on this post, opening the bar pre-highlights that emoji:
- Background behind the selected emoji: `t.palette.primary_50` circle (light theme) / `t.palette.primary_900` with lower alpha (dark theme), inscribed in the 44-pt hit region.
- `accessibilityState={{selected: true}}` on that emoji so screen readers announce "selected".
- Releasing / clicking the selected emoji is the **remove** gesture (AC-2). The picker announces "Removes reaction" as the accessibility hint on the selected emoji.

---

## 3. Chip Rendering — `QuickReactChip`

### 3.1 What the chip shows (AC-9, AC-10)

- Just the viewer's chosen emoji — **no count**, **no other-user reactions**, **no reacted-by indicator** in v0.
- The chip's presence alone communicates "you reacted with X". A long-press on the chip (native) or click (web/keyboard) reopens the bar so the user can change or remove.

### 3.2 Position relative to existing action row

The current `PostControls` row renders (roughly, LTR): Reply · Repost · Like · Bookmark · Share. The chip renders **inline, at the trailing edge of the controls row**, before Share but after Like/Bookmark. It participates in the same flex row so horizontal spacing stays consistent with existing buttons. In RTL, it mirrors (AC-14).

Rationale:
- Placing it next to Like makes the "reaction is independent of Like" (AC-3) visually explicit — they are adjacent and visually distinct (chip = emoji tinted background; Like = heart icon button).
- Trailing position means the chip does not shift the positions of primary actions when it appears/disappears, which preserves motor memory for frequent users.

### 3.3 Chip visual spec

- Shape: pill, `a.rounded_full`.
- Padding: `a.px_sm` / `a.py_2xs`.
- Background: `t.palette.primary_25` (light) / `t.palette.primary_975` (dark) — a *subtle* tint that distinguishes it from the Like button without shouting.
- Emoji size: 16 pt glyph; chip height matches existing control icons (≈ 24 pt total).
- No text label visible (AC-10: no counts). Screen-reader label is localized: `_(msg\`Reacted with fire, double-tap to change or remove\`)` etc.
- Hit target: minimum 44×44 pt by extending invisible padding when rendered size is smaller.

### 3.4 Chip entrance/exit

- **Entrance** (default): width expands from 0 to full with a spring (stiffness 180); emoji scales 0.6 → 1.0. 160 ms total.
- **Entrance** (reduced motion): opacity 0 → 1 over 100 ms, no width animation — chip is rendered at full width from the start and simply fades.
- **Exit** (remove): symmetric collapse. Reduced motion: fade-out.
- **Change** (emoji → different emoji): the existing emoji swaps via cross-fade (80 ms out, 80 ms in); chip width does not change.

---

## 4. Interaction Patterns

### 4.1 Native long-press (AC-4, iOS + Android)

- **Trigger**: `LongPressGestureHandler` with `minDurationMs={400}`. Use `react-native-gesture-handler` to avoid conflicts with the existing feed scroll `PanGestureHandler`.
- **Gesture target**: the **post body** — the author block + text content container. Explicitly *not*:
  - Embedded images (would conflict with the image viewer / lightbox open gesture)
  - Embedded link cards (would conflict with link open)
  - Quote embeds (would conflict with navigating to the quoted post)
  - Action row buttons (would conflict with their own long-press menus, e.g., bookmark/share)
  - Author avatar (would conflict with profile navigation)
- **Conflict resolution**: `waitFor` / `simultaneousHandlers` is the architect's call; the UX requirement is that long-press on media opens the media viewer, and long-press on text/metadata opens the react bar. If a user long-presses on the post while text is selectable (web only), the react bar does not open (text-selection wins on web; long-press on web is not the documented trigger anyway — see §4.2).
- **Threshold**: 400 ms (AC-4). Below that, the gesture is treated as a tap (navigates to the post detail per existing behavior).
- **On-press visual feedback** (~350 ms): post card background shifts to `t.atoms.bg_contrast_25` or opacity 0.92 to preview activation. User can cancel by releasing before 400 ms.
- **Release on emoji**: fires selection (AC-4).
- **Release off-target**: dismisses the bar, no selection (AC-4). Includes release above/below the bar and release back on the post body.
- **Drag-to-scrub**: the same finger can drag laterally after the bar opens; whichever emoji the finger is over when released is selected. This matches iMessage Tapback.

### 4.2 Web hover + click (AC-6)

- **Primary path**: mouse hovers post card → after 200 ms sustained hover, React button fades in → user clicks → popover opens.
- **Long-press on web**: not a documented trigger. Not implemented.
- **Touch-capable web** (iPad Safari, Chrome with touch, hybrid laptops): hover is unreliable. Fallback is **always-visible React button** on touch-web. Detection via pointer media queries: `web({'@media (hover: none)': {...always visible...}})`. This resolves the open question from `ac_check.json` for AC-6 in the affirmative for the always-visible option (simpler than porting long-press to web).

### 4.3 Web keyboard (AC-7)

- Tab enters the post; Tab moves through controls in reading order; React button is focusable.
- `Enter` or `Space` on React → popover opens, focus on first emoji.
- `ArrowRight` / `ArrowLeft` move focus between emoji. In RTL, `ArrowLeft` moves forward (AC-14).
- `Enter` or `Space` on a focused emoji → select, close, focus returns to React button.
- `Escape` → close, focus returns to React button.
- Focus trap while open; outside click closes (same as AC-6).

### 4.4 Tap / long-press on the chip

- **Native long-press on chip**: reopens the bar anchored to the chip. Same gesture semantics as long-press on post body.
- **Native tap on chip**: reopens the bar (chip is small enough that requiring a long-press is unnecessarily fussy).
- **Web click on chip**: opens popover anchored to the chip.
- **Web keyboard Enter/Space on chip**: opens popover, focus on the viewer's currently-selected emoji.

### 4.5 Pull-to-refresh / scroll

- Long-press must not interfere with vertical scroll. Gesture handler priority: `PanGestureHandler` (scroll) takes precedence until a 400 ms hold at nearly-zero translation is reached. Any vertical movement >8 pt before 400 ms cancels the long-press.
- While the bar is open, the underlying feed scroll is disabled.

---

## 5. Accessibility Picker (`QuickReactPicker`) — AC-11

When a screen reader is active, the long-press bar is **not** the a11y entry point. Instead:

### 5.1 Entry

- Every `PostFeedItem` and thread post exposes an additional `accessibilityAction` `{name: 'react', label: _(msg\`React to post\`)}` alongside existing actions.
- Activating this action (double-tap with VoiceOver rotor, or long-press in TalkBack actions menu) opens the `QuickReactPicker`.

### 5.2 Picker layout

- Implemented as a `Dialog.Outer` + `Dialog.ScrollableInner` on native (bottom sheet) and the same primitive on web (modal). Reuses existing focus management, Escape handling, and outside-click dismissal.
- Header: `Dialog.Header` with `Dialog.HeaderText` → `_(msg\`React to post\`)`.
- Body: a vertical list of four buttons, each row `a.flex_row`, `a.gap_md`, `a.py_md`:
  - 32-pt emoji glyph
  - Localized emoji label (e.g., `_(msg\`Heart\`)`, `_(msg\`Fire\`)`, `_(msg\`Eyes\`)`, `_(msg\`Tears of joy\`)`). Labels are Lingui-wrapped (AC-13).
- If the viewer has an existing reaction, that row shows:
  - Leading: emoji
  - Trailing: `CircleCheck` icon + label `_(msg\`Selected\`)`
  - Row's accessibility label concatenates "selected — double-tap to remove"
- A fifth row **"Remove reaction"** appears only when a reaction exists; it is redundant with re-tapping the selected emoji but makes removal explicit and discoverable for screen-reader users. Row label: `_(msg\`Remove reaction\`)` with the `Trash` or `CircleX` icon.
- Native uses `Dialog.Handle`; web uses `Dialog.Close` per CLAUDE.md platform pattern.

### 5.3 Dismiss + commit

- Selecting a row: close the dialog via `control.close(() => { writeReaction(emoji) })` — using the callback form per CLAUDE.md footgun note about post-close actions.
- Remove row: close via `control.close(() => { removeReaction() })`.
- Cancel (Handle drag, Close button, Escape, outside tap): close, no write.

### 5.4 Announcements

- On chip appearance: live-region announcement `_(msg\`Reacted with ${label}\`)`.
- On chip removal: `_(msg\`Reaction removed\`)`.
- On failure toast: the toast itself is announced via its existing live-region behavior in `src/components/Toast`.

---

## 6. State Matrix

Every screen-level state that the feature can put a post into.

### 6.1 `PostFeedItem` (and thread post) with flag ON

| State | What the user sees | Source of state |
| --- | --- | --- |
| **Loading** | No chip yet rendered; post controls row renders without change. The viewer's prior reaction may be loading; during that window there is no chip. | Query for viewer's existing reaction is `isPending`. |
| **Empty (no prior reaction)** | No chip. React button (web, on hover) or a11y action (everywhere) available. | Query resolved; no reaction record. |
| **Populated** | Chip showing viewer's emoji in the controls row. | Query resolved with emoji. |
| **Error (query)** | No chip, no toast. React action still works; first write will establish the record. Silent fallback — users shouldn't see an error for a read they didn't initiate. | Query error. |
| **Offline (read)** | No chip (no cache hit) or last-known chip (cache hit). No toast. | Network unavailable at fetch time. |
| **Partial** | Not applicable — reaction record is atomic (emoji code or nothing). | — |

### 6.2 Quick-react bar / popover

| State | What the user sees |
| --- | --- |
| **Loading** | Bar never enters a loading state — the emoji list is fixed and local. |
| **Empty** | Not applicable. |
| **Populated** | Four emoji, selected state on prior reaction if any. |
| **Error** | Bar itself does not show errors. Failures are on the write path and surface as a toast after the bar has closed. |
| **Offline** | Bar opens normally. User selects. Chip appears optimistically, then reverts when the write fails. Toast: `_(msg\`Couldn't save reaction\`)`. |
| **Partial** | Not applicable. |

### 6.3 `QuickReactChip`

| State | What the user sees |
| --- | --- |
| **Loading** | Not rendered. |
| **Empty** | Not rendered. |
| **Populated** | Emoji chip. |
| **Error (write)** | Chip appears optimistically, then animates out on failure, and toast appears. |
| **Offline** | Same as error state. |

### 6.4 Flag OFF

| State | What the user sees |
| --- | --- |
| All | Nothing about reactions is rendered or called (AC-15). Long-press on post body does nothing new (returns to default). Keyboard tab order does not include a React button. |

---

## 7. Navigation Flow

- The feature does not introduce any new screens or routes. Everything happens within the existing `PostFeedItem` and thread-post surfaces.
- The react bar / popover / picker is an **overlay**, not a navigation push. Back button (Android hardware), Escape (web), swipe-down (native bottom sheet picker), and outside tap dismiss the overlay without changing the route.
- No deep link opens a reaction picker. No share link encodes a reaction.
- The bar does not survive navigation away from the post (route change closes any open overlay).

---

## 8. Edge Cases

### 8.1 Post taller than screen

- If the post is taller than the viewport (long-form text, multiple images), the bar anchors to the touch point, not to the post as a whole. This avoids the bar rendering off-screen for tall posts.

### 8.2 Bar collision with top/bottom of screen

- If the touch point is within 120 pt of the **top** of the viewport, the bar flips to render **below** the touch point (pointing up).
- If within 120 pt of the **bottom** of the viewport (e.g., last post above the tab bar), the bar renders **above** the touch point (default).
- If within 120 pt of the **leading or trailing edge** horizontally, the bar clamps horizontally so all emoji remain on-screen with a ≥ 16-pt safe-area margin (`a.px_lg` equivalent).

### 8.3 Gesture conflict — long-press to select text (web)

- Web: long-press on text initiates text-selection. Because web uses hover+click rather than long-press, there is no conflict by design.

### 8.4 Gesture conflict — image viewer / link cards (native)

- Long-press on embedded images opens the image viewer (existing behavior, preserved).
- Long-press on link cards opens the link preview menu if present, or navigates (existing behavior, preserved).
- The react bar is only triggered by long-press on the *text/metadata* region. The architect must wire the gesture handler to a specific container that excludes media and link-card children.

### 8.5 Gesture conflict — scroll

- See §4.5. Any vertical movement >8 pt before 400 ms cancels the long-press. This guards against accidental activation while scrolling.

### 8.6 Double reaction race (AC-17)

- User long-presses, selects ❤️. Chip shows ❤️. Debounce timer T=2 s starts.
- User long-presses again at T=1 s, selects 🔥. Chip swap-animates to 🔥. Debounce timer resets to 2 s from T=1 s.
- At T=3 s, a single write fires with emoji=🔥. No intermediate request for ❤️ was ever sent (trailing-only debounce).

### 8.7 Flag flips OFF mid-interaction

- Bar is open when flag flips OFF: bar closes immediately on next render; no chip is written; no toast shown (silent teardown — users don't need to know about flag flips).
- Chip is rendered when flag flips OFF: chip disappears from the controls row on next render. Server-side record is not deleted (the chip may reappear if the flag flips back ON).

### 8.8 Flag is ON but user is signed out

- The feature is session-gated in addition to flag-gated. Signed-out users see no React button, no a11y action, no chip (reactions are per-DID; no DID, no reactions).

### 8.9 Post is deleted / hidden by moderation mid-interaction

- If the post is removed from the feed while the bar is open, the overlay dismisses with the post. No error, no toast. Any pending debounced write is cancelled.

### 8.10 RTL (AC-14)

- Bar renders emoji order: heart · fire · eyes · joy in LTR; reversed (joy · eyes · fire · heart) in RTL. Arrow keys mirror correspondingly on web.
- Popover anchor: on LTR, anchors at leading edge of controls row (left); on RTL, anchors at leading edge (right).
- Chip position within the controls row mirrors.

### 8.11 Dynamic Type / large text

- Emoji glyphs scale with system font-size setting, up to 200% (XXL). Bar height expands to accommodate larger glyphs; hit targets remain ≥ 44 pt.
- Chip text (if ever added — not in v0) would scale similarly. In v0, only the emoji glyph scales.
- If the scaled bar would exceed viewport width, emoji wrap to a 2×2 grid. Tested against the largest accessibility text size.

### 8.12 Accessible picker when no prior reaction

- Picker shows the four emoji rows only; no "Remove reaction" row. Cancel path is the normal dialog dismiss.

---

## 9. Motion & Haptics

### 9.1 Motion (AC-12)

Two animation profiles govern every motion in this feature:

| Motion | Default | Reduced motion (`prefers-reduced-motion` / `accessibilityReduceMotion`) |
| --- | --- | --- |
| Bar entrance | 180 ms scale + opacity, stagger per emoji | 100 ms opacity only, no stagger |
| Bar exit | 120 ms scale + opacity | 100 ms opacity only |
| Scrub highlight | 1.15× scale under finger | 1-pt `t.palette.primary_500` ring under finger |
| Chip entrance | 160 ms spring width + emoji scale | 100 ms opacity |
| Chip exit | 160 ms spring collapse | 100 ms opacity |
| Chip emoji swap | 80 ms cross-fade | 80 ms cross-fade (already opacity-only) |
| Web React button hover-in | 120 ms opacity | 120 ms opacity |
| Web React button hover-out | 150 ms opacity | 150 ms opacity |
| Popover open | 120 ms opacity + scale-from-anchor | 100 ms opacity |

Use ALF platform utilities to conditionally branch:

```
native(reducedMotion ? {...} : {...})
web({'@media (prefers-reduced-motion: reduce)': {...}})
```

Detection uses the existing React Native `AccessibilityInfo.isReduceMotionEnabled()` on native and the CSS media query on web. A single hook (e.g., `useReducedMotion()`) is an acceptable addition to `src/lib/` — the architect may propose one if not already present.

### 9.2 Haptics (AC-5)

- On bar open (native): no haptic. The gesture itself is the feedback.
- On scrub (native): no haptic — scrubbing would produce too many haptics. (Rejected: per-emoji selection haptic. Too noisy.)
- On select (native): `useHaptics()('Light')` — light impact, via `src/lib/haptics.ts`. This already respects the system haptic preference via `useHapticsDisabled()`.
- On remove (native): same `Light` haptic.
- On failure (native): no haptic. The toast is the feedback.
- On web: no haptics (the `useHaptics` hook no-ops on web already).

---

## 10. Theming — ALF Tokens

All colors use theme tokens; no hex codes.

### 10.1 Bar / popover

| Role | Light | Dark | Token |
| --- | --- | --- | --- |
| Bar bg | white | near-black | `t.atoms.bg` |
| Bar border | subtle | subtle | `t.atoms.border_contrast_low` |
| Bar shadow | soft drop | soft drop | platform-specific shadow, theme-independent |
| Selected emoji bg | tinted | tinted | `t.palette.primary_50` (light) / `t.palette.primary_900` (dark) with reduced alpha |
| Scrub ring (reduced motion) | primary | primary | `t.palette.primary_500` |

### 10.2 Chip

| Role | Light | Dark | Token |
| --- | --- | --- | --- |
| Chip bg | very subtle tint | very subtle tint | `t.palette.primary_25` / `t.palette.primary_975` |
| Chip border | none | none | — |
| Chip emoji | rendered glyph — native color | rendered glyph — native color | — |

### 10.3 Web React button

| Role | Light | Dark | Token |
| --- | --- | --- | --- |
| Button fg | secondary contrast | secondary contrast | `t.atoms.text_contrast_medium` |
| Button hover bg | subtle | subtle | `t.atoms.bg_contrast_25` |
| Button focus ring | primary | primary | `t.palette.primary_500` (via existing Button focus styles) |

### 10.4 Post card press feedback (AC-4)

- Press-in tint before bar opens: `t.atoms.bg_contrast_25` at 100% opacity, or opacity of the post itself to 0.92. Whichever reads better on both themes — design QA confirms after first build.

### 10.5 Tokens / atoms cheatsheet used

Spacing: `a.p_sm`, `a.px_sm`, `a.py_2xs`, `a.px_md`, `a.py_sm`, `a.gap_sm`, `a.gap_md`.
Shape: `a.rounded_full`.
Layout: `a.flex_row`, `a.align_center`, `a.justify_center`.
Text: `a.text_sm`, `a.font_semibold`.
Platform: `web({...})`, `native({...})`, `ios({...})`, `android({...})`.

Tested in both light and dark themes. No hardcoded colors.

---

## 11. Responsive / Breakpoints

Using `useBreakpoints()` from `#/alf`.

### 11.1 Phone (default)

- Bar width: 224 pt, emoji 32 pt, hit target 44 pt.
- Chip: 16-pt emoji, 24-pt height.
- Popover (web phone / touch web): anchored to React button, which is always visible on touch-web (§4.2).

### 11.2 `gtPhone` (small tablet)

- Same layout as phone. No change.

### 11.3 `gtMobile` (tablet+)

- Bar on native: same; tablet still uses touch. No change.
- Web: React button is visible on hover (not always-visible), since tablets with keyboards often have a pointing device. If the media query `(hover: none)` still matches (pure touch), fall back to always-visible.
- Popover anchor position unchanged.

### 11.4 `gtTablet` (desktop)

- Web hover timing unchanged (200 ms).
- Popover max-width matches phone; 4 emoji never require wrapping.

### 11.5 Viewport < 320 pt

- Bar clamps horizontally with 16-pt safe-area margins. Emoji spacing may tighten to `a.gap_xs` (4 pt) rather than `a.gap_sm`.

### 11.6 Dynamic Type XXL

- See §8.11. Bar may wrap to a 2×2 grid.

---

## 12. Copy Deck (Lingui-wrapped, AC-13)

All strings exported through `msg()` or `<Trans>`. Format here: `id` → English source.

### 12.1 Emoji labels (used by screen reader and accessible picker)

| Emoji | English | Notes |
| --- | --- | --- |
| ❤️ heart | `_(msg\`Heart\`)` | |
| 🔥 fire | `_(msg\`Fire\`)` | |
| 👀 eyes | `_(msg\`Eyes\`)` | |
| 😂 joy | `_(msg\`Tears of joy\`)` | "joy" alone is ambiguous in translation; "tears of joy" matches the Unicode CLDR name |

### 12.2 Actions

| Context | English |
| --- | --- |
| Web React button label | `_(msg\`React\`)` |
| Web React button tooltip | `_(msg\`Add a reaction\`)` |
| Accessibility action | `_(msg\`React to post\`)` |
| Picker title | `_(msg\`React to post\`)` |
| Picker remove row | `_(msg\`Remove reaction\`)` |
| Picker cancel (native handle / web close are unlabeled visually; screen-reader label) | `_(msg\`Close\`)` |
| Chip accessibility label (with prior reaction) | `_(msg\`Reacted with ${label}. Activate to change or remove.\`)` |
| Bar emoji accessibility label (not selected) | `_(msg\`React with ${label}\`)` |
| Bar emoji accessibility label (selected) | `_(msg\`${label} — selected. Activate to remove.\`)` |
| Chip removed live announcement | `_(msg\`Reaction removed\`)` |
| Chip added live announcement | `_(msg\`Reacted with ${label}\`)` |

### 12.3 Error

| Context | English |
| --- | --- |
| Failure toast | `_(msg\`Couldn't save reaction\`)` |

### 12.4 Translation hygiene notes

- German strings typically run ~30% longer. "Tears of joy" in German: "Freudentränen" (12 chars vs 13 — fine). Chip labels via screen reader only, so line-width in UI is never a concern. The React button uses an icon only; no visible label to translate-overflow.
- CJK locales render emoji glyphs the same; no special handling needed.
- Arabic/Hebrew: labels flow naturally; RTL mirroring is a layout concern (AC-14), not a copy concern.

Total user-facing strings: **15** (counting each distinct `msg()`).

---

## 13. Iconography

- `Emoji` icon from `src/components/icons/Emoji.tsx` — used for the web React button.
- `CircleCheck` from `src/components/icons/CircleCheck.tsx` — used in the accessible picker to mark the selected emoji.
- `Trash` or `CircleX` from `src/components/icons/` — used for the "Remove reaction" row in the accessible picker.

No new icons are required. No icons need RTL mirroring (the Emoji icon is a generic glyph, the check is symmetric, the trash can is symmetric).

Emoji glyphs themselves are rendered as `<Text emoji>❤️</Text>` to leverage the existing emoji-rendering pattern in `src/components/Typography`.

---

## 14. Accessibility Specification

This section is not optional. Every item here must be satisfied.

### 14.1 Screen reader

- Every emoji in the bar and picker has an `accessibilityLabel` (Lingui-wrapped, §12).
- Every emoji in the bar has an `accessibilityRole="button"`.
- The selected emoji has `accessibilityState={{selected: true}}`.
- The chip has `accessibilityRole="button"` and `accessibilityLabel` describing the current reaction and the action (`"Reacted with Fire. Activate to change or remove."`).
- The "React to post" accessibility action (AC-11) is attached to every eligible post via `accessibilityActions` + `onAccessibilityAction`.
- The accessible picker reuses `Dialog.Outer` / `Dialog.ScrollableInner`, which already manages focus trap and announces the dialog label on open.
- Live announcements on chip changes use `AccessibilityInfo.announceForAccessibility` on native and `aria-live="polite"` on web.

### 14.2 Focus order

- Within a post's controls row: Reply → Repost → Like → Bookmark → Chip (if present) → React button (web, if flag ON) → Share.
- Inside the popover: focus trapped; Tab cycles among the four emoji; Escape / outside-click returns focus to the React button.
- Inside the accessible picker: focus trapped; initial focus on the first emoji row (or the viewer's current reaction if present); Escape / close returns focus to the post.

### 14.3 Dynamic Type / large text

- All text (including the emoji glyph, which is a Text node) uses the Lingui-wrapped `Text` component, which already respects system font-size scaling.
- Bar height grows with emoji size. 2×2 wrap at XXL (§8.11).
- Chip grows with emoji size; padding grows proportionally.
- No text is clipped; no `numberOfLines={1}` on any visible text in the feature.

### 14.4 Reduced motion (AC-12)

- See §9.1 motion matrix. Every animation has an opacity-only fallback.
- No parallax, no translate, no scale in reduced-motion mode.

### 14.5 Hit targets

- Every interactive element ≥ 44×44 pt.
- Bar emoji: 44 pt target with 32 pt glyph.
- Chip: 44 pt target with 16 pt glyph + invisible padding extension.
- Web React button: 44 pt target minimum; inherits from `Button` primitive's `size="small"` which meets this.

### 14.6 Color contrast

- Chip emoji (glyph) on `t.palette.primary_25` bg: emoji colors are not affected by theme; contrast is inherent to the glyph. OK.
- React button icon on `t.atoms.bg`: `t.atoms.text_contrast_medium` meets WCAG AA (4.5:1) in both themes, verified against existing PostControls buttons.
- Focus ring: `t.palette.primary_500` on both themes meets 3:1 against adjacent bg, matching existing button focus behavior.
- Selected-emoji tint in bar: the emoji glyph itself carries information; the tint is decorative. Screen-reader users get `selected: true`; contrast of the tint is not a semantic requirement. OK.

### 14.7 RTL (AC-14)

- Emoji order reverses in RTL.
- Popover anchor mirrors.
- Chip position mirrors.
- Arrow key directions reverse (ArrowLeft = next in RTL).
- All ALF layout atoms (`a.flex_row`) already respect RTL via React Native's `I18nManager.isRTL`.

### 14.8 Accessibility coverage summary

| Dimension | Covered |
| --- | --- |
| Screen reader labels on every interactive element | yes |
| Screen-reader-specific entry path (a11y action → accessible picker) | yes (AC-11) |
| Dynamic Type / large-text support | yes |
| Reduced motion (every animation has fallback) | yes (AC-12) |
| RTL mirroring | yes (AC-14) |
| Color contrast (WCAG AA) | yes |
| Hit targets ≥ 44 pt | yes |
| Focus trap in popover and picker | yes |
| Focus restoration on close | yes |
| Live-region announcements on chip change | yes |
| Flag-OFF silence (no tab stops, no a11y actions, no announcements) | yes (AC-15) |

---

## 15. Analytics — UX Concerns Only (AC-18)

The architect owns the event schema and emission points. UX-relevant concerns:

- **Bar open** fires once per open, regardless of whether the user scrubs.
- **Emoji select** fires on commit, not on hover/scrub. Changing an existing reaction is two events (one `remove` implicit in the change? — no; spec treats change as a single `select` with the new emoji; explicit remove is its own event).
- **Reaction remove** fires only on explicit removal (re-tap selected emoji, or picker remove row).
- No PII in any event payload. Post URI is hashed (algorithm to be specified by architect).
- Flag variant is included so analytics can distinguish ON-cohort baseline from any future variants.

---

## 16. Summary — Reference to AC

| AC | Addressed in |
| --- | --- |
| AC-1 | Architect owns endpoint; UX assumes a write API exists. |
| AC-2 | §1.3 Change/remove, §2.5 selected state rendering, §5.2 remove row. |
| AC-3 | §3.2 chip position; chip and Like are visually distinct, no shared state. |
| AC-4 | §4.1 native long-press, §2.3 bar anatomy. |
| AC-5 | §9.2 haptics. |
| AC-6 | §4.2 hover + click, §4.2 touch-web fallback. |
| AC-7 | §1.4, §4.3 keyboard flow. |
| AC-8 | §2.1 surfaces in scope. |
| AC-9 | §3 chip rendering, §6.1 populated state. |
| AC-10 | §3.1 — no counts, no other-user reactions. |
| AC-11 | §5 accessibility picker. |
| AC-12 | §9.1 motion matrix with reduced-motion column. |
| AC-13 | §12 copy deck (all Lingui-wrapped). |
| AC-14 | §8.10 RTL, §14.7 a11y RTL. |
| AC-15 | §1.6 flag-off path, §6.4 state matrix flag-off, §8.7 mid-interaction flip. |
| AC-16 | §1.5 failure/offline path, §3.4 chip animations. |
| AC-17 | §8.6 double-reaction race. |
| AC-18 | §15 analytics UX concerns. |

---

## 17. Open UX Questions for Reporter

Carried over from `ac_check.json`, with UX framing:

1. **Gesture target on media (AC-4)**: UX recommends the bar only triggers on text/metadata. Confirm this matches product intent.
2. **Touch-web fallback (AC-6)**: UX recommends always-visible React button on touch-web (media query `(hover: none)`) rather than porting long-press. Confirm.
3. **"Joy" label translation (AC-13)**: UX recommends the CLDR-standard "Tears of joy" rather than "Joy" for translation clarity. Confirm.
4. **Chip tap vs. long-press (§4.4)**: UX recommends tap *and* long-press on chip both reopen the bar, because the chip is small. Confirm.

None of these block design; all are captured here for visibility.

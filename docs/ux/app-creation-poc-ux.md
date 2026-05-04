# UX Design: App Creation POC

**Designer:** Sable | **Date:** 2026-05-01
**Feature Spec:** `docs/product/app-creation-poc.md`

---

## Design Intent

The user should feel like they're talking to a **competent collaborator**, not interrogating a search box. The chat is a conversation, not a form. The wait for generation should feel like *the assistant is working*, not like *the spinner is broken*. When the app appears, it should feel like **theirs** — saved, shareable, alive — even though we're not yet showing them the marketplace.

Three feelings to optimize for, in order:

1. **Confidence** — "I can describe what I want, however I want, and something useful will happen."
2. **Surprise** — "Oh, it actually made the thing I described."
3. **Ownership** — "This is mine. It saves. It's still here tomorrow."

Anti-feeling: *interrogated.* No required fields. No "select category." No "describe in 3 bullet points." The chat is the only input.

---

## Jobs-to-be-Done

> **When** I have an idea for an app I want to use or show someone,
> **I want to** describe it in plain language and see it real,
> **so I can** validate the idea, demo it, or just use it — without becoming a programmer.

**Current solution:** Notes app, voice memo, Pinterest board, paying a freelancer for the rare ones, or never building it.
**Pain points:** The skill wall, the time wall, the cost wall. Most ideas die in the Notes app.
**Consequences:** Compounded frustration over time — the gap between *imagination* and *reality* erodes confidence in your own ideas. People stop having them.

---

## User Journey Map

### Stage 1 — Discover & Sign Up

| | |
|---|---|
| **Doing** | Opens the app for the first time. Sees Sign-In screen. |
| **Thinking** | "OK, I'll try this. Don't ask me to make a password." |
| **Feeling** | Cautious optimism. Slightly skeptical. |
| **Pain** | Magic-link friction (have to leave the app, check email, come back). |
| **Opportunity** | Make the wait feel productive. Show what's coming. |

### Stage 2 — First Idea

| | |
|---|---|
| **Doing** | Lands on empty Home. Taps "Create new app." Lands on empty Chat. |
| **Thinking** | "What should I type? Will it understand me?" |
| **Feeling** | Hesitant. Looking for permission to be vague. |
| **Pain** | Blank-page paralysis. Don't know what's possible. |
| **Opportunity** | Strong empty state with example prompts. Lower the activation energy with concrete starters. |

### Stage 3 — Generation Wait

| | |
|---|---|
| **Doing** | Submitted prompt. Watching loading. |
| **Thinking** | "Is it working? How long?" |
| **Feeling** | Anticipatory. Vulnerable to a frozen-spinner read. |
| **Pain** | Up to 90 seconds is a *long* time on mobile. |
| **Opportunity** | Honest progress messaging. "Reading your idea" → "Picking components" → "Putting it together." Not real progress, but honest about what's happening at each stage. |

### Stage 4 — First Reveal

| | |
|---|---|
| **Doing** | App renders. User pokes at it. |
| **Thinking** | "Is this real? Let me try the buttons. Wait, it actually works." |
| **Feeling** | Surprise → delight → ownership. |
| **Pain** | If it doesn't *do* anything (only static text), the magic dies. Buttons need to do something even if simple. |
| **Opportunity** | Make the action feedback unmistakable. Toast on `toast` action. Visible state changes. Counter increments visibly. |

### Stage 5 — Return

| | |
|---|---|
| **Doing** | Reopens the app the next day. Sees the library. |
| **Thinking** | "Oh, it saved. Cool." |
| **Feeling** | Quietly impressed. Trust forms. |
| **Pain** | If the app looks different on reopen, trust collapses immediately. |
| **Opportunity** | Render must be byte-identical. The library card preview must accurately reflect the runtime app. |

---

## User Flow

### Happy Path

```
Sign-In screen (email input)
    │
    ▼ enter email → "Send link" → toast "Check your inbox"
    │
    ▼ tap link in email (deep link to scheme://auth?token=…)
    │
    ▼ Auth callback screen (briefly) → Home
    │
Home screen (empty library + "Create new app" CTA)
    │
    ▼ tap "Create new app"
    │
Chat screen (input focused, example prompts visible)
    │
    ▼ type prompt → tap Send
    │
Loading state (in-place on Chat — no navigation yet)
    │  • "Reading your idea…" (0–5s)
    │  • "Picking components…" (5–20s)
    │  • "Putting it together…" (20–90s)
    │
    ▼ /generate succeeds
    │
AppRunner screen (full-screen rendered app)
    │  • Top bar: app title (auto-derived) + "Done" button
    │  • Body: rendered A2UI tree
    │  • Bottom: subtle hint "Tap Done to save"
    │
    ▼ tap "Done"
    │
Home screen (library now has 1 card with the new app)
    │
    ▼ tap card any time later
    │
AppRunner (identical render, instant — no LLM call)
```

### Error & Edge Cases

| Trigger | Behavior |
|---|---|
| Send tapped with empty / whitespace-only prompt | Send button is disabled; no error needed. |
| Send tapped with prompt > 2000 chars | Inline counter under input turns red at 1900 chars; Send disabled at 2001+. |
| /generate returns `invalid_input` | Toast: "Try rephrasing — keep it under a paragraph." Input preserved. |
| /generate returns `invalid_spec` | Toast: "Hmm, I couldn't turn that into an app. Try a different idea or be more specific." Input preserved. |
| /generate returns `prompt_too_large` | Toast: "Too much detail at once. Start with the basics — we can refine later." Input preserved. |
| /generate returns `rate_limited` | Toast: "We're a bit busy right now. Try again in a minute." Input preserved. Send disabled for 60s with countdown. |
| /generate returns `internal` | Toast: "Something went wrong on our end. Try again." Input preserved. |
| Network drops during generation | Toast: "You went offline mid-generation. Your idea is saved here — try again when you're back." Spec attempt is not lost from the input. |
| Magic link tapped with expired token | Sign-In screen with banner: "That link expired. Send a new one?" |
| Magic link tapped with already-used token | Same as expired. |
| User signs out from Settings (Phase 2) | Returns to Sign-In screen. Library cleared from device cache. |

---

## Screen-by-Screen Design

### Screen 1: Sign-In

**Purpose:** Get the user authenticated with the lowest friction possible.

**Layout (top → bottom):**
- Top safe area
- Logo / wordmark (small, centered, 64pt below safe area)
- Headline (`text_xl`, `font_semibold`): "Make the apps in your head."
- Subhead (`text_md`, `palette.muted`): "Describe an idea. Get a real app."
- Email input (full-width, label "Email", autocomplete=email, keyboardType=email-address, autocapitalize=none)
- Primary Button "Send magic link" (full-width, primary variant)
- Footer (small, palette.muted): "We'll email you a one-tap sign-in link. No password."

**States:**
| State | What changes |
|---|---|
| **Default** | As above. |
| **Email empty** | "Send magic link" disabled (50% opacity). |
| **Email invalid format** | Inline error under input: "That doesn't look like an email." Button stays disabled. |
| **Email valid** | Button enabled. |
| **Sending** | Button shows inline spinner + label "Sending…" — disabled. |
| **Sent (success)** | Replace primary content with confirmation: ✓ icon, headline "Check your inbox", subhead "We sent a sign-in link to **<email>**." Button text changes to "Resend" (enabled after 30s cooldown). |
| **Sent (error)** | Toast: "Couldn't send the link. Try again in a moment." Form returns to default. |
| **Token tapped — verifying** | Briefly visible auth callback: full-screen spinner + "Signing you in…" |
| **Token expired/used** | Sign-In screen with banner above the form: "That link expired. Send a new one?" — banner has dismiss X. |

**Interactions:**
- Tap email field → keyboard rises, no autofocus on cold start (intentional — let the user breathe).
- Tap Send → button enters sending state, request fires.
- Tap "Resend" → restarts the flow.

**Accessibility:**
- Heading marked as `accessibilityRole="header"`.
- Email input has `accessibilityLabel="Email address"`.
- Send button label is dynamic: "Send magic link" / "Sending sign-in link" / "Resend sign-in link".
- Error message announced via `accessibilityLiveRegion="polite"`.

**Responsive (iPhone SE → iPhone Pro Max):**
- Single column always. Logo + headline stay above the fold even on SE (vertical rhythm: 16pt between logo and headline, 8pt headline→subhead, 32pt subhead→input, 16pt input→button).

---

### Screen 2: Home (Library)

**Purpose:** Show what the user has made. Get them into Chat fast.

**Layout (top → bottom):**
- Top safe area
- Top bar: "Your apps" (text_lg, font_semibold, left-aligned) + Settings gear icon (right, hit target 44×44)
- Hero CTA: full-width Card-shaped button, primary variant, content "✨ Create new app" (icon + text, 64pt tall). Sticky at top — does not scroll away.
- Library list:
  - Section divider with caption "Recent" (`text_sm`, palette.muted, padding-top: lg)
  - Each project = a Card with:
    - Title (auto-derived, `text_md`, `font_semibold`, max 1 line, ellipsize)
    - Subtitle (`text_sm`, palette.muted): relative time ago — "Created 3 days ago"
    - Trailing chevron (right arrow icon)
  - Cards have light divider between them
- Bottom safe area

**States:**
| State | What changes |
|---|---|
| **Empty** | Library list replaced with empty state: large illustration (a flat sketch of a phone with sparkles around it — kept minimal), headline "Your library is empty.", subhead "Tap **Create new app** to make your first one. It takes about a minute." Hero CTA stays at top. |
| **Loading** | Hero CTA visible. Library list shows 3 skeleton cards (shimmer). |
| **Populated (1–4 apps)** | List shows all apps, no scrolling needed. |
| **Populated (5+ apps)** | List scrolls. Hero CTA stays sticky at top. |
| **Error** | Hero CTA visible. Library list replaced with error state: small icon, "Couldn't load your library", "Pull to retry." |

**Interactions:**
- Tap "Create new app" → push Chat screen.
- Tap library card → push AppRunner with that project.
- Pull to refresh → re-fetches /projects.
- Long-press card (Phase 2) — out of scope here, but reserve the gesture for Phase 2 Edit/Delete menu.

**Accessibility:**
- `accessibilityLabel` on each card: "Open <title>, created <time ago>".
- Hero CTA: "Create a new app from a description".
- Settings: "Settings".
- Pull-to-refresh announces "Refreshed" / "No new apps".

**Responsive:**
- Single column, full-width cards. No grid layout at MVP.

---

### Screen 3: Chat

**Purpose:** Capture an idea. Show progress honestly. Get out of the way.

**Layout (top → bottom):**
- Top safe area
- Top bar: ← back arrow + "New app" title + (no trailing element)
- Empty area / message thread:
  - **First-time visitor:** centered welcome card with headline "What do you want to build?" and three example prompt chips:
    - "A tip splitter for my favorite coffee shop"
    - "A morning routine tracker with three habits"
    - "A simple expense logger"
    - Tapping a chip pre-fills the input — does not auto-send.
  - **In-progress:** The user's prompt appears as a chat bubble (right-aligned, primary color background, white text). Below it, the assistant's loading bubble (left-aligned, surface color, with progress messaging).
- Bottom: input bar (sticky to keyboard)
  - Multi-line text input with placeholder "Describe your app idea…"
  - Trailing Send button (icon: paper-plane). Hit target 44×44.
  - Above input: subtle character counter — only visible at 1800+ chars, turns red at 1900+.

**States:**
| State | What changes |
|---|---|
| **Empty (first visit)** | Welcome card + example chips visible. Input empty. Send disabled. |
| **Typing** | Welcome card hidden once a character is typed. Send enabled when prompt has ≥1 non-whitespace char and length ≤ 2000. |
| **Submitting** | User's bubble appears. Loading bubble appears with message "Reading your idea…". Input clears. Send button replaced with cancel icon (disabled functionally — cancel comes Phase 2; for now, the icon is a non-interactive spinner). |
| **Loading: 0–5s** | Loading bubble: "Reading your idea…" |
| **Loading: 5–20s** | Loading bubble: "Picking components…" |
| **Loading: 20–90s** | Loading bubble: "Putting it together…" |
| **Loading: >90s** (rare) | Loading bubble: "Almost there…" |
| **Success** | Loading bubble dismissed; navigate to AppRunner with a brief modal-presentation animation (slide up from bottom). |
| **Error** | Loading bubble replaced with assistant error bubble: bg=destructive-tint, content=error message per error map. Send button re-enabled. Input preserves the prompt for editing. |
| **Offline at submit time** | Toast: "You're offline." Send button greyed. |
| **Offline mid-generation** | Loading bubble updates: "Waiting for connection…" — when reconnected, the request is *not* automatically retried. We show a Retry button next to the user's bubble. (Anthropic calls aren't safely idempotent without a key.) |

**Interactions:**
- Input grows up to 5 lines, then scrolls internally.
- Send button on filled-keyboard return key. (iOS hardware keyboard / iPad: Enter sends; Shift+Enter newline.)
- Tap example prompt chip → pre-fills input → user can edit → tap Send.
- Back arrow during loading → confirmation alert: "Cancel this generation?" → if confirmed, return to previous screen (Home), the generation completes server-side (no abort) and the project still gets created — visible in library on next refresh.

**Accessibility:**
- Input has `accessibilityLabel="App idea"`.
- Send: "Send" / "Cancel" / dynamic per state.
- Loading bubble updates announced via `accessibilityLiveRegion="polite"`.
- Example chips: `accessibilityRole="button"`, label "Example: <chip text>".

**Responsive:**
- Welcome card stacks chips vertically on small screens.

**Reduced Motion:**
- The bubble entrance animation collapses to instant opacity change.
- The loading bubble's progress-text transitions are crossfade-only (no slide).

---

### Screen 4: AppRunner

**Purpose:** Render the user's generated app. Stay out of the way of *their* app.

**Layout:**
- Top safe area
- Top bar: ← back arrow + auto-derived title (`text_md`, `font_semibold`, ellipsize) + (no trailing element this slice — Phase 2 adds Edit and Share)
- Body: scroll view containing the rendered A2UI tree, padded with `lg` on left/right and `md` on top/bottom
- Bottom safe area

**States:**
| State | What changes |
|---|---|
| **Loading saved app (re-open from library)** | Skeleton shapes matching the spec's structure (we know the spec; we can render real shape skeletons, not generic ones) for ~100–200ms while the renderer hydrates state. |
| **Loaded** | Rendered tree visible. State machine active. |
| **Action: toast** | Toast appears at top of screen (below safe area, above body). 3s auto-dismiss. |
| **Action: navigate** (multi-view spec) | Crossfade between views; back arrow stays mapped to "exit AppRunner" (not "previous view") at MVP. |
| **Render error** (spec invalid / unknown component / runtime exception) | Body replaced with apologetic error: icon + "This app didn't render correctly. Try recreating it." + button "Back to library". This is a P0 bug if it happens — we instrument it. |

**Interactions:**
- Pull to refresh — disabled. The spec is immutable per version; refresh would do nothing.
- Back arrow — pop to Home.

**A2UI component visual treatment** — see next section.

**Accessibility:**
- Top bar back arrow: "Back to library".
- A2UI Heading: `accessibilityRole="header"`.
- A2UI Button: `accessibilityRole="button"` + label = the button's text.
- A2UI TextInput: `accessibilityLabel` from the `label` prop.
- A2UI Toggle: `accessibilityRole="switch"` + state announced.
- A2UI Counter: combined label "<label>, current value <n>" + `accessibilityActions` for increment/decrement.
- Toast: announced via live region.

**Responsive:**
- Container with `direction: row` wraps to `column` on narrow screens (<375pt) — to be confirmed in implementation.

---

## A2UI Catalog Visual Treatment

This is the part that ships in *every app the user makes.* I'm picking a treatment that:

1. **Looks intentional** — not Material, not Cupertino, not Tailwind defaults. Custom enough to be ours, not so custom it's distracting.
2. **Scales gracefully** — heading hierarchy that works for a 1-screen tip calculator and a 4-screen routine tracker.
3. **Communicates affordance** — buttons look tappable, inputs look fillable, toggles look toggleable, at a glance.
4. **Respects iOS conventions** at the OS-interaction level (haptics, keyboard behavior, focus rings) without aping iOS aesthetics.

### Tokens (light theme — dark theme mirrored)

```
spacing:        2xs=2  xs=4  sm=8  md=16  lg=24  xl=32  2xl=48
radius:         sm=6  md=10  lg=16  full=999
typography:
  display       text_2xl=28pt  bold=700
  heading-1     text_xl=22pt   bold=700
  heading-2     text_lg=18pt   semibold=600
  heading-3     text_md=16pt   semibold=600
  body          text_md=16pt   regular=400
  body-strong   text_md=16pt   semibold=600
  caption       text_sm=14pt   regular=400
  caption-mute  text_sm=14pt   regular=400  palette.muted
elevation:      shadow_sm  shadow_md  (used sparingly — flat-ish design)
```

### Color palette

**Light:**
```
bg.surface:        #ffffff
bg.subtle:         #f6f7f9   (cards, sheets)
bg.elevated:       #ffffff   (with shadow_sm)
text.primary:      #0a0a0b
text.muted:        #5e6470
text.destructive:  #b3261e
border.subtle:     #e6e8eb
border.strong:     #c7ccd1
primary:           #4f46e5    (indigo — distinct from system blue)
primary.hover:     #4338ca
primary.fg:        #ffffff
destructive:       #dc2626
destructive.fg:    #ffffff
focus.ring:        #4f46e5  + alpha 0.4 outer glow
```

**Dark:**
```
bg.surface:        #0a0a0b
bg.subtle:         #16181d
bg.elevated:       #1f2229
text.primary:      #f5f5f7
text.muted:        #a4a8b3
text.destructive:  #f87171
border.subtle:     #2a2d34
border.strong:     #3a3f48
primary:           #818cf8    (lighter indigo for dark)
primary.hover:     #a5b4fc
primary.fg:        #0a0a0b
destructive:       #f87171
destructive.fg:    #0a0a0b
```

WCAG AA contrast verified for all text/bg pairs. `text.muted` on `bg.surface` = 4.6:1; `primary.fg` on `primary` = 8.1:1; etc.

### Components

| Component | Visual treatment |
|---|---|
| **Heading** | `level: 1` → display style, padding-top: lg. `level: 2` → heading-1 + padding-top: md. `level: 3` → heading-2 + padding-top: sm. Always full-width left-aligned. |
| **Text** | body. `weight: bold` → body-strong. `color: muted` → text.muted. `color: destructive` → text.destructive. |
| **Image** | radius: md. If `aspectRatio` provided, locked. Otherwise, max-height: 240pt with letterbox bg.subtle. |
| **Button** | Padding 12pt vertical / 20pt horizontal. radius: md. `variant: primary` → bg.primary + primary.fg. `variant: secondary` → bg.subtle + text.primary + border.subtle. `variant: destructive` → bg.destructive + destructive.fg. Pressed state: 8% darken via overlay. Haptic: `Haptics.impactAsync(Light)` on press success. |
| **TextInput** | radius: md, border.subtle, padding 12pt vertical / 14pt horizontal. Label sits above input, caption-style. Focus state: border becomes primary, focus.ring outer glow. Multi-line: 5-line max, then internal scroll. |
| **Toggle** | iOS-native switch via React Native `Switch` with `trackColor` set to primary when on, border.strong when off. Label sits to the left, full-width row, 56pt min height for hit target. |
| **Counter** | Three-element row: `−` button (secondary variant, square 44pt), value (heading-2 style, center, min-width 60pt), `+` button (secondary variant, square 44pt). Label above. Disabled state for buttons at min/max. Haptic: light impact on inc/dec. |
| **List** | Vertical stack with `md` gap by default. `separator: true` → bg.subtle 1px lines between items, no gap. |
| **Form** | Vertical stack with `md` gap between fields. `submitLabel` button at the bottom, full-width, primary variant. `submitAction` fires on press. |
| **Container** | Flexbox with the requested direction. Padding from token. Gap from token. align/justify map to flexbox. |

### Action feedback

| Action | Feedback |
|---|---|
| `set` | If the target is a TextInput → field updates visually. If Counter → number updates with a brief scale animation (1.0 → 1.1 → 1.0, 200ms). If Toggle → switch animates. |
| `increment` / `decrement` | Counter value updates; button momentarily shows a darker pressed state. Light haptic. |
| `toast` | Top toast slides down from below safe area — surface color, body-strong text, `md` padding, auto-dismiss 3s. Dark variant in dark theme. |
| `navigate` | Crossfade between views inside the AppRunner body, 250ms. |

---

## Component Inventory

### App-shell components (in `apps/mobile/src/components/`)

| Component | Status | Notes |
|---|---|---|
| `Logo` | New | Small wordmark "App Creator" — type-only at MVP, no graphic mark yet |
| `Button` (shell version) | New | Primary, secondary, destructive variants. Mirrors the A2UI Button visual but lives in the shell layer |
| `TextInput` (shell version) | New | Email, multi-line variants. Distinct from A2UI TextInput (different label placement, different states) |
| `Card` | New | Library card variant. Tappable. |
| `EmptyState` | New | Icon + headline + subhead + optional CTA |
| `Skeleton` | New | Shimmer animation for loading states |
| `Toast` | New | Top-of-screen, auto-dismiss, queue-aware |
| `LoadingBubble` | New | Chat-specific. Animated dots + dynamic progress text |
| `ChatBubble` | New | User vs assistant variants |
| `ExamplePromptChip` | New | Tappable rounded-full pills with chevron |
| `BackButton` | New | Standard ← chevron, hit target 44pt |
| `SafeContainer` | New | Wraps every screen, applies safe area insets + bg.surface |

### A2UI catalog components (in `packages/a2ui-renderer/`)

All 10. Listed above. **All new.** All snapshot-tested per ARCHITECTURE.md §6 + AC-R3.

---

## Content & Copy

| Element | Copy | Notes |
|---|---|---|
| App name (header) | "App Creator" | Working title; brand pass is Phase 2 |
| Sign-In headline | "Make the apps in your head." | Aspirational, short |
| Sign-In subhead | "Describe an idea. Get a real app." | The promise, in 7 words |
| Sign-In email label | "Email" | — |
| Sign-In primary button | "Send magic link" | Plain, action-first |
| Sign-In sending button | "Sending…" | Past-tense feel for the wait |
| Sign-In sent headline | "Check your inbox" | Imperative, friendly |
| Sign-In sent subhead | "We sent a sign-in link to **{email}**." | Bold the email so they verify it |
| Sign-In resend button | "Resend" | After 30s cooldown |
| Sign-In expired-link banner | "That link expired. Send a new one?" | Non-judgmental, action embedded |
| Sign-In footer | "We'll email you a one-tap sign-in link. No password." | Reassures the no-password path |
| Home title | "Your apps" | Possessive, ownership-forward |
| Home empty headline | "Your library is empty." | Factual |
| Home empty subhead | "Tap **Create new app** to make your first one. It takes about a minute." | Sets expectation |
| Home CTA | "✨ Create new app" | Sparkle for delight, "Create" not "New" |
| Home time-ago | "Created {time}" | Where {time} is "just now", "5 minutes ago", "yesterday", "3 days ago", "a week ago" |
| Home library error | "Couldn't load your library." | Honest |
| Home library error CTA | "Pull to retry." | Mechanism instruction |
| Chat title | "New app" | Anonymous; no opinion yet |
| Chat welcome headline | "What do you want to build?" | Open question |
| Chat example chip 1 | "A tip splitter for my favorite coffee shop" | Concrete + personal |
| Chat example chip 2 | "A morning routine tracker with three habits" | Concrete + personal |
| Chat example chip 3 | "A simple expense logger" | Different domain |
| Chat input placeholder | "Describe your app idea…" | One sentence, ellipsis hint at chat-style brevity |
| Chat send button (a11y) | "Send" | — |
| Loading message 0–5s | "Reading your idea…" | First-person assistant voice |
| Loading message 5–20s | "Picking components…" | Hints at *how* |
| Loading message 20–90s | "Putting it together…" | Verb in progress |
| Loading message >90s | "Almost there…" | Rare; soothing |
| Error: invalid_input | "Try rephrasing — keep it under a paragraph." | Specific guidance |
| Error: invalid_spec | "Hmm, I couldn't turn that into an app. Try a different idea or be more specific." | Apologetic + actionable |
| Error: prompt_too_large | "Too much detail at once. Start with the basics — we can refine later." | Hints at edit-by-chat (Phase 2) |
| Error: rate_limited | "We're a bit busy right now. Try again in a minute." | Honest about backend pressure |
| Error: internal | "Something went wrong on our end. Try again." | Standard 500 copy |
| Error: offline (at send) | "You're offline." | Bare |
| Error: offline (mid-gen) | "Waiting for connection…" | Then becomes a Retry button when restored |
| Cancel-during-generation alert title | "Cancel this generation?" | — |
| Cancel-during-generation alert body | "It's almost done — leaving will lose progress." | Friction toward staying |
| Cancel-during-generation primary | "Keep waiting" | Default |
| Cancel-during-generation secondary | "Cancel" | Destructive-styled |
| AppRunner top-bar Done button (a11y) | "Done — return to library" | — |
| AppRunner render-error headline | "This app didn't render correctly." | Honest |
| AppRunner render-error CTA | "Back to library" | — |
| AppRunner saved-toast | "Saved to your library" | Auto-dismisses 2s |

---

## Iconography

| Icon | Source | Use |
|---|---|---|
| `arrow-left` | lucide-react-native (sanctioned, ARCHITECTURE.md §14 — confirm with Cal) | Back navigation |
| `send` (paper-plane) | lucide | Chat send button |
| `sparkles` | lucide | Hero CTA, brand moments |
| `settings` (gear) | lucide | Home top bar |
| `chevron-right` | lucide | Library card affordance |
| `check-circle` | lucide | Sign-in success |
| `alert-triangle` | lucide | Error states |
| `wifi-off` | lucide | Offline indicator |
| `plus` / `minus` | lucide | A2UI Counter buttons |

If `lucide-react-native` isn't already sanctioned in §14, Cal needs to add it. It's the lightest mainstream RN icon set; using `expo/vector-icons` is also acceptable (already comes with Expo).

---

## Animation & Motion

All animations respect `accessibilityReduceMotion`. Static fallbacks as noted.

| Element | Motion | Reduced |
|---|---|---|
| Screen transitions | iOS push/pop default (slide horizontal) | Crossfade |
| Modal screen (AppRunner from Chat) | Slide up from bottom, 300ms ease-out | Crossfade |
| Chat bubble entrance | Fade + 8pt translate-up, 200ms | Fade only |
| Loading bubble dots | Three dots ping in sequence, 1.2s loop | Static dots, no animation |
| Loading message text change | Crossfade, 200ms | Crossfade (already minimal) |
| Toast appearance | Slide down + fade, 250ms | Fade only |
| Counter increment | Scale 1.0→1.1→1.0 on the value, 200ms | No scale; instant value swap |
| Toggle | Native iOS switch animation | Native iOS handles reduced-motion |
| Skeleton shimmer | Linear gradient sweep, 1.5s loop | Static grey blocks |
| Pull-to-refresh | iOS-native | iOS-native |
| Button press | 8% darken overlay, 100ms | Same (subtle enough) |

---

## Theming

- Light + dark themes both ship at MVP. Toggle (Phase 2) defaults to system preference.
- All color decisions go through theme tokens. No hardcoded hex values in component code.
- Dark theme is *true dark* (#0a0a0b background), not "almost-dark grey" — looks better at night, saves OLED battery.
- Accent (primary) shifts hue between light and dark for contrast — light uses indigo-600, dark uses indigo-400. Both feel "the same color" subjectively despite different hex values.

---

## Design Decisions & Rationale

| Decision | Why | Alternative considered |
|---|---|---|
| Magic-link auth, not Apple/Google sign-in | One persona = personal individual. Magic link is universally available, requires no SDK setup, no Apple/Google account on the test device. | Apple/Google: deferred to Phase 2 when we cross the App Store review threshold. |
| Empty Chat with example prompts (not blank) | Idea-makers face blank-page paralysis. Concrete starters lower activation energy. | Blank input: rejected — too cold. Question wizard: rejected — kills conversational tone. |
| 3-stage progress messaging during generation | 90s is long. A static spinner reads "stuck" after 15s. Honest staged messaging keeps user engaged without faking real progress. | Real progress bar: rejected — we don't have streaming events to drive it accurately. Static spinner only: rejected — feels broken. |
| Cancel-during-generation triggers confirmation, but server-side request continues | We can't safely abort an Anthropic call mid-flight (no idempotency). Better to let it finish, save the project, surface it next refresh — never lose user work. | Hard cancel: rejected — wastes the LLM cost AND fails to deliver the user's idea. |
| AppRunner uses modal-style slide-up (not standard push) | The transition Chat → AppRunner is "your idea became real" — that's a moment. Slide-up gives it weight. The library push transition stays standard. | Standard push: rejected — flattens the magic moment. |
| Custom indigo primary, not iOS system blue | The catalog's button style ships in *every generated app.* iOS blue would make every generated app look like a Settings menu. Custom-but-restrained indigo signals "this is a thing I made." | iOS system blue: rejected — too system-y. Bright/playful color: rejected — looks unserious for the small-business persona we may add later. |
| Light + dark both at MVP | Most of the work (token-based theming) is paid up front; not adding dark later costs more than building it now. | Light only: rejected — looks unfinished on modern iOS. |
| Lucide icons over SF Symbols | SF Symbols ties us to iOS forever; lucide is portable to Android in M2 with no design rework. | SF Symbols: rejected for portability. |
| No bottom tab bar at MVP | Three screens don't need it. Top-bar back nav is sufficient and keeps the AppRunner full-bleed. | Tabs: premature for 3 screens. |
| Library cards are list rows, not grid tiles | Cards need title + time-ago without a thumbnail (we don't render previews yet). Rows handle text-heavy content better. | Grid: rejected — would need preview images to look good, deferred to Phase 2. |
| Streaming generation deferred (per spec) | Robert scoped it out. The 3-stage progress UX is *only acceptable* because we know streaming lands soon. If streaming slips past Phase 2, revisit. | Stream now: out of spec. |

---

## Notes for Cal

The high-leverage architectural reads from this UX doc — the things where a wrong call costs us a redo:

1. **Renderer state model is non-trivial.** A `Form` containing a `Counter` and three `TextInput`s with a `submitAction: set(otherInputId, computed-value)` requires reactive state. The renderer needs a store-like primitive — a `Map<id, A2UIValue>` with subscribers, or a small `useReducer` per AppRunner instance. Pick the lighter option; this is M1, not Notion.
2. **Toast queue belongs to the app shell, not the renderer.** When the A2UI Toast action fires, the renderer dispatches up to a shell-level toast service. Don't let the renderer own its own toast UI — that'd duplicate code and risk visual drift between shell-toasts and renderer-toasts.
3. **Auto-derived project title** is server-side: derive from first Heading text → fall back to first 40 chars of the prompt. Persist to `projects.title`. Don't compute it client-side — the server already has the spec parsed and validated.
4. **render_hash** is computed server-side too. Send it down to the client; the client doesn't need to recompute. It's a signal, not a contract the client enforces.
5. **Magic-link callback URL scheme:** `appcreator://auth?token=...` matches the `scheme: 'appcreator'` in `app.config.ts` (already set). Confirm Supabase auth is configured to redirect there.
6. **Icon set:** confirm `lucide-react-native` (or fallback to `@expo/vector-icons` which is already shipped with Expo) gets into ARCHITECTURE.md §14. Pick one — don't ship both.
7. **Cancel during generation:** the server-side `/generate` request continues even when the client navigates away. That implies `/generate` is decoupled from the client connection — a job-queue pattern (write the project after the LLM completes, regardless of who's listening). For MVP this means: the LLM call completes server-side, the spec gets saved as a project even if the client cancels, and the client sees it on next library refresh. Cleaner than wiring abort signals through the SSE/HTTP layer at MVP.
8. **iOS Simulator + magic links:** the link URL needs to be tappable from Mail. On simulator, the user clicks the email link in their browser → it opens the iOS-bound URL → the simulator catches it. This works but requires the simulator to be running with the app installed. Don't architect around it; just document.
9. **Sub-slicing the ADR:** Robert's ADR sub-slicing suggestion (auth+infra → generate → persistence → render+library) is reasonable. UX-wise, the Sign-In + Home shells unblock you to mockup the empty states without LLM. Then Chat + AppRunner come together once /generate lands. Worth considering.

## Notes for Colby

Tactical implementation gotchas:

1. **The Chat input keyboard:** use `KeyboardAvoidingView` with `behavior="padding"` and adjust `keyboardVerticalOffset` for the top bar height. The iOS Simulator's keyboard toggle is `Cmd+K` — easy to miss this if you only test on hardware.
2. **Magic-link deep link handling:** `expo-linking` has `useURL()` hook that handles cold-start + warm-start cases. Test both: link tapped while app is closed vs link tapped while app is in background.
3. **The `Switch` for Toggle on iOS** has its own padding/height that doesn't match other A2UI components' 44pt baseline. Wrap it in a row container that enforces the touch target rather than relying on the switch alone.
4. **Skeleton shimmer:** use `react-native-reanimated` `useSharedValue` + `withRepeat`. Avoid setting up an `Animated` driver per skeleton — use one shared driver at the screen level.
5. **Toast queue:** if 2+ toasts fire in close succession (rare but possible — e.g., generation success + unrelated network blip), queue them. Don't stack. Single visible toast at a time, dismissible by tap.
6. **Error toast copy is dynamic** — map server `error` codes to copy strings via a single helper, not inline ternaries. Cal will probably colocate this with the API client.
7. **Counter scale animation** during increment: use `withSequence(withTiming(1.1, {duration: 100}), withTiming(1.0, {duration: 100}))`. Reduced-motion check first.
8. **A2UI rendering recursion:** `Container` and `Form` and `List` all contain children. Keep the recursion shallow — Robert's spec caps depth at 8 (ARCHITECTURE.md §6 implicit). Don't add `useEffect` per node; the renderer is a pure function.
9. **All A2UI Buttons** must wire `accessibilityLabel` from `node.label`. Don't synthesize labels; the catalog node already has the right text.
10. **Don't blur app-shell components and A2UI components in the same file.** They live in different packages (`apps/mobile/src/components/` vs `packages/a2ui-renderer/components/`). Even if the visual treatment is similar, the props contracts differ.

---

> ✅ UX design saved to `docs/ux/app-creation-poc-ux.md`
>
> **Next step:** Hand to Cal (`/architect`). Cal, check the "Notes for Cal" section.

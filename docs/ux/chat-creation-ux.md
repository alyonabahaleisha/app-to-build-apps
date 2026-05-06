# UX Design: Chat → Generate → Publish (Maker Marketplace)

**Designer:** Sable | **Date:** 2026-05-02
**Feature Spec:** `docs/product/chat-creation.md`
**Parent UX:** `docs/ux/app-creation-poc-ux.md`
**Supersedes from parent:** Screen 2 (Home — single list → two tabs), Screen 3 (Chat loading state — three timer messages → two SSE-driven phases), Screen 4 (AppRunner — single mode → three modes). Tokens, color palette, typography, motion language, A2UI catalog visual treatment all carry forward unchanged.

---

## Design Intent

The umbrella shipped _"this is mine."_ This slice ships _"this is ours."_ — without losing the private, low-stakes feel of the first sketch. Three feelings to hold simultaneously, ordered by sensitivity:

1. **Belonging** _(new — primary for browser-makers)_ — "Other people are doing this. I'm in good company. There are starting points if I'm stuck."
2. **Pride** _(new — primary for makers post-publish)_ — "I made something good enough to put my name on. It's out there with my handle."
3. **Safety** _(carryover, sharpened)_ — "Nothing leaves my drafts unless I tap Publish. The words I typed don't go public until I say so. I can pull it back."

Anti-feelings to actively design _against:_

- _Performance pressure_ — the Library is for inspiration, not measurement. No like counts, no view counts, no leaderboards in v1. (The KPIs are _ours_; testers don't see them.)
- _Confused ownership_ — Try-mode must be _unambiguously_ "this is someone else's app." The visual disambiguation is non-negotiable.
- _Empty-shelf feeling_ — first-launch Library must be populated (cold-start seeds, AC-CG-S1–S3). Empty Library = dead product.

The two-stage loading state is the most subtle intent: it must feel like the assistant is _thinking_, not stuck. Real server events drive the transitions — no fake-progressing fiction. Honesty buys trust on the wait, which we cash in on every subsequent generation.

---

## Jobs-to-be-Done

### The Maker (carries from umbrella, sharpened)

> **When** I have an idea for an app I want to use or show someone,
> **I want to** describe it in plain language, see it real, and put it where my friends can see what I made,
> **so I can** demo it, validate the idea, or just enjoy _having shipped a thing_.

New since umbrella: the "put it where my friends can see" clause. The maker now has an audience.

### The Browser-Maker (new)

> **When** I open the app and don't have an idea yet — or I want to see if this thing is _real_,
> **I want to** scroll through what other people have built and try a few of them,
> **so I can** decide whether to invest energy in describing my own idea, and find a starting point if I do.

**Current solution:** Twitter screenshots, Product Hunt demos, Pinterest boards. None are interactive. **Pain:** "I see the picture but can't tell if the buttons actually do anything." **Consequences:** Skepticism — people expect AI demos to be all hat and no cattle. They bounce before describing anything.

The Library/Try loop is the answer to that skepticism: _here's a working artifact, made by a real person, that does what it says_. Try it. Then make your own.

---

## User Journey Map

The umbrella's stages 1–5 carry. New stages inserted between Stages 1 and 2, and after Stage 4:

### Stage 1.5 — First Browse _(new — Browser-Maker entry)_

|                 |                                                                                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Doing**       | Lands on Home post-sign-in. Library tab is default. Sees a list of tiles by handles they don't know yet. Scrolls.                                                                     |
| **Thinking**    | "Wait — there's stuff here? Who made these? Are they real?"                                                                                                                           |
| **Feeling**     | Curiosity tinged with skepticism. The interactive promise is unverified.                                                                                                              |
| **Pain**        | If tiles look generated/fake, skepticism wins. If tiles look hand-made and labeled, curiosity wins.                                                                                   |
| **Opportunity** | Tile design must communicate _"a real person made this"_ — handle (`@alyona`) is the credibility signal. Featured badge on `@example` tiles is the disclaimer that protects the rest. |

### Stage 1.6 — First Try _(new)_

|                 |                                                                                                                                                          |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Doing**       | Taps a tile. AppRunner loads in Try mode. Pokes the buttons.                                                                                             |
| **Thinking**    | "OK this is real. The toggle actually works. Can I make one?"                                                                                            |
| **Feeling**     | Surprise → "I want one of these" → activation energy.                                                                                                    |
| **Pain**        | If Try mode visual is identical to Owner mode, the user gets confused — they think they're editing someone else's app. Disambiguation is the whole game. |
| **Opportunity** | The Try-mode banner _("Trying @alyona's app — your taps don't save")_ is a cheat code: it tells the user the rules and primes them for the Remix CTA.    |

### Stage 4.5 — First Publish _(new — Maker side)_

|                 |                                                                                                                                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Doing**       | App generated, in AppRunner Owner mode. Sees Publish CTA in top bar. Taps it. Bottom sheet asks for handle (pre-filled). Confirms.                                                                                              |
| **Thinking**    | "Hm, my handle is `@alyona`? OK that's fine. … Wait, immutable? OK."                                                                                                                                                            |
| **Feeling**     | Brief commitment moment, then quiet pride.                                                                                                                                                                                      |
| **Pain**        | If the handle field is blank or the regex rejects something obvious, friction kills publish-rate. The pre-fill is critical. If publishing is reversible (it is — Unpublish exists), that should be visible from the sheet copy. |
| **Opportunity** | One-tap path: "Publish as @alyona" → tap Publish → done. Three taps total: Publish CTA → confirm in sheet → success. The handle field is _editable_ but doesn't _require_ editing.                                              |

### Stage 4.7 — First Remix _(new — Browser-Maker side)_

|                 |                                                                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Doing**       | In Try mode on someone's app. Taps Remix. Lands on Chat with the prompt pre-filled and an attribution chip above the input.                                                    |
| **Thinking**    | "I want to change the colors. Let me edit the prompt. Or just hit Send?"                                                                                                       |
| **Feeling**     | Ownership transfers — _the maker's prompt becomes my starting point_.                                                                                                          |
| **Pain**        | If the chip is just decoration and doesn't carry parent_project_id forward, provenance breaks silently. If the chip can't be cleared, the user feels coerced into attribution. |
| **Opportunity** | The chip is dismissible (the × control), and dismissing clears `parent_project_id`. Tester can choose to remix-with-attribution or fork-clean.                                 |

---

## User Flow

### Happy Path — Browser → Try → Remix → Publish

```
Sign-In (existing) → Home (default tab: Library)
    │
    ▼ scroll Library tab
    │
Library tile list (cold-start: ~5 @example tiles + recent maker tiles)
    │
    ▼ tap @lucy's tile
    │
AppRunner — TRY MODE
    │  Top bar:    [← back]  [@lucy's Streak Tracker]
    │  Banner:     🔍 Trying @lucy's app — your taps don't save
    │  Body:       <rendered A2UI tree>
    │  Bottom FAB: [✨ Remix this app]
    │
    ▼ tap Remix FAB
    │
Chat screen — REMIX MODE
    │  Top bar:        [← back]  [New app]
    │  Above input:    🌀 Remixing from @lucy [×]
    │  Input:          <pre-filled with @lucy's original prompt, editable>
    │  Send button:    enabled
    │
    ▼ edit prompt → tap Send
    │
Chat screen — TWO-STAGE LOADING
    │  User bubble appears (right-aligned).
    │  Assistant bubble: "Thinking about your idea…" (until building_started SSE event)
    │  Assistant bubble: "Building your app…" (until done SSE event)
    │
    ▼ /generate done event (~60–120s)
    │
AppRunner — OWNER MODE (PRIVATE)
    │  Top bar:    [← back]  [<auto-title>]  [Publish ↑]
    │  Body:       <rendered A2UI tree>
    │
    ▼ tap Publish
    │
Bottom sheet — PUBLISH (first time for this user)
    │  Header:     "Publish to Library?"
    │  Field:      [@] [alyona____________]   ✓ Available
    │  Helper:     3–20 chars · lowercase · letters, numbers, dashes
    │  Lock copy:  You can't change this later.
    │  Warning:    Publishing exposes the words you typed.
    │  CTAs:       [Cancel]   [Publish]   ← primary
    │
    ▼ tap Publish
    │
AppRunner — OWNER MODE (PUBLIC)
    │  Top bar:    [← back]  [<title>]  [Unpublish ↓]
    │  Toast:      ✓ Published to Library — auto-dismiss 2s
    │
    ▼ tap back
    │
Home — auto-switches to "My apps" tab — new tile at top with "Published" pill
```

### Happy Path — Maker (no Remix, no Browser entry)

Identical to umbrella's happy path through generation. Then post-generation enters AppRunner Owner mode → Publish sheet (same as above) → Library.

### Error & Edge Cases

The umbrella's full error map carries unchanged for `/generate`. New error rows added for the marketplace flows:

| Trigger                                                                           | Behavior                                                                                                                                                                                                                                                           |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Publish: handle taken**                                                         | Sheet stays open. Field shows red border. Inline error below field: "Handle taken. Try another." Field stays focused.                                                                                                                                              |
| **Publish: invalid handle format** (regex fail, debounced 500ms)                  | Field shows red border. Helper text becomes red: "Handles use 3–20 lowercase letters, numbers, or dashes." Submit disabled.                                                                                                                                        |
| **Publish: handle already validated, then race-loses on submit**                  | Server returns `handle_taken` even though debounced check passed. Sheet field re-focuses, inline error: "Handle taken — that one was just claimed. Try another."                                                                                                   |
| **Publish: network error**                                                        | Sheet stays open. Inline error in destructive bg: "Couldn't publish. [Try again]" — Try again retries the request.                                                                                                                                                 |
| **Publish: project is in zombie state** (`invalid_state` from server)             | Toast: "This app couldn't be published. Try recreating it." — sheet dismisses.                                                                                                                                                                                     |
| **Unpublish: confirmation**                                                       | iOS-native action sheet: "Unpublish '<title>'? Other makers won't see it anymore. Your draft stays." [Unpublish] [Cancel]. Unpublish is **destructive-styled** (red text).                                                                                         |
| **Unpublish: success**                                                            | Toast: "Unpublished." Top bar swaps to Publish CTA. Tile in Library disappears on next scroll/refresh.                                                                                                                                                             |
| **Unpublish: network error**                                                      | Toast: "Couldn't unpublish. Try again." State unchanged.                                                                                                                                                                                                           |
| **Try-mode: tap Remix while parent was just unpublished**                         | Chat opens with prompt pre-filled. Top of message thread shows banner: "The original was removed by its maker." Chip still says "Remixed from @lucy" but is non-tappable. Generation still works; new project still saves with `parent_project_id` for provenance. |
| **Try-mode: parent was deleted entirely** (Phase 2 deletion path; defensive only) | Same as above — banner copy: "The original is no longer available."                                                                                                                                                                                                |
| **Library: empty (seeds failed to load too)**                                     | Empty state: 🌱 "Nothing here yet." subhead "Be the first to publish — describe an idea." CTA: "Create new app".                                                                                                                                                   |
| **Library: offline**                                                              | Last-cached tiles remain visible (read-only). Top banner: "You're offline — content may be stale." Tap-to-detail disabled.                                                                                                                                         |
| **Library: tap on tile that was just unpublished by owner**                       | Loading state for ~150ms → toast: "That app was just removed." Pop back to Library tab.                                                                                                                                                                            |
| **My apps: empty**                                                                | Empty state: 📝 "Your drafts are empty." CTA: "Create new app".                                                                                                                                                                                                    |
| **My apps: error loading**                                                        | Empty state: ⚠️ "Couldn't load your apps." CTA: "Pull to retry".                                                                                                                                                                                                   |
| **Two-stage loading: SSE silent for >30s**                                        | Loading bubble adds a third static phase: "Still working…" (after 30s of any single phase). No timer-driven cosmetic transitions; this is a real-silence indicator.                                                                                                |
| **Two-stage loading: SSE drops**                                                  | Toast: "Connection lost. We saved your draft — check My apps." Auto-navigates back to Home, switches to My apps tab.                                                                                                                                               |
| **Browser-Maker tries to Publish while in `skipAuth` dev bypass**                 | Publish CTA tap → toast: "Sign in to publish." No sheet.                                                                                                                                                                                                           |
| **Browser-Maker tries to Remix while in `skipAuth`**                              | Remix FAB tap → toast: "Sign in to make your own." Chat doesn't open.                                                                                                                                                                                              |
| **Featured tile (`@example`)**                                                    | Identical interaction model to maker tiles. Visually distinguished by "Featured" pill inline with handle. No Remix attribution path is special — remixing a featured tile sets `parent_project_id` to the seed project, same as any other parent.                  |

---

## Screen-by-Screen Design

### Screen 2 (replaces umbrella): Home — two tabs

**Purpose:** Show the maker community AND the maker's own work in a single screen. Tabs let one persona (Browser-Maker) live in Library, and another (Maker) live in My apps, without a router-level split.

**Layout (top → bottom):**

- Top safe area
- Top bar: leading Logo (small wordmark, left) + trailing Settings gear icon (right, hit target 44×44)
- **Tab bar** (segmented control style — _not_ iOS UITabBar; this is a horizontal segmented control between top bar and content):
  - Two segments: **Library** | **My apps**
  - Active segment has bg.primary tint at 12% + primary text; inactive segments have text.muted
  - Below segmented control: 1px hairline border.subtle (full-width)
  - Hit target per segment ≥ 44pt vertical
- Hero CTA: full-width Card-shaped button, primary variant, "✨ Create new app" — sticky below the tab bar regardless of active tab
- Content: list of tiles (Library tiles or My-apps tiles depending on active tab)
- Bottom safe area

**Sub-screen: Library tab**

| State                    | What changes                                                                                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Default (with seeds)** | List shows tiles from `GET /library`, ordered by `published_at DESC`. Featured @example tiles appear at the bottom (back-dated `published_at`); real maker tiles surface above as soon as they publish. |
| **Loading**              | 5 skeleton tiles (shimmer).                                                                                                                                                                             |
| **Empty (seeds failed)** | "🌱 Nothing here yet." + subhead + CTA "Create new app". Hero CTA above remains.                                                                                                                        |
| **Error**                | "Couldn't load the Library." + "Pull to retry."                                                                                                                                                         |
| **Offline**              | Top banner "You're offline — content may be stale." + last-cached tiles visible read-only.                                                                                                              |
| **Pagination loading**   | Trailing skeleton tile appears during cursor-fetch.                                                                                                                                                     |

**Sub-screen: My apps tab**

| State                                                | What changes                                                                                                                                          |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Default**                                          | List from `GET /me/projects`, ordered by `updated_at DESC`. Each tile carries a "Published" pill if `visibility = 'public'`.                          |
| **Loading**                                          | 3 skeleton tiles.                                                                                                                                     |
| **Empty**                                            | "📝 Your drafts are empty." + CTA "Create new app".                                                                                                   |
| **Error**                                            | Same pattern as Library.                                                                                                                              |
| **Auto-switch on return from successful generation** | If user came from Chat → AppRunner → tap-back, Home opens with My apps tab pre-selected and a toast "Saved to your apps". The new tile is at the top. |

**Interactions:**

- Tap segmented-control segment → switch tab. Animation: 200ms crossfade between content lists. Reduced motion: instant swap.
- Tap "Create new app" → push Chat (always — same on both tabs).
- Tap a Library tile → push AppRunner in Try mode.
- Tap a My-apps tile → push AppRunner in Owner mode.
- Pull to refresh on either tab → re-fetches that tab's query. Both tabs maintain independent fetch states.
- Scroll to bottom of Library → trigger next-page cursor fetch (handled by the query hook). My apps doesn't paginate (small N).

**Tab-state persistence:**

- Last-selected tab persists in MMKV tier-3 (`home.lastTab`).
- Default for first-ever-launch: **Library**. Rationale: makers with 0 drafts should see what's possible _first_. Returning makers naturally switch to My apps via their own intent.
- After successful generation, force-switch to My apps (overrides last-tab).

**Accessibility:**

- Segmented control: each segment is `accessibilityRole="tab"`, with `accessibilityState={selected: <bool>}`.
- Library tile: `accessibilityLabel="<title>, by @<handle>, published <relative time>, double-tap to try"`.
- My-apps tile (private): `accessibilityLabel="<title>, draft, last edited <relative time>"`.
- My-apps tile (public): `accessibilityLabel="<title>, published <relative time>, double-tap to open"`.
- Featured tile: append "Featured" before the handle in the label.
- Empty-state CTA: focus jumps to it on render.
- VoiceOver swipe-down (rotor) cycles tiles.

**Responsive:**

- Single column always. Tile width = full width − 2× lg padding.
- iPhone SE: tab bar segments compress to text-only; no icons.
- iPhone Pro Max: tile spacing scales with `lg`, no extra columns (intentional — no grid yet).

**Reduced Motion:**

- Tab transitions: instant swap (no crossfade).
- Skeleton shimmer: replaced by static placeholder blocks.

---

### Screen 2.5 (new): Library Tile

**Purpose:** A single tile must communicate, in <1 second of glance: what it is, who made it, when, and (if applicable) what it remixes.

**Layout (left → right within the tile):**

```
┌─────────────────────────────────────────────────────────────┐
│ <Title (text_md, font_semibold, 1 line, ellipsize)>     ›   │
│ by @<handle>  ·  <relative time>                            │
│ ↳ remixed from @<parent.author>   [optional, third line]   │
└─────────────────────────────────────────────────────────────┘
```

Featured variant (only for `@example` tiles):

```
┌─────────────────────────────────────────────────────────────┐
│ <Title>   [Featured]                                    ›   │
│ by @example  ·  <relative time>                             │
└─────────────────────────────────────────────────────────────┘
```

**Tokens:**

- Tile: bg.surface, padding `md`, radius `md`, border subtle bottom only (border.subtle, 1px), tappable area = full row.
- Title: text_md / font_semibold / text.primary.
- Attribution line: text_sm / regular / text.muted. The `@<handle>` substring is text.primary (not muted) to make the handle pop.
- Remix line: text_sm / regular / text.muted. Leading `↳` glyph. The `@<parent.author>` is text.primary.
- "Featured" pill: text_xs (12pt) / font_semibold / palette.primary text on bg.subtle, padding `2xs` `xs`, radius `sm`, inline next to title with `xs` left margin.
- Trailing chevron: lucide `chevron-right`, 20×20pt, text.muted.
- Pressed state: 6% darken overlay on the tile background, 80ms.

**Variants:**
| Variant | When | Difference |
|---|---|---|
| `library-default` | Library tab tile, real maker | Shows "by @handle · time", optional remix line |
| `library-featured` | Library tab tile, `@example` | Shows "Featured" pill inline with title; "by @example" still shown |
| `myapps-private` | My apps tab, private project | No "by ..." line (it's the user's own); subhead is "Created <time>" or "Edited <time>"; no "Published" pill |
| `myapps-public` | My apps tab, published project | Same as myapps-private but with "Published" pill (text_xs / font_semibold / primary.fg on bg.primary, inline with title) |

**My-apps variants — no attribution** because the user owns these. The "Edited X ago" subhead is `updated_at`-based.

**Interactions:**

- Tap → push AppRunner. Library tile → Try mode. My-apps tile → Owner mode.
- Long-press (Phase 2): Edit/Delete/Unpublish menu. Out of scope at v1; reserved gesture.

---

### Screen 3 (sharpened): Chat

**What carries from umbrella:** layout (top bar + thread + input bar), welcome card with example chips, character counter, send button mechanics, error toasts, accessibility patterns.

**What changes:**

#### A. Two-stage loading (replaces umbrella's three-timer messaging)

The umbrella ran three messages on a client timer:

- "Reading your idea…" (0–5s)
- "Picking components…" (5–20s)
- "Putting it together…" (20–90s)

These were a fiction. This slice replaces them with two **server-driven** phases:

| Phase                       | Trigger                                                                     | Loading bubble copy                                         |
| --------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Phase 1 (extended thinking) | Receipt of `thinking_started` SSE event (at `/generate` request acceptance) | "Thinking about your idea…"                                 |
| Phase 2 (tool use)          | Receipt of `building_started` SSE event (when Anthropic transitions phases) | "Building your app…"                                        |
| Stalled                     | 30s of silence within either phase                                          | "Still working…" (passive — replaces current copy in place) |

**No client-side timers.** The loading-bubble copy changes only on real server events. If Phase 1 takes 8s, the transition to Phase 2 happens at 8s. If Phase 1 takes 45s, the user stays on "Thinking…" for 45s — and the "Still working…" stall message kicks in at 30s.

**Reduced motion:** copy changes via crossfade (already minimal); no slide.

**Live-region announce:** `accessibilityLiveRegion="polite"` on the loading bubble. VoiceOver announces "Thinking about your idea" once on Phase 1 entry, "Building your app" once on Phase 2 entry. _Do not_ announce "Still working" on stall — would chatter. Instead, on `done` event, announce "Your app is ready" — single confirmation.

#### B. Remix attribution chip (new — appears when arrived from Try mode)

When the user arrives at Chat via the Remix CTA from Try mode, the input bar gets an additional row above it:

```
┌──────────────────────────────────────────┐
│ 🌀 Remixing from @lucy            [ × ]  │  ← chip row, sticky above input
├──────────────────────────────────────────┤
│ <pre-filled prompt, editable>            │  ← input bar
│                                  [Send ▶]│
└──────────────────────────────────────────┘
```

**Chip design:**

- Pill-shaped container, bg.subtle, radius `full`, padding `xs` `sm`.
- Leading icon: lucide `git-branch` (or fallback `repeat`), 16×16pt, text.muted.
- Label: text_sm / regular. The substring `@<handle>` is text.primary.
- Trailing × close affordance: lucide `x`, 14×14pt, text.muted, hit target 44×44 invisible padding.
- Tap on chip body itself: no-op at v1 (Phase 2 candidate: shows parent in modal).

**Behavior:**

- Pre-fills the prompt input from the parent's `original_prompt`.
- Carries `parent_project_id` in component state until Send. On Send, included in `/generate` body.
- Tap × → animates chip out (200ms slide-up + fade), input field retains its current text, `parent_project_id` cleared. Subsequent generation creates a non-remix project.
- If user navigates away from Chat (back to Home) and comes back, chip is gone, parent state cleared.
- If parent was unpublished/deleted in the interim, chip stays but a banner appears at the top of the message thread: "The original was removed by its maker." (See Error map.)

**Accessibility:**

- Chip: `accessibilityRole="button"`, label "Remixing from @lucy. Activate the close button to clear."
- × control: `accessibilityRole="button"`, label "Clear remix attribution".
- Live-region announce on entry: "Remixing from @lucy".

#### C. Cancel-during-generation (carries from umbrella, reaffirmed)

Per Robert's open-question call: cancel stays Phase 2. The Chat back arrow during loading triggers the umbrella's confirmation alert ("Cancel this generation? It's almost done — leaving will lose progress."). Server-side request continues; if it succeeds, project saves to My apps; user finds it on next refresh.

**Reduced motion:** alert is iOS-native; respects system setting.

---

### Screen 4 (replaces umbrella — three modes): AppRunner

**Purpose:** Render the spec. Make ownership context unmistakable.

The umbrella defined a single mode. This slice introduces three. The renderer body (the A2UI tree) is identical across modes — only the chrome and CTAs differ.

#### Common layout

```
┌────────────────────────────────────────────────────┐
│ [← back]   <Title>                       [<CTA>]   │  Top bar (44pt)
├────────────────────────────────────────────────────┤
│                                                    │
│ <optional contextual banner>                       │  ← only in Try mode
│                                                    │
├────────────────────────────────────────────────────┤
│                                                    │
│ <rendered A2UI tree, scrollable>                   │  Body
│                                                    │
│                                                    │
│                                                    │
│                                                    │
│                                                    │
│                                       [<FAB>]      │  ← only in Try mode
└────────────────────────────────────────────────────┘
```

#### Mode A: Owner (private)

|                          |                                                                             |
| ------------------------ | --------------------------------------------------------------------------- |
| **Top bar trailing CTA** | **Publish** button (text_sm / font_semibold / primary). Hit target ≥ 44×44. |
| **Banner**               | None.                                                                       |
| **FAB**                  | None.                                                                       |
| **Renderer state**       | Hydrated from MMKV tier-3 (per-user persistence).                           |
| **Tap Publish**          | Opens publish bottom-sheet (Screen 5).                                      |
| **Tap back**             | Pop to Home (My apps tab).                                                  |

#### Mode B: Owner (public)

|                          |                                                                                                                                                                                                                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Top bar trailing CTA** | **Unpublish** button (text_sm / font_semibold / **destructive** color). Hit target ≥ 44×44. Subtle: this CTA reads as "this is a destructive-ish action" because it removes from the Library.                                                                           |
| **Banner**               | Optional thin subtle banner under top bar: _"Published to Library"_ (text_sm / text.muted / centered / bg.subtle / 32pt height). Only on first-load post-publish; auto-collapses after 3s. Reduced motion: stays static, dismissible by tap. _— design call, optional._ |
| **FAB**                  | None.                                                                                                                                                                                                                                                                   |
| **Renderer state**       | Same as Owner-private.                                                                                                                                                                                                                                                  |
| **Tap Unpublish**        | iOS action sheet (NOT bottom sheet — destructive needs system patterns) confirming the action. Per error map.                                                                                                                                                           |
| **Tap back**             | Pop to Home (whatever tab user was on).                                                                                                                                                                                                                                 |

#### Mode C: Try (browser viewing someone else's app)

|                          |                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Top bar trailing CTA** | None — no Publish, no Edit.                                                                                                                                                                                                                                                                                                                                   |
| **Banner**               | **Mandatory.** Slim under top bar. Background: bg.subtle. Content: lucide `eye` icon (16pt, text.muted) + body text "Trying @lucy's app — your taps don't save" (text_sm / text.muted). Right-aligned: small "Made by @lucy" chip (caption / text.primary). Banner height 36pt + safe-area-respecting margin. Sticky — does not scroll with body.             |
| **FAB**                  | **Mandatory.** Floating action button, bottom-right, anchored to safe area + lg margin. Pill-shaped: 56pt height, padding `lg` horizontal. bg.primary / primary.fg. Content: lucide `git-branch` icon (20pt) + label "Remix this app" (text_md / font_semibold). Shadow `shadow_md`. **Always visible** even during scroll. Hit target = entire FAB, ≥ 56×56. |
| **Renderer state**       | `state = {}` initialized fresh on screen entry. Dropped on screen exit. **No MMKV writes in this mode** (AC-CG-A2).                                                                                                                                                                                                                                           |
| **Tap Remix FAB**        | Push Chat in Remix mode (chip pre-attached, prompt pre-filled).                                                                                                                                                                                                                                                                                               |
| **Tap back**             | Pop to Home (Library tab). State discarded.                                                                                                                                                                                                                                                                                                                   |

**Visual disambiguation rationale:** the Try-mode banner + missing top-bar trailing CTA + presence of the FAB form three independent signals that this is _not_ the user's app. Even if any one signal is missed, the others compensate. Screen-reader users hear the banner via live-region + the FAB via tab order.

#### Cross-mode states (carry from umbrella, sharpened)

| State                       | What changes                                                                                                                                                                                                               |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Loading saved app**       | Skeleton matches spec structure (per umbrella). Owner modes: skeleton renders against the persisted state for the user. Try mode: skeleton renders against `state = {}`.                                                   |
| **Loaded**                  | Renderer active. State machine functional in all three modes.                                                                                                                                                              |
| **Action: toast**           | Same as umbrella. Toast appears below safe-area, above body, NOT below the Try-mode banner (toast layer is above banners).                                                                                                 |
| **Action: navigate**        | Crossfade between A2UI views inside the body. Top bar back arrow always pops the AppRunner — never "previous A2UI view" (per umbrella).                                                                                    |
| **Render error**            | Same as umbrella's render-error fallback. P0 instrumentation.                                                                                                                                                              |
| **Try mode + render error** | Body replaced with error; banner stays visible; FAB stays visible (user can still tap Remix to make their own). Rationale: don't strand the user — keep the inspiration loop alive even when the source spec can't render. |

**Accessibility (mode-specific):**

- Owner-private top bar: trailing CTA labeled "Publish to Library".
- Owner-public top bar: trailing CTA labeled "Unpublish from Library". `accessibilityHint`: "Removes this app from the public Library. Your draft stays."
- Try-mode banner: `accessibilityLiveRegion="polite"`, on screen entry announces "Trying @lucy's app. Your taps will not save. Activate the Remix button to make your own."
- Try-mode FAB: `accessibilityLabel="Remix this app — describe your version in chat"`, `accessibilityRole="button"`. Tab order places FAB **after** body content (not before) so VoiceOver users hear the rendered app first, then the action.

**Responsive (Try mode):**

- iPhone SE: FAB collapses label to icon-only, 44×44 (still meets hit target).
- iPhone Pro Max: FAB stays as pill with label.

**Reduced motion (Try mode):**

- FAB entrance on screen-load: instant (no scale-up).
- Body actions (counter increment scale) — already covered by umbrella's reduced-motion table.

---

### Screen 5 (new): Publish bottom-sheet

**Purpose:** Give the maker a ~3-tap path from "I made an app" to "it's in the Library", with one inline commitment moment (handle picker) on the first publish only.

**Layout (sheet height: ~50% of screen, swipe-down-to-dismiss):**

#### First-time publish (no `users.handle` set yet)

```
┌─────────────────────────────────────────────────┐
│                                                 │
│    Publish to Library?                          │  Heading text_xl / font_semibold
│                                                 │
│    Pick a handle other makers will see.         │  body / text.muted
│                                                 │
│    ┌─────────────────────────────────────────┐  │
│    │  @  alyona___________________________   │  │  TextInput with @ prefix
│    │                                         │  │
│    └─────────────────────────────────────────┘  │
│    ✓ Available  ·  3–20 chars · letters,        │  helper / inline validation
│      numbers, dashes                            │
│                                                 │
│    You can't change this later.                 │  caption / text.muted
│                                                 │
│    Publishing exposes the words you typed.      │  caption / text.muted
│                                                 │
│                                                 │
│         [ Cancel ]    [ Publish → ]             │  primary CTA right
│                                                 │
└─────────────────────────────────────────────────┘
```

#### Subsequent publish (handle already set)

```
┌─────────────────────────────────────────────────┐
│                                                 │
│    Publish to Library?                          │
│                                                 │
│    You'll publish as @alyona.                   │
│    Other makers will see this in the Library.   │
│                                                 │
│    Publishing exposes the words you typed.      │
│                                                 │
│                                                 │
│         [ Cancel ]    [ Publish → ]             │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Handle field details (first-time only):**

- Label: "Handle" — sits above the input.
- Prefix: `@` — visually inline with input, not editable, palette.muted.
- Pre-fill: server-derived from email local-part (sanitized to match regex). For email `alyona.bahaleisha@gmail.com`, pre-fill = `alyona-bahaleisha` truncated to 20 if needed. Pre-fill happens **before sheet appears** — handle is already in the field on render.
- Inline validation:
  - On every keystroke: regex match `^[a-z0-9-]{3,20}$`. Failure → red border + helper turns red ("Use 3–20 lowercase letters, numbers, or dashes").
  - On regex pass + 500ms debounce: dispatch async availability check (lightweight `GET /handles/check?h=foo` or just attempt via `POST /users/me/handle` with dry-run flag — Cal's call). Helper updates: ✓ Available (green) or ✗ Taken (red).
- Submit (Publish button) is **disabled** when:
  - Field is empty
  - Regex fails
  - Availability check is pending OR returns Taken
- On submit: `POST /projects/:id/publish` with `{handle: <field-value>}` body. Server's `handle_taken` race-loss surfaces inline error and re-focuses field.

**Sheet entry animation:** slide up from bottom, 300ms ease-out (iOS standard). Reduced motion: crossfade in 200ms.

**Sheet exit animations:**

- Cancel / swipe-down: slide down 300ms.
- Successful publish: slide down 200ms + checkmark animation in toast (post-dismissal).

**Accessibility:**

- Heading: `accessibilityRole="header"`.
- Handle field: `accessibilityLabel="Your handle"`. `accessibilityHint="3 to 20 lowercase letters, numbers, or dashes. You can't change this later."`. Auto-focus on sheet open.
- ✓/✗ inline state: `accessibilityLiveRegion="polite"`, announces "Available" or "Taken" after debounce.
- Cancel button: `accessibilityLabel="Cancel — close without publishing"`.
- Publish button: `accessibilityLabel="Publish to Library"`, when disabled `accessibilityState={disabled: true}` + `accessibilityHint` describing why ("Pick a valid available handle to enable").
- Sheet container: `accessibilityViewIsModal={true}` — VoiceOver focus trapped inside sheet.
- Swipe-down dismissal preserves user input only if user swiped (gesture is intentional cancel); if dismissed via Cancel button, also preserve. _Don't_ preserve if Publish succeeded (irrelevant by then).

**Reduced motion:**

- Sheet animation: crossfade only.
- ✓/✗ icon transition: instant swap, no fade.

---

## A2UI catalog visual treatment

**No changes from umbrella.** The 10 components, their visual tokens, action feedback, and snapshot-test discipline all carry. Try-mode and Owner-modes share the same renderer; only the host wraps the renderer with different chrome.

The only delta-relevant note: in Try mode, `dispatch` writes to in-memory state only. The renderer doesn't know the difference. AC-CG-A2 enforces this at the host level (AppRunner passes a different reducer / store for Try mode).

---

## Component Inventory

### App-shell components — delta from umbrella

| Component                    | Status                      | Notes                                                                                                                                                                                                                                                                    |
| ---------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Logo`                       | Carries                     | unchanged                                                                                                                                                                                                                                                                |
| `Button`                     | Carries                     | unchanged (primary, secondary, destructive variants suffice for Publish/Unpublish/Cancel/Remix)                                                                                                                                                                          |
| `TextInput`                  | Modified                    | Add `prefix` prop (for the `@` in handle field). Optional, defaults null                                                                                                                                                                                                 |
| `Card` (library tile)        | New variant — `LibraryTile` | Needs handle attribution, relative time, optional remix line, optional Featured pill, optional Published pill                                                                                                                                                            |
| `EmptyState`                 | Carries                     | use unchanged for Library/My-apps empty states; copy varies                                                                                                                                                                                                              |
| `Skeleton`                   | Carries                     | same shimmer; tile count differs per tab                                                                                                                                                                                                                                 |
| `Toast`                      | Carries                     | unchanged; new copy strings                                                                                                                                                                                                                                              |
| `LoadingBubble`              | Modified                    | Two-phase mode replaces three-phase mode; copy strings change; SSE-driven not timer-driven                                                                                                                                                                               |
| `ChatBubble`                 | Carries                     | unchanged                                                                                                                                                                                                                                                                |
| `ExamplePromptChip`          | Carries                     | unchanged                                                                                                                                                                                                                                                                |
| `BackButton`                 | Carries                     | unchanged                                                                                                                                                                                                                                                                |
| `SafeContainer`              | Carries                     | unchanged                                                                                                                                                                                                                                                                |
| `SegmentedControl`           | New                         | Two-segment tab control on Home. Could use react-native built-in `SegmentedControl` (iOS-native) or a custom component matching theme tokens. _Recommendation: custom — gives us light/dark + token consistency. iOS native segmented control is light-only by default._ |
| `BottomSheet`                | New                         | Modal slide-up sheet for Publish. Use existing primitives (e.g. `react-native-modal` _or_ roll our own with `Animated.View` + backdrop). _Cal: confirm sanctioned dep._                                                                                                  |
| `RemixChip`                  | New                         | Pill above Chat input. Sticky-positioned. Tappable ×                                                                                                                                                                                                                     |
| `Pill`                       | New (atomic)                | Used for "Featured", "Published", and inside `RemixChip`. Variants by tone (subtle, primary, destructive)                                                                                                                                                                |
| `Banner`                     | New                         | Slim contextual strip used in Try-mode AppRunner header and the offline-banner pattern                                                                                                                                                                                   |
| `FAB` (FloatingActionButton) | New                         | Used for Remix in Try mode                                                                                                                                                                                                                                               |
| `ActionSheet`                | New (or wrap iOS-native)    | iOS-native `ActionSheetIOS.showActionSheetWithOptions` for the Unpublish confirmation. Wrap with a typed helper                                                                                                                                                          |
| `HandleField`                | New (compound)              | Prefix `@` + TextInput + inline validation indicator + helper text. Used only in publish sheet. Could be inline in the sheet rather than its own component — Colby's call.                                                                                               |

### A2UI catalog components

**No changes.** All 10 carry from umbrella, all snapshot-tested, all live in `packages/a2ui-renderer/`.

---

## Content & Copy

(Delta-only. Umbrella table carries unchanged for everything not listed below.)

| Element                                                            | Copy                                                    | Notes                                                    |
| ------------------------------------------------------------------ | ------------------------------------------------------- | -------------------------------------------------------- |
| **Replaced from umbrella**                                         |                                                         |                                                          |
| Loading message Phase 1                                            | "Thinking about your idea…"                             | Replaces 3-stage timer messages                          |
| Loading message Phase 2                                            | "Building your app…"                                    | Replaces 3-stage timer messages                          |
| Loading message stalled (after 30s of silence within either phase) | "Still working…"                                        | Replaces ">90s rare" message                             |
| Home title                                                         | "" _(no title — segmented control acts as the heading)_ | Replaces umbrella's "Your apps" title; cleaner with tabs |
| **New**                                                            |                                                         |                                                          |
| Home tab — Library                                                 | "Library"                                               | Single word, neutral                                     |
| Home tab — My apps                                                 | "My apps"                                               | Possessive, mirrors umbrella's "Your apps" voice         |
| Library empty (seeds failed)                                       | "Nothing here yet."                                     | Apologetic but not pleading                              |
| Library empty subhead                                              | "Be the first to publish — describe an idea."           | Action-forward                                           |
| Library empty CTA                                                  | "Create new app"                                        | Same as Home hero CTA                                    |
| Library tile attribution                                           | "by @{handle} · {time}"                                 | Middle dot separator                                     |
| Library tile remix line                                            | "↳ remixed from @{parent.author}"                       | Leading arrow glyph; muted                               |
| Library tile Featured pill                                         | "Featured"                                              | Title-case                                               |
| My apps empty                                                      | "Your drafts are empty."                                | Mirrors umbrella's "Your library is empty."              |
| My apps empty subhead                                              | "Tap **Create new app** to make your first one."        | Bolds the CTA reference                                  |
| My apps tile (private) subhead                                     | "Edited {time}"                                         | Or "Created {time}" if updated_at == created_at          |
| My apps tile (public) Published pill                               | "Published"                                             | Title-case, primary tone                                 |
| AppRunner top bar — Publish CTA                                    | "Publish"                                               | Verb-first                                               |
| AppRunner top bar — Unpublish CTA                                  | "Unpublish"                                             | Verb-first; destructive color                            |
| AppRunner Try-mode banner                                          | "Trying @{handle}'s app — your taps don't save"         | Honest about the rules                                   |
| AppRunner Try-mode banner — short variant (small screens)          | "Trying @{handle}'s — taps don't save"                  | iPhone SE                                                |
| AppRunner Try-mode FAB                                             | "Remix this app"                                        | Primary CTA                                              |
| AppRunner Try-mode FAB — short variant (icon-only on SE)           | (no text — git-branch icon only)                        | a11y label still "Remix this app"                        |
| Chat — remix chip                                                  | "Remixing from @{handle}"                               | Chip body                                                |
| Chat — remix chip × a11y label                                     | "Clear remix attribution"                               | —                                                        |
| Chat — remix-parent-removed banner                                 | "The original was removed by its maker."                | Honest, non-blaming                                      |
| Publish sheet — heading                                            | "Publish to Library?"                                   | Question form softens commitment                         |
| Publish sheet — first-time body                                    | "Pick a handle other makers will see."                  | One sentence                                             |
| Publish sheet — first-time helper (default)                        | "3–20 chars · letters, numbers, dashes"                 | Format hint                                              |
| Publish sheet — first-time helper (regex fail)                     | "Use 3–20 lowercase letters, numbers, or dashes."       | Specific error                                           |
| Publish sheet — first-time helper (available)                      | "✓ Available"                                           | Green icon + text                                        |
| Publish sheet — first-time helper (taken)                          | "✗ Handle taken — try another"                          | Red icon + text                                          |
| Publish sheet — first-time helper (checking)                       | "Checking…"                                             | While debounce + fetch in flight                         |
| Publish sheet — first-time lock copy                               | "You can't change this later."                          | Plain commitment                                         |
| Publish sheet — warning copy                                       | "Publishing exposes the words you typed."               | Honest about prompt visibility                           |
| Publish sheet — subsequent body                                    | "You'll publish as @{handle}."                          | Reminder, no commitment                                  |
| Publish sheet — subsequent body line 2                             | "Other makers will see this in the Library."            | Reminder of audience                                     |
| Publish sheet — Cancel button                                      | "Cancel"                                                | Neutral                                                  |
| Publish sheet — Publish button                                     | "Publish"                                               | Primary action                                           |
| Publish sheet — network error                                      | "Couldn't publish. Try again."                          | Inline, not toast                                        |
| Publish toast (success)                                            | "✓ Published to Library"                                | 2s auto-dismiss                                          |
| Unpublish action sheet — title                                     | "Unpublish '{title}'?"                                  | Quoted title for clarity                                 |
| Unpublish action sheet — body                                      | "Other makers won't see it anymore. Your draft stays."  | Reassures about draft retention                          |
| Unpublish action sheet — destructive button                        | "Unpublish"                                             | Red, iOS-native destructive style                        |
| Unpublish action sheet — cancel                                    | "Cancel"                                                | iOS-native cancel button                                 |
| Unpublish toast (success)                                          | "Unpublished."                                          | Terse; 2s auto-dismiss                                   |
| Unpublish toast (error)                                            | "Couldn't unpublish. Try again."                        | Toast, not inline                                        |
| Library tile — tap on unpublished item toast                       | "That app was just removed."                            | After 404                                                |
| Library — offline banner                                           | "You're offline — content may be stale."                | Top of Library tab                                       |
| Auth-gated CTA toast (skipAuth bypass) — Publish                   | "Sign in to publish."                                   | Direct                                                   |
| Auth-gated CTA toast (skipAuth bypass) — Remix                     | "Sign in to make your own."                             | Direct                                                   |
| Post-generation toast on return to Home                            | "Saved to your apps"                                    | Auto-switches to My apps tab                             |

---

## Iconography

(Delta from umbrella.)

| Icon                                 | Source          | Use                                                                               |
| ------------------------------------ | --------------- | --------------------------------------------------------------------------------- |
| `git-branch` (or fallback `repeat`)  | lucide          | Remix CTA + Remix chip leading icon                                               |
| `eye`                                | lucide          | Try-mode banner leading icon                                                      |
| `x`                                  | lucide          | Remix chip dismiss + sheet/banner dismiss                                         |
| `at-sign` (or just static `@` glyph) | lucide / inline | Handle field prefix — recommend static glyph for crispness                        |
| `check`                              | lucide          | Inline "Available" indicator + Published toast                                    |
| `arrow-up-right`                     | lucide          | Optional — could decorate Publish CTA. Decision: skip for now, keep CTA text-only |

All from lucide (already in umbrella's pick). No new icon library required.

---

## Animation & Motion

(Delta from umbrella; all umbrella entries carry.)

| Element                                             | Motion                                                                                                         | Reduced                     |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Tab segment switch on Home                          | Crossfade between tab content lists, 200ms                                                                     | Instant swap                |
| Library tile press                                  | 6% darken overlay, 80ms                                                                                        | Same                        |
| AppRunner Try-mode FAB entrance                     | Scale 0.85 → 1.0 + fade, 250ms ease-out                                                                        | Instant; no scale, no fade  |
| Publish bottom-sheet entry                          | Slide up + backdrop fade, 300ms ease-out                                                                       | Crossfade 200ms             |
| Publish bottom-sheet exit (cancel)                  | Slide down, 250ms ease-in                                                                                      | Crossfade 200ms             |
| Publish bottom-sheet exit (success)                 | Slide down + post-dismissal toast slide-down + ✓ icon scale-pop in toast (1.0 → 1.15 → 1.0, 250ms)             | Crossfade only; no scale    |
| Handle field validation icon (✓ / ✗)                | Crossfade 150ms                                                                                                | Instant                     |
| Remix chip entrance                                 | Slide up + fade from below input, 200ms                                                                        | Fade only                   |
| Remix chip dismissal (× tap)                        | Slide up + fade out, 200ms                                                                                     | Fade only                   |
| Loading bubble phase transition (Phase 1 → Phase 2) | Crossfade 200ms (same as umbrella)                                                                             | Crossfade (already minimal) |
| Two-stage loading "Still working" stall transition  | Crossfade 200ms                                                                                                | Crossfade                   |
| Remix-parent-removed banner appearance in Chat      | Slide down from top of message thread, 200ms                                                                   | Fade only                   |
| Try-mode banner appearance                          | Already-present on screen-load; no separate entrance. If banner dismisses via Phase 2 future feature: slide-up | n/a                         |

---

## Theming

No changes from umbrella. All new components honor `useTheme()`.

---

## Design Decisions & Rationale

| Decision                                                        | Why                                                                                                                                                                                                                                   | Alternative considered                                                                                                                                                                 |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Two-tab Home (Library + My apps) over separate routes           | Two views, one screen, single mental model. The user always knows where they are; switching tabs is faster than navigating to a different route. Browser-Maker can live in Library; Maker can live in My apps.                        | Bottom tab bar: rejected, only 2 destinations doesn't justify the chrome. Separate routes via top-bar dropdown: rejected, feels Web-y on iOS.                                          |
| Default tab = Library on first launch                           | First-time user has 0 drafts; My apps is empty. Library has seeds; it's never empty. Showing the populated tab maximizes Stage 1.5 (First Browse) impact.                                                                             | Default to My apps: rejected, users see emptiness and bounce.                                                                                                                          |
| Auto-switch to My apps after generation                         | The user just made something; their next step is to see/publish it. Forcing a tab swap surfaces their work without requiring an extra tap.                                                                                            | Stay on origin tab: rejected, makes the just-saved app feel invisible.                                                                                                                 |
| Library tile is text-only (no preview thumbnail)                | Generating preview thumbnails server-side is significant infra (offscreen render, canvas snapshot, upload). At v1 scale (≤20 testers), text + handle attribution is enough credibility signal.                                        | Thumbnail tiles: deferred to Phase 2 — the right call once the marketplace exceeds ~50 published apps.                                                                                 |
| Featured pill is inline next to title (not a corner adornment)  | Corner adornments compete with the trailing chevron and look like status-light badges. Inline is honest: "Featured" is a property of the tile, not a decoration.                                                                      | Top-right corner pill: rejected. Background tint for whole tile: rejected, draws too much attention; seeds shouldn't outshine real maker work.                                         |
| Try-mode uses both a banner AND a missing top-bar CTA AND a FAB | Three independent disambiguation signals. Banner is the explicit text; missing CTA is the structural signal; FAB is the affordance for the next action. Even if one is missed, others compensate. Especially for screen-reader users. | Just a banner: rejected — easy to miss after first read. Just FAB color difference: rejected — too subtle.                                                                             |
| Try-mode FAB anchored bottom-right                              | Standard iOS gesture territory; doesn't conflict with back-arrow at top-left. Floating preserves screen real estate for the rendered app body.                                                                                        | Top-bar trailing CTA: rejected, would compete with potential future Edit/Share CTAs and reads as "this is mine to edit". Bottom bar (full-width): rejected, too heavy; FAB is lighter. |
| Publish sheet over modal screen                                 | Sheet = quick decision; doesn't break the flow of "I just made an app, here's the next step." Modal screen would feel like a settings page.                                                                                           | Full-screen modal: rejected, too heavy. Inline expansion in AppRunner top bar: rejected, no room.                                                                                      |
| Handle field auto-pre-fills from email                          | Reduces commitment moment to "accept the suggestion or edit it." If we presented an empty field, the publish-rate would crater on first publish.                                                                                      | Empty field: rejected. Random suggestion (`@user-37291`): rejected, ugly and impersonal. Force handle setup at sign-in time: rejected per Q4 — onboarding friction.                    |
| Handle is immutable at v1                                       | Phase 2 work (rename + redirect URLs). At MVP, a tester picking a typo'd handle is a known limitation; pre-fill mitigates risk.                                                                                                       | Allow rename: deferred — the engineering for redirect handling, ID propagation, and stale-attribution UI is bigger than the v1 scope.                                                  |
| Lock-copy is direct ("You can't change this later")             | Honest disclosure. If the user lives with their handle, they should know that's the call. Hiding immutability would feel like a trap when they later try to rename.                                                                   | Soften ("Choose carefully"): rejected, vague. Move to settings page: rejected — not surfaced at the moment of decision, fails informed-consent.                                        |
| Unpublish uses iOS action sheet (not bottom sheet)              | Action sheet is iOS's pattern for destructive confirmations. Users recognize it instantly. Bottom sheet would feel like Publish-but-reversed; doesn't trigger destructive-action recognition.                                         | Bottom sheet with destructive button: rejected for pattern mismatch. Inline confirm in top bar: rejected, too subtle.                                                                  |
| Two-stage loading driven by SSE, not timer                      | The umbrella's three-timer cosmetic UX broke whenever real latency varied. SSE events are honest; "Thinking" lasts as long as Anthropic actually thinks. The user sees real progress.                                                 | Keep three-timer fiction: rejected — Robert's Q5 explicit recommendation. Show the actual thinking trace: rejected — out of scope, also exposes raw model output (privacy risk).       |
| "Still working…" stall message at 30s within a phase            | Without a stall indicator, users assume the spinner is broken. Static "Thinking…" for 60s reads as frozen. The "Still working" copy acknowledges the wait without faking progress.                                                    | Animated dots only: rejected — not enough signal at minute-long wait. Real progress %: not feasible (no tokens-emitted signal).                                                        |
| Remix chip is dismissible                                       | Avoids coercing attribution. A maker who wants to fork without credit is a real (if rare) case; respecting their choice is more honest than forced attribution. The maker's `parent_project_id` still gets cleared properly.          | Force attribution: rejected — coercive. Offer two CTAs ("Remix" vs "Fork clean"): rejected — too much choice up front, decision paralysis.                                             |
| `RemixChip` is sticky above input (not in the message thread)   | The chip is _contextual to the input_, not historic — it's a flag on the next message, not a past message. Threading it into the chat history would make it look like an assistant utterance.                                         | Inside thread as system message: rejected — wrong information architecture.                                                                                                            |
| No like / view counts on Library tiles in v1                    | Performance pressure is the wrong incentive for an internal-tester maker community. Counts encourage gaming and discourage publishing flawed-but-honest work. Phase 2: revisit if signal data shows engagement plateau.               | Show counts: rejected for v1 — defer until we know what signals matter at scale.                                                                                                       |
| Banner ("Trying @lucy's app") doesn't auto-dismiss              | The disambiguation signal must be persistent. If it auto-dismisses after 5s, late-engaging users (scrolling slowly) miss it.                                                                                                          | Auto-dismiss: rejected. Toast-only: rejected — no persistence.                                                                                                                         |
| Renamed "Drafts" → "My apps"                                    | Spec says My apps shows both private + public. "Drafts" implies private-only. "My apps" is honest about the mixed contents and reads warmer than "Mine" or "You".                                                                     | "Drafts": rejected — misleading. "Mine": rejected — clipped, jargon-y. "Your apps" (umbrella's home title): repurposed at the tab level, clearer than at the screen level.             |

---

## Notes for Cal

The architectural reads from this UX doc:

1. **`SegmentedControl` is custom, not native.** iOS-native segmented control is light-mode-only without significant theming work. Build a small token-aware component. Trivial component but flag it for the inventory.
2. **`BottomSheet` primitive needs a sanctioned dep.** Options: `@gorhom/bottom-sheet` (battle-tested, pulls in `reanimated` which is already installed transitively), `react-native-modal` (lighter, simpler), or roll our own with `Animated.View`. My recommendation: `@gorhom/bottom-sheet` — it handles keyboard avoidance, swipe-to-dismiss, focus trap, and accessibility correctly out of the box. Adding a dep here saves us from building three half-broken behaviors. Confirm in ARCHITECTURE.md §14 before merge.
3. **Tab persistence (`home.lastTab`) is MMKV tier-3 (user-scoped).** Per ARCHITECTURE.md §5. Don't put it in tier-2 (device-scoped) — different users on the same device should not share tab state.
4. **AppRunner three-mode plumbing.** The renderer is unchanged across modes — it's the _host_ (AppRunner screen) that swaps the chrome and the dispatch implementation. Owner mode passes a persistent dispatch (writes through MMKV); Try mode passes an in-memory dispatch (no writes). Keep this swap shallow — a single `mode` prop on AppRunner with a switch on chrome rendering, plus a single store-factory call.
5. **Try-mode renderer state initialization.** AC-CG-A2 demands `state = {}` and no MMKV writes. The host instantiates a fresh in-memory reducer per AppRunner mount in Try mode. On unmount, the reducer is GC'd. Don't memoize across mounts.
6. **Handle availability check** can be its own endpoint (`GET /handles/check?h=foo` → `{available: bool}`) or piggyback on `POST /users/me/handle` with a dry-run flag. Sable's UX needs only "available/taken" as inline feedback in the field. Pick the cheapest server impl; either works for the UX.
7. **SSE on `/generate`** drives the loading-bubble copy. Three events the client cares about: `thinking_started`, `building_started`, `done`. Plus `error`. The 30s-stall stall copy is purely client-side — set a timer when entering each phase, replace copy if no transition event by 30s. Reset on transition.
8. **Auto-tab-switch after generation** is a navigation parameter. When AppRunner pops back to Home post-successful-generation, route Home with `{forceTab: 'myApps', highlightProjectId: <id>}` query state. Home reads, switches, scrolls.
9. **Featured pill on `@example`** is a render-time check on `tile.author_handle === 'example'`. No special API field needed — the pill is purely client-derived from a known sentinel handle.
10. **Library list cache eviction.** When the maker publishes/unpublishes their own project, invalidate the Library query cache (TanStack `invalidateQueries`). Otherwise the maker's just-published tile won't appear / disappear in the Library tab when they switch back to it.
11. **Try-mode rendering of seed (`@example`) apps** must still work even if those seed specs are large or use the full A2UI catalog. The renderer is the renderer; the host is the host. Try mode's only constraint is "no writes," not "no rendering."
12. **Handle field uniqueness race** — the publish endpoint returns `handle_taken` even after the client's debounced check passes. Don't try to be clever and "retry with a suffix" — just surface the race-loss to the user and re-prompt. The 1-in-500 race is fine; the misleading auto-suffix is not.

---

## Notes for Colby

Tactical implementation gotchas:

1. **Segmented control hit target.** Each segment must be ≥44pt vertical. iOS default segmented control is 30pt — too small for our standard. Wrap in a `Pressable` with extended `hitSlop` if you go native, or build to spec if custom.
2. **`@gorhom/bottom-sheet` keyboard avoidance.** When the handle field is focused, the keyboard rises ~250pt; the sheet must not be hidden behind it. Use `KeyboardAvoidingView` inside the sheet content (or `bottomInset` prop). Test on iPhone SE where vertical room is tightest.
3. **Pre-fill sanitization for handle field.** Email like `Alyona.Bahaleisha+test@gmail.com` should sanitize to `alyona-bahaleisha`. Steps: lowercase → take local-part before `@` → replace `[^a-z0-9-]` with `-` → collapse runs of `-` → trim leading/trailing `-` → truncate to 20 chars → if <3 chars, pad with `-1`. Server-side sanitization (in the response that surfaces the publish sheet's pre-fill) keeps client logic dumb. Cal: add to publish endpoint or a separate `/users/me/handle/suggest`.
4. **Debounced availability check** uses a fresh `AbortController` per keystroke; cancel previous on next keystroke to avoid races. 500ms debounce. While in-flight, helper text shows "Checking…" without ✓/✗ icon.
5. **Live-region announcements should be deduped.** RN's `accessibilityLiveRegion="polite"` will fire on every re-render; throttle the underlying value so screen readers don't chatter on minor state churn. The Try-mode banner announces only on screen entry, not on every render.
6. **FAB position when keyboard is up** (rare in Try mode but possible for inputs in the rendered app): stick to safe-area + lg margin from bottom; let keyboard push it up via `KeyboardAvoidingView`. Don't hide the FAB on keyboard.
7. **Reduced motion check** — get it from `AccessibilityInfo.isReduceMotionEnabled()` once at app boot; subscribe to `reduceMotionChanged` for live changes. Cache in a context. Don't re-poll per-component.
8. **Two-stage loading transition trigger** — use SSE event arrival, not timer. Source of truth is the `useGenerateMutation` hook (or whatever the query primitive ends up being); it should expose `phase: 'thinking' | 'building' | 'done' | 'error'`. The loading bubble subscribes to that.
9. **Stall-indicator timer** — when `phase` changes, reset a timer to 30s. If no phase transition in 30s, swap copy to "Still working…". On transition, clear timer and re-arm for the new phase.
10. **Try-mode dispatch isolation** — pass a _different_ dispatch closure to the renderer. Owner mode dispatch writes to MMKV through a hook; Try mode dispatch writes only to a `useReducer` local state. Single source of difference; renderer is mode-agnostic.
11. **`@example` user must be loadable in Library queries** but **not in `/me/projects`** (since no real user is signed in as @example). Server enforces; client's My apps query never returns @example tiles.
12. **Featured pill conditional render** — `tile.author_handle === 'example'`. Don't extract a `tile.is_featured` boolean from API; the API returns the handle, the client decides display. Keeps API surface minimal.
13. **Handle field component should not commit to a `forwardRef`-laden custom-input pattern**. Just compose a `View` (with `@`) + `TextInput` + a state-aware footer Text. Don't over-engineer for a single screen.
14. **Library tile's "by @lucy · 3 days ago" line** — use `text.muted` for everything _except_ `@lucy`, which is `text.primary`. Two `Text` runs concatenated. RN inline `<Text>` children with different colors works fine; no need for layout splitting.
15. **Skip-auth dev bypass** check — from `useSession()`. If `session.user.email === 'guest@local'` (the synthetic email from `skipAuth`), treat as auth-gated. Show toast on Publish/Remix taps; don't open sheets / navigate.
16. **Tab content lists each have their own query** (`useLibraryQuery`, `useMyProjectsQuery`). Independent stale times, independent invalidation. Don't share a single query.
17. **Cursor pagination on Library** — use `useInfiniteQuery` from TanStack Query. The trailing skeleton during fetch-next-page is built-in to most patterns.
18. **Auto-scroll to top on tab switch** is _not_ the default. We want user's scroll position retained per-tab so cross-tab back-and-forth is comfortable. Only force-scroll on the post-generation tab-switch (which is conceptually a new "load" state, hence top-aligned).

---

> ✅ UX design saved to `docs/ux/chat-creation-ux.md`
>
> **Next step:** Hand to Cal (`/architect`). Cal, check the **Notes for Cal** section — there's a sanctioned-dep ask (`@gorhom/bottom-sheet`), an SSE protocol question, and the AppRunner three-mode plumbing flag. Sable is available for copy or interaction-pattern questions during ADR drafting.

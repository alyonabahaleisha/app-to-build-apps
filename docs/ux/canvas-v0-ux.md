# UX Design: Canvas V0

**Designer:** Sable | **Date:** 2026-05-07
**Feature Spec:** `docs/product/canvas-v0.md`
**Decision Brief:** `docs/product/canvas-v0-brief.md`
**Status:** Draft — parallel to `canvas-v0.md` §0 Sponsor reconciliation. Design system is decoupled from the pipeline question; this spec ships regardless of which §0 path Sponsor picks.

---

## Design Intent

Canvas is what happens when a user types one sentence and a real, native iOS tool appears 7 seconds later. The design has to deliver that promise without ever feeling like a parlour trick. Every screen, every component, every animation answers one of three questions:

1. **Does this feel native?** — Indistinguishable from a hand-built iOS app to a non-technical viewer. The instant the user feels "AI slop," retention is gone. (H5.)
2. **Does this feel like mine?** — The tool the user described should *belong* to them on first sight. Realistic seed data, stance-and-palette personalization, persistent identity in the Library card grid.
3. **Does this feel like Canvas?** — A friend who taps a Universal Link should feel like they walked into the same building, not a different app. The host chrome is identical for every mini-app; the content register adapts.

Three feelings, in order of sensitivity:

1. **Trust** — "This app is calm. It won't surprise me. Buttons do what they say."
2. **Surprise** — "Wait. It actually made the thing I described — and it's *good*."
3. **Pride** — "I want to send this to someone. Look what I made."

Anti-feelings to actively design against:

- *AI uncanny valley* — components that are almost-but-not-quite native (wrong padding, wrong font weight, wrong sheet behavior). The mandatory polish library list is the structural defense; pixel-level care is the second line.
- *Monotony* — every generated app looking the same. The 12 visual registers (2 stances × 6 palettes) are load-bearing here. If a user generates three tools and they all feel like the same beige form, V0 is a demo.
- *Brittle* — components that look great with seed data but break with empty states, long strings, large lists, or accessibility settings dialed up. We design every state, every length, every rotation.

**Design philosophy.** The host is calm, neutral, productivity-feeling — Notion-/Linear-class restraint. The mini-apps inherit one of two stances: **productive** (lists, calculators) or **expressive** (trackers, journals). The chrome stays consistent across stances; the content register adapts. The LLM never makes visual decisions — every visual choice is pre-made by UX in tokens and component implementations.

---

## Jobs-to-be-Done

### The Idea-Maker (primary)

> **When** I have a personal-tool idea — a workout tracker, a packing checklist, a tip splitter — and I'm holding my phone,
> **I want to** describe it in plain language and get a working iOS tool I can use *and* show to a friend within a single sitting,
> **so I can** stop hoarding ideas in Notes and actually *have the thing on my phone.*

**Current solution:** Notes app. Voice memos. A Pinterest board. Paying a freelancer for the rare ones. Or never building it.
**Pain:** The skill wall, the time wall, the cost wall. Most ideas die in Notes.
**Consequences:** Compounded frustration; ideas stop happening because the gap between *imagining* and *having* erodes confidence in your own ideas.

### The Friend-Recipient (V0 is also their first surface)

> **When** a friend sends me a Universal Link to a tool they made,
> **I want to** tap it and have the tool work — with my own data, not theirs — without leaving iMessage feeling like I just got phished,
> **so I can** use the tool, see what Canvas is, and (maybe) make my own.

**Current solution:** Friend describes the tool verbally over coffee; nobody actually downloads anything.
**Pain:** The cold-start of an unknown app + the social cost of "did you really need to send me an App Store link" combine to kill share-rate.
**Consequences:** The growth loop never ignites. Tools live in single-user islands.

The Universal Link install-gate page (designed below) is the answer to the friend's pain: a fast, lightweight, social proof page that says "your friend made this thing, here's a one-tap way to open it."

---

## User Journey Map

### Stage 1 — First Open (Idea-Maker)

| | |
|---|---|
| **Doing** | Installs Canvas from App Store. Opens. Sees Sign-In with Apple. |
| **Thinking** | "OK. One tap with Apple. I expected worse." |
| **Feeling** | Mildly skeptical. Curious. |
| **Pain** | If first launch asks for email/password or 4 onboarding screens, they bounce. |
| **Opportunity** | Sign in with Apple is one tap. Land directly in Library with a real empty state — not a tutorial. |

### Stage 2 — Empty Library

| | |
|---|---|
| **Doing** | Sees empty Library. Hero illustration. Three big example prompts. |
| **Thinking** | "What can this thing actually do? Let me try one of these." |
| **Feeling** | Cautious commitment. |
| **Pain** | Blank Library + Create button = blank-page paralysis. |
| **Opportunity** | The empty state is *the* most-seen screen. Three concrete tappable prompts that auto-fill Create. The illustration sets the tone. |

### Stage 3 — Generation Wait (7–9s)

| | |
|---|---|
| **Doing** | Tapped Submit. Watching loading screen. |
| **Thinking** | "How long is this going to take? Did it work?" |
| **Feeling** | Anticipatory. Vulnerable to feeling stuck. |
| **Pain** | A 9-second indeterminate spinner reads as "broken" by second 5. |
| **Opportunity** | Honest progress: 3 cycled witty messages + an accent-color **determinate** progress bar paced to fill at p50 latency (so 50% of users see it complete naturally). The bar slows in the last 20% to absorb tail latency without lying. |

### Stage 4 — First Reveal

| | |
|---|---|
| **Doing** | Tool appears in Run mode. Heading. Seeded data. FAB. Pokes a row. |
| **Thinking** | "Is this real? It actually has my workouts in it. How?" |
| **Feeling** | Surprise → delight → pride. |
| **Pain** | If seed data is `["Item 1", "Item 2"]`, the magic dies in 2 seconds. If a button does nothing, the magic dies in 5. |
| **Opportunity** | Realistic seed data (mandatory per brief §2.4). Every tap has visible feedback. The first-time coachmark *quietly* points at the share affordance — primes the share intent that's the V0 growth loop. |

### Stage 5 — First Share

| | |
|---|---|
| **Doing** | Taps meatball. "Share." Link copied. Pastes to friend in iMessage. |
| **Thinking** | "Will my friend think this is weird? Is this app legit-looking?" |
| **Feeling** | Pride mixed with social anxiety. |
| **Pain** | If the share confirmation is a tiny grey toast, the act feels small. If the link preview in iMessage is generic, the friend doesn't tap. |
| **Opportunity** | A satisfying share confirmation (haptic + accent flash). Open Graph metadata on the install-gate page produces a rich link preview with the tool name + maker handle + cover art. |

### Stage 6 — Friend-Recipient

| | |
|---|---|
| **Doing** | Friend taps the link. iMessage opens Canvas (or App Store). |
| **Thinking** | (Canvas-installed) "OK, this is in my Library now. What's the thing my friend made?" / (no Canvas) "Should I install this?" |
| **Feeling** | Mild commitment. |
| **Pain** | If the install-gate page is an empty App Store link, friend bails. If post-install delivery is buggy, friend installs but never sees the tool. |
| **Opportunity** | Install-gate page shows the tool's identity (name, maker, cover art) before install. Post-install deferred-deep-link delivers the mini-app to the new user's Library with a celebratory sheet ("@maker shared this with you"). |

### Stage 7 — Re-prompt-to-Edit

| | |
|---|---|
| **Doing** | Tool's column should be reordered. Taps meatball → "Make changes." Returns to Create with original prompt pre-filled. Edits prompt, submits. |
| **Thinking** | "I just want to add a notes column. Will it lose my data?" |
| **Feeling** | Mild trepidation about data loss. |
| **Pain** | If "make changes" silently destroys the user's seven entries, V0 is a betrayal. |
| **Opportunity** | Best-effort field migration (matching name + type) preserves data. A single "Some fields changed; here's what we kept" toast is shown once, not pumped on every regeneration. |

---

## User Flow

### Happy path — Idea-Maker creation + share

```
App launch (cold start)
    │
    ▼ Sign in with Apple (one tap)
    │
Library tab (empty state — illustration, headline, 3 example prompts)
    │
    ▼ tap "Track my daily workouts" example chip
    │
Create tab (input pre-filled with chip text, suggested prompts visible)
    │
    ▼ tap Submit
    │
Generating screen (full-screen loading state — 7–9s)
    │  • "Sketching the layout…" (0–3s)
    │  • "Choosing colors…" (3–6s)
    │  • "Filling in your workouts…" (6–9s)
    │  determinate progress bar paced to p50 latency
    │
    ▼ /generate succeeds
    │
Run mode (full mount, no progressive render)
    │  • Host header: ← back, "Workouts", ⋯ meatball
    │  • First-time coachmark on ⋯ ("Tap here to share")
    │  • Body: spec render with stance-and-palette theme
    │  • Host tab bar: Library, Create
    │
    ▼ user interacts, then taps ⋯ → Share
    │
Share confirmation (haptic + accent flash + toast "Link copied")
    │
    ▼ user pastes to iMessage to friend
    │
[Friend tapping link → Stage 6 below]
```

### Happy path — Friend-Recipient (Canvas not installed)

```
Friend taps link in iMessage
    │
    ▼ iOS opens canvas.app/m/{share_id}/clone in Safari
    │
Install-gate webpage
    │  • Hero: cover art + "@maker made this"
    │  • Title: tool name
    │  • CTA: "Install Canvas to open" → App Store badge
    │  • Below fold: "What is Canvas? — a personal canvas for your everyday tools"
    │
    ▼ tap App Store badge → install
    │
First app launch
    │
    ▼ Sign in with Apple
    │
Library tab — populated with the friend's tool (deferred-deep-link delivered)
    │
    ▼ celebration sheet: "@maker shared 'Workouts' with you" + Open / Later
    │
    ▼ tap Open
    │
Run mode (friend's clone — fresh seeded data, friend's namespace)
```

### Happy path — Friend-Recipient (Canvas already installed)

```
Friend taps link in iMessage
    │
    ▼ Canvas opens via Universal Link
    │
Library tab — celebration sheet bottom-up: "@maker shared 'Workouts' with you"
    │  Two CTAs: Open / Later
    │
    ▼ tap Open
    │
Run mode (friend's clone — fresh seeded data, friend's namespace)
```

### Re-prompt-to-Edit path

```
Run mode → ⋯ meatball → "Make changes"
    │
    ▼ Create tab opens with original prompt pre-filled (editable)
    │  Above input: "Editing 'Workouts'" pill (dismissable; if dismissed,
    │  next submission creates a *new* tool instead of updating)
    │
    ▼ user edits prompt, submits
    │
Generating screen (same 7–9s)
    │
    ▼ /generate succeeds
    │
Field-migration check (server-side, synchronous)
    │  • Match new spec's collection fields to old by (name, type)
    │  • Preserved fields keep data
    │  • New fields seeded
    │  • Removed fields dropped
    │  • If any field changed: queue one toast for first Run-mode load
    │
    ▼ navigate to Run mode
    │
Run mode (new spec, migrated data, optional one-time toast)
```

### Error & edge cases

| Trigger | Behavior |
|---|---|
| Empty / whitespace prompt | Submit disabled inline; no error needed. |
| Prompt > 2000 chars | Inline counter from 1800; turns danger color at 1900; Submit disabled at 2001+. |
| Generator returns `out_of_scope` | Out-of-Scope Surface (designed below). |
| Generator returns `invalid_spec` | Toast: "I couldn't turn that into a tool. Try a different idea." Prompt preserved. |
| Generator returns `quota_exhausted` | Quota Exhausted Surface (designed below). |
| Generator returns `rate_limited` | Toast: "We're a bit busy right now. Try again in a minute." Submit disabled 60s with countdown. |
| Generator returns `internal` | Toast: "Something went wrong on our end. Try again." Prompt preserved. |
| Network drops mid-generation | Loading screen surfaces "Waiting for connection…" message; on reconnect, the request is **not** auto-retried (LLM calls aren't safely idempotent). User taps Retry. |
| Generation succeeds but render-time error | Run-mode error state: apologetic icon + "This tool didn't render correctly. Try recreating it." + "Back to Library." Logged as P0 — should never happen if validation passes. |
| Universal Link with malformed `share_id` | Generic error screen: "This link doesn't work." + "Open Library." |
| Universal Link with reserved `mode` (`view`, `remix`) | "This share mode isn't supported in this version yet" + "Open Library." |
| Friend taps link to a deleted creator's tool | "This tool is no longer available" + "Open Library." |
| Friend taps link, signed-out | App opens to Sign-In; deferred-deep-link delivers tool after first sign-in. |
| Pre-iOS 26 device generates a tool with summarize | The summarize-using component (e.g. `ListSummary`) hides itself or shows raw content. No upsell, no error toast. |
| User has 50+ tools in Library | FlashList scrolls; no pagination in V0. |
| Re-prompt drops a column the user had data in | One-time toast: "Some fields changed. We kept what we could." |
| User cancels Sign in with Apple | Stays on Sign-In screen. |
| User signs out from Settings sheet | Returns to Sign-In; cloud-private data persists server-side; local data clears. |

---

## Token Surface — what the LLM sees, locked

This is the entire visual vocabulary the model picks from. **Anything not in this section is decided once and locked.** Cal codegens TypeScript types from this surface into `packages/design-system/tokens.ts`; the LLM tool input_schema enumerates these names.

### Color tokens (12)

| Token | Role | Resolution |
|---|---|---|
| `bg` | Page / surface background | stance-locked |
| `bg-elevated` | Card / elevated surface | stance-locked |
| `bg-overlay` | Modal scrim | stance-locked |
| `fg` | Primary text + icon | stance-locked |
| `fg-muted` | Secondary text | stance-locked |
| `fg-faint` | Tertiary / placeholder text | stance-locked |
| `divider` | Hairline borders, list separators | stance-locked |
| `accent` | Brand accent — primary actions, focus states, FAB | **palette-resolved** |
| `accent-fg` | Foreground on accent (ensures AA contrast vs accent) | **palette-resolved** |
| `success` | Positive states (completed, saved) | stance-locked |
| `warning` | Warning states (quota near, edit-might-lose) | stance-locked |
| `danger` | Destructive states, errors | stance-locked |

**The LLM picks tokens by name.** It never picks hex, RGBA, gradient stops. If a designer wants a new color, they add a token here; the LLM doesn't gain that ability until the next App Store update.

### Spacing scale (6)

| Token | Value | Use |
|---|---|---|
| `space-none` | 0pt | Flush layouts |
| `space-xs` | 4pt | Inline pairings (icon + label) |
| `space-sm` | 8pt | Tight stacks, dense lists |
| `space-md` | 12pt | Default vertical rhythm in productive stance |
| `space-lg` | 20pt | Default vertical rhythm in expressive stance; section padding |
| `space-xl` | 32pt | Screen-edge padding, hero spacing |

(Brief locked. No `2xl`. If a generated layout needs > 32pt of breathing room, it stacks `xl` + section header instead.)

### Radius scale (5 named — brief said 4; treating `none` as the zero-baseline sentinel and `full` as the special)

| Token | Value | Use |
|---|---|---|
| `radius-none` | 0pt | Edge-to-edge content |
| `radius-sm` | 6pt | Chips, badges, small buttons |
| `radius-md` | 12pt | Cards, primary buttons, inputs |
| `radius-lg` | 20pt | Sheets, full-width cards (expressive stance only) |
| `radius-full` | 9999pt | Pills, avatars, FAB |

> **Note for Cal:** the brief table shows "Radii 4" with 5 names. I'm reading "4" as the count of *active sizes* (sm/md/lg/full), with `none` as the zero-baseline sentinel. If the architect needs a strict 4-name enum, drop `radius-none` and have layouts use omission instead. My preference is to keep `none` as an explicit token so generated specs are unambiguous.

### Type roles (6)

Productive and expressive stances differ in **font family** and **scale**, not in role names. The LLM picks a role; the stance picks the resolution.

| Token | Productive (SF Pro / Inter — single sans family) | Expressive (Editorial display + Inter body) |
|---|---|---|
| `type-display` | 32 / 40 / 600 / -0.4 tracking | 36 / 44 / 500 (display serif) / -0.6 |
| `type-h1` | 24 / 30 / 600 / -0.2 | 28 / 36 / 500 (display serif) / -0.3 |
| `type-h2` | 18 / 24 / 600 / 0 | 22 / 30 / 500 (display serif) / -0.1 |
| `type-body` | 16 / 24 / 400 / 0 | 16 / 26 / 400 (sans) / 0 |
| `type-caption` | 13 / 18 / 400 / 0.1 | 14 / 20 / 400 (sans) / 0 |
| `type-micro` | 11 / 14 / 500 / 0.4 | 11 / 14 / 500 (sans) / 0.4 |

(Format: `size / line-height / weight / letter-spacing` in pt.)

**Display fonts.** Productive uses iOS system (SF Pro) at full scale — no custom font, fastest cold start. Expressive ships **one** display serif: I'm specifying **Tiempos Headline** (Klim) at the `display`/`h1`/`h2` levels with Inter at body and below. If Tiempos licensing isn't available, the substitute is **New York** (already shipped by iOS) — close enough at a fraction of the bundle size; that's the V0 fallback.

### Elevation (3)

| Token | Shadow recipe | Use |
|---|---|---|
| `elevation-flat` | No shadow | Default surface |
| `elevation-raised` | `0 1px 2px rgba(15, 18, 22, 0.06), 0 1px 1px rgba(15, 18, 22, 0.04)` | Cards, list items in expressive stance |
| `elevation-floating` | `0 8px 24px rgba(15, 18, 22, 0.10), 0 2px 6px rgba(15, 18, 22, 0.06)` | FAB, sheets, popovers |

(Same recipes both stances; iOS-tuned, not Material — softer, lower contrast.)

### Motion curves (4)

| Token | Spec | Default for |
|---|---|---|
| `motion-instant` | 0ms | Reduced-motion mode (all animations collapse here) |
| `motion-snappy` | 150ms `cubic-bezier(0.2, 0.8, 0.2, 1)` | Productive stance default; press states; toggles |
| `motion-smooth` | 280ms `cubic-bezier(0.4, 0.0, 0.2, 1)` | Expressive stance default; sheet open; navigation |
| `motion-springy` | Reanimated spring `{ stiffness: 180, damping: 18 }` | FAB scale-in, share-success haptic-paired bounce |

### Iconography (~80 semantic names — closed set)

The icon set is **Lucide** (`lucide-react-native`). The LLM picks a semantic name; the renderer maps it to a Lucide glyph at the rendered size (16, 20, 24, 32 — picked by the component, not the spec). Adding a new icon requires App Store update.

| Tier | Names |
|---|---|
| Navigation (8) | `chevron-left`, `chevron-right`, `chevron-up`, `chevron-down`, `arrow-left`, `arrow-right`, `x`, `more-horizontal` |
| Action (10) | `plus`, `minus`, `share`, `edit`, `trash`, `archive`, `copy`, `refresh-cw`, `save`, `send` |
| Indicator (8) | `info`, `alert-triangle`, `check`, `check-circle`, `x-circle`, `help-circle`, `sparkles`, `dot` |
| Input (6) | `search`, `filter`, `eye`, `eye-off`, `mic`, `paperclip` |
| Content kind (10) | `list`, `grid-2x2`, `image`, `file`, `link`, `calendar`, `clock`, `map-pin`, `tag`, `hash` |
| Activity (10) | `heart`, `star`, `bookmark`, `flame`, `zap`, `target`, `trophy`, `medal`, `gift`, `party-popper` |
| Domain (16) | `book`, `book-open`, `dumbbell`, `leaf`, `droplet`, `sun`, `dollar-sign`, `brain`, `music`, `camera`, `palette`, `code`, `globe`, `coffee`, `plane`, `rocket` |
| Profile (4) | `user`, `users`, `log-out`, `settings` |
| Commerce (4) | `shopping-bag`, `shopping-cart`, `credit-card`, `receipt` |
| Time (4) | `timer`, `hourglass`, `history`, `repeat` |

**Total: 80.** Cover-art generation (below) draws from this same set so the LLM's icon choice for a tool's identity comes from one closed surface.

---

## Stance System — 2 visual registers

The generator picks **one stance per mini-app** at create time, deterministically:

- ListCRUD, Calculator → **Productive**
- Tracker, Journal → **Expressive**

Stance is locked at generation. The schema reserves a `stanceOverride` field per screen for V0.5+ but V0 ignores it.

| Dimension | Productive | Expressive |
|---|---|---|
| **Density** | Tight — `space-md` default vertical rhythm; lists are dense rows | Generous — `space-lg` default; lists are spaced cards |
| **Type** | Functional, body-driven; SF Pro / Inter throughout | Editorial, display-driven; Tiempos Headline (or NY) at display/h1/h2; Inter at body |
| **Imagery** | Iconographic — Lucide icon at 24pt, on accent background, in cards | Photo-forward — `MediaTray` and `ImagePicker` are first-class; cards lean on imagery |
| **Color register** | Restrained — accent used sparingly (FAB, primary CTA, focus); fg-muted carries most of the UI weight | Rich — accent appears in headings, decorative dividers, and stance-themed cover art; warmer divider hue |
| **Motion** | `motion-snappy` default — 150ms throughout | `motion-smooth` default — 280ms throughout; `motion-springy` on entrances |
| **Border treatment** | Hairline dividers (`divider` token, 1pt) | Soft gaps (no border, just `space-lg` separation) |
| **Card elevation** | `elevation-flat` default; `elevation-raised` for emphasis | `elevation-raised` default; `elevation-floating` for emphasis |
| **Default radius** | `radius-md` (12pt) on cards | `radius-lg` (20pt) on cards |

**Both stances are light-mode only in V0.** Both are warm — productive is a cool warm-white, expressive is a soft cream. Neither is pure white. (Pure white reads as "system app shell"; both stances read as "Canvas.")

---

## Palette System — 6 accent palettes × 2 stances = 12 visual registers

The generator picks one palette per mini-app at create time, biased by archetype + content hints:

- ListCRUD: `focus` default; `social` if content suggests people/relationships; `play` if playful tone
- Tracker: `health` if fitness/wellness; `focus` if productivity; `play` if game-like
- Journal: `social` if relational; `learn` if reflective/educational
- Calculator: `money` if financial; `focus` otherwise

User palette override is V0.5; in V0 the generator's pick is final.

### Stance-locked colors (the same across all 6 palettes within a stance)

| Token | Productive | Expressive |
|---|---|---|
| `bg` | `#FAFAF7` (warm off-white) | `#FBF8F3` (warm cream) |
| `bg-elevated` | `#FFFFFF` | `#FFFFFF` |
| `bg-overlay` | `rgba(20, 23, 26, 0.45)` | `rgba(26, 23, 21, 0.45)` |
| `fg` | `#14171A` (near-black, cool) | `#1A1715` (near-black, warm) |
| `fg-muted` | `#5C6470` | `#6B5F56` (warmer brown) |
| `fg-faint` | `#A2A8B2` | `#B0A89E` |
| `divider` | `#ECEEF1` (cool grey) | `#EFE9DF` (warm grey-cream) |
| `success` | `#0E8345` | `#4A7B45` (softer for editorial) |
| `warning` | `#B8580C` | `#C46A2A` |
| `danger` | `#C03A2B` | `#B5392E` |

### Palette-resolved colors (`accent` + `accent-fg` per palette per stance)

All 12 accent / accent-fg pairs verified ≥4.5:1 contrast (WCAG AA body). Measured ratios in the table; lowest is 4.65:1 (expressive/learn — unchanged in the revision, sits just above the bar), highest is 7.30:1 (expressive/money). **Revised 2026-05-08** — original values for productive/health, productive/social, expressive/health, expressive/social, expressive/play measured below the 4.5:1 body bar against `#FFFFFF` once Colby ran the math during ADR-0005 Step 8 implementation. Replacements darken each accent within its color family to clear the bar with margin.

| Palette | Productive `accent` | Productive `accent-fg` | Expressive `accent` | Expressive `accent-fg` |
|---|---|---|---|---|
| **focus** (indigo) | `#4F46E5` | `#FFFFFF` (6.29:1) | `#5B53D9` | `#FFFFFF` (5.70:1) |
| **health** (emerald) | `#0A7048` | `#FFFFFF` (6.13:1) | `#4A7438` | `#FFFFFF` (5.46:1) |
| **money** (deep teal) | `#0E7C7B` | `#FFFFFF` (5.02:1) | `#2E5E5E` | `#FFFFFF` (7.30:1) |
| **social** (rose) | `#C73456` | `#FFFFFF` (5.18:1) | `#B7456E` | `#FFFFFF` (5.13:1) |
| **learn** (violet) | `#7C3AED` | `#FFFFFF` (5.70:1) | `#8E5DC4` | `#FFFFFF` (4.65:1) |
| **play** (amber) | `#EA8B0E` | `#1A1715` (6.96:1) | `#A85A14` | `#FFFFFF` (5.08:1) |

**Notes:**

- All 12 pairs clear WCAG AA body text (≥4.5:1) without carve-out. The previous "4.5:1 on large" annotations on `health` productive and `social` productive are obsolete — body-text contrast holds for every pair after the 2026-05-08 revision.
- `play` productive uses `fg` as the foreground (dark on amber) because amber lights are too light to carry white text. This is the only palette that doesn't use `#FFFFFF` for `accent-fg`.
- All 12 register pairs verified by the WCAG luminance formula in `packages/design-system/test/contrast.ts`; the contrast scan in ADR-0005 §AC-N1 runs on the design tokens, so this matrix is the source of truth.
- Within-family preservation: each replacement preserves the recognizable hue family (emerald, rose, olive-sage, dusty rose, burnt orange). Users still read "this is the green palette" / "this is the rose palette" — the shifts are saturation/lightness, not hue rotation.

### The 12 registers as a sanity check

| Register | Productive | Expressive |
|---|---|---|
| **focus** | Notion-blue, restrained, "this is a tool" | Indigo + serif headlines, "this is a thoughtful tool" |
| **health** | Confident emerald, "this is for moving" | Olive-sage + serif, "this is for wellness" |
| **money** | Deep teal, gravitas, "this is for spending" | Muted teal + serif, "this is for managing" |
| **social** | Rich rose, warm, "this is for people" | Dusty rose + serif, "this is intimate" |
| **learn** | Violet, curious, "this is for thinking" | Soft violet + serif, "this is for studying" |
| **play** | Amber, energetic, "this is fun" | Burnt orange + serif, "this is creative" |

These are the 12 visual fingerprints of every tool a user will ever generate. Variety isn't *infinite* but it's enough that three tools in a Library feel meaningfully different.

---

## Iconography (host shell + cover art)

| Use | Icon |
|---|---|
| Library tab | `grid-2x2` |
| Create tab | `sparkles` |
| Settings (avatar dropdown) | `settings` |
| Sign out | `log-out` |
| Back | `chevron-left` |
| Meatball | `more-horizontal` |
| Share | `share` |
| Edit / make changes | `edit` |
| Archive | `archive` |
| Delete | `trash` |
| Search | `search` |
| Filter | `filter` |
| Voice mic (placeholder, V0.5) | `mic` |
| Submit / send | `send` |

Lucide is the icon set. `react-native-svg` is the rendering primitive (Lucide RN uses it). Sizes: 16 (inline), 20 (default), 24 (host chrome), 32 (cover art icon).

---

## Motion Vocabulary

All animations honor `accessibilityReduceMotion`; reduced collapses to `motion-instant` (no transition) for transforms and crossfade-only for opacity.

| Surface | Motion | Library |
|---|---|---|
| Tab bar selection | `motion-snappy`, accent color crossfade + 1pt scale on icon | Reanimated |
| Sheet open (Settings, Library long-press, Out-of-Scope) | `motion-springy`, slide up | Gorhom Bottom Sheet |
| Sheet dismiss | `motion-smooth`, 240ms ease-out | Gorhom |
| Run-mode entry from Create | `motion-springy` slide up + fade | React Navigation native-stack `presentation: 'modal'` |
| Library card long-press → action sheet | 100ms scale 1.0 → 0.96 + haptic, then sheet open | Reanimated |
| Generating screen progress bar | `motion-smooth` linear interpolation, paced to p50 | Reanimated `withTiming` |
| Generating screen message swap | 200ms crossfade | Reanimated |
| Out-of-scope detection result | 280ms slide-up of result card after generation completes | Reanimated |
| Toast | 250ms slide-down + fade in; auto-dismiss 3s; 200ms fade out | Reanimated |
| FAB scale-in (first Run-mode mount) | `motion-springy` scale 0 → 1 with 80ms delay after content | Reanimated |
| Share success | 100ms accent flash on FAB + medium haptic + toast | Reanimated + Expo Haptics |
| Coachmark dismiss | 240ms fade + 8pt translate-up | Reanimated |
| Cover art entrance (Library card first appear) | 300ms fade + 4pt translate-up, staggered 40ms per card | Reanimated |

**Reduced-motion fallbacks:**

- All slide/scale/translate → opacity-only crossfade.
- FAB scale-in → instant.
- Skeleton shimmer → static grey block.
- Cover art stagger → all appear together, no fade.
- Progress bar still animates (it's information, not decoration) but at 100ms steps instead of linear interpolation.

---

## Host Shell — screen-by-screen

### Screen 1: Sign in with Apple

**Purpose.** Lowest-friction entry. Apple's button does the work.

**Layout (top → bottom):**

- Top safe area
- Centered hero (40% of viewport):
  - Wordmark "Canvas" — `type-display`, `fg`, no graphic mark in V0
  - Tagline — `type-body`, `fg-muted`: "A personal canvas for your everyday tools."
- Sign in with Apple button (Apple-prescribed style, full-width, 48pt tall, `radius-md`)
- Footer micro-copy — `type-micro`, `fg-faint`: "By signing in, you agree to our Terms and Privacy Policy." Each underlined word opens the respective web page in `WKWebView`.
- Bottom safe area

**States:**

| State | What changes |
|---|---|
| Default | As above. |
| Signing in | Apple button shows its own spinner (system-managed). |
| Cancelled | No-op; user stays on Sign-In. |
| Error | Toast: "Sign-in failed. Try again." |

**Interactions:**

- Tap Sign in with Apple → system flow → success → navigate to Library tab.

**Accessibility:**

- Wordmark is `accessibilityRole="header"`.
- Apple button is system-managed; do not override its labels.
- Footer Terms / Privacy each have `accessibilityRole="link"`.

**Notes:**

- This is the user's *first* impression of the wordmark — pick a font weight that holds up at 32pt without feeling bombastic. SF Pro Display Semibold tested in mockup.

---

### Screen 2: Library tab — populated state

**Purpose.** Show the user their tools. Get them back into the one they want, or into Create.

**Layout (top → bottom):**

- Top safe area
- Header bar (44pt tall):
  - Title "Library" — `type-h1`, `fg`, left-aligned
  - Trailing avatar — 32pt circular, opens Settings sheet (Gorhom)
- Sticky search + filter row (56pt tall):
  - Search field (90% width) — `radius-full`, `bg-elevated`, `divider` border 1pt, leading `search` icon, placeholder "Search your tools"
  - Filter chip row below search (24pt chips, `radius-full`):
    - All (default selected — `accent` background, `accent-fg` text)
    - Mine
    - Shared with me
- Tool grid (2 columns, FlashList):
  - Card width = (viewport - 32 edge - 12 gutter) / 2 ≈ (393 - 44) / 2 = 174pt on iPhone 14
  - Card aspect ratio 4:5 (174 × 218pt)
  - Each card:
    - Cover art top (174 × 130pt, `radius-md` top corners only — the card's bottom corners are also `radius-md` so the card has all 4 rounded)
    - Title row 1 (`type-body` + 600 weight, 1 line ellipsize, 8pt above)
    - Subtitle (`type-caption`, `fg-muted`, 1 line ellipsize): "Created 3 days ago" — relative time
- Tab bar (host chrome — see §Tab Bar)

**States:**

| State | What changes |
|---|---|
| Empty | Grid replaced with empty state (next sub-section) |
| Populated 1–8 tools | Grid scrolls within viewport. |
| Populated 9+ tools | Grid scrolls vertically; no pagination in V0. |
| Loading | 4 skeleton cards (shimmer-disabled in reduced-motion). |
| Error | Inline banner above grid: "Couldn't load your library. Pull to retry." |
| Search active, no results | Inline empty state: "No tools match '<query>'." |
| Filter "Shared with me", no shares | Inline empty state: "Tools your friends share will appear here." |

**Interactions:**

- Tap card → push Run mode for that tool.
- Long-press card → 100ms scale + haptic, then Gorhom action sheet:
  - Open (default action — same as tap)
  - Share
  - Make changes
  - Archive
  - Delete (destructive — confirm dialog)
- Pull to refresh → re-fetch `GET /mini-apps`.
- Tap avatar → Settings sheet (Gorhom).
- Tap filter chip → filter changes; grid re-renders without re-fetch.
- Tap search field → keyboard rises; inline cancel button on field.

**Accessibility:**

- Card label: "Open <title>, <stance>, <palette> palette, created <time ago>". Stance + palette are read so users with low vision can disambiguate two similarly-titled tools.
- Filter chips: `accessibilityRole="button"`, `accessibilityState={{ selected: <bool> }}`.
- Long-press: announced via `accessibilityHint="Long-press for options."`
- Pull-to-refresh announces "Refreshed" / "No new tools."

**Responsive (iPhone SE → Pro Max):**

- Always 2 columns. Card width scales proportionally.
- Header + search + filter row stay sticky.

---

### Screen 2a: Library tab — empty state

**Purpose.** First impression. Most-seen screen. Inviting, not depressing.

**Layout:**

- Top safe area
- Header bar (same as populated)
- Centered content (60% viewport):
  - Hero illustration — 200 × 200pt — see §Cover Art for the illustration system; for the empty state we use a hand-drawn sketch of a small notebook + pencil + rough mini-app frame. Single illustration, ships in `apps/mobile/assets/`. Stance-neutral cream palette.
  - Headline `type-h1`: "What do you want to build?"
  - Subhead `type-body`, `fg-muted`: "Three ideas to get you started."
  - Three big tappable example chips (full-width, 56pt tall, `radius-md`, `bg-elevated`, `elevation-raised`):
    - "📓 Daily mood journal"
    - "🥗 Weekly grocery list"
    - "🏃 Track my workouts"
- Tab bar

**Interactions:**

- Tap chip → navigate to Create tab with input pre-filled. Suggested prompts row below input is hidden on this entry (chip is the prompt).

**Why these three?** They span Journal / ListCRUD / Tracker — three of the four V0 archetypes. Calculator is intentionally absent on the empty state because calculator prompts don't read as "easy to start with" for a first-time user; calculator examples appear in the Create suggested-prompt rotation.

---

### Screen 3: Create tab

**Purpose.** Capture the prompt. Lower activation energy via curated suggestions. Get out of the way.

**Layout:**

- Top safe area
- Header bar:
  - Title "Create" — `type-h1`, `fg`
  - (No trailing element)
- Body:
  - Prompt input — multi-line, `bg-elevated`, `radius-md`, `divider` border, internal padding `space-md`. 5-line max then internal scroll. Placeholder: "Describe a tool you want." `type-body`, `fg`. Above input: optional dismissable pill "Editing 'Workouts' [×]" when arrived from "Make changes."
  - Right-aligned mic icon inside input (placeholder, V0.5; tappable, opens "Voice input is coming soon — want to be notified?" sheet that captures email — same pattern as out-of-scope).
  - Below input: character counter at 1800+ chars, `type-micro`, `fg-faint`; turns `danger` at 1900+.
  - Spacer `space-lg`
  - "Or try one of these" `type-caption`, `fg-muted`
  - 6 suggested prompt chips (rotated; pulled from a curated pool of 10 — see canvas-v0.md §3.10). 2 columns × 3 rows. Each chip 80% width column, 44pt tall, `radius-full`, `bg-elevated`, `divider` border, content: emoji + prompt text, `type-caption`. Tap pre-fills input (does *not* auto-submit).
- Floating action button at bottom-right (above tab bar):
  - 56pt circle, `accent` background, `accent-fg` icon
  - Icon: `send`
  - Disabled state: 50% opacity, no shadow, no haptic
  - Enabled state: `elevation-floating`, springy on appear
- Tab bar

**States:**

| State | What changes |
|---|---|
| Default (no input) | FAB disabled. Suggested prompts visible. Mic icon visible. |
| Typing | Suggested prompts hidden (collapses up). Counter appears at 1800+ chars. FAB enabled when ≥1 non-whitespace char and ≤2000 chars. |
| Submitting | Navigate to Generating screen (full-screen modal). |
| Error returned | Toast per error type. Stay on Create with prompt preserved. |
| Editing pill present | Pill above input shows "Editing 'Workouts'." Dismissable; if dismissed, next submit creates a new tool. |

**Interactions:**

- Tap chip → input pre-filled; chips collapse up; FAB enables.
- Tap FAB → submit; navigate to Generating screen.
- Tap mic icon → V0.5 waitlist capture sheet.
- Keyboard: hardware Enter sends; Shift+Enter newline.

**Accessibility:**

- Input: `accessibilityLabel="Describe your tool"`.
- Mic: `accessibilityLabel="Voice input — coming soon"`, `accessibilityHint="Opens waitlist sign-up"`.
- FAB: `accessibilityLabel="Generate tool"`, `accessibilityState={{ disabled: <bool> }}`.
- Chips: `accessibilityRole="button"`, label = chip text, hint = "Pre-fills the prompt."
- Counter at 1900+: `accessibilityLiveRegion="polite"` announces "Approaching length limit" once at 1900 and once at 2000.

---

### Screen 3a: Generating screen

**Purpose.** Hold the user's attention for 7–9 seconds without lying about progress.

**Layout (full-screen modal, no host chrome):**

- Top safe area
- Hero illustration centered (200 × 200pt) — animated stance-neutral abstract: 5 geometric shapes arranged on a soft grid, drifting slowly with `motion-smooth`. The shapes are `accent` (palette assigned at generation start; we already know which palette before the LLM finishes). Reduced-motion: shapes static.
- Below illustration:
  - Headline `type-h1`, centered: "Building your canvas."
  - Cycled message — `type-body`, `fg-muted`, centered. 200ms crossfade between:
    - 0–3s: "Sketching the layout…"
    - 3–6s: "Choosing colors…"
    - 6–9s: "Filling in your seed data…"
    - >9s (rare): "Almost there…"
- Determinate progress bar — `accent`, 4pt tall, full-width with `space-xl` horizontal padding, `radius-full`. Pacing:
  - 0 → 75% over 6.5s linear
  - 75 → 95% over 1.5s linear
  - 95 → 99% indefinite (held while server completes)
  - 99 → 100% on success, then immediate transition to Run mode
- Bottom safe area (no tab bar)

**Why determinate?** Indeterminate spinners read as "stuck" by second 5 on mobile. A determinate bar paced to p50 latency (~9s) is honest 50% of the time and informative 100% of the time. Tail latency past 9s gets absorbed in the 95–99% hold zone — the bar visibly slows but doesn't stall, which reads as "thinking carefully" rather than "broken."

**States:**

| State | What changes |
|---|---|
| Generating (success path) | Above. |
| Out-of-scope detected | Crossfade to Out-of-Scope Surface (below) at 250ms. |
| Error | Crossfade to Create with toast. |
| Network drop mid-generation | Bar holds at current %. Headline becomes "Waiting for connection…" Below: text button "Cancel and retry." |
| Cancel during generation | Confirmation alert: "Cancel? You'll lose this generation." Default = Keep waiting. Cancel = back to Create. (LLM call still completes server-side; orphan generation discarded after timeout.) |

**Accessibility:**

- Headline `accessibilityRole="header"`.
- Cycled message has `accessibilityLiveRegion="polite"` so VoiceOver users hear progress.
- Progress bar `accessibilityRole="progressbar"`, `accessibilityValue={{ now, min: 0, max: 100 }}`.
- Reduced motion: messages still cycle (information), illustration shapes static (decoration).

---

### Screen 4: Run mode (mini-app surface)

**Purpose.** Render the user's mini-app. Stay out of the way.

**Layout:**

- Top safe area
- Host header (32pt tall — thin, brief §3.6):
  - Leading: `chevron-left` back button (host nav), 24pt icon, 44pt hit target
  - Title: tool name, `type-body` + 600 weight, center-aligned, ellipsize
  - Trailing: `more-horizontal` meatball, 24pt icon, 44pt hit target
- Body (mini-app's UI; the spec render):
  - Internal padding from the schema's screen-level padding (default `space-lg` horizontal, `space-md` vertical)
  - Background: `bg`
  - Internal nav (one of 4 patterns — see §Internal Nav)
  - State, components, all spec-driven
- Tab bar (host chrome)

**Host header is always present.** Mini-apps cannot hide it, cannot full-bleed past it, cannot color it differently (host header background is always `bg-elevated` with a 1pt `divider` bottom border). This is invariant #3 from the brief.

**The meatball menu (Gorhom action sheet):**

- Open
- Share — copies Universal Link, haptic + accent flash + toast "Link copied"
- Make changes — navigate to Create with prompt pre-filled + Editing pill
- Archive
- Rename — opens inline rename Gorhom sheet with single text input, 80-char limit
- Delete — destructive; confirmation dialog

**States:**

| State | What changes |
|---|---|
| First open after generation | Body renders with `motion-springy` slide-up; coachmark on meatball appears 600ms after mount. |
| Subsequent open from Library | Body renders instantly; no coachmark. |
| Render error | Body replaced with apologetic state (next sub-section). |
| Re-prompt-to-edit completed with field changes | One-time toast on first load: "Some fields changed. We kept what we could." |
| Cloned from Universal Link | Celebration sheet bottom-up (Gorhom, 50% height): "@maker shared '<name>' with you" + Open / Later. |

**Accessibility:**

- Header back button: `accessibilityLabel="Back to Library"`.
- Header title: `accessibilityRole="header"`.
- Meatball: `accessibilityLabel="Tool options"`, `accessibilityHint="Opens share, edit, archive, delete."`
- Run-mode body inherits standard accessibility from each rendered component.
- Coachmark announces once with `accessibilityLiveRegion="polite"`: "Tap the meatball to share this tool."

---

### Screen 4a: Run-mode render error

**Purpose.** Apologize for a rare failure and route the user out without losing trust.

**Layout (in body, replaces spec render):**

- Centered illustration: `alert-triangle` 64pt in `warning` color
- Headline `type-h1`: "This tool didn't render."
- Subhead `type-body`, `fg-muted`: "Something went wrong. Try recreating it."
- Primary button "Back to Library" (full-width, secondary variant)
- Secondary button "Recreate" (text-only, opens Create with prompt pre-filled)

This is a P0 bug if it happens. Sentry captures the spec hash and the renderer error. The user is never blamed.

---

### Screen 5: Settings sheet

**Purpose.** Sign-out, account info, V0.5 waitlist subscriptions, support.

**Triggered by:** tap on Library header avatar.

**Surface:** Gorhom Bottom Sheet, 75% height, dismissable.

**Layout:**

- Drag handle at top (4 × 36pt pill, `divider` color, 8pt below sheet top)
- Section: Account
  - Row: avatar + display name + Apple ID email (masked: `j••@privaterelay.appleid.com`)
- Section: Coming next update
  - Pill list of V0.5 capabilities the user has subscribed to (from out-of-scope captures + voice mic capture). Each pill shows capability name + "Notify me when ready" toggle. Default off; user opts in by tapping.
- Section: About
  - Row: Terms (opens web)
  - Row: Privacy (opens web)
  - Row: Help (opens email link)
  - Row: Version + build number — `type-micro`, `fg-faint`
- Section: Account actions
  - Sign out (destructive text)
  - Delete account (destructive, opens confirmation alert "This permanently deletes your tools.")

**Accessibility:**

- Sheet announces "Settings" on open.
- Drag handle has `accessibilityRole="adjustable"` with VoiceOver action "Dismiss."

---

### Tab bar (host chrome)

Persistent across Library, Create, and Run modes. (Settings sheet is modal, not a tab.)

**Layout:**

- 56pt tall plus safe-area bottom
- 2 tabs, evenly spaced
- Each tab: icon (24pt) + label (`type-micro`, 4pt below icon)
- Active tab: icon + label in `accent`; inactive: in `fg-muted`
- 1pt `divider` top border

**Tabs:**

| Icon | Label | Route |
|---|---|---|
| `grid-2x2` | Library | Library tab |
| `sparkles` | Create | Create tab |

**Behavior:**

- Tap inactive tab → navigate to that tab; icon + label crossfade to accent, slight scale on icon (1.0 → 1.06 → 1.0, 200ms `motion-snappy`).
- Tap active tab → scroll-to-top in that tab (if scrollable).
- In Run mode, tab bar is still present; tapping Library or Create dismisses Run mode and switches tabs.

**Accessibility:**

- Each tab: `accessibilityRole="tab"`, `accessibilityState={{ selected: <bool> }}`.
- Tab bar root: `accessibilityRole="tablist"`.

---

## Generated Cover Art Composition Formula

Cover art is the visual identity of a tool in the Library card grid. It's deterministic from `(stance, accent_palette, semantic_icon, cover_art_seed)` so the cover stays stable across re-prompts (canvas-v0.md AC-P4). Not LLM-generated — algorithmic.

### Inputs

| Input | Source | Stable across re-prompts? |
|---|---|---|
| `stance` | LLM picks at generation | No — re-prompt can flip stance |
| `accent_palette` | LLM picks at generation | No — re-prompt can flip palette |
| `semantic_icon` | LLM picks from 80-icon set | No — re-prompt can flip icon |
| `cover_art_seed` | Server-assigned at first generation; immutable across re-prompts | **Yes** — this is the stability anchor (canvas-v0.md AC-P4) |

The seed is what keeps the card's *shape* stable even when stance/palette/icon flip. Stance/palette/icon flips re-color and re-decorate; the underlying composition (which shapes, where, at what rotation) is the seed's job.

### The composition

Card cover area: 174 × 130pt at iPhone 14 (ratio 1.34:1).

**Layer 1 — Background:** filled with stance.bg-elevated. (`#FFFFFF` both stances.)

**Layer 2 — Shapes:** 3 geometric shapes from a 6-shape vocabulary, picked deterministically from `cover_art_seed`:

- Circle, square, rounded square, triangle, ribbon, arc

Each shape positioned, rotated, and scaled per seed. Productive stance: shapes use `accent` at 12% opacity. Expressive stance: shapes use `accent` at 24% opacity (richer color register).

**Layer 3 — Icon:** `semantic_icon` rendered Lucide-style, 32pt, in `accent`, centered + 8pt below center. Icon background: a `radius-full` 56pt circle in `bg` (`#FAFAF7` or `#FBF8F3` — same as page bg, so the icon sits in a "hole" through the colored shapes).

**Layer 4 — Title gradient (productive only):** vertical linear gradient from `bg-elevated` 0% at bottom to transparent at 30% — provides legibility floor for the title text below.

**Why this composition holds across 12 visual registers:**

- Shape vocabulary stays constant; only color and opacity change per stance.
- Icon recoloring tracks the palette, so a `dumbbell` icon reads as "fitness" in health-green, "discipline" in focus-indigo, "fun" in play-amber — same icon, three different feelings.
- Seed-stability means the user's mental model of "my Workouts tool is the one with the diagonal ribbon" survives a re-prompt.

### Worked example

Tool: "Track my workouts" → Tracker archetype → Expressive stance, Health palette, `dumbbell` icon, seed `0xa7c3...`.

- Layer 1: `bg-elevated` = `#FFFFFF`.
- Layer 2: 3 shapes from seed → arc (top-left, 32pt, 0° rotation), rounded square (right edge, 48pt, 18° rotation), ribbon (bottom-left, 80pt diagonal, -12° rotation). All in `accent` (Expressive Health = `#5B8F4D`) at 24% opacity.
- Layer 3: 56pt circle in `#FBF8F3`, centered + 8pt below; `dumbbell` icon 32pt in `#5B8F4D`.
- Layer 4: skipped (expressive doesn't use the bottom gradient).

The card's bottom 88pt is title + subtitle, on `bg-elevated` (`#FFFFFF`).

**Cal note:** the 6-shape vocabulary, the seed-to-position function, and the per-stance opacity rule live in `packages/design-system/coverArt.ts`. The renderer calls a single function `renderCoverArt({stance, palette, icon, seed}) → JSX` and gets back a `react-native-svg` tree. Pure function; snapshot-tested.

---

## Loading State Choreography (the 7–9s problem, fully specified)

The Generating screen is the highest-leverage screen for trust. Here's the full timing.

### Timing

| t | Surface state |
|---|---|
| 0ms | Submit tapped on Create. Generating screen presents via `motion-springy` slide-up. Progress bar at 0%. Message "Sketching the layout…" |
| 0–500ms | Hero illustration shapes start drifting (smooth motion). |
| 500ms | Server begins SSE stream. Bar starts linear interpolation toward 75%. |
| 3000ms | Crossfade to "Choosing colors…" (200ms). |
| 6000ms | Crossfade to "Filling in your seed data…" (200ms). |
| ~6500ms | Bar reaches 75%. Slowdown begins; 75 → 95% over 1.5s. |
| ~8000ms | Bar reaches 95%. Holds. (At p50 latency, server completes around here.) |
| <on success> | Bar fills to 100% over 200ms. 200ms hold. Generating screen dismissed via `motion-smooth`; Run mode mounts. |
| 9000ms (rare tail) | Crossfade to "Almost there…" Bar still at 95%. |
| <30s timeout> | Bar holds. Headline changes to "This is taking longer than usual." Below: "Cancel and retry" text button (cancels client-side; server-side request continues to completion or the 60s job timeout). |

### Why these messages

| Message | Maps to | Read |
|---|---|---|
| "Sketching the layout…" | Schema generation | "It's thinking about *what* it's going to make." |
| "Choosing colors…" | Stance + palette assignment | "It's making *aesthetic* decisions, like a designer would." |
| "Filling in your seed data…" | Seed data generation | "It's making the tool *yours*, with realistic content." |
| "Almost there…" | Tail-latency catch | Reassuring without lying. |

The messages don't reflect literal pipeline stages (V0 is single-call); they reflect what the user *imagines* the system is doing. Honesty in spirit, not in machine.

---

## First-Time-User Coachmark

**Surface.** Bottom-up speech-bubble pointing at the meatball icon in the host header.

**Trigger.** First Run-mode mount per user (across all tools — not per-tool). Stored in `expo-secure-store` as `coachmark_share_seen=true`.

**Layout:**

- Position: anchored to meatball, speech-bubble tail pointing up at it
- Width: 240pt
- Background: `bg-elevated`, `radius-md`, `elevation-floating`
- Padding: `space-md`
- Content: `sparkles` icon 16pt + `type-body` "Tap here to share this tool." + tappable "Got it" link in `accent`

**Behavior:**

- Appears 600ms after Run mode mounts, with `motion-smooth` 240ms slide-down + fade.
- Auto-dismisses on:
  - User taps anywhere outside the speech bubble
  - User taps "Got it"
  - User taps the meatball (the intended next action)
- Auto-dismisses after 8s with no interaction.
- Once dismissed, never re-appears for any tool.

**Accessibility:**

- Speech bubble has `accessibilityViewIsModal={true}` so VoiceOver focuses it.
- Announces: "Tip: Tap the options button to share this tool. Tap Got it to dismiss."
- Reduced motion: instant appear, no slide.

---

## Out-of-Scope Surface

**Surface.** Full-screen takeover from the Generating screen when generator returns `out_of_scope: { capability, reason }`.

**Layout (top → bottom):**

- Top safe area
- ← back button (top-left, 44pt hit, dismisses to Create with prompt preserved)
- Hero illustration (200 × 200pt) — per-capability illustration:

| Capability | Illustration |
|---|---|
| `image_gen` | Sketch of a paint palette and brush, soft rose accent |
| `vision` | Sketch of a magnifying glass over a leaf |
| `chat` | Sketch of two speech bubbles overlapping |
| `transcription` | Sketch of a microphone + waveform |
| `classification` | Sketch of nested folders / tags |

(Five illustrations, all by UX in week 1, ship in `apps/mobile/assets/`. Stance-neutral cream palette — they're cross-stance.)

- Headline `type-h1`, centered: "Almost — but not yet."
- Body `type-body`, `fg-muted`, centered, 80% width:
  - For `image_gen`: "Generating images is something Canvas is working on. We'll let you know the moment it's ready."
  - For `vision`: "Reading photos is something Canvas is working on…"
  - For `chat`: "Conversational tools are coming…"
  - For `transcription`: "Voice notes are coming…"
  - For `classification`: "Smart sorting is coming…"
- Email field — full-width, `radius-md`, `bg-elevated`, `divider` border, placeholder "you@example.com", pre-filled from Apple ID email if available, `keyboardType="email-address"`
- Primary button "Notify me" (full-width, `accent`, 48pt tall)
- Secondary button "Try a different idea" (full-width, text-only, opens Create with prompt cleared)
- Bottom safe area

**States:**

| State | What changes |
|---|---|
| Default | As above. Email pre-filled. |
| Email empty | Notify me disabled. |
| Email invalid | Inline error under field: "That doesn't look like an email." Notify me disabled. |
| Submitting | Notify me shows inline spinner. |
| Submitted | Replace primary content with confirmation: `check-circle` `success`-color icon + "Got it. We'll email you the moment <capability> is ready." Single button "Try a different idea" (full-width, secondary) → Create. |
| Error | Toast "Couldn't save. Try again." Field stays. |

**Telemetry.** On submit, fires `out_of_scope_intent` with `(capability, prompt_hash, timestamp)`. The user's email is captured separately for the V0.5 waitlist (canvas-v0.md AC-O3).

**Accessibility:**

- Headline `accessibilityRole="header"`.
- Email field `accessibilityLabel="Email for notification"`.
- Per-capability copy is read in full to VoiceOver.

**Why a full-screen takeover and not a toast:**

- Out-of-scope detection is a *moment of truth* — the user's idea hit a wall, and how we handle it determines whether they try again or churn. A toast says "your idea was wrong"; a takeover says "your idea is ahead of us, we're chasing it." That framing is the entire growth-hack: out-of-scope volume is the V0.5 prioritization input (canvas-v0.md §Success Metrics), and only a substantial surface produces emails at meaningful rates.

---

## Quota-Exhausted Surface

**Trigger.** Generator returns `429 quota_exhausted: { reset_at: ISO8601 }`.

**Surface.** Full-screen takeover from the Generating screen, similar shape to out-of-scope but lighter content.

**Layout:**

- Top safe area
- ← back button
- Hero illustration: `hourglass` icon 64pt in `warning`, on a soft `warning`-tinted `radius-full` circle 120pt
- Headline `type-h1`, centered: "You've hit today's limit."
- Body `type-body`, `fg-muted`, centered: "Canvas is free in this version. Your generations reset <relative time> — about <X tools left> until then." Where `<relative time>` is "tomorrow at 9am" or "in 4 hours" computed client-side from `reset_at`.
- Single primary button "Got it" (full-width, secondary variant — not accent, because we're not asking for an action) → Library tab
- Bottom safe area

**Notes:**

- No upsell in V0. (canvas-v0.md guardrail — V0 is creator-funded with hard-stop. Paid plans are V0.5.)
- The "<X tools left> until then" copy requires the server to send `daily_limit` and `used_today` in the error body, so the client can compute remaining tools (= 0 always at exhaustion, but the *time* part is the load-bearing info).

**Accessibility:**

- Headline + body in `accessibilityLiveRegion="polite"` so VoiceOver users hear the limit + reset time.

---

## Universal Link Install-Gate (web)

**Surface.** A static webpage at `https://canvas.app/m/{share_id}/clone`. Served as plain HTML/CSS/JS — *not* a webview inside the iOS app (canvas-v0.md AC-AR5 / brief §2.7). When a friend without Canvas installed taps the Universal Link, iOS opens this page in their default browser.

**Layout (mobile-first; desktop is the same with horizontal padding):**

- Above-the-fold (target: visible without scroll on iPhone 12 mini = 375 × 812):
  - Brand wordmark "Canvas" — top-left, 32pt
  - Hero card (full-width, `radius-lg`, soft drop shadow):
    - Cover art (rendered server-side from the same composition formula, fed `(stance, palette, icon, seed)` from the share record) — fills card top, 1.5:1 ratio
    - Below cover, `space-md` padding:
      - "@<maker_handle>" — small avatar + handle, `type-caption`, `fg-muted`
      - Tool name — `type-h1`, `fg`
      - 1-line description — `type-body`, `fg-muted`
  - Primary CTA — Apple "Download on the App Store" badge (Apple-prescribed asset, full-width, ~140pt tall on mobile). Tap → App Store with the Canvas listing + Branch / Adjust deferred-deep-link hint that delivers `share_id` post-install.

- Below-the-fold:
  - Section: "What is Canvas?"
  - Body: "Canvas is a personal canvas for your everyday tools. Describe a tool — like a workout tracker, a packing checklist, a daily journal — and Canvas builds it in seven seconds."
  - 3 example screenshots in a horizontal scroll (Library + Run mode + Create), 2:3 ratio each
  - Footer: small Canvas wordmark + Terms + Privacy

**States:**

| State | What changes |
|---|---|
| Cover art available + maker handle | As above |
| Share record not found (404) | Generic "This link doesn't work" page with a single CTA "Visit canvas.app" |
| Share record exists but creator deleted account | "This tool is no longer available." + same CTA |
| Page loaded on desktop browser | Same content, max-width 600pt, centered |

**Open Graph metadata** (for iMessage / Slack / Twitter rich previews):

```html
<meta property="og:title" content="<tool_name>" />
<meta property="og:description" content="Made by @<maker_handle> with Canvas" />
<meta property="og:image" content="https://canvas.app/m/<share_id>/cover.png" />
<meta property="og:type" content="website" />
<meta name="twitter:card" content="summary_large_image" />
```

`cover.png` is server-rendered from the same cover-art formula (same SVG rendered to PNG). The image preview in iMessage shows the cover art + tool name. **This is the maker's pride moment** — the share's social object should look like a real product, not a generic App Store page.

**Performance budget.** Static HTML + inline CSS, one PNG, one Apple badge SVG. Target: <50KB gzipped, FCP <800ms on 4G.

**Accessibility:**

- Wordmark `<header><h1>Canvas</h1></header>` (semantic).
- Cover art `<img alt="<tool_name> — a Canvas tool by @<maker>">`.
- App Store badge `<a aria-label="Download Canvas on the App Store">`.

**The deferred-deep-link round-trip:**

1. Friend taps Universal Link → `/m/{share_id}/clone` web page
2. Tap App Store badge → App Store opens with Canvas + a `?fallback_share_id=<share_id>` query param read by Branch SDK
3. Friend installs Canvas + opens
4. On first launch, Branch SDK delivers `share_id`
5. App calls `POST /mini-apps/clone { share_id }` server-side (after Sign in with Apple)
6. Library populates with the cloned tool
7. Celebration sheet bottom-up: "@maker shared '<name>' with you"

This is a real round-trip with multiple failure points (Branch SDK, Sign-in cancel, network drop). UX needs to design **graceful degradation** for each:

| Failure | UX response |
|---|---|
| Branch SDK doesn't deliver `share_id` | First launch lands on standard empty Library. No celebration. (User can paste link from clipboard if they kept it.) |
| Friend cancels Sign in with Apple | Stays on Sign-In; deferred-link cached for next attempt. |
| Network drop during clone | Library shows "Loading shared tool…" placeholder card until clone completes. |
| `share_id` invalid by clone time | Clone fails silently; Library is just empty. (Don't show an error — friend doesn't know what they expected.) |

---

## Internal Navigation Patterns — 4 (closed)

The generator picks one per mini-app at create time. The 4-pattern enum is a closed registry — see brief §3.7. All patterns live *inside* the host header + tab bar; they cannot replace either.

### Pattern 1: `none`

**Single-screen tool** (default for Calculator).

- No internal nav surface. Body fills available height.
- Suitable for: tip splitters, BMI calculators, simple game-result screens.

### Pattern 2: `stack`

**List → detail navigation** (default for ListCRUD, Journal).

- Mini-app's own subheader 32pt below host header (so total chrome = 64pt — still slim).
- Subheader contents on detail screens:
  - Leading: small `chevron-left` "Back" (subheader nav, distinct from host back) — 16pt icon, `type-caption` label
  - Title: detail item's title, `type-body` + 600 weight, ellipsize
  - Trailing: optional `edit` icon
- Subheader on list (root) screen: omitted; mini-app's own title comes from a `Heading` component.
- Push transition: native-stack default (iOS slide-from-right).

### Pattern 3: `tabs`

**Top segmented control** (default for Tracker — "Today / History" pattern).

- 36pt tall segmented control 12pt below host header
- Up to 4 tabs (closed limit; if generator emits 5+, schema rejects)
- Active tab: `accent` underline (2pt) + `accent` text; inactive: `fg-muted`
- Crossfade between tab content, 200ms `motion-smooth`

**No bottom tab bar inside mini-apps.** The bottom is reserved for host chrome. (Brief §3.7.)

### Pattern 4: `modal-overlay`

**FAB opens a sheet for compose / quick-add** (used by Tracker, Journal, ListCRUD).

- FAB at bottom-right, 56pt, `accent`, `elevation-floating`. Icon: `plus` by default; spec can override to `mic`, `camera`, `edit`.
- Sits 16pt above the host tab bar (so 56 + 16 = 72pt above bottom safe area)
- Tap → Gorhom Bottom Sheet, 75% height, contains a Form (one of the spec's compound components)
- Sheet dismissable via drag down or tap on overlay

---

## Component Specs — 28 components

Every component is a renderer-pure function of `{node, state, dispatch}`. Props below correspond to schema field names; Cal codegens these into `packages/protocol/spec.zod.ts` as Zod object shapes. Common props (`id`, `accessibilityLabel`) are noted once and elided per-component.

### Common props (all components)

| Prop | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | Unique within spec; referenced by actions |
| `accessibilityLabel` | string | optional override | Each component has a sensible default |
| `testID` | string | no | Renderer reserves |

Layout-affecting props (`padding`, `margin`) are NOT free-form — they take token names from `space-*`. Color props take token names from the color set. Radius props take from `radius-*`. The schema enforces.

### Layout tier (5)

#### `Screen`

Top-level wrapper. One per screen; not nestable.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `padding` | `space-*` enum | `space-lg` (productive) / `space-xl` (expressive) | Horizontal screen padding; vertical handled per-section |
| `safeArea` | `'top' \| 'bottom' \| 'both' \| 'none'` | `'both'` | Insets from device safe area |
| `children` | array | required | Nodes |

Variants: none (this is a layout primitive). States: none.

#### `Section`

Vertical content group with optional title.

| Prop | Type | Default |
|---|---|---|
| `title` | string | optional (omitted = no header) |
| `caption` | string | optional |
| `padding` | `space-*` | `space-md` (productive) / `space-lg` (expressive) |
| `children` | array | required |

Variants: with title, without title. States: none.

#### `Stack`

Vertical flex container.

| Prop | Type | Default |
|---|---|---|
| `gap` | `space-*` | `space-md` (productive) / `space-lg` (expressive) |
| `align` | `'start' \| 'center' \| 'end' \| 'stretch'` | `'stretch'` |
| `children` | array | required |

#### `Row`

Horizontal flex container.

| Prop | Type | Default |
|---|---|---|
| `gap` | `space-*` | `space-sm` |
| `align` | `'start' \| 'center' \| 'end'` | `'center'` |
| `justify` | `'start' \| 'center' \| 'end' \| 'space-between' \| 'space-around'` | `'start'` |
| `wrap` | bool | false |
| `children` | array | required |

#### `Card`

Visual container with elevation and padding.

| Prop | Type | Default |
|---|---|---|
| `elevation` | `'flat' \| 'raised' \| 'floating'` | `'raised'` |
| `padding` | `space-*` | `space-md` (productive) / `space-lg` (expressive) |
| `radius` | `radius-*` | `'md'` (productive) / `'lg'` (expressive) |
| `children` | array | required |

States: pressed (only if wrapped in an action — handled by parent).

### Typography tier (3)

#### `Heading`

| Prop | Type | Default |
|---|---|---|
| `text` | string | required |
| `level` | `1 \| 2 \| 3` | `2` |
| `align` | `'start' \| 'center' \| 'end'` | `'start'` |

Resolution: `level: 1` → `type-display` (productive) / `type-display` serif (expressive). `level: 2` → `type-h1`. `level: 3` → `type-h2`. Color: `fg`.

Accessibility: `accessibilityRole="header"`, `accessibilityLevel={level}`.

#### `Body`

| Prop | Type | Default |
|---|---|---|
| `text` | string | required |
| `weight` | `'regular' \| 'strong'` | `'regular'` |
| `color` | `'fg' \| 'fg-muted' \| 'fg-faint' \| 'success' \| 'warning' \| 'danger' \| 'accent'` | `'fg'` |
| `align` | `'start' \| 'center' \| 'end'` | `'start'` |

Resolution: `type-body`. Weight maps to 400/600.

#### `Caption`

Same shape as `Body` but resolves to `type-caption`. Color default `'fg-muted'`.

### Inputs tier (5)

#### `TextField`

| Prop | Type | Default |
|---|---|---|
| `label` | string | required |
| `placeholder` | string | optional |
| `value` | string (state-bound by `id`) | empty |
| `multiline` | bool | false (true = up to 5 lines, internal scroll) |
| `keyboardType` | `'default' \| 'email-address' \| 'url'` | `'default'` |
| `maxLength` | number | optional (default 500 single-line, 2000 multiline) |
| `optional` | bool | false |

Visual: label above input (`type-caption`, `fg-muted`); input height 44pt single-line, 88pt multiline; `radius-md`, `bg-elevated`, `divider` border 1pt; focus state border = `accent` + 2pt focus ring at `accent` + 24% alpha.

States: default, focused, error (border = `danger`), disabled (50% opacity).

Accessibility: `accessibilityLabel={label}`, error state announced via `accessibilityLiveRegion`.

Library: React Native `TextInput` wrapped in Reanimated for focus animation; Keyboard Controller for software-keyboard handling.

#### `NumberField`

Same shape as TextField but `keyboardType="numeric"`, `value: number`, accepts `min` / `max` / `step` props.

#### `DateField`

| Prop | Type | Default |
|---|---|---|
| `label` | string | required |
| `value` | ISO date string (state-bound) | today |
| `mode` | `'date' \| 'time' \| 'datetime'` | `'date'` |

Surface: tappable field showing formatted date (`type-body`); tap opens iOS-native `DateTimePickerIOS` in a Gorhom sheet.

#### `Picker`

| Prop | Type | Default |
|---|---|---|
| `label` | string | required |
| `value` | string (state-bound) | first option |
| `options` | array of `{ value: string, label: string, icon?: string }` | required, max 12 |

Surface: tappable field showing current label; tap opens Gorhom sheet with options as rows.

#### `Switch`

| Prop | Type | Default |
|---|---|---|
| `label` | string | required |
| `value` | bool (state-bound) | false |

Surface: full-width row, label left (`type-body`), iOS-native `Switch` right. Min 56pt row height for hit target. Switch `trackColor` on = `accent`, off = `divider`. Light haptic on toggle.

### Display tier (4)

#### `Stat`

Big-number display.

| Prop | Type | Default |
|---|---|---|
| `value` | string | required |
| `label` | string | required |
| `delta` | string | optional ("+12%", "-3 today") |
| `deltaTone` | `'positive' \| 'negative' \| 'neutral'` | `'neutral'` |
| `align` | `'start' \| 'center'` | `'start'` |

Visual: value in `type-display`, label below in `type-caption fg-muted`, delta in `type-caption` colored by tone (positive=`success`, negative=`danger`, neutral=`fg-muted`).

#### `Badge`

Small status pill.

| Prop | Type | Default |
|---|---|---|
| `text` | string | required |
| `tone` | `'neutral' \| 'accent' \| 'success' \| 'warning' \| 'danger'` | `'neutral'` |

Visual: 24pt tall, `radius-full`, padding `space-sm` horizontal, `type-micro` + 600 weight. Tone resolves background + foreground at low-saturation tints.

#### `Chip`

Tappable filter / selection chip.

| Prop | Type | Default |
|---|---|---|
| `text` | string | required |
| `selected` | bool | false |
| `icon` | semantic icon name | optional |
| `action` | action object | optional (default no-op) |

Visual: 32pt tall, `radius-full`, padding `space-md` horizontal, `type-caption`. Selected: `accent` bg + `accent-fg` text. Unselected: `bg-elevated` bg + `fg` text + `divider` border.

#### `Avatar`

| Prop | Type | Default |
|---|---|---|
| `name` | string | required (for fallback initials) |
| `imageUrl` | string | optional |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` (24/32/48 pt) |

Visual: `radius-full` circle, image if available, otherwise `accent` bg + `accent-fg` initials in `type-caption`.

### Lists tier (5)

#### `List`

Container for `ListItem` children, FlashList-backed.

| Prop | Type | Default |
|---|---|---|
| `collectionId` | string | required (links to a typed collection) |
| `itemLayout` | `'compact' \| 'standard' \| 'expanded'` | `'standard'` |
| `emptyState` | `EmptyState` node | optional (renderer renders one if absent) |
| `loadingState` | `LoadingState` node | optional |

FlashList is mandatory for >20 items. Renderer always uses FlashList; `estimatedItemSize` derived from `itemLayout`.

#### `ListItem`

| Prop | Type | Default |
|---|---|---|
| `title` | string | required |
| `subtitle` | string | optional |
| `leading` | `Avatar` \| `Badge` \| `Icon` \| null | optional |
| `trailing` | `Badge` \| `Stat` \| `Chip` \| `Icon` \| null | optional |
| `tapAction` | action object | optional |

Visual: row, 56pt tall (compact 44, standard 56, expanded 80), `space-md` horizontal padding, `divider` 1pt bottom border (productive) or `space-sm` gap (expressive). Tap: 100ms 92% opacity press, light haptic.

#### `SwipeableRow`

`ListItem` with leading and trailing swipe actions (e.g., archive on swipe-right, delete on swipe-left).

| Prop | Type | Default |
|---|---|---|
| (extends `ListItem`) | | |
| `leadingAction` | action object | optional |
| `leadingActionIcon` | semantic icon | optional |
| `leadingActionColor` | `'success' \| 'warning' \| 'accent'` | `'accent'` |
| `trailingAction` | action object | optional |
| `trailingActionIcon` | semantic icon | optional |
| `trailingActionColor` | `'danger' \| 'warning'` | `'danger'` |

Library: react-native-gesture-handler `Swipeable`, animated with Reanimated. Swipe threshold 80pt for confirmation.

#### `EmptyState`

| Prop | Type | Default |
|---|---|---|
| `icon` | semantic icon | required |
| `headline` | string | required |
| `body` | string | optional |
| `actionLabel` | string | optional |
| `action` | action object | optional |

Visual: centered, icon 48pt in `fg-muted` on `bg`-tinted `radius-full` 88pt circle, `space-lg` below; headline `type-h2`; body `type-body fg-muted`; action button (if present) full-width `Button variant: secondary`.

#### `LoadingState`

| Prop | Type | Default |
|---|---|---|
| `lines` | number | 3 |

Visual: skeleton rows mimicking `ListItem` shape; 1.5s shimmer (Reanimated), `divider` color block fading to `bg-elevated`. Reduced motion: static blocks.

### Compound tier (4)

#### `ConditionalSection`

Renders children only if predicate matches.

| Prop | Type | Default |
|---|---|---|
| `collectionId` | string | required |
| `showWhen` | `'whenEmpty' \| 'whenNotEmpty'` | required |
| `children` | array | required |

The entire conditional surface in V0 (brief §2.4 Registry 5). No expression DSL.

#### `ListSummary`

A single-line summary of a collection — the `aiProcess(summarize)` host.

| Prop | Type | Default |
|---|---|---|
| `collectionId` | string | required |
| `prompt` | string | required (e.g., "Summarize the last week's mood entries in one sentence") |
| `fallback` | `'show-raw' \| 'hide'` | `'hide'` |

On iOS 26+ Pro: dispatches to Apple Foundation Models, renders summary in `type-body` with `accent` left bar (4pt). On unsupported devices: hides (`fallback: hide`) or renders the raw last-3 collection items as bulleted body text (`fallback: show-raw`). Loading state during summarize: 1-line skeleton 1.5s shimmer.

#### `MediaTray`

Horizontal scrolling tray of images from a collection.

| Prop | Type | Default |
|---|---|---|
| `collectionId` | string | required |
| `imageField` | string | required (which collection field is the image) |
| `aspectRatio` | `'1:1' \| '4:5' \| '16:9'` | `'1:1'` |
| `tapAction` | action object | optional (default opens Gorhom sheet with full-size) |

Library: Expo Image for rendering; FlashList horizontal for the tray.

#### `ImagePicker`

| Prop | Type | Default |
|---|---|---|
| `label` | string | required |
| `value` | image reference (state-bound) | empty |
| `source` | `'camera' \| 'library' \| 'both'` | `'both'` |

Surface: 88 × 88pt placeholder (`bg-elevated`, `divider` border, `radius-md`, `image` icon centered) when empty; 88 × 88pt thumbnail when populated. Tap → action sheet (camera / library) → expo-image-picker.

### Actions tier (2)

#### `Button`

| Prop | Type | Default |
|---|---|---|
| `label` | string | required |
| `variant` | `'primary' \| 'secondary' \| 'destructive' \| 'text'` | `'primary'` |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` (32/44/56 pt height) |
| `icon` | semantic icon | optional (leading) |
| `iconPosition` | `'leading' \| 'trailing'` | `'leading'` |
| `action` | action object | required |
| `disabled` | bool | false |
| `loading` | bool | false |
| `fullWidth` | bool | false |

Visual:

- `primary`: `accent` bg, `accent-fg` text, `radius-md`. Pressed: 8% darken overlay. Light haptic.
- `secondary`: `bg-elevated` bg, `fg` text, `divider` border 1pt. Pressed: 4% darken.
- `destructive`: `danger` bg, white text. Pressed: 8% darken. Medium haptic.
- `text`: no bg, `accent` text. Pressed: 12% accent tint bg.

States: default, pressed, disabled (50% opacity, no haptic), loading (label hidden, inline spinner).

Accessibility: `accessibilityRole="button"`, label = `label`, state `disabled` propagated.

#### `FAB`

| Prop | Type | Default |
|---|---|---|
| `icon` | semantic icon | required (default `'plus'` if omitted by spec) |
| `action` | action object | required |
| `accessibilityLabel` | string | required (no default — FAB is iconic only, screen readers need explicit label) |

Visual: 56pt circle, `accent` bg, `accent-fg` icon 24pt centered, `elevation-floating`, springy on first mount, position bottom-right with `space-lg` from edges. Always sits above host tab bar (16pt clearance).

States: default, pressed (96% scale + medium haptic), disabled (50% opacity + flat elevation).

---

## Action Verb Feedback Contract

The 12-verb dispatcher renders feedback uniformly so generated tools feel coherent regardless of which verbs they use. (Revised 2026-05-08 from "13-verb": F-04 cut `share` from the spec — Share is host-meatball-only, not a renderer verb.)

| Verb | Feedback |
|---|---|
| `set` | Target component re-renders with new value. If a TextField, focus is *not* changed. |
| `update` | Same as `set`, but for collection items — animated row update via Reanimated `LayoutAnimation`. |
| `reset` | Same as `set`, but to schema's seed value. Light haptic. |
| `addItem` | New row enters list with `motion-springy` slide-down + fade. Light haptic. Optional toast "Added" if dispatch flag set. |
| `removeItem` | Row exits with `motion-smooth` slide-out + fade, 240ms. Medium haptic. **Always** shows undo toast for 5s with "Undo" action. |
| `updateItem` | Row updates in-place via `LayoutAnimation`, 200ms. Light haptic. |
| `clearCollection` | All rows exit staggered (40ms each); always wrapped in confirmation alert before dispatch. |
| `navigate` | Pattern-dependent: stack → push (native), tabs → segmented control change (crossfade), modal-overlay → Gorhom open. |
| `back` | Stack pop (native), tab → previous tab, modal → close. |
| `capture` | Opens expo-image-picker (camera). On capture: light haptic + thumbnail enters with `motion-springy`. |
| `toast` | Top-of-screen toast, `bg-elevated` bg, `divider` border, `type-body`, 3s auto-dismiss, swipe-up to dismiss early. Tone-tinted icon: `success` / `warning` / `danger` / `accent`. |
| `aiProcess` | Component renders its own loading state during dispatch (e.g., `ListSummary` shows skeleton). On completion: `motion-smooth` 240ms crossfade. On unsupported device: silently hides per fallback policy. |

**Toast queue:** single visible toast at a time. Queued toasts appear sequentially, 200ms gap between dismiss and next. Dispatch happens via the host (toast UI lives in `apps/mobile/src/components/Toast.tsx`, not in the renderer).

---

## Accessibility Reference

### VoiceOver labels — per component

(Defaults; spec can override per node.)

| Component | Default label |
|---|---|
| `Heading` | `text`, with `accessibilityRole="header"` and `accessibilityLevel={level}` |
| `Body` / `Caption` | `text` |
| `Button` | `label` |
| `FAB` | required from spec; no default |
| `TextField` / `NumberField` / `DateField` / `Picker` | `label`; current value announced; error state announced via live region |
| `Switch` | `label` + state ("on"/"off") |
| `Stat` | "<label>: <value>" + delta if present "<delta tone>: <delta>" |
| `Badge` / `Chip` | `text`; chip adds `accessibilityState={{ selected: <bool> }}` |
| `Avatar` | `name` |
| `ListItem` | `title`; subtitle appended if present; trailing element appended if it has accessible content |
| `SwipeableRow` | as ListItem; gestures announced via `accessibilityActions` |
| `EmptyState` | `headline`; body appended; action label appended as `accessibilityHint` |
| `LoadingState` | "Loading" |
| `ConditionalSection` | `accessibilityElementsHidden={false}` only when shown |
| `ListSummary` | "Summary: <generated text>" |
| `MediaTray` | "<imageField> from <collectionId>, <count> images" |
| `ImagePicker` | `label`; "Image selected" / "No image selected" |

### Contrast pairs — verified 4.5:1 minimum (AA body)

| Pair | Productive | Expressive |
|---|---|---|
| fg on bg | 16.4:1 | 13.2:1 |
| fg-muted on bg | 6.7:1 | 5.4:1 |
| fg-faint on bg | 3.2:1 (used only for non-text decoration) | 2.9:1 (same restriction) |
| accent-fg on accent | per palette table above (all ≥4.5:1) | per palette table above (all ≥4.5:1) |
| `success` text on bg | 5.1:1 | 5.0:1 |
| `warning` text on bg | 4.8:1 | 4.7:1 |
| `danger` text on bg | 5.4:1 | 5.0:1 |

`fg-faint` is rated AA-fail for body text and is documented as "decorative only" — the lint rule on the renderer rejects `fg-faint` as a `Body`/`Caption` color (it's only for placeholders, dividers' text-side variants, and `fg-faint`-on-`bg` validation tests).

### Touch targets

All interactive components hit ≥44 × 44 pt at all sizes. Enforced in component implementations, not the spec.

### Dynamic Type

V0 supports up to "Large" body size category. Type tokens scale linearly: at "Large", body becomes 18pt (productive) / 18pt (expressive). At "Extra Large" and above, the renderer caps at "Large" rendering — V0.5 expands.

### Focus order

Keyboard focus order follows visual top-to-bottom, left-to-right. Hardware keyboard support: tab to next focusable element, shift-tab to previous. iOS hardware keyboards on iPad supported; software-keyboard "Done" / "Next" actions wired via Keyboard Controller.

---

## Polish Acceptance Checklist (1-day pre-launch review)

Walked by UX week 6 against every demo mini-app + the host shell. Pass/fail per item.

### Animation timing

- [ ] Tab bar selection: snappy + 1pt icon scale, no overshoot
- [ ] FAB scale-in: springy, lands without bounce-back
- [ ] Sheet open: springy slide-up, lands at 75% with no settle wobble
- [ ] Sheet dismiss: smooth 240ms, no abrupt cut
- [ ] Run mode entry from Create: motion-springy, full-screen modal feel
- [ ] Coachmark appear: 600ms delay after Run mount, 240ms slide-down
- [ ] Generating progress bar: linear 0–75 over 6.5s, slowdown to 95% over 1.5s, hold to completion
- [ ] Toast slide-down: 250ms, centered, no jitter
- [ ] List row enter (addItem): motion-springy, no overshoot
- [ ] List row exit (removeItem): motion-smooth 240ms with undo

### Sheet behavior

- [ ] Settings sheet: drag-to-dismiss works, releases at >40% travel
- [ ] Library long-press action sheet: snap points feel right
- [ ] Out-of-scope email field: keyboard rises, sheet adjusts (Keyboard Controller)
- [ ] DateField picker sheet: iOS-native picker renders, doesn't leak default chrome
- [ ] Picker sheet: row tap dismisses sheet immediately
- [ ] Modal-overlay FAB sheet: drag-to-dismiss preserves form state on partial dismissal (snaps back)

### Type rendering

- [ ] Display serif (Tiempos / NY) renders crisp at 36pt
- [ ] SF Pro / Inter at body weight 400 looks correct at 16pt
- [ ] Letter spacing per type role applied
- [ ] Long titles ellipsize without overflow on iPhone SE
- [ ] Multi-line `Body` wraps at expected breakpoints
- [ ] Number fonts in `Stat` use tabular figures (`fontVariant: ['tabular-nums']`)

### List scrolling

- [ ] FlashList performance ≥58fps on iPhone 12 with 100-item list
- [ ] Pull-to-refresh feels native (iOS rubber band, no JS-driven jitter)
- [ ] Swipeable row gesture: completes at 80pt threshold, animates back if released early
- [ ] Long lists (200+ items): no flicker on FlashList recycling

### Keyboard handling

- [ ] Create input: keyboard rises, FAB stays visible above keyboard (Keyboard Controller)
- [ ] TextField in modal-overlay sheet: keyboard rises, sheet doesn't overlap input
- [ ] Hardware keyboard: tab order correct
- [ ] "Done" key dismisses keyboard without submitting (form requires explicit submit)
- [ ] Multi-line TextField: hardware Enter inserts newline; iOS hardware keyboard "return" same

### Cover art

- [ ] All 12 visual registers render distinct cover art
- [ ] Same `(stance, palette, icon, seed)` produces byte-identical SVG
- [ ] Cover SVG renders to PNG for OG previews without artifacts

### Cross-stance / cross-palette

- [ ] All 28 components render correctly in both stances
- [ ] Palette-resolved colors propagate (FAB, focus ring, accent text, chip selected, accent flash on share)
- [ ] Stance-resolved type families load on cold start without flicker

### Accessibility

- [ ] VoiceOver: all interactive elements announce label + state
- [ ] Reduced motion: all transforms collapse to opacity-only
- [ ] Dynamic Type "Large": no clipping, no overflow
- [ ] Hit targets: ≥44pt verified per component
- [ ] Contrast scan: passes for all stance × palette combinations

### Edge content

- [ ] Long titles, long item names, long captions don't break layout
- [ ] Empty seed (regression test — should never happen post-validation) shows EmptyState gracefully
- [ ] 200-item list scrolls without lag
- [ ] Right-to-left rotation: deferred V0.5, but `aria-orientation` correct in DOM-equivalent (RN: `accessibilityValue.text`)

### Cold start

- [ ] App cold-launch ≤2.5s on iPhone 14 (canvas-v0.md NFR)
- [ ] No font flicker (FOUT)
- [ ] First Library render ≤500ms after sign-in

### Network states

- [ ] Offline: Create disabled with banner "You're offline"
- [ ] Slow network: Generating screen tail-latency hold reads as "thinking" not "broken"
- [ ] Quota exhausted: surface lands cleanly, reset time accurate

### Universal Link round-trip

- [ ] Universal Link tap: Canvas opens (installed) or web install-gate (not installed)
- [ ] Install-gate page: cover art renders, OG image surfaces in iMessage
- [ ] Post-install delivery: deferred deep-link populates Library, celebration sheet shows

---

## Content & Copy Reference

| Surface | Element | Copy |
|---|---|---|
| Sign-In | Wordmark | "Canvas" |
| Sign-In | Tagline | "A personal canvas for your everyday tools." |
| Sign-In | Footer | "By signing in, you agree to our Terms and Privacy Policy." |
| Library | Header title | "Library" |
| Library | Search placeholder | "Search your tools" |
| Library | Filter — All | "All" |
| Library | Filter — Mine | "Mine" |
| Library | Filter — Shared | "Shared with me" |
| Library | Empty headline | "What do you want to build?" |
| Library | Empty subhead | "Three ideas to get you started." |
| Library | Empty chip 1 | "📓 Daily mood journal" |
| Library | Empty chip 2 | "🥗 Weekly grocery list" |
| Library | Empty chip 3 | "🏃 Track my workouts" |
| Library | No-results | "No tools match '{query}'." |
| Library | No-shares | "Tools your friends share will appear here." |
| Library | Long-press menu | Open / Share / Make changes / Archive / Delete |
| Library | Card subtitle | "Created {time}" |
| Library | Error banner | "Couldn't load your library. Pull to retry." |
| Create | Header | "Create" |
| Create | Input placeholder | "Describe a tool you want." |
| Create | Editing pill | "Editing '{name}'" |
| Create | Suggestions header | "Or try one of these" |
| Create | Suggestion chips | (rotated from canvas-v0.md §3.10 list) |
| Create | Submit a11y | "Generate tool" |
| Create | Mic placeholder | (sheet) "Voice input is coming soon. Want to be notified?" |
| Generating | Headline | "Building your canvas." |
| Generating | Message 1 (0–3s) | "Sketching the layout…" |
| Generating | Message 2 (3–6s) | "Choosing colors…" |
| Generating | Message 3 (6–9s) | "Filling in your seed data…" |
| Generating | Message tail (>9s) | "Almost there…" |
| Generating | Tail-30s | "This is taking longer than usual." |
| Generating | Cancel | "Cancel and retry" |
| Generating | Cancel-confirm title | "Cancel? You'll lose this generation." |
| Out-of-scope | Headline | "Almost — but not yet." |
| Out-of-scope | image_gen body | "Generating images is something Canvas is working on. We'll let you know the moment it's ready." |
| Out-of-scope | vision body | "Reading photos is something Canvas is working on. We'll let you know the moment it's ready." |
| Out-of-scope | chat body | "Conversational tools are coming. Want to be the first to try them?" |
| Out-of-scope | transcription body | "Voice notes are coming. Want to be the first to try them?" |
| Out-of-scope | classification body | "Smart sorting is coming. Want to be the first to try it?" |
| Out-of-scope | Email placeholder | "you@example.com" |
| Out-of-scope | Submit | "Notify me" |
| Out-of-scope | Submitted | "Got it. We'll email you the moment {capability} is ready." |
| Out-of-scope | Secondary | "Try a different idea" |
| Quota | Headline | "You've hit today's limit." |
| Quota | Body | "Canvas is free in this version. Your generations reset {relative_time}." |
| Quota | Primary | "Got it" |
| Run mode | Coachmark | "Tap here to share this tool." |
| Run mode | Coachmark dismiss | "Got it" |
| Run mode | Render error headline | "This tool didn't render." |
| Run mode | Render error body | "Something went wrong. Try recreating it." |
| Run mode | Render error primary | "Back to Library" |
| Run mode | Render error secondary | "Recreate" |
| Run mode | Meatball menu | Open / Share / Make changes / Rename / Archive / Delete |
| Run mode | Share success toast | "Link copied" |
| Run mode | Friend celebration sheet | "@{maker} shared '{name}' with you" |
| Run mode | Friend celebration primary | "Open" |
| Run mode | Friend celebration secondary | "Later" |
| Run mode | Field-migration toast | "Some fields changed. We kept what we could." |
| Settings | Header | "Settings" |
| Settings | Account section | "Account" |
| Settings | Coming next | "Coming next update" |
| Settings | About | "About" |
| Settings | Sign out | "Sign out" |
| Settings | Delete account | "Delete account" |
| Settings | Delete confirm title | "Delete your account?" |
| Settings | Delete confirm body | "This permanently deletes your tools and data. We can't undo this." |
| Install-gate (web) | Hero subtitle | "@{maker} made this with Canvas" |
| Install-gate | CTA | "Install Canvas to open" (Apple App Store badge) |
| Install-gate | Below-fold heading | "What is Canvas?" |
| Install-gate | Below-fold body | "Canvas is a personal canvas for your everyday tools. Describe a tool — like a workout tracker, a packing checklist, a daily journal — and Canvas builds it in seven seconds." |
| Errors (toast) | invalid_spec | "I couldn't turn that into a tool. Try a different idea." |
| Errors (toast) | rate_limited | "We're a bit busy right now. Try again in a minute." |
| Errors (toast) | internal | "Something went wrong on our end. Try again." |
| Errors (toast) | offline submit | "You're offline." |
| Errors (toast) | offline mid-gen | "Waiting for connection…" |

**Positioning copy guardrails (canvas-v0.md):** all UI copy has been audited against the forbidden / required table. No instance of "app builder", "no-code", "generate apps", "AI app generator", "code generation", "build apps with AI", "compile", "deploy", "publish app". Every reference to user output uses **tool**, **canvas**, or **share / link**.

---

## Component Inventory

### App-shell components (in `apps/mobile/src/components/`)

| Component | Status | Notes |
|---|---|---|
| `Wordmark` | New | "Canvas" type-only, Sign-In + install-gate |
| `AppleSignInButton` | New | Wraps `expo-apple-authentication` |
| `Tabs` (host tab bar) | New | 2 tabs, active-tab scroll-to-top |
| `LibraryHeader` | New | Title + avatar |
| `LibraryGrid` | New | FlashList 2-column |
| `LibraryCard` | New | Cover art + title + subtitle |
| `SearchField` | New | Pill-style with leading icon |
| `FilterChipRow` | New | 3 chips, selectable |
| `LibraryEmptyState` | New | Illustration + 3 chips |
| `CreateInput` | New | Multi-line TextField + char counter + mic |
| `SuggestedPromptChip` | New | Distinct from A2UI Chip; pre-fills Create input |
| `EditingPill` | New | Above input, dismissable |
| `GeneratingScreen` | New | Progress bar + cycled messages + animated illustration |
| `OutOfScopeScreen` | New | Per-capability illustration + email capture |
| `QuotaExhaustedScreen` | New | Hourglass + reset time |
| `RunHeader` | New | 32pt thin host header |
| `MeatballMenu` | New | Gorhom action sheet |
| `Coachmark` | New | One-time speech bubble |
| `RunRenderErrorScreen` | New | Apologetic state |
| `SettingsSheet` | New | Gorhom 75% sheet |
| `Toast` (host) | New | Single-toast queue |
| `CelebrationSheet` | New | Friend-recipient bottom sheet |
| `Skeleton` | New | Shimmer-disabled in reduced-motion |
| `BackButton` | New | Used in host header + sub-headers |

### A2UI catalog components (in `packages/a2ui-renderer/src/components/`)

All 28. Listed above with prop signatures. **All new.** All snapshot-tested across 2 stances × at-least-2 palettes.

### Design system primitives (in `packages/design-system/`)

| Primitive | Notes |
|---|---|
| `tokens.ts` | All tokens above as TypeScript constants |
| `theme.ts` | Stance + palette resolver |
| `coverArt.ts` | Composition formula (input: stance, palette, icon, seed; output: SVG tree) |
| `icons/` | 80 Lucide icon name → component map |
| `motion.ts` | Reanimated easing constants |

---

## Design Decisions & Rationale

| Decision | Why | Alternative considered |
|---|---|---|
| 2 tabs, not 3 (no Inbox) | Brief locks 2; designed for it. Inbox is V0.5. Adding it now adds a screen that needs design + implementation + a story for empty state. | 3 tabs (Library + Create + Inbox): rejected — Inbox can't be earned in 6 weeks. |
| Sign in with Apple only | Apple is universal on iOS, one-tap, Apple-blessed for App Review. Email/password ships V0.5. | Email magic link (M1's pattern): rejected — adds the email-roundtrip friction the brief specifically pushes against; users have to leave Canvas, check email, come back. Slower than Apple's one-tap. |
| Productive vs Expressive (2 stances), not 3 | 2 produces 12 visual registers via palette. 3 would produce 18 — more variety but tripling the design + implementation surface for marginal first-impression gain. Brief locks 2. | 3 stances: deferred to V0.5+. |
| Determinate progress bar paced to p50 | Indeterminate spinners read as broken at 5+ seconds. Determinate paced to p50 is honest 50% of the time and reassuring 100% of the time. | Indeterminate spinner: rejected — fails the trust test. |
| Coachmark on first Run-mode mount, not first Library mount | The share affordance is in the *meatball*, which is in Run mode. Coachmarking in Library would point at empty space. | Coachmark on Library: rejected — wrong target. |
| Out-of-scope as full-screen takeover, not toast | The capability-waitlist email is the *V0.5 prioritization input*. Full-screen yields meaningful capture rates; toast yields ~zero. | Toast: rejected — kills the growth-hack. |
| Per-capability illustrations on out-of-scope | The capability-specific framing turns "your idea was wrong" into "your idea is ahead of us." Reframing matters. | Single generic illustration: rejected — generic framing doesn't earn the email. |
| Quota hard-stop with no upsell in V0 | V0 is creator-funded with hard-stop per brief. Adding an upsell for V0.5 paid plans = scope creep + a half-built billing surface. | "Upgrade to Pro" CTA: rejected — V0 doesn't ship paid plans. |
| Cover art deterministic from `(stance, palette, icon, seed)` | Re-prompts must keep card identity stable; LLM regeneration must not flip the visual identity randomly. Seed anchors the composition; stance/palette/icon flips re-color. | LLM-generated cover image per regeneration: rejected — slow, expensive, and flips identity. Random per-regeneration: rejected — breaks the user's mental model of "the one with the diagonal ribbon." |
| Generated cover art uses 6-shape vocabulary, not photos | We don't have photo licensing in V0; royalty-free integrations are V0.5. Geometric shapes are stance-and-palette responsive without licensing. | Photo cover art: rejected for V0. |
| Lucide icons (80 set), not SF Symbols | Lucide is portable to Android in V0.5; SF Symbols ties us to iOS forever. | SF Symbols: rejected for portability. |
| Tiempos Headline (or NY fallback) for expressive display | Editorial register requires a display serif; Inter alone reads productive. | Inter throughout: rejected — kills the stance distinction. Bundling a heavy serif: licensing-gated; if Tiempos blocked, NY (system) is the fallback. |
| Bottom tab bar always present (even in Run mode) | Brief invariant #3. The user is always in Canvas. | Hide tab bar in Run mode: rejected by brief. |
| Re-prompt-to-edit, not in-place edit | Brief V0 cuts the edit pipeline. Re-prompt regenerates from scratch with field-migration. | In-place edit (M2's path): out of V0 scope. |
| Settings sheet as Gorhom modal, not a full screen | Settings is a destination but not a flow — sheet feels right. Sheet preserves the user's place in Library. | Full-screen modal: rejected — overweight for the few rows of content. |
| Meatball menu as Gorhom action sheet, not a popover | Action sheets are iOS-native pattern; popovers don't render correctly on phone (only iPad). | Popover: rejected for iPhone. |
| Universal Link install-gate as static HTML, not webview | Brief invariant: no webview renders user-facing content. Static HTML survives App Store + caches at CDN. | In-app webview: rejected by brief. |
| Cover art rendered to PNG server-side for OG images | Rich link previews in iMessage are the social object that earns the friend tap. SVG-only previews don't render on iMessage. | SVG-only OG: rejected — iMessage compatibility. |
| FlashList for everything ≥20 items | Brief invariant #8 (mandatory polish libraries). | FlatList: lint-blocked. |

---

## Notes for Cal

The high-leverage architectural reads — places where a wrong call costs a redo:

1. **Schema source of truth (`packages/protocol/spec.zod.ts`).** The token surface, component prop signatures, action verb shapes, palette + stance enums — all of these are codegen targets from the schema. The schema's source-of-truth nature means *adding a token here is a 4-file change* (schema + design system tokens + renderer + docs) and *removing one is a generation-breaking change* (existing specs reference the removed token). Plan for this.

2. **Two distinct color resolutions in the schema.** Stance-locked colors (10 of 12) are simple Zod enums. Palette-resolved colors (`accent`, `accent-fg`) require the schema to *not* let the LLM pick a hex — only the token name `accent` — and then the renderer applies the palette resolution at render time. This means the spec doesn't carry palette resolution; it carries the palette *name*, and the renderer's theme provider resolves `accent` → hex per stance × palette. Don't bake hex into the spec.

3. **Cover art is a pure function in `packages/design-system/coverArt.ts`.** Inputs: `(stance, palette, icon, seed)`. Output: react-native-svg tree (in-app) or PNG buffer (server, for OG). The same function runs on both the client and the server so cover art is consistent across the in-app card and the install-gate page. Server-side rendering uses `@resvg/resvg-js` or similar; both paths must produce byte-identical output for the same inputs.

4. **Stance + palette are spec-level fields, not screen-level.** The brief reserves a `stanceOverride` per screen for V0.5 — schema should encode that as `stance: Stance` at the top level + `screens[i].stanceOverride: Stance | null`, with V0 ignoring overrides. Don't embed stance in every component node; the renderer's theme provider hands stance down via context.

5. **`out_of_scope` is the *one* deviation from forced tool use.** Generator uses `tool_choice: 'auto'` between `produce_app_spec` and `out_of_scope`. The system prompt instructs the model: "If the prompt requires a capability not in the V0 catalog, call `out_of_scope` instead." Mobile checks the response shape and routes to the Out-of-Scope Surface. Capability enum is closed (5 values; `unknown` reserved for future).

6. **Field-migration logic on re-prompt-to-edit lives server-side, in the persistence layer.** When the new spec is validated, the server diffs the old spec's collection schemas against the new — matching by `(name, type)` — and emits a migration plan: `{preserved: [...], added: [...], removed: [...]}`. Migration runs synchronously before the new `mini_app_version` is committed. If `removed` is non-empty, set a flag on the version record so the client shows the field-migration toast on first Run-mode load.

7. **Coachmark seen-state belongs in `expo-secure-store`, not in `mini_apps` table.** It's per-device, not per-account. (A user signing in on a new device should see the coachmark again — it's an iOS gesture they need to learn on this device.) Single key: `coachmark_share_seen=true`.

8. **The Generating screen's progress bar is *paced*, not server-driven.** SSE events from the server can update the message text but they don't drive the bar. The bar is a 7s linear interpolation client-side, with slow-down zones at 75% and 95%. This avoids stalling when SSE events bunch.

9. **Telemetry whitelist** (carryover from ADR-0004 Step 8) — confirm the new V0 events are added: `share_link_copied`, `link_clone_opened`, `out_of_scope_intent`, `tool_session_open`, `tool_session_30s_interaction`, `summarize_invoked`, `quota_exhausted`. The `tool_session_30s_interaction` fires once per session per tool when the user has interacted (any dispatch) for ≥30s cumulative.

10. **Mandatory libraries — verify pinned versions.** Reanimated 4, Gorhom Bottom Sheet (latest), React Navigation native-stack, FlashList (Shopify), Expo Image, react-native-keyboard-controller. New addition vs M1: `lucide-react-native` for icons; verify it's RN-New-Architecture compatible.

11. **Sub-slicing the ADR** (Robert flagged this in canvas-v0.md notes; same recommendation here): I'd split into 4 ADRs for V0 — (a) protocol schema + design system tokens, (b) renderer + 28 components + action dispatcher + AI bridge, (c) generation pipeline + out-of-scope detection + telemetry update, (d) Universal Links + install-gate + clone flow. They're roughly 1 week each with parallelism.

12. **Apple Foundation Models on-device dispatch.** `react-native-ai-apple` is the package per brief §2.2. Single integration; treat the local model as a routing destination behind `aiProcess(summarize)`. On iOS < 26 or non-Pro device, the dispatcher returns `{ supported: false }` and the `ListSummary` component honors its fallback prop.

---

## Notes for Colby

Tactical implementation gotchas:

1. **Cover art SVG generation must be deterministic across server and client.** Use a shared seeded PRNG (e.g., `seedrandom` library) — *not* `Math.random()`. The seed string goes through SHA-256 first to produce a deterministic 64-bit value, then drives shape selection, position, rotation. Snapshot test fixes outputs.

2. **The 6-shape vocabulary's positions are computed deterministically.** Pseudo-code:
   ```
   const rng = seededPRNG(sha256(seed))
   const shapeCount = 3
   const shapes = [pickFrom(SHAPE_TYPES, rng) for i in 0..shapeCount]
   const positions = [{x: rng.float() * cardW, y: rng.float() * cardH, rotation: rng.float() * 360} for ...]
   ```
   Snapshot test verifies same seed → same positions across renders.

3. **FlashList `estimatedItemSize` per `itemLayout`:**
   - `compact`: 44
   - `standard`: 56
   - `expanded`: 80
   
   Wrong `estimatedItemSize` causes flicker on fast scrolls.

4. **Reanimated 4 vs Reanimated 3:** worklets API changed slightly. Cover-art SVG animations (Library card stagger entrance) use `useDerivedValue` + `withDelay` + `withTiming`. Don't fall back to `Animated` from RN core.

5. **Gorhom Bottom Sheet snap points:** Settings sheet `[75%]`, Library long-press `[40%]`, modal-overlay FAB `[90%]`. Sheet `enableDynamicSizing` for variable-content sheets (e.g., Picker with 3 options vs 12).

6. **Keyboard Controller:** wrap app root in `KeyboardProvider`. Use `KeyboardAvoidingView` from the package (not RN core). Set `keyboardOpeningOffset` for the host header height.

7. **Progress bar pacing:** use Reanimated `withTiming` with explicit timing config:
   ```
   sharedValue.value = withSequence(
     withTiming(75, { duration: 6500, easing: Easing.linear }),
     withTiming(95, { duration: 1500, easing: Easing.linear }),
     // hold at 95 until success or timeout
   )
   ```
   On success: `withTiming(100, { duration: 200 })` then dismiss.

8. **Coachmark anchoring:** measure the meatball icon's position with `onLayout` after host header mounts. Position the speech bubble below it with `position: 'absolute'`. Don't try to use a Tooltip library — they don't anchor to RN nodes cleanly.

9. **Per-capability out-of-scope illustrations:** ship as `react-native-svg` components in `apps/mobile/src/illustrations/` (5 files). Each is hand-converted from a Sketch / Figma export via SVGR-RN. Stance-neutral cream palette baked into the SVG (not theme-tinted) — they're cross-stance.

10. **Universal Link install-gate page:** lives in a separate static-site repo (or `apps/web/install-gate/`) — *not* in the React Native app. Build with Astro / Next static export / plain HTML. Hosted via Vercel / Cloudflare Pages. The web page is rendered at request time (server-rendered) so it can pull the share record's `(stance, palette, icon, seed)` and render the cover art into PNG via `@resvg/resvg-js`.

11. **Open Graph image route:** `/m/{share_id}/cover.png` server-side renders the cover art SVG to PNG (1200 × 630 — Twitter card 1.91:1, padded). Cache with `Cache-Control: public, max-age=86400, immutable`.

12. **Branch SDK setup:** for deferred-deep-link delivery post-install. Single `share_id` query param survives the App Store install round-trip. Test on real device — simulator install doesn't go through Branch's funnel.

13. **`expo-haptics` patterns:**
   - Light impact: `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)` — toggle, button press, list row tap
   - Medium impact: `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)` — share success, swipe-to-delete commit
   - Notification success: `Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)` — tool generated successfully
   - **Reduced motion** does *not* disable haptics; haptics are accessibility-positive.

14. **Sign in with Apple + display name:** Apple only sends the display name on *first* sign-in. Persist it server-side immediately; don't expect it on subsequent signs. If a user revokes + re-signs, you might lose the name — fallback to "Maker" as the host display.

15. **Apple Foundation Models guard:** the `aiProcess(summarize)` dispatch must check device support *synchronously* before showing skeleton. Otherwise users on unsupported devices see a 1.5s skeleton followed by silent removal — that reads as broken. Check on component mount; choose final state immediately.

16. **Don't blur app-shell components and renderer components in the same file.** Different packages, different prop contracts. Even when visually similar (e.g., shell `Button` vs A2UI `Button`), keep them separate. The shell's `Button` can have onboarding-specific behaviors; the A2UI's must remain a pure function of `{node, state, dispatch}`.

17. **Stance-resolved type loading:** if Tiempos is bundled, use Expo Font's `useFonts` hook in `App.tsx` and don't render until fonts are ready. NY fallback (system font) loads instantly. Test cold-start with both paths.

18. **`accessibilityLiveRegion="polite"`** on toasts and progress messages — but only fire it on *content change*, not on every render. Otherwise VoiceOver re-announces on every state update. Use `useEffect` with the message string as dependency.

19. **Reduced-motion checks:** import `AccessibilityInfo` from RN core; `AccessibilityInfo.isReduceMotionEnabled()`. Subscribe to changes; users can toggle mid-session. Cover-art animations and progress-bar pacing both honor this — but progress-bar pacing should still *animate* in reduced motion (it's information), just at lower frame rate (steps every 100ms instead of continuous).

20. **First-launch deferred-deep-link timing:** Branch SDK's `subscribe` listener fires *before* the React tree is mounted in some scenarios. Buffer the `share_id` in a top-level `useState` and pass to `LibraryGrid` once the user is signed in. Don't try to navigate from the Branch listener directly.

---

> ✅ UX design saved to `docs/ux/canvas-v0-ux.md`.
>
> **Status:** Parallel to `canvas-v0.md` §0 Sponsor reconciliation. Design system is decoupled from the pipeline question — Sable's work ships regardless of which §0 path is signed.
>
> **Next step:** Hand to Cal (`/architect`).
>
> **Note for Cal:** you can review this spec now, but you cannot start the V0 ADR until Sponsor (Alyona) signs off on canvas-v0.md §0 reconciliation (due 2026-05-12). The §0 decision determines whether ADR-0004's planner stage and `/edit` route are legacy or kept. Your ADR scope hangs on that answer. Review my spec for component signatures and codegen viability in the meantime — flag any prop signature that's awkward to express in Zod before §0 lands.

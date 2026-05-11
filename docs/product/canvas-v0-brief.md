# Canvas — V0 Decision Brief

For PM, Architect, and UX consumption. This is the document each team takes back to plan their workstream.

## Executive Summary

We are building Canvas, a native iOS app that lets users describe a personal tool in plain language and receive a working, shareable mini-app in 7-9 seconds.

V0 ships in 6 weeks. It proves four use case categories (lists, trackers, journals, calculators) with a closed component catalog, a single-call generation pipeline, and a Universal Link share flow. AI-rich use cases (try-on, vision, chat, image generation) are deferred to V0.5 and informed by V0 user signal.

The architecture is Server-Driven UI, not code generation. The LLM produces a structured JSON spec interpreted by a pre-bundled native renderer. No code crosses the network into the device. This survives App Store review, supports the design quality bar, and constrains the LLM to produce coherent output by construction.

---

## 1. Product Decisions (PM-owned)

### 1.1 Positioning

"A personal canvas for your everyday tools."

Not an app builder. Not no-code. Not an AI app generator. The framing is load-bearing for App Store review (the Replit and Vibecode rejections in early 2026 both involved positioning as "build apps with AI"). Internal and external copy must consistently use **canvas, tool, space**, never **app builder**.

### 1.2 Core User Loop

1. User opens Canvas.
2. Taps Create.
3. Types or selects a prompt ("track my workouts").
4. Waits 7-9 seconds with a loading screen.
5. Tool launches in Run mode with realistic seed data.
6. User interacts; data persists locally and to their cloud namespace.
7. User taps the meatball menu → Share → copies a Universal Link.
8. Friend taps the link → Canvas opens (or installs first) → mini-app appears in their Library and launches in Run mode with their own fresh copy of the seed.

### 1.3 V0 Scope — What's In

- iOS only. Light mode only. iPhone 14 and newer (older devices supported but `aiProcess(summarize)` gracefully degrades on pre-iPhone 15 Pro).
- Two tabs: Library, Create. Profile lives behind a header avatar opening a settings sheet.
- Four archetypes: ListCRUD, Tracker, Journal, Calculator.
- One AI capability at runtime: `aiProcess(summarize)`, on-device only (Apple Foundation Models on iOS 26+, otherwise gracefully hidden).
- Universal Link share flow with three modes: `view` (read-only of creator's content for cloud-shared — not applicable in V0), `clone` (friend gets fresh seeded copy), and `remix` (friend opens spec to fork — deferred to V0.5).

V0 effectively only ships `clone` mode. URL grammar reserves `view` and `remix` for forward compatibility.

### 1.4 V0 Scope — What's Deliberately Out

These are V0.5 candidates, prioritized by V0 user signal (waitlist captures from out-of-scope prompts):

- Image generation, vision, transcription, classification (unlocks try-on, plant ID, voice journal)
- Chat threads and conversational archetypes
- Charts, dashboards, financial primitives
- Edit pipeline ("modify this with AI")
- Cloud-shared collections, real-time multi-user sync
- Friend-fallback billing (V0 is creator-funded only; friends use creator's quota until exhausted)
- Inbox tab, notifications, activity feed
- Android, dark mode, the third visual stance

### 1.5 Out-of-Scope Prompt Handling

When a user's prompt clearly requests capabilities outside V0 (image gen, vision, chat), the generator responds:

> "This would need [capability]. That's coming in our next update — want to be notified?"

Captures email, logs the intent. This data drives V0.5 prioritization with real signal instead of guesswork.

### 1.6 Quotas & Billing

V0 ships creator-funded with hard-stop at limit. No friend-fallback payment in V0. When creator's daily AI quota is exhausted, the on-device summarize feature is the only AI runtime capability anyway, and on-device calls don't count against quota. Generation calls (the Sonnet pipeline) cost ~$0.05-0.10 per generation; we eat that at startup pricing tiers and surface limits in V0.5.

### 1.7 App Review Strategy

PM owns the Reviewer Notes document containing:

- Inventory of all 28 components with screenshots.
- List of 12 action verbs with descriptions.
- Statement: "All capabilities ship with this build. User prompts compose layouts from this fixed toolkit; they cannot introduce new code, components, or actions."
- The single AI capability (summarize, on-device only) with example output.
- Three example mini-app specs with screenshots of generated output.
- Direct contact for App Review questions.

A demo account pre-loads three mini-apps so reviewers don't wait through generation.

### 1.8 Success Metrics for V0

- **Activation**: % of installs that complete one Create flow.
- **Magic moment**: % of first-time users who interact with their generated tool for >30 seconds.
- **Share rate**: % of created tools that get a Universal Link copied within 7 days.
- **Friend conversion**: % of received Universal Links that result in app install.
- **Retention**: % of users who open Canvas in week 2.
- **Out-of-scope volume**: % of prompts hitting V0.5 capabilities, with breakdown by capability — this is the primary input to V0.5 scoping.

---

## 2. Architecture Decisions (Architect-owned)

### 2.1 Architectural Invariants — Non-Negotiable

These nine invariants are inviolable. Cutting any of them puts the product at App Store risk or undermines the design quality bar:

1. **No code crosses the network into the iOS app.** Specs are data; renderers are pre-bundled.
2. **No webview renders generated UI.** Everything native via React Native.
3. **Host chrome is always present.** Persistent header + bottom tab bar on every mini-app screen.
4. **The LLM never picks visual primitives.** Colors, sizes, shadows, fonts are all token-resolved.
5. **All AI calls go through the host's billing/moderation/quota layer.** Mini-apps cannot make direct API calls.
6. **Closed registries.** Components, action verbs, AI tasks, stances are all closed enums.
7. **Every collection has typed fields and seed data.** No untyped JSON. No empty first-open.
8. **Polish-critical UI uses the mandatory library list.** No bare-RN animations, no FlatList, no JS-driven sheets.
9. **OTA updates can change implementations, not capabilities.** New component types, action verbs, or AI tasks always require App Store update.

### 2.2 Platform & Tech Stack

Expo + React Native (New Architecture: Fabric + TurboModules). The existing codebase evolves; no platform migration.

**Mandatory polish libraries:**

- React Native Reanimated 4 — all animations
- Gorhom Bottom Sheet — sheets and modals
- React Navigation native-stack — uses native UINavigationController on iOS
- FlashList — any list with more than ~20 items
- Expo Image — image rendering
- React Native Keyboard Controller — input handling

**On-device AI:** React Native AI Apple package (Apple Foundation Models, iOS 26+ Pro devices). Single integration; treats local model as a routing destination behind the `aiProcess` action verb.

### 2.3 Pipeline — Single Stage

```
User Prompt
    ↓
Sonnet (streaming, tool-forced JSON output)
    ↓
Validate (Zod parse, capability check)
    ↓
Persist (server stores spec, mints share ID)
    ↓
Universal Link returned to client
```

Total latency: 7-9 seconds. Loading screen with witty messages during generation. No progressive render in V0; full mount when complete.

This collapses the two-stage Plan + Build pipeline from the current implementation back to single-call. The 4-archetype scope makes archetype warm-start savings marginal, and a single call simplifies prompt engineering, observability, and error handling.

**Edit pipeline:** not in V0. Modifications happen by re-prompting from scratch. The 7-9 second regeneration cost is acceptable; structured editing comes V0.5 once we see what kinds of edits users actually request.

### 2.4 The Protocol — Five Closed Registries

#### Registry 1: Components — 28 in V0

| Tier | Count | Components |
|---|---|---|
| Layout | 5 | Screen, Section, Stack, Row, Card |
| Typography | 3 | Heading, Body, Caption |
| Inputs | 5 | TextField, NumberField, DateField, Picker, Switch |
| Display | 4 | Stat, Badge, Chip, Avatar |
| Lists | 5 | List, ListItem, SwipeableRow, EmptyState, LoadingState |
| Compound | 4 | ConditionalSection, ListSummary, MediaTray, ImagePicker |
| Actions | 2 | Button, FAB |

Every component is deeply variant'd, themed for 2 stances × light mode, accessibility-correct, RTL-deferred to V0.5.

#### Registry 2: Action Verbs — 12

| Category | Verbs |
|---|---|
| State | set, update, reset |
| Collections | addItem, removeItem, updateItem, clearCollection |
| Navigation | navigate, back |
| Device | capture |
| Feedback | toast |
| AI | aiProcess (single verb dispatching summarize task only in V0) |

**Deliberately absent:** httpRequest, eval, compute, runScript, pickFile, notify, confirm, submitForm, openSheet. Network goes through `aiProcess` or synced collections. Sheets handled via `navigate`.

#### Registry 3: Collections — 2 Sync Modes

**Field types (closed enum):** `string | number | boolean | date | image | reference<T>`. No nested objects. No arrays. No JSON blobs. No location field in V0.

**Sync modes:**

- `local` — device-only, fresh seed per opener.
- `cloud-private` — synced to creator's namespace; each friend opening a clone gets their own private namespace, separately seeded.

No `cloud-shared` in V0. Multi-user sync is a separate engineering project; deferred to V0.5+.

**Seed data:** mandatory on every collection. Generated by the same Sonnet call that produces the spec. Realistic content (no lorem ipsum, no `["Item 1", "Item 2"]`).

#### Registry 4: AI Tasks — 1 in V0

| Task | Routing | Quota |
|---|---|---|
| summarize | on-device only (Apple Foundation Models) | free |

**Graceful degradation:** on devices without Apple Intelligence, components depending on `aiProcess(summarize)` either hide or show the raw content. No cloud fallback in V0 — keeps the AI surface zero-cost and zero-moderation in V0.

#### Registry 5: Predicates — Component-Internal

No expression DSL. No `whenEmpty`/`whenCountAtLeast` predicate vocabulary in V0. Conditional rendering is encapsulated inside specific components: `ListSummary` shows "No entries yet" if its collection is empty; `ConditionalSection` accepts `showWhen` from a tiny enum (`whenEmpty`, `whenNotEmpty`). That's the entire conditional surface. Anything more complex re-prompts.

### 2.5 Schema Source of Truth

```
packages/protocol/
  spec.zod.ts           ← single source, hand-edited Zod, ~300-450 lines
  generated/
    json-schema.json    ← LLM tool input_schema, derived
    types.ts            ← shared TS types, derived
    docs.md             ← prompt context, derived
```

CI rejects hand-edits to `generated/`. No dual strict/permissive split in V0; one schema serves both LLM and renderer. No SemVer versioning in V0; protocol changes ship via App Store updates like any other code change.

### 2.6 Codebase Structure

```
services/api/                         ← upgraded
  src/llm/
    generate.ts                       ← KEPT, single-call pipeline
    prompts/
      system.ts                       ← rewritten for 28-component catalog
    tools/
      produceAppSpec.ts               ← KEPT, schema upgraded

apps/mobile/                          ← rebuilt host
  src/screens/
    Library/
    Create/
    Run/                              ← mounts the renderer

packages/a2ui-renderer/               ← rewritten, 28 components
  src/
    render.tsx
    components/                       ← 28 implementations
    state/
      collections.ts                  ← typed store, 2 sync modes
      actions.ts                      ← 12-verb dispatcher
    ai/
      summarize.ts                    ← Apple Foundation Models bridge

packages/protocol/                    ← NEW
  spec.zod.ts

packages/design-system/               ← NEW
  tokens.ts                           ← 2 stances, 6 palettes
  icons/                              ← ~80 icons
```

No `packages/ai-router` in V0 (single on-device task doesn't need routing infrastructure).

### 2.7 Universal Link Share Flow

URL grammar: `canvas.app/m/{miniAppId}/{mode}` where mode is `clone` in V0 (other modes reserved).

iOS Universal Links via AASA file. Tap link → host opens (or installs first) → mini-app appears in Library and launches in Run mode with a fresh seeded copy of the creator's spec.

**Uninstalled friends** land on a static install-gate page on canvas.app — not a webview inside the iOS app. The install gate is yourapp.com served as a normal webpage with platform install CTA.

### 2.8 Server Stack

- TypeScript backend (existing `services/api/`).
- Anthropic API for Sonnet generation.
- Postgres for spec persistence and per-user namespaces.
- S3-equivalent for any user-uploaded images or captured photos.
- Auth: Sign in with Apple (V0). Email/password V0.5.

---

## 3. UX Decisions (UX-owned)

### 3.1 Design Philosophy

The host is calm, neutral, productivity-feeling — Notion-/Linear-class restraint. The mini-apps inherit one of two stances based on archetype: `productive` (lists, calculators) or `expressive` (trackers, journals). The chrome stays consistent; the content register adapts.

The LLM never makes visual decisions. Every visual choice is pre-made by UX in tokens and component implementations.

### 3.2 Token Surface (What the LLM Sees)

This is the entire visual vocabulary the model picks from. Anything not in this list is decided by UX once and locked.

| Category | Count | Tokens |
|---|---|---|
| Colors (resolved per stance + palette) | 12 | bg, bg-elevated, bg-overlay, fg, fg-muted, fg-faint, accent, accent-fg, success, warning, danger, divider |
| Spaces | 6 | none, xs, sm, md, lg, xl → 0, 4, 8, 12, 20, 32 |
| Radii | 4 | none, sm, md, lg, full |
| Type roles | 6 | display, h1, h2, body, caption, micro |
| Elevations | 3 | flat, raised, floating |
| Motion curves | 4 | instant, snappy, smooth, springy |
| Icons | ~80 | semantic names from a single locked icon set |

The LLM never picks hex, px, ms, font sizes, shadow values, breakpoints, or chrome dimensions.

### 3.3 Stance System — 2 in V0

| | Productive | Expressive |
|---|---|---|
| Density | Tight | Generous |
| Type | Functional, body-driven | Editorial, display-driven |
| Imagery | Iconographic | Photo-forward |
| Color | Restrained | Rich |
| Motion | Snappy | Smooth |

The generator picks one stance per mini-app from archetype + content hints. Schema reserves a `stanceOverride` field per screen for V0.5+.

### 3.4 Accent Palettes — 6

`focus, health, money, social, learn, play`. Generator picks one per mini-app. User can override in settings (V0.5; V0 is generator's choice).

### 3.5 Host Navigation — 2 Tabs

```
┌─────────────────────────┐
│  Library          [👤]  │  ← top: avatar opens settings sheet
├─────────────────────────┤
│                         │
│  [tool cards grid]      │
│                         │
├─────────────────────────┤
│   [📚 Library]  [✨ Create]   │  ← 2 tabs only
└─────────────────────────┘
```

Library is the home tab. Create is center, accent-colored, visually prominent. Profile/settings via the avatar in the Library header. No Inbox in V0.

### 3.6 Run Surface (Mini-App Rendering)

```
┌─────────────────────────┐
│  ←  Plant Journal   ⋯   │  ← thin host header (32pt) — always present
├─────────────────────────┤
│                         │
│  [mini-app's UI         │
│   internal nav lives    │
│   entirely inside this  │
│   region]               │
│                         │
├─────────────────────────┤
│ [📚 Library]  [✨ Create] │  ← host tab bar — always present
└─────────────────────────┘
```

Mini-apps cannot hide chrome, disable swipe-back, or full-bleed past the host frame. The user is always in Canvas.

### 3.7 Internal Navigation Patterns — 4

The generator picks one per mini-app:

- `none` — single-screen tool (calculators).
- `stack` — list/index pushes detail screens; back arrow in mini-app's own subheader below host header.
- `tabs` — segmented control at top of content area. Never a bottom tab bar (bottom is reserved for host).
- `modal-overlay` — primary action button (FAB) opens a sheet for compose/quick-add.

### 3.8 Create Flow — 4 Steps

1. **Prompt screen** — full-screen text input with placeholder "Describe your idea." Below: 6 curated suggested prompts (rotated weekly) matching V0 capabilities. Voice mic button. Submit is the accent.
2. **Generating** — full-screen loading state with 3 witty loading messages cycled, accent-color progress indicator, total duration ~7-9s.
3. **First open** — mini-app launches in Run mode with seed data populated. First-time-user coachmark overlay: "Tap ⋯ to share." Dismissable, never re-shown.
4. **Re-prompt for changes** — meatball menu offers "Make changes." Returns to step 1 with the original prompt pre-filled and editable. Regenerates from scratch (no in-place edit in V0).

### 3.9 Library — Tool Card Grid

2-column grid. Each card shows:

- Generated cover art (stance-themed background + accent color + semantic icon, generated at create time, immutable).
- Tool name (user can rename).
- 1-line description from the spec.

Top: search bar, filter chip row (All | Mine | Shared with me), and a "+ New" button shortcut to Create.

Long-press on a card: action sheet (Open, Share, Make Changes, Archive, Delete).

Empty state: large illustration, headline "What do you want to build?", three big tappable example prompts auto-filling Create.

### 3.10 Suggested Prompts (Curated for V0)

These appear on the Create screen rotated. All prompts must produce coherent output within V0's 4 archetypes:

- "Track my workouts"
- "Daily mood journal"
- "Trip packing checklist"
- "Reading list with notes"
- "Tip splitter for dinners"
- "Habit tracker for meditation"
- "Photo diary for my dog"
- "Weekly grocery list"
- "Sleep log"
- "Books I want to read"

Curation prevents users from typing prompts the V0 catalog can't fulfill on their first interaction.

### 3.11 Polish Acceptance — 1 Day Pre-Launch

UX walks every screen of every demo mini-app and the host shell. Fixes anything that feels wrong: animation timing, sheet behavior, type rendering, list scrolling, keyboard handling. Goal: zero "uncanny valley" moments where the app almost feels native but doesn't quite.

### 3.12 Accessibility — V0 Baseline

- All touch targets ≥44pt.
- VoiceOver labels on every interactive element.
- Contrast ratios meet WCAG AA.
- Dynamic Type supported up to "Large" (extra-large+ V0.5).
- No reliance on color alone for state.

Deferred to V0.5: full Dynamic Type, RTL, full VoiceOver semantics with custom rotor actions, reduced motion.

---

## 4. Timeline & Ownership

### 4.1 Six-Week Build

| Week | Track A (Architect) | Track B (UX) | Track C (PM) |
|---|---|---|---|
| 1 | Zod schema source. Universal Links integration. Host shell scaffold. | Design specs for 28 components. Token system. 2 stances × 6 palettes finalized. | Reviewer Notes draft. Curated prompt set. Create flow research. |
| 2-4 | Renderer. Action dispatcher. Collection store. Apple Foundation Models bridge. | Component implementation reviewed (Claude Code + designer pair). Stance themes applied. | App Review submission package. Demo content scripted. Launch comms drafted. |
| 5 | End-to-end pipeline integration. Generation prompt iteration on 4 archetypes. Out-of-scope detection. | Mini-app rendering review across all 4 archetypes × 2 stances. | Beta tester recruitment. Onboarding script. |
| 6 | Bug fixes. Performance audit. | One-day polish review. Final design QA. | App Store and TestFlight submission. Demo account seeded. |

### 4.2 Cross-Functional Sync Points

- Daily — async standup in Slack (15 min).
- Tuesday/Thursday — 30-min sync, three tracks together, review blockers.
- Friday — weekly demo of work-in-progress, all tracks (60 min).

### 4.3 Decision Authority

- **PM (Sam)**: scope, success metrics, App Review submission, launch story.
- **Architect (Maya, owning host shell + renderer; supported by Diego on schema and Tomás on AI/infra)**: technical decisions within the 9 invariants. Anything that touches an invariant requires panel review.
- **UX (Priya)**: all visual decisions, component variants, stance system, polish criteria. Veto on launch if the polish review reveals critical issues.

Disagreements escalate to a 30-minute three-person decision meeting; no async ping-pong on cross-track decisions.

---

## 5. Risks & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Generation quality on 4 archetypes is below bar | High | Week 5 dedicated to prompt iteration. Pre-week-5 generation testing on canonical prompts. Curated suggested prompts prevent first-impression failures. |
| Polish review reveals issues that take >1 day to fix | Medium | Mandatory libraries used from week 1, not added at the end. Per-component informal QA during weeks 3-4. |
| Apple rejects under 2.5.2 | Medium | "Personal canvas" framing. Reviewer Notes. Demo content. No webview. Pre-submission review by App Review Guideline expert (1-day external audit, week 5). |
| Universal Links plumbing slips | Low-Medium | Allocated week 1; tracked weekly. If slipping, fall back to copy-paste-link share flow for V0 — not ideal but ships. |
| 28-component catalog produces visually monotonous output | Medium | 2 stances + 6 palettes provide ~12 visual registers across mini-apps. UX validates variety in week 5 review. |
| Apple Foundation Models integration is unstable | Low | Graceful degradation already designed in. If on-device summarize doesn't work in V0, the feature hides; the rest of the app is unaffected. |
| Single-call pipeline produces lower quality than two-stage | Medium | Weeks 5 buffer for prompt iteration. If quality falls short, reintroduce planner stage in week 6 (1 week of work, ships in V0.1). |

---

## 6. The V0 Spine — One Sentence

A native iOS host app — light mode, two tabs, 28 deeply-variant'd components, 12 action verbs, 4 archetypes, 2 visual stances, 6 accent palettes, declarative collections with seed data, one on-device AI summarize verb, single-call Sonnet pipeline producing structured specs in 7-9 seconds — shareable by Universal Link, no webview, no code over the network, all data interpreted by a pre-reviewed renderer using mandatory polish libraries; 6 weeks build, 1 day pre-launch polish review, App Review submission immediately after.

---

## 7. Immediate Next Step

The dependency-blocking artifact is `packages/protocol/spec.zod.ts` — the Zod schema source of truth. Estimated 300-450 lines, ~1 day of focused work by the architect.

Once it lands:

- Architect can scaffold the renderer.
- UX can finalize component specs against typed prop signatures.
- PM can confirm the LLM tool input_schema for prompt engineering.

Everything else parallelizes from there.

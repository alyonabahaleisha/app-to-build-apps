# M2 — App Archetype Taxonomy

**Author:** Robert (CPO) | **Date:** 2026-05-05
**Status:** Draft — Pending Sponsor + Eng Lead sign-off (Week 1, D3 + catalog budget)
**Parent:** `docs/product/M2-milestone.md` §Critical-Path Dependencies (D3, D5)

> Locks the **8 archetypes** that frame the M2 eval set, the multi-screen
> renderer's coverage targets, and archetype routing in the generation
> pipeline. Also proposes the **A2UI catalog growth budget** for M2.
> This is a PM-owned artifact; Eng Lead confirms the budget by end of
> Week 1.

---

## Why this exists

Three downstream things all need this locked before they can start:

1. **150-prompt eval set (D4).** Every prompt must be archetype-labeled,
   with an even-ish distribution across the 8 archetypes, so SO-3's
   "no archetype below 75%" can be measured.
2. **Archetype routing in the generation pipeline.** The router needs a
   closed set of labels. Open-ended classification = unmeasurable
   regressions.
3. **Catalog growth budget.** Each archetype implies a minimum component
   set; the budget is the difference between what we have and what those
   minimums require, plus a small slack.

If the taxonomy is wrong now, every measurement and every routing decision
inherits the wrongness. That's why this gets locked in Week 1, before any
build.

---

## The 8 Archetypes

| #   | Archetype         | One-line definition                                                                       | Min screens | Default navigation                                                                                                                                  | Required catalog components                                                           | Generation success target |
| --- | ----------------- | ----------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------- |
| 1   | **List / CRUD**   | User maintains a collection of items with create/read/update/delete                       | 2           | Stack (list → detail). Tabs only if collection has clear top-level filters                                                                          | List, Card, Form fields, Button, Heading                                              | ≥85%                      |
| 2   | **Tracker**       | User logs an entry repeatedly over time and sees trend / streak                           | 2           | Tabs (Today / History)                                                                                                                              | Counter, Toggle, List, Card, Heading, simple Chart/Sparkline (proposed new primitive) | ≥85%                      |
| 3   | **Calculator**    | User enters inputs, sees a derived result. No persistence required                        | 1           | None (single-screen). **This is the H5-protected single-screen fallback case** — multi-screen routing must NOT force this archetype to multi-screen | Form fields, Button, Heading, Result block (Text)                                     | ≥90%                      |
| 4   | **Journal**       | User writes longer-form entries dated to a day; revisits past entries                     | 2           | Stack (list → entry view/edit)                                                                                                                      | List, Card, Form (long-form text), Heading, Button                                    | ≥80%                      |
| 5   | **Dashboard**     | User sees a summary of metrics at a glance, drills into one                               | 2           | Tabs (top-level) + Stack (drill-down). Tabs are primary                                                                                             | Card, List, Heading, summary metric blocks (Counter), simple Chart/Sparkline          | ≥75%                      |
| 6   | **Social / Feed** | Vertical list of cards (posts/items) with detail view; sample data only — no real backend | 2           | Tabs (Feed / Profile) + Stack (post detail)                                                                                                         | List/Feed, Card, Heading, Button, Form (compose)                                      | ≥75%                      |
| 7   | **Info Display**  | Reference / cheat-sheet / recipe content; index → topic detail                            | 2           | Stack (index → topic)                                                                                                                               | List, Card, Heading, text content blocks, Image                                       | ≥85%                      |
| 8   | **Simple Game**   | Self-contained interaction: quiz, flashcards, dice roller, tic-tac-toe                    | 1           | Stack if home → play → result; otherwise single-screen                                                                                              | Button, Counter, Toggle, conditional rendering, Heading                               | ≥75%                      |

**Overall SO-3 target:** ≥85% generation success across the 150-prompt set,
**no archetype below 75%**. The two 75%-target archetypes (Dashboard, Social,
Game) are the M2 hardness floor — if any of them slips below 75% at week 5,
that archetype's routing temporarily reverts to its safer cousin (Dashboard
→ List/CRUD; Social → List/CRUD; Game → Calculator) until the gap is closed.

---

## Eval set construction rules (input to D4)

- 150 prompts total, **~19 per archetype** (target distribution: 19, 19, 19, 19, 19, 19, 18, 18 — split chosen to keep numbers even and avoid implying false precision).
- Each prompt is **archetype-labeled** at authoring time (not classified
  post-hoc). PM + AI Eng code-review the labels.
- Each archetype includes a mix of:
  - **Concrete prompts** (e.g., "morning routine tracker with three habits and a streak") — 2/3 of the slot
  - **Vague prompts** ("an app to keep track of stuff for me") — 1/3 of the slot
- **Edit eval (50 prompts) labels** the same archetypes and is sampled from
  the 150-prompt outputs. Edit prompts must include at least 5 prompts per
  archetype (40 base; 10 cross-archetype "rephrase the whole thing"
  destructive edits to verify SO-4's preservation rule actually fails when
  it should).

---

## Out of taxonomy (M2)

- **Multi-actor / multi-user apps** (chat, marketplace, anything requiring
  another user's state). No real backend integrations is a hard non-goal
  per `M2-milestone.md`.
- **Map / location-aware apps.** Requires a primitive we don't plan to
  add to the M2 catalog.
- **Camera / media-capture apps.** Same reason.
- **Time-based / scheduled-trigger apps** (alarms, reminders that fire on
  a schedule). No background execution model in M2.

If a real-user prompt during alpha falls outside these 8, it's logged as
**out-of-taxonomy** with the prompt verbatim. This is a feature, not an
embarrassment — it's how we learn what M3's taxonomy needs to add.

---

## Routing decision rule (input to AI Eng)

Routing is performed by the **Plan stage** of the Plan → Build pipeline
(see `docs/product/M2-milestone.md` §Architectural Anchor). The planner
emits the archetype as a structured tool input; the build stage cannot
override it.

```
plan = planner(prompt, catalog, taxonomy, nav_rubric)
# plan.archetype : one of 8 archetypes | "unknown"
# plan.screens   : max 4
# plan.navigation: none | stack | tabs | tabs+stack | modal-overlay

if plan.archetype in {"Calculator", "SimpleGame"}:
    plan.screens may be 1
elif plan.archetype == "unknown":
    fallback to M1 single-screen path
    log("out-of-taxonomy", prompt)
else:
    plan.screens >= 2 required; planner re-prompted if it emits 1
```

The plan is **persisted** alongside the resulting spec version, so a bad
generation can be debugged against the actual plan rather than guessed at,
and edit calls can read the prior plan to scope intent.

---

## A2UI Catalog Growth Budget

**Today (M1):** 10 components.
**Proposed M2 ceiling:** **16 components** (+6).
**Sign-off needed:** Eng Lead by end of Week 1.

### Proposed additions (within +6 budget)

| #   | Component                                                                     | Why                                                                                                         | Used by archetypes |
| --- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------ |
| +1  | **TabBar** (navigation primitive)                                             | Tabs are the default nav for Tracker, Dashboard, Social/Feed                                                | 2, 5, 6            |
| +2  | **StackHeader** (navigation primitive — back button + title)                  | Stack nav default for List/CRUD, Journal, Info Display, Game                                                | 1, 4, 7, 8         |
| +3  | **Modal** (navigation primitive)                                              | Compose / quick-add flows without leaving the current screen                                                | 1, 4, 6            |
| +4  | **DetailHeader** (visual primitive — large title + subtitle + optional image) | Detail screens look like forms today; this is the single biggest rubric-score win on Hierarchy + Typography | 1, 4, 5, 6, 7      |
| +5  | **Sparkline / SimpleChart** (visual primitive — line or bar, no axes)         | Trackers and Dashboards both need an at-a-glance trend; without this they read as "lists of numbers"        | 2, 5               |
| +6  | **EmptyState** (visual primitive — icon + heading + body + optional CTA)      | Every list-driven archetype has a first-run empty state today that reads as broken                          | 1, 2, 4, 5, 6, 7   |

### What this budget is NOT for

- Form-field variants beyond what M1 already has (no slider, no date picker
  v2, no rich text). If a prompt needs them, it's out-of-taxonomy.
- Avatar / chip / badge / stepper / progress bar / segmented control. Each
  is a real primitive but each widens the bad-generation surface; deferred
  to M3 unless an archetype's success rate is blocked on it.
- Anything that requires native modules beyond what `apps/mobile` already
  has bundled. The catalog ceiling is also a _native dependency ceiling_.

### Trade-off rule

Any proposal beyond the +6 budget must:

1. Identify which existing component or proposed addition it replaces, OR
2. Be approved jointly by Sponsor (Alyona) + Eng Lead with a written
   rationale linked from this doc, OR
3. Be deferred to M3.

"It would be nice to have" is **not** a rationale.

---

## Ask / Next Steps

| Owner                | Action                                                                                                                                                                                                                  | Due           |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| **Eng Lead**         | Confirm or push back on the +6 catalog budget. Identify any of the 6 proposed primitives that are unsafe within M2 timeline (especially Sparkline)                                                                      | End of Week 1 |
| **Alyona (Sponsor)** | Sign off on the 8-archetype taxonomy and the 75% / 85% / 90% per-archetype floors                                                                                                                                       | End of Week 1 |
| **AI Eng + PM**      | Begin authoring the 150-prompt eval set against this taxonomy on Week 2 — do not block on Eng Lead budget confirmation if archetype list is signed off (eval prompts don't depend on the catalog being implemented yet) | Start Week 2  |
| **Mobile Eng**       | Once budget is confirmed, prepare technical-design notes for each of the 6 new primitives ahead of `/architect`                                                                                                         | Week 2        |

## Handoff

> ✅ Taxonomy + catalog budget saved to `docs/product/M2-archetype-taxonomy.md`.
>
> **Open for sign-off:** Sponsor (Alyona) on archetype list and per-archetype
> targets; Eng Lead on +6 catalog budget.
>
> **Once signed off, next per-feature specs to spin (in priority order):**
>
> 1. **Analytics instrumentation** (D1) — owner Data/Analytics — `/architect` directly (no UI).
> 2. **Visual rubric authoring** (D2) — owner Design Lead — non-engineering artifact, but worth a written brief.
> 3. **Multi-screen renderer + navigation primitives** (D5, D6) — `/ux` then `/architect`.
> 4. **Edit-preservation logic + CI eval** (D7) — `/architect` directly (server-side, no UI).
> 5. **In-app feedback path** (part of SO-5) — `/ux` then `/architect`.
> 6. **Alpha distribution** (D8) — `/architect` directly (DevOps/release engineering).

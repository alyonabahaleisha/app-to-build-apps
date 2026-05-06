# Milestone Brief: M2 — Quality Threshold

**Author:** Robert (CPO) | **Date:** 2026-05-05
**Sponsor:** Alyona Yanuchek
**Status:** Draft — Pending Sponsor / Eng Lead / Design Lead Sign-Off
**Hypothesis under test:** H5 (see `docs/product/hypothesis-tracker.md`)
**Predecessor:** M1 (chat → generate → render → publish loop, 10-component A2UI catalog)
**Successor:** M3 (payments, full marketplace, store submission) — out of scope here

> Milestone-level brief, not a feature spec. Owns the *measurable target* and
> the *kill criteria*. Per-feature specs (multi-screen renderer, navigation
> primitives, edit-preservation, alpha cohort tooling) are children of this
> doc and follow the standard Feature Spec template before any of them go to
> `/ux` or `/architect`.

---

## Decision

Run M2 as a **6–8 week, evidence-led milestone** to test H5 — that there is a
visual and structural quality threshold above which generated apps are kept
and shared, and below which they are abandoned regardless of functional
correctness. M1 proved we *can* generate; M2 proves the output is *good
enough that users come back and share*.

**Week 1 is instrumentation and baseline only — no build.** Quality work that
ships before the baseline is measured is unfalsifiable and will be rejected.

**Week 7 holds a kill-criteria review.** If retention and share targets are
not directionally on track at that point, M2 ships as a *learning* (H5
disconfirmed) rather than a polish project. This is protected scope, not a
soft option.

## Rationale

- M1 proved generation works in eval; we still don't know whether anyone
  *uses what they generate*. Today's <10% second-session rate is the wall.
- The quality of the output is the suspected dominant variable in retention.
  If true, every later milestone (memory, edit-by-chat at depth, marketplace
  liquidity) sits on a foundation that won't hold without M2.
- If H5 is **false**, that is the most valuable result M2 can produce —
  earlier, cheaper, and more decision-relevant than nine months of polish.
  The kill review at week 7 exists to make that finding shippable, not
  embarrassing.
- Quality is the load-bearing wall before any growth investment. Recruiting
  alpha users into a product they abandon after one session burns the
  cohort and the trust.

## Hypothesis (H5)

**H5 — Quality threshold drives retention.** There exists a visual and
structural quality bar above which generated apps are kept and used, and
below which they are abandoned regardless of functional correctness.
Generation reliability alone (H3) is necessary but not sufficient.

**Measured by:** second-session return rate and share/publish rate as a
function of designer rubric score on the alpha cohort.

**Disconfirmed if:** rubric score and second-session return are uncorrelated
on the alpha cohort (Spearman |ρ| < 0.2 over n ≥ 50), or if return rate
plateaus below 25% even on the rubric-top quartile of generations.

## Architectural Anchor — Plan → Build pipeline

**Decision (locked Week 1, Sponsor approved 2026-05-05):** M2 generation
shifts from M1's single-LLM-call architecture to a two-stage **Plan → Build**
pipeline. SO-1 (structural coherence), SO-3 (breadth), and especially SO-4
(edit preservation) are not reliably reachable on a single-call architecture
once the output is multi-screen.

### Pipeline shape

| Stage | Model | Job | Output | Latency budget (p95) |
|---|---|---|---|---|
| **Plan** | `claude-haiku-4-5-20251001` | "PM-who-knows-the-catalog." Decide archetype, screens, navigation pattern, and (on edits) edit-intent. Catalog- and rubric-aware. Cannot emit an A2UI spec | Structured plan via forced tool use | ≤10s |
| **Build** | `claude-sonnet-4-6` | Render the plan into an A2UI spec, conditioned on the plan + the cached catalog block. Cannot change archetype, screens, or nav pattern | A2UI spec (or RFC 6902 patch on edits) via forced tool use | ≤80s |
| **Total** | — | — | — | **≤90s p95** |

### Planner inputs

- User prompt + conversation history (for edits)
- The A2UI component catalog (cache-shared with the builder so the cache hit holds)
- The 8-archetype taxonomy (closed set + `unknown`)
- The navigation-pattern rubric (Design's Week-1 deliverable D2)

### Planner outputs (structured)

- `archetype`: one of the 8 + `unknown`
- `screens[]` (max 4): `{role, purpose, key_components[]}` — sketch, not a full spec
- `navigation`: `none | stack | tabs | tabs+stack | modal-overlay`
- `edit_intent` (edit calls only): `{target_screens[], target_node_ids[], do_not_touch_allowlist[]}`

### Why this is the right shift

| Target | Single-call (M1) | Plan → Build |
|---|---|---|
| SO-1 nav appropriateness | Implicit, drift-prone | Explicit, rubric-checked before build |
| SO-3 archetype floor | Routing decisions tangled with content choices | Routing is a planner output; archetype routing is observable |
| SO-4 edit preservation | LLM must hold "intent + patch" in one shot — main reason today's edits regress | Planner reasons about intent; builder emits patch against an explicit allowlist |
| Debugging | Root cause = "the LLM" | Plan artifact is persisted; build can be replayed against a fixed plan |

### Guardrails

- **Catalog ceiling unchanged** — planner can only route to components in the agreed +6 catalog budget (`docs/product/M2-archetype-taxonomy.md`).
- **Single-screen fallback preserved** — `archetype == "unknown"` and `Calculator` / `Simple Game` are allowed to emit 1-screen plans. The planner does not force multi-screen.
- **Plan artifact persisted** alongside every spec version (schema decision in ADR — Cal). This is what edit diffing reads and what enables eval-time replay.
- **Latency overrun rule** — if total p95 > 90s, the planner is simplified (or moved to a smaller model surface) **before** the builder is cut. Builder quality is the H5 lever; planner is the routing lever.
- **Cost** — roughly 1.5–2× per generation vs. M1, partly offset by Haiku on planner. Accepted by Sponsor as the price of SO-4.

### What this means for Week 1

The Plan → Build ADR (Cal, `/architect`) becomes the **first** M2 build dependency, ahead of analytics instrumentation, because the analytics events emitted by generation depend on the planner's structured output (archetype, screen count, nav pattern). It is the top of the build queue.

## Primary Objective & KPIs

| KPI | Definition | Measurement | Target | Today |
|---|---|---|---|---|
| **Second-session return** | % of generated apps reopened ≥1 time within 7 days of creation, by the creator | Analytics event `app_session_open` keyed by `(user_id, project_id)`; cohort window is rolling 7d post-creation | **≥40%** on alpha cohort | <10% |
| **Share/publish rate** | % of users who, having generated ≥1 app, take a share OR publish action within 7 days | Events `share_intent_clicked` and `publish_clicked` (publish remains M2-instrumented intent only — actual marketplace publish is M3) | **≥25%** on alpha cohort | not measured |

Both targets must be hit on the **alpha cohort**, not on internal users.
Internal dogfood is for finding P0 bugs, not for moving these numbers.

## Supporting Objectives & KPIs

| # | Objective | KPI | Target | Failure mode it prevents |
|---|---|---|---|---|
| SO-1 | **Structural coherence.** Generated apps have real architecture, not single-screen forms | (a) ≥80% of generations produce ≥2 screens with working navigation; (b) ≥90% of multi-screen apps use a navigation pattern (tabs or stack) appropriate to the app type per the written rubric | (a) ≥80% / (b) ≥90% | "It's beautiful but it's just a form" |
| SO-2 | **Visual quality bar.** Outputs are visually indistinguishable from hand-built apps to non-technical viewers | (a) Blind test of 20 generated outputs mixed with 10 hand-built reference apps: non-technical raters misclassify ≥50% of generated apps as hand-built; (b) Designer rubric score (spacing, hierarchy, typography, color, alignment, density) averages ≥3.5/5 across the eval set, scored by two independent designers | (a) ≥50% / (b) ≥3.5 / 5 | "It's clearly AI slop" |
| SO-3 | **Generation breadth.** System handles the shapes of apps real users want | Expand eval set 30 → 150 prompts spanning 8 archetypes (list/CRUD, tracker, calculator, journal, dashboard, social/feed, info display, simple game). Generation success ≥85% across the full set with **no archetype below 75%** | ≥85% overall, ≥75% per archetype | "It only does one kind of app well" |
| SO-4 | **Edit reliability.** Edit-by-chat preserves what the user didn't ask to change | ≥90% of single-intent edits modify only the requested element with no regressions on untouched screens, validated on a 50-prompt edit eval set running in CI | ≥90% | "I asked for one change and it rewrote the whole app" |
| SO-5 | **Discovery readiness.** We can hand the app to 50 external alpha users without babysitting | (a) Zero P0 bugs in a 2-week internal dogfood; (b) p95 generation latency ≤90s sustained; (c) Working in-app feedback path on every generation | (a) zero P0 / (b) ≤90s / (c) shipped | "Alpha cohort burns out before week 2" |

All five must hit on the **expanded 150-prompt eval set** (SO-1 through
SO-4) and the alpha cohort (SO-5).

## Acceptance Criteria — M2 is "done" only when ALL hold

- [ ] **Baseline measured in week 1.** Current 7-day return rate, current
  share/publish-intent rate (instrumented now), current visual rubric score
  on a sample of M1 outputs. Documented in
  `docs/product/M2-baseline.md` before any M2 build work starts.
- [ ] **All five supporting objectives** hit numeric targets on the
  expanded 150-prompt eval set (SO-3 set; SO-4 on the 50-prompt edit set).
- [ ] **Visual rubric is written, version-controlled, and applied by two
  independent designers.** Inter-rater agreement (Cohen's κ or Krippendorff's
  α on ordinal 1–5 scores) **≥0.7** before any rubric scores count toward a
  KPI gate.
- [ ] **50-user alpha cohort runs ≥2 weeks** with in-app feedback collected
  on every generation; ≥40% second-session return observed on the cohort.
- [ ] **Edit eval (50 prompts) automated and runs in CI** on every prompt
  change or component-catalog change; regressions block merges.
- [ ] **Sponsor + PM + Eng Lead + Design Lead joint sign-off** in a recorded
  H5 review at week 7 or week 8.

## Critical-Path Dependencies

| # | Dependency | Owner | Due | Blocks |
|---|---|---|---|---|
| D1 | Analytics instrumentation: second-session return funnel, share/publish-intent events, per-archetype generation success | Data / Analytics | End of week 1 | All KPI measurement; baseline doc |
| D2 | Visual rubric authored, signed off by Design | Design Lead | End of week 1 | Any rubric-gated KPI |
| D3 | Archetype taxonomy locked (8 archetypes) | Product (Robert) | End of week 1 | 150-prompt eval authoring |
| D4 | 150-prompt eval set authored, archetype-labeled, code-reviewed by AI Eng + PM | AI Eng + Product | End of week 3 | SO-2, SO-3 measurement |
| D5 | Expanded A2UI component catalog: navigation primitives (tab bar, stack, modal, list-detail) + extended visual primitive set | Mobile + AI Eng | Mid week 3 | Multi-screen generation |
| D6 | Multi-screen renderer + navigation primitives in A2UI | Mobile Eng | End of week 4 | SO-1 |
| D7 | Edit-preservation logic + automated 50-prompt edit eval in CI | AI Eng + Backend | End of week 4 | SO-4 |
| D8 | Alpha distribution channel ready (TestFlight + internal Play track), ≥50 invited testers slotted | Mobile Eng + Product | End of week 5 | Week 6+ alpha |

## Owners & Responsibilities

| Function | Owns |
|---|---|
| **AI / Agent Engineering** | Generation pipeline upgrades, expanded prompts, archetype routing, edit-preservation logic, eval harness expansion (30 → 150) |
| **Design** | Visual rubric authorship, blind-test coordination, designer rating sessions, navigation-pattern decision rubric |
| **Mobile Engineering** | Multi-screen renderer, navigation primitives in A2UI, in-app feedback path, alpha build distribution |
| **Backend Engineering** | Expanded spec schema for multi-screen apps, share/publish-intent telemetry, edit-diff persistence |
| **Data / Analytics** | Baseline measurement (week 1), second-session-return funnel, cohort dashboard, day-30 readout |
| **Product (Robert)** | Archetype taxonomy, kill/double-down criteria, hypothesis tracker entry for H5, alpha recruitment |

## Timeline

| Week | Focus | Deliverables | Build allowed? |
|---|---|---|---|
| **1** | Instrument + baseline + lock rubric and taxonomy | Analytics live; baseline doc; visual rubric v1.0 signed off; 8-archetype taxonomy locked; component-catalog growth budget agreed | **No** — no build work |
| **2–3** | Catalog expansion + eval authoring + first rubric pass | Navigation primitives in A2UI; 150-prompt eval authored and labeled; first designer rubric pass on M1 outputs | Yes |
| **3–5** | Ship multi-screen + edit-preservation + visual upgrades | Multi-screen generation; archetype routing; edit-preservation logic; CI 50-prompt edit eval; iterate against rubric | Yes |
| **5–6** | Internal dogfood + first blind test | Zero P0 dogfood gate; first blind-test results; tighten weakest archetype | Yes |
| **6–8** | Alpha cohort + readout | 50-user alpha for ≥2 weeks; in-app feedback collected; second-session metrics review; H5 go/no-go review at week 7; final sign-off by week 8 | Yes (bug-fix bias after week 7) |

## Risks & Mitigations

| Risk | Mitigation | Trigger to escalate |
|---|---|---|
| **Visual rubric becomes a vibes argument** | Written rubric with explicit dimensions (spacing, hierarchy, typography, color, alignment, density). Two independent designers. Inter-rater agreement **≥0.7** before scoring counts | κ < 0.7 on calibration set → rubric rewrites until it does, before any KPI gate |
| **Multi-screen generation regresses M1 single-screen reliability** | Single-screen stays as fallback path. Multi-screen gated on archetype routing rather than forced on every prompt | Single-screen success rate drops >5pp from M1 baseline → revert routing to single-screen-only for that archetype |
| **Component-catalog explosion** — every new primitive widens the bad-generation surface | Catalog growth **budget** agreed in week 1; new components require explicit trade-off against the budget | Any proposal beyond budget escalates to PM + Eng Lead |
| **Edit-by-chat regressions on untouched screens** | Automated 50-prompt edit eval running in CI; regressions block merges | Two consecutive edit-eval regressions in a week → freeze edit-pipeline changes until root-caused |
| **Alpha cohort too small or too narrow for second-session metric to be trustworthy** | Recruit ≥50 testers across small business + personal segments; weight metrics by segment; report per-segment | <40 active testers by end of week 6 → delay alpha by 1 week, do not relax the metric |
| **H5 turns out to be false** (users abandon even beautiful generations) | **Most valuable risk to surface.** Week 7 kill-criteria review. M2 declared a *learning* rather than a ship. Sponsor briefed on this possibility at kickoff | Rubric-top quartile second-session return <25% at week 7 → present disconfirmation as the deliverable |

## Explicit Non-Goals

- **No payments or wallet** — deferred to M3.
- **No marketplace publish, browse, or fork** — deferred to M3. **But:**
  instrument "would publish" intent now (we need the share/publish-rate KPI).
- **No App Store or Play Store submission** — alpha distribution only
  (TestFlight + internal Play track).
- **No voice input, no tap-to-edit, no version history.**
- **English only.**
- **No real third-party integrations** — generated apps remain self-contained.

## Exit Criteria

M2 is considered done when **all** of the following hold:

1. Baseline metrics are documented (`docs/product/M2-baseline.md`).
2. Primary objective targets met on the alpha cohort:
   - ≥40% second-session return within 7 days
   - ≥25% share/publish rate
3. All five supporting objectives hit numeric targets on the 150-prompt eval
   set (SO-3) and the 50-prompt edit eval set (SO-4); SO-5 verified on the
   alpha cohort.
4. Visual rubric (with κ ≥ 0.7) and 50-prompt edit eval are in CI.
5. **Sponsor + PM + Eng Lead + Design Lead jointly sign off in a recorded
   review against H5.**

## Ask / Next Steps

| Owner | Action | Due |
|---|---|---|
| **Data / Analytics** | Ship analytics instrumentation: second-session return funnel, share/publish-intent events, per-archetype generation success | End of week 1 |
| **Data / Analytics** | Publish `docs/product/M2-baseline.md` with current 7-day return, share-intent rate, and rubric score on M1 sample | End of week 1 |
| **Design Lead** | Author visual rubric v1.0 (6 dimensions: spacing, hierarchy, typography, color, alignment, density). Calibrate two-designer agreement to κ ≥ 0.7 on a 20-output calibration set | End of week 1 |
| **Robert (PM)** | Lock 8-archetype taxonomy in writing; agree component-catalog growth budget with Eng Lead | End of week 1 |
| **AI Eng + Product** | Author and label 150-prompt eval set, code-reviewed by AI Eng and PM | End of week 3 |
| **Mobile + AI Eng** | Land navigation primitives in A2UI catalog (within budget) | Mid week 3 |
| **AI Eng + Backend** | Land edit-preservation logic + automated 50-prompt edit eval in CI | End of week 4 |
| **Mobile Eng + Product** | Confirm TestFlight + internal Play track ready, ≥50 alpha testers slotted across small-business + personal segments | End of week 5 |
| **Robert (PM)** | Schedule H5 kill-criteria review for week 7 with Sponsor (Alyona) + Eng Lead + Design Lead. Prepare disconfirmation framing in advance so it's a real option, not a face-saving add-on | Week 6 |

## Handoff

> ✅ M2 milestone brief saved to `docs/product/M2-milestone.md`.
> ✅ Hypothesis H5 recorded in `docs/product/hypothesis-tracker.md`.
>
> **Next steps (in order):**
>
> 1. **Data / Analytics** — week-1 instrumentation + baseline. No build before this lands.
> 2. **Design Lead** — visual rubric v1.0 + κ calibration.
> 3. **Robert (PM)** — archetype taxonomy + catalog growth budget.
> 4. Once week-1 deliverables land: spin per-feature specs (multi-screen
>    renderer, navigation primitives, edit-preservation, in-app feedback
>    path, alpha distribution) and route each through `/ux` → `/architect`
>    in the standard pipeline.

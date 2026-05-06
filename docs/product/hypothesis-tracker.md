# Hypothesis Tracker

**Owner:** Robert (CPO)
**Last updated:** 2026-05-05

> Single source of truth for the hypotheses we are betting milestones on.
> One row per hypothesis. Each one has a status, a measurement, and a
> disconfirmation rule — if we can't say what would falsify it, it isn't
> a hypothesis, it's a vibe.

---

## Status legend

- **Active** — being tested in the current milestone
- **Validated** — measurement met the success criterion in the named milestone
- **Disconfirmed** — measurement met the disconfirmation rule
- **Deferred** — accepted as needing later test; not blocking current milestone
- **Retired** — superseded or no longer relevant

---

## Index

| ID | Statement | Status | Milestone | Owner |
|---|---|---|---|---|
| H1 | Idea-makers (personal individuals) will convert at ≥8% to a paid plan once they have a working chat → render loop | Deferred | M1 (referenced) → M3 willingness-to-pay test | Robert |
| H3 | Generation reliability (success rate, latency, crash-free) is a necessary condition for the product to be usable | Validated | M1 | AI Eng |
| H5 | **Quality threshold drives retention.** There is a visual and structural quality bar above which generated apps are kept and used, and below which they are abandoned regardless of functional correctness. H3 is necessary but not sufficient | **Active** | **M2** | Robert |

> H2 and H4 reserved — not yet entered. Add when claimed by a named
> milestone with a disconfirmation rule.

---

## H1 — Willingness to pay (idea-makers)

- **Statement:** Idea-makers (personal individuals) will convert at ≥8% to a
  paid plan once they have a working chat → render loop.
- **Status:** Deferred. Cited in `docs/product/app-creation-poc.md` §Business
  Value as the underlying revenue driver. Not measurable until paid plans
  exist (M3+).
- **Measurement (when active):** % of users who generate ≥1 app and convert
  to a paid plan within 30 days of first generation.
- **Disconfirmed if:** <3% conversion sustained over 8 weeks on a cohort of
  ≥500 users.

---

## H3 — Generation reliability

- **Statement:** A non-technical user can describe an app idea in plain
  language and the system will reliably produce a usable, structurally valid
  rendered app — at acceptable success rate, latency, and crash-free rate.
- **Status:** **Validated** in M1.
- **Measurement:** Eval-set generation success rate ≥80% on 30 prompts,
  p95 latency ≤90s, crash-free ≥99% on TestFlight cohort. Met during M1.
- **Why it's not enough:** Reliability gets the app *to* the user.
  Whether the user comes back is the H5 question, not the H3 one.

---

## H5 — Quality threshold drives retention *(active)*

- **Statement:** There is a visual and structural quality bar above which
  generated apps are kept and used, and below which they are abandoned
  regardless of functional correctness. Generation reliability alone (H3)
  is necessary but not sufficient.
- **Milestone:** M2 (`docs/product/M2-milestone.md`).
- **Status:** **Active** as of 2026-05-05.
- **Owner:** Robert (CPO). Co-signers required at sign-off: Sponsor
  (Alyona Yanuchek) + Eng Lead + Design Lead.

### Measurement

| Signal | Definition | Target |
|---|---|---|
| Second-session return rate | % of generated apps reopened ≥1 time within 7 days of creation, by the creator | ≥40% on alpha cohort |
| Share / publish rate | % of users who, having generated ≥1 app, take a share OR publish-intent action within 7 days | ≥25% on alpha cohort |
| Designer rubric score | 6-dimension rubric (spacing, hierarchy, typography, color, alignment, density), 1–5 ordinal, two independent designers, κ ≥ 0.7 | ≥3.5 / 5 average on eval set |
| Correlation | Spearman ρ between rubric score and second-session return on alpha cohort | \|ρ\| ≥ 0.2 |

### Validation rule

H5 is **validated** if, on the alpha cohort (n ≥ 50, ≥2 weeks):

- Second-session return ≥40%, AND
- Share/publish rate ≥25%, AND
- Spearman ρ between rubric score and per-app second-session return ≥0.2
  (positive direction).

### Disconfirmation rule

H5 is **disconfirmed** if any of:

- Rubric score and second-session return are uncorrelated on the alpha
  cohort (\|ρ\| < 0.2), **OR**
- Second-session return on the rubric-top quartile of generations is <25%
  (i.e., even the best-looking outputs are abandoned), **OR**
- Second-session return on the alpha cohort is <25% overall after a full
  2-week observation window with rubric average ≥3.5.

### Decision points

- **Week 7 kill-criteria review.** If the trend is not directionally on
  track, M2 ships as a learning rather than a polish project. Sponsor
  briefed on this possibility at kickoff so disconfirmation is shippable,
  not embarrassing.
- **Final sign-off review.** Sponsor + PM + Eng Lead + Design Lead jointly
  sign off, recorded.

### What disconfirmation would mean

- Quality is **not** the dominant variable in retention at this stage.
- The next milestone should test a different lever (memory / personalization,
  utility-anchored generation, social loop) rather than spending more on
  visual polish.
- This is the highest-information outcome M2 can produce. Optimize for
  *learning the truth*, not for proving the hypothesis.

# Canvas V0 — Prompt Quality Loop

**Audience:** Sponsor, PM, UX Lead
**Status:** Active — V0 build window
**Related:** ADR-0007 (eval harness), ADR-0010 (grading loop implementation),
`docs/pipeline/prompt-grading-template.md` (weekly session template),
`services/api/eval/baseline.json` (current pass-rate baseline)

---

## Why this loop exists

Canvas V0 ships on a quality bar: AC-G9 requires ≥90% generation success
across a 100-prompt archetype-balanced eval set, with no archetype below
80%. That bar is a launch gate, not a post-launch aspiration. The H5
hypothesis (quality threshold drives second-session return) only reads
cleanly at public scale if output quality was intentionally managed before
launch. This loop is the mechanism that closes the gap between "model emits
a spec" and "model emits a spec a stranger would share." It sits as a thin
layer on top of the eval harness in ADR-0007, adding human grading and a
structured feedback cycle on top of automated pass/fail.

---

## The four parts

**Eval gates.** Every pull request touching the LLM layer, system prompt, or
component catalog runs the 100-prompt eval set in CI. A pass-rate drop below
the baseline in `services/api/eval/baseline.json` blocks merge.

**Weekly grading.** Once a week, Sable and the engineering lead score a
40-prompt sample (10 per archetype, random seed for reproducibility) on a
1–5 Primary scale plus seven qualitative dimensions. The week passes when
every archetype hits Primary average ≥3.5. The session template is at
`docs/pipeline/prompt-grading-template.md`.

**Regression gate.** The `check-eval-regression` script compares fresh eval
results against the current baseline. A drop beyond the threshold blocks the
PR. When a prompt improvement lifts scores, `bump-baseline` updates
`services/api/eval/baseline.json`; baselines only move up.

**Prompt versioning.** System prompt changes are tracked by a semver string
(`PROMPT_VERSION`) embedded in the prompt file and emitted with every
telemetry event. CI blocks a prompt-text change without a version bump. The
version appears in Langfuse traces, connecting grading sessions to the exact
prompt text that produced them.

---

## The cadence

**Weekly grading sessions** run each Monday before the product review. Sable
grades; the engineer logs scores and drafts the iteration proposal in the same
session document.

**Per-PR regression check** runs automatically. A tripped gate is escalated
immediately to the engineering lead, not deferred to the weekly session.

**Ad-hoc prompt bumps** happen when a grading session identifies a specific
weakness. The engineer proposes a targeted change (≤500 chars diff, scoped to
the named catalog block section), runs a spot eval against affected archetypes,
and pairs the change with a `PROMPT_VERSION` increment.

---

## Who owns what

**Sable (UX Lead):** Primary grader and quality veto. Sable's score is the
authoritative read on "design-Sable-could-ship." She identifies patterns
across the sample and proposes which dimension to target next. She holds
launch veto: if any archetype Primary average is below 3.5 at end of week 5,
she flags it to Sponsor before submission.

**PM (Robert):** Cadence owner. Books weekly sessions. Owns sample selection
policy. Drafts the pre-launch diagnostic summary for Sponsor review.

**Engineering:** Implements prompt edits. Runs `bump-baseline` and
`check-eval-regression`. Maintains `PROMPT_VERSION` discipline. Generates
the 40-prompt sample for each session via the `sample-grading-set` script.

**Sponsor (Alyona):** Month-end trend review. Receives the weekly grading
rollup as part of milestone status. Co-signs the week-7 quality review before
App Store submission. Both AC-G9 (≥90% / ≥80%) and weekly grading Primary
average ≥3.5 per archetype must hold for V0 launch sign-off.

---

## What "good" looks like

A grading session that produces a v0.X.Y prompt iteration that ships: Sable
grades 40 prompts, finds a shared weakness across two archetypes, the engineer
writes a targeted catalog block change, the spot eval confirms the affected
archetypes lift without dragging others, the version bumps, CI passes, and
the change merges. The following session starts with a cleaner baseline.
Over six weeks this compounds into launch-quality output.

The signal the loop is failing: Sable's notes are general without a targetable
dimension, the Primary average moves less than 0.2 from the prior session, and
the iteration proposal is vague. That pattern indicates a structural ceiling
targeted iteration won't lift; the fallback is the M2 planner stage (see
§Risks in `docs/product/canvas-v0.md`).

---

## V0.5 extensions (deferred)

The following are explicitly out of scope for V0.

**LLM-as-judge.** Automated scoring via a second model call. Requires
calibration against Sable's human scores before the automated scores are
trustworthy — a week of work not available in the V0 build window.

**In-product feedback button.** Thumbs-up / thumbs-down after the 30-second
interaction window. Deferred because V0 launch volume may be too small to
read the signal cleanly before the week-7 decision.

**A/B prompt routing.** Two prompt versions served to a split cohort with
second-session return as the outcome variable. Requires n ≥ 500 per variant.
Deferred to V0.5 once the install base is established.

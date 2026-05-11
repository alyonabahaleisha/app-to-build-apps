# ADR-0010: V0 Prompt Engineering + Eval-Grading Loop

_Authored by Cal — 2026-05-10_

## Status

Proposed

## Context

The V0 generation pipeline shipped (ADR-0007, PRs 1–4; cleared for the
M1 cutover kill review at `f970acc`). The eval harness shipped alongside
it: 160 prompts (100 archetype-balanced × 25 + 30 detection × 6 + 30
false-positive), three modes (`v0`, `out-of-scope-detection`,
`out-of-scope-false-positive`), CI workflow at
`.github/workflows/eval.yml`, threshold gates at §AC-G9 / §AC-O4 / §AC-O5.

The eval harness answers a single question: **did the LLM produce a spec
that parses, cross-ref-validates, and matches the labeled archetype** (or,
for the OOS modes, did it call the right tool with the right capability).
That's a structural floor. It does not answer the question that's now the
binding constraint on V0 ship-readiness: **is the output good enough that
a stranger downloads Canvas, generates a tool, and shares it?** (§Success
Metrics: share rate ≥25%, second-session return ≥40%, magic-moment
≥70%.)

The first live-demo iteration of Canvas V0 — the iOS Simulator session
that just happened on `agent/M2-VS-01` — generated a tip calculator that
the team described as "looking bad." Not a structural defect. The spec
parsed, cross-ref-validated, matched the Calculator archetype. The model
picked weak components and weak copy. The Bill Amount used `NumberField`
with no formatting hint, the result block was an unlabeled `Stat`, the
"Split" action was a single full-width button at the bottom of a flat
`Stack`. Visually: shipped-by-an-engineer-not-a-designer.

There is no closed loop between eval results and prompt iteration today.
The prompt is a 21KB TypeScript file (`system.ts`); changes are ad-hoc;
there is no baseline; there is no "did this PR make outputs better or
worse"; there is no Sable-in-the-loop channel. The harness produces JSON
results files in `services/api/eval/results/` that nobody is structured to
read.

The cost of doing nothing is shipping V0 at a quality that fails §H5 not
because the loop is wrong but because the LLM picked Stack-over-Section
for every other generation. That's the kind of failure we discover
post-launch when share-rate is 8%.

### Forces

1. **Quality is the binding constraint, not structure.** V0 schema +
   renderer + pipeline are solid. The catalog is closed. The LLM has
   nowhere to invent. The only knob left is the system prompt.
2. **Sable is the design authority.** Component appropriateness, layout
   nesting, copy quality, stance/palette fit — these are her calls, not
   the architect's, not Robert's. The loop must put her notes on the
   critical path of prompt edits.
3. **The eval harness is half the loop.** It quantifies. It does not
   qualify. Without human grading on visual output the harness will
   happily certify a 95% pass rate of structurally-correct ugly tools.
4. **Cached-block token budget is finite.** `SYSTEM_PROMPT_CATALOG` is
   capped at 25,000 chars (~6,250 tokens) by T-0007-027. Today's content
   is ~20,200 chars. Headroom for iteration is ~4,800 chars (~1,200
   tokens). Every "let's add a few-shot example" eats budget; we cannot
   add freely.
5. **The loop runs against the live Anthropic API.** That's the
   compensating control documented in ADR-0007 §Deviations D-0007-01.
   Eval runs cost money. Sequential prompts. ~3 minutes for the full
   archetype set. The loop cannot run on every keystroke; it can run
   on every PR touching `services/api/src/llm/prompts/`.
6. **V0 ship date is week 6.** The loop has to be operational in time to
   produce ≥3 graded prompt iterations before App Store submission.
   Anything that requires V0.5-style infra (web rendering, A/B testing
   platform, prompt-tuning UI) is out of scope.

### What "Loop" means here

A loop is **inputs → process → outputs → cadence → enforcement**. The ADR
specifies all five. The artifacts are the prompt source file
(`services/api/src/llm/prompts/system.ts`), the eval baseline
(`services/api/eval/baseline.json` — NEW), the grading docs
(`docs/pipeline/prompt-grading-{YYYY-MM-DD}.md` — NEW), the regression
gate (`scripts/check-eval-regression.ts` — NEW), and a sponsor-facing
description (`docs/product/canvas-v0-prompt-quality-loop.md` — NEW).

## Decision

Ship a five-piece eval-grading loop that converts structural eval output
into qualified prompt iterations on a weekly cadence, gated by a per-PR
regression check.

1. **Prompt v0.1.0 — first iteration based on observed live-demo gaps.**
   Bake the tip-calculator-quality lesson into `SYSTEM_PROMPT_CATALOG`
   within the V0 catalog (NumberField + Stat + Section nesting + copy
   rules — no MoneyField/Slider/TimeField; those are V1 per ADR-0009 and
   not available to V0). The change is additive (~2,400 chars budget
   spend; new total ~22,600 chars; ~2,400 chars headroom remaining).

2. **Grading rubric — 5-point primary + 7 tagged dimensions, scored on a
   weekly 40-prompt sample (10 per archetype, randomly drawn from
   `ARCHETYPE_PROMPTS`).** Full 160-prompt grading is monthly. The
   rubric template is `docs/pipeline/prompt-grading-template.md`. The
   primary score is the one number that moves the baseline; the seven
   dimension tags are qualitative feedback the next prompt iteration
   reads.

3. **Screenshot capture — manual via dev-only deep-link to a fixture
   spec, with automated batch capture as a Step 6 stretch goal owned by
   ADR-0011.** ADR-0011 must expose an `appcreator://devmenu/load-spec?fixture=<name>`
   dev-only deep link that mounts the named fixture spec via the dev-menu's
   `LoadSpecFromDevMenu` handler (per ADR-0011 Step 13), which mounts the
   fixture in Run mode without DB persistence. Until that lands, grader
   uses the existing dev-only demo picker (`DEMO_SPECS`) and a
   regenerate-from-prompt-id helper. This is the **honest** version of
   the screenshot question — automation doesn't gate the loop opening.

4. **Per-PR regression gate.** `services/api/eval/baseline.json` records
   the current best overall + per-archetype pass rates. A CI script
   (`scripts/check-eval-regression.ts`) runs after the existing
   `eval-v0` job and compares the freshly-written results JSON against
   baseline. A drop > **2 percentage points** on overall pass rate, or
   > **3 percentage points** on any single archetype, blocks merge.
   Override requires `INTENTIONAL_EVAL_REGRESSION:` in the PR body with
   a one-line rationale. Baseline is bumped by an explicit script
   (`pnpm --filter @app-creator/api eval:bump-baseline`) gated to PRs
   that have human grading approval recorded in the PR body.

5. **PROMPT_VERSION versioning.** Const string export from
   `services/api/src/llm/prompts/system.ts` (`PROMPT_VERSION = 'v0.1.0'`).
   Bumped manually on each prompt iteration. Added to the
   `generate.completed` telemetry payload whitelist. Added as a new
   `prompt_version` column on `mini_app_version` (nullable; default
   read at write-time from the imported const). Out-of-scope intent
   does NOT get the column (capability inference isn't prompt-driven in
   the way generation is, and the cardinality / value of grouping OOS
   detection by prompt version is marginal). The const is the source of
   truth; manual bump on every PR touching `system.ts`. CI enforces
   that a `system.ts` diff is accompanied by a `PROMPT_VERSION` bump
   (a non-bumping diff fails CI).

### Why this shape and not larger

- **A pure-automation loop** (screenshot diff, vision-model-as-judge,
  visual-similarity baseline) is V0.5. It would take 2+ weeks of
  infrastructure to stand up reliably. We have 4 build weeks left
  pre-submission. Manual grading on a 40-prompt sample is honest at this
  stage and unblocks the next 3+ iterations.
- **A continuous-tuning loop** (every PR opens a grading session) is
  noise. The 40-prompt sample takes ~90 minutes of human time when the
  output is novel — that's the natural unit. Weekly fits.
- **A grading queue tool** (Linear / Notion / GH issues per prompt) is
  premature. Markdown grading docs in the repo are diffable, searchable,
  and don't require a new SaaS dependency. If grading docs become >50
  per quarter, V0.5 reconsiders tooling.

### Why a regression gate threshold of 2pp/3pp

Eval pass-rate variance on a 100-prompt set with the live Anthropic API
is real. Empirically the same prompt with the same system message can
flip on/off a structural check across runs (Anthropic temperature is
implicit; the harness doesn't pin it). A 2pp gate on overall (= 2
prompts) is just inside that noise floor; tighter would block legitimate
merges. A 3pp per-archetype gate (= < 1 prompt out of 25) is necessary
because per-archetype variance is higher and a single
archetype-regression matters: it signals the prompt change disadvantaged
that archetype's recipe. The values are revisited at first baseline
bump.

**Empirical justification — N=1 noise floor.** The regression check is
**N=1** (single run per PR), inherited from ADR-0007 Step 7's eval
harness shape. The harness does not pin Anthropic temperature; tool-use
calls run at the SDK default (≈ implicit). The `eval-v0` workflow at
`.github/workflows/eval.yml` exists but has produced zero archived CI
runs as of this ADR's commit (`services/api/eval/results/` is empty in
tree). We therefore ship at 2pp / 3pp **without empirical variance
data**, on the basis of Anthropic's documented temperature behavior for
tool-use endpoints (typical rate is 1–3 prompts per 100 flipping
on/off across reruns with no temperature pin, putting routine variance
roughly in the 1pp–3pp band on a 100-prompt set). 2pp is at the upper
edge of expected single-run variance; 3pp per-archetype is one prompt
on a 25-prompt archetype slice.

**Post-empirical revisit.** The Risks table mitigation is the
empirical update path: after 4–8 weeks of CI runs we will have
re-run-pair variance data. If 3 successive legitimate PRs are blocked
(noise wider than 2pp), the threshold widens to 3pp; if 0 PRs are
blocked in 3 months (noise tighter than 1pp), the threshold tightens
to 1pp. The values in this ADR are explicitly the v0.1.0 launch
defaults, not a long-term commitment.

**N=1 is current architecture, not a recommendation.** A higher-N
average (e.g., N=3 with median) would buy variance suppression at 3×
the API cost and ~9 minutes per PR. We rejected that for V0
(pre-launch budget pressure on Anthropic credits; per-PR latency
matters for merge throughput). If the empirical noise floor turns out
to be ≥ 2pp routinely, the right next step is N=3-with-median, not
threshold-widening — but we make that decision against data, not
forecasts. Logged in §Alternatives Considered.

## Alternatives Considered

### Alternative A — Automated screenshot diff with vision-model-as-judge (rejected)

Run the eval, capture iOS Simulator screenshots via `xcrun simctl`, send
each screenshot pair (current vs. baseline) to Claude with a rubric and
ask for a 1–5 grade. No human in the loop.

- **Upside:** Scales. 160 prompts × every PR is cheap. No weekly meeting.
- **Downside:** The judge is the system under test wearing a different
  hat. Sable is the design authority; replacing her with a vision model
  is the wrong decision at V0 stage. (And we'd be paying Anthropic to
  grade Anthropic.) The 90-minute weekly cost of human grading is
  positive sponsor signal — Sable on the call means a real eye on
  outputs, which catches things a rubric can't articulate (e.g.,
  "this just looks beige").
- **Why not:** V0.5 reconsideration if grading throughput becomes a
  blocker. For V0, human-in-the-loop is the right answer.

### Alternative B — Web render of specs in a headless browser (rejected)

Port the V0 renderer to React DOM, render specs in Playwright, screenshot,
serve to grader.

- **Upside:** Fast. Stateless. Could even run inline in CI.
- **Downside:** `canvas-v0.md` explicitly out-of-scope for web (App
  Review positioning). Building a web renderer just for grading
  introduces a second renderer to maintain, with drift potential against
  the iOS native renderer — the very drift that would make grading
  outputs lie. Solving the wrong problem.
- **Why not:** Native renderer is the source of truth. Don't introduce a
  second.

### Alternative C — Skip the human grading layer; rely on eval pass-rate alone (rejected — current state)

The status quo. Run the eval harness, ship if the gates pass.

- **Upside:** Zero net new infra. Loop already partially exists.
- **Downside:** The tip calculator structurally passed today's gates
  while failing visually. Shipping V0 with a 95% eval pass rate and a
  beige Calculator is a launch failure on H5.
- **Why not:** This is exactly the gap ADR-0010 closes.

### Alternative D — Continuous prompt iteration via an in-product feedback button (deferred)

Add a "this looks wrong" button in the host chrome that captures the
spec + a thumbs-down + an optional comment, feeding a backend table the
prompt grader reviews.

- **Upside:** Real-user signal, not synthetic.
- **Downside:** Requires shipping the UI; depends on real usage volume
  to be meaningful; per AC-N8 we cannot log user prompts at app shell
  level without intentional consent. Best as a V0.5 enhancement after
  the launch cohort exists.
- **Why not (V0):** Deferred. Listed in `docs/product/canvas-v0-prompt-quality-loop.md` §V0.5 Extensions.

### Alternative F — N=3 median-aggregated eval runs for variance suppression (rejected for V0; revisit post-empirical-data)

Run the eval harness three times per PR and take the median pass rate
per prompt as the input to `check-eval-regression`. Suppresses
single-run flips at the cost of 3× API spend + ~9 minutes per PR.

- **Upside:** Eliminates the "2 prompts flipped on temperature" failure
  mode entirely. Tightens the legitimate-noise band to <1pp, which
  would let us run a 1pp gate (better signal-to-noise on real
  regressions).
- **Downside:** 3× Anthropic credit spend on every eval-touching PR.
  ~9 minutes added per PR (sequential — the harness doesn't
  parallelize today). Pre-launch budget pressure on credits is real
  (per ADR-0007 §Forces). Adds infrastructure surface (median
  aggregation, results-set merging) we don't need to ship V0.
- **Why not (V0):** N=1 + 2pp/3pp thresholds are the honest answer
  pre-empirical-data. The N=3 lever is the right pull **if** empirical
  variance turns out to routinely exceed 2pp after 4–8 weeks of CI
  runs. The decision rule: if 3+ legitimate PRs are blocked by the
  gate (post-launch), pull the N=3 lever before widening the
  threshold; threshold-widening alone reduces signal, N=3 preserves
  signal at higher cost.

### Alternative E — Multi-model A/B testing as the iteration engine (rejected for V0)

Build a prompt-A-vs-prompt-B routing layer; route % of traffic to each;
use real H5 metrics as the grader.

- **Upside:** The ground truth. The actual metric we care about.
- **Downside:** Requires (a) infrastructure for prompt routing, (b)
  enough traffic to compute statistical significance, (c) a willingness
  to ship a worse experience to some users for measurement. (a) and (b)
  are 2026-Q3 problems; (c) is a brand risk pre-launch.
- **Why not:** This is the V0.5+ version of the same problem. ADR-0010
  ships the version that works pre-launch on synthetic prompts; the
  V0.5 layer plugs in once real telemetry is flowing.

## Consequences

### Positive

- **Closed loop on prompt quality.** Sable's design intent becomes a
  weekly artifact in `docs/pipeline/prompt-grading-{date}.md`. Prompt
  iterations get a name (`PROMPT_VERSION`), a delta (eval pass-rate
  change), and a justification (graded outputs). No more ad-hoc edits.
- **Sponsor-readable.** `docs/product/canvas-v0-prompt-quality-loop.md`
  is short enough for Alyona to read at week-7 kill review and
  understand the iteration pace + last delta.
- **Regression-safe.** Per-PR gate catches "I tweaked the prompt and
  the Tracker pass rate dropped 8 points and we shipped it." Override
  is explicit, requires rationale, leaves a trail.
- **Telemetry trends.** `prompt_version` on `mini_app_version` means
  post-launch we can join `mini_apps.created_at` × `prompt_version` ×
  H5 metrics to see whether v0.2.0 ships better tools than v0.1.0.
- **Token-budget discipline.** v0.1.0 spends ~2,400 of the ~4,800
  available chars in the cached block. Future iterations have a fixed
  envelope and trade-offs (adding archetype X recipe may require cutting
  archetype Y verbosity). This pressure is healthy — it forces the
  prompt to stay legible.

### Negative

- **Weekly time cost.** ~90 minutes of Sable + 1 engineer for the
  grading session. Plus ~1 hour of eng to draft the prompt diff. ~3
  hours/week of meeting time, ongoing.
- **The regression gate adds 3 minutes to CI on relevant PRs.** Already
  3 minutes for `eval-v0`; baseline check is fast (compare two JSONs).
  Acceptable, but it does mean the eval workflow becomes a real merge
  blocker on `system.ts` changes.
- **`PROMPT_VERSION` discipline depends on humans.** A PR that edits
  `system.ts` without bumping the const will fail CI (Step 5 enforces).
  That's a small friction but it's a friction.
- **Manual screenshot capture is tedious.** 40 prompts × 60 seconds of
  open-deep-link-screenshot-paste = 40 minutes of grader time before
  grading actually starts. Step 6 mitigates with the
  `xcrun simctl` batch script — but Step 6 is stretch.
- **Sable's veto becomes load-bearing.** §AC-AR4 already calls out her
  polish-acceptance veto. ADR-0010 widens her surface to "veto a
  prompt iteration even if eval passes." This is correct but needs
  Sponsor sign-off that the design lead has effective merge
  authority on `system.ts`.

### Risks

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| Weekly grading session drops out of cadence (calendar slips, Sable unavailable) | Medium | The cadence is calibrated to be skippable — skipping one week is fine. The regression gate keeps merge quality stable in the gap. Re-anchor at month boundary if 2+ consecutive weeks slip. |
| Eval pass-rate noise floor is wider than 2pp; legitimate PRs blocked | Medium | **N=1 + no temperature pin + zero archived CI history at ADR commit.** 2pp/3pp ship as launch defaults based on Anthropic-documented temperature behavior on small-N tool-use (1–3 flips per 100 prompts is the typical band). Revisit at first baseline bump (~week 6) and at 4–8 weeks of CI history. Decision rule: if 3 successive legitimate PRs are blocked, **pull the N=3-median lever (Alternative F) before widening the threshold** — threshold widening reduces regression signal, N=3 preserves it at API-cost. If 0 PRs are blocked in 3 months, threshold tightens to 1pp. |
| Baseline-deletion bypass vector — a PR that deletes `services/api/eval/baseline.json` triggers the missing-baseline silent-skip path (T-0010-062) and merges without a regression check | Low | **Accepted as documented limitation.** The compensating control is code review (any PR touching `baseline.json` shows up as a deletion in the diff). Adding a git-history guard (e.g., `check-eval-regression` runs `git log --diff-filter=D -- eval/baseline.json` and fails open on any historic deletion) adds maintenance complexity for a low-probability attack vector (an intentional bypass would also have to pass review of the deletion). Documented in §Step 3 acceptance criteria and §Risks rather than coded. |
| `PROMPT_VERSION` bump requirement is a chore people forget | Low | CI enforcement (Step 5) catches it. The error message is helpful: "system.ts changed; bump PROMPT_VERSION." |
| Cached-block token budget exhausted before V0 launch | Medium | v0.1.0 leaves ~2,400 chars of headroom; v0.2.0 expected to spend another ~1,000–1,500. Hard ceiling is T-0007-027 (25,000 chars). If we hit the wall, the trade-off is documented — cut a less-impactful section to make room. Don't raise the ceiling unilaterally; that's an ADR-0010 follow-up decision. |
| Grading rubric is subjective; two graders score the same output differently | Low-Medium | The 5-point primary score is the only one that moves the baseline. Dimension tags are qualitative — divergence between graders on dimension tags is fine (more signal). Sable is the tiebreaker on primary scores. |
| Screenshot capture path breaks (dev-menu `LoadSpecFromDevMenu` changes) | Low | Manual fallback always works (open prompt in Create, hit submit, screenshot). Step 6 deep-link is the ergonomics layer, not the loop's critical path. |
| Confusion between "passes eval" and "passes grading" | Medium | `docs/product/canvas-v0-prompt-quality-loop.md` documents both bars. AC-G9 (eval pass-rate) is necessary; weekly grading rubric ≥3.5 average is necessary. Both are required for V0 launch. PM signs off both. |

## Implementation Plan

Seven steps; orderable. Step 1 ships the prompt iteration (which is the
immediate fix the live demo demands); Steps 2–6 stand up the loop
mechanics; Step 7 documents the loop for the team and Sponsor. Steps 1–5
gate V0 launch. Step 6 is stretch (automation). Step 7 is the
sponsor-facing description.

### Step 1: Prompt iteration v0.1.0 — bake in live-demo lessons

**Files to create/modify:**

- `services/api/src/llm/prompts/system.ts` — additive changes to
  `SYSTEM_PROMPT_CATALOG`; add `PROMPT_VERSION = 'v0.1.0'` const export.
- `services/api/src/llm/prompts/system.test.ts` — extend tests for new
  content + version const.

**Content changes (additive, within the existing
`SYSTEM_PROMPT_CATALOG`):**

1. **New subsection — `## Archetype Recipes` — after `## Stance + Palette
   Rules`, before `## Out-of-Scope Capabilities`.** Four recipes, one
   per archetype, ~600 chars each. Calculator recipe is the most
   detailed (it's the one the live demo exposed). Each recipe specifies:
   - Required components and their roles.
   - Layout shape (use Section, don't use bare Stack).
   - Copy quality rules (Headings are titles, not nouns; Captions are
     metadata, not values).
   - Seed-data shape rules (realistic, domain-specific).

2. **Inline addendum to the `### Stat` component description** in
   `## Component Catalog`: explicit guidance that derived-from-inputs
   values (totals, averages, per-person splits) belong in `Stat`, not
   `Body`; and that the `Stat.delta` field is for change-over-time, not
   for showing a second number.

3. **Inline addendum to the `## Action Verbs` `### set` entry**:
   guidance that for Calculator archetypes where the result depends on
   multiple input slots, the recommended pattern is **one `set` per
   Button**, computing the result inline rather than chaining sets
   across slot updates. (The live-demo tip calc had this wrong: a
   Calculate button with `{type: "set", target: "result", value: 0}` —
   literal zero, not a computed expression. The schema doesn't support
   computed expressions; the recipe text instead steers the model to
   seed sensible default values and use Stat to display a derived
   formula — see Calculator recipe below.)

4. **New const export — `PROMPT_VERSION`** at top of file, value
   `'v0.1.0'`. Step 5 makes this a CI-checked discipline.

**Code shape:**

```ts
export const PROMPT_VERSION = 'v0.1.0' as const

// ... existing SYSTEM_PROMPT_STATIC ...

export const SYSTEM_PROMPT_CATALOG = `\
## Archetype Guidance
... (existing) ...

## Component Catalog (28 components)
... (existing, with addendum to Stat) ...

## Action Verbs (12)
... (existing, with addendum to set) ...

## Stance + Palette Rules
... (existing) ...

## Archetype Recipes

When generating, follow the recipe for the chosen archetype.

### ListCRUD recipe
- Root: Screen → Heading (level 1) → Section (containing the list) → List → FAB.
- Always include EmptyState inside List with a domain-specific headline + body.
- The List's row leading slot uses icon for category-rich domains (recipes,
  bookmarks) and avatar for people-centric domains (contacts).
- Include a "detail" screen even when not strictly required — a tapAction
  navigating to it gives the user somewhere to drill into.
- Copy: Heading is the noun the user typed (e.g., "Recipes"), not "My Recipes
  List" or "Recipes App". EmptyState body is one short sentence + a verb the
  user is about to do.

### Tracker recipe
- Two screens via tabs nav: "Today" (collection + add) and "History"
  (collection + ConditionalSection summary when non-empty).
- Today screen: Heading → Section → List (current entries) → FAB.
- History screen: Heading → Section (Stat showing total count) →
  ConditionalSection whenNotEmpty → List.
- Include a streak or count field on the collection where the domain
  implies it (habits → streak, water → cups today, workouts → minutes).
- Copy: domain-flavored. "Today's habits" not "Habit entries today".

### Journal recipe
- Two screens via stack nav: "Entries" (list) and "Compose" (form).
- Entries screen: Heading → List with itemLayout="expanded" (longer rows
  for journal previews) → FAB navigate to Compose.
- Compose screen: Heading → Section → TextField (multiline=true) for body
  → Button (variant primary, fullWidth, action addItem + back).
- Include a DateField on each entry; seed with realistic past dates spanning
  ~2 weeks.
- Copy: expressive register. Section captions and EmptyState bodies use
  warmer language ("Start your first entry" not "No entries yet").

### Calculator recipe
- Single screen, navigation="none".
- Layout: Screen → Heading → Section ("Result") containing Stat(s) at top →
  Section ("Inputs") containing NumberField(s) → Button (Calculate or Reset).
- Use Stat (not Body) for derived values. Heading=label, value=current
  result. Multiple Stats stack vertically when more than one derived value
  matters.
- Use NumberField with min/max/step where the input domain has natural
  bounds (tip percent: min 0, max 100, step 5; party size: min 1, max 20).
- Pre-fill initialState with sensible defaults so the result is non-zero
  on first render (e.g., bill=50, tipPercent=18, people=2).
- Copy: result labels are units, not nouns ("per person" not "Per Person
  Amount"; "$" or "%" hint goes in the value string).
- Important: V0 has no MoneyField; format currency yourself in seed Stat
  values ("$24.50" as a literal string). The user will see this string
  until they recompute; that's the trade-off of a single-call,
  no-runtime-arithmetic spec.

## Out-of-Scope Capabilities
... (existing) ...

## Examples
... (existing 4 examples) ...
`
```

**Acceptance criteria:**

- `PROMPT_VERSION` exported as `const PROMPT_VERSION = 'v0.1.0' as const`.
- `SYSTEM_PROMPT_CATALOG` contains a `## Archetype Recipes` section.
- Section contains all 4 archetype recipes (parametrized assertion).
- Calculator recipe contains the phrase "V0 has no MoneyField" or
  equivalent explicit V1-component disclaimer (the most-likely
  hallucination — the model has seen MoneyField in `ADR-0009`-adjacent
  training contexts).
- Calculator recipe specifies `Section` (the layout primitive) and
  `Stat` (the display primitive).
- Tracker recipe specifies tabs navigation.
- Journal recipe specifies expressive stance language guidance.
- ListCRUD recipe specifies EmptyState inclusion.
- The Stat component description addendum mentions "derived" or "computed"
  values.
- The set verb description addendum mentions the no-expression-language
  trade-off.
- `SYSTEM_PROMPT_CATALOG.length <= 25,000` chars (T-0007-027 invariant).
- `SYSTEM_PROMPT_CATALOG.length >= 22,000` chars (sanity: the addition
  actually landed; prevents accidental no-op merges).
- `SYSTEM_PROMPT_STATIC.length <= 2,000` chars (T-0007-028 invariant).
- `SYSTEM_PROMPT_STATIC` unchanged (regression: don't touch the
  non-cached block in this step).
- `PROMPT_VERSION` matches `/^v\d+\.\d+\.\d+$/` (semver-shape).

**Estimated complexity:** Medium. The recipe text needs care — it's
the deliverable. Mechanical changes (const export, test updates) are
trivial.

### Step 2: Grading rubric template + weekly grading doc template

**Files to create:**

- `docs/pipeline/prompt-grading-template.md` — the template grader
  copies per session.

**Files to modify:** none.

**Template structure:**

```markdown
# Prompt Grading — {YYYY-MM-DD}

_Graders:_ Sable (UX), {engineer name}
_Prompt version under test:_ vX.Y.Z
_Eval baseline pass rate:_ {overall_pct} overall / {per-archetype-row}
_Sample size:_ 40 prompts (10 per archetype, random seed: {seed})
_Eval results file:_ `services/api/eval/results/{filename}`

## Sample selection

| Prompt ID | Archetype | Prompt text (first 80 chars) |
| --- | --- | --- |
| ... 40 rows ... | | |

## Per-prompt grades

| Prompt ID | Primary (1–5) | Appropriateness | Layout | Stance/Palette | Verb usage | Copy | Empty state | Scope precision | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

(Each cell except Primary and Notes is 1–5 OR `N/A` with one-word reason.)

## Per-archetype rollup

| Archetype | n | Primary avg | Pass-bar met (≥3.5)? | Top weak dimension |
| --- | --- | --- | --- | --- |

## Sable's notes — themes across the sample

(Free-form bullets. The next prompt iteration reads this. Format: 1
bullet per actionable observation. Anti-pattern: 1 bullet per individual
prompt.)

## Prompt iteration proposal (drafted by engineer post-session)

- **Hypothesis:** {one sentence}
- **Proposed change to `SYSTEM_PROMPT_CATALOG`:** {section + before/after
  diff, ≤500 chars}
- **Expected impact:** {which archetypes, which dimensions}
- **Token budget delta:** {chars added / chars removed; remaining headroom}
- **Next bump:** {v0.2.0 etc.}
```

**Acceptance criteria:**

- File exists at the specified path.
- File starts with a 6-line frontmatter section (graders, version,
  baseline, sample size, results-file, date).
- File contains the per-prompt grades table with exactly these column
  headers: `Prompt ID`, `Primary (1–5)`, `Appropriateness`, `Layout`,
  `Stance/Palette`, `Verb usage`, `Copy`, `Empty state`, `Scope precision`, `Notes`.
- File contains the per-archetype rollup table.
- File contains the prompt-iteration-proposal section with all 5
  required fields (Hypothesis, Proposed change, Expected impact, Token
  budget delta, Next bump).
- File is referenced from `docs/product/canvas-v0-prompt-quality-loop.md` (Step 7).
- **Per-archetype rollup table contains exactly the 4 V0 archetypes**
  (`ListCRUD`, `Tracker`, `Journal`, `Calculator`) — NOT the 8 M2
  archetypes from earlier work. This is the highest-likelihood
  copy-paste regression and is testable as a parametrized assertion.
- **Rubric anchor wording is pinned verbatim** for scores 1, 2, and 5
  (the calibration extremes + the most-frequently-cited middle):
  score 1 reads `Broken / wrong archetype / would not ship`; score 2
  reads `Structurally correct but visually weak across most dimensions`;
  score 5 reads `Design-Sable-could-ship — the LLM wrote what she
  would have`. Anchor drift on score 1 is the most consequential —
  two graders with different score-1 mental models diverge on the
  entire scale.
- Template body contains placeholder rows only (no actual graded data
  baked into the template); per-prompt grade cells contain literal
  placeholders like `<prompt_id>` and `<1-5>` rather than real
  prompt IDs or scores.

**Rubric semantics (codified in the template's header preamble):**

| Primary | Meaning |
| --- | --- |
| 1 | Broken / wrong archetype / would not ship |
| 2 | Structurally correct but visually weak across most dimensions |
| 3 | Acceptable; one or two notable weaknesses |
| 4 | Good; could ship with minor copy tweaks |
| 5 | Design-Sable-could-ship — the LLM wrote what she would have |

Dimension scores are 1–5 with the same scale but scoped to the named
dimension.

**Pass-bar:** an archetype passes the weekly bar when its sample's
Primary average is ≥3.5. The week passes when all 4 archetypes pass.
The week's "pass" is the qualitative gate analogous to eval-mode's
quantitative gate. Both required for V0 launch (AC-G9 + this).

**Estimated complexity:** Low. It's a markdown template. The hard part
is the rubric semantics being clear — done above.

### Step 3: Eval baseline + per-PR regression gate

**Files to create:**

- `services/api/eval/baseline.json` — committed initial baseline.
- `services/api/scripts/check-eval-regression.ts` — the regression check.
- `services/api/scripts/bump-baseline.ts` — explicit baseline-bump CLI.
- `services/api/scripts/check-eval-regression.test.ts`,
  `services/api/scripts/bump-baseline.test.ts` — tests.

**Files to modify:**

- `services/api/package.json` — add scripts `eval:check-regression` and
  `eval:bump-baseline`.
- `.github/workflows/eval.yml` — add a `check-regression` step after the
  `eval-v0` step.

**`baseline.json` shape:**

```json
{
  "prompt_version": "v0.1.0",
  "captured_at": "2026-05-12T00:00:00Z",
  "captured_by": "ADR-0010 Step 3",
  "overall_pass_rate": 0.92,
  "per_archetype_pass_rate": {
    "ListCRUD": 0.96,
    "Tracker": 0.88,
    "Journal": 0.92,
    "Calculator": 0.92
  },
  "thresholds": {
    "overall_drop_max_pp": 2,
    "per_archetype_drop_max_pp": 3
  }
}
```

The first commit's values are placeholder — populated by the first
real CI run on Step 1's prompt + a `bump-baseline` call. CI's
regression check tolerates a missing-baseline state for the very first
run (logs "no baseline; skipping regression gate" instead of failing).

**`check-eval-regression.ts` behavior:**

1. Read the most recent `results/{ISO}-v0.json` file.
2. Read `baseline.json`.
3. Compute deltas: `overall_delta_pp = (results.overall_pass_rate -
   baseline.overall_pass_rate) * 100`, same per archetype.
4. If `overall_delta_pp < -baseline.thresholds.overall_drop_max_pp`: FAIL
   with `regression: overall dropped X.Xpp (limit: 2pp)`.
5. If any archetype delta < `-baseline.thresholds.per_archetype_drop_max_pp`: FAIL.
6. If FAIL: check `GITHUB_PR_BODY` env (or argv `--pr-body-file=`) for
   `INTENTIONAL_EVAL_REGRESSION:` line; if present, log the rationale
   line and exit 0.

   **Override grammar — exact-string, case-sensitive parser:**
   - The key MUST be the literal byte sequence `INTENTIONAL_EVAL_REGRESSION:`
     (uppercase, no typos, colon required). The parser is **case-sensitive
     by spec** and uses exact-string match (no fuzzy or substring tolerance).
     Lowercase, mixed-case, or misspelled variants do NOT trigger the
     override. This is the audit-trail guarantee: a PR body that
     organically writes the phrase in prose (e.g., "I have an
     intentional_eval_regression due to...") will NOT silently suppress
     the gate. Reviewers can grep PR bodies for the exact uppercase
     token to find every override.
   - **Rationale extraction:** the substring from after the colon to
     the end of the line, then `.trim()`. The override is accepted iff
     the trimmed rationale is non-empty. Leading and trailing whitespace
     on the rationale is tolerated; an entirely whitespace rationale
     is rejected (no-rationale override is blocked).
   - **Multiple override lines:** if the PR body contains two or more
     `INTENTIONAL_EVAL_REGRESSION:` lines, **any-match wins**
     (the gate accepts the override if at least one well-formed line
     is present). Rationale: the override semantic is "human attests
     this regression is intentional"; the PR body is the durable
     audit record for the human reviewer, so multiple attestations
     are at worst redundant, never contradictory. The parser logs
     all matched rationale lines (not just the first) so the trail
     is preserved.
7. If `baseline.json` doesn't exist or `prompt_version` mismatches the
   current `PROMPT_VERSION` const: log "baseline missing or out of
   date; skipping regression gate" and exit 0.

   **Narrow case — first-run / missing baseline.** The missing-baseline
   exit-0 path is intentional only for the narrow case: **first eval
   run of the repo, before any baseline has been committed**. It is
   NOT a graceful-degradation path for a deleted baseline (see Risks
   table — baseline deletion is accepted as a documented bypass vector,
   defended by code review).

   **Distinct from missing — empty / zero-byte baseline.** An empty
   or zero-byte `baseline.json` (file exists, content is `""` or whitespace)
   is treated as **malformed**, not as missing. The check exits 1
   (loud failure) rather than exit 0 (silent skip). Same rule applies
   to syntactically-valid JSON that fails the schema (missing required
   keys, wrong types). Rationale: an empty file is a sign of broken
   tooling or a partial commit; silently skipping the gate on broken
   tooling is exactly the bypass vector we're documenting in Risks.

**`bump-baseline.ts` behavior:**

1. Read most recent `results/{ISO}-v0.json`.
2. Read current `PROMPT_VERSION` from compiled `prompts/system.ts`.
3. Write `baseline.json` with: results values + `prompt_version` from
   import + ISO now + `captured_by: process.env.USER || 'unknown'`.
4. Print summary diff (old → new) to stdout.

**Note: PROMPT_VERSION monotonicity is enforced upstream, not here.**
`bump-baseline.ts` does NOT independently validate that the bumped
baseline's `prompt_version` is strictly greater than the previous
baseline's `prompt_version`. The rollback gate is entirely in
`check-prompt-version-bumped` (Step 5), which runs on every PR
touching `system.ts`. Acceptable architecture — single source of
truth for the monotonicity invariant. Documented here so the reliance
is explicit and future-maintainer-discoverable.

**Acceptance criteria:**

- `baseline.json` checked into the repo at `services/api/eval/baseline.json`.
- `check-eval-regression` script exits 0 when overall delta within 2pp
  and per-archetype delta within 3pp.
- Script exits 1 when overall delta exceeds -2pp.
- Script exits 1 when any per-archetype delta exceeds -3pp.
- Script exits 0 with logged rationale when failure conditions met but
  `INTENTIONAL_EVAL_REGRESSION:` line present in `--pr-body-file=`.
- Script exits 0 when `baseline.json` missing (narrow first-run case;
  see spec — empty/zero-byte baseline is distinct and exits 1).
- Script exits 1 when `baseline.json` exists but is empty / zero-byte
  / whitespace-only (malformed-baseline guard).
- Script exits 0 when `baseline.prompt_version !== PROMPT_VERSION`
  (the baseline is stale; comparison is meaningless).
- Script exits 1 when the most-recent results file's `prompt_version`
  field does not match the current `PROMPT_VERSION` const (results
  from a stale prompt version produce nonsensical comparison —
  separate concern from baseline staleness).
- Override parser is case-sensitive and exact-string-match;
  lowercase / typo variants do NOT trigger the override.
- Override rationale extraction trims whitespace and rejects
  empty-after-trim rationales.
- Multiple `INTENTIONAL_EVAL_REGRESSION:` lines in a PR body: any-match
  wins; all matched rationales are logged.
- `bump-baseline` script writes a valid `baseline.json` matching the
  schema above.
- `bump-baseline` refuses to write if there is no results file newer
  than the existing baseline.
- `eval.yml` workflow runs `check-eval-regression` after `eval-v0` in
  the same job (so it has the just-written results file).

**Code shape — `check-eval-regression.ts`:**

```ts
import {readFileSync, readdirSync, existsSync} from 'node:fs'
import {join} from 'node:path'

type Baseline = {
  prompt_version: string
  overall_pass_rate: number
  per_archetype_pass_rate: Record<string, number>
  thresholds: {overall_drop_max_pp: number; per_archetype_drop_max_pp: number}
}

function findLatestV0Results(resultsDir: string): string | null { /* ... */ }
function readPromptVersion(): string { /* import or fs-read */ }
function readPrBody(arg: string | undefined): string { /* file or env */ }

async function main(): Promise<number> {
  const baselinePath = join(__dirname, '..', 'eval', 'baseline.json')
  if (!existsSync(baselinePath)) { console.log('no baseline; skipping'); return 0 }
  const baseline: Baseline = JSON.parse(readFileSync(baselinePath, 'utf-8'))
  const currentVersion = readPromptVersion()
  if (baseline.prompt_version !== currentVersion) {
    console.log(`baseline prompt_version ${baseline.prompt_version} ≠ current ${currentVersion}; skipping`)
    return 0
  }
  // ... compute deltas, evaluate thresholds, check INTENTIONAL_EVAL_REGRESSION,
  // log + exit
}
```

**Estimated complexity:** Medium. The CLI is mechanical. The CI wire-up
is the bit Eva has to review (path filter, secret access, exit-code
propagation).

### Step 4: PROMPT_VERSION on telemetry + mini_app_version column

**Files to modify:**

- `services/api/src/llm/telemetry.ts` — add `prompt_version` to the
  `generate.completed` event payload whitelist.
- `services/api/src/llm/generate.ts` — at `generate.completed` event
  emission, include `prompt_version` from the imported `PROMPT_VERSION`
  const.
- `services/api/src/llm/generate.test.ts` — assert the new key is on the
  event payload; assert the value matches the const.
- `services/api/src/llm/telemetry.test.ts` — extend the whitelist test.
- `services/api/src/db/schema.ts` — add `prompt_version` column to
  `mini_app_version` (text, nullable).
- `services/api/src/services/projects.service.ts` (or wherever
  `mini_app_version` rows are written) — write the current
  `PROMPT_VERSION` const on row insert.
- `services/api/drizzle/migrations/{NNNN}_add_prompt_version.sql` —
  new migration (review SQL per CLAUDE.md §10).

**Acceptance criteria:**

- `EVENT_PAYLOAD_WHITELIST['generate.completed']` contains
  `'prompt_version'`.
- `generate.completed` event payload at emission time contains
  `prompt_version: PROMPT_VERSION` (value taken from the import, not
  hardcoded — regression-safe against future bumps).
- `mini_app_version` schema includes a nullable `prompt_version` text column.
- New rows are inserted with the current `PROMPT_VERSION` const.
- Existing rows (pre-migration) have `null` and the read path tolerates
  null (e.g., analytics queries with `coalesce(prompt_version, 'pre-v0.1.0')`).
- No `prompt_version` column on `out_of_scope_intent` (per Decision §5).
- The `generate.invalid_spec` and `generate.out_of_scope` events do NOT
  add `prompt_version` (intentional scope tightness — failures are not
  joined to version analytics in V0).

**Code shape:**

```ts
// telemetry.ts
'generate.completed': [
  'generationId',
  'archetype',
  'screens_count',
  'navigation',
  'generation_duration_ms',
  'prompt_version',  // NEW
],

// generate.ts (at completion event emission)
await writeEvent('generate.completed', {
  generationId,
  archetype: spec.archetype,
  screens_count: spec.screens.length,
  navigation: spec.navigation,
  generation_duration_ms: phase2DurationMs,
  prompt_version: PROMPT_VERSION,
})
```

**Estimated complexity:** Low. Two file touches + one migration.

### Step 5: CI guard — PROMPT_VERSION bump required when system.ts changes

**Files to create:**

- `services/api/scripts/check-prompt-version-bumped.ts` — git-aware diff
  check.
- `services/api/scripts/check-prompt-version-bumped.test.ts` — tests.

**Files to modify:**

- `.github/workflows/eval.yml` — add a new pre-flight step before the
  eval run. (Same workflow file because the path filters already align;
  no need for a new workflow.)
- `services/api/package.json` — add `eval:check-version-bump` script.

**Behavior:**

1. Run `git diff origin/<base-branch> -- services/api/src/llm/prompts/system.ts`.
2. If diff is empty: exit 0 (no system.ts change).
3. If diff is non-empty: extract `PROMPT_VERSION = '<value>'` from the
   current `system.ts` and from the base `git show
   origin/<base>:services/api/src/llm/prompts/system.ts`.
4. If both extracted versions are equal: exit 1 with message
   `system.ts changed without PROMPT_VERSION bump`.
5. If versions differ and the new version isn't strictly greater under
   semver comparison: exit 1.
6. Otherwise exit 0.

**Acceptance criteria:**

- Script exits 0 when no `system.ts` changes detected.
- Script exits 1 when `system.ts` changes but `PROMPT_VERSION`
  unchanged.
- Script exits 1 when `system.ts` changes and new version is `< old`
  under semver.
- Script exits 0 when `system.ts` changes and new version `> old`
  under semver.
- Script handles the case where the base branch ref is unavailable
  (e.g., first commit; log warning and exit 0).
- CI workflow includes the script as a step before the eval run; failure
  blocks the eval job (saves API credits on a guaranteed-to-fail
  iteration).

**Code shape:**

```ts
import {execSync} from 'node:child_process'

function readVersion(content: string): string {
  const m = content.match(/PROMPT_VERSION = '([^']+)'/)
  if (!m) throw new Error('PROMPT_VERSION not found in system.ts')
  return m[1]
}
function semverGt(a: string, b: string): boolean { /* ... */ }

async function main(): Promise<number> {
  const base = process.env.GITHUB_BASE_REF || 'main'
  const path = 'services/api/src/llm/prompts/system.ts'
  const diff = execSync(`git diff origin/${base} -- ${path}`).toString()
  if (!diff) return 0
  const current = readFileSync(path, 'utf-8')
  const baseContent = execSync(`git show origin/${base}:${path}`).toString()
  const cv = readVersion(current), bv = readVersion(baseContent)
  if (cv === bv) { console.error(`${path} changed; PROMPT_VERSION not bumped`); return 1 }
  if (!semverGt(cv, bv)) { console.error(`PROMPT_VERSION ${cv} ≤ ${bv}`); return 1 }
  console.log(`PROMPT_VERSION bumped: ${bv} → ${cv}`)
  return 0
}
```

**Estimated complexity:** Low. Git diff parsing + a minimal semver
comparator (the version is always major.minor.patch — no pre-release,
no build metadata; we don't need a full semver library).

### Step 6: (Stretch) Sample-Spec Emulator deep-link for batch screenshots

**Files to modify (this ADR specifies; ADR-0011 implements):**

- The dev-menu's `LoadSpecFromDevMenu` handler (per ADR-0011 Step 13)
  is the mount target — it loads a bundled fixture by name via the
  URL-scheme entrypoint and mounts it in Run mode without DB
  persistence. ADR-0010 does NOT modify any mobile-shell files
  directly.
- `apps/mobile/src/screens/Run/devMenu/__fixtures__/<name>.json` —
  bundled per-fixture JSON (owned by ADR-0011 Step 13 surface; ADR-0010
  may contribute the fixture content per archetype). The eval harness's
  per-prompt fixture writes (below) are the source.
- `services/api/eval/fixtures/<name>.json` — the eval harness writes
  one JSON file per successful generation in addition to the aggregate
  results JSON. Fixture name `<name>` corresponds to a prompt ID from
  `ARCHETYPE_PROMPTS` (e.g., `lc-04`, `tr-12`, `jr-07`, `ca-22`).

**Files in ADR-0011's scope (referenced here, owned there):**

- The mobile-shell URL-scheme handler that recognizes
  `appcreator://devmenu/load-spec?fixture=<name>` (dev builds only) and
  routes to the dev-menu's `LoadSpecFromDevMenu` handler (per ADR-0011
  Step 13), which mounts the fixture in Run mode without DB persistence.
- The Sample-Spec Emulator hook: a way for `xcrun simctl openurl` to
  trigger the load.

**Files in this ADR's scope only (the script):**

- `services/api/scripts/capture-eval-screenshots.sh` — bash script that
  iterates a sampled list of prompt IDs and runs `xcrun simctl openurl
  booted appcreator://devmenu/load-spec?fixture=<name>` + `xcrun simctl
  io booted screenshot` per ID.
- `services/api/eval/sample-grading-set.ts` — picks N random prompt IDs
  from `ARCHETYPE_PROMPTS`, balanced across archetypes, deterministic
  given a seed.

**Acceptance criteria (scoped to Step 6's V0 stretch goal):**

- Script `sample-grading-set.ts` returns N prompts balanced across
  archetypes given a `--seed=` arg (same seed → same sample).
- Script defaults: N=40, distribution 10 per archetype.
- Script writes selected prompt IDs to stdout, one per line.
- Bash script `capture-eval-screenshots.sh` accepts a `--seed=` arg,
  runs the harness against the sample, and produces a numbered
  screenshot file per prompt ID in `services/api/eval/screenshots/{date}-{seed}/`.
- Bash script tolerates a missing simulator (skip with warning; the
  grader takes screenshots manually that week).
- The mobile-shell deep-link integration is **declared as a dependency
  on ADR-0011** and tracked there. Step 6 ships the bash + sample
  scripts; the deep-link is ADR-0011's surface.

**Estimated complexity:** Medium. Script work is low; the cross-ADR
dependency is the load-bearing coordination piece.

**Failure mode:** If ADR-0011 doesn't deliver the deep-link hook before
week 5, Step 6 ships the sampling script alone; the grader opens each
fixture manually via the existing dev-only demo picker (one extra
click). The loop still works.

### Step 7: Documentation — sponsor-facing description + AC-G9 reference + template

**Files to create:**

- `docs/product/canvas-v0-prompt-quality-loop.md` — sponsor-facing
  description.
- `docs/pipeline/prompt-grading-template.md` — referenced from Step 2.

**Files to modify:**

- `docs/product/canvas-v0.md` §AC-G9 — append a reference clause:
  "Quality bar additionally enforced by the weekly grading rubric per
  ADR-0010; both AC-G9 (≥90% / ≥80%) and weekly grading Primary
  average ≥3.5 per archetype must hold for V0 launch."
- `docs/product/canvas-v0.md` §Success Metrics — add a "Pre-launch
  diagnostic" row for `prompt_grading_primary_avg` (target ≥3.5; not a
  KPI but a launch gate).
- `.claude/references/adr-index.md` — **NOT updated by Cal in this
  ADR**; Ellis owns the insertion post-commit (per coordination
  notes in the brief).

**`canvas-v0-prompt-quality-loop.md` structure (~600 words):**

- Why this loop exists (1 paragraph, references H5)
- The four parts (eval gates, weekly grading, regression gate,
  prompt versioning) — one short paragraph each
- The cadence (weekly grading sessions; per-PR regression check;
  ad-hoc prompt bumps)
- Who owns what (Sable: grading + veto; PM: cadence + sample
  selection; Engineering: prompt edits + scripts; Sponsor: month-end
  trend review)
- What "good" looks like (a graded session that produces a v0.X.Y
  iteration that ships)
- V0.5 extensions (LLM-as-judge, in-product feedback button, A/B
  routing) — explicitly deferred

**Acceptance criteria:**

- All three docs exist.
- `canvas-v0.md` §AC-G9 references ADR-0010.
- `canvas-v0.md` §AC-G9 still contains the original `≥90%` / `≥80%`
  numbers **in the same paragraph as the ADR-0010 reference** — the
  reference appends context, it does not replace the numeric bar.
- `canvas-v0.md` §Success Metrics includes the grading-primary-avg row.
- The loop doc references the template doc and the eval baseline file.
- The loop doc references **ADR-0007** (the harness the loop consumes;
  the loop is a thin layer on top of the ADR-0007 eval mode, not an
  independent surface).
- The loop doc does NOT contain any of the App Review prohibited
  phrases enumerated by §AC-AR3 of `canvas-v0.md` — explicit grep
  targets: `app builder`, `AI app generator`, `code generation`,
  `no-code`, and any case-variant. Rationale: even though the loop
  doc is internal, App Review auditors may request internal docs;
  positioning hygiene must hold across all written surfaces.
- ADR index is **NOT** modified in this ADR's commit (per coordination
  notes; Ellis inserts the row post-commit).

**Estimated complexity:** Low-Medium. Mostly prose; the §AC-G9 edit
needs care to not contradict the existing bar.

---

## Comprehensive Test Specification

### Test File Mapping

| Step | Test File | Env |
| --- | --- | --- |
| 1 | `services/api/src/llm/prompts/system.test.ts` (extend) | Node (Jest) |
| 2 | `services/api/test/grading-template.test.ts` (NEW) | Node (Jest — markdown structure) |
| 3 | `services/api/scripts/check-eval-regression.test.ts` (NEW) | Node (Jest) |
| 3 | `services/api/scripts/bump-baseline.test.ts` (NEW) | Node (Jest) |
| 4 | `services/api/src/llm/telemetry.test.ts` (extend) | Node (Jest) |
| 4 | `services/api/src/llm/generate.test.ts` (extend) | Node (Jest) |
| 4 | `services/api/src/db/schema.test.ts` (extend) | Node (Jest — DB migration smoke) |
| 5 | `services/api/scripts/check-prompt-version-bumped.test.ts` (NEW) | Node (Jest — git-mock + fs) |
| 6 | `services/api/eval/sample-grading-set.test.ts` (NEW) | Node (Jest) |
| 7 | `services/api/test/docs.test.ts` (NEW or extend existing docs test) | Node (Jest — fs.existsSync + grep) |

### Step 1 Tests — Prompt v0.1.0

| ID | Category | Description |
| --- | --- | --- |
| T-0010-001 | Happy | `PROMPT_VERSION === 'v0.1.0'` (exact literal at first ship) |
| T-0010-002 | Boundary | `PROMPT_VERSION` matches `/^v\d+\.\d+\.\d+$/` (semver-shape, no pre-release suffix) |
| T-0010-003 | Boundary | `PROMPT_VERSION` is exported `as const` (TS const-assertion preserves literal type — assert via type-level test or `typeof PROMPT_VERSION extends 'v0.1.0' ? true : false`) |
| T-0010-004 | Happy | `SYSTEM_PROMPT_CATALOG.includes('## Archetype Recipes')` |
| T-0010-005 | Happy | `SYSTEM_PROMPT_CATALOG.includes('### ListCRUD recipe')` |
| T-0010-006 | Happy | `SYSTEM_PROMPT_CATALOG.includes('### Tracker recipe')` |
| T-0010-007 | Happy | `SYSTEM_PROMPT_CATALOG.includes('### Journal recipe')` |
| T-0010-008 | Happy | `SYSTEM_PROMPT_CATALOG.includes('### Calculator recipe')` |
| T-0010-009 | Happy | Calculator recipe includes `Section` and `Stat` (both V0 component names) |
| T-0010-010 | Happy | Calculator recipe includes `NumberField` with bounds guidance (`min`, `max`, `step` words present) |
| T-0010-011 | Happy | Tracker recipe includes `tabs` (nav pattern) |
| T-0010-012 | Happy | Tracker recipe mentions `streak` OR `count` (domain field guidance) |
| T-0010-013 | Happy | Journal recipe specifies `expressive` (stance) |
| T-0010-014 | Happy | Journal recipe mentions `multiline=true` or `multiline` in some form |
| T-0010-015 | Happy | ListCRUD recipe includes `EmptyState` |
| T-0010-016 | Failure | Calculator recipe does NOT mention `MoneyField` (it's V1) |
| T-0010-017 | Failure | Calculator recipe does NOT mention `Slider` (V1) |
| T-0010-018 | Failure | Calculator recipe does NOT mention `TimeField` (V1) |
| T-0010-019 | Failure | No archetype recipe mentions V1 components: `RatingInput`, `MultiPicker`, `SearchBar`, `Chart`, `BarChart`, `LineChart` (parametrized check) |
| T-0010-020 | Happy | Calculator recipe explicitly states V0 lacks MoneyField — search for the phrase 'no MoneyField' OR 'has no MoneyField' OR equivalent disclaimer |
| T-0010-021 | Happy | Stat component description includes addendum on derived/computed values (search for 'derived' or 'computed') |
| T-0010-022 | Happy | `set` verb description includes the no-arithmetic-expression caveat (search for 'expression' or 'arithmetic' or 'inline') |
| T-0010-023 | Boundary | `SYSTEM_PROMPT_CATALOG.length` ≤ 25,000 chars (regression on T-0007-027) |
| T-0010-024 | Boundary | `SYSTEM_PROMPT_CATALOG.length` ≥ 22,000 chars (sanity: v0.1.0 additions actually present) |
| T-0010-025 | Boundary | `SYSTEM_PROMPT_STATIC.length` ≤ 2,000 chars (regression on T-0007-028) |
| T-0010-026 | Regression | `SYSTEM_PROMPT_STATIC` byte-equal to its previous shipped form (snapshot test against pinned string — change to static block requires explicit snapshot update and an ADR note) |
| T-0010-027 | Regression | All 28 V0 component names still appear in catalog (parametrized; carryover from T-0007-023) |
| T-0010-028 | Regression | All 12 V0 action verb names still appear in catalog (carryover from T-0007-024) |
| T-0010-029 | Regression | All 5 OOS capabilities still appear in catalog (carryover from T-0007-026) |
| T-0010-030 | Regression | All 4 archetype names still appear (carryover from T-0007-022) |
| T-0010-031 | Breaking change | No instance of `MoneyField` anywhere in `system.ts` (catalog OR static OR comments) |
| T-0010-032 | Happy | `PROMPT_VERSION` exported alongside `SYSTEM_PROMPT_STATIC` and `SYSTEM_PROMPT_CATALOG` from the module |

#### Step 1 Test Summary

| Category | Count |
| --- | --- |
| Happy | 17 |
| Failure | 4 |
| Boundary | 5 |
| Regression | 5 |
| Breaking change | 1 |
| **Total** | **32** |

### Step 2 Tests — Grading template

| ID | Category | Description |
| --- | --- | --- |
| T-0010-033 | Happy | File `docs/pipeline/prompt-grading-template.md` exists |
| T-0010-034 | Happy | File starts with `# Prompt Grading —` heading literal |
| T-0010-035 | Happy | File contains the frontmatter lines: `Graders:`, `Prompt version under test:`, `Eval baseline pass rate:`, `Sample size:`, `Eval results file:` (parametrized) |
| T-0010-036 | Happy | File contains a `## Per-prompt grades` section |
| T-0010-037 | Happy | Per-prompt grades table header includes all 10 named columns: `Prompt ID, Primary (1–5), Appropriateness, Layout, Stance/Palette, Verb usage, Copy, Empty state, Scope precision, Notes` (parametrized) |
| T-0010-038 | Happy | File contains a `## Per-archetype rollup` section |
| T-0010-039 | Happy | File contains a `## Sable's notes` section heading |
| T-0010-040 | Happy | File contains a `## Prompt iteration proposal` section |
| T-0010-041 | Happy | Iteration-proposal section contains all 5 named fields: `Hypothesis, Proposed change, Expected impact, Token budget delta, Next bump` (parametrized) |
| T-0010-042 | Happy | File contains the rubric semantics table (5 rows, scores 1–5) |
| T-0010-043 | Happy | Rubric semantics: score 5 reads `Design-Sable-could-ship` literal |
| T-0010-044 | Boundary | File `<= 8,000` chars (the template is a template, not a thesis) |
| T-0010-045 | Boundary | File `>= 1,500` chars (sanity floor) |
| T-0010-140 | Failure | Per-prompt grades table column-rename guard: parametrized assertion FAILS if any of the 10 column headers is renamed (test mutates one column header in a fixture copy of the template and asserts the column-set check rejects it). Calibration anchor — graders rely on column names being byte-stable. |
| T-0010-141 | Failure | Rubric anchor for **score 1** reads the exact literal `Broken / wrong archetype / would not ship` (no synonyms, no rewording). Most consequential calibration anchor: divergent score-1 mental models distort the entire scale. |
| T-0010-142 | Failure | Rubric anchor for **score 2** reads the exact literal `Structurally correct but visually weak across most dimensions`. |
| T-0010-143 | Failure | `## Per-archetype rollup` table body contains exactly the 4 V0 archetype names — `ListCRUD`, `Tracker`, `Journal`, `Calculator` — and does NOT contain any of the 8 M2 archetypes (parametrized exclusion check: `Notes`, `Habits`, `Inventory`, `Tasks`, `Reminders`, `Goals`, `Workouts`, `Reading` — names per the M2 archetype set; copy-paste risk from the team just coming off M2). |
| T-0010-144 | Failure | Template contains placeholder rows only — every `Primary` column cell in the per-prompt grades table reads `<1-5>` or equivalent placeholder, NOT a real numeric score (1–5). Same for `Prompt ID` cells: must read `<prompt_id>` or equivalent, not a real ID from `ARCHETYPE_PROMPTS`. |

#### Step 2 Test Summary

| Category | Count |
| --- | --- |
| Happy | 11 |
| Failure | 5 |
| Boundary | 2 |
| **Total** | **18** |

### Step 3 Tests — Baseline + regression gate

| ID | Category | Description |
| --- | --- | --- |
| T-0010-046 | Happy | `baseline.json` exists at `services/api/eval/baseline.json` |
| T-0010-047 | Happy | `baseline.json` parses as valid JSON |
| T-0010-048 | Happy | `baseline.json` contains all required keys: `prompt_version, captured_at, captured_by, overall_pass_rate, per_archetype_pass_rate, thresholds` |
| T-0010-049 | Happy | `baseline.json.per_archetype_pass_rate` contains all 4 V0 archetypes |
| T-0010-050 | Happy | `baseline.json.thresholds.overall_drop_max_pp === 2` |
| T-0010-051 | Happy | `baseline.json.thresholds.per_archetype_drop_max_pp === 3` |
| T-0010-052 | Happy | `check-eval-regression` exits 0 on a results file with identical metrics to baseline |
| T-0010-053 | Happy | `check-eval-regression` exits 0 when overall_pass_rate is 1pp BELOW baseline (within tolerance) |
| T-0010-054 | Happy | `check-eval-regression` exits 0 when overall_pass_rate is ABOVE baseline (improvement) |
| T-0010-055 | Failure | `check-eval-regression` exits 1 when overall_pass_rate is 3pp BELOW baseline |
| T-0010-056 | Failure | `check-eval-regression` exits 1 when ListCRUD pass rate is 4pp BELOW baseline (per-archetype) |
| T-0010-057 | Failure | `check-eval-regression` exits 1 when Calculator pass rate is 5pp BELOW baseline |
| T-0010-058 | Boundary | `check-eval-regression` exits 0 at exactly -2.0pp overall delta (boundary inclusive) |
| T-0010-059 | Boundary | `check-eval-regression` exits 1 at exactly -2.01pp overall delta |
| T-0010-060 | Boundary | `check-eval-regression` exits 0 at exactly -3.0pp per-archetype |
| T-0010-061 | Boundary | `check-eval-regression` exits 1 at exactly -3.01pp per-archetype |
| T-0010-062 | Error handling | `check-eval-regression` exits 0 with log when `baseline.json` is missing |
| T-0010-063 | Error handling | `check-eval-regression` exits 0 with log when `baseline.prompt_version !== PROMPT_VERSION` |
| T-0010-064 | Error handling | `check-eval-regression` exits 1 with a clear error when there is no results file in `eval/results/` |
| T-0010-065 | Error handling | `check-eval-regression` exits 1 when `baseline.json` is malformed JSON (not 0 — silent-skipping a broken baseline is worse than failing loud) |
| T-0010-066 | Happy (override) | `check-eval-regression` exits 0 when overall delta is -5pp but `--pr-body-file=` contains `INTENTIONAL_EVAL_REGRESSION: tuning Tracker recipe` |
| T-0010-067 | Failure (override) | `check-eval-regression` exits 1 when `--pr-body-file=` is empty (no override) and delta exceeds threshold |
| T-0010-068 | Failure (override) | `check-eval-regression` exits 1 when `INTENTIONAL_EVAL_REGRESSION:` is present but the rest of the line is blank (no rationale → blocked) |
| T-0010-069 | Security | `check-eval-regression` does NOT print user prompts or spec content; only metrics and prompt IDs |
| T-0010-070 | Security | The override rationale is logged verbatim (so a reviewer sees what was claimed); no PII filtering needed because PR bodies are not PII surface |
| T-0010-071 | Concurrency | Two concurrent invocations of `check-eval-regression` on the same results file produce identical exit codes (idempotent; no file lock needed because read-only) |
| T-0010-072 | Happy | `bump-baseline` reads the latest `results/{ISO}-v0.json` and writes baseline values matching |
| T-0010-073 | Happy | `bump-baseline` sets `baseline.prompt_version` to the current `PROMPT_VERSION` const value (not the value in the results file — the writer is the source of truth at bump time) |
| T-0010-074 | Failure | `bump-baseline` exits 1 when no results file exists newer than the current baseline |
| T-0010-075 | Failure | `bump-baseline` exits 1 when there is no results file at all |
| T-0010-076 | Boundary | `bump-baseline` writes `captured_at` as a valid ISO 8601 timestamp |
| T-0010-077 | Boundary | `bump-baseline` writes `captured_by` from `process.env.USER` or fallback `'unknown'` (never empty) |
| T-0010-078 | Regression | `bump-baseline` does NOT modify `thresholds` — those are constants of the gate, not data |
| T-0010-079 | Security | `bump-baseline` refuses to write outside `services/api/eval/baseline.json` (path is hardcoded; no `--path` arg) |
| T-0010-080 | CI/CD | `eval.yml` workflow includes a step after `eval-v0` that runs `check-eval-regression` with `GITHUB_PR_BODY`-derived input |
| T-0010-145 | Failure (override) | `check-eval-regression` exits 1 when `--pr-body-file=` contains `intentional_eval_regression: rationale` (lowercase). **The parser is case-sensitive by spec.** Lowercase variants must NOT suppress the gate — protects against a PR body that organically writes the phrase in prose (e.g., "I have an intentional_eval_regression due to ..."). Audit-trail integrity guarantee. |
| T-0010-146 | Failure (override) | `check-eval-regression` exits 1 when `--pr-body-file=` contains `Intentional_Eval_Regression: rationale` (mixed-case). |
| T-0010-147 | Failure (override) | `check-eval-regression` exits 1 when `--pr-body-file=` contains `INTENTIONAL_EVAL_REGRSSION: rationale` (typo — missing E). Exact-string match — no fuzzy tolerance. |
| T-0010-148 | Happy (override) | `check-eval-regression` exits 0 when `--pr-body-file=` contains `INTENTIONAL_EVAL_REGRESSION:   rationale with leading spaces   ` — rationale is trimmed before non-empty check; whitespace tolerated; the override accepts. |
| T-0010-149 | Failure (override) | `check-eval-regression` exits 1 when `--pr-body-file=` contains `INTENTIONAL_EVAL_REGRESSION:   ` (whitespace-only rationale after colon) — trimmed rationale is empty; override rejected. Distinct from T-0010-068 (T-0010-068 covers blank-after-colon; this covers whitespace-after-colon). |
| T-0010-150 | Happy (override) | `check-eval-regression` exits 0 when `--pr-body-file=` contains TWO `INTENTIONAL_EVAL_REGRESSION:` lines (different rationales). Any-match wins; both rationale lines are logged to stdout. |
| T-0010-151 | Failure (cross-condition) | `check-eval-regression` exits 1 when overall delta is **-1.5pp** (within 2pp overall threshold) AND one archetype delta is **-3.5pp** (exceeds 3pp per-archetype threshold). The per-archetype condition blocks merge independently of the overall condition. Most operationally likely scenario: a prompt change helps 3 archetypes while regressing 1. |
| T-0010-152 | Boundary | `check-eval-regression` exits 0 when results file has metrics **identical** to baseline (zero-variance / zero-delta case). Guards against a floating-point comparison bug (e.g., `0.92 - 0.92 < 0` evaluating true due to FP rounding). |
| T-0010-153 | Failure | `check-eval-regression` exits 1 when `baseline.json` exists but is empty / zero-byte (distinct from missing — narrow first-run exception does NOT apply to empty files; empty is treated as malformed). |
| T-0010-154 | Failure | `check-eval-regression` exits 1 when `baseline.json` exists but is whitespace-only (e.g., `"  \n"`). Same logic as T-0010-153. |
| T-0010-155 | Error handling | `check-eval-regression` exits 1 when the most-recent results file is malformed JSON (analogous to T-0010-065 for baseline — symmetric guard so both inputs fail loud, never silent-skip). |
| T-0010-156 | Security | `check-eval-regression` exits 1 when the most-recent results file's `prompt_version` field does NOT match the current `PROMPT_VERSION` const (results from a stale prompt version produce a nonsensical comparison; this is a separate concern from baseline-version mismatch in T-0010-063). |

#### Step 3 Test Summary

| Category | Count |
| --- | --- |
| Happy | 15 |
| Failure | 14 |
| Boundary | 6 |
| Error handling | 5 |
| Security | 4 |
| Concurrency | 1 |
| Regression | 1 |
| CI/CD | 1 |
| **Total** | **47** |

### Step 4 Tests — PROMPT_VERSION telemetry + DB column

| ID | Category | Description |
| --- | --- | --- |
| T-0010-081 | Happy | `EVENT_PAYLOAD_WHITELIST['generate.completed']` includes `'prompt_version'` |
| T-0010-082 | Happy | `generate.completed` event emitted by `generateAppSpec` includes `prompt_version: 'v0.1.0'` (or current const value) on the payload |
| T-0010-083 | Happy | The `prompt_version` value in the event matches the imported `PROMPT_VERSION` const (regression-safe to const bump) |
| T-0010-084 | Failure | `writeEvent('generate.completed', {prompt_version: 'unknown', ...validKeys})` succeeds (only key whitelisted, not value-shape) |
| T-0010-085 | Regression | `EVENT_PAYLOAD_WHITELIST['generate.out_of_scope']` does NOT include `prompt_version` (intentional V0 scope) |
| T-0010-086 | Regression | `EVENT_PAYLOAD_WHITELIST['generate.invalid_spec']` does NOT include `prompt_version` |
| T-0010-087 | Regression | `EVENT_PAYLOAD_WHITELIST['out_of_scope_intent_captured']` does NOT include `prompt_version` |
| T-0010-088 | Regression | The other 4 entries in `EVENT_PAYLOAD_WHITELIST['generate.completed']` are unchanged: `generationId, archetype, screens_count, navigation, generation_duration_ms` (parametrized) |
| T-0010-089 | Happy (DB) | After running the new migration, `mini_app_version` table has a `prompt_version` column |
| T-0010-090 | Boundary (DB) | `prompt_version` column is `text` and nullable |
| T-0010-091 | Happy (DB) | Inserting a new `mini_app_version` row writes the current `PROMPT_VERSION` value (`'v0.1.0'`) |
| T-0010-092 | Failure (DB) | An existing row inserted before the migration has `prompt_version: null` (and the migration does not backfill — V0 trade-off) |
| T-0010-093 | Failure (DB) | Inserting `mini_app_version` with `prompt_version: ''` (empty string) is allowed by DB but caller (`projects.service`) MUST pass the const literal, not empty (assert at service test) |
| T-0010-094 | Security | The `prompt_version` value is bounded by the const at write-time; user input cannot reach this column |
| T-0010-095 | Concurrency | Two concurrent inserts with the same `PROMPT_VERSION` produce two rows with identical values; no race (write-only, no read-modify-write) |
| T-0010-096 | Regression | The `mini_app_version` column count is exactly the previous count + 1 (catches accidental column drops) |
| T-0010-097 | CI/CD | Drizzle migration file exists at `services/api/drizzle/migrations/{NNNN}_add_prompt_version.sql` |
| T-0010-098 | CI/CD | The Drizzle generated SQL file is committed (not relying on dev-time generation) |
| T-0010-157 | Error handling (DB) | Pre-migration state — if a `mini_app_version` insert is attempted against a DB that has NOT yet had the `add_prompt_version` migration applied, the service must **fail loudly** (Drizzle insert errors on unknown column / inserted-key mismatch) rather than silently write a row without `prompt_version`. Test: spin up a DB at the pre-migration schema, run the service insert path, assert it throws. Rationale: silent-null on `prompt_version` would corrupt the analytics join from day one. |

#### Step 4 Test Summary

| Category | Count |
| --- | --- |
| Happy | 5 |
| Failure | 4 |
| Boundary | 1 |
| Regression | 4 |
| Error handling | 1 |
| Security | 1 |
| Concurrency | 1 |
| CI/CD | 2 |
| **Total** | **19** |

### Step 5 Tests — PROMPT_VERSION bump CI guard

| ID | Category | Description |
| --- | --- | --- |
| T-0010-099 | Happy | `check-prompt-version-bumped` exits 0 when `git diff` shows no changes to `system.ts` |
| T-0010-100 | Happy | `check-prompt-version-bumped` exits 0 when `system.ts` changed AND `PROMPT_VERSION` went from `v0.1.0` → `v0.1.1` |
| T-0010-101 | Happy | `check-prompt-version-bumped` exits 0 when `PROMPT_VERSION` went `v0.1.0` → `v0.2.0` |
| T-0010-102 | Happy | `check-prompt-version-bumped` exits 0 when `PROMPT_VERSION` went `v0.1.0` → `v1.0.0` |
| T-0010-103 | Failure | `check-prompt-version-bumped` exits 1 when `system.ts` changed and `PROMPT_VERSION` is the same |
| T-0010-104 | Failure | `check-prompt-version-bumped` exits 1 when `system.ts` changed and `PROMPT_VERSION` went `v0.1.1` → `v0.1.0` (downgrade) |
| T-0010-105 | Failure | `check-prompt-version-bumped` exits 1 when `system.ts` changed and `PROMPT_VERSION` went `v0.2.0` → `v0.1.9` |
| T-0010-106 | Boundary | Semver comparison handles `v0.10.0` > `v0.9.0` correctly (not lexicographic) |
| T-0010-107 | Boundary | Semver comparison handles `v1.0.0` > `v0.99.99` correctly |
| T-0010-108 | Boundary | Comparison treats `v0.1.0` and `v0.01.0` as different / rejects `v0.01.0` (no leading zeros allowed) — failure: regex match fails |
| T-0010-109 | Error handling | Script exits 0 with warning when base ref unavailable (`git show origin/main:...` fails) — first-commit case |
| T-0010-110 | Error handling | Script exits 1 when `system.ts` parsing fails to find `PROMPT_VERSION` (broken file) |
| T-0010-111 | Error handling | Script exits 1 when `PROMPT_VERSION` is not a string literal (e.g., concatenated expression) |
| T-0010-112 | Security | Script does NOT execute `system.ts` content (uses regex extraction only) — adversarial commit injecting JS code is not executed |
| T-0010-113 | CI/CD | `eval.yml` runs `check-prompt-version-bumped` as a step before the `eval-v0` Anthropic call (saves API credits) |
| T-0010-114 | Regression | Script invocation has no side effects beyond stdout/stderr/exit code (no fs writes) |
| T-0010-158 | Security | `check-prompt-version-bumped` regex extraction (`PROMPT_VERSION = '([^']+)'`) is anchored to the export form, not a substring. Test: `system.ts` fixture containing multiple `PROMPT_VERSION = '<value>'` strings (one in a `//` comment with a different value, one as the actual export const). The extractor MUST return the export's value, not the comment's value. Defends against an adversarial commit that bumps the comment instead of the const. Recommended implementation: anchor the regex to `^export const PROMPT_VERSION = '([^']+)'` (multiline mode) so comment occurrences are excluded by construction. |

#### Step 5 Test Summary

| Category | Count |
| --- | --- |
| Happy | 4 |
| Failure | 3 |
| Boundary | 3 |
| Error handling | 3 |
| Security | 2 |
| CI/CD | 1 |
| Regression | 1 |
| **Total** | **17** |

### Step 6 Tests — Sample-Grading-Set + screenshot script (stretch)

| ID | Category | Description |
| --- | --- | --- |
| T-0010-115 | Happy | `sample-grading-set` returns 40 prompt IDs by default |
| T-0010-116 | Happy | `sample-grading-set --seed=42` returns the same 40 IDs across two invocations |
| T-0010-117 | Happy | `sample-grading-set` distribution: exactly 10 per archetype (parametrized: ListCRUD, Tracker, Journal, Calculator) |
| T-0010-118 | Happy | `sample-grading-set --n=20` distribution: 5 per archetype |
| T-0010-119 | Boundary | `sample-grading-set --n=4` distribution: 1 per archetype |
| T-0010-120 | Failure | `sample-grading-set --n=0` exits 1 (no sample is not a valid sample) |
| T-0010-121 | Failure | `sample-grading-set --n=3` exits 1 (cannot balance across 4 archetypes) |
| T-0010-122 | Failure | `sample-grading-set --n=200` exits 1 (only 100 prompts exist) |
| T-0010-123 | Boundary | `sample-grading-set --seed=abc` is accepted (string seeds hashed to numeric — deterministic) |
| T-0010-124 | Happy | `sample-grading-set` outputs one prompt ID per line on stdout |
| T-0010-125 | Regression | `sample-grading-set` source-of-truth is `ARCHETYPE_PROMPTS` (single import); no parallel hardcoded list |
| T-0010-126 | CI/CD | `capture-eval-screenshots.sh` exists and is executable |
| T-0010-127 | Happy | `capture-eval-screenshots.sh` defaults: `--seed=42 --n=40` |
| T-0010-128 | Error handling | `capture-eval-screenshots.sh` exits 0 with warning when `xcrun simctl` is missing (skips gracefully on CI) |
| T-0010-129 | N/A (per coordination) | The deep-link route handler in `apps/mobile/` is owned by ADR-0011 — tests of the route live there, not here. **Cross-ADR boundary grammar (authoritative declaration in ADR-0011 §Coordination → ADR-0010 subsection, R2):** ADR-0011 exposes a dev-only deep link with the form `appcreator://devmenu/load-spec?fixture=<name>`, where `<name>` is one of the prompt IDs in `ARCHETYPE_PROMPTS` (e.g., `lc-04`, `tr-12`, `jr-07`, `ca-22`). The handler routes to the dev-menu's `LoadSpecFromDevMenu` handler (per ADR-0011 Step 13), which mounts the fixture in Run mode without DB persistence. ADR-0010 ships the harness-side per-prompt fixture JSON writes; ADR-0011 ships the deep-link consumer. Justification: avoids dual ownership of the route surface. |

#### Step 6 Test Summary

| Category | Count |
| --- | --- |
| Happy | 6 |
| Failure | 3 |
| Boundary | 2 |
| Error handling | 1 |
| Regression | 1 |
| CI/CD | 1 |
| N/A | 1 |
| **Total** | **15** |

### Step 7 Tests — Documentation

| ID | Category | Description |
| --- | --- | --- |
| T-0010-130 | Happy | File `docs/product/canvas-v0-prompt-quality-loop.md` exists |
| T-0010-131 | Happy | Loop doc references `services/api/eval/baseline.json` |
| T-0010-132 | Happy | Loop doc references `docs/pipeline/prompt-grading-template.md` |
| T-0010-133 | Happy | Loop doc has all 6 required sections: `Why this loop exists, The four parts, The cadence, Who owns what, What "good" looks like, V0.5 extensions` (parametrized) |
| T-0010-134 | Happy | `docs/product/canvas-v0.md` §AC-G9 references `ADR-0010` |
| T-0010-135 | Happy | `docs/product/canvas-v0.md` §Success Metrics contains the `prompt_grading_primary_avg` diagnostic row with target ≥3.5 |
| T-0010-136 | Failure | `.claude/references/adr-index.md` is NOT modified by this ADR's commit (regression: Ellis owns the insertion; Cal does not touch the file). Test: `git diff` of the ADR commit does not include `.claude/references/adr-index.md`. |
| T-0010-137 | Regression | `docs/product/canvas-v0.md` §AC-G9 still includes the original `≥90%` / `≥80%` numbers (no overwrite — ADR-0010 appends, doesn't replace) |
| T-0010-138 | Boundary | Loop doc length ≤ 6,000 chars (a Sponsor reads this in 5 minutes; longer is a red flag) |
| T-0010-139 | Boundary | Loop doc length ≥ 2,000 chars (sanity floor) |
| T-0010-159 | Failure | `canvas-v0.md` §AC-G9 paragraph that mentions ADR-0010 ALSO contains the literal `≥90%` AND the literal `≥80%` numbers in the same paragraph. Reference adds context; does not replace. (Strictly tighter form of T-0010-137 — requires same-paragraph presence, not just file-wide presence.) |
| T-0010-160 | Failure | `docs/product/canvas-v0-prompt-quality-loop.md` references **ADR-0007** by name or filename (the harness the loop consumes). |
| T-0010-161 | Failure | `docs/product/canvas-v0-prompt-quality-loop.md` does NOT contain any of the App Review prohibited phrases enumerated by §AC-AR3: parametrized exclusion check on `app builder`, `AI app generator`, `code generation`, `no-code` (case-insensitive). Positioning hygiene applies even to internal docs (App Review may request internal documentation). |

#### Step 7 Test Summary

| Category | Count |
| --- | --- |
| Happy | 6 |
| Failure | 4 |
| Boundary | 2 |
| Regression | 1 |
| **Total** | **13** |

### Test Totals

| Step | New | Regression | Total |
| --- | --- | --- | --- |
| 1 — Prompt v0.1.0 | 27 | 5 | 32 |
| 2 — Grading template | 18 | 0 | 18 |
| 3 — Baseline + regression gate | 46 | 1 | 47 |
| 4 — PROMPT_VERSION telemetry + DB | 15 | 4 | 19 |
| 5 — PROMPT_VERSION bump guard | 16 | 1 | 17 |
| 6 — Sample + screenshot (stretch) | 14 | 1 (incl. 1 N/A) | 15 |
| 7 — Documentation | 12 | 1 | 13 |
| **Total** | **148** | **13** | **161** |

(One test — T-0010-129 — is N/A scoped here; it documents the deliberate
cross-ADR boundary with ADR-0011. Counted in the total for traceability.)

### Per-step failure:happy ratio (post-revision)

| Step | Happy | Failure | Ratio |
| --- | --- | --- | --- |
| 1 — Prompt v0.1.0 | 17 | 4 | 0.24 |
| 2 — Grading template | 11 | 5 | 0.45 |
| 3 — Baseline + regression gate | 15 | 14 | 0.93 |
| 4 — PROMPT_VERSION telemetry + DB | 5 | 4 | 0.80 |
| 5 — PROMPT_VERSION bump guard | 4 | 3 | 0.75 |
| 6 — Sample + screenshot (stretch) | 6 | 3 | 0.50 |
| 7 — Documentation | 6 | 4 | 0.67 |

The failure:happy rule of ≥1.0 was the binding constraint in Roz's
review for Steps 2 and 7 (both at 0 failure tests originally). Both are
now non-zero with meaningful failure coverage; the rule as a strict
≥1.0 minimum is not enforced at the per-step level for Steps where
happy-path existence assertions naturally dominate (documentation,
prompt content, sample-grading-set). The Coverage Table in the Roz
review brief is the binding shape; the per-step rule is the
calibration check.

### Test Helpers & Mocks

- **Mocked Anthropic SDK** (existing pattern from ADR-0007 Step 3) —
  reused in Step 4 telemetry tests.
- **Mocked `node:child_process` `execSync`** (Step 5) — git commands
  return canned diffs and base-content strings.
- **In-memory baseline.json fixture** (Step 3) — read by tests via
  `jest.mock('node:fs')` or via a temp dir.
- **Containerized Postgres** (existing from ADR-0007 Step 4) — Step 4
  DB tests.
- **`tmp` package** or `os.tmpdir()` for ephemeral baseline / results
  fixtures.
- **Deterministic seedable RNG** for `sample-grading-set` (Step 6) —
  use `mulberry32` or similar PRNG that takes a numeric seed; no
  `Math.random()`.

### Coverage Gates

- New scripts (`check-eval-regression`, `bump-baseline`,
  `check-prompt-version-bumped`, `sample-grading-set`) must have 100%
  line coverage on the happy paths and all named failure branches.
- The `generate.ts` telemetry-payload assertion is a single new
  assertion; existing coverage requirements apply.
- Documentation tests are existence + content-grep; no coverage
  threshold beyond passing.

---

## UX Requirements

ADR-0010 does not change runtime UX. The loop is internal-facing
(engineering, design, sponsor). Sable's involvement is process, not
component design. Per AC-AR3 (positioning copy guardrails), the loop
documents (`canvas-v0-prompt-quality-loop.md`) avoid the forbidden
phrases — the doc is internal but eventually gets read by App Review
auditors if they ask "how do you decide what the app generates?" — so
positioning stays compliant: "produces a structured layout" not
"generates code".

---

## Data Sensitivity

| Store / Surface | Returns | Sensitivity |
| --- | --- | --- |
| `mini_app_version.prompt_version` | text (e.g., `'v0.1.0'`) | `public-safe`. Const string set server-side at row write time. Never user-influenced. Safe to expose to clients in any future detail endpoint. |
| `events.payload['prompt_version']` | text | `public-safe`. Analytics-only. Same constraints. |
| `baseline.json` | JSON | Internal. Committed to repo. Public-safe by definition (no user data). |
| `prompt-grading-{date}.md` | markdown | Internal. Committed to repo. May reference prompt IDs (e.g., `lc-04`) and grading notes — both safe. **MUST NOT reference user-facing real prompts** unless those prompts are eval fixtures from `prompts.ts` (already public in the repo). |
| `eval/results/{date}.json` | JSON | Internal. T-0007-171 already enforces no raw prompts in results; ADR-0010 inherits that guarantee. |

The one new sensitivity question — does `prompt_version` leak anything? —
is no. It's a const string. It tells an adversary which prompt iteration
is live, which is not exploitable (the prompt isn't public regardless).
If a future ADR adds runtime A/B routing, the column may carry per-user
variant identifiers; that's a re-evaluation point for V0.5, not now.

---

## CI/CD Impact

| Job | Config File | Impact | Required Change |
| --- | --- | --- | --- |
| `eval-v0` | `.github/workflows/eval.yml` | Two new steps: `check-prompt-version-bumped` (pre-flight, before Anthropic call); `check-eval-regression` (post-flight, after results JSON written). Both block job on failure. | Step 3 + Step 5 |
| `eval-out-of-scope` | `.github/workflows/eval.yml` | No change. Out-of-scope mode does not interact with the regression gate. | None |
| `renderer-snapshot-matrix` | `.github/workflows/renderer-snapshot-matrix.yml` | No change. | None |
| `codegen-drift` | `.github/workflows/codegen-drift.yml` | No change. | None |
| `cover-art-runtime-parity` | `.github/workflows/cover-art-runtime-parity.yml` | No change. | None |
| (NEW) `prompt-iteration-guard` | (in-line in `eval.yml`) | New step before the eval run that fails if `system.ts` changes without `PROMPT_VERSION` bump. | Step 5 |

The eval workflow path filters
(`services/api/src/llm/**`, `packages/protocol/**`,
`packages/a2ui-renderer/src/v0/components/**`) already trigger on
`system.ts` changes. No filter expansion required.

**Eva (DevOps) review required** for:
- The exit-code propagation of `check-eval-regression` inside the
  GitHub Actions job (must not pass on a failing script).
- `GITHUB_PR_BODY` is not a default env var — the workflow needs an
  explicit step to fetch the PR body (via `gh pr view --json body` or
  the `pull_request.body` payload field). Step 3 spec hand-waves this;
  Eva picks the cleanest approach at implementation.

---

## Documentation Impact

| Doc | Path | What Changes |
| --- | --- | --- |
| Canvas V0 feature spec | `docs/product/canvas-v0.md` §AC-G9 | Append reference to ADR-0010 and the weekly grading bar (≥3.5 Primary avg per archetype). Existing thresholds unchanged. |
| Canvas V0 feature spec | `docs/product/canvas-v0.md` §Success Metrics → Diagnostic KPIs | Add `prompt_grading_primary_avg` row (Target ≥3.5; Definition: weekly grading session per ADR-0010; Measurement: docs/pipeline/prompt-grading-{date}.md rollup). |
| Prompt-quality loop description (NEW) | `docs/product/canvas-v0-prompt-quality-loop.md` | New sponsor-facing doc explaining the loop. |
| Grading template (NEW) | `docs/pipeline/prompt-grading-template.md` | New template for weekly sessions. |
| ADR index | `.claude/references/adr-index.md` | **NOT modified by this ADR.** Ellis inserts the row post-commit. |
| ADR-0007 | `docs/adrs/ADR-0007-llm-v0-cutover.md` | No change. ADR-0010 builds on Step 7's harness; references it but does not modify it. |
| ADR-0011 (parallel) | `docs/adrs/ADR-0011-*.md` | Receives a dependency: "expose dev-only `appcreator://devmenu/load-spec?fixture=<name>` deep link for the Sample-Spec Emulator (ADR-0010 Step 6), routed to `LoadSpecFromDevMenu` per ADR-0011 Step 13." Authoritative grammar is declared in ADR-0011 §Coordination → ADR-0010 subsection (R2). This ADR consumes; ADR-0011 owns the surface. Coordination note in this ADR's §Notes for Colby. |
| CLAUDE.md | `CLAUDE.md` | No change. The patterns in §3 (LLM call pattern) and §8 (Testing patterns) remain authoritative; ADR-0010 builds on them. |
| ARCHITECTURE.md | `ARCHITECTURE.md` | No change in this ADR (ARCHITECTURE.md is the binding spec; if anything in this ADR contradicts it, ARCHITECTURE.md wins per CLAUDE.md preamble). |

---

## Coordination

- **ADR-0008 (Universal Links)** — no overlap. Different surface.
- **ADR-0011 (Mobile V0 shells + SIWA + `mini_app` rename)** — overlap
  at Step 6. ADR-0011 owns the mobile-shell deep-link surface; ADR-0010
  consumes it via the bash screenshot script. The dependency is
  one-directional: ADR-0010 ships without it (manual screenshot
  fallback); ADR-0011 implementing the hook (Step 13 `LoadSpecFromDevMenu`
  + URL scheme `appcreator://devmenu/load-spec?fixture=<name>`) upgrades
  Step 6 from stretch to checked-in. Authoritative grammar is declared
  in ADR-0011 §Coordination → ADR-0010 subsection (R2). This ADR
  consumes; ADR-0011 owns the surface.
- **Demo bugfixes already committed** (`2f25855`, `6d35755`) — none of
  this ADR's surface touches them.
- **ADR-0007 PR 4 kill review** — independent. ADR-0010's regression
  gate runs against `eval-v0` results, which is the very harness PR 4
  ships. If the kill review unwinds ADR-0007 PR 4 for any reason,
  ADR-0010 is paused until the harness is replaced (not invalidated;
  pause).
- **`.claude/references/adr-index.md`** — Cal does NOT touch this file.
  Ellis owns the post-commit insertion.

### D-0007-01 compensating-control closure

ADR-0010's grading loop is the long-term durable form of D-0007-01's
compensating control. D-0007-01 was accepted on the basis that "live CI
run against real Anthropic API IS the functional test" — i.e., the
`eval-v0` job in `.github/workflows/eval.yml` running against the real
SDK is the protection against unit-test-tautology slipping a
`writeResults` or mode-dispatch regression. ADR-0010's weekly human
grading session reviews actual eval outputs (specs + screenshots),
making the grader an explicit second gate on result-shape integrity
beyond CI's pass/fail. A malformed `writeResults` that produces specs
the renderer can't mount would be flagged by the grader as a
non-renderable result; a mode-dispatch regression that produces specs
of the wrong archetype would be flagged as appropriateness=1. The
D-0007-01 invalidation condition ("if a regression slips past live CI")
is therefore now partly covered by the weekly grading review — making
the deviation durable through M1 and beyond. If the grading cadence
slips for 2+ consecutive weeks (per the Risks-table mitigation),
D-0007-01's invalidation condition is re-armed for that gap until the
next session lands.

---

## Notes for Colby

1. **Step 1 is the highest-value step.** If everything else slips and
   only Step 1 ships, the live-demo tip calculator gap is closed. Lead
   with it.

2. **The Calculator recipe is the load-bearing text in Step 1.** Spend
   real care on its wording. It directly competes with the LLM's
   training prior to use `Body` + `TextField` + flat layouts. Read it
   to yourself in Sable's voice — if it sounds like a designer wrote
   it, the model will mirror that register in outputs.

3. **`PROMPT_VERSION` is the const, but the semantic version is
   `v0.1.0` at first ship.** Manual bump on each subsequent prompt
   change. Don't try to automate the version-derivation from content
   hash — that fights the loop. The human decides what's a v0.1.x
   patch vs a v0.2.0 minor.

4. **The regression gate's `INTENTIONAL_EVAL_REGRESSION:` override is a
   contract.** Don't add silent override paths (env vars, "skip CI"
   labels). Every override must be in the PR body, in the verbatim
   format, with a rationale on the same line. This is the audit trail.

5. **The `git diff` parsing in Step 5 is the brittlest piece.** Test
   it hard with the canned-diff mocks. If you find yourself wanting
   `simple-git`, push back — it's overkill for this surface and the
   regex parse is 20 lines.

6. **The Drizzle migration in Step 4 is reviewable SQL.** Per CLAUDE.md
   §10, run `pnpm --filter @app-creator/api db:generate`, READ the
   generated SQL, commit both the schema diff and the migration file.
   Do not edit a committed migration.

7. **Step 6 (screenshot automation) is stretch — explicitly.** If
   week-5 capacity is tight, ship Steps 1–5 + 7 and leave 6 for after
   App Store submission. The loop works without it.

8. **The grading template (Step 2) is markdown that other humans
   diff and read.** Keep it under 8KB. Don't add prose explaining
   why each column exists — the loop doc (Step 7) is where context
   lives.

9. **`baseline.json` is committed.** That's intentional. PRs that
   bump the baseline produce a diff that reviewers see. It's the
   eval pass-rate's version history.

10. **No telemetry on grading sessions.** Sable's grading notes don't
    get logged programmatically. The loop is in git; that's the log.

11. **When you write `check-prompt-version-bumped`, run it locally
    against a no-op `system.ts` change to confirm the CI guard
    triggers as expected.** This is the kind of script that's
    silently wrong until someone tries to bypass it.

12. **Cross-ADR coordination note for ADR-0011:** the deep-link signature
    is `appcreator://devmenu/load-spec?fixture=<name>` (authoritative
    grammar declared in ADR-0011 §Coordination → ADR-0010 subsection,
    R2) where `<name>` is one of the prompt IDs in `ARCHETYPE_PROMPTS`
    (e.g., `lc-04`, `tr-12`, `jr-07`, `ca-22`). The handler routes to the
    dev-menu's `LoadSpecFromDevMenu` handler (per ADR-0011 Step 13),
    which mounts the fixture in Run mode without DB persistence. The
    fixture spec is loaded from a JSON file the eval harness writes
    per-prompt during a `--mode=v0` run (see Step 6 files). ADR-0010
    ships the harness-side JSON writes; ADR-0011 ships the deep-link
    consumer.

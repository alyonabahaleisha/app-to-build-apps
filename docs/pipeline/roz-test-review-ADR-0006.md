# QA Report — ADR-0006 Canvas V0 Renderer (Test Spec Review, rev-0)

_Reviewed by Roz — 2026-05-08_

## Verdict: REVISE

---

## Ruling on Cal's 7 Self-Flagged Concerns

**Concern 1 — Renderer/host seam (§G):** acceptable with modifications. Remove `onShare` from `HostCallbacks` (vestigial — fired by host's button, not renderer); add a nested navigator seam test or document the known-safe nesting contract for stack-in-stack.

**Concern 2 — Middleware composition (§C):** acceptable; one forward-compat footgun. ADR-0007's telemetry middleware inserted *after* `toast` in the chain will silently miss all `toast` actions (toast short-circuits). Document this insertion constraint in `middleware.ts` and add MT-05 to lock the contract.

**Concern 3 — Milestone A:** acceptable with fixture path errata fix (line 27 + line 600 say `fixtures.ts`; should be `fixtures.demo.ts`).
**Milestone B:** overstated. Claims "all 4 nav patterns navigating" but T-0006-173 only exercises stack. Tighten claim or add tabs/modal integration tests.

**Concern 4 — Snapshot matrix (§J):** acceptable. 2 of 12 registers + polish-review week extension is sound.

**Concern 5 — AI bridge mockability (§F):** acceptable. Add `act()` usage note to Step 3 ACs and MT-04 for transition-state coverage.

**Concern 6 — Failure-vs-happy ratios on Steps 5, 9, 10:** Steps 5, 9 accepted under "narrow surface" rationale. **Step 10 NOT accepted** — runtime nav failure modes exist (back-on-empty-history, navigate-while-sheet-open, navigate-on-none-nav) and have no tests.

**Concern 7 — M1 spec compatibility (T-0006-177):** **NOT accepted.** Test description "either renders correctly via legacy fallback or surfaces a controlled error (decide which)" is a deferred architecture decision dressed as a test. Cal must pick a behavior and write a deterministic test.

---

## Issues Found

### R-01 (Medium) — T-0006-007 too vague for granular failures
Expand "12 action verbs produce correct state transitions per their schemas" to specify the expected state shape per verb, or split into 12 sub-tests with explicit assertions.

### R-02 (Medium) — T-0006-018 should throw in dev, return undefined in prod
The retro normalizeRow lesson: silent wrong values cause hard-to-trace bugs. In `__DEV__` the binding should throw; in production, return undefined + log. Split T-0006-018 into two tests.

### R-03 (High) — T-0006-102 says "6 input components" but inputs tier has 5
ImagePicker is in Compound (Step 8), not Inputs (Step 6). Fix the count: 5×3=15, not 18. Update Step 6 totals.

### R-04 (High) — `clearCollection` confirmation alert flow not tested
Sable's contract: "always wrapped in confirmation alert before dispatch." Three missing tests: (a) alert raised before reducer runs, (b) cancellation leaves collection unchanged, (c) confirmation dispatches.

### R-05 (High) — `removeItem` undo restoration not tested + architectural gap
Sable's contract: undo toast appears for 5s with tappable Undo action. Where does the buffered row data live? Not in §B's state model. Three missing tests: (a) undo toast shows with item data, (b) tap restores to original `rowOrder` position, (c) 5s expiry leaves item removed.

### R-06 (High) — UX doc still says "13-verb dispatcher"
`canvas-v0-ux.md` §Action Verb Feedback Contract header (line 1548) reads "The 13-verb dispatcher renders feedback uniformly." The feedback table includes `share`. ADR-0005 F-04 cut share. UX doc must be patched: remove share row, change "13-verb" → "12-verb".

### R-07 (P0, gates Step 10) — 3 missing nav failure tests
- back() called when history stack is empty on stack pattern
- navigate(target) called when sheet is already open on modal-overlay
- navigate(target) called when navigation: 'none'

These are runtime failures that Zod can't catch. Required.

### R-08 (High) — T-0006-177 must be rewritten as deterministic test
"Either renders correctly via legacy fallback or surfaces a controlled error (decide which)" cannot be implemented. Cal must pick a behavior. My recommendation: Option A — M1 spec fails V0 SpecSchema parse; AppRunner's RenderErrorBoundary catches; user sees render-error state.

### R-09 (Medium) — `share` listed in middleware pass-through (Step 2 ACs)
"each middleware can short-circuit (toast, aiProcess) or pass through (navigate, capture, share)" — `share` is not a renderer verb. Remove.

### R-10 (Low) — `renderer-snapshot-matrix.yml` Required Change unspecified
CI/CD Impact table says "New" without details. Mirror the codegen-drift.yml pattern from ADR-0005.

### R-11 (Low) — Milestone A fixture path errata
Lines 27 and 600 say `fixtures.ts`; Step 5 note + Colby note #12 + Step 13 say `fixtures.demo.ts`. Patch lines 27 and 600.

### R-12 (Low) — `onShare` in HostCallbacks unexplained
Already addressed in Concern 1 ruling — remove.

---

## Missing Tests (independently identified)

- **MT-01** — back() with empty history (Step 10, Failure)
- **MT-02** — clearCollection confirmation flow (Step 9, 3 tests: Failure + 2 Happy)
- **MT-03** — removeItem undo restoration (Step 9, 3 tests: 2 Happy + 1 Boundary)
- **MT-04** — AICapabilitiesProvider act() flush (Step 3, Boundary)
- **MT-05** — telemetry middleware insertion point (Step 2, Regression — ADR-0007 forward compat)
- **MT-06** — TextField focus border snapshot (Step 6, Snapshot — advisory)
- **MT-07** — FAB disabled state (Step 9, Failure)
- **MT-08** — Heading serif font in expressive stance (Step 5, Snapshot — advisory)
- **MT-09** — navigate() on navigation:'none' (Step 10, Failure)
- **MT-10** — ListSummary stable render across isAvailable() resolve (Step 8, Boundary — advisory)

---

## Roz's Assessment

267 tests for a 28-component, 12-verb, 4-nav-pattern renderer with an AI bridge is reasonable. The foundation work (Step 2) is well-specified — the immutability regression test, concurrency tests, and security tests reflect lessons from prior ADRs. Cal clearly read the retro lessons.

Three problem areas:

1. **The `share` verb ghost** still haunts documents written before F-04 closure landed. The UX doc Action Verb Feedback Contract was never patched. It will mislead Colby on test count.

2. **The `removeItem` undo mechanism** is architecturally underspecified. The transient buffer for undo isn't in §B's state model. There are no tests for undo restoration. This is the most user-visible feedback behavior in the entire verb set.

3. **T-0006-177 is a TODO dressed as a test.** The M1 alpha cohort deserves a deterministic decision.

One additional architectural concern Cal didn't self-flag: **the middleware ADR-0007 insertion point for telemetry.** If telemetry middleware goes after `toast` (which "add on top" implies), it will silently miss all `toast` actions. Document the constraint now.

**Verdict: REVISE.** Required additions: 3 nav failure tests (R-07), 3 clearCollection confirmation tests (R-04/MT-02), 3 removeItem undo tests + state model addition (R-05/MT-03), MT-05 (insertion-point), rewrite T-0006-177. Errata: R-03, R-06, R-09, R-11. Total surgical: ~10 new tests + ~5 edits. One round of revision should close it all.

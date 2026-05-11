# Cal — PR 4 Deviation Review (ADR-0007 Step 7, Roz NOTE-2)

_Reviewed by Cal — 2026-05-10_
_Subject: ADR-0007 PR 4, committed at `f970acc`_
_Trigger: Roz's `docs/pipeline/roz-pr4-qa-ADR-0007.md` NOTE-2; M1 cutover kill review gate_

## Verdict: ACCEPT

The deviation (T-0007-160..166 + T-0007-170..172 implemented as arithmetic
mirrors / type guards rather than mocked-SDK harness invocations) is
documented as **D-0007-01** in `docs/adrs/ADR-0007-llm-v0-cutover.md`
under a new §Deviations section. PR 4 is cleared for the M1 cutover
kill review.

## Rationale (≤300 words)

Three considerations decide this.

**Public-API cost vs. test-coverage benefit is asymmetric.** The three
mode runners (`runV0Mode`, `runOutOfScopeDetectionMode`,
`runOutOfScopeFalsePositiveMode`) are module-private by design. Each is
~80 lines wrapping `generateAppSpec` plus aggregation. Exporting them
to enable mocked-SDK threshold tests would commit the harness to a
three-function external contract just so unit tests can call them.
ADR-0007 is still Proposed; the harness's intended contract is the
binary, the CLI flags, and the results filename — not the internal
decomposition. That public-API decision should be deliberate, not a
side-effect of test ergonomics.

**The live CI run is a real functional test, not a lint gate.**
`.github/workflows/eval.yml` runs both `eval-v0` and
`eval-out-of-scope` against the real Anthropic API on every PR
touching `services/api/src/llm/**`, `packages/protocol/**`, or
`packages/a2ui-renderer/src/v0/components/**`. A regression in mode
dispatch, the result-aggregation loop, or `writeResults` surfaces
there. Eva owns secret provisioning (Roz NOTE-2 already flagged for
post-merge DevOps validation).

**AC11 is type-enforced.** `PerPromptResult` has no `prompt` field;
construction at `run.ts:150-156` builds it with `prompt_id` only. A
future change adding `prompt` would fail typecheck before CI.

The remaining real risk Roz identified — silent regression in
`writeResults` payload shape — is mitigated cheaply by adding a
runtime structural assertion inside `writeResults` (no API surface
change). I've called that out as a follow-up obligation in the
deviation entry, not a blocker. The deviation is explicitly contingent
on the live CI run continuing to function as the gate; if CI ever
silently ships a malformed results file in M1, the deviation is
invalidated and Colby exports the runners.

## Action taken

Added §Deviations section with entry **D-0007-01** to
`docs/adrs/ADR-0007-llm-v0-cutover.md` (appended after the existing
"What to escalate" section, before EOF). Entry covers:

- The deviation: which T-IDs, what was specified, what was implemented.
- The rationale: three points above, in detail.
- The compensating controls already in place: live CI on relevant
  paths, specific tests for parseMode / RESULTS_DIR / scoreArchetype /
  EVAL_MODE first-line / no-Promise.all, type-level privacy guard,
  prompt-dataset specificity (T-0007-152..159).
- The compensating control to add as a follow-up (non-blocking):
  runtime structural assertion inside `writeResults` covering AC11
  + AC12 shape.
- The invalidation condition: if a `writeResults`/mode-dispatch
  regression slips past CI in M1, the deviation is voided and the
  runners must be exported.
- Sign-off: Cal, 2026-05-10. NOTE-1 (run.ts length) and NOTE-3
  (eval.yml path filter) remain open as separately tracked
  follow-ups.

`.claude/references/adr-index.md` ADR-0007 row **not updated** —
status remains "Proposed (PRs 1+2+3 implemented)" pending PR 4
landing in the index after the kill review. Ellis owns that update
on commit.

## Estimated cost of the alternative path (REJECT → PR 5)

Rough sizing for the rejected branch, for the record:

- Export `runV0Mode`, `runOutOfScopeDetectionMode`,
  `runOutOfScopeFalsePositiveMode` from `services/api/eval/run.ts`.
  Mechanically trivial; semantically commits the public API surface
  decision.
- Refactor each runner to be safely callable from a test harness
  (currently each is structured around `for (const entry of
  ARCHETYPE_PROMPTS)` — fine to call directly, but `process.exit`
  semantics in `main()` and the `writeFileSync` side effect both need
  test seams. Either inject `fs`/`process.exit` or rely on the
  existing `jest.mock` of `node:fs` and the `process.exit` mock
  pattern from T-0007-168 — the latter is cheaper).
- Rewrite seven threshold tests (T-0007-160..166) to call the runners
  with mocked `generateAppSpec` returning crafted spec generators,
  asserting on the `boolean` return + the captured `writeFileSync`
  args. Rewrite three shape tests (T-0007-170..172) to assert on the
  captured `writeFileSync` payload from a real runner invocation.
- Net: ~1.5–2 days of Colby (refactor + test rewrite + Roz round-2
  QA). Plus a forward-cost on the public API: the three mode runners
  become a supported surface that future contributors must respect.

The benefit is closing a real gap (regressions in aggregation /
`writeResults` would be caught by unit tests rather than only by CI).
That gap exists, but the runtime structural assertion in
`writeResults` (a few hours of work as a follow-up) closes most of
it without the public-API cost. ACCEPT plus follow-up obligation
beats REJECT on net.

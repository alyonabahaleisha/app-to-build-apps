# QA Test-Spec Review — ADR-0005 Canvas V0: Protocol and Design System

**Reviewed by Roz** | **Date:** 2026-05-08

---

## Verdict: REVISE

Cal's test spec is the most mature one I've seen from him. The data-sensitivity table is correctly scoped to public-safe. The retro lessons landed: every function shape declared, sensitive-field reasoning documented, CI guard designed to catch the kind of discipline failure the retro lessons described. The four areas he flagged himself are real and he did catch three of the four. But there are material gaps, an arithmetic inconsistency the grand-total table obscures, a silent cross-runtime snapshot trap, and a critical missing test for the `share` verb's real failure mode. These gate approval.

---

## Category Coverage Table

Legend: COVERED / THIN / MISSING / N/A-justified

| Step | Happy | Failure | Boundary | Security | Concurrency | Regression | Breaking | Config |
|---|---|---|---|---|---|---|---|---|
| 1 — Scaffold + token enums | COVERED | THIN | COVERED | MISSING | N/A | COVERED | N/A (new) | N/A |
| 2 — Binding + Actions | COVERED | COVERED | COVERED | THIN | COVERED | N/A | COVERED | N/A |
| 3 — Collections | COVERED | COVERED | COVERED | MISSING | N/A | N/A | N/A (new) | N/A |
| 4 — 28 component schemas | COVERED | COVERED | THIN | MISSING | N/A | N/A | THIN | N/A |
| 5 — Spec + Screen + Node | COVERED | COVERED | THIN | MISSING | N/A | COVERED | N/A | N/A |
| 6 — Cross-ref validator | COVERED | COVERED | THIN | MISSING | COVERED | N/A | N/A | N/A |
| 7 — Codegen + CI guard | COVERED | COVERED | MISSING | MISSING | N/A | COVERED | COVERED | THIN |
| 8 — Design-system scaffold | COVERED | THIN | N/A | COVERED | N/A | COVERED | N/A | N/A |
| 9 — 80-icon module | COVERED | COVERED | COVERED | COVERED | N/A | COVERED | N/A | N/A |
| 10 — Cover-art determinism | COVERED | COVERED | COVERED | COVERED | COVERED | COVERED | COVERED | N/A |

---

## Failure:Happy Ratio — Independent Count

Cal's summary tables claim these per-step ratios. I re-counted from the test IDs.

| Step | Happy (Cal) | Happy (Roz count) | Negative (Cal) | Negative (Roz count) | Holds? |
|---|---|---|---|---|---|
| 1 | 16 | 16 | 11 | 11 | NO — happy > negative |
| 2 | 7 | 7 | 20 | 20 | YES |
| 3 | 4 | 4 | 11 | 11 | YES |
| 4 | 32 | 32 | 40 | 40 | YES |
| 5 | 6 | 6 | 8 | 8 | YES (close) |
| 6 | 5 | 5 | 17 | 17 | YES |
| 7 | 4 | 4 | 4 | 4 | NO — tied |
| 8 | 16 (summary) / 15 (probable) | 15 | 17 | 17 | YES (if corrected) |
| 9 | 5 | 5 | 8 | 8 | YES |
| 10 | 21 | 21 | 18 | 18 | NO — happy > negative |

**My ruling on parameterized-happy inflation:** Cal invited me to make a call. I am making one. The hard rule is failure ≥ happy on behavioral tests, not on parameterized enumeration tests. I accept the following reclassification:

- Steps 1, 8, 9, 10: parameterized "all N values parse" tests count as a single behavioral test for ratio purposes. Under that lens, Steps 1, 8, 9 have adequate ratios. Step 10 does not — the 20 golden snapshot tests (10 Node + 10 RN-jest) covering the same 10 inputs are each a happy-path pass, and the behavioral failure count (4 failure + 5 boundary + 2 security = 11) is adequate. I accept Step 10's ratio under the golden-collapse rule.

- Step 7 remains problematic even under any reasonable reclassification. Four happy tests against four negatives on an 8-test step covering a CI integration is borderline. One more failure test is warranted. See Finding F-07.

---

## Findings

### P0 Findings (gate approval — Cal must add before Colby starts)

#### F-01 — Cover-art cross-runtime snapshot trap (Step 10, T-0005-243..252)

**Severity:** P0

Cal's test description for T-0005-243..252 reads: "Same 10 fixture inputs → byte-identical snapshots; assertion: Node-snapshot file === RN-snapshot file (when both are checked in)."

The parenthetical "when both are checked in" is the trap. If the two snapshot files use different serialization formats — Jest's `.snap` format (which escapes unicode and uses a specific double-quote style) versus jest-expo's `.snap` format (which may differ in line endings, escaping, or snapshot key naming) — byte-identical SVG content can produce non-byte-identical snapshot files. The assertion `Node-snapshot file === RN-snapshot file` is not a Jest assertion; it has to be an explicit file-comparison step that runs after both test suites complete, probably in CI. The test spec does not describe how this cross-file assertion is implemented or where it runs.

Cal identified four failure modes (PRNG, attribute order, float precision, Lucide path). The snapshot-file format difference is a fifth failure mode not in his list. The real divergence is silent: both snapshot files exist, both pass their own test suite, but the SVG content differs because one runtime produces `"0.500"` and the other produces `"0.5"` (if the float-precision helper is applied inconsistently). The golden files look green. No test fails. Cover art on the install-gate page doesn't match the Library card. Social object identity is broken.

**Required:** Add an explicit test that reads both snapshot files from disk and asserts their SVG string content is byte-identical — not the snapshot file byte-for-byte, but the extracted SVG string value from each snapshot. This test should run as a Node test that reads both files post-run, or as a CI step in `codegen-drift.yml` that runs both suites and then diffs the extracted SVG values. The test description in the spec must describe this mechanism, not defer it to parenthetical.

Also: the spec says the 10 cover-art golden inputs cover "all 12 visual registers + 4 archetypes' canonical icons." 12 registers = 2 stances × 6 palettes. 10 fixture inputs cannot cover all 12 registers. Either the fixture count is 12 (not 10) or the coverage claim is overstated. Cal should either add 2 fixtures or retract the claim.

---

#### F-02 — `share` verb regression test is testing the wrong failure mode (Step 2, T-0005-039)

**Severity:** P0

T-0005-039 tests `ActionSchema.parse({type: 'share'})` fails. This is good as far as it goes. But the real failure mode for `share` re-entry is not a developer hand-typing `share` into a test fixture. It is the codegen pipeline.

The `share` verb is absent from the Zod schema's 12-verb discriminated union. When `gen-json-schema.ts` runs `zodToJsonSchema(SpecSchema)`, the output `json-schema.json` will not include `share`. ADR-0007 imports this file as the LLM tool `input_schema`. If someone in ADR-0007 accidentally adds `share` back to the system prompt's verb descriptions or to a Zod-adjacent type, the LLM may attempt to emit it — and the schema will reject it (good), but the rejection will surface as `invalid_spec` instead of a caught test failure.

The missing test: in the codegen test file (Step 7, `codegen.test.ts`), add an assertion that `generated/json-schema.json` does NOT contain the string `"share"` anywhere in its action verb enum or verb schema definitions. This is the F-4 regression guard at the codegen surface — the one place where `share` could silently re-enter without a Zod schema change.

Current T-0005-039 stays, but it is insufficient without the codegen-level guard.

---

### High Findings (should be resolved before Colby starts; Cal may address inline)

#### F-03 — ValidationErrorCode coverage is asserted but not verified (Step 6, T-0005-178)

**Severity:** High

T-0005-178 reads: "All 12 ValidationErrorCode values are exercised across the test suite." This is a category assertion, not a test. It passes trivially if someone writes it as `expect(Object.values(ValidationErrorCode)).toHaveLength(12)` — which tests the closed enum has 12 members but does not verify each code is produced by a live test case.

The actual coverage gap: looking at the 14 failure tests in Step 6, I count coverage of: `unknown_collection` (T-158), `unknown_field` (T-159), `field_type_mismatch` (T-160), `unknown_screen` (T-161), `unknown_state_slot` (T-162), `seed_field_missing` (T-164), `seed_field_extra` (T-165), `seed_required_missing` (T-166), `nav_screen_count_mismatch` (T-167), `none_nav_multiple_screens` (T-168), `nesting_too_deep` (T-169), `duplicate_id` (T-170, T-171, T-172). That's 12 codes with at least one test each. However, T-0005-178 as written could be implemented as a code-count assertion with no behavioral backing. The description must specify: assert that the test suite triggers each error code at least once via a real validator call, not via an enum inspection.

**Required:** Rewrite T-0005-178 to read: "The test suite produces at least one real `validateCrossRefs()` call that returns `{ok: false, errors: [{code: X}]}` for each of the 12 ValidationErrorCode values; verified by collecting all observed error codes across the test file and asserting set equality with the closed enum."

---

#### F-04 — Multi-error accumulation test scope is insufficient (Step 6, T-0005-174)

**Severity:** High

T-0005-174 tests that a spec with both `unknown_collection` and `unknown_screen` returns 2 errors. Cal states the validator returns ALL errors, not first-only, and T-0005-174 is the evidence. Two errors is the minimum demonstration of non-short-circuit behavior. It does not verify:

1. Three or more simultaneous errors (a spec could stop accumulating after 2 with a subtle early-return bug).
2. Errors at different structural depths — e.g., one error in `screens[0].root.children[1].collectionId` and another in `screens[0].root.children[2].action.target`. T-0005-176 tests path depth but for a single error.
3. Errors from different check categories simultaneously — e.g., a seed validation error combined with a nesting-depth error. Cal's note says "all checks accumulate"; verify it.

**Required:** Add two tests:
- A spec with 4 simultaneous violations (one `duplicate_id`, one `unknown_collection`, one `nesting_too_deep`, one `seed_field_extra`) returns all 4 errors.
- A spec with errors at depth 5+ on two separate subtrees returns both errors with correct paths.

---

#### F-05 — Step 7 codegen-drift CI guard tests a simulation, but the simulation may not reflect real CI behavior

**Severity:** High

T-0005-185 reads: "Hand-edited `generated/json-schema.json` is detected by codegen-drift CI (simulated by running `git diff --exit-code` on a modified file)."

The word "simulated" is doing a lot of work. The real CI behavior is:

1. Check out the PR branch.
2. Run `pnpm codegen`.
3. Run `git diff --exit-code packages/protocol/generated/`.
4. Non-zero exit fails the job.

The test in `codegen.test.ts` presumably modifies a file and runs `git diff --exit-code`. But in a test environment, if the working directory is not a git repo (or if the test runs inside a Jest sandbox that doesn't have the actual git state), `git diff --exit-code` will either return 0 (no diff because the modified file isn't tracked by git in the test environment) or crash. This is the "tests the mock, not the real behavior" anti-pattern.

**Required:** The test for T-0005-185 must either (a) run against the actual git repository by invoking `pnpm codegen` as a subprocess, then `git diff --exit-code`, and assert non-zero exit when a file has been hand-edited — or (b) be replaced by a stricter test: run `pnpm codegen` twice and assert byte-identical output (which already exists as T-0005-180), plus a note that T-0005-185 is validated by the actual `codegen-drift.yml` workflow on the first PR, not by a unit test simulation. Either interpretation must be documented in the spec so Colby doesn't write a test that passes trivially by not being in git context.

T-0005-186 ("workflow triggers on `packages/protocol/**` changes") is a config-level assertion. The test must read `.github/workflows/codegen-drift.yml` and assert the path filter contains `packages/protocol/**`. That is testable and correct. Mark it as such.

---

#### F-06 — Nesting-depth boundary tests are misaligned between Steps 5 and 6

**Severity:** High

T-0005-152 (Step 5) reads: "Nesting depth 8 succeeds; 9 fails (per validator — see Step 6)." The parenthetical is the problem. The Zod schema alone does not enforce nesting depth. `MAX_NESTING_DEPTH = 8` is enforced in the cross-reference validator (Step 6). T-0005-152 in Step 5 will pass for depth 9 at the Zod parse level — it only fails after `validateCrossRefs()` is called.

If T-0005-152 is implemented as a pure `SpecSchema.parse(depth9Spec)` call, it will return `ok` and the test will fail at assertion. If it is implemented as a full two-pass validation (parse + validateCrossRefs), it belongs in Step 6, not Step 5.

T-0005-169 (Step 6) correctly tests `nesting_too_deep` via `validateCrossRefs`. T-0005-173 (Step 6) tests the boundary: "Stack at depth 8 passes; depth 9 fails."

The conflict: T-0005-152 should either (a) be removed from Step 5 as redundant with T-0005-173, or (b) be rewritten to test only that `NodeSchema` accepts arbitrarily deep nesting without enforcing the cap — because at the Zod layer, deep nesting is structurally valid. The description as written will cause Colby to write a misimplemented test.

**Required:** Rewrite T-0005-152 to: "`SpecSchema.parse()` accepts a spec with a Node nested 9 levels deep — confirming Zod imposes no nesting limit; the limit is enforced by `validateCrossRefs()`." Remove the "9 fails" claim from Step 5.

---

#### F-07 — Step 7 failure-to-happy ratio is exactly tied; needs one more failure test

**Severity:** High

Step 7 has 4 happy and 4 negative tests across 8 total. The ratio is exactly tied, not failure ≥ happy. The codegen step is not low-risk: it produces the LLM tool `input_schema` that every generation call uses. Failures here are silent and wide-impact.

Missing tests:
- What happens when `gen-docs.ts` runs against a spec where a component has no JSDoc comment? The generated `docs.md` should either include a default stub or emit a named error — not silently produce a section with no content. A test for "all 28 components have non-empty docs.md sections" catches this.
- What does the CI guard do if `generated/` does not yet exist (fresh checkout)? `git diff --exit-code` on a file that doesn't exist returns 0 in some git versions. The CI guard must handle first-run creation. A test (or CI guard comment) for this scenario is absent.

**Required:** Add at least one failure test: `gen-docs.ts` emits a non-empty paragraph for each of the 28 components (parameterized over component name, asserts non-empty section in output). This covers the silent-empty-doc failure mode and brings Step 7 to 5 failure vs. 4 happy.

---

### Medium Findings (Cal may address inline during implementation; flag for Colby)

#### F-08 — Step 8 summary-table count is internally inconsistent

**Severity:** Medium

Step 8's own summary table says Happy: 16. The grand-total table says Step 8 total is 32. Working from the IDs: T-0005-187 (Happy), T-0005-188 (Happy) = 2 explicit happy. T-0005-189..198 = 10 IDs for 12 (stance, palette) combinations. There are 2 × 6 = 12 combinations; the range covers only 10. Either the range should be T-0005-189..200 (12 IDs), or the parameterized test covers 10 fixture inputs not all 12. Whichever is intended, the happy count is 2 + 10 + 3 (T-0005-213, 214, 215) = 15, matching the grand total's arithmetic. The summary table's "Happy: 16" is off by 1.

This is a documentation error, not a test gap — but if Colby counts from the summary table and allocates test IDs based on it, the numbering in Step 8 will collide with Step 9's IDs or leave a gap.

**Required:** Reconcile either the parameterized-range (T-0005-189..200 for 12 combinations) or the summary count (Happy: 15). Update one to match the other. Verify that downstream IDs (T-0005-199 onward for security tests) don't conflict.

---

#### F-09 — `Binding<T>` tested at binding-schema level only, not at per-input-component level (Steps 2 and 4)

**Severity:** Medium

Cal acknowledges this directly in his closing note. Step 2 tests the binding discriminated union in isolation. Step 4 tests each of 28 components with a "required-prop fixture." For input components (`TextField`, `NumberField`, `DateField`, `Picker`, `Switch`), the required fixture includes `valueBinding` — so each input gets one happy-path test with one binding kind.

Missing: each of the 5 input components (plus `ImagePicker`) tested with each of the 3 binding kinds (`literal`, `state`, `collectionField`). That is 6 components × 3 kinds = 18 behavioral tests. The Step 2 binding-schema tests prove the binding type is correct in isolation; they don't prove that `TextField.valueBinding: {kind: 'collectionField', collectionId: 'x', field: 'y'}` is accepted by `TextFieldSchema.parse()`.

This matters because Zod composition can fail silently if the wrong schema is used — e.g., if `TextFieldSchema` was accidentally written with `valueBinding: StringBindingSchema` hardcoded rather than using the shared schema. The binding test in Step 2 would still pass; the component test in Step 4 would only exercise one binding kind.

My ruling: this is a Medium, not High, because the F-6 cross-ref validator tests (Step 6) exercise live binding-to-collection references end-to-end. But the schema-level gap should be documented for Colby so he knows to use the shared schema, not re-implement it.

**Required:** Add to Step 4 "Notes for Colby" (or to the test spec): "Each input component's `valueBinding` field must be verified to accept all 3 binding kinds, not just the kind used in the fixture." Add at minimum T-0005-072a..072c (or equivalent) for `TextField` with all three binding kinds, and a comment that the other 5 input components follow the same pattern — parameterized or inline.

---

#### F-10 — Step 3 collection security: no test for maximum-size seed-row payload

**Severity:** Medium

The security concern here is not injection — it is denial-of-service via oversized seed data. ADR-0005 §Risks notes "worst-case parse cost is bounded" by the schema bounds (max 50 seed rows, max 20 fields, max 64-char field names, max 200-char Heading text). The collection schema tests verify the count limits (T-0005-064, T-0005-065) but not the content-size limits within a single row.

A pathological seed row is: 20 fields, each 64-char string values, each field name 64 chars. That's 20 × (64 + 64) = 2560 chars per row × 50 rows × 8 collections = 1,024,000 chars of seed content. Zod parses this; the server holds it in memory before storing. This is in-scope for a protocol that claims "all schema bounds enforced by Zod."

Missing test: a collection with 50 rows each containing 20 string-type fields at max string length succeeds parse without timing out (assert parse completes in < 500ms). This is a boundary/performance test, not a security test, but it proves the "worst-case parse cost is bounded" claim in the ADR.

**Required:** Add one boundary test to Step 3: max-size collection (50 rows × 20 fields × max-length strings) parses successfully and within a timing bound.

---

#### F-11 — Cover-art `Layer 4` (title gradient, productive only) is absent from schema and tests

**Severity:** Medium

Sable's cover-art composition formula (canvas-v0-ux.md §Generated Cover Art Composition Formula) specifies a Layer 4: "vertical linear gradient from `bg-elevated` 0% at bottom to transparent at 30% — productive only." This layer appears in the worked example discussion but is not mentioned in `coverArt.ts` code shape or in any test.

Two possibilities: (a) Layer 4 is a renderer concern (ADR-0006), not a `coverArt.ts` concern — `coverArt.ts` outputs the SVG and Layer 4 is overlaid by the renderer's List card component. (b) Layer 4 is part of the canonical SVG output and must be included by `coverArt.ts`. If (b), then T-0005-262 (the closed-attribute security test) must include `linearGradient`, `defs`, `stop`, and `stop-opacity` in the allowed-attribute set, which it currently does not.

Cal's `canonicalSVG()` call in the code shape shows 4 layers being passed in; the worked example in the UX doc shows the gradient is stance-conditional. But `coverArt.ts` code shape doesn't mention `linearGradient` or `defs`. If Layer 4 belongs in `coverArt.ts`, the security test's closed-attribute set is missing at least 4 attributes.

**Required:** Cal must explicitly state where Layer 4 lives (protocol package or renderer). If `coverArt.ts`, update T-0005-262's closed-attribute set to include gradient-related SVG attributes. If the renderer, add a note to Step 10 explaining why the gradient is excluded from the canonical SVG and where it is tested.

---

#### F-12 — Step 1 radius token count discrepancy between brief, UX doc, and schema

**Severity:** Medium

The brief (canvas-v0-brief.md §3.2) says "Radii: 4 — none, sm, md, lg, full." That is 5 names, not 4. Sable's UX doc (canvas-v0-ux.md §Radius scale) says "5 named — brief said 4" and includes `radius-none, radius-sm, radius-md, radius-lg, radius-full`. The ADR Step 1 acceptance criteria say: "All token-name enums export with the values from canvas-v0-ux.md §Token Surface (color: 12, space: 6, radius: 5, type: 6, elevation: 3, motion: 4)."

T-0005-009 tests "All 5 `RadiusToken` values parse (incl. `radius-none`)." So the test is written for 5. But the brief says 4. There is an unresolved discrepancy between the brief and the UX doc on the canonical count.

This is not just a documentation issue. If `RadiusToken` ends up with 5 values in V0, the LLM can emit `radius-none` in specs. If it ends up with 4 (Sable's "active sizes" reading), `radius-none` is not a valid LLM-emittable token — layouts use omission instead. The schema test outcome depends on which is correct.

**Required:** Cal must document in the ADR (or via a Slack decision) which count is canonical and which document wins. The ADR currently defers to the UX doc (5 values), which contradicts the brief (4 values). The acceptance criteria for Step 1 should name the winner. This resolves before Colby writes `tokens.ts`.

---

#### F-13 — canvas-v0.md AC-R4 counts 13 action verbs; ADR-0005 has 12

**Severity:** Medium

canvas-v0.md §AC-R4 reads: "All 13 action verbs execute correctly via the renderer's dispatcher: set, update, reset, addItem, removeItem, updateItem, clearCollection, navigate, back, capture, share, toast, aiProcess." This list explicitly includes `share` and counts 13. ADR-0005 §D correctly removes `share` for 12 verbs. But the product spec has not been updated to reflect F-4's resolution. If ADR-0006 (renderer) and ADR-0007 (generation) are written from canvas-v0.md without cross-referencing ADR-0005's F-4 note, `share` comes back in through the renderer dispatcher.

The ADR itself says "ADR-0005 retires no surface in this build window" — but the `share` verb retirement is a protocol-level decision that affects the renderer dispatcher (ADR-0006) and should be explicit in ADR-0005's consequences.

This is a documentation gap in the product spec that ADR-0005's test spec doesn't close. T-0005-039 tests the protocol rejects `share`. But there is no test that verifies the downstream: the generated `json-schema.json` does not enumerate `share` (this is partially covered by F-02 above), and no test in Steps 1-10 verifies the verb count is exactly 12 in the codegen output.

**Required:** Add to Step 7 tests: "`generated/json-schema.json` action verb enum has exactly 12 members, and the string `share` is not present in any verb type enum." This closes the loop that T-0005-039 opens. Also: note in the ADR's Consequences section that canvas-v0.md AC-R4 will be updated in ADR-0006 to reflect 12 verbs, not 13.

---

### Low Findings (Colby can address inline; no gate)

#### F-14 — Step 5 minimal Spec fixture is missing a required `collections` min-count boundary

**Severity:** Low

T-0005-150 tests "Spec with 0 collections succeeds (Calculator archetype: no collections)." The schema acceptance criteria say `collections: z.array(CollectionSchema).max(8)` — no minimum. This is correct for Calculator. However, the brief §2.4 says "Seed data: mandatory on every collection." If a Calculator spec has collections, they must have seed data. If a Calculator spec has no collections, a state-slot-only approach is used. T-0005-150 is correct as a schema boundary test but should be accompanied by a note: "Calculator with 0 collections is valid at schema level; validator checks seed data only on collections that exist."

No additional test required; just a description note.

---

#### F-15 — Step 6 error-path format is only tested at one depth

**Severity:** Low

T-0005-176 tests that `errors[0].path` is correctly populated for a deep ref. One deep-path test is the minimum. The test should specify the exact path value (`['screens', 0, 'root', 'children', 1, 'collectionId']`) rather than just asserting "a deep ref" — the current description as written is specific enough but the test should also cover an action-level path (e.g., `['screens', 0, 'root', 'children', 1, 'action', 'collection']`) to verify the path construction works across different node types.

Note for Colby, not a revision requirement.

---

#### F-16 — Step 9 `Icon` component size enforcement has no behavioral test for the pass-through case

**Severity:** Low

T-0005-231 tests that `<Icon name="chevron-left" size={9} />` rejects out-of-range size. T-0005-227 tests that sizes 16 and 32 render. The rejection mechanism for an invalid size is the test — but what should the rejection look like? Throw? Return null? Log a warning? The spec says "rejects out-of-range size (closed enum: 16/20/24/32)" but does not specify the rejection behavior. Colby will guess.

**Required:** Add to T-0005-231 description: specify whether invalid size throws (TypeScript compile-time enforcement only), throws at runtime, or renders a fallback. "Rejects" is insufficient.

---

## F-4 Resolution Verification (Cal's self-flagged friction points)

| Friction | Claimed resolution | Verified? |
|---|---|---|
| F-1: Binding discriminated union | `valueBinding: StringBinding` on inputs; 3-branch union; tested in Step 2 | YES — schema and tests cover the union |
| F-2: Runtime-only Button props | `loading` absent from schema; `disabled: BooleanBinding`; T-0005-126..128 | YES — regression tests present |
| F-3: Polymorphic ListItem slots | `SlotSchema` discriminated union; T-0005-129..134 | YES — all slot kinds tested |
| F-4: `share` verb cut | `share` absent from 12-verb union; T-0005-039 | PARTIAL — schema level only; codegen-level guard absent (see F-02) |
| F-5: 80-icon enum verbosity | Codegen from `lucide-static`; LLM sees names in system prompt | YES — acknowledged as architectural, not a test gap |
| F-6: Cross-ref validator | Two-pass validation; 12 codes; Step 6 tests | YES — but accumulation scope thin (see F-04) |
| F-7: Recursive children | `z.lazy()` + manual `Node` alias; T-0005-151, T-0005-152 | PARTIAL — T-0005-152 description is incorrect (see F-06) |

---

## Cal's Four Highest-Leverage Areas — Verdict

**1. Cover-art determinism contract (Step 10)**

Three of Cal's four failure modes are adequately covered: PRNG pinning (T-0005-269), SVG attribute order and float precision (T-0005-265), Lucide path source (T-0005-224, T-0005-270). The fourth failure mode — snapshot file format divergence across Jest and jest-expo — is not covered. This is F-01 above, rated P0. The cross-runtime assertion mechanism is unspecified. The 10-fixture vs. 12-register coverage gap is also present.

**2. Cross-reference validator coverage (Step 6)**

All 12 error codes have at least one behavioral test. The validator's all-errors-not-first-only behavior is tested but only for 2 simultaneous errors. The T-0005-178 coverage assertion is not an independently verifiable test. See F-03 (High) and F-04 (High).

**3. Closed-enum exhaustiveness (Steps 1, 2, 4, 9)**

IconName 80-value parameterized test is present (T-0005-223, T-0005-228 exact-count guard). Legacy M1 verb rejection is present (T-0005-052, T-0005-053). `share` verb rejection is present at schema level. The codegen-level guard for `share` is absent (F-02, P0). The Step 8 ID range discrepancy for the 12 (stance, palette) combination tests is a documentation inconsistency (F-08, Medium).

**4. Codegen-drift CI guard (Step 7)**

T-0005-185's simulation approach may not reflect real CI behavior. The test likely cannot reproduce CI's git-diff semantics in a Jest environment. See F-05 (High). T-0005-186 is a config assertion that is straightforwardly testable by reading the YAML file.

---

## Cal's Invited Ratio Rebalancing — My Ruling

I accept parameterized-enum happy tests as a single behavioral test for ratio purposes, consistent with how I've treated snapshot tests in prior ADRs. Under that lens:

- Steps 1, 8, 9: ratios are adequate when collapsed.
- Step 7: remains tied (4 vs. 4); one more failure test required (F-07).
- Steps 2, 3, 4, 5, 6: ratios hold without qualification.
- Step 10: I accept the golden-snapshot collapse rule — 20 goldens collapse to 1 behavioral happy pass. Under that lens, behavioral happy = 2 (T-0005-232 + 1 collapsed golden block) + failure/boundary/security = 16. Ratio holds.

No ratio-based rebalance demand beyond F-07.

---

## Data Sensitivity Table Review

Cal's table covers the 4 module outputs and correctly tags all as `public-safe`. The reasoning is documented ("hex codes are not secret; they ship in the mobile bundle"). The `normalizeRow` retro lesson is cited explicitly. No leakage vectors identified in the declared surface.

One gap: the table does not cover error returns from `validateCrossRefs`. A `ValidationError` with `path: ['screens', 0, 'root', 'children', 1, 'collectionId']` and `message: 'collection "workouts" not found'` reveals internal spec structure. This is acceptable because (a) the spec comes from the LLM, not user data, and (b) the path information aids debugging. But the table should explicitly note this: `validateCrossRefs errors` reveal spec structure (not user PII) — `public-safe` for logging purposes, but should not be returned verbatim to end users in production (ADR-0007 will gate this). Add this row.

---

## ADR-0004 Surface Retirement — Verification

The ADR states correctly: "ADR-0005 retires no surface in this build window." Confirmed. `packages/a2ui-schema/` stays. The new packages do not import from it. No ADR-0004 surface (planner, `/edit`, patch tool, telemetry module, eval short-circuit) is touched by Steps 1–10. The telemetry whitelist and eval short-circuit carry forward verbatim to ADR-0007.

The one watch-out: Step 7's `gen-json-schema.ts` will produce a new `json-schema.json` for the `produce_app_spec` tool. ADR-0007 must switch the route from `packages/a2ui-schema/` to `packages/protocol/generated/`. Until that switch, the existing eval harness runs against `packages/a2ui-schema/` unchanged — per the CI/CD impact section. This is correctly documented. No action required in this ADR.

---

## CI/CD Impact — Verification

| Job | Impact | Verified |
|---|---|---|
| `codegen-drift.yml` (new) | Runs on `packages/protocol/**` PRs; fails on non-empty `git diff --exit-code` | Partially — T-0005-186 covers the trigger; T-0005-185's simulation fidelity is questioned (F-05) |
| `eval.yml` (existing) | No change this ADR | Correct — `eval.yml` path filter unchanged until ADR-0007 |
| `pnpm test` (workspace) | Auto-picks new packages via `-r --parallel` | Correct — no root config change needed |
| `pnpm typecheck` (workspace) | Same | Correct |

One omission: the CI/CD Impact section does not address what happens if `pnpm install` picks up the two new packages but their `tsconfig.json` references are malformed. A type-check CI failure on a clean install of a new contributor is a likely early-CI failure that is not tested. Step 1's acceptance criteria cover `pnpm typecheck` passing, which implies this is tested — but it should be listed explicitly in the CI/CD impact.

---

## Documentation Impact — Verification

The documentation table is correct and minimal. `CLAUDE.md` workspace list update (2 lines). `adr-index.md` new row. `generated/docs.md` auto-generated. `ARCHITECTURE.md` deferred if no relevant §-specific update is needed. All appropriate.

One gap: the ADR does not note that `canvas-v0.md` AC-R4 (13 verbs) conflicts with ADR-0005's F-4 resolution (12 verbs). That conflict should appear in the Documentation Impact section with a note that ADR-0006 must update the product spec's verb count before its own review.

---

## Missing Tests — Independently Identified

These are cases Cal did not cover that I would expect to see before implementation:

**MT-1:** `SpecSchema.parse()` called with `initialState: {slot: <value>}` where `<value>` is not a valid `BindingValue` (i.e., an object, not a string/number/boolean) — should fail. The `BindingValueSchema` accepts `string | number | boolean`; an object would be rejected, but this is not tested. One failure test.

**MT-2:** `validateCrossRefs()` called on a spec where `initialState` contains a slot name that is 65 chars (over the 64-char max) — should fail. The schema bounds state slot names to max 64 chars on `Binding<state>`, but `initialState` is `z.record(z.string(), BindingValueSchema)` with no length limit on the key. If the key regex/length is not applied to `initialState` keys, a state slot can be declared without a matching reference. One boundary test.

**MT-3:** `coverArt()` with an `icon` value that exists in `IconNameSchema` but has an empty string in `ICON_PATHS` — should produce a named error, not silently render an invisible icon. T-0005-222 tests that `ICON_PATHS['chevron-left']` is non-empty, but this is a static assertion on the generated paths file. A runtime guard in `coverArt.ts` should throw if `ICON_PATHS[icon]` is empty. One failure test.

**MT-4:** `CollectionSchema` with a `reference` field where `targetCollectionId` references the collection itself (self-reference) — schema allows it; cross-ref validator should either allow or reject it with a defined behavior. The spec is silent on self-referencing collections. One test, pass or fail, with documented expected behavior.

**MT-5:** Two calls to `theme()` with the same arguments produce strictly equal (referential or value-equal) output — or produce independent copies. If `theme()` returns a shared mutable object, a caller who mutates the returned theme breaks all subsequent callers. One test: mutating the returned object does not affect a subsequent `theme()` call.

---

## Summary

| Severity | Count | Gate approval? |
|---|---|---|
| P0 | 2 (F-01, F-02) | YES |
| High | 5 (F-03, F-04, F-05, F-06, F-07) | YES |
| Medium | 6 (F-08..F-13) | No (address inline or in PR) |
| Low | 3 (F-14..F-16) | No (note for Colby) |
| Missing tests identified | 5 (MT-1..MT-5) | F-01 and F-02 are blocking; MT-1..MT-5 are add-inline |

---

## Roz's Assessment

Cal wrote a spec that reads like someone who absorbed the retro lessons and then tried very hard to pre-empt my questions. He mostly succeeded. The data-sensitivity table is clean. The closed-enum parameterization strategy is sound. The F-1 through F-7 friction-point resolutions are mostly correct. The cover-art determinism thinking is the best I've seen him do — four failure modes identified and tested.

The two P0 findings are both about the same class of mistake: testing the near thing instead of the real thing. T-0005-243..252 proves the SVG content is identical — but the mechanism for cross-asserting the two snapshot files is unspecified, and Jest snapshot files are not SVG strings. T-0005-039 proves the schema rejects `share` — but the schema is not what the LLM reads; the `json-schema.json` is, and nothing tests that file doesn't contain `share`. Both gaps would produce passing test suites and broken runtime behavior.

The High findings are all fixable before Colby starts. F-06 in particular would cause Colby to write T-0005-152 as a test that passes trivially because Zod doesn't enforce nesting depth — the description says "9 fails" but the mechanism that enforces the failure lives in Step 6, not Step 5. That is the kind of misimplementation that produces a green suite and a broken contract.

Medium F-12 (radius count disagreement between brief and UX doc) needs Cal to get a decision, not write a test. It is blocking in a different way: Colby cannot write `RadiusTokenSchema` until the count is settled.

The verdict is REVISE. The P0s are real and the High findings would leave Colby writing misimplemented tests. These are solvable in a half-day of revision. ADR-0004 took three rounds. This one needs one, maybe two. The bones are good.

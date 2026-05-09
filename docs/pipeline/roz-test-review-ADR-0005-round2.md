# Roz Test-Spec Review — ADR-0005 (rev-1)

**Reviewed by Roz** | **Date:** 2026-05-08 | **Round:** 2

---

## Verdict: APPROVE WITH NOTES

Every P0 and High finding from rev-0 has a substantive test response. The bones held. Three material issues remain — none of which is a new P0, but one of them will cause Colby to create wrong files if not corrected before implementation starts. The other two are internal consistency errors that make the spec misleading without being incorrect at the test-contract level.

The architectural calls Cal made during revision (Layer 4 in renderer, collection self-reference allowed, theme() frozen output) are sound. The MT-2 call is sound in principle but created a schema-consistency gap that deserves one additional test. The ratio tables are stale in several places and should be corrected.

---

## Finding-by-Finding Closure Verification

### F-01 (P0) — Cross-runtime snapshot trap: CLOSED

T-0005-256a is an explicit cross-file SVG-string extraction test. It reads both the Node and RN snapshot files from disk, parses the Jest snapshot format, extracts the SVG string values, and asserts byte-equality across all 12 matched pairs. The description specifies what "fails loudly" means (missing file, mismatched count, unequal string). This is the right mechanism — it checks the SVG content, not the snapshot file format.

The 12-fixture expansion (T-0005-233..244 Node, T-0005-245..256 RN) correctly closes the 10-vs-12 coverage gap. All 12 stance × palette combos now have a golden.

T-0005-256b asserts the CI workflow runs all three suites in order via YAML inspection. Adequate.

The new `cover-art-runtime-parity.yml` workflow is documented in the CI/CD Impact table with the correct trigger paths and step sequence.

Closed. No further action on F-01.

**New gap introduced by F-01 fix — MATERIAL:** See NV-1 below.

---

### F-02 (P0) — `share` codegen-level guard: CLOSED

T-0005-187a asserts `JSON.stringify(generated/json-schema.json)` does not contain the substring `"share"`. The search operates on the full stringified file, which catches `share` appearing in enum values, description fields, or any other JSON key. The word `share` is specific enough in context that false-positive hits from compound words are implausible in this schema. This is the right surface (the LLM-facing file) and the right assertion.

Closes the F-4 loop at the codegen surface. T-0005-039 retains schema-level coverage. Together they form the layered guard I asked for.

Closed.

---

### F-03 (High) — T-0005-178 behavioral coverage: CLOSED

The rewrite is correct. The test accumulates observed `ValidationErrorCode` values via a Jest `afterAll` hook across all live `validateCrossRefs()` calls in the file and asserts set equality with the closed enum. The description is specific enough to implement without ambiguity — "real-call coverage test, not a `Object.values().length` shape inspection."

One thing worth noting: the `afterAll` hook accumulation pattern requires a shared module-level collector. Colby will need to know to scope the collector to the test file, not to a shared global. The description implies this but doesn't state it explicitly. This is a Notes for Colby issue, not a revision requirement.

Closed.

---

### F-04 (High) — Multi-error accumulation scope: CLOSED

T-0005-174a: 4 simultaneous violations across 4 categories (`duplicate_id`, `unknown_collection`, `nesting_too_deep`, `seed_field_extra`), all surface. Asserts `errors.length === 4` and exact code set. This verifies three or more violations and cross-category accumulation.

T-0005-176a: errors at depth 5+ on two separate subtrees, both surface with exact paths. This verifies multi-subtree path construction.

Both tests are adequately described to write without reading source.

Closed.

---

### F-05 (High) — Codegen-drift simulation fidelity: CLOSED (via option b)

Cal chose option (b): T-0005-185 is retired as a simulation and reframed as a note pointing to T-0005-180 (byte-identical reproducibility) plus a reference to `codegen-drift.yml` as the production guard. T-0005-186 is sharpened to actual YAML inspection (parse the file, assert path filter and step sequence — not regex on raw text). This is the correct call. A Jest test cannot reliably reproduce CI's git-diff semantics. Documenting the split clearly prevents Colby from writing a simulation.

Closed.

---

### F-06 (High) — Nesting-depth misalignment: CLOSED

T-0005-152 is rewritten: "SpecSchema.parse() accepts a Spec with a Node nested 9 levels deep — confirming Zod imposes no nesting limit at the schema layer; the MAX_NESTING_DEPTH = 8 cap is enforced by validateCrossRefs()." The note explicitly tells Colby where the cap lives and what this test is validating.

Step 6 T-0005-173 retains the bound test: "Stack at depth 8 passes; depth 9 fails." The two tests no longer conflict.

Closed.

---

### F-07 (High) — Step 7 ratio: CLOSED

T-0005-183a added: `gen-docs.ts` emits a non-empty paragraph for each of 28 components. This directly covers the silent-empty-doc failure mode and is parameterized over component name. Brings the negative count above happy.

However, the ratio table at the bottom of the test spec still shows Step 7 as "4 vs. 4 — Borderline." The step-specific note says "4 happy vs. 7 negative." These are contradictory. See NV-2.

Closed as a finding. The stale ratio table is noted below.

---

### F-08 (Medium) — Step 8 count off-by-one: CLOSED

Cal chose the suffix approach (T-0005-198a, T-0005-198b) rather than extending the range to T-0005-189..200. This avoids the downstream ID collision with the security contrast range starting at T-0005-199. The approach is valid. Step 9 starts cleanly at T-0005-219 as claimed.

The Happy count in the Step 8 summary is now 18 (15 base + 2 reconciliation + 1 MT-5). The grand-total ratio table shows Happy=15 for Step 8, which is pre-218a. See NV-2.

Closed.

---

### F-09 (Medium) — Per-input binding-kind tests: CLOSED

T-0005-072a..072r: 6 input components × 3 binding kinds = 18 tests, parameterized via `test.each`. The description specifies the type fixture per component (TextField → StringBinding, NumberField → NumberBinding, etc.). The Notes for Colby section includes the parameterization comment.

The 18 tests push Step 4's happy count to 50 against 40 negative. Under the parameterized-collapse rule (which I applied to enum enumeration tests in rev-0), these tests are behavioral matrix coverage — closer to golden snapshot tests than to token enumeration tests. The ratio is technically inverted at raw count. Under behavioral collapse (18 binding-kind tests collapse to 1 per input component = 6 behavioral happys), the ratio holds. I accept this under the same logic applied to Step 10's goldens.

The ratio table at the bottom shows Step 4 as "32 vs. 40" — that's the rev-0 number. See NV-2.

Closed. Ratio table stale is noted.

---

### F-10 (Medium) — Max-size seed payload: CLOSED

T-0005-064a: 50 rows × 20 fields × 64-char strings × 64-char field names parses in ≤500ms. Correct surface, correct bound.

Closed.

---

### F-11 (Medium) — Layer 4 placement: CLOSED (architectural decision)

Cal's §J is explicit: Layer 4 (productive title gradient) lives in the renderer (ADR-0006), not in `coverArt.ts`. The reasoning is sound — the gradient is Library-card chrome, not cover-art identity. T-0005-262's closed-attribute set excludes gradient attributes, which is now correctly motivated. The note in Step 10 ACs explains the exclusion.

The architectural call is correct. Install-gate page renders the cover art without a title overlay; Library card adds the gradient at render time. Keeping the two surfaces separate preserves the "cover-art identity" contract across all consumers.

Closed.

---

### F-12 (Medium) — Radius count: CLOSED (Sponsor ruling)

Sponsor ruled 5. Step 1 ACs updated with explicit note: "Sponsor-locked at 5 (`radius-none, sm, md, lg, full`); the brief's '4' was a count typo." Documentation Impact notes the brief will be patched in a follow-up. T-0005-214 asserts `tokens.RADII` has exactly 5 entries.

Closed.

---

### F-13 (Medium) — Verb count codegen guard: CLOSED

T-0005-187b: walks `generated/json-schema.json` and counts `{type: 'string', const: <verb-name>}` entries within the Action definition. Asserts exactly 12 members. This is the right assertion — it counts structural members, not string occurrences. Catches accidental verb addition or removal.

The Consequences section notes ADR-0006 owns the AC-R4 update in canvas-v0.md.

Closed.

---

### F-14 (Low) — T-0005-150 description note: CLOSED

Description expanded with the cross-ref validator note. Adequate.

---

### F-15 (Low) — Error-path action-level test: CLOSED

T-0005-176b added with exact path `['screens', 0, 'root', 'children', 1, 'action', 'collection']`. Adequate.

---

### F-16 (Low) — Icon size rejection mechanism: CLOSED

T-0005-231 now specifies TypeScript compile-time enforcement via `// @ts-expect-error` directive. The rejection mechanism is unambiguous. No runtime guard needed because the literal union type prevents the call site.

Closed.

---

### MT-1 through MT-5: CLOSED

MT-1 (T-0005-150a): `initialState` with object value fails. Correct.
MT-2 (T-0005-150b): `initialState` with 65-char key fails. Correct as far as it goes — see NV-3 below.
MT-3 (T-0005-256c): `coverArt()` throws on empty path with named error. Defense-in-depth. Correct.
MT-4 (T-0005-057a): Collection self-reference allowed. Architectural call documented in Step 3 ACs.
MT-5 (T-0005-218a): `theme()` returns `Object.freeze`'d output. Tests both `Object.isFrozen()` and mutation non-propagation. Correct.

---

### Data Sensitivity row: CLOSED

The `validateCrossRefs` error row is present. Public-safe for server logging, not verbatim to end-users, ADR-0007 gates. Adequate.

---

## New Gaps Found (introduced by revision)

### NV-1 — Step 10 "Files to create" and acceptance criteria are inconsistent with the test table (MATERIAL)

**Severity:** Medium (Colby will create wrong files without correction)

The Step 10 "Files to create" section lists:

```
packages/design-system/__snapshots__/coverArt.test.ts.snap (10 golden SVGs, checked in)
packages/design-system/__node-snapshots__/coverArt.node.snap (separate snapshot store)
```

The Step 10 test table uses:

```
packages/design-system/__node-snapshots__/coverArt.test.ts.snap (Node golden store)
packages/design-system/__rn-snapshots__/coverArt.rn.test.ts.snap (RN golden store)
```

Three concrete inconsistencies:
1. The first file listed (`__snapshots__/`) is mentioned nowhere in the test table; it appears to be a rev-0 artifact not removed.
2. The Node-runtime snapshot store is named `__node-snapshots__/coverArt.node.snap` in the files list but `__node-snapshots__/coverArt.test.ts.snap` in the test table (different filename within the same directory).
3. The fixture count in the acceptance criteria says "10 fixed test cases" and "same 10 SVG strings byte-for-byte" — both should say 12 after the F-01 expansion.

The Test Helpers section also says "10 cover-art golden inputs" — this should be 12.

Colby reads "Files to create" first and will create `__snapshots__/coverArt.test.ts.snap`. The tests will write to `__node-snapshots__/coverArt.test.ts.snap`. CI will check in both. T-0005-256a will read the wrong file and fail with "file not found." This is the kind of error that costs half a day.

**Required:** Update Step 10 "Files to create" to match the test table's snapshot paths. Update acceptance criteria fixture count from 10 to 12. Update Test Helpers section to say 12 golden inputs.

---

### NV-2 — Ratio table at end of spec is stale for Steps 4, 7, and 10 (MINOR)

**Severity:** Low

The per-step ratio table at the bottom of the test spec (after the totals table) uses rev-0 numbers for three steps:

| Step | Table says (happy vs. negative) | Actual rev-1 |
|---|---|---|
| 4 | 32 vs. 40 | 50 vs. 40 — table not updated for F-09 |
| 7 | 4 vs. 4 — "Borderline" | 4 vs. 7 — correctly stated in step-specific note |
| 10 | 21 vs. 16 — "Below" | 25 vs. 21 after F-01 expansion |

Step 7 is the most confused: the step-specific note correctly states "4 happy vs. 7 negative — Roz's F-07 closed" but the ratio table says "4 vs. 4 — Borderline." A reviewer reading only the ratio table would conclude F-07 is still open.

**Required:** Update the ratio table's Step 4, 7, and 10 rows to reflect rev-1 counts. No test changes needed.

---

### NV-3 — MT-2 closure created a schema-consistency gap: `Binding<state>.slot` and `initialState` keys use different validation schemas (MATERIAL)

**Severity:** Medium

Cal's MT-2 architectural call: "slot-name length is a shape constraint enforced at Zod parse." He added `SlotNameSchema = z.string().min(1).max(64).regex(/^[a-z][a-zA-Z0-9_]{0,63}$/)` to the `initialState` record key in Step 5.

But Step 2's `Binding<state>` code shape still uses `z.string().min(1).max(64)` — no regex:

```ts
z.object({kind: z.literal('state'), slot: z.string().min(1).max(64)})
```

The result: a spec can contain `Binding<state>` with `slot: '1numericStart'` (fails SlotNameSchema's regex, passes the binding's plain `min(1).max(64)` check) that references an `initialState` key which cannot exist (because `initialState` requires `SlotNameSchema`). Zod parse succeeds on both — the binding parses fine, initialState parses fine with no such key. The cross-reference validator catches the mismatch with `unknown_state_slot`. But the architectural premise of MT-2 ("slot-name length is a shape constraint enforced at Zod parse") is only half-true: length is enforced at parse; regex is not.

This is not catastrophic — the validator catches it — but it violates the principle Cal stated for MT-2 and creates an inconsistency that will confuse Colby when he reads the code shape for Step 2 vs. the Step 5 AC. If the regex is part of the shape contract, both places should use `SlotNameSchema`.

**Required:** Either (a) update Step 2's `Binding<state>` code shape to use `SlotNameSchema` for the `slot` field, closing the consistency gap — or (b) state explicitly in Step 5 ACs and Step 2 Notes for Colby that `Binding<state>.slot` intentionally uses a looser schema (length-only) and the regex is `initialState`-key-only, with a note explaining why. Option (a) is the right call architecturally.

If option (a) is chosen, add a test: `StringBindingSchema.parse({kind: 'state', slot: '1numericStart'})` fails (regex). This should be T-0005-036a or similar, adjacent to T-0005-036 (over-length slot fails).

---

### NV-4 — Grand totals table arithmetic doesn't add up (MINOR)

**Severity:** Low

The grand totals table claims: New=289, Regression=15, Total=308.

289 + 15 = 304, not 308.

The 4-test gap is the breaking-change tests in Steps 2 (3 tests: T-0005-052, T-0005-053, and one more) and Step 4 (1 test: T-0005-140). The table footnotes these as "0 (3 breaking-change)" and "0 (1 breaking-change)" — the breaking tests are neither counted in "New" nor in "Regression," yet they're in the per-step totals. The per-step summaries (which sum to 308) are correct. The grand totals table's New and Regression columns don't account for breaking-change tests.

Breaking-change tests should be counted in "New" for this spec (they're new tests in this ADR; they happen to be breaking-change category). The table needs a third column, or breaking-change tests should be folded into "New."

No test changes required. The per-step counts are correct. The grand totals table just needs arithmetic reconciliation.

---

### NV-5 — T-0005-256 ID collision: base ID used as both an RN golden and a suffix base (MINOR)

**Severity:** Low

T-0005-245..256 covers 12 RN golden tests. T-0005-256 is the twelfth RN golden. T-0005-256a is the cross-runtime SVG-string equality test. T-0005-256b is the CI orchestration test. T-0005-256c is the MT-3 empty-path test.

Three tests use "256" as a base with alphabetic suffixes. This means T-0005-256 (RN golden #12) and T-0005-256a (cross-runtime assertion) share a numeric base but are completely different tests. A reader parsing the ID range `T-0005-245..256` gets T-0005-256 as the last RN golden and then immediately encounters T-0005-256a as a different test category in the same range. It is ambiguous whether T-0005-256a is a variant of the T-0005-256 golden or a separate test that happens to be numbered 256a.

The cleaner approach would be T-0005-257a, T-0005-257b, T-0005-257c for the three cross-runtime/CI tests, shifting the invalid-input tests to T-0005-258+ onward. Or accept the current numbering and add a note explicitly stating that T-0005-256 is the 12th RN golden and T-0005-256a/b/c are independent tests that happen to share the base number due to the insertion.

No revision required, but a one-line note in the test table header for Step 10 would prevent Colby from questioning this.

---

## Category Coverage Table (rev-1)

| Step | Happy | Failure | Boundary | Security | Concurrency | Regression | Breaking | Config |
|---|---|---|---|---|---|---|---|---|
| 1 | COVERED | COVERED | COVERED | N/A | N/A | COVERED | N/A (new) | N/A |
| 2 | COVERED | COVERED | COVERED | COVERED | COVERED | N/A | COVERED | N/A |
| 3 | COVERED | COVERED | COVERED | N/A | N/A | N/A | N/A (new) | N/A |
| 4 | COVERED | COVERED | COVERED | N/A | N/A | N/A | COVERED | N/A |
| 5 | COVERED | COVERED | COVERED | N/A | N/A | COVERED | N/A | N/A |
| 6 | COVERED | COVERED | COVERED | N/A | COVERED | N/A | N/A | N/A |
| 7 | COVERED | COVERED | COVERED | N/A | N/A | COVERED | N/A | COVERED |
| 8 | COVERED | COVERED | N/A | COVERED | N/A | COVERED | N/A | N/A |
| 9 | COVERED | COVERED | COVERED | COVERED | N/A | COVERED | N/A | N/A |
| 10 | COVERED | COVERED | COVERED | COVERED | COVERED | COVERED | COVERED | N/A |

All category gaps from rev-0 have been addressed. Step 1 Security (was MISSING) is now N/A-justified (token enums carry no security surface; the schema level handles XSS via renderer, not schema). This is acceptable.

---

## Failure:Happy Ratio (rev-1 independent count)

Under the parameterized-collapse rule established in rev-0:

| Step | Happy (raw) | Happy (collapsed) | Negative | Holds (collapsed)? |
|---|---|---|---|---|
| 1 | 16 | 4 behavioral | 11 | YES |
| 2 | 7 | 7 | 19 | YES |
| 3 | 5 | 5 | 12 | YES |
| 4 | 50 | 32+6 collapsed binding = 38 | 40 | YES (borderline) |
| 5 | 7 | 7 | 9 | YES |
| 6 | 6 | 6 | 19 | YES |
| 7 | 4 | 4 | 7 | YES |
| 8 | 18 | 5 behavioral | 14+2 | YES |
| 9 | 5 | 3 behavioral | 8 | YES |
| 10 | 25 | 3 collapsed goldens | 21 | YES |

No step fails the hard rule under the collapse rule.

---

## Architectural Call Verdicts

**MT-2 (slot-name length as shape constraint):** Call is conceptually sound — keeping regex validation at the initialState key level is correct. The gap is that the Binding<state>.slot schema should use the same regex to preserve the architectural promise. See NV-3. Call is accepted with the schema-consistency fix required.

**MT-4 (collection self-reference allowed):** Sound. The use case (rep-of tracking in a Workouts collection) is coherent. The validator passes self-reference without a loop because the validator doesn't recurse into seed data — it only checks that referenced IDs exist. Spec authors are correctly warned to break cycles in seed data. The architectural note in Step 3 ACs is adequate.

**MT-5 (theme() returns frozen output):** Sound. `Object.freeze()` on a small token object is trivially cheap. The test verifies both `isFrozen()` and mutation non-propagation (two-call test). This is real safety, not window dressing — it prevents the class of bug where a renderer mutates the returned theme and corrupts all subsequent renders in the same session.

**F-11 (Layer 4 in renderer):** Sound. The §J rationale is the clearest architectural reasoning in the document. Immutable cover-art identity vs. rendering-context chrome is a real seam. T-0005-262's excluded attribute set is now correctly motivated.

---

## CI/CD Verification

New `cover-art-runtime-parity.yml` workflow is documented with correct trigger paths and step sequence. T-0005-256b verifies it via YAML inspection. Adequate.

The Roz CI/CD note from rev-0 (clean-install typecheck) is addressed: Step 1 and Step 8 ACs require `pnpm --filter ... typecheck` to pass, and the workspace `typecheck` job auto-picks up new packages. Adequate.

No new CI surfaces missed.

---

## Documentation Update Assessment

The brief radius patch is correctly deferred to PM (not gating). The canvas-v0.md AC-R4 verb count update is correctly assigned to ADR-0006. Both are tracked in Documentation Impact. Adequate.

---

## Roz's Assessment

Cal closed every P0 and High finding with substantive tests. The F-01 cross-runtime mechanism is the right approach and is now specified precisely enough for Colby to implement. The F-02 codegen guard is at the right surface. The F-03 behavioral coverage rewrite is implementable. The F-04 multi-error tests are adequate. Cal's choice on F-05 (acknowledge the simulation limitation, document the workflow as the production guard) is more honest than trying to fake CI semantics in Jest.

Three issues remain. NV-1 (the Step 10 files section) will cost Colby half a day if not fixed — wrong snapshot paths, wrong fixture count, stale file from rev-0. This is a material error. NV-3 (the MT-2 schema consistency gap) is a design error that will produce confusing behavior: a spec parses successfully but a cross-ref validator error fires because the binding referenced a slot name that fails the initialState key regex. Colby will see this as a validator bug, not a schema inconsistency. NV-2, NV-4, and NV-5 are documentation cleanup — no tests wrong, no implementation direction wrong, just numbers that don't add up and a stale table.

My verdict: **APPROVE WITH NOTES.** NV-1 and NV-3 must be corrected before Colby starts Step 1. NV-2, NV-4, NV-5 can be corrected inline in a follow-up commit, or Cal can fix them in the same pass as NV-1 and NV-3 since it's the same document.

The bones are good. They held. Colby is cleared to start Step 1 once the two material notes land.

---

## Summary Table

| Category | Count | Gates Start? |
|---|---|---|
| Material (must fix before Step 1) | 2 (NV-1, NV-3) | YES |
| Minor / documentation | 3 (NV-2, NV-4, NV-5) | NO |
| P0 findings from rev-0 | 2 — both CLOSED | — |
| High findings from rev-0 | 5 — all CLOSED | — |
| Medium findings from rev-0 | 6 — all CLOSED | — |
| Low findings from rev-0 | 3 — all CLOSED | — |
| Missing tests from rev-0 | 5 — all CLOSED | — |

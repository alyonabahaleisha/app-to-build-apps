# QA Report — ADR-0005 Step 6 (Cross-Reference Validator)

_Reviewed by Roz — 2026-05-08_

## Verdict: PASS WITH NOTES

| Check | Status | Details |
|---|---|---|
| Type Check | PASS | `tsc --noEmit` exits 0. Clean. |
| Tests | PASS | 515/515 pass in `packages/protocol`. |
| All 25 T-IDs present | PASS | T-0005-157..178 + T-0005-174a + T-0005-176a + T-0005-176b all confirmed. |
| 12-code closed enum | PASS | Exactly 12 values; no 13th; `slot_name_too_long` correctly absent. |
| `ValidationError` shape | PASS | `{path: (string\|number)[], message: string, code: ValidationErrorCode}`. Exact. |
| `ValidatorResult` shape | PASS | `{ok: true; spec: Spec} \| {ok: false; errors: ValidationError[]}`. Discriminated union. Exact. |
| 10 named checks / 8 functions / 12 codes | PASS | 8 check functions; each code emitted by at least one function. |
| All-errors-not-first-only contract | PASS | `validateCrossRefs` spreads all 8 check arrays into a single accumulator. No short-circuit. |
| F-03 behavioral hook (T-0005-178) | PASS | `afterAll` asserts `expect(observedCodes).toEqual(expected)` where `expected` is `Set<ValidationErrorCode>` of all 12 values. Genuine behavioral test. |
| F-04 multi-error (T-0005-174a) | PASS WITH NOTES | All 4 categories surface. Assertion uses `>= 4` not `=== 4`. See NOTE-1. |
| F-04 multi-subtree (T-0005-176a) | PASS | Both errors surface with exact paths. |
| F-15 action-level path (T-0005-176b) | PASS | Path verified correct by trace. |
| State slot auto-derivation | PASS | T-0005-163 exercises the auto-derivation case. |
| MAX_NESTING_DEPTH source | PASS | Imported from `./components/index.js`; not redeclared. |
| Nesting boundary | PASS | `depth > MAX_NESTING_DEPTH` correct; depth 8 passes, 9 fails. |
| Duplicate-id cross-namespace | PASS | All three cross-namespace collision types covered. |
| Multiple errors same code | PASS | No deduplication anywhere. |
| Path correctness | PASS | Three deep paths verified by manual trace. |
| No scope creep | PASS | No codegen, no design-system, no Step 7+ files. |
| Workspace imports | PASS | Only sibling protocol files + `zod`. |
| ESM `.js` extensions | PASS | All intra-package imports correct. |
| `console.log` | PASS | None. |
| `index.ts` re-exports | PASS | Step 6 exports reachable from package root. |
| Cardinality tripwires | PASS WITH NOTES | 12-code length + set-size check. Belt-and-suspenders is appropriate. |
| Security | PASS | Pure function. File-level comment correctly flags message/path as internal-only. |

---

## Issues Found

### NOTE-1 — T-0005-174a assertion weakened below ADR spec (non-blocking; fix before Step 7 closes)

**File:** `packages/protocol/src/validate.test.ts`, line 627

**ADR says:** `result.errors.length === 4` and codes set equals `{'duplicate_id', 'unknown_collection', 'nesting_too_deep', 'seed_field_extra'}`.

**Colby wrote:** `expect(result.errors.length).toBeGreaterThanOrEqual(4)`. Codes checked individually with `.has()` but not as exact set.

By tracing the spec, exactly 4 errors fire — but `>= 4` would pass even if 6 errors fired. The ADR's exact-count requirement exists precisely to catch a regressor that produces spurious additional errors. The comment in the test acknowledges the discrepancy.

**Recommendation:** Change to `expect(result.errors.length).toBe(4)` and add `expect(codes).toEqual(new Set(['duplicate_id', 'unknown_collection', 'nesting_too_deep', 'seed_field_extra']))`.

### NOTE-2 — F-03 comment inaccuracy (cosmetic)

**File:** `packages/protocol/src/validate.test.ts`, line 19

Comment says "Every validateCrossRefs() call in this file goes through record()." Actual: T-0005-177 (purity test) calls validateCrossRefs directly without `record()`. The afterAll hook still passes because `unknown_collection` is already covered elsewhere. But the comment misleads.

**Recommendation:** Amend comment to note T-0005-177 is an exception.

### NOTE-3 — Internal check numbering inconsistency (cosmetic)

**File:** `packages/protocol/src/validate.ts`

File header says "10 named checks" (matches ADR). Internal section comments number checks 1–11 because seed data was split into three sub-checks. Cosmetic.

### NOTE-4 — T-0005-164 ADR description vs implementation (semantic note for Cal)

**ADR T-0005-164:** "`seed_field_missing`: seed row missing a required field"

**Implementation:** `seed_field_missing` fires for any missing field (required or not). T-0005-164 uses a non-required field. This is a better interpretation and matches the disambiguation in the rev-2 ADR. The ADR description should say "row missing a known field (required or not)." ADR errata, not a code bug.

---

## F-03 / F-04 / F-15 Closure Verification

**F-03 CLOSED.** `afterAll` accumulates `ValidationErrorCode` values into `observedCodes: Set<ValidationErrorCode>` across every `record(validateCrossRefs(...))` call returning `ok: false`. On suite completion asserts `expect(observedCodes).toEqual(expected)` with all 12 values. Jest's `toEqual` on Sets checks deep structural equality. A missing code fails. A code that exists in the enum but is never exercised would cause the assertion to fail. This is a genuine behavioral coverage test, not a shape inspection.

**F-04 CLOSED with NOTE-1 caveat.** Both T-0005-174a (4 simultaneous violations) and T-0005-176a (errors at depth 5+ on two subtrees with exact paths) pass. The `>= 4` weakening in T-0005-174a is real but does not constitute a behavioral failure.

**F-15 CLOSED.** T-0005-176b path verified by trace through `extractNodeActions` and `checkActionCollectionRef`.

---

## Ruling on Colby's Open Question: Interpretation A is correct

`seed_field_missing` and `seed_required_missing` co-fire on the same absent required field. The two codes describe orthogonal violations:

- `seed_field_missing` answers "which field keys are absent from this row?"
- `seed_required_missing` answers "which required constraints are violated?"

A required field that is absent satisfies both questions simultaneously. Consumers can filter by code semantically.

Interpretation B would produce information loss and an awkward asymmetry at the boundary (callers handling `seed_field_missing` would need to know that some missing fields are hidden behind `seed_required_missing`).

**Verification of Colby's implementation:** `checkSeedData` has two independent loops. The first iterates over all `fieldNames` and fires `seed_field_missing` for any field key absent regardless of `required`. The second iterates over `requiredFields` and fires `seed_required_missing` for any required field absent. Implementation matches Interpretation A.

**Test coverage of co-firing:** T-0005-166 verifies `seed_required_missing` fires but does not assert `seed_field_missing` co-fires on the same case. Mild gap; future regressor making the codes mutually exclusive would not be caught. Adding an assertion in T-0005-166 that `result.errors.map(e => e.code)` contains both codes would close it. Not a gate.

---

## Path Correctness Spot-Check

Three deep-path assertions verified by manual trace through `walkNodes` → `extractNodeActions` → error construction. All paths exact.

---

## ESM / CLAUDE.md Compliance

All clean. ESM extensions, no workspace deep imports, no console.log, type-only imports where runtime values aren't needed.

---

## Notes for Step 7 (Codegen)

1. **T-0005-174a tightening.** Fix `>= 4` to `=== 4` and add exact set equality before closing Step 6. Surgical.
2. **Co-firing coverage.** Optional: add an assertion in T-0005-166 confirming `seed_field_missing` co-fires on a required absent field. Documents Interpretation A.
3. **Codegen (Step 7) can proceed.** `validateCrossRefs` API surface is stable. `gen-json-schema.ts` consumes `SpecSchema` (unchanged). The validator is not in the codegen pipeline.
4. **`initialScreenId` validation reminder.** §G check #5 lives in `SpecSchema.superRefine`, not in `validateCrossRefs`. Step 7 should not introduce a duplicate check.

### CI/CD Verification Required: No

### Documentation Update Required: No

---

## Roz's Assessment

The implementation is solid. Eight check functions covering twelve codes, all-errors accumulation contract enforced, correct path construction on deep trees, and a genuine behavioral coverage hook that would actually catch a missing code at runtime. The F-03 afterAll with set equality is exactly what was specified and exactly what a behavioral coverage test should look like.

Two findings worth Cal's eyes: the weakened `>= 4` assertion in T-0005-174a is a deferred decision, not a judgment error. Make it exact before this step is called done. The false comment at line 19 is routine cleanup.

The Interpretation A ruling on seed codes is correct. The ADR's brief description at T-0005-164 ("missing a required field") is the loose end — that belongs in an ADR note, not in Colby's code.

For Step 7: proceed. Fix T-0005-174a before closing Step 6 as complete.

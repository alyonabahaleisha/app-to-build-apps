# QA Report — ADR-0005 Steps 2 + 3 (Binding/Actions + Collection)

_Reviewed by Roz — 2026-05-08_

## Verdict: PASS WITH NOTES

| Check | Status | Details |
|---|---|---|
| Type Check | PASS | `pnpm --filter @app-creator/protocol typecheck` exits clean |
| Tests | PASS | 192/192 passed across 7 suites; 0 failed |
| Coverage | N/A | Protocol package is pure schema; 192 tests exercise every branch |
| Complexity | PASS | All files well under 300 lines; no nesting >3; no functions >50 lines |
| DB Migrations | N/A | Protocol package has no DB layer |
| Security | PASS | Pure schema package; no PII, no sensitive fields, no injection surfaces. `normalizeRow` retro lesson N/A here |
| CI/CD Compat | N/A | No auth, RBAC, env vars, or middleware touched |
| Docs Impact | N/A | No endpoints, CLI commands, or user-visible behavior changed |
| Dependencies | PASS | No new deps; `zod` and `./enums.js`/`./binding.js` are the only imports |
| Scope Creep | PASS | No `spec.ts`, no `validate.ts`, no `components/`, no `design-system/`, no codegen artifacts |

---

## Per-AC Verification — Step 2 (Binding + Actions)

**AC: `SlotNameSchema` exported from `binding.ts`, not `enums.ts`** — Confirmed. `binding.ts` line 8 declares and exports it. `enums.ts` contains no such declaration. Step 1 QA note honored.

**AC: `SlotNameSchema` closes NV-3 / MT-2 — slot reference uses regex + length constraint at parse time** — Confirmed. All five `Binding<*>.state` branches use `SlotNameSchema` at the `slot:` field (binding.ts lines 26, 38, 50, 63, 75). T-0005-036a parameterized test exercises all five.

**AC: 5 `Binding<T>` schemas implemented as 3-branch discriminated unions** — Confirmed. Each schema has `literal`, `state`, `collectionField` branches.

**AC: 12-verb `ActionSchema` discriminated union; `share` absent** — Confirmed. `ACTION_VERB_COUNT = 12`. `share` appears only in comments. Grep returns zero schema code.

**AC: Every verb schema uses `.strict()`** — Confirmed. 12 `.strict()` calls in `actions.ts`, one per verb.

**AC: `aiProcess.task` is `z.literal('summarize')`** — Confirmed.

**AC: `ToneSchema`, `BindingValueSchema` imported, not redefined** — Confirmed.

**AC: Verified 12 verbs are exactly `set, update, reset, addItem, removeItem, updateItem, clearCollection, navigate, back, capture, toast, aiProcess`** — Confirmed against ADR §D.

---

## Per-AC Verification — Step 3 (Collection)

**AC: `FieldTypeSchema` is a full `z.discriminatedUnion` on `type` with 6 variants** — Confirmed. `'array'`, `'json'` rejected.

**AC: `reference` variant carries `targetCollectionId`** — Confirmed.

**AC: MT-4 — self-referential collections allowed at schema level** — Confirmed. T-0005-057a passes.

**AC: `CollectionFieldSchema` field name regex `^[a-z][a-zA-Z0-9_]{0,63}$`** — Confirmed.

**AC: `CollectionSchema` id regex same** — Confirmed.

**AC: Size bounds — fields 1–20, seedData 1–50** — Confirmed.

**AC: `SyncModeSchema` imported from `enums.ts`, not redefined** — Confirmed.

**AC: Cross-ref validator (Step 6) NOT invoked at schema parse** — Confirmed.

---

## Per-Test-ID Checklist — All 45 T-IDs

**Step 2 — Binding (12 IDs):** T-028..037 + T-036a — all present.
**Step 2 — Actions (17 IDs):** T-038..054 — all present, including T-039 (share rejection), T-040 (cardinality), T-047 (.strict() check), T-052/053 (legacy verb breaking-change).
**Step 3 — Collection (17 IDs):** T-055..069 + T-057a + T-064a — all present, including T-064a hard performance assertion (`Date.now()` delta < 500ms; actual ~2ms).

All 45 T-IDs present. No IDs missing.

---

## Critical Schema Decision Verification

1. **`share` absence at every surface** — VERIFIED. Source clean; T-0005-039 explicit rejection.
2. **`SlotNameSchema` placement in `binding.ts`** — VERIFIED. `enums.ts` does not contain it; all 5 binding state branches reference by name.
3. **`.strict()` on all 12 verb schemas** — VERIFIED. T-0005-047 exercises `back` and `reset` extra-param rejection.
4. **MT-4 self-reference allowed at schema** — VERIFIED. No constraint on `targetCollectionId === id`. T-0005-057a confirms.
5. **MT-3-pattern T-0005-064a performance bound** — VERIFIED. Hard `Date.now()` assertion, not soft comment.

---

## ESM / CLAUDE.md Compliance

- All intra-package imports use `.js` extensions. VERIFIED.
- No `@app-creator/*` workspace deep imports. VERIFIED.
- No `console.log`. VERIFIED.
- Naming conventions: `SCREAMING_SNAKE_CASE` for `ACTION_VERB_COUNT`, `COLLECTION_FIELD_NAME_REGEX`, `COLLECTION_ID_REGEX`; `PascalCase` for schema names. VERIFIED.
- `binding.ts` imports only `zod`. `actions.ts` imports `zod` + `./enums.js` + `./binding.js`. `collection.ts` imports `zod` + `./enums.js`. All clean.

---

## Pre-Existing Failure Scoping

The `a2ui-renderer` Toggle test referenced in the Step 1 QA report now passes (13/13). It was pre-existing at Step 1 and remains unaffected by Steps 2/3. The `services/api` Docker concern is orthogonal and not exercised by any test in scope.

No new pre-existing failures introduced.

---

## Issues Found

**NOTE-1 — Misleading "at max" label in T-0005-049 (test description mismatch)**

`actions.test.ts` line 168: the describe label says "toast accepts long message with valid tone" and the ADR test table says "succeeds at max." However `ToastActionSchema` has only `z.string().min(1)` on `message` — there is no maximum constraint. A future reader may incorrectly infer that a 201-character message would fail. It will not. The test result is correct (200 chars parses), but the label implies a bound that does not exist.

**Owner: Cal** (ADR test description) / **Colby** (test label). Neither blocks Step 4. Flag for ADR errata.

**NOTE-2 — Misleading comment on `update` verb in `actions.ts` lines 18–19**

Lines 18–19 say `update` is "alias for updateItem at the action level; 'update' is the general verb, 'updateItem' is the named alias." This framing is inverted and factually incorrect. The ADR defines both as separate, independent entries in the 12-verb discriminated union. They happen to share the same parameters but carry distinct `type` literals. A renderer can receive either. There is no aliasing relationship. The comment will mislead anyone reading the schema in isolation.

**Owner: Colby.** Does not affect runtime. Flag for correction before Step 4 (the renderer ADR will consume these verb types).

**NOTE-3 — T-0005-037 sub-test split (Colby's note)**

Colby expanded the ADR's single T-0005-037 entry into 4 sub-tests in one describe block. This is acceptable. The ADR specifies the behavior ("each binding type's literal variant parses"); Colby structured the test for clarity. Cal should acknowledge this in the ADR test-table note column if he wants the split documented, but it does not gate Step 4.

**NOTE-4 — `index.test.ts` does not cover Step 2/3 exports from the package root**

`index.test.ts` tests Step 1 exports only (tokens, enums, canonicalize). The new `SlotNameSchema`, `ActionSchema`, `ACTION_VERB_COUNT`, `CollectionSchema`, etc. are reachable from `./index.js` (confirmed in `index.ts`) but have no smoke assertion in `index.test.ts`. If a future refactor accidentally drops a re-export, no index-level test will catch it. The per-module tests import from the sibling file directly, not from the index — so an `index.ts` re-export drop would be silent at this test layer.

**Recommended:** add one `it('exports SlotNameSchema, ActionSchema, ACTION_VERB_COUNT, CollectionSchema from index')` smoke to `index.test.ts`. Low effort, high tripwire value. Not a blocker for Step 4.

---

## CI/CD Verification Required: No

## Documentation Update Required: No

---

## Roz's Assessment

192 tests pass. All 45 T-IDs are present and correctly implemented. The three critical invariants — `share` absence, `SlotNameSchema` in `binding.ts`, `.strict()` on all 12 verb schemas — are confirmed at both the source and the test layer. MT-4 self-reference and T-0005-064a's hard performance assertion are both correctly implemented.

The implementation is clean. No scope creep, no workspace violations, no `console.log`, proper ESM imports throughout. Colby's T-0005-037 split into 4 sub-tests is sensible test organization, not a deviation.

The two notes worth attention before Step 4 are: the `update`-as-alias comment (NOTE-2) which will confuse anyone implementing the renderer's dispatcher if they read the schema comments, and the missing index smoke for new exports (NOTE-4). Neither gates Step 4, but the comment correction should happen before ADR-0006 imports these types.

T-0005-049's "at max" label is an ADR authoring artifact that has faithfully propagated into the test. It is not Colby's error. Cal owns the errata.

**Step 4 may proceed.**

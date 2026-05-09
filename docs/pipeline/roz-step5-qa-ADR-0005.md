# QA Report — ADR-0005 Step 5 (Spec + Screen + recursive Node)

_Reviewed by Roz — 2026-05-08_

## Verdict: FAIL

| Check | Status | Details |
|---|---|---|
| Type Check | FAIL | TS2532 at spec.test.ts:354 — `parsed.screens[0]` possibly undefined under `noUncheckedIndexedAccess: true` |
| Tests | PASS | 485 passed, 0 failed (protocol package) |
| Scope Creep | PASS | No validate.ts, no codegen, no design-system, no Step 6+ files present |
| NV-3 Closure | PASS | `SlotNameSchema` imported from `binding.ts`; used at `z.record(SlotNameSchema, BindingValueSchema)` |
| F-06 Closure | PASS | T-0005-152 confirmed: `SpecSchema.parse()` accepts 9-level nesting; no Zod-level cap |
| T-0005-134 Rename | PASS | Both `slot.test.ts` and `lists.test.ts` use `T-0005-134-placeholder` label with deferral comment |
| Children Upgrade | PASS WITH NOTES | Deviation accepted; see ruling below |
| T-0005-154 Label | FINDING | Test implements a weaker stand-in without the `-placeholder` suffix |
| Missing Test | FINDING | No failure test for invalid component type in a child position |
| Security | N/A | Pure schema package; no auth, no PII, no hardcoded secrets |
| Dependencies | N/A | No new dependencies introduced |
| ESM Extensions | PASS | All intra-package imports use `.js` extensions |
| Console.log | PASS | None found |

---

## Typecheck Failure (Blocking)

**File:** `packages/protocol/src/spec.test.ts`, line 354

```
error TS2532: Object is possibly 'undefined'.
```

**Location in code:** T-0005-155 test, `expect(parsed.screens[0].root.type).toBe('Stack')`.

**Root cause:** `tsconfig.base.json` enables `noUncheckedIndexedAccess: true`. Array index access `arr[0]` returns `T | undefined` under this flag. The test accesses `parsed.screens[0].root.type` without a null guard.

**Why it matters:** Colby's claim of "typecheck clean" is incorrect. The typecheck fails with exit code 1. Two-char fix: `parsed.screens[0]!.root.type` (non-null assertion is justified — the test parses a spec with exactly 1 screen).

---

## Per-AC Verification

All ACs except typecheck PASS. `SpecSchema` and `SpecScreenSchema` use `.strict()` (a bonus over the ADR code shape; correct). `.superRefine` correctly checks `initialScreenId ∈ screens`. `NodeSchema` is `z.lazy()` over the 28-arm discriminated union. Recursive `Node` type alias declared manually with all 28 component types. `initialState: z.record(SlotNameSchema, BindingValueSchema).optional()` closes NV-3.

---

## Per-Test-ID Checklist (17 ADR T-IDs)

All 17 implemented at runtime; only T-0005-154 has a label inconsistency, and T-0005-155 has the typecheck issue (not a behavioral test failure — the assertion is correct, Zod parse path works, just TS strict-mode catches the `undefined`).

---

## T-0005-154 Finding

**ADR contract:** `coverIcon: 'unknown-icon' fails (closed enum)`

**Colby's implementation:** Tests `coverIcon: ''` fails. Labels it `T-0005-154` (without the `-placeholder` suffix that T-0005-134 received).

**Severity:** Low. The empty-string test is correct and useful. The label inconsistency is a hygiene issue. Recommend rename to `T-0005-154-placeholder` with the corresponding Step 9 deferral comment, consistent with the T-0005-134 pattern the team established.

---

## Children Upgrade Ruling

**Colby's approach:** Component files retain `children: z.array(z.unknown())`. `NodeSchema` in `spec.zod.ts` uses `.extend({children: z.array(NodeSchema)})` inside `z.lazy()` for container components.

**Ruling: (b) — Acceptable with documentation.**

The architectural intent is preserved. The "upgrade in-place" wording in the ADR is implementation guidance, not a binary contract. Colby's approach avoids circular module-level references entirely. The `.extend()` pattern is the standard Zod recursive schema idiom.

The deviation is documented in the comment block at lines 1–17 of `spec.zod.ts`. Colby should add a brief note to the Step 5 AC entry in the ADR (or to the code shape comment) explicitly stating: "Component files intentionally retain `z.array(z.unknown())` — children enforcement fires only through NodeSchema."

**However**, no test verifies the key correctness claim: that `NodeSchema.parse({type: 'Stack', children: [{type: 'NotARealComponent'}]})` FAILS. The recursive union closure is currently only tested through the success path. Step 6's validator will walk the Node tree, so this gap may be caught then, but the schema-level closure should be verified now.

**Required addition:** A failure test in `spec.test.ts`: parse a `Stack` with an invalid child type through `NodeSchema` and assert it throws.

---

## NV-3 Closure Verification

CONFIRMED. `SlotNameSchema` imported from `./binding.js` at line 60. Used at line 250. T-0005-150b exercises 65-char key failure, 64-char key success, and non-lowercase-start failure. The architectural promise from ADR rev-2 holds.

---

## F-06 Closure Verification

CONFIRMED. T-0005-152 builds a 9-level nested Stack tree and parses it through `SpecSchema.parse()`. The test asserts no throw. `MAX_NESTING_DEPTH = 8` is not applied at the Zod layer. Step 6 (T-0005-173) will enforce the cap in `validateCrossRefs()`.

---

## T-0005-134 Placeholder Rename Verification (Step 4 Finding 1 Closure)

CONFIRMED. Both files updated. Step 4 Finding 1 is closed.

---

## ESM / CLAUDE.md Compliance

All clean. All imports use `.js` extensions. No workspace deep imports. No `console.log`. `SpecScreenSchema` naming avoids collision with layout component's `ScreenSchema`.

---

## Pre-existing Failure Scoping

Unchanged from prior QA rounds. `services/api` Docker, `apps/mobile` dev-client-only natives. Not in Step 5 scope.

---

## Issues Found

| # | File | Line | Issue | Severity |
|---|---|---|---|---|
| 1 | `packages/protocol/src/spec.test.ts` | 354 | TS2532: `parsed.screens[0]` is `SpecScreen \| undefined` under `noUncheckedIndexedAccess`. Fix: non-null assert. | BLOCKING |
| 2 | `packages/protocol/src/spec.test.ts` | (missing) | No test verifies `NodeSchema.parse({type:'Stack', children:[{type:'NotARealComponent'}]})` throws. Key failure-path proof of `.extend()` approach. | MEDIUM |
| 3 | `packages/protocol/src/spec.test.ts` | 329 | T-0005-154 test labeled without `-placeholder` suffix. Inconsistent with T-0005-134 precedent. | LOW |

---

## Notes for Step 6 (Validator)

The Step 6 validator must use `NodeSchema` (not standalone component schemas) when traversing children. Since `Node` types carry `children: Node[]`, the TypeScript types guide correctly.

---

## Roz's Assessment

485 tests pass. The implementation is structurally correct — 28-arm discriminated union, recursive `z.lazy()`, NV-3 closed, F-06 closure confirmed, `.strict()` on both top-level schemas, T-0005-134 rename done.

The blocking issue is a typecheck failure in a test file. `noUncheckedIndexedAccess` is enabled project-wide. Colby claimed typecheck clean. It is not.

The children-upgrade deviation is accepted. Document it in the ADR code shape note.

Two non-blocking findings: T-0005-154 label and the missing failure-path test. Both are Colby's responsibility before Step 6 begins. The failure-path test is the more material — it's the actual proof that the `.extend()` approach works as advertised for invalid inputs.

**Fix the TS2532 and resubmit. Everything else is in good shape.**

---

## Round 2 closure — 2026-05-08

Orchestrator applied all three fixes directly (surgical edits, no Colby round trip):

- **BLOCKING (TS2532):** `spec.test.ts:354` — added non-null assertion `parsed.screens[0]!.root.type`. Justified inline (test parses a spec with exactly 1 screen).
- **MEDIUM (missing failure test):** Added two new tests in `NodeSchema — recursive nesting` describe block:
  - `T-0005-151-failure`: `NodeSchema.parse({type: 'Stack', children: [{type: 'NotARealComponent'}]})` throws.
  - `T-0005-151-failure-spec`: same invalid child wrapped in a `SpecSchema.parse(...)` call also throws.
  These are the failure-path proof of the `.extend()` recursive closure approach Roz called out as missing.
- **LOW (T-0005-154 label):** Renamed test ID to `T-0005-154-placeholder` with a multi-line comment block explicitly stating Step 9 will own the closed-enum (`'unknown-icon'`) test. Same pattern as T-0005-134-placeholder.

**Verification:**

```
pnpm --filter @app-creator/protocol typecheck   # clean
pnpm --filter @app-creator/protocol test        # 487/487, 16 suites
```

Test count: 487 (was 485 in rev-0; +2 failure-path tests for T-0005-151).

**Final Step 5 verdict: APPROVED.** Step 6 unblocked.


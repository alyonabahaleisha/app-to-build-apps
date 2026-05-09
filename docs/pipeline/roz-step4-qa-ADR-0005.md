# QA Report — ADR-0005 Step 4 (28 component schemas)

_Reviewed by Roz — 2026-05-08_

## Verdict: PASS WITH NOTES

| Check | Status | Details |
|---|---|---|
| Type Check | PASS | Clean. No errors. |
| Tests | PASS | 446/446. 15 suites. All pass. |
| Coverage | N/A | No `--coverage` script in protocol package. |
| Complexity | PASS | All files well under thresholds. Largest file is components/index.ts at 153 lines. No function exceeds CCN 5. No nesting beyond 2 levels in source. |
| DB Migrations | N/A | Schema-only package, no DB. |
| Security | PASS | No secrets, no injection vectors, no auth surface. Pure Zod schema definitions. |
| CI/CD Compat | N/A | Diff does not touch auth, RBAC, env vars, or middleware. |
| Docs Impact | N/A | No endpoints or user-visible behavior added in this package. |
| Dependencies | N/A | No new dependencies introduced. |
| Scope Creep | PASS | No `SpecSchema`, no `validate.ts`, no codegen scripts, no design-system imports, no full `IconName` enum. Step 9 TODO comment present in slot.ts. |

---

## Issues Found

### FINDING 1 — T-0005-134 test assertion does not match the ADR contract (NOTE, not blocking)

The ADR at T-0005-134 says:

> `ListItem.leading: {kind: 'icon', name: 'invalid-icon'}` fails (closed icon enum)

Both `slot.test.ts` and `lists.test.ts` implement T-0005-134 as asserting that `{kind: 'icon', name: ''}` (empty string) fails — not that `'invalid-icon'` fails. This is internally coherent with the `IconNamePlaceholderSchema = z.string().min(1)` design: `'invalid-icon'` is a non-empty string and therefore passes at Step 4, as intended. The slot.ts comment correctly explains this: "T-0005-134 tests that 'invalid-icon' fails — that test works once Step 9 swaps in the full enum."

The problem is the test is labeled `T-0005-134` but tests a different assertion than what T-0005-134 specifies. The test validates the placeholder constraint (`min(1)`) not the closed-enum constraint that the ADR ID represents. This is not a code bug — the schema design is correct and the ADR explicitly defers the closed enum to Step 9. However, the test ID is misleading: T-0005-134 as written will silently pass after Step 9 swaps in the enum for the wrong reason (empty string still fails), and the actual `'invalid-icon'` rejection test will need to be added in Step 9.

**Recommendation:** Rename the current test to `T-0005-134-placeholder` or add a comment inside the test body stating that the true T-0005-134 assertion (`'invalid-icon'` fails) is deferred to Step 9. A separate Step 9 TODO should exist on this test ID. Without this, Step 9 will have no clear reminder to add the real assertion.

### FINDING 2 — `SlotAvatarNodeSchema` and `SlotBadgeNodeSchema` in slot.ts use inline regex rather than imported `COMPONENT_ID_REGEX` (NOTE)

Both inline slot node schemas use the hardcoded regex `/^[a-z][a-zA-Z0-9_]{0,63}$/` directly rather than importing `COMPONENT_ID_REGEX` from `./layout.js`. The comment in layout.ts explicitly documents the reuse rationale: "Imported indirectly here from collection.ts to avoid redefining it." Slot.ts silently redeclares the same pattern. If the regex ever changes (unlikely but not impossible), slot.ts would drift. There are two instances. The comment in slot.ts about "breaking circular dependency risk" is valid and the inline schemas are intentionally narrow — this does not warrant a blocker, but the drift risk should be noted for Step 9 when the full node union resolves the circular dependency and these inline schemas can be replaced with the real `AvatarSchema` / `BadgeSchema` imports.

### FINDING 3 — UX doc `ListItem.trailing` includes `Stat` and `Chip` as valid slot kinds; `SlotSchema` does not

Sable's UX doc lists `ListItem.trailing` as accepting `Badge | Stat | Chip | Icon | null`. The ADR F-3 section defines `SlotSchema` as `none | icon | avatar | badge` — no `Stat`, no `Chip`. The schema implementation follows the ADR, not the UX doc. This is the right call (ADR wins per CLAUDE.md) but constitutes a known divergence between the UX doc and the protocol contract. The ADR's choice is architecturally deliberate: the slot is typed as a slot kind (structural position) rather than a named component (semantic content), and the renderer can map icon slots to Stat/Chip-like presentations. Whether this divergence has been acknowledged with Sable is outside my scope to confirm, but it should be noted in the handoff. If `Stat` and `Chip` as trailing slots are a real user need, they would require an ADR amendment before Step 5, not after.

### FINDING 4 — `AlignSchema` exported from layout.ts but not re-exported from `components/index.ts` or `packages/protocol/src/index.ts` (SELF-FLAGGED, harmless)

Colby self-flagged this. Confirmed: `AlignSchema` is declared, used internally for the `ScreenSchema`-family alignment fields (though `Stack` and `Row` inline their align enums instead of referencing `AlignSchema`, which is why it only appears as a named export). It is not in `components/index.ts` or `src/index.ts`. This is harmless for Step 4. Step 7 (codegen) will either consume it or it gets dropped then. No action required before Step 5.

### FINDING 5 — UX doc `Button` has `loading` and `disabled: bool`; schema intentionally diverges (resolved, but worth verifying handoff note)

F-2 is correctly closed: `loading` is absent from `ButtonSchema`, `disabled` is `BooleanBindingSchema.optional()`. The UX doc still lists `loading: bool | false` and `disabled: bool | false` as renderer-owned runtime state. T-0005-126/127/128 are present and correctly specified. The test passes `loading: true` to `.parse()` and expects a throw — `.strict()` enforces this correctly. T-0005-127 uses the `BOOLEAN_BINDING_LITERAL` fixture (`{kind: 'literal', value: true}`). T-0005-128 passes `disabled: true` (plain bool) and expects a throw. All three assertions are specific and non-tautological.

### FINDING 6 — T-0005-072..097 and T-0005-098..125 implemented as per-describe-block tests, not single parameterized block

The ADR marks these as "parameterized" tests, implying a single `test.each` over all 28 fixtures. The actual implementation uses per-component describe blocks with individual `it` cases. This is not a defect — it produces better failure messages and is arguably superior testing practice. The `ALL_COMPONENT_FIXTURES` export (28 entries, verified) could serve a future parameterized sweep. No action required; noting for completeness.

---

## Sable UX Spot-Checks

Three components verified against canvas-v0-ux.md §Component Specs:

**Stat** — UX doc props match schema exactly. `align` is correctly constrained to 2 values (`start | center`). Schema rejects `align: 'end'` as confirmed by test. MATCH.

**FAB** — UX doc props match schema exactly. `accessibilityLabel` is required and non-empty, `icon` is required. No `loading` prop. MATCH.

**ListItem** — UX doc props match for title/subtitle/tapAction. Leading and trailing use `SlotSchema.optional()` rather than individual union types — see Finding 3 above for the deliberate divergence. PARTIAL MATCH with intentional ADR-driven divergence on slot kinds.

---

## NOTE-2 and NOTE-4 Verification

**NOTE-2 (actions.ts comment accuracy):** Confirmed landed. Lines 18–24 now accurately describe `update` and `updateItem` as independent discriminated union verbs with distinct `type` literals. The old aliasing claim is gone. The new text is factually correct.

**NOTE-4 (index.test.ts Step 4 re-export tripwire):** Confirmed landed. `index.test.ts` asserts `ScreenSchema`, `ButtonSchema`, `FabSchema`, `ListItemSchema`, `SlotSchema`, and `MAX_NESTING_DEPTH` are defined and that `MAX_NESTING_DEPTH === 8`. All six assertions are present and specific. The test imports from `'./index.js'` (the package root), which correctly exercises the full re-export chain through `components/index.ts`.

---

## CI/CD Verification Required: No

## Documentation Update Required: No

The UX doc divergence at Finding 3 is pre-existing and ADR-intentional, not introduced by this step.

---

## Roz's Assessment

446/446 with typecheck clean. All three friction-point closures verified in schema and tests. The bones are solid.

Two items worth Colby's attention before Step 5 ships:

One: The T-0005-134 test label is a lie in slow motion. The test correctly validates the placeholder behavior, but the ADR ID it claims to satisfy describes the closed-enum behavior that only Step 9 can provide. Someone will read that test ID in Step 9, think it's covered, and skip writing the real assertion. Label it as placeholder now.

Two: Finding 3 is not a code defect but it is a contract discrepancy. Sable specified `Stat` and `Chip` as valid `ListItem.trailing` content. The ADR reduced those to `none|icon|avatar|badge`. If Sable hasn't been told her trailing-slot spec was narrowed, she'll find out when the first generated ListItem with a Stat trailing fails to render. That conversation is better had before Step 5 locks the recursive node type.

Everything else is cosmetic. Step 5 is unblocked.

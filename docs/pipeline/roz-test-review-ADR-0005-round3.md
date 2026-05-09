# Roz Test-Spec Review — ADR-0005 (rev-2)

**Reviewed by Roz** | **Date:** 2026-05-08 | **Round:** 3 (rev-2 verification)

---

## Verdict: APPROVE WITH NOTES

Four of the five NV-* findings are cleanly closed. One material residual gap found: the Step 5 code shape still uses `z.string()` as the `initialState` record key, contradicting both the Step 5 AC prose and the NV-3 fix description. The AC text is correct; the code block is not. This is a one-line fix in a single code shape block. It does not change the test contract — T-0005-150b and T-0005-036a remain correct as written. It only affects what Colby implements, which is the point.

Everything else held.

---

## Finding-by-Finding Closure Verification (NV-* only)

### NV-1 — Step 10 file paths and fixture counts: CLOSED

Verification:

- Step 10 "Files to create" now lists: `__node-snapshots__/coverArt.test.ts.snap` (12 Node golden SVGs) and `__rn-snapshots__/coverArt.rn.test.ts.snap` (12 RN golden SVGs). The stale `__snapshots__/` artifact is gone.
- The test table at T-0005-233..244 references `packages/design-system/__node-snapshots__/coverArt.test.ts.snap`. T-0005-245..256 references `packages/design-system/__rn-snapshots__/coverArt.rn.test.ts.snap`. Both match "Files to create" byte-for-byte.
- AC text: "Same inputs → byte-identical output across **12 fixed test cases**" and "Both runtimes produce the same **12 SVG strings** byte-for-byte." Both say 12.
- Test Helpers: "**12 cover-art golden inputs** (one per (stance, palette) combination per F-01 expansion)." Says 12.

Closed. No further action.

---

### NV-2 — Stale ratio table for Steps 4, 7, 10: CLOSED

The per-step ratio table shows:

- Step 4: 50 vs. 40 (was 32 vs. 40). Correct.
- Step 7: 4 vs. 7 with explicit "F-07 closed" annotation. Correct. The contradiction between the step-specific note and the ratio table that I flagged is resolved.
- Step 10: 25 vs. 21 (was 16). Correct.

The behavioral-collapse rule is annotated inline for Steps 1, 4, 8, and 10 where raw counts invert. This is sufficient.

Closed.

---

### NV-3 — `Binding<state>.slot` and `initialState` keys schema consistency: PARTIALLY CLOSED

What was fixed:

- `SlotNameSchema` is declared in the Step 2 narrative and code shape with the full regex `z.string().min(1).max(64).regex(/^[a-z][a-zA-Z0-9_]{0,63}$/)`.
- Step 2 `StringBinding` discriminated union now references `SlotNameSchema` for the `slot` field. The comment in the code shape ("// Shared with Spec.initialState keys (Step 5) — closes NV-3 / MT-2.") is present.
- Step 2 ACs include: "**`SlotNameSchema` exported from `binding.ts`** and used by both `Binding<*>.slot` (this step) and `Spec.initialState` keys (Step 5)."
- T-0005-036a is present in the Step 2 test table and specifies parameterization across all 5 binding types (`StringBinding`, `NumberBinding`, `BooleanBinding`, `DateBinding`, `ImageBinding`) with `slot: '1numericStart'`.

What was missed:

The Step 5 `SpecSchema` **code shape** still reads:

```ts
initialState: z.record(z.string(), BindingValueSchema).optional(),
```

The Step 5 **AC prose** correctly reads:

```
initialState?: z.record(SlotNameSchema, BindingValueSchema)
```

These are inconsistent. Colby reads the code shape. He will implement `z.record(z.string(), ...)` and the AC test T-0005-150b (which exercises the 65-char key failure) will still pass because the length check is in `z.string().min(1).max(64)` — but the regex check will not be enforced on the `initialState` key side. The original NV-3 architectural gap persists in the implementation guide even though the AC prose and T-0005-036a correctly describe the intent.

This is a one-line fix: replace `z.record(z.string(), BindingValueSchema)` with `z.record(SlotNameSchema, BindingValueSchema)` in the Step 5 code shape block.

Severity: same as original NV-3 — Medium. Colby reads code shapes, not prose ACs, when writing implementation.

**Required:** Update Step 5 code shape line to `initialState: z.record(SlotNameSchema, BindingValueSchema).optional()`.

---

### NV-4 — Grand totals arithmetic: CLOSED

Per-row arithmetic verified independently:

| Step | New | Regression | Total |
|---|---|---|---|
| 1 | 24 | 3 | 27 |
| 2 | 32 | 0 | 32 |
| 3 | 17 | 0 | 17 |
| 4 | 90 | 0 | 90 |
| 5 | 16 | 1 | 17 |
| 6 | 25 | 0 | 25 |
| 7 | 9 | 2 | 11 |
| 8 | 32 | 3 | 35 |
| 9 | 12 | 1 | 13 |
| 10 | 41 | 5 | 46 |
| **Total** | **298** | **15** | **313** |

298 + 15 = 313. Every per-row sum is correct. Breaking-change tests are folded into New as directed. Grand total arithmetic is clean.

Closed.

---

### NV-5 — T-0005-256 ID base reuse numbering: CLOSED

The numbering note exists in Step 10 test table header:

> "NV-5 numbering note: T-0005-256 is the 12th RN-jest golden snapshot (last entry in the T-245..256 range). T-0005-256a, T-0005-256b, T-0005-256c are independent tests inserted at this point in the spec for the cross-runtime SVG-string equality assertion (256a), the CI orchestration check (256b), and the MT-3 empty-path runtime guard (256c). They share the numeric base 256 only because they were inserted adjacent to T-256 during rev-1; they are unrelated to T-256 itself. Future revisions should renumber rather than continue suffix-stacking on 256."

Clear and sufficient. Colby will not confuse T-0005-256 (12th RN golden) with T-0005-256a (cross-runtime assertion).

Closed.

---

## Supplementary Check — Step 2 Summary Table

The Step 2 Test Summary shows:

| Category | Count |
|---|---|
| Failure | 16 (+5 NV-3 T-0005-036a parameterized over 5 binding types) |
| **Total** | **32** |

The +5 NV-3 tests are reflected in the Step 2 summary table. The totals table also annotates the Step 2 New count as "24 base + 3 breaking + 5 NV-3." The addition is consistent across all three surfaces (test table, step summary, totals table).

---

## Summary Table

| Finding | Rev-2 Status | Notes |
|---|---|---|
| NV-1 (Material) — Step 10 file paths | CLOSED | Files, ACs, and Test Helpers all say 12; paths match test table byte-for-byte |
| NV-2 (Minor) — Stale ratio table | CLOSED | Steps 4, 7, 10 updated to rev-2 actuals; collapse annotations present |
| NV-3 (Material) — Slot schema inconsistency | PARTIALLY CLOSED | Step 2 code shape and ACs fixed; Step 5 code shape still uses `z.string()` |
| NV-4 (Minor) — Totals arithmetic | CLOSED | 298 + 15 = 313 verified; per-row sums correct |
| NV-5 (Minor) — T-0005-256 numbering | CLOSED | Note present in Step 10 test table header |

---

## Roz's Assessment

Cal closed four of five findings correctly. NV-4 arithmetic is clean. NV-2 ratio table is accurate and annotated. NV-5 note exists and is specific. NV-1 file paths match the test table without ambiguity. Those held.

NV-3 is 80% done. The Step 2 code shape is correct — `SlotNameSchema` is declared, exported, and used in `StringBinding`. T-0005-036a is specified correctly across all 5 binding types. The Step 5 AC prose says `z.record(SlotNameSchema, BindingValueSchema)`. But the Step 5 code shape block says `z.record(z.string(), BindingValueSchema)`. Colby implements from code shapes, not prose. The regex enforcement on `initialState` keys will not happen. This is the same failure mode I flagged in rev-1 — the fix touched 4 of 5 surfaces and missed the one that matters most to an implementer.

One line. `z.string()` becomes `SlotNameSchema`. Cal can fix this without a rev-3 cycle if he updates the file and sends me confirmation of the change rather than a full re-review. Colby starts Step 1 now — Step 5 is weeks away. But the fix must land before Colby reaches Step 5.

**Verdict: APPROVE WITH NOTES.** Colby is cleared to start Step 1. The NV-3 residual (Step 5 code shape) must be corrected before Colby begins Step 5 implementation.

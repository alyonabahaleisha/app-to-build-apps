# QA Report — ADR-0005 Step 1 Implementation

_Reviewed by Roz — 2026-05-08_

## Verdict: PASS WITH NOTES

| Check | Status | Details |
|---|---|---|
| Type Check | PASS | `pnpm --filter @app-creator/protocol typecheck` exits clean. Zero errors. |
| Tests | PASS | 112 passed, 0 failed. 4 suites. Matches Colby's claim exactly. |
| All 27 T-IDs present | PASS | Every T-0005-001 through T-0005-027 confirmed in test files by grep. |
| Token cardinalities | PASS | color=12, space=6, radius=5, type=6, elevation=3, motion=4. All match ADR ACs and F-12 Sponsor ruling. |
| Enum values | PASS | Stance, Palette, Archetype, NavPattern, SyncMode, BindingKind, SlotKind, FieldTypeDiscriminant — all exact. |
| canonical.ts verbatim | PASS | `diff` returns no output. 27 lines, byte-identical to legacy. |
| No workspace deep imports | PASS | `packages/protocol/src/` imports only `zod` and sibling `.js` files. No `@app-creator/*` imports in source. |
| ESM `.js` extensions | PASS | All intra-package imports in `index.ts` use `.js` extension (`./tokens.js`, `./enums.js`, `./canonical.js`). |
| No `console.log` | PASS | None found in source or tests. |
| `.strict()` discipline | N/A | No `z.object(...)` calls exist in Step 1 files. All schemas are `z.enum(...)`. |
| package.json shape | PASS WITH NOTE | See Note 1 below. |
| Scope creep (Steps 2–10) | PASS | `BindingKindSchema` and `SlotKindSchema` enums are present in `enums.ts` and exported from the index — see Note 2 below. No `Binding<T>` schemas, no `ActionSchema`, no `SpecSchema`, no `validate.ts`, no `design-system/`, no `coverArt.ts`, no codegen scripts. |
| Data sensitivity | PASS | No store methods, no endpoints, no user-facing data in Step 1 scope. |
| Pre-existing failures | CONFIRMED PRE-EXISTING | See below. |

---

## Per-AC Verification

**AC 1: `pnpm --filter @app-creator/protocol typecheck` passes** — Confirmed. No errors.

**AC 2: `pnpm --filter @app-creator/protocol test` passes** — Confirmed. 112/112.

**AC 3: Token-name enums export with correct cardinalities**

| Token | ADR AC | Actual in `tokens.ts` | Verdict |
|---|---|---|---|
| ColorToken | 12 | 12 (`bg`, `bg-elevated`, `bg-overlay`, `fg`, `fg-muted`, `fg-faint`, `divider`, `accent`, `accent-fg`, `success`, `warning`, `danger`) | PASS |
| SpaceToken | 6 | 6 (`space-none`, `space-xs`, `space-sm`, `space-md`, `space-lg`, `space-xl`) | PASS |
| RadiusToken | 5 (Sponsor F-12) | 5 (`radius-none`, `radius-sm`, `radius-md`, `radius-lg`, `radius-full`) | PASS |
| TypeRole | 6 | 6 (`type-display`, `type-h1`, `type-h2`, `type-body`, `type-caption`, `type-micro`) | PASS |
| Elevation | 3 | 3 (`elevation-flat`, `elevation-raised`, `elevation-floating`) | PASS |
| MotionCurve | 4 | 4 (`motion-instant`, `motion-snappy`, `motion-smooth`, `motion-springy`) | PASS |

**AC 4: Enum exact values**
- `Stance = 'productive' | 'expressive'`: PASS
- `Palette = 'focus' | 'health' | 'money' | 'social' | 'learn' | 'play'`: PASS
- `Archetype = 'ListCRUD' | 'Tracker' | 'Journal' | 'Calculator' | 'unknown'`: PASS
- `SyncMode = 'local' | 'cloud-private'` (no `'cloud-shared'`): PASS
- `NavPattern = 'none' | 'stack' | 'tabs' | 'modal-overlay'`: PASS

**AC 5: `canonicalize` and `renderHash` exported, bytewise-identical to legacy** — Confirmed. `diff` produces zero output. T-0005-026 pins the hash to `299ce8ddb74ff60f06007b46e34e7b1f2853bb988b349f138c728266752acff6` and passes. The copy is a copy, not a re-export from the legacy package (per Cal's Notes item 9 — confirmed by `index.ts` line 37: `from './canonical.js'`).

---

## Per-Test-ID Verification (all 27)

- [x] T-0005-001 — `tokens.test.ts` `ColorTokenSchema`, parses `'accent'`
- [x] T-0005-002 — `tokens.test.ts`, parses `'bg-elevated'`
- [x] T-0005-003 — `tokens.test.ts`, rejects `'primary'` (legacy M1 name)
- [x] T-0005-004 — `tokens.test.ts`, rejects `'accent-bg'` (typo)
- [x] T-0005-005 — `tokens.test.ts`, rejects empty string
- [x] T-0005-006 — `tokens.test.ts`, rejects null
- [x] T-0005-007 — `tokens.test.ts`, `it.each` over all 12 color tokens
- [x] T-0005-008 — `tokens.test.ts`, `it.each` over all 6 space tokens
- [x] T-0005-009 — `tokens.test.ts`, `it.each` over all 5 radius tokens including `radius-none`
- [x] T-0005-010 — `tokens.test.ts`, `it.each` over all 6 type roles
- [x] T-0005-011 — `tokens.test.ts`, `it.each` over all 3 elevations
- [x] T-0005-012 — `tokens.test.ts`, `it.each` over all 4 motion curves
- [x] T-0005-013 — `enums.test.ts`, `StanceSchema.parse('productive')` succeeds
- [x] T-0005-014 — `enums.test.ts`, `StanceSchema.parse('expressive')` succeeds
- [x] T-0005-015 — `enums.test.ts`, `StanceSchema.parse('neutral')` throws
- [x] T-0005-016 — `enums.test.ts`, `it.each` over all 6 palettes
- [x] T-0005-017 — `enums.test.ts`, `ArchetypeSchema.parse('Calculator')` succeeds
- [x] T-0005-018 — `enums.test.ts`, `ArchetypeSchema.parse('unknown')` succeeds
- [x] T-0005-019 — `enums.test.ts`, `ArchetypeSchema.parse('Dashboard')` throws
- [x] T-0005-020 — `enums.test.ts`, `NavPatternSchema.parse('none')` succeeds
- [x] T-0005-021 — `enums.test.ts`, `it.each` over all 4 nav patterns
- [x] T-0005-022 — `enums.test.ts`, `it.each` over all 6 `FieldTypeDiscriminantSchema` values (see Note 3)
- [x] T-0005-023 — `enums.test.ts`, `FieldTypeDiscriminantSchema.parse('array')` throws
- [x] T-0005-024 — `enums.test.ts`, `SyncModeSchema.parse('local')` and `'cloud-private'` pass; `'cloud-shared'` throws
- [x] T-0005-025 — `canonical.test.ts`, `canonicalize({z:1, a:2})` returns `'{"a":2,"z":1}'`
- [x] T-0005-026 — `canonical.test.ts`, 100-key fixture hash pinned to expected value
- [x] T-0005-027 — `canonical.test.ts`, nested 3-level object sorts keys at every level

All 27 IDs present. Zero gaps.

---

## canonical.ts Diff Result

Zero diff. Files are byte-identical. The copy is correct and does not re-export from the legacy package.

---

## ESM / CLAUDE.md Compliance

- All intra-package imports in `index.ts` use `.js` extension. Test files import from `./tokens.js`, `./enums.js`, `./canonical.js` — correct.
- `package.json` has `"type": "module"` — consistent with the ESM-first pattern.
- No `console.log` anywhere in the package.
- Naming conventions: PascalCase for types (`ColorToken`, `Stance`), SCREAMING_SNAKE constants not applicable at Step 1 (no constants), camelCase for functions (`canonicalize`, `renderHash`) — all correct.
- No barrel files at `src/` root (the `index.ts` is the package root re-export, per-folder index, not a root barrel in the prohibited sense — consistent with how `a2ui-schema` is structured).

---

## Notes

**Note 1 — package.json: `jest.config.js` vs `jest.config.cjs`**
The ADR Step 1 "Files to create" list specifies `jest.config.js`. Colby delivered `jest.config.cjs`. This is the correct choice. Because `package.json` has `"type": "module"`, a `jest.config.js` file would be treated as ESM and `module.exports = {...}` would throw. The `.cjs` extension is needed to keep the Jest config as CommonJS — identical to how `packages/a2ui-schema/` handles this (also `jest.config.cjs` with `module.exports`). The ADR filename is a documentation artifact; the `.cjs` implementation is correct. No action needed.

**Note 2 — `BindingKindSchema` and `SlotKindSchema` in Step 1**
These two enums are in `enums.ts` and exported from the package root. The ADR Step 1 "Files to create" list includes `enums.ts` with the enumeration `(Stance, Palette, Archetype, Navigation, Tone, FieldType, SyncMode, BindingKind, SlotKind, NavPattern)`. So `BindingKindSchema` and `SlotKindSchema` are explicitly Step 1 scope — they're discriminant enums, not the full `Binding<T>` schemas (which are Step 2). This is not scope creep. The comment in `enums.ts` line 52 ("discriminant for the Binding<T> discriminated union — Step 2") makes the layering explicit. Correct.

**Note 3 — T-0005-022: FieldType "discriminated union" vs flat enum**
The ADR T-0005-022 description says "FieldType discriminated union parses each variant." Colby's `enums.ts` has `FieldTypeDiscriminantSchema` — a flat `z.enum(...)` of the six type strings, not a full `z.discriminatedUnion(...)`. The full discriminated union (`z.object({type: z.literal('string')})` et al.) is explicitly Step 3 (`collection.ts`). Colby's test for T-0005-022 exercises the discriminant strings via the flat enum, which is the correct Step 1 artifact. The comment in `enums.test.ts` lines 111–113 is transparent about this deferral. The ADR Step 1 "Files to create" does not include `collection.ts`. This interpretation is acceptable — the six discriminant values parse correctly, which is what the test is validating at this stage. Step 3 will own the full structural test. Not a finding; noted for clarity.

**Note 4 — ADR Step 1 Test Summary arithmetic (pre-existing in ADR)**
The ADR Step 1 Test Summary table claims Happy=16, Regression=3, Total=27. Counting from the Step 1 test table: Happy=17, Regression=2, Total=27. The summary is off: Happy is overcounted or Regression is overcounted by 1 each in a compensating error. Total is correct. This is an ADR-internal arithmetic artifact — NV-4 family, pre-existing. Not Colby's bug, not Colby's problem to fix.

---

## Pre-Existing Failure Scoping

Confirmed pre-existing, not introduced by Colby's Step 1 changes:

1. **`a2ui-renderer` TS error in `Toggle.test.tsx:164`** — `Type '... | undefined' must have a '[Symbol.iterator]()' method`. This file is in `packages/a2ui-renderer/src/components/Toggle.test.tsx` which is not in Colby's untracked file list. `git status` shows `packages/protocol/` as entirely new (untracked directory); no modifications to `a2ui-renderer`. The error predates this step.
2. **`services/api` Docker/testcontainer failures** — not applicable to this package-level QA; no container runtime in this environment, and Step 1 touches no API code.

---

## Cardinality Assertions Beyond ADR

Colby added cardinality assertions in `index.test.ts` (`closed-enum cardinality contract` describe block) and per-schema `has exactly N members` assertions in `tokens.test.ts` and `enums.test.ts`. These are sensible additions — they act as a tripwire if someone adds or removes a value from a closed enum without updating the ADR. These are not Test Theater: each asserts a specific numeric invariant that the ADR explicitly specifies, and a failure would be immediately actionable. Cardinality assertions are additive, not substitutive — the ADR-spec'd parameterized parse tests are also present. No issue.

---

## Notes for Step 2

- `SlotNameSchema` is Step 2's responsibility per ADR NV-3 resolution. It must be exported from `binding.ts` (not `enums.ts`). Colby should not pre-define it in Step 1 files.
- Step 2 imports from `enums.ts` for `BindingKindSchema` and `SlotKindSchema` — the enums are ready.
- The `FieldTypeDiscriminantSchema` in `enums.ts` is the right discriminant for Step 3's `z.discriminatedUnion(...)`. No changes needed to `enums.ts` from Step 2 to use it.
- The `index.test.ts` smoke tests import `BindingKindSchema` and `SlotKindSchema` and verify they're defined and have the correct cardinality. Step 2's `binding.ts` will add the structural schemas on top of these discriminants — no conflict.

---

## Roz's Assessment

112 tests, 4 suites, clean typecheck, zero diff on the canonical copy, all 27 IDs present, token cardinalities exact, no scope creep, no console logs, ESM extensions correct. Colby also correctly chose `.cjs` for the jest config rather than following the ADR's `.js` filename literally — that's the right call for an ESM-typed package.

Two notes worth flagging to Cal: the ADR's T-0005-022 description ("FieldType discriminated union") is slightly misleading for what's actually testable in Step 1 scope, and the Step 1 Test Summary arithmetic is off by 1 in two categories (compensating, total correct). Neither blocks Step 2.

Step 1 clears. Step 2 is unblocked.

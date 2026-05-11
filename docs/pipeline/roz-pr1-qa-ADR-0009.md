# QA Report — ADR-0009 PR 1 (Steps 1+3+8 — Foundations)

_Reviewed by Roz — 2026-05-07_

## Verdict: PASS WITH NOTES

One P1 fix required before Ellis commit: `generated/types.ts` stale (5 new components missing from hand-rolled `gen-types.ts` `NODE_TYPE` constant). 20-min mechanical fix. All other surfaces clean.

| Check | Status |
|---|---|
| Type Check | PASS — protocol + design-system + renderer all clean |
| Lint | PASS — 0 errors, 4 pre-existing warnings (not from PR 1) |
| Tests | PASS — 968 protocol + 252 design-system + 710 renderer (1930 total) |
| Complexity | PASS — largest is Callout.tsx 210 lines, CCN well under 10 |
| Security | PASS — no new PII, no secrets, no injection vectors |
| Dependencies | PASS — no new deps; date-fns + expo-document-picker correctly deferred |
| Scope isolation | PASS — `services/api/`, `apps/mobile/` untouched |
| Deferred Steps 2/4/5/6/7/9/10 | PASS — all correctly untouched |

## P1 Finding (must fix before commit)

### `generated/types.ts` stale — 5 V1 components missing

**File:** `packages/protocol/scripts/gen-types.ts` lines 194-235

The `NODE_TYPE` constant in `gen-types.ts` is a **hand-rolled string template** (NOT auto-derived from Zod). PR 1 added 5 new components (Divider, Image, IconButton, AvatarGroup, Callout) to `src/spec.zod.ts`'s `Node` union, but did NOT update the parallel `NODE_TYPE` template. Result: `generated/types.ts` shows 28 V0 components in its `Node` union, missing the 5 V1 additions.

**Why it doesn't break today:** `generated/types.ts` is a consumer-facing convenience type, NOT the schema source of truth. Authoritative types in `src/spec.zod.ts` are correct. All renderer + protocol code imports from `src/`, not `generated/`. TypeScript clean.

**Why it matters:** External consumers importing from `generated/types.ts` get an incomplete `Node` union. Codegen-drift CI will catch this on next PR (`git diff --exit-code packages/protocol/generated/` after codegen).

**Fix:** Update `NODE_TYPE` template in `gen-types.ts` to add 5 entries:

- After `Card`: `| {id: string; type: 'Divider'; label?: string; inset?: 'none' | 'start' | 'both'; weight?: 'hairline' | 'thick'; accessibilityLabel?: string}`
- After `Avatar`: `AvatarGroup` and `Callout` entries (full types per Roz's report)
- After `ImagePicker`: `Image` entry
- After `Fab`: `IconButton` entry

Then `pnpm --filter @app-creator/protocol codegen` to regenerate `types.ts`. Commit both.

## Notable Deviations Accepted

### CalloutSchema.variant `.optional()` not `.default('info')`

`packages/protocol/src/components/display.ts` line 95. Renderer applies default via `node.variant ?? 'info'` in `Callout.tsx` line 65.

**Technical constraint verified:** `z.ZodType<Node>` annotation forces `z.infer<typeof CalloutSchema>` to match Node union member exactly. `.default('info')` would change the inferred type (non-optional vs optional). Workaround alternatives (z.lazy, separate annotations) add complexity for zero behavioral gain.

End-user behavior identical. T-0009-079 passes. **Accepted.**

## T-ID Coverage

**Step 1 (T-0009-001..030 + T-0009-243):** All 31 implemented.
- T-0009-024 Image defensive empty-alt throw — verified
- T-0009-029 NodeRenderer Divider missing id rejected upstream — verified
- T-0009-030 28 V0 components still dispatch — regression confirmed
- T-0009-243 Divider no-label `accessibilityRole="none"` — both branches concrete-asserted

**Step 3 (T-0009-068..088 + T-0009-240..242):** All 24 implemented.
- T-0009-068..073, T-240 tintColor — all 8 cases including alpha=0 boundary, short-hex throw
- T-0009-241 AvatarGroup `accessibilityLabel` exact string `"5 people: Alex, Sam, Jordan, and 2 others"` — passes specificity bar
- T-0009-242 Callout `danger` `accessibilityRole="alert"` — concrete value asserted

**Step 8 (T-0009-186..204 + T-0009-229):** Per ADR strategy.
- Fully implemented: T-186..188, T-203..204, T-229 (backward-compat audit), T-198..202 (icon catalog 80→98)
- Properly deferred as `.todo` (11 stubs): T-189..197, T-191a/b, T-245 — each with concrete description of what assertion will fire when V1 components land

## Pre-existing Observations (not new)

- 4 ESLint warnings in `useReducedMotion.test.ts` and `Renderer.test.tsx` — pre-existing.

## CI/CD Verification Required: Yes

`generated/types.ts` regeneration required after `gen-types.ts` fix. codegen-drift.yml will catch on next PR if missed.

## Roz's Assessment

Thirty-one T-IDs for Step 1. Twenty-four for Step 3. Twenty-two for Step 8 with 11 properly deferred .todo stubs. Tests passing at claimed counts. All 5 new components pure functions, no useEffect. Snapshots match. Icon catalog exactly 98. Validator contract change backward-compatible. Skeleton check functions return `[]` with future-PR comments. CalloutSchema deviation technically justified.

The `generated/types.ts` omission is a real gap. Source-of-truth is correct so nothing breaks today, but it will mislead external consumers and confuse future developers. Fix is mechanical: 20 minutes.

**One P1 fix required. Ellis should hold the commit until Colby addresses `gen-types.ts`.**

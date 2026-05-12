# R2 QA Report — ADR-0009 PR 6 (Step 7) Surgical Fix Verification

_Reviewed by Roz — 2026-05-12_

## Verdict: PASS

All 4 R1 findings closed cleanly. BeforeAfter coverage rose 58%→88%. No scope creep.

| Check | Status | Details |
|---|---|---|
| F1 — Timeline fake timers | CLOSED | `useFakeTimers` at lines 92, 118; anchor `2026-01-15T12:00:00Z` matches Heatmap/Calendar; snapshot deterministic |
| F2 — `GalleryBaseSchema` leak | CLOSED | Removed from `src/index.ts`; still in `components/index.ts` + `spec.zod.ts` as required |
| F3 — T-0009-171 a11y action tests | CLOSED | 3 specific assertions: 50→60 / 50→40 / 10x clamps to 95; coverage 58%→88.23% |
| F4 — T-0009-164 close button a11y | CLOSED | role + label assertions against correct testID element |
| Tests | PASS | 1062 + 1 todo, 170 snapshots, 0 failed |
| Typecheck | PASS | Both packages |
| Lint | PASS | 4 pre-existing warnings unchanged |
| Scope creep | CLEAN | Only Step 7 files + 4 R2-prescribed files |

## F1 Detail

Timeline snapshot contains only fixed strings (`14d ago`, `-7200s ago`, `-1461600s ago`) — zero live date strings. Snapshot is deterministic. 11/11 Timeline tests pass.

**`-7200s ago` oddity**: Seed entry "Design review" timestamped `2026-01-15T14:00:00Z` — 2 hours AFTER the noon anchor. Formatter produces negative delta. Pre-existing behavior, now deterministic. Not a finding.

## F2 Detail

`grep "GalleryBaseSchema" packages/protocol/src/index.ts` returns empty. `components/index.ts` + `spec.zod.ts` still have it (internal use). Protocol typecheck clean.

## F3 Detail

3 tests at `BeforeAfter.test.tsx:160-212`:
- Increment 50→60: specific `toBe(60)`
- Decrement 50→40: specific `toBe(40)`
- 10x increment clamps to 95: matches implementation cap `Math.min(0.95, ...)` → `Math.round(0.95 * 100) = 95`

Coverage went 58% → 88.23% statements. Uncovered lines 92-95 are the Reanimated worklet — accepted gap (cannot drive worklets from Jest without significant infra).

## F4 Detail

Lines 239-240 of `Gallery.test.tsx`:
```ts
expect(closeBtn.props.accessibilityRole).toBe('button')
expect(closeBtn.props.accessibilityLabel).toBe('Close photo')
```

`closeBtn` retrieved via testID `gallery-fullscreen-close` — the correct element, not a proxy.

## Roz's R2 Assessment

All findings closed cleanly. Tests are specific (`toBe(60)`, `toBe(40)`, `toBe(95)`, not presence checks). Close button assertions on the correct element. Coverage moved from embarrassing to acceptable. Snapshots pinned. F2 landed without collateral damage to the discriminated union.

**PASS.** Ellis can commit.

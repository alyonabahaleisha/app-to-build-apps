# R2 QA Report — ADR-0009 PR 5 (Step 6) Surgical Fix Verification

_Reviewed by Roz — 2026-05-12_

## Verdict: REVISE (1 NEW BLOCKING finding — Calendar snapshot date-rot)

F1/F2/F3 from R1 all closed cleanly. New analogous finding F5 surfaced: Calendar snapshots have the same date-rot defect Colby fixed for Heatmap, but he didn't apply the symmetric fix to Calendar. Today the snapshots pass; in 20 days they won't.

This was a miss on R1 coverage — Roz notes the structural `new Date()` coupling in CalendarRenderer was visible at R1.

| Check | Status | Details |
|---|---|---|
| Type Check | PASS | clean |
| Lint | PASS | 4 pre-existing warnings — none in Calendar/Heatmap |
| Tests (Heatmap) | PASS | 21/21 |
| Tests (Calendar) | PASS | 21 + 1 todo (T-0009-137 bundle) |
| Tests (full suite) | PARTIAL | 984 passed, 2 failed (pre-existing Timeline drift from `2817ae3`), 1 todo |
| F1 — Heatmap date-rot | CLOSED | Fake timers correctly installed; snapshot pinned to "Jan 15, 2026" |
| F2 — Calendar a11y role | CLOSED | `role="grid"` (ARIA-aligned RN 0.73+ prop) — accepted |
| F3 — T-0009-148 title | CLOSED | Renamed to "renderer with collection items renders without crashing" |
| **F5 NEW — Calendar snapshot date-rot** | **FAIL** | T-0009-152 snapshots contain live "May 2026" |
| Scope creep | CLEAN | Only 6 files in a2ui-renderer scope |
| Timeline drift | PRE-EXISTING | From `2817ae3` Step 4 — backlog item |

## F1 — Heatmap date-rot: CLOSED

All 4 describe blocks in `Heatmap.test.tsx` exercising date-sensitive rendering (T-0009-150, T-0009-151, both T-0009-153 blocks) wrap with `jest.useFakeTimers()` / `jest.setSystemTime(new Date('2026-01-15T12:00:00Z'))` / `jest.useRealTimers()` in `beforeEach`/`afterEach`. Snapshot at lines 2568 and 5177 contains "Jan 15, 2026" hardcoded.

## F2 — Calendar a11y role: ACCEPTED

`role="grid"` on the container View (Calendar.tsx:168). RN's legacy `accessibilityRole` union doesn't include `'grid'` — using it would require `as any` cast which TS would reject. `role` is the ARIA-aligned prop added in RN 0.73 precisely for values the legacy union can't express. The ADR's intent — grid semantics exposed to assistive tech — is satisfied; VoiceOver maps `role="grid"` to ARIA grid role.

Test at `Calendar.test.tsx:352` asserts `expect(grid.props.role).toBe('grid')`. Incorrect comment removed. Snapshot lines 6 and 2867 show `role="grid"`. No other components in `v0/components/` use this pattern — Calendar sets the precedent cleanly.

## F3 — T-0009-148 misleading title: CLOSED

Renamed to "renderer with collection items renders without crashing." Comment block explains quintile math is in unit tests above. Hardcoded `'2026-01-15'` used.

## BLOCKING — F5 NEW: Calendar T-0009-152 snapshots contain live date

`Calendar.test.tsx:446-464` (two T-0009-152 describe blocks: productive×focus + expressive×health) have **no fake timer setup**. `CalendarRenderer` initializes `currentMonth` via `useState(() => startOfMonth(new Date()))`, so rendered output includes the real current month.

Snapshot file confirms "May 2026" at lines 148 and 3009. Cell `testID` values encode real current date (`calendar-cell-cal1-2026-05-11` at lines 1362 and 4223).

**On June 1, 2026 these two snapshots will fail.** Identical date-rot pattern to Heatmap which Colby already fixed.

**Prescription (mechanical, mirrors F1):**

Add `beforeEach`/`afterEach` blocks to both T-0009-152 describe blocks:
```ts
beforeEach(() => {
  jest.useFakeTimers()
  jest.setSystemTime(new Date('2026-01-15T12:00:00Z'))
})
afterEach(() => {
  jest.useRealTimers()
})
```

Use the same pinned date as Heatmap (`2026-01-15T12:00:00Z`) for consistency. Delete `__snapshots__/Calendar.test.tsx.snap` and regenerate via `-u`.

**Roz acknowledges this was a miss on R1.** The structural coupling to `new Date()` in CalendarRenderer (via `startOfMonth(new Date())`) was visible in the source at R1 time. R1 caught Heatmap's date-rot but didn't trace the analogous pattern in Calendar.

## Scope Creep — Clean

Only the 6 files in `packages/a2ui-renderer/src/v0/components/compound/` (4 source/test + 2 snapshots) changed for this R2 fix. RunScreen workstream files in `apps/mobile/src/screens/Run/**` are entirely separate package — no cross-contamination.

## Timeline drift — Pre-existing, NOT blocking

Timeline "130d ago → 131d ago" failures originate from `2817ae3` (ADR-0009 Step 4). Untouched by this R2 fix. Backlog item — do not block PR 5 on them.

## Roz's Assessment

F1, F2, F3 are clean. The new finding F5 is the same defect class as F1 but in a sibling component. Colby applied the fake-timer pattern to Heatmap and stopped at the a2ui-renderer package boundary without asking "does Calendar have the same problem?" It does. The Calendar component also calls `new Date()` at render time. Today the snapshots pass. In 20 days they won't. That's not a pass — that's a deferred failure.

The fix is identical and mechanical. Two describe blocks, same pinned date, regenerated snapshot. ~5-minute fix.

**REVISE.** Surgical extension of the same fix.

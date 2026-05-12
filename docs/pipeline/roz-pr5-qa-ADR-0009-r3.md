# R3 QA Report — ADR-0009 PR 5 (Step 6) Calendar Date-Rot Symmetric Fix

_Reviewed by Roz — 2026-05-11_

## Verdict: PASS

F5 (Roz's R2 new finding) closed mechanically. Pattern symmetric with Heatmap's R2 fix.

| Check | Status | Details |
|---|---|---|
| F5 — fake-timer setup (productive×focus) | CLOSED | Lines 447-453 in Calendar.test.tsx |
| F5 — fake-timer setup (expressive×health) | CLOSED | Lines 465-471 |
| F5 — Pinned date consistency | CLOSED | `2026-01-15T12:00:00Z` (matches Heatmap) |
| F5 — `useRealTimers()` teardown | CLOSED | Both afterEach blocks |
| F5 — Snapshot "January 2026" | CLOSED | Lines 148 + 3009 |
| F5 — Snapshot date-rot strings | CLOSED | Zero "May 2026" / "2026-05-11" occurrences |
| F5 — testID pin | CLOSED | `calendar-cell-cal1-2026-01-15` at lines 1530 + 4391 |
| Calendar suite | PASS | 21 passed, 1 todo, 2 snapshots matched |
| Full a2ui-renderer suite | PASS | 984 passed, 2 failed (pre-existing Timeline drift from `2817ae3`), 1 todo — unchanged from R2 |
| Scope creep | CLEAN | Only Calendar.test.tsx + Calendar.test.tsx.snap |

## F5 Detail

Both T-0009-152 describe blocks now wrap with:

```ts
beforeEach(() => {
  jest.useFakeTimers()
  jest.setSystemTime(new Date('2026-01-15T12:00:00Z'))
})
afterEach(() => {
  jest.useRealTimers()
})
```

Snapshot regenerated with pinned date. Zero date-rot strings survive.

## Pre-existing Timeline drift — unchanged

2 Timeline snapshot failures from `2817ae3` (ADR-0009 Step 4) — "99d ago → 100d ago" drift. Not introduced here. Backlog item.

## Roz's R3 Assessment

Mechanical fix applied correctly. Pattern symmetric with Heatmap. No regressions.

**PASS.** PR 5 may proceed to Ellis for commit. Full Step 6 work (Calendar + Heatmap + R2 fixes + R3 fix) ships as one commit.

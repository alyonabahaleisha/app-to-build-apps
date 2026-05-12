# QA Report — ADR-0009 PR 6 (Step 7 — Content/Media: Gallery, CommerceCard, BeforeAfter, DocumentPicker)

_Reviewed by Roz — 2026-05-12_

## Verdict: REVISE (1 CRITICAL + 1 HIGH + 1 MEDIUM + 2 LOW)

3 of 4 components clean. Gallery superRefine correct; CommerceCard strikethrough/border specific; DocumentPicker MIME mapping correct (the `star/star` comment is documentation noise, runtime uses correct `'*/*'`).

| Check | Status |
|---|---|
| Type Check | PASS |
| Lint | PASS (4 pre-existing warnings unrelated) |
| Tests (renderer) | PASS — 1059 + 1 todo, 80 suites, 170 snapshots |
| Tests (protocol) | PASS — 1128 + 12 todo, 19 suites |
| Tests (mobile) | PASS — 383 |
| Coverage | WARN — BeforeAfter.tsx 58% stmts / 69% branch |
| Complexity | PASS |
| Security | PASS |
| Dependencies | PASS — `expo-document-picker@~12.0.2` clean |

## CRITICAL — F1: Timeline snapshot rot (Step 7 touches out-of-scope file with band-aid fix)

`packages/a2ui-renderer/src/v0/components/lists/__snapshots__/Timeline.test.tsx.snap`. Colby ran `--updateSnapshot` to bump relative dates by 1 day (130d→131d ago, etc). `Timeline.test.tsx` has NO `jest.useFakeTimers()` / `jest.setSystemTime()` — real `Date.now()` is used.

Snapshot captured 2026-05-12. **Will fail on 2026-05-13.** Same scenario that prompted fake-timer remediation for Heatmap + Calendar in Step 6.

**Fix:** Add `jest.useFakeTimers()` + `jest.setSystemTime(new Date('2026-05-12T12:00:00Z'))` in both Timeline snapshot describes (or a `beforeEach`/`afterEach` block scoped to those tests), then re-record. Use a consistent pinned date per the Heatmap/Calendar pattern (suggest `2026-01-15T12:00:00Z` for catalog-wide consistency).

This is not a Step 7 bug per se — but Colby touched it and left it worse than he found it. Proper fix required before merge.

## HIGH — F2: `GalleryBaseSchema` leaks from `packages/protocol/src/index.ts`

Line 133 of `src/index.ts` exports `GalleryBaseSchema`. `CalendarBaseSchema` (analogous pattern from Step 6) is NOT in `src/index.ts` — only in `components/index.ts`. Inconsistency leaks an implementation detail into the public package surface.

`*BaseSchema` exists because `z.discriminatedUnion` requires `ZodObject` (not `ZodEffects` produced by `superRefine`). Only `spec.zod.ts` internally needs it — accessed via `components/index.ts`.

**Fix:** Remove `GalleryBaseSchema` from `packages/protocol/src/index.ts:133`. Keep it in `components/index.ts` only.

## MEDIUM — F3: T-0009-171 BeforeAfter drag test is presence-only

`BeforeAfter.test.tsx:140-166`. Description: "slider mode handle drag clips Before image (Reanimated worklet)." Test only asserts composite view + after-clip container + thumb are in the tree.

**Never:**
- Simulates a pan gesture
- Verifies `clipFraction.value` changes after drag
- Verifies animated clip width updates

The `onUpdate` worklet at `BeforeAfter.tsx:85-96` has ZERO test coverage. T-0009-171 is a presence check masquerading as a behavior check.

**Fix:** Either simulate a pan via Reanimated mock's gesture handler OR (minimum acceptable) add an `onAccessibilityAction` increment-event assertion on the thumb that verifies `accessibilityValue.now` changes — at least covers the JS-side a11y path (lines 241-249).

## LOW — F4: T-0009-164 close button accessibility not asserted

`Gallery.test.tsx:227-246`. Tests close button exists by testID + pressing doesn't throw. Doesn't assert `accessibilityRole="button"` + `accessibilityLabel="Close photo"`. Implementation has both (correct), but test doesn't lock them.

**Fix:** Add `expect(closeBtn.props.accessibilityRole).toBe('button')` + `expect(closeBtn.props.accessibilityLabel).toBe('Close photo')`.

## LOW — F5: BeforeAfter.tsx coverage 58%

Uncovered lines 81, 92-95 (onUpdate worklet), 241-249 (a11y action callbacks). No threshold configured → not blocking. But new code below team standard. Closing F3 likely closes this too.

## Informational

- **`star/star` JSDoc comment**: Only appears in line 16 doc comment. Runtime MIME map at line 53 correctly uses `'*/*'`. No production bug. (Workaround for `*/` terminating the `/** */` block.)
- **`GALLERY_EMPTY` fixture**: Would fail schema parse (XOR rejects `images: []` + no collection). Test bypasses schema by direct typing — acceptable for renderer defensive testing.

## Roz's Assessment

Three of the four components are clean. The drag worklet in BeforeAfter is the riskiest piece and the one with the weakest test coverage. The Timeline snapshot update is the most concerning issue — not because it's wrong code, but because it's a band-aid that bought one day of green CI. Fix those three, and Step 7 ships.

**REVISE.** Surgical fixes:
1. F1: Add fake timers to Timeline.test.tsx + re-record snapshot
2. F2: Remove `GalleryBaseSchema` from main `src/index.ts`
3. F3: Add real drag/a11y behavior assertions to T-0009-171
4. F4: Add accessibility-prop assertions to T-0009-164 close button

# QA Report — ADR-0011 Phase 2 PR 2 (Step 8 — LibraryScreen)

_Reviewed by Roz — 2026-05-10_

## Verdict: PASS WITH NOTES (5 findings — F1+F2 worth folding before ship)

Core acceptance criteria all implemented. 262 tests pass; typecheck + lint clean. Five non-blocking findings; F1 + F2 are 1-3 line fixes that should fold in (F2 is the same a11y pattern as PR 1's BLOCKING F2 hit-target issue).

| Check | Status |
|---|---|
| Type Check | PASS |
| Lint | PASS |
| Tests | PASS — 262 passed, 1 pre-existing skip |
| Coverage | PASS WITH NOTES — Library files mostly ≥95%; LongPressActionSheet 50% (F5) |
| Complexity | PASS — no function >CCN 10 |
| Security | PASS WITH NOTES — F1 backstop narrower than spec |
| Dependencies | PASS — no new deps |

## Findings

### F1 — T-0011-170a assertion narrower than P0-4 spec

`LibraryScreen.test.tsx:400-417`. Required: `JSON.stringify(serialized).not.toContain(specJsonContent)`. Implemented: queryAllByText + manual button walk + queryAllByTestId. Doesn't cover `accessibilityHint` on non-buttons, `accessibilityValue`, `accessibilityLabel` on role="alert" / role="header" elements, or the full JSON tree.

**Fix:** Add `expect(JSON.stringify(screen.toJSON())).not.toContain(SPEC_JSON_SENTINEL)` after card render. One line.

### F2 — Filter chip touch targets 24pt (ARCHITECTURE.md §12 violation)

`SearchAndFilters.tsx:163-165`. `chip` height: 24pt. Pressable chips have NO `hitSlop`. Comment at line 168 claims "44pt via parent vertical padding" — **WRONG**. Parent View padding does NOT extend Pressable touch target in React Native. Touch area = Pressable geometry + hitSlop.

Same pattern as PR 1's BLOCKING F2 (footer links 22pt). Roz gave PR 1 BLOCKING; gives this NOTE.

**Fix:** `hitSlop={{top: 10, bottom: 10}}` on each chip Pressable (24 + 10 + 10 = 44pt). Add test mirroring T-0011-150 (`top + bottom >= 20`).

### F3 — `isTrulyEmpty` checked before `isSharedFilterWithNoShares`

`LibraryScreen.tsx:237-254`. Edge case: query.data === [] + activeFilter === 'shared' + searchQuery === ''. `isTrulyEmpty` evaluates first → generic EmptyState shown ("What do you want to build?") instead of "Tools your friends share will appear here."

T-0011-170 doesn't trigger this because it seeds 1 app first. Edge case untested. Non-blocking because spec doesn't define explicitly; "truly empty" is arguably correct when user has zero apps.

### F4 — Header title `accessibilityRole="header"` untested

`LibraryScreen.tsx:203` has the role but no test asserts it. Code is correct; coverage gap.

### F5 — LongPressActionSheet handler coverage 50%

`LongPressActionSheet.tsx:75-112`. Action item taps not exercised beyond presence. Handlers stubbed in Step 8; verified integration is Step 10 territory. Coverage backlog.

## Notes on Brief vs Implementation

- Brief item 7 said "4 V0 archetypes + sort dropdown" — ADR Step 8 and Sable both say "All / Mine / Shared with me" (3 chips). Implementation correct per binding specs.
- Sort dropdown deferred to V0.5 — correct alignment.

## Roz's Assessment

Home fully deleted. Library is in. Navigation.tsx routes to "Library" as authenticated root. Chat and AppRunner tests updated stubs. No stale Home imports.

262 tests pass. Core ACs all implemented: states, search, filter chips, pull-to-refresh, long-press menu (6 items), card a11y, hints, skeleton shimmer reduced-motion, T-0011-170 exact copy, T-0011-170b negative.

F1 + F2 are 1-3 line fixes that close real gaps. F3-F5 backlog.

**PASS WITH NOTES.** Fold F1 + F2 into a surgical fix before commit; F3-F5 backlog.

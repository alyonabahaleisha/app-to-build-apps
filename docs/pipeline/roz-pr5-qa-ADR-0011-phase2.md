# QA Report — ADR-0011 Phase 2 PR 5 (Step 6 — ShellLayout + TabBar + SettingsSheet)

_Reviewed by Roz — 2026-05-12_

## Verdict: REVISE (1 BROKEN CONTRACT + 1 tautological test + 1 complexity)

| Check | Status |
|---|---|
| Type Check | PASS |
| Lint | PASS |
| Tests | PASS — 41/41 (ShellLayout 21, SettingsSheet 20); 483 mobile total |
| Coverage | PASS w/ note — SettingsSheet 77.77% branch (uncovered partly = F-1 dead code) |
| **Complexity** | **FAIL** — SettingsSheet.tsx is 481 lines (>300 threshold) |
| Security | PASS — `maskEmail` correctly uses `lastIndexOf('@')` + edge case guards |

## FAIL — F-1: `useSettingsSheet()` sheetRef attaches to NOTHING (broken contract)

`apps/mobile/src/shell/SettingsSheet.tsx:101-113` (hook) and `:164-170` (component).

- `useSettingsSheet()` creates `sheetRef = useRef<BottomSheetModal>(null)` and returns it
- JSDoc says "Pass `ref` to `<SettingsSheet ref={ref} />`"
- BUT `SettingsSheet` is a plain function component — NOT wrapped in `React.forwardRef`
- React 18 silently ignores `ref` on non-forwardRef function components
- `<BottomSheetModal>` inside SettingsSheet.tsx has NO `ref={}` prop at all (line 164)

**Result:** `sheetRef.current` permanently `null`. `open()` and `close()` are NO-OPs in production. Tapping "Settings" from Library header will call `open()` → nothing happens → sheet never appears.

**Why tests didn't catch it:** T-0011-137 only asserts `typeof result.current.open === 'function'` + `expect(() => result.current.open()).not.toThrow()`. Both pass on a no-op. The test never verifies `present()` was called on the BottomSheetModal instance. Classic tautology.

**Fix:**
- Wrap `SettingsSheet` in `React.forwardRef<BottomSheetModal, SettingsSheetProps>` AND pass the ref to `<BottomSheetModal ref={ref}>` 
- OR own internal ref + expose imperative handle via `useImperativeHandle`
- Update T-0011-137 to spy on `BottomSheetModal.prototype.present` and assert it's called after `open()`.

## FAIL — F-2: T-0011-135 duplicates T-0011-134

`SettingsSheet.test.tsx:199-204`. T-0011-135's purpose: "Tap-on-overlay dismisses." Implementation checks `sheet.props.enablePanDownToClose === true` — same as T-0011-134. Test comment acknowledges it ("enablePanDownToClose covers this at sheet level"). Overlay-tap is a separate Gorhom behavior (`backdropComponent` / `backdropPressBehavior`).

**Fix:** Re-point at `backdropPressBehavior` OR delete if overlay-tap is explicitly out of scope.

## FAIL — F-3: SettingsSheet.tsx 481 lines (>300)

Sub-components (`SectionHeader`, `Divider`, `LinkRow`, `ComingNextList`) could be extracted to `shell/settings/` or co-located `SettingsSheet.parts.tsx`.

## NOTE — F-4: Late mid-file import at line 296

`import type {ResolvedTheme}` mid-file. All imports must be top-of-file. ESLint `import/order` didn't flag — check if type-only imports are excluded from the rule.

## NOTE — F-5: Pre-existing `act()` warnings

`Skeleton.tsx`'s `Animated.loop` fires outside act. Same as LibraryScreen.test.tsx. Not introduced here. CI noise.

## Scrutiny — PASS items

- **maskEmail**: SIWA distinguished by `domain === SIWA_DOMAIN`; magic-link gets first+last char; single-char local handled. All 4 branches tested.
- **T-0011-141c skeleton pin**: both `isLoading` AND `isError` show skeleton; cached intents NOT shown. Asserted via `getByTestId` + `queryAllByTestId(/settings-capability-/).length === 0`.
- **TabBar defensive typing**: `Tab | string` accepts unknown values, both tabs render unselected, no crash. T-0011-141a verifies.
- **AuthUser.displayName**: optional, correctly typed at SessionProvider:58. Consumers: SettingsSheet (rendering) + siwaProvider (setting). Magic-link fallback `user?.email?.split('@')[0]` in SettingsSheet.tsx:157 — correct placement.
- **Snapshot determinism**: `expo-constants` mocked to fixed values. No `Date.now()` in output.
- **Sign Out chain**: `handleSignOut:132-139` calls `session.signOut() → qc.clear() → navigation.reset`. T-0011-141h verifies via spies. Confirms ADR-0008 chain: `signOut → enterUnauthenticated → clearPendingClone`.

## Roz's Assessment

41 tests, all green. `maskEmail`, a11y attributes, skeleton pin, sign-out chain, `AuthUser.displayName` all solid.

F-1 is the reason this doesn't pass. `useSettingsSheet()` ships a ref that attaches to nothing. Production user taps Settings → silently nothing happens. T-0011-137 passes only because it checks "doesn't throw" on a no-op function. Optimism with a `jest.fn` wrapper — not a test.

Fix forwardRef + tighten T-0011-137 + dedupe T-0011-135 (or delete) + extract sub-components from 481-line file.

**REVISE.** F-1 is the must-fix; F-2/F-3 are required for clean ship.

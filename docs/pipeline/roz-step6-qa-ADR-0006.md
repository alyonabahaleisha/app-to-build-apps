# QA Report — ADR-0006 Step 6 (Inputs Tier)

_Reviewed by Roz — 2026-05-07_

## Verdict: FAIL

Two gating issues. Two non-gating deviations accepted. Surgical-fix round required before Step 7.

| Check | Status |
|---|---|
| Type Check | PASS — clean |
| Lint | PASS WITH NOTES — useEffect ban silently broken (Finding 2) |
| Tests (legacy) | PASS — 211/211 |
| Tests (V0) | PASS — 314/314 |
| Coverage (inputs) | PASS WITH NOTES — 95.04% stmt / 83.95% branch |
| Snapshots | PASS — 35 V0 total (10 new inputs) |
| useEffect ban (§K) | **FAIL** — TextField + NumberField violate the ban |
| ESLint enforcement | **FAIL** — package `.eslintrc.cjs` not loaded by root flat config |
| Roz Finding 1 closure | PASS — 8 color-arm tests added (Body + Caption now 100%) |

---

## Deviation Rulings

### Deviation 1: DateField stub — ACCEPTED with ADR amendment

ADR Step 6 AC says "iOS-native DateTimePickerIOS in Gorhom sheet." `DateTimePickerIOS` removed from RN 0.75+; `@react-native-community/datetimepicker` not installed. Stub calls `host.onToast` on press; T-099 verifies onPress wires. **Cal must amend ADR Step 6 ACs** to move full native-picker AC to Step 8.

### Deviation 2: Picker stub — ACCEPTED

Hidden option list (`height: 0`) preserves dispatch testability. T-100 verifies selection dispatches `set`. Gorhom sheet integration matches Step 8 pattern.

### Deviation 3: sampleSpec.ts NOT moved to protocol package — ACCEPTED

`packages/protocol/test/` exists but moving without codegen-drift infrastructure (Step 12) creates inconsistent partial migration. Cal task at Step 12.

### Deviation 4: useEffect in TextField + NumberField — **REJECTED (Ruling B)**

ADR §K bans useEffect outside `src/v0/ai/` and `src/v0/a11y/`. Two production components carry `useEffect` in banned territory. **Worse:** stale-closure bug — `focused` is captured in closure but absent from `[boundValue]` deps. External resets during active typing can incorrectly overwrite the draft. The bug becomes worse in Step 7 (ListItemContext writes to same slot from sibling components).

**Required fix:** derived-state ref-guard pattern during render, no useEffect:

```typescript
const prevBoundValueRef = React.useRef(boundValue)
if (prevBoundValueRef.current !== boundValue && !focused) {
  prevBoundValueRef.current = boundValue
  setDraft(boundValue)
}
prevBoundValueRef.current = boundValue
```

Same line count, no stale closure, no §K violation.

---

## T-ID Coverage

All 20 ADR-spec'd Step 6 T-IDs (T-087..106) present and passing.

---

## Findings

### Finding 1 (GATING) — useEffect violates §K + stale-closure bug

Files:
- `packages/a2ui-renderer/src/v0/components/inputs/TextField.tsx` lines 59-63
- `packages/a2ui-renderer/src/v0/components/inputs/NumberField.tsx` lines 48-52

**Fix:** derived-state ref-guard pattern (above).

### Finding 2 (GATING) — ESLint useEffect ban silently inactive

File: `packages/a2ui-renderer/.eslintrc.cjs`

The package-level `.eslintrc.cjs` (legacy ESLint config format) is not loaded by the root `eslint.config.mjs` (ESLint 9 flat config). Confirmed via `npx eslint --print-config`. The `no-restricted-syntax` useEffect ban is absent from effective config for `src/v0/components/inputs/*`. Both Step 6 components passed `pnpm lint` despite violating the ban.

This was pre-existing (Step 1 carry-forward) but Step 5 components didn't trip it. Step 6 made the gap visible.

**Fix:** Migrate `.eslintrc.cjs` rules into root `eslint.config.mjs` as scoped flat-config blocks for `packages/a2ui-renderer/src/v0/**`. Pattern:

```js
{
  files: ['packages/a2ui-renderer/src/v0/**/*.{ts,tsx}'],
  ignores: ['packages/a2ui-renderer/src/v0/{ai,a11y}/**', 'packages/a2ui-renderer/src/v0/state/useRendererState.ts'],
  rules: {
    'no-restricted-syntax': [
      'error',
      {selector: "CallExpression[callee.name='useEffect']", message: 'useEffect is banned in V0 renderer code per ADR-0006 §K.'}
    ],
  },
}
```

After migration, verify the ban fires by running lint on the unfixed input components — should error.

### Finding 3 (Advisory) — NumberField collectionField dispatch path untested

`NumberField.tsx` line 113 (clamped-value dispatch in `collectionField` branch). Step 7 (Lists tier) will exercise this path. Not gating Step 6 fix-up.

### Finding 4 (Advisory) — TextField onFocus inline arrow not covered

`TextField.tsx` line 115. MT-06 (deferred TextField focus border snapshot) related. Step 9 task.

---

## Roz Finding 1 Closure (Step 5 Carry-Forward) — CLOSED

- Body color-arm tests (4): `fg-faint`, `success`, `warning`, `danger` — added at `Body.test.tsx:157-203`. Body 100% coverage.
- Caption color-arm tests (4): `fg`, `success`, `warning`, `danger` — added at `Caption.test.tsx:166-212`. Caption 100% coverage.

---

## Required Fixes for Round 2

1. **Remove `useEffect`** from `TextField.tsx` and `NumberField.tsx`. Replace with derived-state ref-guard pattern.
2. **Migrate ESLint rules** from `packages/a2ui-renderer/.eslintrc.cjs` to root `eslint.config.mjs` as scoped blocks for `packages/a2ui-renderer/src/v0/**`. Carve out `ai/` and `a11y/` and `state/useRendererState.ts`. Verify ban fires by temporarily reintroducing useEffect into a test file (or running on git history pre-fix).
3. **Verify all 314 V0 tests still pass** after the fix.
4. **Add a focus-during-external-reset test** for both TextField and NumberField — verify draft is NOT overwritten while user is focused (the stale-closure bug fix produces correct behavior; lock it in).

After fixes land, scoped re-run: typecheck, lint, both test suites.

---

## Cal Tasks (Non-Gating, Paperwork)

1. **ADR Step 6 amendment:** DateField/Picker AC text update (stub in Step 6, full native in Step 8).
2. **§K amendment:** `useReducedMotion` second exception (Step 3 carry-forward, still open).

---

## Roz's Assessment

The inputs tier is structurally sound — binding resolution, dispatch shape, accessibility roles, hit targets, theme tokens all correct. The 8 color-arm tests close Step 5 Finding 1 cleanly. T-ID coverage is complete.

The `useEffect` issue is gating because it carries a real bug, not just a §K violation. The dep array misses `focused`, and the bug surfaces in Step 7's collectionField writes through ListItemContext. The fix is mechanical and small.

The ESLint enforcement gap is the more concerning systemic issue. A rule that doesn't enforce isn't a rule. Migrate it to flat config, verify it fires, and we have actual protection against future violations.

Both fixes together should be a single scoped commit. After the round-2 QA passes, Step 7 unblocks.

# QA Report — ADR-0006 Step 10 (4 nav patterns + `<Renderer>` = Milestone B)

_Reviewed by Roz — 2026-05-09_

## Verdict: FAIL

| Check | Status | Details |
|---|---|---|
| Type Check | FAIL | 4 errors across renderer + mobile |
| Lint | FAIL | 9 errors: 3× `useEffect` ban, 1× `require()` ban, 5× unused vars |
| Tests (node) | PASS | 211 passed, 0 failed |
| Tests (RN/jest-expo) | FAIL | 540 passed, 7 failed (DateField ×3, Picker ×4) |
| Complexity | PASS | All nav files under CCN 10, under 120 lines |
| Security | PASS | No secrets, no injection vectors |
| Dependencies | PASS | No new deps; Gorhom + react-navigation already in tree |

---

## Blocking issues

### TC-01 — `independent` prop not on `NavigationContainer`
`packages/a2ui-renderer/src/v0/nav/StackNav.tsx:86`

The installed `@react-navigation/native` does not accept `independent`. Remove it; StackNav is already inside the renderer's own context.

### TC-02 — `sampleSpec.ts` violates current protocol schema
`packages/a2ui-renderer/src/v0/__demo__/sampleSpec.ts:34, 99, 120`

- L34: `schema` is not a Collection prop — schema uses `fields`.
- L99: `direction` is not in the List schema.
- L120: FAB requires `accessibilityLabel` (required, not optional).

Cascades into both renderer and mobile typecheck. Also: `__V0_SAMPLE_SPEC` would be rejected by Zod at runtime on device — Milestone B demo would fail to mount.

### LE-01 — `useEffect` in three nav components (ADR §K violation)
- `nav/StackNav.tsx:78`
- `nav/TabsNav.tsx:52`
- `nav/ModalOverlayNav.tsx:63`

Used for primitive registration / cleanup. The use case is defensible (lifecycle coordination, not app logic) but the exemption is undocumented. Either add nav files to the §K exemption list in `eslint.config.mjs` with rationale, or refactor out.

### LE-02 — `require()` import in DateField
`packages/a2ui-renderer/src/v0/components/inputs/DateField.tsx:59`

```ts
const mod = require('@react-native-community/datetimepicker')
```

`@typescript-eslint/no-require-imports` blocks. Use dynamic `import()` in try/catch, or moduleNameMapper + `import type` with conditional factory.

### TF-01 — 7 test failures from DateField/Picker Gorhom refactor
- DateField: T-0006-091, -092 (snapshots stale — new BottomSheetModalProvider wrapper); T-0006-099 (asserts old `onToast` stub behavior; new impl opens Gorhom sheet)
- Picker: T-0006-093, -094 (snapshots stale); T-0006-100 ×2 (test queries `picker-option-*` testIDs but options live inside the sheet — must `present()` first)

Tests must be rewritten for the sheet-interaction model.

---

## Non-blocking notes

### NB-01 — T-0006-173 Milestone B integration is shallow
`nav/Renderer.test.tsx:280–308`

ADR AC says: mount, fire navigate, **assert screen changed**, fire back, **assert reverted**, mutate slot, **assert binding re-resolves**.

Actual test: `expect(() => fireEvent.press(...)).not.toThrow()`. Tautological — passes against any non-throwing implementation, including one that doesn't navigate at all. Mocked NavigationContainer doesn't swap content, so there's nothing to assert on. **Milestone B's "interactive demo" claim is currently unverified by automated tests.**

### NB-02 — T-0006-172a tests the wrong code path
`nav/Renderer.test.tsx:130–156`

Test uses `nav: 'none'` spec, which fires `navigate-on-none-nav`, not `back-on-empty-history`. Assertion is `toHaveBeenCalled()` rather than `toHaveBeenCalledWith('back-on-empty-history')`. Middleware unit test at `navigation.test.ts:82` covers it correctly; the Renderer-level integration is missing.

### NB-03 — Unused test imports
`act`, `waitFor`, `buildInitialRendererState` imported but unused. Suggests intent to write back-navigation tests that never landed.

### NB-04 — `createNavigationContainerRef()` in render body
`StackNav.tsx:56` — called every render instead of `useRef`. Production correctness risk; mock hides it.

### NB-05 — DateField/Picker scope justified
Not creep. They were touched because Step 10 adds the Gorhom mock in `jestSetup.js`; the functional refactor (stub → real sheet) closes Step 6 Deviations 1 & 2. The problem is just that tests weren't updated.

---

## Roz's read

The four nav patterns themselves are structurally sound — `back-on-empty-history` signal name matches the closed enum, `ModalOverlayNav` swap behavior is correctly implemented at L67–69, HostCallbacks shape matches §G post-rev-2 (no `onShare`, correct `NavigationErrorSignal` enum). `jestSetup.js` mocks are at the right level (infrastructure, not renderer internals).

What failed is the seams. The fixes are all single-pass:
1. Drop `independent` from `NavigationContainer`
2. Fix `sampleSpec.ts` against actual schema
3. Either exempt nav files in `eslint.config.mjs` or refactor `useEffect` out
4. Replace `require()` in DateField with dynamic `import()` or jest mapper
5. Update DateField + Picker tests for Gorhom sheet interaction model
6. Strengthen T-0006-173 with real assertions (NB-01 — should not be deferred; it's the Milestone B gate)
7. Fix T-0006-172a to actually test `back-on-empty-history` (NB-02)

None of this is architectural. All fixable in one round. But the type check and tests must be green before this milestone closes.

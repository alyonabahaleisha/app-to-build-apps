# QA Report — Step 8, ADR-0005 (Design-System Scaffold + Tokens + Theme)

_Reviewed by Roz — 2026-05-08_

## Verdict: PASS WITH NOTES

| Check | Status | Details |
|---|---|---|
| Type Check | PASS | Exits 0, no errors |
| Lint | PASS | 0 errors in design-system. 62 pre-existing warnings in `a2ui-renderer/` — unchanged |
| Tests | PASS | 99/99 across 2 suites (`tokens.test.ts`, `theme.test.ts`) |
| Coverage | N/A | Token/theme files are 100% exercised in practice |
| Complexity | PASS | tokens.ts 178 lines, theme.ts 84 lines, index.ts 18 lines. CCN ≤ 2 |
| Security | PASS | No secrets, no injection surface |
| Dependencies | PASS | `@app-creator/protocol` in `dependencies` (runtime), not devDependencies |

---

## Per-AC Verification

All 5 ACs CONFIRMED. Token cardinalities exact (6 spacing, 5 radii, 6 type roles per stance, 3 elevations, 4 motion). 10 stance-locked colors per stance + 12 accent/accent-fg pairs match revised UX doc. `theme(stance, palette)` returns `ResolvedTheme` with all token names resolved. All 12 contrast pairs ≥4.5:1. `tokens.ts` does NOT export `Stance` or `Palette` types.

---

## Per-Test-ID Checklist (35 IDs)

All 35 IDs present and covering correct assertions.

---

## Contrast Revision Verification (5 Revised Pairs)

| Pair | Pre-revision | Post-revision | Computed ratio | ≥4.5:1 |
|---|---|---|---|---|
| productive/health | `#0E9F6E` | `#0A7048` | 6.13:1 | PASS |
| productive/social | `#E84B73` | `#C73456` | 5.18:1 | PASS |
| expressive/health | `#5B8F4D` | `#4A7438` | 5.46:1 | PASS |
| expressive/social | `#C8527E` | `#B7456E` | 5.13:1 | PASS |
| expressive/play | `#C26F1F` | `#A85A14` | 5.08:1 | PASS |

Full 12-pair re-computation: lowest 4.65:1 (expressive/learn — unchanged in revision), highest 7.29:1 (expressive/money). All clear WCAG AA body.

---

## T-0005-218 (Typecheck-Only) Verification

`tokens.ts` line 10 uses `import type {Stance}` — type-only import, not a value export. Dynamic-import runtime guard at T-0005-218 fails on `Stance`/`Palette`/`StanceSchema`/`PaletteSchema` if any appears in export keys. T-218 specific and sufficient.

## T-0005-218a (MT-5 Freeze) Verification

`theme.ts` line 64: `return Object.freeze({...} satisfies ResolvedTheme)`. Test at theme.test.ts:239–267: (1) `Object.isFrozen(t) === true`, (2) mutation throws, (3) second `theme()` call returns unmodified original. Mutation wrapped in try/catch so third assertion fires regardless of strict-mode.

## F-08 Reconciliation

T-0005-198a (productive/play) and T-0005-198b (expressive/play) both present. `ALL_COMBOS` covers all 12 stance×palette pairs. F-08 closed.

## Hex Cross-Reference: UX Doc vs tokens.ts

All 32 hex/rgba values match exactly between `tokens.ts` and the REVISED 2026-05-08 UX doc table.

## ESM / CLAUDE.md Compliance

All clean. ESM extensions, no deep imports, no console.log, `pnpm-workspace.yaml` picks up the package via glob.

---

## Issues Found

### Finding 1 — Non-blocking (ADR staleness)

ADR line 1423 (T-0005-188 description) reads `accent: '#5B8F4D'` — pre-revision value. Test, tokens.ts, and revised UX doc all correctly use `#4A7438`. Test passes. Prose-only staleness.

**Fix:** update ADR line 1423 to `accent: '#4A7438'`.

### Finding 2 — Non-blocking (UX doc inaccuracy)

UX doc line 426 prose says "lowest is 5.08:1, highest is 8.13:1." Actual lowest is 4.65:1 (expressive/learn — unchanged in revision). Actual highest is 7.29:1 (expressive/money). Prose contradicts the table on line 434 immediately below it.

**Fix:** update UX doc line 426 to "lowest is 4.65:1 (expressive/learn), highest is 7.29:1 (expressive/money)."

### Finding 3 — Non-blocking (Build artifact)

`tsconfig.build.json` excludes `**/*.test.ts` but not `test/**/*`. As a result, `test/contrast.ts` compiles into `dist/test/contrast.js`. Not exported via `src/index.ts` so no consumer can import it. Cleanliness issue, not functional.

**Fix:** add `"test/**/*"` to the `exclude` array in `tsconfig.build.json`.

---

## Notes for Step 9 (Icons Module)

1. **Apply Finding 3 fix before Step 9 starts.** Otherwise any test utility added to `test/` will leak into `dist/`.
2. The `IconNamePlaceholderSchema` in `packages/protocol` gets swapped for the 80-value enum in Step 9. T-0005-218 doesn't check for icon names, but re-run theme.test.ts and tokens.test.ts after the protocol change.
3. **Worth flagging to Sable for awareness:** expressive/learn at 4.65:1 passes WCAG AA but falls below the ≥5.0:1 margin the 5-pair revision aimed for. Sable's call whether to tighten — `#8E5DC4` could be darkened. Tests pass as-written.

---

## CI/CD Verification Required: No

## Documentation Update Required: Yes — ADR line 1423 + UX doc line 426

Neither gates Step 9 — informational only.

---

## Roz's Assessment

Colby did the right thing when the math failed: stopped, escalated, applied the revision, updated the tests. The 5 revised pairs all clear with margin. Every hex value in `tokens.ts` matches the UX doc exactly. The 35 test IDs are all present, 99 tests pass, typecheck is clean.

The freeze contract is properly implemented — not just `as const` at the type level, but `Object.freeze` at runtime, with a test that actually attempts a mutation.

Three minor housekeeping items. None gate Step 9. Finding 3 is the only one with a code file to fix; Findings 1 and 2 are documentation corrections. The UX doc prose contradicting its own table is what happens when you revise five values and update the prose summary without re-reading the table. Sable should also be aware that expressive/learn sits at 4.65:1 — it passes, but it didn't benefit from the revision pass.

**Step 9 can proceed after `tsconfig.build.json` is patched.**

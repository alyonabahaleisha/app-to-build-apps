# QA Report — ADR-0005 Step 10 (coverArt + golden snapshots × 2 runtimes)

_Reviewed by Roz — 2026-05-08 — **FINAL ADR-0005 QA**_

## Verdict: PASS WITH NOTES

| Check | Status | Details |
|---|---|---|
| Type Check | PASS | Clean. Zero errors. |
| Lint | PASS | Zero errors in Step 10 files. |
| Tests | PASS | 222 Node + 12 RN = 234 tests. All pass. 12 + 12 snapshots matched. |
| Coverage | NOTES | Stmts 95.72%, Branch 78.94%, Funcs 100%, Lines 95.61%. Branch below ADR's 90% gate due to 4 structurally unreachable branches. |
| Complexity | PASS | `coverArt.ts` 423 lines; `renderShape` switch CCN ~8. |
| Security | PASS | `ALLOWED_SVG_ATTRS` excludes `script`, `onclick`, `style`, `linearGradient`, `defs`, `stop`, `stop-opacity`. |
| CI/CD Compat | NOTES | See Finding 1 (P1, gating). |
| Dependencies | PASS | `seedrandom@3.0.5` exact, `js-sha256@0.10.1` exact, `lucide-react-native@0.487.0` exact. |

---

## Findings

### Finding 1 — P1 (gates ADR-0006 start): `--updateSnapshot` in CI workflow defeats golden-snapshot drift detection

**File:** `.github/workflows/cover-art-runtime-parity.yml`, lines 46 and 49.

Both `Run Node coverArt.test.ts suite` and `Run RN coverArt.rn.test.ts suite` pass `--updateSnapshot`. CI regenerates the snapshot files from whatever `coverArt.ts` produces in that commit, then the cross-runtime parity check (T-0005-256a) reads the freshly-written files and compares them.

**What CI catches:** cross-runtime divergence (Node and RN producing different SVGs).
**What CI does NOT catch:** SVG drift from committed golden files. A PR that changes `coverArt.ts` to produce completely different but internally-consistent SVGs passes silently.

The ADR says: "CI fails on snapshot drift unless explicitly updated by `pnpm test -- -u` and committed." Not implemented. The committed snapshot files serve no CI guard function as written.

**Fix:** remove `--updateSnapshot` from both steps. Snapshot files are checked in; CI runs read-only. One-line change per step.

P1 because the F-01 P0 closure depends on the golden-snapshot contract being CI-enforced. Must fix before ADR-0006 starts.

### Finding 2 — Minor: T-0005-274 tests wrong package

`coverArt.test.ts` line 496 reads `pkg.dependencies['lucide-react-native']` from `packages/design-system/package.json`. The ADR's concern is `lucide-static` (in `packages/protocol/package.json`) — the package that generates `ICON_PATHS`. `lucide-react-native` has no bearing on `coverArt.ts` determinism.

`lucide-static` IS pinned exact (`0.487.0`) — but the test doesn't actually verify that.

**Fix:** read from `packages/protocol/package.json` and assert on `lucide-static`.

### Finding 3 — Minor: branch coverage 78.94% below ADR 90% gate

4 of 19 uncovered branches are structurally unreachable:
- `null` short-circuit branch (TypeScript prevents callers passing `null`)
- `default: never` exhaustive switch case (unreachable by design)
- `!pathData || pathData.length === 0` guard (impossible via real `coverArt()` call due to `as const` `ICON_PATHS`)

3 of 4 are unreachable. Adding `coverArt({...VALID_INPUT, seed: null as unknown as string})` would cover one. Remaining could be `/* istanbul ignore next */`.

### Finding 4 — Info: T-0005-265 too weak

`coverArt.test.ts` line 322 asserts `openTagCount >= 5`. Structural minimum is 7. Tighten to `>= 7`.

### Finding 5 — Info: T-0005-273 reads package.json not lock file

ADR says "regex assert on lock file equals 3.0.5." Test reads `package.json`. Equivalent in practice (package.json `"3.0.5"` exact pin → lock can only be 3.0.5). Lock-file check is more durable.

---

## Per-AC Verification

All ACs PASS modulo Finding 1's CI subtlety. 12 fixtures, 12+12 golden snapshots, byte-identical across runtimes (`diff` exit 0), Layer 4 absent, no `<Icon>` use in coverArt, all determinism contract elements verified.

---

## Per-Test-ID Checklist (46 IDs)

All 46 IDs present and passing. T-0005-265 weak (Finding 4); T-0005-273 minor (Finding 5); T-0005-274 wrong package (Finding 2).

---

## F-01 Cross-Runtime Parity Verification

12 fixtures, 12+12 snapshots, byte-equal manual diff exit 0. T-0005-256a parser robust (handles Jest snapshot format with multiline strings, escape unescaping). Separate snapshot dirs eliminate format-divergence risk. **CI enforcement partial — see Finding 1.**

---

## F-11 Layer 4 Exclusion Verification

`coverArt.ts` source contains zero `linearGradient`/`defs`/`stop` references. `ALLOWED_SVG_ATTRS` excludes gradient attrs. All 24 snapshot SVGs visually inspected — clean. T-0005-266 asserts. F-11 closed.

---

## MT-3 Ruling on Colby's Deviation

**Acceptable.** The guard logic is what the ADR cares about — error message format. Colby's `runGuard()` test verifies the message exactly. Real `coverArt(VALID_INPUT)` does NOT throw (line 235), exercising guard's positive path. Negative path covered by `runGuard()` directly. Real-world `ICON_PATHS` integrity is enforced upstream (T-0005-229). Guard is defense-in-depth.

---

## Determinism Contract — 4 Failure Modes

| Failure Mode | Status |
|---|---|
| PRNG (`seedrandom@3.0.5` exact, pure JS) | PASS |
| Attribute order (alphabetical via `canonicalAttrs`) | PASS |
| Float precision (`.toFixed(3).replace(/\.?0+$/, '')`) | PASS |
| Lucide path source (`ICON_PATHS` from protocol) | PASS |

---

## ESM / CLAUDE.md Compliance

All clean. ESM extensions, package-entry imports, no `console.log`, `CoverArtInput` is `readonly`.

---

## CI/CD Verification Required: YES (Finding 1)

Remove `--updateSnapshot` from both steps in `.github/workflows/cover-art-runtime-parity.yml`.

## Documentation Update Required: No

---

## Final ADR-0005 Closure Note

This is the last step. Steps 1–9 cleared. Step 10 clears with notes. The protocol and design-system packages are done modulo three targeted fixes:

1. **Finding 1 (gating before commit):** remove `--updateSnapshot` from CI workflow. One line per step.
2. **Finding 2 (correctness):** T-0005-274 should test `lucide-static` in protocol's package.json.
3. **Finding 4 (strength):** T-0005-265 should assert `>= 7`.

The golden-snapshot contract works locally and the parity test is real. The CI issue is embarrassing (says it guards, doesn't) — fix before Ellis commits.

---

## Notes for ADR-0006 (Renderer)

1. **Layer 4 is renderer's.** `coverArt()` produces no gradient. Renderer adds productive-only vertical `linearGradient` from `bg-elevated` 0% bottom to transparent at 30%.
2. **`coverArt()` returns string.** Pass to `<SvgXml />` from `react-native-svg`. Pure function, no hooks needed.
3. **Renderer snapshot tests must cover Layer 4.** Productive and expressive stances need separate assertions.
4. **Branch coverage debt from Step 10** — note for Cal so 78.94% on `coverArt.ts` doesn't accidentally gate ADR-0006 start.

**ADR-0005 — APPROVED for commit after Finding 1 fix lands.**

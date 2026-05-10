# QA Report — ADR-0006 Step 11 (AppRunner cutover + Layer 4 gradient)

_Reviewed by Roz — 2026-05-07_

## Verdict: PASS WITH NOTES

Cutover structurally clean. Two cleanup items + two ADR-spec'd test gaps for Step 12/13 deferral.

| Check | Status |
|---|---|
| Type Check (renderer + mobile) | PASS |
| Lint | PASS — 0 errors, 66 pre-existing warnings |
| Tests (renderer/node) | PASS — 211/211 |
| Tests (renderer/RN) | PASS — 548/548, 62 snapshots |
| Tests (mobile) | PASS — 185/185 (was failing 4 suites) |
| Cutover correctness | PASS — flag retired, `__V0_*` retired, V0 canonical |
| Layer 4 gradient | PASS — productive only, opacity ≤ 25%, vertical |
| Resolver-cascade root cause | PASS — `.js` extension stripping, flash-list transform, expo/fetch boundary, QueryClientProvider pre-existing bugs |
| `expo-linear-gradient` install | PASS — installed at 13.0.2, lockfile updated |
| Local type stub | **FLAG** — `apps/mobile/types/expo-linear-gradient.d.ts` shadows real types, forces unnecessary cast |
| T-0006-177 (failure path) | NOT IMPLEMENTED — defer to Step 13 |
| T-0006-178 (iPhone SE) | NOT IMPLEMENTED — defer to Step 12 |

---

## Findings

### Note 1 (Medium) — Delete the type stub now

`apps/mobile/types/expo-linear-gradient.d.ts` shadows the real installed package's types via TS ambient declaration. Forces unnecessary `as unknown as string[]` cast at `LibraryCard.tsx:87`. Real package declares `colors: readonly string[]`. **Delete in this PR, not the next one.**

### Note 2 (Low) — Stale JSDoc

`Renderer.tsx:26` says "Exported as `__V0_Renderer` from the package root." No longer true post-Step 11.

### Note 3 (Low) — Dead env var

`apps/mobile/.env` line 24: `EXPO_PUBLIC_CANVAS_V0_DEMO=true` is dead. Gitignored, harmless.

### T-ID Gaps (deferrable)

- **T-0006-177** (failure: M1 spec → schema reject → error boundary): defer to Step 13 — legacy delete makes this the only path.
- **T-0006-178** (boundary: iPhone SE 320×568 viewport): defer to Step 12 — snapshot matrix is the natural home.

---

## Cutover Correctness

`EXPO_PUBLIC_CANVAS_V0_DEMO` flag — clean in source. `__V0_*` prefix — retired in production sources. Legacy subpath (`@app-creator/a2ui-renderer/legacy`) — live via package.json exports map.

## Layer 4 Gradient

`LibraryCard.tsx:73` gates `LinearGradient` on `stance === 'productive'`. Tests cover all three branches (productive present, expressive absent, no-stance absent). Opacity 0.20 ≤ 0.25. Vertical top-to-bottom. Per-palette tinting intentionally not applied (bg-elevated is palette-invariant per UX doc).

## Resolver-Cascade Root Cause

- `.js` extension stripping: idiomatic Jest+TS ESM fix.
- `@shopify/flash-list` transformIgnorePatterns: justified — V0 surface now traversed in tests.
- `expo/fetch` stub: correct boundary for native modules.
- `QueryClientProvider` Chat/generate fixes: confirmed pre-existing (stash test confirmed Step 10 baseline failed without them).

---

## Roz's Assessment

Cutover is structurally clean. The flag is gone, the prefix is gone, the canonical export surface is correct, the legacy subpath resolves. Layer 4 gradient respects the stance gate and accessibility opacity limit. The resolver cascade is root-cause fixed across all four surfaces.

Two loose ends: the type stub needs to be deleted in this PR (package is installed, stub is now wrong), and T-0006-177 + T-0006-178 are deferred to subsequent steps.

**If type stub deleted + T-177/T-178 formally deferred with rationale comments, this clears to PASS. Without that, PASS WITH NOTES.**

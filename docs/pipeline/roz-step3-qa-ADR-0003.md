# QA Report — ADR-0003 Step 3: Image + Heading + Text + render.tsx coverage closure

_Reviewed by Roz — 2026-05-02_

## Verdict: PASS WITH NOTES

---

| Check      | Status          | Details                                                                                                                |
| ---------- | --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Type Check | PASS            | All 4 workspaces clean.                                                                                                |
| Lint       | PASS WITH NOTES | 0 errors. 54 `no-explicit-any` warnings — all intentional `toJSON()` casts. T-0003-006b 11/11.                         |
| Tests      | PASS            | 120/120 in renderer package. 11 suites, 0 failures, 17 snapshots match.                                                |
| Coverage   | PASS WITH NOTES | 100% stmts / 98.94% branches / 96.77% functions. render.tsx 100/100/100/100. Image.tsx 100/100/66.66/100. See Issue 1. |
| Complexity | PASS            | Image 88 LOC, Heading 69 LOC, Text 55 LOC.                                                                             |

## T-ID Verification

All 23 mandatory T-IDs (T-0003-039..054) present and assertions specific. 8 named snapshot T-IDs each in own `it` block. Happy:Failure ratio passes gate (12:3).

## Pressure-Test Results

**T-0003-050b** — PASS, genuine. Direct prop-invocation of `onError` rather than RN mock interception, but behavioral outcome identical (no-op invoked, no throw). Test verifies component remains mounted post-invocation.

**T-0003-050c** — PASS, genuine. `as any` cast bypasses Zod, level-99 clamps to 1, asserts header role + display fontSize + spacing.lg paddingTop.

**T-0003-054** — PASS, with baseline-provenance note. See Issue 3.

**Snapshot updates (Container/List + render.step3)** — PASS semantically. Diff is structural enrichment from Heading/Text extraction (skeleton inline `<Text>` → full themed components), not behavioral drift. CLAUDE.md §8 reviewer note absent — see Issue 2.

**`RendererTypography.fontWeight` narrowing** — PASS. No regression. Step 1 tests pass 120/120.

**EventEmitterMock + jest moduleNameMapper** — PASS. Standard babel-jest workaround for RN's Flow mapped types in `EventEmitter.js`. Clean, well-commented.

**Step 2 Issue 2 closure** — CLOSED. render.tsx line 19 (initialViewId not found) and line 59 (List branch) both exercised by `render.step3.test.tsx`. Coverage 100/100/100/100 on render.tsx.

**Image.tsx 66.66% functions** — PARTIALLY artifact. Letterbox-branch `onError` covered by T-0003-050b. AspectRatio-branch `onError` (line 56) genuinely uncalled. Both are identical no-ops, so no behavioral consequence — but Colby's "Istanbul artifact" framing is imprecise.

## Issues Found

### Issue 1 (Minor): Image.tsx aspectRatio-branch `onError` uncalled

`Image.tsx` line 56. The aspectRatio-path `onError` is a genuinely uncalled no-op. Both `onError` callbacks (aspectRatio + letterbox) are identical, and the letterbox path is verified. Coverage gates still met; functions gap is in a no-op.

**Remediation:** Step 4 should add `imgEl.props.onError()` invocation to T-0003-047 or T-0003-050 to close the Istanbul gap. One line.

### Issue 2 (Minor, CLAUDE.md §8 process debt): Snapshot update notes absent

Container.test.tsx.snap and List.test.tsx.snap regenerated due to richer Heading/Text post-extraction output. Justified, but CLAUDE.md §8 requires explicit code-review notes documenting the regeneration rationale.

**Remediation:** Step 4 PR should include a comment in `render.step3.test.tsx` (or commit message when Ellis groups) explaining: Container/List snapshots updated due to Heading/Text extraction enriching child output; render.step3 snapshots are new baselines since no ADR-0002 snapshot existed.

### Issue 3 (Note, T-0003-054 baseline provenance): Regression test captures Step 3 output, not ADR-0002 skeleton

The ADR specified comparison against ADR-0002's snapshot. None existed on disk. Test creates a fresh baseline against the post-extraction renderer. Will guard future regressions, but did not verify continuity from ADR-0002's skeleton (which was semantically different — no theme tokens). ADR phrasing was aspirational; implementation is correct.

**No remediation required.** Document for Step 4 handoff: T-0003-054 baseline is Step 3 output, not ADR-0002 skeleton.

### Issue 4 (Carry-forward, Step 2): T-0003-038c key-stability vacuous. Unchanged.

### Issue 5 (Carry-forward, Step 1): `useA2UIState.ts` decrement default-by branch gap. Unchanged.

## Roz's Assessment

Step 3 is solid. Three new components match the ADR exactly. render.tsx 100% coverage including all NodeRenderer branches and the initialViewId-not-found fallback. EventEmitterMock workaround is clean.

Two minor cleanups for Step 4: (1) close the Image.tsx aspectRatio-path onError gap with one line, (2) add snapshot-regeneration rationale per CLAUDE.md §8.

**Step 4 (Button + dispatcher integration) may proceed.**

— Roz

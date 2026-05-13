# V0 Close-Out Handoff

_Last updated: 2026-05-12 by Claude (autonomous-mode session)_

## TL;DR

**V0 code surface: COMPLETE.** All 6 ADRs closed locally. 65 commits ahead of `origin/agent/M2-VS-01`. Never pushed.

**Blocking V0 ship:**
1. `git push` (deliberately not run)
2. EAS dev-client build + on-device E2E smoke test
3. CI run for Docker-gated integration tests
4. Working-tree cleanup (see below)

---

## Branch state

- **Branch**: `agent/M2-VS-01`
- **Ahead of remote by**: 65 commits
- **Last commit**: `9a43307 feat(mobile): ADR-0011 Step 14 — E2E happy-path test (FINAL V0 close-out)`

## ADRs — all closed locally

| ADR | Status | Final commit |
|---|---|---|
| ADR-0007 LLM V0 cutover | ✅ CLOSED | (earlier, pre-session) |
| ADR-0008 Universal Links | ✅ CLOSED | `033520d` Step 6 / `ee4e73a` Step 7 |
| ADR-0009 V1 catalog Phase 1 | ✅ CLOSED | `e10b02e` Step 10 (53 components, 106 snapshots, PROMPT_VERSION v0.2.0, 225 eval prompts) |
| ADR-0010 Prompt eval loop | ✅ CLOSED | `20e2615` Step 7 docs / `90c4a9d` Step 5 CI guard (Step 6 stretch deferred) |
| ADR-0011 Mobile V0 shells | ✅ CLOSED | `9a43307` Step 14 E2E |
| ADR-0013 SIWA migration | ✅ CLOSED | `0900e89` Step 5 |

## Key recent commits (most recent first)

- `9a43307` ADR-0011 Step 14 E2E (FINAL)
- `fc6513b` ADR-0011 Step 13 DevMenu
- `d949cd5` ADR-0011 Step 12 LinkingProvider
- `033520d` ADR-0008 Step 6 share affordance
- `20e2615` ADR-0010 Step 7 docs
- `13330c4` ADR-0011 Phase 2 PR 5 SettingsSheet
- `97a1c70` ADR-0008 Step 5 pendingClone
- `ee4e73a` ADR-0008 Step 7 telemetry
- `90c4a9d` ADR-0010 Step 5 CI guard
- `e10b02e` ADR-0009 Step 10 (CLOSES ADR-0009)
- `a7b4aac` ADR-0009 Step 9 snapshot matrix 56→106
- `d2ca055` ADR-0009 Step 7 Content/Media compounds
- `f731e93` ADR-0008 Step 4 mobile Universal Link parser
- `8d7f3c3` ADR-0009 Step 6 Calendar + Heatmap
- `711da89` ADR-0011 Phase 2 PR 4 RunScreen

## Working tree state (uncommitted, NEEDS DECISION)

**21 uncommitted items** — these are leftovers from concurrent workstreams that never landed in their own commits. Review each before pushing:

### Modified files (likely should land or revert)

- `apps/mobile/.env.example` — ADR-0013 auth provider env var additions
- `apps/mobile/eas.json` — ADR-0013 production env var
- `apps/mobile/metro.config.js` — likely related to native-module stubs (below)
- `apps/mobile/package.json` — likely related to stubs/lockfile
- `apps/mobile/src/lib/auth/magicLinkProvider.ts` — @deprecated annotation
- `apps/mobile/src/lib/routes/types.ts` — AppRunner route type removal
- `apps/mobile/src/screens/Create/CreateScreen.test.tsx` — AppRunner cleanup
- `apps/mobile/src/screens/Create/suggestedPrompts.ts` — unknown change
- `apps/mobile/src/screens/OutOfScope/OutOfScopeScreen.test.tsx` — AppRunner cleanup
- `apps/mobile/src/screens/QuotaExhausted/QuotaExhaustedScreen.test.tsx` — AppRunner cleanup
- `eslint.config.mjs` — `EXPO_PUBLIC_AUTH_PROVIDER` lint rule from ADR-0013 Step 3
- `pnpm-lock.yaml` — date-fns / expo-document-picker / etc. dep additions

### Deletions (ADR-0011 Step 10 AppRunner cleanup leftover)

- `apps/mobile/src/screens/AppRunner/RenderErrorBoundary.tsx` + `.test.tsx`
- `apps/mobile/src/screens/AppRunner/components/PublishSheet.tsx` + `.test.tsx`
- `apps/mobile/src/screens/AppRunner/index.tsx` + `.test.tsx`

### Untracked (likely Metro bundler stubs)

- `apps/mobile/.stubs/expo-apple-authentication-stub.js`
- `apps/mobile/.stubs/expo-document-picker-stub.js`
- `apps/mobile/.stubs/react-native-svg-stub.js`

**Recommendation**: One follow-up commit "chore(mobile): consolidate ADR-0011/0013 cleanup leftovers" that lands the AppRunner deletions, env file updates, eslint rule, and lockfile. The `.stubs/` files need investigation (Metro resolver stubs for native deps in dev-client builds — likely from earlier dev-client setup).

## Path to V0 ship

### 1. Cleanup (immediate)
- Review the 21 uncommitted items
- Consolidate into 1-2 follow-up commits OR revert items that shouldn't ship
- Audit `.stubs/` directory — confirm Metro config references them; ensure not shipping stubs to production

### 2. Push (when ready)
```bash
git push origin agent/M2-VS-01
```
This is a 65-commit push. Open PR for review.

### 3. CI verification (auto on push)
- Watch `.github/workflows/eval.yml` — should run PROMPT_VERSION bump check + eval
- Watch `.github/workflows/renderer-snapshot-matrix.yml` — 106 snapshots
- Watch Docker-gated integration tests (~410 in services/api) — should pass with real Postgres

### 4. EAS dev-client + on-device smoke
```bash
cd apps/mobile
eas build --profile development --platform ios
```
Install on device/simulator, then `pnpm --filter @app-creator/mobile start` and walk through:
- SignIn (SIWA flow against real Apple Developer credentials)
- Library empty state → tap chip → Create
- Type prompt → tap FAB → Generating
- Receive real spec → Run mounts renderer
- Tap meatball → archive/rename/delete (all real API calls)
- Tap Share → universal link copied to clipboard
- Paste link in Safari/iMessage on another device → Universal Link routes back to app
- Tap link from cold-start vs warm-start
- Test reserved-mode links (`/m/{id}/view`, `/m/{id}/remix`) → "Coming soon" toast

### 5. App Review prep
- Sponsor doc: `docs/product/canvas-v0-prompt-quality-loop.md`
- Reviewer notes: `docs/product/canvas-v0-reviewer-notes.md`
- App Store Connect: bump `buildNumber` (iOS rejects re-uploaded binaries with same number)

## Deferred backlog (non-blocking, cosmetic)

- `clones.ts` double-invalidate (`onSuccess` + `onSettled` both invalidate) — TanStack dedupes; pre-existing from Step 5
- T-0008-140 documentation test pattern (type-system carries enforcement)
- T-0011-246 triple T-ID collision in RunScreen.test.tsx
- T-0011-304 "logs warning" overclaim
- T-0011-321a, T-0011-325, T-0011-326, T-0011-327 (Step 14 test table not fully implemented)
- ADR-0009 ceiling deviation: 35K → 40K char ceiling on `SYSTEM_PROMPT_CATALOG`; 40K → 50K on tool JSON Schema. Roz accepted (Ruling A); ADR-0009 should be amended to record binding values.
- BeforeAfter Reanimated worklet untested (Jest can't drive worklets; only a11y action proxy tested)
- T-0009-137 bundle-size check `.todo` (pending Step 9 snapshot-matrix bundle harness — wait, actually Step 9 already shipped; check if this can be flipped)
- DevSpecContext `syntheticDetailRef` stale-cache concern (Date.now() collision edge case)
- Timeline drift in `2817ae3` Step 4 (130d → 131d ago snapshot bumps; fake-timer fix applied to Calendar/Heatmap in Step 6 R2, but Timeline got `--updateSnapshot` rather than fake timer — should retroactively apply)

## QA paper trail

All Roz QA reports for this session in `docs/pipeline/`:
- `roz-pr5-qa-ADR-0008-step5.md` + `r2`
- `roz-pr6-qa-ADR-0008-step6.md`
- `roz-pr8-qa-ADR-0008-step7.md` + `r2`
- `roz-pr5-qa-ADR-0009.md` + `r2` + `r3`
- `roz-pr4-qa-ADR-0009.md` + `r2`
- `roz-pr5-qa-ADR-0010.md`
- `roz-pr7-qa-ADR-0009-step9.md`
- `roz-pr8-qa-ADR-0009-step10.md`
- `roz-pr6-qa-ADR-0009-step7.md` + `r2`
- `roz-pr5-qa-ADR-0011-phase2.md` + `r2`
- `roz-pr12-qa-ADR-0011.md`
- `roz-pr13-qa-ADR-0011.md` (returned directly by Roz; not saved)
- `roz-pr4-qa-ADR-0011-phase2.md` + `r2`

## Notes about this session

- Session ran in autonomous mode with the user saying "go" / "go parallel" to advance
- Never pushed to remote (session-wide rule)
- Ellis used strict selective staging due to overlapping concurrent workstreams modifying the same files (notably `SessionProvider.tsx` shared between Step 5 pendingClone and Step 6 SettingsSheet)
- ~17 commits landed this session across 6 ADRs
- One R2-cycle pattern caught a real production bug (Step 7 telemetry: RunScreen.tsx passing non-whitelisted `miniAppId`)
- Step 14 R2 caught a real ADR deviation (back from Run went to Create instead of Library — fixed via `goBack()` → `popToTop()`)

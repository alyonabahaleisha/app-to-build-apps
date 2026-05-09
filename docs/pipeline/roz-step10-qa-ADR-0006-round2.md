# QA Report — ADR-0006 Step 10 Round 2 (Surgical Fix)

_Reviewed by Roz — 2026-05-09_

## Verdict: PASS WITH NOTES

| Check | Status | Details |
|---|---|---|
| Type Check (renderer) | PASS | Zero errors |
| Type Check (mobile) | PASS | Zero errors |
| Lint | PASS | 0 errors, 67 warnings (2 new cosmetic — see Notes) |
| Tests (node) | PASS | 211 passed, 18 suites |
| Tests (RN/jest-expo) | PASS | 548 passed, 51 suites, 62 snapshots |
| Security | PASS | No new surfaces |

## Round-1 finding closures

- **TC-01** (`independent` prop) — CLOSED. `NavigationContainer` at `StackNav.tsx:87` clean.
- **NB-04** (ref in render body) — CLOSED. `useRef(createNavigationContainerRef<ParamList>()).current` at `StackNav.tsx:57`.
- **LE-01** (useEffect ban exemption) — CLOSED. `eslint.config.mjs:61–63` adds `src/v0/nav/**` to the §K exemption with rationale comment.
- **NB-01** (tautological navigate test) — CLOSED. Three concrete assertions: navigate-no-error, back-after-navigate-doesn't-fire-empty-history-signal (proves history push), Switch `accessibilityState.checked` transitions false→true via `getByLabelText` after `set` action (genuine end-to-end loop).
- **NB-02** (T-0006-172a literal) — CLOSED. `Renderer.test.tsx:187` asserts `toHaveBeenCalledWith('back-on-empty-history')` literal, using `STACK_SPEC`.
- **NB-03** (unused imports) — CLOSED. Lint reports 0 errors.
- **TC-02** (`sampleSpec.ts` schema) — CONFIRMED CLEAN. `fields` (not `schema`), no `direction` on List, FAB has `accessibilityLabel`. The round-1 read likely caught a transient intermediate state.
- **LE-02** (`require()` disable comment) — CONFIRMED CLEAN at `DateField.tsx:58`.
- **TF-01** (DateField/Picker tests) — CONFIRMED. T-0006-099 and T-0006-100 use the Gorhom sheet interaction model (press trigger → assert sheet visible / press option → assert dispatch). Snapshots passing.

## SAMPLE_SPEC Zod conformance

`Renderer.test.tsx:310–318` runs an explicit `SpecSchema.safeParse(MILESTONE_B_SPEC)` test asserting `result.success === true`. Test passes. Schema conformance verified programmatically.

## Notes (non-gating)

**Unused `eslint-disable` directives at `Renderer.test.tsx:177, 440`** — `// eslint-disable-next-line @typescript-eslint/no-non-null-assertion` is unnecessary on those lines (rule doesn't fire in test files). Warnings only. Sweep in the next PR.

**NB-01 honest limitation** — Test comment at lines 329–371 documents that `RendererStateContext.Provider` is private to `RendererInner`, so direct state observation requires modifying `Renderer.tsx`. The navigate→back-after-navigate indirect proof is the strongest assertion achievable within the current component boundary. If the renderer ever exposes a test hook for state observation, upgrade this test to a direct assertion.

## Roz's read

Every round-1 finding is closed with verifiable evidence. The NB-01 rewrite is genuine — Switch binding re-resolve via `accessibilityState.checked` transition is a real dispatch→reducer→slot→binding→re-render loop test. The navigate→back-after-navigate proof is honest about its observability constraints.

The two `already-resolved` claims (TC-02, LE-02) check out on disk. `sampleSpec.ts` is in the diff, so Colby did touch it — the round-1 read caught it in a partial state.

Step 10 gates are closed. Milestone B demo is runnable.

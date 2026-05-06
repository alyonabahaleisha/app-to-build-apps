# Roz's Test Spec Review — ADR-0003 Renderer

**Reviewer:** Roz | **Date:** 2026-05-02
**Artifact:** `docs/adrs/ADR-0003-renderer.md`
**ADR author:** Cal

---

## Verdict: REVISE

The structural decisions in this ADR are sound, and the test spec is the most thorough one Cal has written. The data-sensitivity table is appropriately scoped for a package that holds no state. Several "MUST NOT" surfaces the prompt required me to probe are either missing entirely or covered with insufficient specificity. The numeric totals table has miscounts that overstate the real total. The dispatch-signature regression is not adequately covered. The determinism test is structurally weak. And the warn-log PII coverage has a gap directly analogous to the `normalizeRow` retro lesson.

These are not cosmetic. Colby needs to know what to write before picking up a keyboard on Step 1.

---

## Category Coverage Table

Legend: ✅ covered | ⚠️ thin / vague | ❌ missing | N/A justified

| Step                                    | Happy |    Failure     | Boundary |  Negative  | Error | Security | Concurrency | Regression |        Breaking        |
| --------------------------------------- | :---: | :------------: | :------: | :--------: | :---: | :------: | :---------: | :--------: | :--------------------: |
| 1 — State engine / theme / logger       |  ✅   |       ✅       |    ✅    |     ✅     |  N/A  |    ✅    |     ✅      |  ⚠️ thin   | ❌ dispatch-sig change |
| 2 — Container + List                    |  ✅   | ❌ no failures |    ✅    |     ✅     |  N/A  |   N/A    |     N/A     |  N/A new   |        N/A new         |
| 3 — Image + Heading + Text              |  ✅   | ❌ no failures |    ✅    |    N/A     |  N/A  |   N/A    |     N/A     |     ✅     |        N/A new         |
| 4 — Button + dispatcher                 |  ✅   |       ✅       |    ✅    |     ✅     |  N/A  |    ✅    |     N/A     |  N/A new   |        N/A new         |
| 5 — Counter                             |  ✅   |       ✅       |    ✅    | ❌ missing |  N/A  |   N/A    |     N/A     |  N/A new   |        N/A new         |
| 6 — TextInput + Toggle                  |  ✅   | ❌ no failures |    ✅    |  ⚠️ thin   |  N/A  |   N/A    |     N/A     |  N/A new   |        N/A new         |
| 7 — Form                                |  ✅   | ❌ no failures |    ✅    |     ✅     |  N/A  |   N/A    |     N/A     |  N/A new   |        N/A new         |
| 8 — AppRunner integration + determinism |  ✅   |    ⚠️ thin     |    ✅    |     ✅     |  N/A  |    ✅    |     N/A     |     ✅     |          N/A           |

---

## Failure:Happy Ratio — Independent Count

Cal's totals row claims 117 new + 5 regression = 122 total. Per-step "New" sums to: 22+16+14+14+13+16+8+14 = 117. But Step 1 has 23 rows (T-0003-001..022 plus T-0003-011b — Cal even annotates this). So Step 1 should be 23 new, total = 118+5 = 123.

Step 3's Regression count says 2, but only T-0003-054 appears tagged as Regression. That is 1 regression test. Cal's per-step summary overcounts Step 3 regression by 1.

Global Failure:Happy = 4:68. This is catastrophic for a renderer ADR where "MUST NOT" behavior is the primary risk surface. The ADR has excellent boundary and negative coverage but almost no Failure category tests. Steps 2, 3, 6, 7, and 8 have literally zero Failure-category tests.

**Important distinction:** Cal is conflating Negative (things that should not happen) with Failure (things that go wrong at runtime). Both are necessary. Negative tests cover behavioral "MUST NOT" invariants. Failure tests cover "what happens when dependencies, inputs, or the environment misbehave." These are different failure modes. The renderer needs both.

---

## AC-R1..R5 Coverage Map

| AC    | Description                                     | Covering Tests                                                                                                                                                                                                                                                                   | Verdict                                                                                                                                                                                                                                                                                                                          |
| ----- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-R1 | All 10 catalog components render                | T-0003-023 (Container), T-0003-033 (List), T-0003-039 (Heading), T-0003-043 (Text), T-0003-047 (Image), T-0003-055 (Button), T-0003-069 (Counter), T-0003-082 (TextInput), T-0003-091 (Toggle), T-0003-098 (Form)                                                                | ✅ All 10 have at least one Happy-path render test                                                                                                                                                                                                                                                                               |
| AC-R2 | Each component honors required + optional props | Container 4 prop combos (T-023..028), Heading levels (T-039..042), Text weight/color (T-043..046), Image aspectRatio/alt (T-047..050), Button variants (T-056..058), Counter step/min/max (T-073..076), TextInput multiline/placeholder (T-083,084), Toggle defaultValue (T-092) | ⚠️ No test covers optional `id` field on nodes (used as state key). What happens when a Button has no id but its action targets a Counter that does? No test covers missing `id` on an interactive node.                                                                                                                         |
| AC-R3 | Snapshot test per props matrix per component    | Steps 2–7 include snapshot tests; Step 8 is the determinism lock                                                                                                                                                                                                                 | ⚠️ Snapshot coverage is thin: Container has 1 snapshot (T-032), not a full matrix. §Step 2 acceptance says "Snapshot tests cover: Container with `direction: row`, `direction: column`, each padding/gap level, each align/justify" but the test table has only T-0003-032 as a single Snapshot entry. Tests don't match the AC. |
| AC-R4 | Reopen produces byte-equal render               | T-0003-113, T-0003-114                                                                                                                                                                                                                                                           | ⚠️ See G-6 — structurally weak                                                                                                                                                                                                                                                                                                   |
| AC-R5 | All 4 action types execute correctly            | T-0003-003 (set), T-0003-004..006 (inc/dec), T-0003-007 (toast), T-0003-008 (navigate), dispatcher integration in T-0003-059..062                                                                                                                                                | ✅ All covered. Note: product spec says "4 action types" but schema has 5 (`increment` and `decrement` are separate). Not a spec gap in the ADR; just a miscount in Robert's AC-R5.                                                                                                                                              |

---

## Gaps Found

**G-1 — Dispatch signature change has no regression test that proves ADR-0002's callers still compile.**

T-0003-021 checks the `render()` function signature, not the `Dispatch` type definition. AppRunner declares `ownerDispatch: Dispatch` and calls it as `dispatch(node.action, _state)`. TS function compatibility allows extra parameters (so this technically isn't breaking), but the reasoning must be in the spec, not left for Colby to discover. Either add a typecheck test that asserts both old and new call shapes compile, or document that this isn't breaking and explain why in T-0003-021.

**G-2 — No Failure tests for Steps 2, 3, 6, 7.**

- Step 2 (Container/List): catch-all `[Unimplemented: <Type>]` fallback being removed in Step 2. After removal, an unknown type falls through. No test that the switch is exhaustive.
- Step 3 (Image): "Image doesn't error on a 404'd URL" is a behavioral contract — needs a Failure test.
- Step 6 (TextInput): What happens when `state[id]` is `null` or `boolean`? T-0003-088 covers `number` only.
- Step 7 (Form): What if `Form.fields` contains a non-field node type (e.g., `Heading`)? Schema allows `fields: A2UINode[]`. No test.

**G-3 — T-0003-059 contradicts the ADR's own dispatch-signature change.**

T-0003-059 says "Press fires `dispatch(node.action, state)` exactly once" — the OLD signature. ADR §D and Step 4 code shape both show `dispatch(node.action)` (no state). Either copy-paste error or an old contract that needs to be re-stated. Fix the test description to match the new contract.

**G-4 — Warn-log payload PII coverage has a gap (the `normalizeRow` lesson).**

T-0003-119 tests render_failed log doesn't include raw spec/original_prompt — good. But three additional warn-level logs (`a2ui_set_type_mismatch`, `a2ui_navigate_unknown_view`, `a2ui_toggle_type_mismatch`) are exercised by T-0003-012/013/095 but those tests don't assert payload shape. `a2ui_set_type_mismatch` will presumably log targetId + value — if value could be a TextInput's contents (a password), that's a leak. Add payload assertions: each log must contain only metadata (targetId, expectedType, actualType, viewId) and explicitly NOT the actual mismatched value.

**G-5 — Counter Button.action clamp path is not tested programmatically.**

T-0003-011 tests the state reducer directly. T-0003-076 tests Counter's own + button. But there is no test that a `Button` node (outside the Counter UI) with `action: {type: 'increment', targetId: 'c', by: 100}` on a Counter with `max: 50` also clamps. ADR §I explicitly justifies clamping with the "Add 100" example — it's the central rationale and it has no direct test. Add T-0003-076b.

**G-6 — Determinism test is structurally weak on two axes.**

First, `JSON.stringify(toJSON())` ≠ `renderHash(spec)`. The render hash is on the spec, the deep-equal is on the rendered tree. T-0003-113 tests render-stability. T-0003-114 tests spec-canonicalization. The ADR conflates them. Make the distinction explicit.

Second, "e.g., the saved Pomodoro Timer" is an escape hatch. An inline spec crafted by the test author will be designed to pass. Require T-0003-113 and T-0003-114 to run against ≥2 distinct fixtures (Pomodoro + Tip Splitter, both real generations from 2026-05-02).

**G-7 — No test for workspace boundary enforcement.**

ADR §D says renderer "cannot import `apps/mobile/src/theme/`." But no test (or CI lint rule) catches a violation. If Colby writes `import {useTheme} from '#/theme'` inside `packages/a2ui-renderer/src/components/Button.tsx`, TS compiles fine and no existing test catches it. Required: a `no-restricted-imports` ESLint rule (or equivalent) that flags imports of `apps/mobile`, `#/theme`, `#/lib/*`, `#/state/*` from within `packages/a2ui-renderer/src/`. Belongs in CI/CD Impact section.

**G-8 — Snapshot discipline gap: claim is inconsistent with table.**

ADR §E says "10 components × ~3 variants = ~30 snapshots." Counting Snapshot-tagged tests: T-032, T-037, T-051,052,053, T-066,067, T-079,080, T-089,090,096,097, T-104 = 14 named snapshot tests in the tables. The ~30 claim is unsupported. Either enumerate every discrete snapshot assertion as its own T-ID, or drop the ~30 claim. Acceptance criteria like "Snapshot tests cover: [list]" without corresponding T-IDs are not testable.

**G-9 — Step 6 Toggle: T-0003-095 covers Boundary but not Failure.**

What happens when the Toggle's Switch component itself throws? RN Switch is finicky on iOS versions per the ADR's own risk table. Is the Error Boundary the only catch? No test for Toggle rendering with a missing `id` (defensive against `any`-cast bypassing Zod).

**G-10 — RenderErrorBoundary fallback copy is undertested.**

T-0003-110 says "renders the fallback copy" — vague. Pin the exact strings: "This app didn't render correctly.", "Try recreating it.", "Back to library". Same pattern as my ADR-0001 G-4 lesson (logger assertions said "logged via `safeMessage`" — vague).

---

## Independently Identified Missing Tests

| #    | Step | Missing test                                                                                                |
| ---- | ---- | ----------------------------------------------------------------------------------------------------------- |
| M-1  | 1    | `useA2UIState` re-called with a different `spec`: does state reset? Stale-key behavior is undefined.        |
| M-2  | 1    | `dispatch` called after component unmount (haptic promise resolving after navigate-back). Should not throw. |
| M-3  | 2    | Container key-as-index reconciliation when children array length changes.                                   |
| M-4  | 3    | Heading with `level` outside 1/2/3 (defensive against discriminator drift). What's the default?             |
| M-5  | 4    | Button with `variant` not in the enum — `variantStyles[unknown]` → `.color` would crash.                    |
| M-6  | 5    | Counter with no `min` and no `max` (unconstrained). Should increment indefinitely.                          |
| M-7  | 5    | Counter at-min snapshot (- disabled). T-079/080 cover zero/max only.                                        |
| M-8  | 6    | TextInput focus border styling change (Sable line 402: "border becomes primary on focus"). No T-ID.         |
| M-9  | 7    | Form with `submitAction` defined but `submitLabel` undefined — what does it render?                         |
| M-10 | 8    | AppRunner loading and error states (isLoading / error path) survive the reducer refactor.                   |
| M-11 | All  | `renderWithProviders` test helper itself validated (provider-missing fallback).                             |

---

## Required Revisions vs. Nice-to-Have

### Required (MUST be addressed before APPROVED)

- **R-1:** Fix the numeric totals. Step 1 New = 23 not 22. Step 3 Regression = 1 not 2. ADR footer "122 total" = wrong. Correct totals.
- **R-2:** Add Failure-category tests to Steps 2, 3, 6, 7. Min: (Step 2) unknown node type; (Step 3) Image with bad URL; (Step 6) TextInput receiving null/non-string; (Step 7) Form with non-field in `fields`. Recover Failure:Happy ratio.
- **R-3:** Fix T-0003-059 description to match new `dispatch(action)` signature.
- **R-4:** Add warn-log payload assertions to T-0003-012, T-0003-013, T-0003-095. Each must assert payload shape AND that the actual mismatched value is NOT in the log.
- **R-5:** Add T-0003-076b: programmatic Button → Counter clamp (the "Add 100 to a counter capped at 50" case).
- **R-6:** Call out the workspace-boundary lint rule explicitly in CI/CD Impact or Coverage Gates section.
- **R-7:** Fix snapshot count inconsistency. Enumerate all snapshot T-IDs explicitly OR drop "~30 snapshots" claim.
- **R-8:** Pin exact fallback copy strings in T-0003-110.
- **R-9:** Add Counter at-min snapshot (M-7).

### Nice-to-Have (Cal's discretion)

- **N-1:** Add M-1 (`useA2UIState` re-mount with different spec).
- **N-2:** Add M-9 (Form with `submitAction` but no `submitLabel`).
- **N-3:** Add M-10 (AppRunner loading/error regression branches).
- **N-4:** Add M-8 (TextInput focus border).
- **N-5:** Dedicated breaking-change test for `Dispatch` type (or document why it's non-breaking under TS function compatibility).

---

## Sign-off Line

**REVISE.** Nine required revisions. Five (R-2, R-4, R-5, R-7, R-8) are scope additions — missing tests. Four (R-1, R-3, R-6, R-9) are corrections to what's already there.

The ADR's architectural choices are sound. The state-engine design, the RendererThemeProvider, the logger sink pattern, and the Error Boundary placement are all correct. §D and §J show Cal read the codebase carefully. What's missing is the failure-path and payload-safety discipline that my ADR-0001 review forced.

Colby should not start Step 1 until R-1, R-2, R-3, and R-5 are addressed. Steps 2 and higher should not start until R-7 (snapshot T-ID enumeration) is addressed, since that determines what Colby must write in those test files.

R-4 (warn-log payload assertions) can be addressed in a single revision pass alongside R-2 — they're in the same test files. R-6 is a one-line CI/CD section addition.

Cal: fix the count, add failures, pin the warn-log payloads, enumerate the snapshot T-IDs, add the Button→Counter clamp test, fix T-0003-059's signature, and pin the fallback copy strings. This is one revision pass. The bones are good enough that I expect to APPROVE in Round 2.

— Roz

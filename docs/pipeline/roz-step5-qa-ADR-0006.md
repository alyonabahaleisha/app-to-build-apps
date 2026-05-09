# QA Report — ADR-0006 Step 5 (Typography + Display + NodeRenderer 12-arm + Milestone A)

_Reviewed by Roz — 2026-05-07_

## Verdict: PASS WITH NOTES

| Check | Status | Details |
|---|---|---|
| Type Check | PASS | `pnpm --filter @app-creator/a2ui-renderer typecheck` — clean |
| Lint | PASS | 0 errors, 64 warnings — all pre-existing in `src/legacy/` |
| Tests (legacy) | PASS | 211/211 |
| Tests (V0) | PASS | 243/243 |
| Coverage | PASS WITH NOTES | NodeRenderer 100%. Display 98.18% / 88.52%. Typography 78.94% / 71.42% — uncovered color arms in Body/Caption (Finding 1) |
| Snapshots | PASS | 25 V0 total: 14 component (7 × 2) + 1 integration + 10 layout from Step 4 |
| Complexity | PASS | No file > 130 lines; deepest nesting 3 levels |
| Security | PASS | No `useEffect`, no `fetch`, no `console.log`, no hardcoded hex in typography/display |
| CI/CD | PASS WITH NOTES | V0 tests still not wired to CI (Step 4 carry-forward) |
| Docs Impact | PASS WITH NOTES | ADR §State Model binding-on-text-fields claim contradicts protocol schema (Binding ruling) |

---

## Binding Ruling: Option A — Colby is correct

Verified `packages/protocol/src/components/typography.ts` and `display.ts`. Every text-bearing field is plain `z.string()`:
- `HeadingSchema.text`: `z.string().min(1).max(200)`
- `BodySchema.text`: `z.string().min(1).max(2000)`
- `CaptionSchema.text`: `z.string().min(1).max(2000)`
- `StatSchema.value/label/delta`: `z.string()`
- `BadgeSchema.text`, `ChipSchema.text`: `z.string()`

No `Binding<string>` union is defined in the protocol package. Wiring `useBinding()` would contradict the schema. Display nodes are pure functions of literal props per ADR-0005. `Binding<string>` on display text is a post-V0 concern.

**Action required (non-gating):** ADR-0006 §State Model needs a Documentation Impact patch to remove the binding-resolution-on-text-fields claim. Cal owns this edit.

---

## T-ID Coverage — Step 5 (T-0006-064..086)

All 23 ADR-spec'd Step 5 T-IDs present and passing.

| T-ID | Description | Status |
|---|---|---|
| T-064..077 | 14 component snapshots (7 components × 2 register pairs) | PASS |
| T-078 | Heading levels 1/2/3 resolve to display/h1/h2 type roles | PASS |
| T-079 | Stat delta-tone enum maps to success/danger/fg-muted | PASS |
| T-080 | Badge tone enum renders correct background tint | PASS |
| T-081 | Chip selected state inverts to accent/accent-fg | PASS |
| T-082 | Avatar initials fallback when imageUrl absent | PASS |
| T-083 | Avatar size enum enforces 24/32/48 diameter | PASS |
| T-084 | Heading empty text rejected at schema parse | PASS |
| T-085 | Stat with delta undefined renders without delta block | PASS |
| T-086 | Milestone A integration: spec validates, renders, snapshot | PASS |

---

## Findings

### Finding 1 (Advisory) — Body.tsx + Caption.tsx untested color arms

`Body.tsx` 73.33% statements (lines 33–39: `'fg-faint'`, `'success'`, `'warning'`, `'danger'` arms uncovered).
`Caption.tsx` 73.33% statements (lines 25, 29–33: `'fg'`, `'success'`, `'warning'`, `'danger'` arms uncovered).

**Impact:** A typo in any uncovered arm would silently produce the wrong color. **Resolution:** Add render-path tests with explicit color variants. Step 6 task pickup.

### Finding 2 (Advisory) — `sampleSpec.ts` placement

ADR specifies `packages/protocol/test/fixtures.demo.ts`. Colby placed it at `packages/a2ui-renderer/src/v0/__demo__/sampleSpec.ts`. Functions correctly; misses codegen-drift guard (Step 12 concern).

**Resolution:** Move to protocol/test/ during Step 6, or leave for Cal to reconcile before Step 12 codegen-drift wiring.

### Finding 3 (Pre-existing carry-forward) — V0 tests not in CI

Same as Step 4 Finding 1.

### Finding 4 (Pre-existing carry-forward, MT-08) — Expressive serif `fontFamily` not applied

`TYPE_BY_STANCE` design-system token carries no `fontFamily`. ADR §834 says expressive uses serif at display/h1/h2; deferred to Step 12 per ADR-0005 MT-08.

---

## iOS Simulator Visual Demo Readiness

**Step 11 (`<Renderer>` host wrapper) is NOT required for Milestone A demo.**

A flag-gated shim is sufficient:
1. Import `RendererThemeProvider`, `HostProvider`, `NodeRenderer` from `packages/a2ui-renderer/src/v0/` direct paths.
2. Minimal `HostCallbacks` (onToast, onAIError as no-ops — no actions dispatch in SAMPLE_SPEC).
3. Wrap `<NodeRenderer node={SAMPLE_SPEC.screens[0].root} />`.
4. Gate behind `EXPO_PUBLIC_CANVAS_V0_DEMO=true`.

SAMPLE_SPEC has `navigation: 'none'` and uses only Layout + Typography + Display. No nav, AI bridge, or dispatcher exercised.

---

## Roz's Assessment

454 total tests. Zero regressions. Typecheck clean. NodeRenderer 100% coverage with all 12 arms wired and defensive default intact. Milestone A integration test validates, renders, snapshots cleanly. Finding 2 pickup from Step 4 (3 safeArea render-path tests) correctly implemented. Accessibility roles match Step 4 notes.

The only real issue is Body/Caption color-arm coverage — non-trivial branches that should land before Step 10. Not gating.

Binding ruling clean. Colby read the schema correctly. ADR §State Model needs patching to close the spec-vs-doc gap.

Renderer surface is sufficient to mount demo on iOS Simulator now. Step 11 is production cutover, not Milestone A prerequisite.

**Milestone A unblocked. Demo shim is the next concrete deliverable.**

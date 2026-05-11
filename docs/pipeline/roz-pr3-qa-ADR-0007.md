# QA Report — ADR-0007 PR 3 (Step 6 — V0 Deletion Sweep + T-088 add)

_Reviewed by Roz — 2026-05-10_

## Verdict: PASS WITH NOTES

The deletion sweep is structurally complete. All 15 source targets are gone, all 30 deletion-sweep tests pass, T-0007-088 is present and meets the specificity bar, and no new non-Docker regressions were introduced. Three notes, none gating.

| Check | Status | Details |
|---|---|---|
| Type Check | PASS | `pnpm --filter @app-creator/api typecheck` exits clean |
| Lint | N/A | `@app-creator/api` has no `lint` script; root-level lint surface unchanged |
| Tests | PASS (Docker-gated failures pre-existing) | 254 passed, 205 failed (all 205 are pre-existing Docker-gated failures — same "Could not find a working container runtime strategy" seen in PR 2). Non-Docker pass counts: deletion-sweep 30/30, telemetry 31/31, env unit 17/17, generate.ts unit 35/35 (17 Docker-gated) |
| Coverage | N/A | No new functions; coverage direction net-negative (files deleted) |
| Complexity | PASS | No new files with complexity concerns; stubs trivial |
| DB Migrations | N/A | No migrations |
| Security | PASS WITH NOTE | See NOTE-2; no new vectors |
| CI/CD Compat | PASS | `server.ts` no longer registers `/edit`; `EVAL_MODE` replaces `PLAN_BUILD_EVAL_MODE`; env schema clean |
| Docs Impact | RESOLVED | NOTE-1 originally flagged 3 doc lines; cleanup folded into PR 3 (5 lines total fixed) |
| Dependencies | NOTE | `fast-json-patch` orphaned in `package.json`; not a blocker (NOTE-3) |

## Acceptance Criteria Verification

| AC | Status | How Verified |
|---|---|---|
| AC1: 15 deletion targets gone | PASS | `ls` of all target dirs + T-0007-124..135f all pass |
| AC2: zero `@app-creator/a2ui-schema` imports in `services/api/src` | PASS | `grep -rn` returns empty; T-0007-136 passes |
| AC3: `EVENT_PAYLOAD_WHITELIST` has only 4 V0 event types | PASS | `telemetry.ts` confirmed; T-0007-141 asserts `keys.length === 4` and passes |
| AC4: `env.ts` has no `PLAN_BUILD_*` | PASS | `env.ts` confirmed; T-0007-143 passes |
| AC5: `EVAL_MODE` defined | PASS | `env.ts:61` — `EVAL_MODE: z.enum(['true', 'false']).default('false')` |
| AC6: Contradictory-state check removed | PASS | No such check in env.ts; no test still expects the old error |
| AC7: ADR-0004 status Superseded | PASS | Header reads "Superseded by ADR-0007"; T-0007-151 passes |
| AC8: adr-index.md ADR-0007 row updated | PASS | Reads "Proposed (PRs 1+2+3 implemented)"; T-0007-150 passes |
| AC9: Docs 13→12 verb count; share removed | RESOLVED | Originally FAIL on 3 lines; Cal folded fix into PR 3 (canvas-v0.md: lines 125, 563, 779, 828; canvas-v0-brief.md: line 234) |
| AC10: T-0007-088 added and passes | PASS | `routes/generate.test.ts:637`; passes; specificity bar met |
| AC11: typecheck clean | PASS | `pnpm --filter @app-creator/api typecheck` exits 0 |
| AC12: lint clean | N/A | No per-filter lint script; root lint unchanged |
| AC13: T-0007-124..151 + T-0007-184-source — 30 pass | PASS | `test/deletion-sweep.test.ts`: 30/0 |
| AC14: No regressions in prior V0 tests | PASS | All previously-passing non-Docker suites still pass |

## Notes (non-gating)

### NOTE-1 — Documentation Impact: Three residual "13 verb" references (ORIGINAL FINDING — RESOLVED)

Original finding: ADR Step 6 Documentation Impact section specified patching `canvas-v0.md` §AC-R4 and `canvas-v0-brief.md` §1.7 + §2.4. Those sections were correctly updated, but three other occurrences were missed:

- `docs/product/canvas-v0.md:125` — "Components (28), action verbs **(13)**…"
- `docs/product/canvas-v0.md:563` — "**Action verb inventory** — **13 verbs**, what they do, sample uses."
- `docs/product/canvas-v0-brief.md:234` — `actions.ts ← **13-verb dispatcher**` (code-tree diagram)

**Resolution:** Cal swept the docs and fixed all 5 residuals (the 3 above plus 2 additional that Roz did not catch — `canvas-v0.md:779` "13-verb dispatcher" in week-2 timeline, and `canvas-v0.md:828` "Actions limited to the 13 verbs"). Folded into PR 3 commit. Verified zero remaining "13-verb" references in non-historical docs.

### NOTE-2 — Telemetry dead-code: M1 duration keys in `writeEvent` DB path (non-gating)

`services/api/src/llm/telemetry.ts:103-109` — comment reads "Extract duration_ms from payload if present (plan_duration_ms or build_duration_ms)" and the ternary checks for both M1 keys. These keys are unreachable at runtime: the whitelist enforcement at lines 89-93 throws `EventPayloadValidationError` before the DB insert path if either key appears. V0 `generate.completed` event uses `generation_duration_ms` (correctly whitelisted). No production impact, no security vector. The comment is misleading and the dead ternary adds noise. Cleanup in PR 4 or follow-up.

### NOTE-3 — `fast-json-patch` orphaned in `package.json` (non-gating, follow-up)

`services/api/package.json:26` — `"fast-json-patch": "^3.1.1"` remains. Confirmed: zero imports of `fast-json-patch` in `services/api/src/`, `services/api/test/`, `services/api/eval/`. The only references are stale HTML in `coverage/` output. `zod-to-json-schema` correctly retained at line 33 — still consumed by `produceAppSpec.ts:1`. Removing an unused dep is not a blocker for PR 3; follow-up issue.

## Specific Item Verification

**T-0007-088 specificity bar.** Met. Test at `routes/generate.test.ts:637` uses concrete LLM-emitted string (`mySecretSlot`), asserts absence from full SSE response body via `not.toContain`, then positively asserts `detail.codes` equals exactly `['unknown_slot_id']`. Two distinct catch surfaces. **NOTE-1 from PR 2 is closed.**

**NOTE-3 from PR 2 (bridge `as any` casts).** Closed. Files deleted. `grep -rn "as any"` in `services/api/src/` returns no results from the former bridge locations.

**`scoreArchetype.ts` V0 rewrite.** Imports from `@app-creator/protocol` — correct. No `@app-creator/a2ui-schema` reference. The `spec.archetype as Archetype` cast is mild type-safety miss; consistent with stub posture. Step 7 will rewrite.

**eval/ stubs.** `eval/run.ts` sets `process.env.EVAL_MODE = 'true'` first (T-0007-169 met), then `process.exit(1)` with clear error. No M1 references. `eval/run.test.ts` has one `.todo` — no phantom coverage. `eval/scoreArchetype.ts` is complete V0 implementation (9 lines), not stub.

**ADR-0004 status in both locations.** Verified Superseded marker in header AND adr-index, both pointing to ADR-0007.

## CI/CD Verification Required: No

No auth, middleware, or cross-cutting behavior changed beyond `/edit` route removal (mobile-side-dead per PR 2). `EVAL_MODE` replaces `PLAN_BUILD_EVAL_MODE` — any CI job setting old var silently falls back to `EVAL_MODE=false` (Zod default), which is the correct safe default.

## Documentation Update Required: Resolved in PR 3

5 doc lines patched to reflect 12 verbs (originally 3 flagged by Roz; Cal swept and caught 2 additional).

## Roz's Assessment

The deletion sweep did its job. Fifteen files gone, thirty tests passing, no M1 artifact left in the import graph, T-088 present and specific. The contradictory-state check is gone, the adr-index and ADR-0004 paperwork is correct, the eval stubs are clean placeholders without phantom coverage.

NOTE-1 was originally a PM landmine (the App Review section at canvas-v0.md:563 was the most consequential). Cal folded the cleanup into PR 3 before commit, and caught two additional residuals I missed in my sweep. Doc surface is now clean.

NOTE-2 is a low-noise cleanup; the dead M1 ternary is unreachable at runtime but reads like surviving M1 code that will confuse a future reader. NOTE-3 (orphan dep) is a known carry-forward.

**Verdict: PASS WITH NOTES. PR 3 ready to commit.**

# QA Report — ADR-0010 PR 5 (Step 5 — CI guard: PROMPT_VERSION bump required)

_Reviewed by Roz — 2026-05-12_

## Verdict: PASS WITH NOTES

29 tests pass. Regex anchored, semverGt leading-zero rejection explicit, graceful base-branch-unavailable fallback works, CI step ordering correct, GITHUB_BASE_REF handling correct.

| Check | Status |
|---|---|
| Type Check | PASS |
| Lint | PASS (4 pre-existing renderer warnings unrelated) |
| Tests | PASS — 29/29 |
| Coverage | PASS — 85.3% stmt / 83.3% branch on new script |
| Complexity | PASS — 176 lines, CCN <10 |
| Security | PASS with notes |
| CI/CD Compat | PASS with notes |

## Scrutiny — All PASS

- **`readVersion` regex**: `/^export const PROMPT_VERSION = '([^']+)'/m` — multiline-anchored to `^`, comment-only occurrences excluded by construction. `makeSystemTs` fixture exercises this.
- **`semverGt` leading-zero rejection**: explicit `if (seg.length > 1 && seg.startsWith('0'))` throw, NOT a `parseInt` accident.
- **Graceful base-branch fallback**: `execSync` throw caught, exits 0, emits warn.
- **`GITHUB_BASE_REF` handling**: defaults to `'main'` when unset; respects env var when set; both branches tested.
- **CI conditional**: `if: github.event_name == 'pull_request'` at step level — pushes to main correctly skip.
- **Pre-flight ordering**: line 59 guard runs BEFORE line 65 `Run eval - mode=v0`. No `continue-on-error`. Credit-save protected.

## Note 1 (informational) — Shell injection vector via `GITHUB_BASE_REF`

`GITHUB_BASE_REF` interpolated directly into `execSync` command strings (lines 102, 124). In GitHub Actions, value is runtime-set and not attacker-controlled. Local users who export `GITHUB_BASE_REF='main; some-command'` would execute that command. Comment in file header says env var is "set automatically by GitHub Actions" — implicit assumption that local users don't set adversarially. Sanitization check (`/^[a-zA-Z0-9._\/-]+$/.test(base)`) would eliminate. Not blocking.

## Note 2 (informational) — `console.warn` for success path

Line 173 uses `console.warn` for the success confirmation message. ADR code shape (line 928) shows `console.log`. `console.warn` writes to stderr; `console.log` writes to stdout. In CI invisible; tooling that captures only stdout for audit logs would miss the success confirmation. Not blocking.

## Note 3 (deferred recommendation) — `eval-out-of-scope` asymmetric guard

Out-of-scope job runs 30 prompts (per `eval/run.ts:15`). Same path-filter trigger as `eval-v0`. Credit-saving motivation applies symmetrically. Colby's YAGNI reasoning ("separate trigger path") is only partially correct — `system.ts` changes trigger BOTH jobs.

Recommend applying the guard step to `eval-out-of-scope` too for consistency. Not blocking this PR; backlog.

## Scope Check — CLEAN

Only 4 files staged (the deliverable):
- `services/api/scripts/check-prompt-version-bumped.ts`
- `services/api/scripts/check-prompt-version-bumped.test.ts`
- `.github/workflows/eval.yml`
- `services/api/package.json`

Working-tree drift in `apps/mobile/**` (RunScreen + AppRunner + telemetry) is concurrent ADR-0008 Step 7 + earlier workstreams. Not this PR.

## Roz's Assessment

Core deliverable is sound. Regex correctly anchored. Semver comparator rejects leading zeros explicitly. Graceful fallback handles first-commit + shallow-clone without false-failing. CI step ordering correct. 29 tests covering full ADR Step 5 test table.

Three notes — none blocking. Note 1 is low-risk given deployment context. Note 2 is minor spec drift. Note 3 is a deferred recommendation worth taking on backlog.

**PASS WITH NOTES.** Ellis can commit.

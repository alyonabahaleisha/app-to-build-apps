# Test-Spec Review R2 — ADR-0013 (Sign in with Apple)

_Reviewed by Roz — 2026-05-10_

## Verdict: REVISE (1 new P0)

Cal fixed 14 of 15 R1 findings. One new P0 found: T-0013-131 and T-0013-132 use a tautological TypeScript pattern that always compiles to `true`, defeating the compile-time guard they were added to provide.

## Finding Resolution Summary

| Finding | Origin | Status |
|---|---|---|
| P0-1 email in response shape | R1 | CLOSED |
| P0-2 schema type-export assertion | R1 | CLOSED (T-0013-133 correctly designed) |
| P0-3 seven vs eight error codes | R1 | CLOSED |
| P1-1 no Exclude<> assertion | R1 | **REOPENED via NF-1** |
| P1-2 sha256 rationale | R1 | CLOSED |
| P1-3 JWKS race unaddressed | R1 | CLOSED |
| P1-4 Step 2 zero boundary | R1 | CLOSED |
| P1-5 deprecation warn ordering | R1 | CLOSED |
| P1-6 T-0013-073 misreference | R1 | CLOSED |
| P1-7 Step 5 ratio + telemetry gaps | R1 | CLOSED |
| P2-1 backgrounded mid-SIWA | R1 | CLOSED |
| P2-2 provider name test | R1 | CLOSED |
| P2-3 T-0011 vs T-0013 overlap | R1 | CLOSED |
| P2-4 coverage gate | R1 | CLOSED |
| P2-5 T-0013-045 vague assertion | R1 | CLOSED |
| **NF-1 T-0013-131/132 tautological** | New | **OPEN — blocks approval** |

## NF-1: T-0013-131 and T-0013-132 are tautological compile-time assertions

Cal's pattern:
```ts
type _AssertNoEmail = Exclude<keyof ResponseUser, 'email'> extends keyof ResponseUser ? true : never
const _check: _AssertNoEmail = true
```

**Trace:**
- Correct shape `{id, display_name}`: `Exclude<'id'|'display_name', 'email'>` = `'id'|'display_name'`. Subset of itself. Result: `true` — compiles.
- Leaked shape `{id, display_name, email}`: `Exclude<'id'|'display_name'|'email', 'email'>` = `'id'|'display_name'`. Subset of original. Result: `true` — **also compiles**.

The Exclude result is always a subset of the original keyset by definition. The assertion catches nothing. Structurally identical to `const _check: true = true`.

**Correct inverse pattern:**
```ts
type _AssertNoEmail = 'email' extends keyof ResponseUser ? never : true
const _check: _AssertNoEmail = true
```

Now if `email` is added: `'email' extends keyof T` is `true` → conditional resolves `never` → `const _check: never = true` fails to compile.

Same flaw applies to T-0013-132 (`appleUserId | apple_user_id`).

T-0013-133 uses a DIFFERENT pattern (`$inferSelect extends {field: T} ? true : never`) which IS correctly designed — fails if required fields are absent. No flaw there.

**Resolution:** Rewrite T-0013-131 and T-0013-132 assertion shapes per the inverse pattern above. Single fix; no other ADR text affected.

## Decision Point Rulings

1. **Step 3 ratio 0.33:1 thin-by-design** — Accepted. N/A justification explicit; precedent from ADR-0010 R2 Step 1 holds.
2. **Step 4 borderline 1.0:1** — Accepted. T-0013-139 tests Step 4's intent (deprecation warn ordering). Strict equality satisfies hard rule.
3. **All P0s fully closed** — P0-1 and P0-3 fully closed. P0-2 fully closed via T-0013-133. The flaw is in P1-1's companion tests (T-0013-131/132), now NF-1.
4. **Email-removal completeness** — No surviving `email` in response body anywhere. The JWT payload's `email: user.email` (`issueLocalJwtForUser`) is inside the base64 access_token blob; T-0013-130's `JSON.stringify(reply.body)` substring assertion is safe.
5. **T-0013-133 satisfies correctness** — Correct direction. Fails to compile if required Drizzle columns absent.

## What Passes Cleanly

- Step 1 test density + failure-class coverage: excellent. Security tests T-0013-022/023/024 remain strongest section.
- T-0013-040 sha256 specificity: correct, `crypto.createHash('sha256')` pinned.
- T-0013-139 warn-before-Zod ordering: real test via pino transport ordering, not a stub.
- T-0013-140 EVAL_MODE spy + zero-rows: two-part assertion distinguishing wrong-but-passing implementations.
- T-0013-141 optional `failure_code` + sibling rejection: closes "optional means anything goes" gap.
- §Coverage Gates `appleIdentity.ts` ≥95%: appropriate.
- §Cross-References section: complete.

## Roz's Assessment

14 of 15 R1 findings closed. sha256 rationale is one of the better-documented security decisions in this codebase. T-0013-140 + T-0013-141 design thinking is sound. T-0013-133 correctly specified.

T-0013-131 and T-0013-132 are broken in a subtle TypeScript way that wouldn't be caught by reading them quickly. The runtime guard T-0013-130 survives and is sound — but the compile-time layer Cal added specifically for P1-1 closure does not function.

Small fix. Change assertion direction in two test descriptions, re-submit. Everything else clears.

**REVISE.** One fix required. Scope: T-0013-131 and T-0013-132 assertion pattern only.

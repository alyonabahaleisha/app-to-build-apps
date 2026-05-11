# Test-Spec Review R4 — ADR-0013 (Sign in with Apple)

_Reviewed by Roz — 2026-05-10_

## Verdict: APPROVED

NF-2 closed. Spec ready for Colby.

## What Was Verified

T-0013-132 four-case trace (the fix under review):

```ts
type _AssertNoAppleUserIdCamel = 'appleUserId' extends keyof ResponseUser ? never : true
const _c1: _AssertNoAppleUserIdCamel = true

type _AssertNoAppleUserIdSnake = 'apple_user_id' extends keyof ResponseUser ? never : true
const _c2: _AssertNoAppleUserIdSnake = true
```

| Case | Shape | _c1 | _c2 | Correct? |
|---|---|---|---|---|
| Correct | `{id, display_name}` | `true` — compiles | `true` — compiles | Yes |
| Camel leak | `{id, display_name, appleUserId}` | `never` — FAILS | `true` — compiles | Yes |
| Snake leak | `{id, display_name, apple_user_id}` | `true` — compiles | `never` — FAILS | Yes |
| Both leak | `{...appleUserId, apple_user_id}` | `never` — FAILS | `never` — FAILS | Yes |

All four cases resolve correctly. Non-distributive union problem fully eliminated — each assertion tests exactly one key against the keyset independently. No silent pass-through scenario survives.

Rationale embedded in T-0013-132 is accurate: correctly explains why union form fails and why split assertions are required.

**T-0013-131:** Unchanged. Correct inverse-extends on `'email'`. No drift.
**T-0013-133:** Unchanged. `$inferSelect extends {columns} ? true : never` direction correct. No drift.
**Surrounding prose:** Lines 900-933 intact. No insertions, deletions, or ID renumbering between T-0013-070 and T-0013-133.

## Roz R4 Assessment

The fix is correct. Two lines of TypeScript, two constants, four cases covered, rationale documented. Nothing subtle missed. T-0013-131 and T-0013-133 already sound and remain so.

The compile-time layer Cal added for P1-1 closure now actually works.

**APPROVED. Spec ready for Colby.**

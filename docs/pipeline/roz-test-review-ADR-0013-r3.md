# Test-Spec Review R3 — ADR-0013 (Sign in with Apple)

_Reviewed by Roz — 2026-05-10_

## Verdict: REVISE (NF-2 — narrower than R2)

NF-1 (T-0013-131) is fully closed. T-0013-132 has a residual gap: union-extends pattern silently fails to catch the realistic single-key leak.

## NF-1: T-0013-131 — CLOSED

Pattern as written:
```ts
type _AssertNoEmail = 'email' extends keyof ResponseUser ? never : true
const _check: _AssertNoEmail = true
```

Correct shape: `'email' extends keyof T` → `false` → resolves `true` → compiles ✓
Leaked shape: `'email' extends keyof T` → `true` → resolves `never` → fails compile ✓

R2-prescribed pattern implemented exactly. NF-1 flaw gone.

## NF-2: T-0013-132 — OPEN (new finding)

Pattern as written:
```ts
type _AssertNoAppleUserId = 'appleUserId' | 'apple_user_id' extends keyof ResponseUser ? never : true
const _check2: _AssertNoAppleUserId = true
```

TypeScript evaluates `A | B extends keyof T` non-distributively when the union is a literal type (not a naked type parameter). The check passes only when EVERY member of the left union is in `keyof T`.

| Shape | Single-key leak? | Result | Catches? |
|---|---|---|---|
| `{id, display_name}` | None | `true` (correct shape) | N/A |
| `{id, display_name, appleUserId}` | Camel | `true` (`apple_user_id` not in T → whole union doesn't extend) | **NO** — silently passes |
| `{id, display_name, apple_user_id}` | Snake | `true` (`appleUserId` not in T → whole union doesn't extend) | **NO** — silently passes |
| `{...appleUserId, apple_user_id}` | Both | `never` (both keys in T → union extends) | Yes |

The realistic leak scenario — a Zod `.object()` schema adding ONE casing variant — slips through silently. The description claims "either key" coverage that the TypeScript evaluation does not deliver.

**Resolution prescribed:** Split into two independent inverse-extends assertions, one per key:

```ts
type _AssertNoAppleUserIdCamel = 'appleUserId' extends keyof ResponseUser ? never : true
const _c1: _AssertNoAppleUserIdCamel = true

type _AssertNoAppleUserIdSnake = 'apple_user_id' extends keyof ResponseUser ? never : true
const _c2: _AssertNoAppleUserIdSnake = true
```

Each independently catches its respective key. T-0013-130 (runtime substring) continues to cover this gap operationally until the spec change lands.

## What Else Passes Cleanly

- T-0013-133 (Drizzle `$inferSelect satisfies`): unchanged, correct
- T-ID count 141 unchanged
- Variable rename `_AssertNoAppleSub` → `_AssertNoAppleUserId`: clean
- No other prose drift

## Roz R3 Assessment

The NF-1 fix is exactly right. T-0013-132 has a TypeScript subtlety Cal walked into — union-extends in non-distributive position is whole-union assignment, not member-by-member. The description overstates the assertion's coverage relative to what TypeScript actually evaluates.

The runtime guard T-0013-130 remains operative for single-key leaks. The compile-time layer just doesn't provide what its description claims for the realistic failure mode.

Surgical: split into two single-key assertions. Pattern matches description.

**REVISE.** One fix, T-0013-132 only.

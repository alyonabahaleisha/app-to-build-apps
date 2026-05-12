# QA Report — ADR-0008 Step 5 (Pending-clone intent + post-SIWA replay)

_Reviewed by Roz — 2026-05-12_

## Verdict: PASS WITH NOTES

Implementation correct, matches ADR code shape. Error handling layered correctly. T-0008-123 sign-out test workaround is sound.

| Check | Status |
|---|---|
| Type Check | PASS |
| Lint | PASS — 0 errors |
| Tests | PASS — 42/42 (pendingClone 17, clones 11, SessionProvider +1=T-0008-123) |
| Security | PASS — namespaced key, validated input, no crash vectors |

## Scrutiny — All PASS

- **T-0008-115/116 sync validation**: `!SHARE_ID_RE.test()` fires before async SecureStore call. `await expect().rejects.toThrow('invalid_share_id')` pattern. `setItemAsync` never called for malformed input.
- **T-0008-118b read-error try/catch**: `getItemAsync` wrapped at lines 66-71. Logs `'pendingClone_read_failed'` with `safeMessage`. Returns null. Mock + assertion tight.
- **T-0008-117 atomic read-then-delete**: second pop returns null. `deleteItemAsync` correctly gated `if (value)`.
- **T-0008-117b never-expires**: `jest.advanceTimersByTime(30 * 24 * 60 * 60 * 1000)` — exactly 30 days. Round-trip identical. Pins no-TTL contract.
- **T-0008-123 sign-out clears**: Uses `redeemToken` to reach authed state (avoids T-0001-080 mock bleed). Seeds key, signs out, asserts mem cleared. Exercises real `signOut → enterUnauthenticated → clearPendingClone` chain.
- **T-0008-131 no re-persist**: `mockSetPendingClone` not called after failed mutation.
- **T-0008-130 success clears**: Pop already cleared before mutate; success path invalidates `miniAppsKeys.list()`. No re-persist.
- **api.test.ts allowlist**: 2 entries (`pendingClone.ts`, `pendingClone.test.ts`). Clean.

## NOTE (non-blocking) — Double-invalidate on success

`apps/mobile/src/state/queries/clones.ts:111,124`. `miniAppsKeys.list()` invalidated in BOTH `onSuccess` AND `onSettled`. TanStack deduplicates in-flight refetches so no double-fetch in practice — but redundant and diverges from `miniApps.ts` pattern (which uses `onSettled` only). Recommend cleanup follow-up; not blocking.

## NOTE — `act()` warnings in clones.test.ts

Console emits `Warning: An update to TestComponent inside a test was not wrapped in act(...)` for all mutation tests. Confirmed pre-existing across query test suite (same pattern in `miniApps.test.ts`). Not introduced here.

## Concurrent SessionProvider.tsx changes

The `displayName?: string` field added by parallel SettingsSheet work AND `clearPendingClone` import here are both in working tree. Different lines, different concerns — no live merge conflict. Both diffs additive.

## Roz's Assessment

Implementation matches ADR code shape exactly. Error handling layered correctly (read fail returns null + logs; delete fail after read surfaces value anyway). `clearPendingClone` swallows internal errors so the unguarded call in `enterUnauthenticated` is safe. T-0008-123 `redeemToken` workaround sound — reaches authed state through real path then exercises real `signOut` chain.

**PASS WITH NOTES.** Ship it.

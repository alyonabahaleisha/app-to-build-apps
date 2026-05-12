# QA Report — ADR-0008 Step 6 (Share affordance + clone landing UX)

_Reviewed by Roz — 2026-05-12_

## Verdict: PASS WITH NOTES — F1 requires surgical fix before clean ship

T-0008-143b ordering pin verified non-tautological. Step 7 R2 regression tests preserved. DI clipboard pattern legitimate. 4 findings.

| Check | Status |
|---|---|
| Type Check | PASS |
| Lint | PASS — 0 errors |
| Tests | PASS — mobile 541; coverage 94-100% on new files |
| Security | PASS — no PII in telemetry; no test seam visible in production |

## BLOCKING — F1: T-0008-139 429 rate-limit toast not wired (ADR deviation)

`apps/mobile/src/state/queries/shareLinks.ts:132-135`. ADR spec line 1454: 429 → toast.error `"Try again in a moment."` 

Implementation: NO 429 discrimination. All errors route to `SHARE_LINK_COPY.createError` ("Couldn't create a share link. Try again."). The constant `SHARE_LINK_COPY.rateLimited` exists at line 72 but is **dead code**.

Test at line 278 knowingly asserts the generic string with comment acknowledging the gap. Spec violation, test matches implementation rather than spec.

**Fix:** Add `status === 429` branch in `onError`:
```ts
if ((err as ApiError).status === 429) {
  toast.error(SHARE_LINK_COPY.rateLimited)
  return
}
toast.error(SHARE_LINK_COPY.createError)
```
Update T-0008-139 to assert `rateLimited` string.

## NOTABLE — F2: T-0008-140 documentation test, not regression test

`shareLinks.test.ts:314-336`. Asserts `typeof result.current.mutate === 'function'`. Would pass even if hook called `navigation.navigate`. Structural enforcement via typecheck. Acceptable boundary but doesn't satisfy the ADR's "regression" intent.

## NOTABLE — F3: T-0008-141 label mismatch vs ADR

ADR line 1456 defines T-0008-141 as: "`useCloneMutation.mutate(shareId)` invalidates `miniAppsKeys.list()` **exactly once**." Colby's T-0008-141 tests the opposite hook (`useCreateShareLinkMutation` does NOT invalidate). Both behaviors correct/correctly tested — T-ID misapplied. The ADR's intended T-0008-141 partially covered by T-0008-125 in clones.test.ts (presence not count).

The "exactly once" matters because `clones.ts:112,125` invalidates twice — onSuccess + onSettled. Pre-existing from Step 5; harmless (TanStack dedupes) but no test catches a regression.

## INFORMATIONAL — F4: clones.ts double-invalidate

Pre-existing from Step 5 (commit `97a1c70`). CLAUDE.md §2 mandates onSettled only. Not introduced by Step 6 — only toast string change in `clones.ts` here.

## All Other Scrutiny — PASS

- **T-0008-143b ordering pin**: `toEqual(['clipboard', 'haptic', 'telemetry', 'toast.success'])` — exact array, not tautological. Error path: `toEqual(['toast.error'])` — fails if haptic/telemetry fire.
- **Step 7 R2 regression tests preserved**: All 3 tests at RunScreen.test.tsx:1016-1092 use `jest.requireActual('#/lib/telemetry')` against real whitelist. Pattern correctly applied.
- **Telemetry payload**: `share_id_prefix: result.share_id.slice(0, 4)` — 4 chars, no PII. T-0008-136 uses requireActual.
- **DI pattern**: `opts.setClipboard` optional with real default. No production caller passes it. Test seam not visible outside test context.
- **useCloneMutation 404/410**: "This tool is no longer available." + "This share link has been revoked." + "Couldn't open the shared tool." All confirmed at clones.ts:59-63.
- **No navigation in mutation**: confirmed.

## Scope Creep — CLEAN

shareLinks/ShareSheet/RunScreen/clones — exactly the declared files.

## Roz's Assessment

Core deliverable solid. Ordering pin, telemetry payload validation, DI abstraction, Step 7 R2 regression preservation all clean.

F1 is a real ADR deviation — 429 rate-limit UX gap with dead constant. ~5-min fix. After F1 closes: PASS.

F2/F3/F4 are notes for cleanup; not blocking.

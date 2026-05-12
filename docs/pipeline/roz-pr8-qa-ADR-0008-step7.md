# QA Report — ADR-0008 Step 7 (Telemetry whitelist additions + integration tests)

_Reviewed by Roz — 2026-05-12_

## Verdict: REVISE (1 CRITICAL production bug + 2 notable non-blocking)

Client-side telemetry rewrite is correctly implemented in isolation: whitelist logic real, error class proper, 27 tests non-tautological with PII keys covered individually. But the behavior change (no-op → throws) wasn't propagated to existing call sites in RunScreen.tsx — every share action in production will fail.

| Check | Status |
|---|---|
| Type Check | PASS — 0 errors |
| Lint | PASS — 0 errors |
| Tests | PASS (mobile 410/410; API non-Docker baseline preserved) |
| Complexity | PASS |
| **Security** | **FAIL** — production PII key passed to enforced whitelist |
| Docs | N/A (ADR spec drift noted) |

## CRITICAL — F1: RunScreen.tsx passes non-whitelisted `miniAppId` to writeEvent

`apps/mobile/src/screens/Run/RunScreen.tsx:140` (`handleShare`) and `:160` (`handleCopyLink`) both call:
```ts
writeEvent({eventType: 'share_link_copied', miniAppId})
```

`miniAppId` is NOT in `MOBILE_EVENT_PAYLOAD_WHITELIST['share_link_copied']` (which is `['share_id_prefix']` only). The new `writeEvent` throws `MobileEventPayloadValidationError` synchronously on any non-whitelisted key.

**Production impact:** Every user who taps Share triggers an unhandled synchronous throw. It escapes the `try`-`catch` (throws AFTER successful await, propagates up into useCallback uncaught). Toast never shows, link never copies, share is silently broken.

**Why tests didn't catch it:**
- RunScreen.test.tsx mocks the entire module: `jest.mock('#/lib/telemetry', () => ({writeEvent: jest.fn()}))` — mock accepts any args
- TypeScript `MobileEvent` type has `[key: string]: unknown` index signature — accepts arbitrary additional keys at compile time
- Defect is invisible to all automated checks. Exact category of bug that escapes CI.

**Why miniAppId shouldn't be there anyway:** It's a UUID — PII-adjacent identifier that telemetry should not carry. The whitelist correctly excludes it for the same reason `email`/`sub`/`identity_token` are excluded.

**Fix:**
1. `handleShare` (line 140): The share API call result must capture `share_id` from the response. Pass `share_id_prefix: result.shareId.slice(0, 4)` instead of `miniAppId`. This requires the API response to include `share_id` — verify the route returns it.
2. `handleCopyLink` (line 160): Already has `result.url`; extract the share ID from the URL pattern `/m/{share_id}/clone` and slice(0, 4). Pass `share_id_prefix` instead of `miniAppId`.

If the API doesn't return enough info to compute `share_id_prefix`, the fallback is to emit telemetry with empty/no payload (still a valid whitelist case). Better than passing PII.

Add a RunScreen test that asserts the unmocked writeEvent contract — i.e., that the production call site's payload would be accepted by the real whitelist. Pattern:
```ts
it('handleShare emits telemetry with valid whitelist shape', () => {
  const realWriteEvent = jest.requireActual('#/lib/telemetry').writeEvent
  // Capture the call args via a spy that delegates to the real fn
  expect(() => realWriteEvent({eventType: 'share_link_copied', share_id_prefix: 'abcd'})).not.toThrow()
})
```

This test would catch the next regression.

## NOTABLE — F2: T-0008-150 tautological placeholder

`services/api/src/routes/clones.test.ts:780` — `expect(true).toBe(true)`.

T-0008-150 was specified as EVAL_MODE=true regression for the new event types. Test body acknowledges coverage exists elsewhere (telemetry.test.ts), which is accurate — but the placeholder always passes regardless of code. False confidence in the test matrix.

**Fix:** Either (a) replace with `it.todo(...)` so it shows pending rather than passing, OR (b) duplicate the EVAL_MODE assertion here using the existing pattern.

## NOTABLE — F3: ADR T-0008-152b spec drift (doc-only, not blocking)

ADR line 1491 describes T-0008-152b as:
```
telemetry.emit('share_link_copied', {share_id_prefix: 'aBcD', source_archetype: 'tracker'})
```

But `source_archetype` is NOT in the client whitelist (correctly so — it's server-side telemetry territory). The actual implementation + test use `{share_id_prefix: 'aBcD'}` without `source_archetype`. Implementation and tests agree; ADR description is stale. Update ADR line 1491 when convenient.

## Verified — Colby's "already done" claims

Server-side telemetry IS complete in prior commits:
- `services/api/src/llm/telemetry.ts:39-41` — all 3 share_link.* event types in EventType union
- Lines 77-79 — correct whitelist entries; no PII keys
- `clones.test.ts:730-817` — T-0008-144..152 present, exercising all 3 events
- Decision to NOT create `shareLinks.test.ts`: correct (share-link create + lookup both in `clones.ts`)

## Verified — Scope clean

Diff surface exactly:
- `apps/mobile/src/lib/telemetry.ts` (rewritten)
- `apps/mobile/src/lib/telemetry.test.ts` (new)

No other files touched. Confirmed clean.

## Roz's Assessment

One critical defect. Client-side telemetry rewrite is correct in isolation. The problem is the existing call sites in `RunScreen.tsx` weren't updated to match the new whitelist. The module was previously a no-op so `{eventType: 'share_link_copied', miniAppId}` was harmless. Now it throws. Both production call paths will silently fail after this lands.

The defect is invisible to all automated checks. RunScreen mocks the module (correct for RunScreen's purpose). TypeScript index signature allows arbitrary keys. Exactly the category of bug that escapes CI and surfaces at 2 AM.

**REVISE.** Fix the two RunScreen.tsx call sites; resolve T-0008-150 tautology. ADR doc drift can wait.

# QA Report — ADR-0008 Step 4 (iOS entitlement + Universal Link handler)

_Reviewed by Roz — 2026-05-11_

## Verdict: REVISE (1 BLOCKER — typecheck error)

Clean implementation. Parser fails closed on all unrecognized inputs. Hook correctly destructures callbacks. Linking.parse shim is test-only. One TypeScript error blocks the commit.

| Check | Status | Details |
|---|---|---|
| Type Check | **FAIL** | 1 Step-4 error at `universalLink.test.tsx:357`; 1 pre-existing (ADR-0009 Step 7 working-tree) |
| Lint | PASS | 0 errors |
| Tests | PASS | 381/381 across 23 suites; universalLink suite 29/29 |
| Coverage | PASS WITH NOTES | 95%+ all axes; 2 uncovered lines (72, 141) |
| Complexity | PASS | 153 lines, low CCN, max 2 nesting |
| Security | PASS | Fail-closed parser; env-sourced AASA app ID undefined-tolerant |

## BLOCKING — F1: TypeScript error at universalLink.test.tsx:357

```
error TS2345: Argument of type '{ config: {}; }' is not assignable to parameter of type 'ConfigContext'.
  Missing: projectRoot, staticConfigPath, packageJsonPath
```

T-0008-112 calls `appConfig({config: {}})` — runtime passes (JS ignores missing props), TypeScript rejects.

**Fix (one line):**
```ts
const resolved = appConfig({config: {}, projectRoot: '', staticConfigPath: null, packageJsonPath: null})
```

OR (acceptable for test-only):
```ts
const resolved = appConfig({config: {}} as unknown as ConfigContext)
```

## PASS WITH NOTES — Coverage gaps (advisory, not blocking)

**universalLink.ts:72** (`catch` returning null): No test exercises a truly unparseable string (e.g. `"not a url"`, `"://broken"`). ADR T-IDs cover null/empty/wrong-host/wrong-path but NOT malformed-URL throw path. Behavior is correct; test gap.

**universalLink.ts:141** (`onReservedMode(parsed)` in warm-start callback): T-0008-107 covers cold-start reserved-mode; T-0008-108 covers warm-start active-mode only. **Warm-start reserved-mode is exercised zero times.** Missing-test gap not identified in Cal's table.

Recommend Colby add both during R2 surgical, since the working tree is already open. ~3 lines of test each.

## PASS WITH NOTES — useEffect dep array

Implementation uses `[onActiveLink, onReservedMode]` (destructured) — better than ADR reference code's `[opts]`. Comment at lines 148-151 documents the stable-callback constraint. Step 5's `SessionProvider` will provide stable refs.

`useRef` "mount once" pattern not adopted — defensible call since Step 5 stabilizes refs.

## All other scrutiny — PASS

- **AC-P7 rejection coverage**: each rejection type (non-HTTPS, wrong host, wrong path, share_id length, dashes, empty, unknown mode, uppercase mode, extra segments) has a specific test. T-0008-093..105.
- **No consumers wired**: `grep` returns only definition + test. RunScreen/Navigation/etc untouched.
- **app.config.ts scope**: `applinks:canvas.app` exactly once; expo-apple-authentication plugin untouched; `appleAppSiteAssociationAppId` env-sourced + undefined-tolerant.
- **Linking.parse shim**: test-only, lines 44-57; returns realistic `{scheme, hostname, queryParams}` for `parseAuthDeepLink` consumer.
- **AC-P7 closure**: parser fails closed on all unrecognized inputs — returns null, never throws, never defaults to clone mode.
- **T-0008-098 dashed share_id**: test sample diverges from ADR (24 chars vs 29 chars) but both correctly reject — cosmetic only.
- **T-0008-113b null cold-start**: covered via `beforeEach` defaulting `mockGetInitialURL` to null.

## Scope creep — concurrent workstreams (NOT this PR)

Working tree drift from concurrent work NOT to be staged with Step 4:
- ADR-0013 leftovers (`.env.example`, `eas.json`, magicLinkProvider deprecation comment, ESLint EXPO_PUBLIC_AUTH_PROVIDER rule)
- ADR-0011 Step 10 AppRunner cleanup (6 file deletes + test harness fixups)
- ADR-0009 Step 7 in flight (`packages/protocol/`, `packages/a2ui-renderer/`) — has its OWN typecheck error in `spec.zod.ts:232` (CommerceCardSchema `.default('USD')` makes `_input` accept `currency: undefined` and breaks `z.ZodType<Node>`)

None affect Step 4's three files. Ellis will selective-stage exactly:
- `apps/mobile/app.config.ts`
- `apps/mobile/src/lib/universalLink.ts`
- `apps/mobile/src/lib/universalLink.test.tsx`

## Roz's Assessment

One typecheck error owned by this step (test-side, mechanical fix). Implementation is clean; parser is the ADR spec; hook is strictly better than the ADR reference code.

The ADR-0009 Step 7 working-tree drift will mess up Step 4's clean record if commits aren't carefully staged. Ellis already handles this.

Two coverage gaps (malformed URL throw path, warm-start reserved-mode) are not ADR-required but should be added during R2 since the file is open anyway.

**REVISE.** Fix the one-line typecheck error + add the 2 coverage tests if R2 doesn't take long → R2 verify → Ellis.

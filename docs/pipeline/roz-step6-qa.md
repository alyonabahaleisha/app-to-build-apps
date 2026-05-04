## QA Report — Step 6 of ADR-0001
*Reviewed by Roz, 2026-05-01*

### Verdict: PASS

| Check | Status | Details |
|-------|--------|---------|
| Type Check | PASS | `pnpm typecheck` clean across all 4 workspaces (api, a2ui-schema, a2ui-renderer, mobile). |
| Lint | PASS | `pnpm lint` clean — no eslint output. |
| Tests | PASS | Step 6 mandatory: 20/20 T-IDs covered (097 N/A) across 29 jest cases (`SignIn|deepLink` filter: 2 suites, 29 passed). Mobile workspace: 4 suites, 53/53 (Step 5 = 24, Step 6 = 29). Full sweep: server 97/97, schema 5/5, mobile 53/53 → 155 total. |
| Coverage | PASS | All 20 implementable Step 6 T-IDs map to a non-tautological assertion. AC trace below. |
| Security | PASS | Zero `console.*` calls under `screens/SignIn/`, `lib/deepLink.ts`, `state/queries/auth.ts`, or `components/`. `/auth/magic-link` is in `PUBLIC_PATH_PREFIXES` (`api.ts:60`) — `apiFetch` does NOT attach a token to magic-link calls, so there is no token surface to leak from this Step at all. Email never logged. T-0001-094 input attrs verified. T-0001-095 confirmed (toast copy contains no email; thrown errors contain no email). |
| Accessibility | PASS | All 4 interactive shells have `accessibilityRole` + `accessibilityLabel`. `Button.tsx:62–63` adds `accessibilityState={{disabled, busy}}`. `BackButton.tsx:29–30` declares role + label. `TextInput.tsx:113` error message uses `accessibilityLiveRegion="polite"`. Send button label is dynamic per state via `signInCopy.a11ySend{Default,Sending,Resend}` (`copy.ts:21–23`, wired at `index.tsx:214–216, 196`). Hit targets ≥ 44pt: Button `minHeight: 44` (`Button.tsx:130`); BackButton `width/height: 44` (`BackButton.tsx:42–43`); expired-banner dismiss has `hitSlop={8}` (`index.tsx:247`). |
| Steps 1-5 regression | PASS | server 97/97, schema 5/5, mobile SessionProvider 13/13 (filter run). No drift. |

### AC Coverage trace

| AC (ADR §Step 6) | Test ID | Status |
|---|---|---|
| Default state: email empty + Send disabled | T-0001-086 | PASS — `index.test.tsx:160`, asserts `accessibilityState.disabled === true`. |
| Email validates inline; button enables when valid | T-0001-087, T-0001-090 | PASS — `:168` valid email enables; `:258` table-driven over `['notanemail','a@','@b.c']` asserts inline error copy `signInCopy.emailInvalid` AND Send disabled. |
| Tapping Send calls `/auth/magic-link`; UI transitions to "sent" | T-0001-088 | PASS — `:178` asserts `mockFetch` called once with `/auth/magic-link`, method POST; `screen.getByText('user@example.com')` proves the bold-email substitution. |
| "Resend" available after 30s cooldown | T-0001-089, T-0001-125 | PASS — `:196` resend label visible post-send; `:211` asserts disabled at t=0, t=29s, enabled at t=30s, then re-fire increments `mockFetch` call count to 2 and resets disabled. |
| Server error → toast copy | T-0001-091, T-0001-135 | PASS — `:273` 500 → `errorServer` copy AND distinct from rate-limit; `:289` 429 → `errorRateLimited` AND distinct from server. |
| Magic-link tap (deep link) → redeem + signed in | T-0001-098, T-0001-099 | PASS — cold (`deepLink.test.tsx:113`) and warm (`:125`) both assert `redeemToken` called exactly once with `{accessToken, refreshToken: ''}`. |
| Expired/used token banner | (UI surface only — wiring deferred) | DEFERRED — `showExpiredBanner` prop is implemented + rendered + a11y-live-regioned at `index.tsx:222–253`; the Navigator wiring (deep-link redeem failure → flip `showExpiredBanner=true`) is a Step 7 Navigation concern. See "ADR/Sable deviations" below. |
| All copy via single `copy.ts` module | (i18n discipline) | PASS — see "Copy i18n-codemod readiness" below. |
| Reduced-motion: animations collapse to opacity-only | T-0001-096 | PASS — `:420` mocks `AccessibilityInfo.isReduceMotionEnabled` to true, asserts headline + subhead + sent state copy identical. `Toast.tsx:58–85` branches: when `reduced=true`, only `opacity` animates (no `translateY`). |
| VoiceOver labels on every interactive element + 44pt hit targets | T-0001-094 (partial) | PASS — see Accessibility row above. |

All 10 AC bullets covered (1 deferred for Step 7 wiring with shipped UI surface).

### Debounce + cooldown precision

**Send-debounce (T-0001-126)** — `index.test.tsx:379`. Mock fetch returns a never-resolving promise so `mutation.isPending` stays true. Three rapid `fireEvent.press(send)` calls. `waitFor` for disabled state to settle, then asserts `mockFetch.toHaveBeenCalledTimes(1)`. The double-guard (`mutation.isPending || inFlightRef.current` at `index.tsx:110`) is justified: per Colby's comment at `:76–82`, without `inFlightRef` a synchronous second tap before React renders carries the previous render's closure where `isPending` was still `false`. The test's three-tap pattern is the right exercise — even with three taps inside one render boundary, only one network call fires. **Accept the double-guard.** Cleanup: test resolves the in-flight promise inside `act` (`:411`) before exiting, so no leaked promise.

**Cooldown precision (T-0001-125)** — `index.test.tsx:211`. Uses `jest.useFakeTimers({doNotFake: ['performance']})` + `jest.setSystemTime(1_000_000_000)`. Asserts disabled at t=0 (`:227`), still disabled after 29s (`:235`), enabled at exactly 30s (`:243`). Re-render is driven by the component's own `setInterval` calling `setNowTick` every 1s (`index.tsx:118`); `jest.advanceTimersByTime` triggers those ticks, which re-render and re-evaluate `cooldownActive` (`index.tsx:131`). Resend re-fire asserts `mockFetch.toHaveBeenCalledTimes(2)` and disabled flips back to true (`:252–255`). The component's interval is cleared in the `useEffect` cleanup (`index.tsx:125`) and once cooldown elapses (`:122`). **Test does not call `screen.unmount()` explicitly**; relies on RNTL auto-cleanup + `afterEach`'s `jest.useRealTimers()`. The "worker process force exited" warning in jest output is the visible signature of a residual timer at suite teardown — **soft observation**, not blocking (test passes, exits clean by force). Suggest adding an explicit `screen.unmount()` before the test returns for Roz M-10 cleanup discipline. Recording.

### Token / PII leak audit (Step 6 surfaces)

| Surface | Email/token in any log? |
|---|---|
| `screens/SignIn/index.tsx` | None — `grep console.` returns 0 matches in all Step 6 source files. Errors flow into `toast.show(message, {variant: 'error'})` where `message` is one of the three pre-canned `signInCopy.error{Server,RateLimited,Offline}` literals — none reference `email`. |
| `state/queries/auth.ts` | None. The mutation only logs via TanStack's internal mechanism (no `console.*` calls). `classifyMagicLinkError` returns enum values, not the error object. |
| `lib/deepLink.ts` | None. `redeemToken` failures are caught silently (`:97–100`); the comment cites the SessionProvider as the policy holder. No token in any log call. |
| `components/Toast.tsx` | Toast `accessibilityLabel` interpolates the message (`:105`). Since the message is one of the canned `signInCopy.error*` literals (not user input), no PII risk. |
| Magic-link request body | `auth.ts:46` JSON-stringifies `{email}` — sent over the wire to the API server, expected per route contract. Not a leak surface. |
| Network token leak | N/A — `/auth/magic-link` is in `PUBLIC_PATH_PREFIXES` (`api.ts:60`); `apiFetch` does NOT attach the bearer token for this call. The magic-link mutation never touches a token client-side at all. |

**Verdict:** clean. Step 6 introduces no new leak surface beyond the already-defended Step 5 surfaces. T-0001-095 `index.test.tsx:348` does the empirical test: typed email = `pii-canary@example.com`; mutation throws; toast copy queried with `new RegExp(email)` — asserts null.

### Copy i18n-codemod readiness (`screens/SignIn/copy.ts`)

PASS. All 18 keys are plain string literals on a single `as const` object. No template strings. No concatenation. The "sent" subhead is split into `sentSubheadPrefix` + `sentSubheadSuffix` (`copy.ts:25–26`) wrapping a `<Text>` JSX element for the bold email at `index.tsx:186–193` — this is the Lingui-friendly pattern (the JSX tree carries the substitution; the codemod wraps each literal independently). No inline ternaries that produce different copy variants — the only ternary in `index.tsx` (`:213–216`) chooses between two pre-defined `signInCopy.*` keys, which the codemod will wrap independently. Three error-class variants (`errorServer`, `errorRateLimited`, `errorOffline`) are addressed by the `classifyMagicLinkError` enum, not by string interpolation.

### Module boundaries (shell vs catalog)

PASS. `Button.tsx` and `TextInput.tsx` live in `apps/mobile/src/components/`. `grep -rn "Button|TextInput" packages/a2ui-renderer/` returns zero matches — the catalog versions don't exist yet (Step 7+ territory) and the shell versions don't poison the renderer namespace. Comments at `Button.tsx:1–3` and `TextInput.tsx:1–3` explicitly cite ARCHITECTURE.md §6 and call out the distinction.

### Navigation gating (T-0001-109 implied)

`Navigation.tsx:33–47`:
- `session.status === 'loading'` → `<HydrationSplash>` (centered spinner + "Signing you in…" copy from `signInCopy.verifyingHeadline`).
- `session.status === 'authenticated'` → `<Stack.Screen name="Home">`.
- `session.status === 'unauthenticated'` → `<Stack.Screen name="SignIn">`.
- `useAuthDeepLink()` mounted at the navigator level (line 29), BEFORE the conditional render — sees URLs regardless of which screen is mounted. PASS.

### Issues Found

None blocking.

Editorial notes (non-blocking):

- **T-0001-125 cleanup discipline.** Test does not call `screen.unmount()` before exit. RNTL's auto-cleanup runs in afterEach but the timing means `jest.useRealTimers()` (in `afterEach` at `:121`) runs first, which lets the component's internal `setInterval` (still scheduled in fake-timer land) leak into real-timer land at unmount. The "worker process force exited" warning in jest output is the visible signature. Tests pass. Suggest explicit `screen.unmount()` inside the test before `afterEach` runs. Recording for Roz M-10.

- **`also: ApiError instance check`** (`index.test.tsx:437`) is a sanity test, not a T-ID. Belt-and-suspenders for Future Roz; no objection.

- **`expired-link banner` is shipped UI but not wired.** See ADR/Sable deviations below.

### ADR/Sable deviations Colby called out

1. **`inFlightRef` + `mutation.isPending` double-guard.** **ACCEPTED.** The justification (synchronous re-tap before React renders carries stale closure where `isPending === false`) is technically correct. RN's event loop can deliver multiple `Pressable.onPress` events between two paint cycles, and TanStack's `mutation.isPending` toggle is a state setter that requires a render to propagate. The `inFlightRef` is the synchronous gate that closes the race. T-0001-126 verifies the canonical assertion (`mockFetch.toHaveBeenCalledTimes(1)` after three rapid taps). The `inFlightRef` is cleared in a `finally` block (`index.tsx:103`) so a thrown mutation doesn't permanently lock the button.

2. **`showExpiredBanner` prop unwired.** **ACCEPTED.** The prop accepts + renders + dismiss-handles correctly (`index.tsx:222–253`), with `accessibilityLiveRegion="polite"` on the banner text (`:239`). The Navigator-level wiring (deep-link redeem failure → set `showExpiredBanner=true` on SignIn) is genuinely a Step 7 concern: it requires both (a) a route param mechanism and (b) a session-state listener for `RedeemFailedError`. Step 6's contract was the screen surface, not the cross-cutting wire. Carry-forward note for Step 7: Cal must include the `showExpiredBanner=true` flip path in the Navigation acceptance criteria, otherwise this prop becomes dead code.

### Cal patch verification

- ADR §Step 6 summary now Boundary=3, Total=20: PASS — `ADR-0001-foundation.md:697` reads `| Boundary | 3 |`; line 704 reads `| **Total (excl. N/A)** | **20** |`. Recount of §Step 6 Tests table (lines 668–690): three Boundary rows (T-0001-125 line 673, T-0001-092 line 677, T-0001-102 line 690). Math holds.
- Test Totals row 6 now 20, global 135: PASS — `:775` reads `| 6 | 20 | 6 | 6 | ✅ |`; `:778` reads `| **Total** | **135** | **31** | **38** | **✅** |`.
- T-0001-133 wording aligned: PASS — `:639` text now reads `"the next apiFetch rejects with NotAuthenticatedError (refresh is fire-and-forget — no awaiting caller to receive a typed RefreshFailedError; user-visible state is identical)"`. Matches Step 5 implementation. Carry-forward closed.

### Carry-forward

- New: **T-0001-125 cleanup discipline** (above) — Step 7 should follow the same fake-timer + setInterval pattern; suggest establishing `unmount()` before `afterEach` as house style.
- New: **`showExpiredBanner` wiring for Step 7** — Cal must specify the redeem-failure → flag path, otherwise the prop is dead code.
- Closed: T-0001-133 wording, Step 6 boundary count (Cal patch landed).

### Roz's assessment

Six clean passes. The Sign-In screen lands tight: every state from Sable's matrix has a code path, every code path has at least one T-ID, and the T-IDs are specific assertions, not "renders without crashing" placebos. The `copy.ts` discipline is exemplary — 18 string literals on a single object, no concatenation, no templated branches. The Lingui codemod will be a one-pass `Object.keys` walk.

The double-guard on send-debounce is the right call. `mutation.isPending` alone would have been theoretically sufficient if React rendered synchronously after every state setter, but it doesn't — and the test exercises the actual race (three rapid taps in one render boundary). The synchronous `inFlightRef` is the belt to React's suspenders. T-0001-126's assertion (call count exactly 1) is the canonical observable.

The cooldown test (T-0001-125) is the cleanest fake-timer pattern I've reviewed in this ADR: drives re-renders via the component's own `setInterval` (rather than test-side rerenders), asserts at three time points (t=0, t=29s, t=30s) with the boundary condition both above and below, then proves the re-fire path. The `setNowTick` interval in the component is the right re-render trigger — Colby's stale-closure fix. The one nit is the missing explicit `unmount()` (Roz M-10), which the jest "worker force exited" warning is the visible footprint of. Tests pass; recording for next cycle.

Token-leak surface for Step 6 is genuinely empty: `/auth/magic-link` is a public route (`PUBLIC_PATH_PREFIXES` in `api.ts:60`), so `apiFetch` never attaches a token for the magic-link call. The screen never logs. The deep-link handler swallows redeem errors silently with a comment citing the SessionProvider as the policy holder. Email is in the request body (expected) and in the rendered "sent" subhead (also expected); nowhere else.

The `showExpiredBanner` deferral is defensible: the prop is shipped, accessible, and wired to a dismiss handler; the cross-cutting flip path (deep-link redeem failure → SignIn route param) belongs to Navigation, which is a Step 7 surface. Cal — please codify this in the Step 7 ADR so the prop doesn't become dead code.

Cal's three carry-forwards are closed (boundary count, total, T-0001-133 wording). Step 6 closes. Step 7 (Home library) is greenlit pending `showExpiredBanner` wiring being added to the Navigation acceptance criteria.

— Roz

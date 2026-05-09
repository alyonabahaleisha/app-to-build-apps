# QA Report — ADR-0006 Step 8 (Compound tier + AI bridge)

_Reviewed by Roz — 2026-05-07_

## Verdict: FAIL

Two gating issues. The structural work is clean — the AI chain is broken end-to-end, and the ListSummary error/timeout state is unimplemented relative to the ADR AC.

| Check | Status |
|---|---|
| Type Check | PASS |
| Lint | PASS — 0 errors |
| Tests (V0) | PASS — 439/439 |
| Tests (Legacy) | PASS — 211/211 |
| Coverage (compound) | PASS — 95.45% stmt / 80.43% branch |
| useEffect ban (§K) | PASS — zero in compound; AICapabilitiesProvider exempt |
| `queueMicrotask` pattern | ACCEPT WITH AMENDMENT NOTE |
| NodeRenderer 26-arm switch | PASS |
| AI middleware end-to-end | **FAIL** — `aiBridge.ts` passes `items: []` |
| T-0006-144/145 vs ADR AC | **FAIL** — no error/timeout state implemented |
| Mock placement | PASS — `expo-image-picker` + `react-native-ai-apple` mocks in `src/v0/__test-utils__/jestSetup.js` |
| DateField/Picker Gorhom | N/A — ADR Step 8 doesn't cover; Step 6 stubs stand |
| Scope creep | PASS |

---

## Findings

### Finding 1 (GATING) — aiBridge passes `items: []` (Step 2 placeholder unchanged)

**File:** `packages/a2ui-renderer/src/v0/state/middleware/aiBridge.ts` line 46

```ts
dispatcher.summarize({prompt: action.prompt, items: []})
```

Step 2 placeholder. Step 8 wired the dispatcher but never updated the middleware to resolve collection rows from state. **Every `aiProcess(summarize)` sends empty items to the native model.** The sanitization guard T-0006-147 verifies runs on zero rows. On real hardware the model receives prompt only — meaningless output.

**Fix:** `makeAIBridgeMiddleware` needs a state getter parameter analogous to `makeUndoBufferMiddleware`'s. `useRendererState.ts` already has `fullStateRef`; pass `() => fullStateRef.current` to the AI middleware. Resolve `state.collections.get(action.collection)` before calling the dispatcher.

**Test gap (Finding 3 below):** `aiBridge.test.ts` T-0006-021 asserts `expect(mockAI.summarize).toHaveBeenCalled()` but not `toHaveBeenCalledWith({prompt, items: <real rows>})`. The mock ignores `items` so the chain breakage isn't detected.

### Finding 2 (GATING) — T-0006-144/145 don't fulfill ADR AC

**Files:** `ListSummary.test.tsx` 287-321; `ListSummary.tsx` (no error/timeout render path).

ADR specifies:
- T-0006-144: "ListSummary falls back to **error state**"
- T-0006-145: "ListSummary shows **timeout state**"

Implementation has neither. When AI rejection or 30s timeout fires, the slot stays empty, and ListSummary shows `<LoadingShimmer>` indefinitely. Tests assert `getByTestId('list-summary-loading')` — confirming the shimmer, not an error state. T-139 already covers "slot empty → shimmer." T-144/145 are tautological.

**Resolution paths:**

- **Path A:** Implement distinct error/timeout states. Larger surgery.
- **Path B (recommended):** Cal amends the ADR ACs to "loading shimmer persists; host receives `onAIError` and decides UX (hide/toast)." Architecturally defensible: graceful-degradation lives in the host, not the renderer. Rewrite T-144/145 to verify `host.onAIError` was called on rejection/timeout.

### Finding 3 (Advisory, bundled with Fix 1) — aiBridge test missing items assertion

`aiBridge.test.ts` line 32. After Fix 1 lands, tighten to `toHaveBeenCalledWith({prompt, items: [...rows]})`.

### Finding 4 (Advisory) — `aiCapabilitiesCheck.ts` stale comment

Line 11 claims "ONLY place that touches `react-native-ai-apple`" — `aiDispatcher.ts` does too. Update.

### Finding 5 (Advisory) — `isSupported` false→true async transition untested

`useAICapabilities` mocked statically; async-resolution race not exercised. Confirms ADR MT-10 still open.

### Finding 6 (Advisory) — Unmount race in `queueMicrotask` dispatch

If parent unmounts ListSummary between render and microtask, dispatch fires into possibly-dead context. `useRendererState`'s `mountedRef` covers downstream. Component-level `dispatchedRef` doesn't. Document as known limitation.

---

## `queueMicrotask` Ruling — ACCEPT WITH AMENDMENT NOTE

Semantic difference from `useEffect` is real:
- `useEffect`: lifecycle subscription, cleanup hook, scheduler control, strict-mode double-fires.
- `queueMicrotask` + ref guard: one-shot, no lifecycle subscription, no cleanup, fires after render commit at microtask checkpoint, strict-mode safe via persistent ref.

Accepted with conditions:
1. Restricted to `ListSummary` only.
2. Cal adds §K amendment formalizing this as the approved AI dispatch-on-mount workaround.
3. Finding 6 documented as known limitation.

---

## Required Fixes for Round 2

1. **Wire aiBridge state resolution.** Pass `getState` to `makeAIBridgeMiddleware`. Resolve collection rows before dispatcher call. Update `useRendererState.ts` accordingly.
2. **Tighten `aiBridge.test.ts`** — assert `summarize` called with actual row data (closes Finding 3).
3. **Path B for T-144/145:** Rewrite to verify `host.onAIError` is called on rejection/timeout. Update test descriptions to match what's actually being tested.
4. **(Optional) Update stale comment** in `aiCapabilitiesCheck.ts` (Finding 4).

## Cal Tasks (Non-Gating, Paperwork)

1. ADR §K amendment: `queueMicrotask` pattern formalized for ListSummary.
2. ADR T-0006-144/145 AC amendment: "loading shimmer persists; host owns error UX via `onAIError`."
3. Carry-forward Cal tasks: §State Model binding (Step 5), useReducedMotion §K (Step 3), DateField/Picker stub (Step 6), FlashList v1→v2 §L (Step 7).

---

## Roz's Assessment

Structural work is clean. Four compound components, no `useEffect` leaks, FlashList horizontal in MediaTray correct, ImagePicker paths covered, NodeRenderer 26-arm switch intact. `queueMicrotask` pattern accepted — genuinely different from useEffect, single appropriate site.

Two breakages. Finding 1 is consequential — the native model receives empty items every call. Real feature broken on real hardware. Fix is one parameter and three lines.

Finding 2 is a requirements gap masquerading as test coverage. Tests assert what's already covered by T-139; they pass without verifying error handling. Path B (Cal amendment + rewritten tests) is the right call.

Both fixes addressable in one round.

**Step 9 unblocks after PASS.**

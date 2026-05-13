# App QA Bug Log
> Branch: agent/M2-VS-01 | Date: 2026-05-13 | Tester: Claude Code (MCP + idb automation)
> Device: iPhone 16 Pro simulator · iOS 18.3 · dev-client build

---

## ~~BUG-000~~ · FIXED — Delete / Archive from Run screen meatball did not work

**Root cause (2 layers):**  
1. `navigation.goBack()` was inside `onSuccess` — never fired without API. Fixed by moving it to fire immediately on confirm.  
2. `apiFetch` always sent `Content-Type: application/json` even on bodyless DELETE/POST requests. Fastify returned `400 FST_ERR_CTP_EMPTY_JSON_BODY`, triggering `onError` cache rollback so the item silently reappeared. Fixed by only setting the header when `rest.body != null`.

**PR:** agent/M2-VS-01 — commits `fix(run): optimistic nav on delete/archive + error toast` + `fix(api): omit Content-Type header on bodyless requests (delete/archive)`

---

## BUG-001 · P0 · CRASH — App restarts to sign-in after successful generation

**Screen:** Create → Generating → Run  
**Steps:**
1. Skip auth (dev)
2. Tap "+ New", select "Daily mood journal" chip
3. Tap Generate FAB
4. Observe "Building your tool…" loading screen (~6 s)
5. App navigates briefly to the generated Run screen, then restarts to the Canvas sign-in screen

**Evidence:** Process PID changed (29567 → 35199) confirming a hard restart. The new project **does** persist in the Library ("Mood Journal — created 2 minutes ago"), so generation succeeded but post-generation navigation crashes the app.

**Expected:** User lands on the Run screen and stays there.  
**Severity:** P0 — the core create-and-view flow crashes every time the Generating screen dismisses.

---

## BUG-002 · P1 · NAVIGATION — Create screen has no back/cancel button

**Screen:** Create (reached via Library "+ New" or via meatball → "Make changes")  
**Observation:**
- No explicit close or back button is rendered.
- The avatar circle in the top-right is a confirmed no-op stub (`handleAvatarPress` → `// Stub: no-op in Step 8`).
- iOS edge-swipe gesture does not trigger back navigation.
- Force-quitting and relaunching the app resumes on the Create screen (session preserved).

**Expected:** A `×` or `‹` button returns the user to the previous screen.  
**Severity:** P1 — users who arrive via "Make changes" and change their mind are trapped with no escape except generating again.

---

## BUG-003 · P1 · RENDER — Generated-app list items are non-interactive (AXStaticText)

**Screens:** Weekly Grocery List ("Tap an item to mark it as picked up"), Mood Journal ("Example — tap to delete")  
**Observation:** Items the spec labels as tap-to-act are rendered with `role: AXStaticText`. Tapping them has no effect.

```
AXLabel: "Example — tap to delete"
role:    AXStaticText     ← should be AXButton or interactive element
```

Confirmed in both the Grocery List (5 seed items) and Mood Journal (1 seed entry).

**Expected:** Tapping an item marks it picked up / deletes it per the in-app label.  
**Severity:** P1 — core generated-app interactivity is broken; apps feel dead to users.

---

## BUG-004 · P2 · WRONG TEXT — Editing banner shows truncated UUID instead of project title

**Screen:** Create, when arrived via meatball → "Make changes"  
**Observed:** `Editing '426281fc' ×`  
**Expected:** `Editing 'Mood Journal' ×`  
**Evidence:** AXLabel on the editing-pill text node: `"Editing '426281fc'"` (first 8 chars of project UUID, no title lookup).

**Severity:** P2 — confusing for users editing an existing app.

---

## BUG-005 · P2 · VISUAL — Library card thumbnails never load (all gray placeholders)

**Screen:** Library grid  
**Observation:** Every project card shows a solid gray fill where cover-art should appear. No spinner, no error — the placeholder never resolves, even across app restarts.

**Likely cause:** Cover-art URL comes from the API; with no API running the URL is null and the fallback renders a featureless gray view.

**Expected:** Either a real thumbnail or a recognisable empty-state (app icon, initial letter, etc.).  
**Severity:** P2 — Library looks unfinished; difficult to distinguish projects visually.

---

## BUG-006 · P2 · BEHAVIOR — "New mood entry" button shows no visible feedback

**Screen:** Run → Mood Journal  
**Observation:** Tapping the pink "New mood entry" `AXButton` (56×56 pt, `enabled: true`) produces no visible state change, animation, or toast.

**Possible causes:**
- Action dispatches a spec mutation requiring the API to persist → silently dropped with no error feedback.
- Dispatch action wired incorrectly in the renderer.

**Expected:** Visible feedback — new entry appears, loading indicator shows, or an "offline" toast explains the failure.  
**Severity:** P2 — need API running to distinguish a renderer bug from a swallowed network error.

---

## BUG-007 · P2 · ACCESSIBILITY — Bottom sheet items not individually AT-reachable

**Screens:** Run meatball menu, Rename sheet  
**Observation:** Individual action rows (Share, Copy link, Make changes, Rename, Archive, Delete) are not exposed as separate AX elements. The entire sheet appears as a single `AXSlider` labelled "Bottom Sheet".

```
AXRole:  AXSlider
AXLabel: "Bottom Sheet"    ← opaque; individual rows invisible to VoiceOver
```

**Expected:** Each row should be an `AXButton` with its action label.  
**Severity:** P2 — accessibility compliance gap; VoiceOver users cannot reach sheet actions.

---

## BUG-008 · P3 · LAYOUT — Suggestion chip labels visually truncated

**Screen:** Create  

| Displayed | Full label |
|-----------|-----------|
| `Medication remind...` | `Medication reminder log` |
| `Simple expense tra...` | `Simple expense tracker` |

Full strings are present in `AXLabel`; truncation is purely visual (chip width 181 pt, single-line, no wrap).

**Expected:** Wider chips, 2-line labels, or shorter copy.  
**Severity:** P3 — cosmetic; full text accessible via AX.

---

## BUG-009 · P3 · LAYOUT — Library card titles truncated mid-word

**Screen:** Library grid (search active)  
**Observed:** `Daily Affirmati...` instead of `Daily Affirmations`  
**Severity:** P3 — cosmetic.

---

## BUG-010 · P3 · ACCESSIBILITY — Empty AXUniqueId on some library cards

**Screen:** Library grid  
**Observation:** Project card buttons deeper in the list (y > 786 pt) have `AXUniqueId: ""` (empty string) rather than `null` or a stable ID. Cards in the first two rows carry `null`.

**Expected:** Consistent `null` or a stable ID like `project-card-<uuid>`.  
**Severity:** P3 — automation and AT navigation reliability.

---

## Known / Intentional (not bugs)

| Item | Note |
|------|------|
| Settings / avatar button is a no-op | `// Stub: no-op in Step 8; the sheet ref will be wired in SettingsSheet PR` |
| "Voice input — coming soon" mic button | Opens waitlist sign-up — intentional per AXLabel help text |

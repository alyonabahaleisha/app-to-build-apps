# Canvas V0 — Milestone A Visual Demo

**Status:** Ready to build. Shipped between ADR-0006 Steps 5 and 6.

This shim lets you mount the V0 renderer on the iOS Simulator with a single
env flag. No backend is required. The screen is static — no AI, no inputs,
no navigation. It proves the renderer compiles and mounts the sample spec.

---

## Enabling the demo

### 1. Set the flag

In `apps/mobile/.env` (create if absent):

```
EXPO_PUBLIC_CANVAS_V0_DEMO=true
```

Or pass it inline to the EAS build command (see step 2).

### 2. Rebuild the dev-client

Expo evaluates `EXPO_PUBLIC_*` at build time, so a Metro restart alone is NOT
enough. You must rebuild the dev-client after setting the flag:

```bash
eas build --profile development --platform ios
```

Install the resulting `.ipa` on the Simulator via Xcode's Devices & Simulators
window, or with `xcrun simctl install booted <path-to.app>`.

### 3. Start the dev server

```bash
pnpm --filter @app-creator/mobile start
```

Open the installed dev-client on the Simulator. Navigate to any `AppRunner`
screen — the route still requires a `projectId` param in the nav stack, but the
screen body ignores it and renders the sample spec instead.

---

## What you should see

A full-bleed screen in the **productive x focus** stance/palette:

- Safe-area padding at top and bottom (the `Screen` node handles this).
- An `Avatar` — circular, medium size, initials "AJ" for "Alex Johnson".
- A `Section` titled **"Today"** containing:
  - A `Heading` (level 1): **"Welcome"**
  - A `Body`: **"Here's what's on deck today."**
  - A `Card` (raised elevation) containing:
    - A `Row` of three `Stat` nodes: **5 tasks** (+2), **12 done**, **2 pending** (-1)
    - A `Row` containing two `Badge` nodes (**Active** / **Overdue**) and one
      selected `Chip` (**All**)

No nav header. No back button. No publish CTA. This is a renderer demo, not a
product screen.

---

## Known limitations (Milestone A scope)

- No navigation — `navigation: 'none'` in the spec.
- No interactive nodes — all content is read-only Typography and Display.
- No AI bridge — `onAIError` is a no-op.
- No toast surface wired — `onToast` is a no-op.
- The AppRunner nav shell (back button, title bar) is absent when the flag is
  set. This is intentional — Step 11 of ADR-0006 replaces the entire
  AppRunner with the full V0 `<Renderer>` component.

---

## Disabling the demo

Remove or set the flag to anything other than `'true'`:

```
EXPO_PUBLIC_CANVAS_V0_DEMO=false
```

Then rebuild the dev-client. The M1 legacy AppRunner path is fully restored —
the shim is a pure additive branch with no side effects on the existing surface.

---

## Code location

| What | Where |
|---|---|
| Flag gate + `V0DemoRunner` | `apps/mobile/src/screens/AppRunner/index.tsx` |
| `__V0_*` package exports | `packages/a2ui-renderer/src/index.ts` |
| Sample spec | `packages/a2ui-renderer/src/v0/__demo__/sampleSpec.ts` |
| Branch tests | `apps/mobile/src/screens/AppRunner/index.test.tsx` |

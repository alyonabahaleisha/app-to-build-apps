# Canvas — Generated App User Research Report
> **Date:** 2026-05-13  
> **Method:** AI-generated apps evaluated by simulated user personas + PM & designer synthesis  
> **Apps tested:** 5 (generated live in simulator, iPhone 16 Pro, iOS 18.3, dev-client)  
> **Evaluators:** Maya (nurse/health), Tom (freelancer/practical), Zoe (UX researcher/wellness)  
> **Analysts:** PM, Lead Designer

---

## Executive Summary

Five apps were generated via Canvas's prompt → LLM → V0 renderer pipeline and evaluated cold by three distinct user personas. **Two apps are ready for priority polishing (Daily Check-In, Water Tracker). Two have high potential blocked by a single fixable defect (Morning Routine, Freelance Hours). One requires significant rework (Grocery Budget).**

The generation quality is impressive — all five apps were navigable, named themselves correctly, and had logical component layouts. The failures are concentrated in **interaction feedback** (users cannot tell if taps register) and **data presentation edge cases** (null values render blank, currency line-breaks). These are renderer and prompt gaps, not fundamental model failures.

**The one metric that matters:** Day-2 active rate on generated apps. Canvas has crossed the "impressive demo" bar. The question is whether it can cross the "tool I come back to" bar.

---

## Apps Generated

All 5 apps were generated in sequence via the Create screen. Generation time averaged ~20 seconds per app.

### App 1 — Water Tracker
**Prompt:** *"Build me a water tracker. Show a stat tile for today's total ounces and a stat tile for my daily goal (64 oz). Add a button to log 8 oz, a button to log 16 oz, and a button to reset today's count. Show a metric tile with the percentage of my goal reached today."*

**What was generated:**
- Today / History tab navigation
- Stat tiles: "Today's Intake: 0 oz" · "Daily Goal: 64 oz"
- Metric tile: "0% of Goal Reached — Target: 64 oz"
- "+8 oz" and "+16 oz" buttons (green) · "Reset Today" (red)
- Tip card: "Stay hydrated! The recommended daily intake is 64 oz (8 cups)."

**Observed issues:** None structural. Reset button renders in danger red (tone mismatch for wellness context).

---

### App 2 — Freelance Hours Log
**Prompt:** *"Create a freelance hours tracker. I have three clients: Acme, Bloom, and Crestwood. Show a stat tile for total hours logged this week. Add a list of clients where I can tap each one to log 30 minutes or 1 hour of work. Show a metric tile for estimated earnings this week assuming $85 per hour."*

**What was generated:**
- This Week / History tab navigation
- Stat tile: "0 hrs — Hours This Week" · Est. Earnings tile (renders blank — no value)
- Client rows: Acme · Bloom · Crestwood, each with "+30m" and "+1h" teal buttons
- "0 hrs logged" sub-label per client

**Observed issues:** Est. Earnings metric tile renders blank when no hours are logged. No hourly rate configured — metric has nothing to compute from. Users interpret blank as broken, not loading.

---

### App 3 — Morning Routine Checklist
**Prompt:** *"Make a morning routine tracker for weekdays. Show a list with these habits: drink water, 10-minute stretch, read for 15 minutes, review my day's top 3 goals. Each item should be tappable to mark complete. Show a stat tile with how many habits I've done today and a button to reset all habits for the next morning."*

**What was generated:**
- Today / History tab navigation
- Subtitle: "Weekday habits to start strong ☀️"
- Stat tile: "0 — Habits Done Today — Keep going!"
- Habit list: Drink Water · 10-Minute Stretch · Read for 15 Minutes · Review Top 3 Goals (each showing "Pending" at right edge)
- Tip card + "Reset All Habits" button

**Observed issues (CONFIRMED BUG-003):** Habit row checkbox tap targets are rendered at `x = -9690` (off-screen). The list items are visually static — "Pending" reads as a status label, not a tap affordance. The entire core interaction of the app is inaccessible. AX snapshot confirmed checkboxes are off-screen buttons invisible to both users and accessibility tools.

---

### App 4 — Daily Check-In (Mood & Energy Journal)
**Prompt:** *"Build a daily mood and energy check-in. Show two rows of buttons: one row for mood (Great, Okay, Low) and one row for energy (High, Medium, Drained). After I tap one from each row, show today's selections as stat tiles. Add a metric tile showing my most common mood this week based on my logs."*

**What was generated:**
- Today / History tab navigation
- Subtitle: "How are you feeling today?"
- Mood row: 😊 Great · 😐 Okay · 😒 Low (chip buttons)
- Energy row: ⚡ High · 🔋 Medium · 📱 Drained (chip buttons — emoji choices show genuine wit)
- Stat tiles: "Mood / Today" · "Energy / Today" (empty until buttons tapped)
- "Save Check-In" button (green, full-width)

**Observed issues:** Stat tiles show empty before any interaction — reads as broken placeholder rather than intentional pre-action state.

---

### App 5 — Grocery Budget Tracker
**Prompt:** *"Create a grocery budget tracker. Show a stat tile for my budget ($120) and a stat tile for amount spent so far. Add a list of common items I buy: milk ($4), eggs ($5), bread ($3), chicken ($10), snacks ($8). Each item should be tappable to add it to my cart total. Add a button to clear the cart and start over. Show a metric tile for how much budget I have remaining."*

**What was generated:**
- Shop / Summary tab navigation
- Stat tiles: "$120.00 Total Budget" (line-break renders as "$120.\n00") · "0 Amount Spent" (missing dollar sign)
- Metric tile: "$120.00 Remaining Budget — of $120 budget"
- Common items list: Milk $4 · Eggs $5 · Bread $3 · Chicken $10 · Snacks $8 (teal price badges per row)

**Observed issues:** Two number formatting failures on the first screen. "$120.\n00" line-break damages trust immediately. "0 Amount Spent" missing unit. Items appear tappable (teal badges) but no visible add-to-cart mechanic confirmed.

---

## User Group Evaluation

### Scoring Dimensions (1–5)
1. **Purpose Clarity** — immediate understanding of what the app does
2. **First-Action Discoverability** — finding the first thing to do without instruction
3. **Data Legibility** — numbers, labels, and states are readable and meaningful
4. **Interaction Feedback** — app communicates that actions were received
5. **Layout Coherence** — screen feels organized with clear hierarchy
6. **Task Completion Confidence** — user believes they accomplished what they intended
7. **Personal Fit** — user would actually use this in their own life

---

### Maya (32, ER nurse · health-conscious · impatient)

| App | Clarity | Discover | Legible | Feedback | Coherence | Confidence | Fit | Verdict |
|-----|---------|----------|---------|----------|-----------|------------|-----|---------|
| Water Tracker | 5 | 5 | 4 | 3 | 4 | 4 | 5 | **Yes** |
| Freelance Hours | 4 | 4 | 2 | 3 | 3 | 3 | 1 | No |
| Morning Routine | 5 | 1 | 3 | 1 | 4 | 2 | 4 | Conditional |
| Daily Check-In | 5 | 5 | 3 | 4 | 5 | 4 | 3 | Conditional |
| Grocery Budget | 4 | 4 | 2 | 3 | 3 | 3 | 2 | No |

**Maya's key quotes:**
- *"If the number doesn't update the instant I tap, I will not trust it and I'll stop logging."* (Water Tracker)
- *"I'm staring at 'Pending' and I have no idea if that's a button or just a label."* (Morning Routine)
- *"Fix the tap affordance and this becomes my favorite of the five."* (Morning Routine)
- *"After a brutal 12-hour shift I might actually use this."* (Daily Check-In)
- *"I see '$120.\n00' and my brain flags this as a buggy app."* (Grocery Budget)

**Make-or-break per app:** Water Tracker → instant state update. Morning Routine → visible tap affordance. Daily Check-In → History must show trends, not just logs. Grocery Budget → fix the rendering glitch.

---

### Tom (45, freelance graphic designer · 15 years experience · skeptical/practical)

| App | Clarity | Discover | Legible | Feedback | Coherence | Confidence | Fit | Verdict |
|-----|---------|----------|---------|----------|-----------|------------|-----|---------|
| Water Tracker | 5 | 5 | 4 | 3 | 4 | 5 | 1 | Conditional |
| Freelance Hours | 5 | 5 | 2 | 3 | 3 | 3 | 4 | Conditional* |
| Morning Routine | 4 | 1 | 3 | 1 | 3 | 1 | 2 | **No** |
| Daily Check-In | 5 | 5 | 3 | 3 | 4 | 4 | 1 | No |
| Grocery Budget | 4 | 2 | 2 | 2 | 2 | 2 | 2 | No |

**Tom's key quotes:**
- *"That blank 'Est. Earnings' tile is like a punch in the gut right at the start."* (Freelance Hours)
- *"I'd tap around for 20 seconds and delete it."* (Morning Routine)
- *"The display layer is mostly fine. The interaction layer is where things fall apart."* (cross-app)
- *"An app I can see but not confidently use is just a pretty screenshot."* (cross-app)
- *"This is the app I'd pay for — but only after that earnings tile is fixed."* (Freelance Hours)

**Make-or-break per app:** Freelance Hours → populate Est. Earnings with at least $0.00 and a way to set hourly rate. Morning Routine → any discoverable first action. Grocery Budget → fix the rendering glitch as table stakes.

---

### Zoe (26, UX researcher · wellness-focused · design-literate)

| App | Clarity | Discover | Legible | Feedback | Coherence | Confidence | Fit | Verdict |
|-----|---------|----------|---------|----------|-----------|------------|-----|---------|
| Water Tracker | 4 | 4 | 3 | 2 | 3 | 4 | 2 | Conditional |
| Freelance Hours | 5 | 4 | 3 | 2 | 4 | 3 | 2 | No |
| Morning Routine | 5 | 2 | 4 | 1 | 3 | 2 | 3 | Conditional |
| Daily Check-In | 5 | 5 | 3 | 3 | 4 | 4 | 5 | **Adopt** |
| Grocery Budget | 4 | 2 | 2 | 1 | 3 | 2 | 2 | No |

**Zoe's key quotes:**
- *"The red Reset button is the first thing that catches my eye. Why is the most alarming-looking button the one I'm most likely to accidentally tap?"* (Water Tracker)
- *"The soul is there. The interaction layer needs to be rebuilt."* (Morning Routine)
- *"The 📱 Drained icon is a little moment of wit I noticed."* (Daily Check-In)
- *"This is the only one I'd add to my home screen today."* (Daily Check-In)
- *"In wellness apps, that confirmation moment — the small animation — is load-bearing for habit formation."* (cross-app)
- *"Canvas needs to make post-tap feedback a first-class output."* (cross-app)

**Make-or-break per app:** Water Tracker → fix red reset tone. Morning Routine → checkbox affordance (dopamine loop never closes without it). Daily Check-In → button selection state must be visible.

---

### Cross-User Scores (Averaged)

| App | Clarity | Discover | Legible | Feedback | Coherence | Confidence | Fit | Overall |
|-----|---------|----------|---------|----------|-----------|------------|-----|---------|
| Water Tracker | **4.7** | **4.7** | 3.7 | 2.7 | 3.7 | **4.3** | 2.7 | 3.8 |
| Freelance Hours | **4.7** | **4.3** | 2.3 | 2.7 | 3.3 | 3.0 | 2.3 | 3.2 |
| Morning Routine | **4.7** | 1.3 | 3.3 | 1.0 | 3.3 | 1.7 | 3.0 | 2.6 |
| Daily Check-In | **5.0** | **5.0** | 3.0 | 3.3 | **4.3** | **4.0** | 3.0 | **3.9** |
| Grocery Budget | 4.0 | 2.7 | 2.0 | 1.3 | 2.7 | 2.3 | 2.0 | 2.4 |

**Lowest scoring dimension across all apps: Interaction Feedback (avg 2.2).** Every app has a logging action. None clearly confirm the action landed.

---

## PM Analysis

### App Rankings — Viability as Daily Tools

**#1 — Daily Check-In** · Only Adopt verdict. Strongest first-action discoverability (5.0/5.0). Core loop is coherent. One condition: History must show trends, not just raw entries. Fix that and this ships.

**#2 — Water Tracker** · All three gave Conditional, all for different low-cost reasons. Maya wants instant state update (latency, not design). Tom's barrier is domain mismatch (not a product flaw). Zoe wants warmer tone on the reset button. Lowest fix cost of any Conditional app.

**#3 — Morning Routine** · Highest ceiling, lowest current floor. Highest concept resonance across all three personas. Killed by a single layout bug (BUG-003 — checkboxes at x=-9690). Fix the bug, fix the affordance, and this competes with Daily Check-In for the wellness segment.

**#4 — Freelance Hours** · Structurally sound for a professional tool. Fails on one thing: blank Est. Earnings tile. For a money-tracking app, an empty earnings field reads as "app not working." Tom's "hard conditional" is accurate. One render fix away from being viable for the freelancer segment.

**#5 — Grocery Budget** · Multiple compounding issues. No single fix recovers it. Deprioritize until the inline-add catalog gap is filled.

### Top 3 Priority Fixes (Highest ROI)

**Fix 1 — BUG-003: Checkbox layout off-screen (`x=-9690`)**
Morning Routine's core interaction is completely inaccessible. Checkboxes render with a negative x-offset derived from incorrect absolute positioning. Replace with a `flexDirection: 'row'` / `justifyContent: 'space-between'` layout. Checkboxes stay within row bounds at all label lengths. Estimate: 2 hours. Recovers an entire app.

**Fix 2 — Number formatting guard (Stat tile + Metric tile)**
Two apps affected. Three sub-fixes:
1. Wrap value + unit in `flexWrap: 'nowrap'` row to prevent mid-number line breaks.
2. Always prepend/append unit when value is zero (e.g., "$0", "0 oz") — zero is valid data.
3. Metric tile with null/uncomputed value shows `emptyLabel` field ("Log hours to see earnings"), not blank.
Estimate: 3 hours. Eliminates trust-destroying display bugs across two apps.

**Fix 3 — Interactive element tap affordance (end of the "Pending" anti-pattern)**
"Pending" as a state label on an interactive row is banned. Any actionable state must render a visual tap affordance: trailing chevron, checkbox shape, or button container. This is both a renderer rule and a prompt rule. Add to LLM system prompt: *"Never emit a label or status string for an element that has an action. Use rowType: 'checkbox' for interactive list items."*
Estimate: 2 hours renderer + 1 hour prompt. Prevents recurrence in every future generated app.

### Catalog Gap Analysis

| Missing component/behavior | Evidence | Affected apps |
|----------------------------|----------|---------------|
| **Inline add / text input in list context** | All 3 users expected to add custom items/entries dynamically | Grocery Budget, Freelance Hours |
| **Trend / sparkline visualization** | Daily Check-In adopted conditionally on History showing patterns | Daily Check-In, Morning Routine |
| **Contextual empty state per component** | Blank tiles in 3 of 5 apps | Freelance Hours, Grocery Budget, Daily Check-In |
| **Tappable label / action chip** | "Pending" has no affordance | Morning Routine |
| **Color intent field on buttons** | Red reset in wellness app — destructive color used for non-destructive action | Water Tracker, Morning Routine |

### Adoption Likelihood by Segment

| App | Segment | PMF likelihood | Condition |
|-----|---------|---------------|-----------|
| Daily Check-In | Wellness/self-reflection, 22–38 | **High** | History tab shows trends |
| Water Tracker | Health-habit, 25–45 | **Moderate** | Tap latency <100ms perceptually |
| Freelance Hours | Solo freelancers | **Moderate** | Fix blank earnings tile |
| Morning Routine | Productivity/wellness overlap | Low→Moderate (high upside) | BUG-003 + affordance both fixed |
| Grocery Budget | Household budget trackers | **Low this sprint** | Requires inline-add component |

### Prompt Engineering Recommendations

1. **Enforce currency formatting:** Add to system prompt catalog section — "Currency stat values must use the `unit` field for the symbol prefix. Never embed the symbol in the value string. Zero is a valid value: always render '$0', never ''."

2. **Require emptyLabel on all computed tiles:** "Every MetricTile and Stat with a computed/bound value must include `emptyLabel` (≤32 chars, invites action). Example: 'Log hours to see earnings'. Never leave blank."

3. **Ban "Pending" as interactive state label:** "Interactive list items use `rowType: 'checkbox'`. The label describes the task, not its state. Never use 'Pending', 'Incomplete', or 'To-do' as a label on an interactive row."

4. **Color intent for destructive vs. reset:** "Destructive (delete, remove) → danger color. Reset/restart in wellness/habit apps → neutral color. Only irreversible actions use danger."

5. **Seed data requirement:** "Every list component must include at least 2 populated rows of seed data. An empty list at first open is indistinguishable from a broken component."

### The One Metric

**Day-2 active rate on generated apps** — the percentage of users who open a Canvas-generated app on the day after it was created. Day-1 opens are novelty taps. Day-2 opens require a decision that the app is worth returning to. That decision is the entire product hypothesis. A 40%+ D2 rate signals Canvas has crossed from impressive demo to useful tool. Below 20%: generation quality isn't holding interest past novelty.

---

## Designer Analysis

### Design System Gaps

#### Stat Tile
- **No formatting spec:** Raw value strings render verbatim → line-breaks mid-number. **Fix:** `numberOfLines={1}` + `adjustsFontSizeToFit` + `flexWrap: 'nowrap'` wrapping value + unit. Unit rendered as non-wrapping prefix/suffix, never concatenated into value string.
- **No zero-state currency rule:** "0" renders without unit. **Fix:** When `unit` is currency, always render "$0" not "0".
- **No sub-label height reservation:** Inconsistent tile heights when sub-label is empty.

#### Metric Tile
- **No null/uncomputed state:** Blank tile when value can't be computed. **Fix:** Required `emptyLabel` field (default: "Not yet tracked"). When null/undefined, render `emptyLabel` in tertiary italic style. Tile retains full height.
- **No dependency tracking:** Add optional `computedFrom` array — if any dependency is null, switch to empty state before NaN reaches render.

#### List Row / Checkbox
- **Checkbox positioned by absolute x:** Overflows off-screen at certain label lengths (BUG-003). **Fix:** Use `flexDirection: 'row'` + `justifyContent: 'space-between'`. Checkbox is the last flex child, always trailing, never absolutely positioned.
- **No `rowType` enum:** Static vs. interactive rows are structurally identical. **Fix:** Add `rowType: 'static' | 'checkbox' | 'destructive'`. Renderer enforces affordance per type.
- **Checkbox visual undefined:** No spec for checked/unchecked appearance. **Fix:** 24×24pt rounded square, 2pt border in interactive color, checkmark glyph on check, fill animation 150ms.

#### Button
- **No semantic variant field:** "Reset" renders identically to "Log". **Fix:** `variant: 'primary' | 'secondary' | 'destructive' | 'ghost'`. Renderer enforces: max 1 primary per screen; destructive always triggers 2-step confirmation; primary always positioned last (closest to thumb).
- **No post-tap feedback:** Silent on success. **Fix:** Primary button pulses to `successFlash` color (200ms) on dispatch. Destructive shows inline confirm row for 3 seconds before reverting.

### Interaction Design Requirements (Renderer Contract)

**Universal tap feedback (all interactive components):**
- Press start: scale 0.97, opacity 0.85, 80ms ease-in
- Press end: scale 1.0, opacity 1.0, 120ms ease-out
- Use `Pressable`, never `TouchableOpacity`

**Primary button — post-tap:**
Background pulses to `successFlash` tint for 200ms. This is the "confirmation moment" that is load-bearing for habit formation (Zoe's finding).

**Destructive button — post-tap:**
Replace button with inline `[Cancel] [Confirm {Action}]` row for 3 seconds. Auto-reverts if no interaction. Eliminates accidental resets and signals intent.

**Checkbox row — post-tap:**
Row background flashes `successFlash` at 12% opacity for 150ms. Fill animates empty → filled, 150ms. Light haptic on check (`impactOccurred(.light)`). Softer haptic on uncheck (`selectionChanged`).

**Metric tile — on value change:**
Outgoing value slides up + fades out (100ms), incoming slides up from below + fades in (150ms). Makes the tile feel live, not static.

### Empty/Zero State Standards

| Component | Condition | Render |
|-----------|-----------|--------|
| Stat Tile | value = null | Show `emptyLabel` in tertiary style, never "0" |
| Stat Tile | value = 0 + currency unit | "$0" — unit always shown |
| Stat Tile | value = 0 + other unit | "0 oz" — unit always shown |
| Stat Tile | value overflows single line | `adjustsFontSizeToFit`, min 14pt, truncate at end of integer never at decimal |
| Metric Tile | value = null/undefined | `emptyLabel` centered, 13pt, tertiary, italic |
| Metric Tile | computedFrom has null dependency | `emptyLabel` — proactive, before NaN |
| List | zero items | Single non-interactive row with `emptyLabel`, standard row height (no collapse) |
| List Row | label = empty string | "(no label)" in tertiary — never blank row |
| Button | disabled | Opacity 0.38, no tap response, `accessibilityState={{disabled: true}}` |

### Visual Hierarchy Rules

**Button semantic mapping:**

| Variant | Treatment | Use when | Max per screen |
|---------|-----------|----------|---------------|
| `primary` | Filled, `color.interactive.primary` | Single most important action | 1 |
| `secondary` | Outlined, `color.interactive.primary` | Supporting actions | 2 |
| `destructive` | Outlined, `color.semantic.danger` | Reset, Clear, Delete | Unlimited (always last) |
| `ghost` | Text only, `color.text.secondary` | Dismiss, Cancel | Unlimited |

Renderer rule: if spec contains >1 `primary` button, demote all but the last-declared to `secondary`. Hard rule, not a warning.

**Placement:** Buttons stack vertically, 8pt gap. Primary is always last (thumb-closest). Destructive separated from primary/secondary by 16pt gap.

### Copy and Tone Guidelines

**Label rules:**
- Title case on tile labels. `"Est. Earnings"` not `"EST EARNINGS"`.
- Sub-labels add context, never repeat the label. `"Goal: 8 glasses"` not `"Water Intake Today"` under "Water Intake".

**Button copy rules:**
- Affirmative verbs only. `"Log Glass"` not `"Submit"` or `"OK"`.
- Specific objects. `"Reset Today's Log"` not `"Reset"`. `"Clear All Items"` not `"Clear"`.
- Destructive buttons name what's destroyed. `"Clear All Entries"` not `"Clear"`.

**Wellness app tone (applied when archetype = wellness/habit):**
- Prompt injection: *"Button labels should feel like a supportive nudge, not a command. Prefer 'I drank a glass' over 'Log', 'Start my day' over 'Begin'."*
- Warm, first-person or second-person copy. Avoid: clinical, imperative, passive.

**Banned in interactive rows:** The word "Pending" as a state label on an actionable row. State is shown by the checkbox, not by mutating the label.

**emptyLabel pattern:** Sentence case, first-person or second-person, max 32 chars. Never "N/A", "null", "No data". Invite action: `"Log hours to see earnings"` not `"No data"`. Never start with a gerund: `"No entries yet"` not `"Nothing added yet"`.

### Three Quick Wins (Ship This Week)

#### QW1 — Checkbox layout fix (~2h)
Replace absolute positioning with flex layout in `ListRow.tsx`:
```tsx
<Pressable style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:16, minHeight:44}}>
  <Text>{node.label}</Text>
  <CheckboxGlyph checked={!!state[node.id]} />  // always trailing, never absolute
</Pressable>
```
**Impact:** Morning Routine First-Action Discoverability: 1.3 → 3.5+. Core interaction restored.

#### QW2 — Number formatting guard (~3h)
Add `formatValue(value, unit)` utility. In `StatTile` and `MetricTile`, render value + unit in a `flexDirection:'row'` / `flexWrap:'nowrap'` container with `numberOfLines={1}` + `adjustsFontSizeToFit` on the value Text node. Currency unit is always a prefix child, never concatenated.
**Impact:** Grocery Budget Data Legibility: 2.0 → 3.5+. Trust in money display restored.

#### QW3 — Metric tile empty state (~2h)
Add `emptyLabel: z.string().max(32).default('Not yet tracked')` to MetricTile schema. Renderer shows `emptyLabel` in tertiary italic style when value is null/undefined, maintaining tile height. Add to LLM prompt: emptyLabel is required, must invite action.
**Impact:** Freelance Hours Confidence: 3.0 → 4.0+. Tom's "punch in the gut" eliminated.

**Total for QW1–QW3: ~7 engineering hours. Combined, they raise perceived quality across 3 of 5 apps.**

---

## Findings Summary

### What Canvas Got Right
- **Generation quality is high.** Five coherent, named, appropriately structured apps from plain-language prompts. The LLM chose the right components for each concept.
- **App 4 (Daily Check-In) demonstrated genuine personality.** The 📱 Drained energy icon and "How are you feeling today?" framing show the model can produce warm, human-feeling output. More of this.
- **App 3 (Morning Routine) copy is excellent.** "Weekday habits to start strong ☀️" and per-habit motivational sub-labels ("Hydrate first thing", "Feed your mind") are the kind of copywriting that separates good tools from generic ones.
- **Tab navigation (Today/History) appeared unprompted in 4 of 5 apps** — the model is already thinking about persistence and review, even when not asked.

### What Canvas Must Fix
1. **Post-tap feedback is absent.** The highest priority cross-cutting gap. Every logging app lives or dies on the confirmation moment. Users doubt their own taps.
2. **Null/blank tiles read as broken.** Two apps damaged by empty-looking data tiles. The `emptyLabel` spec addition eliminates this class of failure.
3. **"Pending" as interactive state label is a dealbreaker.** Combined with BUG-003 (checkboxes off-screen), Morning Routine goes from highest-potential to zero-adoption.
4. **Destructive action color is wrong for wellness context.** Red "Reset" in a habit app signals danger, not a routine restart.
5. **Number formatting in money tiles must be hardened.** A line-break in a dollar amount is the most trust-damaging cosmetic bug possible in a finance app.

### Cross-Cutting Pattern
*"The display layer is mostly fine. The interaction layer is where things fall apart."* — Tom

All five apps were visually readable. All five apps had ambiguity about whether taps registered. Rendering the UI is solved. Confirming that UI is responsive is the next milestone.

---

## Action Items

| Priority | Owner | Action | Effort |
|----------|-------|--------|--------|
| P0 | Engineering | Fix BUG-003 — checkbox x=-9690 (ListRow flex layout) | 2h |
| P0 | Engineering | Number formatting guard — `flexWrap:'nowrap'`, currency prefix, zero-state | 3h |
| P0 | Engineering | MetricTile empty state — `emptyLabel` schema field + renderer | 2h |
| P1 | Engineering | Universal tap feedback — scale + opacity animation on all `Pressable` | 3h |
| P1 | Engineering | Primary button success pulse (`successFlash`) | 2h |
| P1 | Engineering | Destructive button two-step confirmation | 4h |
| P1 | PM + Engineering | Add `emptyLabel` requirement to LLM system prompt for all MetricTile nodes | 1h |
| P1 | PM + Engineering | Ban "Pending" pattern in prompt — enforce `rowType:'checkbox'` for interactive lists | 1h |
| P2 | PM | Define Day-2 retention tracking on generated apps | — |
| P2 | Design | Color intent spec — `variant` field on Button, destructive vs. reset treatment | 1h design |
| P3 | Engineering | Inline-add component (unblocks Grocery Budget and dynamic list use cases) | TBD |
| P3 | Engineering | Trend/sparkline for History tab (unblocks Daily Check-In full adoption) | TBD |

---

*Report generated 2026-05-13 · Canvas M2 sprint · Branch: agent/M2-VS-01*

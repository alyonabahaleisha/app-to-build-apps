# UX Design: Canvas V1 Catalog Expansion — Phase 1

**Designer:** Sable | **Date:** 2026-05-07
**Predecessor spec:** `docs/ux/canvas-v0-ux.md` (28 V0 components)
**Decision Brief reference:** `docs/product/canvas-v0-brief.md` §3 (token surface, stance system, palette system)
**Status:** Draft — design input to ADR-0009 (V1 catalog expansion). Phase 2 (Charts) and Phase 3 (Compound-AI) deferred to subsequent ADRs.

---

## Design Intent

Phase 1 widens the catalog from 28 to 53 components without changing what Canvas *feels* like. Same two stances. Same six palettes. Same Notion-/Linear-class restraint on the host. Same iOS-native discipline on the rendered tools.

The 25 components below let the LLM compose **richer mini-apps** without inventing visual language. They cover the four shapes V0 told us were missing once we watched users press against the catalog ceiling:

1. **Inputs that match financial / scheduling / preference reality** — MoneyField, TimeField, MultiPicker, Slider, RatingInput, SearchBar. (You can't build a tip splitter without MoneyField. You can't build a meditation timer without TimeField. You can't build a gratitude tag list without MultiPicker.)
2. **Compositions that domain-template** — TransactionRow, Receipt, MetricTile, Calendar, Heatmap, StepList. (Pre-baked compounds save the LLM 10–15 component-decisions per spec, and keep the visual quality high.)
3. **Visual richness for personal content** — Image, Gallery, CommerceCard, BeforeAfter, AvatarGroup, Carousel, Timeline. (Photos make a journal feel like a journal. Currently V0 has nowhere to put a photo other than as an avatar.)
4. **Polish primitives that V0 punted** — Divider, Callout, IconButton, GridList, ErrorState, DocumentPicker. (Each a small piece. Together they shave a *lot* of awkwardness off generated specs.)

Three feelings we're protecting (carried forward from V0):

1. **Trust** — The new components inherit V0's discipline. No surprises. Every state designed.
2. **Surprise** — The richer catalog produces more variety per archetype. The same prompt yesterday → 7 components; tomorrow → 12 components, more domain-fit.
3. **Pride** — The maker's "look what I made" feeling extends to richer-looking tools. A Receipt with tax math feels real in a way an itemized List doesn't.

**Anti-feeling: catalog bloat.** Adding 25 components is a real risk. If the LLM struggles to choose between TransactionRow and ListItem, generations get worse, not better. Mitigations:

- **Composition over invention.** Most new compounds (MetricTile, TransactionRow, Receipt, Callout, CommerceCard) are explicit compositions of existing primitives. Cal can document the "TransactionRow = ListItem + amount Stat + category Chip" relationship in the schema; the system prompt instructs the LLM to use compounds when domain-specific, primitives when generic.
- **Tier discipline.** New components slot into existing 7 tiers — Layout, Typography, Display, Inputs, Lists, Compound, Actions. No new tiers. Sable rejected the urge to invent "Charts" or "Compound-AI" tiers in Phase 1 — those are deliberate Phase 2/3 work.
- **Eval gate.** ADR-0009 should add ≥30 prompts per archetype that exercise the new components, with a regression gate that pass rate doesn't drop more than 5 points from V0's baseline.

**Stance affinity rules (simple):**

- New inputs (MoneyField, TimeField, MultiPicker, Slider, RatingInput, SearchBar) — stance-neutral. Same visual treatment in productive vs expressive, with the same accent/palette response as V0 inputs.
- Visual-richness components (Image, Gallery, CommerceCard, Carousel, BeforeAfter) — **lean expressive.** Generator should prefer expressive stance when a spec includes them, because they're photo-forward by nature. Productive specs that genuinely need photos (e.g., a CommerceCard for an e-commerce mini-app) override.
- Domain compounds (TransactionRow, Receipt, MetricTile, Calendar, Heatmap, StepList) — stance-driven by archetype, same as V0 compounds. Tracker → productive; Journal → expressive; etc.
- Polish primitives (Divider, Callout, IconButton, ErrorState, GridList, DocumentPicker) — pure stance-neutral.

**No new stances. No new palettes. No new tiers. No reorganization of V0.** The 12 visual registers (2 stances × 6 palettes) carry these 25 components without expansion.

---

## Jobs-to-be-Done (incremental over V0)

V0's two JTBDs (Idea-Maker, Friend-Recipient) carry forward unchanged. Phase 1 adds two Maker-side incremental needs that V0's catalog doesn't fulfill:

### The Maker with a Domain-Specific Idea

> **When** I describe a tool that has financial entries, dates, photos, or per-item ratings,
> **I want to** see it generate with components that *look like the domain* — money formatted with currency, dates as native pickers, photos rendered properly, ratings as stars,
> **so I can** trust that Canvas understands what kind of tool I asked for, not just "a list of things."

Pain in V0: a "track my expenses" prompt produces a List of items with text amounts. It works. It doesn't *feel* like a money tracker. The Maker doesn't share it because it doesn't look like a money tracker.

### The Maker with a Visual Idea

> **When** I want my mini-app to *show* something — a recipe with the dish photo, a packing list with the bag image, a workout plan with form-check photos —
> **I want to** describe the photo content and see it integrated into the layout, not bolted on as an Avatar afterthought,
> **so I can** make tools that are visually rich enough to want to share.

Pain in V0: photos exist only as Avatar (24/32/48pt circles). MediaTray exists but is a horizontal scroll — no place for a single hero image. Image, Gallery, CommerceCard, BeforeAfter close this gap.

---

## User Journey Map (deltas only)

V0's 7-stage journey carries forward unchanged. Phase 1 adds zero new screens and zero new flow steps — these are *components*, not flows. The deltas are inside Stage 4 (First Reveal) and Stage 7 (Re-prompt-to-Edit):

### Stage 4 — First Reveal (Phase 1 delta)

| | |
|---|---|
| **Doing** | Tool appears in Run mode. Now sees a richer surface — money with currency symbols, calendar grids, photos. |
| **Thinking** | "Wait. It used a real calendar. That's unfair." (positive surprise) |
| **Feeling** | The surprise spike from V0 amplifies. The "look what I made" pride is bigger. |
| **Pain** | If the LLM picks Calendar when the prompt warranted a List, the surprise sours. Catalog-bloat risk. |
| **Opportunity** | New eval gates measure per-component appropriateness. The 4 archetypes get their own per-component appropriateness scores. |

### Stage 7 — Re-prompt-to-Edit (Phase 1 delta)

| | |
|---|---|
| **Doing** | Re-prompts to add a column. The new spec uses a Calendar where there was a List. |
| **Thinking** | "I didn't ask for a calendar. Why is this a calendar?" |
| **Feeling** | Confused. Trust dips. |
| **Pain** | LLM treating re-prompts as fresh generation may pick different compounds than the original. |
| **Opportunity** | ADR-0009 should specify that re-prompts inherit the original spec's compound-set unless the user explicitly asks to change layout. **This is a Cal note.** |

---

## Component Specs — 25 components

Same conventions as `canvas-v0-ux.md` §Component Specs. Common props (`id`, `accessibilityLabel`, `testID`) inherited unchanged. Layout-affecting props take token names from `space-*` / `radius-*` enums; the schema enforces.

### Layout tier — 1 new component (Divider)

#### `Divider`

Horizontal hairline separator. Visual breath without a Section.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `label` | string | optional | Center text break (e.g., "Today", "—or—") |
| `inset` | `'none' \| 'start' \| 'both'` | `'none'` | `'start'` = 16pt left inset (matches ListItem leading); `'both'` = 16pt both sides |
| `weight` | `'hairline' \| 'thick'` | `'hairline'` | Hairline = 1pt `divider`; thick = 2pt `divider` for stronger section breaks |

**Visual:**

- No-label: horizontal line at `divider` color, full available width minus inset.
- With label: line + centered label `type-micro`, `fg-muted`, padded `space-md` horizontal so the line doesn't bleed into the text.

**States:** none (pure visual primitive).

**Stance treatment:**

- Productive: tighter — uses `space-md` margin above/below.
- Expressive: more breathing — `space-lg` margin above/below.

**Accessibility:**

- `accessibilityRole="none"` (visual-only when no label).
- With label: `accessibilityRole="text"`, `accessibilityLabel={label}`.
- VoiceOver: when label present, announces it; when no label, skipped (decorative).

**Composition:** none (atomic).

**Notes for Cal:** Pure layout primitive. No actions, no state, no bindings. The simplest possible component to land.

---

### Inputs tier — 6 new components

#### `MoneyField`

Currency-aware numeric input.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `label` | string | required | |
| `valueBinding` | `NumberBinding` | required | Stored as cents (integer) — see Notes for Cal |
| `currency` | `'USD' \| 'EUR' \| 'GBP' \| 'JPY' \| 'CAD' \| 'AUD' \| 'INR'` | `'USD'` | Closed enum, 7 options for V1; locale-aware formatting; symbol position determined by currency |
| `min` | number (cents) | optional | Renderer rejects entries below |
| `max` | number (cents) | optional | Renderer rejects entries above |
| `placeholder` | string | optional | If absent, formatted zero per currency (e.g., "$0.00") |
| `optional` | bool | false | |

**Visual:** label above input (`type-caption`, `fg-muted`); 44pt tall input field; `radius-md`, `bg-elevated`, `divider` border. **Currency symbol leading inside the input**, in `fg-muted`, `space-sm` from left edge. Number entered in `type-body` + tabular numerals; renders with thousand separators ("$1,234.56"). Decimal places per currency: 2 for USD/EUR/GBP/CAD/AUD/INR, 0 for JPY.

**States:** default, focused (border = `accent` + 2pt focus ring at 24% alpha), error (border = `danger`, error caption below), disabled (50% opacity, no haptic on tap).

**Accessibility:**

- `accessibilityLabel={label}, currency={currency}` — VoiceOver announces "Tip amount, US dollars, edit text" on focus.
- Numeric keyboard with decimal point.
- `accessibilityValue={{text: formattedValue}}` so VoiceOver reads "$24.50" not "2450".

**Stance:** stance-neutral.

**Composition:** none (atomic input).

**Notes for Cal:**

- **Storage as cents (integer).** The valueBinding is a NumberBinding, but the renderer must canonicalize to integer cents before write to avoid floating-point math bugs ($0.10 + $0.20 ≠ $0.30 in JS). Cal: document this in the schema comment. The format/parse helpers live in the renderer, not the LLM's surface.
- New currency enum is not part of any other enum — declare in `packages/protocol/src/enums.ts` as `CurrencySchema`.
- Locale-aware formatting via `Intl.NumberFormat(currency)` in the renderer.

---

#### `TimeField`

Native time picker — counterpart to V0's DateField.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `label` | string | required | |
| `valueBinding` | `StringBinding` | required | Stored as `HH:MM` (24h) at protocol level; renderer formats per locale at display |
| `mode` | `'time' \| 'time-with-seconds'` | `'time'` | Seconds variant for stopwatch / timer use cases |
| `min` | string (HH:MM) | optional | Earliest allowed |
| `max` | string (HH:MM) | optional | Latest allowed |

**Visual:** Tappable field showing formatted time (`type-body`); tap opens iOS-native `DateTimePickerIOS` in time mode in a Gorhom sheet (matching V0 DateField's pattern).

**States:** default, focused (border = `accent`), disabled.

**Accessibility:** `accessibilityRole="button"`, `accessibilityLabel={label}, current value {formattedTime}`. Picker sheet inherits iOS-native a11y.

**Stance:** stance-neutral.

**Composition:** none (atomic input).

**Notes for Cal:**

- StringBinding (not DateBinding) because time-only doesn't need a full ISO date. Format `HH:MM` (24h) is unambiguous, parseable, sortable.
- Reuses the Gorhom sheet wiring from V0 DateField. Cal: cite the existing pattern.
- Locale display: 12h / 24h decided by device settings, not spec. The renderer reads `Intl.DateTimeFormat`'s `hourCycle`.

---

#### `MultiPicker`

Multi-select dropdown.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `label` | string | required | |
| `valueBinding` | `StringBinding` (CSV) | required | Stored as comma-separated string at protocol level — see Notes for Cal |
| `options` | array of `{value: string, label: string, icon?: IconName}` | required, max 16 | (V0 Picker is 12; MultiPicker bumps to 16 to support tag-style selections) |
| `min` | int | optional | Renderer rejects fewer selected |
| `max` | int | optional | Renderer rejects more selected |
| `placeholder` | string | optional | Shown when nothing selected |

**Visual:** Tappable field. **Trigger state** (closed): label above, current selection rendered as a row of selected chips inside the field (each chip dismissable with × — tap removes); if nothing selected, placeholder text in `fg-muted`. **Sheet state** (open): Gorhom sheet rises with searchable list of options, each with a leading checkbox, an optional icon, and a label. Multi-select; sheet has a "Done" button that confirms.

**States:**

- Default empty: placeholder visible, no chips.
- Default with selections: selected chips visible, total count badge if more chips than fit on the row.
- Focused (sheet open): border = `accent`.
- Disabled.

**Accessibility:**

- Trigger: `accessibilityRole="button"`, `accessibilityLabel={label}, {N} selected: {comma-list of labels}`.
- Sheet: each option `accessibilityRole="checkbox"`, `accessibilityState={{checked}}`. Search field: `accessibilityLabel="Search options"`.

**Stance:** stance-neutral.

**Composition:** trigger uses Chip variant (V0). Sheet body uses List + ListItem (V0).

**Notes for Cal:**

- **CSV string storage** is the pragmatic choice for V0 protocol (no array type in StringBinding). Renderer parses to `string[]` on read, joins on write. **This is a real limitation** — if the user names two options with commas in their labels, the parser breaks. Mitigation: the schema's `option.value` regex disallows commas (Cal: add `/^[^,]+$/` constraint).
- For V1.5+: consider adding `ArrayBinding<T>` to the binding system. Out of scope for Phase 1.

---

#### `Slider`

Range input.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `label` | string | required | |
| `valueBinding` | `NumberBinding` | required | |
| `min` | number | required | |
| `max` | number | required | |
| `step` | number | `1` | Snap increment |
| `showValue` | bool | `true` | If true, displays current value badge above the thumb |
| `format` | `'integer' \| 'decimal' \| 'percent'` | `'integer'` | Display format for the value badge |

**Visual:**

- Label above (`type-caption`, `fg-muted`).
- Track: 4pt tall, `radius-full`. **Filled portion (left of thumb):** `accent`. **Unfilled portion:** `divider`. Track minimum hit-target padded to 44pt vertically (invisible padding).
- Thumb: 24pt circle, `bg-elevated` with 1pt `divider` border, `elevation-raised`.
- Value badge (when `showValue=true`): floats 8pt above thumb, follows thumb during drag. `type-micro` + 600 weight, `radius-sm`, padding `space-xs`, background `accent`, foreground `accent-fg`. Tail-down arrow points at thumb.
- Min/max labels (`type-micro`, `fg-faint`) below track ends.

**States:** default, dragging (thumb scales 1.0 → 1.15, light haptic on grab; medium haptic on step crossings), disabled (50% opacity, no drag).

**Accessibility:**

- `accessibilityRole="adjustable"`.
- `accessibilityLabel={label}`.
- `accessibilityValue={{min, max, now: currentValue, text: formattedValue}}`.
- VoiceOver supports increment/decrement gestures (swipe up/down) — Reanimated worklet handles the value updates.

**Stance:**

- Productive: thumb 24pt as above.
- Expressive: thumb 28pt, slightly larger; track 6pt tall (more presence).

**Composition:** none (custom Reanimated component).

**Notes for Cal:**

- Reanimated 4 worklet for thumb drag + spring animation. Not native iOS Slider — we want full control over haptic + value badge visuals.
- Reduced motion: thumb scale animation disabled; value badge appears/disappears instantly.
- Step values: if `step=10`, thumb snaps to 0/10/20/...; the badge updates only on snap, not continuously.

---

#### `RatingInput`

Star or scale rating.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `label` | string | required | |
| `valueBinding` | `NumberBinding` | required | |
| `scale` | `5 \| 10` | `5` | Number of stars / scale max |
| `glyph` | `'star' \| 'heart' \| 'flame' \| 'circle'` | `'star'` | Closed enum of rating glyphs (all in V0 80-icon catalog) |
| `allowHalf` | bool | false | If true, supports half-step values (e.g., 3.5 stars) |

**Visual:**

- Label above (`type-caption`, `fg-muted`).
- Row of `scale` glyphs (24pt each), `space-sm` gap.
- Filled glyphs (≤ value): `accent`.
- Unfilled (> value): `divider` with hollow stroke — uses Lucide stroke variant.
- If `allowHalf=true`, each glyph is split — left half toggles 0.5 step, right half toggles 1.0 step.
- Tap on glyph N sets value to N. Tap on glyph at current value clears (sets to 0).

**States:** default, hovered/pressed (filled glyph scales 1.0 → 1.15 with `motion-snappy`), disabled (50% opacity), value=0 (all glyphs in `divider` color).

**Accessibility:**

- Wrapper: `accessibilityRole="adjustable"`, `accessibilityLabel={label}`, `accessibilityValue={{min: 0, max: scale, now: currentValue, text: "${value} of ${scale}"}}`.
- VoiceOver swipe up/down increments/decrements.
- Each glyph also tappable individually (44pt hit target each).

**Stance:**

- Productive: `'star'` default, no half-step.
- Expressive: glyphs slightly larger (28pt), warmer feel.

**Composition:** uses 80-icon catalog (star, heart, flame, circle).

**Notes for Cal:**

- The `glyph` enum maps to Lucide icons: star → Star, heart → Heart, flame → Flame, circle → Circle. The hollow/filled variants use Lucide's stroke-vs-filled rendering — both are in the existing icon system.
- Half-step rendering is a single split-glyph (left filled, right hollow) — implementation detail handled in renderer with overlay clipping.

---

#### `SearchBar`

Search input with clear button. Filters a bound collection in-place.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `valueBinding` | `StringBinding` | required | The query string; collections subscribe to it |
| `placeholder` | string | `'Search'` | |
| `voiceMic` | bool | false | If true, shows mic affordance (V0.5 placeholder — opens "Voice search coming soon" sheet, same pattern as V0 Create mic) |
| `boundCollectionId` | string (collection id) | optional | If set, the collection's List/GridList renderer subscribes and filters by `valueBinding` substring-match across all string fields |

**Visual:**

- 36pt tall input, `bg-elevated`, `radius-md`, `divider` border 1pt.
- Leading: `search` icon, 16pt, `fg-muted`, `space-sm` from left.
- Center: TextInput, `type-body`, `fg`. Placeholder `fg-muted`.
- Trailing (only when value non-empty): clear `x` icon button, 16pt, `fg-muted`, 32pt hit target. Tap clears the binding.
- Trailing (when `voiceMic=true` AND value empty): mic icon, 16pt, `fg-muted`, 32pt hit target. Tap opens V0.5 waitlist sheet.

**States:** default, focused (border = `accent` + ring), populated (clear icon visible), disabled.

**Accessibility:**

- `accessibilityRole="search"`.
- `accessibilityLabel={placeholder}`.
- Clear button: `accessibilityLabel="Clear search"`.
- Mic: `accessibilityLabel="Voice search — coming soon"`.

**Stance:** stance-neutral.

**Composition:** uses TextInput primitive + Icon.

**Notes for Cal:**

- **Collection-binding behavior is novel.** Cal: when `boundCollectionId` is set, the renderer's List/GridList for that collection subscribes to the SearchBar's value binding and filters in-place by **substring match (case-insensitive)** across all string fields of the collection. If collection has fields `[name: string, body: string, age: number]`, query "cof" matches rows where `name` or `body` (string fields only) contain "cof"; numeric fields ignored. This is a renderer concern, not LLM-visible.
- Filter happens on the rendered list, not the source data. No mutation. Useful for client-side search of small collections (≤200 rows).
- For V0.5: extend to fuzzy match. Phase 1: substring is enough.

---

### Display tier — 2 new components

#### `AvatarGroup`

Stacked avatars for "N friends are using this" affordances.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `avatars` | array of `{name: string, imageUrl?: string}` | required, max 5 | Order matters: first → frontmost |
| `maxShown` | int | `3` | Avatars beyond this become "+N" overflow indicator |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Same sizes as V0 Avatar (24/32/48pt) |
| `overlap` | `'tight' \| 'spread'` | `'tight'` | Tight = -25% width (overlap); spread = -10% width (slight overlap) |

**Visual:**

- Up to `maxShown` Avatars rendered in a row, each subsequent one overlapping the previous.
- Each Avatar wears a 2pt `bg` border (creating the visual stacking ring).
- If `avatars.length > maxShown`: a final circle in `bg-elevated` with 1pt `divider` border showing `+N` in `type-caption`, `fg-muted`.

**Stance:**

- Productive: tight overlap, sm size default for in-row use.
- Expressive: spread overlap, md size default for content emphasis.

**States:** none (display-only — V1 doesn't include tap-to-expand; V1.5+ might).

**Accessibility:**

- Wrapper: `accessibilityRole="text"`.
- `accessibilityLabel="3 people: Alex, Sam, Jordan, and 2 others"` (auto-generated from avatar names + overflow count).
- Individual avatars not separately accessible (the group is the unit).

**Composition:** uses V0 Avatar (each entry).

**Notes for Cal:**

- **Border between stacked avatars** matches `bg` (not `bg-elevated`) — this gives the cleanest stacking visual against any container background.
- Max 5 avatars in the schema; overflow shown as "+N" where N = avatars.length - maxShown.

---

#### `Callout`

Highlighted info block for tips, warnings, success confirmations.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `variant` | `'info' \| 'success' \| 'warning' \| 'tip' \| 'danger'` | `'info'` | 5 closed variants |
| `headline` | string | required | One-line attention-grabber |
| `body` | string | optional | Supporting text |
| `icon` | IconName | optional | Override the variant's default icon |
| `action` | `{label: string, action: ActionVerb}` | optional | Optional CTA button at the right |

**Visual:**

- Card-shaped (Card composition) with 1pt left border in the variant's accent color (4pt thick on expressive).
- Padding `space-md`.
- Leading: variant icon, 20pt, in variant's color.
- Center column: headline `type-body` + 600 weight in `fg`; body (if present) `type-caption` `fg-muted`.
- Trailing (if action): text button, `type-caption` + 600 weight, in variant's color.

**Variant defaults:**

| Variant | Default icon | Color | Background tint |
|---|---|---|---|
| `info` | `info` | `accent` (palette-resolved) | `accent` at 6% alpha over `bg-elevated` |
| `success` | `check-circle` | `success` | `success` at 6% alpha over `bg-elevated` |
| `warning` | `alert-triangle` | `warning` | `warning` at 6% alpha over `bg-elevated` |
| `tip` | `sparkles` | `accent` | `bg-elevated` (no tint — tips are softer) |
| `danger` | `x-circle` | `danger` | `danger` at 6% alpha over `bg-elevated` |

**States:** default, with action (right-aligned trailing button), without action.

**Stance:**

- Productive: hairline left border (1pt), tight padding.
- Expressive: thicker left border (4pt), more padding (`space-lg`).

**Accessibility:**

- `accessibilityRole={variant === 'warning' || variant === 'danger' ? 'alert' : 'text'}`.
- `accessibilityLabel="{variant}: {headline}. {body}. {action.label if present}"`.
- Action: separately tappable, `accessibilityRole="button"`.

**Composition:** Card (V0) + Icon + Heading + Body + (optional) Button.

**Notes for Cal:**

- The 6% tint is a new design-system concern. Recommend Cal extend `tokens.ts` to expose a helper `tintColor(color, alpha)` so renderers compute the tint deterministically without hand-coding each variant's RGBA.
- Five variants (not three) because V0's existing Badge tone enum is `neutral|accent|success|warning|danger`. Callout adds `tip` because tips deserve their own affordance — they're not status, they're guidance.

---

### Lists & Data tier — 4 new components

#### `GridList`

2-column or 3-column grid container — alternative to V0 List for visually-dense layouts (especially photo grids, card grids).

| Prop | Type | Default | Notes |
|---|---|---|---|
| `collectionId` | string | required | Same surface as V0 List |
| `columns` | `2 \| 3` | `2` | 3 only on iPad-class widths (renderer collapses to 2 on iPhone widths < 380pt — handled internally) |
| `gap` | `space-*` | `space-md` (productive) / `space-lg` (expressive) | Gap between cells |
| `itemAspectRatio` | `'1:1' \| '4:5' \| '3:4'` | `'1:1'` | Cell aspect ratio constraint |
| `emptyState` | Node | optional | Same as V0 List |
| `loadingState` | Node | optional | Same as V0 List |

**Visual:**

- FlashList-backed grid (FlashList supports masonry mode).
- Each cell renders the collection's item template at the configured aspect ratio.
- Cells are `radius-md` containers; the cell content (whatever the template emits) clips to the cell shape.

**States:** populated, empty (renders emptyState), loading (renders loadingState).

**Accessibility:** `accessibilityRole="list"`, items inherit from template.

**Stance:**

- Productive: 2-column default, `1:1` aspect, tight gaps.
- Expressive: 2-column default but `4:5` aspect (more vertical / photo-friendly), generous gaps.

**Composition:** uses FlashList; each item is a Node template (not constrained to ListItem).

**Notes for Cal:**

- The item template can be any Node type — most commonly Card-with-Image, Card-with-Heading, or CommerceCard. Cal: schema permits `itemTemplate: NodeSchema` similar to V0 List.
- 3-column is a hint, not a guarantee: renderer collapses to 2 on narrow widths to maintain ≥150pt minimum cell width.

---

#### `Carousel`

Horizontally scrollable cards with pagination.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `collectionId` | string | optional — if absent, uses static `cards` array | |
| `cards` | array of Node | optional — if absent, uses `collectionId` template | |
| `indicator` | `'dots' \| 'fraction' \| 'none'` | `'dots'` | Page indicator style: dots (Apple-style), "1 / 5" fraction, or hidden |
| `cardWidth` | `'snap' \| 'peek' \| 'full'` | `'snap'` | snap = 90% of container with peek; peek = 75% with two side peeks; full = 100% |
| `autoplay` | bool | false | If true, auto-advances every 4s (paused on touch) |

**Visual:**

- Horizontal `FlashList` (horizontal mode).
- Cards `radius-lg` (slightly larger than List cards — Carousel cards are showpieces).
- Snap-to-card on scroll release.
- Indicator (when dots): row of 6pt circles centered below carousel, `space-xs` gap. Active dot: `accent`. Inactive: `divider`.
- Indicator (when fraction): "2 / 5" text, `type-caption`, `fg-muted`, centered below.

**States:** populated, dragging (haptic on dot crossing), autoplaying (active dot pulses with `motion-smooth`).

**Stance:**

- Productive: snap mode, dots indicator, no autoplay default.
- Expressive: peek mode (more cinematic), dots indicator, autoplay-allowed.

**Accessibility:**

- `accessibilityRole="adjustable"`, swipe gestures supported.
- `accessibilityLabel="Carousel, item {currentIndex+1} of {totalCount}"`.
- Reduced motion: autoplay disabled (always); snap behavior preserved.

**Composition:** uses FlashList (horizontal); cards are Nodes.

**Notes for Cal:**

- **Mutually exclusive: `collectionId` XOR `cards`.** Schema must enforce. Cal: superRefine to reject specs that set both or neither.
- Autoplay must respect `useReducedMotion()` (hard-disabled when motion is reduced — accessibility, not preference).

---

#### `Timeline`

Vertical sequential events with date indicators on left rail.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `collectionId` | string | required | |
| `dateField` | string (collection field name) | required | Field of type `date` used for the rail |
| `dateFormat` | `'relative' \| 'absolute' \| 'short'` | `'relative'` | "2h ago" vs "Jan 14, 2026" vs "Jan 14" |
| `groupBy` | `'none' \| 'day' \| 'week' \| 'month'` | `'none'` | If set, renders date headers between groups |

**Visual:**

- Vertical layout, FlashList-backed for long timelines.
- **Left rail (40pt wide):** vertical line at `divider` (1pt). At each event row, a 12pt `accent` circle marks the event. The line continues through, the circle is centered horizontally on the rail.
- **Right column (rest of width):** event content. Event date in `type-micro`, `fg-faint`, top-aligned. Event body uses the collection's item template.
- Group headers (when `groupBy` set): full-width row, `type-caption` + 600 weight, `fg`, with `divider` line below. Event circles continue but the group header doesn't carry one.

**States:** populated, empty (uses emptyState).

**Stance:**

- Productive: tight (events `space-sm` apart), small dot (8pt), short date format default.
- Expressive: generous (events `space-lg` apart), larger dot (12pt), absolute date format default.

**Accessibility:**

- `accessibilityRole="list"`.
- Each event: `accessibilityLabel="{date}: {event content}"` (date + body concatenated for VoiceOver).

**Composition:** uses FlashList + the collection template; rail is custom.

**Notes for Cal:**

- The cross-ref validator must check `dateField` exists on the named collection AND has type `date` (mirrors V0 MediaTray's imageField check).
- `groupBy` is a render-time aggregation; no schema impact on the spec itself.

---

#### `ErrorState`

Friendly error display with retry CTA. Counterpart to V0 EmptyState.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `icon` | IconName | `'alert-triangle'` | |
| `headline` | string | required | |
| `body` | string | optional | |
| `actionLabel` | string | optional | |
| `action` | ActionVerb | optional | Typically `reset` or a `navigate` back |

**Visual:** identical structure to V0 EmptyState — centered icon (64pt), headline (`type-h1`), body (`type-body`, `fg-muted`), action button (full-width secondary). The only difference vs EmptyState is the **default icon and tone** — `alert-triangle` in `warning` color (instead of EmptyState's contextual icon in `accent`).

**States:** default, with action (button visible), without action (no button).

**Stance:** stance-neutral.

**Accessibility:**

- `accessibilityRole="alert"` (announces immediately, unlike EmptyState which is text).
- `accessibilityLabel="{headline}. {body}. {actionLabel if present}"`.

**Composition:** structural twin of V0 EmptyState; literally the same render tree with different defaults.

**Notes for Cal:**

- Cal: the structural similarity to EmptyState is intentional — schema can extend EmptyState's shape with a single `tone: 'empty' | 'error'` discriminator if you want to dedupe. **Sable preference:** keep them as separate components for LLM clarity. The LLM's job is easier when "this is an error state" gets its own type than when it has to remember to set `tone: 'error'` on EmptyState.

---

### Compound — Productivity tier — 7 new components

#### `MetricTile`

Dashboard tile: metric value + label + sparkline + trend.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `value` | string | required | Already-formatted value (e.g., "$1,234", "85%", "12") |
| `label` | string | required | E.g., "Revenue this month" |
| `delta` | string | optional | E.g., "+12%", "-3 today" |
| `deltaTone` | `'positive' \| 'negative' \| 'neutral'` | `'neutral'` | |
| `sparklineData` | `number[]` | optional, max 30 points | If provided, renders a small sparkline below the value |
| `icon` | IconName | optional | Small leading icon at top-left of the tile |

**Visual:**

- Card-wrapped (`elevation-raised`, `radius-md`, padding `space-md`).
- Top row: leading icon (if present, 16pt, `fg-muted`) + label `type-caption`, `fg-muted`. Right-aligned: nothing.
- Middle: value `type-display` (productive) or `type-h1` (expressive) — smaller than standalone Stat because Tile is dense.
- Sparkline (if data): 32pt tall, full width minus padding. Color: deltaTone resolves to `success` / `danger` / `fg-muted`. Lightweight SVG polyline (no Skia — simple `<polyline>` rendered via react-native-svg, which is in the Expo SDK).
- Bottom row: delta `type-caption` colored by tone.

**States:** default, sparkline-loading (skeleton bar where the sparkline goes), sparkline-empty (no sparkline rendered, layout adapts).

**Stance:**

- Productive: smaller value (h1), tighter padding, sparkline 24pt tall.
- Expressive: larger value (display), more padding, sparkline 40pt tall.

**Accessibility:**

- Wrapper: `accessibilityRole="text"`.
- `accessibilityLabel="{label}: {value}, {delta if present}"`.
- Sparkline: not separately accessible (visual decoration; the delta carries the trend info).

**Composition:** Card + (Icon if present) + Body (label) + Body (value) + Body (delta) + custom sparkline polyline.

**Notes for Cal:**

- **Sparkline is NOT a Chart.** It's a single SVG polyline, no axes, no tooltips. Cal: this is intentional — it lets MetricTile ship in Phase 1 without the Skia/Victory-Native decision. Phase 2 (Charts) handles full chart components.
- Sparkline data is `number[]` (raw values); renderer auto-scales to fit the 32pt height. No min/max passed by spec.

---

#### `StepList`

Numbered procedural list (recipes, instructions, onboarding).

| Prop | Type | Default | Notes |
|---|---|---|---|
| `steps` | array of `{title: string, body?: string, completed?: BooleanBinding}` | required, max 20 | |
| `style` | `'numbered' \| 'checklist'` | `'numbered'` | Numbered = "1 / 2 / 3" leading; checklist = checkboxes (taps toggle `completed`) |

**Visual:**

- Vertical list of step rows.
- **Numbered style:** leading 28pt circle in `bg-elevated` with 1pt `divider` border, containing the step number in `type-caption` + 600 weight, `fg`. Vertical line connects circles (via padding + ::before). Active step (next un-checked, if completed bindings present): circle filled with `accent`, number in `accent-fg`. Past steps: circle filled with `success`, check icon instead of number.
- **Checklist style:** leading 24pt checkbox (`radius-sm`, 1pt `divider` border, 24pt hit target — wrapped in 44pt tappable area). Checked: `accent` background + `check` icon in `accent-fg`. Body to the right.
- Step body: title `type-body` + 600 weight, `fg`. Optional body `type-caption`, `fg-muted`, indented to align with title.

**States:** completed (strike-through on title), in-progress (next un-checked highlighted), all-complete (subtle success Callout below the list).

**Stance:**

- Productive: numbered default, dense.
- Expressive: numbered default with larger circles (32pt) and more spacing.

**Accessibility:**

- Wrapper: `accessibilityRole="list"`.
- Each step: `accessibilityRole={style === 'checklist' ? 'checkbox' : 'text'}`, label = "Step {N}: {title}. {body}", state = `{checked: completed}` for checklist style.

**Composition:** Custom render (not a List of ListItem because the connecting visual rail is unique).

**Notes for Cal:**

- The connecting vertical rail between numbered circles requires careful render — recommend Cal use absolute-positioned line behind the circles, or use a flexbox column with the line as a continuous background at the leading edge.
- `completed` per step is `BooleanBinding` (optional) — when present, supports state-driven progress; when absent, no progress tracking, just a static numbered list.

---

#### `BeforeAfter`

Side-by-side or slider comparison of two images.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `before` | `ImageBinding` | required | "Before" image source |
| `after` | `ImageBinding` | required | "After" image source |
| `mode` | `'side-by-side' \| 'slider'` | `'slider'` | Slider mode = single image with draggable vertical divider revealing before/after |
| `beforeLabel` | string | `'Before'` | |
| `afterLabel` | string | `'After'` | |
| `aspectRatio` | `'1:1' \| '4:5' \| '16:9'` | `'4:5'` | |

**Visual:**

- **Side-by-side mode:** two equal-width Image columns, 1pt `divider` line between, label badges (`type-micro`, `radius-full`, padding `space-xs`, `bg` background, `fg` text) at the top-left of each.
- **Slider mode:** stack containing the After image; Before image overlays clipped from left edge to a draggable vertical line. The line: 2pt wide, `bg-elevated` (with 1pt `divider` outline), with a 32pt circular handle at the vertical midpoint containing a `chevron-left chevron-right` double-arrow icon. Drag left/right to reveal more/less of After.

**States:** default, dragging (handle scales 1.0 → 1.15 with light haptic on grab), reduced-motion (handle still draggable, no scale animation).

**Accessibility:**

- Wrapper: `accessibilityRole="image"`, `accessibilityLabel="Before-after comparison: {beforeLabel} on left, {afterLabel} on right"`.
- Slider mode: handle is `accessibilityRole="adjustable"`, swipe up/down adjusts the reveal position by 10% per gesture.

**Composition:** uses Image (the new component below) ×2.

**Notes for Cal:**

- Slider mode is implemented with Reanimated worklet (clipping the Before image's width based on drag position). The drag is gesture-handler-based (`PanGestureHandler`).
- Both images must have the same `aspectRatio` (enforced by spec — both inherit from this component's `aspectRatio` prop).

---

#### `Calendar`

Month or week view with markers for collection items by date.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `view` | `'month' \| 'week'` | `'month'` | |
| `collectionId` | string | optional | If set, marks dates that have collection items |
| `dateField` | string (collection field) | optional, required if collectionId set | Field of type `date` to mark |
| `selectedBinding` | `DateBinding` | optional | If set, calendar is interactive (date taps update binding) |
| `firstDayOfWeek` | `'sunday' \| 'monday'` | locale-determined | Override for explicit control |

**Visual:**

- **Month view:** 7-column grid of days (~52pt cell), with day-of-week header row at top (`type-micro`, `fg-muted`). Each cell shows the day number `type-caption` + 600 weight in `fg`. Today's cell: `accent` filled circle around the number. Selected date: `accent` filled circle (overrides today's circle if different). Other-month days (preceding/following): `fg-faint`. Marked dates (when collection bound): a 4pt `accent` dot below the day number.
- **Week view:** single row of 7 days, slightly larger cells (60pt). Below each day, a vertical column space for events listed compactly.
- Header row above the grid: month name + year (`type-h2`, centered) flanked by chevron-left / chevron-right buttons (44pt hit target each) for navigation.

**States:** default, dragging-month (cards swipe; light haptic on month change), date-selected, no-binding (read-only).

**Stance:**

- Productive: month view default, tight cells (44pt), dots for markers.
- Expressive: month view default, larger cells (52pt), filled tinted backgrounds for marked dates (instead of dots) — `accent` at 12% alpha.

**Accessibility:**

- Grid: `accessibilityRole="grid"`.
- Each day cell: `accessibilityRole="button"`, `accessibilityLabel="{date long format}, {marked: ' has events' or ''}, {selected: ' selected' or ''}"`, `accessibilityState={{selected}}`.
- Month nav: `accessibilityLabel="Previous month" / "Next month"`.
- Reduced motion: month transitions instant (no swipe animation), still tappable.

**Composition:** Custom (not composed of other V0 components).

**Notes for Cal:**

- Date math is non-trivial. Recommend `date-fns` (small, tree-shakeable) — already in some Expo projects; Cal: confirm dep, add if missing.
- Cross-ref validator: when `collectionId` is set, `dateField` must exist on that collection AND have type `date`.
- The schema must NOT include "year/month being viewed" — that's purely renderer state, not spec state. The view-month state lives in the renderer's local state (resets on remount).

---

#### `Heatmap`

GitHub-style activity grid (streaks, habits, frequency).

| Prop | Type | Default | Notes |
|---|---|---|---|
| `collectionId` | string | required | |
| `dateField` | string (collection field) | required | Field of type `date` used for the activity tally |
| `range` | `'30d' \| '90d' \| '180d' \| '365d'` | `'90d'` | Number of days shown |
| `intensityMode` | `'count' \| 'binary'` | `'count'` | count = darker for more events on a day; binary = single shade if any events |

**Visual:**

- Horizontal grid of week columns, 7 days per column, oldest left, today right.
- Each cell: 12pt × 12pt square, `radius-sm` (2pt — slightly rounded).
- Color intensity: 5 levels mapping to count quintiles, scaled by `accent`:
  - 0 events: `divider` background
  - 1 (lowest quintile): `accent` at 20% alpha
  - 2: `accent` at 40% alpha
  - 3: `accent` at 60% alpha
  - 4: `accent` at 80% alpha
  - 5+ (top quintile): `accent` at 100%
- Binary mode: 0 events = `divider`; ≥1 events = `accent` at 60% alpha (single non-zero shade).
- Day-of-week labels (M, W, F) at the left edge (`type-micro`, `fg-faint`).
- Month labels (J, F, M) along the top edge (`type-micro`, `fg-faint`), positioned at first column of each month.
- Today's cell has a 1pt `accent` border.

**States:** default, hovered/long-pressed (cell scales 1.0 → 1.15, popup tooltip showing date + count).

**Stance:**

- Productive: 12pt cells, count mode.
- Expressive: 14pt cells, count mode (richer color register handles the alpha gradient well).

**Accessibility:**

- Wrapper: `accessibilityRole="image"`, `accessibilityLabel="Activity heatmap, {range}, total {N} events, longest streak {M} days"` (auto-summarized).
- Individual cells: not separately accessible (would be 90+ rotor stops; instead the wrapper summarizes).
- Long-press a cell: VoiceOver speaks "{date}, {count} events" via `accessibilityCustomActions`.

**Composition:** Custom (no Skia — pure View grid).

**Notes for Cal:**

- The 5-level intensity map needs the renderer to compute quintiles from the actual data — Cal: this is renderer logic, not LLM-visible. The system prompt doesn't expose the levels; the LLM just declares "Heatmap of habit completions, range 90 days," and the renderer handles binning.
- Cross-ref validator: same as Calendar (dateField must exist + be type `date`).
- Performance: 365d × 7 days = 2555 cells. FlashList not appropriate (small fixed grid). Plain `View` with absolute positioning OR Reanimated `FlatList` horizontal. Cal: pick.

---

#### `TransactionRow`

ListItem variant for financial entries.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `date` | `DateBinding` | required | Stored as ISO date |
| `merchant` | `StringBinding` | required | Counter-party name (e.g., "Whole Foods") |
| `amount` | `NumberBinding` | required | Cents, sign-bearing (negative for debits) |
| `currency` | Currency enum | `'USD'` | Same enum as MoneyField |
| `category` | `StringBinding` | optional | Category name, rendered as a Chip |
| `categoryIcon` | IconName | optional | Icon shown next to category |
| `tapAction` | ActionVerb | optional | |

**Visual:**

- 60pt tall row, horizontally laid out.
- Leading: 32pt circle with categoryIcon (if present) at center, in palette `accent` color tinted at 20% (background) with 100% icon. If no categoryIcon, no leading element.
- Center column: merchant `type-body` + 600 weight, `fg` (truncated to 1 line); below, date `type-caption` `fg-muted` (relative format like "2 days ago").
- Trailing column (right-aligned): amount `type-body` + 600 weight + tabular numerals; positive amounts in `success`, negative in `fg` (not danger — debits are not "errors"); currency-formatted. Below: category Chip (if present), `type-micro`, `fg-muted` color.

**States:** default, pressed (background → `divider` 6% tint), tapAction active.

**Stance:**

- Productive: tabular numerals, tight layout.
- Expressive: tabular numerals, slightly more padding (`space-md` vertical).

**Accessibility:**

- Wrapper: `accessibilityRole={tapAction ? 'button' : 'text'}`.
- `accessibilityLabel="{merchant}, {date long}, {amount with sign and currency}, category {category}"`.

**Composition:** Composes Avatar (leading icon circle), Body × 2 (merchant + amount), Caption × 2 (date + category), optional Chip.

**Notes for Cal:**

- This is a domain compound — pre-baked for the financial archetype that V1 unlocks. The LLM should use TransactionRow when generating expense trackers, splitwise-style apps, etc. The system prompt should make this explicit.
- Sign bearing: positive = credit/income (green), negative = debit/expense (default fg). NOT using `danger` for debits because debits aren't errors. This is a Sable design call. Document.

---

#### `Receipt`

Itemized list with subtotals, tax, total.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `items` | array of `{label: string, amount: NumberBinding, quantity?: number}` | required, max 50 | |
| `subtotal` | `NumberBinding` | required | Computed by spec or user-bound |
| `tax` | `NumberBinding` | optional | |
| `tip` | `NumberBinding` | optional | |
| `total` | `NumberBinding` | required | |
| `currency` | Currency enum | `'USD'` | |

**Visual:**

- Card-wrapped (`elevation-flat`, `radius-md`, padding `space-md`).
- Items section: each row is `[quantity × ]label.................amount` with dotted-leader fill (visual: render dots filling the gap between label and amount). Quantity prefix only if > 1.
- `Divider` (the new component, hairline).
- Subtotal row, tax row, tip row (each as label-right-aligned + amount-right-aligned, all in `type-body`, `fg-muted` for label, `fg` for amount).
- Bold `Divider`.
- Total row in `type-h2` + 600 weight, `fg`, full strength.

**States:** default, with-tax-no-tip, with-tip-no-tax, all-three.

**Stance:**

- Productive: dotted-leader fill, tight rows, monospaced amounts.
- Expressive: solid hairline between items (no dots), more breathing room, monospaced amounts.

**Accessibility:**

- Wrapper: `accessibilityRole="text"`.
- `accessibilityLabel="Receipt with {N} items, subtotal {amount}, tax {if present}, tip {if present}, total {amount}"`.

**Composition:** Card + List of custom rows + Divider × 2 + final total row.

**Notes for Cal:**

- Cal: the cross-ref validator should verify `subtotal + tax + tip ≈ total` — but allow ±1 cent for floating-point. **Not enforce equality** (the LLM might emit small rounding discrepancies; we don't reject specs over them, but we surface a warning telemetry event so we can tune the prompt).
- Items max 50 — beyond that, Receipt is the wrong component (use List).

---

### Compound — Content & Media tier — 4 new components

#### `Image`

Single image display. Foundation for Gallery, CommerceCard, BeforeAfter.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `source` | `ImageBinding` | required | URI or asset reference (uses ImageBinding from V0) |
| `aspectRatio` | `'1:1' \| '4:5' \| '16:9' \| '3:4' \| '21:9'` | `'4:5'` | Closed enum, no free-form |
| `fit` | `'cover' \| 'contain'` | `'cover'` | |
| `radius` | `radius-*` | `'md'` (productive) / `'lg'` (expressive) | |
| `alt` | string | required | Accessibility label — required (not optional, accessibility critical) |
| `fallbackIcon` | IconName | `'image'` | Shown when source fails to load |

**Visual:**

- Renders via Expo Image (already in deps).
- Default state: image fills bounded aspect ratio with fit applied; rounded corners per `radius`.
- Loading state: skeleton shimmer (uses LoadingState's shimmer pattern from V0) at the same aspect ratio.
- Error state: centered fallback icon (32pt, `fg-muted`) on `bg-elevated` background.

**States:** loading (shimmer), loaded (image), error (icon fallback).

**Stance:**

- Productive: smaller default radius (`radius-md`), `fit: cover`.
- Expressive: larger default radius (`radius-lg`), still `fit: cover`. Expressive uses Image more frequently; the visual emphasis matters.

**Accessibility:**

- `accessibilityRole="image"`.
- `accessibilityLabel={alt}` — REQUIRED in schema (no optional fallback to source URL — that's a screen-reader-noise anti-pattern).
- VoiceOver respects alt; image element grouped (no separate scrubbing of image vs alt).

**Composition:** atomic (uses Expo Image internally).

**Notes for Cal:**

- **`alt` must be required in the schema** — accessibility-critical. The LLM is instructed to author alt text from the prompt context. If the LLM omits alt, schema rejects.
- Uses Expo Image (`expo-image`), which is in V0's mandatory polish library list (brief §2.2). No new dep.
- ImageBinding (V0 binding kind) supports `literal` (URL string), `state` (slot — for user-uploaded images), and `collectionField` (image field on a collection row).

---

#### `Gallery`

Image grid with tap-to-fullscreen.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `collectionId` | string | optional | If set, renders one image per row using `imageField` |
| `imageField` | string | required if collectionId set | Field of type `image` |
| `images` | array of `ImageBinding` | optional | Static gallery (mutually exclusive with collectionId) |
| `columns` | `2 \| 3 \| 4` | `3` | Grid columns |
| `aspectRatio` | `'1:1' \| '4:5'` | `'1:1'` | Cell aspect |
| `gap` | `space-*` | `space-xs` (productive) / `space-sm` (expressive) | Tight gaps for gallery feel |

**Visual:**

- FlashList grid (same as GridList) of Image cells.
- Each cell: square or 4:5 Image, `radius-sm` (smaller than other surfaces — gallery cells are tight).
- Tap any cell → opens iOS-native fullscreen image viewer (Gorhom sheet at 100% height containing the Image at full bleed with a close X in top-right).

**States:** populated, empty (centered "No photos yet" with `image` icon, no separate ErrorState), tapped (modal open).

**Stance:**

- Productive: 3 columns, square, `space-xs` gap.
- Expressive: 2 columns, 4:5 aspect, `space-sm` gap.

**Accessibility:**

- Wrapper: `accessibilityRole="list"`, `accessibilityLabel="Photo gallery, {N} photos"`.
- Each cell: `accessibilityRole="image"`, label inherited from the underlying Image's `alt`.
- Modal: `accessibilityRole="image"` with VoiceOver announcement on open.

**Composition:** GridList + Image × N.

**Notes for Cal:**

- **Mutually exclusive: `collectionId` + `imageField` XOR `images`.** Schema enforces.
- The fullscreen modal is renderer-level; not LLM-visible.
- Reuses the V0 Gorhom sheet pattern.

---

#### `CommerceCard`

Image + title + price + add-to-cart action.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `image` | `ImageBinding` | required | Product photo |
| `title` | string | required | Product name |
| `subtitle` | string | optional | E.g., "Sourdough loaf" under "Tartine Bakery" |
| `price` | `NumberBinding` | required | Cents |
| `currency` | Currency enum | `'USD'` | |
| `priceCompare` | `NumberBinding` | optional | Strikethrough "compare at" price for sales |
| `action` | ActionVerb | required | Typically `addItem` to a cart collection |
| `actionLabel` | string | `'Add'` | |
| `badge` | string | optional | E.g., "New", "Sale" — corner badge |

**Visual:**

- Card-wrapped (`elevation-raised`, `radius-md`, padding `space-md`).
- Image at top, full card width, fixed `4:5` aspect, `radius-md` (clipped to top of card).
- Below: title `type-body` + 600 weight, `fg`. If subtitle: `type-caption`, `fg-muted` below.
- Price row: price `type-body` + 600 weight + tabular numerals, `fg`. If priceCompare: same line, strikethrough in `fg-muted`.
- Bottom: action button (compact, `accent` background, `accent-fg`, `radius-full`, padding `space-sm` vertical, full-width).
- If badge: top-right corner of image, `radius-full`, padding `space-xs`, `accent` background, `accent-fg` text, `type-micro` + 600 weight.

**States:** default, image-loading (shimmer), image-error (Image fallback), action-pressed (button background darkens 10%), out-of-stock (only if badge="Sold out" — visual only, action still works).

**Stance:**

- Productive: tighter, smaller image (4:5), action button at bottom.
- Expressive: larger image (3:4 — more vertical), more padding, action button slightly larger.

**Accessibility:**

- Wrapper: `accessibilityRole="text"`.
- `accessibilityLabel="{title}, {subtitle if present}, {price formatted}, {priceCompare if present: 'was {priceCompare}'}, {badge if present}"`.
- Action button separately accessible: `accessibilityRole="button"`, `accessibilityLabel="{actionLabel} {title}"`.

**Composition:** Card + Image + Body × 2 + Button.

**Notes for Cal:**

- This is a domain compound for e-commerce-style mini-apps. The LLM should pick CommerceCard when prompts include "shop", "store", "sell", "buy".

---

#### `DocumentPicker`

File-system picker for PDFs, docs, etc.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `label` | string | required | |
| `valueBinding` | `StringBinding` | required | Stores file URI (after picker resolves) |
| `acceptedTypes` | array of `'pdf' \| 'image' \| 'video' \| 'audio' \| 'any'` | `['any']` | Closed enum, max 4 types |
| `placeholder` | string | `'Choose file'` | |

**Visual:**

- 60pt tall row.
- Default (no file selected): placeholder text in `fg-muted`, leading `paperclip` icon (16pt, `fg-muted`).
- Selected: file name in `fg`, leading file-type icon (PDF → `file`, image → `image`, etc.). Trailing: `x` icon (16pt, 32pt hit target) to clear.
- Tap → opens iOS-native document picker (Gorhom sheet hosting `expo-document-picker`).

**States:** empty, selected, picking (loading state while iOS picker is open), error (file-type mismatch — caption below in `danger`).

**Stance:** stance-neutral.

**Accessibility:**

- Wrapper: `accessibilityRole="button"`, `accessibilityLabel={label}`, `accessibilityValue={{text: filename or 'no file selected'}}`.

**Composition:** uses `expo-document-picker` (NEW DEP).

**Notes for Cal:**

- New dep: `expo-document-picker`. Add to `apps/mobile/package.json` and renderer test mocks.
- `acceptedTypes` maps to MIME types in the picker config: pdf → `application/pdf`, image → `image/*`, video → `video/*`, audio → `audio/*`, any → `*/*`.
- File contents are NOT stored in the binding — only the URI. If the spec needs file contents, that's a V0.5 concern (cloud upload).

---

### Actions tier — 1 new component

#### `IconButton`

Compact icon-only button for headers, toolbars.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `icon` | IconName | required | |
| `action` | ActionVerb | required | |
| `variant` | `'primary' \| 'secondary' \| 'ghost' \| 'destructive'` | `'ghost'` | (V0 Button uses 'text' for what here is 'ghost'; alias for clarity in icon contexts) |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` (32pt with 44pt hit target) | sm = 24pt icon / 44pt hit; md = 32pt icon / 44pt hit; lg = 44pt icon / 56pt hit |
| `accessibilityLabel` | string | **required** (no default — icon alone is not labeled) | |
| `disabled` | `BooleanBinding` | optional | |

**Visual:**

- Circular tap area (`radius-full`).
- Variant treatments:
  - `primary`: `accent` background, `accent-fg` icon.
  - `secondary`: `bg-elevated` background with 1pt `divider` border, `fg` icon.
  - `ghost`: transparent background (no border), `fg` icon.
  - `destructive`: `danger` icon, transparent background. (Tints to `danger` 8% on press.)
- Press: background tints to next-darker shade (10% darker for `primary`, 6% for `secondary`/`ghost`).

**States:** default, pressed (background tint), disabled (50% opacity, no haptic).

**Accessibility:**

- `accessibilityRole="button"`.
- `accessibilityLabel` is REQUIRED in schema (no fallback to icon name — icon names are technical, not human-readable).
- Hit target ≥ 44pt regardless of icon size.
- Light haptic on press (consistent with Button).

**Stance:** stance-neutral.

**Composition:** atomic (Pressable + Icon).

**Notes for Cal:**

- Cal: this is structurally a Button minus `label` plus required `accessibilityLabel`. Schema can DRY by sharing `disabled`, `action`, `size`, `variant` shapes with Button — but **separate types** in the discriminated union (LLM clarity over schema dedup).
- The variant naming differs from Button (`'ghost'` instead of Button's `'text'`) — Sable preference: `ghost` is the iconography-community standard for "transparent action button". Cal: this means the system prompt has both `Button.variant: 'text'` and `IconButton.variant: 'ghost'` representing the same idea. Intentional. Document.

---

## Design-System Extensions

### New Icons (extend the 80-icon catalog to ~100)

Phase 1 components require these new icons (all available in Lucide):

| Icon name | Used by | Lucide source |
|---|---|---|
| `bell` | (existing — for Callout warning variant) | already |
| `bell-off` | (V0.5 notifications) — defer | — |
| `calendar-days` | Calendar component | `CalendarDays` |
| `chevron-down` | (existing) | already |
| `chevrons-up-down` | MultiPicker trigger arrow | `ChevronsUpDown` |
| `chevrons-left-right` | BeforeAfter slider handle | `ChevronsLeftRight` |
| `circle` | RatingInput glyph variant | `Circle` |
| `credit-card` | TransactionRow categoryIcon default for "card" category | `CreditCard` |
| `currency-circle` | MoneyField generic icon (rare use) | `CircleDollarSign` (shorthand) |
| `dollar-sign` | (existing) | already |
| `file-image` | DocumentPicker for image type | `FileImage` |
| `file-text` | DocumentPicker default | `FileText` |
| `file-video` | DocumentPicker for video type | `FileVideo` |
| `flag` | StepList completion marker (variant) | `Flag` |
| `gallery-thumbnails` | Gallery icon for empty state | `GalleryThumbnails` |
| `git-fork` | (V0.5 remix) — defer | — |
| `lightbulb` | Callout `tip` variant icon | `Lightbulb` |
| `list-checks` | StepList icon | `ListChecks` |
| `mic-off` | (V0.5 voice) — defer | — |
| `pause` | (V0.5 audio) — defer | — |
| `pin` | Carousel pinned state (V1.5) — defer | — |
| `play` | (V0.5 audio) — defer | — |
| `plus-circle` | StepList "Add step" affordance | `PlusCircle` |
| `receipt` | Receipt component icon for empty state | `Receipt` |
| `repeat` | Calendar recurrence (V1.5) — defer | — |
| `search` | (existing) | already |
| `shopping-bag` | CommerceCard icon for empty cart | `ShoppingBag` |
| `shopping-cart` | CommerceCard action button icon (when actionLabel hidden) | `ShoppingCart` |
| `slider-vertical` | Slider component empty state | `SlidersVertical` |
| `tags` | MultiPicker icon for tag-style use | `Tags` |
| `timer` | TimeField mode='time-with-seconds' indicator | `Timer` |

**Net new for Phase 1: 18 icons.** Catalog grows from 80 → 98.

Cal: extend `packages/protocol/src/icons/names.ts` with these names. Generate paths via the existing `gen-icon-paths.ts` script. Codegen-drift CI guards stay green.

### New Tokens (tiny — most use existing)

Phase 1 mostly reuses existing tokens. Three small additions:

1. **Tint helper.** Cal: add `tintColor(color: string, alpha: number): string` to `packages/design-system/src/tokens.ts`. Used by Callout (6% backgrounds), Heatmap (intensity gradient), TransactionRow (category icon background at 20%). This is a pure function, not a token, but it lives in the tokens module for discoverability.
2. **Currency enum** (already noted under MoneyField). Add `CurrencySchema` to `packages/protocol/src/enums.ts`. 7 entries: `USD, EUR, GBP, JPY, CAD, AUD, INR`.
3. **Callout variant tones.** Five named variants need consistent treatment. Cal: `tokens.ts` doesn't need to encode them as tokens — the renderer's Callout implementation maps `variant` → `(icon, color, backgroundTint)` internally. **No new token; new internal mapping.**

**No new colors. No new spaces. No new radii. No new type roles. No new elevations. No new motion curves.** V0's token set covers the 25 components.

### New Color Roles

None at the protocol/design-system level. The semantic colors (`success, warning, danger, accent`) cover Callout variants, RatingInput tones, TransactionRow signs.

---

## Stance Affinity Cheat-Sheet (for the LLM)

When the system prompt is updated for V1, add this guidance:

| Component | Productive | Expressive |
|---|---|---|
| Divider | tight margin | breathing margin |
| MoneyField | stance-neutral | stance-neutral |
| TimeField | stance-neutral | stance-neutral |
| MultiPicker | stance-neutral | stance-neutral |
| Slider | thumb 24pt, track 4pt | thumb 28pt, track 6pt |
| RatingInput | star, no half-step | larger glyph, optional half-step |
| SearchBar | stance-neutral | stance-neutral |
| AvatarGroup | sm size, tight overlap | md size, spread overlap |
| Callout | hairline border 1pt | thick border 4pt |
| GridList | 2-col, 1:1 | 2-col, 4:5 |
| Carousel | snap mode, dots | peek mode, dots |
| Timeline | 8pt dot, short date | 12pt dot, absolute date |
| ErrorState | stance-neutral | stance-neutral |
| MetricTile | smaller value (h1), tight | larger value (display) |
| StepList | tight, 28pt circles | spaced, 32pt circles |
| BeforeAfter | slider mode | slider mode (more cinematic) |
| Calendar | tight cells (44pt), dots | larger cells (52pt), tinted backgrounds |
| Heatmap | 12pt cells, count | 14pt cells, count |
| TransactionRow | tabular, tight | tabular, more padding |
| Receipt | dotted leaders, tight | hairline separators, breathing |
| Image | radius-md, fit cover | radius-lg, fit cover |
| Gallery | 3-col 1:1, xs gap | 2-col 4:5, sm gap |
| CommerceCard | 4:5 image | 3:4 image |
| DocumentPicker | stance-neutral | stance-neutral |
| IconButton | stance-neutral | stance-neutral |

**Components leaning expressive:** Slider, RatingInput, AvatarGroup, GridList, Carousel, Timeline, Calendar, Heatmap, MetricTile, BeforeAfter, Image, Gallery, CommerceCard.

**Components leaning productive:** MoneyField, TransactionRow, Receipt, Divider, Callout (info/warning), DocumentPicker, IconButton, ErrorState.

(Stance-neutral components default to whatever the spec's overall stance is.)

---

## Notes for Cal

### Architecture-level

1. **No new tier.** All 25 components fit into the existing 7 tiers. Don't create "Charts" or "Compound-AI" — those are Phase 2/3 ADRs.

2. **Component count grows from 28 → 53.** NodeRenderer goes from 28-arm switch to 53-arm switch. Snapshot matrix grows from 56 (28 × 2) to 106 (53 × 2). Eval prompt count likely grows from 100 → 160 (40 per archetype to test new combinations).

3. **Schema additions (concrete files):**
   - `packages/protocol/src/components/layout.ts` — add `DividerSchema`.
   - `packages/protocol/src/components/inputs.ts` — add `MoneyFieldSchema`, `TimeFieldSchema`, `MultiPickerSchema`, `SliderSchema`, `RatingInputSchema`, `SearchBarSchema`.
   - `packages/protocol/src/components/display.ts` — add `AvatarGroupSchema`, `CalloutSchema`.
   - `packages/protocol/src/components/lists.ts` — add `GridListSchema`, `CarouselSchema`, `TimelineSchema`, `ErrorStateSchema`.
   - `packages/protocol/src/components/compound.ts` — add `MetricTileSchema`, `StepListSchema`, `BeforeAfterSchema`, `CalendarSchema`, `HeatmapSchema`, `TransactionRowSchema`, `ReceiptSchema`, `ImageSchema`, `GallerySchema`, `CommerceCardSchema`, `DocumentPickerSchema`.
   - `packages/protocol/src/components/actions.ts` — add `IconButtonSchema`.
   - `packages/protocol/src/spec.zod.ts` — extend `Node` type alias union AND `NodeSchema` discriminated union with all 25 new schemas.
   - `packages/protocol/src/enums.ts` — add `CurrencySchema` (7 currencies).
   - `packages/protocol/src/icons/names.ts` — add 18 new icon names.

4. **Cross-ref validator extensions** (`packages/protocol/src/validate.ts`):
   - Calendar/Timeline/Heatmap: when `collectionId` is set, `dateField` must exist on collection AND have type `date` (mirrors V0 MediaTray's imageField check at lines 204-228).
   - Gallery: `imageField` must exist on collection AND have type `image`.
   - Carousel: superRefine to enforce mutually-exclusive `collectionId` XOR `cards`.
   - Gallery: same XOR for `collectionId+imageField` vs `images`.
   - SearchBar: when `boundCollectionId` is set, the collection must exist (no field-type check needed — substring match is over all string fields).
   - Receipt: warning telemetry (not error) if `subtotal + tax + tip ≠ total ± 1 cent`.

5. **New deps:**
   - `expo-document-picker` (DocumentPicker — runtime).
   - `date-fns` (Calendar — date math). Light, tree-shakeable. Cal: confirm latest version compatible with Expo SDK 52.
   - `react-native-svg` (MetricTile sparkline). **Already in Expo SDK** — no new install, just import. Confirm.
   - **No** Skia. **No** Victory Native. Phase 2 makes that decision.

6. **Re-prompt continuity (Sable concern lifted from Stage 7 journey).** When the user re-prompts an existing tool, the new spec might pick different compounds (Calendar where there was List, MetricTile where there was Stat). This is jarring. **Cal: ADR-0009 should specify** that the LLM is instructed (in the system prompt, on edit calls) to inherit the original spec's component-set unless the user explicitly asks to change layout. This is a prompt-engineering concern, not a renderer concern.

7. **Storage wrinkles to document:**
   - **MoneyField stores cents (integer), not floats.** `valueBinding` is `NumberBinding`, but the renderer canonicalizes to integer cents. Document in schema comment.
   - **TimeField stores `HH:MM` 24h string** via `StringBinding`, not `DateBinding`. Document.
   - **MultiPicker stores CSV string** via `StringBinding`. Schema constraint: option values cannot contain commas. Document.
   - **DocumentPicker stores URI string** via `StringBinding`. File contents not in the binding (V0.5 cloud upload concern).

### Composition relationships (so the schema can hint to LLM)

Several Phase 1 components are pre-baked compositions of V0 primitives:

- **Callout** = Card + Icon + Heading + Body + (optional) Button
- **AvatarGroup** = Avatar × N
- **MetricTile** = Card + Icon + Body + custom sparkline polyline
- **TransactionRow** = Avatar (icon circle) + Body × 2 + Caption × 2 + Chip
- **Receipt** = Card + List + Divider × 2
- **CommerceCard** = Card + Image + Body × 2 + Button
- **Gallery** = GridList + Image × N
- **BeforeAfter** = Image × 2 + custom drag handle
- **StepList** = custom (numbered/checkbox rail is unique)
- **Calendar** = custom (date math + grid)
- **Heatmap** = custom (cell grid + intensity binning)

The LLM picks compounds when they're domain-fit; primitives when generic. Cal's system-prompt update should explicitly say: "For financial entries, prefer TransactionRow over a List of ListItems. For dashboards with sparklines, prefer MetricTile over Stat. For grids of photos, prefer Gallery over a List with Image children."

### Visual decisions Sable made (don't re-litigate)

- 7-currency closed enum (USD/EUR/GBP/JPY/CAD/AUD/INR). Adding more requires App Store update (closed registry per invariant 6).
- 5-variant Callout (info/success/warning/tip/danger). The brief's existing tone enum is `neutral|accent|success|warning|danger`; Callout adds `tip` and drops `neutral`/`accent` for clarity in the Callout context.
- IconButton variant `'ghost'` (alias for Button's `'text'` — different name in icon context).
- Sparkline as SVG polyline, not Skia. Phase 2 decides Skia.
- Gallery cells smaller and tighter than other GridList uses (gallery-feel).
- TransactionRow debit color is `fg`, not `danger`. Debits aren't errors.
- Receipt "≈ total" tolerance ±1 cent (prompt-tuning telemetry, not schema rejection).
- Calendar's view-month state lives in the renderer, not the spec.

### Things to flag back to Robert (PM)

- **Currency enum** needs PM input on which 7 currencies. Sable defaulted to the most common 7 from analytics pre-launch (USD top, then EU/UK/JP/CA/AU/IN by market size). Robert may want different ordering or substitutions.
- **Phase 1 increases the LLM's choice surface from 28 → 53 components.** Pre-launch eval gates on V0 had ~90% pass rate; V1 expansion may regress. Robert may want to size the V1 launch as "soft" (no public launch announcement until eval re-baselines).

---

## Notes for Colby

### General implementation patterns (carry forward from V0)

- All new components are renderer-pure functions of `{node, state, dispatch}`. No `useEffect` outside §K-approved exceptions (and Phase 1 introduces NO new exceptions — the new components don't need them).
- Snapshot test per component per stance × focus and expressive × health register pairs (matches V0's 56-snapshot matrix; Phase 1 grows it to 106).
- All new components use Reanimated 4 for animations; never bare RN `Animated`.
- All FlashList consumers (GridList, Carousel, Timeline, Gallery, Heatmap if its 90+ cells warrant it) follow V0 List's pattern.
- Hit targets ≥44pt enforced. IconButton's small variant is 24pt icon inside 44pt hit; Slider thumb hit area is 44pt; Heatmap cell long-press is per-cell (12pt cell with 32pt hit zone via React Native's `hitSlop`).

### Component-specific implementation hints

1. **MoneyField cents canonicalization.** On user input (e.g., types "12.50"), parse to cents (1250). On display, format from cents (1250 → "$12.50"). Use `Intl.NumberFormat(currency, {minimumFractionDigits: digits[currency], maximumFractionDigits: digits[currency]})`. Watch out for JPY (zero decimals) — formatter handles, but tests must cover.

2. **MultiPicker chip dismissal.** When user taps × on a chip in the trigger, the renderer emits a `set` action with the new CSV (current value minus that option). The chip animates out with `motion-snappy` (Reanimated layout animation). Also opens the sheet for re-selection on tap of the trigger area outside the chips.

3. **Slider Reanimated worklet.** Use `useSharedValue` for thumb position. PanGestureHandler for drag. `runOnJS` for haptics. `useDerivedValue` for value badge text. Reduced-motion: thumb position updates instantly, no spring.

4. **RatingInput half-step rendering.** Each glyph is a `View` containing two `Pressable` halves (left = 0.5 step, right = 1.0 step). Visual: render a single icon, but use an absolute-positioned overlay clip-mask for the half-fill state. Lucide icons can be styled with `color`, but for half-fill you need to render the icon twice (once with `color: divider`, once with `color: accent` and `clipPath: polygon(0 0, 50% 0, 50% 100%, 0 100%)`).

5. **SearchBar collection filtering.** When `boundCollectionId` is set, the renderer publishes a context value at the SearchBar's mount point. The List/GridList for that collection subscribes via context and filters in-place. Implementation: a `SearchFilterContext` that the List/GridList renderers call into. **This is a subtle architectural addition** — Cal's ADR should spec it.

6. **AvatarGroup render order.** First avatar in the array is frontmost (highest `zIndex`). Subsequent avatars have decreasing zIndex and increasing leftward offset (`marginLeft: -size * (overlap === 'tight' ? 0.25 : 0.10)`).

7. **Callout left-border thickness.** 1pt productive vs 4pt expressive — implement as `borderLeftWidth` from the `LAYOUT_DEFAULTS` table by stance.

8. **GridList masonry mode.** FlashList supports masonry via `masonry={true}` and `optimizeItemArrangement={true}`. Use it. Aspect-ratio constraint enforced per-cell.

9. **Carousel mutually-exclusive props.** Renderer guards: if both `collectionId` and `cards` are set (shouldn't happen — schema rejects — but defensive), prefer `cards`.

10. **Timeline rail.** The vertical line connecting event circles is a `View` with `position: 'absolute', left: 19, top: 0, bottom: 0, width: 1, backgroundColor: divider`. Each event row's circle is `position: 'absolute', left: 14` over the rail. The right column starts at `paddingLeft: 40`.

11. **ErrorState shares structure with EmptyState.** Recommend a shared `CenteredStatus` internal component that both EmptyState and ErrorState delegate to, varying only icon/tone defaults.

12. **MetricTile sparkline.** `react-native-svg` `<Polyline points="..." stroke={color} strokeWidth={1.5} fill="none" />`. Auto-scale: `points.map((y, i) => [(i / (points.length - 1)) * width, height - ((y - min) / (max - min)) * height])`. Smooth via `strokeLinecap="round"` and `strokeLinejoin="round"`.

13. **StepList rail.** Vertical line through circles: same pattern as Timeline rail.

14. **BeforeAfter slider mode.** PanGestureHandler tracks horizontal drag of a 32pt handle. Before image overlays After image, clipped to width = handlePosition. Handle: a `View` at `left: handlePosition - 16, top: '50%', marginTop: -16`. Reanimated worklet runs on UI thread; no JS thread jank.

15. **Calendar.** Use `date-fns/format`, `date-fns/startOfMonth`, `date-fns/getDay`, `date-fns/addDays`. Generate a 6-row × 7-col grid for any month (always 6 rows for layout consistency, even if 4-week month).

16. **Heatmap intensity binning.** Group collection rows by date (using `date-fns/format(date, 'yyyy-MM-dd')` as key). Compute count per day. Find quintile thresholds (sort counts, take 20/40/60/80 percentile values). Map each day to its quintile index (0-5) where 0 = no events.

17. **TransactionRow amount formatting.** Use `Intl.NumberFormat(currency, {style: 'currency'})`. Sign-aware: positive amounts include `+`, negative include `-` (formatter handles sign). Color: positive → `success`; negative → `fg`.

18. **Receipt dotted leaders.** Productive style: render row as `[label] [.....] [amount]` where the dots fill via `position: 'absolute'` between label end and amount start, computed at layout time. Use `flexBasis: 0, flexGrow: 1` on the dot container and render dot characters (`.`) repeated, or use a horizontal divider with `borderStyle: 'dotted'`. **Heads up: RN's `borderStyle: 'dotted'` is unreliable on iOS — fall back to repeated `.` characters in a `<Text>` with `numberOfLines={1}` and `ellipsizeMode='clip'`.**

19. **Image alt-required enforcement.** Schema rejects specs with missing `alt`. Renderer additionally throws if `alt` is empty string at render time (defense-in-depth).

20. **Gallery fullscreen modal.** Reuse Gorhom BottomSheet at 100% height. Image inside the modal at full bleed (no padding). Close button: `IconButton` (the new component) with `icon: 'x'`, `accessibilityLabel: 'Close gallery'`, top-right corner with safe-area inset.

21. **CommerceCard image clipping.** Image at top of card with `borderTopLeftRadius: cardRadius, borderTopRightRadius: cardRadius`. Card itself has `overflow: 'hidden'` to ensure clean clip.

22. **DocumentPicker integration.** `expo-document-picker` API: `getDocumentAsync({type: mimeTypes})`. On success, returns `{uri, name, size, mimeType}`. Renderer dispatches `set` with the URI to the bound slot. Render: file name from `name` field.

23. **IconButton press feedback.** Reanimated `useAnimatedStyle` for the background tint on press. No useEffect — state-driven via `Pressable`'s `onPressIn` / `onPressOut`.

### Accessibility checklist (carry forward + Phase 1 specifics)

- Every interactive component has explicit `accessibilityLabel` (no fallback to icon name).
- Image and Gallery require `alt` (schema-enforced).
- Carousel autoplay disabled under `useReducedMotion()`.
- Slider supports VoiceOver swipe-up/down to increment/decrement.
- RatingInput supports VoiceOver swipe-up/down to increment/decrement.
- Calendar cells are individual rotor stops (44pt hit each).
- Heatmap cells are NOT individual rotor stops (would be 90+ stops); the wrapper summarizes; long-press exposes per-cell info via custom action.
- Callout with `variant: warning` or `danger` uses `accessibilityRole="alert"` (announces immediately).

### Test strategy

Following V0's pattern:
- Unit test per component (productive×focus + expressive×health snapshots).
- Schema test per component (Zod accept happy + reject negative cases).
- Cross-ref test for components with collection field references (Calendar, Heatmap, Timeline, Gallery, Carousel, MetricTile if it ever takes collection data).
- Integration test for compositions (Receipt total math; CommerceCard with addItem dispatch; SearchBar filtering a List in-place).

Estimate: ~300 new tests across protocol + renderer for Phase 1. Cal's ADR will spec exact T-IDs.

---

## Component Inventory

| Component | Status | Notes |
|---|---|---|
| Divider | New | Layout primitive |
| MoneyField | New | Currency-aware input; new `CurrencySchema` enum |
| TimeField | New | Time picker; reuses V0 DateField sheet pattern |
| MultiPicker | New | Multi-select with chip display; CSV storage |
| Slider | New | Reanimated thumb; value badge |
| RatingInput | New | Star/heart/flame/circle scale |
| SearchBar | New | Substring filter; introduces SearchFilterContext |
| AvatarGroup | New | Stacked avatars; composes V0 Avatar |
| Callout | New | 5-variant info block; composes Card+Icon+Body |
| GridList | New | FlashList masonry; alternative to V0 List |
| Carousel | New | Horizontal FlashList with snap; Reanimated indicator |
| Timeline | New | Vertical event rail; composes FlashList |
| ErrorState | New | Structural twin of V0 EmptyState |
| MetricTile | New | Card+sparkline polyline; SVG, no Skia |
| StepList | New | Numbered or checklist; custom rail render |
| BeforeAfter | New | Image comparison; depends on Image |
| Calendar | New | Date math via date-fns; new dep |
| Heatmap | New | Activity grid; pure View, no Skia |
| TransactionRow | New | Domain compound for financial archetype |
| Receipt | New | Itemized math; ±1 cent tolerance |
| Image | New | Foundation for Gallery, CommerceCard, BeforeAfter |
| Gallery | New | Image grid; fullscreen modal; depends on Image |
| CommerceCard | New | Domain compound for commerce archetype |
| DocumentPicker | New | New dep: expo-document-picker |
| IconButton | New | Compact icon button; structural sibling to Button |

V0 components used by Phase 1 (no changes): Card, Image (none — Image is new!), Button, Stat, Badge, Chip, Avatar, ListItem, FlashList, EmptyState, LoadingState, Heading, Body, Caption.

---

## Content & Copy

Phase 1 components are mostly LLM-emitted content (no fixed copy strings). Three exceptions where Sable owns the default copy:

| Element | Copy | Notes |
|---|---|---|
| MoneyField default placeholder | `"$0.00"` (currency-aware) | Per currency: USD `"$0.00"`, EUR `"€0,00"`, JPY `"¥0"`, etc. |
| SearchBar default placeholder | `"Search"` | Override-able by spec |
| DocumentPicker default placeholder | `"Choose file"` | Override-able by spec |
| Gallery empty state | `"No photos yet"` with `image` icon | Hardcoded — Gallery has no `emptyState` prop (deliberate simplification; LLM use ErrorState if it wants custom) |
| ErrorState default headline (when generated by spec, NO default — schema requires) | n/a | — |

---

## Design Decisions & Rationale

1. **No new tier in Phase 1.** Charts and Compound-AI as new tiers were tempting, but:
   - Charts need a Skia-vs-Victory-Native architectural decision that costs design time (component-level) and engineering time (renderer integration). Out of Phase 1.
   - Compound-AI requires V0.5 AI capabilities (image gen, vision, chat, transcription) that aren't shipped. Out of Phase 1.
   - Keeping Phase 1 within existing tiers means the LLM's mental model doesn't shift — it just has more components to choose from in tiers it already knows.

2. **Domain compounds (TransactionRow, Receipt, MetricTile, CommerceCard) are pre-baked.** The alternative was "let the LLM compose List + ListItem + Stat + Chip into something money-shaped each time." Pre-baking compounds:
   - Saves the LLM 10–15 component decisions per spec (latency win).
   - Guarantees visual consistency across financial mini-apps.
   - Lets the system prompt nudge the LLM toward the domain compound when context warrants ("when generating an expense tracker, use TransactionRow").

3. **Currency as a closed 7-enum.** I considered a free-form ISO 4217 code, but:
   - Closed enum keeps registries discoverable + validatable.
   - 7 currencies cover ~95% of pre-launch waitlist signal.
   - Adding more is a closed-registry expansion (App Store update), aligned with invariant 6.

4. **MultiPicker as CSV string.** Ugly but pragmatic:
   - The binding system has `StringBinding`, `NumberBinding`, `BooleanBinding`, `DateBinding`, `ImageBinding` — no `ArrayBinding<T>`.
   - Adding `ArrayBinding<T>` is a binding-system overhaul (V0.5+).
   - CSV string + comma-disallowed in option values is ugly but works for V1.

5. **Sparkline in MetricTile, not its own Chart component.** Sparklines are a single polyline — too small to need a charting library. Phase 1 ships sparklines via `react-native-svg` (already in Expo SDK). Phase 2 adds proper Charts (LineChart, BarChart, RingChart) with axes, tooltips, legends.

6. **Receipt math tolerance ±1 cent.** The LLM emits seed data; small rounding discrepancies are real. Strict equality would reject specs over $0.01 differences. Telemetry-warning instead lets us surface and prompt-tune without breaking generations.

7. **TransactionRow debit color is `fg`, not `danger`.** Debits are not errors. Banking apps that color debits red trigger anxiety; calmness wins. Sable design call.

8. **ErrorState as a separate component (not a tone variant of EmptyState).** Easier for the LLM to choose the right one. Slight schema duplication; large prompt-engineering simplification. Worth it.

9. **IconButton variant `'ghost'` instead of Button's `'text'`.** Different naming for the same idea. Iconography community uses `ghost` for transparent action buttons; renaming for icon contexts is a small cognitive aid for the LLM (and developers reading the schema).

10. **Image's `alt` is required.** The accessibility cost of optional alt text is too high. The LLM is instructed to author alt from prompt context. Schema rejects missing alt. Defense-in-depth at runtime.

---

## Out of scope (deferred)

- **Charts (LineChart, BarChart, RingChart)** — Phase 2. Requires Skia-vs-Victory-Native decision. Estimated effort: 2 weeks design + 3 weeks engineering.
- **Compound-AI (ChatThread, StreamingText, AIConfidence, AISuggestion, VirtualTryOn, VisionAnalyzer)** — Phase 3. Blocked on V0.5 AI capabilities (image_gen, vision, chat, transcription). Estimated effort: pending V0.5 capability shipment.
- **`ArrayBinding<T>` to clean up MultiPicker** — V0.5+ binding-system upgrade.
- **3rd stance** (V0.5+).
- **User-overridable accent palette** (V0.5+).
- **Dark mode** (V0.5+).

---

## Handoff

> ✅ UX design saved to `docs/ux/canvas-v1-catalog-expansion-phase1-ux.md`
>
> **Next step:** Hand to Cal (`/architect`). Cal, check the "Notes for Cal" section first — particularly the architectural concerns (re-prompt continuity, SearchBar collection filtering context, schema cross-ref additions for date/image fields, MoneyField cents canonicalization) and the new deps list (`expo-document-picker`, `date-fns`).
>
> 25 components. 18 new icons. 1 small enum addition (Currency). No new colors, no new spaces, no new radii, no new type roles, no new elevations, no new motion curves, no new tiers, no new stances. The design system carries this load.

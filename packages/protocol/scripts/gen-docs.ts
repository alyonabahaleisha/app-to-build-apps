/**
 * gen-docs.ts — Generates packages/protocol/generated/docs.md
 *
 * One section per: 13 token types, 47 component schemas, 12 action verbs,
 * 5 binding types, plus top-level Spec / SpecScreen / Collection schemas.
 * ADR-0007's prompt builder concatenates this into the cacheable catalog block.
 *
 * Section ordering (deterministic):
 *   1. Token types (alphabetical: ColorToken, Elevation, MotionCurve, NavPattern,
 *      RadiusToken, SpaceToken, TypeRole — 7 token-name types; plus Archetype,
 *      BindingKind, Palette, SlotKind, Stance, Tone — 6 behavioral enums = 13 total)
 *   2. Component schemas (tier order: layout, typography, inputs, display,
 *      lists, compound, actions — 47 total, V1 Phase 1 Step 1 adds Divider + Image + IconButton,
 *      V1 Phase 1 Step 3 adds AvatarGroup + Callout,
 *      V1 Phase 1 Step 2 adds MoneyField + TimeField + MultiPicker + Slider + RatingInput + SearchBar,
 *      V1 Phase 1 Step 4 adds GridList + Carousel + Timeline + ErrorState,
 *      V1 Phase 1 Step 5 adds TransactionRow + Receipt + MetricTile + StepList)
 *   3. Action verbs (schema-declaration order, matching actions.ts — 12 total)
 *   4. Binding types (StringBinding, NumberBinding, BooleanBinding, DateBinding,
 *      ImageBinding — 5 total)
 *   5. Top-level schemas (Collection, Spec, SpecScreen — 3 total)
 *
 * Total: 13 + 47 + 12 + 5 + 3 = 80 sections (≥60 per ADR AC).
 *
 * T-0005-183a guard: every component section must have a non-empty body
 * paragraph. Static description map ensures this — no silent-empty-doc.
 * Step 4 update: 39 → 43 components.
 *
 * Run via: pnpm --filter @app-creator/protocol codegen
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import {fileURLToPath} from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..')
const OUTPUT_PATH = path.join(REPO_ROOT, 'packages', 'protocol', 'generated', 'docs.md')

// ---------------------------------------------------------------------------
// § Static description map — one description per section.
// Descriptions drive the body paragraph for each section. Every entry must
// be non-empty; T-0005-183a verifies this for all 28 component sections.
// ---------------------------------------------------------------------------

const TOKEN_DESCRIPTIONS: Record<string, string> = {
  Archetype: 'The intended use-case category of the app. V0 supports four archetypes — ListCRUD (manage a list of items), Tracker (log recurring events), Journal (capture free-form entries over time), and Calculator (compute derived values). The reserved value `unknown` is provided for forward compatibility.',
  BindingKind: 'Discriminant for the three-way Binding<T> union. `literal` carries a hardcoded compile-time value. `state` references a named slot in the app\'s mutable initialState. `collectionField` reads a specific field from a specific collection row at runtime.',
  ColorToken: 'A semantic color name from the V0 palette system. The model picks a color token name; the design-system package resolves it to a concrete hex value for the active stance and palette. Tokens: bg, bg-elevated, bg-overlay, fg, fg-muted, fg-faint, divider, accent, accent-fg, success, warning, danger.',
  Elevation: 'A named shadow recipe applied to container components. `elevation-flat` has no shadow, `elevation-raised` has a subtle shadow, and `elevation-floating` has a prominent shadow. The design-system resolves each to concrete shadow values.',
  MotionCurve: 'A named animation easing curve. `motion-instant` skips animation entirely (useful for reduced-motion). `motion-snappy` is a quick, sharp transition. `motion-smooth` is a gentle ease-in-out. `motion-springy` has a small overshoot for a physical feel.',
  NavPattern: 'The top-level navigation structure for the app. `none` means a single-screen app with no navigation chrome. `stack` uses push/pop navigation. `tabs` renders a tab bar at the bottom (2–4 screens). `modal-overlay` presents secondary screens as modal sheets.',
  Palette: 'The accent color palette. Each palette is a thematic accent pair (accent + accent-fg) resolved per stance. Palettes: focus (indigo), health (green), money (emerald), social (violet), learn (amber), play (rose).',
  RadiusToken: 'A named border-radius value. `radius-none` is 0 px (sharp corners), `radius-sm` / `radius-md` / `radius-lg` are progressively larger, and `radius-full` produces a fully-rounded pill shape.',
  SlotKind: 'Discriminant for the polymorphic leading/trailing slot on ListItem and SwipeableRow. `none` renders nothing. `icon` renders a named icon. `avatar` embeds an Avatar node. `badge` embeds a Badge node.',
  SpaceToken: 'A named spacing step from the 6-stop scale (0 / 4 / 8 / 12 / 20 / 32 pt). The model picks space token names; the design-system resolves them to concrete point values. Use for padding, gap, and margin.',
  Stance: 'The visual personality of the app. `productive` is high-density, clean, and functional — suitable for tools, trackers, and utilities. `expressive` is lower density, more generous whitespace, and warmer — suitable for journals, wellness, and creative apps.',
  Tone: 'Semantic feedback tone used by the toast action and badge components. `success` signals a positive outcome (green tint), `warning` signals a cautionary state (amber tint), and `danger` signals an error or destructive action (red tint).',
  TypeRole: 'A named typographic role from the 6-stop type scale. `type-display` is the largest display heading. `type-h1` / `type-h2` are section headings. `type-body` is the default reading size. `type-caption` is supporting text. `type-micro` is fine print.',
}

const COMPONENT_DESCRIPTIONS: Record<string, string> = {
  // Layout tier
  Screen: 'A scrollable full-screen container that forms the root of each app screen. Manages safe-area insets and optional uniform padding. All visible content lives inside a Screen or one of the other layout containers.',
  Section: 'A vertically-stacked group of related content with an optional title header and caption footer. Sections create visual hierarchy within a Screen by separating content into labeled blocks.',
  Stack: 'A vertical flex container that stacks its children with uniform gap spacing. Stack is the primary layout primitive for linear content. The `align` prop controls cross-axis alignment.',
  Row: 'A horizontal flex container that places its children side-by-side. Supports `justify` for main-axis distribution and `wrap` to allow children to reflow onto multiple lines when space is constrained.',
  Card: 'A contained surface that groups related content with configurable elevation and radius. Cards visually separate a cluster of nodes from the background, signaling that the content inside belongs together.',

  // Typography tier
  Heading: 'A bold text label used for screen titles, section headers, and card titles. Supports heading levels 1–3 and optional text alignment. The semantic `role` prop is used by screen readers.',
  Body: 'Standard body copy for descriptive text, instructions, and multi-line content. Accepts an optional semantic color token for tinting and alignment control.',
  Caption: 'Supplementary fine-print text rendered in the `type-caption` type role. Used for timestamps, units, helper text, and footnotes beneath form fields or stats.',

  // Inputs tier
  TextField: 'A text input field bound to a StringBinding slot. Supports single-line and multiline modes, keyboard type hints, and an optional character limit. The `optional` flag indicates to users that the field is not required.',
  NumberField: 'A numeric input field bound to a NumberBinding slot. Accepts optional min, max, and step constraints. Renders a numeric keyboard on mobile. Use for quantities, measurements, and counts.',
  DateField: 'A date or time picker bound to a DateBinding slot. The `mode` prop selects between date-only, time-only, or combined datetime entry. Values are ISO 8601 strings at the protocol level.',
  Picker: 'A closed-list selection control bound to a StringBinding slot. The `options` array enumerates all allowed values. Renders as a native picker or segmented control depending on the host renderer.',
  Switch: 'A binary toggle bound to a BooleanBinding slot. Use for settings and feature flags that the user can enable or disable. The renderer displays a native iOS toggle switch.',

  // V1 Phase 1 Step 2 — inputs tier expansion
  MoneyField: 'A currency input bound to a NumberBinding slot that stores the value as integer cents (zero-decimal for JPY). The `currency` prop selects the currency code (USD default). Values are stored as integers to avoid floating-point arithmetic errors. `min` and `max` are in cents. The renderer shows a leading currency symbol and formats the display value per locale.',
  TimeField: 'A time picker bound to a StringBinding slot that stores HH:MM values in 24-hour format. The `mode` prop selects between `time` (HH:MM) and `time-with-seconds` (HH:MM:SS). Optional `min` and `max` constrain the allowed time range. Renders a native time picker sheet.',
  MultiPicker: 'A multi-select picker bound to a StringBinding slot that stores selected values as a comma-separated string. Each option has a `value` (no commas allowed) and a `label`. Optional `min` / `max` constrain the number of selections. Selected values appear as removable chips in the trigger.',
  Slider: 'A continuous range input bound to a NumberBinding slot. The `min` and `max` props define the range; `step` constrains snap points. `format` controls display: `integer`, `decimal` (2dp), or `percent`. `showValue` renders the current value in a badge above the thumb. VoiceOver increment / decrement adjustments move by one step.',
  RatingInput: 'A star-glyph rating input bound to a NumberBinding slot. `scale` is 5 (default) or 10 glyphs. `glyph` selects the symbol: star (default), heart, flame, or circle. `allowHalf` enables half-point VoiceOver increment. Tapping the current value resets to 0 (clear). Productive stance renders 24pt glyphs; expressive renders 28pt.',
  SearchBar: 'A search text input bound to a StringBinding slot. When `boundCollectionId` is set, the query is written to SearchFilterContext so List components for that collection filter rows by case-insensitive substring match in real time. The optional `voiceMic` shows a mic icon when the field is empty (V0.5 placeholder — tap shows a coming-soon toast). A clear button appears when the query is non-empty.',

  // Display tier
  Stat: 'A key-value display component for prominent numeric or textual metrics. The `label` names the metric; `valueBinding` supplies the current value. Optional `unit` appends a suffix (e.g. "kg", "steps") and `trend` shows a directional arrow.',
  Badge: 'A small inline label with semantic tone tinting. Use for status indicators, counts, and categorical tags. The `tone` prop applies success / warning / danger coloring.',
  Chip: 'An interactive pill label that can carry an optional action and a selected state binding. Use for filter chips, tag selectors, and compact toggles within a Row.',
  Avatar: 'A circular image component that displays a user or item photo from an ImageBinding. Falls back to `fallbackText` (initials or an emoji) when the image is unavailable. The `size` prop is a SpaceToken.',

  // V1 Phase 1 Step 3 — display tier additions
  AvatarGroup: 'A horizontal row of overlapping Avatar circles for displaying a group of up to 5 people. When more avatars exist than `maxShown`, a "+N" overflow chip is appended. The `overlap` prop selects tight (−25% diameter) or spread (−10% diameter) stacking. An auto-generated `accessibilityLabel` lists all names with an "and N others" suffix when truncated.',
  Callout: 'An inline contextual notice with a semantic `variant` (info, success, warning, tip, danger) that drives icon and background tint. Warning and danger variants use `accessibilityRole="alert"`. An optional trailing `action` renders a compact button. The `tip` variant uses `bg-elevated` with no color tint; all other variants apply a 6% tint of the variant color.',

  // Lists tier
  List: 'A vertically-scrolling collection view that renders one instance of `itemTemplate` per row in the named collection. An optional `emptyState` node is shown when the collection has no rows.',
  ListItem: 'A standard list row with a title, optional subtitle, and polymorphic leading/trailing slots. The `tapAction` fires when the user taps the row. Use inside a List\'s `itemTemplate`.',
  SwipeableRow: 'A list row that reveals leading and trailing action slots on swipe. Wrap a ListItem or other node as the `child` prop. Leading and trailing slots render action controls on swipe.',
  EmptyState: 'A full-area placeholder displayed when a collection is empty or content is unavailable. Shows a title, optional subtitle, and an optional call-to-action button.',
  LoadingState: 'A full-area loading indicator displayed while data is being fetched or processed. Shows an optional message alongside the activity indicator.',

  // V1 Phase 1 Step 4 — Lists & Data tier expansion
  GridList: 'A 2- or 3-column masonry grid backed by FlashList. Use in place of List when items benefit from visual density — photo grids, card grids, product tiles. The `columns` prop is a hint; the renderer collapses to 2 columns on devices narrower than 380pt to maintain a minimum 150pt cell width. `itemAspectRatio` constrains each cell\'s shape. An optional `emptyState` or `loadingState` node is shown when the collection is empty or loading.',
  Carousel: 'A horizontally-scrollable card viewer backed by FlashList. Accepts either a `collectionId` (dynamic, one card per row) or a static `cards` array — the two are mutually exclusive and the schema rejects specs that set both or neither. `indicator` selects the page position display style (dots, fraction "1 / 5", or hidden). `autoplay` advances cards every 4 seconds but is hard-disabled when the user has Reduce Motion enabled — accessibility requirement.',
  Timeline: 'A vertically-scrolling event log with a left-rail date indicator. Each event\'s date is read from `dateField` on the named collection; the field must have type `date` (cross-ref validated in Step 8). `dateFormat` controls how the date is displayed: relative ("2h ago"), absolute ("Jan 14, 2026"), or short ("Jan 14"). `groupBy` inserts date-group headers between events at day, week, or month boundaries. The left rail draws a continuous vertical line with `accent` circles at each event position.',
  ErrorState: 'A centered error display that mirrors V0 EmptyState\'s layout but defaults to the `alert-triangle` icon in `warning` color. Use when a data fetch or action fails and the user may retry. `accessibilityRole="alert"` causes VoiceOver to announce the error immediately on render. The optional `action` and `actionLabel` render a full-width secondary button for a retry or navigation CTA.',

  // Compound tier
  ConditionalSection: 'A container that is visible only when a named collection satisfies a condition. `showWhen: \'whenEmpty\'` shows the children when the collection has no rows; `showWhen: \'whenNotEmpty\'` shows them when it has at least one.',
  ListSummary: 'Aggregates a numeric field across all rows in a named collection and displays the result with a label. Supported aggregations: count, sum, avg, min, max. Use for totals, averages, and record counts.',
  MediaTray: 'A horizontally-scrolling image tray that renders one image card per row in the named collection. The `imageField` must be an image-type field on the collection. Tapping a card fires the optional `tapAction`.',
  ImagePicker: 'A camera and photo-library picker bound to an ImageBinding slot. The selected image URI is written to the bound slot. The `optional` flag controls whether the user must select an image.',

  // V1 Phase 1 Step 5 — Productivity domain compounds
  TransactionRow: 'A two-line financial transaction row. Shows merchant name and ISO date on the left; formatted currency amount on the right. Positive amounts render in `success` color (inflow); negative amounts render in `fg` (NOT `danger` — outflows are neutral). An optional `categoryIcon` appears in a 32pt circle with subtle tint background. Amount is formatted via `Intl.NumberFormat` with the specified currency code.',
  Receipt: 'An itemized receipt with label-amount rows separated by dotted leaders. Each row has a `label`, `amount` (NumberBinding, in cents), and optional `quantity`. The receipt footer shows `subtotal`, optional `tax`, optional `tip`, and `total`. iOS `borderStyle: dotted` is unreliable — the renderer falls back to repeated `.` characters as the leader. The cross-ref validator checks that `|subtotal + tax + tip − total| ≤ 1 cent` (T-0009-118/119); mismatches beyond that tolerance produce a `receipt_total_mismatch` warning.',
  MetricTile: 'A KPI tile displaying a prominent value, label, optional delta indicator, and optional sparkline chart. `value` and `label` are hardcoded strings. `delta` shows a change string; `deltaTone` colors it: `positive` → success, `negative` → danger, `neutral` → fg-muted. `sparklineData` accepts up to 30 data points rendered as a `<Polyline>` via react-native-svg. Single-point sparkline renders as a horizontal line at midpoint. Without `sparklineData`, no sparkline area is rendered.',
  StepList: 'An ordered list of steps rendered in either `numbered` or `checklist` style. In `numbered` style, steps show index circles connected by a vertical rail line. In `checklist` style, each step has a checkbox bound via an optional `done` BooleanBinding. Each step has a `title` (required) and optional `body` text. Maximum 20 steps.',

  // V1 Phase 1 Step 6 — Date components
  Calendar: 'A month or week calendar grid with optional collection binding for marking dates. In month view, renders a 6-row × 7-column grid (42 fixed cells). Leading and trailing cells from adjacent months render in muted color. `firstDayOfWeek` shifts the grid: `sunday` (default) or `monday`. When `collectionId` and `dateField` are both set, the renderer marks matching dates with an accent dot beneath the day number. The `selectedBinding` (DateBinding) is updated via dispatch when the user taps a date cell. Month navigation chevrons manage internal month state independently of the spec. `view: \'week\'` renders a single 7-cell row for the current week.',
  Heatmap: 'A date-intensity heatmap grid backed by a required collection. Groups collection items by `dateField` and bins counts into intensity levels. In `count` mode (default), days with items are quintile-binned into 5 levels (level 0 = no items; levels 1–5 = quintiles of the non-zero count distribution). In `binary` mode, any day with at least one item gets level 1, otherwise level 0. The `range` prop controls the window of days displayed (ending today): 30d, 90d (default), 180d, or 365d. The grid is 7 cells tall (Sun–Sat) by N weeks wide. Today\'s cell has a 1pt accent border. Each cell\'s long-press exposes per-cell info (date, count) via `accessibilityCustomActions`.',

  // Actions tier
  Button: 'A tappable button that fires an action on press. The `variant` prop selects primary (accent fill), secondary (outlined), or destructive (danger fill) styling. The optional `disabled` BooleanBinding disables interaction.',
  Fab: 'A Floating Action Button that anchors to the bottom-right corner of its containing screen. Displays a named icon and fires an action on tap. Use for the single primary creation or navigation action on a screen.',

  // V1 Phase 1 Step 1 additions
  Divider: 'A horizontal hairline separator for visual breathing room between sections. The optional `label` renders centered text on the line. `inset` controls left/both-side indentation (16pt). `weight` selects hairline (1pt) or thick (2pt). Stance-driven vertical margin: tight for productive, breathing for expressive.',
  Image: 'A single image display component backed by an ImageBinding source. The required `alt` prop provides VoiceOver text — the schema rejects empty alt strings. `aspectRatio` constrains the rendered dimensions; `fit` controls cover-vs-contain scaling; `radius` rounds corners. On load error, renders the `fallbackIcon` (default: `image`) centered on a `bg-elevated` background.',
  IconButton: 'A compact icon-only button for headers and toolbars. Requires `accessibilityLabel` (the schema rejects empty values — icon names are not human-readable). The `variant` differs from Button: use `ghost` (transparent, default) instead of Button\'s `text`. Hit target is always ≥ 44pt regardless of icon size. Circular tap area via `radius-full`.',
}

const VERB_DESCRIPTIONS: Record<string, string> = {
  set: 'Write a literal value to a named state slot. The `target` is the slot name; `value` is a BindingValue (string, number, or boolean). Use to capture form input or update app state after an event.',
  update: 'Apply a partial patch to a collection item identified by `itemId` within the named `collection`. The `patch` is a record of field-name → BindingValue updates. Does not add or remove items — only mutates existing fields.',
  reset: 'Clear a state slot back to its `initialState` value. Use to undo an in-progress edit or restore a default after a form is submitted.',
  addItem: 'Append a new row to the named collection. The `item` record must supply values for all required fields. The new row is appended at the end of the collection.',
  removeItem: 'Delete a row identified by `itemId` from the named collection. The row is removed immediately with no undo. Consider a `clearCollection` with `confirmText` for destructive bulk operations.',
  updateItem: 'Patch fields on a specific collection row identified by `itemId`. Functionally equivalent to `update`; provided as an idiomatic alias for collection-mutation flows.',
  clearCollection: 'Remove all rows from the named collection. The optional `confirmText` presents a confirmation dialog before the deletion is committed. Use for "clear history" or "reset data" flows.',
  navigate: 'Push a screen onto the navigation stack. The `target` is a screen `id` declared in `spec.screens`. For stack and modal-overlay navigation patterns.',
  back: 'Pop the current screen from the navigation stack, returning to the previous screen. Takes no parameters. Use on cancel or close buttons in stack and modal-overlay flows.',
  capture: 'Open the device camera or photo-library picker and write the resulting image URI to the named state slot. The `target` must be a slot compatible with an ImageBinding.',
  toast: 'Display a brief non-blocking feedback message at the bottom of the screen. The optional `tone` tints the toast with success, warning, or danger styling.',
  aiProcess: 'Run an AI summarization task over the named collection and write the result to a state slot. In V0, `task` is always `\'summarize\'`. The `prompt` guides the summarization; the `target` slot receives the result string.',
}

const BINDING_DESCRIPTIONS: Record<string, string> = {
  StringBinding: 'A three-way discriminated union for string-typed values. `literal` carries a hardcoded string. `state` reads from a named slot in `initialState`. `collectionField` reads a string-typed field from the current collection row at render time.',
  NumberBinding: 'A three-way discriminated union for number-typed values. `literal` carries a hardcoded number. `state` reads from a named slot. `collectionField` reads a number-typed field from the current collection row.',
  BooleanBinding: 'A three-way discriminated union for boolean-typed values. `literal` carries `true` or `false`. `state` reads from a named slot. `collectionField` reads a boolean-typed field from the current collection row.',
  DateBinding: 'A three-way discriminated union for date/time values stored as ISO 8601 strings. `literal` carries a hardcoded date string. `state` reads from a named slot. `collectionField` reads a date-typed field.',
  ImageBinding: 'A three-way discriminated union for image URI values. `literal` carries a hardcoded URI or asset reference. `state` reads from a named slot (typically written by a `capture` action). `collectionField` reads an image-typed field.',
}

const TOP_LEVEL_DESCRIPTIONS: Record<string, string> = {
  Collection: 'Declares a named data collection with a typed field schema and optional seed data. Each collection has an `id` (used by components to reference it), a `name` (human-readable), up to 20 typed `fields`, up to 50 `seedData` rows, and a `syncMode` (local or cloud-private).',
  Spec: 'The top-level document that fully describes a generated app. Includes visual identity fields (archetype, stance, palette, coverIcon), navigation structure, all screens with their root node trees, collections, and optional mutable state slots (initialState). Version is always `1` in V0.',
  SpecScreen: 'A named screen entry in the spec\'s `screens` array. Each screen has a unique `id`, an optional `title` (shown in tab bars or stack navigation headers), and a `root` node that forms the screen\'s full content tree.',
}

// ---------------------------------------------------------------------------
// § Section builder
// ---------------------------------------------------------------------------

function section(name: string, description: string): string {
  return `## ${name}\n\n${description}\n`
}

// ---------------------------------------------------------------------------
// § Assemble document
// ---------------------------------------------------------------------------

const sections: string[] = []

sections.push(`# Protocol Catalog\n\nGenerated documentation for the V0 protocol schema. Each section describes one token type, component, action verb, binding type, or top-level schema. Used by ADR-0007's prompt builder as the cacheable catalog block.\n\nDO NOT EDIT. Source: packages/protocol/src/ — regenerate with \`pnpm --filter @app-creator/protocol codegen\`\n`)

// 1. Token types (alphabetical — 13 sections)
sections.push(`---\n\n## Token Types\n`)
for (const name of Object.keys(TOKEN_DESCRIPTIONS).sort()) {
  const description = TOKEN_DESCRIPTIONS[name]
  if (description !== undefined) {
    sections.push(section(name, description))
  }
}

// 2. Component schemas (tier order — 47 sections)
sections.push(`---\n\n## Component Schemas\n`)
// Tier order matches components/index.ts: layout, typography, inputs, display, lists, compound, actions
const COMPONENT_ORDER = [
  // Layout tier (5 → 6 with Divider)
  'Screen', 'Section', 'Stack', 'Row', 'Card',
  // V1 Phase 1 Step 1 — layout addition
  'Divider',
  // Typography tier (3)
  'Heading', 'Body', 'Caption',
  // Inputs tier (5 → 11 with V1 Phase 1 Step 2)
  'TextField', 'NumberField', 'DateField', 'Picker', 'Switch',
  // V1 Phase 1 Step 2 — inputs tier expansion
  'MoneyField', 'TimeField', 'MultiPicker', 'Slider', 'RatingInput', 'SearchBar',
  // Display tier (4 → 6 with AvatarGroup + Callout)
  'Stat', 'Badge', 'Chip', 'Avatar',
  // V1 Phase 1 Step 3 — display tier additions
  'AvatarGroup', 'Callout',
  // Lists tier (5 → 9 with V1 Phase 1 Step 4)
  'List', 'ListItem', 'SwipeableRow', 'EmptyState', 'LoadingState',
  // V1 Phase 1 Step 4 — Lists & Data tier expansion
  'GridList', 'Carousel', 'Timeline', 'ErrorState',
  // Compound tier (4 → 5 with Image → 9 with V1 Phase 1 Step 5)
  'ConditionalSection', 'ListSummary', 'MediaTray', 'ImagePicker',
  // V1 Phase 1 Step 1 — compound addition
  'Image',
  // V1 Phase 1 Step 5 — Productivity domain compounds
  'TransactionRow', 'Receipt', 'MetricTile', 'StepList',
  // V1 Phase 1 Step 6 — Date components
  'Calendar', 'Heatmap',
  // Actions tier (2 → 3 with IconButton)
  'Button', 'Fab',
  // V1 Phase 1 Step 1 — actions addition
  'IconButton',
]
for (const name of COMPONENT_ORDER) {
  const description = COMPONENT_DESCRIPTIONS[name]
  if (description !== undefined) {
    sections.push(section(name, description))
  }
}

// 3. Action verbs (schema-declaration order — 12 sections)
sections.push(`---\n\n## Action Verbs\n`)
const VERB_ORDER = [
  'set', 'update', 'reset', 'addItem', 'removeItem', 'updateItem',
  'clearCollection', 'navigate', 'back', 'capture', 'toast', 'aiProcess',
]
for (const name of VERB_ORDER) {
  const description = VERB_DESCRIPTIONS[name]
  if (description !== undefined) {
    sections.push(section(name, description))
  }
}

// 4. Binding types (5 sections)
sections.push(`---\n\n## Binding Types\n`)
const BINDING_ORDER = [
  'StringBinding', 'NumberBinding', 'BooleanBinding', 'DateBinding', 'ImageBinding',
]
for (const name of BINDING_ORDER) {
  const description = BINDING_DESCRIPTIONS[name]
  if (description !== undefined) {
    sections.push(section(name, description))
  }
}

// 5. Top-level schemas (3 sections)
sections.push(`---\n\n## Top-Level Schemas\n`)
const TOP_LEVEL_ORDER = ['Collection', 'Spec', 'SpecScreen']
for (const name of TOP_LEVEL_ORDER) {
  const description = TOP_LEVEL_DESCRIPTIONS[name]
  if (description !== undefined) {
    sections.push(section(name, description))
  }
}

const content = sections.join('\n')
fs.writeFileSync(OUTPUT_PATH, content, 'utf8')
process.stdout.write(`[gen-docs] wrote ${OUTPUT_PATH}\n`)

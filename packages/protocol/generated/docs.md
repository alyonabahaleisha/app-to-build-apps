# Protocol Catalog

Generated documentation for the V0 protocol schema. Each section describes one token type, component, action verb, binding type, or top-level schema. Used by ADR-0007's prompt builder as the cacheable catalog block.

DO NOT EDIT. Source: packages/protocol/src/ — regenerate with `pnpm --filter @app-creator/protocol codegen`

---

## Token Types

## Archetype

The intended use-case category of the app. V0 supports four archetypes — ListCRUD (manage a list of items), Tracker (log recurring events), Journal (capture free-form entries over time), and Calculator (compute derived values). The reserved value `unknown` is provided for forward compatibility.

## BindingKind

Discriminant for the three-way Binding<T> union. `literal` carries a hardcoded compile-time value. `state` references a named slot in the app's mutable initialState. `collectionField` reads a specific field from a specific collection row at runtime.

## ColorToken

A semantic color name from the V0 palette system. The model picks a color token name; the design-system package resolves it to a concrete hex value for the active stance and palette. Tokens: bg, bg-elevated, bg-overlay, fg, fg-muted, fg-faint, divider, accent, accent-fg, success, warning, danger.

## Elevation

A named shadow recipe applied to container components. `elevation-flat` has no shadow, `elevation-raised` has a subtle shadow, and `elevation-floating` has a prominent shadow. The design-system resolves each to concrete shadow values.

## MotionCurve

A named animation easing curve. `motion-instant` skips animation entirely (useful for reduced-motion). `motion-snappy` is a quick, sharp transition. `motion-smooth` is a gentle ease-in-out. `motion-springy` has a small overshoot for a physical feel.

## NavPattern

The top-level navigation structure for the app. `none` means a single-screen app with no navigation chrome. `stack` uses push/pop navigation. `tabs` renders a tab bar at the bottom (2–4 screens). `modal-overlay` presents secondary screens as modal sheets.

## Palette

The accent color palette. Each palette is a thematic accent pair (accent + accent-fg) resolved per stance. Palettes: focus (indigo), health (green), money (emerald), social (violet), learn (amber), play (rose).

## RadiusToken

A named border-radius value. `radius-none` is 0 px (sharp corners), `radius-sm` / `radius-md` / `radius-lg` are progressively larger, and `radius-full` produces a fully-rounded pill shape.

## SlotKind

Discriminant for the polymorphic leading/trailing slot on ListItem and SwipeableRow. `none` renders nothing. `icon` renders a named icon. `avatar` embeds an Avatar node. `badge` embeds a Badge node.

## SpaceToken

A named spacing step from the 6-stop scale (0 / 4 / 8 / 12 / 20 / 32 pt). The model picks space token names; the design-system resolves them to concrete point values. Use for padding, gap, and margin.

## Stance

The visual personality of the app. `productive` is high-density, clean, and functional — suitable for tools, trackers, and utilities. `expressive` is lower density, more generous whitespace, and warmer — suitable for journals, wellness, and creative apps.

## Tone

Semantic feedback tone used by the toast action and badge components. `success` signals a positive outcome (green tint), `warning` signals a cautionary state (amber tint), and `danger` signals an error or destructive action (red tint).

## TypeRole

A named typographic role from the 6-stop type scale. `type-display` is the largest display heading. `type-h1` / `type-h2` are section headings. `type-body` is the default reading size. `type-caption` is supporting text. `type-micro` is fine print.

---

## Component Schemas

## Screen

A scrollable full-screen container that forms the root of each app screen. Manages safe-area insets and optional uniform padding. All visible content lives inside a Screen or one of the other layout containers.

## Section

A vertically-stacked group of related content with an optional title header and caption footer. Sections create visual hierarchy within a Screen by separating content into labeled blocks.

## Stack

A vertical flex container that stacks its children with uniform gap spacing. Stack is the primary layout primitive for linear content. The `align` prop controls cross-axis alignment.

## Row

A horizontal flex container that places its children side-by-side. Supports `justify` for main-axis distribution and `wrap` to allow children to reflow onto multiple lines when space is constrained.

## Card

A contained surface that groups related content with configurable elevation and radius. Cards visually separate a cluster of nodes from the background, signaling that the content inside belongs together.

## Divider

A horizontal hairline separator for visual breathing room between sections. The optional `label` renders centered text on the line. `inset` controls left/both-side indentation (16pt). `weight` selects hairline (1pt) or thick (2pt). Stance-driven vertical margin: tight for productive, breathing for expressive.

## Heading

A bold text label used for screen titles, section headers, and card titles. Supports heading levels 1–3 and optional text alignment. The semantic `role` prop is used by screen readers.

## Body

Standard body copy for descriptive text, instructions, and multi-line content. Accepts an optional semantic color token for tinting and alignment control.

## Caption

Supplementary fine-print text rendered in the `type-caption` type role. Used for timestamps, units, helper text, and footnotes beneath form fields or stats.

## TextField

A text input field bound to a StringBinding slot. Supports single-line and multiline modes, keyboard type hints, and an optional character limit. The `optional` flag indicates to users that the field is not required.

## NumberField

A numeric input field bound to a NumberBinding slot. Accepts optional min, max, and step constraints. Renders a numeric keyboard on mobile. Use for quantities, measurements, and counts.

## DateField

A date or time picker bound to a DateBinding slot. The `mode` prop selects between date-only, time-only, or combined datetime entry. Values are ISO 8601 strings at the protocol level.

## Picker

A closed-list selection control bound to a StringBinding slot. The `options` array enumerates all allowed values. Renders as a native picker or segmented control depending on the host renderer.

## Switch

A binary toggle bound to a BooleanBinding slot. Use for settings and feature flags that the user can enable or disable. The renderer displays a native iOS toggle switch.

## Stat

A key-value display component for prominent numeric or textual metrics. The `label` names the metric; `valueBinding` supplies the current value. Optional `unit` appends a suffix (e.g. "kg", "steps") and `trend` shows a directional arrow.

## Badge

A small inline label with semantic tone tinting. Use for status indicators, counts, and categorical tags. The `tone` prop applies success / warning / danger coloring.

## Chip

An interactive pill label that can carry an optional action and a selected state binding. Use for filter chips, tag selectors, and compact toggles within a Row.

## Avatar

A circular image component that displays a user or item photo from an ImageBinding. Falls back to `fallbackText` (initials or an emoji) when the image is unavailable. The `size` prop is a SpaceToken.

## AvatarGroup

A horizontal row of overlapping Avatar circles for displaying a group of up to 5 people. When more avatars exist than `maxShown`, a "+N" overflow chip is appended. The `overlap` prop selects tight (−25% diameter) or spread (−10% diameter) stacking. An auto-generated `accessibilityLabel` lists all names with an "and N others" suffix when truncated.

## Callout

An inline contextual notice with a semantic `variant` (info, success, warning, tip, danger) that drives icon and background tint. Warning and danger variants use `accessibilityRole="alert"`. An optional trailing `action` renders a compact button. The `tip` variant uses `bg-elevated` with no color tint; all other variants apply a 6% tint of the variant color.

## List

A vertically-scrolling collection view that renders one instance of `itemTemplate` per row in the named collection. An optional `emptyState` node is shown when the collection has no rows.

## ListItem

A standard list row with a title, optional subtitle, and polymorphic leading/trailing slots. The `tapAction` fires when the user taps the row. Use inside a List's `itemTemplate`.

## SwipeableRow

A list row that reveals leading and trailing action slots on swipe. Wrap a ListItem or other node as the `child` prop. Leading and trailing slots render action controls on swipe.

## EmptyState

A full-area placeholder displayed when a collection is empty or content is unavailable. Shows a title, optional subtitle, and an optional call-to-action button.

## LoadingState

A full-area loading indicator displayed while data is being fetched or processed. Shows an optional message alongside the activity indicator.

## ConditionalSection

A container that is visible only when a named collection satisfies a condition. `showWhen: 'whenEmpty'` shows the children when the collection has no rows; `showWhen: 'whenNotEmpty'` shows them when it has at least one.

## ListSummary

Aggregates a numeric field across all rows in a named collection and displays the result with a label. Supported aggregations: count, sum, avg, min, max. Use for totals, averages, and record counts.

## MediaTray

A horizontally-scrolling image tray that renders one image card per row in the named collection. The `imageField` must be an image-type field on the collection. Tapping a card fires the optional `tapAction`.

## ImagePicker

A camera and photo-library picker bound to an ImageBinding slot. The selected image URI is written to the bound slot. The `optional` flag controls whether the user must select an image.

## Image

A single image display component backed by an ImageBinding source. The required `alt` prop provides VoiceOver text — the schema rejects empty alt strings. `aspectRatio` constrains the rendered dimensions; `fit` controls cover-vs-contain scaling; `radius` rounds corners. On load error, renders the `fallbackIcon` (default: `image`) centered on a `bg-elevated` background.

## Button

A tappable button that fires an action on press. The `variant` prop selects primary (accent fill), secondary (outlined), or destructive (danger fill) styling. The optional `disabled` BooleanBinding disables interaction.

## Fab

A Floating Action Button that anchors to the bottom-right corner of its containing screen. Displays a named icon and fires an action on tap. Use for the single primary creation or navigation action on a screen.

## IconButton

A compact icon-only button for headers and toolbars. Requires `accessibilityLabel` (the schema rejects empty values — icon names are not human-readable). The `variant` differs from Button: use `ghost` (transparent, default) instead of Button's `text`. Hit target is always ≥ 44pt regardless of icon size. Circular tap area via `radius-full`.

---

## Action Verbs

## set

Write a literal value to a named state slot. The `target` is the slot name; `value` is a BindingValue (string, number, or boolean). Use to capture form input or update app state after an event.

## update

Apply a partial patch to a collection item identified by `itemId` within the named `collection`. The `patch` is a record of field-name → BindingValue updates. Does not add or remove items — only mutates existing fields.

## reset

Clear a state slot back to its `initialState` value. Use to undo an in-progress edit or restore a default after a form is submitted.

## addItem

Append a new row to the named collection. The `item` record must supply values for all required fields. The new row is appended at the end of the collection.

## removeItem

Delete a row identified by `itemId` from the named collection. The row is removed immediately with no undo. Consider a `clearCollection` with `confirmText` for destructive bulk operations.

## updateItem

Patch fields on a specific collection row identified by `itemId`. Functionally equivalent to `update`; provided as an idiomatic alias for collection-mutation flows.

## clearCollection

Remove all rows from the named collection. The optional `confirmText` presents a confirmation dialog before the deletion is committed. Use for "clear history" or "reset data" flows.

## navigate

Push a screen onto the navigation stack. The `target` is a screen `id` declared in `spec.screens`. For stack and modal-overlay navigation patterns.

## back

Pop the current screen from the navigation stack, returning to the previous screen. Takes no parameters. Use on cancel or close buttons in stack and modal-overlay flows.

## capture

Open the device camera or photo-library picker and write the resulting image URI to the named state slot. The `target` must be a slot compatible with an ImageBinding.

## toast

Display a brief non-blocking feedback message at the bottom of the screen. The optional `tone` tints the toast with success, warning, or danger styling.

## aiProcess

Run an AI summarization task over the named collection and write the result to a state slot. In V0, `task` is always `'summarize'`. The `prompt` guides the summarization; the `target` slot receives the result string.

---

## Binding Types

## StringBinding

A three-way discriminated union for string-typed values. `literal` carries a hardcoded string. `state` reads from a named slot in `initialState`. `collectionField` reads a string-typed field from the current collection row at render time.

## NumberBinding

A three-way discriminated union for number-typed values. `literal` carries a hardcoded number. `state` reads from a named slot. `collectionField` reads a number-typed field from the current collection row.

## BooleanBinding

A three-way discriminated union for boolean-typed values. `literal` carries `true` or `false`. `state` reads from a named slot. `collectionField` reads a boolean-typed field from the current collection row.

## DateBinding

A three-way discriminated union for date/time values stored as ISO 8601 strings. `literal` carries a hardcoded date string. `state` reads from a named slot. `collectionField` reads a date-typed field.

## ImageBinding

A three-way discriminated union for image URI values. `literal` carries a hardcoded URI or asset reference. `state` reads from a named slot (typically written by a `capture` action). `collectionField` reads an image-typed field.

---

## Top-Level Schemas

## Collection

Declares a named data collection with a typed field schema and optional seed data. Each collection has an `id` (used by components to reference it), a `name` (human-readable), up to 20 typed `fields`, up to 50 `seedData` rows, and a `syncMode` (local or cloud-private).

## Spec

The top-level document that fully describes a generated app. Includes visual identity fields (archetype, stance, palette, coverIcon), navigation structure, all screens with their root node trees, collections, and optional mutable state slots (initialState). Version is always `1` in V0.

## SpecScreen

A named screen entry in the spec's `screens` array. Each screen has a unique `id`, an optional `title` (shown in tab bars or stack navigation headers), and a `root` node that forms the screen's full content tree.

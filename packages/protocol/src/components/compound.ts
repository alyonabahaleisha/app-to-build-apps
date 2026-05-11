import {z} from 'zod'
import {COMPONENT_ID_REGEX} from './layout.js'
import {ActionSchema} from '../actions.js'
import {ImageBindingSchema, NumberBindingSchema, BooleanBindingSchema} from '../binding.js'
import {IconNameSchema} from './slot.js'
import {CurrencySchema} from '../enums.js'

// ConditionalSection — renders children only if predicate matches.
// The entire conditional surface in V0 (brief §2.4 Registry 5): no expression DSL.
// children: z.array(z.unknown()) for Step 4; Step 5 wires in NodeSchema.
export const ConditionalSectionSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('ConditionalSection'),
    collectionId: z.string().min(1).max(64),
    showWhen: z.enum(['whenEmpty', 'whenNotEmpty']),
    children: z.array(z.unknown()),
    accessibilityLabel: z.string().optional(),
  })
  .strict()
export type ConditionalSection = z.infer<typeof ConditionalSectionSchema>

// ListSummary — single-line AI summary of a collection.
// The aiProcess(summarize) host component. On iOS 26+ Pro dispatches to Apple
// Foundation Models; on unsupported devices: hides (fallback: hide) or shows
// raw last-3 items (fallback: show-raw).
export const ListSummarySchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('ListSummary'),
    collectionId: z.string().min(1).max(64),
    prompt: z.string().min(1).max(400),
    fallback: z.enum(['show-raw', 'hide']).optional(),
    accessibilityLabel: z.string().optional(),
  })
  .strict()
export type ListSummary = z.infer<typeof ListSummarySchema>

// MediaTray — horizontal scrolling tray of images from a collection.
// imageField references a field of type 'image' in the named collection.
// Cross-ref validator (Step 6) checks field existence and type.
export const MediaTraySchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('MediaTray'),
    collectionId: z.string().min(1).max(64),
    imageField: z.string().min(1).max(64),
    aspectRatio: z.enum(['1:1', '4:5', '16:9']).optional(),
    tapAction: ActionSchema.optional(),
    accessibilityLabel: z.string().optional(),
  })
  .strict()
export type MediaTray = z.infer<typeof MediaTraySchema>

// ---------------------------------------------------------------------------
// Image — single image display (V1 Phase 1, Step 1)
//
// `alt` is REQUIRED (min 1 char) — accessibility critical.
// Schema rejects empty alt; renderer also throws defensively (defense-in-depth).
//
// source: ImageBinding (literal URI, state slot, or collectionField).
// fallbackIcon: optional icon name shown when source fails to load.
// ---------------------------------------------------------------------------
export const ImageSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('Image'),
    source: ImageBindingSchema,
    aspectRatio: z.enum(['1:1', '4:5', '16:9', '3:4', '21:9']).optional(),
    fit: z.enum(['cover', 'contain']).optional(),
    radius: z.enum(['radius-none', 'radius-sm', 'radius-md', 'radius-lg', 'radius-full']).optional(),
    alt: z.string().min(1).max(200), // REQUIRED for accessibility — schema rejects empty
    fallbackIcon: IconNameSchema.optional(),
  })
  .strict()
export type Image = z.infer<typeof ImageSchema>

// ImagePicker — tappable image picker backed by expo-image-picker.
// F-9 (closed): valueBinding uses ImageBinding (not a plain value: string).
export const ImagePickerSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('ImagePicker'),
    label: z.string().min(1).max(80),
    valueBinding: ImageBindingSchema,
    source: z.enum(['camera', 'library', 'both']).optional(),
    accessibilityLabel: z.string().optional(),
  })
  .strict()
export type ImagePicker = z.infer<typeof ImagePickerSchema>

// ---------------------------------------------------------------------------
// V1 Phase 1 Step 5 — Productivity domain compounds
// ---------------------------------------------------------------------------

// TransactionRow — single-line financial transaction display.
//
// amount: NumberBinding (cents). Positive = inflow → success color.
//         Negative = outflow → fg (NOT danger — explicit ADR-0009 AC item 2).
// categoryIcon: optional icon in a 32pt circle with subtle tint background.
// Formatted via Intl.NumberFormat('en-US', {style: 'currency', currency}).
export const TransactionRowSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('TransactionRow'),
    date: z.string().min(1),
    merchant: z.string().min(1).max(80),
    amount: NumberBindingSchema,
    // optional, defaults to 'USD' in renderer (matches MoneyFieldSchema pattern)
    currency: CurrencySchema.optional(),
    categoryIcon: IconNameSchema.optional(),
    accessibilityLabel: z.string().optional(),
  })
  .strict()
export type TransactionRow = z.infer<typeof TransactionRowSchema>

// Receipt — itemized receipt with dotted-leader rendering.
//
// iOS borderStyle: 'dotted' is unreliable (Sable UX note) — renderer falls back
// to repeated '.' characters between label and amount.
// Math validation (subtotal + tax + tip ≠ total ± 1 cent) is deferred to
// validateCrossRefs (Step 8). The receipt_total_mismatch warning code is defined
// in the validate module; Step 5 only stores the data shape.
const ReceiptItemSchema = z.object({
  label: z.string().min(1).max(80),
  amount: NumberBindingSchema,
  quantity: z.number().int().positive().optional(),
})

export const ReceiptSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('Receipt'),
    items: z.array(ReceiptItemSchema).min(1).max(50),
    subtotal: NumberBindingSchema,
    tax: NumberBindingSchema.optional(),
    tip: NumberBindingSchema.optional(),
    total: NumberBindingSchema,
    // optional, defaults to 'USD' in renderer (matches MoneyFieldSchema pattern)
    currency: CurrencySchema.optional(),
    accessibilityLabel: z.string().optional(),
  })
  .strict()
export type Receipt = z.infer<typeof ReceiptSchema>
export type ReceiptItem = z.infer<typeof ReceiptItemSchema>

// MetricTile — KPI tile with optional sparkline.
//
// sparklineData: up to 30 data points rendered via react-native-svg <Polyline>.
// Single-point guard: sparklineData.length === 1 renders a horizontal line at
// midpoint (division-by-zero guard for the (i / (points.length - 1)) * width formula).
// deltaTone: 'positive' → success, 'negative' → danger, 'neutral' → fg.
export const MetricTileSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('MetricTile'),
    value: z.string().min(1).max(40),
    label: z.string().min(1).max(80),
    delta: z.string().max(40).optional(),
    deltaTone: z.enum(['positive', 'negative', 'neutral']).optional(),
    sparklineData: z.array(z.number()).max(30).optional(),
    icon: IconNameSchema.optional(),
    accessibilityLabel: z.string().optional(),
  })
  .strict()
export type MetricTile = z.infer<typeof MetricTileSchema>

// StepList — numbered instructions or checklist of steps.
//
// numbered style: circles connected by a vertical rail line.
// checklist style: each step has a checkbox bound via BooleanBinding.
// Max 20 steps (T-0009-128).
const StepSchema = z.object({
  title: z.string().min(1).max(80),
  body: z.string().max(240).optional(),
  done: BooleanBindingSchema.optional(),
})

export const StepListSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('StepList'),
    steps: z.array(StepSchema).min(1).max(20),
    // optional, defaults to 'numbered' in renderer (consistent with .default() avoidance pattern)
    style: z.enum(['numbered', 'checklist']).optional(),
    accessibilityLabel: z.string().optional(),
  })
  .strict()
export type StepList = z.infer<typeof StepListSchema>
export type Step = z.infer<typeof StepSchema>

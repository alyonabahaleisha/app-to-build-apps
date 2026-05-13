import {z} from 'zod'
import {COMPONENT_ID_REGEX} from './layout.js'
import {ActionSchema} from '../actions.js'
import {ImageBindingSchema, NumberBindingSchema, BooleanBindingSchema, DateBindingSchema, StringBindingSchema} from '../binding.js'
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

// MetricTileBaseSchema — raw ZodObject shape for MetricTileSchema.
// Used in NodeSchema discriminated union (refine → ZodEffects, which is
// incompatible with z.discriminatedUnion's ZodObject requirement).
// Mirrors the CalendarBaseSchema / CalendarSchema pattern.
//
// sparklineData: up to 30 data points rendered via react-native-svg <Polyline>.
// Single-point guard: sparklineData.length === 1 renders a horizontal line at
// midpoint (division-by-zero guard for the (i / (points.length - 1)) * width formula).
// deltaTone: 'positive' → success, 'negative' → danger, 'neutral' → fg.
export const MetricTileBaseSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('MetricTile'),
    // value: legacy literal string. Required when valueBinding is absent.
    value: z.string().min(1).max(40).optional(),
    // valueBinding: live binding for MetricTiles that should track a state slot.
    valueBinding: z.union([StringBindingSchema, NumberBindingSchema]).optional(),
    label: z.string().min(1).max(80),
    delta: z.string().max(40).optional(),
    deltaTone: z.enum(['positive', 'negative', 'neutral']).optional(),
    sparklineData: z.array(z.number()).max(30).optional(),
    icon: IconNameSchema.optional(),
    accessibilityLabel: z.string().optional(),
  })
  .strict()

// MetricTileSchema — wraps MetricTileBaseSchema with the XOR refine.
// Use MetricTileSchema for standalone parsing; use MetricTileBaseSchema in discriminated unions.
export const MetricTileSchema = MetricTileBaseSchema.refine(
  v => (v.value !== undefined) !== (v.valueBinding !== undefined),
  {message: 'MetricTile must have exactly one of `value` or `valueBinding`'},
)
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

// ---------------------------------------------------------------------------
// V1 Phase 1 Step 6 — Date components
// ---------------------------------------------------------------------------

// CalendarBaseSchema — the raw ZodObject shape for CalendarSchema.
// Use this for the NodeSchema discriminated union (superRefine → ZodEffects,
// which is incompatible with z.discriminatedUnion's ZodObject requirement).
// Mirrors the CarouselBaseSchema / CarouselSchema pattern in lists.ts.
//
// NOTE: view and firstDayOfWeek use .optional() (not .default()) to avoid
// ZodEffects _input/_output mismatch when used in the NodeSchema discriminated
// union (z.lazy wraps the union in ZodLazy, requiring _input === _output for
// the Node type alias). Renderer applies defaults: view → 'month'.
// See the same pattern in lists.ts for GridList, Carousel, Timeline, ErrorState.
export const CalendarBaseSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('Calendar'),
    view: z.enum(['month', 'week']).optional(),
    collectionId: z.string().min(1).max(64).optional(),
    dateField: z.string().min(1).max(64).optional(),
    selectedBinding: DateBindingSchema.optional(),
    firstDayOfWeek: z.enum(['sunday', 'monday']).optional(),
    accessibilityLabel: z.string().optional(),
  })
  .strict()

// CalendarSchema — wraps CalendarBaseSchema with the cross-field superRefine.
//
// superRefine rule: if collectionId is set, dateField must also be set.
// The error path is ['dateField'] (per ADR-0009 Step 6 code shape).
//
// Use CalendarSchema for parsing; use CalendarBaseSchema in discriminated unions.
export const CalendarSchema = CalendarBaseSchema.superRefine((data, ctx) => {
  // If collectionId is set, dateField must be set
  if (data.collectionId && !data.dateField) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Calendar with collectionId requires dateField',
      path: ['dateField'],
    })
  }
})
export type Calendar = z.infer<typeof CalendarSchema>

// HeatmapSchema — date-intensity grid backed by a required collection.
//
// collectionId + dateField are REQUIRED (not optional) — per ADR-0009 Step 6
// code shape. The schema groups collection items by dateField, then
// quintile-bins counts into 5 intensity levels (or 2 for binary mode).
//
// range: window of days to display (ending at today).
// intensityMode: 'count' (quintile binning) or 'binary' (present/absent).
//
// NOTE: range and intensityMode use .optional() (not .default()) to avoid
// ZodEffects _input/_output mismatch in the NodeSchema discriminated union.
// Renderer applies defaults: range → '90d', intensityMode → 'count'.
// See the same pattern in lists.ts for Timeline, ErrorState, etc.
export const HeatmapSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('Heatmap'),
    collectionId: z.string().min(1).max(64),
    dateField: z.string().min(1).max(64),
    range: z.enum(['30d', '90d', '180d', '365d']).optional(),
    intensityMode: z.enum(['count', 'binary']).optional(),
    accessibilityLabel: z.string().optional(),
  })
  .strict()
export type Heatmap = z.infer<typeof HeatmapSchema>

// ---------------------------------------------------------------------------
// V1 Phase 1 Step 7 — Content/Media expansion
// ---------------------------------------------------------------------------

// GalleryBaseSchema — raw ZodObject shape for the GallerySchema.
// Used in NodeSchema discriminated union (superRefine → ZodEffects, which is
// incompatible with z.discriminatedUnion's ZodObject requirement).
// Mirrors the CalendarBaseSchema / CarouselBaseSchema pattern.
//
// NOTE: columns and aspectRatio use .optional() (not .default()) to avoid
// ZodEffects _input/_output mismatch in the NodeSchema discriminated union.
// Renderer applies defaults: columns → 3, aspectRatio → '1:1'.
export const GalleryBaseSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('Gallery'),
    collectionId: z.string().min(1).max(64).optional(),
    imageField: z.string().min(1).max(64).optional(),
    images: z.array(ImageBindingSchema).max(50).optional(),
    columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional(),
    aspectRatio: z.enum(['1:1', '4:5']).optional(),
    gap: z.enum(['space-none', 'space-xs', 'space-sm', 'space-md', 'space-lg', 'space-xl']).optional(),
    accessibilityLabel: z.string().optional(),
  })
  .strict()

// GallerySchema — wraps GalleryBaseSchema with two superRefine cross-field checks.
//
// Check 1: Mutually exclusive — (collectionId+imageField) XOR images.
//   Both-set rejected; neither-set rejected.
// Check 2: If collectionId set, imageField required (path ['imageField']).
//
// Use GallerySchema for parsing; use GalleryBaseSchema in discriminated unions.
export const GallerySchema = GalleryBaseSchema.superRefine((data, ctx) => {
  // A "complete" collection binding requires BOTH collectionId AND imageField.
  // An "images" binding requires images array with at least one entry.
  const hasCollection = data.collectionId !== undefined && data.imageField !== undefined
  const hasImages = data.images !== undefined && data.images.length > 0
  if (hasCollection === hasImages) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Gallery requires exactly one of (collectionId+imageField) or images',
    })
  }
  if (data.collectionId && !data.imageField) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Gallery with collectionId requires imageField',
      path: ['imageField'],
    })
  }
})
export type Gallery = z.infer<typeof GallerySchema>

// CommerceCardSchema — product card with image, price, and optional CTA.
//
// price and priceCompare are in integer cents (zero-decimal for JPY).
// priceCompare renders with textDecorationLine: 'line-through' (strikethrough).
// currency defaults to 'USD' in the renderer (schema stores as optional).
// ctaLabel defaults to 'Add' in the renderer (schema stores as optional).
//
// NOTE: currency and ctaLabel use .optional() (not .default()) to avoid
// ZodEffects _input/_output mismatch in the NodeSchema discriminated union.
// Renderer applies defaults: currency → 'USD', ctaLabel → 'Add'.
// Same pattern as CalendarBaseSchema, HeatmapSchema, BeforeAfterSchema.
export const CommerceCardSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('CommerceCard'),
    title: z.string().min(1).max(120),
    image: ImageBindingSchema,
    price: NumberBindingSchema,
    priceCompare: NumberBindingSchema.optional(),
    currency: CurrencySchema.optional(),
    ctaLabel: z.string().min(1).max(40).optional(),
    ctaAction: ActionSchema.optional(),
    badge: z.string().max(40).optional(),
    accessibilityLabel: z.string().optional(),
  })
  .strict()
export type CommerceCard = z.infer<typeof CommerceCardSchema>

// BeforeAfterSchema — side-by-side or slider image comparison.
//
// mode: 'slider' — draggable thumb divides before (left/bottom) and after (right/top).
//        Uses Reanimated worklet for the pan gesture.
// mode: 'side-by-side' — static 50/50 split with a hairline divider. No animation.
//
// Reduced-motion: when AccessibilityInfo.reduceMotionEnabled is true, 'slider'
// mode degrades to a static 50/50 split (no drag interaction).
//
// NOTE: mode uses .optional() (not .default()) to avoid ZodEffects mismatch
// in the NodeSchema discriminated union. Renderer applies default: mode → 'slider'.
export const BeforeAfterSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('BeforeAfter'),
    before: ImageBindingSchema,
    after: ImageBindingSchema,
    mode: z.enum(['slider', 'side-by-side']).optional(),
    beforeLabel: z.string().max(40).optional(),
    afterLabel: z.string().max(40).optional(),
    accessibilityLabel: z.string().optional(),
  })
  .strict()
export type BeforeAfter = z.infer<typeof BeforeAfterSchema>

// DocumentPickerSchema — labeled tappable area that invokes expo-document-picker.
//
// valueBinding: StringBinding — receives the selected file URI on success.
// acceptedTypes: maps to MIME types passed to DocumentPicker.getDocumentAsync().
//   'pdf'   → 'application/pdf'
//   'image' → 'image/*'
//   'video' → 'video/*'
//   'audio' → 'audio/*'
//   'any'   → '*/*'
//
// On cancel: no-op (silent). On permission denied: shows error caption; retries on next tap.
//
// NOTE: acceptedTypes uses .optional() (not .default()) to avoid ZodEffects
// _input/_output mismatch in the NodeSchema discriminated union.
// Renderer applies default: acceptedTypes → ['any'].
// Same pattern as CalendarBaseSchema, HeatmapSchema etc.
export const DocumentPickerSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('DocumentPicker'),
    label: z.string().min(1).max(80),
    valueBinding: StringBindingSchema,
    acceptedTypes: z.array(z.enum(['pdf', 'image', 'video', 'audio', 'any'])).min(1).max(4).optional(),
    placeholder: z.string().max(80).optional(),
    accessibilityLabel: z.string().optional(),
  })
  .strict()
export type DocumentPicker = z.infer<typeof DocumentPickerSchema>

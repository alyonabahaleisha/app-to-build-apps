import {z} from 'zod'
import {
  StringBindingSchema,
  NumberBindingSchema,
  BooleanBindingSchema,
  DateBindingSchema,
} from '../binding.js'
import {COMPONENT_ID_REGEX} from './layout.js'
import {CurrencySchema} from '../enums.js'
import {IconNameSchema} from './slot.js'

// TextField — single-line or multiline text input.
// F-9 (closed): valueBinding uses StringBinding (not a plain value: string).
// The ADR code shape is authoritative; canvas-v0-ux.md's 'value: string' column
// is the UX-facing name — schema renders it as valueBinding: StringBinding.
export const TextFieldSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('TextField'),
    label: z.string().min(1).max(80),
    placeholder: z.string().max(80).optional(),
    valueBinding: StringBindingSchema,
    multiline: z.boolean().optional(),
    keyboardType: z.enum(['default', 'email-address', 'url']).optional(),
    maxLength: z.number().int().positive().max(2000).optional(),
    optional: z.boolean().optional(),
    accessibilityLabel: z.string().optional(),
  })
  .strict()
export type TextField = z.infer<typeof TextFieldSchema>

// NumberField — numeric input with optional min / max / step constraints.
// F-9 (closed): valueBinding uses NumberBinding.
export const NumberFieldSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('NumberField'),
    label: z.string().min(1).max(80),
    placeholder: z.string().max(80).optional(),
    valueBinding: NumberBindingSchema,
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().positive().optional(),
    optional: z.boolean().optional(),
    accessibilityLabel: z.string().optional(),
  })
  .strict()
export type NumberField = z.infer<typeof NumberFieldSchema>

// DateField — tappable date/time field backed by iOS DateTimePickerIOS.
// F-9 (closed): valueBinding uses DateBinding (ISO 8601 string at protocol level).
export const DateFieldSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('DateField'),
    label: z.string().min(1).max(80),
    valueBinding: DateBindingSchema,
    mode: z.enum(['date', 'time', 'datetime']).optional(),
    accessibilityLabel: z.string().optional(),
  })
  .strict()
export type DateField = z.infer<typeof DateFieldSchema>

// PickerOptionSchema — one option in a Picker's options list.
const PickerOptionSchema = z.object({
  value: z.string().min(1).max(80),
  label: z.string().min(1).max(80),
  icon: z.string().min(1).optional(), // icon name; placeholder until Step 9
})

// Picker — single-select dropdown backed by a Gorhom sheet.
// F-9 (closed): valueBinding uses StringBinding.
// options: max 12 (T-0005-136).
export const PickerSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('Picker'),
    label: z.string().min(1).max(80),
    valueBinding: StringBindingSchema,
    options: z.array(PickerOptionSchema).min(1).max(12),
    accessibilityLabel: z.string().optional(),
  })
  .strict()
export type Picker = z.infer<typeof PickerSchema>

// Switch — iOS-native toggle; full-width row with label + Switch component.
// F-9 (closed): valueBinding uses BooleanBinding.
export const SwitchSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('Switch'),
    label: z.string().min(1).max(80),
    valueBinding: BooleanBindingSchema,
    accessibilityLabel: z.string().optional(),
  })
  .strict()
export type Switch = z.infer<typeof SwitchSchema>

// ---------------------------------------------------------------------------
// V1 Phase 1 Step 2 — 6 new input components (ADR-0009 Step 2)
// ---------------------------------------------------------------------------

// MoneyField — currency-aware numeric input.
// valueBinding: NumberBinding — stored as INTEGER CENTS (renderer canonicalizes).
// USD/EUR/GBP/CAD/AUD/INR: 2 decimal places (100 cents per unit).
// JPY: 0 decimal places (1 cent per unit = whole yen).
// NOTE: CurrencySchema uses .optional() instead of .default('USD') because
// the z.ZodType<Node> annotation requires exact type inference compatibility
// (same pattern as CalloutSchema.variant — Roz PR 1 accepted deviation).
// Renderer applies default 'USD' via `node.currency ?? 'USD'`.
export const MoneyFieldSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('MoneyField'),
    label: z.string().min(1).max(80),
    valueBinding: NumberBindingSchema, // Stored as integer cents (renderer canonicalizes)
    currency: CurrencySchema.optional(), // defaults to 'USD' in renderer
    min: z.number().int().optional(), // cents
    max: z.number().int().optional(), // cents
    placeholder: z.string().max(80).optional(),
    optional: z.boolean().optional(),
    accessibilityLabel: z.string().optional(),
  })
  .strict()
export type MoneyField = z.infer<typeof MoneyFieldSchema>

// TimeField — native time picker; counterpart to DateField.
// valueBinding: StringBinding — stored as "HH:MM" 24h string at protocol level.
// Renderer formats per device locale (12h/24h decided by Intl.DateTimeFormat hourCycle).
// Reuses Gorhom sheet pattern from DateField.
export const TimeFieldSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('TimeField'),
    label: z.string().min(1).max(80),
    valueBinding: StringBindingSchema, // Stored as HH:MM 24h string
    mode: z.enum(['time', 'time-with-seconds']).optional(),
    min: z.string().max(5).optional(), // HH:MM format
    max: z.string().max(5).optional(), // HH:MM format
    accessibilityLabel: z.string().optional(),
  })
  .strict()
export type TimeField = z.infer<typeof TimeFieldSchema>

// MultiPickerOptionSchema — one option in a MultiPicker's options list.
// option.value regex /^[^,]+$/ enforces no commas — CSV storage would break.
const MultiPickerOptionSchema = z.object({
  value: z.string().min(1).max(80).regex(/^[^,]+$/, 'option value must not contain commas'),
  label: z.string().min(1).max(80),
  icon: IconNameSchema.optional(),
})

// MultiPicker — multi-select dropdown backed by a Gorhom sheet.
// valueBinding: StringBinding — stored as CSV string at protocol level.
// Renderer parses on read (split by comma, filter empty), joins on write.
// options: max 16 (bumped from Picker's 12 to support tag-style selections).
export const MultiPickerSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('MultiPicker'),
    label: z.string().min(1).max(80),
    valueBinding: StringBindingSchema, // CSV string
    options: z.array(MultiPickerOptionSchema).min(1).max(16),
    min: z.number().int().nonnegative().optional(),
    max: z.number().int().positive().optional(),
    placeholder: z.string().max(80).optional(),
    accessibilityLabel: z.string().optional(),
  })
  .strict()
export type MultiPicker = z.infer<typeof MultiPickerSchema>

// Slider — range input with optional step + value badge.
// valueBinding: NumberBinding.
// Reanimated 4 worklet for thumb drag + spring animation.
// Reduced-motion: scale animation disabled; value badge instant.
export const SliderSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('Slider'),
    label: z.string().min(1).max(80),
    valueBinding: NumberBindingSchema,
    min: z.number(),
    max: z.number(),
    step: z.number().positive().optional(), // defaults to 1 in renderer
    showValue: z.boolean().optional(), // defaults to true in renderer
    format: z.enum(['integer', 'decimal', 'percent']).optional(), // defaults to 'integer'
    accessibilityLabel: z.string().optional(),
  })
  .strict()
export type Slider = z.infer<typeof SliderSchema>

// RatingInput — star or scale rating.
// valueBinding: NumberBinding.
// glyph enum maps to Lucide icons: star→Star, heart→Heart, flame→Flame, circle→Circle.
// allowHalf: half-step values (3.5 stars) via split-glyph overlay clipping.
export const RatingInputSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('RatingInput'),
    label: z.string().min(1).max(80),
    valueBinding: NumberBindingSchema,
    scale: z.union([z.literal(5), z.literal(10)]).optional(), // defaults to 5
    glyph: z.enum(['star', 'heart', 'flame', 'circle']).optional(), // defaults to 'star'
    allowHalf: z.boolean().optional(),
    accessibilityLabel: z.string().optional(),
  })
  .strict()
export type RatingInput = z.infer<typeof RatingInputSchema>

// SearchBar — search input with clear button.
// valueBinding: StringBinding — the query string.
// boundCollectionId: when set, List/GridList for that collection subscribe and
// filter by substring match across string fields (renderer concern via SearchFilterContext).
// voiceMic: V0.5 placeholder — shows mic affordance, opens "coming soon" sheet.
export const SearchBarSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('SearchBar'),
    valueBinding: StringBindingSchema,
    placeholder: z.string().max(80).optional(),
    voiceMic: z.boolean().optional(),
    boundCollectionId: z.string().min(1).max(64).optional(),
    accessibilityLabel: z.string().optional(),
  })
  .strict()
export type SearchBar = z.infer<typeof SearchBarSchema>

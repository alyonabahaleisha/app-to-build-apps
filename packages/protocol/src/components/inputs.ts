import {z} from 'zod'
import {
  StringBindingSchema,
  NumberBindingSchema,
  BooleanBindingSchema,
  DateBindingSchema,
} from '../binding.js'
import {COMPONENT_ID_REGEX} from './layout.js'

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

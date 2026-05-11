import {z} from 'zod'

// Visual stance — determines density, type scale, motion, color register.
// Generator picks one per mini-app; locked at generation.
export const StanceSchema = z.enum(['productive', 'expressive'])
export type Stance = z.infer<typeof StanceSchema>

// Accent palette — 6 palettes × 2 stances = 12 visual registers.
// Generator picks one per mini-app biased by archetype + content.
export const PaletteSchema = z.enum([
  'focus',
  'health',
  'money',
  'social',
  'learn',
  'play',
])
export type Palette = z.infer<typeof PaletteSchema>

// Archetype — 4 V0 archetypes + 'unknown' reserved for forward compatibility.
// V0.5 widens via App Store update (concern E from prop-review).
export const ArchetypeSchema = z.enum([
  'ListCRUD',
  'Tracker',
  'Journal',
  'Calculator',
  'unknown',
])
export type Archetype = z.infer<typeof ArchetypeSchema>

// Tone — used by the toast action verb to tint feedback messages.
export const ToneSchema = z.enum(['success', 'warning', 'danger'])
export type Tone = z.infer<typeof ToneSchema>

// FieldType discriminants — closed enum for collection field types.
// No 'location', no 'json', no nested objects in V0.
export const FieldTypeDiscriminantSchema = z.enum([
  'string',
  'number',
  'boolean',
  'date',
  'image',
  'reference',
])
export type FieldTypeDiscriminant = z.infer<typeof FieldTypeDiscriminantSchema>

// SyncMode — local is device-only; cloud-private syncs to creator's namespace.
// cloud-shared is V0.5+ and must reject at schema level.
export const SyncModeSchema = z.enum(['local', 'cloud-private'])
export type SyncMode = z.infer<typeof SyncModeSchema>

// BindingKind — discriminant for the Binding<T> discriminated union (Step 2).
export const BindingKindSchema = z.enum(['literal', 'state', 'collectionField'])
export type BindingKind = z.infer<typeof BindingKindSchema>

// SlotKind — discriminant for ListItem leading/trailing polymorphic slot (Step 4).
export const SlotKindSchema = z.enum(['none', 'icon', 'avatar', 'badge'])
export type SlotKind = z.infer<typeof SlotKindSchema>

// NavPattern — internal navigation pattern picked per mini-app by the generator.
export const NavPatternSchema = z.enum(['none', 'stack', 'tabs', 'modal-overlay'])
export type NavPattern = z.infer<typeof NavPatternSchema>

// CurrencySchema — closed 7-value enum for V1 Phase 1 input components.
// Adding currencies is a closed-registry expansion requiring an App Store update
// (invariant 9). The 7 values are the highest-volume markets in pre-launch analytics.
// V1 Phase 1 Step 2 — ADR-0009 §I.
export const CurrencySchema = z.enum(['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'INR'])
export type Currency = z.infer<typeof CurrencySchema>

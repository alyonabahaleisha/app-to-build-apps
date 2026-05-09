import {z} from 'zod'
import {SyncModeSchema} from './enums.js'

// Field name and collection id share the same regex shape as SlotNameSchema:
// lowercase letter start, up to 63 alphanumeric or underscore characters.
// Defined as a constant for reference in tests and downstream consumers.
export const COLLECTION_FIELD_NAME_REGEX = /^[a-z][a-zA-Z0-9_]{0,63}$/
export const COLLECTION_ID_REGEX = /^[a-z][a-zA-Z0-9_]{0,63}$/

// FieldTypeSchema — full discriminated union on 'type'.
// Step 1's FieldTypeDiscriminantSchema is the flat enum for ID-only checks;
// this is the structural form that carries additional properties per type.
//
// 'reference' carries targetCollectionId so the cross-ref validator (Step 6)
// can resolve the referenced collection. Self-referential collections are
// allowed at schema level (MT-4 decision).
export const FieldTypeSchema = z.discriminatedUnion('type', [
  z.object({type: z.literal('string')}),
  z.object({type: z.literal('number')}),
  z.object({type: z.literal('boolean')}),
  z.object({type: z.literal('date')}),
  z.object({type: z.literal('image')}),
  z.object({
    type: z.literal('reference'),
    targetCollectionId: z.string().min(1).max(64),
  }),
])
export type FieldType = z.infer<typeof FieldTypeSchema>

// CollectionFieldSchema — a named, typed field within a collection.
// 'required' defaults to optional (Step 6 cross-ref validator enforces seed-data
// required-field presence; Zod schema enforces structural shape only).
export const CollectionFieldSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(COLLECTION_FIELD_NAME_REGEX),
  type: FieldTypeSchema,
  required: z.boolean().optional(),
})
export type CollectionField = z.infer<typeof CollectionFieldSchema>

// SeedRowSchema — a single seed-data row. Keys are field names (unvalidated
// at Zod parse; key-subset cross-ref validation is Step 6's responsibility).
// Values are the raw JSON-compatible primitives the LLM emits.
const SeedRowSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))

// CollectionSchema — a named, typed data collection with seed data.
// Bounds: 1–20 fields, 1–50 seed rows (brief §2.4 requires at least one row).
// SyncMode imported from enums.ts — not redefined here.
export const CollectionSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(64)
    .regex(COLLECTION_ID_REGEX),
  name: z.string().min(1).max(80),
  fields: z.array(CollectionFieldSchema).min(1).max(20),
  seedData: z.array(SeedRowSchema).min(1).max(50),
  syncMode: SyncModeSchema,
})
export type Collection = z.infer<typeof CollectionSchema>

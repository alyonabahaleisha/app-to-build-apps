import {z} from 'zod'

// SlotNameSchema — shared between Binding<state>.slot (Step 2) and
// Spec.initialState keys (Step 5). Closes NV-3 / MT-2: slot-name structure
// (length AND regex) is a shape constraint enforced at Zod parse, not deferred
// to the cross-ref validator. The regex requires a lowercase letter start,
// followed by up to 63 alphanumeric or underscore characters.
export const SlotNameSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-zA-Z0-9_]{0,63}$/)

// BindingValueSchema — values emitted to state slots by actions.
// Accepts either a literal (string|number|boolean) or a state-slot reference
// `{kind:'state', slot}`. The reducer resolves state references at dispatch
// time against the current slots map — letting addItem capture the live
// value of a TextField's bound slot instead of a hardcoded empty string.
export const BindingValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.object({kind: z.literal('state'), slot: SlotNameSchema}),
])
export type BindingValue = z.infer<typeof BindingValueSchema>

// StringBindingSchema — 3-branch discriminated union on 'kind'.
// literal: hardcoded string value
// state: reference to a named state slot
// collectionField: reference to a specific field within a specific collection
export const StringBindingSchema = z.discriminatedUnion('kind', [
  z.object({kind: z.literal('literal'), value: z.string()}),
  z.object({kind: z.literal('state'), slot: SlotNameSchema}),
  z.object({
    kind: z.literal('collectionField'),
    collectionId: z.string().min(1).max(64),
    field: z.string().min(1).max(64),
  }),
])
export type StringBinding = z.infer<typeof StringBindingSchema>

// NumberBindingSchema — same 3-branch shape; literal value is z.number().
export const NumberBindingSchema = z.discriminatedUnion('kind', [
  z.object({kind: z.literal('literal'), value: z.number()}),
  z.object({kind: z.literal('state'), slot: SlotNameSchema}),
  z.object({
    kind: z.literal('collectionField'),
    collectionId: z.string().min(1).max(64),
    field: z.string().min(1).max(64),
  }),
])
export type NumberBinding = z.infer<typeof NumberBindingSchema>

// BooleanBindingSchema — literal value is z.boolean().
export const BooleanBindingSchema = z.discriminatedUnion('kind', [
  z.object({kind: z.literal('literal'), value: z.boolean()}),
  z.object({kind: z.literal('state'), slot: SlotNameSchema}),
  z.object({
    kind: z.literal('collectionField'),
    collectionId: z.string().min(1).max(64),
    field: z.string().min(1).max(64),
  }),
])
export type BooleanBinding = z.infer<typeof BooleanBindingSchema>

// DateBindingSchema — literal value is z.string() (ISO 8601 date string).
// The date is a string at the protocol level; the renderer parses it.
export const DateBindingSchema = z.discriminatedUnion('kind', [
  z.object({kind: z.literal('literal'), value: z.string()}),
  z.object({kind: z.literal('state'), slot: SlotNameSchema}),
  z.object({
    kind: z.literal('collectionField'),
    collectionId: z.string().min(1).max(64),
    field: z.string().min(1).max(64),
  }),
])
export type DateBinding = z.infer<typeof DateBindingSchema>

// ImageBindingSchema — literal value is z.string() (URI / asset reference).
export const ImageBindingSchema = z.discriminatedUnion('kind', [
  z.object({kind: z.literal('literal'), value: z.string()}),
  z.object({kind: z.literal('state'), slot: SlotNameSchema}),
  z.object({
    kind: z.literal('collectionField'),
    collectionId: z.string().min(1).max(64),
    field: z.string().min(1).max(64),
  }),
])
export type ImageBinding = z.infer<typeof ImageBindingSchema>

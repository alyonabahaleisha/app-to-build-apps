import {z} from 'zod'
import {ToneSchema} from './enums.js'
import {BindingValueSchema} from './binding.js'

// ActionSchema — exactly 13 verbs. 'share' is cut (F-4 from prop-review;
// Share is host-meatball-only). All verb object schemas use .strict() so
// extra params are rejected as errors (T-0005-047 / Notes for Colby item 12).

// 1. set — write a BindingValue to a named state slot
const SetActionSchema = z
  .object({
    type: z.literal('set'),
    target: z.string().min(1),
    value: BindingValueSchema,
  })
  .strict()

// 2. update — patch named fields on a collection item, targeting it by collection
// and itemId. 'update' and 'updateItem' are separate, independent verbs in the
// discriminated union — they carry distinct 'type' literals and the renderer
// dispatcher routes them independently. There is no aliasing relationship between
// them; a renderer can receive either. ('updateItem' exists as the idiomatic
// collection-mutation verb; 'update' provides a more general patch surface for
// cases where the spec author prefers that framing.)
const UpdateActionSchema = z
  .object({
    type: z.literal('update'),
    collection: z.string().min(1),
    itemId: z.string().min(1),
    patch: z.record(z.string(), BindingValueSchema),
  })
  .strict()

// 3. reset — clear a state slot back to its initialState value
const ResetActionSchema = z
  .object({
    type: z.literal('reset'),
    target: z.string().min(1),
  })
  .strict()

// 4. addItem — append a new row to a collection
const AddItemActionSchema = z
  .object({
    type: z.literal('addItem'),
    collection: z.string().min(1),
    item: z.record(z.string(), BindingValueSchema),
  })
  .strict()

// 5. removeItem — delete a row from a collection by id
const RemoveItemActionSchema = z
  .object({
    type: z.literal('removeItem'),
    collection: z.string().min(1),
    itemId: z.string().min(1),
  })
  .strict()

// 6. updateItem — patch fields on a specific collection row
const UpdateItemActionSchema = z
  .object({
    type: z.literal('updateItem'),
    collection: z.string().min(1),
    itemId: z.string().min(1),
    patch: z.record(z.string(), BindingValueSchema),
  })
  .strict()

// 7. clearCollection — remove all rows from a collection; optional confirm dialog
const ClearCollectionActionSchema = z
  .object({
    type: z.literal('clearCollection'),
    collection: z.string().min(1),
    confirmText: z.string().optional(),
  })
  .strict()

// 8. navigate — push a screen onto the navigation stack
const NavigateActionSchema = z
  .object({
    type: z.literal('navigate'),
    target: z.string().min(1),
  })
  .strict()

// 9. back — pop the current screen; no params
const BackActionSchema = z
  .object({
    type: z.literal('back'),
  })
  .strict()

// 10. capture — open the camera/image-picker and write the result to a state slot
const CaptureActionSchema = z
  .object({
    type: z.literal('capture'),
    target: z.string().min(1),
  })
  .strict()

// 11. toast — show a brief feedback message; optional tone tint
const ToastActionSchema = z
  .object({
    type: z.literal('toast'),
    message: z.string().min(1),
    tone: ToneSchema.optional(),
  })
  .strict()

// 12. aiProcess — run an AI task on a collection and write the result to a slot.
// 'task' is a z.literal('summarize') — exactly one allowed value in V0.
// Additional tasks (translate, etc.) gate an App Store update and an ADR bump.
const AiProcessActionSchema = z
  .object({
    type: z.literal('aiProcess'),
    task: z.literal('summarize'),
    collection: z.string().min(1),
    prompt: z.string().min(1),
    target: z.string().min(1),
  })
  .strict()

// 13. increment — add a numeric delta to a state slot.
// Reads slot's current value (0 if absent or non-numeric), adds `by` (may be
// negative — that's how decrement works), writes the new number back. Optional
// min/max clamp at the reducer so the model doesn't have to express bounds via
// guard actions. Pure reducer op; no middleware involvement.
const IncrementActionSchema = z
  .object({
    type: z.literal('increment'),
    target: z.string().min(1),
    by: z.number(),
    min: z.number().optional(),
    max: z.number().optional(),
  })
  .strict()

// ActionSchema — discriminated union of the 13 verbs above.
// 'share' is deliberately absent (F-4 cut). T-0005-039 and T-0005-040 guard this.
export const ActionSchema = z.discriminatedUnion('type', [
  SetActionSchema,
  UpdateActionSchema,
  ResetActionSchema,
  AddItemActionSchema,
  RemoveItemActionSchema,
  UpdateItemActionSchema,
  ClearCollectionActionSchema,
  NavigateActionSchema,
  BackActionSchema,
  CaptureActionSchema,
  ToastActionSchema,
  AiProcessActionSchema,
  IncrementActionSchema,
])

export type Action = z.infer<typeof ActionSchema>

// Verb count constant — used by T-0005-040 cardinality assertion.
export const ACTION_VERB_COUNT = 13

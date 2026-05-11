import {z} from 'zod'
import {COMPONENT_ID_REGEX} from './layout.js'
import {ActionSchema} from '../actions.js'
import {BooleanBindingSchema} from '../binding.js'
import {IconNameSchema} from './slot.js'

// Button — primary interaction component.
//
// F-2 (closed): NO 'loading' prop. Loading is a runtime-only state owned by the
// renderer, not a schema-declared prop. T-0005-126 asserts that parsing a Button
// with { loading: true } fails (caught by .strict()). T-0005-127 asserts that
// { disabled: {kind: 'literal', value: true} } succeeds — disabled is a
// BooleanBinding, not a plain boolean (T-0005-128 asserts the plain-boolean path fails).
export const ButtonSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('Button'),
    label: z.string().min(1).max(80),
    variant: z.enum(['primary', 'secondary', 'destructive', 'text']).optional(),
    size: z.enum(['sm', 'md', 'lg']).optional(),
    icon: IconNameSchema.optional(),
    iconPosition: z.enum(['leading', 'trailing']).optional(),
    action: ActionSchema,
    // disabled is a BooleanBinding — not a plain boolean.
    // This allows the disabled state to be driven by a state slot or collection
    // field (e.g., disable Submit while a form field is empty). F-2 closure.
    disabled: BooleanBindingSchema.optional(),
    fullWidth: z.boolean().optional(),
    accessibilityLabel: z.string().optional(),
  })
  .strict()
export type Button = z.infer<typeof ButtonSchema>

// ---------------------------------------------------------------------------
// IconButton — icon-only button (V1 Phase 1, Step 1)
//
// `accessibilityLabel` is REQUIRED (min 1 char) — icon alone is not labeled.
// Schema rejects missing or empty accessibilityLabel.
// ---------------------------------------------------------------------------
export const IconButtonSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('IconButton'),
    icon: IconNameSchema,
    action: ActionSchema,
    variant: z.enum(['primary', 'secondary', 'ghost', 'destructive']).optional(),
    size: z.enum(['sm', 'md', 'lg']).optional(),
    accessibilityLabel: z.string().min(1).max(80), // REQUIRED — icon alone is not labeled
    disabled: BooleanBindingSchema.optional(),
  })
  .strict()
export type IconButton = z.infer<typeof IconButtonSchema>

// FAB — floating action button.
// icon is required (no text label; screen readers need an explicit
// accessibilityLabel — no default). accessibilityLabel is required.
export const FabSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('FAB'),
    icon: IconNameSchema,
    action: ActionSchema,
    accessibilityLabel: z.string().min(1),
  })
  .strict()
export type Fab = z.infer<typeof FabSchema>

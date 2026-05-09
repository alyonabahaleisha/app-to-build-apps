import {z} from 'zod'
import {SpaceTokenSchema} from '../tokens.js'
import {COLLECTION_ID_REGEX} from '../collection.js'

// Component id regex — same as collection id and field name:
// lowercase letter start, up to 63 alphanumeric or underscore characters.
// Imported indirectly here from collection.ts to avoid redefining it (Notes for
// Colby item: "Reuse — don't redeclare.").
const COMPONENT_ID_REGEX = COLLECTION_ID_REGEX

// AlignSchema — horizontal alignment; shared across layout components.
const AlignSchema = z.enum(['start', 'center', 'end', 'stretch'])

// Screen — top-level wrapper. One per screen; not nestable.
// children is typed as z.lazy() → ComponentNodeSchema once Step 5 wires the
// full recursive union. For Step 4, we accept z.array(z.unknown()) to unblock
// compilation; Step 5 replaces this with the NodeSchema discriminated union.
export const ScreenSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('Screen'),
    padding: SpaceTokenSchema.optional(),
    safeArea: z.enum(['top', 'bottom', 'both', 'none']).optional(),
    children: z.array(z.unknown()),
    accessibilityLabel: z.string().optional(),
  })
  .strict()
export type Screen = z.infer<typeof ScreenSchema>

// Section — vertical content group with optional title.
export const SectionSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('Section'),
    title: z.string().max(80).optional(),
    caption: z.string().max(160).optional(),
    padding: SpaceTokenSchema.optional(),
    children: z.array(z.unknown()),
    accessibilityLabel: z.string().optional(),
  })
  .strict()
export type Section = z.infer<typeof SectionSchema>

// Stack — vertical flex container.
export const StackSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('Stack'),
    gap: SpaceTokenSchema.optional(),
    align: z.enum(['start', 'center', 'end', 'stretch']).optional(),
    children: z.array(z.unknown()),
    accessibilityLabel: z.string().optional(),
  })
  .strict()
export type Stack = z.infer<typeof StackSchema>

// Row — horizontal flex container.
export const RowSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('Row'),
    gap: SpaceTokenSchema.optional(),
    align: z.enum(['start', 'center', 'end']).optional(),
    justify: z.enum(['start', 'center', 'end', 'space-between', 'space-around']).optional(),
    wrap: z.boolean().optional(),
    children: z.array(z.unknown()),
    accessibilityLabel: z.string().optional(),
  })
  .strict()
export type Row = z.infer<typeof RowSchema>

// Card — visual container with elevation and padding.
export const CardSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('Card'),
    elevation: z.enum(['flat', 'raised', 'floating']).optional(),
    padding: SpaceTokenSchema.optional(),
    radius: z.enum(['radius-none', 'radius-sm', 'radius-md', 'radius-lg', 'radius-full']).optional(),
    children: z.array(z.unknown()),
    accessibilityLabel: z.string().optional(),
  })
  .strict()
export type Card = z.infer<typeof CardSchema>

// Re-export for components/index.ts convenience
export {AlignSchema, COMPONENT_ID_REGEX}

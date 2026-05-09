import {z} from 'zod'
import {COMPONENT_ID_REGEX} from './layout.js'

// Body color token subset — the colors Body and Caption can use.
// Does not include the full ColorToken set; only the named semantic options
// from canvas-v0-ux.md §Component Specs > Body.
const BodyColorSchema = z.enum(['fg', 'fg-muted', 'fg-faint', 'success', 'warning', 'danger', 'accent'])

// Heading — display text at 3 levels (h1=display, h2=h1, h3=h2 in type scale).
export const HeadingSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('Heading'),
    text: z.string().min(1).max(200),
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
    align: z.enum(['start', 'center', 'end']).optional(),
    accessibilityLabel: z.string().optional(),
  })
  .strict()
export type Heading = z.infer<typeof HeadingSchema>

// Body — paragraph text. Resolves to type-body (16pt).
export const BodySchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('Body'),
    text: z.string().min(1).max(2000),
    weight: z.enum(['regular', 'strong']).optional(),
    color: BodyColorSchema.optional(),
    align: z.enum(['start', 'center', 'end']).optional(),
    accessibilityLabel: z.string().optional(),
  })
  .strict()
export type Body = z.infer<typeof BodySchema>

// Caption — same shape as Body but resolves to type-caption (13pt).
// Color default is 'fg-muted' per canvas-v0-ux.md.
export const CaptionSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('Caption'),
    text: z.string().min(1).max(2000),
    weight: z.enum(['regular', 'strong']).optional(),
    color: BodyColorSchema.optional(),
    align: z.enum(['start', 'center', 'end']).optional(),
    accessibilityLabel: z.string().optional(),
  })
  .strict()
export type Caption = z.infer<typeof CaptionSchema>

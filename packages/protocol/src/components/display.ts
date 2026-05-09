import {z} from 'zod'
import {COMPONENT_ID_REGEX} from './layout.js'
import {ActionSchema} from '../actions.js'
import {IconNameSchema} from './slot.js'

// Stat — big-number display with optional delta.
export const StatSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('Stat'),
    value: z.string().min(1).max(80),
    label: z.string().min(1).max(80),
    delta: z.string().max(40).optional(),
    deltaTone: z.enum(['positive', 'negative', 'neutral']).optional(),
    align: z.enum(['start', 'center']).optional(),
    accessibilityLabel: z.string().optional(),
  })
  .strict()
export type Stat = z.infer<typeof StatSchema>

// Badge — small status pill; tone-tinted.
export const BadgeSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('Badge'),
    text: z.string().min(1).max(80),
    tone: z.enum(['neutral', 'accent', 'success', 'warning', 'danger']).optional(),
    accessibilityLabel: z.string().optional(),
  })
  .strict()
export type Badge = z.infer<typeof BadgeSchema>

// Chip — tappable filter / selection chip; optional leading icon.
export const ChipSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('Chip'),
    text: z.string().min(1).max(80),
    selected: z.boolean().optional(),
    icon: IconNameSchema.optional(),
    action: ActionSchema.optional(),
    accessibilityLabel: z.string().optional(),
  })
  .strict()
export type Chip = z.infer<typeof ChipSchema>

// Avatar — circular image or initials fallback.
// Size: sm=24pt, md=32pt, lg=48pt per canvas-v0-ux.md.
export const AvatarSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('Avatar'),
    name: z.string().min(1).max(80),
    imageUrl: z.string().optional(),
    size: z.enum(['sm', 'md', 'lg']).optional(),
    accessibilityLabel: z.string().optional(),
  })
  .strict()
export type Avatar = z.infer<typeof AvatarSchema>

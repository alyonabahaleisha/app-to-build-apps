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

// ---------------------------------------------------------------------------
// V1 Phase 1 Step 3 — Display tier additions
// ---------------------------------------------------------------------------

// AvatarGroup — stacked avatar row for "N people" affordances.
// avatars: max 5; maxShown: how many to display before "+N" overflow.
// Per canvas-v1-catalog-expansion-phase1-ux.md §AvatarGroup.
const AvatarEntrySchema = z
  .object({
    name: z.string().min(1).max(80),
    imageUrl: z.string().optional(),
  })
  .strict()

export const AvatarGroupSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('AvatarGroup'),
    avatars: z.array(AvatarEntrySchema).min(1).max(5),
    maxShown: z.number().int().min(1).max(5).optional(),
    size: z.enum(['sm', 'md', 'lg']).optional(),
    overlap: z.enum(['tight', 'spread']).optional(),
    accessibilityLabel: z.string().optional(),
  })
  .strict()
export type AvatarGroup = z.infer<typeof AvatarGroupSchema>

// Callout — highlighted info block for tips, warnings, success confirmations.
// 5 closed variants; action is an optional CTA.
// Per canvas-v1-catalog-expansion-phase1-ux.md §Callout.
export const CalloutSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('Callout'),
    variant: z.enum(['info', 'success', 'warning', 'tip', 'danger']).optional(),
    headline: z.string().min(1).max(200),
    body: z.string().max(400).optional(),
    icon: IconNameSchema.optional(),
    action: z
      .object({
        label: z.string().min(1).max(40),
        action: ActionSchema,
      })
      .optional(),
    accessibilityLabel: z.string().optional(),
  })
  .strict()
export type Callout = z.infer<typeof CalloutSchema>

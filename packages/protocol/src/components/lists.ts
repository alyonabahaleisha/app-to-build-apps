import {z} from 'zod'
import {COMPONENT_ID_REGEX} from './layout.js'
import {ActionSchema} from '../actions.js'
import {SlotSchema} from './slot.js'
import {IconNameSchema} from '../icons/names.js'

// List — FlashList-backed container for ListItem children.
// emptyState and loadingState are node references (child nodes).
// Step 5 will constrain the type more precisely via NodeSchema; for Step 4
// we accept z.unknown() to keep layout/lists independent of the full Node union.
export const ListSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('List'),
    collectionId: z.string().min(1).max(64),
    itemLayout: z.enum(['compact', 'standard', 'expanded']).optional(),
    emptyState: z.unknown().optional(),
    loadingState: z.unknown().optional(),
    accessibilityLabel: z.string().optional(),
  })
  .strict()
export type List = z.infer<typeof ListSchema>

// ListItem — single row within a List.
// leading and trailing use SlotSchema (F-3 closure): discriminated union on
// 'kind': 'none' | 'icon' | 'avatar' | 'badge'. The renderer reads .kind
// and dispatches to the appropriate render path.
export const ListItemSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('ListItem'),
    title: z.string().min(1).max(200),
    subtitle: z.string().max(200).optional(),
    leading: SlotSchema.optional(),
    trailing: SlotSchema.optional(),
    tapAction: ActionSchema.optional(),
    accessibilityLabel: z.string().optional(),
  })
  .strict()
export type ListItem = z.infer<typeof ListItemSchema>

// SwipeableListItemActionColor — leading and trailing swipe actions have
// different allowed color sets per canvas-v0-ux.md §SwipeableRow.
const LeadingActionColorSchema = z.enum(['success', 'warning', 'accent'])
const TrailingActionColorSchema = z.enum(['danger', 'warning'])

// SwipeableRow — ListItem extended with leading and trailing swipe actions.
// All ListItem props are present plus the swipe-action props below.
export const SwipeableRowSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('SwipeableRow'),
    // ListItem core props
    title: z.string().min(1).max(200),
    subtitle: z.string().max(200).optional(),
    leading: SlotSchema.optional(),
    trailing: SlotSchema.optional(),
    tapAction: ActionSchema.optional(),
    // Swipe action props
    leadingAction: ActionSchema.optional(),
    leadingActionIcon: IconNameSchema.optional(),
    leadingActionColor: LeadingActionColorSchema.optional(),
    trailingAction: ActionSchema.optional(),
    trailingActionIcon: IconNameSchema.optional(),
    trailingActionColor: TrailingActionColorSchema.optional(),
    accessibilityLabel: z.string().optional(),
  })
  .strict()
export type SwipeableRow = z.infer<typeof SwipeableRowSchema>

// EmptyState — centered empty state with icon, headline, optional action.
export const EmptyStateSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('EmptyState'),
    icon: IconNameSchema,
    headline: z.string().min(1).max(200),
    body: z.string().max(400).optional(),
    actionLabel: z.string().max(80).optional(),
    action: ActionSchema.optional(),
    accessibilityLabel: z.string().optional(),
  })
  .strict()
export type EmptyState = z.infer<typeof EmptyStateSchema>

// LoadingState — skeleton rows mimicking ListItem shape.
// lines defaults to 3 per canvas-v0-ux.md.
export const LoadingStateSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('LoadingState'),
    lines: z.number().int().positive().max(20).optional(),
    accessibilityLabel: z.string().optional(),
  })
  .strict()
export type LoadingState = z.infer<typeof LoadingStateSchema>

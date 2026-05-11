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

// ---------------------------------------------------------------------------
// V1 Phase 1 Step 4 — Lists & Data tier expansion
// ---------------------------------------------------------------------------

// GridList — N-column FlashList masonry grid.
// columns is a hint; renderer collapses to 2 on narrow widths (< 380pt).
// emptyState and loadingState accept z.unknown() here (tightened to NodeSchema
// via z.lazy in spec.zod.ts for the recursive node union).
// NOTE: columns and itemAspectRatio use .optional() (not .default()) to avoid
// the ZodEffects _input/_output mismatch that breaks ZodType<Node>. Renderer
// applies defaults: columns → 2, itemAspectRatio → '1:1'.
export const GridListSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('GridList'),
    collectionId: z.string().min(1).max(64),
    columns: z.union([z.literal(2), z.literal(3)]).optional(),
    gap: z.enum(['space-none', 'space-xs', 'space-sm', 'space-md', 'space-lg', 'space-xl']).optional(),
    itemAspectRatio: z.enum(['1:1', '4:5', '3:4']).optional(),
    emptyState: z.unknown().optional(),
    loadingState: z.unknown().optional(),
    accessibilityLabel: z.string().optional(),
  })
  .strict()
export type GridList = z.infer<typeof GridListSchema>

// CarouselBaseSchema — the raw ZodObject shape for CarouselSchema.
// This is the schema used in the discriminated union (ZodEffects cannot participate
// in z.discriminatedUnion — it requires ZodObject with .shape). The exported
// CarouselSchema wraps this with superRefine for validation consumers.
// NOTE: indicator, cardWidth, autoplay use .optional() (not .default()) to avoid
// ZodEffects _input/_output mismatch. Renderer applies defaults: indicator → 'dots',
// cardWidth → 'snap', autoplay → false.
export const CarouselBaseSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('Carousel'),
    collectionId: z.string().min(1).max(64).optional(),
    cards: z.array(z.unknown()).max(10).optional(),
    indicator: z.enum(['dots', 'fraction', 'none']).optional(),
    cardWidth: z.enum(['snap', 'peek', 'full']).optional(),
    autoplay: z.boolean().optional(),
    accessibilityLabel: z.string().optional(),
  })
  .strict()

// CarouselSchema — full validated schema with mutually-exclusive collectionId XOR cards.
// Wraps CarouselBaseSchema with superRefine. Use this for parsing; use CarouselBaseSchema
// in discriminated unions (ZodEffects is incompatible with z.discriminatedUnion).
// autoplay accessibility: renderer disables autoplay when useReducedMotion() returns true.
export const CarouselSchema = CarouselBaseSchema.superRefine((data, ctx) => {
  const hasCollection = data.collectionId !== undefined
  const hasCards = data.cards !== undefined && data.cards.length > 0
  if (hasCollection === hasCards) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Carousel requires exactly one of collectionId or cards (not both, not neither)',
    })
  }
})
export type Carousel = z.infer<typeof CarouselSchema>

// TimelineSchema — vertical sequential events with left-rail date indicators.
// dateField references a field of type 'date' on the named collection.
// Cross-ref validation that dateField exists on the collection is Step 8's job.
// groupBy is a render-time aggregation; no spec-level impact.
// NOTE: dateFormat and groupBy use .optional() (not .default()) to avoid
// ZodEffects _input/_output mismatch. Renderer applies defaults: dateFormat → 'relative',
// groupBy → 'none'.
export const TimelineSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('Timeline'),
    collectionId: z.string().min(1).max(64),
    dateField: z.string().min(1).max(64),
    dateFormat: z.enum(['relative', 'absolute', 'short']).optional(),
    groupBy: z.enum(['none', 'day', 'week', 'month']).optional(),
    accessibilityLabel: z.string().optional(),
  })
  .strict()
export type Timeline = z.infer<typeof TimelineSchema>

// ErrorStateSchema — friendly error display with optional retry CTA.
// Structural twin of EmptyState; separate type for LLM clarity (per Sable).
// Default icon is 'alert-triangle'; accessibilityRole="alert" in renderer.
// NOTE: icon uses .optional() (not .default()) to avoid ZodEffects _input/_output
// mismatch. Renderer applies default: icon → 'alert-triangle'.
export const ErrorStateSchema = z
  .object({
    id: z.string().regex(COMPONENT_ID_REGEX),
    type: z.literal('ErrorState'),
    icon: IconNameSchema.optional(),
    headline: z.string().min(1).max(200),
    body: z.string().max(400).optional(),
    actionLabel: z.string().max(80).optional(),
    action: ActionSchema.optional(),
    accessibilityLabel: z.string().optional(),
  })
  .strict()
export type ErrorState = z.infer<typeof ErrorStateSchema>

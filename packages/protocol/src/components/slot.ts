import {z} from 'zod'

// IconNameSchema — closed 80-value enum of semantic icon names.
// Lives in packages/protocol/src/icons/names.ts (Step 9).
// Protocol owns the names + paths (no workspace deps); design-system owns the
// RN render component (imports IconName from protocol).
export {IconNameSchema} from '../icons/names.js'
import {IconNameSchema} from '../icons/names.js'

// AvatarNodeSchema — inline schema for Avatar nodes used inside SlotSchema.
// Kept minimal here to break the circular dependency that would arise from
// importing the full AvatarSchema (which itself depends on SlotSchema indirectly
// via the Node union in Step 5). The SlotSchema avatar branch only needs the
// Avatar's structural identity — same field shapes as AvatarSchema in display.ts.
const SlotAvatarNodeSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-zA-Z0-9_]{0,63}$/),
    type: z.literal('Avatar'),
    name: z.string().min(1).max(80),
    imageUrl: z.string().optional(),
    size: z.enum(['sm', 'md', 'lg']).optional(),
    accessibilityLabel: z.string().optional(),
  })
  .strict()

// BadgeNodeSchema — inline schema for Badge nodes used inside SlotSchema.
// Same rationale as SlotAvatarNodeSchema — breaks circular dependency risk.
const SlotBadgeNodeSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-zA-Z0-9_]{0,63}$/),
    type: z.literal('Badge'),
    text: z.string().min(1).max(80),
    tone: z.enum(['neutral', 'accent', 'success', 'warning', 'danger']).optional(),
    accessibilityLabel: z.string().optional(),
  })
  .strict()

// SlotSchema — 4-branch discriminated union on 'kind'.
// Used by ListItem.leading, ListItem.trailing, SwipeableRow.leading,
// SwipeableRow.trailing. The renderer reads .kind and dispatches to the
// appropriate render path (F-3 closure from prop-review).
//
// Branches:
//   none   — empty slot; no leading/trailing element
//   icon   — a named icon from the 80-icon catalog (closed enum, Step 9)
//   avatar — an Avatar component node
//   badge  — a Badge component node
export const SlotSchema = z.discriminatedUnion('kind', [
  z.object({kind: z.literal('none')}),
  z.object({kind: z.literal('icon'), name: IconNameSchema}),
  z.object({kind: z.literal('avatar'), node: SlotAvatarNodeSchema}),
  z.object({kind: z.literal('badge'), node: SlotBadgeNodeSchema}),
])
export type Slot = z.infer<typeof SlotSchema>

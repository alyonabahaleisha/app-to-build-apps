/**
 * spec.zod.ts — Top-level Spec + SpecScreen + recursive Node
 *
 * Section order per ADR-0005 §B:
 *   1. Node type alias (manual, for z.ZodType<Node> — resolves F-7)
 *   2. NodeSchema (z.lazy discriminated union over all 28 components)
 *   3. SpecScreenSchema (top-level screen wrapper — renamed from ScreenSchema to
 *      avoid collision with the layout-component ScreenSchema in components/layout.ts)
 *   4. SpecSchema (top-level spec with .superRefine for initialScreenId cross-ref)
 *
 * Circular import note: components/layout.ts and components/compound.ts import
 * NodeSchema from this file via z.lazy(() => ...) for their children fields.
 * This is the standard Zod recursive pattern: z.lazy defers reference resolution
 * to first parse time, by which point all ES modules are fully initialized.
 * TypeScript tracks the recursive Node type via the explicit type alias below,
 * not via z.infer<typeof NodeSchema>.
 */
import {z} from 'zod'

import {
  // Layout tier (5)
  ScreenSchema,
  SectionSchema,
  StackSchema,
  RowSchema,
  CardSchema,
  // Typography tier (3)
  HeadingSchema,
  BodySchema,
  CaptionSchema,
  // Inputs tier (5)
  TextFieldSchema,
  NumberFieldSchema,
  DateFieldSchema,
  PickerSchema,
  SwitchSchema,
  // Display tier (4)
  StatSchema,
  BadgeSchema,
  ChipSchema,
  AvatarSchema,
  // Lists tier (5)
  ListSchema,
  ListItemSchema,
  SwipeableRowSchema,
  EmptyStateSchema,
  LoadingStateSchema,
  // Compound tier (4)
  ConditionalSectionSchema,
  ListSummarySchema,
  MediaTraySchema,
  ImagePickerSchema,
  // Actions tier (2)
  ButtonSchema,
  FabSchema,
} from './components/index.js'

import {ArchetypeSchema, StanceSchema, PaletteSchema, NavPatternSchema} from './enums.js'
import {CollectionSchema} from './collection.js'
import {SlotNameSchema, BindingValueSchema} from './binding.js'
import {IconNameSchema} from './components/slot.js'
import {COLLECTION_ID_REGEX} from './collection.js'
import {canonicalize} from './canonical.js'

// ---------------------------------------------------------------------------
// § Node type alias (resolves F-7)
//
// Declared manually because z.infer cannot resolve recursive references.
// The type mirrors the component schemas' inferred shapes but replaces
// `z.array(z.unknown())` children with `Node[]` for the container components.
// Keep this in sync with the NodeSchema discriminated union below.
// ---------------------------------------------------------------------------
export type Node =
  // Layout tier
  | {
      id: string
      type: 'Screen'
      padding?: string
      safeArea?: 'top' | 'bottom' | 'both' | 'none'
      children: Node[]
      accessibilityLabel?: string
    }
  | {
      id: string
      type: 'Section'
      title?: string
      caption?: string
      padding?: string
      children: Node[]
      accessibilityLabel?: string
    }
  | {
      id: string
      type: 'Stack'
      gap?: string
      align?: 'start' | 'center' | 'end' | 'stretch'
      children: Node[]
      accessibilityLabel?: string
    }
  | {
      id: string
      type: 'Row'
      gap?: string
      align?: 'start' | 'center' | 'end'
      justify?: 'start' | 'center' | 'end' | 'space-between' | 'space-around'
      wrap?: boolean
      children: Node[]
      accessibilityLabel?: string
    }
  | {
      id: string
      type: 'Card'
      elevation?: 'flat' | 'raised' | 'floating'
      padding?: string
      radius?: 'radius-none' | 'radius-sm' | 'radius-md' | 'radius-lg' | 'radius-full'
      children: Node[]
      accessibilityLabel?: string
    }
  // Typography tier
  | z.infer<typeof HeadingSchema>
  | z.infer<typeof BodySchema>
  | z.infer<typeof CaptionSchema>
  // Inputs tier
  | z.infer<typeof TextFieldSchema>
  | z.infer<typeof NumberFieldSchema>
  | z.infer<typeof DateFieldSchema>
  | z.infer<typeof PickerSchema>
  | z.infer<typeof SwitchSchema>
  // Display tier
  | z.infer<typeof StatSchema>
  | z.infer<typeof BadgeSchema>
  | z.infer<typeof ChipSchema>
  | z.infer<typeof AvatarSchema>
  // Lists tier
  | z.infer<typeof ListSchema>
  | z.infer<typeof ListItemSchema>
  | z.infer<typeof SwipeableRowSchema>
  | z.infer<typeof EmptyStateSchema>
  | z.infer<typeof LoadingStateSchema>
  // Compound tier — ConditionalSection has children: Node[]
  | {
      id: string
      type: 'ConditionalSection'
      collectionId: string
      showWhen: 'whenEmpty' | 'whenNotEmpty'
      children: Node[]
      accessibilityLabel?: string
    }
  | z.infer<typeof ListSummarySchema>
  | z.infer<typeof MediaTraySchema>
  | z.infer<typeof ImagePickerSchema>
  // Actions tier
  | z.infer<typeof ButtonSchema>
  | z.infer<typeof FabSchema>

// ---------------------------------------------------------------------------
// § NodeSchema — recursive discriminated union via z.lazy (resolves F-7)
//
// z.ZodType<Node> annotation is required because z.infer cannot resolve
// recursive type references. The z.lazy defers the discriminatedUnion
// construction to first parse call, by which point all module imports
// (including the circular component imports below) are resolved.
// ---------------------------------------------------------------------------
export const NodeSchema: z.ZodType<Node> = z.lazy(() =>
  z.discriminatedUnion('type', [
    // Layout tier — children upgraded to z.array(NodeSchema)
    ScreenSchema.extend({children: z.array(NodeSchema)}),
    SectionSchema.extend({children: z.array(NodeSchema)}),
    StackSchema.extend({children: z.array(NodeSchema)}),
    RowSchema.extend({children: z.array(NodeSchema)}),
    CardSchema.extend({children: z.array(NodeSchema)}),
    // Typography tier
    HeadingSchema,
    BodySchema,
    CaptionSchema,
    // Inputs tier
    TextFieldSchema,
    NumberFieldSchema,
    DateFieldSchema,
    PickerSchema,
    SwitchSchema,
    // Display tier
    StatSchema,
    BadgeSchema,
    ChipSchema,
    AvatarSchema,
    // Lists tier
    ListSchema,
    ListItemSchema,
    SwipeableRowSchema,
    EmptyStateSchema,
    LoadingStateSchema,
    // Compound tier — ConditionalSection children upgraded
    ConditionalSectionSchema.extend({children: z.array(NodeSchema)}),
    ListSummarySchema,
    MediaTraySchema,
    ImagePickerSchema,
    // Actions tier
    ButtonSchema,
    FabSchema,
  ]),
)

// ---------------------------------------------------------------------------
// § SpecScreenSchema — top-level screen wrapper
//
// Named SpecScreenSchema (not ScreenSchema) to avoid collision with the layout
// component's ScreenSchema in components/layout.ts. The layout ScreenSchema
// represents a Screen node in the node tree; this represents a screen entry in
// Spec.screens with its id, optional title, and root node.
// ---------------------------------------------------------------------------
export const SpecScreenSchema = z
  .object({
    id: z.string().regex(COLLECTION_ID_REGEX).max(64),
    title: z.string().max(40).optional(),
    root: NodeSchema,
  })
  .strict()

export type SpecScreen = z.infer<typeof SpecScreenSchema>

// ---------------------------------------------------------------------------
// § SpecSchema — top-level spec
//
// coverIcon: closed 80-value IconNameSchema from Step 9 icon catalog.
// Rejects any name not in the canonical set — LLM must pick from the catalog.
//
// initialState keys use SlotNameSchema (NV-3 / MT-2 closure): slot-name
// structure is a shape constraint enforced at Zod parse, not deferred to
// the cross-ref validator. Same regex/length as Binding<state>.slot.
//
// .superRefine checks initialScreenId ∈ screens. All other cross-refs
// (collection references, nesting depth, nav conformance, etc.) are Step 6's job.
// ---------------------------------------------------------------------------
export const SpecSchema = z
  .object({
    version: z.literal(1),
    archetype: ArchetypeSchema,
    stance: StanceSchema,
    palette: PaletteSchema,
    // Closed 80-value enum from the icon catalog (Step 9). Rejects any name not in
    // the canonical set — LLM must pick from the catalog.
    coverIcon: IconNameSchema,
    navigation: NavPatternSchema,
    screens: z.array(SpecScreenSchema).min(1).max(4),
    initialScreenId: z.string(),
    collections: z.array(CollectionSchema).max(8),
    // NV-3 / MT-2: SlotNameSchema enforces key structure at parse time.
    // BindingValueSchema is string | number | boolean (not the full Binding<T>).
    initialState: z.record(SlotNameSchema, BindingValueSchema).optional(),
  })
  .strict()
  .superRefine((spec, ctx) => {
    const screenIds = new Set(spec.screens.map(s => s.id))
    if (!screenIds.has(spec.initialScreenId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'initialScreenId not in screens',
        path: ['initialScreenId'],
      })
    }
  })

export type Spec = z.infer<typeof SpecSchema>

// Re-export canonicalize for downstream consumers who import from spec.zod directly.
export {canonicalize}

import {z} from 'zod'

// Layout tier (5 → 6 with Divider)
export {ScreenSchema, SectionSchema, StackSchema, RowSchema, CardSchema, DividerSchema} from './layout.js'
export type {Screen, Section, Stack, Row, Card, Divider} from './layout.js'

// Typography tier (3)
export {HeadingSchema, BodySchema, CaptionSchema} from './typography.js'
export type {Heading, Body, Caption} from './typography.js'

// Inputs tier (5 → 11 with V1 Phase 1 Step 2 additions)
export {
  TextFieldSchema,
  NumberFieldSchema,
  DateFieldSchema,
  PickerSchema,
  SwitchSchema,
  // V1 Phase 1 Step 2
  MoneyFieldSchema,
  TimeFieldSchema,
  MultiPickerSchema,
  SliderSchema,
  RatingInputSchema,
  SearchBarSchema,
} from './inputs.js'
export type {
  TextField,
  NumberField,
  DateField,
  Picker,
  Switch,
  // V1 Phase 1 Step 2
  MoneyField,
  TimeField,
  MultiPicker,
  Slider,
  RatingInput,
  SearchBar,
} from './inputs.js'

// Display tier (4 → 6 with AvatarGroup + Callout)
export {StatSchema, BadgeSchema, ChipSchema, AvatarSchema, AvatarGroupSchema, CalloutSchema} from './display.js'
export type {Stat, Badge, Chip, Avatar, AvatarGroup, Callout} from './display.js'

// Lists tier (5 → 9 with V1 Phase 1 Step 4)
export {
  ListSchema,
  ListItemSchema,
  SwipeableRowSchema,
  EmptyStateSchema,
  LoadingStateSchema,
  // V1 Phase 1 Step 4 — Lists & Data tier expansion
  GridListSchema,
  CarouselBaseSchema,
  CarouselSchema,
  TimelineSchema,
  ErrorStateSchema,
} from './lists.js'
export type {List, ListItem, SwipeableRow, EmptyState, LoadingState, GridList, Carousel, Timeline, ErrorState} from './lists.js'

// Compound tier (4 → 5 with Image → 9 with V1 Phase 1 Step 5 → 11 with V1 Phase 1 Step 6 → 15 with Step 7)
export {
  ConditionalSectionSchema,
  ListSummarySchema,
  MediaTraySchema,
  ImagePickerSchema,
  ImageSchema,
  // V1 Phase 1 Step 5 — Productivity domain compounds
  TransactionRowSchema,
  ReceiptSchema,
  MetricTileSchema,
  StepListSchema,
  // V1 Phase 1 Step 6 — Date components
  // Note: CalendarBaseSchema used in NodeSchema discriminated union (superRefine → ZodEffects)
  CalendarBaseSchema,
  CalendarSchema,
  HeatmapSchema,
  // V1 Phase 1 Step 7 — Content/Media expansion
  // Note: GalleryBaseSchema used in NodeSchema discriminated union (superRefine → ZodEffects)
  GalleryBaseSchema,
  GallerySchema,
  CommerceCardSchema,
  BeforeAfterSchema,
  DocumentPickerSchema,
} from './compound.js'
export type {
  ConditionalSection,
  ListSummary,
  MediaTray,
  ImagePicker,
  Image,
  // V1 Phase 1 Step 5
  TransactionRow,
  Receipt,
  ReceiptItem,
  MetricTile,
  StepList,
  Step,
  // V1 Phase 1 Step 6
  Calendar,
  Heatmap,
  // V1 Phase 1 Step 7
  Gallery,
  CommerceCard,
  BeforeAfter,
  DocumentPicker,
} from './compound.js'

// Actions tier (2 → 3 with IconButton)
export {ButtonSchema, FabSchema, IconButtonSchema} from './actions.js'
export type {Button, Fab, IconButton} from './actions.js'

// Slot polymorphism (F-3 closure)
export {SlotSchema, IconNameSchema} from './slot.js'
export type {Slot} from './slot.js'

// MAX_NESTING_DEPTH — exported for Step 6 validator to import.
// Zod does NOT enforce this at schema parse time (F-06 architectural call:
// keeping the schema layer stateless and the cross-ref validator responsible
// for structural depth). See ADR-0005 §G check #9 and T-0005-173.
export const MAX_NESTING_DEPTH = 8

// ComponentNode type alias — forward reference placeholder for Step 5.
// Step 5 wires the full recursive NodeSchema as z.ZodType<ComponentNode>.
// Step 4 exports this union type so Step 5 can extend it without redefining.
//
// For now this is a placeholder manual union; Step 5 will re-export the
// recursive NodeSchema that satisfies z.ZodType<ComponentNode>.
import {ScreenSchema, SectionSchema, StackSchema, RowSchema, CardSchema, DividerSchema} from './layout.js'
import {HeadingSchema, BodySchema, CaptionSchema} from './typography.js'
import {
  TextFieldSchema,
  NumberFieldSchema,
  DateFieldSchema,
  PickerSchema,
  SwitchSchema,
  MoneyFieldSchema,
  TimeFieldSchema,
  MultiPickerSchema,
  SliderSchema,
  RatingInputSchema,
  SearchBarSchema,
} from './inputs.js'
import {StatSchema, BadgeSchema, ChipSchema, AvatarSchema, AvatarGroupSchema, CalloutSchema} from './display.js'
import {
  ListSchema,
  ListItemSchema,
  SwipeableRowSchema,
  EmptyStateSchema,
  LoadingStateSchema,
  GridListSchema,
  CarouselBaseSchema,
  CarouselSchema,
  TimelineSchema,
  ErrorStateSchema,
} from './lists.js'
import {
  ConditionalSectionSchema,
  ListSummarySchema,
  MediaTraySchema,
  ImagePickerSchema,
  ImageSchema,
  // V1 Phase 1 Step 5 — Productivity domain compounds
  TransactionRowSchema,
  ReceiptSchema,
  MetricTileSchema,
  StepListSchema,
  // V1 Phase 1 Step 6 — Date components
  CalendarBaseSchema,
  CalendarSchema,
  HeatmapSchema,
  // V1 Phase 1 Step 7 — Content/Media expansion
  GalleryBaseSchema,
  GallerySchema,
  CommerceCardSchema,
  BeforeAfterSchema,
  DocumentPickerSchema,
} from './compound.js'
import {ButtonSchema, FabSchema, IconButtonSchema} from './actions.js'

// All 53 component schemas in one array — used by the Step 5 discriminated union.
// Step 5 passes this to z.discriminatedUnion('type', ALL_COMPONENT_SCHEMAS).
// V1 Phase 1 Step 1 adds: DividerSchema, ImageSchema, IconButtonSchema (→33).
// V1 Phase 1 Step 3 adds: AvatarGroupSchema, CalloutSchema (→35).
// V1 Phase 1 Step 2 adds: MoneyField, TimeField, MultiPicker, Slider, RatingInput, SearchBar (→39).
// V1 Phase 1 Step 4 adds: GridList, Carousel, Timeline, ErrorState (→43).
// V1 Phase 1 Step 5 adds: TransactionRow, Receipt, MetricTile, StepList (→47).
// V1 Phase 1 Step 6 adds: Calendar, Heatmap (→49).
// V1 Phase 1 Step 7 adds: Gallery, CommerceCard, BeforeAfter, DocumentPicker (→53).
export const ALL_COMPONENT_SCHEMAS = [
  ScreenSchema,
  SectionSchema,
  StackSchema,
  RowSchema,
  CardSchema,
  DividerSchema,
  HeadingSchema,
  BodySchema,
  CaptionSchema,
  TextFieldSchema,
  NumberFieldSchema,
  DateFieldSchema,
  PickerSchema,
  SwitchSchema,
  // V1 Phase 1 Step 2 — inputs tier expansion
  MoneyFieldSchema,
  TimeFieldSchema,
  MultiPickerSchema,
  SliderSchema,
  RatingInputSchema,
  SearchBarSchema,
  StatSchema,
  BadgeSchema,
  ChipSchema,
  AvatarSchema,
  AvatarGroupSchema,
  CalloutSchema,
  ListSchema,
  ListItemSchema,
  SwipeableRowSchema,
  EmptyStateSchema,
  LoadingStateSchema,
  // V1 Phase 1 Step 4 — Lists & Data tier expansion
  // Note: CarouselBaseSchema used here (not CarouselSchema) because z.discriminatedUnion
  // requires ZodObject; CarouselSchema's superRefine returns ZodEffects (incompatible).
  GridListSchema,
  CarouselBaseSchema,
  TimelineSchema,
  ErrorStateSchema,
  ConditionalSectionSchema,
  ListSummarySchema,
  MediaTraySchema,
  ImagePickerSchema,
  ImageSchema,
  // V1 Phase 1 Step 5 — Productivity domain compounds
  TransactionRowSchema,
  ReceiptSchema,
  MetricTileSchema,
  StepListSchema,
  ButtonSchema,
  FabSchema,
  IconButtonSchema,
  // V1 Phase 1 Step 6 — Date components
  // Note: CalendarBaseSchema used here (not CalendarSchema) because z.discriminatedUnion
  // requires ZodObject; CalendarSchema's superRefine returns ZodEffects (incompatible).
  CalendarBaseSchema,
  HeatmapSchema,
  // V1 Phase 1 Step 7 — Content/Media expansion
  // Note: GalleryBaseSchema used here (not GallerySchema) because z.discriminatedUnion
  // requires ZodObject; GallerySchema's superRefine returns ZodEffects (incompatible).
  GalleryBaseSchema,
  CommerceCardSchema,
  BeforeAfterSchema,
  DocumentPickerSchema,
] as const

// ComponentNode — union type of all 53 component inferred types.
// Recursive children are typed as ComponentNode[] (z.lazy() in Step 5 resolves this).
export type ComponentNode =
  | z.infer<typeof ScreenSchema>
  | z.infer<typeof SectionSchema>
  | z.infer<typeof StackSchema>
  | z.infer<typeof RowSchema>
  | z.infer<typeof CardSchema>
  | z.infer<typeof DividerSchema>
  | z.infer<typeof HeadingSchema>
  | z.infer<typeof BodySchema>
  | z.infer<typeof CaptionSchema>
  | z.infer<typeof TextFieldSchema>
  | z.infer<typeof NumberFieldSchema>
  | z.infer<typeof DateFieldSchema>
  | z.infer<typeof PickerSchema>
  | z.infer<typeof SwitchSchema>
  // V1 Phase 1 Step 2 — inputs tier expansion
  | z.infer<typeof MoneyFieldSchema>
  | z.infer<typeof TimeFieldSchema>
  | z.infer<typeof MultiPickerSchema>
  | z.infer<typeof SliderSchema>
  | z.infer<typeof RatingInputSchema>
  | z.infer<typeof SearchBarSchema>
  | z.infer<typeof StatSchema>
  | z.infer<typeof BadgeSchema>
  | z.infer<typeof ChipSchema>
  | z.infer<typeof AvatarSchema>
  | z.infer<typeof AvatarGroupSchema>
  | z.infer<typeof CalloutSchema>
  | z.infer<typeof ListSchema>
  | z.infer<typeof ListItemSchema>
  | z.infer<typeof SwipeableRowSchema>
  | z.infer<typeof EmptyStateSchema>
  | z.infer<typeof LoadingStateSchema>
  // V1 Phase 1 Step 4 — Lists & Data tier expansion
  | z.infer<typeof GridListSchema>
  | z.infer<typeof CarouselSchema>
  | z.infer<typeof TimelineSchema>
  | z.infer<typeof ErrorStateSchema>
  | z.infer<typeof ConditionalSectionSchema>
  | z.infer<typeof ListSummarySchema>
  | z.infer<typeof MediaTraySchema>
  | z.infer<typeof ImagePickerSchema>
  | z.infer<typeof ImageSchema>
  // V1 Phase 1 Step 5 — Productivity domain compounds
  | z.infer<typeof TransactionRowSchema>
  | z.infer<typeof ReceiptSchema>
  | z.infer<typeof MetricTileSchema>
  | z.infer<typeof StepListSchema>
  | z.infer<typeof ButtonSchema>
  | z.infer<typeof FabSchema>
  | z.infer<typeof IconButtonSchema>
  // V1 Phase 1 Step 6 — Date components
  | z.infer<typeof CalendarSchema>
  | z.infer<typeof HeatmapSchema>
  // V1 Phase 1 Step 7 — Content/Media expansion
  | z.infer<typeof GallerySchema>
  | z.infer<typeof CommerceCardSchema>
  | z.infer<typeof BeforeAfterSchema>
  | z.infer<typeof DocumentPickerSchema>

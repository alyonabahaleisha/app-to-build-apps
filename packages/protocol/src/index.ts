// Token-name enums — the visual vocabulary the LLM picks from
export {
  ColorTokenSchema,
  SpaceTokenSchema,
  RadiusTokenSchema,
  TypeRoleSchema,
  ElevationSchema,
  MotionCurveSchema,
} from './tokens.js'
export type {ColorToken, SpaceToken, RadiusToken, TypeRole, Elevation, MotionCurve} from './tokens.js'

// Core enums — stances, palettes, archetypes, and registry discriminants
export {
  StanceSchema,
  PaletteSchema,
  ArchetypeSchema,
  ToneSchema,
  FieldTypeDiscriminantSchema,
  SyncModeSchema,
  BindingKindSchema,
  SlotKindSchema,
  NavPatternSchema,
} from './enums.js'
export type {
  Stance,
  Palette,
  Archetype,
  Tone,
  FieldTypeDiscriminant,
  SyncMode,
  BindingKind,
  SlotKind,
  NavPattern,
} from './enums.js'

// Canonicalization — verbatim copy from a2ui-schema; do not re-export from legacy package
export {canonicalize, renderHash} from './canonical.js'

// Binding<T> schemas — 5 typed discriminated unions + shared slot-name schema
export {
  SlotNameSchema,
  BindingValueSchema,
  StringBindingSchema,
  NumberBindingSchema,
  BooleanBindingSchema,
  DateBindingSchema,
  ImageBindingSchema,
} from './binding.js'
export type {
  BindingValue,
  StringBinding,
  NumberBinding,
  BooleanBinding,
  DateBinding,
  ImageBinding,
} from './binding.js'

// Action verb discriminated union — 12 verbs, 'share' absent (F-4 cut)
export {ActionSchema, ACTION_VERB_COUNT} from './actions.js'
export type {Action} from './actions.js'

// Collection schema — field types + collection shape + seed data
export {
  FieldTypeSchema,
  CollectionFieldSchema,
  CollectionSchema,
  COLLECTION_FIELD_NAME_REGEX,
  COLLECTION_ID_REGEX,
} from './collection.js'
export type {FieldType, CollectionField, Collection} from './collection.js'

// Step 9: Icon catalog — 80-name enum, path data
export {ICON_NAMES, IconNameSchema, ICON_PATHS} from './icons/index.js'
export type {IconName} from './icons/index.js'

// Step 5: Spec + SpecScreen + recursive Node
export {SpecSchema, SpecScreenSchema, NodeSchema} from './spec.zod.js'
export type {Spec, SpecScreen, Node} from './spec.zod.js'

// Step 6: Cross-reference validator
export {validateCrossRefs} from './validate.js'
export type {ValidationError, ValidationErrorCode, ValidatorResult} from './validate.js'

// Component schemas (Step 4) — 28 components grouped by tier
export {
  // Layout tier
  ScreenSchema,
  SectionSchema,
  StackSchema,
  RowSchema,
  CardSchema,
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
  // Compound tier
  ConditionalSectionSchema,
  ListSummarySchema,
  MediaTraySchema,
  ImagePickerSchema,
  // Actions tier
  ButtonSchema,
  FabSchema,
  // Slot polymorphism
  SlotSchema,
  // Constants + type alias placeholder
  MAX_NESTING_DEPTH,
  ALL_COMPONENT_SCHEMAS,
} from './components/index.js'
export type {
  Screen,
  Section,
  Stack,
  Row,
  Card,
  Heading,
  Body,
  Caption,
  TextField,
  NumberField,
  DateField,
  Picker,
  Switch,
  Stat,
  Badge,
  Chip,
  Avatar,
  List,
  ListItem,
  SwipeableRow,
  EmptyState,
  LoadingState,
  ConditionalSection,
  ListSummary,
  MediaTray,
  ImagePicker,
  Button,
  Fab,
  Slot,
  ComponentNode,
} from './components/index.js'

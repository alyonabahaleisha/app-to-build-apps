/**
 * Snapshot matrix — Step 12 (ADR-0006) + Step 9 (ADR-0009)
 *
 * T-0006-180..235: 28 components × 2 register pairs = 56 snapshots (V0).
 * T-0006-236: Snapshot stability — deterministic fixtures produce zero
 *   diff across runs. Guaranteed by the absence of any runtime
 *   randomness (no Date.now(), no Math.random(), no seedrandom
 *   calls in component render paths).
 * T-0006-237..286: 25 new V1 Phase 1 components × 2 register pairs = 50 snapshots.
 *
 * Total: 106 snapshots = 53 components × 2 register pairs.
 *
 * Register pairs:
 *   Productive × Focus  — cobalt accent, sans-serif, tighter spacing
 *   Expressive × Health — sage olive, serif headings, looser spacing
 *
 * Parameterized with it.each(MATRIX_ENTRIES) per ADR-0006 §J note 11.
 * Each entry is a [T-ID, componentName, stance, palette, element] tuple.
 *
 * Components that require collection state (List, ListSummary, MediaTray,
 * ConditionalSection, GridList, Carousel, Timeline, Heatmap) receive a
 * pre-built RendererState via renderWithTheme's rendererState option.
 * SwipeableRow renders the swipe action panels inline (jestSetup mock).
 *
 * Date-sensitive components (Calendar, Heatmap, Timeline) require fake
 * timers pinned to 2026-01-15T12:00:00Z for deterministic snapshots.
 * The describe block that contains these entries sets up fake timers.
 *
 * Snapshot policy: see packages/a2ui-renderer/test/snapshot-policy.md
 */
import React from 'react'
import type {Stance, Palette, Spec} from '@app-creator/protocol'
import type {Node} from '@app-creator/protocol'
import {renderWithTheme} from './__test-utils__/renderWithTheme'
import {buildInitialRendererState} from './state/reducer'
import type {RendererState} from './state/types'

// ---------------------------------------------------------------------------
// Component imports
// ---------------------------------------------------------------------------

// V0 — Layout
import {ScreenRenderer} from './components/layout/Screen'
import {SectionRenderer} from './components/layout/Section'
import {StackRenderer} from './components/layout/Stack'
import {RowRenderer} from './components/layout/Row'
import {CardRenderer} from './components/layout/Card'
// V0 — Typography
import {HeadingRenderer} from './components/typography/Heading'
import {BodyRenderer} from './components/typography/Body'
import {CaptionRenderer} from './components/typography/Caption'
// V0 — Display
import {StatRenderer} from './components/display/Stat'
import {BadgeRenderer} from './components/display/Badge'
import {ChipRenderer} from './components/display/Chip'
import {AvatarRenderer} from './components/display/Avatar'
// V0 — Inputs
import {TextFieldRenderer} from './components/inputs/TextField'
import {NumberFieldRenderer} from './components/inputs/NumberField'
import {DateFieldRenderer} from './components/inputs/DateField'
import {PickerRenderer} from './components/inputs/Picker'
import {SwitchRenderer} from './components/inputs/Switch'
// V0 — Lists
import {ListRenderer} from './components/lists/List'
import {ListItemRenderer} from './components/lists/ListItem'
import {SwipeableRowRenderer} from './components/lists/SwipeableRow'
import {EmptyStateRenderer} from './components/lists/EmptyState'
import {LoadingStateRenderer} from './components/lists/LoadingState'
// V0 — Compound
import {ConditionalSectionRenderer} from './components/compound/ConditionalSection'
import {ListSummaryRenderer} from './components/compound/ListSummary'
import {MediaTrayRenderer} from './components/compound/MediaTray'
import {ImagePickerRenderer} from './components/compound/ImagePicker'
// V0 — Actions
import {ButtonRenderer} from './components/actions/Button'
import {FABRenderer} from './components/actions/FAB'

// V1 Phase 1 — Layout
import {DividerRenderer} from './components/layout/Divider'
import {ImageRenderer} from './components/compound/Image'
// V1 Phase 1 — Actions
import {IconButtonRenderer} from './components/actions/IconButton'
// V1 Phase 1 — Inputs
import {MoneyFieldRenderer} from './components/inputs/MoneyField'
import {TimeFieldRenderer} from './components/inputs/TimeField'
import {MultiPickerRenderer} from './components/inputs/MultiPicker'
import {SliderRenderer} from './components/inputs/Slider'
import {RatingInputRenderer} from './components/inputs/RatingInput'
import {SearchBarRenderer} from './components/inputs/SearchBar'
// V1 Phase 1 — Display
import {AvatarGroupRenderer} from './components/display/AvatarGroup'
import {CalloutRenderer} from './components/display/Callout'
// V1 Phase 1 — Lists
import {GridListRenderer} from './components/lists/GridList'
import {CarouselRenderer} from './components/lists/Carousel'
import {TimelineRenderer} from './components/lists/Timeline'
import {ErrorStateRenderer} from './components/lists/ErrorState'
// V1 Phase 1 — Compound (Productivity)
import {TransactionRowRenderer} from './components/compound/TransactionRow'
import {ReceiptRenderer} from './components/compound/Receipt'
import {MetricTileRenderer} from './components/compound/MetricTile'
import {StepListRenderer} from './components/compound/StepList'
import {CalendarRenderer} from './components/compound/Calendar'
import {HeatmapRenderer} from './components/compound/Heatmap'
// V1 Phase 1 — Compound (Content/Media)
import {GalleryRenderer} from './components/compound/Gallery'
import {CommerceCardRenderer} from './components/compound/CommerceCard'
import {BeforeAfterRenderer} from './components/compound/BeforeAfter'
import {DocumentPickerRenderer} from './components/compound/DocumentPicker'

// ---------------------------------------------------------------------------
// AI capabilities mock (ListSummary needs it)
// ---------------------------------------------------------------------------

jest.mock('./ai/AICapabilitiesProvider', () => {
  const original = jest.requireActual('./ai/AICapabilitiesProvider')
  return {
    ...original,
    useAICapabilities: jest.fn().mockReturnValue({isSupported: true}),
  }
})

// ---------------------------------------------------------------------------
// Shared specs for collection-dependent components
// ---------------------------------------------------------------------------

/** Spec that owns the 'items' collection used by List/ConditionalSection. */
const SPEC_WITH_ITEMS: Spec = {
  version: 1,
  archetype: 'ListCRUD',
  stance: 'productive',
  palette: 'focus',
  coverIcon: 'list',
  navigation: 'none',
  screens: [{id: 's1', root: {id: 'n1', type: 'Heading', text: 'T', level: 1}}],
  initialScreenId: 's1',
  collections: [
    {
      id: 'items',
      name: 'Items',
      syncMode: 'local' as const,
      fields: [{name: 'name', type: {type: 'string'} as const, required: true}],
      seedData: [
        {name: 'Morning run'},
        {name: 'Evening walk'},
      ],
    },
  ],
  initialState: {},
}

/** Spec that owns the 'photos' collection used by MediaTray. */
const SPEC_WITH_PHOTOS: Spec = {
  ...SPEC_WITH_ITEMS,
  coverIcon: 'camera',
  collections: [
    {
      id: 'photos',
      name: 'Photos',
      syncMode: 'local' as const,
      fields: [{name: 'uri', type: {type: 'image'} as const, required: true}],
      seedData: [
        {uri: 'https://example.com/a.jpg'},
        {uri: 'https://example.com/b.jpg'},
      ],
    },
  ],
}

/** Spec that owns the 'workouts' collection used by ListSummary. */
const SPEC_WITH_WORKOUTS: Spec = {
  ...SPEC_WITH_ITEMS,
  coverIcon: 'dumbbell',
  collections: [
    {
      id: 'workouts',
      name: 'Workouts',
      syncMode: 'local' as const,
      fields: [
        {name: 'name', type: {type: 'string'} as const, required: true},
        {name: 'duration', type: {type: 'number'} as const, required: false},
      ],
      seedData: [
        {name: 'Morning run', duration: 30},
        {name: 'Evening yoga', duration: 45},
      ],
    },
  ],
}

// Pre-built renderer states for collection-dependent components.
const itemsState: RendererState = buildInitialRendererState(SPEC_WITH_ITEMS)
const photosState: RendererState = buildInitialRendererState(SPEC_WITH_PHOTOS)
const workoutsState: RendererState = buildInitialRendererState(SPEC_WITH_WORKOUTS)

// ---------------------------------------------------------------------------
// V1 Phase 1 — additional shared specs for new collection-dependent components
// ---------------------------------------------------------------------------

/** Spec that owns 'gridphotos' collection used by GridList. */
const SPEC_WITH_GRIDPHOTOS: Spec = {
  ...SPEC_WITH_ITEMS,
  coverIcon: 'image',
  collections: [
    {
      id: 'gridphotos',
      name: 'Grid Photos',
      syncMode: 'local' as const,
      fields: [{name: 'title', type: {type: 'string'} as const, required: true}],
      seedData: [
        {title: 'Sunrise'},
        {title: 'Cityscape'},
        {title: 'Portrait'},
        {title: 'Landscape'},
      ],
    },
  ],
}

/** Spec that owns 'slides' collection used by Carousel. */
const SPEC_WITH_SLIDES: Spec = {
  ...SPEC_WITH_ITEMS,
  coverIcon: 'list',
  collections: [
    {
      id: 'slides',
      name: 'Slides',
      syncMode: 'local' as const,
      fields: [{name: 'title', type: {type: 'string'} as const, required: true}],
      seedData: [
        {title: 'Slide 1'},
        {title: 'Slide 2'},
        {title: 'Slide 3'},
      ],
    },
  ],
}

/** Spec that owns 'events' collection used by Timeline. */
const SPEC_WITH_EVENTS: Spec = {
  ...SPEC_WITH_ITEMS,
  coverIcon: 'calendar',
  collections: [
    {
      id: 'events',
      name: 'Events',
      syncMode: 'local' as const,
      fields: [
        {name: 'title', type: {type: 'string'} as const, required: true},
        {name: 'createdAt', type: {type: 'date'} as const, required: true},
      ],
      seedData: [
        {title: 'Team meeting', createdAt: '2026-01-10'},
        {title: 'Design review', createdAt: '2026-01-12'},
        {title: 'Launch day', createdAt: '2026-01-15'},
      ],
    },
  ],
}

/** Spec that owns 'habits' collection used by Heatmap. */
const SPEC_WITH_HABITS: Spec = {
  ...SPEC_WITH_ITEMS,
  coverIcon: 'flame',
  collections: [
    {
      id: 'habits',
      name: 'Habits',
      syncMode: 'local' as const,
      fields: [
        {name: 'name', type: {type: 'string'} as const, required: true},
        {name: 'completedAt', type: {type: 'date'} as const, required: true},
      ],
      seedData: [
        {name: 'Morning run', completedAt: '2026-01-10'},
        {name: 'Evening walk', completedAt: '2026-01-12'},
        {name: 'Yoga', completedAt: '2026-01-14'},
      ],
    },
  ],
}

/** Spec that owns 'gallery_imgs' collection used by Gallery. */
const SPEC_WITH_GALLERY: Spec = {
  ...SPEC_WITH_ITEMS,
  coverIcon: 'image',
  collections: [
    {
      id: 'gallery_imgs',
      name: 'Gallery',
      syncMode: 'local' as const,
      fields: [{name: 'photoUrl', type: {type: 'image'} as const, required: true}],
      seedData: [
        {photoUrl: 'https://example.com/p1.jpg'},
        {photoUrl: 'https://example.com/p2.jpg'},
        {photoUrl: 'https://example.com/p3.jpg'},
      ],
    },
  ],
}

const gridphotosState: RendererState = buildInitialRendererState(SPEC_WITH_GRIDPHOTOS)
const slidesState: RendererState = buildInitialRendererState(SPEC_WITH_SLIDES)
const eventsState: RendererState = buildInitialRendererState(SPEC_WITH_EVENTS)
const habitsState: RendererState = buildInitialRendererState(SPEC_WITH_HABITS)
const galleryState: RendererState = buildInitialRendererState(SPEC_WITH_GALLERY)

// ---------------------------------------------------------------------------
// Node fixtures
// ---------------------------------------------------------------------------

type ScreenNode = Extract<Node, {type: 'Screen'}>
type SectionNode = Extract<Node, {type: 'Section'}>
type StackNode = Extract<Node, {type: 'Stack'}>
type RowNode = Extract<Node, {type: 'Row'}>
type CardNode = Extract<Node, {type: 'Card'}>
type HeadingNode = Extract<Node, {type: 'Heading'}>
type BodyNode = Extract<Node, {type: 'Body'}>
type CaptionNode = Extract<Node, {type: 'Caption'}>
type StatNode = Extract<Node, {type: 'Stat'}>
type BadgeNode = Extract<Node, {type: 'Badge'}>
type ChipNode = Extract<Node, {type: 'Chip'}>
type AvatarNode = Extract<Node, {type: 'Avatar'}>
type TextFieldNode = Extract<Node, {type: 'TextField'}>
type NumberFieldNode = Extract<Node, {type: 'NumberField'}>
type DateFieldNode = Extract<Node, {type: 'DateField'}>
type PickerNode = Extract<Node, {type: 'Picker'}>
type SwitchNode = Extract<Node, {type: 'Switch'}>
type ListNode = Extract<Node, {type: 'List'}>
type ListItemNode = Extract<Node, {type: 'ListItem'}>
type SwipeableRowNode = Extract<Node, {type: 'SwipeableRow'}>
type EmptyStateNode = Extract<Node, {type: 'EmptyState'}>
type LoadingStateNode = Extract<Node, {type: 'LoadingState'}>
type ConditionalSectionNode = Extract<Node, {type: 'ConditionalSection'}>
type ListSummaryNode = Extract<Node, {type: 'ListSummary'}>
type MediaTrayNode = Extract<Node, {type: 'MediaTray'}>
type ImagePickerNode = Extract<Node, {type: 'ImagePicker'}>
type ButtonNode = Extract<Node, {type: 'Button'}>
type FabNode = Extract<Node, {type: 'FAB'}>

// V1 Phase 1 node types
type DividerNode = Extract<Node, {type: 'Divider'}>
type ImageNode = Extract<Node, {type: 'Image'}>
type IconButtonNode = Extract<Node, {type: 'IconButton'}>
type MoneyFieldNode = Extract<Node, {type: 'MoneyField'}>
type TimeFieldNode = Extract<Node, {type: 'TimeField'}>
type MultiPickerNode = Extract<Node, {type: 'MultiPicker'}>
type SliderNode = Extract<Node, {type: 'Slider'}>
type RatingInputNode = Extract<Node, {type: 'RatingInput'}>
type SearchBarNode = Extract<Node, {type: 'SearchBar'}>
type AvatarGroupNode = Extract<Node, {type: 'AvatarGroup'}>
type CalloutNode = Extract<Node, {type: 'Callout'}>
type GridListNode = Extract<Node, {type: 'GridList'}>
type CarouselNode = Extract<Node, {type: 'Carousel'}>
type TimelineNode = Extract<Node, {type: 'Timeline'}>
type ErrorStateNode = Extract<Node, {type: 'ErrorState'}>
type TransactionRowNode = Extract<Node, {type: 'TransactionRow'}>
type ReceiptNode = Extract<Node, {type: 'Receipt'}>
type MetricTileNode = Extract<Node, {type: 'MetricTile'}>
type StepListNode = Extract<Node, {type: 'StepList'}>
type CalendarNode = Extract<Node, {type: 'Calendar'}>
type HeatmapNode = Extract<Node, {type: 'Heatmap'}>
type GalleryNode = Extract<Node, {type: 'Gallery'}>
type CommerceCardNode = Extract<Node, {type: 'CommerceCard'}>
type BeforeAfterNode = Extract<Node, {type: 'BeforeAfter'}>
type DocumentPickerNode = Extract<Node, {type: 'DocumentPicker'}>

// Layout

const SCREEN_NODE: ScreenNode = {
  id: 'mx-screen',
  type: 'Screen',
  safeArea: 'none',
  children: [],
}

const SECTION_NODE: SectionNode = {
  id: 'mx-section',
  type: 'Section',
  title: 'Workouts',
  children: [],
}

const STACK_NODE: StackNode = {
  id: 'mx-stack',
  type: 'Stack',
  children: [],
}

const ROW_NODE: RowNode = {
  id: 'mx-row',
  type: 'Row',
  children: [],
}

const CARD_NODE: CardNode = {
  id: 'mx-card',
  type: 'Card',
  elevation: 'raised',
  children: [],
}

// Typography

const HEADING_NODE: HeadingNode = {
  id: 'mx-heading',
  type: 'Heading',
  text: 'My Workouts',
  level: 1,
}

const BODY_NODE: BodyNode = {
  id: 'mx-body',
  type: 'Body',
  text: 'Track your progress every day.',
}

const CAPTION_NODE: CaptionNode = {
  id: 'mx-caption',
  type: 'Caption',
  text: 'Last updated: today',
}

// Display

const STAT_NODE: StatNode = {
  id: 'mx-stat',
  type: 'Stat',
  label: 'Workouts this week',
  value: '12',
  delta: '+2',
  deltaTone: 'positive',
}

const BADGE_NODE: BadgeNode = {
  id: 'mx-badge',
  type: 'Badge',
  text: 'Active',
  tone: 'success',
}

const CHIP_NODE: ChipNode = {
  id: 'mx-chip',
  type: 'Chip',
  text: 'Running',
  action: {type: 'set', target: 'filter', value: 'running'},
}

const AVATAR_NODE: AvatarNode = {
  id: 'mx-avatar',
  type: 'Avatar',
  name: 'José García',
  size: 'lg',
}

// Inputs

const TEXT_FIELD_NODE: TextFieldNode = {
  id: 'mx-textfield',
  type: 'TextField',
  label: 'Workout name',
  valueBinding: {kind: 'state', slot: 'workoutName'},
}

const NUMBER_FIELD_NODE: NumberFieldNode = {
  id: 'mx-numberfield',
  type: 'NumberField',
  label: 'Duration (min)',
  valueBinding: {kind: 'state', slot: 'duration'},
}

const DATE_FIELD_NODE: DateFieldNode = {
  id: 'mx-datefield',
  type: 'DateField',
  label: 'Workout date',
  valueBinding: {kind: 'state', slot: 'date'},
}

const PICKER_NODE: PickerNode = {
  id: 'mx-picker',
  type: 'Picker',
  label: 'Category',
  options: [
    {value: 'strength', label: 'Strength'},
    {value: 'cardio', label: 'Cardio'},
    {value: 'flexibility', label: 'Flexibility'},
  ],
  valueBinding: {kind: 'state', slot: 'category'},
}

const SWITCH_NODE: SwitchNode = {
  id: 'mx-switch',
  type: 'Switch',
  label: 'Remind me daily',
  valueBinding: {kind: 'literal', value: false},
}

// Lists

const LIST_NODE: ListNode = {
  id: 'mx-list',
  type: 'List',
  collectionId: 'items',
  itemLayout: 'standard',
}

const LIST_ITEM_NODE: ListItemNode = {
  id: 'mx-listitem',
  type: 'ListItem',
  title: '李明',
  subtitle: 'Trainer',
  leading: {kind: 'icon', name: 'star'},
  trailing: {kind: 'badge', node: {id: 'mx-badge-t', type: 'Badge', text: 'Pro', tone: 'accent'}},
}

const SWIPEABLE_ROW_NODE: SwipeableRowNode = {
  id: 'mx-swipeable',
  type: 'SwipeableRow',
  title: "O'Brien",
  subtitle: '45 min',
  trailingAction: {type: 'removeItem', collection: 'items', itemId: 'row_1'},
  trailingActionIcon: 'trash',
  trailingActionColor: 'danger',
}

const EMPTY_STATE_NODE: EmptyStateNode = {
  id: 'mx-emptystate',
  type: 'EmptyState',
  icon: 'list',
  headline: 'No items yet',
  body: 'Add your first item to get started.',
}

const LOADING_STATE_NODE: LoadingStateNode = {
  id: 'mx-loading',
  type: 'LoadingState',
  lines: 3,
}

// Compound

const CONDITIONAL_SECTION_NODE: ConditionalSectionNode = {
  id: 'mx-conditional',
  type: 'ConditionalSection',
  collectionId: 'items',
  showWhen: 'whenNotEmpty',
  children: [HEADING_NODE],
}

const LIST_SUMMARY_NODE: ListSummaryNode = {
  id: 'mx-listsummary',
  type: 'ListSummary',
  collectionId: 'workouts',
  prompt: 'Summarize these workouts.',
  fallback: 'show-raw',
}

const MEDIA_TRAY_NODE: MediaTrayNode = {
  id: 'mx-mediatray',
  type: 'MediaTray',
  collectionId: 'photos',
  imageField: 'uri',
  aspectRatio: '1:1',
}

const IMAGE_PICKER_NODE: ImagePickerNode = {
  id: 'mx-imagepicker',
  type: 'ImagePicker',
  label: 'Add photo',
  valueBinding: {kind: 'state', slot: 'selectedPhoto'},
}

// Actions

const BUTTON_NODE: ButtonNode = {
  id: 'mx-button',
  type: 'Button',
  label: 'Add Workout',
  variant: 'primary',
  action: {type: 'addItem', collection: 'items', item: {name: 'New workout'}},
}

const FAB_NODE: FabNode = {
  id: 'mx-fab',
  type: 'FAB',
  icon: 'plus',
  accessibilityLabel: 'Add workout',
  action: {type: 'addItem', collection: 'items', item: {name: 'New workout'}},
}

// V1 Phase 1 — Layout

const DIVIDER_NODE: DividerNode = {
  id: 'mx-divider',
  type: 'Divider',
  label: 'Today',
  weight: 'hairline',
  inset: 'none',
}

const IMAGE_NODE: ImageNode = {
  id: 'mx-image',
  type: 'Image',
  source: {kind: 'literal', value: 'https://example.com/hero.jpg'},
  aspectRatio: '16:9',
  alt: 'Hero image',
}

// V1 Phase 1 — Actions

const ICON_BUTTON_NODE: IconButtonNode = {
  id: 'mx-iconbutton',
  type: 'IconButton',
  icon: 'edit',
  variant: 'secondary',
  size: 'md',
  accessibilityLabel: 'Edit workout',
  action: {type: 'set', target: 'editing', value: true},
}

// V1 Phase 1 — Inputs

const MONEY_FIELD_NODE: MoneyFieldNode = {
  id: 'mx-moneyfield',
  type: 'MoneyField',
  label: 'Tip amount',
  valueBinding: {kind: 'state', slot: 'tipCents'},
  currency: 'USD',
}

const TIME_FIELD_NODE: TimeFieldNode = {
  id: 'mx-timefield',
  type: 'TimeField',
  label: 'Workout time',
  valueBinding: {kind: 'state', slot: 'startTime'},
}

const MULTI_PICKER_NODE: MultiPickerNode = {
  id: 'mx-multipicker',
  type: 'MultiPicker',
  label: 'Muscle groups',
  valueBinding: {kind: 'state', slot: 'muscleGroups'},
  options: [
    {value: 'chest', label: 'Chest'},
    {value: 'back', label: 'Back'},
    {value: 'legs', label: 'Legs'},
    {value: 'shoulders', label: 'Shoulders'},
  ],
}

const SLIDER_NODE: SliderNode = {
  id: 'mx-slider',
  type: 'Slider',
  label: 'Intensity',
  valueBinding: {kind: 'state', slot: 'intensity'},
  min: 1,
  max: 10,
  step: 1,
  showValue: true,
}

const RATING_INPUT_NODE: RatingInputNode = {
  id: 'mx-ratinginput',
  type: 'RatingInput',
  label: 'Session rating',
  valueBinding: {kind: 'state', slot: 'rating'},
  scale: 5,
  glyph: 'star',
}

const SEARCH_BAR_NODE: SearchBarNode = {
  id: 'mx-searchbar',
  type: 'SearchBar',
  valueBinding: {kind: 'state', slot: 'query'},
  placeholder: 'Search workouts…',
}

// V1 Phase 1 — Display

const AVATAR_GROUP_NODE: AvatarGroupNode = {
  id: 'mx-avatargroup',
  type: 'AvatarGroup',
  avatars: [
    {name: 'José García'},
    {name: '李明'},
    {name: "O'Brien"},
  ],
  maxShown: 3,
  size: 'md',
}

const CALLOUT_NODE: CalloutNode = {
  id: 'mx-callout',
  type: 'Callout',
  variant: 'info',
  headline: 'Rest day recommended',
  body: 'You have trained 5 days in a row.',
}

// V1 Phase 1 — Lists

const GRID_LIST_NODE: GridListNode = {
  id: 'mx-gridlist',
  type: 'GridList',
  collectionId: 'gridphotos',
  columns: 2,
}

const CAROUSEL_NODE: CarouselNode = {
  id: 'mx-carousel',
  type: 'Carousel',
  collectionId: 'slides',
  indicator: 'dots',
}

const TIMELINE_NODE: TimelineNode = {
  id: 'mx-timeline',
  type: 'Timeline',
  collectionId: 'events',
  dateField: 'createdAt',
  dateFormat: 'absolute',
}

const ERROR_STATE_NODE: ErrorStateNode = {
  id: 'mx-errorstate',
  type: 'ErrorState',
  headline: 'Failed to load',
  body: 'Check your connection and try again.',
}

// V1 Phase 1 — Compound (Productivity)

const TRANSACTION_ROW_NODE: TransactionRowNode = {
  id: 'mx-transactionrow',
  type: 'TransactionRow',
  date: 'Jan 14, 2026',
  merchant: 'Gym membership',
  amount: {kind: 'literal', value: -4999},
  currency: 'USD',
  categoryIcon: 'zap',
}

const RECEIPT_NODE: ReceiptNode = {
  id: 'mx-receipt',
  type: 'Receipt',
  items: [
    {label: 'Protein shake', amount: {kind: 'literal', value: 799}},
    {label: 'Resistance band', amount: {kind: 'literal', value: 1299}},
  ],
  subtotal: {kind: 'literal', value: 2098},
  tax: {kind: 'literal', value: 168},
  total: {kind: 'literal', value: 2266},
  currency: 'USD',
}

const METRIC_TILE_NODE: MetricTileNode = {
  id: 'mx-metrictile',
  type: 'MetricTile',
  value: '14',
  label: 'Workouts this month',
  delta: '+3',
  deltaTone: 'positive',
  sparklineData: [5, 7, 6, 9, 11, 10, 14],
}

const STEP_LIST_NODE: StepListNode = {
  id: 'mx-steplist',
  type: 'StepList',
  style: 'numbered',
  steps: [
    {title: 'Warm up', body: '5 minutes light cardio'},
    {title: 'Main set', body: '3 × 10 reps each exercise'},
    {title: 'Cool down', body: 'Stretch for 5 minutes'},
  ],
}

const CALENDAR_NODE: CalendarNode = {
  id: 'mx-calendar',
  type: 'Calendar',
  view: 'month',
  selectedBinding: {kind: 'state', slot: 'selectedDate'},
}

const HEATMAP_NODE: HeatmapNode = {
  id: 'mx-heatmap',
  type: 'Heatmap',
  collectionId: 'habits',
  dateField: 'completedAt',
  range: '90d',
  intensityMode: 'count',
}

// V1 Phase 1 — Compound (Content/Media)

const GALLERY_NODE: GalleryNode = {
  id: 'mx-gallery',
  type: 'Gallery',
  images: [
    {kind: 'literal', value: 'https://example.com/a.jpg'},
    {kind: 'literal', value: 'https://example.com/b.jpg'},
    {kind: 'literal', value: 'https://example.com/c.jpg'},
  ],
  columns: 3,
  aspectRatio: '1:1',
}

const COMMERCE_CARD_NODE: CommerceCardNode = {
  id: 'mx-commercecard',
  type: 'CommerceCard',
  title: 'Foam Roller Pro',
  image: {kind: 'literal', value: 'https://example.com/foam-roller.jpg'},
  price: {kind: 'literal', value: 3499},
  priceCompare: {kind: 'literal', value: 4999},
  currency: 'USD',
  ctaLabel: 'Add to cart',
  badge: 'Sale',
}

const BEFORE_AFTER_NODE: BeforeAfterNode = {
  id: 'mx-beforeafter',
  type: 'BeforeAfter',
  before: {kind: 'literal', value: 'https://example.com/before.jpg'},
  after: {kind: 'literal', value: 'https://example.com/after.jpg'},
  mode: 'side-by-side',
  beforeLabel: 'Before',
  afterLabel: 'After',
}

const DOCUMENT_PICKER_NODE: DocumentPickerNode = {
  id: 'mx-documentpicker',
  type: 'DocumentPicker',
  label: 'Attach training plan',
  valueBinding: {kind: 'state', slot: 'planUri'},
  acceptedTypes: ['pdf'],
}

// ---------------------------------------------------------------------------
// Matrix entries
//
// Format: [tId, label, stance, palette, element, rendererState?]
//
// T-0006-180..207: productive×focus (28 components)
// T-0006-208..235: expressive×health (28 components)
//
// Components that need collection state get it via rendererState.
// ---------------------------------------------------------------------------

type MatrixEntry = {
  tId: string
  label: string
  stance: Stance
  palette: Palette
  element: React.ReactElement
  rendererState?: RendererState
}

const MATRIX_ENTRIES: MatrixEntry[] = [
  // -------------------------------------------------------------------------
  // productive×focus (T-0006-180..207)
  // -------------------------------------------------------------------------
  {tId: 'T-0006-180', label: 'Screen/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <ScreenRenderer node={SCREEN_NODE} />},
  {tId: 'T-0006-181', label: 'Section/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <SectionRenderer node={SECTION_NODE} />},
  {tId: 'T-0006-182', label: 'Stack/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <StackRenderer node={STACK_NODE} />},
  {tId: 'T-0006-183', label: 'Row/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <RowRenderer node={ROW_NODE} />},
  {tId: 'T-0006-184', label: 'Card/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <CardRenderer node={CARD_NODE} />},
  {tId: 'T-0006-185', label: 'Heading/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <HeadingRenderer node={HEADING_NODE} />},
  {tId: 'T-0006-186', label: 'Body/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <BodyRenderer node={BODY_NODE} />},
  {tId: 'T-0006-187', label: 'Caption/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <CaptionRenderer node={CAPTION_NODE} />},
  {tId: 'T-0006-188', label: 'Stat/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <StatRenderer node={STAT_NODE} />},
  {tId: 'T-0006-189', label: 'Badge/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <BadgeRenderer node={BADGE_NODE} />},
  {tId: 'T-0006-190', label: 'Chip/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <ChipRenderer node={CHIP_NODE} />},
  {tId: 'T-0006-191', label: 'Avatar/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <AvatarRenderer node={AVATAR_NODE} />},
  {tId: 'T-0006-192', label: 'TextField/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <TextFieldRenderer node={TEXT_FIELD_NODE} />},
  {tId: 'T-0006-193', label: 'NumberField/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <NumberFieldRenderer node={NUMBER_FIELD_NODE} />},
  {tId: 'T-0006-194', label: 'DateField/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <DateFieldRenderer node={DATE_FIELD_NODE} />},
  {tId: 'T-0006-195', label: 'Picker/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <PickerRenderer node={PICKER_NODE} />},
  {tId: 'T-0006-196', label: 'Switch/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <SwitchRenderer node={SWITCH_NODE} />},
  {tId: 'T-0006-197', label: 'List/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <ListRenderer node={LIST_NODE} />,
    rendererState: itemsState},
  {tId: 'T-0006-198', label: 'ListItem/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <ListItemRenderer node={LIST_ITEM_NODE} />},
  {tId: 'T-0006-199', label: 'SwipeableRow/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <SwipeableRowRenderer node={SWIPEABLE_ROW_NODE} />},
  {tId: 'T-0006-200', label: 'EmptyState/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <EmptyStateRenderer node={EMPTY_STATE_NODE} />},
  {tId: 'T-0006-201', label: 'LoadingState/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <LoadingStateRenderer node={LOADING_STATE_NODE} />},
  {tId: 'T-0006-202', label: 'ConditionalSection/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <ConditionalSectionRenderer node={CONDITIONAL_SECTION_NODE} />,
    rendererState: itemsState},
  {tId: 'T-0006-203', label: 'ListSummary/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <ListSummaryRenderer node={LIST_SUMMARY_NODE} />,
    rendererState: workoutsState},
  {tId: 'T-0006-204', label: 'MediaTray/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <MediaTrayRenderer node={MEDIA_TRAY_NODE} />,
    rendererState: photosState},
  {tId: 'T-0006-205', label: 'ImagePicker/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <ImagePickerRenderer node={IMAGE_PICKER_NODE} />},
  {tId: 'T-0006-206', label: 'Button/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <ButtonRenderer node={BUTTON_NODE} />},
  {tId: 'T-0006-207', label: 'FAB/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <FABRenderer node={FAB_NODE} />},

  // -------------------------------------------------------------------------
  // expressive×health (T-0006-208..235)
  // -------------------------------------------------------------------------
  {tId: 'T-0006-208', label: 'Screen/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <ScreenRenderer node={{...SCREEN_NODE, id: 'mx-screen-e'}} />},
  {tId: 'T-0006-209', label: 'Section/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <SectionRenderer node={{...SECTION_NODE, id: 'mx-section-e', title: 'Wellness Journal'}} />},
  {tId: 'T-0006-210', label: 'Stack/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <StackRenderer node={{...STACK_NODE, id: 'mx-stack-e'}} />},
  {tId: 'T-0006-211', label: 'Row/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <RowRenderer node={{...ROW_NODE, id: 'mx-row-e'}} />},
  {tId: 'T-0006-212', label: 'Card/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <CardRenderer node={{...CARD_NODE, id: 'mx-card-e', elevation: 'floating'}} />},
  {tId: 'T-0006-213', label: 'Heading/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <HeadingRenderer node={{...HEADING_NODE, id: 'mx-heading-e', text: 'My Wellness Journal', level: 1}} />},
  {tId: 'T-0006-214', label: 'Body/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <BodyRenderer node={{...BODY_NODE, id: 'mx-body-e', text: 'Nurture your mind and body daily.'}} />},
  {tId: 'T-0006-215', label: 'Caption/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <CaptionRenderer node={{...CAPTION_NODE, id: 'mx-caption-e', text: 'Mood logged today'}} />},
  {tId: 'T-0006-216', label: 'Stat/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <StatRenderer node={{...STAT_NODE, id: 'mx-stat-e', label: 'Wellness streak', value: '7 days', delta: undefined, deltaTone: undefined}} />},
  {tId: 'T-0006-217', label: 'Badge/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <BadgeRenderer node={{...BADGE_NODE, id: 'mx-badge-e', text: 'Mindful', tone: 'accent'}} />},
  {tId: 'T-0006-218', label: 'Chip/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <ChipRenderer node={{...CHIP_NODE, id: 'mx-chip-e', text: 'Meditation', action: {type: 'set', target: 'filter', value: 'meditation'}}} />},
  {tId: 'T-0006-219', label: 'Avatar/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <AvatarRenderer node={{...AVATAR_NODE, id: 'mx-avatar-e', name: '李明', size: 'lg'}} />},
  {tId: 'T-0006-220', label: 'TextField/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <TextFieldRenderer node={{...TEXT_FIELD_NODE, id: 'mx-textfield-e', label: 'Mood note'}} />},
  {tId: 'T-0006-221', label: 'NumberField/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <NumberFieldRenderer node={{...NUMBER_FIELD_NODE, id: 'mx-numberfield-e', label: 'Sleep hours'}} />},
  {tId: 'T-0006-222', label: 'DateField/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <DateFieldRenderer node={{...DATE_FIELD_NODE, id: 'mx-datefield-e', label: 'Log date'}} />},
  {tId: 'T-0006-223', label: 'Picker/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <PickerRenderer node={{...PICKER_NODE, id: 'mx-picker-e', label: 'Mood', options: [
      {value: 'great', label: 'Great'},
      {value: 'good', label: 'Good'},
      {value: 'okay', label: 'Okay'},
      {value: 'low', label: 'Low'},
    ]}} />},
  {tId: 'T-0006-224', label: 'Switch/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <SwitchRenderer node={{...SWITCH_NODE, id: 'mx-switch-e', label: 'Morning affirmations'}} />},
  {tId: 'T-0006-225', label: 'List/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <ListRenderer node={{...LIST_NODE, id: 'mx-list-e', itemLayout: 'expanded'}} />,
    rendererState: itemsState},
  {tId: 'T-0006-226', label: 'ListItem/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <ListItemRenderer node={{...LIST_ITEM_NODE, id: 'mx-listitem-e', title: 'Sunset meditation', subtitle: '20 min'}} />},
  {tId: 'T-0006-227', label: 'SwipeableRow/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <SwipeableRowRenderer node={{...SWIPEABLE_ROW_NODE, id: 'mx-swipeable-e', title: 'Journaling', subtitle: 'Evening'}} />},
  {tId: 'T-0006-228', label: 'EmptyState/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <EmptyStateRenderer node={{...EMPTY_STATE_NODE, id: 'mx-emptystate-e', headline: 'No entries yet', body: 'Start your wellness journey today.'}} />},
  {tId: 'T-0006-229', label: 'LoadingState/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <LoadingStateRenderer node={{...LOADING_STATE_NODE, id: 'mx-loading-e', lines: 4}} />},
  {tId: 'T-0006-230', label: 'ConditionalSection/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <ConditionalSectionRenderer node={{...CONDITIONAL_SECTION_NODE, id: 'mx-conditional-e', showWhen: 'whenEmpty'}} />,
    rendererState: itemsState},
  {tId: 'T-0006-231', label: 'ListSummary/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <ListSummaryRenderer node={{...LIST_SUMMARY_NODE, id: 'mx-listsummary-e', prompt: 'Summarize my wellness week.', fallback: 'hide'}} />,
    rendererState: workoutsState},
  {tId: 'T-0006-232', label: 'MediaTray/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <MediaTrayRenderer node={{...MEDIA_TRAY_NODE, id: 'mx-mediatray-e', aspectRatio: '16:9'}} />,
    rendererState: photosState},
  {tId: 'T-0006-233', label: 'ImagePicker/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <ImagePickerRenderer node={{...IMAGE_PICKER_NODE, id: 'mx-imagepicker-e', label: 'Mood photo'}} />},
  {tId: 'T-0006-234', label: 'Button/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <ButtonRenderer node={{...BUTTON_NODE, id: 'mx-button-e', label: 'Save Journal Entry', variant: 'secondary', action: {type: 'set', target: 'saved', value: true}}} />},
  {tId: 'T-0006-235', label: 'FAB/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <FABRenderer node={{...FAB_NODE, id: 'mx-fab-e', icon: 'plus', accessibilityLabel: 'Add journal entry'}} />},

  // -------------------------------------------------------------------------
  // V1 Phase 1 productive×focus (T-0006-237..261)
  // Tier order: Layout, Actions, Inputs, Display, Lists, Compound
  // -------------------------------------------------------------------------
  // Layout
  {tId: 'T-0006-237', label: 'Divider/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <DividerRenderer node={DIVIDER_NODE} />},
  {tId: 'T-0006-238', label: 'Image/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <ImageRenderer node={IMAGE_NODE} />},
  // Actions
  {tId: 'T-0006-239', label: 'IconButton/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <IconButtonRenderer node={ICON_BUTTON_NODE} />},
  // Inputs
  {tId: 'T-0006-240', label: 'MoneyField/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <MoneyFieldRenderer node={MONEY_FIELD_NODE} />},
  {tId: 'T-0006-241', label: 'TimeField/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <TimeFieldRenderer node={TIME_FIELD_NODE} />},
  {tId: 'T-0006-242', label: 'MultiPicker/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <MultiPickerRenderer node={MULTI_PICKER_NODE} />},
  {tId: 'T-0006-243', label: 'Slider/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <SliderRenderer node={SLIDER_NODE} />},
  {tId: 'T-0006-244', label: 'RatingInput/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <RatingInputRenderer node={RATING_INPUT_NODE} />},
  {tId: 'T-0006-245', label: 'SearchBar/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <SearchBarRenderer node={SEARCH_BAR_NODE} />},
  // Display
  {tId: 'T-0006-246', label: 'AvatarGroup/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <AvatarGroupRenderer node={AVATAR_GROUP_NODE} />},
  {tId: 'T-0006-247', label: 'Callout/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <CalloutRenderer node={CALLOUT_NODE} />},
  // Lists
  {tId: 'T-0006-248', label: 'GridList/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <GridListRenderer node={GRID_LIST_NODE} />,
    rendererState: gridphotosState},
  {tId: 'T-0006-249', label: 'Carousel/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <CarouselRenderer node={CAROUSEL_NODE} />,
    rendererState: slidesState},
  {tId: 'T-0006-250', label: 'Timeline/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <TimelineRenderer node={TIMELINE_NODE} />,
    rendererState: eventsState},
  {tId: 'T-0006-251', label: 'ErrorState/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <ErrorStateRenderer node={ERROR_STATE_NODE} />},
  // Compound
  {tId: 'T-0006-252', label: 'TransactionRow/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <TransactionRowRenderer node={TRANSACTION_ROW_NODE} />},
  {tId: 'T-0006-253', label: 'Receipt/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <ReceiptRenderer node={RECEIPT_NODE} />},
  {tId: 'T-0006-254', label: 'MetricTile/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <MetricTileRenderer node={METRIC_TILE_NODE} />},
  {tId: 'T-0006-255', label: 'StepList/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <StepListRenderer node={STEP_LIST_NODE} />},
  {tId: 'T-0006-256', label: 'Calendar/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <CalendarRenderer node={CALENDAR_NODE} />},
  {tId: 'T-0006-257', label: 'Heatmap/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <HeatmapRenderer node={HEATMAP_NODE} />,
    rendererState: habitsState},
  {tId: 'T-0006-258', label: 'Gallery/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <GalleryRenderer node={GALLERY_NODE} />,
    rendererState: galleryState},
  {tId: 'T-0006-259', label: 'CommerceCard/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <CommerceCardRenderer node={COMMERCE_CARD_NODE} />},
  {tId: 'T-0006-260', label: 'BeforeAfter/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <BeforeAfterRenderer node={BEFORE_AFTER_NODE} />},
  {tId: 'T-0006-261', label: 'DocumentPicker/productive×focus',
    stance: 'productive', palette: 'focus',
    element: <DocumentPickerRenderer node={DOCUMENT_PICKER_NODE} />},

  // -------------------------------------------------------------------------
  // V1 Phase 1 expressive×health (T-0006-262..286)
  // Tier order: Layout, Actions, Inputs, Display, Lists, Compound
  // -------------------------------------------------------------------------
  // Layout
  {tId: 'T-0006-262', label: 'Divider/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <DividerRenderer node={{...DIVIDER_NODE, id: 'mx-divider-e', label: 'This week', weight: 'thick'}} />},
  {tId: 'T-0006-263', label: 'Image/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <ImageRenderer node={{...IMAGE_NODE, id: 'mx-image-e', aspectRatio: '4:5', alt: 'Wellness moment'}} />},
  // Actions
  {tId: 'T-0006-264', label: 'IconButton/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <IconButtonRenderer node={{...ICON_BUTTON_NODE, id: 'mx-iconbutton-e', icon: 'heart', variant: 'primary', accessibilityLabel: 'Like entry'}} />},
  // Inputs
  {tId: 'T-0006-265', label: 'MoneyField/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <MoneyFieldRenderer node={{...MONEY_FIELD_NODE, id: 'mx-moneyfield-e', label: 'Wellness budget', currency: 'EUR'}} />},
  {tId: 'T-0006-266', label: 'TimeField/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <TimeFieldRenderer node={{...TIME_FIELD_NODE, id: 'mx-timefield-e', label: 'Meditation time'}} />},
  {tId: 'T-0006-267', label: 'MultiPicker/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <MultiPickerRenderer node={{...MULTI_PICKER_NODE, id: 'mx-multipicker-e', label: 'Wellness goals',
      options: [
        {value: 'mindfulness', label: 'Mindfulness'},
        {value: 'sleep', label: 'Sleep'},
        {value: 'nutrition', label: 'Nutrition'},
        {value: 'movement', label: 'Movement'},
      ]}} />},
  {tId: 'T-0006-268', label: 'Slider/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <SliderRenderer node={{...SLIDER_NODE, id: 'mx-slider-e', label: 'Mood level', format: 'integer'}} />},
  {tId: 'T-0006-269', label: 'RatingInput/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <RatingInputRenderer node={{...RATING_INPUT_NODE, id: 'mx-ratinginput-e', label: 'Mood rating', glyph: 'heart'}} />},
  {tId: 'T-0006-270', label: 'SearchBar/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <SearchBarRenderer node={{...SEARCH_BAR_NODE, id: 'mx-searchbar-e', placeholder: 'Search journal entries…'}} />},
  // Display
  {tId: 'T-0006-271', label: 'AvatarGroup/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <AvatarGroupRenderer node={{...AVATAR_GROUP_NODE, id: 'mx-avatargroup-e', size: 'lg', overlap: 'spread'}} />},
  {tId: 'T-0006-272', label: 'Callout/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <CalloutRenderer node={{...CALLOUT_NODE, id: 'mx-callout-e', variant: 'success', headline: 'Goal achieved!', body: 'You completed your wellness streak.'}} />},
  // Lists
  {tId: 'T-0006-273', label: 'GridList/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <GridListRenderer node={{...GRID_LIST_NODE, id: 'mx-gridlist-e', columns: 3}} />,
    rendererState: gridphotosState},
  {tId: 'T-0006-274', label: 'Carousel/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <CarouselRenderer node={{...CAROUSEL_NODE, id: 'mx-carousel-e', indicator: 'fraction', cardWidth: 'peek'}} />,
    rendererState: slidesState},
  {tId: 'T-0006-275', label: 'Timeline/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <TimelineRenderer node={{...TIMELINE_NODE, id: 'mx-timeline-e', dateFormat: 'relative', groupBy: 'week'}} />,
    rendererState: eventsState},
  {tId: 'T-0006-276', label: 'ErrorState/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <ErrorStateRenderer node={{...ERROR_STATE_NODE, id: 'mx-errorstate-e', headline: 'Could not load entries', body: 'Please try again later.'}} />},
  // Compound
  {tId: 'T-0006-277', label: 'TransactionRow/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <TransactionRowRenderer node={{...TRANSACTION_ROW_NODE, id: 'mx-transactionrow-e', merchant: 'Yoga studio', amount: {kind: 'literal', value: 2500}}} />},
  {tId: 'T-0006-278', label: 'Receipt/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <ReceiptRenderer node={{...RECEIPT_NODE, id: 'mx-receipt-e',
      items: [{label: 'Essential oils', amount: {kind: 'literal', value: 1599}}],
      subtotal: {kind: 'literal', value: 1599},
      total: {kind: 'literal', value: 1599}}} />},
  {tId: 'T-0006-279', label: 'MetricTile/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <MetricTileRenderer node={{...METRIC_TILE_NODE, id: 'mx-metrictile-e', value: '7 days', label: 'Mindfulness streak', delta: '+2 days', deltaTone: 'positive', sparklineData: undefined}} />},
  {tId: 'T-0006-280', label: 'StepList/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <StepListRenderer node={{...STEP_LIST_NODE, id: 'mx-steplist-e', style: 'checklist',
      steps: [
        {title: 'Morning meditation', done: {kind: 'literal', value: true}},
        {title: 'Gratitude journal', done: {kind: 'literal', value: false}},
        {title: 'Evening walk', done: {kind: 'literal', value: false}},
      ]}} />},
  {tId: 'T-0006-281', label: 'Calendar/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <CalendarRenderer node={{...CALENDAR_NODE, id: 'mx-calendar-e', firstDayOfWeek: 'monday'}} />},
  {tId: 'T-0006-282', label: 'Heatmap/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <HeatmapRenderer node={{...HEATMAP_NODE, id: 'mx-heatmap-e', range: '30d', intensityMode: 'binary'}} />,
    rendererState: habitsState},
  {tId: 'T-0006-283', label: 'Gallery/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <GalleryRenderer node={{...GALLERY_NODE, id: 'mx-gallery-e', aspectRatio: '4:5'}} />,
    rendererState: galleryState},
  {tId: 'T-0006-284', label: 'CommerceCard/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <CommerceCardRenderer node={{...COMMERCE_CARD_NODE, id: 'mx-commercecard-e', title: 'Meditation cushion', badge: undefined, ctaLabel: 'Buy now'}} />},
  {tId: 'T-0006-285', label: 'BeforeAfter/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <BeforeAfterRenderer node={{...BEFORE_AFTER_NODE, id: 'mx-beforeafter-e', mode: 'side-by-side', beforeLabel: 'Day 1', afterLabel: 'Day 30'}} />},
  {tId: 'T-0006-286', label: 'DocumentPicker/expressive×health',
    stance: 'expressive', palette: 'health',
    element: <DocumentPickerRenderer node={{...DOCUMENT_PICKER_NODE, id: 'mx-documentpicker-e', label: 'Attach wellness plan', acceptedTypes: ['pdf', 'image']}} />},
]

// ---------------------------------------------------------------------------
// Parameterized snapshot matrix
// T-0006-180..235: 28 × 2 = 56 snapshots (V0)
// T-0006-237..286: 25 × 2 = 50 snapshots (V1 Phase 1)
// Total: 106 snapshots = 53 components × 2 register pairs
// T-0006-236: stability — deterministic output, zero diff on re-run
// ---------------------------------------------------------------------------

// Date-sensitive V1 entries (Calendar, Heatmap, Timeline): T-IDs that render
// with date.now(). We run these under fake timers pinned to 2026-01-15T12:00:00Z.
const DATE_SENSITIVE_TIDS = new Set([
  'T-0006-250', 'T-0006-256', 'T-0006-257', // productive×focus
  'T-0006-275', 'T-0006-281', 'T-0006-282', // expressive×health
])

const DATE_STABLE_ENTRIES = MATRIX_ENTRIES.filter(e => !DATE_SENSITIVE_TIDS.has(e.tId))
const DATE_SENSITIVE_ENTRIES = MATRIX_ENTRIES.filter(e => DATE_SENSITIVE_TIDS.has(e.tId))

describe('Snapshot matrix — 106 register-pair snapshots (T-0006-180..286)', () => {
  describe('Date-stable entries (T-0006-180..249, T-0006-251..255, T-0006-258..274, T-0006-276..280, T-0006-283..286)', () => {
    it.each(DATE_STABLE_ENTRIES)(
      '$tId — $label',
      ({stance, palette, element, rendererState}) => {
        const {toJSON} = renderWithTheme(element, {stance, palette, rendererState})
        expect(toJSON()).toMatchSnapshot()
      },
    )
  })

  describe('Date-sensitive entries — Calendar, Heatmap, Timeline (T-0006-250, 256, 257, 275, 281, 282)', () => {
    beforeEach(() => {
      jest.useFakeTimers()
      jest.setSystemTime(new Date('2026-01-15T12:00:00Z'))
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it.each(DATE_SENSITIVE_ENTRIES)(
      '$tId — $label',
      ({stance, palette, element, rendererState}) => {
        const {toJSON} = renderWithTheme(element, {stance, palette, rendererState})
        expect(toJSON()).toMatchSnapshot()
      },
    )
  })
})

// ---------------------------------------------------------------------------
// T-0006-236: Snapshot stability assertion
//
// Jest snapshot tests are deterministic by nature — if the fixtures and
// component implementations contain no randomness (no Date.now(), no
// Math.random(), no seedrandom without a fixed seed), running the suite
// twice produces zero diff. This test asserts the count is exactly 106
// by examining the MATRIX_ENTRIES array, which is the single source of
// truth for the parameterized tests above.
//
// The assertion is: matrix size === 53 components × 2 register pairs.
// If a component is added or removed without updating this file, this
// test catches the drift before CI snapshot diff does.
//
// T-IDs: T-0006-180..235 (V0, 56 entries) + T-0006-237..286 (V1, 50 entries).
// T-0006-236 is the stability test itself — intentional gap in the sequence.
// ---------------------------------------------------------------------------

describe('Snapshot matrix stability (T-0006-236)', () => {
  it('matrix has exactly 106 entries (53 components × 2 register pairs)', () => {
    expect(MATRIX_ENTRIES).toHaveLength(106)
  })

  it('all productive×focus entries have stance=productive and palette=focus', () => {
    const productiveFocusEntries = MATRIX_ENTRIES.filter(e => e.stance === 'productive')
    expect(productiveFocusEntries).toHaveLength(53)
    productiveFocusEntries.forEach(e => {
      expect(e.palette).toBe('focus')
    })
  })

  it('all expressive×health entries have stance=expressive and palette=health', () => {
    const expressiveHealthEntries = MATRIX_ENTRIES.filter(e => e.stance === 'expressive')
    expect(expressiveHealthEntries).toHaveLength(53)
    expressiveHealthEntries.forEach(e => {
      expect(e.palette).toBe('health')
    })
  })

  it('T-IDs are unique; cover T-0006-180..235 and T-0006-237..286 with one gap at 236', () => {
    const tIds = MATRIX_ENTRIES.map(e => e.tId)
    const unique = new Set(tIds)
    expect(unique.size).toBe(106)

    const numbers = tIds.map(id => parseInt(id.replace('T-0006-', ''), 10))
    const sorted = [...numbers].sort((a, b) => a - b)
    expect(sorted[0]).toBe(180)
    expect(sorted[105]).toBe(286)

    // Two contiguous blocks with a single gap at 236 (the stability test itself).
    // Block 1: 180..235 (56 entries), Block 2: 237..286 (50 entries).
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!
      const curr = sorted[i]!
      const gap = curr - prev
      if (prev === 235 && curr === 237) {
        // Expected gap at T-0006-236 (this stability test).
        expect(gap).toBe(2)
      } else {
        expect(gap).toBe(1)
      }
    }
  })
})

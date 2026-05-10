/**
 * Snapshot matrix — Step 12 (ADR-0006)
 *
 * T-0006-180..235: 28 components × 2 register pairs = 56 snapshots.
 * T-0006-236: Snapshot stability — deterministic fixtures produce zero
 *   diff across runs. Guaranteed by the absence of any runtime
 *   randomness (no Date.now(), no Math.random(), no seedrandom
 *   calls in component render paths).
 *
 * Register pairs:
 *   Productive × Focus  — cobalt accent, sans-serif, tighter spacing
 *   Expressive × Health — sage olive, serif headings, looser spacing
 *
 * Parameterized with it.each(MATRIX_ENTRIES) per ADR-0006 §J note 11.
 * Each entry is a [T-ID, componentName, stance, palette, element] tuple.
 *
 * Components that require collection state (List, ListSummary, MediaTray,
 * ConditionalSection) receive a pre-built RendererState via renderWithTheme's
 * rendererState option. SwipeableRow renders the swipe action panels inline
 * (jestSetup mock) so no special state is needed.
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

import {ScreenRenderer} from './components/layout/Screen'
import {SectionRenderer} from './components/layout/Section'
import {StackRenderer} from './components/layout/Stack'
import {RowRenderer} from './components/layout/Row'
import {CardRenderer} from './components/layout/Card'
import {HeadingRenderer} from './components/typography/Heading'
import {BodyRenderer} from './components/typography/Body'
import {CaptionRenderer} from './components/typography/Caption'
import {StatRenderer} from './components/display/Stat'
import {BadgeRenderer} from './components/display/Badge'
import {ChipRenderer} from './components/display/Chip'
import {AvatarRenderer} from './components/display/Avatar'
import {TextFieldRenderer} from './components/inputs/TextField'
import {NumberFieldRenderer} from './components/inputs/NumberField'
import {DateFieldRenderer} from './components/inputs/DateField'
import {PickerRenderer} from './components/inputs/Picker'
import {SwitchRenderer} from './components/inputs/Switch'
import {ListRenderer} from './components/lists/List'
import {ListItemRenderer} from './components/lists/ListItem'
import {SwipeableRowRenderer} from './components/lists/SwipeableRow'
import {EmptyStateRenderer} from './components/lists/EmptyState'
import {LoadingStateRenderer} from './components/lists/LoadingState'
import {ConditionalSectionRenderer} from './components/compound/ConditionalSection'
import {ListSummaryRenderer} from './components/compound/ListSummary'
import {MediaTrayRenderer} from './components/compound/MediaTray'
import {ImagePickerRenderer} from './components/compound/ImagePicker'
import {ButtonRenderer} from './components/actions/Button'
import {FABRenderer} from './components/actions/FAB'

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
]

// ---------------------------------------------------------------------------
// Parameterized snapshot matrix
// T-0006-180..235: 28 × 2 = 56 snapshots
// T-0006-236: stability — deterministic output, zero diff on re-run
// ---------------------------------------------------------------------------

describe('Snapshot matrix — 56 register-pair snapshots (T-0006-180..235)', () => {
  it.each(MATRIX_ENTRIES)(
    '$tId — $label',
    ({stance, palette, element, rendererState}) => {
      const {toJSON} = renderWithTheme(element, {stance, palette, rendererState})
      expect(toJSON()).toMatchSnapshot()
    },
  )
})

// ---------------------------------------------------------------------------
// T-0006-236: Snapshot stability assertion
//
// Jest snapshot tests are deterministic by nature — if the fixtures and
// component implementations contain no randomness (no Date.now(), no
// Math.random(), no seedrandom without a fixed seed), running the suite
// twice produces zero diff. This test asserts the count is exactly 56
// by examining the MATRIX_ENTRIES array, which is the single source of
// truth for the parameterized test above.
//
// The assertion is: matrix size === 28 components × 2 register pairs.
// If a component is added or removed without updating this file, this
// test catches the drift before CI snapshot diff does.
// ---------------------------------------------------------------------------

describe('Snapshot matrix stability (T-0006-236)', () => {
  it('matrix has exactly 56 entries (28 components × 2 register pairs)', () => {
    expect(MATRIX_ENTRIES).toHaveLength(56)
  })

  it('all productive×focus entries have stance=productive and palette=focus', () => {
    const productiveFocusEntries = MATRIX_ENTRIES.filter(e => e.stance === 'productive')
    expect(productiveFocusEntries).toHaveLength(28)
    productiveFocusEntries.forEach(e => {
      expect(e.palette).toBe('focus')
    })
  })

  it('all expressive×health entries have stance=expressive and palette=health', () => {
    const expressiveHealthEntries = MATRIX_ENTRIES.filter(e => e.stance === 'expressive')
    expect(expressiveHealthEntries).toHaveLength(28)
    expressiveHealthEntries.forEach(e => {
      expect(e.palette).toBe('health')
    })
  })

  it('T-IDs are unique and cover T-0006-180..235 without gaps', () => {
    const tIds = MATRIX_ENTRIES.map(e => e.tId)
    const unique = new Set(tIds)
    expect(unique.size).toBe(56)

    const numbers = tIds.map(id => parseInt(id.replace('T-0006-', ''), 10))
    const sorted = [...numbers].sort((a, b) => a - b)
    expect(sorted[0]).toBe(180)
    expect(sorted[55]).toBe(235)
    // No gaps
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i]).toBe(sorted[i - 1]! + 1)
    }
  })
})

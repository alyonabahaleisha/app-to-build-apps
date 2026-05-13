/**
 * Canonical minimal-required-prop fixtures for all 28 component schemas.
 * Reused across Step 4 happy/failure tests and Step 5/6 spec fixtures.
 *
 * Each fixture is the smallest valid object that satisfies the schema.
 * Optional props are intentionally omitted so tests focus on required-prop behavior.
 */

// ---- Bindings (required by input component fixtures) ----

export const STRING_BINDING_LITERAL = {kind: 'literal' as const, value: 'hello'}
export const NUMBER_BINDING_LITERAL = {kind: 'literal' as const, value: 42}
export const BOOLEAN_BINDING_LITERAL = {kind: 'literal' as const, value: true}
export const DATE_BINDING_LITERAL = {kind: 'literal' as const, value: '2026-05-07'}
export const IMAGE_BINDING_LITERAL = {kind: 'literal' as const, value: 'file://photo.jpg'}

export const STRING_BINDING_STATE = {kind: 'state' as const, slot: 'mySlot'}
export const NUMBER_BINDING_STATE = {kind: 'state' as const, slot: 'countSlot'}
export const BOOLEAN_BINDING_STATE = {kind: 'state' as const, slot: 'toggleSlot'}
export const DATE_BINDING_STATE = {kind: 'state' as const, slot: 'dateSlot'}
export const IMAGE_BINDING_STATE = {kind: 'state' as const, slot: 'photoSlot'}

export const STRING_BINDING_COLLECTION = {
  kind: 'collectionField' as const,
  collectionId: 'workouts',
  field: 'name',
}
export const NUMBER_BINDING_COLLECTION = {
  kind: 'collectionField' as const,
  collectionId: 'workouts',
  field: 'reps',
}
export const BOOLEAN_BINDING_COLLECTION = {
  kind: 'collectionField' as const,
  collectionId: 'tasks',
  field: 'done',
}
export const DATE_BINDING_COLLECTION = {
  kind: 'collectionField' as const,
  collectionId: 'workouts',
  field: 'date',
}
export const IMAGE_BINDING_COLLECTION = {
  kind: 'collectionField' as const,
  collectionId: 'journal',
  field: 'photo',
}

// ---- Action fixture ----

export const TOAST_ACTION = {
  type: 'toast' as const,
  message: 'Done',
}

export const BACK_ACTION = {type: 'back' as const}

// ---- Slot fixtures ----

export const SLOT_NONE = {kind: 'none' as const}
export const SLOT_ICON = {kind: 'icon' as const, name: 'star'}
export const SLOT_AVATAR = {
  kind: 'avatar' as const,
  node: {id: 'av1', type: 'Avatar' as const, name: 'Alice'},
}
export const SLOT_BADGE = {
  kind: 'badge' as const,
  node: {id: 'bd1', type: 'Badge' as const, text: 'New'},
}

// ---- Layout tier fixtures ----

export const SCREEN_FIXTURE = {
  id: 's1',
  type: 'Screen' as const,
  children: [],
}

export const SECTION_FIXTURE = {
  id: 'sec1',
  type: 'Section' as const,
  children: [],
}

export const STACK_FIXTURE = {
  id: 'stk1',
  type: 'Stack' as const,
  children: [],
}

export const ROW_FIXTURE = {
  id: 'row1',
  type: 'Row' as const,
  children: [],
}

export const CARD_FIXTURE = {
  id: 'crd1',
  type: 'Card' as const,
  children: [],
}

// ---- Typography tier fixtures ----

export const HEADING_FIXTURE = {
  id: 'hd1',
  type: 'Heading' as const,
  text: 'My Heading',
}

export const BODY_FIXTURE = {
  id: 'bd1',
  type: 'Body' as const,
  text: 'Some body text.',
}

export const CAPTION_FIXTURE = {
  id: 'cap1',
  type: 'Caption' as const,
  text: 'A caption.',
}

// ---- Inputs tier fixtures ----

export const TEXT_FIELD_FIXTURE = {
  id: 'tf1',
  type: 'TextField' as const,
  label: 'Name',
  valueBinding: STRING_BINDING_LITERAL,
}

export const NUMBER_FIELD_FIXTURE = {
  id: 'nf1',
  type: 'NumberField' as const,
  label: 'Reps',
  valueBinding: NUMBER_BINDING_LITERAL,
}

export const DATE_FIELD_FIXTURE = {
  id: 'df1',
  type: 'DateField' as const,
  label: 'Date',
  valueBinding: DATE_BINDING_LITERAL,
}

export const PICKER_FIXTURE = {
  id: 'pk1',
  type: 'Picker' as const,
  label: 'Category',
  valueBinding: STRING_BINDING_LITERAL,
  options: [{value: 'a', label: 'Option A'}],
}

export const SWITCH_FIXTURE = {
  id: 'sw1',
  type: 'Switch' as const,
  label: 'Enable',
  valueBinding: BOOLEAN_BINDING_LITERAL,
}

// ---- Display tier fixtures ----

export const STAT_FIXTURE = {
  id: 'st1',
  type: 'Stat' as const,
  value: '42',
  label: 'Total',
}

// STAT_FIXTURE_WITH_BINDING — a Stat that tracks a state slot (counter, total, etc.)
export const STAT_FIXTURE_WITH_BINDING = {
  id: 'st2',
  type: 'Stat' as const,
  valueBinding: {kind: 'state' as const, slot: 'count'},
  label: 'Current count',
}

export const BADGE_FIXTURE = {
  id: 'bg1',
  type: 'Badge' as const,
  text: 'New',
}

export const CHIP_FIXTURE = {
  id: 'ch1',
  type: 'Chip' as const,
  text: 'All',
}

export const AVATAR_FIXTURE = {
  id: 'av1',
  type: 'Avatar' as const,
  name: 'Alice',
}

// ---- Lists tier fixtures ----

export const LIST_FIXTURE = {
  id: 'lst1',
  type: 'List' as const,
  collectionId: 'workouts',
}

export const LIST_ITEM_FIXTURE = {
  id: 'li1',
  type: 'ListItem' as const,
  title: 'Morning Run',
}

export const SWIPEABLE_ROW_FIXTURE = {
  id: 'sr1',
  type: 'SwipeableRow' as const,
  title: 'Morning Run',
}

export const EMPTY_STATE_FIXTURE = {
  id: 'es1',
  type: 'EmptyState' as const,
  icon: 'list',
  headline: 'No items yet',
}

export const LOADING_STATE_FIXTURE = {
  id: 'ls1',
  type: 'LoadingState' as const,
}

// ---- Compound tier fixtures ----

export const CONDITIONAL_SECTION_FIXTURE = {
  id: 'cs1',
  type: 'ConditionalSection' as const,
  collectionId: 'workouts',
  showWhen: 'whenEmpty' as const,
  children: [],
}

export const LIST_SUMMARY_FIXTURE = {
  id: 'lsum1',
  type: 'ListSummary' as const,
  collectionId: 'workouts',
  prompt: 'Summarize last week.',
}

export const MEDIA_TRAY_FIXTURE = {
  id: 'mt1',
  type: 'MediaTray' as const,
  collectionId: 'journal',
  imageField: 'photo',
}

export const IMAGE_PICKER_FIXTURE = {
  id: 'ip1',
  type: 'ImagePicker' as const,
  label: 'Photo',
  valueBinding: IMAGE_BINDING_LITERAL,
}

// ---- Actions tier fixtures ----

export const BUTTON_FIXTURE = {
  id: 'btn1',
  type: 'Button' as const,
  label: 'Submit',
  action: TOAST_ACTION,
}

export const FAB_FIXTURE = {
  id: 'fab1',
  type: 'FAB' as const,
  icon: 'plus',
  action: TOAST_ACTION,
  accessibilityLabel: 'Add item',
}

// ---- All 28 fixtures in order (matches ADR T-0005-072..097 parameterized tests) ----

export const ALL_COMPONENT_FIXTURES = [
  {name: 'Screen', fixture: SCREEN_FIXTURE},
  {name: 'Section', fixture: SECTION_FIXTURE},
  {name: 'Stack', fixture: STACK_FIXTURE},
  {name: 'Row', fixture: ROW_FIXTURE},
  {name: 'Card', fixture: CARD_FIXTURE},
  {name: 'Heading', fixture: HEADING_FIXTURE},
  {name: 'Body', fixture: BODY_FIXTURE},
  {name: 'Caption', fixture: CAPTION_FIXTURE},
  {name: 'TextField', fixture: TEXT_FIELD_FIXTURE},
  {name: 'NumberField', fixture: NUMBER_FIELD_FIXTURE},
  {name: 'DateField', fixture: DATE_FIELD_FIXTURE},
  {name: 'Picker', fixture: PICKER_FIXTURE},
  {name: 'Switch', fixture: SWITCH_FIXTURE},
  {name: 'Stat', fixture: STAT_FIXTURE},
  {name: 'Badge', fixture: BADGE_FIXTURE},
  {name: 'Chip', fixture: CHIP_FIXTURE},
  {name: 'Avatar', fixture: AVATAR_FIXTURE},
  {name: 'List', fixture: LIST_FIXTURE},
  {name: 'ListItem', fixture: LIST_ITEM_FIXTURE},
  {name: 'SwipeableRow', fixture: SWIPEABLE_ROW_FIXTURE},
  {name: 'EmptyState', fixture: EMPTY_STATE_FIXTURE},
  {name: 'LoadingState', fixture: LOADING_STATE_FIXTURE},
  {name: 'ConditionalSection', fixture: CONDITIONAL_SECTION_FIXTURE},
  {name: 'ListSummary', fixture: LIST_SUMMARY_FIXTURE},
  {name: 'MediaTray', fixture: MEDIA_TRAY_FIXTURE},
  {name: 'ImagePicker', fixture: IMAGE_PICKER_FIXTURE},
  {name: 'Button', fixture: BUTTON_FIXTURE},
  {name: 'FAB', fixture: FAB_FIXTURE},
] as const

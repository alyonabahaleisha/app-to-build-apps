/**
 * NodeRenderer tests
 * T-0006-062: NodeRenderer discriminates 5 layout types correctly
 *             (extended to 12 in Step 5, 17 in Step 6, 22 in Step 7, 26 in Step 8,
 *             33 in V1P1S1+S3, 39 in V1P1S2, 43 in V1P1S4)
 * T-0006-063: NodeRenderer with unknown type calls host.onUnknownNodeType + renders null
 * T-0009-109: NodeRenderer 43-arm boundary test
 */
import React from 'react'
import {render} from '@testing-library/react-native'
import type {Node, Spec} from '@app-creator/protocol'
import {RendererThemeProvider} from '../theme/RendererThemeProvider'
import {HostProvider} from '../host/HostContext'
import type {HostCallbacks} from '../state/hostCallbacks'
import {RendererStateContext} from '../state/useRendererState'
import {buildInitialRendererState} from '../state/reducer'
import {NodeRenderer} from './NodeRenderer'

// Mock AICapabilitiesProvider to avoid native module checks for compound components.
jest.mock('../ai/AICapabilitiesProvider', () => {
  const original = jest.requireActual('../ai/AICapabilitiesProvider')
  return {
    ...original,
    useAICapabilities: jest.fn().mockReturnValue({isSupported: false}),
  }
})

// ---------------------------------------------------------------------------
// Test wrapper
// ---------------------------------------------------------------------------

// Minimal spec for RendererStateContext used by input components.
// Includes a 'workouts' collection for compound tier components (Step 8).
// Includes an 'events' collection for V1P1S4 Timeline / GridList / Carousel.
const MINIMAL_SPEC: Spec = {
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
      id: 'workouts',
      name: 'Workouts',
      fields: [
        {name: 'name', type: {type: 'string'} as const, required: true},
        {name: 'uri', type: {type: 'image'} as const, required: false},
      ],
      seedData: [{name: 'Morning run', uri: 'file://run.jpg'}],
      syncMode: 'local' as const,
    },
    {
      id: 'events',
      name: 'Events',
      fields: [
        {name: 'title', type: {type: 'string'} as const, required: true},
        {name: 'createdAt', type: {type: 'date'} as const, required: true},
      ],
      seedData: [{title: 'Kickoff', createdAt: '2026-01-01T09:00:00Z'}],
      syncMode: 'local' as const,
    },
  ],
  initialState: {textSlot: '', numSlot: 0, boolSlot: false, dateSlot: '2026-01-01', strSlot: '', photoSlot: ''},
}

const MINIMAL_STATE = buildInitialRendererState(MINIMAL_SPEC)

function makeHostCallbacks(overrides?: Partial<HostCallbacks>): HostCallbacks {
  return {
    onToast: jest.fn(),
    onAIError: jest.fn(),
    onUnknownNodeType: jest.fn(),
    ...overrides,
  }
}

function renderNode(node: Node, host: HostCallbacks) {
  return render(
    <RendererThemeProvider stance="productive" palette="focus">
      <HostProvider value={host}>
        <RendererStateContext.Provider value={{state: MINIMAL_STATE, dispatch: jest.fn()}}>
          <NodeRenderer node={node} />
        </RendererStateContext.Provider>
      </HostProvider>
    </RendererThemeProvider>,
  )
}

// ---------------------------------------------------------------------------
// Minimal node fixtures — layout tier (Step 4)
// ---------------------------------------------------------------------------

const SCREEN: Extract<Node, {type: 'Screen'}> = {
  id: 's1',
  type: 'Screen',
  children: [],
}

const SECTION: Extract<Node, {type: 'Section'}> = {
  id: 'sec1',
  type: 'Section',
  children: [],
}

const STACK: Extract<Node, {type: 'Stack'}> = {
  id: 'stk1',
  type: 'Stack',
  children: [],
}

const ROW: Extract<Node, {type: 'Row'}> = {
  id: 'row1',
  type: 'Row',
  children: [],
}

const CARD: Extract<Node, {type: 'Card'}> = {
  id: 'card1',
  type: 'Card',
  children: [],
}

// ---------------------------------------------------------------------------
// Minimal node fixtures — typography tier (Step 5)
// ---------------------------------------------------------------------------

const HEADING: Extract<Node, {type: 'Heading'}> = {
  id: 'hdg1',
  type: 'Heading',
  text: 'Welcome',
}

const BODY: Extract<Node, {type: 'Body'}> = {
  id: 'bdy1',
  type: 'Body',
  text: "Here's what's on deck today.",
}

const CAPTION: Extract<Node, {type: 'Caption'}> = {
  id: 'cap1',
  type: 'Caption',
  text: 'Created 3 days ago',
}

// ---------------------------------------------------------------------------
// Minimal node fixtures — display tier (Step 5)
// ---------------------------------------------------------------------------

const STAT: Extract<Node, {type: 'Stat'}> = {
  id: 'stat1',
  type: 'Stat',
  value: '5',
  label: 'tasks',
}

const BADGE: Extract<Node, {type: 'Badge'}> = {
  id: 'bdg1',
  type: 'Badge',
  text: 'Active',
}

const CHIP: Extract<Node, {type: 'Chip'}> = {
  id: 'chp1',
  type: 'Chip',
  text: 'Filter',
}

const AVATAR: Extract<Node, {type: 'Avatar'}> = {
  id: 'avt1',
  type: 'Avatar',
  name: 'Alex Johnson',
}

// ---------------------------------------------------------------------------
// Minimal node fixtures — inputs tier (Step 6)
// ---------------------------------------------------------------------------

const TEXTFIELD: Extract<Node, {type: 'TextField'}> = {
  id: 'tf1',
  type: 'TextField',
  label: 'Task title',
  valueBinding: {kind: 'state', slot: 'textSlot'},
}

const NUMBERFIELD: Extract<Node, {type: 'NumberField'}> = {
  id: 'nf1',
  type: 'NumberField',
  label: 'Quantity',
  valueBinding: {kind: 'state', slot: 'numSlot'},
}

const DATEFIELD: Extract<Node, {type: 'DateField'}> = {
  id: 'df1',
  type: 'DateField',
  label: 'Due date',
  valueBinding: {kind: 'state', slot: 'dateSlot'},
}

const PICKER: Extract<Node, {type: 'Picker'}> = {
  id: 'pk1',
  type: 'Picker',
  label: 'Priority',
  valueBinding: {kind: 'state', slot: 'strSlot'},
  options: [{value: 'low', label: 'Low'}, {value: 'high', label: 'High'}],
}

const SWITCH: Extract<Node, {type: 'Switch'}> = {
  id: 'sw1',
  type: 'Switch',
  label: 'Enable',
  valueBinding: {kind: 'state', slot: 'boolSlot'},
}

// ---------------------------------------------------------------------------
// Minimal node fixtures — lists tier (Step 7)
// ---------------------------------------------------------------------------

const LIST: Extract<Node, {type: 'List'}> = {
  id: 'lst1',
  type: 'List',
  collectionId: 'workouts',
}

const LIST_ITEM: Extract<Node, {type: 'ListItem'}> = {
  id: 'li1',
  type: 'ListItem',
  title: 'Morning workout',
}

const SWIPEABLE_ROW: Extract<Node, {type: 'SwipeableRow'}> = {
  id: 'sr1',
  type: 'SwipeableRow',
  title: 'Push-ups',
  trailingAction: {type: 'removeItem', collection: 'workouts', itemId: 'row_1'},
}

const EMPTY_STATE: Extract<Node, {type: 'EmptyState'}> = {
  id: 'es1',
  type: 'EmptyState',
  icon: 'list',
  headline: 'No items',
}

const LOADING_STATE: Extract<Node, {type: 'LoadingState'}> = {
  id: 'ls1',
  type: 'LoadingState',
  lines: 3,
}

// ---------------------------------------------------------------------------
// Minimal node fixtures — compound tier (Step 8)
// ---------------------------------------------------------------------------

const CONDITIONAL_SECTION: Extract<Node, {type: 'ConditionalSection'}> = {
  id: 'cs1',
  type: 'ConditionalSection',
  collectionId: 'workouts',
  showWhen: 'whenNotEmpty',
  children: [],
}

const LIST_SUMMARY: Extract<Node, {type: 'ListSummary'}> = {
  id: 'lsm1',
  type: 'ListSummary',
  collectionId: 'workouts',
  prompt: 'Summarize these workouts.',
  fallback: 'hide',
}

const MEDIA_TRAY: Extract<Node, {type: 'MediaTray'}> = {
  id: 'mtr1',
  type: 'MediaTray',
  collectionId: 'workouts',
  imageField: 'uri',
  aspectRatio: '1:1',
}

const IMAGE_PICKER: Extract<Node, {type: 'ImagePicker'}> = {
  id: 'ip1',
  type: 'ImagePicker',
  label: 'Profile photo',
  valueBinding: {kind: 'state', slot: 'photoSlot'},
}

// ---------------------------------------------------------------------------
// Minimal node fixtures — actions tier (Step 9)
// ---------------------------------------------------------------------------

const BUTTON: Extract<Node, {type: 'Button'}> = {
  id: 'btn1',
  type: 'Button',
  label: 'Add Item',
  action: {type: 'addItem', collection: 'workouts', item: {name: 'New'}},
}

const FAB: Extract<Node, {type: 'FAB'}> = {
  id: 'fab1',
  type: 'FAB',
  icon: 'plus',
  action: {type: 'addItem', collection: 'workouts', item: {name: 'New'}},
  accessibilityLabel: 'Add item',
}

// ---------------------------------------------------------------------------
// Minimal node fixtures — V1 Phase 1 Step 1 (Divider, Image, IconButton)
// ---------------------------------------------------------------------------

const DIVIDER: Extract<Node, {type: 'Divider'}> = {
  id: 'div1',
  type: 'Divider',
}

const IMAGE: Extract<Node, {type: 'Image'}> = {
  id: 'img1',
  type: 'Image',
  source: {kind: 'literal', value: 'https://example.com/photo.jpg'},
  alt: 'A sunset',
}

const ICON_BUTTON: Extract<Node, {type: 'IconButton'}> = {
  id: 'icb1',
  type: 'IconButton',
  icon: 'plus',
  action: {type: 'toast', message: 'Done'},
  accessibilityLabel: 'Add item',
}

// ---------------------------------------------------------------------------
// Minimal node fixtures — V1 Phase 1 Step 3 (AvatarGroup, Callout)
// ---------------------------------------------------------------------------

const AVATAR_GROUP: Extract<Node, {type: 'AvatarGroup'}> = {
  id: 'ag1',
  type: 'AvatarGroup',
  avatars: [{name: 'Alex'}, {name: 'Sam'}],
}

const CALLOUT: Extract<Node, {type: 'Callout'}> = {
  id: 'cal1',
  type: 'Callout',
  variant: 'info',
  headline: 'Note',
}

// ---------------------------------------------------------------------------
// Minimal node fixtures — V1 Phase 1 Step 2 (MoneyField, TimeField, MultiPicker,
//                          Slider, RatingInput, SearchBar)
// ---------------------------------------------------------------------------

const MONEYFIELD: Extract<Node, {type: 'MoneyField'}> = {
  id: 'mf1',
  type: 'MoneyField',
  label: 'Amount',
  valueBinding: {kind: 'state', slot: 'numSlot'},
}

const TIMEFIELD: Extract<Node, {type: 'TimeField'}> = {
  id: 'tif1',
  type: 'TimeField',
  label: 'Meeting time',
  valueBinding: {kind: 'state', slot: 'strSlot'},
}

const MULTIPICKER: Extract<Node, {type: 'MultiPicker'}> = {
  id: 'mp1',
  type: 'MultiPicker',
  label: 'Tags',
  valueBinding: {kind: 'state', slot: 'strSlot'},
  options: [{value: 'a', label: 'A'}, {value: 'b', label: 'B'}],
}

const SLIDER: Extract<Node, {type: 'Slider'}> = {
  id: 'sl1',
  type: 'Slider',
  label: 'Volume',
  valueBinding: {kind: 'state', slot: 'numSlot'},
  min: 0,
  max: 100,
}

const RATING_INPUT: Extract<Node, {type: 'RatingInput'}> = {
  id: 'ri1',
  type: 'RatingInput',
  label: 'Rating',
  valueBinding: {kind: 'state', slot: 'numSlot'},
}

const SEARCH_BAR: Extract<Node, {type: 'SearchBar'}> = {
  id: 'sb1',
  type: 'SearchBar',
  valueBinding: {kind: 'state', slot: 'strSlot'},
  placeholder: 'Search...',
}

// ---------------------------------------------------------------------------
// Minimal node fixtures — V1 Phase 1 Step 4 (GridList, Carousel, Timeline, ErrorState)
// ---------------------------------------------------------------------------

const GRID_LIST: Extract<Node, {type: 'GridList'}> = {
  id: 'gl1',
  type: 'GridList',
  collectionId: 'events',
}

const CAROUSEL: Extract<Node, {type: 'Carousel'}> = {
  id: 'car1',
  type: 'Carousel',
  collectionId: 'events',
}

const TIMELINE: Extract<Node, {type: 'Timeline'}> = {
  id: 'tl1',
  type: 'Timeline',
  collectionId: 'events',
  dateField: 'createdAt',
}

const ERROR_STATE: Extract<Node, {type: 'ErrorState'}> = {
  id: 'err1',
  type: 'ErrorState',
  headline: 'Something went wrong',
}

// ---------------------------------------------------------------------------
// T-0006-062 (extended V1 Phase 1 Step 4): NodeRenderer discriminates 43 types correctly
// T-0009-109: 43-arm boundary test
// ---------------------------------------------------------------------------

describe('NodeRenderer discrimination (T-0006-062 — Step 4 extended to 43 arms, T-0009-109)', () => {
  // Suppress console.warn for List/MediaTray/ConditionalSection with
  // unknown or empty collectionId variations.
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it.each([
    // Layout tier (6)
    ['Screen', SCREEN],
    ['Section', SECTION],
    ['Stack', STACK],
    ['Row', ROW],
    ['Card', CARD],
    ['Divider', DIVIDER],
    // Typography tier (3)
    ['Heading', HEADING],
    ['Body', BODY],
    ['Caption', CAPTION],
    // Display tier (6)
    ['Stat', STAT],
    ['Badge', BADGE],
    ['Chip', CHIP],
    ['Avatar', AVATAR],
    ['AvatarGroup', AVATAR_GROUP],
    ['Callout', CALLOUT],
    // Inputs tier (11)
    ['TextField', TEXTFIELD],
    ['NumberField', NUMBERFIELD],
    ['DateField', DATEFIELD],
    ['Picker', PICKER],
    ['Switch', SWITCH],
    ['MoneyField', MONEYFIELD],
    ['TimeField', TIMEFIELD],
    ['MultiPicker', MULTIPICKER],
    ['Slider', SLIDER],
    ['RatingInput', RATING_INPUT],
    ['SearchBar', SEARCH_BAR],
    // Lists tier (9)
    ['List', LIST],
    ['ListItem', LIST_ITEM],
    ['SwipeableRow', SWIPEABLE_ROW],
    ['EmptyState', EMPTY_STATE],
    ['LoadingState', LOADING_STATE],
    ['GridList', GRID_LIST],
    ['Carousel', CAROUSEL],
    ['Timeline', TIMELINE],
    ['ErrorState', ERROR_STATE],
    // Compound tier (5)
    ['ConditionalSection', CONDITIONAL_SECTION],
    ['ListSummary', LIST_SUMMARY],
    ['MediaTray', MEDIA_TRAY],
    ['ImagePicker', IMAGE_PICKER],
    ['Image', IMAGE],
    // Actions tier (3)
    ['Button', BUTTON],
    ['FAB', FAB],
    ['IconButton', ICON_BUTTON],
  ] as [string, Node][])('renders %s without error', (_type, node) => {
    const host = makeHostCallbacks()
    const {toJSON} = renderNode(node, host)

    // List/GridList/Carousel/Timeline with unknown or empty collectionId may render empty View (not null).
    // ListSummary with fallback=hide renders null when AI unsupported.
    // All other nodes render non-null.
    if (_type !== 'ListSummary') {
      expect(toJSON()).not.toBeNull()
    }
    // onUnknownNodeType must NOT be called for known types.
    expect(host.onUnknownNodeType).not.toHaveBeenCalled()
  })

  // T-0009-109: 43-arm boundary test — all arms present, none call onUnknownNodeType
  it('T-0009-109: does not call onUnknownNodeType for any of the 43 node types', () => {
    const host = makeHostCallbacks()
    const allNodes: Node[] = [
      // Layout (6)
      SCREEN, SECTION, STACK, ROW, CARD, DIVIDER,
      // Typography (3)
      HEADING, BODY, CAPTION,
      // Display (6)
      STAT, BADGE, CHIP, AVATAR, AVATAR_GROUP, CALLOUT,
      // Inputs (11)
      TEXTFIELD, NUMBERFIELD, DATEFIELD, PICKER, SWITCH,
      MONEYFIELD, TIMEFIELD, MULTIPICKER, SLIDER, RATING_INPUT, SEARCH_BAR,
      // Lists (9)
      LIST, LIST_ITEM, SWIPEABLE_ROW, EMPTY_STATE, LOADING_STATE,
      GRID_LIST, CAROUSEL, TIMELINE, ERROR_STATE,
      // Compound (5)
      CONDITIONAL_SECTION, LIST_SUMMARY, MEDIA_TRAY, IMAGE_PICKER, IMAGE,
      // Actions (3)
      BUTTON, FAB, ICON_BUTTON,
    ]
    // Total: 6 + 3 + 6 + 11 + 9 + 5 + 3 = 43
    expect(allNodes.length).toBe(43)

    for (const node of allNodes) {
      renderNode(node, host)
    }
    expect(host.onUnknownNodeType).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// T-0006-063: NodeRenderer with unknown type calls host.onUnknownNodeType
// and renders null (no visible output)
// ---------------------------------------------------------------------------

describe('NodeRenderer defensive default (T-0006-063)', () => {
  it('calls host.onUnknownNodeType with the unknown type string', () => {
    const host = makeHostCallbacks()
    // Cast a fictional node type through the type system.
    const unknownNode = {id: 'unk1', type: 'UnknownWidget'} as unknown as Node

    renderNode(unknownNode, host)

    expect(host.onUnknownNodeType).toHaveBeenCalledTimes(1)
    expect(host.onUnknownNodeType).toHaveBeenCalledWith('UnknownWidget')
  })

  it('renders null (empty tree) for an unknown node type', () => {
    const host = makeHostCallbacks()
    const unknownNode = {id: 'unk2', type: 'FutureComponent'} as unknown as Node

    const {toJSON} = renderNode(unknownNode, host)

    // NodeRenderer returns null for unknown types; the root wrapper renders
    // an empty React tree — toJSON() returns null for a purely-null render.
    expect(toJSON()).toBeNull()
  })

  it('does not throw when onUnknownNodeType is not provided by host', () => {
    const host: HostCallbacks = {
      onToast: jest.fn(),
      onAIError: jest.fn(),
      // onUnknownNodeType intentionally omitted — optional in HostCallbacks
    }
    const unknownNode = {id: 'unk3', type: 'AnotherFuture'} as unknown as Node

    expect(() => renderNode(unknownNode, host)).not.toThrow()
  })
})

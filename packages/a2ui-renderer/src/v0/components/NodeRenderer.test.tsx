/**
 * NodeRenderer tests
 * T-0006-062: NodeRenderer discriminates 5 layout types correctly
 *             (extended to 12 in Step 5, 17 in Step 6)
 * T-0006-063: NodeRenderer with unknown type calls host.onUnknownNodeType + renders null
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

// ---------------------------------------------------------------------------
// Test wrapper
// ---------------------------------------------------------------------------

// Minimal spec for RendererStateContext used by input components.
const MINIMAL_SPEC: Spec = {
  version: 1,
  archetype: 'ListCRUD',
  stance: 'productive',
  palette: 'focus',
  coverIcon: 'list',
  navigation: 'none',
  screens: [{id: 's1', root: {id: 'n1', type: 'Heading', text: 'T', level: 1}}],
  initialScreenId: 's1',
  collections: [],
  initialState: {textSlot: '', numSlot: 0, boolSlot: false, dateSlot: '2026-01-01', strSlot: ''},
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
// T-0006-062 (extended Step 7): NodeRenderer discriminates 22 types correctly
// ---------------------------------------------------------------------------

describe('NodeRenderer discrimination (T-0006-062 — Step 7 extended to 22 arms)', () => {
  // Suppress console.warn for List with unknown collectionId (workouts not in MINIMAL_SPEC)
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  })
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it.each([
    ['Screen', SCREEN],
    ['Section', SECTION],
    ['Stack', STACK],
    ['Row', ROW],
    ['Card', CARD],
    ['Heading', HEADING],
    ['Body', BODY],
    ['Caption', CAPTION],
    ['Stat', STAT],
    ['Badge', BADGE],
    ['Chip', CHIP],
    ['Avatar', AVATAR],
    ['TextField', TEXTFIELD],
    ['NumberField', NUMBERFIELD],
    ['DateField', DATEFIELD],
    ['Picker', PICKER],
    ['Switch', SWITCH],
    ['List', LIST],
    ['ListItem', LIST_ITEM],
    ['SwipeableRow', SWIPEABLE_ROW],
    ['EmptyState', EMPTY_STATE],
    ['LoadingState', LOADING_STATE],
  ] as [string, Node][])('renders %s without error', (_type, node) => {
    const host = makeHostCallbacks()
    const {toJSON} = renderNode(node, host)

    // List with unknown collectionId renders an empty View (not null)
    // All other nodes render non-null
    if (_type !== 'List') {
      expect(toJSON()).not.toBeNull()
    }
    // onUnknownNodeType must NOT be called for known types
    expect(host.onUnknownNodeType).not.toHaveBeenCalled()
  })

  it('does not call onUnknownNodeType for any of the 22 node types', () => {
    const host = makeHostCallbacks()
    const allNodes: Node[] = [
      SCREEN, SECTION, STACK, ROW, CARD,
      HEADING, BODY, CAPTION,
      STAT, BADGE, CHIP, AVATAR,
      TEXTFIELD, NUMBERFIELD, DATEFIELD, PICKER, SWITCH,
      LIST, LIST_ITEM, SWIPEABLE_ROW, EMPTY_STATE, LOADING_STATE,
    ]
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

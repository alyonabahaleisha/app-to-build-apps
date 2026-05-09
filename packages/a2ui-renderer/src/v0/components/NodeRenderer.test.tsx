/**
 * NodeRenderer tests
 * T-0006-062: NodeRenderer discriminates 5 layout types correctly (extended to 12 in Step 5)
 * T-0006-063: NodeRenderer with unknown type calls host.onUnknownNodeType + renders null
 */
import React from 'react'
import {render} from '@testing-library/react-native'
import type {Node} from '@app-creator/protocol'
import {RendererThemeProvider} from '../theme/RendererThemeProvider'
import {HostProvider} from '../host/HostContext'
import type {HostCallbacks} from '../state/hostCallbacks'
import {NodeRenderer} from './NodeRenderer'

// ---------------------------------------------------------------------------
// Test wrapper
// ---------------------------------------------------------------------------

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
        <NodeRenderer node={node} />
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
// T-0006-062 (extended Step 5): NodeRenderer discriminates 12 types correctly
// ---------------------------------------------------------------------------

describe('NodeRenderer discrimination (T-0006-062 — Step 5 extended to 12 arms)', () => {
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
  ] as [string, Node][])('renders %s without error', (_type, node) => {
    const host = makeHostCallbacks()
    const {toJSON} = renderNode(node, host)

    expect(toJSON()).not.toBeNull()
    // onUnknownNodeType must NOT be called for known types
    expect(host.onUnknownNodeType).not.toHaveBeenCalled()
  })

  it('does not call onUnknownNodeType for any of the 12 node types', () => {
    const host = makeHostCallbacks()
    const allNodes: Node[] = [SCREEN, SECTION, STACK, ROW, CARD, HEADING, BODY, CAPTION, STAT, BADGE, CHIP, AVATAR]
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

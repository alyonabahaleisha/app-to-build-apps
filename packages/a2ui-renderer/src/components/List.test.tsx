/**
 * Tests for ListRenderer.
 *
 * Step 2 — T-0003-033..037b
 *
 * Uses react-test-renderer (rtr) per the ADR test-file mapping.
 * RendererThemeProvider wraps every render so useRendererTheme() resolves.
 */
import React from 'react'
import {create} from 'react-test-renderer'

import type {A2UINode} from '@app-creator/a2ui-schema'

import {DEFAULT_LIGHT_THEME, RendererThemeProvider} from '../theme/RendererThemeProvider'
import type {Dispatch, RenderState} from '../types'
import {ListRenderer} from './List'

// -- Helpers ------------------------------------------------------------------

function makeDispatch(): jest.Mock {
  return jest.fn()
}

function renderList(
  node: Parameters<typeof ListRenderer>[0]['node'],
  state: RenderState = {},
  dispatch: Dispatch = makeDispatch(),
) {
  return create(
    <RendererThemeProvider value={DEFAULT_LIGHT_THEME}>
      <ListRenderer node={node} state={state} dispatch={dispatch} />
    </RendererThemeProvider>,
  )
}

const HEADING: A2UINode = {type: 'Heading', text: 'Title'}
const TEXT: A2UINode = {type: 'Text', text: 'body'}
const HEADING2: A2UINode = {type: 'Heading', level: 2, text: 'Sub'}

// -- T-0003-033: default md gap -----------------------------------------------

describe('ListRenderer — default gap', () => {
  // T-0003-033
  it('renders items with md gap when separator is not set', () => {
    const tree = renderList({
      type: 'List',
      items: [HEADING, TEXT, HEADING2],
    })
    const root = tree.toJSON() as any
    expect(root.type).toBe('View')
    // The container View should have gap: md (16)
    expect(root.props.style).toMatchObject({gap: DEFAULT_LIGHT_THEME.spacing.md})
    // Three children (the items themselves, no separators)
    expect(root.children).toHaveLength(3)
  })
})

// -- T-0003-034: separator:true -----------------------------------------------

describe('ListRenderer — separator', () => {
  // T-0003-034
  it('separator:true interleaves 1px bg.subtle Views between items', () => {
    const tree = renderList({
      type: 'List',
      items: [HEADING, TEXT, HEADING2],
      separator: true,
    })
    const root = tree.toJSON() as any
    // 3 items + 2 separators = 5 children
    expect(root.children).toHaveLength(5)

    // Separators are at indices 1 and 3
    const sep1 = root.children[1]
    const sep2 = root.children[3]

    // Each separator is a 1px View with bg.subtle background
    expect(sep1.type).toBe('View')
    expect(sep1.props.style).toMatchObject({
      height: 1,
      backgroundColor: DEFAULT_LIGHT_THEME.palette.bg.subtle,
    })
    expect(sep2.type).toBe('View')
    expect(sep2.props.style).toMatchObject({
      height: 1,
      backgroundColor: DEFAULT_LIGHT_THEME.palette.bg.subtle,
    })
  })

  // separator:true disables gap
  it('separator:true uses no gap (gap replaced by separator lines)', () => {
    const tree = renderList({
      type: 'List',
      items: [HEADING, TEXT],
      separator: true,
    })
    const root = tree.toJSON() as any
    // No gap when separator is true — the separator Views replace spacing
    expect(root.props.style?.gap ?? 0).toBe(0)
  })
})

// -- T-0003-035..036: boundary cases -----------------------------------------

describe('ListRenderer — boundary cases', () => {
  // T-0003-035
  it('single item: no separator rendered', () => {
    const tree = renderList({
      type: 'List',
      items: [HEADING],
      separator: true,
    })
    const root = tree.toJSON() as any
    // 1 item, 0 separators → exactly 1 child
    expect(root.children).toHaveLength(1)
  })

  // T-0003-036
  it('empty items: renders an empty View without crashing', () => {
    expect(() => {
      renderList({type: 'List', items: []})
    }).not.toThrow()

    const tree = renderList({type: 'List', items: []})
    const root = tree.toJSON() as any
    expect(root.type).toBe('View')
    expect(root.children).toBeNull()
  })
})

// -- T-0003-037a..b: Snapshots ------------------------------------------------

describe('ListRenderer — snapshots', () => {
  // T-0003-037a
  it('snapshot: 3 items + separator off (default md gap)', () => {
    const tree = renderList({
      type: 'List',
      items: [HEADING, TEXT, HEADING2],
    })
    expect(tree.toJSON()).toMatchSnapshot()
  })

  // T-0003-037b
  it('snapshot: 3 items + separator on (no gap, 1px lines)', () => {
    const tree = renderList({
      type: 'List',
      items: [HEADING, TEXT, HEADING2],
      separator: true,
    })
    expect(tree.toJSON()).toMatchSnapshot()
  })
})

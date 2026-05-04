/**
 * Tests for TextRenderer.
 *
 * Step 3 — T-0003-043..046, T-0003-052a/b/c
 *
 * Uses react-test-renderer (rtr) per the ADR test-file mapping.
 * RendererThemeProvider wraps every render so useRendererTheme() resolves.
 */
import React from 'react'
import {create} from 'react-test-renderer'

import {DEFAULT_LIGHT_THEME, RendererThemeProvider} from '../theme/RendererThemeProvider'
import type {Dispatch, RenderState} from '../types'
import {TextRenderer} from './Text'
import type {A2UITextNode} from './Text'

// -- Helpers ------------------------------------------------------------------

function makeDispatch(): jest.Mock {
  return jest.fn()
}

function renderText(
  node: A2UITextNode,
  state: RenderState = {},
  dispatch: Dispatch = makeDispatch(),
) {
  return create(
    <RendererThemeProvider value={DEFAULT_LIGHT_THEME}>
      <TextRenderer node={node} state={state} dispatch={dispatch} />
    </RendererThemeProvider>,
  )
}

const T = DEFAULT_LIGHT_THEME

// -- T-0003-043: default (no props) -------------------------------------------

describe('TextRenderer — default', () => {
  // T-0003-043
  it('without weight/color uses body typography + text.primary color', () => {
    const tree = renderText({type: 'Text', text: 'Hello world'})
    const root = tree.toJSON() as any
    expect(root.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({fontSize: T.typography.body.fontSize, fontWeight: T.typography.body.fontWeight}),
        expect.objectContaining({color: T.palette.text.primary}),
      ]),
    )
  })
})

// -- T-0003-044: weight:bold --------------------------------------------------

describe('TextRenderer — weight:bold', () => {
  // T-0003-044
  it('weight:bold applies bodyStrong typography', () => {
    const tree = renderText({type: 'Text', text: 'Bold', weight: 'bold'})
    const root = tree.toJSON() as any
    expect(root.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({fontWeight: T.typography.bodyStrong.fontWeight}),
      ]),
    )
  })
})

// -- T-0003-045: color:muted --------------------------------------------------

describe('TextRenderer — color:muted', () => {
  // T-0003-045
  it('color:muted applies text.muted color', () => {
    const tree = renderText({type: 'Text', text: 'Muted', color: 'muted'})
    const root = tree.toJSON() as any
    expect(root.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({color: T.palette.text.muted}),
      ]),
    )
  })
})

// -- T-0003-046: color:destructive --------------------------------------------

describe('TextRenderer — color:destructive', () => {
  // T-0003-046
  it('color:destructive applies text.destructive color', () => {
    const tree = renderText({type: 'Text', text: 'Error', color: 'destructive'})
    const root = tree.toJSON() as any
    expect(root.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({color: T.palette.text.destructive}),
      ]),
    )
  })
})

// -- T-0003-052a/b/c: Snapshots -----------------------------------------------

describe('TextRenderer — snapshots', () => {
  // T-0003-052a
  it('snapshot: default (no weight/color)', () => {
    const tree = renderText({type: 'Text', text: 'Default text'})
    expect(tree.toJSON()).toMatchSnapshot()
  })

  // T-0003-052b
  it('snapshot: bold weight + muted color', () => {
    const tree = renderText({type: 'Text', text: 'Bold muted', weight: 'bold', color: 'muted'})
    expect(tree.toJSON()).toMatchSnapshot()
  })

  // T-0003-052c
  it('snapshot: destructive color', () => {
    const tree = renderText({type: 'Text', text: 'Destructive', color: 'destructive'})
    expect(tree.toJSON()).toMatchSnapshot()
  })
})

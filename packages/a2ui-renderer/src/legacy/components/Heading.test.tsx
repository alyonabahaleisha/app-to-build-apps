/**
 * Tests for HeadingRenderer.
 *
 * Step 3 — T-0003-039..042, T-0003-050c, T-0003-051a/b/c
 *
 * Uses react-test-renderer (rtr) per the ADR test-file mapping.
 * RendererThemeProvider wraps every render so useRendererTheme() resolves.
 */
import React from 'react'
import {create} from 'react-test-renderer'

import {DEFAULT_LIGHT_THEME, RendererThemeProvider} from '../theme/RendererThemeProvider'
import type {Dispatch, RenderState} from '../types'
import {HeadingRenderer} from './Heading'
import type {A2UIHeadingNode} from './Heading'

// -- Helpers ------------------------------------------------------------------

function makeDispatch(): jest.Mock {
  return jest.fn()
}

function renderHeading(
  node: A2UIHeadingNode,
  state: RenderState = {},
  dispatch: Dispatch = makeDispatch(),
) {
  return create(
    <RendererThemeProvider value={DEFAULT_LIGHT_THEME}>
      <HeadingRenderer node={node} state={state} dispatch={dispatch} />
    </RendererThemeProvider>,
  )
}

const T = DEFAULT_LIGHT_THEME

// -- T-0003-039: level 1 -------------------------------------------------------

describe('HeadingRenderer — level 1', () => {
  // T-0003-039
  it('level:1 applies display typography, padding-top:lg, accessibilityRole:header', () => {
    const tree = renderHeading({type: 'Heading', text: 'Hello', level: 1})
    const root = tree.toJSON() as any
    expect(root.props.accessibilityRole).toBe('header')
    expect(root.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({fontSize: T.typography.display.fontSize}),
        expect.objectContaining({paddingTop: T.spacing.lg}),
      ]),
    )
  })
})

// -- T-0003-040: level 2 -------------------------------------------------------

describe('HeadingRenderer — level 2', () => {
  // T-0003-040
  it('level:2 applies heading1 typography + padding-top:md', () => {
    const tree = renderHeading({type: 'Heading', text: 'Sub', level: 2})
    const root = tree.toJSON() as any
    expect(root.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({fontSize: T.typography.heading1.fontSize}),
        expect.objectContaining({paddingTop: T.spacing.md}),
      ]),
    )
  })
})

// -- T-0003-041: level 3 -------------------------------------------------------

describe('HeadingRenderer — level 3', () => {
  // T-0003-041
  it('level:3 applies heading2 typography + padding-top:sm', () => {
    const tree = renderHeading({type: 'Heading', text: 'Small', level: 3})
    const root = tree.toJSON() as any
    expect(root.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({fontSize: T.typography.heading2.fontSize}),
        expect.objectContaining({paddingTop: T.spacing.sm}),
      ]),
    )
  })
})

// -- T-0003-042: missing level defaults to 1 ----------------------------------

describe('HeadingRenderer — missing level', () => {
  // T-0003-042: missing `level` defaults to level 1 (Sable line 398 implication)
  it('without level defaults to level-1 display typography + padding-top:lg', () => {
    const tree = renderHeading({type: 'Heading', text: 'No Level'})
    const root = tree.toJSON() as any
    expect(root.props.accessibilityRole).toBe('header')
    expect(root.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({fontSize: T.typography.display.fontSize}),
        expect.objectContaining({paddingTop: T.spacing.lg}),
      ]),
    )
  })
})

// -- T-0003-050c: out-of-range level defaults to 1 ----------------------------

describe('HeadingRenderer — boundary: out-of-range level', () => {
  // T-0003-050c: level outside 1/2/3 forced via `as any` cast bypassing Zod
  it('level:99 (forced via as any) defaults to level-1 styling', () => {
    const node = {type: 'Heading', text: 'Wild', level: 99} as any as A2UIHeadingNode
    const tree = renderHeading(node)
    const root = tree.toJSON() as any
    expect(root.props.accessibilityRole).toBe('header')
    expect(root.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({fontSize: T.typography.display.fontSize}),
        expect.objectContaining({paddingTop: T.spacing.lg}),
      ]),
    )
  })
})

// -- T-0003-051a/b/c: Snapshots -----------------------------------------------

describe('HeadingRenderer — snapshots', () => {
  // T-0003-051a
  it('snapshot: level 1', () => {
    const tree = renderHeading({type: 'Heading', text: 'Level One', level: 1})
    expect(tree.toJSON()).toMatchSnapshot()
  })

  // T-0003-051b
  it('snapshot: level 2', () => {
    const tree = renderHeading({type: 'Heading', text: 'Level Two', level: 2})
    expect(tree.toJSON()).toMatchSnapshot()
  })

  // T-0003-051c
  it('snapshot: level 3', () => {
    const tree = renderHeading({type: 'Heading', text: 'Level Three', level: 3})
    expect(tree.toJSON()).toMatchSnapshot()
  })
})

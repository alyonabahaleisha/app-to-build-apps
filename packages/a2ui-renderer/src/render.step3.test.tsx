/**
 * render.step3.test.tsx
 *
 * Step 3 — T-0003-054 regression + Roz Issue-2 carryover coverage for
 * render.tsx lines 19 (initialViewId-not-found) and 59 (dispatch branches
 * for Heading / Text / Image via the top-level render() function).
 *
 * These tests call the top-level render({spec, state, dispatch}) directly
 * rather than mounting individual components. That drives the full
 * NodeRenderer switch path and surfaces the initialViewId error branch.
 *
 * NOTE: Step 8 will create render.test.tsx (determinism tests). This file
 * covers only Step-3 obligations to avoid a merge collision.
 */
import React from 'react'
import {create} from 'react-test-renderer'

import type {A2UISpec} from '@app-creator/a2ui-schema'

import {render} from './render'
import {DEFAULT_LIGHT_THEME, RendererThemeProvider} from './theme/RendererThemeProvider'
import type {Dispatch, RenderState} from './types'

// -- Helpers ------------------------------------------------------------------

function makeDispatch(): jest.Mock {
  return jest.fn()
}

/**
 * Wrap render() output in a RendererThemeProvider so all component hooks
 * resolve — mirrors how AppRunner will mount the tree in Step 8.
 */
function renderSpec(
  spec: A2UISpec,
  state: RenderState = {},
  dispatch: Dispatch = makeDispatch(),
) {
  return create(
    <RendererThemeProvider value={DEFAULT_LIGHT_THEME}>
      {render({spec, state, dispatch})}
    </RendererThemeProvider>,
  )
}

// -- Minimal valid spec builders ----------------------------------------------

function makeSpec(root: A2UISpec['views'][0]['root']): A2UISpec {
  return {
    version: 1,
    views: [{id: 'main', root}],
    initialViewId: 'main',
  }
}

// -- T-0003-054: Regression — Heading + Text still produce identical trees ----
//
// CLAUDE.md §8 snapshot regeneration rationale (Roz Step-3 QA Issue 2):
//
// Container.test.tsx.snap and List.test.tsx.snap were regenerated in Step 3
// because HeadingRenderer and TextRenderer were extracted from inline render.tsx
// cases into standalone components. The children previously rendered as plain
// RN <Text> nodes; post-extraction they now carry theme tokens (font size,
// font weight, paddingTop, color, accessibilityRole). This structural
// enrichment is intentional and correct — not drift.
//
// render.step3 snapshots below are fresh baselines (no ADR-0002 snapshot
// existed on disk). The ADR specified comparison against an ADR-0002 snapshot,
// but ADR-0002 used a different rendering shape (inline, no theme tokens).
// The Step-3 baseline captures the correct post-extraction output and will
// guard against future regressions. See also: Roz QA Issue 3 (T-0003-054
// baseline is Step-3 output, not ADR-0002 skeleton — no remediation required).

describe('render() — T-0003-054 regression: Heading + Text post-extraction', () => {
  it('Heading node renders via HeadingRenderer with accessibilityRole:header', () => {
    const spec = makeSpec({type: 'Heading', text: 'Regression Heading', level: 1})
    const tree = renderSpec(spec)
    const json = tree.toJSON() as any
    // Post-extraction: HeadingRenderer still sets accessibilityRole="header"
    expect(json.props.accessibilityRole).toBe('header')
    expect(json.children).toContain('Regression Heading')
  })

  it('Text node renders via TextRenderer with text content', () => {
    const spec = makeSpec({type: 'Text', text: 'Regression Text'})
    const tree = renderSpec(spec)
    const json = tree.toJSON() as any
    expect(json.children).toContain('Regression Text')
  })

  it('snapshot: Heading level 1 through render() matches extracted component output', () => {
    const spec = makeSpec({type: 'Heading', text: 'Snap Heading', level: 1})
    expect(renderSpec(spec).toJSON()).toMatchSnapshot()
  })

  it('snapshot: Text default through render() matches extracted component output', () => {
    const spec = makeSpec({type: 'Text', text: 'Snap Text'})
    expect(renderSpec(spec).toJSON()).toMatchSnapshot()
  })
})

// -- Roz Issue 2: initialViewId-not-found branch (render.tsx line 19) ---------

describe('render() — initialViewId-not-found fallback (Roz Issue 2 / line 19)', () => {
  it('returns "Invalid spec: initialViewId not found" when no view matches', () => {
    // Bypass Zod schema validation intentionally — this tests runtime
    // defence-in-depth for a spec that somehow arrives with a bad initialViewId.
    const spec = {
      version: 1,
      views: [{id: 'main', root: {type: 'Text', text: 'Hi'}}],
      initialViewId: 'nonexistent',
    } as unknown as A2UISpec

    const tree = create(
      <RendererThemeProvider value={DEFAULT_LIGHT_THEME}>
        {render({spec, state: {}, dispatch: makeDispatch()})}
      </RendererThemeProvider>,
    )
    const json = tree.toJSON() as any
    // Outer View containing the error Text
    const errorText = json.children?.find((c: any) => c.children?.includes('Invalid spec: initialViewId not found'))
    expect(errorText).toBeDefined()
  })
})

// -- Roz Issue 2: multi-component spec drives NodeRenderer dispatch branches --

describe('render() — multi-component spec drives Heading/Text/Image branches (Roz Issue 2)', () => {
  it('Container with [Heading, Text, Image] renders all three node types via NodeRenderer', () => {
    const spec = makeSpec({
      type: 'Container',
      direction: 'column',
      children: [
        {type: 'Heading', text: 'Title', level: 1},
        {type: 'Text', text: 'Body copy'},
        {type: 'Image', src: 'https://example.com/img.png', alt: 'test image'},
      ],
    })

    const dispatch = makeDispatch()
    const tree = renderSpec(spec, {}, dispatch)
    const json = tree.toJSON() as any

    // Container renders a View; its children correspond to our 3 child nodes.
    expect(json.type).toBe('View')
    const children: any[] = json.children ?? []

    // Heading child — has accessibilityRole:header
    const headingEl = children.find((c: any) => c.props?.accessibilityRole === 'header')
    expect(headingEl).toBeDefined()
    expect(headingEl.children).toContain('Title')

    // Text child — plain Text with body copy
    const textEl = children.find((c: any) => c.children?.includes('Body copy'))
    expect(textEl).toBeDefined()

    // Image child — wrapper View containing an Image (letterbox branch, no aspectRatio)
    const imageWrapper = children.find(
      (c: any) => c.type === 'View' && c.children?.[0]?.type === 'Image',
    )
    expect(imageWrapper).toBeDefined()
    expect(imageWrapper.children[0].props.source).toEqual({uri: 'https://example.com/img.png'})
    expect(imageWrapper.children[0].props.accessibilityLabel).toBe('test image')
  })

  it('List with [Heading, Text] drives List dispatch branch in NodeRenderer', () => {
    const spec = makeSpec({
      type: 'List',
      items: [
        {type: 'Heading', text: 'List Heading', level: 2},
        {type: 'Text', text: 'List text'},
      ],
    })

    const tree = renderSpec(spec)
    const json = tree.toJSON() as any

    // ListRenderer wraps in a View; both children should render
    expect(json.type).toBe('View')
    const headingEl = json.children.find((c: any) => c.props?.accessibilityRole === 'header')
    const textEl = json.children.find((c: any) => c.children?.includes('List text'))
    expect(headingEl).toBeDefined()
    expect(textEl).toBeDefined()
  })
})

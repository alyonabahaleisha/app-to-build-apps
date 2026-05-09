/**
 * Tests for ImageRenderer.
 *
 * Step 3 — T-0003-047..050b, T-0003-053a/b
 *
 * Uses react-test-renderer (rtr) per the ADR test-file mapping.
 * RendererThemeProvider wraps every render so useRendererTheme() resolves.
 */
import React from 'react'
import {create} from 'react-test-renderer'

import {DEFAULT_LIGHT_THEME, RendererThemeProvider} from '../theme/RendererThemeProvider'
import type {Dispatch, RenderState} from '../types'
import {ImageRenderer} from './Image'
import type {A2UIImageNode} from './Image'

// -- Helpers ------------------------------------------------------------------

function makeDispatch(): jest.Mock {
  return jest.fn()
}

function renderImage(
  node: A2UIImageNode,
  state: RenderState = {},
  dispatch: Dispatch = makeDispatch(),
) {
  return create(
    <RendererThemeProvider value={DEFAULT_LIGHT_THEME}>
      <ImageRenderer node={node} state={state} dispatch={dispatch} />
    </RendererThemeProvider>,
  )
}

const T = DEFAULT_LIGHT_THEME

// -- T-0003-047: aspectRatio provided -----------------------------------------

describe('ImageRenderer — aspectRatio provided', () => {
  // T-0003-047
  it('aspectRatio:1.5 renders Image directly with that aspectRatio locked', () => {
    const tree = renderImage({type: 'Image', src: 'https://example.com/a.png', aspectRatio: 1.5})
    const root = tree.toJSON() as any
    // With aspectRatio set, the component returns an <Image> directly (no wrapper View).
    expect(root.type).toBe('Image')
    expect(root.props.style).toMatchObject({aspectRatio: 1.5})
    expect(root.props.source).toEqual({uri: 'https://example.com/a.png'})
    // Roz Issue 1 closure: invoke the aspectRatio-branch onError to bring
    // Istanbul functions coverage to 100% (letter-box branch already covered
    // by T-0003-050b; both callbacks are identical no-ops but Istanbul counts
    // them as separate function instances).
    expect(() => root.props.onError()).not.toThrow()
  })
})

// -- T-0003-048: no aspectRatio — letterbox fallback --------------------------

describe('ImageRenderer — no aspectRatio', () => {
  // T-0003-048
  it('without aspectRatio renders View letterbox with maxHeight:240 + bg.subtle', () => {
    const tree = renderImage({type: 'Image', src: 'https://example.com/b.png'})
    const root = tree.toJSON() as any
    // Letterbox: outer View + inner Image
    expect(root.type).toBe('View')
    expect(root.props.style).toMatchObject({
      backgroundColor: T.palette.bg.subtle,
      maxHeight: 240,
    })
    // The inner Image child
    const imgChild = root.children[0]
    expect(imgChild.type).toBe('Image')
    expect(imgChild.props.source).toEqual({uri: 'https://example.com/b.png'})
  })
})

// -- T-0003-049: alt → accessibilityLabel -------------------------------------

describe('ImageRenderer — alt prop', () => {
  // T-0003-049
  it('alt:"Sunset" exposes accessibilityLabel:"Sunset"', () => {
    const tree = renderImage({
      type: 'Image',
      src: 'https://example.com/sunset.png',
      alt: 'Sunset',
    })
    const root = tree.toJSON() as any
    // With no aspectRatio the Image is the first child of the wrapper View
    const imgChild = root.children[0]
    expect(imgChild.props.accessibilityLabel).toBe('Sunset')
  })
})

// -- T-0003-050: portrait aspectRatio -----------------------------------------

describe('ImageRenderer — boundary: portrait aspectRatio', () => {
  // T-0003-050
  it('aspectRatio:0.5 (portrait) — aspectRatio is locked on the Image', () => {
    const tree = renderImage({
      type: 'Image',
      src: 'https://example.com/portrait.png',
      aspectRatio: 0.5,
    })
    const root = tree.toJSON() as any
    expect(root.type).toBe('Image')
    expect(root.props.style).toMatchObject({aspectRatio: 0.5})
  })
})

// -- T-0003-050b: malformed URL does not throw --------------------------------

describe('ImageRenderer — failure: malformed URL', () => {
  // T-0003-050b: Image with unreachable URL must NOT throw and must NOT trip
  // the Render Error Boundary. onError is a no-op; component still renders.
  it('malformed URL renders without throwing', () => {
    expect(() => {
      const tree = renderImage({
        type: 'Image',
        src: 'https://invalid.example.invalid/x.png',
      })
      const root = tree.toJSON() as any
      // The component renders; find the Image element (direct or in wrapper)
      const imgEl = root.type === 'Image' ? root : root.children[0]
      // Simulate RN's onError callback firing — must not throw.
      expect(() => imgEl.props.onError()).not.toThrow()
      // Component tree is still intact after onError
      expect(root).not.toBeNull()
    }).not.toThrow()
  })
})

// -- T-0003-053a/b: Snapshots --------------------------------------------------

describe('ImageRenderer — snapshots', () => {
  // T-0003-053a
  it('snapshot: with aspectRatio + alt', () => {
    const tree = renderImage({
      type: 'Image',
      src: 'https://example.com/photo.png',
      aspectRatio: 16 / 9,
      alt: 'A scenic view',
    })
    expect(tree.toJSON()).toMatchSnapshot()
  })

  // T-0003-053b
  it('snapshot: without aspectRatio (letterbox fallback)', () => {
    const tree = renderImage({
      type: 'Image',
      src: 'https://example.com/banner.png',
    })
    expect(tree.toJSON()).toMatchSnapshot()
  })
})

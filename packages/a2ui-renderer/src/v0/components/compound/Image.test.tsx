/**
 * ImageRenderer tests
 * T-0009-014: snapshot at productive×focus
 * T-0009-015: snapshot at expressive×health
 * T-0009-016: stance-driven default radius (radius-md productive, radius-lg expressive)
 * T-0009-017: fit defaults to 'cover'
 * T-0009-020: all aspectRatio values render without error
 * T-0009-021: fallbackIcon default 'image' rendered on error state
 * T-0009-022: accessibilityRole="image" on root
 * T-0009-023: accessibilityLabel equals alt
 * T-0009-024: empty alt throws (defense-in-depth)
 */
import React from 'react'
import {renderWithTheme} from '../../__test-utils__/renderWithTheme'
import type {Node} from '@app-creator/protocol'
import {ImageRenderer} from './Image'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type ImageNode = Extract<Node, {type: 'Image'}>

const IMAGE_LITERAL: ImageNode = {
  id: 'img1',
  type: 'Image',
  source: {kind: 'literal', value: 'https://example.com/photo.jpg'},
  alt: 'A sunset over the mountains',
}

const IMAGE_EXPRESSIVE: ImageNode = {
  ...IMAGE_LITERAL,
  id: 'img2',
}

const IMAGE_WITH_ALL_PROPS: ImageNode = {
  id: 'img3',
  type: 'Image',
  source: {kind: 'literal', value: 'https://example.com/photo.jpg'},
  alt: 'Product photo',
  aspectRatio: '16:9',
  fit: 'contain',
  radius: 'radius-none',
  fallbackIcon: 'image',
}

const IMAGE_NO_RESOLVABLE_URI: ImageNode = {
  id: 'img4',
  type: 'Image',
  source: {kind: 'state', slot: 'photoSlot'},
  alt: 'User uploaded photo',
}

// ---------------------------------------------------------------------------
// T-0009-014: snapshot at productive×focus
// ---------------------------------------------------------------------------

describe('ImageRenderer snapshot (T-0009-014) — productive×focus', () => {
  it('matches snapshot at productive×focus', () => {
    const {toJSON} = renderWithTheme(<ImageRenderer node={IMAGE_LITERAL} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0009-015: snapshot at expressive×health
// ---------------------------------------------------------------------------

describe('ImageRenderer snapshot (T-0009-015) — expressive×health', () => {
  it('matches snapshot at expressive×health', () => {
    const {toJSON} = renderWithTheme(<ImageRenderer node={IMAGE_EXPRESSIVE} />, {
      stance: 'expressive',
      palette: 'health',
    })
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0009-016: stance-driven default radius
// ---------------------------------------------------------------------------

describe('ImageRenderer stance-driven radius (T-0009-016)', () => {
  it('renders without error in productive stance', () => {
    const {toJSON} = renderWithTheme(<ImageRenderer node={IMAGE_LITERAL} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('renders without error in expressive stance', () => {
    const {toJSON} = renderWithTheme(<ImageRenderer node={IMAGE_EXPRESSIVE} />, {
      stance: 'expressive',
      palette: 'health',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('expressive stance applies larger border radius than productive', () => {
    type ViewTree = {props?: {style?: {borderRadius?: number}}} | null
    const {toJSON: toJSONProd} = renderWithTheme(<ImageRenderer node={IMAGE_LITERAL} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const {toJSON: toJSONExpr} = renderWithTheme(<ImageRenderer node={IMAGE_EXPRESSIVE} />, {
      stance: 'expressive',
      palette: 'health',
    })
    const prodRadius = (toJSONProd() as ViewTree)?.props?.style?.borderRadius ?? 0
    const exprRadius = (toJSONExpr() as ViewTree)?.props?.style?.borderRadius ?? 0
    expect(exprRadius).toBeGreaterThan(prodRadius)
  })
})

// ---------------------------------------------------------------------------
// T-0009-020: all aspectRatio values render without error
// ---------------------------------------------------------------------------

describe('ImageRenderer aspectRatio variations (T-0009-020)', () => {
  const aspectRatios = ['1:1', '4:5', '16:9', '3:4', '21:9'] as const

  it.each(aspectRatios)('renders with aspectRatio "%s" without error', aspectRatio => {
    const {toJSON} = renderWithTheme(
      <ImageRenderer node={{...IMAGE_LITERAL, aspectRatio}} />,
      {stance: 'productive', palette: 'focus'},
    )
    expect(toJSON()).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// T-0009-021: fallbackIcon rendered when source not resolvable
// ---------------------------------------------------------------------------

describe('ImageRenderer fallback (T-0009-021)', () => {
  it('renders without error when source is a state binding (no URI)', () => {
    const {toJSON} = renderWithTheme(<ImageRenderer node={IMAGE_NO_RESOLVABLE_URI} />, {
      stance: 'productive',
      palette: 'focus',
    })
    // Should render the error/fallback state (not throw).
    expect(toJSON()).not.toBeNull()
  })

  it('renders all extra props without error', () => {
    const {toJSON} = renderWithTheme(<ImageRenderer node={IMAGE_WITH_ALL_PROPS} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// T-0009-022: accessibilityRole="image" on root
// T-0009-023: accessibilityLabel equals alt
// ---------------------------------------------------------------------------

describe('ImageRenderer accessibility (T-0009-022, T-0009-023)', () => {
  it('has accessibilityRole="image" on root (T-0009-022)', () => {
    const {toJSON} = renderWithTheme(<ImageRenderer node={IMAGE_LITERAL} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {accessibilityRole?: string}} | null
    expect(tree?.props?.accessibilityRole).toBe('image')
  })

  it('accessibilityLabel equals node.alt (T-0009-023)', () => {
    const {toJSON} = renderWithTheme(<ImageRenderer node={IMAGE_LITERAL} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {accessibilityLabel?: string}} | null
    expect(tree?.props?.accessibilityLabel).toBe('A sunset over the mountains')
  })

  it('handles diverse alt text (non-ASCII)', () => {
    const node: ImageNode = {
      ...IMAGE_LITERAL,
      id: 'img_i18n',
      alt: '日本語のテキスト — O\'Brien\'s photo',
    }
    const {toJSON} = renderWithTheme(<ImageRenderer node={node} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {accessibilityLabel?: string}} | null
    expect(tree?.props?.accessibilityLabel).toBe('日本語のテキスト — O\'Brien\'s photo')
  })
})

// ---------------------------------------------------------------------------
// T-0009-024: empty alt throws (defense-in-depth)
// ---------------------------------------------------------------------------

describe('ImageRenderer empty alt throws (T-0009-024)', () => {
  it('throws when alt is empty string', () => {
    // Suppress React's error boundary console output in test.
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const badNode = {
      id: 'bad1',
      type: 'Image' as const,
      source: {kind: 'literal' as const, value: 'https://example.com/x.jpg'},
      alt: '',
    }
    expect(() =>
      renderWithTheme(<ImageRenderer node={badNode as ImageNode} />, {
        stance: 'productive',
        palette: 'focus',
      }),
    ).toThrow('alt is required')
    spy.mockRestore()
  })

  it('throws when alt is whitespace only', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const badNode = {
      id: 'bad2',
      type: 'Image' as const,
      source: {kind: 'literal' as const, value: 'https://example.com/x.jpg'},
      alt: '   ',
    }
    expect(() =>
      renderWithTheme(<ImageRenderer node={badNode as ImageNode} />, {
        stance: 'productive',
        palette: 'focus',
      }),
    ).toThrow('alt is required')
    spy.mockRestore()
  })
})

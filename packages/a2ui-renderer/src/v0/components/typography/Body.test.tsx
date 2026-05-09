/**
 * BodyRenderer tests
 * T-0006-066: snapshot at productive×focus
 * T-0006-067: snapshot at expressive×health
 */
import React from 'react'
import {renderWithTheme} from '../../__test-utils__/renderWithTheme'
import type {Node} from '@app-creator/protocol'
import {BodyRenderer} from './Body'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type BodyNode = Extract<Node, {type: 'Body'}>

const BODY_DEFAULT: BodyNode = {
  id: 'body1',
  type: 'Body',
  text: "Here's what's on deck today.",
}

const BODY_STRONG: BodyNode = {
  id: 'body2',
  type: 'Body',
  text: 'Important note.',
  weight: 'strong',
  color: 'fg',
}

const BODY_ACCENT: BodyNode = {
  id: 'body3',
  type: 'Body',
  text: 'Accent colored body.',
  color: 'accent',
}

const BODY_MUTED: BodyNode = {
  id: 'body4',
  type: 'Body',
  text: 'Secondary text.',
  color: 'fg-muted',
}

const BODY_CENTERED: BodyNode = {
  id: 'body5',
  type: 'Body',
  text: 'Centered body.',
  align: 'center',
}

// ---------------------------------------------------------------------------
// T-0006-066: snapshot at productive×focus
// ---------------------------------------------------------------------------

describe('BodyRenderer snapshot (T-0006-066) — productive×focus', () => {
  it('matches snapshot at productive×focus', () => {
    const {toJSON} = renderWithTheme(<BodyRenderer node={BODY_DEFAULT} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0006-067: snapshot at expressive×health
// ---------------------------------------------------------------------------

describe('BodyRenderer snapshot (T-0006-067) — expressive×health', () => {
  it('matches snapshot at expressive×health', () => {
    const {toJSON} = renderWithTheme(<BodyRenderer node={BODY_DEFAULT} />, {
      stance: 'expressive',
      palette: 'health',
    })
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// Happy path: renders all color variants
// ---------------------------------------------------------------------------

describe('BodyRenderer color and weight variants', () => {
  it('renders at productive×focus without error', () => {
    const {toJSON} = renderWithTheme(<BodyRenderer node={BODY_DEFAULT} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('renders at expressive×health without error', () => {
    const {toJSON} = renderWithTheme(<BodyRenderer node={BODY_DEFAULT} />, {
      stance: 'expressive',
      palette: 'health',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('renders strong weight with fontWeight 600', () => {
    const {toJSON} = renderWithTheme(<BodyRenderer node={BODY_STRONG} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {style?: {fontWeight?: string}}} | null
    expect(tree?.props?.style?.fontWeight).toBe('600')
  })

  it('renders regular weight with fontWeight 400', () => {
    const {toJSON} = renderWithTheme(<BodyRenderer node={BODY_DEFAULT} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {style?: {fontWeight?: string}}} | null
    expect(tree?.props?.style?.fontWeight).toBe('400')
  })

  it('renders accent color body', () => {
    const {toJSON} = renderWithTheme(<BodyRenderer node={BODY_ACCENT} />, {
      stance: 'productive',
      palette: 'focus',
    })
    // focus accent = #4F46E5
    const tree = toJSON() as {props?: {style?: {color?: string}}} | null
    expect(tree?.props?.style?.color).toBe('#4F46E5')
  })

  it('renders fg-muted color body', () => {
    const {toJSON} = renderWithTheme(<BodyRenderer node={BODY_MUTED} />, {
      stance: 'productive',
      palette: 'focus',
    })
    // productive fg-muted = #5C6470
    const tree = toJSON() as {props?: {style?: {color?: string}}} | null
    expect(tree?.props?.style?.color).toBe('#5C6470')
  })

  it('renders center-aligned body', () => {
    const {toJSON} = renderWithTheme(<BodyRenderer node={BODY_CENTERED} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {style?: {textAlign?: string}}} | null
    expect(tree?.props?.style?.textAlign).toBe('center')
  })

  it('applies body type scale (16pt at productive)', () => {
    const {toJSON} = renderWithTheme(<BodyRenderer node={BODY_DEFAULT} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {style?: {fontSize?: number}}} | null
    expect(tree?.props?.style?.fontSize).toBe(16)
  })

  // ---------------------------------------------------------------------------
  // Roz Finding 1 pickup: uncovered color arms fg-faint / success / warning / danger
  // ---------------------------------------------------------------------------

  it('fg-faint color resolves correctly (productive)', () => {
    // productive fg-faint = #A2A8B2
    const node: BodyNode = {id: 'b-faint', type: 'Body', text: 'Faint text', color: 'fg-faint'}
    const {toJSON} = renderWithTheme(<BodyRenderer node={node} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {style?: {color?: string}}} | null
    expect(tree?.props?.style?.color).toBe('#A2A8B2')
  })

  it('success color resolves correctly (productive)', () => {
    // productive success = #0E8345
    const node: BodyNode = {id: 'b-success', type: 'Body', text: 'Success text', color: 'success'}
    const {toJSON} = renderWithTheme(<BodyRenderer node={node} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {style?: {color?: string}}} | null
    expect(tree?.props?.style?.color).toBe('#0E8345')
  })

  it('warning color resolves correctly (productive)', () => {
    // productive warning = #B8580C
    const node: BodyNode = {id: 'b-warning', type: 'Body', text: 'Warning text', color: 'warning'}
    const {toJSON} = renderWithTheme(<BodyRenderer node={node} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {style?: {color?: string}}} | null
    expect(tree?.props?.style?.color).toBe('#B8580C')
  })

  it('danger color resolves correctly (productive)', () => {
    // productive danger = #C03A2B
    const node: BodyNode = {id: 'b-danger', type: 'Body', text: 'Danger text', color: 'danger'}
    const {toJSON} = renderWithTheme(<BodyRenderer node={node} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {style?: {color?: string}}} | null
    expect(tree?.props?.style?.color).toBe('#C03A2B')
  })
})

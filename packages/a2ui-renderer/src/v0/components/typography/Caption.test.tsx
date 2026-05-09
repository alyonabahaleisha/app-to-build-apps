/**
 * CaptionRenderer tests
 * T-0006-068: snapshot at productive×focus
 * T-0006-069: snapshot at expressive×health
 */
import React from 'react'
import {renderWithTheme} from '../../__test-utils__/renderWithTheme'
import type {Node} from '@app-creator/protocol'
import {CaptionRenderer} from './Caption'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type CaptionNode = Extract<Node, {type: 'Caption'}>

const CAPTION_DEFAULT: CaptionNode = {
  id: 'cap1',
  type: 'Caption',
  text: 'Created 3 days ago',
}

const CAPTION_FAINT: CaptionNode = {
  id: 'cap2',
  type: 'Caption',
  text: 'Placeholder text',
  color: 'fg-faint',
}

const CAPTION_ACCENT: CaptionNode = {
  id: 'cap3',
  type: 'Caption',
  text: 'Accent caption',
  color: 'accent',
}

const CAPTION_STRONG: CaptionNode = {
  id: 'cap4',
  type: 'Caption',
  text: 'Strong caption',
  weight: 'strong',
}

const CAPTION_CENTERED: CaptionNode = {
  id: 'cap5',
  type: 'Caption',
  text: 'Centered caption',
  align: 'center',
}

// ---------------------------------------------------------------------------
// T-0006-068: snapshot at productive×focus
// ---------------------------------------------------------------------------

describe('CaptionRenderer snapshot (T-0006-068) — productive×focus', () => {
  it('matches snapshot at productive×focus', () => {
    const {toJSON} = renderWithTheme(<CaptionRenderer node={CAPTION_DEFAULT} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0006-069: snapshot at expressive×health
// ---------------------------------------------------------------------------

describe('CaptionRenderer snapshot (T-0006-069) — expressive×health', () => {
  it('matches snapshot at expressive×health', () => {
    const {toJSON} = renderWithTheme(<CaptionRenderer node={CAPTION_DEFAULT} />, {
      stance: 'expressive',
      palette: 'health',
    })
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// Happy path variants
// ---------------------------------------------------------------------------

describe('CaptionRenderer variants', () => {
  it('renders at productive×focus without error', () => {
    const {toJSON} = renderWithTheme(<CaptionRenderer node={CAPTION_DEFAULT} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('renders at expressive×health without error', () => {
    const {toJSON} = renderWithTheme(<CaptionRenderer node={CAPTION_DEFAULT} />, {
      stance: 'expressive',
      palette: 'health',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('default color is fg-muted (secondary tone)', () => {
    // productive fg-muted = #5C6470
    const {toJSON} = renderWithTheme(<CaptionRenderer node={CAPTION_DEFAULT} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {style?: {color?: string}}} | null
    expect(tree?.props?.style?.color).toBe('#5C6470')
  })

  it('fg-faint color resolves correctly', () => {
    // productive fg-faint = #A2A8B2
    const {toJSON} = renderWithTheme(<CaptionRenderer node={CAPTION_FAINT} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {style?: {color?: string}}} | null
    expect(tree?.props?.style?.color).toBe('#A2A8B2')
  })

  it('accent color resolves to palette accent', () => {
    // focus accent = #4F46E5
    const {toJSON} = renderWithTheme(<CaptionRenderer node={CAPTION_ACCENT} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {style?: {color?: string}}} | null
    expect(tree?.props?.style?.color).toBe('#4F46E5')
  })

  it('strong weight renders fontWeight 600', () => {
    const {toJSON} = renderWithTheme(<CaptionRenderer node={CAPTION_STRONG} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {style?: {fontWeight?: string}}} | null
    expect(tree?.props?.style?.fontWeight).toBe('600')
  })

  it('applies caption type scale (13pt at productive)', () => {
    const {toJSON} = renderWithTheme(<CaptionRenderer node={CAPTION_DEFAULT} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {style?: {fontSize?: number}}} | null
    expect(tree?.props?.style?.fontSize).toBe(13)
  })

  it('applies caption type scale (14pt at expressive)', () => {
    const {toJSON} = renderWithTheme(<CaptionRenderer node={CAPTION_DEFAULT} />, {
      stance: 'expressive',
      palette: 'health',
    })
    const tree = toJSON() as {props?: {style?: {fontSize?: number}}} | null
    expect(tree?.props?.style?.fontSize).toBe(14)
  })

  it('renders center-aligned caption', () => {
    const {toJSON} = renderWithTheme(<CaptionRenderer node={CAPTION_CENTERED} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {style?: {textAlign?: string}}} | null
    expect(tree?.props?.style?.textAlign).toBe('center')
  })
})

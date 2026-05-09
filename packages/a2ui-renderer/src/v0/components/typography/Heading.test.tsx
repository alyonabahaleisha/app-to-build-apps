/**
 * HeadingRenderer tests
 * T-0006-064: snapshot at productive×focus
 * T-0006-065: snapshot at expressive×health
 * T-0006-078: Heading levels 1/2/3 use display/h1/h2 type roles
 * T-0006-084: empty text rejected at schema parse
 */
import React from 'react'
import {renderWithTheme} from '../../__test-utils__/renderWithTheme'
import {HeadingSchema} from '@app-creator/protocol'
import type {Node} from '@app-creator/protocol'
import {HeadingRenderer} from './Heading'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type HeadingNode = Extract<Node, {type: 'Heading'}>

const HEADING_DEFAULT: HeadingNode = {
  id: 'h1',
  type: 'Heading',
  text: 'Welcome',
}

const HEADING_LEVEL1: HeadingNode = {
  id: 'h2',
  type: 'Heading',
  text: 'Display Heading',
  level: 1,
}

const HEADING_LEVEL2: HeadingNode = {
  id: 'h3',
  type: 'Heading',
  text: 'Primary Heading',
  level: 2,
}

const HEADING_LEVEL3: HeadingNode = {
  id: 'h4',
  type: 'Heading',
  text: 'Section Heading',
  level: 3,
}

const HEADING_CENTERED: HeadingNode = {
  id: 'h5',
  type: 'Heading',
  text: 'Centered',
  level: 1,
  align: 'center',
}

// ---------------------------------------------------------------------------
// T-0006-064: snapshot at productive×focus
// ---------------------------------------------------------------------------

describe('HeadingRenderer snapshot (T-0006-064) — productive×focus', () => {
  it('matches snapshot at productive×focus', () => {
    const {toJSON} = renderWithTheme(<HeadingRenderer node={HEADING_DEFAULT} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0006-065: snapshot at expressive×health
// ---------------------------------------------------------------------------

describe('HeadingRenderer snapshot (T-0006-065) — expressive×health', () => {
  it('matches snapshot at expressive×health', () => {
    const {toJSON} = renderWithTheme(<HeadingRenderer node={HEADING_DEFAULT} />, {
      stance: 'expressive',
      palette: 'health',
    })
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0006-078: Heading levels 1/2/3 use display/h1/h2 type roles
// ---------------------------------------------------------------------------

describe('HeadingRenderer level rendering (T-0006-078)', () => {
  it('renders level 1 without error at productive×focus', () => {
    const {toJSON} = renderWithTheme(<HeadingRenderer node={HEADING_LEVEL1} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('renders level 2 without error at productive×focus', () => {
    const {toJSON} = renderWithTheme(<HeadingRenderer node={HEADING_LEVEL2} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('renders level 3 without error at productive×focus', () => {
    const {toJSON} = renderWithTheme(<HeadingRenderer node={HEADING_LEVEL3} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('level 1 applies display type spec font size at productive', () => {
    // productive.display.size = 32
    const {toJSON} = renderWithTheme(<HeadingRenderer node={HEADING_LEVEL1} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {style?: {fontSize?: number}}} | null
    expect(tree?.props?.style?.fontSize).toBe(32)
  })

  it('level 2 applies h1 type spec font size at productive', () => {
    // productive.h1.size = 24
    const {toJSON} = renderWithTheme(<HeadingRenderer node={HEADING_LEVEL2} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {style?: {fontSize?: number}}} | null
    expect(tree?.props?.style?.fontSize).toBe(24)
  })

  it('level 3 applies h2 type spec font size at productive', () => {
    // productive.h2.size = 18
    const {toJSON} = renderWithTheme(<HeadingRenderer node={HEADING_LEVEL3} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {style?: {fontSize?: number}}} | null
    expect(tree?.props?.style?.fontSize).toBe(18)
  })

  it('level 1 applies display type spec font size at expressive', () => {
    // expressive.display.size = 36
    const {toJSON} = renderWithTheme(<HeadingRenderer node={HEADING_LEVEL1} />, {
      stance: 'expressive',
      palette: 'health',
    })
    const tree = toJSON() as {props?: {style?: {fontSize?: number}}} | null
    expect(tree?.props?.style?.fontSize).toBe(36)
  })

  it('default level (no level prop) renders as level 2 → h1 type role', () => {
    // productive.h1.size = 24
    const {toJSON} = renderWithTheme(<HeadingRenderer node={HEADING_DEFAULT} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {style?: {fontSize?: number}}} | null
    expect(tree?.props?.style?.fontSize).toBe(24)
  })

  it('renders center-aligned heading', () => {
    const {toJSON} = renderWithTheme(<HeadingRenderer node={HEADING_CENTERED} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {style?: {textAlign?: string}}} | null
    expect(tree?.props?.style?.textAlign).toBe('center')
  })
})

// ---------------------------------------------------------------------------
// T-0006-084: empty text rejected at schema parse
// ---------------------------------------------------------------------------

describe('Heading schema (T-0006-084)', () => {
  it('rejects empty text at schema parse', () => {
    const result = HeadingSchema.safeParse({
      id: 'bad_heading',
      type: 'Heading',
      text: '',
    })
    expect(result.success).toBe(false)
  })

  it('accepts non-empty text', () => {
    const result = HeadingSchema.safeParse({
      id: 'good_heading',
      type: 'Heading',
      text: 'Hello world',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid level (4 is out of range)', () => {
    const result = HeadingSchema.safeParse({
      id: 'bad_level',
      type: 'Heading',
      text: 'Test',
      level: 4,
    })
    expect(result.success).toBe(false)
  })
})

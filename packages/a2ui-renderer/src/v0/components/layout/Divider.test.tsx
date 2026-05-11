/**
 * DividerRenderer tests
 * T-0009-018: snapshot at productive×focus (no label)
 * T-0009-019: snapshot at expressive×health (with label)
 * T-0009-025: accessibilityRole="none" when no label
 * T-0009-026: accessibilityRole="text" + accessibilityLabel when label present
 * T-0009-243: stance-driven vertical margin (space-md vs space-lg)
 */
import React from 'react'
import {renderWithTheme} from '../../__test-utils__/renderWithTheme'
import type {Node} from '@app-creator/protocol'
import {DividerRenderer} from './Divider'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type DividerNode = Extract<Node, {type: 'Divider'}>

const DIVIDER_MINIMAL: DividerNode = {
  id: 'div1',
  type: 'Divider',
}

const DIVIDER_WITH_LABEL: DividerNode = {
  id: 'div2',
  type: 'Divider',
  label: 'Today',
}

const DIVIDER_THICK: DividerNode = {
  id: 'div3',
  type: 'Divider',
  weight: 'thick',
}

const DIVIDER_INSET_START: DividerNode = {
  id: 'div4',
  type: 'Divider',
  inset: 'start',
}

const DIVIDER_INSET_BOTH: DividerNode = {
  id: 'div5',
  type: 'Divider',
  inset: 'both',
}

const DIVIDER_WITH_A11Y: DividerNode = {
  id: 'div6',
  type: 'Divider',
  label: 'Or',
  accessibilityLabel: 'Or — login alternative',
}

// ---------------------------------------------------------------------------
// T-0009-018: snapshot at productive×focus (no label)
// ---------------------------------------------------------------------------

describe('DividerRenderer snapshot (T-0009-018) — productive×focus no-label', () => {
  it('matches snapshot at productive×focus', () => {
    const {toJSON} = renderWithTheme(<DividerRenderer node={DIVIDER_MINIMAL} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0009-019: snapshot at expressive×health (with label)
// ---------------------------------------------------------------------------

describe('DividerRenderer snapshot (T-0009-019) — expressive×health with label', () => {
  it('matches snapshot at expressive×health', () => {
    const {toJSON} = renderWithTheme(<DividerRenderer node={DIVIDER_WITH_LABEL} />, {
      stance: 'expressive',
      palette: 'health',
    })
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0009-025: accessibilityRole="none" when no label
// ---------------------------------------------------------------------------

describe('DividerRenderer accessibility — no label (T-0009-025)', () => {
  it('has accessibilityRole="none" when no label', () => {
    const {toJSON} = renderWithTheme(<DividerRenderer node={DIVIDER_MINIMAL} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {accessibilityRole?: string}} | null
    expect(tree?.props?.accessibilityRole).toBe('none')
  })
})

// ---------------------------------------------------------------------------
// T-0009-026: accessibilityRole="text" + accessibilityLabel when label present
// ---------------------------------------------------------------------------

describe('DividerRenderer accessibility — with label (T-0009-026)', () => {
  it('has accessibilityRole="text" when label is present', () => {
    const {toJSON} = renderWithTheme(<DividerRenderer node={DIVIDER_WITH_LABEL} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {accessibilityRole?: string; accessibilityLabel?: string}} | null
    expect(tree?.props?.accessibilityRole).toBe('text')
  })

  it('uses label as accessibilityLabel when no explicit accessibilityLabel', () => {
    const {toJSON} = renderWithTheme(<DividerRenderer node={DIVIDER_WITH_LABEL} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {accessibilityLabel?: string}} | null
    expect(tree?.props?.accessibilityLabel).toBe('Today')
  })

  it('uses node.accessibilityLabel when explicitly provided', () => {
    const {toJSON} = renderWithTheme(<DividerRenderer node={DIVIDER_WITH_A11Y} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {accessibilityLabel?: string}} | null
    expect(tree?.props?.accessibilityLabel).toBe('Or — login alternative')
  })
})

// ---------------------------------------------------------------------------
// T-0009-243: stance-driven vertical margin (space-md vs space-lg)
// ---------------------------------------------------------------------------

describe('DividerRenderer stance treatment (T-0009-243)', () => {
  it('renders without error in productive stance', () => {
    const {toJSON} = renderWithTheme(<DividerRenderer node={DIVIDER_MINIMAL} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('renders without error in expressive stance', () => {
    const {toJSON} = renderWithTheme(<DividerRenderer node={DIVIDER_MINIMAL} />, {
      stance: 'expressive',
      palette: 'health',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('productive stance applies smaller vertical margin than expressive', () => {
    const {toJSON: toJSONProductive} = renderWithTheme(
      <DividerRenderer node={DIVIDER_MINIMAL} />,
      {stance: 'productive', palette: 'focus'},
    )
    const {toJSON: toJSONExpressive} = renderWithTheme(
      <DividerRenderer node={DIVIDER_MINIMAL} />,
      {stance: 'expressive', palette: 'health'},
    )
    type ViewTree = {props?: {style?: {marginVertical?: number}}} | null
    const prodMargin = (toJSONProductive() as ViewTree)?.props?.style?.marginVertical ?? 0
    const exprMargin = (toJSONExpressive() as ViewTree)?.props?.style?.marginVertical ?? 0
    expect(prodMargin).toBeLessThan(exprMargin)
  })
})

// ---------------------------------------------------------------------------
// Weight and inset behavior
// ---------------------------------------------------------------------------

describe('DividerRenderer weight', () => {
  it('renders hairline (default) as height: 1', () => {
    const {toJSON} = renderWithTheme(<DividerRenderer node={DIVIDER_MINIMAL} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {style?: {height?: number}}} | null
    expect(tree?.props?.style?.height).toBe(1)
  })

  it('renders thick weight as height: 2', () => {
    const {toJSON} = renderWithTheme(<DividerRenderer node={DIVIDER_THICK} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {style?: {height?: number}}} | null
    expect(tree?.props?.style?.height).toBe(2)
  })
})

describe('DividerRenderer inset', () => {
  it('renders with no left margin when inset is none', () => {
    const {toJSON} = renderWithTheme(<DividerRenderer node={DIVIDER_MINIMAL} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {style?: {marginLeft?: number}}} | null
    expect(tree?.props?.style?.marginLeft ?? 0).toBe(0)
  })

  it('renders with 16pt left margin when inset is start', () => {
    const {toJSON} = renderWithTheme(<DividerRenderer node={DIVIDER_INSET_START} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {style?: {marginLeft?: number}}} | null
    expect(tree?.props?.style?.marginLeft).toBe(16)
  })

  it('renders with 16pt both margins when inset is both', () => {
    const {toJSON} = renderWithTheme(<DividerRenderer node={DIVIDER_INSET_BOTH} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {style?: {marginLeft?: number; marginRight?: number}}} | null
    expect(tree?.props?.style?.marginLeft).toBe(16)
    expect(tree?.props?.style?.marginRight).toBe(16)
  })
})

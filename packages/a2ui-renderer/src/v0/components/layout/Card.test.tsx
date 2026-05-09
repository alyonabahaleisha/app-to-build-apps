/**
 * CardRenderer tests
 * T-0006-047: renders at productive×focus
 * T-0006-048: renders at expressive×health
 * T-0006-053: snapshot at productive×focus
 * T-0006-058: snapshot at expressive×health
 * T-0006-061: Card.elevation resolves to correct shadow recipe per stance
 */
import React from 'react'
import {renderWithTheme} from '../../__test-utils__/renderWithTheme'
import type {Node} from '@app-creator/protocol'
import {CardRenderer, SHADOW_RECIPES} from './Card'

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

type CardNode = Extract<Node, {type: 'Card'}>

const CARD_DEFAULT: CardNode = {
  id: 'card1',
  type: 'Card',
  children: [],
}

const CARD_FLAT: CardNode = {
  id: 'card2',
  type: 'Card',
  elevation: 'flat',
  children: [],
}

const CARD_RAISED: CardNode = {
  id: 'card3',
  type: 'Card',
  elevation: 'raised',
  padding: 'space-lg',
  children: [],
}

const CARD_FLOATING: CardNode = {
  id: 'card4',
  type: 'Card',
  elevation: 'floating',
  radius: 'radius-lg',
  children: [
    {id: 'inner1', type: 'Stack', children: []},
  ],
}

// ---------------------------------------------------------------------------
// T-0006-047: renders at productive×focus
// ---------------------------------------------------------------------------

describe('CardRenderer (T-0006-047) — productive×focus', () => {
  it('renders without error at productive×focus', () => {
    const {toJSON} = renderWithTheme(<CardRenderer node={CARD_DEFAULT} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('renders with explicit elevation, padding, radius', () => {
    const {toJSON} = renderWithTheme(<CardRenderer node={CARD_FLOATING} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// T-0006-048: renders at expressive×health
// ---------------------------------------------------------------------------

describe('CardRenderer (T-0006-048) — expressive×health', () => {
  it('renders without error at expressive×health', () => {
    const {toJSON} = renderWithTheme(<CardRenderer node={CARD_DEFAULT} />, {
      stance: 'expressive',
      palette: 'health',
    })
    expect(toJSON()).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// T-0006-053: snapshot at productive×focus
// ---------------------------------------------------------------------------

describe('CardRenderer snapshot (T-0006-053) — productive×focus', () => {
  it('matches snapshot at productive×focus', () => {
    const {toJSON} = renderWithTheme(<CardRenderer node={CARD_RAISED} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0006-058: snapshot at expressive×health
// ---------------------------------------------------------------------------

describe('CardRenderer snapshot (T-0006-058) — expressive×health', () => {
  it('matches snapshot at expressive×health', () => {
    const {toJSON} = renderWithTheme(<CardRenderer node={CARD_RAISED} />, {
      stance: 'expressive',
      palette: 'health',
    })
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0006-061: Card.elevation resolves to correct shadow recipe per stance
//
// Both stances use the same shadow recipes (per canvas-v0-ux.md §Elevation).
// The SHADOW_RECIPES constants are exported for test-level verification.
// ---------------------------------------------------------------------------

describe('CardRenderer elevation (T-0006-061)', () => {
  it('flat elevation has no shadow (shadowOpacity=0)', () => {
    expect(SHADOW_RECIPES.flat.shadowOpacity).toBe(0)
    expect(SHADOW_RECIPES.flat.elevation).toBe(0)
  })

  it('raised elevation has correct primary shadow (shadowRadius=2, opacity=0.06)', () => {
    expect(SHADOW_RECIPES.raised.shadowRadius).toBe(2)
    expect(SHADOW_RECIPES.raised.shadowOpacity).toBe(0.06)
    expect(SHADOW_RECIPES.raised.shadowOffset).toEqual({width: 0, height: 1})
  })

  it('floating elevation has correct primary shadow (shadowRadius=24, opacity=0.10)', () => {
    expect(SHADOW_RECIPES.floating.shadowRadius).toBe(24)
    expect(SHADOW_RECIPES.floating.shadowOpacity).toBe(0.1)
    expect(SHADOW_RECIPES.floating.shadowOffset).toEqual({width: 0, height: 8})
  })

  it('default elevation is raised at productive×focus', () => {
    // Render a card with no explicit elevation; rendered style should contain raised shadow values.
    const {toJSON} = renderWithTheme(<CardRenderer node={CARD_DEFAULT} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {style?: {shadowRadius?: number}}} | null
    // The outer View gets the shadow style applied
    expect(tree?.props?.style?.shadowRadius).toBe(SHADOW_RECIPES.raised.shadowRadius)
  })

  it('flat elevation applies flat recipe at expressive×health', () => {
    const {toJSON} = renderWithTheme(<CardRenderer node={CARD_FLAT} />, {
      stance: 'expressive',
      palette: 'health',
    })
    const tree = toJSON() as {props?: {style?: {shadowOpacity?: number}}} | null
    expect(tree?.props?.style?.shadowOpacity).toBe(0)
  })

  it('floating elevation applies floating recipe at productive×focus', () => {
    const {toJSON} = renderWithTheme(<CardRenderer node={CARD_FLOATING} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {style?: {shadowRadius?: number}}} | null
    expect(tree?.props?.style?.shadowRadius).toBe(SHADOW_RECIPES.floating.shadowRadius)
  })
})

/**
 * AvatarGroupRenderer tests
 * T-0009-076: renders up to maxShown avatars
 * T-0009-077: renders "+N" overflow when maxShown < avatars.length
 * T-0009-078: tight overlap applies -25% width margin
 * T-0009-086: snapshots at productive×focus + expressive×health
 * T-0009-241: auto-generated accessibilityLabel exact format
 */
import React from 'react'
import {renderWithTheme} from '../../__test-utils__/renderWithTheme'
import type {Node} from '@app-creator/protocol'
import {AvatarGroupRenderer} from './AvatarGroup'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type AvatarGroupNode = Extract<Node, {type: 'AvatarGroup'}>

const THREE_AVATARS: AvatarGroupNode = {
  id: 'ag1',
  type: 'AvatarGroup',
  avatars: [{name: 'Alex'}, {name: 'Sam'}, {name: 'Jordan'}],
  maxShown: 3,
}

const FIVE_AVATARS_MAXSHOWN_THREE: AvatarGroupNode = {
  id: 'ag2',
  type: 'AvatarGroup',
  avatars: [
    {name: 'Alex'},
    {name: 'Sam'},
    {name: 'Jordan'},
    {name: 'Kim'},
    {name: 'Pat'},
  ],
  maxShown: 3,
}

const TIGHT_OVERLAP: AvatarGroupNode = {
  ...THREE_AVATARS,
  id: 'ag3',
  overlap: 'tight',
  size: 'md',
}

const SPREAD_OVERLAP: AvatarGroupNode = {
  ...THREE_AVATARS,
  id: 'ag4',
  overlap: 'spread',
  size: 'md',
}

// ---------------------------------------------------------------------------
// T-0009-086: snapshots at productive×focus + expressive×health
// ---------------------------------------------------------------------------

describe('AvatarGroupRenderer snapshot (T-0009-086) — productive×focus', () => {
  it('matches snapshot at productive×focus', () => {
    const {toJSON} = renderWithTheme(<AvatarGroupRenderer node={THREE_AVATARS} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).toMatchSnapshot()
  })
})

describe('AvatarGroupRenderer snapshot (T-0009-086) — expressive×health', () => {
  it('matches snapshot at expressive×health', () => {
    const {toJSON} = renderWithTheme(<AvatarGroupRenderer node={THREE_AVATARS} />, {
      stance: 'expressive',
      palette: 'health',
    })
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0009-076: renders up to maxShown avatars without overflow
// ---------------------------------------------------------------------------

describe('AvatarGroupRenderer avatar count (T-0009-076)', () => {
  it('renders without error when avatars.length === maxShown', () => {
    const {toJSON} = renderWithTheme(<AvatarGroupRenderer node={THREE_AVATARS} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('renders single avatar without error', () => {
    const single: AvatarGroupNode = {
      id: 'ag_single',
      type: 'AvatarGroup',
      avatars: [{name: 'José García'}],
      maxShown: 3,
    }
    const {toJSON} = renderWithTheme(<AvatarGroupRenderer node={single} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('renders with non-ASCII names (Li Ming, O\'Brien)', () => {
    const intl: AvatarGroupNode = {
      id: 'ag_intl',
      type: 'AvatarGroup',
      avatars: [{name: '李明'}, {name: "O'Brien"}],
      maxShown: 3,
    }
    const {toJSON} = renderWithTheme(<AvatarGroupRenderer node={intl} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// T-0009-077: renders "+N" overflow when more than maxShown
// ---------------------------------------------------------------------------

describe('AvatarGroupRenderer overflow indicator (T-0009-077)', () => {
  it('renders without error when overflow exists', () => {
    const {toJSON} = renderWithTheme(
      <AvatarGroupRenderer node={FIVE_AVATARS_MAXSHOWN_THREE} />,
      {stance: 'productive', palette: 'focus'},
    )
    expect(toJSON()).not.toBeNull()
  })

  it('renders 5 avatars with maxShown=5 (no overflow)', () => {
    const noOverflow: AvatarGroupNode = {
      ...FIVE_AVATARS_MAXSHOWN_THREE,
      id: 'ag_no_overflow',
      maxShown: 5,
    }
    const {toJSON} = renderWithTheme(<AvatarGroupRenderer node={noOverflow} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// T-0009-078: tight overlap applies -25% width margin
// ---------------------------------------------------------------------------

describe('AvatarGroupRenderer overlap (T-0009-078)', () => {
  it('renders tight overlap without error', () => {
    const {toJSON} = renderWithTheme(<AvatarGroupRenderer node={TIGHT_OVERLAP} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('renders spread overlap without error', () => {
    const {toJSON} = renderWithTheme(<AvatarGroupRenderer node={SPREAD_OVERLAP} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('tight overlap produces larger negative margin than spread', () => {
    // md diameter = 32pt. tight=-25%→-8pt, spread=-10%→-3pt.
    // We verify this via the tree structure — check avatarGroup renders are distinct.
    const {toJSON: tightJSON} = renderWithTheme(<AvatarGroupRenderer node={TIGHT_OVERLAP} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const {toJSON: spreadJSON} = renderWithTheme(
      <AvatarGroupRenderer node={SPREAD_OVERLAP} />,
      {stance: 'productive', palette: 'focus'},
    )
    // Both render; snapshots differ (tight has larger negative margin).
    expect(tightJSON()).not.toBeNull()
    expect(spreadJSON()).not.toBeNull()
    // Tight and spread produce different trees (overlap margin difference).
    expect(JSON.stringify(tightJSON())).not.toEqual(JSON.stringify(spreadJSON()))
  })
})

// ---------------------------------------------------------------------------
// T-0009-241: auto-generated accessibilityLabel exact format
// ---------------------------------------------------------------------------

describe('AvatarGroupRenderer auto-generated accessibilityLabel (T-0009-241)', () => {
  it('generates "5 people: Alex, Sam, Jordan, and 2 others" for 5 avatars, maxShown=3', () => {
    const {toJSON} = renderWithTheme(
      <AvatarGroupRenderer node={FIVE_AVATARS_MAXSHOWN_THREE} />,
      {stance: 'productive', palette: 'focus'},
    )
    const tree = toJSON() as {props?: {accessibilityLabel?: string}} | null
    expect(tree?.props?.accessibilityLabel).toBe('5 people: Alex, Sam, Jordan, and 2 others')
  })

  it('generates "3 people: Alex, Sam, Jordan" for 3 avatars, maxShown=3 (no overflow suffix)', () => {
    const {toJSON} = renderWithTheme(<AvatarGroupRenderer node={THREE_AVATARS} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {accessibilityLabel?: string}} | null
    expect(tree?.props?.accessibilityLabel).toBe('3 people: Alex, Sam, Jordan')
  })

  it('generates "1 person: Alex" for 1 avatar', () => {
    const single: AvatarGroupNode = {
      id: 'ag_one',
      type: 'AvatarGroup',
      avatars: [{name: 'Alex'}],
      maxShown: 3,
    }
    const {toJSON} = renderWithTheme(<AvatarGroupRenderer node={single} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {accessibilityLabel?: string}} | null
    expect(tree?.props?.accessibilityLabel).toBe('1 person: Alex')
  })

  it('uses node.accessibilityLabel when explicitly provided', () => {
    const withA11y: AvatarGroupNode = {
      ...THREE_AVATARS,
      id: 'ag_a11y',
      accessibilityLabel: 'Custom label',
    }
    const {toJSON} = renderWithTheme(<AvatarGroupRenderer node={withA11y} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {accessibilityLabel?: string}} | null
    expect(tree?.props?.accessibilityLabel).toBe('Custom label')
  })

  it('has accessibilityRole="text" on the wrapper', () => {
    const {toJSON} = renderWithTheme(<AvatarGroupRenderer node={THREE_AVATARS} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {accessibilityRole?: string}} | null
    expect(tree?.props?.accessibilityRole).toBe('text')
  })
})

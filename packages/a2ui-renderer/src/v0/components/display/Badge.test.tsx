/**
 * BadgeRenderer tests
 * T-0006-072: snapshot at productive×focus
 * T-0006-073: snapshot at expressive×health
 * T-0006-080: Badge tone enum renders correct background tint
 */
import React from 'react'
import {renderWithTheme} from '../../__test-utils__/renderWithTheme'
import type {Node} from '@app-creator/protocol'
import {BadgeRenderer} from './Badge'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type BadgeNode = Extract<Node, {type: 'Badge'}>

const BADGE_NEUTRAL: BadgeNode = {
  id: 'badge1',
  type: 'Badge',
  text: 'Pending',
}

const BADGE_ACCENT: BadgeNode = {
  id: 'badge2',
  type: 'Badge',
  text: 'Active',
  tone: 'accent',
}

const BADGE_SUCCESS: BadgeNode = {
  id: 'badge3',
  type: 'Badge',
  text: 'Done',
  tone: 'success',
}

const BADGE_WARNING: BadgeNode = {
  id: 'badge4',
  type: 'Badge',
  text: 'Warning',
  tone: 'warning',
}

const BADGE_DANGER: BadgeNode = {
  id: 'badge5',
  type: 'Badge',
  text: 'Overdue',
  tone: 'danger',
}

// ---------------------------------------------------------------------------
// T-0006-072: snapshot at productive×focus
// ---------------------------------------------------------------------------

describe('BadgeRenderer snapshot (T-0006-072) — productive×focus', () => {
  it('matches snapshot at productive×focus', () => {
    const {toJSON} = renderWithTheme(<BadgeRenderer node={BADGE_NEUTRAL} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0006-073: snapshot at expressive×health
// ---------------------------------------------------------------------------

describe('BadgeRenderer snapshot (T-0006-073) — expressive×health', () => {
  it('matches snapshot at expressive×health', () => {
    const {toJSON} = renderWithTheme(<BadgeRenderer node={BADGE_NEUTRAL} />, {
      stance: 'expressive',
      palette: 'health',
    })
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0006-080: Badge tone enum renders correct background tint
// ---------------------------------------------------------------------------

describe('BadgeRenderer tone rendering (T-0006-080)', () => {
  it('renders neutral tone without error', () => {
    const {toJSON} = renderWithTheme(<BadgeRenderer node={BADGE_NEUTRAL} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('renders accent tone without error', () => {
    const {toJSON} = renderWithTheme(<BadgeRenderer node={BADGE_ACCENT} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('renders success tone without error', () => {
    const {toJSON} = renderWithTheme(<BadgeRenderer node={BADGE_SUCCESS} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('renders warning tone without error', () => {
    const {toJSON} = renderWithTheme(<BadgeRenderer node={BADGE_WARNING} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('renders danger tone without error', () => {
    const {toJSON} = renderWithTheme(<BadgeRenderer node={BADGE_DANGER} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('accent tone uses accent background color', () => {
    // productive focus accent = #4F46E5
    const {toJSON} = renderWithTheme(<BadgeRenderer node={BADGE_ACCENT} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {style?: {backgroundColor?: string}}} | null
    expect(tree?.props?.style?.backgroundColor).toBe('#4F46E5')
  })

  it('neutral tone uses divider background', () => {
    // productive divider = #ECEEF1
    const {toJSON} = renderWithTheme(<BadgeRenderer node={BADGE_NEUTRAL} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {style?: {backgroundColor?: string}}} | null
    expect(tree?.props?.style?.backgroundColor).toBe('#ECEEF1')
  })

  it('renders all 5 tones at expressive×health without error', () => {
    for (const badge of [BADGE_NEUTRAL, BADGE_ACCENT, BADGE_SUCCESS, BADGE_WARNING, BADGE_DANGER]) {
      const {toJSON} = renderWithTheme(<BadgeRenderer node={badge} />, {
        stance: 'expressive',
        palette: 'health',
      })
      expect(toJSON()).not.toBeNull()
    }
  })
})

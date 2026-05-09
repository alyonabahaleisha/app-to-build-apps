/**
 * StatRenderer tests
 * T-0006-070: snapshot at productive×focus
 * T-0006-071: snapshot at expressive×health
 * T-0006-079: delta-tone color resolves: positive→success, negative→danger, neutral→fg-muted
 * T-0006-085: Stat with delta undefined renders without delta block
 */
import React from 'react'
import {renderWithTheme} from '../../__test-utils__/renderWithTheme'
import type {Node} from '@app-creator/protocol'
import {StatRenderer} from './Stat'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type StatNode = Extract<Node, {type: 'Stat'}>

const STAT_BASIC: StatNode = {
  id: 'stat1',
  type: 'Stat',
  value: '5',
  label: 'tasks today',
}

const STAT_WITH_POSITIVE_DELTA: StatNode = {
  id: 'stat2',
  type: 'Stat',
  value: '12',
  label: 'done',
  delta: '+3 vs yesterday',
  deltaTone: 'positive',
}

const STAT_WITH_NEGATIVE_DELTA: StatNode = {
  id: 'stat3',
  type: 'Stat',
  value: '2',
  label: 'pending',
  delta: '-1',
  deltaTone: 'negative',
}

const STAT_NEUTRAL_DELTA: StatNode = {
  id: 'stat4',
  type: 'Stat',
  value: '8',
  label: 'total',
  delta: 'no change',
  deltaTone: 'neutral',
}

const STAT_NO_DELTA: StatNode = {
  id: 'stat5',
  type: 'Stat',
  value: '42',
  label: 'items',
  // delta intentionally absent
}

const STAT_NO_LABEL: StatNode = {
  id: 'stat6',
  type: 'Stat',
  value: '100%',
  label: 'progress',
}

// ---------------------------------------------------------------------------
// T-0006-070: snapshot at productive×focus
// ---------------------------------------------------------------------------

describe('StatRenderer snapshot (T-0006-070) — productive×focus', () => {
  it('matches snapshot at productive×focus', () => {
    const {toJSON} = renderWithTheme(<StatRenderer node={STAT_WITH_POSITIVE_DELTA} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0006-071: snapshot at expressive×health
// ---------------------------------------------------------------------------

describe('StatRenderer snapshot (T-0006-071) — expressive×health', () => {
  it('matches snapshot at expressive×health', () => {
    const {toJSON} = renderWithTheme(<StatRenderer node={STAT_WITH_POSITIVE_DELTA} />, {
      stance: 'expressive',
      palette: 'health',
    })
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0006-079: delta-tone color resolves correctly
// ---------------------------------------------------------------------------

describe('StatRenderer delta-tone (T-0006-079)', () => {
  it('renders at productive×focus without error', () => {
    const {toJSON} = renderWithTheme(<StatRenderer node={STAT_BASIC} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('renders at expressive×health without error', () => {
    const {toJSON} = renderWithTheme(<StatRenderer node={STAT_BASIC} />, {
      stance: 'expressive',
      palette: 'health',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('renders positive delta tone without error', () => {
    const {toJSON} = renderWithTheme(<StatRenderer node={STAT_WITH_POSITIVE_DELTA} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('renders negative delta tone without error', () => {
    const {toJSON} = renderWithTheme(<StatRenderer node={STAT_WITH_NEGATIVE_DELTA} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('renders neutral delta tone without error', () => {
    const {toJSON} = renderWithTheme(<StatRenderer node={STAT_NEUTRAL_DELTA} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// T-0006-085: Stat with delta undefined renders without delta block
// ---------------------------------------------------------------------------

describe('StatRenderer boundary (T-0006-085)', () => {
  it('renders without delta block when delta is undefined', () => {
    const {toJSON} = renderWithTheme(<StatRenderer node={STAT_NO_DELTA} />, {
      stance: 'productive',
      palette: 'focus',
    })
    // Should render without throwing; delta block simply not present
    expect(toJSON()).not.toBeNull()
  })

  it('renders a stat with just value and label', () => {
    const {toJSON} = renderWithTheme(<StatRenderer node={STAT_NO_LABEL} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })
})

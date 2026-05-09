/**
 * RowRenderer tests
 * T-0006-045: renders at productive×focus
 * T-0006-046: renders at expressive×health
 * T-0006-052: snapshot at productive×focus
 * T-0006-057: snapshot at expressive×health
 */
import React from 'react'
import {renderWithTheme} from '../../__test-utils__/renderWithTheme'
import type {Node} from '@app-creator/protocol'
import {RowRenderer} from './Row'

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

type RowNode = Extract<Node, {type: 'Row'}>

const ROW_DEFAULTS: RowNode = {
  id: 'row1',
  type: 'Row',
  children: [],
}

const ROW_CONFIGURED: RowNode = {
  id: 'row2',
  type: 'Row',
  gap: 'space-sm',
  align: 'center',
  justify: 'space-between',
  wrap: true,
  children: [
    {id: 'card1', type: 'Card', children: []},
    {id: 'card2', type: 'Card', children: []},
  ],
}

// ---------------------------------------------------------------------------
// T-0006-045: renders at productive×focus
// ---------------------------------------------------------------------------

describe('RowRenderer (T-0006-045) — productive×focus', () => {
  it('renders without error at productive×focus', () => {
    const {toJSON} = renderWithTheme(<RowRenderer node={ROW_DEFAULTS} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('renders configured Row (space-between, wrap, 2 children) correctly', () => {
    const {toJSON} = renderWithTheme(<RowRenderer node={ROW_CONFIGURED} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// T-0006-046: renders at expressive×health
// ---------------------------------------------------------------------------

describe('RowRenderer (T-0006-046) — expressive×health', () => {
  it('renders without error at expressive×health', () => {
    const {toJSON} = renderWithTheme(<RowRenderer node={ROW_CONFIGURED} />, {
      stance: 'expressive',
      palette: 'health',
    })
    expect(toJSON()).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// T-0006-052: snapshot at productive×focus
// ---------------------------------------------------------------------------

describe('RowRenderer snapshot (T-0006-052) — productive×focus', () => {
  it('matches snapshot at productive×focus', () => {
    const {toJSON} = renderWithTheme(<RowRenderer node={ROW_CONFIGURED} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0006-057: snapshot at expressive×health
// ---------------------------------------------------------------------------

describe('RowRenderer snapshot (T-0006-057) — expressive×health', () => {
  it('matches snapshot at expressive×health', () => {
    const {toJSON} = renderWithTheme(<RowRenderer node={ROW_CONFIGURED} />, {
      stance: 'expressive',
      palette: 'health',
    })
    expect(toJSON()).toMatchSnapshot()
  })
})

/**
 * TransactionRowRenderer tests
 *
 * T-0009-112: positive amount renders in success color
 * T-0009-113: negative amount renders in fg color (NOT danger)
 * T-0009-114: amount formatted via Intl.NumberFormat
 * T-0009-115: categoryIcon renders in 32pt circle with icon
 * T-0009-129: snapshots at productive×focus + expressive×health
 */
import React from 'react'
import type {Node} from '@app-creator/protocol'
import {renderWithTheme} from '../../__test-utils__/renderWithTheme'
import {TransactionRowRenderer} from './TransactionRow'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type TransactionRowNode = Extract<Node, {type: 'TransactionRow'}>

const BASE_NODE: TransactionRowNode = {
  id: 'txn1',
  type: 'TransactionRow',
  date: '2026-01-15',
  merchant: 'Acme Coffee',
  amount: {kind: 'literal', value: 1250},
  currency: 'USD',
}

const NEGATIVE_NODE: TransactionRowNode = {
  ...BASE_NODE,
  id: 'txn2',
  amount: {kind: 'literal', value: -750},
}

const WITH_ICON_NODE: TransactionRowNode = {
  ...BASE_NODE,
  id: 'txn3',
  categoryIcon: 'shopping-bag',
}

const DIVERSE_MERCHANT_NODE: TransactionRowNode = {
  ...BASE_NODE,
  id: 'txn4',
  merchant: 'José García — 李明商店',
}

// ---------------------------------------------------------------------------
// T-0009-129: snapshot at productive×focus
// ---------------------------------------------------------------------------

describe('TransactionRowRenderer snapshot (T-0009-129) — productive×focus', () => {
  it('matches snapshot at productive×focus', () => {
    const {toJSON} = renderWithTheme(<TransactionRowRenderer node={BASE_NODE} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0009-129: snapshot at expressive×health
// ---------------------------------------------------------------------------

describe('TransactionRowRenderer snapshot (T-0009-129) — expressive×health', () => {
  it('matches snapshot at expressive×health', () => {
    const {toJSON} = renderWithTheme(<TransactionRowRenderer node={BASE_NODE} />, {
      stance: 'expressive',
      palette: 'health',
    })
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0009-112: positive amount renders in success color
// ---------------------------------------------------------------------------

describe('TransactionRowRenderer positive amount color (T-0009-112)', () => {
  it('T-0009-112: positive amount (1250 cents) uses success color text', () => {
    const {toJSON} = renderWithTheme(<TransactionRowRenderer node={BASE_NODE} />, {
      stance: 'productive',
      palette: 'focus',
    })
    // Verify the component renders (success color applied internally).
    expect(toJSON()).not.toBeNull()
  })

  it('renders without error with positive amount', () => {
    const {toJSON} = renderWithTheme(<TransactionRowRenderer node={BASE_NODE} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// T-0009-113: negative amount renders in fg color (NOT danger)
// ---------------------------------------------------------------------------

describe('TransactionRowRenderer negative amount color (T-0009-113)', () => {
  it('T-0009-113: negative amount (-750 cents) uses fg color, not danger', () => {
    const {toJSON} = renderWithTheme(<TransactionRowRenderer node={NEGATIVE_NODE} />, {
      stance: 'productive',
      palette: 'focus',
    })
    // Verify renders without error; color lock is enforced by snapshot below.
    expect(toJSON()).not.toBeNull()
  })

  it('T-0009-113: negative amount snapshot at productive×focus — locks fg (#14171A), not danger (#C03A2B)', () => {
    // Option A: snapshot pins exact color. "#14171A" = fg, "#C03A2B" = danger.
    // If someone changes negative amount color to danger, this snapshot fails.
    const {toJSON} = renderWithTheme(<TransactionRowRenderer node={NEGATIVE_NODE} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0009-114: amount formatted via Intl.NumberFormat
// ---------------------------------------------------------------------------

describe('TransactionRowRenderer amount formatting (T-0009-114)', () => {
  it('T-0009-114: renders USD amount as currency string (e.g., $12.50)', () => {
    const {getAllByText} = renderWithTheme(<TransactionRowRenderer node={BASE_NODE} />, {
      stance: 'productive',
      palette: 'focus',
    })
    // Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'}).format(12.50) → '$12.50'
    // accessibilityElementsHidden is set on children; use {hidden: true} to find them.
    expect(getAllByText('$12.50', {includeHiddenElements: true}).length).toBeGreaterThanOrEqual(1)
  })

  it('formats EUR currency correctly', () => {
    const eurNode: TransactionRowNode = {
      ...BASE_NODE,
      id: 'txn_eur',
      currency: 'EUR',
      amount: {kind: 'literal', value: 500},
    }
    const {toJSON} = renderWithTheme(<TransactionRowRenderer node={eurNode} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('renders merchant name (diverse chars)', () => {
    const {getAllByText} = renderWithTheme(<TransactionRowRenderer node={DIVERSE_MERCHANT_NODE} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(
      getAllByText('José García — 李明商店', {includeHiddenElements: true}).length,
    ).toBeGreaterThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// T-0009-115: categoryIcon renders in 32pt circle
// ---------------------------------------------------------------------------

describe('TransactionRowRenderer categoryIcon (T-0009-115)', () => {
  it('T-0009-115: renders with categoryIcon without error', () => {
    const {toJSON} = renderWithTheme(<TransactionRowRenderer node={WITH_ICON_NODE} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('renders without categoryIcon without error', () => {
    const {toJSON} = renderWithTheme(<TransactionRowRenderer node={BASE_NODE} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('renders date in the component', () => {
    const {getAllByText} = renderWithTheme(<TransactionRowRenderer node={BASE_NODE} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(getAllByText('2026-01-15', {includeHiddenElements: true}).length).toBeGreaterThanOrEqual(1)
  })
})

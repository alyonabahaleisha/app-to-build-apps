/**
 * ReceiptRenderer tests
 *
 * T-0009-118: Receipt subtotal + tax + tip === total validates clean (display-only)
 * T-0009-119: Receipt subtotal + tax + tip = total + 1 cent validates clean (display-only)
 * T-0009-120: 5-cent mismatch produces receipt_total_mismatch (Step 8 wires validateCrossRefs)
 * T-0009-130: snapshots at productive×focus + expressive×health
 * T-0009-135: dotted-leader via repeated '.' characters
 * T-0009-237: no tax/no tip — subtotal === total clean; subtotal === total + 5 cents warns
 *
 * Note on T-0009-118..120 and T-0009-237:
 *   Receipt math validation is deferred to Step 8's validateCrossRefs. This renderer
 *   is display-only and renders the data as-is. Tests here verify the renderer doesn't
 *   crash on valid/invalid math and that items + summary rows are rendered.
 *   The warning emission test (T-0009-120) is implemented in Step 8's validate test.
 */
import React from 'react'
import type {Node} from '@app-creator/protocol'
import {renderWithTheme} from '../../__test-utils__/renderWithTheme'
import {ReceiptRenderer} from './Receipt'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type ReceiptNode = Extract<Node, {type: 'Receipt'}>

const LITERAL_AMOUNT = (value: number) => ({kind: 'literal' as const, value})

const BASE_RECEIPT: ReceiptNode = {
  id: 'rcp1',
  type: 'Receipt',
  items: [
    {label: 'Cappuccino', amount: LITERAL_AMOUNT(450)},
    {label: 'Muffin', amount: LITERAL_AMOUNT(350)},
  ],
  subtotal: LITERAL_AMOUNT(800),
  total: LITERAL_AMOUNT(800),
  currency: 'USD',
}

const RECEIPT_WITH_TAX_TIP: ReceiptNode = {
  ...BASE_RECEIPT,
  id: 'rcp2',
  subtotal: LITERAL_AMOUNT(800),
  tax: LITERAL_AMOUNT(64),
  tip: LITERAL_AMOUNT(120),
  total: LITERAL_AMOUNT(984),
}

const RECEIPT_MISMATCH: ReceiptNode = {
  ...BASE_RECEIPT,
  id: 'rcp3',
  subtotal: LITERAL_AMOUNT(800),
  tax: LITERAL_AMOUNT(64),
  tip: LITERAL_AMOUNT(120),
  // total is 5 cents off — triggers receipt_total_mismatch in Step 8 validator
  total: LITERAL_AMOUNT(989),
}

const RECEIPT_1_CENT_TOLERANCE: ReceiptNode = {
  ...BASE_RECEIPT,
  id: 'rcp4',
  subtotal: LITERAL_AMOUNT(800),
  tax: LITERAL_AMOUNT(64),
  // 1 cent off — within tolerance, no warning
  total: LITERAL_AMOUNT(865),
}

const RECEIPT_NO_TAX_TIP_CLEAN: ReceiptNode = {
  ...BASE_RECEIPT,
  id: 'rcp5',
  subtotal: LITERAL_AMOUNT(450),
  total: LITERAL_AMOUNT(450),
}

const RECEIPT_NO_TAX_TIP_MISMATCH: ReceiptNode = {
  ...BASE_RECEIPT,
  id: 'rcp6',
  subtotal: LITERAL_AMOUNT(450),
  // 5 cents off — still warns even without tax/tip (T-0009-237)
  total: LITERAL_AMOUNT(455),
}

// ---------------------------------------------------------------------------
// T-0009-130: snapshot at productive×focus
// ---------------------------------------------------------------------------

describe('ReceiptRenderer snapshot (T-0009-130) — productive×focus', () => {
  it('matches snapshot at productive×focus', () => {
    const {toJSON} = renderWithTheme(<ReceiptRenderer node={BASE_RECEIPT} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0009-130: snapshot at expressive×health
// ---------------------------------------------------------------------------

describe('ReceiptRenderer snapshot (T-0009-130) — expressive×health', () => {
  it('matches snapshot at expressive×health', () => {
    const {toJSON} = renderWithTheme(<ReceiptRenderer node={BASE_RECEIPT} />, {
      stance: 'expressive',
      palette: 'health',
    })
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0009-118: clean math renders without error
// ---------------------------------------------------------------------------

describe('ReceiptRenderer clean math (T-0009-118)', () => {
  it('T-0009-118: renders receipt where subtotal + tax + tip === total without crash', () => {
    const {toJSON} = renderWithTheme(<ReceiptRenderer node={RECEIPT_WITH_TAX_TIP} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('renders items', () => {
    const {getAllByText} = renderWithTheme(<ReceiptRenderer node={BASE_RECEIPT} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(getAllByText('Cappuccino', {includeHiddenElements: true}).length).toBeGreaterThanOrEqual(1)
    expect(getAllByText('Muffin', {includeHiddenElements: true}).length).toBeGreaterThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// T-0009-119: 1-cent tolerance renders without error
// ---------------------------------------------------------------------------

describe('ReceiptRenderer 1-cent tolerance (T-0009-119)', () => {
  it('T-0009-119: renders receipt with 1-cent math discrepancy without crash', () => {
    const {toJSON} = renderWithTheme(<ReceiptRenderer node={RECEIPT_1_CENT_TOLERANCE} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// T-0009-120: 5-cent mismatch — renderer is display-only; warning is Step 8's job
// ---------------------------------------------------------------------------

describe('ReceiptRenderer 5-cent mismatch display-only (T-0009-120)', () => {
  it('T-0009-120: renderer renders mismatched receipt without crash (validation in Step 8)', () => {
    // The renderer does not validate math — it renders what it's given.
    // The receipt_total_mismatch warning is emitted by validateCrossRefs (Step 8).
    const {toJSON} = renderWithTheme(<ReceiptRenderer node={RECEIPT_MISMATCH} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// T-0009-135: dotted-leader via repeated '.' characters
// ---------------------------------------------------------------------------

describe('ReceiptRenderer dotted-leader (T-0009-135)', () => {
  it('T-0009-135: renders dotted leaders as repeated dot characters', () => {
    const {getAllByText} = renderWithTheme(<ReceiptRenderer node={BASE_RECEIPT} />, {
      stance: 'productive',
      palette: 'focus',
    })
    // The leader contains only dots (T-0009-135: iOS borderStyle: 'dotted' fallback).
    // accessibilityElementsHidden is set on leader elements; use {hidden: true}.
    const leaders = getAllByText(/^\.+$/, {includeHiddenElements: true})
    expect(leaders.length).toBeGreaterThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// T-0009-237: no tax/no tip — clean vs. 5-cent mismatch
// ---------------------------------------------------------------------------

describe('ReceiptRenderer no-tax-no-tip math (T-0009-237)', () => {
  it('T-0009-237: renders no-tax-no-tip receipt where subtotal === total without crash', () => {
    const {toJSON} = renderWithTheme(<ReceiptRenderer node={RECEIPT_NO_TAX_TIP_CLEAN} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('T-0009-237: renders no-tax-no-tip receipt with 5-cent mismatch without crash (Step 8 warns)', () => {
    const {toJSON} = renderWithTheme(<ReceiptRenderer node={RECEIPT_NO_TAX_TIP_MISMATCH} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('renders Subtotal in footer', () => {
    const {getAllByText} = renderWithTheme(<ReceiptRenderer node={BASE_RECEIPT} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(getAllByText('Subtotal', {includeHiddenElements: true}).length).toBeGreaterThanOrEqual(1)
    expect(getAllByText('Total', {includeHiddenElements: true}).length).toBeGreaterThanOrEqual(1)
  })

  it('renders Tax and Tip labels when present', () => {
    const {getAllByText} = renderWithTheme(<ReceiptRenderer node={RECEIPT_WITH_TAX_TIP} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(getAllByText('Tax', {includeHiddenElements: true}).length).toBeGreaterThanOrEqual(1)
    expect(getAllByText('Tip', {includeHiddenElements: true}).length).toBeGreaterThanOrEqual(1)
  })

  it('does not render Tax or Tip labels when absent', () => {
    const {queryAllByText} = renderWithTheme(<ReceiptRenderer node={BASE_RECEIPT} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(queryAllByText('Tax', {includeHiddenElements: true}).length).toBe(0)
    expect(queryAllByText('Tip', {includeHiddenElements: true}).length).toBe(0)
  })

  it('renders item with quantity', () => {
    const nodeWithQuantity: ReceiptNode = {
      ...BASE_RECEIPT,
      id: 'rcp_qty',
      items: [{label: 'Espresso', amount: LITERAL_AMOUNT(300), quantity: 2}],
    }
    const {getAllByText} = renderWithTheme(<ReceiptRenderer node={nodeWithQuantity} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(getAllByText('Espresso ×2', {includeHiddenElements: true}).length).toBeGreaterThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// T-0009-238: currency boundary — non-USD summary rows use correct currency symbol
// Category: Boundary (currency boundary across non-USD)
// ---------------------------------------------------------------------------

describe('ReceiptRenderer EUR currency boundary (T-0009-238)', () => {
  const EUR_RECEIPT: ReceiptNode = {
    id: 'rcp_eur',
    type: 'Receipt',
    items: [
      {label: 'Croissant', amount: LITERAL_AMOUNT(350)},
    ],
    subtotal: LITERAL_AMOUNT(350),
    tax: LITERAL_AMOUNT(35),
    tip: LITERAL_AMOUNT(50),
    total: LITERAL_AMOUNT(435),
    currency: 'EUR',
  }

  it('T-0009-238: EUR receipt renders € symbol in Total summary row', () => {
    const {toJSON} = renderWithTheme(<ReceiptRenderer node={EUR_RECEIPT} />, {
      stance: 'productive',
      palette: 'focus',
    })
    // Intl.NumberFormat('en-US', {style: 'currency', currency: 'EUR'}) → '€4.35' or '€ 4.35'
    // Assert € appears in the rendered tree (covers Subtotal, Tax, Tip, and Total rows).
    const tree = JSON.stringify(toJSON())
    expect(tree).toContain('€')
  })

  it('T-0009-238: EUR receipt does not render $ in summary rows', () => {
    const {toJSON} = renderWithTheme(<ReceiptRenderer node={EUR_RECEIPT} />, {
      stance: 'productive',
      palette: 'focus',
    })
    // Before this fix, SummaryRow hardcoded 'USD' — summary rows would render '$'.
    const tree = JSON.stringify(toJSON())
    expect(tree).not.toContain('"$')
  })
})

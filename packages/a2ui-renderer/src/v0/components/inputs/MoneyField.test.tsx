/**
 * MoneyFieldRenderer tests — ADR-0009 Step 2
 *
 * T-0009-033: MoneyFieldSchema parses valid examples.
 * T-0009-035: Renderer canonicalizes "12.50" → 1250 (USD); 125 (JPY).
 * T-0009-036: User input "abc" rejected at blur.
 * T-0009-037: JPY "12.50" → 12 (drops decimal).
 * T-0009-059: Snapshots at productive×focus + expressive×health.
 * T-0009-228: Floating-point regression — parseAndCanonicalize avoids float bugs.
 */
import React from 'react'
import {fireEvent, act} from '@testing-library/react-native'
import type {Node, Spec} from '@app-creator/protocol'
import {MoneyFieldSchema} from '@app-creator/protocol'
import {renderWithTheme} from '../../__test-utils__/renderWithTheme'
import {buildInitialRendererState} from '../../state/reducer'
import {MoneyFieldRenderer, parseAndCanonicalize, centsToDollarString} from './MoneyField'

type MoneyFieldNode = Extract<Node, {type: 'MoneyField'}>

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SPEC: Spec = {
  version: 1,
  archetype: 'Calculator',
  stance: 'productive',
  palette: 'money',
  coverIcon: 'list',
  navigation: 'none',
  screens: [{id: 's1', root: {id: 'n1', type: 'Heading', text: 'T', level: 1}}],
  initialScreenId: 's1',
  collections: [],
  initialState: {amount: 1250},
}

const MF_USD: MoneyFieldNode = {
  id: 'mf1',
  type: 'MoneyField',
  label: 'Tip amount',
  valueBinding: {kind: 'state', slot: 'amount'},
  currency: 'USD',
}

const MF_JPY: MoneyFieldNode = {
  id: 'mf2',
  type: 'MoneyField',
  label: 'Price',
  valueBinding: {kind: 'state', slot: 'amount'},
  currency: 'JPY',
}

const MF_LITERAL: MoneyFieldNode = {
  id: 'mf3',
  type: 'MoneyField',
  label: 'Fixed cost',
  valueBinding: {kind: 'literal', value: 500},
  currency: 'EUR',
}

// ---------------------------------------------------------------------------
// T-0009-228 (P0): Floating-point regression — parseAndCanonicalize
// ---------------------------------------------------------------------------

describe('parseAndCanonicalize — floating-point regression (T-0009-228)', () => {
  it('0.10 + 0.20 = 30 cents exactly (no float drift)', () => {
    const a = parseAndCanonicalize('0.10', 'USD')
    const b = parseAndCanonicalize('0.20', 'USD')
    expect(a).toBe(10)
    expect(b).toBe(20)
    expect(a + b).toBe(30) // NOT 30.000000000000004
    expect(typeof (a + b)).toBe('number')
    expect(Number.isInteger(a + b)).toBe(true)
  })

  it('0.10 × 3 = 30 (integer multiplication)', () => {
    const cents = parseAndCanonicalize('0.10', 'USD')
    expect(cents * 3).toBe(30)
  })

  it('99.99 USD = 9999 cents', () => {
    expect(parseAndCanonicalize('99.99', 'USD')).toBe(9999)
  })

  it('12.50 USD = 1250 cents', () => {
    expect(parseAndCanonicalize('12.50', 'USD')).toBe(1250)
  })

  it('12.50 JPY = 12 (zero-decimal: drops decimal)', () => {
    expect(parseAndCanonicalize('12.50', 'JPY')).toBe(12)
  })

  it('125 JPY = 125 (whole yen)', () => {
    expect(parseAndCanonicalize('125', 'JPY')).toBe(125)
  })

  it('returns NaN for non-numeric input "abc"', () => {
    expect(parseAndCanonicalize('abc', 'USD')).toBeNaN()
  })

  it('returns NaN for empty string', () => {
    expect(parseAndCanonicalize('', 'USD')).toBeNaN()
  })

  it('handles negative values correctly', () => {
    expect(parseAndCanonicalize('-12.50', 'USD')).toBe(-1250)
  })

  it('handles whole-dollar amounts', () => {
    expect(parseAndCanonicalize('100', 'USD')).toBe(10000)
  })
})

// ---------------------------------------------------------------------------
// centsToDollarString
// ---------------------------------------------------------------------------

describe('centsToDollarString', () => {
  it('1250 USD → "12.50"', () => {
    expect(centsToDollarString(1250, 'USD')).toBe('12.50')
  })

  it('125 JPY → "125"', () => {
    expect(centsToDollarString(125, 'JPY')).toBe('125')
  })

  it('0 USD → "0.00"', () => {
    expect(centsToDollarString(0, 'USD')).toBe('0.00')
  })

  it('-500 USD → "-5.00"', () => {
    expect(centsToDollarString(-500, 'USD')).toBe('-5.00')
  })
})

// ---------------------------------------------------------------------------
// Schema validation (T-0009-033)
// ---------------------------------------------------------------------------

describe('MoneyFieldSchema validation (T-0009-033)', () => {
  const BASE = {
    id: 'mf1',
    type: 'MoneyField' as const,
    label: 'Amount',
    valueBinding: {kind: 'state' as const, slot: 'amount'},
  }

  it('parses with just required fields', () => {
    const result = MoneyFieldSchema.safeParse(BASE)
    expect(result.success).toBe(true)
  })

  it('parses all 7 currency values', () => {
    for (const currency of ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'INR']) {
      const result = MoneyFieldSchema.safeParse({...BASE, currency})
      expect(result.success).toBe(true)
    }
  })

  it('rejects unknown currency', () => {
    const result = MoneyFieldSchema.safeParse({...BASE, currency: 'XYZ'})
    expect(result.success).toBe(false)
  })

  it('parses with min and max (in cents)', () => {
    const result = MoneyFieldSchema.safeParse({...BASE, min: 100, max: 10000})
    expect(result.success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// T-0009-059: Snapshots at productive×focus + expressive×health
// ---------------------------------------------------------------------------

describe('MoneyFieldRenderer snapshot (T-0009-059) — productive×focus', () => {
  it('matches snapshot at productive×focus', () => {
    const state = buildInitialRendererState(SPEC)
    const {toJSON} = renderWithTheme(
      <MoneyFieldRenderer node={MF_USD} />,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})

describe('MoneyFieldRenderer snapshot (T-0009-059) — expressive×health', () => {
  it('matches snapshot at expressive×health', () => {
    const state = buildInitialRendererState(SPEC)
    const {toJSON} = renderWithTheme(
      <MoneyFieldRenderer node={MF_USD} />,
      {stance: 'expressive', palette: 'health', rendererState: state},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// Renderer behavior: dispatch, binding, currency display
// ---------------------------------------------------------------------------

describe('MoneyFieldRenderer behavior (T-0009-035..037)', () => {
  it('renders USD field with currency symbol', () => {
    const state = buildInitialRendererState(SPEC)
    const {toJSON} = renderWithTheme(
      <MoneyFieldRenderer node={MF_USD} />,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )
    const tree = JSON.stringify(toJSON())
    expect(tree).toContain('$') // USD symbol
  })

  it('renders JPY field with yen symbol', () => {
    const state = buildInitialRendererState(SPEC)
    const {toJSON} = renderWithTheme(
      <MoneyFieldRenderer node={MF_JPY} />,
      {stance: 'productive', palette: 'focus', rendererState: state},
    )
    const tree = JSON.stringify(toJSON())
    expect(tree).toContain('¥')
  })

  it('dispatches set with integer cents on blur (USD)', () => {
    const mockDispatch = jest.fn()
    const state = buildInitialRendererState(SPEC)
    const {getByTestId} = renderWithTheme(
      <MoneyFieldRenderer node={MF_USD} />,
      {stance: 'productive', palette: 'focus', rendererState: state, dispatch: mockDispatch},
    )

    const input = getByTestId('moneyfield-input-mf1')
    act(() => { fireEvent.changeText(input, '12.50') })
    act(() => { fireEvent(input, 'blur') })

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'set',
      target: 'amount',
      value: 1250,
    })
    // Verify the value is an integer (cents), not a float.
    const callArg = mockDispatch.mock.calls[0]?.[0]
    expect(Number.isInteger(callArg?.value)).toBe(true)
  })

  it('does not dispatch on blur for non-numeric input (T-0009-036)', () => {
    const mockDispatch = jest.fn()
    const state = buildInitialRendererState(SPEC)
    const {getByTestId} = renderWithTheme(
      <MoneyFieldRenderer node={MF_USD} />,
      {stance: 'productive', palette: 'focus', rendererState: state, dispatch: mockDispatch},
    )

    const input = getByTestId('moneyfield-input-mf1')
    act(() => { fireEvent.changeText(input, 'abc') })
    act(() => { fireEvent(input, 'blur') })

    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('does not dispatch for literal binding (T-0009-036)', () => {
    const mockDispatch = jest.fn()
    const {getByTestId} = renderWithTheme(
      <MoneyFieldRenderer node={MF_LITERAL} />,
      {stance: 'productive', palette: 'focus', dispatch: mockDispatch},
    )

    const input = getByTestId('moneyfield-input-mf3')
    act(() => { fireEvent.changeText(input, '10.00') })
    act(() => { fireEvent(input, 'blur') })

    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('has accessibilityRole adjustable', () => {
    const {toJSON} = renderWithTheme(
      <MoneyFieldRenderer node={MF_LITERAL} />,
      {stance: 'productive', palette: 'focus'},
    )
    const tree = JSON.stringify(toJSON())
    expect(tree).toContain('"accessibilityRole":"adjustable"')
  })
})

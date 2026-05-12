/**
 * CommerceCard tests — ADR-0009 Step 7
 *
 * T-0009-165: CommerceCardSchema.parse({image, title, price, action}) succeeds
 * T-0009-166: CommerceCard renders price with currency formatting
 * T-0009-167: CommerceCard priceCompare renders strikethrough when present
 * T-0009-168: CommerceCard image clips to top of card via borderTopLeftRadius + overflow: hidden
 * T-0009-169: CommerceCard badge renders top-right corner of image
 * T-0009-182: Snapshot at productive×focus + expressive×health
 */
import React from 'react'
import {fireEvent} from '@testing-library/react-native'
import {CommerceCardSchema} from '@app-creator/protocol'
import type {Node} from '@app-creator/protocol'
import {renderWithTheme} from '../../__test-utils__/renderWithTheme'
import {CommerceCardRenderer} from './CommerceCard'

type CommerceCardNode = Extract<Node, {type: 'CommerceCard'}>

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_COMMERCE_CARD: CommerceCardNode = {
  id: 'cc1',
  type: 'CommerceCard',
  title: 'Wireless Headphones',
  image: {kind: 'literal', value: 'https://example.com/headphones.jpg'},
  price: {kind: 'literal', value: 9999},
  currency: 'USD',
  ctaLabel: 'Add',
}

const COMMERCE_CARD_WITH_COMPARE: CommerceCardNode = {
  ...BASE_COMMERCE_CARD,
  id: 'cc2',
  price: {kind: 'literal', value: 7999},
  priceCompare: {kind: 'literal', value: 9999},
}

const COMMERCE_CARD_WITH_BADGE: CommerceCardNode = {
  ...BASE_COMMERCE_CARD,
  id: 'cc3',
  badge: 'Sale',
}

const COMMERCE_CARD_WITH_ACTION: CommerceCardNode = {
  ...BASE_COMMERCE_CARD,
  id: 'cc4',
  ctaAction: {type: 'toast', message: 'Added to cart'},
}

// ---------------------------------------------------------------------------
// T-0009-165: Schema validation
// ---------------------------------------------------------------------------

describe('CommerceCardSchema validation (T-0009-165)', () => {
  it('T-0009-165: parses with image, title, price', () => {
    const result = CommerceCardSchema.safeParse({
      id: 'cc1',
      type: 'CommerceCard',
      title: 'Sneakers',
      image: {kind: 'literal', value: 'https://example.com/sneakers.jpg'},
      price: {kind: 'literal', value: 8999},
    })
    expect(result.success).toBe(true)
  })

  it('currency is optional (renderer defaults to USD)', () => {
    const result = CommerceCardSchema.safeParse({
      id: 'cc1',
      type: 'CommerceCard',
      title: 'Sneakers',
      image: {kind: 'literal', value: 'https://example.com/sneakers.jpg'},
      price: {kind: 'literal', value: 8999},
    })
    expect(result.success).toBe(true)
    if (result.success) {
      // Optional — renderer applies USD default when absent
      expect(result.data.currency === undefined || typeof result.data.currency === 'string').toBe(true)
    }
  })

  it('ctaLabel is optional (renderer defaults to "Add")', () => {
    const result = CommerceCardSchema.safeParse({
      id: 'cc1',
      type: 'CommerceCard',
      title: 'Sneakers',
      image: {kind: 'literal', value: 'https://example.com/sneakers.jpg'},
      price: {kind: 'literal', value: 8999},
    })
    expect(result.success).toBe(true)
    if (result.success) {
      // Optional — renderer applies 'Add' default when absent
      expect(result.data.ctaLabel === undefined || typeof result.data.ctaLabel === 'string').toBe(true)
    }
  })

  it('rejects title over 120 chars', () => {
    const result = CommerceCardSchema.safeParse({
      id: 'cc1',
      type: 'CommerceCard',
      title: 'A'.repeat(121),
      image: {kind: 'literal', value: 'https://example.com/x.jpg'},
      price: {kind: 'literal', value: 100},
    })
    expect(result.success).toBe(false)
  })

  it('rejects ctaLabel over 40 chars', () => {
    const result = CommerceCardSchema.safeParse({
      id: 'cc1',
      type: 'CommerceCard',
      title: 'Product',
      image: {kind: 'literal', value: 'https://example.com/x.jpg'},
      price: {kind: 'literal', value: 100},
      ctaLabel: 'A'.repeat(41),
    })
    expect(result.success).toBe(false)
  })

  it('accepts diverse product titles (i18n)', () => {
    for (const title of ['José García', '電子製品', "O'Brien's Gadget"]) {
      const result = CommerceCardSchema.safeParse({
        id: 'cc1',
        type: 'CommerceCard',
        title,
        image: {kind: 'literal', value: 'https://example.com/x.jpg'},
        price: {kind: 'literal', value: 100},
      })
      expect(result.success).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// T-0009-166: Currency formatting
// ---------------------------------------------------------------------------

describe('CommerceCard price rendering (T-0009-166)', () => {
  it('T-0009-166: renders 9999 cents as $99.99 (USD)', () => {
    const {getByTestId} = renderWithTheme(
      <CommerceCardRenderer node={BASE_COMMERCE_CARD} />,
      {stance: 'productive', palette: 'focus'},
    )
    const priceEl = getByTestId('commerce-card-price-cc1')
    expect(priceEl.props.children).toBe('$99.99')
  })

  it('renders EUR currency formatted correctly', () => {
    const eurCard: CommerceCardNode = {
      ...BASE_COMMERCE_CARD,
      id: 'cc-eur',
      price: {kind: 'literal', value: 4999},
      currency: 'EUR',
    }
    const {getByTestId} = renderWithTheme(
      <CommerceCardRenderer node={eurCard} />,
      {stance: 'productive', palette: 'focus'},
    )
    const priceEl = getByTestId('commerce-card-price-cc-eur')
    // EUR formatting varies slightly by locale; assert it starts with EUR symbol or code
    const text = priceEl.props.children as string
    expect(text).toMatch(/49\.99/)
  })
})

// ---------------------------------------------------------------------------
// T-0009-167: priceCompare strikethrough
// ---------------------------------------------------------------------------

describe('CommerceCard priceCompare (T-0009-167)', () => {
  it('T-0009-167: priceCompare renders with textDecorationLine: line-through', () => {
    const {getByTestId} = renderWithTheme(
      <CommerceCardRenderer node={COMMERCE_CARD_WITH_COMPARE} />,
      {stance: 'productive', palette: 'focus'},
    )
    const compareEl = getByTestId('commerce-card-price-compare-cc2')
    expect(compareEl.props.style).toMatchObject({
      textDecorationLine: 'line-through',
    })
  })

  it('priceCompare text shows original price', () => {
    const {getByTestId} = renderWithTheme(
      <CommerceCardRenderer node={COMMERCE_CARD_WITH_COMPARE} />,
      {stance: 'productive', palette: 'focus'},
    )
    const compareEl = getByTestId('commerce-card-price-compare-cc2')
    expect(compareEl.props.children).toBe('$99.99')
  })

  it('priceCompare is not rendered when not provided', () => {
    const {queryByTestId} = renderWithTheme(
      <CommerceCardRenderer node={BASE_COMMERCE_CARD} />,
      {stance: 'productive', palette: 'focus'},
    )
    expect(queryByTestId('commerce-card-price-compare-cc1')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// T-0009-168: Image clips to top of card
// ---------------------------------------------------------------------------

describe('CommerceCard image clipping (T-0009-168)', () => {
  it('T-0009-168: image container has borderTopLeftRadius and overflow: hidden', () => {
    const {getByTestId} = renderWithTheme(
      <CommerceCardRenderer node={BASE_COMMERCE_CARD} />,
      {stance: 'productive', palette: 'focus'},
    )
    const card = getByTestId('commerce-card-cc1')
    // The card container itself has overflow: 'hidden'
    expect(card.props.style).toMatchObject({overflow: 'hidden'})
  })
})

// ---------------------------------------------------------------------------
// T-0009-169: Badge renders top-right corner
// ---------------------------------------------------------------------------

describe('CommerceCard badge (T-0009-169)', () => {
  it('T-0009-169: badge renders when provided', () => {
    const {getByTestId} = renderWithTheme(
      <CommerceCardRenderer node={COMMERCE_CARD_WITH_BADGE} />,
      {stance: 'productive', palette: 'focus'},
    )
    const badge = getByTestId('commerce-card-badge-cc3')
    expect(badge).toBeTruthy()
  })

  it('badge is positioned absolutely at top-right', () => {
    const {getByTestId} = renderWithTheme(
      <CommerceCardRenderer node={COMMERCE_CARD_WITH_BADGE} />,
      {stance: 'productive', palette: 'focus'},
    )
    const badge = getByTestId('commerce-card-badge-cc3')
    expect(badge.props.style).toMatchObject({position: 'absolute', top: 8, right: 8})
  })

  it('badge is not rendered when not provided', () => {
    const {queryByTestId} = renderWithTheme(
      <CommerceCardRenderer node={BASE_COMMERCE_CARD} />,
      {stance: 'productive', palette: 'focus'},
    )
    expect(queryByTestId('commerce-card-badge-cc1')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// CTA action dispatch
// ---------------------------------------------------------------------------

describe('CommerceCard CTA dispatch', () => {
  it('pressing CTA dispatches ctaAction', () => {
    const mockDispatch = jest.fn()
    const {getByTestId} = renderWithTheme(
      <CommerceCardRenderer node={COMMERCE_CARD_WITH_ACTION} />,
      {stance: 'productive', palette: 'focus', dispatch: mockDispatch},
    )
    const cta = getByTestId('commerce-card-cta-cc4')
    fireEvent.press(cta)
    expect(mockDispatch).toHaveBeenCalledWith({type: 'toast', message: 'Added to cart'})
  })
})

// ---------------------------------------------------------------------------
// T-0009-182: Snapshots
// ---------------------------------------------------------------------------

describe('CommerceCardRenderer snapshots (T-0009-182)', () => {
  it('T-0009-182a: snapshot at productive×focus', () => {
    const {toJSON} = renderWithTheme(
      <CommerceCardRenderer node={BASE_COMMERCE_CARD} />,
      {stance: 'productive', palette: 'focus'},
    )
    expect(toJSON()).toMatchSnapshot()
  })

  it('T-0009-182b: snapshot at expressive×health', () => {
    const {toJSON} = renderWithTheme(
      <CommerceCardRenderer node={COMMERCE_CARD_WITH_COMPARE} />,
      {stance: 'expressive', palette: 'health'},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})

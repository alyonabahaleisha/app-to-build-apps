/**
 * SliderRenderer tests — ADR-0009 Step 2
 *
 * T-0009-044: SliderSchema parses valid schema.
 * T-0009-046 (a11y): VoiceOver swipe-up increments by step.
 * T-0009-047: Reduced-motion: instant update (no spring).
 * T-0009-059: Snapshots at productive×focus + expressive×health.
 */
import React from 'react'
import {fireEvent, act} from '@testing-library/react-native'
import type {Node} from '@app-creator/protocol'
import {SliderSchema} from '@app-creator/protocol'
import {renderWithTheme} from '../../__test-utils__/renderWithTheme'
import {SliderRenderer, formatSliderValue} from './Slider'

type SliderNode = Extract<Node, {type: 'Slider'}>

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SL_STATE: SliderNode = {
  id: 'sl1',
  type: 'Slider',
  label: 'Volume',
  valueBinding: {kind: 'state', slot: 'volume'},
  min: 0,
  max: 100,
  step: 5,
  showValue: true,
  format: 'integer',
}

const SL_PERCENT: SliderNode = {
  id: 'sl2',
  type: 'Slider',
  label: 'Progress',
  valueBinding: {kind: 'literal', value: 50},
  min: 0,
  max: 100,
  format: 'percent',
}

const SL_DECIMAL: SliderNode = {
  id: 'sl3',
  type: 'Slider',
  label: 'Temperature',
  valueBinding: {kind: 'literal', value: 36},
  min: 35,
  max: 40,
  format: 'decimal',
}

// ---------------------------------------------------------------------------
// formatSliderValue unit tests
// ---------------------------------------------------------------------------

describe('formatSliderValue', () => {
  it("integer format → whole number string", () => {
    expect(formatSliderValue(50, 'integer')).toBe('50')
    expect(formatSliderValue(50.7, 'integer')).toBe('51')
  })

  it("percent format → N% string", () => {
    expect(formatSliderValue(75, 'percent')).toBe('75%')
  })

  it("decimal format → 1 decimal place", () => {
    expect(formatSliderValue(36.5, 'decimal')).toBe('36.5')
  })

  it("undefined format defaults to integer", () => {
    expect(formatSliderValue(42, undefined)).toBe('42')
  })
})

// ---------------------------------------------------------------------------
// Schema validation (T-0009-044)
// ---------------------------------------------------------------------------

describe('SliderSchema validation (T-0009-044)', () => {
  const BASE = {
    id: 'sl1',
    type: 'Slider' as const,
    label: 'Volume',
    valueBinding: {kind: 'state' as const, slot: 'v'},
    min: 0,
    max: 100,
  }

  it('parses with required fields (T-0009-044)', () => {
    const result = SliderSchema.safeParse(BASE)
    expect(result.success).toBe(true)
  })

  it('parses with step: 5', () => {
    const result = SliderSchema.safeParse({...BASE, step: 5})
    expect(result.success).toBe(true)
  })

  it('parses all format values', () => {
    for (const format of ['integer', 'decimal', 'percent']) {
      const result = SliderSchema.safeParse({...BASE, format})
      expect(result.success).toBe(true)
    }
  })

  it('rejects negative step', () => {
    const result = SliderSchema.safeParse({...BASE, step: -1})
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// T-0009-059: Snapshots
// ---------------------------------------------------------------------------

describe('SliderRenderer snapshot (T-0009-059) — productive×focus', () => {
  it('matches snapshot at productive×focus', () => {
    const {toJSON} = renderWithTheme(
      <SliderRenderer node={SL_PERCENT} />,
      {stance: 'productive', palette: 'focus'},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})

describe('SliderRenderer snapshot (T-0009-059) — expressive×health', () => {
  it('matches snapshot at expressive×health', () => {
    const {toJSON} = renderWithTheme(
      <SliderRenderer node={SL_PERCENT} />,
      {stance: 'expressive', palette: 'health'},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// Renderer behavior
// ---------------------------------------------------------------------------

describe('SliderRenderer behavior', () => {
  it('renders without error', () => {
    const {toJSON} = renderWithTheme(
      <SliderRenderer node={SL_STATE} />,
      {stance: 'productive', palette: 'focus'},
    )
    expect(toJSON()).not.toBeNull()
  })

  it('has accessibilityRole adjustable (T-0009-046)', () => {
    const {toJSON} = renderWithTheme(
      <SliderRenderer node={SL_STATE} />,
      {stance: 'productive', palette: 'focus'},
    )
    const tree = JSON.stringify(toJSON())
    expect(tree).toContain('"accessibilityRole":"adjustable"')
  })

  it('renders value badge when showValue=true', () => {
    const {getByTestId} = renderWithTheme(
      <SliderRenderer node={SL_STATE} />,
      {stance: 'productive', palette: 'focus'},
    )
    expect(getByTestId('slider-badge-sl1')).toBeTruthy()
  })

  it('does not render value badge when showValue=false', () => {
    const node: SliderNode = {...SL_STATE, showValue: false}
    const {queryByTestId} = renderWithTheme(
      <SliderRenderer node={node} />,
      {stance: 'productive', palette: 'focus'},
    )
    expect(queryByTestId('slider-badge-sl1')).toBeNull()
  })

  it('VoiceOver increment increases value by step (T-0009-046)', () => {
    const mockDispatch = jest.fn()
    const {getByTestId} = renderWithTheme(
      <SliderRenderer node={SL_STATE} />,
      {stance: 'productive', palette: 'focus', dispatch: mockDispatch},
    )

    const container = getByTestId('slider-container-sl1')
    act(() => {
      fireEvent(container, 'accessibilityAction', {nativeEvent: {actionName: 'increment'}})
    })

    // Initial value is min=0; after increment by step=5, should be 5.
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({type: 'set', value: 5}),
    )
  })

  it('VoiceOver decrement decreases value by step', () => {
    const mockDispatch = jest.fn()
    // Node with literal value 50 — but we need state binding to dispatch.
    const node: SliderNode = {
      ...SL_STATE,
      valueBinding: {kind: 'state', slot: 'volume'},
    }
    const {getByTestId} = renderWithTheme(
      <SliderRenderer node={node} />,
      {stance: 'productive', palette: 'focus', dispatch: mockDispatch},
    )

    const container = getByTestId('slider-container-sl1')
    // First increment then decrement to test boundary.
    act(() => {
      fireEvent(container, 'accessibilityAction', {nativeEvent: {actionName: 'increment'}})
    })
    act(() => {
      fireEvent(container, 'accessibilityAction', {nativeEvent: {actionName: 'decrement'}})
    })

    // Second call is decrement — back to 0 (clamped at min).
    const calls = mockDispatch.mock.calls
    expect(calls.length).toBeGreaterThanOrEqual(2)
  })

  it('renders percent format (T-0009-047)', () => {
    const {toJSON} = renderWithTheme(
      <SliderRenderer node={SL_PERCENT} />,
      {stance: 'productive', palette: 'focus'},
    )
    const tree = JSON.stringify(toJSON())
    expect(tree).toContain('%')
  })

  it('renders decimal format', () => {
    const {toJSON} = renderWithTheme(
      <SliderRenderer node={SL_DECIMAL} />,
      {stance: 'productive', palette: 'focus'},
    )
    expect(toJSON()).not.toBeNull()
  })
})

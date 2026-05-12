/**
 * BeforeAfter tests — ADR-0009 Step 7
 *
 * T-0009-170: BeforeAfterSchema.parse({before, after, mode: 'slider'}) succeeds
 * T-0009-171: BeforeAfter slider mode — a11y increment/decrement actions update drag position
 * T-0009-172: BeforeAfter handle is accessibilityRole="adjustable"; swipe up/down adjusts reveal by 10%
 * T-0009-173: BeforeAfter side-by-side mode renders two equal columns with hairline divider
 * T-0009-183: Snapshot at productive×focus + expressive×health
 */
import React from 'react'
import {fireEvent} from '@testing-library/react-native'
import {BeforeAfterSchema} from '@app-creator/protocol'
import type {Node} from '@app-creator/protocol'
import {renderWithTheme} from '../../__test-utils__/renderWithTheme'
import {BeforeAfterRenderer} from './BeforeAfter'

// Mock useReducedMotion from react-native-reanimated so we can control
// the reduced-motion branch in tests.
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated')
  return {
    ...actual,
    useReducedMotion: jest.fn().mockReturnValue(false),
  }
})

import {useReducedMotion} from 'react-native-reanimated'
const mockUseReducedMotion = useReducedMotion as jest.MockedFunction<typeof useReducedMotion>

type BeforeAfterNode = Extract<Node, {type: 'BeforeAfter'}>

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BEFORE_IMAGE = {kind: 'literal' as const, value: 'https://example.com/before.jpg'}
const AFTER_IMAGE = {kind: 'literal' as const, value: 'https://example.com/after.jpg'}

const BEFORE_AFTER_SLIDER: BeforeAfterNode = {
  id: 'ba1',
  type: 'BeforeAfter',
  before: BEFORE_IMAGE,
  after: AFTER_IMAGE,
  mode: 'slider',
  beforeLabel: 'Before',
  afterLabel: 'After',
}

const BEFORE_AFTER_SIDE: BeforeAfterNode = {
  id: 'ba2',
  type: 'BeforeAfter',
  before: BEFORE_IMAGE,
  after: AFTER_IMAGE,
  mode: 'side-by-side',
  beforeLabel: 'Before',
  afterLabel: 'After',
}

const BEFORE_AFTER_DEFAULT: BeforeAfterNode = {
  id: 'ba3',
  type: 'BeforeAfter',
  before: BEFORE_IMAGE,
  after: AFTER_IMAGE,
}

// ---------------------------------------------------------------------------
// T-0009-170: Schema validation
// ---------------------------------------------------------------------------

describe('BeforeAfterSchema validation (T-0009-170)', () => {
  it('T-0009-170: parses with before, after, mode: slider', () => {
    const result = BeforeAfterSchema.safeParse({
      id: 'ba1',
      type: 'BeforeAfter',
      before: BEFORE_IMAGE,
      after: AFTER_IMAGE,
      mode: 'slider',
    })
    expect(result.success).toBe(true)
  })

  it('parses with mode: side-by-side', () => {
    const result = BeforeAfterSchema.safeParse({
      id: 'ba1',
      type: 'BeforeAfter',
      before: BEFORE_IMAGE,
      after: AFTER_IMAGE,
      mode: 'side-by-side',
    })
    expect(result.success).toBe(true)
  })

  it('parses without mode (renderer defaults to slider)', () => {
    const result = BeforeAfterSchema.safeParse({
      id: 'ba1',
      type: 'BeforeAfter',
      before: BEFORE_IMAGE,
      after: AFTER_IMAGE,
    })
    expect(result.success).toBe(true)
  })

  it('rejects mode: "fade" (not in enum)', () => {
    const result = BeforeAfterSchema.safeParse({
      id: 'ba1',
      type: 'BeforeAfter',
      before: BEFORE_IMAGE,
      after: AFTER_IMAGE,
      mode: 'fade',
    })
    expect(result.success).toBe(false)
  })

  it('rejects beforeLabel over 40 chars', () => {
    const result = BeforeAfterSchema.safeParse({
      id: 'ba1',
      type: 'BeforeAfter',
      before: BEFORE_IMAGE,
      after: AFTER_IMAGE,
      beforeLabel: 'A'.repeat(41),
    })
    expect(result.success).toBe(false)
  })

  it('rejects extra props (.strict())', () => {
    const result = BeforeAfterSchema.safeParse({
      id: 'ba1',
      type: 'BeforeAfter',
      before: BEFORE_IMAGE,
      after: AFTER_IMAGE,
      unknownProp: true,
    })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// T-0009-171: Slider mode — a11y increment/decrement actions update drag position
// ---------------------------------------------------------------------------

describe('BeforeAfter slider mode (T-0009-171)', () => {
  beforeEach(() => {
    mockUseReducedMotion.mockReturnValue(false)
  })

  it('T-0009-171: slider mode renders the composite view with after-clip and thumb', () => {
    const {getByTestId} = renderWithTheme(
      <BeforeAfterRenderer node={BEFORE_AFTER_SLIDER} />,
      {stance: 'productive', palette: 'focus'},
    )
    // The Reanimated worklet-backed clip container and thumb should be in the tree
    const composite = getByTestId('before-after-composite-ba1')
    const afterClip = getByTestId('before-after-after-clip-ba1')
    const thumb = getByTestId('before-after-thumb-ba1')
    expect(composite).toBeTruthy()
    expect(afterClip).toBeTruthy()
    expect(thumb).toBeTruthy()
  })

  it('T-0009-171: increment action increases accessibilityValue.now by ~10', () => {
    // Exercises the JS-side a11y path at BeforeAfter.tsx:240-251 (onAccessibilityAction).
    // This is the testable proxy for drag position since Reanimated worklets
    // cannot be driven through pan gestures in the Jest environment.
    const {getByTestId} = renderWithTheme(
      <BeforeAfterRenderer node={BEFORE_AFTER_SLIDER} />,
      {stance: 'productive', palette: 'focus'},
    )
    const thumb = getByTestId('before-after-thumb-ba1')
    const initialNow = thumb.props.accessibilityValue.now as number

    fireEvent(thumb, 'accessibilityAction', {nativeEvent: {actionName: 'increment'}})

    const updatedThumb = getByTestId('before-after-thumb-ba1')
    const updatedNow = updatedThumb.props.accessibilityValue.now as number
    // Default clipPct starts at 0.5 (50). Increment steps +10 → clamped to 60.
    expect(updatedNow).toBeGreaterThan(initialNow)
    expect(updatedNow).toBe(60)
  })

  it('T-0009-171: decrement action decreases accessibilityValue.now by ~10', () => {
    // Exercises the decrement branch of onAccessibilityAction at BeforeAfter.tsx:246-250.
    const {getByTestId} = renderWithTheme(
      <BeforeAfterRenderer node={BEFORE_AFTER_SLIDER} />,
      {stance: 'productive', palette: 'focus'},
    )
    const thumb = getByTestId('before-after-thumb-ba1')
    const initialNow = thumb.props.accessibilityValue.now as number

    fireEvent(thumb, 'accessibilityAction', {nativeEvent: {actionName: 'decrement'}})

    const updatedThumb = getByTestId('before-after-thumb-ba1')
    const updatedNow = updatedThumb.props.accessibilityValue.now as number
    // Default clipPct starts at 0.5 (50). Decrement steps -10 → clamped to 40.
    expect(updatedNow).toBeLessThan(initialNow)
    expect(updatedNow).toBe(40)
  })

  it('T-0009-171: increment clamps at 95 (does not exceed max)', () => {
    // Verify upper-bound clamping: fire increment many times, value should not exceed 95.
    const {getByTestId} = renderWithTheme(
      <BeforeAfterRenderer node={BEFORE_AFTER_SLIDER} />,
      {stance: 'productive', palette: 'focus'},
    )
    // Fire 10 increments — enough to push beyond 0.95
    for (let i = 0; i < 10; i++) {
      fireEvent(getByTestId('before-after-thumb-ba1'), 'accessibilityAction', {
        nativeEvent: {actionName: 'increment'},
      })
    }
    const finalThumb = getByTestId('before-after-thumb-ba1')
    expect(finalThumb.props.accessibilityValue.now).toBe(95)
  })

  it('slider mode renders even without explicit mode (defaults to slider)', () => {
    const {getByTestId} = renderWithTheme(
      <BeforeAfterRenderer node={BEFORE_AFTER_DEFAULT} />,
      {stance: 'productive', palette: 'focus'},
    )
    expect(getByTestId('before-after-composite-ba3')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// T-0009-172: Accessibility — adjustable role + increment/decrement
// ---------------------------------------------------------------------------

describe('BeforeAfter accessibility (T-0009-172)', () => {
  beforeEach(() => {
    mockUseReducedMotion.mockReturnValue(false)
  })

  it('T-0009-172: thumb has accessibilityRole="adjustable"', () => {
    const {getByTestId} = renderWithTheme(
      <BeforeAfterRenderer node={BEFORE_AFTER_SLIDER} />,
      {stance: 'productive', palette: 'focus'},
    )
    const thumb = getByTestId('before-after-thumb-ba1')
    expect(thumb.props.accessibilityRole).toBe('adjustable')
  })

  it('T-0009-172: thumb has accessibilityActions for increment and decrement', () => {
    const {getByTestId} = renderWithTheme(
      <BeforeAfterRenderer node={BEFORE_AFTER_SLIDER} />,
      {stance: 'productive', palette: 'focus'},
    )
    const thumb = getByTestId('before-after-thumb-ba1')
    const actions = thumb.props.accessibilityActions as Array<{name: string; label: string}>
    const names = actions.map(a => a.name)
    expect(names).toContain('increment')
    expect(names).toContain('decrement')
  })

  it('T-0009-172: thumb has accessibilityValue with min/max/now', () => {
    const {getByTestId} = renderWithTheme(
      <BeforeAfterRenderer node={BEFORE_AFTER_SLIDER} />,
      {stance: 'productive', palette: 'focus'},
    )
    const thumb = getByTestId('before-after-thumb-ba1')
    const value = thumb.props.accessibilityValue
    expect(value.min).toBe(0)
    expect(value.max).toBe(100)
    expect(typeof value.now).toBe('number')
  })
})

// ---------------------------------------------------------------------------
// T-0009-172 a11y: Reduced-motion bypass
// ---------------------------------------------------------------------------

describe('BeforeAfter reduced-motion bypass', () => {
  it('reduced motion ON: slider mode renders static side-by-side (no thumb, no composite)', () => {
    mockUseReducedMotion.mockReturnValue(true)

    const {queryByTestId, getByTestId} = renderWithTheme(
      <BeforeAfterRenderer node={BEFORE_AFTER_SLIDER} />,
      {stance: 'productive', palette: 'focus'},
    )

    // Slider-specific elements should NOT be present
    expect(queryByTestId('before-after-composite-ba1')).toBeNull()
    expect(queryByTestId('before-after-thumb-ba1')).toBeNull()

    // Hairline divider from side-by-side layout should be present
    const divider = getByTestId('before-after-divider-ba1')
    expect(divider).toBeTruthy()
  })

  afterEach(() => {
    mockUseReducedMotion.mockReturnValue(false)
  })
})

// ---------------------------------------------------------------------------
// T-0009-173: Side-by-side mode
// ---------------------------------------------------------------------------

describe('BeforeAfter side-by-side mode (T-0009-173)', () => {
  beforeEach(() => {
    mockUseReducedMotion.mockReturnValue(false)
  })

  it('T-0009-173: side-by-side renders hairline divider', () => {
    const {getByTestId} = renderWithTheme(
      <BeforeAfterRenderer node={BEFORE_AFTER_SIDE} />,
      {stance: 'productive', palette: 'focus'},
    )
    const divider = getByTestId('before-after-divider-ba2')
    expect(divider).toBeTruthy()
  })

  it('T-0009-173: side-by-side does not render slider thumb', () => {
    const {queryByTestId} = renderWithTheme(
      <BeforeAfterRenderer node={BEFORE_AFTER_SIDE} />,
      {stance: 'productive', palette: 'focus'},
    )
    expect(queryByTestId('before-after-thumb-ba2')).toBeNull()
  })

  it('T-0009-173: side-by-side shows both before and after labels', () => {
    const {getAllByText} = renderWithTheme(
      <BeforeAfterRenderer node={BEFORE_AFTER_SIDE} />,
      {stance: 'productive', palette: 'focus'},
    )
    expect(getAllByText('Before').length).toBeGreaterThanOrEqual(1)
    expect(getAllByText('After').length).toBeGreaterThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// T-0009-183: Snapshots
// ---------------------------------------------------------------------------

describe('BeforeAfterRenderer snapshots (T-0009-183)', () => {
  beforeEach(() => {
    mockUseReducedMotion.mockReturnValue(false)
  })

  it('T-0009-183a: snapshot at productive×focus (slider mode)', () => {
    const {toJSON} = renderWithTheme(
      <BeforeAfterRenderer node={BEFORE_AFTER_SLIDER} />,
      {stance: 'productive', palette: 'focus'},
    )
    expect(toJSON()).toMatchSnapshot()
  })

  it('T-0009-183b: snapshot at expressive×health (side-by-side mode)', () => {
    const {toJSON} = renderWithTheme(
      <BeforeAfterRenderer node={BEFORE_AFTER_SIDE} />,
      {stance: 'expressive', palette: 'health'},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})

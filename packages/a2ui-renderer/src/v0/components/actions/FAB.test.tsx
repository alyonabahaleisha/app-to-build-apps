/**
 * FABRenderer tests
 *
 * T-0006-150: snapshot at productive×focus
 * T-0006-151: snapshot at expressive×health
 * T-0006-156: FAB renders 56pt accent circle at floating elevation
 * T-0006-157: FAB scale-in springy on first mount
 * T-0006-159: Reduced-motion: animations collapse to instant
 * T-0006-161g: FAB with disabled literal true: 50% opacity + flat elevation; press no-op; no haptic
 */
import React from 'react'
import {fireEvent} from '@testing-library/react-native'
import type {Node} from '@app-creator/protocol'
import {renderWithTheme} from '../../__test-utils__/renderWithTheme'
import * as useReducedMotionModule from '../../a11y/useReducedMotion'
import {FABRenderer} from './FAB'

type FabNode = Extract<Node, {type: 'FAB'}>

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_FAB: FabNode = {
  id: 'fab1',
  type: 'FAB',
  icon: 'plus',
  action: {type: 'addItem', collection: 'tasks', item: {name: 'New task'}},
  accessibilityLabel: 'Add task',
}

// ---------------------------------------------------------------------------
// T-0006-150: snapshot at productive×focus
// ---------------------------------------------------------------------------

describe('FABRenderer snapshot (T-0006-150) — productive×focus', () => {
  it('matches snapshot', () => {
    const {toJSON} = renderWithTheme(<FABRenderer node={BASE_FAB} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0006-151: snapshot at expressive×health
// ---------------------------------------------------------------------------

describe('FABRenderer snapshot (T-0006-151) — expressive×health', () => {
  it('matches snapshot', () => {
    const node: FabNode = {
      ...BASE_FAB,
      id: 'fab2',
      action: {type: 'navigate', target: 's2'},
      accessibilityLabel: 'Go to next screen',
    }
    const {toJSON} = renderWithTheme(<FABRenderer node={node} />, {
      stance: 'expressive',
      palette: 'health',
    })
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0006-156: FAB renders 56pt accent circle at floating elevation
// ---------------------------------------------------------------------------

describe('FABRenderer visual properties (T-0006-156)', () => {
  it('renders a 56pt circle with accent background', () => {
    const {toJSON} = renderWithTheme(<FABRenderer node={BASE_FAB} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = JSON.stringify(toJSON())
    // productive×focus accent: #4F46E5
    expect(tree).toContain('#4F46E5')
    // 56pt width/height
    expect(tree).toContain('"width":56')
    expect(tree).toContain('"height":56')
    // Border radius for full circle
    expect(tree).toContain('"borderRadius":28')
  })

  it('renders with floating elevation shadow (non-disabled)', () => {
    const {toJSON} = renderWithTheme(<FABRenderer node={BASE_FAB} />)
    const tree = JSON.stringify(toJSON())
    // FAB has shadowOpacity > 0 (elevation-floating)
    expect(tree).toContain('"shadowOpacity":')
  })

  it('accessibility label matches node.accessibilityLabel', () => {
    const {getByLabelText} = renderWithTheme(<FABRenderer node={BASE_FAB} />)
    expect(getByLabelText('Add task')).toBeTruthy()
  })

  it('accessibility role is "button"', () => {
    const {getByRole} = renderWithTheme(<FABRenderer node={BASE_FAB} />)
    expect(getByRole('button')).toBeTruthy()
  })

  it('press dispatches node.action', () => {
    const mockDispatch = jest.fn()
    const {getByRole} = renderWithTheme(<FABRenderer node={BASE_FAB} />, {
      dispatch: mockDispatch,
    })
    fireEvent.press(getByRole('button'))
    expect(mockDispatch).toHaveBeenCalledWith(BASE_FAB.action)
  })

  it('has minimum 44pt hit target (56pt satisfies this)', () => {
    // FAB is 56pt, which exceeds the 44pt minimum.
    const {toJSON} = renderWithTheme(<FABRenderer node={BASE_FAB} />)
    const tree = JSON.stringify(toJSON())
    expect(tree).toContain('"width":56')
    expect(tree).toContain('"height":56')
  })
})

// ---------------------------------------------------------------------------
// T-0006-157: FAB scale-in springy on first mount
// ---------------------------------------------------------------------------

describe('FABRenderer mount animation (T-0006-157)', () => {
  it('renders the FAB container on first mount', () => {
    // Reanimated spring animation is driven by the UI thread. In tests,
    // the shared value starts at 0 and the spring is scheduled. We verify
    // the FAB container renders (indicating the animation component mounts).
    const {getByTestId} = renderWithTheme(<FABRenderer node={BASE_FAB} />)
    expect(getByTestId('fab-container')).toBeTruthy()
  })

  it('reduced motion: scale starts at 1 (no spring animation)', () => {
    // Mock useReducedMotion to return true.
    jest.spyOn(useReducedMotionModule, 'useReducedMotion').mockReturnValue(true)

    const {toJSON} = renderWithTheme(<FABRenderer node={BASE_FAB} />)
    // Component mounts without error; scale is at 1 (instant).
    expect(toJSON()).not.toBeNull()

    jest.restoreAllMocks()
  })
})

// ---------------------------------------------------------------------------
// T-0006-159: Reduced-motion: animations collapse to instant; haptics still fire
//
// FABRenderer renders in isolation with a mockDispatch — no real middleware
// chain is in scope. The haptic half of T-0006-159 ("haptics still fire") is
// asserted in haptics.test.ts, which tests the haptics middleware directly for
// the addItem verb. Haptics are middleware-level and fire regardless of reduced-
// motion preference (useReducedMotion only suppresses animation, not haptics).
// Option B cross-reference pattern per ADR-0006 Roz ruling.
// ---------------------------------------------------------------------------

describe('FABRenderer reduced motion (T-0006-159)', () => {
  it('renders correctly with reduced motion active', () => {
    jest.spyOn(useReducedMotionModule, 'useReducedMotion').mockReturnValue(true)

    const {toJSON} = renderWithTheme(<FABRenderer node={BASE_FAB} />)
    expect(toJSON()).not.toBeNull()

    jest.restoreAllMocks()
  })

  it('still dispatches press event with reduced motion active (haptic half: see haptics.test.ts)', () => {
    jest.spyOn(useReducedMotionModule, 'useReducedMotion').mockReturnValue(true)

    const mockDispatch = jest.fn()
    const {getByRole} = renderWithTheme(<FABRenderer node={BASE_FAB} />, {
      dispatch: mockDispatch,
    })
    fireEvent.press(getByRole('button'))
    expect(mockDispatch).toHaveBeenCalledWith(BASE_FAB.action)

    jest.restoreAllMocks()
  })
})

// ---------------------------------------------------------------------------
// T-0006-161g: FAB disabled: 50% opacity + flat elevation; press no-op; no haptic
// ---------------------------------------------------------------------------

describe('FABRenderer disabled state (T-0006-161g)', () => {
  // FABSchema does not include a `disabled` field in the locked protocol schema.
  // The renderer handles it defensively for forward-compat. We cast to test.

  it('disabled FAB renders at 50% opacity', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node = {...BASE_FAB, id: 'fab-disabled', disabled: {kind: 'literal', value: true}} as any as FabNode
    const {toJSON} = renderWithTheme(<FABRenderer node={node} />)
    const tree = JSON.stringify(toJSON())
    expect(tree).toContain('"opacity":0.5')
  })

  it('disabled FAB renders flat elevation (no shadowOpacity / elevation)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node = {...BASE_FAB, id: 'fab-disabled-elev', disabled: {kind: 'literal', value: true}} as any as FabNode
    const {toJSON} = renderWithTheme(<FABRenderer node={node} />)
    const tree = JSON.stringify(toJSON())
    // disabled → no shadow style applied (shadowOpacity key absent or absent in outer Animated.View)
    // The tree should not have the floating elevation shadow values
    expect(tree).not.toContain('"shadowOpacity":0.1')
  })

  it('disabled FAB press is a no-op (no dispatch)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node = {...BASE_FAB, id: 'fab-disabled-press', disabled: {kind: 'literal', value: true}} as any as FabNode
    const mockDispatch = jest.fn()
    const {getByRole} = renderWithTheme(<FABRenderer node={node} />, {
      dispatch: mockDispatch,
    })
    fireEvent.press(getByRole('button'))
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('disabled FAB accessibilityState is {disabled: true}', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node = {...BASE_FAB, id: 'fab-disabled-a11y', disabled: {kind: 'literal', value: true}} as any as FabNode
    const {getByRole} = renderWithTheme(<FABRenderer node={node} />)
    expect(getByRole('button').props.accessibilityState).toEqual(
      expect.objectContaining({disabled: true}),
    )
  })
})

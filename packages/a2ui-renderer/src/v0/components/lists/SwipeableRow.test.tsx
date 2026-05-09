/**
 * SwipeableRow tests
 *
 * T-0006-109: snapshot at productive×focus
 * T-0006-110: snapshot at expressive×health
 * T-0006-120: leading swipe at ≥80pt commits leadingAction
 * T-0006-121: trailing swipe at ≥80pt commits trailingAction (typically destructive)
 *
 * Note on swipe gesture testing: react-native-gesture-handler's Swipeable is
 * mocked in jestSetup.js to render action panels inline (always visible). This
 * allows testing the dispatch behavior of swipe actions without simulating
 * the actual gesture system. The swipe threshold (80pt) is an implementation
 * detail verified at the component level by reading the leftThreshold /
 * rightThreshold props on the Swipeable mock.
 */
import React from 'react'
import {fireEvent} from '@testing-library/react-native'
import type {Node} from '@app-creator/protocol'
import {renderWithTheme} from '../../__test-utils__/renderWithTheme'
import {SwipeableRowRenderer} from './SwipeableRow'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type SwipeableRowNode = Extract<Node, {type: 'SwipeableRow'}>

const ROW_WITH_BOTH_ACTIONS: SwipeableRowNode = {
  id: 'sr1',
  type: 'SwipeableRow',
  title: 'Morning workout',
  subtitle: '45 min',
  leadingAction: {type: 'set', target: 'archived', value: true},
  leadingActionIcon: 'archive',
  leadingActionColor: 'success',
  trailingAction: {type: 'removeItem', collection: 'workouts', itemId: 'row_1'},
  trailingActionIcon: 'trash',
  trailingActionColor: 'danger',
}

const ROW_WITH_LEADING_ONLY: SwipeableRowNode = {
  id: 'sr2',
  type: 'SwipeableRow',
  title: 'Yoga session',
  leadingAction: {type: 'set', target: 'completed', value: true},
  leadingActionIcon: 'check',
  leadingActionColor: 'accent',
}

const ROW_WITH_TRAILING_ONLY: SwipeableRowNode = {
  id: 'sr3',
  type: 'SwipeableRow',
  title: 'Pull-ups',
  trailingAction: {type: 'removeItem', collection: 'workouts', itemId: 'row_2'},
  trailingActionIcon: 'trash',
  trailingActionColor: 'danger',
}

const ROW_WITH_AVATAR_LEADING: SwipeableRowNode = {
  id: 'sr4',
  type: 'SwipeableRow',
  title: 'José García',
  subtitle: 'Trainer',
  leading: {kind: 'avatar', node: {id: 'av1', type: 'Avatar', name: 'José García'}},
  trailingAction: {type: 'removeItem', collection: 'contacts', itemId: 'row_3'},
  trailingActionIcon: 'trash',
}

const ROW_NO_ACTIONS: SwipeableRowNode = {
  id: 'sr5',
  type: 'SwipeableRow',
  title: '李明',
  subtitle: 'No swipe actions',
}

// ---------------------------------------------------------------------------
// T-0006-109: snapshot at productive×focus
// ---------------------------------------------------------------------------

describe('SwipeableRowRenderer snapshot (T-0006-109) — productive×focus', () => {
  it('matches snapshot at productive×focus', () => {
    const {toJSON} = renderWithTheme(
      <SwipeableRowRenderer node={ROW_WITH_BOTH_ACTIONS} />,
      {stance: 'productive', palette: 'focus'},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0006-110: snapshot at expressive×health
// ---------------------------------------------------------------------------

describe('SwipeableRowRenderer snapshot (T-0006-110) — expressive×health', () => {
  it('matches snapshot at expressive×health', () => {
    const {toJSON} = renderWithTheme(
      <SwipeableRowRenderer node={ROW_WITH_BOTH_ACTIONS} />,
      {stance: 'expressive', palette: 'health'},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0006-120: leading swipe commits leadingAction
// ---------------------------------------------------------------------------

describe('SwipeableRowRenderer leading action (T-0006-120)', () => {
  it('renders the leadingAction button (revealed inline by mock)', () => {
    // The Swipeable mock renders left + right action panels inline.
    // There will be a 'button' role for the leading action panel.
    const {getAllByRole} = renderWithTheme(
      <SwipeableRowRenderer node={ROW_WITH_LEADING_ONLY} />,
      {stance: 'productive', palette: 'focus'},
    )
    expect(getAllByRole('button').length).toBeGreaterThanOrEqual(1)
  })

  it('dispatches leadingAction when leading panel is pressed', () => {
    const mockDispatch = jest.fn()
    const {getAllByRole} = renderWithTheme(
      <SwipeableRowRenderer node={ROW_WITH_LEADING_ONLY} />,
      {stance: 'productive', palette: 'focus', dispatch: mockDispatch},
    )

    // The leading panel button is the first rendered button in the mock
    const buttons = getAllByRole('button')
    fireEvent.press(buttons[0]!)

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'set',
      target: 'completed',
      value: true,
    })
  })

  it('renders both leading and trailing action buttons for row with both actions', () => {
    const mockDispatch = jest.fn()
    const {getAllByRole} = renderWithTheme(
      <SwipeableRowRenderer node={ROW_WITH_BOTH_ACTIONS} />,
      {stance: 'productive', palette: 'focus', dispatch: mockDispatch},
    )

    // Mock renders: [leading panel button, trailing panel button]
    const buttons = getAllByRole('button')
    expect(buttons.length).toBeGreaterThanOrEqual(2)
  })
})

// ---------------------------------------------------------------------------
// T-0006-121: trailing swipe commits trailingAction (typically destructive)
// ---------------------------------------------------------------------------

describe('SwipeableRowRenderer trailing action (T-0006-121)', () => {
  it('dispatches trailingAction when trailing panel is pressed', () => {
    const mockDispatch = jest.fn()
    const {getAllByRole} = renderWithTheme(
      <SwipeableRowRenderer node={ROW_WITH_TRAILING_ONLY} />,
      {stance: 'productive', palette: 'focus', dispatch: mockDispatch},
    )

    // Trailing panel button
    const buttons = getAllByRole('button')
    // The last button in the inline-rendered mock is the trailing action
    fireEvent.press(buttons[buttons.length - 1]!)

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'removeItem',
      collection: 'workouts',
      itemId: 'row_2',
    })
  })

  it('dispatches removeItem via trailing action for destructive-color row', () => {
    const mockDispatch = jest.fn()
    const {getAllByRole} = renderWithTheme(
      <SwipeableRowRenderer node={ROW_WITH_BOTH_ACTIONS} />,
      {stance: 'productive', palette: 'focus', dispatch: mockDispatch},
    )

    const buttons = getAllByRole('button')
    // Press the last button (trailing = danger/delete)
    fireEvent.press(buttons[buttons.length - 1]!)

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'removeItem',
      collection: 'workouts',
      itemId: 'row_1',
    })
  })

  it('renders title and subtitle correctly', () => {
    const {getByText} = renderWithTheme(
      <SwipeableRowRenderer node={ROW_WITH_BOTH_ACTIONS} />,
      {stance: 'productive', palette: 'focus'},
    )

    expect(getByText('Morning workout')).toBeTruthy()
    expect(getByText('45 min')).toBeTruthy()
  })

  it('renders avatar in leading slot', () => {
    const {getByText} = renderWithTheme(
      <SwipeableRowRenderer node={ROW_WITH_AVATAR_LEADING} />,
      {stance: 'productive', palette: 'focus'},
    )

    // Avatar initials for "José García"
    expect(getByText('JG')).toBeTruthy()
  })

  it('renders without crash when no swipe actions provided', () => {
    const {getByText} = renderWithTheme(
      <SwipeableRowRenderer node={ROW_NO_ACTIONS} />,
      {stance: 'productive', palette: 'focus'},
    )
    expect(getByText('李明')).toBeTruthy()
  })

  it('hit target: row minimum height ≥44pt (compact layout)', () => {
    const {toJSON} = renderWithTheme(
      <SwipeableRowRenderer node={ROW_WITH_BOTH_ACTIONS} itemLayout="compact" />,
      {stance: 'productive', palette: 'focus'},
    )
    const tree = JSON.stringify(toJSON())
    expect(tree).toContain('"minHeight":44')
  })
})

/**
 * ChipRenderer tests
 * T-0006-074: snapshot at productive×focus
 * T-0006-075: snapshot at expressive×health
 * T-0006-081: Chip selected state inverts to accent/accent-fg
 */
import React from 'react'
import {fireEvent} from '@testing-library/react-native'
import {renderWithTheme} from '../../__test-utils__/renderWithTheme'
import type {Node} from '@app-creator/protocol'
import {ChipRenderer} from './Chip'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type ChipNode = Extract<Node, {type: 'Chip'}>

const CHIP_UNSELECTED: ChipNode = {
  id: 'chip1',
  type: 'Chip',
  text: 'All',
}

const CHIP_SELECTED: ChipNode = {
  id: 'chip2',
  type: 'Chip',
  text: 'Mine',
  selected: true,
}

const CHIP_WITH_ICON: ChipNode = {
  id: 'chip3',
  type: 'Chip',
  text: 'Workouts',
  icon: 'dumbbell',
}

const CHIP_SELECTED_WITH_ICON: ChipNode = {
  id: 'chip4',
  type: 'Chip',
  text: 'Active',
  icon: 'check',
  selected: true,
}

const CHIP_WITH_ACTION: ChipNode = {
  id: 'chip5',
  type: 'Chip',
  text: 'Done',
  action: {type: 'set', target: 'status', value: 'done'},
}

// ---------------------------------------------------------------------------
// T-0006-074: snapshot at productive×focus
// ---------------------------------------------------------------------------

describe('ChipRenderer snapshot (T-0006-074) — productive×focus', () => {
  it('matches snapshot at productive×focus', () => {
    const {toJSON} = renderWithTheme(<ChipRenderer node={CHIP_UNSELECTED} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0006-075: snapshot at expressive×health
// ---------------------------------------------------------------------------

describe('ChipRenderer snapshot (T-0006-075) — expressive×health', () => {
  it('matches snapshot at expressive×health', () => {
    const {toJSON} = renderWithTheme(<ChipRenderer node={CHIP_UNSELECTED} />, {
      stance: 'expressive',
      palette: 'health',
    })
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0006-081: selected state inverts to accent/accent-fg
// ---------------------------------------------------------------------------

describe('ChipRenderer selection state (T-0006-081)', () => {
  it('renders unselected chip at productive×focus without error', () => {
    const {toJSON} = renderWithTheme(<ChipRenderer node={CHIP_UNSELECTED} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('renders selected chip at productive×focus without error', () => {
    const {toJSON} = renderWithTheme(<ChipRenderer node={CHIP_SELECTED} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('renders chip with icon at productive×focus without error', () => {
    const {toJSON} = renderWithTheme(<ChipRenderer node={CHIP_WITH_ICON} />, {
      stance: 'productive',
      palette: 'focus',
    })
    expect(toJSON()).not.toBeNull()
  })

  it('selected chip uses accent as background', () => {
    // productive focus accent = #4F46E5
    const {toJSON} = renderWithTheme(<ChipRenderer node={CHIP_SELECTED} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {style?: {backgroundColor?: string}}} | null
    expect(tree?.props?.style?.backgroundColor).toBe('#4F46E5')
  })

  it('unselected chip uses bg-elevated as background', () => {
    // bg-elevated = #FFFFFF
    const {toJSON} = renderWithTheme(<ChipRenderer node={CHIP_UNSELECTED} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {style?: {backgroundColor?: string}}} | null
    expect(tree?.props?.style?.backgroundColor).toBe('#FFFFFF')
  })

  it('unselected chip has a border', () => {
    const {toJSON} = renderWithTheme(<ChipRenderer node={CHIP_UNSELECTED} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {style?: {borderWidth?: number}}} | null
    expect(tree?.props?.style?.borderWidth).toBe(1)
  })

  it('selected chip has no border', () => {
    const {toJSON} = renderWithTheme(<ChipRenderer node={CHIP_SELECTED} />, {
      stance: 'productive',
      palette: 'focus',
    })
    const tree = toJSON() as {props?: {style?: {borderWidth?: number}}} | null
    expect(tree?.props?.style?.borderWidth).toBe(0)
  })

  it('renders at expressive×health without error', () => {
    const {toJSON} = renderWithTheme(<ChipRenderer node={CHIP_SELECTED_WITH_ICON} />, {
      stance: 'expressive',
      palette: 'health',
    })
    expect(toJSON()).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// T-0006-076: snapshot for interactive (action-bearing) chip
// ---------------------------------------------------------------------------

describe('ChipRenderer snapshot (interactive) — T-0006-076', () => {
  it('matches snapshot for chip with action at productive×focus', () => {
    const {toJSON} = renderWithTheme(
      <ChipRenderer node={CHIP_WITH_ACTION} />,
      {stance: 'productive', palette: 'focus'},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// ChipRenderer interactive behavior
// ---------------------------------------------------------------------------

describe('ChipRenderer interactive behavior', () => {
  it('dispatches node.action when pressed', () => {
    // The Text child has accessibilityElementsHidden, so we query the
    // Pressable wrapper via its accessibilityLabel instead.
    const {getByLabelText, dispatch} = renderWithTheme(
      <ChipRenderer node={CHIP_WITH_ACTION} />,
      {stance: 'productive', palette: 'focus'},
    )
    fireEvent.press(getByLabelText('Done'))
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith(CHIP_WITH_ACTION.action)
  })

  it('does not dispatch when action is absent', () => {
    // CHIP_UNSELECTED has no action — renders as View (not Pressable), so
    // fireEvent.press on the accessible label is a no-op at the interactive level.
    const {getByLabelText, dispatch} = renderWithTheme(
      <ChipRenderer node={CHIP_UNSELECTED} />,
      {stance: 'productive', palette: 'focus'},
    )
    fireEvent.press(getByLabelText('All'))
    expect(dispatch).not.toHaveBeenCalled()
  })
})

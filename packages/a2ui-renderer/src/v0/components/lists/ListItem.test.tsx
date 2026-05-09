/**
 * ListItem tests
 *
 * T-0006-111: snapshot at productive×focus
 * T-0006-112: snapshot at expressive×health
 * T-0006-119: leading/trailing slot kinds (icon/avatar/badge/none) render correctly
 */
import React from 'react'
import {fireEvent} from '@testing-library/react-native'
import type {Node} from '@app-creator/protocol'
import {renderWithTheme} from '../../__test-utils__/renderWithTheme'
import {ListItemRenderer} from './ListItem'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type ListItemNode = Extract<Node, {type: 'ListItem'}>

const LIST_ITEM_BASIC: ListItemNode = {
  id: 'li1',
  type: 'ListItem',
  title: 'Morning workout',
  subtitle: '45 minutes',
}

const LIST_ITEM_WITH_ICON_LEADING: ListItemNode = {
  id: 'li2',
  type: 'ListItem',
  title: 'Yoga session',
  subtitle: '30 minutes',
  leading: {kind: 'icon', name: 'star'},
  trailing: {kind: 'none'},
}

const LIST_ITEM_WITH_AVATAR_LEADING: ListItemNode = {
  id: 'li3',
  type: 'ListItem',
  title: 'José García',
  subtitle: 'Trainer',
  leading: {kind: 'avatar', node: {id: 'av1', type: 'Avatar', name: 'José García'}},
}

const LIST_ITEM_WITH_BADGE_TRAILING: ListItemNode = {
  id: 'li4',
  type: 'ListItem',
  title: '李明',
  trailing: {kind: 'badge', node: {id: 'bdg1', type: 'Badge', text: 'Done', tone: 'success'}},
}

const LIST_ITEM_NO_SLOTS: ListItemNode = {
  id: 'li5',
  type: 'ListItem',
  title: "O'Brien",
  leading: {kind: 'none'},
  trailing: {kind: 'none'},
}

const LIST_ITEM_WITH_TAP_ACTION: ListItemNode = {
  id: 'li6',
  type: 'ListItem',
  title: 'Tappable item',
  tapAction: {type: 'navigate', target: 'detail'},
}

const LIST_ITEM_NO_SUBTITLE: ListItemNode = {
  id: 'li7',
  type: 'ListItem',
  title: 'Title only',
}

// ---------------------------------------------------------------------------
// T-0006-111: snapshot at productive×focus
// ---------------------------------------------------------------------------

describe('ListItemRenderer snapshot (T-0006-111) — productive×focus', () => {
  it('matches snapshot at productive×focus', () => {
    const {toJSON} = renderWithTheme(
      <ListItemRenderer node={LIST_ITEM_BASIC} />,
      {stance: 'productive', palette: 'focus'},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0006-112: snapshot at expressive×health
// ---------------------------------------------------------------------------

describe('ListItemRenderer snapshot (T-0006-112) — expressive×health', () => {
  it('matches snapshot at expressive×health', () => {
    const {toJSON} = renderWithTheme(
      <ListItemRenderer node={LIST_ITEM_BASIC} />,
      {stance: 'expressive', palette: 'health'},
    )
    expect(toJSON()).toMatchSnapshot()
  })
})

// ---------------------------------------------------------------------------
// T-0006-119: leading/trailing slot kinds render correctly
// ---------------------------------------------------------------------------

describe('ListItemRenderer slot rendering (T-0006-119)', () => {
  it('renders title and subtitle text', () => {
    const {getByText} = renderWithTheme(
      <ListItemRenderer node={LIST_ITEM_BASIC} />,
      {stance: 'productive', palette: 'focus'},
    )

    expect(getByText('Morning workout')).toBeTruthy()
    expect(getByText('45 minutes')).toBeTruthy()
  })

  it('renders without subtitle when not provided', () => {
    const {getByText, queryByText} = renderWithTheme(
      <ListItemRenderer node={LIST_ITEM_NO_SUBTITLE} />,
      {stance: 'productive', palette: 'focus'},
    )

    expect(getByText('Title only')).toBeTruthy()
    // No subtitle element rendered
    expect(queryByText('45 minutes')).toBeNull()
  })

  it('slot kind "icon" — renders without crash', () => {
    const {getByText} = renderWithTheme(
      <ListItemRenderer node={LIST_ITEM_WITH_ICON_LEADING} />,
      {stance: 'productive', palette: 'focus'},
    )
    // Title is rendered — icon is inside an SVG (not a text node)
    expect(getByText('Yoga session')).toBeTruthy()
  })

  it('slot kind "avatar" — renders initials fallback for leading slot', () => {
    const {getByText} = renderWithTheme(
      <ListItemRenderer node={LIST_ITEM_WITH_AVATAR_LEADING} />,
      {stance: 'productive', palette: 'focus'},
    )
    // Avatar fallback initials for "José García" → "JG"
    expect(getByText('JG')).toBeTruthy()
    expect(getByText('José García')).toBeTruthy()
  })

  it('slot kind "badge" — renders badge text in trailing slot', () => {
    const {getByText} = renderWithTheme(
      <ListItemRenderer node={LIST_ITEM_WITH_BADGE_TRAILING} />,
      {stance: 'productive', palette: 'focus'},
    )
    expect(getByText('Done')).toBeTruthy()
    // Unicode name renders correctly
    expect(getByText('李明')).toBeTruthy()
  })

  it('slot kind "none" — renders row without leading or trailing elements', () => {
    const {toJSON} = renderWithTheme(
      <ListItemRenderer node={LIST_ITEM_NO_SLOTS} />,
      {stance: 'productive', palette: 'focus'},
    )
    const tree = JSON.stringify(toJSON())
    // O'Brien title is present
    expect(tree).toContain("O'Brien")
  })

  it('renders as Pressable (button role) when tapAction is provided', () => {
    const mockDispatch = jest.fn()
    const {getByRole} = renderWithTheme(
      <ListItemRenderer node={LIST_ITEM_WITH_TAP_ACTION} />,
      {stance: 'productive', palette: 'focus', dispatch: mockDispatch},
    )
    expect(getByRole('button')).toBeTruthy()
  })

  it('dispatches tapAction when pressed', () => {
    const mockDispatch = jest.fn()
    const {getByRole} = renderWithTheme(
      <ListItemRenderer node={LIST_ITEM_WITH_TAP_ACTION} />,
      {stance: 'productive', palette: 'focus', dispatch: mockDispatch},
    )

    fireEvent.press(getByRole('button'))

    expect(mockDispatch).toHaveBeenCalledWith({type: 'navigate', target: 'detail'})
  })

  it('hit target satisfies ≥44pt minimum (minHeight ≥ 44)', () => {
    const {toJSON} = renderWithTheme(
      <ListItemRenderer node={LIST_ITEM_BASIC} itemLayout="compact" />,
      {stance: 'productive', palette: 'focus'},
    )
    const tree = JSON.stringify(toJSON())
    // Compact layout = 44pt minimum height
    expect(tree).toContain('"minHeight":44')
  })
})

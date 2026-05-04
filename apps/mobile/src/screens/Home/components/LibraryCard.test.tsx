/**
 * LibraryCard tests — focused unit tests for the card component.
 *
 * The bulk of Step 7 lives in `Home/index.test.tsx`; these tests pin
 * card-level behaviour (T-0001-111 empty title fallback, accessible label,
 * tap → onPress with the correct projectId).
 */
import React from 'react'
import {SafeAreaProvider} from 'react-native-safe-area-context'
import {fireEvent, render} from '@testing-library/react-native'

// Stub @expo/vector-icons so jest can render the chevron without the font
// asset pipeline. Mirrors the SignIn test setup.
jest.mock('@expo/vector-icons', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactInner = require('react')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const RN = require('react-native')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Icon = (props: any) =>
    ReactInner.createElement(RN.View, {testID: `icon-${props.name}`})
  return {__esModule: true, Feather: Icon}
})

import {LibraryCard} from './LibraryCard'
import {homeCopy} from '../copy'

function wrap(node: React.ReactElement) {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: {x: 0, y: 0, width: 390, height: 844},
        insets: {top: 0, bottom: 0, left: 0, right: 0},
      }}
    >
      {node}
    </SafeAreaProvider>,
  )
}

const FIXED_NOW = new Date('2026-05-01T12:00:00Z')

describe('LibraryCard', () => {
  it('renders title and time-ago subtitle', () => {
    const screen = wrap(
      <LibraryCard
        projectId="11111111-1111-1111-1111-111111111111"
        title="Tip Splitter"
        createdAt={new Date(FIXED_NOW.getTime() - 5 * 60_000).toISOString()}
        onPress={() => {}}
        now={FIXED_NOW}
      />,
    )
    screen.getByText('Tip Splitter')
    screen.getByText(`${homeCopy.cardCreatedPrefix}5 minutes ago`)
  })

  it('T-0001-111 (defense in depth): empty title → "Untitled" placeholder', () => {
    const screen = wrap(
      <LibraryCard
        projectId="11111111-1111-1111-1111-111111111111"
        title=""
        createdAt={FIXED_NOW.toISOString()}
        onPress={() => {}}
        now={FIXED_NOW}
      />,
    )
    screen.getByText(homeCopy.cardUntitled)
  })

  it('whitespace-only title also falls back to "Untitled"', () => {
    const screen = wrap(
      <LibraryCard
        projectId="11111111-1111-1111-1111-111111111111"
        title="   "
        createdAt={FIXED_NOW.toISOString()}
        onPress={() => {}}
        now={FIXED_NOW}
      />,
    )
    screen.getByText(homeCopy.cardUntitled)
  })

  it('tap fires onPress with projectId', () => {
    const onPress = jest.fn()
    const screen = wrap(
      <LibraryCard
        projectId="22222222-2222-2222-2222-222222222222"
        title="Habit Tracker"
        createdAt={FIXED_NOW.toISOString()}
        onPress={onPress}
        now={FIXED_NOW}
      />,
    )
    fireEvent.press(screen.getByTestId('library-card'))
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(onPress).toHaveBeenCalledWith('22222222-2222-2222-2222-222222222222')
  })

  it('exposes accessibilityLabel describing title + time-ago', () => {
    const screen = wrap(
      <LibraryCard
        projectId="11111111-1111-1111-1111-111111111111"
        title="Habit Tracker"
        createdAt={new Date(FIXED_NOW.getTime() - 3 * 24 * 60 * 60_000).toISOString()}
        onPress={() => {}}
        now={FIXED_NOW}
      />,
    )
    const card = screen.getByTestId('library-card')
    expect(card.props.accessibilityLabel).toBe(
      'Open Habit Tracker, created 3 days ago',
    )
  })
})

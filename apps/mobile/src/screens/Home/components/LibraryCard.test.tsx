/**
 * LibraryCard tests — focused unit tests for the card component.
 *
 * The bulk of Step 7 lives in `Home/index.test.tsx`; these tests pin
 * card-level behaviour (T-0001-111 empty title fallback, accessible label,
 * tap → onPress with the correct projectId).
 *
 * Step 11 (ADR-0006 F-11 / T-0006-175): adds gradient overlay tests.
 *   - Productive stance → LinearGradient overlay rendered.
 *   - Expressive stance → no overlay.
 *   - No stance prop → no overlay (M1 / pre-V0 compat).
 *   - Gradient opacity ≤ 25% (accessibility — text remains readable).
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
  const Icon = (props: any) => ReactInner.createElement(RN.View, {testID: `icon-${props.name}`})
  return {__esModule: true, Feather: Icon}
})

import {AppShellThemeProvider} from '#/theme/AppShellThemeProvider'
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
      <AppShellThemeProvider>
        {node}
      </AppShellThemeProvider>
    </SafeAreaProvider>,
  )
}

const FIXED_NOW = new Date('2026-05-01T12:00:00Z')

const BASE_PROPS = {
  projectId: '11111111-1111-1111-1111-111111111111',
  title: 'Tip Splitter',
  createdAt: new Date(FIXED_NOW.getTime() - 5 * 60_000).toISOString(),
  onPress: () => {},
  now: FIXED_NOW,
} as const

describe('LibraryCard', () => {
  it('renders title and time-ago subtitle', () => {
    const screen = wrap(<LibraryCard {...BASE_PROPS} />)
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
    expect(card.props.accessibilityLabel).toBe('Open Habit Tracker, created 3 days ago')
  })

  // ---- Step 11 / T-0006-175: Layer 4 productive gradient overlay -----------

  describe('Layer 4 gradient overlay (T-0006-175)', () => {
    it('productive stance renders the LinearGradient overlay', () => {
      const screen = wrap(<LibraryCard {...BASE_PROPS} stance="productive" />)
      // The gradient overlay must be present.
      expect(screen.getByTestId('productive-gradient-overlay')).toBeTruthy()
    })

    it('expressive stance does NOT render the gradient overlay', () => {
      const screen = wrap(<LibraryCard {...BASE_PROPS} stance="expressive" />)
      // No overlay for expressive stance.
      expect(screen.queryByTestId('productive-gradient-overlay')).toBeNull()
    })

    it('no stance prop does NOT render the gradient overlay (M1 / pre-V0 compat)', () => {
      const screen = wrap(<LibraryCard {...BASE_PROPS} />)
      expect(screen.queryByTestId('productive-gradient-overlay')).toBeNull()
    })

    it('productive gradient opacity is ≤ 25% (accessibility — text remains readable)', () => {
      const screen = wrap(<LibraryCard {...BASE_PROPS} stance="productive" />)
      const overlay = screen.getByTestId('productive-gradient-overlay')
      // Our stub stores colors as a comma-joined string in data-gradient-colors.
      // The full string is like: "transparent,rgba(255,255,255,0.2)"
      const colorsAttr: string = overlay.props['data-gradient-colors'] ?? ''
      // Extract all rgba opacity values from the full colors string.
      // This handles commas-inside-rgba correctly.
      const rgbaMatches = [...colorsAttr.matchAll(/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)/g)]
      if (rgbaMatches.length > 0) {
        // All rgba entries must have opacity ≤ 0.25.
        for (const m of rgbaMatches) {
          const opacity = parseFloat(m[1] ?? '0')
          expect(opacity).toBeLessThanOrEqual(0.25)
        }
      } else {
        // No rgba found — colors must all be named keywords (transparent, white, etc.)
        // which carry no explicit opacity component > 0.25.
        expect(colorsAttr).toMatch(/transparent/i)
      }
    })
  })
})

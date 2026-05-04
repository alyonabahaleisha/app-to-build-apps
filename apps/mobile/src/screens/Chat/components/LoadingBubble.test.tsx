/**
 * LoadingBubble component tests — ADR-0002 Step 8.
 *
 * Verifies copy-by-phase rendering and reduced-motion fallback.
 * These are companion tests to T-0002-134/T-0002-135 (which test via the
 * full Chat screen); these test the component in isolation.
 */
import React from 'react'
import {AccessibilityInfo} from 'react-native'
import {render, act} from '@testing-library/react-native'
import {SafeAreaProvider} from 'react-native-safe-area-context'

import {LoadingBubble, copyForPhase} from './LoadingBubble'
import {chatCopy} from '#/screens/Chat/copy'

// ---------------------------------------------------------------------------
// Per-test setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false)
})

afterEach(() => {
  jest.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderBubble(phase: 'thinking' | 'building' | 'stalled') {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: {x: 0, y: 0, width: 390, height: 844},
        insets: {top: 0, bottom: 0, left: 0, right: 0},
      }}
    >
      <LoadingBubble phase={phase} />
    </SafeAreaProvider>,
  )
}

// ---------------------------------------------------------------------------
// copy-by-phase tests (unit, no component render)
// ---------------------------------------------------------------------------

describe('copyForPhase', () => {
  it('thinking → chatCopy.loadingThinking', () => {
    expect(copyForPhase('thinking')).toBe(chatCopy.loadingThinking)
  })

  it('building → chatCopy.loadingBuilding', () => {
    expect(copyForPhase('building')).toBe(chatCopy.loadingBuilding)
  })

  it('stalled → chatCopy.loadingStalled', () => {
    expect(copyForPhase('stalled')).toBe(chatCopy.loadingStalled)
  })
})

// ---------------------------------------------------------------------------
// Component render tests
// ---------------------------------------------------------------------------

describe('LoadingBubble', () => {
  it('renders thinking copy', () => {
    const screen = renderBubble('thinking')
    expect(screen.getByTestId('loading-bubble-text').props.children).toBe(
      chatCopy.loadingThinking,
    )
  })

  it('renders building copy', () => {
    const screen = renderBubble('building')
    expect(screen.getByTestId('loading-bubble-text').props.children).toBe(
      chatCopy.loadingBuilding,
    )
  })

  it('renders stalled copy', () => {
    const screen = renderBubble('stalled')
    expect(screen.getByTestId('loading-bubble-text').props.children).toBe(
      chatCopy.loadingStalled,
    )
  })

  it('renders animated dots', () => {
    const screen = renderBubble('thinking')
    expect(screen.getByTestId('loading-dots')).toBeTruthy()
  })

  it('reduced-motion: component still renders correct copy', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true)

    const screen = renderBubble('building')

    // Wait for the async isReduceMotionEnabled promise to settle.
    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByTestId('loading-bubble-text').props.children).toBe(
      chatCopy.loadingBuilding,
    )
    // Dots still rendered in reduced-motion (static, not animated).
    expect(screen.getByTestId('loading-dots')).toBeTruthy()
  })
})

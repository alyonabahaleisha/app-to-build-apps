/**
 * AICapabilitiesProvider + useAICapabilities tests
 * T-0006-032: resolves {isSupported: true} on iOS 26+ Pro mock
 * T-0006-033: resolves {isSupported: false, reason: 'no-foundation-models'} on unsupported mock
 * T-0006-034: returns {isSupported: false} before async check completes (safe default)
 * T-0006-035: isAvailable() rejection → {isSupported: false, reason: 'check-failed'}
 * T-0006-038a: act() transition test (MT-04) — pre-resolve false → resolved value
 */
import React from 'react'
import {renderHook, act} from '@testing-library/react-native'
import {AICapabilitiesProvider, useAICapabilities} from './AICapabilitiesProvider'
import type {AICapabilities} from './AICapabilitiesProvider'

// Mock the entire aiCapabilitiesCheck module so we control what the check returns.
// We never want the actual require('react-native-ai-apple') to run in tests.
jest.mock('./aiCapabilitiesCheck', () => ({
  aiCapabilitiesCheck: jest.fn(),
}))

// Import after mocking so we get the jest mock.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {aiCapabilitiesCheck} = require('./aiCapabilitiesCheck') as {
  aiCapabilitiesCheck: jest.MockedFunction<() => Promise<AICapabilities>>
}

beforeEach(() => {
  jest.clearAllMocks()
})

// Helper: render the hook inside the AICapabilitiesProvider and flush async effects.
async function renderAndFlush(mockResult: AICapabilities | Error) {
  if (mockResult instanceof Error) {
    aiCapabilitiesCheck.mockRejectedValue(mockResult)
  } else {
    aiCapabilitiesCheck.mockResolvedValue(mockResult)
  }

  const wrapper = ({children}: {children: React.ReactNode}) => (
    <AICapabilitiesProvider>{children}</AICapabilitiesProvider>
  )

  const rendered = renderHook(() => useAICapabilities(), {wrapper})

  // Flush microtasks (Promise.then inside useEffect) to let state update.
  await act(async () => {
    await Promise.resolve()
  })

  return rendered
}

// ---------------------------------------------------------------------------
// T-0006-032: happy path — iOS 26+ Pro mock (isSupported: true)
// ---------------------------------------------------------------------------

describe('AICapabilitiesProvider (T-0006-032)', () => {
  it('resolves isSupported=true when device supports Foundation Models', async () => {
    const {result} = await renderAndFlush({isSupported: true})
    expect(result.current).toEqual({isSupported: true})
  })
})

// ---------------------------------------------------------------------------
// T-0006-033: unsupported device mock → {isSupported: false, reason: 'no-foundation-models'}
// ---------------------------------------------------------------------------

describe('AICapabilitiesProvider (T-0006-033)', () => {
  it('resolves no-foundation-models reason on unsupported device', async () => {
    const {result} = await renderAndFlush({
      isSupported: false,
      reason: 'no-foundation-models',
    })
    expect(result.current).toEqual({isSupported: false, reason: 'no-foundation-models'})
  })
})

// ---------------------------------------------------------------------------
// T-0006-034: safe default — returns {isSupported: false} before check resolves
// ---------------------------------------------------------------------------

describe('AICapabilitiesProvider (T-0006-034)', () => {
  it('returns {isSupported: false} before the async check completes', () => {
    // Never-resolving promise — synchronous render only.
    aiCapabilitiesCheck.mockReturnValue(new Promise(() => {}))

    const wrapper = ({children}: {children: React.ReactNode}) => (
      <AICapabilitiesProvider>{children}</AICapabilitiesProvider>
    )

    const {result} = renderHook(() => useAICapabilities(), {wrapper})

    // Do NOT flush — we're testing the pre-resolve initial state.
    expect(result.current).toEqual({isSupported: false})
  })
})

// ---------------------------------------------------------------------------
// T-0006-035: check failure → {isSupported: false, reason: 'check-failed'}
// ---------------------------------------------------------------------------

describe('AICapabilitiesProvider (T-0006-035)', () => {
  it('returns {isSupported: false, reason: check-failed} when check throws', async () => {
    const {result} = await renderAndFlush(new Error('native crash'))
    expect(result.current).toEqual({isSupported: false, reason: 'check-failed'})
  })
})

// ---------------------------------------------------------------------------
// T-0006-038a: MT-04 — act() flush; transitions from false to resolved value
// without remount (Roz Concern 5 closure)
// ---------------------------------------------------------------------------

describe('AICapabilitiesProvider (T-0006-038a)', () => {
  it('transitions from {isSupported:false} to resolved value within a single render cycle', async () => {
    aiCapabilitiesCheck.mockResolvedValue({isSupported: true})

    const wrapper = ({children}: {children: React.ReactNode}) => (
      <AICapabilitiesProvider>{children}</AICapabilitiesProvider>
    )

    const {result} = renderHook(() => useAICapabilities(), {wrapper})

    // Before flushing: safe default.
    expect(result.current).toEqual({isSupported: false})

    // Wrap in act(async) to flush the microtask queue (Promise.then) inside
    // the useEffect. This is the NF-04 pattern from Roz's Step 2 QA notes.
    await act(async () => {
      await Promise.resolve()
    })

    // After act() flushes, the resolved value must be visible.
    expect(result.current).toEqual({isSupported: true})

    // aiCapabilitiesCheck was called exactly once on mount, not re-called.
    expect(aiCapabilitiesCheck).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// useAICapabilities outside provider — context default is safe {isSupported: false}
// ---------------------------------------------------------------------------

describe('useAICapabilities (outside provider)', () => {
  it('returns the safe default {isSupported: false} outside a provider', () => {
    const {result} = renderHook(() => useAICapabilities())
    expect(result.current).toEqual({isSupported: false})
  })
})

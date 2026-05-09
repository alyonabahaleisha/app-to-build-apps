/**
 * useReducedMotion tests
 * T-0006-036: returns current reduced-motion state from AccessibilityInfo
 * T-0006-037: subscription fires correctly when system preference toggles
 *
 * The react-native preset (jest.config.js: preset:'react-native') pre-mocks
 * AccessibilityInfo with jest.fn() implementations. We use jest.spyOn to
 * control return values per test, and capture the event handler directly from
 * the addEventListener mock to simulate preference changes.
 */
import {renderHook, act} from '@testing-library/react-native'
import {AccessibilityInfo} from 'react-native'
import {useReducedMotion} from './useReducedMotion'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// The react-native preset mocks addEventListener to return {remove: jest.fn()}.
// We replace it with a capturing implementation so we can fire events.
type ReduceMotionHandler = (v: boolean) => void

function setupEventCapture(): {fire: (v: boolean) => void} {
  let capturedHandler: ReduceMotionHandler | null = null

  // Cast to `any` to bypass the overloaded signature typing on addEventListener.
  // The react-native preset already mocks addEventListener; we're just capturing
  // the handler to simulate events in tests.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(jest.spyOn(AccessibilityInfo, 'addEventListener') as jest.MockedFunction<any>).mockImplementation(
    (_event: string, handler: ReduceMotionHandler) => {
      capturedHandler = handler
      return {remove: jest.fn()}
    },
  )

  return {
    fire: (v: boolean) => {
      if (capturedHandler) capturedHandler(v)
    },
  }
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks()
})

// ---------------------------------------------------------------------------
// T-0006-036: returns current state from AccessibilityInfo
// ---------------------------------------------------------------------------

describe('useReducedMotion (T-0006-036)', () => {
  it('returns false as safe default before the async query resolves', () => {
    setupEventCapture()
    // Never-resolving promise — synchronous test body only.
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(
      new Promise(() => {}),
    )

    const {result} = renderHook(() => useReducedMotion())
    expect(result.current).toBe(false)
  })

  it('returns true after isReduceMotionEnabled resolves true', async () => {
    setupEventCapture()
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true)

    const {result} = renderHook(() => useReducedMotion())

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current).toBe(true)
  })

  it('returns false when isReduceMotionEnabled resolves false', async () => {
    setupEventCapture()
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false)

    const {result} = renderHook(() => useReducedMotion())

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// T-0006-037: subscription fires when system preference toggles
// ---------------------------------------------------------------------------

describe('useReducedMotion (T-0006-037)', () => {
  it('updates when system reduce-motion preference toggles on', async () => {
    const {fire} = setupEventCapture()
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false)

    const {result} = renderHook(() => useReducedMotion())

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current).toBe(false)

    // Simulate system preference toggling on.
    act(() => {
      fire(true)
    })

    expect(result.current).toBe(true)
  })

  it('updates when system reduce-motion preference toggles off', async () => {
    const {fire} = setupEventCapture()
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true)

    const {result} = renderHook(() => useReducedMotion())

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current).toBe(true)

    // Simulate system preference toggling off.
    act(() => {
      fire(false)
    })

    expect(result.current).toBe(false)
  })

  it('removes the subscription on unmount (no setState-after-unmount)', async () => {
    const removeMock = jest.fn()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({
      remove: removeMock,
    } as any)
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false)

    const {unmount} = renderHook(() => useReducedMotion())

    await act(async () => {
      await Promise.resolve()
    })

    unmount()

    // remove() must be called on unmount to clean up the subscription.
    expect(removeMock).toHaveBeenCalledTimes(1)
  })
})

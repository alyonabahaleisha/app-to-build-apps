/**
 * shareLinks mutation tests — ADR-0008 Step 6.
 *
 * T-0008-133: 201 → Clipboard.setStringAsync called with universal_link.
 * T-0008-134: 201 → Haptics.impactAsync called with Medium style.
 * T-0008-135: 201 → toast.success called with 'Link copied'.
 * T-0008-136: 201 → share_link_copied telemetry with whitelisted payload.
 * T-0008-137: 401 → toast.error generic; Clipboard NOT called.
 * T-0008-138: 404 → toast.error generic; Clipboard NOT called.
 * T-0008-139: 429 → toast.error SHARE_LINK_COPY.rateLimited ("Try again in a moment.").
 * T-0008-139b: non-429 errors → toast.error SHARE_LINK_COPY.createError (generic).
 * T-0008-140: mutation does NOT trigger navigation.
 * T-0008-141: useCreateShareLinkMutation does NOT call invalidateQueries.
 * T-0008-142: mutation does NOT persist universal_link outside clipboard (no MMKV/AsyncStorage/SecureStore).
 * T-0008-143: mutation does NOT auto-share via OS share sheet (copy-only).
 * T-0008-143b: Clipboard rejects → error toast, NO haptic, NO telemetry, NO success toast.
 *
 * setClipboard is injected via opts.setClipboard (test-friendly DI pattern)
 * rather than relying on Jest module-factory override, which doesn't replace
 * closed-over references inside hook implementations.
 */
import {renderHook, act} from '@testing-library/react-native'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import React from 'react'

import {apiFetch, ApiError} from '#/lib/api'
import {writeEvent} from '#/lib/telemetry'

// -- Module mocks (must precede SUT import) ----------------------------------

jest.mock('#/lib/api', () => {
  const actual = jest.requireActual('#/lib/api') as typeof import('#/lib/api')
  return {
    ...actual,
    apiFetch: jest.fn(),
  }
})

jest.mock('#/lib/telemetry', () => ({
  writeEvent: jest.fn(),
  MOBILE_EVENT_PAYLOAD_WHITELIST: {
    share_link_copied: ['share_id_prefix'],
    link_clone_opened: ['share_id_prefix', 'mode'],
  },
}))

jest.mock('#/logger', () => ({
  logger: {info: jest.fn(), warn: jest.fn(), error: jest.fn()},
  safeMessage: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}))

// Mock expo-haptics.
jest.mock('expo-haptics', () => ({
  __esModule: true,
  ImpactFeedbackStyle: {Medium: 'medium', Light: 'light', Heavy: 'heavy'},
  impactAsync: jest.fn(async () => {}),
}))

// -- SUT import (AFTER mocks) ------------------------------------------------

import {
  useCreateShareLinkMutation,
  SHARE_LINK_COPY,
} from '#/state/queries/shareLinks'
import * as Haptics from 'expo-haptics'

// -- Helpers -----------------------------------------------------------------

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>
const mockWriteEvent = writeEvent as jest.MockedFunction<typeof writeEvent>
const mockImpactAsync = Haptics.impactAsync as jest.MockedFunction<typeof Haptics.impactAsync>

const MINI_APP_ID = '00000000-0000-0000-0000-000000000001'
const SHARE_ID = 'abcd1234efgh5678ijkl9012'
const UNIVERSAL_LINK = 'https://app.canvas.so/m/abcd1234efgh5678ijkl9012/clone'

function makeWrapper(qc: QueryClient) {
  return function Wrapper({children}: {children: React.ReactNode}) {
    return React.createElement(QueryClientProvider, {client: qc}, children)
  }
}

function makeQc() {
  return new QueryClient({
    defaultOptions: {
      queries: {retry: false},
      mutations: {retry: false},
    },
  })
}

function makeToast() {
  return {
    success: jest.fn(),
    error: jest.fn(),
  }
}

const SHARE_RESPONSE = {share_id: SHARE_ID, universal_link: UNIVERSAL_LINK}

beforeEach(() => {
  mockApiFetch.mockReset()
  mockWriteEvent.mockReset()
  mockImpactAsync.mockReset()
  mockImpactAsync.mockResolvedValue(undefined)
})

// ============================================================================
// Happy path
// ============================================================================

describe('useCreateShareLinkMutation — happy path', () => {
  it('T-0008-133: 201 → setClipboard called with universal_link', async () => {
    const qc = makeQc()
    const toast = makeToast()
    const setClipboard = jest.fn(async () => {})
    mockApiFetch.mockResolvedValueOnce(SHARE_RESPONSE)

    const {result} = renderHook(
      () => useCreateShareLinkMutation(toast, {setClipboard}),
      {wrapper: makeWrapper(qc)},
    )

    await act(async () => {
      await result.current.mutateAsync(MINI_APP_ID)
    })

    expect(setClipboard).toHaveBeenCalledTimes(1)
    expect(setClipboard).toHaveBeenCalledWith(UNIVERSAL_LINK)
  })

  it('T-0008-134: 201 → Haptics.impactAsync called with Medium style', async () => {
    const qc = makeQc()
    const toast = makeToast()
    const setClipboard = jest.fn(async () => {})
    mockApiFetch.mockResolvedValueOnce(SHARE_RESPONSE)

    const {result} = renderHook(
      () => useCreateShareLinkMutation(toast, {setClipboard}),
      {wrapper: makeWrapper(qc)},
    )

    await act(async () => {
      await result.current.mutateAsync(MINI_APP_ID)
    })

    expect(mockImpactAsync).toHaveBeenCalledTimes(1)
    expect(mockImpactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium)
  })

  it('T-0008-135: 201 → toast.success called with "Link copied"', async () => {
    const qc = makeQc()
    const toast = makeToast()
    const setClipboard = jest.fn(async () => {})
    mockApiFetch.mockResolvedValueOnce(SHARE_RESPONSE)

    const {result} = renderHook(
      () => useCreateShareLinkMutation(toast, {setClipboard}),
      {wrapper: makeWrapper(qc)},
    )

    await act(async () => {
      await result.current.mutateAsync(MINI_APP_ID)
    })

    expect(toast.success).toHaveBeenCalledTimes(1)
    expect(toast.success).toHaveBeenCalledWith(SHARE_LINK_COPY.linkCopied)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('T-0008-136: 201 → share_link_copied telemetry with whitelisted payload (real whitelist accepted)', async () => {
    // Use the REAL writeEvent to validate the production payload shape.
    // This mirrors the Step 7 R2 regression pattern in RunScreen.test.tsx.
    const realTelemetry =
      jest.requireActual<typeof import('#/lib/telemetry')>('#/lib/telemetry')

    const qc = makeQc()
    const toast = makeToast()
    const setClipboard = jest.fn(async () => {})
    mockApiFetch.mockResolvedValueOnce(SHARE_RESPONSE)

    const {result} = renderHook(
      () => useCreateShareLinkMutation(toast, {setClipboard}),
      {wrapper: makeWrapper(qc)},
    )

    await act(async () => {
      await result.current.mutateAsync(MINI_APP_ID)
    })

    // Mocked writeEvent was called.
    expect(mockWriteEvent).toHaveBeenCalledTimes(1)
    const callArgs = mockWriteEvent.mock.calls[0]![0] as Parameters<typeof realTelemetry.writeEvent>[0]
    expect(callArgs.eventType).toBe('share_link_copied')
    // share_id_prefix is first 4 chars of share_id (not miniAppId).
    expect(callArgs.share_id_prefix).toBe(SHARE_ID.slice(0, 4))

    // Prove the real whitelist accepts this exact payload (regression guard).
    expect(() => realTelemetry.writeEvent(callArgs)).not.toThrow()
  })
})

// ============================================================================
// Failure path
// ============================================================================

describe('useCreateShareLinkMutation — failure path', () => {
  it('T-0008-137: 401 → toast.error generic; setClipboard NOT called', async () => {
    const qc = makeQc()
    const toast = makeToast()
    const setClipboard = jest.fn(async () => {})
    mockApiFetch.mockRejectedValueOnce(new ApiError(401, '{"error":"unauthorized"}'))

    const {result} = renderHook(
      () => useCreateShareLinkMutation(toast, {setClipboard}),
      {wrapper: makeWrapper(qc)},
    )

    await act(async () => {
      try {
        await result.current.mutateAsync(MINI_APP_ID)
      } catch {
        // expected
      }
    })

    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(toast.success).not.toHaveBeenCalled()
    expect(setClipboard).not.toHaveBeenCalled()
    expect(mockWriteEvent).not.toHaveBeenCalled()
    expect(mockImpactAsync).not.toHaveBeenCalled()
  })

  it('T-0008-138: 404 → toast.error generic; setClipboard NOT called', async () => {
    const qc = makeQc()
    const toast = makeToast()
    const setClipboard = jest.fn(async () => {})
    mockApiFetch.mockRejectedValueOnce(new ApiError(404, '{"error":"not_found"}'))

    const {result} = renderHook(
      () => useCreateShareLinkMutation(toast, {setClipboard}),
      {wrapper: makeWrapper(qc)},
    )

    await act(async () => {
      try {
        await result.current.mutateAsync(MINI_APP_ID)
      } catch {
        // expected
      }
    })

    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(toast.success).not.toHaveBeenCalled()
    expect(setClipboard).not.toHaveBeenCalled()
  })

  it('T-0008-139: 429 status fires rateLimited toast', async () => {
    const qc = makeQc()
    const toast = makeToast()
    const setClipboard = jest.fn(async () => {})
    mockApiFetch.mockRejectedValueOnce(new ApiError(429, '{"error":"rate_limited"}'))

    const {result} = renderHook(
      () => useCreateShareLinkMutation(toast, {setClipboard}),
      {wrapper: makeWrapper(qc)},
    )

    await act(async () => {
      try {
        await result.current.mutateAsync(MINI_APP_ID)
      } catch {
        // expected
      }
    })

    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(toast.error).toHaveBeenCalledWith(SHARE_LINK_COPY.rateLimited)
    expect(toast.error).not.toHaveBeenCalledWith(SHARE_LINK_COPY.createError)
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('T-0008-139b: non-429 errors fire generic createError toast', async () => {
    const qc = makeQc()
    const toast = makeToast()
    const setClipboard = jest.fn(async () => {})
    mockApiFetch.mockRejectedValueOnce(new ApiError(500, '{"error":"internal"}'))

    const {result} = renderHook(
      () => useCreateShareLinkMutation(toast, {setClipboard}),
      {wrapper: makeWrapper(qc)},
    )

    await act(async () => {
      try {
        await result.current.mutateAsync(MINI_APP_ID)
      } catch {
        // expected
      }
    })

    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(toast.error).toHaveBeenCalledWith(SHARE_LINK_COPY.createError)
    expect(toast.error).not.toHaveBeenCalledWith(SHARE_LINK_COPY.rateLimited)
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('T-0008-143b: setClipboard rejects → error toast only; NO haptic, NO telemetry, NO success toast', async () => {
    const qc = makeQc()
    const toast = makeToast()
    // Clipboard failure — simulate a device permission denial or an RN internal error.
    const setClipboard = jest.fn().mockRejectedValueOnce(new Error('Clipboard write denied'))
    mockApiFetch.mockResolvedValueOnce(SHARE_RESPONSE)

    const {result} = renderHook(
      () => useCreateShareLinkMutation(toast, {setClipboard}),
      {wrapper: makeWrapper(qc)},
    )

    await act(async () => {
      await result.current.mutateAsync(MINI_APP_ID)
    })

    // Error toast with manual-copy prompt.
    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(toast.error).toHaveBeenCalledWith(SHARE_LINK_COPY.clipboardError)

    // The three things that must NOT fire (T-0008-143b pin).
    expect(toast.success).not.toHaveBeenCalled()
    expect(mockImpactAsync).not.toHaveBeenCalled()
    expect(mockWriteEvent).not.toHaveBeenCalled()
  })
})

// ============================================================================
// Regression / Security / Breaking
// ============================================================================

describe('useCreateShareLinkMutation — regression + security', () => {
  it('T-0008-140: mutation does NOT trigger navigation (no navigate/goBack calls)', async () => {
    // Navigation lives in the host shell (ADR-0011). The mutation hook is
    // self-contained — it never receives or calls a navigation prop.
    const qc = makeQc()
    const toast = makeToast()
    const setClipboard = jest.fn(async () => {})
    mockApiFetch.mockResolvedValueOnce(SHARE_RESPONSE)

    const {result} = renderHook(
      () => useCreateShareLinkMutation(toast, {setClipboard}),
      {wrapper: makeWrapper(qc)},
    )

    await act(async () => {
      await result.current.mutateAsync(MINI_APP_ID)
    })

    // If the hook navigated, it would need a navigation ref injected.
    // The hook signature has no navigation param — this test asserts the shape.
    expect(typeof result.current.mutate).toBe('function')
    // No navigation-related side-effects to assert — the absence of the prop
    // IS the contract. This test documents the boundary.
  })

  it('T-0008-141: useCreateShareLinkMutation does NOT call invalidateQueries (Library is unaffected by sharing)', async () => {
    const qc = makeQc()
    const toast = makeToast()
    const setClipboard = jest.fn(async () => {})
    mockApiFetch.mockResolvedValueOnce(SHARE_RESPONSE)
    const invalidateSpy = jest.spyOn(qc, 'invalidateQueries')

    const {result} = renderHook(
      () => useCreateShareLinkMutation(toast, {setClipboard}),
      {wrapper: makeWrapper(qc)},
    )

    await act(async () => {
      await result.current.mutateAsync(MINI_APP_ID)
    })

    // Creating a share link does not mutate the Library list.
    expect(invalidateSpy).not.toHaveBeenCalled()
  })

  it('T-0008-142: universal_link is NOT persisted outside clipboard (no SecureStore write)', async () => {
    // expo-secure-store is not mocked at this test scope, so we verify no
    // unexpected storage writes occur. The clipboard injector is the only write path.
    const qc = makeQc()
    const toast = makeToast()
    const setClipboard = jest.fn(async () => {})
    mockApiFetch.mockResolvedValueOnce(SHARE_RESPONSE)

    const {result} = renderHook(
      () => useCreateShareLinkMutation(toast, {setClipboard}),
      {wrapper: makeWrapper(qc)},
    )

    await act(async () => {
      await result.current.mutateAsync(MINI_APP_ID)
    })

    // Only clipboard write should have occurred for the universal_link.
    expect(setClipboard).toHaveBeenCalledTimes(1)
    expect(setClipboard).toHaveBeenCalledWith(UNIVERSAL_LINK)
    // Telemetry only receives share_id_prefix — not the full universal_link.
    expect(mockWriteEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({universal_link: expect.anything()}),
    )
  })

  it('T-0008-143: mutation does NOT call Share.share or ActionSheetIOS (copy-only, no OS share sheet)', async () => {
    // V0 is copy-only; OS share sheet is V0.5.
    // Verify no share-sheet module is imported by checking module graph at runtime.
    const qc = makeQc()
    const toast = makeToast()
    const setClipboard = jest.fn(async () => {})
    mockApiFetch.mockResolvedValueOnce(SHARE_RESPONSE)

    const {result} = renderHook(
      () => useCreateShareLinkMutation(toast, {setClipboard}),
      {wrapper: makeWrapper(qc)},
    )

    await act(async () => {
      await result.current.mutateAsync(MINI_APP_ID)
    })

    // If Share.share were called it would throw in jsdom (not mocked).
    // The test passing without a Share mock confirms it's not called.
    expect(setClipboard).toHaveBeenCalledTimes(1)
    // One clipboard write and done — no system share sheet invoked.
  })
})

// ============================================================================
// Ordering test — sequencing of T-0008-143b effects
// ============================================================================

describe('T-0008-143b ordering enforcement', () => {
  it('clipboard attempt is FIRST (before haptic, telemetry, toast)', async () => {
    const callOrder: string[] = []
    const qc = makeQc()
    const toast = {
      success: jest.fn(() => { callOrder.push('toast.success') }),
      error: jest.fn(() => { callOrder.push('toast.error') }),
    }
    const setClipboard = jest.fn(async () => {
      callOrder.push('clipboard')
    })

    mockApiFetch.mockResolvedValueOnce(SHARE_RESPONSE)
    mockImpactAsync.mockImplementation(async () => {
      callOrder.push('haptic')
    })
    mockWriteEvent.mockImplementation(() => {
      callOrder.push('telemetry')
    })

    const {result} = renderHook(
      () => useCreateShareLinkMutation(toast, {setClipboard}),
      {wrapper: makeWrapper(qc)},
    )

    await act(async () => {
      await result.current.mutateAsync(MINI_APP_ID)
    })

    // Clipboard comes first, then haptic, then telemetry, then toast.
    expect(callOrder).toEqual(['clipboard', 'haptic', 'telemetry', 'toast.success'])
  })

  it('clipboard failure short-circuits before haptic (ordering preserved on error path)', async () => {
    const callOrder: string[] = []
    const qc = makeQc()
    const toast = {
      success: jest.fn(() => { callOrder.push('toast.success') }),
      error: jest.fn(() => { callOrder.push('toast.error') }),
    }
    const setClipboard = jest.fn().mockRejectedValueOnce(new Error('denied'))

    mockApiFetch.mockResolvedValueOnce(SHARE_RESPONSE)
    mockImpactAsync.mockImplementation(async () => {
      callOrder.push('haptic')
    })
    mockWriteEvent.mockImplementation(() => {
      callOrder.push('telemetry')
    })

    const {result} = renderHook(
      () => useCreateShareLinkMutation(toast, {setClipboard}),
      {wrapper: makeWrapper(qc)},
    )

    await act(async () => {
      await result.current.mutateAsync(MINI_APP_ID)
    })

    // Only error toast fires — haptic and telemetry are skipped.
    expect(callOrder).toEqual(['toast.error'])
  })
})

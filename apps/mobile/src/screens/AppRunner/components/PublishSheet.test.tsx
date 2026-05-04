/**
 * PublishSheet — unit tests.
 *
 * Covers T-0002-150, T-0002-151, T-0002-152, T-0002-155, T-0002-156,
 * T-0002-157, T-0002-158, T-0002-161, T-0002-163.
 *
 * @gorhom/bottom-sheet is mocked via jest.config.js moduleNameMapper →
 * `@gorhom/bottom-sheet/mock`. The mock renders its children directly,
 * which lets us test sheet content without a full native gesture stack.
 */
import {act, fireEvent, render, waitFor} from '@testing-library/react-native'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import React, {createRef} from 'react'
import {SafeAreaProvider} from 'react-native-safe-area-context'

// The BottomSheetModal type for ref — imported for typing only
import type {BottomSheetModal} from '@gorhom/bottom-sheet'

import {apiFetch, ApiError} from '#/lib/api'
import {PublishSheet} from './PublishSheet'

// -- Mocks -------------------------------------------------------------------

jest.mock('#/lib/api', () => {
  const actual = jest.requireActual('#/lib/api') as typeof import('#/lib/api')
  return {
    ...actual,
    apiFetch: jest.fn(),
  }
})

jest.mock('#/components/ToastProvider', () => ({
  useToast: () => ({show: mockShowToast, hide: jest.fn()}),
}))

const mockShowToast = jest.fn()
const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>

// -- Helpers -----------------------------------------------------------------

function makeQc() {
  return new QueryClient({
    defaultOptions: {
      queries: {retry: false},
      mutations: {retry: false},
    },
  })
}

interface RenderOptions {
  firstPublish?: boolean
  currentHandle?: string | null
  projectId?: string
}

const SAFE_AREA_METRICS = {
  frame: {x: 0, y: 0, width: 390, height: 844},
  insets: {top: 0, bottom: 0, left: 0, right: 0},
}

function renderSheet(opts: RenderOptions = {}) {
  const {
    firstPublish = true,
    currentHandle = null,
    projectId = 'proj-123',
  } = opts
  const qc = makeQc()
  const ref = createRef<BottomSheetModal>()

  const utils = render(
    <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
      <QueryClientProvider client={qc}>
        <PublishSheet
          ref={ref}
          projectId={projectId}
          firstPublish={firstPublish}
          currentHandle={currentHandle}
        />
      </QueryClientProvider>
    </SafeAreaProvider>,
  )
  return {...utils, ref, qc}
}

// -- Tests -------------------------------------------------------------------

describe('PublishSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // T-0002-150: Tap Publish → sheet opens; first-time variant renders if no handle
  it('renders the sheet heading', () => {
    const {getByTestId} = renderSheet({firstPublish: true})
    expect(getByTestId('publish-sheet-heading')).toBeTruthy()
  })

  it('first-time variant renders HandleField when firstPublish=true', () => {
    const {getByTestId} = renderSheet({firstPublish: true})
    // The HandleField input is present
    expect(getByTestId('publish-sheet-handle-input')).toBeTruthy()
  })

  // T-0002-163: Sheet MUST NOT pre-fill on subsequent (non-first) publishes
  it('subsequent variant DOES NOT render HandleField when firstPublish=false', () => {
    const {queryByTestId} = renderSheet({
      firstPublish: false,
      currentHandle: 'alice',
    })
    expect(queryByTestId('publish-sheet-handle-input')).toBeNull()
  })

  // T-0002-152: Subsequent variant shows "@handle" copy
  it('subsequent variant shows "You\'ll publish as @<handle>" copy', () => {
    const {getByTestId} = renderSheet({
      firstPublish: false,
      currentHandle: 'alice',
    })
    const copy = getByTestId('publish-sheet-subsequent-copy')
    expect(copy.props.children).toContain('@alice')
  })

  // T-0002-151: First-time sheet pre-fills handle field from suggest response
  it('pre-fills handle field from useHandleSuggestQuery response', async () => {
    // suggest fires before we render — prime the mock
    mockApiFetch.mockImplementation(async (path: string) => {
      if (String(path).includes('/me/handle/suggest')) {
        return {handle: 'alyona-bahaleisha'}
      }
      return {}
    })

    const {getByTestId} = renderSheet({firstPublish: true})

    await waitFor(() => {
      const input = getByTestId('publish-sheet-handle-input')
      expect(input.props.value).toBe('alyona-bahaleisha')
    })
  })

  // T-0002-158: Submit disabled until regex passes + check returns Available + no in-flight
  it('submit button is disabled by default on first-time sheet', () => {
    const {getByTestId} = renderSheet({firstPublish: true})
    const submit = getByTestId('publish-sheet-submit')
    expect(submit.props.accessibilityState?.disabled).toBe(true)
  })

  it('submit button is enabled on subsequent sheet (no validation needed)', () => {
    const {getByTestId} = renderSheet({firstPublish: false, currentHandle: 'alice'})
    const submit = getByTestId('publish-sheet-submit')
    expect(submit.props.accessibilityState?.disabled).toBe(false)
  })

  // T-0002-155: Submit publishes; toast shown
  it('shows success toast after successful publish on subsequent sheet', async () => {
    mockApiFetch.mockResolvedValueOnce({
      project: {
        id: 'proj-123',
        visibility: 'public',
        publishedAt: '2026-05-02T00:00:00Z',
        authorHandle: 'alice',
      },
    })

    const {getByTestId} = renderSheet({
      firstPublish: false,
      currentHandle: 'alice',
    })

    const submit = getByTestId('publish-sheet-submit')
    await act(async () => {
      fireEvent.press(submit)
    })

    expect(mockShowToast).toHaveBeenCalledWith('✓ Published to Library', {durationMs: 2000})
  })

  // T-0002-156: Network error during publish → inline error in sheet
  it('shows inline error on network failure', async () => {
    mockApiFetch.mockRejectedValueOnce(new TypeError('Network request failed'))

    const {getByTestId} = renderSheet({
      firstPublish: false,
      currentHandle: 'alice',
    })

    const submit = getByTestId('publish-sheet-submit')
    await act(async () => {
      fireEvent.press(submit)
    })

    await waitFor(() => {
      const inlineErr = getByTestId('publish-sheet-inline-error')
      expect(inlineErr.props.children).toBe("Couldn't publish. Try again.")
    })
  })

  // T-0002-157: Race-loss handle_taken → inline error shown
  it('shows inline error on handle_taken race-loss from server', async () => {
    mockApiFetch.mockRejectedValueOnce(
      new ApiError(409, JSON.stringify({error: 'handle_taken'})),
    )

    const {getByTestId} = renderSheet({
      firstPublish: false,
      currentHandle: 'alice',
    })

    await act(async () => {
      fireEvent.press(getByTestId('publish-sheet-submit'))
    })

    await waitFor(() => {
      const inlineErr = getByTestId('publish-sheet-inline-error')
      expect(inlineErr.props.children).toContain('Handle taken')
    })
  })

  // T-0002-161: Sheet a11y: accessibilityViewIsModal
  it('has accessibilityViewIsModal on the modal wrapper', () => {
    const {UNSAFE_getAllByProps} = renderSheet({firstPublish: false, currentHandle: 'alice'})
    const modalViews = UNSAFE_getAllByProps({accessibilityViewIsModal: true})
    expect(modalViews.length).toBeGreaterThan(0)
  })
})

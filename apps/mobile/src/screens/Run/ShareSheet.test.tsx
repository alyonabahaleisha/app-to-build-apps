/**
 * ShareSheet hook tests — ADR-0008 Step 6.
 *
 * Tests for `useShareAction`:
 *   - handleShare triggers mutation.mutate with miniAppId
 *   - onBeforeShare fires before mutate
 *   - isPending reflects mutation state
 *   - handles share without onBeforeShare (optional param)
 */
import React from 'react'
import {renderHook, act} from '@testing-library/react-native'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'

// -- Module mocks (must precede SUT import) ----------------------------------

jest.mock('#/state/queries/shareLinks', () => ({
  useCreateShareLinkMutation: jest.fn(),
  SHARE_LINK_COPY: {
    linkCopied: 'Link copied',
    clipboardError: "Couldn't copy the link. Long-press the share link to copy manually.",
    createError: "Couldn't create a share link. Try again.",
    rateLimited: 'Try again in a moment.',
  },
}))

jest.mock('#/components/ToastProvider', () => ({
  useToast: jest.fn(() => ({
    show: jest.fn(),
    hide: jest.fn(),
  })),
}))

// -- SUT import --------------------------------------------------------------

import {useShareAction} from './ShareSheet'
import {useCreateShareLinkMutation} from '#/state/queries/shareLinks'
import {useToast} from '#/components/ToastProvider'

// -- Types -------------------------------------------------------------------

const mockUseCreateShareLinkMutation =
  useCreateShareLinkMutation as jest.MockedFunction<typeof useCreateShareLinkMutation>

const mockUseToast = useToast as jest.MockedFunction<typeof useToast>

// -- Helpers -----------------------------------------------------------------

const MINI_APP_ID = '00000000-0000-0000-0000-000000000001'

function makeWrapper(qc: QueryClient) {
  return function Wrapper({children}: {children: React.ReactNode}) {
    return React.createElement(QueryClientProvider, {client: qc}, children)
  }
}

function makeQc() {
  return new QueryClient({
    defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
  })
}

// -- Setup -------------------------------------------------------------------

beforeEach(() => {
  mockUseToast.mockReturnValue({show: jest.fn(), hide: jest.fn()})
})

afterEach(() => {
  jest.clearAllMocks()
})

// ============================================================================
// Tests
// ============================================================================

describe('useShareAction', () => {
  it('handleShare calls mutation.mutate with miniAppId', () => {
    const mutateMock = jest.fn()
    mockUseCreateShareLinkMutation.mockReturnValue({
      mutate: mutateMock,
      isPending: false,
    } as unknown as ReturnType<typeof useCreateShareLinkMutation>)

    const qc = makeQc()
    const {result} = renderHook(
      () => useShareAction({miniAppId: MINI_APP_ID}),
      {wrapper: makeWrapper(qc)},
    )

    act(() => {
      result.current.handleShare()
    })

    expect(mutateMock).toHaveBeenCalledTimes(1)
    expect(mutateMock).toHaveBeenCalledWith(MINI_APP_ID)
  })

  it('onBeforeShare fires before mutate', () => {
    const callOrder: string[] = []
    const mutateMock = jest.fn(() => { callOrder.push('mutate') })
    const onBeforeShare = jest.fn(() => { callOrder.push('onBeforeShare') })

    mockUseCreateShareLinkMutation.mockReturnValue({
      mutate: mutateMock,
      isPending: false,
    } as unknown as ReturnType<typeof useCreateShareLinkMutation>)

    const qc = makeQc()
    const {result} = renderHook(
      () => useShareAction({miniAppId: MINI_APP_ID, onBeforeShare}),
      {wrapper: makeWrapper(qc)},
    )

    act(() => {
      result.current.handleShare()
    })

    expect(callOrder).toEqual(['onBeforeShare', 'mutate'])
  })

  it('isPending reflects mutation isPending state', () => {
    mockUseCreateShareLinkMutation.mockReturnValue({
      mutate: jest.fn(),
      isPending: true,
    } as unknown as ReturnType<typeof useCreateShareLinkMutation>)

    const qc = makeQc()
    const {result} = renderHook(
      () => useShareAction({miniAppId: MINI_APP_ID}),
      {wrapper: makeWrapper(qc)},
    )

    expect(result.current.isPending).toBe(true)
  })

  it('works without onBeforeShare (optional param)', () => {
    const mutateMock = jest.fn()
    mockUseCreateShareLinkMutation.mockReturnValue({
      mutate: mutateMock,
      isPending: false,
    } as unknown as ReturnType<typeof useCreateShareLinkMutation>)

    const qc = makeQc()
    const {result} = renderHook(
      () => useShareAction({miniAppId: MINI_APP_ID}),
      {wrapper: makeWrapper(qc)},
    )

    // Should not throw when onBeforeShare is omitted.
    expect(() => {
      act(() => { result.current.handleShare() })
    }).not.toThrow()

    expect(mutateMock).toHaveBeenCalledWith(MINI_APP_ID)
  })

  it('adapts toast.show to ShareToast interface (success path)', () => {
    // Verify the toast adapter is constructed correctly: success → show(msg),
    // error → show(msg, {variant:'error'}).
    const showMock = jest.fn()
    mockUseToast.mockReturnValue({show: showMock, hide: jest.fn()})

    let capturedToast: {success: (m: string) => void; error: (m: string) => void} | null = null
    mockUseCreateShareLinkMutation.mockImplementation((toast) => {
      capturedToast = toast
      return {mutate: jest.fn(), isPending: false} as unknown as ReturnType<typeof useCreateShareLinkMutation>
    })

    const qc = makeQc()
    renderHook(() => useShareAction({miniAppId: MINI_APP_ID}), {
      wrapper: makeWrapper(qc),
    })

    const t = capturedToast as {success: (m: string) => void; error: (m: string) => void} | null
    t?.success('Link copied')
    expect(showMock).toHaveBeenCalledWith('Link copied')

    t?.error('Oops')
    expect(showMock).toHaveBeenCalledWith('Oops', {variant: 'error'})
  })
})

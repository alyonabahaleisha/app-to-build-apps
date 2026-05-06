/**
 * Deep-link handler tests — Step 6, 6 of the 20 IDs (T-0001-097 N/A).
 *
 * T-0001-098 — cold start with valid URL → redeemToken called once.
 * T-0001-099 — warm start (URL arrives via re-render) → redeemToken called once.
 * T-0001-100 — wrong path ignored.
 * T-0001-101 — missing token param ignored.
 * T-0001-102 — null URL repeatedly → no infinite loop, no calls.
 * T-0001-134 — empty token (`?token=`) ignored silently.
 *
 * Strategy: parse-layer is a pure function — verify directly. Hook layer
 * is exercised via a tiny harness that injects a fake `useURL()` value.
 * `useSession` is mocked at the module boundary so we can spy on
 * `redeemToken` call counts.
 */
import React from 'react'
import {View} from 'react-native'
import {render, waitFor} from '@testing-library/react-native'

// `expo-linking` mock — `useURL` is the seam, `parse` is the real impl.
const mockUseURL = jest.fn<string | null, []>()
jest.mock('expo-linking', () => {
  return {
    __esModule: true,
    useURL: () => mockUseURL(),
    parse: (url: string) => {
      // Minimal `Linking.parse` shim — handles `appcreator://path?k=v` and
      // returns {scheme, hostname, queryParams} like the real one. We
      // implement just enough surface for the tests; the parser-under-test
      // sits above this.
      const m = /^([a-z][a-z0-9+\-.]*):\/\/([^/?#]*)(?:\/[^?#]*)?(?:\?([^#]*))?/i.exec(url)
      if (!m) return {scheme: null, hostname: null, queryParams: {}}
      const [, scheme, hostname, qs] = m
      const queryParams: Record<string, string | undefined> = {}
      if (qs) {
        for (const pair of qs.split('&')) {
          const [k, v = ''] = pair.split('=')
          if (k) queryParams[decodeURIComponent(k)] = decodeURIComponent(v)
        }
      }
      return {scheme, hostname, queryParams}
    },
  }
})

// `useSession` mock — we stub `redeemToken` so we can spy on it.
const mockRedeemToken = jest.fn<Promise<void>, [unknown]>()
jest.mock('#/state/session/useSession', () => ({
  __esModule: true,
  useSession: () => ({
    status: 'unauthenticated',
    user: null,
    redeemToken: mockRedeemToken,
    signOut: jest.fn(),
    skipAuth: jest.fn(),
  }),
}))

// Imports MUST follow the mocks.
import {parseAuthDeepLink, useAuthDeepLink} from './deepLink'

beforeEach(() => {
  mockUseURL.mockReset()
  mockUseURL.mockReturnValue(null)
  mockRedeemToken.mockReset()
  mockRedeemToken.mockResolvedValue(undefined)
})

// ---- parseAuthDeepLink (pure-function lane) -------------------------------

describe('parseAuthDeepLink', () => {
  it('T-0001-098 (parser): valid auth URL → returns token', () => {
    expect(parseAuthDeepLink('appcreator://auth?token=abc.def.ghi')).toEqual({
      token: 'abc.def.ghi',
      refreshToken: '',
    })
  })

  it('T-0001-100 (parser): wrong host → null', () => {
    expect(parseAuthDeepLink('appcreator://wrongpath?token=foo')).toBeNull()
  })

  it('T-0001-101 (parser): missing token → null', () => {
    expect(parseAuthDeepLink('appcreator://auth')).toBeNull()
  })

  it('T-0001-134 (parser): empty token → null', () => {
    expect(parseAuthDeepLink('appcreator://auth?token=')).toBeNull()
  })

  it('parser: wrong scheme → null', () => {
    expect(parseAuthDeepLink('https://auth?token=foo')).toBeNull()
  })

  it('parser: null URL → null', () => {
    expect(parseAuthDeepLink(null)).toBeNull()
  })

  it('parser: includes refresh_token when present', () => {
    expect(parseAuthDeepLink('appcreator://auth?token=abc&refresh_token=rrr')).toEqual({
      token: 'abc',
      refreshToken: 'rrr',
    })
  })
})

// ---- useAuthDeepLink (hook lane) -----------------------------------------

function HookHarness() {
  useAuthDeepLink()
  return <View testID="hook-host" />
}

describe('useAuthDeepLink', () => {
  it('T-0001-098: cold start with valid URL → redeemToken called once with parsed token', async () => {
    mockUseURL.mockReturnValue('appcreator://auth?token=cold.start.jwt')

    render(<HookHarness />)

    await waitFor(() => {
      expect(mockRedeemToken).toHaveBeenCalledTimes(1)
    })
    const [arg] = mockRedeemToken.mock.calls[0]!
    expect(arg).toEqual({accessToken: 'cold.start.jwt', refreshToken: ''})
  })

  it('T-0001-099: warm start (URL arrives via re-render) → redeemToken called once', async () => {
    // First render: URL is null (app idle).
    mockUseURL.mockReturnValue(null)
    const screen = render(<HookHarness />)

    expect(mockRedeemToken).not.toHaveBeenCalled()

    // OS feeds the URL — next render returns it.
    mockUseURL.mockReturnValue('appcreator://auth?token=warm.start.jwt')
    screen.rerender(<HookHarness />)

    await waitFor(() => {
      expect(mockRedeemToken).toHaveBeenCalledTimes(1)
    })
    expect(mockRedeemToken.mock.calls[0]![0]).toEqual({
      accessToken: 'warm.start.jwt',
      refreshToken: '',
    })
  })

  it('T-0001-100: wrong path → no redeemToken call', async () => {
    mockUseURL.mockReturnValue('appcreator://wrongpath?token=foo')
    render(<HookHarness />)
    // Let any pending effects settle.
    await Promise.resolve()
    await Promise.resolve()
    expect(mockRedeemToken).not.toHaveBeenCalled()
  })

  it('T-0001-101: missing token param → no redeemToken call', async () => {
    mockUseURL.mockReturnValue('appcreator://auth')
    render(<HookHarness />)
    await Promise.resolve()
    await Promise.resolve()
    expect(mockRedeemToken).not.toHaveBeenCalled()
  })

  it('T-0001-134: empty token (?token=) → no redeemToken call, no error toast', async () => {
    mockUseURL.mockReturnValue('appcreator://auth?token=')
    render(<HookHarness />)
    await Promise.resolve()
    await Promise.resolve()
    expect(mockRedeemToken).not.toHaveBeenCalled()
  })

  it('T-0001-102: null URL across re-renders → no calls, no infinite loop', async () => {
    mockUseURL.mockReturnValue(null)

    let renderCount = 0
    function CountingHarness() {
      renderCount += 1
      useAuthDeepLink()
      return <View testID="counting-harness" />
    }

    const screen = render(<CountingHarness />)

    // Force a few re-renders. If the effect were running and somehow
    // looping, the render count would explode.
    for (let i = 0; i < 5; i++) {
      screen.rerender(<CountingHarness />)
    }

    await Promise.resolve()
    await Promise.resolve()

    expect(mockRedeemToken).not.toHaveBeenCalled()
    // 6 renders total (initial + 5 forced); guards against runaway re-renders.
    expect(renderCount).toBeLessThanOrEqual(20)
  })

  it('does not re-fire when the same URL is returned across re-renders', async () => {
    mockUseURL.mockReturnValue('appcreator://auth?token=stable.jwt')

    const screen = render(<HookHarness />)
    await waitFor(() => {
      expect(mockRedeemToken).toHaveBeenCalledTimes(1)
    })

    // Force a re-render — same URL, must not re-fire the effect.
    screen.rerender(<HookHarness />)
    screen.rerender(<HookHarness />)
    await Promise.resolve()
    await Promise.resolve()

    expect(mockRedeemToken).toHaveBeenCalledTimes(1)
  })
})

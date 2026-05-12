/**
 * Universal Link parser + hook tests — ADR-0008 Step 4.
 *
 * T-0008-088..104, T-0008-105  — parseUniversalLink pure-function tests
 * T-0008-106..111              — useUniversalLink hook tests
 * T-0008-112                   — app.config.ts associatedDomains config test
 * T-0008-113                   — regression: parseAuthDeepLink unaffected
 * T-0008-113b                  — useUniversalLink cold-start with non-canvas URL
 *
 * Total: 27 tests.
 *
 * Mock strategy: expo-linking is mocked at module level. The pure parser
 * under test does NOT use expo-linking (it uses the built-in URL global), so
 * we only mock the pieces the hook uses: getInitialURL and addEventListener.
 */
import React from 'react'
import {View} from 'react-native'
import {render, waitFor, act} from '@testing-library/react-native'

// ---- expo-linking mock -------------------------------------------------------
// The hook calls Linking.getInitialURL() and Linking.addEventListener().
// The parser uses the built-in URL global (no expo-linking dependency).

type UrlEventListener = (event: {url: string}) => void

const mockGetInitialURL = jest.fn<Promise<string | null>, []>()
const mockRemove = jest.fn()
// Store the registered listener so tests can fire warm-start events.
let capturedUrlListener: UrlEventListener | null = null
const mockAddEventListener = jest.fn(
  (_event: string, listener: UrlEventListener) => {
    capturedUrlListener = listener
    return {remove: mockRemove}
  },
)

jest.mock('expo-linking', () => ({
  __esModule: true,
  getInitialURL: () => mockGetInitialURL(),
  addEventListener: (event: string, listener: UrlEventListener) =>
    mockAddEventListener(event, listener),
  // parse() shim — needed by parseAuthDeepLink (T-0008-113 regression check).
  // Matches the minimal shim from deepLink.test.tsx; handles custom-scheme URLs.
  parse: (url: string) => {
    const m =
      /^([a-z][a-z0-9+\-.]*):\/\/([^/?#]*)(?:\/[^?#]*)?(?:\?([^#]*))?/i.exec(url)
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
}))

// Imports MUST follow mocks.
import {parseUniversalLink, useUniversalLink} from './universalLink'
import {parseAuthDeepLink} from './deepLink'
import appConfig from '../../app.config'

// ---- Helpers ---------------------------------------------------------------

/** 24-char alphanumeric share ID used across tests. */
const SHARE_ID = 'aBcDeFgHiJkLmNoPqRsTuVwX' // exactly 24 chars

beforeEach(() => {
  mockGetInitialURL.mockReset()
  mockGetInitialURL.mockResolvedValue(null)
  mockAddEventListener.mockClear()
  mockRemove.mockClear()
  capturedUrlListener = null
})

// ---- parseUniversalLink (pure-function lane) --------------------------------

describe('parseUniversalLink', () => {
  // --- Happy path ---

  it('T-0008-088: clone URL returns {shareId, mode: clone}', () => {
    const result = parseUniversalLink(`https://canvas.app/m/${SHARE_ID}/clone`)
    expect(result).toEqual({shareId: SHARE_ID, mode: 'clone'})
  })

  it('T-0008-089: view URL returns {shareId, mode: view}', () => {
    const result = parseUniversalLink(`https://canvas.app/m/${SHARE_ID}/view`)
    expect(result).toEqual({shareId: SHARE_ID, mode: 'view'})
  })

  it('T-0008-090: remix URL returns {shareId, mode: remix}', () => {
    const result = parseUniversalLink(`https://canvas.app/m/${SHARE_ID}/remix`)
    expect(result).toEqual({shareId: SHARE_ID, mode: 'remix'})
  })

  // --- Failure: null / empty ---

  it('T-0008-091: null input → null', () => {
    expect(parseUniversalLink(null)).toBeNull()
  })

  it('T-0008-092: empty string → null', () => {
    expect(parseUniversalLink('')).toBeNull()
  })

  // --- Failure: protocol / host ---

  it('T-0008-093: http:// (non-HTTPS) → null', () => {
    expect(parseUniversalLink(`http://canvas.app/m/${SHARE_ID}/clone`)).toBeNull()
  })

  it('T-0008-094: wrong host → null', () => {
    expect(parseUniversalLink(`https://wrong.app/m/${SHARE_ID}/clone`)).toBeNull()
  })

  // --- Failure: path ---

  it('T-0008-095: wrong path root → null', () => {
    expect(parseUniversalLink(`https://canvas.app/wrong/${SHARE_ID}/clone`)).toBeNull()
  })

  // --- Failure: share_id length ---

  it('T-0008-096: share_id too short (5 chars) → null', () => {
    expect(parseUniversalLink('https://canvas.app/m/short/clone')).toBeNull()
  })

  // --- Failure: unknown mode ---

  it('T-0008-097: unknown mode (junk) → null', () => {
    expect(parseUniversalLink(`https://canvas.app/m/${SHARE_ID}/junk`)).toBeNull()
  })

  // --- Failure: share_id with disallowed chars ---

  it('T-0008-098: share_id with dashes (not alphanumeric) → null', () => {
    expect(
      parseUniversalLink('https://canvas.app/m/aaaa-bbbb-cccc-dddd-eeee/clone'),
    ).toBeNull()
  })

  // --- Failure: empty share_id ---

  it('T-0008-099: empty share_id segment → null', () => {
    // URL path becomes /m//clone
    expect(parseUniversalLink('https://canvas.app/m//clone')).toBeNull()
  })

  // --- Failure: uppercase mode ---

  it('T-0008-100: uppercase mode CLONE → null (modes are case-sensitive)', () => {
    expect(parseUniversalLink(`https://canvas.app/m/${SHARE_ID}/CLONE`)).toBeNull()
  })

  // --- Boundary: exact 24-char share_id variants ---

  it('T-0008-101: 24-char digits-only share_id → accepted', () => {
    const digitsOnly = '012345678901234567890123' // exactly 24 digits
    expect(parseUniversalLink(`https://canvas.app/m/${digitsOnly}/clone`)).toEqual({
      shareId: digitsOnly,
      mode: 'clone',
    })
  })

  it('T-0008-101 (letters): 24-char letters-only share_id → accepted', () => {
    const lettersOnly = 'abcdefghijklmnopqrstuvwx' // exactly 24 letters
    expect(parseUniversalLink(`https://canvas.app/m/${lettersOnly}/clone`)).toEqual({
      shareId: lettersOnly,
      mode: 'clone',
    })
  })

  it('T-0008-101 (mixed-case): 24-char mixed-case share_id → accepted', () => {
    // SHARE_ID is already mixed-case 24 chars; covered by T-0008-088 too.
    expect(parseUniversalLink(`https://canvas.app/m/${SHARE_ID}/clone`)).not.toBeNull()
  })

  // --- Boundary: trailing slash ---

  it('T-0008-102: trailing slash on URL → accepted', () => {
    expect(parseUniversalLink(`https://canvas.app/m/${SHARE_ID}/clone/`)).toEqual({
      shareId: SHARE_ID,
      mode: 'clone',
    })
  })

  // --- Boundary: query string ---

  it('T-0008-103: URL with query string → accepted; query ignored', () => {
    expect(
      parseUniversalLink(`https://canvas.app/m/${SHARE_ID}/clone?utm_source=email`),
    ).toEqual({shareId: SHARE_ID, mode: 'clone'})
  })

  // --- Boundary: fragment ---

  it('T-0008-104: URL with fragment → accepted; fragment ignored', () => {
    expect(parseUniversalLink(`https://canvas.app/m/${SHARE_ID}/clone#x`)).toEqual({
      shareId: SHARE_ID,
      mode: 'clone',
    })
  })

  // --- Failure: extra path segments ---

  it('T-0008-105: extra path segment after mode → null', () => {
    expect(
      parseUniversalLink(`https://canvas.app/m/${SHARE_ID}/clone/extra`),
    ).toBeNull()
  })

  // --- Failure: truly malformed URL (catch branch, line 72) ---

  it('T-0008-101c: malformed URL that throws in new URL() → null', () => {
    // Exercises the catch branch at universalLink.ts:72 — new URL() throws on
    // these inputs; parseUniversalLink must return null rather than propagate.
    expect(parseUniversalLink('not a url')).toBeNull()
    expect(parseUniversalLink('://broken')).toBeNull()
    expect(parseUniversalLink('   ')).toBeNull()
  })
})

// ---- useUniversalLink (hook lane) ------------------------------------------

function makeHarness(
  onActiveLink: jest.Mock,
  onReservedMode: jest.Mock,
) {
  function Harness() {
    useUniversalLink({onActiveLink, onReservedMode})
    return <View testID="harness" />
  }
  return Harness
}

describe('useUniversalLink', () => {
  it('T-0008-106: cold start with active clone link → onActiveLink called exactly once', async () => {
    const url = `https://canvas.app/m/${SHARE_ID}/clone`
    mockGetInitialURL.mockResolvedValue(url)

    const onActiveLink = jest.fn()
    const onReservedMode = jest.fn()
    const Harness = makeHarness(onActiveLink, onReservedMode)

    render(<Harness />)

    await waitFor(() => {
      expect(onActiveLink).toHaveBeenCalledTimes(1)
    })
    expect(onActiveLink).toHaveBeenCalledWith({shareId: SHARE_ID, mode: 'clone'})
    expect(onReservedMode).not.toHaveBeenCalled()
  })

  it('T-0008-107: cold start with reserved view link → onReservedMode called exactly once', async () => {
    const url = `https://canvas.app/m/${SHARE_ID}/view`
    mockGetInitialURL.mockResolvedValue(url)

    const onActiveLink = jest.fn()
    const onReservedMode = jest.fn()
    const Harness = makeHarness(onActiveLink, onReservedMode)

    render(<Harness />)

    await waitFor(() => {
      expect(onReservedMode).toHaveBeenCalledTimes(1)
    })
    expect(onReservedMode).toHaveBeenCalledWith({shareId: SHARE_ID, mode: 'view'})
    expect(onActiveLink).not.toHaveBeenCalled()
  })

  it('T-0008-108: warm start with active link → onActiveLink called', async () => {
    // Cold start resolves null — no callback fires.
    mockGetInitialURL.mockResolvedValue(null)

    const onActiveLink = jest.fn()
    const onReservedMode = jest.fn()
    const Harness = makeHarness(onActiveLink, onReservedMode)

    render(<Harness />)

    // Wait for the effect to mount and register the listener.
    await act(async () => {
      await Promise.resolve()
    })

    expect(capturedUrlListener).not.toBeNull()
    // Fire a warm-start event.
    act(() => {
      capturedUrlListener!({url: `https://canvas.app/m/${SHARE_ID}/clone`})
    })

    expect(onActiveLink).toHaveBeenCalledTimes(1)
    expect(onActiveLink).toHaveBeenCalledWith({shareId: SHARE_ID, mode: 'clone'})
    expect(onReservedMode).not.toHaveBeenCalled()
  })

  it('T-0008-109: warm start with invalid URL → neither callback fires', async () => {
    mockGetInitialURL.mockResolvedValue(null)

    const onActiveLink = jest.fn()
    const onReservedMode = jest.fn()
    const Harness = makeHarness(onActiveLink, onReservedMode)

    render(<Harness />)

    await act(async () => {
      await Promise.resolve()
    })

    act(() => {
      capturedUrlListener!({url: 'https://canvas.app/m/tooshort/clone'})
    })

    expect(onActiveLink).not.toHaveBeenCalled()
    expect(onReservedMode).not.toHaveBeenCalled()
  })

  it('T-0008-110: same URL fired twice via warm event → callback fires twice (no dedup)', async () => {
    mockGetInitialURL.mockResolvedValue(null)

    const onActiveLink = jest.fn()
    const onReservedMode = jest.fn()
    const Harness = makeHarness(onActiveLink, onReservedMode)

    render(<Harness />)

    await act(async () => {
      await Promise.resolve()
    })

    const url = `https://canvas.app/m/${SHARE_ID}/clone`
    act(() => {
      capturedUrlListener!({url})
      capturedUrlListener!({url})
    })

    // Intentional: no deduplication. OS guarantees this doesn't happen in
    // production, but we don't enforce it — callers own idempotency.
    expect(onActiveLink).toHaveBeenCalledTimes(2)
  })

  it('T-0008-111: unmount removes the Linking event subscription', async () => {
    mockGetInitialURL.mockResolvedValue(null)

    const onActiveLink = jest.fn()
    const onReservedMode = jest.fn()
    const Harness = makeHarness(onActiveLink, onReservedMode)

    const screen = render(<Harness />)

    await act(async () => {
      await Promise.resolve()
    })

    expect(mockRemove).not.toHaveBeenCalled()
    screen.unmount()
    expect(mockRemove).toHaveBeenCalledTimes(1)
  })

  it('T-0008-108b: warm-start reserved-mode view URL → onReservedMode called, onActiveLink silent', async () => {
    // Covers universalLink.ts:141 — the onReservedMode(parsed) branch inside
    // the addEventListener warm-start callback. T-0008-107 covers cold-start
    // reserved-mode; T-0008-108 covers warm-start active-mode only. This test
    // closes the remaining gap.
    mockGetInitialURL.mockResolvedValue(null)

    const onActiveLink = jest.fn()
    const onReservedMode = jest.fn()
    const Harness = makeHarness(onActiveLink, onReservedMode)

    render(<Harness />)

    // Wait for the effect to mount and register the listener.
    await act(async () => {
      await Promise.resolve()
    })

    expect(capturedUrlListener).not.toBeNull()
    act(() => {
      capturedUrlListener!({url: `https://canvas.app/m/${SHARE_ID}/view`})
    })

    expect(onReservedMode).toHaveBeenCalledTimes(1)
    expect(onReservedMode).toHaveBeenCalledWith({shareId: SHARE_ID, mode: 'view'})
    expect(onActiveLink).not.toHaveBeenCalled()
  })
})

// ---- app.config.ts config test (T-0008-112) --------------------------------

describe('app.config.ts', () => {
  it('T-0008-112: ios.associatedDomains is exactly ["applinks:canvas.app"]', () => {
    const resolved = appConfig({config: {}, projectRoot: '', staticConfigPath: null, packageJsonPath: null})
    expect(resolved.ios?.associatedDomains).toEqual(['applinks:canvas.app'])
  })
})

// ---- Regression: parseAuthDeepLink unaffected (T-0008-113) -----------------

describe('regression: M1 auth deep link unaffected by universal link parser', () => {
  it('T-0008-113: parseAuthDeepLink still handles appcreator://auth?token=... correctly', () => {
    // parseAuthDeepLink is the M1 custom-scheme handler — completely independent
    // of parseUniversalLink. Both parsers must coexist without interference.
    const authResult = parseAuthDeepLink('appcreator://auth?token=abc.def.ghi')
    expect(authResult).toEqual({token: 'abc.def.ghi', refreshToken: ''})

    // And parseUniversalLink correctly rejects the same URL (wrong protocol/host).
    const universalResult = parseUniversalLink('appcreator://auth?token=abc.def.ghi')
    expect(universalResult).toBeNull()
  })

  it('T-0008-113b: useUniversalLink cold-start with M1 custom-scheme URL → silent discard', async () => {
    // The OS handed us an appcreator:// URL (M1 auth flow). This hook must
    // silently drop it — parseAuthDeepLink handles it on its own pipe.
    mockGetInitialURL.mockResolvedValue('appcreator://auth?token=abc')

    const onActiveLink = jest.fn()
    const onReservedMode = jest.fn()
    const Harness = makeHarness(onActiveLink, onReservedMode)

    render(<Harness />)

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(onActiveLink).not.toHaveBeenCalled()
    expect(onReservedMode).not.toHaveBeenCalled()
  })
})

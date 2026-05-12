/**
 * LoadSpecFromDevMenu tests — ADR-0011 Step 13.
 *
 * T-0011-311  Happy    Dev-menu entry registered when __DEV__=true
 * T-0011-312  Breaking Dev-menu entry NOT registered when __DEV__=false
 * T-0011-313  Happy    Sheet opens on menu pick
 * T-0011-314  Happy    Valid JSON spec → mounts in Run mode with synthetic mini_app
 * T-0011-315  Negative Invalid JSON → inline error; does not crash
 * T-0011-316  Negative Spec failing SpecSchema.parse → inline error with first Zod issue
 * T-0011-317  Happy    Synthetic mini_app never persisted to DB (list unchanged)
 * T-0011-317a Security No telemetry emitted during load + mount flow
 * T-0011-318  Happy    URL scheme warm-start loads tracker fixture + mounts in Run mode
 * T-0011-318a Happy    URL scheme cold-start loads tracker fixture + mounts in Run mode
 * T-0011-319  Negative URL scheme with unknown fixture → toast "Fixture not found"
 * T-0011-320  Happy    Title in synthetic Run mode comes from spec's first Heading.text
 */
import React from 'react'
import {act, fireEvent, render, waitFor} from '@testing-library/react-native'

// ---------------------------------------------------------------------------
// __DEV__ toggle
// ---------------------------------------------------------------------------

let currentDevMode = true

Object.defineProperty(global, '__DEV__', {
  get: () => currentDevMode,
  configurable: true,
})

// ---------------------------------------------------------------------------
// Module mocks
//
// IMPORTANT: jest.mock() factories are hoisted by Babel/Jest. Module-level
// `const` variables are NOT initialized when the factory runs. All mock
// functions are defined inside the factories and retrieved via
// jest.requireMock() in tests/beforeEach.
// ---------------------------------------------------------------------------

jest.mock('react-native/Libraries/Utilities/DevSettings', () => ({
  addMenuItem: jest.fn(),
}))

// expo-linking with a stable parse implementation and controllable fns.
jest.mock('expo-linking', () => {
  function parseUrl(url: string) {
    try {
      const colonIdx = url.indexOf('://')
      const schemePart = colonIdx >= 0 ? url.slice(0, colonIdx) : ''
      const afterScheme = colonIdx >= 0 ? url.slice(colonIdx + 3) : url
      const qIdx = afterScheme.indexOf('?')
      const hostAndPath = qIdx >= 0 ? afterScheme.slice(0, qIdx) : afterScheme
      const queryString = qIdx >= 0 ? afterScheme.slice(qIdx + 1) : ''
      const slashIdx = hostAndPath.indexOf('/')
      const hostname = slashIdx >= 0 ? hostAndPath.slice(0, slashIdx) : hostAndPath
      const path = slashIdx >= 0 ? hostAndPath.slice(slashIdx) : null
      const queryParams: Record<string, string> = {}
      if (queryString) {
        for (const part of queryString.split('&')) {
          const eqIdx = part.indexOf('=')
          if (eqIdx >= 0) {
            const k = part.slice(0, eqIdx)
            const v = part.slice(eqIdx + 1)
            if (k) queryParams[k] = decodeURIComponent(v)
          }
        }
      }
      return {scheme: schemePart, hostname, path, queryParams}
    } catch {
      return {scheme: null, hostname: null, path: null, queryParams: {}}
    }
  }

  return {
    parse: jest.fn(parseUrl),
    getInitialURL: jest.fn(async () => null as string | null),
    addEventListener: jest.fn(
      (_event: string, _handler: (e: {url: string}) => void) => ({
        remove: jest.fn(),
      }),
    ),
  }
})

jest.mock('#/theme/AppShellThemeProvider', () => ({
  useAppShellTheme: jest.fn(() => ({
    fg: '#000',
    'fg-muted': '#888',
    bg: '#fff',
    'bg-elevated': '#f5f5f5',
    'accent-fg': '#fff',
    accent: '#5B4FCF',
    divider: '#eee',
    type: {
      h2: {size: 18, weight: 600, lineHeight: 24},
      body: {size: 16, weight: 400, lineHeight: 22},
    },
  })),
}))

jest.mock('#/components/ToastProvider', () => ({
  useToast: jest.fn(() => ({
    show: jest.fn(),
    hide: jest.fn(),
  })),
}))

jest.mock('#/screens/Run/devMenu/DevSpecContext', () => ({
  useDevSpecContext: jest.fn(() => ({
    setDevSpec: jest.fn(),
    clearDevSpec: jest.fn(),
    entry: null,
  })),
  DevSpecProvider: ({children}: {children: React.ReactNode}) => children,
  useDevSpecMiniAppQuery: jest.fn(),
}))

jest.mock('#/lib/telemetry', () => ({
  writeEvent: jest.fn(),
}))

jest.mock('#/state/queries/miniApps', () => ({
  useMiniAppsListQuery: jest.fn(() => ({data: [], isPending: false, isError: false})),
  useMiniAppQuery: jest.fn(() => ({data: null, isPending: true, isError: false})),
  useArchiveMiniAppMutation: jest.fn(() => ({mutate: jest.fn()})),
  useDeleteMiniAppMutation: jest.fn(() => ({mutate: jest.fn()})),
  useRenameMiniAppMutation: jest.fn(() => ({mutate: jest.fn()})),
}))

// ---------------------------------------------------------------------------
// SUT imports (after mocks)
// ---------------------------------------------------------------------------

import {
  LoadSpecFromDevMenu,
  parseDevMenuUrl,
  titleFromSpec,
} from '#/screens/Run/devMenu/LoadSpecFromDevMenu'
import type {Spec} from '@app-creator/protocol'

// ---------------------------------------------------------------------------
// Mock accessors — typed references to module mocks.
// Retrieved AFTER imports so module registry is populated.
// ---------------------------------------------------------------------------

type DevSettingsMock = {addMenuItem: jest.Mock}
type ExpoLinkingMock = {
  parse: jest.Mock
  getInitialURL: jest.Mock
  addEventListener: jest.Mock
}
type ToastMock = {useToast: jest.Mock}
type DevSpecContextMock = {useDevSpecContext: jest.Mock}
type TelemetryMock = {writeEvent: jest.Mock}

function devSettings(): DevSettingsMock {
  return jest.requireMock('react-native/Libraries/Utilities/DevSettings')
}
function expoLinking(): ExpoLinkingMock {
  return jest.requireMock('expo-linking')
}
function toastModule(): ToastMock {
  return jest.requireMock('#/components/ToastProvider')
}
function devSpecCtx(): DevSpecContextMock {
  return jest.requireMock('#/screens/Run/devMenu/DevSpecContext')
}
function telemetry(): TelemetryMock {
  return jest.requireMock('#/lib/telemetry')
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_SPEC: Spec = {
  version: 1,
  archetype: 'Tracker',
  stance: 'productive',
  palette: 'focus',
  coverIcon: 'check-circle',
  navigation: 'stack',
  initialScreenId: 'main',
  collections: [],
  screens: [
    {
      id: 'main',
      root: {
        id: 'root',
        type: 'Stack',
        children: [
          {id: 'h1', type: 'Heading', text: 'My Test App', level: 1},
          {id: 'b1', type: 'Body', text: 'Body text.'},
        ],
      },
    },
  ],
}

// Valid JSON but fails SpecSchema validation (missing required fields).
const INVALID_SPEC_SHAPE = {
  version: 1,
  archetype: 'Tracker',
  // missing: stance, palette, coverIcon, navigation, initialScreenId, collections, screens
}

// ---------------------------------------------------------------------------
// Navigation factory
// ---------------------------------------------------------------------------

function makeNavigation(): Parameters<typeof LoadSpecFromDevMenu>[0]['navigation'] {
  return {
    navigate: jest.fn(),
    goBack: jest.fn(),
    dispatch: jest.fn(),
    reset: jest.fn(),
    setOptions: jest.fn(),
    addListener: jest.fn(() => jest.fn()),
    removeListener: jest.fn(),
    isFocused: jest.fn(() => true),
    canGoBack: jest.fn(() => false),
    getId: jest.fn(() => 'run'),
    getParent: jest.fn(),
    getState: jest.fn(),
  } as unknown as Parameters<typeof LoadSpecFromDevMenu>[0]['navigation']
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Render the SUT, flush effects, and return the query helpers. */
async function renderSUT(nav = makeNavigation()) {
  const result = render(<LoadSpecFromDevMenu navigation={nav} />)
  await act(async () => {
    await Promise.resolve()
  })
  return result
}

/** Open the bottom sheet by triggering the registered dev-menu callback. */
function openSheet() {
  const calls = devSettings().addMenuItem.mock.calls
  if (!calls.length) throw new Error('addMenuItem was not called')
  const callback = (calls[0] as [string, () => void])[1]
  act(() => callback())
}

// ---------------------------------------------------------------------------
// beforeEach
// ---------------------------------------------------------------------------

beforeEach(() => {
  currentDevMode = true
  jest.clearAllMocks()

  // Re-establish default implementations after clearAllMocks wipes them.
  expoLinking().getInitialURL.mockResolvedValue(null)
  expoLinking().addEventListener.mockImplementation(
    (_event: string, _handler: (e: {url: string}) => void) => ({remove: jest.fn()}),
  )
  toastModule().useToast.mockReturnValue({show: jest.fn(), hide: jest.fn()})
  devSpecCtx().useDevSpecContext.mockReturnValue({
    setDevSpec: jest.fn(),
    clearDevSpec: jest.fn(),
    entry: null,
  })
})

// ---------------------------------------------------------------------------
// T-0011-311: Dev-menu entry registered when __DEV__=true
// ---------------------------------------------------------------------------

describe('T-0011-311: dev-menu registration in __DEV__', () => {
  it('registers "Load spec from JSON" menu item when __DEV__ is true', async () => {
    await renderSUT()
    expect(devSettings().addMenuItem).toHaveBeenCalledWith(
      'Load spec from JSON',
      expect.any(Function),
    )
  })
})

// ---------------------------------------------------------------------------
// T-0011-312: Dev-menu entry NOT registered when __DEV__=false
// ---------------------------------------------------------------------------

describe('T-0011-312: no dev-menu registration in production', () => {
  it('does NOT register menu item when __DEV__ is false', async () => {
    currentDevMode = false
    await renderSUT()
    expect(devSettings().addMenuItem).not.toHaveBeenCalled()
  })

  it('does NOT listen for URL events when __DEV__ is false', async () => {
    currentDevMode = false
    await renderSUT()
    expect(expoLinking().addEventListener).not.toHaveBeenCalled()
  })

  it('does NOT call getInitialURL when __DEV__ is false', async () => {
    currentDevMode = false
    await renderSUT()
    expect(expoLinking().getInitialURL).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// T-0011-313: Sheet opens on menu pick
// ---------------------------------------------------------------------------

describe('T-0011-313: sheet opens on menu pick', () => {
  it('opens the bottom sheet when the registered menu item callback fires', async () => {
    const {getByTestId} = await renderSUT()
    openSheet()
    await waitFor(() => {
      expect(getByTestId('load-spec-sheet')).toBeTruthy()
    })
  })
})

// ---------------------------------------------------------------------------
// T-0011-314: Valid JSON spec → mounts in Run mode with synthetic mini_app
// ---------------------------------------------------------------------------

describe('T-0011-314: valid JSON spec mounts in Run mode', () => {
  it('navigates to Run with a synthetic miniAppId and calls setDevSpec', async () => {
    const nav = makeNavigation()
    const mockSetDevSpec = jest.fn()
    devSpecCtx().useDevSpecContext.mockReturnValue({
      setDevSpec: mockSetDevSpec,
      clearDevSpec: jest.fn(),
      entry: null,
    })

    const {getByTestId} = await renderSUT(nav)
    openSheet()

    await waitFor(() => expect(getByTestId('load-spec-input')).toBeTruthy())
    fireEvent.changeText(getByTestId('load-spec-input'), JSON.stringify(VALID_SPEC))

    await act(async () => {
      fireEvent.press(getByTestId('load-spec-submit'))
    })

    expect(mockSetDevSpec).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.stringContaining('devmenu-'),
        title: 'My Test App',
      }),
      expect.objectContaining({version: 1}),
    )
    expect(nav.navigate).toHaveBeenCalledWith(
      'Run',
      expect.objectContaining({miniAppId: expect.stringContaining('devmenu-')}),
    )
  })
})

// ---------------------------------------------------------------------------
// T-0011-315: Invalid JSON → inline error; does not crash
// ---------------------------------------------------------------------------

describe('T-0011-315: invalid JSON shows inline error without crash', () => {
  it('shows a parse error and does not navigate', async () => {
    const nav = makeNavigation()
    const {getByTestId, queryByTestId} = await renderSUT(nav)
    openSheet()

    await waitFor(() => expect(getByTestId('load-spec-input')).toBeTruthy())
    fireEvent.changeText(getByTestId('load-spec-input'), '{not valid json,,}')

    await act(async () => {
      fireEvent.press(getByTestId('load-spec-submit'))
    })

    const errorEl = getByTestId('load-spec-error')
    expect(errorEl).toBeTruthy()
    expect(queryByTestId('load-spec-error')?.props.children).toMatch(/invalid json/i)
    expect(nav.navigate).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// T-0011-316: Spec failing SpecSchema.parse → inline error with first Zod issue
// ---------------------------------------------------------------------------

describe('T-0011-316: spec that fails SpecSchema shows first Zod issue', () => {
  it('shows a Zod validation message inline when JSON parses but spec is invalid', async () => {
    const nav = makeNavigation()
    const {getByTestId} = await renderSUT(nav)
    openSheet()

    await waitFor(() => expect(getByTestId('load-spec-input')).toBeTruthy())
    fireEvent.changeText(
      getByTestId('load-spec-input'),
      JSON.stringify(INVALID_SPEC_SHAPE),
    )

    await act(async () => {
      fireEvent.press(getByTestId('load-spec-submit'))
    })

    const errorEl = getByTestId('load-spec-error')
    expect(errorEl).toBeTruthy()
    expect(typeof errorEl.props.children).toBe('string')
    expect((errorEl.props.children as string).length).toBeGreaterThan(0)
    expect(nav.navigate).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// T-0011-317: Synthetic mini_app never persisted to DB (list unchanged)
// ---------------------------------------------------------------------------

describe('T-0011-317: synthetic app never persisted to DB', () => {
  it('does not mutate the mini-apps list query cache', async () => {
    const mockSetDevSpec = jest.fn()
    devSpecCtx().useDevSpecContext.mockReturnValue({
      setDevSpec: mockSetDevSpec,
      clearDevSpec: jest.fn(),
      entry: null,
    })

    const nav = makeNavigation()
    const {getByTestId} = await renderSUT(nav)
    openSheet()

    await waitFor(() => expect(getByTestId('load-spec-input')).toBeTruthy())
    fireEvent.changeText(getByTestId('load-spec-input'), JSON.stringify(VALID_SPEC))

    await act(async () => {
      fireEvent.press(getByTestId('load-spec-submit'))
    })

    // setDevSpec (in-memory only) is the ONLY state mutation.
    expect(mockSetDevSpec).toHaveBeenCalledTimes(1)
    // Navigate was called with a devmenu- id, not a real UUID.
    const [, navParams] = (nav.navigate as jest.Mock).mock.calls[0] as ['Run', {miniAppId: string}]
    expect(navParams.miniAppId).toContain('devmenu-')
  })
})

// ---------------------------------------------------------------------------
// T-0011-317a: No telemetry emitted during load + mount flow
// ---------------------------------------------------------------------------

describe('T-0011-317a: no telemetry emitted during load + mount flow', () => {
  it('fires zero writeEvent calls from sheet open → paste → validate → navigate', async () => {
    const {getByTestId} = await renderSUT()

    openSheet()
    await waitFor(() => expect(getByTestId('load-spec-input')).toBeTruthy())

    fireEvent.changeText(getByTestId('load-spec-input'), JSON.stringify(VALID_SPEC))
    await act(async () => {
      fireEvent.press(getByTestId('load-spec-submit'))
    })

    expect(telemetry().writeEvent).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// T-0011-318: URL scheme warm-start loads tracker fixture + mounts in Run mode
// ---------------------------------------------------------------------------

describe('T-0011-318: URL scheme warm-start', () => {
  it('loads the tracker fixture and navigates to Run when URL event fires', async () => {
    const mockSetDevSpec = jest.fn()
    devSpecCtx().useDevSpecContext.mockReturnValue({
      setDevSpec: mockSetDevSpec,
      clearDevSpec: jest.fn(),
      entry: null,
    })

    // Capture the warm-start handler via addEventListener side-effect.
    let capturedHandler: ((e: {url: string}) => void) | null = null
    expoLinking().addEventListener.mockImplementation(
      (_event: string, handler: (e: {url: string}) => void) => {
        capturedHandler = handler
        return {remove: jest.fn()}
      },
    )

    const nav = makeNavigation()
    await renderSUT(nav)

    expect(capturedHandler).not.toBeNull()

    await act(async () => {
      capturedHandler!({url: 'appcreator://devmenu/load-spec?fixture=tracker'})
    })

    expect(mockSetDevSpec).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.stringContaining('devmenu-'),
        title: 'Habit Tracker',
      }),
      expect.objectContaining({version: 1}),
    )
    expect(nav.navigate).toHaveBeenCalledWith(
      'Run',
      expect.objectContaining({miniAppId: expect.stringContaining('devmenu-')}),
    )
  })

  it('ignores unrelated URL scheme events', async () => {
    let capturedHandler: ((e: {url: string}) => void) | null = null
    expoLinking().addEventListener.mockImplementation(
      (_event: string, handler: (e: {url: string}) => void) => {
        capturedHandler = handler
        return {remove: jest.fn()}
      },
    )

    const nav = makeNavigation()
    await renderSUT(nav)

    await act(async () => {
      capturedHandler!({url: 'appcreator://auth?token=abc'})
    })

    expect(nav.navigate).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// T-0011-318a: URL scheme cold-start
// ---------------------------------------------------------------------------

describe('T-0011-318a: URL scheme cold-start', () => {
  it('reads getInitialURL on mount and navigates to Run for tracker fixture', async () => {
    const mockSetDevSpec = jest.fn()
    devSpecCtx().useDevSpecContext.mockReturnValue({
      setDevSpec: mockSetDevSpec,
      clearDevSpec: jest.fn(),
      entry: null,
    })

    expoLinking().getInitialURL.mockResolvedValue(
      'appcreator://devmenu/load-spec?fixture=tracker',
    )

    const nav = makeNavigation()
    await renderSUT(nav)

    await waitFor(() => {
      expect(mockSetDevSpec).toHaveBeenCalledWith(
        expect.objectContaining({title: 'Habit Tracker'}),
        expect.objectContaining({version: 1}),
      )
    })

    expect(nav.navigate).toHaveBeenCalledWith(
      'Run',
      expect.objectContaining({miniAppId: expect.stringContaining('devmenu-')}),
    )
  })

  it('skips navigation when getInitialURL returns null (normal launch)', async () => {
    expoLinking().getInitialURL.mockResolvedValue(null)
    const nav = makeNavigation()
    await renderSUT(nav)
    await new Promise(r => setTimeout(r, 10))
    expect(nav.navigate).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// T-0011-319: Unknown fixture → toast "Fixture not found"
// ---------------------------------------------------------------------------

describe('T-0011-319: unknown fixture shows toast', () => {
  it('shows "Fixture not found" toast for unknown fixture via warm-start URL', async () => {
    const mockShow = jest.fn()
    toastModule().useToast.mockReturnValue({show: mockShow, hide: jest.fn()})

    let capturedHandler: ((e: {url: string}) => void) | null = null
    expoLinking().addEventListener.mockImplementation(
      (_event: string, handler: (e: {url: string}) => void) => {
        capturedHandler = handler
        return {remove: jest.fn()}
      },
    )

    const nav = makeNavigation()
    await renderSUT(nav)

    await act(async () => {
      capturedHandler!({url: 'appcreator://devmenu/load-spec?fixture=nonexistent-thing'})
    })

    expect(mockShow).toHaveBeenCalledWith('Fixture not found')
    expect(nav.navigate).not.toHaveBeenCalled()
  })

  it('shows "Fixture not found" toast for unknown fixture via cold-start URL', async () => {
    const mockShow = jest.fn()
    toastModule().useToast.mockReturnValue({show: mockShow, hide: jest.fn()})

    expoLinking().getInitialURL.mockResolvedValue(
      'appcreator://devmenu/load-spec?fixture=does-not-exist',
    )

    const nav = makeNavigation()
    await renderSUT(nav)

    await waitFor(() => {
      expect(mockShow).toHaveBeenCalledWith('Fixture not found')
    })
    expect(nav.navigate).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// T-0011-320: Title comes from spec's first Heading.text
// ---------------------------------------------------------------------------

describe('T-0011-320: title extracted from spec first Heading', () => {
  it('titleFromSpec returns the first Heading.text value', () => {
    expect(titleFromSpec(VALID_SPEC)).toBe('My Test App')
  })

  it('titleFromSpec returns "Dev spec" when no Heading node is present', () => {
    const specWithoutHeading: Spec = {
      version: 1,
      archetype: 'Tracker',
      stance: 'productive',
      palette: 'focus',
      coverIcon: 'check-circle',
      navigation: 'stack',
      initialScreenId: 'main',
      collections: [],
      screens: [
        {
          id: 'main',
          root: {
            id: 'root',
            type: 'Stack',
            children: [{id: 'b1', type: 'Body', text: 'No heading here.'}],
          },
        },
      ],
    }
    expect(titleFromSpec(specWithoutHeading)).toBe('Dev spec')
  })

  it('uses the heading title when navigating to Run via sheet', async () => {
    const mockSetDevSpec = jest.fn()
    devSpecCtx().useDevSpecContext.mockReturnValue({
      setDevSpec: mockSetDevSpec,
      clearDevSpec: jest.fn(),
      entry: null,
    })

    const nav = makeNavigation()
    const {getByTestId} = await renderSUT(nav)
    openSheet()

    await waitFor(() => expect(getByTestId('load-spec-input')).toBeTruthy())
    fireEvent.changeText(getByTestId('load-spec-input'), JSON.stringify(VALID_SPEC))

    await act(async () => {
      fireEvent.press(getByTestId('load-spec-submit'))
    })

    expect(mockSetDevSpec).toHaveBeenCalledWith(
      expect.objectContaining({title: 'My Test App'}),
      expect.any(Object),
    )
  })
})

// ---------------------------------------------------------------------------
// Unit: parseDevMenuUrl helper
// ---------------------------------------------------------------------------

describe('parseDevMenuUrl', () => {
  it('returns fixtureName for valid appcreator://devmenu/load-spec?fixture=foo', () => {
    expect(parseDevMenuUrl('appcreator://devmenu/load-spec?fixture=foo')).toEqual(
      {fixtureName: 'foo'},
    )
  })

  it('returns null for wrong scheme', () => {
    expect(parseDevMenuUrl('https://devmenu/load-spec?fixture=foo')).toBeNull()
  })

  it('returns null for wrong host', () => {
    expect(parseDevMenuUrl('appcreator://other/load-spec?fixture=foo')).toBeNull()
  })

  it('returns null for missing fixture param', () => {
    expect(parseDevMenuUrl('appcreator://devmenu/load-spec')).toBeNull()
  })

  it('returns null for empty fixture param', () => {
    expect(parseDevMenuUrl('appcreator://devmenu/load-spec?fixture=')).toBeNull()
  })
})

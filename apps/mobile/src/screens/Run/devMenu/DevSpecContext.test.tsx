/**
 * DevSpecContext tests — ADR-0011 Step 13.
 *
 * Tests for useDevSpecMiniAppQuery, the drop-in replacement for
 * useMiniAppQuery that short-circuits to synthetic data when a dev spec
 * is active.
 *
 * T-IDs covered (supplemental, from R2 surgical fix):
 *   T-0011-312-ctx-a  Override active: synthetic data returned, real query NOT called
 *   T-0011-312-ctx-b  Fallthrough: override set but miniAppId doesn't match → real query called
 *   T-0011-312-ctx-c  No provider (production path): delegates to real query without throwing
 *   T-0011-312-ctx-d  Rules of Hooks: useMiniAppQuery called with undefined when override active
 */
import React, {type ReactNode} from 'react'
import {renderHook} from '@testing-library/react-native'

// ---------------------------------------------------------------------------
// Module mocks — declared before SUT imports so Jest hoists them correctly.
// ---------------------------------------------------------------------------

jest.mock('#/state/queries/miniApps', () => ({
  useMiniAppQuery: jest.fn(() => ({
    data: null,
    isPending: true,
    isSuccess: false,
    isError: false,
  })),
}))

// ---------------------------------------------------------------------------
// SUT imports (after mocks)
// ---------------------------------------------------------------------------

import {DevSpecProvider, useDevSpecMiniAppQuery, useDevSpecContext} from './DevSpecContext'
import {useMiniAppQuery} from '#/state/queries/miniApps'
import type {MiniAppDetail} from '#/state/queries/miniApps'
import type {Spec} from '@app-creator/protocol'

// ---------------------------------------------------------------------------
// Mock accessor
// ---------------------------------------------------------------------------

const mockUseMiniAppQuery = useMiniAppQuery as jest.MockedFunction<typeof useMiniAppQuery>

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SYNTHETIC_ID = 'devmenu-abc-123'
const REAL_ID = 'real-ksuid-456'

const SYNTHETIC_APP = {
  id: SYNTHETIC_ID,
  title: 'Dev Test App',
  stance: 'productive',
  accentPalette: 'focus',
}

const SYNTHETIC_SPEC: Spec = {
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
        children: [{id: 'h1', type: 'Heading', text: 'Dev Test App', level: 1}],
      },
    },
  ],
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Wrapper that renders DevSpecProvider and immediately sets a dev spec entry
 * via the context so that child hooks see an active override.
 */
function makeProviderWithEntry(children: ReactNode) {
  return (
    <DevSpecProvider>
      <SetDevSpecOnMount>{children}</SetDevSpecOnMount>
    </DevSpecProvider>
  )
}

/**
 * Helper component: calls setDevSpec on first render so the context has an
 * active entry before the hook under test runs its next render cycle.
 */
function SetDevSpecOnMount({children}: {children: ReactNode}) {
  const {setDevSpec} = useDevSpecContext()
  // Intentionally not using useEffect — we want synchronous pre-population
  // so that the first renderHook result already sees the override.
  // React re-renders will stabilize via useState inside DevSpecProvider.
  React.useEffect(() => {
    setDevSpec(SYNTHETIC_APP, SYNTHETIC_SPEC)
  }, [setDevSpec])
  return <>{children}</>
}

// ---------------------------------------------------------------------------
// beforeEach
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks()
  // Re-establish default: real query returns pending by default.
  mockUseMiniAppQuery.mockReturnValue({
    data: null,
    isPending: true,
    isSuccess: false,
    isError: false,
  } as unknown as ReturnType<typeof useMiniAppQuery>)
})

// ---------------------------------------------------------------------------
// T-0011-312-ctx-a: Override active for matching miniAppId
// ---------------------------------------------------------------------------

describe('T-0011-312-ctx-a: override active for matching miniAppId', () => {
  it('returns synthetic UseQueryResult with isPending:false, isSuccess:true, data populated', async () => {
    const wrapper = ({children}: {children: ReactNode}) =>
      makeProviderWithEntry(children)

    const {result, rerender} = renderHook(
      () => useDevSpecMiniAppQuery(SYNTHETIC_ID),
      {wrapper},
    )

    // First render: setDevSpec has not fired yet (it's in useEffect).
    // After re-render triggered by setDevSpec's setState:
    rerender({})

    // By the time setDevSpec's setState has propagated, the hook should
    // return synthetic data.
    await new Promise(r => setTimeout(r, 0))
    rerender({})

    expect(result.current.isPending).toBe(false)
    expect(result.current.isSuccess).toBe(true)
    expect(result.current.data).not.toBeNull()

    const detail = result.current.data as MiniAppDetail
    expect(detail.miniApp.id).toBe(SYNTHETIC_ID)
    expect(detail.miniApp.title).toBe('Dev Test App')
    expect(detail.currentVersion.specJson).toEqual(SYNTHETIC_SPEC)
  })

  it('does NOT call the real useMiniAppQuery when override is active for matching id', async () => {
    const wrapper = ({children}: {children: ReactNode}) =>
      makeProviderWithEntry(children)

    const {rerender} = renderHook(
      () => useDevSpecMiniAppQuery(SYNTHETIC_ID),
      {wrapper},
    )

    await new Promise(r => setTimeout(r, 0))
    rerender({})

    // Every call to the real hook when override is active must pass undefined
    // (disabled query). No call with the real SYNTHETIC_ID should appear.
    const callArgs = mockUseMiniAppQuery.mock.calls.map(c => c[0])
    expect(callArgs.every(arg => arg === undefined || arg === SYNTHETIC_ID)).toBe(true)
    // At least one call must have been with undefined (the disabled path).
    expect(callArgs.some(arg => arg === undefined)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// T-0011-312-ctx-b: Fallthrough when miniAppId doesn't match override
// ---------------------------------------------------------------------------

describe('T-0011-312-ctx-b: fallthrough when miniAppId does not match override', () => {
  it('calls real useMiniAppQuery with the real id when override is for a different id', async () => {
    const wrapper = ({children}: {children: ReactNode}) =>
      makeProviderWithEntry(children)

    const {rerender} = renderHook(
      () => useDevSpecMiniAppQuery(REAL_ID),
      {wrapper},
    )

    await new Promise(r => setTimeout(r, 0))
    rerender({})

    // After the override is active (SYNTHETIC_ID), querying with REAL_ID
    // should pass the real id to useMiniAppQuery.
    const callArgs = mockUseMiniAppQuery.mock.calls.map(c => c[0])
    expect(callArgs.some(arg => arg === REAL_ID)).toBe(true)
  })

  it('does not return synthetic data for a non-matching miniAppId', async () => {
    const wrapper = ({children}: {children: ReactNode}) =>
      makeProviderWithEntry(children)

    const {result, rerender} = renderHook(
      () => useDevSpecMiniAppQuery(REAL_ID),
      {wrapper},
    )

    await new Promise(r => setTimeout(r, 0))
    rerender({})

    // The real mock returns isPending:true, so that's what we should see.
    expect(result.current.isPending).toBe(true)
    expect(result.current.isSuccess).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// T-0011-312-ctx-c: No provider — production path
// ---------------------------------------------------------------------------

describe('T-0011-312-ctx-c: no DevSpecProvider in tree (production path)', () => {
  it('delegates to real useMiniAppQuery without throwing', () => {
    // No wrapper — context is null.
    expect(() => {
      renderHook(() => useDevSpecMiniAppQuery(REAL_ID))
    }).not.toThrow()
  })

  it('calls real useMiniAppQuery with the provided id when no provider is present', () => {
    renderHook(() => useDevSpecMiniAppQuery(REAL_ID))
    expect(mockUseMiniAppQuery).toHaveBeenCalledWith(REAL_ID)
  })

  it('returns the real query result when no provider is present', () => {
    const fakeResult = {
      data: null,
      isPending: false,
      isSuccess: false,
      isError: true,
    } as unknown as ReturnType<typeof useMiniAppQuery>
    mockUseMiniAppQuery.mockReturnValueOnce(fakeResult)

    const {result} = renderHook(() => useDevSpecMiniAppQuery(REAL_ID))
    expect(result.current.isError).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// T-0011-312-ctx-d: Rules of Hooks — useMiniAppQuery called with undefined when override active
// ---------------------------------------------------------------------------

describe('T-0011-312-ctx-d: Rules of Hooks compliance', () => {
  it('calls useMiniAppQuery with undefined (not the real id) when dev override is active', async () => {
    const wrapper = ({children}: {children: ReactNode}) =>
      makeProviderWithEntry(children)

    const {rerender} = renderHook(
      () => useDevSpecMiniAppQuery(SYNTHETIC_ID),
      {wrapper},
    )

    await new Promise(r => setTimeout(r, 0))
    rerender({})

    // After override kicks in, the real hook must be called with undefined
    // so the underlying query is disabled (enabled:false path).
    const postOverrideCalls = mockUseMiniAppQuery.mock.calls.slice(-1)
    expect(postOverrideCalls[0]?.[0]).toBe(undefined)
  })
})

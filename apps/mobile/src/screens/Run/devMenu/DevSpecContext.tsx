/**
 * DevSpecContext — dev-only context that, when set, short-circuits
 * `useMiniAppQuery` in RunScreen so the eval harness can inject an
 * arbitrary in-memory spec without writing to the DB.
 *
 * ADR-0011 Step 13 (T-0011-311..T-0011-320).
 *
 * Usage:
 *   1. Wrap <App> with <DevSpecProvider> (only in __DEV__, see App.tsx note).
 *   2. Call setDevSpec(synthetic, spec) from LoadSpecFromDevMenu.
 *   3. RunScreen calls useDevSpecMiniAppQuery(miniAppId), which returns
 *      the synthetic data when a dev spec is active.
 *
 * NEVER import this module in production — the __DEV__ guard in the
 * registration site (LoadSpecFromDevMenu) is the enforcement boundary.
 * This file itself is harmless in prod (context is null → passthrough).
 */
import {createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode} from 'react'
import type {UseQueryResult} from '@tanstack/react-query'

import type {Spec} from '@app-creator/protocol'
import type {MiniAppDetail} from '#/state/queries/miniApps'
import {useMiniAppQuery} from '#/state/queries/miniApps'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SyntheticMiniApp {
  id: string
  title: string
  stance: string
  accentPalette: string
}

interface DevSpecEntry {
  synthetic: SyntheticMiniApp
  spec: Spec
}

interface DevSpecContextValue {
  entry: DevSpecEntry | null
  setDevSpec: (synthetic: SyntheticMiniApp, spec: Spec) => void
  clearDevSpec: () => void
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const DevSpecContext = createContext<DevSpecContextValue | null>(null)

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function DevSpecProvider({children}: {children: ReactNode}) {
  const [entry, setEntry] = useState<DevSpecEntry | null>(null)

  const setDevSpec = useCallback((synthetic: SyntheticMiniApp, spec: Spec) => {
    setEntry({synthetic, spec})
  }, [])

  const clearDevSpec = useCallback(() => {
    setEntry(null)
  }, [])

  const value = useMemo(
    () => ({entry, setDevSpec, clearDevSpec}),
    [entry, setDevSpec, clearDevSpec],
  )

  return <DevSpecContext.Provider value={value}>{children}</DevSpecContext.Provider>
}

// ---------------------------------------------------------------------------
// Hook — use inside provider
// ---------------------------------------------------------------------------

export function useDevSpecContext(): DevSpecContextValue {
  const ctx = useContext(DevSpecContext)
  if (!ctx) {
    throw new Error('useDevSpecContext must be used within <DevSpecProvider>')
  }
  return ctx
}

// ---------------------------------------------------------------------------
// Drop-in replacement for useMiniAppQuery — checks dev context first.
//
// When a dev spec is active and the miniAppId matches the synthetic id,
// returns a settled-success query result without hitting the network.
// Otherwise delegates to the real useMiniAppQuery.
// ---------------------------------------------------------------------------

const SYNTHETIC_VERSION_ID = '00000000-0000-0000-0000-000000000001'
const SYNTHETIC_RENDER_HASH = 'dev-spec-hash'

function buildSyntheticDetail(entry: DevSpecEntry): MiniAppDetail {
  const syntheticId = entry.synthetic.id
  return {
    miniApp: {
      id: syntheticId,
      title: entry.synthetic.title,
      currentVersionId: SYNTHETIC_VERSION_ID,
      parentMiniAppId: null,
      stance: entry.synthetic.stance,
      accentPalette: entry.synthetic.accentPalette,
      coverArtSeed: 'dev',
      archetype: 'productivity',
      syncMode: 'local',
      archivedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    currentVersion: {
      id: SYNTHETIC_VERSION_ID,
      miniAppId: syntheticId,
      specJson: entry.spec,
      renderHash: SYNTHETIC_RENDER_HASH,
      createdAt: new Date().toISOString(),
    },
  }
}

/**
 * useDevSpecMiniAppQuery — wraps useMiniAppQuery with a dev-context override.
 *
 * When the dev context has an active spec for this miniAppId, returns synthetic
 * data without a network call. Falls through to useMiniAppQuery otherwise.
 *
 * Rules:
 * - DevSpecContext is NEVER consulted in production (provider is not mounted).
 * - The hook unconditionally calls useMiniAppQuery to satisfy Rules of Hooks.
 *   The real query is disabled (enabled: false) when a dev override is active.
 */
export function useDevSpecMiniAppQuery(
  miniAppId: string | undefined,
): UseQueryResult<MiniAppDetail, Error> {
  const ctx = useContext(DevSpecContext)
  const devEntry = ctx?.entry ?? null

  const isDevOverride =
    devEntry !== null &&
    miniAppId !== undefined &&
    miniAppId === devEntry.synthetic.id

  // Always call — Rules of Hooks. Disabled when dev override is active.
  const realQuery = useMiniAppQuery(isDevOverride ? undefined : miniAppId)

  // Stable ref for synthetic detail to avoid re-creating on every render.
  const syntheticDetailRef = useRef<MiniAppDetail | null>(null)
  if (isDevOverride && devEntry !== null) {
    if (
      syntheticDetailRef.current === null ||
      syntheticDetailRef.current.miniApp.id !== devEntry.synthetic.id
    ) {
      syntheticDetailRef.current = buildSyntheticDetail(devEntry)
    }
  } else {
    syntheticDetailRef.current = null
  }

  if (isDevOverride && syntheticDetailRef.current !== null) {
    const detail = syntheticDetailRef.current
    // Return a shape that satisfies UseQueryResult<MiniAppDetail, Error>.
    // Cast is intentional — we only ever read .data, .isPending, .isError
    // in RunScreen, and all three are set correctly here.
    return {
      data: detail,
      isPending: false,
      isError: false,
      isSuccess: true,
      isLoading: false,
      isLoadingError: false,
      isRefetchError: false,
      isFetching: false,
      isFetched: true,
      isFetchedAfterMount: true,
      isPlaceholderData: false,
      isStale: false,
      isRefetching: false,
      isPaused: false,
      error: null,
      status: 'success',
      fetchStatus: 'idle',
      failureCount: 0,
      failureReason: null,
      errorUpdateCount: 0,
      dataUpdatedAt: Date.now(),
      errorUpdatedAt: 0,
      refetch: async () => ({data: detail, error: null}) as never,
    } as unknown as UseQueryResult<MiniAppDetail, Error>
  }

  return realQuery
}

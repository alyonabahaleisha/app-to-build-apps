/**
 * SessionProvider — single source of truth for the user's auth session
 * (ARCHITECTURE.md §3, ADR-0001 Step 5).
 *
 * Lifecycle:
 *   loading → (hydrate from secure-store) → authenticated | unauthenticated
 *   authenticated → (timer at exp - 60s) → refresh → authenticated | unauthenticated
 *   any → signOut() → unauthenticated
 *
 * Public surface (re-exported via `./useSession.ts`):
 *   - `useSession()` returns a stable `{status, user?, redeemToken, signOut}`
 *     reference — same identity between renders unless state changed
 *     (T-0001-084).
 *
 * Token storage:
 *   - Tokens are persisted ONLY via `secureStore` (Tier 1 — secure-store).
 *     Never MMKV, never AsyncStorage (ARCHITECTURE.md §17 red flag).
 *   - Tokens are also held in memory and pushed to `apiFetch`'s session ref
 *     so HTTP calls don't hit the keychain on every request.
 *
 * Concurrency:
 *   - `redeemToken` is internally idempotent — two simultaneous calls share
 *     a single in-flight `/auth/sync` (T-0001-083).
 *   - `signOut` clears the session ref synchronously, so any
 *     between-tap-and-clear in-flight `apiFetch` resolves on its own
 *     timeline but subsequent calls reject (T-0001-123).
 */
import Constants from 'expo-constants'
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import {createClient} from '@supabase/supabase-js'

import {
  apiFetch,
  NotAuthenticatedError,
  RefreshFailedError,
  resetApiForTests as _resetApiForTests,
  setCurrentSession,
  type SessionAuth,
} from '#/lib/api'
import {clearPendingClone} from '#/lib/pendingClone'
import {secureStore, type SecureSnapshot} from '#/state/persisted/secure'

// -- Public types -----------------------------------------------------------

export interface AuthUser {
  id: string
  email: string
  /** Optional — set by SIWA (ADR-0013); absent for magic-link users. */
  displayName?: string
}

export type SessionStatus = 'loading' | 'unauthenticated' | 'authenticated'

interface SessionStateLoading {
  status: 'loading'
}
interface SessionStateUnauth {
  status: 'unauthenticated'
}
interface SessionStateAuth {
  status: 'authenticated'
  user: AuthUser
}

type InternalState = SessionStateLoading | SessionStateUnauth | SessionStateAuth

export interface RedeemInput {
  accessToken: string
  refreshToken: string
}

export interface SessionContextValue {
  status: SessionStatus
  user: AuthUser | null
  redeemToken: (input: RedeemInput) => Promise<void>
  signOut: () => Promise<void>
  /**
   * Dev/preview bypass: enter an authenticated state with a synthetic guest
   * user. Tokens are NOT written to secure-store and NO bearer is attached
   * to `apiFetch`, so authenticated API calls will reject with
   * `NotAuthenticatedError`. The UI is browsable; backed-by-API screens
   * surface their error state. Use this only to preview the app shell
   * without a magic-link round-trip.
   */
  skipAuth: () => void
}

export class RedeemFailedError extends Error {
  readonly cause?: unknown
  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'RedeemFailedError'
    this.cause = cause
  }
}

// -- Refresh dependency -----------------------------------------------------

/**
 * Refresh implementation. Decoupled from `@supabase/supabase-js` so tests
 * can inject a fake without touching network or env vars. Production wires
 * this up with the real Supabase refresh endpoint.
 */
export interface RefreshClient {
  refresh: (refreshToken: string) => Promise<{accessToken: string; refreshToken: string}>
}

let injectedRefreshClient: RefreshClient | null = null

/** Test seam — replace the refresh client. */
export function setRefreshClientForTests(client: RefreshClient | null): void {
  injectedRefreshClient = client
}

async function defaultRefresh(
  refreshToken: string,
): Promise<{accessToken: string; refreshToken: string}> {
  if (injectedRefreshClient) {
    return injectedRefreshClient.refresh(refreshToken)
  }
  // The URL/anon-key for refresh come from the Expo extra config. At M1 the
  // refresh path is exercised end-to-end in integration tests; unit tests
  // inject a fake refresh client via `setRefreshClientForTests`.
  const extra = (Constants.expoConfig?.extra ?? {}) as {
    supabaseUrl?: string
    supabaseAnonKey?: string
  }
  if (!extra.supabaseUrl || !extra.supabaseAnonKey) {
    throw new RefreshFailedError('supabase config missing')
  }
  const client = createClient(extra.supabaseUrl, extra.supabaseAnonKey, {
    auth: {persistSession: false, autoRefreshToken: false},
  })
  const {data, error} = await client.auth.refreshSession({refresh_token: refreshToken})
  if (error || !data.session) {
    throw new RefreshFailedError(error?.message ?? 'refresh returned no session')
  }
  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
  }
}

// -- JWT decoding -----------------------------------------------------------

interface DecodedJwt {
  sub: string
  email?: string
  exp: number
}

/**
 * Decode the payload portion of a JWT without verifying — the SERVER does
 * the cryptographic verification on every authenticated request. We only
 * need `sub`, `email`, and `exp` for client-side lifecycle management.
 *
 * Throws on malformed input — caller wraps in `RedeemFailedError`.
 */
export function decodeJwtPayload(token: string): DecodedJwt {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('jwt: expected 3 segments')
  const payloadSegment = parts[1]!
  // Base64URL → base64 padding restoration.
  const padded = payloadSegment + '='.repeat((4 - (payloadSegment.length % 4)) % 4)
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/')
  let json: string
  try {
    // `atob` is available in jest-expo and React Native via Hermes.
    json =
      typeof atob === 'function' ? atob(base64) : Buffer.from(base64, 'base64').toString('utf8')
  } catch {
    throw new Error('jwt: payload not base64')
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('jwt: payload not JSON')
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    typeof (parsed as Record<string, unknown>).sub !== 'string' ||
    typeof (parsed as Record<string, unknown>).exp !== 'number'
  ) {
    throw new Error('jwt: payload missing sub/exp')
  }
  const obj = parsed as Record<string, unknown>
  return {
    sub: obj.sub as string,
    email: typeof obj.email === 'string' ? obj.email : undefined,
    exp: obj.exp as number,
  }
}

// -- Context --------------------------------------------------------------

const SessionContext = createContext<SessionContextValue | null>(null)
SessionContext.displayName = 'SessionContext'

/** Internal — useSession imports from `./useSession` which re-exports this. */
export {SessionContext}

// -- Provider --------------------------------------------------------------

interface SessionProviderProps {
  children: ReactNode
  /** Test override. Production omits — defaults to real `secureStore`. */
  storage?: typeof secureStore
}

const REFRESH_LEAD_MS = 60_000

export function SessionProvider({children, storage}: SessionProviderProps) {
  const store = storage ?? secureStore
  const [state, setState] = useState<InternalState>({status: 'loading'})

  // Refs that survive re-renders without re-triggering the effect.
  const refreshTokenRef = useRef<string | null>(null)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlightRedeemRef = useRef<Promise<void> | null>(null)
  const mountedRef = useRef(true)

  // ---- helpers ---------------------------------------------------------

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current !== null) {
      clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = null
    }
  }, [])

  // `applySession` deliberately captures `scheduleRefresh` via closure (it
  // is declared below). Listing it in the deps would cycle. The empty deps
  // are correct because all referenced values are refs or stable closures.
  const applySession = useCallback(
    (session: SessionAuth, user: AuthUser, refreshToken: string, expMs: number) => {
      setCurrentSession(session)
      refreshTokenRef.current = refreshToken
      scheduleRefresh(expMs)
      if (mountedRef.current) setState({status: 'authenticated', user})
    },
    [],
  )

  const enterUnauthenticated = useCallback(async () => {
    clearRefreshTimer()
    refreshTokenRef.current = null
    setCurrentSession(null)
    try {
      await store.clear()
    } catch {
      // Best-effort. The in-memory state is already unauthenticated; a
      // failed delete just means the next cold-start will rediscover the
      // tokens and try to refresh them, and if that also fails we're back
      // here. Token NEVER appears in the warning string (T-0001-082).
      console.warn('secure-store clear failed')
    }
    // ADR-0008 Step 5: clear any pending clone intent on sign-out to prevent
    // cross-account replay if another user signs in on the same device (T-0008-123).
    // clearPendingClone is idempotent — safe to call when nothing is stored.
    await clearPendingClone()
    if (mountedRef.current) setState({status: 'unauthenticated'})
  }, [clearRefreshTimer, store])

  const performRefresh = useCallback(async () => {
    const rt = refreshTokenRef.current
    if (!rt) {
      await enterUnauthenticated()
      return
    }
    try {
      const {accessToken, refreshToken: newRt} = await defaultRefresh(rt)
      const decoded = decodeJwtPayload(accessToken)
      const user: AuthUser = {id: decoded.sub, email: decoded.email ?? ''}
      await store.write({accessToken, refreshToken: newRt, userId: user.id})
      applySession({accessToken, userId: user.id}, user, newRt, decoded.exp * 1000)
    } catch {
      // Refresh failed (network, 401, malformed). Drop the session
      // (T-0001-133). The next `apiFetch` will reject with
      // `NotAuthenticatedError`. Callers can listen on the session status
      // and surface a `RefreshFailedError` toast at a higher layer if
      // they want — we don't throw here because nothing's awaiting us.
      await enterUnauthenticated()
    }
  }, [applySession, enterUnauthenticated, store])

  const scheduleRefresh = useCallback(
    (expMs: number) => {
      clearRefreshTimer()
      const delay = Math.max(0, expMs - Date.now() - REFRESH_LEAD_MS)
      refreshTimerRef.current = setTimeout(() => {
        void performRefresh()
      }, delay)
    },
    [clearRefreshTimer, performRefresh],
  )

  // ---- mount: hydrate from secure-store -------------------------------

  useEffect(() => {
    mountedRef.current = true
    let cancelled = false

    void (async () => {
      let snapshot: SecureSnapshot
      try {
        snapshot = await store.read()
      } catch {
        // `secureStore.read` already swallows native errors and returns
        // null per key. This catch is belt-and-suspenders for a wrapper
        // that throws (T-0001-080).
        snapshot = {accessToken: null, refreshToken: null, userId: null}
      }
      if (cancelled) return

      const {accessToken, refreshToken, userId} = snapshot
      if (!accessToken || !refreshToken || !userId) {
        if (mountedRef.current) setState({status: 'unauthenticated'})
        return
      }

      let decoded: DecodedJwt
      try {
        decoded = decodeJwtPayload(accessToken)
      } catch {
        // Stored token is corrupt — purge and start fresh.
        await enterUnauthenticated()
        return
      }
      const expMs = decoded.exp * 1000
      const now = Date.now()

      if (expMs <= now + REFRESH_LEAD_MS) {
        // Already expired or close enough — refresh inline before exposing
        // an authenticated state. Keeps state machine clean (no
        // momentary-authenticated-then-unauthenticated flicker).
        refreshTokenRef.current = refreshToken
        await performRefresh()
        return
      }

      const user: AuthUser = {id: userId, email: decoded.email ?? ''}
      applySession({accessToken, userId}, user, refreshToken, expMs)
    })()

    return () => {
      cancelled = true
      mountedRef.current = false
      clearRefreshTimer()
      // Don't `setCurrentSession(null)` here — the provider unmounting on
      // app shutdown shouldn't poison a fresh remount during HMR. The
      // ref is process-global, and a fresh provider re-hydrates anyway.
    }
    // Mount-only — the captured callbacks are referentially stable for
    // the lifetime of the provider, and re-hydrating on every render
    // would be incorrect.
  }, [])

  // ---- redeemToken ----------------------------------------------------

  const redeemToken = useCallback(
    async (input: RedeemInput): Promise<void> => {
      // Idempotent: collapse simultaneous calls into one in-flight promise
      // (T-0001-083). The second caller awaits the first's resolution.
      if (inFlightRedeemRef.current) {
        return inFlightRedeemRef.current
      }

      const promise = (async () => {
        let decoded: DecodedJwt
        try {
          decoded = decodeJwtPayload(input.accessToken)
        } catch (err) {
          throw new RedeemFailedError('invalid_token', err)
        }

        const candidateUser: AuthUser = {
          id: decoded.sub,
          email: decoded.email ?? '',
        }

        // Set the session ref BEFORE calling /auth/sync so apiFetch can
        // attach the bearer header on the very call we're about to make.
        // If sync fails, we revert below.
        setCurrentSession({accessToken: input.accessToken, userId: candidateUser.id})

        let synced: {user: {id: string; email: string}}
        try {
          synced = await apiFetch<{user: {id: string; email: string}}>('/auth/sync', {
            method: 'POST',
            body: JSON.stringify({}),
          })
        } catch (err) {
          // Sync failed — DO NOT persist tokens (T-0001-077, T-0001-078).
          setCurrentSession(null)
          if (err instanceof RedeemFailedError) throw err
          throw new RedeemFailedError('sync_failed', err)
        }

        const user: AuthUser = {
          id: synced.user.id,
          email: synced.user.email,
        }

        try {
          await store.write({
            accessToken: input.accessToken,
            refreshToken: input.refreshToken,
            userId: user.id,
          })
        } catch (err) {
          // Storage failed — roll back the in-memory session.
          setCurrentSession(null)
          throw new RedeemFailedError('storage_failed', err)
        }

        applySession(
          {accessToken: input.accessToken, userId: user.id},
          user,
          input.refreshToken,
          decoded.exp * 1000,
        )
      })()

      inFlightRedeemRef.current = promise
      try {
        await promise
      } finally {
        inFlightRedeemRef.current = null
      }
    },
    [applySession, store],
  )

  // ---- signOut --------------------------------------------------------

  const signOut = useCallback(async (): Promise<void> => {
    await enterUnauthenticated()
  }, [enterUnauthenticated])

  const skipAuth = useCallback((): void => {
    clearRefreshTimer()
    refreshTokenRef.current = null
    // Use the dev-bypass token recognized by the API's requireAuth in
    // non-production. Matches DEV_USER.id on the server so project FKs resolve.
    const devUserId = 'deadbeef-0000-0000-0000-000000000000'
    setCurrentSession({accessToken: 'dev-bypass', userId: devUserId})
    if (mountedRef.current) {
      setState({
        status: 'authenticated',
        user: {id: devUserId, email: 'dev-guest@local.dev'},
      })
    }
  }, [clearRefreshTimer])

  // ---- context value (referentially stable per state) ----------------

  const value = useMemo<SessionContextValue>(() => {
    if (state.status === 'authenticated') {
      return {status: state.status, user: state.user, redeemToken, signOut, skipAuth}
    }
    return {status: state.status, user: null, redeemToken, signOut, skipAuth}
  }, [state, redeemToken, signOut, skipAuth])

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

// Re-export types/errors used by callers.
export {NotAuthenticatedError, RefreshFailedError}
// Re-export for completeness — tests sometimes prefer to reset directly.
export const resetApiForTests = _resetApiForTests

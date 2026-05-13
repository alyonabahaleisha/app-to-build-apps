/**
 * Mobile HTTP client — single seam to the API.
 *
 * Two responsibilities:
 *
 * 1. URL resolution. The API URL comes from
 *    `Constants.expoConfig.extra.apiUrl ?? process.env.EXPO_PUBLIC_API_URL`,
 *    with strict validation: only HTTPS in production; HTTP allowed only on
 *    localhost in `__DEV__`. Unset/empty/malformed config falls back to
 *    `http://localhost:3000` in dev (with a warning) and refuses to construct
 *    in non-dev. Covered by T-0001-124 (5 sub-cases).
 *
 * 2. Session-aware fetch. `apiFetch` checks the in-memory session ref
 *    BEFORE issuing the network request. If the route requires auth and no
 *    session exists, the call rejects synchronously with `NotAuthenticatedError`
 *    — no token is ever attached if there's nothing to attach (T-0001-076,
 *    T-0001-123).
 *
 * `SessionProvider` updates the module-level `currentSession` ref on every
 * state transition. The ref is intentionally not React state — `apiFetch`
 * runs inside mutations/queries that are not React renders, and pulling
 * from a context here would force every caller to be inside a component.
 */
import Constants from 'expo-constants'

// -- Public errors ----------------------------------------------------------

export class NotAuthenticatedError extends Error {
  constructor(message = 'not_authenticated') {
    super(message)
    this.name = 'NotAuthenticatedError'
  }
}

export class RefreshFailedError extends Error {
  constructor(message = 'refresh_failed') {
    super(message)
    this.name = 'RefreshFailedError'
  }
}

export class ApiError extends Error {
  readonly status: number
  readonly body: string
  constructor(status: number, body: string) {
    super(`API ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

// -- URL resolution ---------------------------------------------------------

/**
 * Routes that don't require an Authorization header. Everything else assumes
 * authenticated. The list is intentionally tiny — magic-link is the only
 * user-facing public endpoint and `/health` is for the harness.
 */
const PUBLIC_PATH_PREFIXES = ['/health', '/auth/magic-link', '/auth/apple']

const FALLBACK_API_URL = 'http://localhost:3000'

interface ResolveOptions {
  isDev?: boolean
  warn?: (message: string) => void
}

interface ResolutionResult {
  url: string | null
  warning?: string
}

/**
 * Pure function — given a candidate string and dev flag, return the URL to
 * use (or `null` if the API client must refuse to construct).
 *
 * Exported for direct unit testing (T-0001-124). Production callers should
 * use `getApiUrl()`.
 */
export function resolveApiUrl(
  candidate: string | undefined | null,
  opts: ResolveOptions = {},
): ResolutionResult {
  const isDev = opts.isDev ?? false
  const trimmed = (candidate ?? '').trim()

  if (trimmed.length === 0) {
    if (isDev) {
      return {
        url: FALLBACK_API_URL,
        warning: 'EXPO_PUBLIC_API_URL not set; falling back to http://localhost:3000',
      }
    }
    return {url: null, warning: 'EXPO_PUBLIC_API_URL not set'}
  }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    if (isDev) {
      return {
        url: FALLBACK_API_URL,
        warning: `EXPO_PUBLIC_API_URL malformed (${trimmed}); falling back to http://localhost:3000`,
      }
    }
    return {url: null, warning: `EXPO_PUBLIC_API_URL malformed (${trimmed})`}
  }

  if (parsed.protocol === 'https:') {
    return {url: stripTrailingSlash(parsed.toString())}
  }

  if (parsed.protocol === 'http:') {
    const host = parsed.hostname
    const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0'
    if (isDev) {
      const warning = isLocalHost
        ? undefined
        : `EXPO_PUBLIC_API_URL is HTTP on non-localhost host (${host}); accepted in dev only`
      return {url: stripTrailingSlash(parsed.toString()), warning}
    }
    return {
      url: null,
      warning: `EXPO_PUBLIC_API_URL must be HTTPS in non-dev (got ${parsed.protocol}//${host})`,
    }
  }

  // Non-http(s) scheme.
  if (isDev) {
    return {
      url: FALLBACK_API_URL,
      warning: `EXPO_PUBLIC_API_URL has unsupported protocol (${parsed.protocol}); falling back`,
    }
  }
  return {url: null, warning: `EXPO_PUBLIC_API_URL has unsupported protocol (${parsed.protocol})`}
}

function stripTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url
}

/**
 * Read the API URL from Expo config + env, applying the resolver. Throws
 * in non-dev if config is missing/invalid — fail-fast at first call site.
 */
export function getApiUrl(): string {
  const candidate =
    (Constants.expoConfig?.extra as {apiUrl?: string} | undefined)?.apiUrl ??
    process.env.EXPO_PUBLIC_API_URL ??
    null

  // `__DEV__` is a global injected by the React Native runtime. In jest-expo
  // it's defined; in pure-node tests we treat it as truthy.
  const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : true

  const {url, warning} = resolveApiUrl(candidate, {isDev})

  if (warning) {
    console.warn(warning)
  }

  if (url === null) {
    throw new Error(`EXPO_PUBLIC_API_URL configuration invalid: ${warning ?? 'unknown'}`)
  }
  return url
}

// -- Session ref ------------------------------------------------------------

export interface SessionAuth {
  accessToken: string
  userId: string
}

/**
 * Module-level current session. The provider writes to this on every state
 * transition; `apiFetch` reads it on every call.
 *
 * Why not React state? `apiFetch` is invoked from query functions and
 * mutation handlers — neither runs inside a render tree. Forcing it through
 * context would push every API caller into a component. A simple ref is
 * sufficient because authenticated state is process-global anyway (one
 * user at a time per ARCHITECTURE.md §3).
 */
let currentSession: SessionAuth | null = null

export function setCurrentSession(session: SessionAuth | null): void {
  currentSession = session
}

export function getCurrentSession(): SessionAuth | null {
  return currentSession
}

/** Test helper — reset to a known clean state between cases. */
export function resetApiForTests(): void {
  currentSession = null
}

// -- apiFetch ---------------------------------------------------------------

export interface ApiFetchOptions extends RequestInit {
  /**
   * Override the public-path classification. Defaults to checking the path
   * against `PUBLIC_PATH_PREFIXES`.
   */
  requireAuth?: boolean
  /** Optional override of the resolved API URL — for tests. */
  baseUrl?: string
}

function isPublicPath(path: string): boolean {
  return PUBLIC_PATH_PREFIXES.some(prefix => path === prefix || path.startsWith(`${prefix}?`))
}

export async function apiFetch<T>(path: string, init: ApiFetchOptions = {}): Promise<T> {
  const {requireAuth, baseUrl, headers: rawHeaders, ...rest} = init
  const needsAuth = requireAuth ?? !isPublicPath(path)

  const hasBody = rest.body != null
  const headers: Record<string, string> = {
    ...(hasBody ? {'Content-Type': 'application/json'} : {}),
    ...((rawHeaders as Record<string, string> | undefined) ?? {}),
  }

  if (needsAuth) {
    const session = currentSession
    if (!session) {
      // Reject synchronously — never attach a header we don't have, never
      // attempt the network call (T-0001-076, T-0001-123).
      throw new NotAuthenticatedError()
    }
    headers.Authorization = `Bearer ${session.accessToken}`
  }

  const url = `${baseUrl ?? getApiUrl()}${path}`
  const response = await fetch(url, {...rest, headers})
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new ApiError(response.status, text || response.statusText)
  }
  return (await response.json()) as T
}

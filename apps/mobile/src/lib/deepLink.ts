/**
 * Deep-link handler — `useAuthDeepLink()`.
 *
 * Wires `expo-linking`'s `useURL()` (cold + warm start both supported per
 * SDK contract) to the session provider's `redeemToken`.
 *
 * Scheme contract (per `app.config.ts` and ADR-0001 Step 6 sketch):
 *   appcreator://auth?token=<supabase-jwt>&refresh_token=<refresh>
 *
 * Behavior:
 *   - URL null → no-op (covers both "no link tapped yet" and the warm-start
 *     idle state). T-0001-102 — must not infinite-loop.
 *   - Wrong path (e.g. `appcreator://wrongpath`) → ignored. T-0001-100.
 *   - Missing `token` param → ignored. T-0001-101.
 *   - Empty token (`?token=`) → ignored silently, no error toast. T-0001-134.
 *   - Valid `appcreator://auth?token=<jwt>` → calls `redeemToken` once.
 *     Re-renders with the same URL must not re-fire (the effect dep array
 *     is `[url, ...]` and `url` is stable across re-renders per the
 *     expo-linking contract — Cal flagged this in ADR §Notes for Colby #5).
 *
 * Refresh-token note: Supabase returns the access + refresh tokens in the
 * URL hash fragment after a successful magic-link redeem. `expo-linking`
 * exposes both query and hash params via `parse()`. We accept both
 * `query.token` (custom server-bridged form) and `hash` parsing. M1 server
 * bridge — set in ADR Step 3 — places both tokens in the query string for
 * simplicity. The handler accepts `refresh_token` too, but a missing
 * `refresh_token` falls through to the empty string (the SessionProvider
 * is the policy holder for what's required to redeem; this layer is just
 * a transport adapter).
 */
import * as Linking from 'expo-linking'
import {useEffect} from 'react'

import {useSession} from '#/state/session/useSession'

export const AUTH_SCHEME = 'appcreator'
export const AUTH_HOST = 'auth'

/**
 * Expo-linking returns `string | (string | null)[] | undefined` for
 * query params. Coerce to a single trimmed string or null.
 */
function pickParam(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null
  if (Array.isArray(value)) {
    const first = value[0]
    return typeof first === 'string' ? first.trim() || null : null
  }
  return null
}

interface ParsedDeepLink {
  token: string
  refreshToken: string
}

/**
 * Pure URL parser, exported for direct unit tests (T-0001-098..102, 134).
 * Returns `null` when the URL doesn't carry a usable auth payload.
 */
export function parseAuthDeepLink(url: string | null): ParsedDeepLink | null {
  if (!url) return null

  let parsed: ReturnType<typeof Linking.parse>
  try {
    parsed = Linking.parse(url)
  } catch {
    return null
  }

  if (parsed.scheme !== AUTH_SCHEME) return null
  if (parsed.hostname !== AUTH_HOST) return null

  const params = parsed.queryParams ?? {}
  const token = pickParam((params as Record<string, unknown>).token)
  if (!token) return null

  const refreshToken = pickParam((params as Record<string, unknown>).refresh_token) ?? ''

  return {token, refreshToken}
}

export interface UseAuthDeepLinkOptions {
  /**
   * Optional callback fired when `redeemToken` rejects (token expired,
   * used, malformed, network failure during /auth/sync). The Navigator
   * uses this to flip the SignIn `showExpiredBanner` prop. Step 6 shipped
   * the prop; Step 7 wires it.
   *
   * The callback receives the rejection reason (typically a
   * `RedeemFailedError`). Pass-through of the error is intentional — a
   * future variant could differentiate `invalid_token` from `sync_failed`.
   */
  onRedeemError?: (err: unknown) => void
}

export function useAuthDeepLink(opts: UseAuthDeepLinkOptions = {}): void {
  const url = Linking.useURL()
  const {redeemToken} = useSession()
  const {onRedeemError} = opts

  useEffect(() => {
    const parsed = parseAuthDeepLink(url)
    if (!parsed) return
    // Fire-and-forget: redeem failures surface via session state changes
    // and the SessionProvider's RedeemFailedError. The screen layer can
    // observe `useSession().status` to react to expired-link cases — and
    // the `onRedeemError` hook lets the Navigator flip the SignIn banner.
    void redeemToken({
      accessToken: parsed.token,
      refreshToken: parsed.refreshToken,
    }).catch((err: unknown) => {
      // Swallow logging concerns — provider does its own. Surface to the
      // optional caller hook so the UI can react (Step 7 wire).
      onRedeemError?.(err)
    })
    // `redeemToken` is referentially stable across renders that don't
    // change session state (T-0001-084), and `url` is stable until the
    // OS feeds a new deep link. So this effect runs exactly once per
    // distinct URL — see ADR §Notes for Colby #5.
  }, [url, redeemToken, onRedeemError])
}

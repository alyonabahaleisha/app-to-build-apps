/**
 * getAuthProvider() — env-flag dispatch for the auth provider.
 *
 * Reads `EXPO_PUBLIC_AUTH_PROVIDER`. Normalizes (trim + lowercase). Returns:
 *   - 'apple'       → siwaProvider (stub until ADR-0013 lands)
 *   - 'magic-link'  → magicLinkProvider (default)
 *   - '' / unset    → magicLinkProvider
 *   - anything else → logs a warn + falls back to magicLinkProvider
 *
 * Memoized: the provider is resolved once and cached for the app's lifetime.
 * `__resetAuthProviderCacheForTests()` is the test-only escape hatch.
 *
 * Per ADR-0013 §Decision 6. T-0011-155..159 cover exhaustive flag variations.
 * T-0011-158 asserts the exact `logger.warn` payload for unknown values.
 *
 * NOTE: We read the env var via bracket notation `process['env'][...]` to
 * prevent `babel-preset-expo` from inlining the value at compile time
 * (which would break the config-exhaustion tests that set the var at runtime).
 */
import {logger} from '#/logger'

import {magicLinkProvider} from './magicLinkProvider'
import {siwaProvider} from './siwaProvider'
import type {AuthProvider, AuthProviderName} from './types'

/**
 * Test-only env override — lets tests set the raw env string without relying
 * on babel's compile-time inline substitution of EXPO_PUBLIC_* vars. When
 * non-null, `readEnvFlag` uses this value instead of `process.env`.
 */
let _testEnvOverride: string | null = null

function readEnvFlag(): AuthProviderName {
  // Use the test override if set, otherwise read from process.env via bracket
  // notation to prevent babel-preset-expo from inlining at compile time.
  const raw = (
    _testEnvOverride !== null
      ? _testEnvOverride
      : (process['env']['EXPO_PUBLIC_AUTH_PROVIDER'] ?? '')
  )
    .trim()
    .toLowerCase()

  if (raw === 'apple') return 'apple'
  if (raw === 'magic-link' || raw === '') return 'magic-link'
  // Unknown value — warn and fall back. T-0011-158: exact payload.
  logger.warn(
    {event: 'auth_provider_invalid', value: raw, fallback: 'magic-link'},
    'unknown EXPO_PUBLIC_AUTH_PROVIDER value; falling back to magic-link',
  )
  return 'magic-link'
}

let cached: AuthProvider | null = null

export function getAuthProvider(): AuthProvider {
  if (cached) return cached
  cached = readEnvFlag() === 'apple' ? siwaProvider : magicLinkProvider
  return cached
}

/** Test-only seam — reset the memoization between tests. */
export function __resetAuthProviderCacheForTests(): void {
  cached = null
}

/**
 * Test-only seam — set the raw env string that `readEnvFlag` reads.
 * Prevents reliance on babel compile-time inlining of EXPO_PUBLIC_*.
 * Pass `null` to restore runtime env reading.
 *
 * No-op in production: naming convention is not a runtime guard, so we
 * explicitly bail out. This prevents a live auth-provider-swap vector.
 */
export function __setEnvOverrideForTests(value: string | null): void {
  if (process.env.NODE_ENV === 'production') {
    return // no-op in production; test seam only
  }
  _testEnvOverride = value
  // Force cache reset so the next getAuthProvider() call re-reads env.
  __resetAuthProviderCacheForTests()
}

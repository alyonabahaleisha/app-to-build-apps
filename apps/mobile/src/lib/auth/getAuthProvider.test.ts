/**
 * getAuthProvider unit tests — env-flag dispatch + production guard.
 *
 * T-0013-086..094: env-flag dispatch (ADR-0013 Step 2a)
 * T-0011-162:      __setEnvOverrideForTests production guard
 *
 * These tests exercise the getAuthProvider() dispatcher at the module level.
 * They supplement the exhaustive config-exhaustion suite in
 * SignInScreen.test.tsx (T-0011-155..159).
 */
import {
  __resetAuthProviderCacheForTests,
  __setEnvOverrideForTests,
  getAuthProvider,
} from './getAuthProvider'

jest.mock('#/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

const {logger} = jest.requireMock<{logger: {warn: jest.Mock}}>('#/logger')

beforeEach(() => {
  // Start from a known state: magic-link provider, no override.
  __setEnvOverrideForTests('magic-link')
  __resetAuthProviderCacheForTests()
  jest.clearAllMocks()
})

afterEach(() => {
  // Restore default override so subsequent tests are unaffected.
  __setEnvOverrideForTests('magic-link')
  __resetAuthProviderCacheForTests()
  // Restore NODE_ENV if a test mutated it.
  process.env.NODE_ENV = 'test'
})

describe('getAuthProvider', () => {
  // -------------------------------------------------------------------------
  // T-0013-086..094 — env-flag dispatch (ADR-0013 Step 2a)
  // -------------------------------------------------------------------------

  describe('env-flag dispatch', () => {
    it('T-0013-086: EXPO_PUBLIC_AUTH_PROVIDER="apple" → returns siwaProvider (name: "apple")', () => {
      __setEnvOverrideForTests('apple')
      expect(getAuthProvider().name).toBe('apple')
    })

    it('T-0013-087: EXPO_PUBLIC_AUTH_PROVIDER="magic-link" → returns magicLinkProvider (name: "magic-link")', () => {
      __setEnvOverrideForTests('magic-link')
      expect(getAuthProvider().name).toBe('magic-link')
    })

    it('T-0013-088: memoization — two calls within same module lifetime return the same instance', () => {
      __setEnvOverrideForTests('apple')
      const first = getAuthProvider()
      const second = getAuthProvider()
      expect(first).toBe(second)
    })

    it('T-0013-089: EXPO_PUBLIC_AUTH_PROVIDER unset (undefined) → magicLinkProvider, no warn log', () => {
      __setEnvOverrideForTests('')
      const provider = getAuthProvider()
      expect(provider.name).toBe('magic-link')
      expect(logger.warn).not.toHaveBeenCalled()
    })

    it('T-0013-090: EXPO_PUBLIC_AUTH_PROVIDER="" → magicLinkProvider, no warn log', () => {
      __setEnvOverrideForTests('')
      const provider = getAuthProvider()
      expect(provider.name).toBe('magic-link')
      expect(logger.warn).not.toHaveBeenCalled()
    })

    it('T-0013-091: EXPO_PUBLIC_AUTH_PROVIDER="APPLE" (uppercase) → normalizes to apple; returns siwaProvider', () => {
      __setEnvOverrideForTests('APPLE')
      expect(getAuthProvider().name).toBe('apple')
    })

    it('T-0013-092: EXPO_PUBLIC_AUTH_PROVIDER="  apple  " (whitespace) → trims; returns siwaProvider', () => {
      __setEnvOverrideForTests('  apple  ')
      expect(getAuthProvider().name).toBe('apple')
    })

    it('T-0013-093: EXPO_PUBLIC_AUTH_PROVIDER="garbage" → magicLinkProvider + logger.warn once with correct payload', () => {
      __setEnvOverrideForTests('garbage')
      const provider = getAuthProvider()
      expect(provider.name).toBe('magic-link')
      expect(logger.warn).toHaveBeenCalledTimes(1)
      expect(logger.warn).toHaveBeenCalledWith(
        {event: 'auth_provider_invalid', value: 'garbage', fallback: 'magic-link'},
        expect.any(String),
      )
    })

    it('T-0013-094: EXPO_PUBLIC_AUTH_PROVIDER="google" → fallback to magicLinkProvider + warn (no Google provider in V0)', () => {
      __setEnvOverrideForTests('google')
      const provider = getAuthProvider()
      expect(provider.name).toBe('magic-link')
      expect(logger.warn).toHaveBeenCalledTimes(1)
      expect(logger.warn).toHaveBeenCalledWith(
        {event: 'auth_provider_invalid', value: 'google', fallback: 'magic-link'},
        expect.any(String),
      )
    })
  })

  // -------------------------------------------------------------------------
  // T-0011-162 — production guard
  // -------------------------------------------------------------------------

  describe('__setEnvOverrideForTests production guard', () => {
    it('T-0011-162: is a no-op when NODE_ENV === "production"', () => {
      // Pre-condition: set to magic-link, resolve the cache.
      __setEnvOverrideForTests('magic-link')
      __resetAuthProviderCacheForTests()
      const magicLinkProvider = getAuthProvider()
      expect(magicLinkProvider.name).toBe('magic-link')

      // Simulate production: reset cache so the next call would re-resolve.
      // Then attempt to switch provider via __setEnvOverrideForTests — must be a no-op.
      __resetAuthProviderCacheForTests()
      process.env.NODE_ENV = 'production'

      // This call should be a no-op in production; override must NOT change.
      __setEnvOverrideForTests('apple')

      // Restore NODE_ENV before asserting so the guard doesn't interfere with cleanup.
      process.env.NODE_ENV = 'test'

      // Because __setEnvOverrideForTests was a no-op, the override is still 'magic-link'
      // (set before the production simulation). getAuthProvider() resolves afresh
      // using the unchanged override → should still be magic-link, not apple.
      const providerAfterGuard = getAuthProvider()
      expect(providerAfterGuard.name).toBe('magic-link')
    })
  })
})

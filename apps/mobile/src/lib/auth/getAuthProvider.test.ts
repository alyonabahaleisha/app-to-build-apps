/**
 * getAuthProvider unit tests — production guard and cache seam coverage.
 *
 * T-0011-162: __setEnvOverrideForTests is a no-op when NODE_ENV === 'production'
 *
 * These tests supplement the exhaustive config-exhaustion suite in
 * SignInScreen.test.tsx (T-0011-155..159) with lower-level assertions about
 * the auth provider dispatcher itself.
 */
import {
  __resetAuthProviderCacheForTests,
  __setEnvOverrideForTests,
  getAuthProvider,
} from './getAuthProvider'

beforeEach(() => {
  // Start from a known state: magic-link provider, no override.
  __setEnvOverrideForTests('magic-link')
  __resetAuthProviderCacheForTests()
})

afterEach(() => {
  // Restore default override so subsequent tests are unaffected.
  __setEnvOverrideForTests('magic-link')
  __resetAuthProviderCacheForTests()
  // Restore NODE_ENV if a test mutated it.
  process.env.NODE_ENV = 'test'
})

describe('getAuthProvider', () => {
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

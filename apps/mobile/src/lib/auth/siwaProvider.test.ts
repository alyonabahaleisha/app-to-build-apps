/**
 * siwaProvider unit tests — ADR-0013 Step 2b + Step 2 T-IDs.
 *
 * Covered T-IDs:
 *   T-0013-095..107  — siwaProvider.signIn() happy path + error mapping
 *   T-0013-134       — whitespace-only givenName/familyName → undefined
 *   T-0013-135       — empty authorizationCode passed through (not coerced)
 *   T-0013-136       — backgrounded mid-flow → AuthCanceledError
 *   T-0013-137       — siwaProvider.name === 'apple'
 *   T-0013-138       — magicLinkProvider.name === 'magic-link' (spot-check)
 *
 * Mock strategy:
 *   - expo-apple-authentication → mockExpoAppleAuthentication (via jest.config.js moduleNameMapper)
 *   - apiFetch (#/lib/api) → jest.mock; tests configure per-case via mockResolvedValue / mockRejectedValue
 *   - logger (#/logger) → jest.mock; tests assert INFO is never called with identityToken
 *
 * `signInAsync` from the mock is a jest.fn(). Tests use jest.mocked() to control
 * its return value per case — no real iOS native module is invoked.
 */
import * as AppleAuthentication from 'expo-apple-authentication'

import {AuthCanceledError, AuthFailedError} from './errors'
import {magicLinkProvider} from './magicLinkProvider'
import {siwaProvider} from './siwaProvider'

// ---------------------------------------------------------------------------
// Module mocks — hoisted by Jest before any import
// ---------------------------------------------------------------------------

jest.mock('#/lib/api', () => ({
  apiFetch: jest.fn(),
  // Define ApiError inline — jest.mock factories cannot reference out-of-scope
  // variables. Using a class expression avoids the hoisting constraint.
  ApiError: class ApiError extends Error {
    readonly status: number
    readonly body: string
    constructor(status: number, body: string) {
      super(`API ${status}`)
      this.name = 'ApiError'
      this.status = status
      this.body = body
    }
  },
  NotAuthenticatedError: class NotAuthenticatedError extends Error {},
  RefreshFailedError: class RefreshFailedError extends Error {},
}))

jest.mock('#/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const {apiFetch, ApiError: MockApiError} = jest.requireMock<{
  apiFetch: jest.Mock
  ApiError: new (status: number, body: string) => Error & {status: number; body: string}
}>('#/lib/api')
const {logger} = jest.requireMock<{logger: {info: jest.Mock; warn: jest.Mock; error: jest.Mock; debug: jest.Mock}}>('#/logger')

/** Canonical happy-path Apple credential fixture. */
function makeCredential(
  overrides: Partial<AppleAuthentication.AppleAuthenticationCredential> = {},
): AppleAuthentication.AppleAuthenticationCredential {
  return {
    user: 'apple-user-001',
    state: null,
    fullName: {
      givenName: 'Jane',
      familyName: 'Doe',
      middleName: null,
      namePrefix: null,
      nameSuffix: null,
      nickname: null,
    },
    email: 'jane@example.com',
    realUserStatus: 1,
    identityToken: 'apple-id-tok',
    authorizationCode: 'apple-code',
    ...overrides,
  }
}

/** Canonical happy-path API response fixture. */
const HAPPY_API_RESPONSE = {
  access_token: 'access-tok-001',
  refresh_token: 'refresh-tok-001',
  expires_in: 3600,
  user: {id: 'user-uuid-001', display_name: 'Jane Doe'},
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks()
  // Reset signInAsync to a known "not configured" state before each test.
  ;(AppleAuthentication.signInAsync as jest.Mock).mockReset()
})

// ---------------------------------------------------------------------------
// T-0013-137: provider name
// ---------------------------------------------------------------------------

describe('siwaProvider', () => {
  describe('name', () => {
    it('T-0013-137: siwaProvider.name === "apple"', () => {
      expect(siwaProvider.name).toBe('apple')
    })
  })

  // -------------------------------------------------------------------------
  // T-0013-095..098 — Happy path
  // -------------------------------------------------------------------------

  describe('signIn() — happy path', () => {
    it('T-0013-095: resolves AuthSignInResult with displayName from givenName + familyName', async () => {
      ;(AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue(makeCredential())
      apiFetch.mockResolvedValue(HAPPY_API_RESPONSE)

      const result = await siwaProvider.signIn()

      expect(result).toEqual({
        accessToken: 'access-tok-001',
        refreshToken: 'refresh-tok-001',
        expiresIn: 3600,
        user: {id: 'user-uuid-001', displayName: 'Jane Doe'},
      })

      // Verify POST body includes displayName: 'Jane Doe'
      expect(apiFetch).toHaveBeenCalledWith(
        '/auth/apple',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"displayName":"Jane Doe"'),
        }),
      )
    })

    it('T-0013-096: givenName only → displayName is givenName with no trailing space', async () => {
      ;(AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue(
        makeCredential({
          fullName: {
            givenName: 'Jane',
            familyName: null,
            middleName: null,
            namePrefix: null,
            nameSuffix: null,
            nickname: null,
          },
        }),
      )
      apiFetch.mockResolvedValue({...HAPPY_API_RESPONSE, user: {id: 'user-uuid-001', display_name: 'Jane'}})

      await siwaProvider.signIn()

      const bodyArg = JSON.parse((apiFetch as jest.Mock).mock.calls[0][1].body as string)
      expect(bodyArg.displayName).toBe('Jane')
      // Explicitly guard against trailing space (T-0013-096)
      expect(bodyArg.displayName).not.toMatch(/\s$/)
    })

    it('T-0013-097: givenName null + familyName null → no displayName in request body', async () => {
      ;(AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue(
        makeCredential({
          fullName: {
            givenName: null,
            familyName: null,
            middleName: null,
            namePrefix: null,
            nameSuffix: null,
            nickname: null,
          },
        }),
      )
      apiFetch.mockResolvedValue({...HAPPY_API_RESPONSE, user: {id: 'user-uuid-001', display_name: null}})

      await siwaProvider.signIn()

      const bodyArg = JSON.parse((apiFetch as jest.Mock).mock.calls[0][1].body as string)
      expect(bodyArg).not.toHaveProperty('displayName')
    })

    it('T-0013-098: authorizationCode null → request body omits authorizationCode', async () => {
      ;(AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue(
        makeCredential({authorizationCode: null}),
      )
      apiFetch.mockResolvedValue(HAPPY_API_RESPONSE)

      await siwaProvider.signIn()

      const bodyArg = JSON.parse((apiFetch as jest.Mock).mock.calls[0][1].body as string)
      expect(bodyArg).not.toHaveProperty('authorizationCode')
    })
  })

  // -------------------------------------------------------------------------
  // T-0013-099..105 — Failure path
  // -------------------------------------------------------------------------

  describe('signIn() — failure path', () => {
    it('T-0013-099: ERR_REQUEST_CANCELED → AuthCanceledError (not AuthFailedError)', async () => {
      const cancelErr = Object.assign(new Error('canceled'), {code: 'ERR_REQUEST_CANCELED'})
      ;(AppleAuthentication.signInAsync as jest.Mock).mockRejectedValue(cancelErr)

      await expect(siwaProvider.signIn()).rejects.toBeInstanceOf(AuthCanceledError)
      await expect(siwaProvider.signIn()).rejects.not.toBeInstanceOf(AuthFailedError)
    })

    it('T-0013-100: ERR_REQUEST_FAILED → AuthFailedError({code: "siwa_native_failed"})', async () => {
      const failErr = Object.assign(new Error('failed'), {code: 'ERR_REQUEST_FAILED'})
      ;(AppleAuthentication.signInAsync as jest.Mock).mockRejectedValue(failErr)

      await expect(siwaProvider.signIn()).rejects.toMatchObject({
        code: 'siwa_native_failed',
      })
      await expect(siwaProvider.signIn()).rejects.toBeInstanceOf(AuthFailedError)
    })

    it('T-0013-101: unstructured Error from signInAsync → AuthFailedError({code: "siwa_native_failed"})', async () => {
      ;(AppleAuthentication.signInAsync as jest.Mock).mockRejectedValue(new Error('random apple error'))

      await expect(siwaProvider.signIn()).rejects.toMatchObject({
        code: 'siwa_native_failed',
      })
    })

    it('T-0013-102: identityToken null → AuthFailedError({code: "siwa_no_identity_token"})', async () => {
      ;(AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue(
        makeCredential({identityToken: null}),
      )

      await expect(siwaProvider.signIn()).rejects.toMatchObject({
        code: 'siwa_no_identity_token',
      })
      // apiFetch must NOT have been called
      expect(apiFetch).not.toHaveBeenCalled()
    })

    it('T-0013-103: 401 from apiFetch → AuthFailedError({code: "siwa_server_rejected"}) with cause', async () => {
      ;(AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue(makeCredential())
      const apiErr = new MockApiError(401, '{"error":"unauthorized"}')
      apiFetch.mockRejectedValue(apiErr)

      const err = await siwaProvider.signIn().catch(e => e)
      expect(err).toBeInstanceOf(AuthFailedError)
      expect(err.code).toBe('siwa_server_rejected')
      expect(err.cause).toBe(apiErr)
    })

    it('T-0013-104: network error from apiFetch → AuthFailedError({code: "siwa_server_rejected"})', async () => {
      ;(AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue(makeCredential())
      apiFetch.mockRejectedValue(new Error('fetch failed'))

      await expect(siwaProvider.signIn()).rejects.toMatchObject({
        code: 'siwa_server_rejected',
      })
    })

    it('T-0013-105: 503 from apiFetch → AuthFailedError({code: "siwa_server_rejected"})', async () => {
      ;(AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue(makeCredential())
      apiFetch.mockRejectedValue(new MockApiError(503, '{"error":"internal"}'))

      await expect(siwaProvider.signIn()).rejects.toMatchObject({
        code: 'siwa_server_rejected',
      })
    })
  })

  // -------------------------------------------------------------------------
  // T-0013-106..107 — Security
  // -------------------------------------------------------------------------

  describe('signIn() — security', () => {
    it('T-0013-106: identityToken is NOT logged at INFO level by siwaProvider.signIn()', async () => {
      ;(AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue(makeCredential())
      apiFetch.mockResolvedValue(HAPPY_API_RESPONSE)

      await siwaProvider.signIn()

      // logger.info must not have been called with the token
      const infoCallArgs = (logger.info as jest.Mock).mock.calls.flat()
      for (const arg of infoCallArgs) {
        const str = typeof arg === 'string' ? arg : JSON.stringify(arg)
        expect(str).not.toContain('apple-id-tok')
      }
    })

    it('T-0013-107: identityToken is sent ONLY in the POST body, never as a query param or header', async () => {
      ;(AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue(makeCredential())
      apiFetch.mockResolvedValue(HAPPY_API_RESPONSE)

      await siwaProvider.signIn()

      const [path, options] = (apiFetch as jest.Mock).mock.calls[0] as [string, RequestInit & {headers?: Record<string, string>}]

      // Token must not appear in the URL path
      expect(path).not.toContain('apple-id-tok')

      // Token must not appear in any header value
      const headers = options.headers ?? {}
      for (const val of Object.values(headers)) {
        expect(val).not.toContain('apple-id-tok')
      }

      // Token MUST appear in the body
      expect(options.body).toContain('apple-id-tok')
    })
  })

  // -------------------------------------------------------------------------
  // T-0013-134 — Boundary: whitespace-only names
  // -------------------------------------------------------------------------

  describe('signIn() — boundary', () => {
    it('T-0013-134: whitespace-only givenName → displayName undefined; request body has no displayName key', async () => {
      ;(AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue(
        makeCredential({
          fullName: {
            givenName: '   ',
            familyName: '   ',
            middleName: null,
            namePrefix: null,
            nameSuffix: null,
            nickname: null,
          },
        }),
      )
      apiFetch.mockResolvedValue({...HAPPY_API_RESPONSE, user: {id: 'user-uuid-001', display_name: null}})

      await siwaProvider.signIn()

      const bodyArg = JSON.parse((apiFetch as jest.Mock).mock.calls[0][1].body as string)
      // Must not have a displayName key at all — not undefined serialized, not '   '
      expect(bodyArg).not.toHaveProperty('displayName')
    })

    it('T-0013-134 (familyName variant): whitespace-only familyName alone → displayName undefined', async () => {
      ;(AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue(
        makeCredential({
          fullName: {
            givenName: null,
            familyName: '   ',
            middleName: null,
            namePrefix: null,
            nameSuffix: null,
            nickname: null,
          },
        }),
      )
      apiFetch.mockResolvedValue({...HAPPY_API_RESPONSE, user: {id: 'user-uuid-001', display_name: null}})

      await siwaProvider.signIn()

      const bodyArg = JSON.parse((apiFetch as jest.Mock).mock.calls[0][1].body as string)
      expect(bodyArg).not.toHaveProperty('displayName')
    })

    it('T-0013-135: empty authorizationCode ("") is passed through to the API, not coerced to undefined', async () => {
      // Apple may return authorizationCode = '' — a documented rare shape.
      // siwaProvider must NOT strip it; the server Zod schema enforces min(1)
      // and rejects with 400. The provider's job is to pass it, not decide.
      ;(AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue(
        makeCredential({authorizationCode: ''}),
      )
      apiFetch.mockResolvedValue(HAPPY_API_RESPONSE)

      // We don't expect this to succeed (server would 400) but siwaProvider
      // itself doesn't throw — it passes the value to apiFetch. We let apiFetch
      // resolve here for isolation; the server-rejection path is T-0013-103.
      await siwaProvider.signIn()

      const bodyArg = JSON.parse((apiFetch as jest.Mock).mock.calls[0][1].body as string)
      // authorizationCode must be present with the empty-string value — NOT absent
      expect(bodyArg).toHaveProperty('authorizationCode', '')
    })
  })

  // -------------------------------------------------------------------------
  // T-0013-136 — App backgrounded mid-flow → AuthCanceledError
  // -------------------------------------------------------------------------

  describe('signIn() — backgrounded mid-flow', () => {
    it('T-0013-136: app backgrounded mid-flow (ERR_REQUEST_CANCELED) → AuthCanceledError, no toast, no error log', async () => {
      // iOS dismisses the Apple consent sheet when the app is backgrounded.
      // expo-apple-authentication maps this to ERR_REQUEST_CANCELED — the same
      // code as user-tapping-Cancel. If a future iOS version uses a different
      // code for backgrounded-dismissal, update both this test and the
      // ERR_REQUEST_CANCELED check in siwaProvider.ts together.
      const backgroundErr = Object.assign(new Error('request canceled'), {
        code: 'ERR_REQUEST_CANCELED',
      })
      ;(AppleAuthentication.signInAsync as jest.Mock).mockRejectedValue(backgroundErr)

      const err = await siwaProvider.signIn().catch(e => e)

      // Must be AuthCanceledError — not AuthFailedError, not a generic Error
      expect(err).toBeInstanceOf(AuthCanceledError)
      expect(err).not.toBeInstanceOf(AuthFailedError)

      // No error must have been logged (silent dismissal — T-0013-110 pattern)
      expect(logger.error as jest.Mock).not.toHaveBeenCalled()

      // apiFetch must not have been called (no token obtained)
      expect(apiFetch).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // displayName mapping from API response
  // -------------------------------------------------------------------------

  describe('signIn() — displayName in AuthSignInResult', () => {
    it('maps display_name from server response to displayName in result', async () => {
      ;(AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue(makeCredential())
      apiFetch.mockResolvedValue({
        access_token: 'tok',
        refresh_token: 'ref',
        expires_in: 3600,
        user: {id: 'uid', display_name: 'Sarah Connor'},
      })

      const result = await siwaProvider.signIn()
      expect(result.user.displayName).toBe('Sarah Connor')
    })

    it('omits displayName from result when server returns display_name null', async () => {
      ;(AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue(makeCredential())
      apiFetch.mockResolvedValue({
        access_token: 'tok',
        refresh_token: 'ref',
        expires_in: 3600,
        user: {id: 'uid', display_name: null},
      })

      const result = await siwaProvider.signIn()
      // displayName should be absent (not null, not undefined as a key)
      expect(result.user).not.toHaveProperty('displayName')
    })

    it('AuthSignInResult.user has no email key (compile-time + runtime guard)', async () => {
      ;(AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue(makeCredential())
      apiFetch.mockResolvedValue(HAPPY_API_RESPONSE)

      const result = await siwaProvider.signIn()

      // Runtime assertion — email must not appear on the result user object
      expect(result.user).not.toHaveProperty('email')

      // Compile-time assertion — if AuthSignInResult.user ever gains an email
      // key, TypeScript will fail here. Roz-approved inverse-extends pattern.
      type ResultUser = typeof result.user
      type _AssertNoEmail = 'email' extends keyof ResultUser ? never : true
      const _check: _AssertNoEmail = true
      void _check // used by type system; not a runtime value
    })
  })
})

// ---------------------------------------------------------------------------
// T-0013-138 — magicLinkProvider.name spot-check (guards against renaming)
// ---------------------------------------------------------------------------

describe('magicLinkProvider', () => {
  it('T-0013-138: magicLinkProvider.name === "magic-link"', () => {
    expect(magicLinkProvider.name).toBe('magic-link')
  })
})

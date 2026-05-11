/**
 * siwaProvider — Sign in with Apple auth provider.
 *
 * Implements the `AuthProvider` interface for the SIWA flow per ADR-0013 Step 2.
 *
 * Flow:
 *   1. Call AppleAuthentication.signInAsync({requestedScopes: [FULL_NAME, EMAIL]})
 *   2. ERR_REQUEST_CANCELED → AuthCanceledError (user dismissed or app backgrounded)
 *   3. Other Apple error    → AuthFailedError('siwa_native_failed')
 *   4. identityToken null   → AuthFailedError('siwa_no_identity_token')
 *   5. POST /auth/apple     → parse camelCase AuthSignInResult from snake_case response
 *   6. Non-2xx / network    → AuthFailedError('siwa_server_rejected')
 *
 * displayName construction (T-0013-096, T-0013-097, T-0013-134):
 *   - Filter null / whitespace-only components, join with space, trim.
 *   - Empty result after filter → undefined (no displayName in POST body).
 *
 * identityToken is NEVER logged (T-0013-106, T-0013-107).
 *
 * The interface and export name must not change — getAuthProvider() and
 * SignInScreen depend on this module by name.
 */
import * as AppleAuthentication from 'expo-apple-authentication'

import {apiFetch} from '#/lib/api'
import {logger} from '#/logger'
import {AuthCanceledError, AuthFailedError} from './errors'
import type {AuthProvider, AuthSignInResult} from './types'

// Server response shape (snake_case) → mapped to AuthSignInResult (camelCase).
// `email` is intentionally absent from the server response per canvas-v0.md §API Contracts.
interface AppleSignInApiResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  user: {
    id: string
    display_name: string | null
  }
}

/**
 * Construct displayName from Apple's fullName credential.
 *
 * Apple emits fullName only on the first sign-in. On subsequent sign-ins
 * fullName is null or has null component fields — both are treated as undefined.
 *
 * Whitespace-only components (e.g. '   ') are treated as absent per T-0013-134.
 * The resulting string is trimmed; if empty, returns undefined.
 */
function buildDisplayName(
  fullName: AppleAuthentication.AppleAuthenticationFullName | null | undefined,
): string | undefined {
  if (!fullName) return undefined
  const parts = [fullName.givenName, fullName.familyName]
    .map(p => p?.trim() ?? '')
    .filter(p => p.length > 0)
  const joined = parts.join(' ').trim()
  return joined.length > 0 ? joined : undefined
}

export const siwaProvider: AuthProvider = {
  name: 'apple',

  async signIn(): Promise<AuthSignInResult> {
    // Step 1: Invoke the native Apple consent sheet.
    let credential: AppleAuthentication.AppleAuthenticationCredential
    try {
      credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      })
    } catch (err) {
      // ERR_REQUEST_CANCELED covers:
      //   - user tapping Cancel on the consent sheet
      //   - app backgrounded mid-flow (iOS auto-dismisses the sheet — T-0013-136)
      // If a future iOS version reports a different code for backgrounded-dismissal,
      // update both this check and T-0013-136's fixture comment together.
      if ((err as {code?: string} | null)?.code === 'ERR_REQUEST_CANCELED') {
        throw new AuthCanceledError()
      }
      throw new AuthFailedError('siwa_native_failed', err)
    }

    // Step 2: Guard against the (rare) null identityToken Apple edge case.
    if (!credential.identityToken) {
      throw new AuthFailedError('siwa_no_identity_token')
    }

    // Step 3: Build POST body. identityToken is never logged — pass to the API
    // only. displayName is constructed from Apple's fullName (first sign-in only).
    // authorizationCode = '' is passed through as-is: the server's Zod schema
    // enforces min(1) and will reject with 400 (T-0013-135).
    const displayName = buildDisplayName(credential.fullName)
    const requestBody: {
      identityToken: string
      authorizationCode?: string
      displayName?: string
    } = {
      identityToken: credential.identityToken,
    }
    if (credential.authorizationCode !== null && credential.authorizationCode !== undefined) {
      requestBody.authorizationCode = credential.authorizationCode
    }
    if (displayName !== undefined) {
      requestBody.displayName = displayName
    }

    // Step 4: POST to /auth/apple. The path is in PUBLIC_PATH_PREFIXES in
    // api.ts so apiFetch does not require an Authorization header here —
    // this is a sign-in call, there is no session yet.
    let apiResponse: AppleSignInApiResponse
    try {
      apiResponse = await apiFetch<AppleSignInApiResponse>('/auth/apple', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {'content-type': 'application/json'},
      })
    } catch (err) {
      // Any non-2xx or network error is mapped to siwa_server_rejected.
      // The caller (SignInScreen) handles specific toasts per AuthFailedError.
      // The cause carries the original error for structured logging at the
      // call site — identityToken is not in err so it is safe to log cause.
      logger.error('siwa_server_rejected', {safeMessage: err})
      throw new AuthFailedError('siwa_server_rejected', err)
    }

    // Step 5: Map snake_case server response → camelCase AuthSignInResult.
    // `email` is intentionally excluded from the response and from this shape
    // per canvas-v0.md §API Contracts (T-0013-106, types.ts comment).
    return {
      accessToken: apiResponse.access_token,
      refreshToken: apiResponse.refresh_token,
      expiresIn: apiResponse.expires_in,
      user: {
        id: apiResponse.user.id,
        ...(apiResponse.user.display_name != null
          ? {displayName: apiResponse.user.display_name}
          : {}),
      },
    }
  },
}

/**
 * Jest mock for expo-apple-authentication.
 *
 * expo-apple-authentication relies on a native iOS module that is not
 * available in the Jest (Node.js) environment. Without this mock every test
 * file that imports siwaProvider — directly or transitively — fails at
 * module-load time with a "native module not available" error.
 *
 * Per ADR-0013 Step 2 AC item 10: this file is registered in
 * jest.config.js `moduleNameMapper` as the stand-in for the real package.
 *
 * Tests that exercise siwaProvider call jest.spyOn / jest.fn() on the
 * exports here at the test level — they never call the real iOS implementation.
 *
 * Only the subset of the package's API surface used by siwaProvider.ts is
 * mocked. If siwaProvider expands its imports, extend this file accordingly.
 *
 * Error codes per Apple's documented error set (and expo-apple-authentication
 * docs). ERR_REQUEST_CANCELED covers both user-tapped-cancel and
 * app-backgrounded-mid-flow (T-0013-136) — iOS dismisses the consent sheet
 * when the app backgrounds, and expo-apple-authentication maps that dismissal
 * to ERR_REQUEST_CANCELED. If a future iOS version uses a different code for
 * backgrounded-dismissal, update this constant and siwaProvider.ts together.
 */

export enum AppleAuthenticationScope {
  FULL_NAME = 0,
  EMAIL = 1,
}

export interface AppleAuthenticationFullName {
  givenName: string | null
  familyName: string | null
  middleName?: string | null
  namePrefix?: string | null
  nameSuffix?: string | null
  nickname?: string | null
}

export interface AppleAuthenticationCredential {
  user: string
  state: string | null
  fullName: AppleAuthenticationFullName | null
  email: string | null
  realUserStatus: number
  identityToken: string | null
  authorizationCode: string | null
}

export interface AppleAuthenticationSignInOptions {
  requestedScopes?: AppleAuthenticationScope[]
  state?: string
  nonce?: string
}

/**
 * Default implementation throws — individual tests override via jest.spyOn or
 * jest.mocked to control the resolved/rejected value.
 */
export const signInAsync = jest.fn<
  Promise<AppleAuthenticationCredential>,
  [AppleAuthenticationSignInOptions?]
>(() => {
  throw new Error(
    'mockExpoAppleAuthentication: signInAsync not configured in this test. ' +
      'Use jest.spyOn(AppleAuthentication, "signInAsync").mockResolvedValue(...) to set up the fixture.',
  )
})

export const isAvailableAsync = jest.fn<Promise<boolean>, []>().mockResolvedValue(true)

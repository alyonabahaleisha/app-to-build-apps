/**
 * Auth provider types — shared between ADR-0011 (shell) and ADR-0013 (SIWA).
 *
 * Per ADR-0013 §Decision 6: the `AuthProvider` interface is the stable surface
 * that `SignInScreen` depends on. `getAuthProvider()` returns an implementation;
 * the screen calls `provider.signIn()` and never touches provider internals.
 *
 * `AuthSignInResult.user.email` is intentionally absent — per canvas-v0.md
 * §API Contracts, raw email must not appear in response bodies. If the app
 * needs it, read from the JWT claim.
 */
export type AuthProviderName = 'magic-link' | 'apple'

export interface AuthSignInResult {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: {id: string; displayName?: string}
}

export interface AuthProvider {
  readonly name: AuthProviderName
  signIn(): Promise<AuthSignInResult>
}

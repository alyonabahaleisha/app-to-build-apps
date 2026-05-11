/**
 * siwaProvider — Sign in with Apple auth provider.
 *
 * STUB — ADR-0013 PR 1 fills in the real implementation.
 *
 * This module surfaces the `AuthProvider` interface shape so `getAuthProvider()`
 * and `SignInScreen` can reference it today. Calling `signIn()` under
 * `EXPO_PUBLIC_AUTH_PROVIDER=apple` before ADR-0013 lands will throw an
 * explicit "not yet implemented" error — surfaced as a toast on the screen
 * per T-0011-148's acceptance (stub throws; screen shows generic error toast).
 *
 * ADR-0013 Step 2 replaces this stub with the real `AppleAuth.signInAsync()`
 * → `POST /auth/apple` flow. The interface and export name must not change.
 */
import {AuthFailedError} from './errors'
import type {AuthProvider, AuthSignInResult} from './types'

export const siwaProvider: AuthProvider = {
  name: 'apple',
  async signIn(): Promise<AuthSignInResult> {
    // ADR-0013 will implement this. Until then, surface a clear error so the
    // screen can show its error toast. Not a silent no-op.
    throw new AuthFailedError(
      'siwa_not_yet_implemented',
      new Error('siwaProvider.signIn() requires ADR-0013 implementation'),
    )
  },
}

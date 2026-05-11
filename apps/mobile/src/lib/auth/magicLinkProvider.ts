/**
 * magicLinkProvider — magic-link email auth provider.
 *
 * `signIn()` returns a Promise that resolves when the user completes the
 * magic-link flow (email entered → link sent → link tapped → token redeemed).
 * It rejects with `AuthCanceledError` if the user closes the sheet, or
 * `AuthFailedError` on network / server errors.
 *
 * Coordination pattern: the provider holds a deferred promise. `SignInScreen`
 * calls `provider.signIn()` which sets the deferred and signals the screen
 * (via the registered `onSignInRequested` callback) to open `EmailEntrySheet`.
 * The sheet calls `magicLinkProvider.resolve()` / `magicLinkProvider.reject()`
 * when the flow completes or is cancelled.
 *
 * Per ADR-0013 §Decision 6: this is an architectural re-frame of M1's
 * inline mutation logic — inner Supabase calls and EmailEntrySheet UI are
 * unchanged. The interface makes magic-link and SIWA interchangeable from
 * the screen's perspective.
 */
import {AuthCanceledError, AuthFailedError} from './errors'
import type {AuthProvider, AuthSignInResult} from './types'

type SignInCallback = () => void
type ResolveCallback = (result: AuthSignInResult) => void
type RejectCallback = (err: AuthCanceledError | AuthFailedError) => void

/**
 * Imperative handle exposed so `EmailEntrySheet` can resolve/reject the
 * in-flight `signIn()` promise without importing React context.
 */
interface MagicLinkProviderHandle extends AuthProvider {
  /**
   * Register a callback that fires when `signIn()` is called. The screen
   * calls this to learn it should open the email sheet.
   */
  setOnSignInRequested(cb: SignInCallback): void
  /** Called by `EmailEntrySheet` on successful token exchange. */
  resolve(result: AuthSignInResult): void
  /** Called by `EmailEntrySheet` on cancel or error. */
  reject(err: AuthCanceledError | AuthFailedError): void
}

let _onSignInRequested: SignInCallback | null = null
let _resolve: ResolveCallback | null = null
let _reject: RejectCallback | null = null

export const magicLinkProvider: MagicLinkProviderHandle = {
  name: 'magic-link',

  signIn(): Promise<AuthSignInResult> {
    return new Promise<AuthSignInResult>((resolve, reject) => {
      _resolve = resolve
      _reject = reject
      if (_onSignInRequested) {
        _onSignInRequested()
      } else {
        // No screen registered — shouldn't happen in production but guard.
        reject(new AuthFailedError('magic_link_no_screen_registered'))
      }
    })
  },

  setOnSignInRequested(cb: SignInCallback): void {
    _onSignInRequested = cb
  },

  resolve(result: AuthSignInResult): void {
    _resolve?.(result)
    _resolve = null
    _reject = null
  },

  reject(err: AuthCanceledError | AuthFailedError): void {
    _reject?.(err)
    _resolve = null
    _reject = null
  },
}

/** Test-only seam — reset the module-level state between tests. */
export function __resetMagicLinkProviderForTests(): void {
  _onSignInRequested = null
  _resolve = null
  _reject = null
}

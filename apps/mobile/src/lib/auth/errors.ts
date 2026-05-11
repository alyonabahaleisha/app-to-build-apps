/**
 * Auth error classes — per ADR-0013 §Decision 6.
 *
 * `AuthCanceledError` — user dismissed the system auth UI (e.g. tapped
 *   "Cancel" on the SIWA sheet or closed the email sheet without completing).
 *   Not a failure; the screen should no-op and stay on Sign-In.
 *
 * `AuthFailedError` — a non-user-initiated failure with a machine-readable
 *   `code` for structured logging. The `cause` carries the original error
 *   if present.
 */
export class AuthCanceledError extends Error {
  readonly name = 'AuthCanceledError'
  constructor() {
    super('AuthCanceledError')
  }
}

export class AuthFailedError extends Error {
  readonly name = 'AuthFailedError'
  readonly code: string
  readonly cause?: unknown

  constructor(code: string, cause?: unknown) {
    super(code)
    this.name = 'AuthFailedError'
    this.code = code
    this.cause = cause
  }
}

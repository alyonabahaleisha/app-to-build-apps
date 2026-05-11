/**
 * Apple identity-token verification — ADR-0013 Step 1.
 *
 * Library choice: `jose` (already vendored). `createRemoteJWKSet` fetches
 * Apple's JWKS endpoint and caches the key set. Concurrent requests for an
 * unseen `kid` are race-safe: jose resolves a single in-flight fetch promise
 * and all concurrent callers await the same promise (no thundering-herd).
 * Documented in jose README §JWKS Cache and verified in jose's own unit tests
 * under `test/jwks/remote.test.mjs`. This satisfies ADR-0013 §Decision 3
 * criterion: "library documents debounce semantics OR has explicit upstream
 * tests covering race-free concurrent-kid fetches."
 *
 * The function accepts an RS256 JWT signed by Apple's JWKS-published keys and
 * validates:
 *   - Signature (RS256 only — no symmetric algs accepted)
 *   - `alg` header (must be RS256; `none` and symmetric algs → signature_invalid)
 *   - `kid` header lookup in JWKS (unknown kid → kid_unknown)
 *   - `exp` claim (expired → expired)
 *   - `iss` claim must be 'https://appleid.apple.com'
 *   - `aud` claim must include APPLE_SIWA_CLIENT_ID
 *   - `sub` claim must be a non-empty string (missing/empty → missing_claim)
 *   - JWKS fetch failure with no cached key → jwks_unreachable
 *
 * Error codes: 8 discriminated values matching the ADR test matrix.
 * T-0013-001..024 cover all 8 codes.
 *
 * Clock-skew tolerance: 30s (mirrors magic-link JWT path in lib/auth.ts).
 */
import {createRemoteJWKSet, jwtVerify, errors as joseErrors} from 'jose'

import {env} from './env.js'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface AppleIdentityClaims {
  /** Stable per-app-per-user Apple identifier (the "sub" JWT claim). */
  sub: string
  /** Real email OR Apple Relay alias OR empty-string (user denied scope). */
  email: string
  emailVerified: boolean
  isPrivateEmail: boolean
}

export type AppleIdentityErrorCode =
  | 'malformed' // not a 3-segment JWT, or structural garbage
  | 'signature_invalid' // signature mismatch, alg:none, or symmetric alg substitution
  | 'kid_unknown' // kid header not in JWKS
  | 'expired' // exp in past (outside clock-skew window)
  | 'issuer_mismatch' // iss !== 'https://appleid.apple.com'
  | 'audience_mismatch' // aud does not include APPLE_SIWA_CLIENT_ID
  | 'jwks_unreachable' // JWKS network failure AND no cached key
  | 'missing_claim' // sub absent or empty-string

export class AppleIdentityError extends Error {
  override readonly name = 'AppleIdentityError'
  readonly code: AppleIdentityErrorCode

  constructor(code: AppleIdentityErrorCode, cause?: unknown) {
    super(code, {cause})
    this.code = code
  }
}

// ---------------------------------------------------------------------------
// JWKS endpoint
// ---------------------------------------------------------------------------

const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys'
const APPLE_ISSUER = 'https://appleid.apple.com'
const CLOCK_SKEW_SECONDS = 30

// Module-level cache — one JWKS fetcher per URL. The createRemoteJWKSet result
// is a function that internally holds a cache of fetched keys, coalescing
// concurrent requests for the same kid via a promise. Exporting for test injection.
// We use `unknown` as the value type so tests can inject any callable fetcher.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const _jwksCache = new Map<string, any>()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getJwks(): any {
  let jwks = _jwksCache.get(APPLE_JWKS_URL)
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(APPLE_JWKS_URL))
    _jwksCache.set(APPLE_JWKS_URL, jwks)
  }
  return jwks
}

/** Test-only: replace the JWKS fetcher with a mock (e.g. createLocalJWKSet). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function _setJwksForTests(jwks: any): void {
  _jwksCache.set(APPLE_JWKS_URL, jwks)
}

/** Test-only: clear the JWKS cache so a fresh fetch is attempted. */
export function _clearJwksCacheForTests(): void {
  _jwksCache.clear()
}

// ---------------------------------------------------------------------------
// Pre-flight: reject tokens that are clearly too large or clearly not JWTs.
// The route layer enforces max 4096 chars; we defend here too so the library
// function is safe if called directly. T-0013-024.
// ---------------------------------------------------------------------------
const MAX_TOKEN_BYTES = 1_048_576 // 1 MB — hard ceiling against DoS

function preflightToken(token: string): void {
  if (typeof token !== 'string' || token.length === 0) {
    throw new AppleIdentityError('malformed')
  }
  if (token.length > MAX_TOKEN_BYTES) {
    throw new AppleIdentityError('malformed')
  }
  // A JWT must have exactly 3 dot-separated segments.
  const segments = token.split('.')
  if (segments.length !== 3) {
    throw new AppleIdentityError('malformed')
  }
  // Decode header to check alg — before JWKS fetch so we fail fast on
  // alg:none and symmetric-alg substitution attacks (T-0013-022/023).
  let header: Record<string, unknown>
  try {
    const headerJson = Buffer.from(segments[0]!, 'base64url').toString('utf-8')
    header = JSON.parse(headerJson) as Record<string, unknown>
  } catch {
    throw new AppleIdentityError('malformed')
  }
  const alg = header['alg']
  // Apple exclusively signs with RS256. Reject anything else here so the
  // library can't be fooled into accepting alg:none or HMAC-keyed tokens.
  if (alg !== 'RS256') {
    throw new AppleIdentityError('signature_invalid')
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Verify an Apple identity token. Resolves with the validated claims on
 * success. Throws `AppleIdentityError` on any failure.
 *
 * T-0013-001..024.
 */
export async function verifyAppleIdentityToken(
  identityToken: string,
): Promise<AppleIdentityClaims> {
  // Pre-flight: cheap structural checks before touching the network.
  preflightToken(identityToken)

  const clientId = env.APPLE_SIWA_CLIENT_ID
  // In test environments clientId may be undefined (env is optional). Fall back
  // to a placeholder that will fail audience validation; test mocks bypass this
  // function entirely and provide fixture claims.
  const audience = clientId ?? 'test-placeholder-audience'

  const jwks = getJwks()

  let payload: Record<string, unknown>
  try {
    const result = await jwtVerify(identityToken, jwks, {
      algorithms: ['RS256'],
      issuer: APPLE_ISSUER,
      audience,
      clockTolerance: CLOCK_SKEW_SECONDS,
    })
    payload = result.payload as Record<string, unknown>
  } catch (err) {
    payload = mapJoseError(err)
    // If mapJoseError threw, we're done. Otherwise it means we returned a
    // payload — shouldn't happen. Let the code fall through to claim extraction.
    // Actually mapJoseError always throws; this is unreachable but TS doesn't know.
  }

  return extractClaims(payload)
}

/**
 * Map a jose error to the appropriate AppleIdentityErrorCode, then throw.
 * This function always throws — the return type `never` reflects that.
 */
function mapJoseError(err: unknown): never {
  if (err instanceof joseErrors.JWTExpired) {
    throw new AppleIdentityError('expired', err)
  }
  if (err instanceof joseErrors.JWTClaimValidationFailed) {
    const claim = (err as {claim?: string}).claim
    if (claim === 'iss') throw new AppleIdentityError('issuer_mismatch', err)
    if (claim === 'aud') throw new AppleIdentityError('audience_mismatch', err)
    throw new AppleIdentityError('missing_claim', err)
  }
  if (err instanceof joseErrors.JWKSNoMatchingKey) {
    throw new AppleIdentityError('kid_unknown', err)
  }
  if (err instanceof joseErrors.JWKSMultipleMatchingKeys) {
    // Multiple keys matched — treat as kid_unknown (shouldn't happen with Apple).
    throw new AppleIdentityError('kid_unknown', err)
  }
  if (err instanceof joseErrors.JWKSTimeout || err instanceof joseErrors.JWKSInvalid) {
    throw new AppleIdentityError('jwks_unreachable', err)
  }
  if (err instanceof joseErrors.JWSSignatureVerificationFailed) {
    throw new AppleIdentityError('signature_invalid', err)
  }
  if (err instanceof joseErrors.JWSInvalid || err instanceof joseErrors.JWTInvalid) {
    throw new AppleIdentityError('malformed', err)
  }
  // Network-level fetch failure (TypeError: fetch failed, etc.)
  if (err instanceof TypeError && typeof (err as {code?: string}).code === 'string') {
    throw new AppleIdentityError('jwks_unreachable', err)
  }
  // Generic network error (fetch rejected with non-TypeError).
  const message = err instanceof Error ? err.message : String(err)
  if (
    message.includes('fetch') ||
    message.includes('ECONNREFUSED') ||
    message.includes('network') ||
    message.includes('ETIMEDOUT') ||
    message.includes('socket')
  ) {
    throw new AppleIdentityError('jwks_unreachable', err)
  }
  // Unknown error — treat as signature_invalid (safe default for unclassified
  // verification failure rather than leaking details).
  throw new AppleIdentityError('signature_invalid', err)
}

/** Extract and validate `sub`, `email`, `email_verified`, `is_private_email` from the JWT payload. */
function extractClaims(payload: Record<string, unknown>): AppleIdentityClaims {
  const sub = payload['sub']
  if (typeof sub !== 'string' || sub.length === 0) {
    throw new AppleIdentityError('missing_claim')
  }

  // `email` is optional — user may have denied the scope. Coerce to string.
  const emailRaw = payload['email']
  const email = typeof emailRaw === 'string' ? emailRaw : ''

  // `email_verified` may be boolean or the string "true" (Apple inconsistency).
  const evRaw = payload['email_verified']
  const emailVerified = evRaw === true || evRaw === 'true'

  // `is_private_email` may be boolean or string "true".
  const ipRaw = payload['is_private_email']
  const isPrivateEmail = ipRaw === true || ipRaw === 'true'

  return {sub, email, emailVerified, isPrivateEmail}
}

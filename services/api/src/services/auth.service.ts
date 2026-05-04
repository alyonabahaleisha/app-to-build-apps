/**
 * Auth service — thin wrapper around the Supabase admin client. Isolates the
 * SDK call so the route handler can stay focused on HTTP concerns and the
 * test surface can mock at one well-known seam.
 *
 * Contract (ADR-0001 §Step 3):
 *  - `issueMagicLink(email)` calls `supabaseAdmin.auth.admin.generateLink({
 *    type: 'magiclink', email})`.
 *  - The generated URL is intentionally NOT returned. We only need confirmation
 *    that Supabase accepted the request and queued the email. T-0001-042
 *    asserts the URL never reaches the client.
 *  - On Supabase failure (network, 5xx, malformed response) — throws. The
 *    route handler maps to 500 `{error: 'internal'}` and logs via
 *    `safeMessage`. T-0001-040 asserts the SDK error message is logged but
 *    never returned in the response body.
 */
import {getSupabaseAdmin} from '../lib/supabase.js'

/**
 * Ask Supabase to send a magic-link email. Resolves on success, rejects on
 * any Supabase failure. Caller is responsible for translating to HTTP.
 */
export async function issueMagicLink(email: string): Promise<void> {
  const client = getSupabaseAdmin()
  const result = await client.auth.admin.generateLink({type: 'magiclink', email})
  // Supabase's `generateLink` returns `{data, error}`. We treat a non-null
  // `error` as a thrown error so the caller's try/catch shape is uniform.
  if (result.error) {
    throw new Error(`supabase.generateLink failed: ${result.error.message}`)
  }
}

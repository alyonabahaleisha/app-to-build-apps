/**
 * Supabase admin client — server-side only, uses the service-role key. Per
 * ARCHITECTURE.md §3, this client is the only path through which we call
 * `auth.admin.generateLink` (used by Step 3's /auth/magic-link route).
 *
 * Lazy-instantiated so importing this module in test environments doesn't
 * require the SUPABASE_* env vars (they're injected by Step 3 route tests
 * via mocking). Step 2 only ships the constructor; Step 3 wires it to a route.
 */
import {createClient, type SupabaseClient} from '@supabase/supabase-js'

import {env} from './env.js'

let _client: SupabaseClient | undefined

/**
 * Returns the singleton Supabase admin client. Reads SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY from env at first call (not at module import) so
 * unit tests can run without those vars set.
 *
 * Throws if either var is missing — non-test envs are validated at server boot
 * via env.ts; this throw is a defensive safety net for misconfigured tests
 * that try to use the client without injecting a mock.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (_client) return _client
  const url = env.SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'getSupabaseAdmin: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required. ' +
        'In tests, mock the consumer rather than calling this directly.',
    )
  }
  _client = createClient(url, key, {
    auth: {
      // Service-role client; we never persist sessions or auto-refresh on the
      // server. Each call to `auth.admin.*` carries its own context.
      persistSession: false,
      autoRefreshToken: false,
    },
  })
  return _client
}

/**
 * Reset the cached client. Test-only escape hatch — production code should
 * never call this.
 */
export function resetSupabaseAdminForTests(): void {
  _client = undefined
}

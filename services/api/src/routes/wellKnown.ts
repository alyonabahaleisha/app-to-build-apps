/**
 * Well-known routes — ADR-0008 Step 2.
 *
 * GET /.well-known/apple-app-site-association
 *   Serves the Apple App Site Association (AASA) file required for Universal
 *   Links on iOS. Content-Type MUST be exactly 'application/json' — Apple's
 *   CDN silently rejects any other type, causing Universal Links to silently
 *   fall back to Safari.
 *
 *   The appID field is sourced from env.APPLE_APP_ID_PREFIX (TEAMID.bundleID).
 *   This lets the CI smoke test verify the deployed value matches the expected
 *   App Store Connect App ID without hard-coding it in source.
 *
 *   - Rate-limit exempt: Apple's CDN polls this route; rate-limiting would
 *     break Universal Links after any surge. T-0008-036 asserts 100 calls/s
 *     still returns 200.
 *   - Public: no auth required (T-0008-027).
 *   - Cache-Control: public, max-age=3600 — Apple respects this; short enough
 *     to allow rapid updates during initial deploy iteration.
 *
 * T-IDs: T-0008-022..037.
 */
import type {FastifyInstance, FastifyPluginAsync} from 'fastify'
import {env} from '../lib/env.js'

export const wellKnownRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.get('/.well-known/apple-app-site-association', async (_req, reply) => {
    // Apple requires Content-Type: application/json exactly (not text/json, not
    // application/octet-stream). T-0008-023.
    reply.header('Content-Type', 'application/json')
    // Apple's CDN respects Cache-Control. 3600s is short enough for rapid
    // first-deploy iteration; bounded well under 86400 (T-0008-037).
    reply.header('Cache-Control', 'public, max-age=3600')

    // T-0008-025: appID sourced from env so CI smoke can verify the deployed value.
    return {
      applinks: {
        apps: [],
        details: [
          {
            // Non-null assertion: env.ts validates APPLE_APP_ID_PREFIX as required
            // in non-test environments at startup. In tests, wellKnown.test.ts
            // mocks env.js directly with a valid value. The fallback has been
            // removed — if the env var is missing in test/dev/staging, the route
            // should fail loudly rather than silently serving a broken AASA file
            // that Apple's CDN would cache. (SECURITY 1 — Roz PR 1 R1)
            appIDs: [env.APPLE_APP_ID_PREFIX!],
            paths: ['/m/*'],
          },
        ],
      },
    }
  })
}

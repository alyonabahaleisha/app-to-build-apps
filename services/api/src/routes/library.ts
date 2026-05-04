/**
 * Library routes — ADR-0002 Step 6.
 *
 *   GET /library?cursor=&limit=  — auth-required. Public project feed,
 *                                   cursor-paginated, ordered by published_at
 *                                   DESC. Rate 120/min/user.
 *
 *   GET /library/:id             — auth-required. Single public project
 *                                   detail + current spec_json. Rate
 *                                   120/min/user.
 *
 * Error contract:
 *   400 invalid_input  — limit out of range, cursor malformed, :id not UUID.
 *   401 unauthorized   — from requireAuth.
 *   404 not_found      — project absent OR private (same shape, don't leak).
 *   429 rate_limited   — caller over per-route-per-user limit.
 *   500 internal       — unhandled; raw message logged via safeMessage.
 *
 * Security notes:
 *   - No email, owner_id in any response (T-0002-118, T-0002-100).
 *   - list: no spec_json, no original_prompt (T-0002-117, T-0002-122).
 *   - detail: no thinking trace, no server prompt content (T-0002-119);
 *     these are never stored so absence is structural.
 *   - Private-project 404 is identical to non-existent 404 (T-0002-106,
 *     T-0002-120 — even if the caller owns the project).
 */
import type {FastifyInstance, FastifyPluginAsync} from 'fastify'
import {z} from 'zod'
import type {NodePgDatabase} from 'drizzle-orm/node-postgres'

import * as schema from '../db/schema.js'
import {requireAuth, type AuthenticatedRequest} from '../lib/auth.js'
import {safeMessage} from '../lib/logger.js'
import {rateLimit} from '../lib/rateLimit.js'
import {
  createLibraryService,
  type LibraryService,
  InvalidCursorError,
} from '../services/library.service.js'

type Db = NodePgDatabase<typeof schema>

// ---------------------------------------------------------------------------
// Query + param schemas
// ---------------------------------------------------------------------------

const LibraryQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const RATE_LIMIT_WINDOW_MS = 60_000
const RL_LIBRARY_LIST = 120
const RL_LIBRARY_DETAIL = 120

// ---------------------------------------------------------------------------
// Route options
// ---------------------------------------------------------------------------

export interface LibraryRoutesOptions {
  /** Injected by tests; production lazy-loads from db/index.ts. */
  db?: Db
  /** Override the service instance (test-only). */
  service?: LibraryService
}

async function resolveService(opts: LibraryRoutesOptions): Promise<LibraryService> {
  if (opts.service) return opts.service
  if (opts.db) return createLibraryService(opts.db)
  const mod = await import('../db/index.js')
  return createLibraryService(mod.getDb())
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export const libraryRoutes: FastifyPluginAsync<LibraryRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: LibraryRoutesOptions,
) => {
  const service = await resolveService(opts)

  // -------------------------------------------------------------------------
  // GET /library  (auth-required, rate 120/min/user)
  // -------------------------------------------------------------------------
  fastify.get('/library', {preHandler: [requireAuth]}, async (req, reply) => {
    const userId = (req as unknown as AuthenticatedRequest).user.id
    const t0 = performance.now()

    // Rate limit
    const rl = rateLimit(`library:${userId}`, RL_LIBRARY_LIST, RATE_LIMIT_WINDOW_MS)
    if (!rl.allowed) {
      reply.header('Retry-After', String(rl.retryAfter))
      return reply.code(429).send({error: 'rate_limited'})
    }

    // Parse query params
    let query: z.infer<typeof LibraryQuerySchema>
    try {
      query = LibraryQuerySchema.parse(req.query)
    } catch {
      return reply.code(400).send({error: 'invalid_input'})
    }

    try {
      const result = await service.list({
        cursor: query.cursor,
        limit: query.limit,
      })

      req.log.info(
        {
          userId,
          action: 'library.list',
          count: result.items.length,
          durationMs: Math.round(performance.now() - t0),
        },
        'library_list',
      )

      return reply.code(200).send({
        items: result.items.map((item) => ({
          id: item.id,
          title: item.title,
          author_handle: item.author_handle,
          published_at: item.published_at.toISOString(),
          render_hash: item.render_hash,
          parent: item.parent,
        })),
        next_cursor: result.next_cursor,
      })
    } catch (err) {
      if (err instanceof InvalidCursorError) {
        return reply.code(400).send({error: 'invalid_input'})
      }
      req.log.error({err: safeMessage(err), userId}, 'library_list_failed')
      return reply.code(500).send({error: 'internal'})
    }
  })

  // -------------------------------------------------------------------------
  // GET /library/:id  (auth-required, rate 120/min/user)
  // -------------------------------------------------------------------------
  fastify.get<{Params: {id: string}}>(
    '/library/:id',
    {preHandler: [requireAuth]},
    async (req, reply) => {
      const userId = (req as unknown as AuthenticatedRequest).user.id
      const projectId = req.params.id
      const t0 = performance.now()

      // UUID validation — mirrors projects.ts pattern
      if (!UUID_REGEX.test(projectId)) {
        return reply.code(400).send({error: 'invalid_input'})
      }

      // Rate limit
      const rl = rateLimit(`libraryDetail:${userId}`, RL_LIBRARY_DETAIL, RATE_LIMIT_WINDOW_MS)
      if (!rl.allowed) {
        reply.header('Retry-After', String(rl.retryAfter))
        return reply.code(429).send({error: 'rate_limited'})
      }

      try {
        const result = await service.get(projectId)

        if (!result) {
          return reply.code(404).send({error: 'not_found'})
        }

        req.log.info(
          {
            userId,
            projectId,
            action: 'library.read',
            durationMs: Math.round(performance.now() - t0),
          },
          'library_read',
        )

        return reply.code(200).send({
          project: {
            id: result.project.id,
            title: result.project.title,
            author_handle: result.project.author_handle,
            published_at: result.project.published_at.toISOString(),
            original_prompt: result.project.original_prompt,
            parent: result.project.parent,
          },
          current_version: {
            id: result.current_version.id,
            spec_json: result.current_version.spec_json,
            render_hash: result.current_version.render_hash,
            created_at: result.current_version.created_at.toISOString(),
          },
        })
      } catch (err) {
        req.log.error({err: safeMessage(err), userId, projectId}, 'library_get_failed')
        return reply.code(500).send({error: 'internal'})
      }
    },
  )
}

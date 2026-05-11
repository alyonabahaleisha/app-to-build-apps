import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import {sql} from 'drizzle-orm'
import Fastify, {type FastifyInstance} from 'fastify'

import {DEV_USER} from './lib/auth.js'
import {env} from './lib/env.js'
import {authRoutes} from './routes/auth.js'
import {generateRoutes} from './routes/generate.js'
import {healthRoutes} from './routes/health.js'
import {libraryRoutes} from './routes/library.js'
import {marketplaceRoutes} from './routes/marketplace.js'
import {outOfScopeRoutes} from './routes/outOfScope.js'
import {projectsRoutes} from './routes/projects.js'

export async function buildServer(): Promise<FastifyInstance> {
  const server = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      base: {service: 'api', env: env.NODE_ENV},
      transport:
        env.NODE_ENV === 'development'
          ? {target: 'pino-pretty', options: {colorize: true, translateTime: 'HH:MM:ss'}}
          : undefined,
    },
    disableRequestLogging: false,
    bodyLimit: 1024 * 1024, // 1 MB — generation specs stay small
  })

  await server.register(helmet)
  await server.register(cors, {origin: true})
  await server.register(healthRoutes)
  await server.register(authRoutes, {prefix: '/auth'})
  await server.register(projectsRoutes)
  await server.register(generateRoutes)
  await server.register(outOfScopeRoutes)
  await server.register(marketplaceRoutes)
  await server.register(libraryRoutes)

  // Dev-only: ensure the bypass user exists so /generate's project insert
  // doesn't violate the owner_id FK. Idempotent.
  if (env.NODE_ENV !== 'production') {
    try {
      const {getDb} = await import('./db/index.js')
      const db = getDb()
      await db.execute(sql`
        INSERT INTO users (id, email)
        VALUES (${DEV_USER.id}, ${DEV_USER.email})
        ON CONFLICT (id) DO NOTHING
      `)
      server.log.info({devUserId: DEV_USER.id}, 'dev_bypass_user_ready')
    } catch (err) {
      server.log.warn({err: String(err)}, 'dev_bypass_user_seed_failed')
    }
  }

  return server
}

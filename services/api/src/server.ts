import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import Fastify, {FastifyInstance} from 'fastify'

import {env} from './lib/env.js'
import {healthRoutes} from './routes/health.js'

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

  return server
}

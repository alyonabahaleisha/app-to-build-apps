import type {FastifyInstance} from 'fastify'

export async function healthRoutes(server: FastifyInstance): Promise<void> {
  server.get('/health', async () => ({status: 'ok', timestamp: new Date().toISOString()}))
}

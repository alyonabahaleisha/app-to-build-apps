import {buildServer} from './server.js'
import {env} from './lib/env.js'

async function main() {
  const server = await buildServer()
  try {
    await server.listen({port: env.PORT, host: '0.0.0.0'})
    server.log.info({port: env.PORT}, 'api listening')
  } catch (err) {
    server.log.error({err}, 'failed to start')
    process.exit(1)
  }
}

main()

import {buildServer} from '../server.js'

describe('GET /health', () => {
  it('responds with status ok', async () => {
    const server = await buildServer()
    const response = await server.inject({method: 'GET', url: '/health'})
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({status: 'ok'})
    await server.close()
  })
})

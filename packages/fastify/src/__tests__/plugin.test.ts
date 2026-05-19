import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { easydocs } from '../index.js'

vi.mock('@easydocs/core', () => ({ capture: vi.fn() }))

const { capture } = await import('@easydocs/core')

async function makeApp() {
  const fastify = Fastify()
  await fastify.register(easydocs)
  fastify.get('/users', () => ({ data: [] }))
  fastify.get('/users/:id', (req) => ({ id: (req.params as { id: string }).id }))
  fastify.post('/users', (req) => req.body)
  await fastify.ready()
  return fastify
}

describe('fastify plugin', () => {
  beforeEach(() => vi.clearAllMocks())

  it('captures method and path', async () => {
    const app = await makeApp()
    await app.inject({ method: 'GET', url: '/users' })
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET', path: '/users', status: 200 }),
      expect.anything()
    )
  })

  it('captures query params', async () => {
    const app = await makeApp()
    await app.inject({ method: 'GET', url: '/users?page=2&limit=10' })
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({ query: { page: '2', limit: '10' } }),
      expect.anything()
    )
  })

  it('captures path params', async () => {
    const app = await makeApp()
    await app.inject({ method: 'GET', url: '/users/42' })
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({ params: { id: '42' } }),
      expect.anything()
    )
  })

  it('captures response body', async () => {
    const app = await makeApp()
    await app.inject({ method: 'GET', url: '/users' })
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({ response: { data: [] } }),
      expect.anything()
    )
  })

  it('captures POST body', async () => {
    const app = await makeApp()
    await app.inject({
      method: 'POST',
      url: '/users',
      headers: { 'content-type': 'application/json' },
      payload: { name: 'Alice' },
    })
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST', body: { name: 'Alice' } }),
      expect.anything()
    )
  })

  it('passes config to capture', async () => {
    const fastify = Fastify()
    await fastify.register(easydocs, { project: 'my-api' })
    fastify.get('/ping', () => ({ ok: true }))
    await fastify.ready()
    await fastify.inject({ method: 'GET', url: '/ping' })
    expect(capture).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ project: 'my-api' }))
  })
})

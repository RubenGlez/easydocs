import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { easydocs } from '../index.js'

vi.mock(import('@easydocs/core'), async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, createCapturer: vi.fn(() => ({ capture: vi.fn() })) }
})

const { createCapturer } = await import('@easydocs/core')

function getCaptureMock() {
  const results = (createCapturer as ReturnType<typeof vi.fn>).mock.results
  return results[results.length - 1].value.capture as ReturnType<typeof vi.fn>
}

async function makeApp(config?: object) {
  const fastify = Fastify()
  await fastify.register(easydocs, config as never)
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
    expect(getCaptureMock()).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET', path: '/users', status: 200 })
    )
  })

  it('captures query params', async () => {
    const app = await makeApp()
    await app.inject({ method: 'GET', url: '/users?page=2&limit=10' })
    expect(getCaptureMock()).toHaveBeenCalledWith(
      expect.objectContaining({ query: { page: '2', limit: '10' } })
    )
  })

  it('captures path params', async () => {
    const app = await makeApp()
    await app.inject({ method: 'GET', url: '/users/42' })
    expect(getCaptureMock()).toHaveBeenCalledWith(
      expect.objectContaining({ params: { id: '42' } })
    )
  })

  it('captures response body', async () => {
    const app = await makeApp()
    await app.inject({ method: 'GET', url: '/users' })
    expect(getCaptureMock()).toHaveBeenCalledWith(
      expect.objectContaining({ response: { data: [] } })
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
    expect(getCaptureMock()).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST', body: { name: 'Alice' } })
    )
  })

  it('passes config to createCapturer', async () => {
    await makeApp({ project: 'my-api' })
    expect(createCapturer).toHaveBeenCalledWith(
      expect.objectContaining({ project: 'my-api' })
    )
  })
})

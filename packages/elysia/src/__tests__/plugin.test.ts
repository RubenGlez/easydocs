import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Elysia } from 'elysia'
import { easydocs } from '../index.js'

vi.mock('@easydocs/core', () => ({ capture: vi.fn() }))

const { capture } = await import('@easydocs/core')

function makeApp() {
  return new Elysia()
    .use(easydocs())
    .get('/users', () => ({ data: [] }))
    .get('/users/:id', ({ params }) => ({ id: params.id }))
    .post('/users', () => ({ created: true }))
}

describe('elysia plugin', () => {
  beforeEach(() => vi.clearAllMocks())

  it('captures method and path', async () => {
    await makeApp().handle(new Request('http://localhost/users'))
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET', path: '/users', status: 200 }),
      undefined
    )
  })

  it('captures query params', async () => {
    await makeApp().handle(new Request('http://localhost/users?page=2&limit=10'))
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({ query: { page: '2', limit: '10' } }),
      undefined
    )
  })

  it('captures path params', async () => {
    await makeApp().handle(new Request('http://localhost/users/42'))
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({ params: { id: '42' } }),
      undefined
    )
  })

  it('captures response body', async () => {
    await makeApp().handle(new Request('http://localhost/users'))
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({ response: { data: [] } }),
      undefined
    )
  })

  it('passes config to capture', async () => {
    const app = new Elysia()
      .use(easydocs({ project: 'my-api' }))
      .get('/ping', () => ({ ok: true }))
    await app.handle(new Request('http://localhost/ping'))
    expect(capture).toHaveBeenCalledWith(expect.anything(), { project: 'my-api' })
  })
})

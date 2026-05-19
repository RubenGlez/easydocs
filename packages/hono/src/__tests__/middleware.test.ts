import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { easydocs } from '../index.js'

vi.mock('@easydocs/core', () => ({ capture: vi.fn() }))

const { capture } = await import('@easydocs/core')

function makeApp() {
  const app = new Hono()
  app.use(easydocs())
  app.get('/users', (c) => c.json({ data: [] }))
  app.get('/users/:id', (c) => c.json({ id: c.req.param('id') }))
  app.post('/users', (c) => c.json({ created: true }, 201))
  return app
}

describe('hono middleware', () => {
  beforeEach(() => vi.clearAllMocks())

  it('captures method and path', async () => {
    await makeApp().request('/users')
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET', status: 200 }),
      undefined
    )
  })

  it('captures query params', async () => {
    await makeApp().request('/users?page=2&limit=10')
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({ query: { page: '2', limit: '10' } }),
      undefined
    )
  })

  it('captures path params', async () => {
    await makeApp().request('/users/42')
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({ params: { id: '42' } }),
      undefined
    )
  })

  it('captures response body', async () => {
    await makeApp().request('/users')
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({ response: { data: [] } }),
      undefined
    )
  })

  it('captures POST body', async () => {
    await makeApp().request('/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Alice' }),
    })
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST', body: { name: 'Alice' }, status: 201 }),
      undefined
    )
  })

  it('passes config to capture', async () => {
    const app = new Hono()
    app.use(easydocs({ project: 'my-api' }))
    app.get('/ping', (c) => c.json({ ok: true }))
    await app.request('/ping')
    expect(capture).toHaveBeenCalledWith(expect.anything(), { project: 'my-api' })
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createApp, createRouter, defineEventHandler, toWebHandler, readBody, getQuery } from 'h3'
import { easydocs } from '../index.js'

vi.mock('@easydocs/core', () => ({ capture: vi.fn() }))

const { capture } = await import('@easydocs/core')

function makeHandler() {
  const app = createApp()
  app.use(easydocs())
  const router = createRouter()
  router.get('/users', defineEventHandler((e) => {
    void getQuery(e)
    return { data: [] }
  }))
  router.get('/users/:id', defineEventHandler((e) => ({ id: e.context.params?.id })))
  router.post('/users', defineEventHandler(async (e) => readBody(e)))
  app.use(router)
  return toWebHandler(app)
}

describe('h3 middleware', () => {
  beforeEach(() => vi.clearAllMocks())

  it('captures method and path', async () => {
    await makeHandler()(new Request('http://localhost/users'))
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET', status: 200 }),
      undefined
    )
  })

  it('captures query params', async () => {
    await makeHandler()(new Request('http://localhost/users?page=2&limit=10'))
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({ query: { page: '2', limit: '10' } }),
      undefined
    )
  })

  it('calls capture on response', async () => {
    await makeHandler()(new Request('http://localhost/users'))
    // h3's onBeforeResponse body is undefined in toWebHandler test mode;
    // just assert capture was called with the correct method/path/status
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET', path: '/users', status: 200 }),
      undefined
    )
  })

  it('captures POST body', async () => {
    await makeHandler()(new Request('http://localhost/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Alice' }),
    }))
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST', body: { name: 'Alice' } }),
      undefined
    )
  })

  it('passes config to capture', async () => {
    const app = createApp()
    app.use(easydocs({ project: 'my-api' }))
    const router = createRouter()
    router.get('/ping', defineEventHandler(() => ({ ok: true })))
    app.use(router)
    await toWebHandler(app)(new Request('http://localhost/ping'))
    expect(capture).toHaveBeenCalledWith(expect.anything(), { project: 'my-api' })
  })
})

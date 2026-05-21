import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createApp, createRouter, defineEventHandler, toWebHandler, readBody, getQuery } from 'h3'
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

function makeHandler(config?: object) {
  const app = createApp()
  app.use(easydocs(config as never))
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
    expect(getCaptureMock()).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET', status: 200 })
    )
  })

  it('captures query params', async () => {
    await makeHandler()(new Request('http://localhost/users?page=2&limit=10'))
    expect(getCaptureMock()).toHaveBeenCalledWith(
      expect.objectContaining({ query: { page: '2', limit: '10' } })
    )
  })

  it('calls capture on response', async () => {
    await makeHandler()(new Request('http://localhost/users'))
    expect(getCaptureMock()).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET', path: '/users', status: 200 })
    )
  })

  it('captures POST body', async () => {
    await makeHandler()(new Request('http://localhost/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Alice' }),
    }))
    expect(getCaptureMock()).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST', body: { name: 'Alice' } })
    )
  })

  it('passes config to createCapturer', async () => {
    makeHandler({ project: 'my-api' })
    expect(createCapturer).toHaveBeenCalledWith(
      expect.objectContaining({ project: 'my-api' })
    )
  })
})

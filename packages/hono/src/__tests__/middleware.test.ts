import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
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

function makeApp(config?: object) {
  const app = new Hono()
  app.use(easydocs(config as never))
  app.get('/users', (c) => c.json({ data: [] }))
  app.get('/users/:id', (c) => c.json({ id: c.req.param('id') }))
  app.post('/users', (c) => c.json({ created: true }, 201))
  return app
}

describe('hono middleware', () => {
  beforeEach(() => vi.clearAllMocks())

  it('captures method and path', async () => {
    await makeApp().request('/users')
    expect(getCaptureMock()).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET', status: 200 })
    )
  })

  it('captures query params', async () => {
    await makeApp().request('/users?page=2&limit=10')
    expect(getCaptureMock()).toHaveBeenCalledWith(
      expect.objectContaining({ query: { page: '2', limit: '10' } })
    )
  })

  it('captures path params', async () => {
    await makeApp().request('/users/42')
    expect(getCaptureMock()).toHaveBeenCalledWith(
      expect.objectContaining({ params: { id: '42' } })
    )
  })

  it('captures response body', async () => {
    await makeApp().request('/users')
    expect(getCaptureMock()).toHaveBeenCalledWith(
      expect.objectContaining({ response: { data: [] } })
    )
  })

  it('captures POST body', async () => {
    await makeApp().request('/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Alice' }),
    })
    expect(getCaptureMock()).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST', body: { name: 'Alice' }, status: 201 })
    )
  })

  it('passes config to createCapturer', async () => {
    makeApp({ project: 'my-api' })
    expect(createCapturer).toHaveBeenCalledWith(
      expect.objectContaining({ project: 'my-api' })
    )
  })
})

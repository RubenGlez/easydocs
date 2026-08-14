import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { easydocs } from '../index.js'

vi.mock(import('@easydocs/core'), async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, createCapturer: vi.fn(() => ({ capture: vi.fn(), flush: vi.fn(async () => {}) })) }
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
  // Reads the body, like any real handler would.
  app.post('/users', async (c) => {
    const input = await c.req
      .json<{ name?: string }>()
      .catch((): { name?: string } => ({}))
    return c.json({ created: true, name: input.name }, 201)
  })
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

  // The handler above ignores the request body, which is what previously
  // masked the bug: a handler that reads it consumes the underlying Request,
  // and the old `c.req.raw.clone()` then threw, recording body: null.
  it('captures POST body when the handler reads it (realistic handler)', async () => {
    const app = new Hono()
    app.use(easydocs())
    app.post('/users', async (c) => {
      const input = await c.req.json<{ name: string }>()
      return c.json({ created: true, name: input.name }, 201)
    })

    await app.request('/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Alice' }),
    })

    expect(getCaptureMock()).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST', body: { name: 'Alice' }, status: 201 })
    )
  })

  // Awaiting .json() on an open stream never resolves, and the middleware
  // awaits before returning — so an SSE route used to hang for the client.
  it('does not buffer a streaming (non-JSON) response', async () => {
    const app = new Hono()
    app.use(easydocs())
    app.get('/events', () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('data: hello\n\n'))
            // A real SSE stream stays open; never close().
          },
        }),
        { headers: { 'content-type': 'text/event-stream' } }
      )
    )

    const res = await Promise.race([
      app.request('/events'),
      new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 1000)),
    ])

    expect(res).not.toBe('timeout')
    expect((res as Response).headers.get('content-type')).toBe('text/event-stream')
    expect(getCaptureMock()).toHaveBeenCalledWith(expect.objectContaining({ response: null }))
  })

  it('passes config to createCapturer', async () => {
    makeApp({ project: 'my-api' })
    expect(createCapturer).toHaveBeenCalledWith(
      expect.objectContaining({ project: 'my-api' })
    )
  })
})

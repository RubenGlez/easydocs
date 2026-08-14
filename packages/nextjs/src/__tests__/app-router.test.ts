import { describe, it, expect, vi, beforeEach } from 'vitest'
import { withEasydocs } from '../index.js'

vi.mock(import('@easydocs/core'), async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    createCapturer: vi.fn(() => ({ capture: vi.fn(), flush: vi.fn(async () => {}) })),
  }
})

const { createCapturer } = await import('@easydocs/core')

// The adapter caches one capturer per distinct config (so a 50-route app opens
// one DB client, not 50), which means createCapturer runs only on the first
// wrap. Latch onto that capturer's mock rather than re-reading mock.results.
let captureMock: ReturnType<typeof vi.fn> | null = null
function getCaptureMock() {
  if (!captureMock) {
    const results = (createCapturer as ReturnType<typeof vi.fn>).mock.results
    captureMock = results[results.length - 1].value.capture as ReturnType<typeof vi.fn>
  }
  return captureMock
}

/** Minimal stand-in for NextRequest — the adapter only uses these members. */
function makeRequest(url: string, init?: RequestInit) {
  const req = new Request(url, init)
  const parsed = new URL(url)
  return Object.assign(req, {
    nextUrl: { pathname: parsed.pathname, searchParams: parsed.searchParams },
  })
}

describe('next.js app router', () => {
  beforeEach(() => captureMock?.mockClear())

  it('captures method, path and response body', async () => {
    const handler = withEasydocs(async () => Response.json({ data: [] }))
    await handler(makeRequest('http://localhost/api/users'))

    expect(getCaptureMock()).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET', path: '/api/users', response: { data: [] }, status: 200 })
    )
  })

  // The handler consumes the request body, which is what every real POST route
  // does. Cloning after the handler ran throws, so the body used to be null.
  it('captures the request body when the handler reads it', async () => {
    const handler = withEasydocs(async (req) => {
      // The adapter's structural NextRequestLike doesn't declare json() because
      // it never calls it; a real route handler does.
      const input = (await (req as unknown as Request).json()) as { name: string }
      return Response.json({ created: true, name: input.name }, { status: 201 })
    })

    await handler(
      makeRequest('http://localhost/api/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Alice' }),
      })
    )

    expect(getCaptureMock()).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST', body: { name: 'Alice' }, status: 201 })
    )
  })

  it('collapses dynamic segments using the route params', async () => {
    const handler = withEasydocs(async () => Response.json({ id: '42' }))
    await handler(makeRequest('http://localhost/api/users/42'), {
      params: Promise.resolve({ id: '42' }),
    })

    expect(getCaptureMock()).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/api/users/{id}', params: { id: '42' } })
    )
  })

  // Awaiting .json() on an open stream never resolves, and the wrapper awaits
  // it before returning the response — so a streaming route would hang.
  it('does not buffer a streaming response', async () => {
    const handler = withEasydocs(
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('data: hello\n\n'))
              // Stays open, like a real SSE route.
            },
          }),
          { headers: { 'content-type': 'text/event-stream' } }
        )
    )

    const result = await Promise.race([
      handler(makeRequest('http://localhost/api/events')),
      new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 1000)),
    ])

    expect(result).not.toBe('timeout')
    expect(getCaptureMock()).toHaveBeenCalledWith(expect.objectContaining({ response: null }))
  })
})

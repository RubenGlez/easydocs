import { describe, it, expect, vi, beforeEach } from 'vitest'
import { withEasydocsPagesHandler } from '../index.js'

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

/**
 * Minimal NextApiRequest/Response stand-ins. In the Pages Router, `req.query`
 * merges dynamic route params with the query string — reproducing that is the
 * whole point of these tests.
 */
function makeReqRes(opts: {
  method?: string
  url: string
  query: Record<string, string | string[]>
  body?: unknown
}) {
  const req = {
    method: opts.method ?? 'GET',
    url: opts.url,
    query: opts.query,
    body: opts.body,
    headers: {} as Record<string, string>,
  }
  const res = {
    statusCode: 200,
    json(_body: unknown) {
      return res
    },
    getHeaders: () => ({}),
  }
  return { req, res }
}

describe('next.js pages router', () => {
  beforeEach(() => captureMock?.mockClear())

  // Without params, /api/users/1 and /api/users/2 became separate endpoint rows
  // — one stored endpoint and one LLM call per id.
  it('collapses dynamic route segments into a template', async () => {
    const handler = withEasydocsPagesHandler(async (_req, res) => {
      res.json({ id: '42' })
    })
    const { req, res } = makeReqRes({ url: '/api/users/42', query: { id: '42' } })

    await handler(req, res)

    expect(getCaptureMock()).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/api/users/{id}', params: { id: '42' } })
    )
  })

  it('keeps query-string values out of the path params', async () => {
    const handler = withEasydocsPagesHandler(async (_req, res) => {
      res.json({ ok: true })
    })
    // `status=users` must not rewrite the /users segment into /{status}.
    const { req, res } = makeReqRes({
      url: '/api/users?status=users',
      query: { status: 'users' },
    })

    await handler(req, res)

    expect(getCaptureMock()).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/api/users', params: {}, query: { status: 'users' } })
    )
  })

  it('separates route params from query params', async () => {
    const handler = withEasydocsPagesHandler(async (_req, res) => {
      res.json({ ok: true })
    })
    const { req, res } = makeReqRes({
      url: '/api/users/42/posts?page=2',
      query: { id: '42', page: '2' },
    })

    await handler(req, res)

    expect(getCaptureMock()).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/api/users/{id}/posts',
        params: { id: '42' },
        query: { page: '2' },
      })
    )
  })
})

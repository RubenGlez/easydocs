import { createCapturer, parseConfig, buildCaptureEvent } from '@easydocs/core'
import type { EasyDocsConfig } from '@easydocs/core'
import type { Context, Next } from 'hono'

// Only `application/json` (and `+json` suffixes) can become a documented schema.
// Checking the header first is also what keeps a streaming response safe: calling
// .json() on an open SSE stream never resolves, and because the middleware awaits
// it before returning, the client would never receive the response at all.
const JSON_CONTENT_TYPE = /^application\/([\w.+-]+\+)?json\b/i

function isJson(headers: Headers): boolean {
  return JSON_CONTENT_TYPE.test(headers.get('content-type') ?? '')
}

export function easydocs(config?: EasyDocsConfig) {
  const parsedConfig = parseConfig(config)
  const capturer = createCapturer(parsedConfig)

  const middleware = async function easydocsMiddleware(c: Context, next: Next) {
    const startedAt = Date.now()
    await next()

    let responseBody: unknown = null
    if (isJson(c.res.headers)) {
      try {
        responseBody = await c.res.clone().json()
      } catch {
        responseBody = null
      }
    }

    // Read through Hono's own body cache (`c.req.json()`), not `c.req.raw.clone()`:
    // once the handler has consumed the body — which every real POST handler
    // does — cloning the raw Request throws "Body is unusable" and the request
    // body was silently recorded as null.
    let requestBody: unknown = null
    if (isJson(c.req.raw.headers)) {
      try {
        requestBody = await c.req.json()
      } catch {
        requestBody = null
      }
    }

    const url = new URL(c.req.url)

    capturer.capture(
      buildCaptureEvent({
        method: c.req.method,
        path: c.req.routePath ?? url.pathname,
        query: Object.fromEntries(url.searchParams.entries()),
        params: c.req.param() as Record<string, unknown>,
        requestBody,
        responseBody,
        status: c.res.status,
        requestHeaders: Object.fromEntries(c.req.raw.headers.entries()),
        responseHeaders: Object.fromEntries(c.res.headers.entries()),
        durationMs: Date.now() - startedAt,
      })
    )
  }

  // Hono has no shutdown hook, so expose flush on the middleware itself:
  // `await mw.flush()` from your own SIGTERM handler keeps a deploy from
  // discarding specs that were still generating.
  return Object.assign(middleware, { flush: () => capturer.flush() })
}

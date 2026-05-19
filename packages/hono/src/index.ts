import { capture, parseConfig, buildCaptureEvent } from '@easydocs/core'
import type { EasyDocsConfig } from '@easydocs/core'
import type { Context, Next } from 'hono'

export function easydocs(config?: EasyDocsConfig) {
  const parsedConfig = parseConfig(config)
  return async function easydocsMiddleware(c: Context, next: Next) {
    const startedAt = Date.now()
    await next()

    let responseBody: unknown = null
    try {
      responseBody = await c.res.clone().json()
    } catch {
      responseBody = null
    }

    let requestBody: unknown = null
    try {
      requestBody = await c.req.raw.clone().json()
    } catch {
      requestBody = null
    }

    const url = new URL(c.req.url)

    capture(
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
      }),
      parsedConfig
    )
  }
}

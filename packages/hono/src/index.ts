import { capture, parseConfig } from '@easydocs/core'
import type { EasyDocsConfig, HttpMethod } from '@easydocs/core'
import type { Context, Next } from 'hono'

export function easydocs(config?: EasyDocsConfig) {
  const parsedConfig = parseConfig(config)
  return async function easydocsMiddleware(c: Context, next: Next) {
    const startedAt = Date.now()
    await next()

    let responseBody: unknown
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
    const routePath = c.req.routePath ?? url.pathname

    capture(
      {
        method: c.req.method as HttpMethod,
        path: routePath,
        query: Object.fromEntries(url.searchParams.entries()),
        params: c.req.param() as Record<string, string>,
        body: requestBody,
        response: responseBody,
        status: c.res.status,
        requestHeaders: Object.fromEntries(c.req.raw.headers.entries()),
        responseHeaders: Object.fromEntries(c.res.headers.entries()),
        durationMs: Date.now() - startedAt,
      },
      parsedConfig
    )
  }
}

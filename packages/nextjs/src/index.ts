import { capture } from '@easydocs/core'
import type { EasyDocsConfig, HttpMethod } from '@easydocs/core'
import type { NextRequest } from 'next/server'
import type { NextApiRequest, NextApiResponse } from 'next'

// ─── App Router ───────────────────────────────────────────────────────────────

type AppRouterContext = { params?: Promise<Record<string, string>> | Record<string, string> }
type AppRouterHandler = (req: NextRequest, ctx?: AppRouterContext) => Promise<Response> | Response

export function withEasydocs(handler: AppRouterHandler, config?: EasyDocsConfig): AppRouterHandler {
  return async (req, ctx) => {
    const startedAt = Date.now()
    const response = await handler(req, ctx)

    let responseBody: unknown = null
    try {
      responseBody = await response.clone().json()
    } catch {
      // non-JSON response — skip body capture
    }

    let resolvedParams: Record<string, string> = {}
    if (ctx?.params) {
      resolvedParams =
        ctx.params instanceof Promise ? await ctx.params : (ctx.params as Record<string, string>)
    }

    let requestBody: unknown = null
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      try {
        requestBody = await req.clone().json()
      } catch {
        // non-JSON body
      }
    }

    capture(
      {
        method: req.method as HttpMethod,
        path: req.nextUrl.pathname,
        query: Object.fromEntries(req.nextUrl.searchParams.entries()),
        params: resolvedParams,
        body: requestBody,
        response: responseBody,
        status: response.status,
        requestHeaders: Object.fromEntries(req.headers.entries()),
        responseHeaders: Object.fromEntries(response.headers.entries()),
        durationMs: Date.now() - startedAt,
      },
      config
    )

    return response
  }
}

// ─── Pages Router ─────────────────────────────────────────────────────────────

type PagesHandler = (req: NextApiRequest, res: NextApiResponse) => void | Promise<void>

export function withEasydocsPagesHandler(
  handler: PagesHandler,
  config?: EasyDocsConfig
): PagesHandler {
  return async (req, res) => {
    const startedAt = Date.now()
    const originalJson = res.json.bind(res)

    res.json = function (body: unknown) {
      capture(
        {
          method: req.method as HttpMethod,
          path: req.url?.split('?')[0] ?? '/',
          query: req.query as Record<string, string>,
          params: {},
          body: req.body,
          response: body,
          status: res.statusCode,
          requestHeaders: req.headers as Record<string, string>,
          responseHeaders: res.getHeaders() as Record<string, string>,
          durationMs: Date.now() - startedAt,
        },
        config
      )
      return originalJson(body)
    }

    await handler(req, res)
  }
}

import { capture, parseConfig, buildCaptureEvent } from '@easydocs/core'
import type { EasyDocsConfig } from '@easydocs/core'

// ─── Local structural types (avoid importing from next at build time) ──────────

interface NextURL {
  pathname: string
  searchParams: URLSearchParams
}

interface NextRequestLike {
  method: string
  nextUrl: NextURL
  headers: Headers
  clone(): { json(): Promise<unknown> }
}

interface NextApiRequestLike {
  method?: string
  url?: string
  query: Record<string, string | string[]>
  body: unknown
  headers: Record<string, string | string[] | undefined>
}

interface NextApiResponseLike {
  statusCode: number
  json: (body: unknown) => NextApiResponseLike
  getHeaders(): Record<string, string | string[] | number | undefined>
}

// ─── App Router ───────────────────────────────────────────────────────────────

type AppRouterContext = { params?: Promise<Record<string, string>> | Record<string, string> }
type AppRouterHandler = (req: NextRequestLike, ctx?: AppRouterContext) => Promise<Response> | Response

export function withEasydocs(handler: AppRouterHandler, config?: EasyDocsConfig): AppRouterHandler {
  const parsedConfig = parseConfig(config)
  return async (req, ctx) => {
    const startedAt = Date.now()
    const response = await handler(req, ctx)

    let responseBody: unknown = null
    try {
      responseBody = await response.clone().json()
    } catch {
      // non-JSON response
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
      buildCaptureEvent({
        method: req.method,
        path: req.nextUrl.pathname,
        query: Object.fromEntries(req.nextUrl.searchParams.entries()),
        params: resolvedParams,
        requestBody,
        responseBody,
        status: response.status,
        requestHeaders: Object.fromEntries(req.headers.entries()),
        responseHeaders: Object.fromEntries(response.headers.entries()),
        durationMs: Date.now() - startedAt,
      }),
      parsedConfig
    )

    return response
  }
}

// ─── Pages Router ─────────────────────────────────────────────────────────────

type PagesHandler = (req: NextApiRequestLike, res: NextApiResponseLike) => void | Promise<void>

export function withEasydocsPagesHandler(
  handler: PagesHandler,
  config?: EasyDocsConfig
): PagesHandler {
  const parsedConfig = parseConfig(config)
  return async (req, res) => {
    const startedAt = Date.now()
    const originalJson = res.json.bind(res)

    res.json = function (body: unknown) {
      capture(
        buildCaptureEvent({
          method: req.method ?? 'GET',
          path: req.url?.split('?')[0] ?? '/',
          query: req.query as Record<string, unknown>,
          requestBody: req.body,
          responseBody: body,
          status: res.statusCode,
          requestHeaders: req.headers as Record<string, unknown>,
          responseHeaders: res.getHeaders() as Record<string, unknown>,
          durationMs: Date.now() - startedAt,
        }),
        parsedConfig
      )
      return originalJson(body)
    }

    await handler(req, res)
  }
}

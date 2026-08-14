import { createCapturer, parseConfig, buildCaptureEvent } from '@easydocs/core'
import type { EasyDocsConfig, Capturer } from '@easydocs/core'

// Every wrapped route handler would otherwise build its own capturer — its own
// queue, its own libsql client, its own no-key warning. Share one per distinct
// config so a 50-route app opens one DB client, not 50.
const capturerCache = new Map<string, Capturer>()
function getCapturer(config?: EasyDocsConfig): Capturer {
  const parsed = parseConfig(config)
  const key = JSON.stringify(parsed)
  let capturer = capturerCache.get(key)
  if (!capturer) {
    capturer = createCapturer(parsed)
    capturerCache.set(key, capturer)
  }
  return capturer
}

/** Flush every cached capturer. Call from an instrumentation shutdown hook. */
export async function flushEasydocs(): Promise<void> {
  await Promise.all([...capturerCache.values()].map((c) => c.flush()))
}

// Only `application/json` (and `+json` suffixes) can become a documented schema.
// The check also guards against streaming routes: awaiting .json() on an open
// stream never resolves, and the wrapper awaits it before returning the
// response, so a streamed route would hang for the client.
const JSON_CONTENT_TYPE = /^application\/([\w.+-]+\+)?json\b/i

function isJson(headers: { get(name: string): string | null }): boolean {
  return JSON_CONTENT_TYPE.test(headers.get('content-type') ?? '')
}

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
  const capturer = getCapturer(config)
  return async (req, ctx) => {
    const startedAt = Date.now()

    // Clone BEFORE running the handler. App Router handlers read the body with
    // `await req.json()`, which consumes it — and cloning a consumed Request
    // throws, so cloning afterwards silently recorded every requestBody as null.
    let requestClone: { json(): Promise<unknown> } | null = null
    if (req.method !== 'GET' && req.method !== 'HEAD' && isJson(req.headers)) {
      try {
        requestClone = req.clone()
      } catch {
        requestClone = null
      }
    }

    const response = await handler(req, ctx)

    let responseBody: unknown = null
    if (isJson(response.headers)) {
      try {
        responseBody = await response.clone().json()
      } catch {
        // malformed JSON body
      }
    }

    let resolvedParams: Record<string, string> = {}
    if (ctx?.params) {
      resolvedParams =
        ctx.params instanceof Promise ? await ctx.params : (ctx.params as Record<string, string>)
    }

    let requestBody: unknown = null
    if (requestClone) {
      try {
        requestBody = await requestClone.json()
      } catch {
        // malformed JSON body
      }
    }

    capturer.capture(
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
      })
    )

    return response
  }
}

// ─── Pages Router ─────────────────────────────────────────────────────────────

type PagesHandler = (req: NextApiRequestLike, res: NextApiResponseLike) => void | Promise<void>

/**
 * Split `req.query` — which merges dynamic route params and the query string —
 * back into just the route params, by removing everything that came from the
 * URL's search string. Without this the Pages Router reports concrete paths, so
 * `/api/users/1` and `/api/users/2` became two endpoint rows (and two LLM calls)
 * instead of one `/api/users/{id}`.
 */
function splitQuery(req: NextApiRequestLike): {
  params: Record<string, unknown>
  query: Record<string, unknown>
} {
  const search = new URLSearchParams((req.url ?? '').split('?')[1] ?? '')
  const searchKeys = new Set(search.keys())
  const params: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(req.query ?? {})) {
    if (searchKeys.has(key)) continue
    // Catch-all segments ([...slug]) arrive as arrays and can't match a single
    // path segment, so they're left alone.
    if (Array.isArray(value)) continue
    params[key] = value
  }
  // Route params were previously documented as query parameters too, because
  // req.query carries both.
  return { params, query: Object.fromEntries(search.entries()) }
}

export function withEasydocsPagesHandler(
  handler: PagesHandler,
  config?: EasyDocsConfig
): PagesHandler {
  const capturer = getCapturer(config)
  return async (req, res) => {
    const startedAt = Date.now()
    const originalJson = res.json.bind(res)
    const { params, query } = splitQuery(req)

    res.json = function (body: unknown) {
      capturer.capture(
        buildCaptureEvent({
          method: req.method ?? 'GET',
          path: req.url?.split('?')[0] ?? '/',
          query,
          params,
          requestBody: req.body,
          responseBody: body,
          status: res.statusCode,
          requestHeaders: req.headers as Record<string, unknown>,
          responseHeaders: res.getHeaders() as Record<string, unknown>,
          durationMs: Date.now() - startedAt,
        })
      )
      return originalJson(body)
    }

    await handler(req, res)
  }
}

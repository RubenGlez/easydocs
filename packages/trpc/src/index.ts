import { createCapturer, parseConfig, buildCaptureEvent } from '@easydocs/core'
import type { EasyDocsConfig } from '@easydocs/core'

/**
 * tRPC error code → HTTP status. tRPC has no REST status of its own, so a failed
 * procedure is documented under the status tRPC itself would have returned over
 * HTTP. Mirrors tRPC's built-in code→status table.
 */
const TRPC_HTTP_STATUS: Record<string, number> = {
  PARSE_ERROR: 400,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  PAYMENT_REQUIRED: 402,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_SUPPORTED: 405,
  TIMEOUT: 408,
  CONFLICT: 409,
  PRECONDITION_FAILED: 412,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  UNPROCESSABLE_CONTENT: 422,
  TOO_MANY_REQUESTS: 429,
  CLIENT_CLOSED_REQUEST: 499,
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
}

/**
 * Query input is mapped onto OpenAPI query parameters, which the capture core
 * flattens to a string map. Object inputs map key-for-key; a primitive or array
 * input surfaces under a single `input` key so it is still documented.
 */
function toQueryRecord(input: unknown): Record<string, unknown> {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    return input as Record<string, unknown>
  }
  return input === undefined ? {} : { input }
}

/**
 * EasyDocs tRPC middleware. Attach it to a base procedure so every procedure
 * built from it is captured:
 *
 * ```ts
 * const base = t.procedure.use(easydocs())
 * ```
 *
 * Queries map to `GET /trpc/<procedure>`, mutations to `POST /trpc/<procedure>`;
 * subscriptions are skipped. Targets tRPC v11 (`opts.getRawInput()` /
 * `opts.next()` returning `{ ok, data, error }`).
 */
export function easydocs(config?: EasyDocsConfig) {
  const parsedConfig = parseConfig(config)
  const capturer = createCapturer(parsedConfig)

  // Typed loosely: tRPC's middleware generics depend on the user's context/meta,
  // which this adapter is deliberately agnostic to.
  return async function easydocsMiddleware(opts: any): Promise<any> {
    // Subscriptions are streaming, not a request/response we can document.
    if (opts.type === 'subscription') return opts.next()

    let rawInput: unknown
    try {
      rawInput = await opts.getRawInput()
    } catch {
      rawInput = undefined
    }

    const startedAt = Date.now()
    const result = await opts.next()
    const durationMs = Date.now() - startedAt

    const isQuery = opts.type === 'query'
    const status = result.ok ? 200 : TRPC_HTTP_STATUS[result.error?.code] ?? 500
    const responseBody = result.ok ? result.data : { message: result.error?.message }

    capturer.capture(
      buildCaptureEvent({
        method: isQuery ? 'GET' : 'POST',
        path: `/trpc/${opts.path}`,
        query: isQuery ? toQueryRecord(rawInput) : undefined,
        requestBody: isQuery ? undefined : rawInput,
        responseBody,
        status,
        durationMs,
      })
    )

    return result
  }
}

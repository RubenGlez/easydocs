import { createCapturer, parseConfig, buildCaptureEvent } from '@easydocs/core'
import type { EasyDocsConfig } from '@easydocs/core'
import { Elysia } from 'elysia'

// Only `application/json` (and `+json` suffixes) can become a documented schema.
// The check also keeps a streamed response safe: awaiting .json() on an open
// stream never resolves, and the hook is awaited before the response is sent.
const JSON_CONTENT_TYPE = /^application\/([\w.+-]+\+)?json\b/i

function isJson(headers: Headers): boolean {
  return JSON_CONTENT_TYPE.test(headers.get('content-type') ?? '')
}

export function easydocs(config?: EasyDocsConfig) {
  const parsedConfig = parseConfig(config)
  const capturer = createCapturer(parsedConfig)
  return new Elysia({ name: '@easydocs/elysia' })
    .onStop(async () => {
      // Drain queued generation so a redeploy doesn't discard in-flight specs.
      await capturer.flush()
    })
    .onAfterHandle(
      { as: 'global' },
      async ({ request, response, set, path, params, query, body }) => {
        let responseBody: unknown = null
        if (response instanceof Response) {
          if (isJson(response.headers)) {
            try {
              responseBody = await response.clone().json()
            } catch {
              // malformed JSON body
            }
          }
        } else {
          responseBody = response
        }

        const status =
          response instanceof Response ? response.status : (set.status as number | undefined) ?? 200

        capturer.capture(
          buildCaptureEvent({
            method: request.method,
            path,
            query: query as Record<string, unknown>,
            params: params as Record<string, unknown>,
            requestBody: body,
            responseBody,
            status,
            requestHeaders: Object.fromEntries(request.headers.entries()),
            responseHeaders:
              response instanceof Response
                ? Object.fromEntries(response.headers.entries())
                : (set.headers as Record<string, unknown>) ?? {},
          })
        )
      }
    )
}

import { createCapturer, parseConfig, buildCaptureEvent } from '@easydocs/core'
import type { EasyDocsConfig } from '@easydocs/core'
import { Elysia } from 'elysia'

export function easydocs(config?: EasyDocsConfig) {
  const parsedConfig = parseConfig(config)
  const capturer = createCapturer(parsedConfig)
  return new Elysia({ name: '@easydocs/elysia' }).onAfterHandle(
    { as: 'global' },
    async ({ request, response, set, path, params, query, body }) => {
      let responseBody: unknown = null
      if (response instanceof Response) {
        try {
          responseBody = await response.clone().json()
        } catch {
          // non-JSON
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

import { capture, parseConfig } from '@easydocs/core'
import type { EasyDocsConfig, HttpMethod } from '@easydocs/core'
import { Elysia } from 'elysia'

export function easydocs(config?: EasyDocsConfig) {
  const parsedConfig = parseConfig(config)
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

      capture(
        {
          method: request.method as HttpMethod,
          path,
          query: query as Record<string, string>,
          params: params as Record<string, string>,
          body,
          response: responseBody,
          status,
          requestHeaders: Object.fromEntries(request.headers.entries()),
          responseHeaders:
            response instanceof Response
              ? Object.fromEntries(response.headers.entries())
              : (set.headers as Record<string, string>) ?? {},
          durationMs: 0,
        },
        parsedConfig
      )
    }
  )
}

import { capture } from '@easydocs/core'
import type { EasyDocsConfig, HttpMethod } from '@easydocs/core'
import {
  defineEventHandler,
  getMethod,
  getRequestURL,
  getQuery,
  readBody,
  getHeaders,
  type EventHandler,
  type H3Event,
} from 'h3'

declare module 'h3' {
  interface H3EventContext {
    _easydocsStart?: number
  }
}

export function easydocs(config?: EasyDocsConfig): EventHandler {
  return defineEventHandler({
    onRequest(event: H3Event) {
      event.context._easydocsStart = Date.now()
    },

    async onBeforeResponse(event: H3Event, response: { body?: unknown }) {
      const url = getRequestURL(event)
      const rawMethod = getMethod(event)

      let requestBody: unknown = null
      if (rawMethod !== 'GET' && rawMethod !== 'HEAD') {
        try {
          requestBody = await readBody(event)
        } catch {
          // non-JSON body
        }
      }

      capture(
        {
          method: rawMethod as HttpMethod,
          path: url.pathname,
          query: getQuery(event) as Record<string, string>,
          params: (event.context.params as Record<string, string>) ?? {},
          body: requestBody,
          response: response.body,
          status: event.node.res.statusCode,
          requestHeaders: getHeaders(event) as Record<string, string>,
          responseHeaders: Object.fromEntries(
            Object.entries(event.node.res.getHeaders()).map(([k, v]) => [k, String(v ?? '')])
          ),
          durationMs: Date.now() - (event.context._easydocsStart ?? Date.now()),
        },
        config
      )
    },

    handler: () => {},
  })
}

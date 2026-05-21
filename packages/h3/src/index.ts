import { createCapturer, parseConfig, buildCaptureEvent } from '@easydocs/core'
import type { EasyDocsConfig } from '@easydocs/core'
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
  const parsedConfig = parseConfig(config)
  const capturer = createCapturer(parsedConfig)
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

      capturer.capture(
        buildCaptureEvent({
          method: rawMethod,
          path: url.pathname,
          query: getQuery(event) as Record<string, unknown>,
          params: event.context.params as Record<string, unknown>,
          requestBody,
          responseBody: response.body,
          status: event.node.res.statusCode,
          requestHeaders: getHeaders(event) as Record<string, unknown>,
          responseHeaders: event.node.res.getHeaders() as Record<string, unknown>,
          durationMs: Date.now() - (event.context._easydocsStart ?? Date.now()),
        })
      )
    },

    handler: () => {},
  })
}

import { capture, parseConfig, buildCaptureEvent, tryParseJson } from '@easydocs/core'
import type { EasyDocsConfig } from '@easydocs/core'
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'

const plugin: FastifyPluginAsync<EasyDocsConfig> = async (fastify, rawConfig) => {
  const config = parseConfig(rawConfig)

  fastify.addHook(
    'onSend',
    async (request: FastifyRequest, reply: FastifyReply, payload: unknown) => {
      const startedAt = (request as unknown as { easydocsStart?: number }).easydocsStart ?? Date.now()

      capture(
        buildCaptureEvent({
          method: request.method,
          path: request.routeOptions?.url ?? request.url.split('?')[0],
          query: request.query as Record<string, unknown>,
          params: request.params as Record<string, unknown>,
          requestBody: request.body,
          responseBody: tryParseJson(payload),
          status: reply.statusCode,
          requestHeaders: request.headers as Record<string, unknown>,
          responseHeaders: reply.getHeaders() as Record<string, unknown>,
          durationMs: Date.now() - startedAt,
        }),
        config
      )

      return payload
    }
  )

  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    ;(request as unknown as { easydocsStart: number }).easydocsStart = Date.now()
  })
}

export const easydocs = fp(plugin, {
  name: 'easydocs',
  fastify: '>=4.0.0',
})

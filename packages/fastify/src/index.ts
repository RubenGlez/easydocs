import { createCapturer, parseConfig, buildCaptureEvent, tryParseJson } from '@easydocs/core'
import type { EasyDocsConfig } from '@easydocs/core'
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'

const plugin: FastifyPluginAsync<EasyDocsConfig> = async (fastify, rawConfig) => {
  const config = parseConfig(rawConfig)
  const capturer = createCapturer(config)

  fastify.addHook(
    'onSend',
    async (request: FastifyRequest, reply: FastifyReply, payload: unknown) => {
      // No matched route means this hit no handler (404s, scanner probes like
      // /wp-login.php). Skip it: capturing would create a junk endpoint row and
      // an LLM call driven by unauthenticated traffic.
      if (!request.routeOptions?.url) return payload

      const startedAt = (request as unknown as { easydocsStart?: number }).easydocsStart ?? Date.now()

      capturer.capture(
        buildCaptureEvent({
          method: request.method,
          path: request.routeOptions.url,
          query: request.query as Record<string, unknown>,
          params: request.params as Record<string, unknown>,
          requestBody: request.body,
          responseBody: tryParseJson(payload),
          status: reply.statusCode,
          requestHeaders: request.headers as Record<string, unknown>,
          responseHeaders: reply.getHeaders() as Record<string, unknown>,
          durationMs: Date.now() - startedAt,
        })
      )

      return payload
    }
  )

  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    ;(request as unknown as { easydocsStart: number }).easydocsStart = Date.now()
  })

  // Drain queued spec generation on shutdown so a deploy doesn't discard specs
  // that were still being generated.
  fastify.addHook('onClose', async () => {
    await capturer.flush()
  })
}

export const easydocs = fp(plugin, {
  name: 'easydocs',
  fastify: '>=4.0.0',
})

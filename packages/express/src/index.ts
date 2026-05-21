import { createCapturer, parseConfig, buildCaptureEvent } from '@easydocs/core'
import type { EasyDocsConfig } from '@easydocs/core'
import type { Request, Response, NextFunction } from 'express'

export function easydocs(config?: EasyDocsConfig) {
  const parsedConfig = parseConfig(config)
  const capturer = createCapturer(parsedConfig)
  return function easydocsMiddleware(req: Request, res: Response, next: NextFunction) {
    const startedAt = Date.now()
    const originalJson = res.json.bind(res)

    res.json = function (body: unknown) {
      capturer.capture(
        buildCaptureEvent({
          method: req.method,
          path: req.route?.path ?? req.path,
          query: req.query as Record<string, unknown>,
          params: req.params,
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

    next()
  }
}

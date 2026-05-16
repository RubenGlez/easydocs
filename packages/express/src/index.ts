import { capture } from '@easydocs/core'
import type { EasyDocsConfig } from '@easydocs/core'
import type { Request, Response, NextFunction } from 'express'

export function easydocs(config?: EasyDocsConfig) {
  return function easydocsMiddleware(req: Request, res: Response, next: NextFunction) {
    const startedAt = Date.now()
    const originalJson = res.json.bind(res)

    res.json = function (body: unknown) {
      capture(
        {
          method: req.method as import('@easydocs/core').HttpMethod,
          path: req.route?.path ?? req.path,
          query: req.query as Record<string, string>,
          params: req.params as Record<string, string>,
          body: req.body,
          response: body,
          status: res.statusCode,
          requestHeaders: req.headers as Record<string, string>,
          responseHeaders: res.getHeaders() as Record<string, string>,
          durationMs: Date.now() - startedAt,
        },
        config
      )
      return originalJson(body)
    }

    next()
  }
}

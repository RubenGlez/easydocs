import { createCapturer, parseConfig, buildCaptureEvent } from '@easydocs/core'
import type { EasyDocsConfig } from '@easydocs/core'
import type { Request, Response, NextFunction } from 'express'

export function easydocs(config?: EasyDocsConfig) {
  const parsedConfig = parseConfig(config)
  const capturer = createCapturer(parsedConfig)

  const middleware = function easydocsMiddleware(req: Request, res: Response, next: NextFunction) {
    const startedAt = Date.now()
    const originalJson = res.json.bind(res)

    res.json = function (body: unknown) {
      // Send the response first, then capture. Building the event and hashing
      // the payload is cheap but not free, and none of it needs to happen before
      // the client gets its bytes.
      const result = originalJson(body)

      capturer.capture(
        buildCaptureEvent({
          method: req.method,
          // req.route.path is relative to the router's mount point; prepend
          // req.baseUrl so a router mounted at /api/v1 keeps its prefix and two
          // routers sharing a relative path don't collide. It can also be a
          // RegExp or an array for pattern routes, which don't concatenate into
          // a usable template — fall back to the concrete path there.
          path: typeof req.route?.path === 'string' ? (req.baseUrl ?? '') + req.route.path : req.path,
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

      return result
    }

    next()
  }

  // Express has no shutdown hook, so expose flush on the middleware itself:
  // `await mw.flush()` from your own SIGTERM handler keeps a deploy from
  // discarding specs that were still generating.
  return Object.assign(middleware, { flush: () => capturer.flush() })
}

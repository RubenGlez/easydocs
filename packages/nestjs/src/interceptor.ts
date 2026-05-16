import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common'
import { Observable, tap } from 'rxjs'
import { capture } from '@easydocs/core'
import type { EasyDocsConfig, HttpMethod } from '@easydocs/core'
import type { Request, Response } from 'express'

export const EASYDOCS_CONFIG = Symbol('EASYDOCS_CONFIG')

@Injectable()
export class EasyDocsInterceptor implements NestInterceptor {
  constructor(@Inject(EASYDOCS_CONFIG) private readonly config: EasyDocsConfig) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startedAt = Date.now()
    const http = context.switchToHttp()
    const req = http.getRequest<Request>()
    const res = http.getResponse<Response>()

    return next.handle().pipe(
      tap((responseBody: unknown) => {
        const routePath =
          (req as unknown as { route?: { path?: string } }).route?.path ?? req.path

        capture(
          {
            method: req.method as HttpMethod,
            path: routePath,
            query: req.query as Record<string, string>,
            params: req.params as Record<string, string>,
            body: req.body,
            response: responseBody,
            status: res.statusCode,
            requestHeaders: req.headers as Record<string, string>,
            responseHeaders: res.getHeaders() as Record<string, string>,
            durationMs: Date.now() - startedAt,
          },
          this.config
        )
      })
    )
  }
}

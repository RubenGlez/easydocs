import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common'
import { Observable, tap } from 'rxjs'
import { buildCaptureEvent } from '@easydocs/core'
import type { Capturer } from '@easydocs/core'

interface HttpRequest {
  method: string
  path: string
  route?: { path?: string }
  query: Record<string, string>
  params: Record<string, string>
  body: unknown
  headers: Record<string, string>
}

interface HttpResponse {
  statusCode: number
  getHeaders(): Record<string, unknown>
}

export const EASYDOCS_CAPTURER = Symbol('EASYDOCS_CAPTURER')

@Injectable()
export class EasyDocsInterceptor implements NestInterceptor {
  constructor(@Inject(EASYDOCS_CAPTURER) private readonly capturer: Capturer) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startedAt = Date.now()
    const http = context.switchToHttp()
    const req = http.getRequest<HttpRequest>()
    const res = http.getResponse<HttpResponse>()

    return next.handle().pipe(
      tap((responseBody: unknown) => {
        this.capturer.capture(
          buildCaptureEvent({
            method: req.method,
            path: req.route?.path ?? req.path,
            query: req.query as Record<string, unknown>,
            params: req.params as Record<string, unknown>,
            requestBody: req.body,
            responseBody,
            status: res.statusCode,
            requestHeaders: req.headers as Record<string, unknown>,
            responseHeaders: res.getHeaders() as Record<string, unknown>,
            durationMs: Date.now() - startedAt,
          })
        )
      })
    )
  }
}

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common'
import { Observable, tap, catchError, throwError } from 'rxjs'
import { buildCaptureEvent } from '@easydocs/core'
import type { Capturer } from '@easydocs/core'

interface HttpRequest {
  method: string
  path: string
  baseUrl?: string
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

/** Pull the HTTP status an exception filter will apply, defaulting to 500. */
function errorStatus(err: unknown): number {
  const getStatus = (err as { getStatus?: () => number })?.getStatus
  if (typeof getStatus === 'function') {
    const status = getStatus.call(err)
    if (Number.isInteger(status)) return status
  }
  return 500
}

/** The body an exception filter will serialize for this exception. */
function errorBody(err: unknown): unknown {
  const getResponse = (err as { getResponse?: () => unknown })?.getResponse
  if (typeof getResponse === 'function') return getResponse.call(err)
  return { message: err instanceof Error ? err.message : 'Internal server error' }
}

@Injectable()
export class EasyDocsInterceptor implements NestInterceptor {
  constructor(@Inject(EASYDOCS_CAPTURER) private readonly capturer: Capturer) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startedAt = Date.now()
    const http = context.switchToHttp()
    const req = http.getRequest<HttpRequest>()
    const res = http.getResponse<HttpResponse>()

    const record = (responseBody: unknown, status: number) => {
      this.capturer.capture(
        buildCaptureEvent({
          method: req.method,
          // route.path is relative to the router's mount; prepend baseUrl so
          // mounted sub-routers keep their prefix (matches the Express adapter).
          path: req.route?.path ? (req.baseUrl ?? '') + req.route.path : req.path,
          query: req.query as Record<string, unknown>,
          params: req.params as Record<string, unknown>,
          requestBody: req.body,
          responseBody,
          status,
          requestHeaders: req.headers as Record<string, unknown>,
          responseHeaders: res.getHeaders() as Record<string, unknown>,
          durationMs: Date.now() - startedAt,
        })
      )
    }

    return next.handle().pipe(
      tap((responseBody: unknown) => record(responseBody, res.statusCode)),
      // tap() only runs on success, so every response produced by an exception
      // filter (401, 404, 422, 500 …) went undocumented. Read the status and
      // body off the exception itself — res.statusCode is still the default here
      // because the filter has not run yet.
      catchError((err: unknown) => {
        record(errorBody(err), errorStatus(err))
        return throwError(() => err)
      })
    )
  }
}

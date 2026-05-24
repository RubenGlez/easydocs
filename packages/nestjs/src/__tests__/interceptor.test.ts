import { describe, it, expect, vi } from 'vitest'
import { of } from 'rxjs'
import { EasyDocsInterceptor } from '../interceptor.js'
import type { Capturer, CaptureEvent } from '@easydocs/core'

function makeCapturer() {
  const capture = vi.fn<(event: CaptureEvent) => void>()
  return { capture } satisfies Capturer
}

function makeContext(overrides: {
  method?: string
  path?: string
  query?: Record<string, string>
  params?: Record<string, string>
  body?: unknown
  routePath?: string
}) {
  const req = {
    method: overrides.method ?? 'GET',
    path: overrides.path ?? '/users',
    route: overrides.routePath ? { path: overrides.routePath } : undefined,
    query: overrides.query ?? {},
    params: overrides.params ?? {},
    body: overrides.body ?? null,
    headers: { 'content-type': 'application/json' },
  }
  const res = {
    statusCode: 200,
    getHeaders: () => ({ 'content-type': 'application/json' }),
  }
  return {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
  }
}

describe('EasyDocsInterceptor', () => {
  it('captures method and path', () => {
    const capturer = makeCapturer()
    const interceptor = new EasyDocsInterceptor(capturer)
    const ctx = makeContext({ method: 'GET', path: '/users', routePath: '/users' })
    const handler = { handle: () => of({ data: [] }) }

    return new Promise<void>((resolve) => {
      interceptor.intercept(ctx as never, handler).subscribe(() => {
        expect(capturer.capture).toHaveBeenCalledWith(
          expect.objectContaining({ method: 'GET', path: '/users', status: 200 })
        )
        resolve()
      })
    })
  })

  it('captures query and body', () => {
    const capturer = makeCapturer()
    const interceptor = new EasyDocsInterceptor(capturer)
    const ctx = makeContext({ query: { page: '1' }, body: { name: 'Alice' } })
    const handler = { handle: () => of({ id: 1 }) }

    return new Promise<void>((resolve) => {
      interceptor.intercept(ctx as never, handler).subscribe(() => {
        expect(capturer.capture).toHaveBeenCalledWith(
          expect.objectContaining({ query: { page: '1' }, body: { name: 'Alice' } })
        )
        resolve()
      })
    })
  })

  it('uses route path over req.path', () => {
    const capturer = makeCapturer()
    const interceptor = new EasyDocsInterceptor(capturer)
    const ctx = makeContext({ path: '/users/42', routePath: '/users/:id' })
    const handler = { handle: () => of({}) }

    return new Promise<void>((resolve) => {
      interceptor.intercept(ctx as never, handler).subscribe(() => {
        expect(capturer.capture).toHaveBeenCalledWith(
          expect.objectContaining({ path: '/users/:id' })
        )
        resolve()
      })
    })
  })
})

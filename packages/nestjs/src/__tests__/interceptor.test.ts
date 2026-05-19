import { describe, it, expect, vi, beforeEach } from 'vitest'
import { of } from 'rxjs'
import { EasyDocsInterceptor } from '../interceptor.js'

vi.mock(import('@easydocs/core'), async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, capture: vi.fn() }
})

import { capture } from '@easydocs/core'

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
  beforeEach(() => vi.clearAllMocks())

  it('captures method and path', () => {
    const interceptor = new EasyDocsInterceptor({})
    const ctx = makeContext({ method: 'GET', path: '/users', routePath: '/users' })
    const handler = { handle: () => of({ data: [] }) }

    return new Promise<void>((resolve) => {
      interceptor.intercept(ctx as never, handler).subscribe(() => {
        expect(capture).toHaveBeenCalledWith(
          expect.objectContaining({ method: 'GET', path: '/users', status: 200 }),
          {}
        )
        resolve()
      })
    })
  })

  it('captures query and body', () => {
    const interceptor = new EasyDocsInterceptor({})
    const ctx = makeContext({ query: { page: '1' }, body: { name: 'Alice' } })
    const handler = { handle: () => of({ id: 1 }) }

    return new Promise<void>((resolve) => {
      interceptor.intercept(ctx as never, handler).subscribe(() => {
        expect(capture).toHaveBeenCalledWith(
          expect.objectContaining({ query: { page: '1' }, body: { name: 'Alice' } }),
          {}
        )
        resolve()
      })
    })
  })

  it('uses route path over req.path', () => {
    const interceptor = new EasyDocsInterceptor({})
    const ctx = makeContext({ path: '/users/42', routePath: '/users/:id' })
    const handler = { handle: () => of({}) }

    return new Promise<void>((resolve) => {
      interceptor.intercept(ctx as never, handler).subscribe(() => {
        expect(capture).toHaveBeenCalledWith(
          expect.objectContaining({ path: '/users/:id' }),
          {}
        )
        resolve()
      })
    })
  })

  it('passes config to capture', () => {
    const interceptor = new EasyDocsInterceptor({ project: 'my-api' })
    const ctx = makeContext({})
    const handler = { handle: () => of({}) }

    return new Promise<void>((resolve) => {
      interceptor.intercept(ctx as never, handler).subscribe(() => {
        expect(capture).toHaveBeenCalledWith(expect.anything(), { project: 'my-api' })
        resolve()
      })
    })
  })
})

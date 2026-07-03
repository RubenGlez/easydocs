import { describe, it, expect } from 'vitest'
import { normalizePath, toOpenApiPath } from '../path.js'
import { buildCaptureEvent } from '../event.js'

describe('normalizePath', () => {
  it('converts ":name" template segments to "{name}"', () => {
    expect(normalizePath('/users/:id')).toBe('/users/{id}')
    expect(normalizePath('/repos/:owner/:repo/issues')).toBe('/repos/{owner}/{repo}/issues')
  })

  it('keeps existing "{name}" segments untouched (idempotent)', () => {
    expect(normalizePath('/users/{id}')).toBe('/users/{id}')
    expect(normalizePath(normalizePath('/users/:id'))).toBe('/users/{id}')
  })

  it('templatizes concrete URLs using resolved path params', () => {
    expect(normalizePath('/users/123', { id: '123' })).toBe('/users/{id}')
    expect(normalizePath('/users/456', { id: '456' })).toBe('/users/{id}')
    expect(normalizePath('/repos/acme/core/issues', { owner: 'acme', repo: 'core' })).toBe(
      '/repos/{owner}/{repo}/issues'
    )
  })

  it('matches url-encoded segments against decoded param values (PII in path)', () => {
    expect(normalizePath('/users/alice%40example.com', { id: 'alice@example.com' })).toBe(
      '/users/{id}'
    )
  })

  it('only rewrites segments that exactly equal a param value', () => {
    // param value "1" must not rewrite the unrelated "/v1/" version segment
    expect(normalizePath('/v1/items/1', { id: '1' })).toBe('/v1/items/{id}')
  })

  it('leaves concrete segments alone when no params are provided (proxy case)', () => {
    expect(normalizePath('/users/123')).toBe('/users/123')
  })
})

describe('toOpenApiPath', () => {
  it('rewrites legacy ":id" stored paths to "{id}"', () => {
    expect(toOpenApiPath('/api/v1/users/:id')).toBe('/api/v1/users/{id}')
  })
})

describe('buildCaptureEvent path normalization', () => {
  it('normalizes the path via resolved params (h3/elysia/next case)', () => {
    const event = buildCaptureEvent({
      method: 'get',
      path: '/users/123',
      params: { id: '123' },
      status: 200,
    })
    expect(event.path).toBe('/users/{id}')
  })
})

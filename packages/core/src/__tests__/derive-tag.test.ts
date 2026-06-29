import { describe, it, expect } from 'vitest'
import { deriveTag } from '../spec/builder.js'

describe('deriveTag', () => {
  it('uses the first static path segment', () => {
    expect(deriveTag('/users')).toBe('users')
    expect(deriveTag('/users/:id')).toBe('users')
    expect(deriveTag('/auth/login')).toBe('auth')
  })

  it('skips api and version prefixes', () => {
    expect(deriveTag('/api/users')).toBe('users')
    expect(deriveTag('/api/v1/users/:id')).toBe('users')
    expect(deriveTag('/v2/repos')).toBe('repos')
  })

  it('keeps a resource-less path segment like /me', () => {
    expect(deriveTag('/me')).toBe('me')
  })

  it('skips leading path params and brace-style params', () => {
    expect(deriveTag('/:id')).toBe('default')
    expect(deriveTag('/repos/{owner}/{repo}/issues')).toBe('repos')
  })

  it('falls back to "default" when there is no static segment', () => {
    expect(deriveTag('/')).toBe('default')
  })
})

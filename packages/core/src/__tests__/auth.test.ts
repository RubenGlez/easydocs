import { describe, it, expect } from 'vitest'
import { detectAuthSchemes, VALID_SCHEME_NAMES, SECURITY_SCHEME_DEFS } from '../spec/auth.js'

describe('detectAuthSchemes', () => {
  it('detects bearer token', () => {
    expect(detectAuthSchemes({ authorization: 'Bearer abc123' }, {})).toEqual(['bearerAuth'])
  })

  it('detects basic auth', () => {
    expect(detectAuthSchemes({ authorization: 'Basic dXNlcjpwYXNz' }, {})).toEqual(['basicAuth'])
  })

  it('returns nothing for unknown auth header scheme', () => {
    expect(detectAuthSchemes({ authorization: 'CustomScheme token' }, {})).toEqual([])
  })

  it('detects x-api-key header', () => {
    expect(detectAuthSchemes({ 'x-api-key': 'my-key' }, {})).toEqual(['apiKeyHeader'])
  })

  it('detects api-key header', () => {
    expect(detectAuthSchemes({ 'api-key': 'my-key' }, {})).toEqual(['apiKeyHeader'])
  })

  it('detects api_key query param', () => {
    expect(detectAuthSchemes({}, { api_key: 'abc' })).toEqual(['apiKeyQuery'])
  })

  it('detects apikey query param', () => {
    expect(detectAuthSchemes({}, { apikey: 'abc' })).toEqual(['apiKeyQuery'])
  })

  it('detects key query param', () => {
    expect(detectAuthSchemes({}, { key: 'abc' })).toEqual(['apiKeyQuery'])
  })

  it('detects cookie auth when no other schemes present', () => {
    expect(detectAuthSchemes({ cookie: 'session=abc' }, {})).toEqual(['cookieAuth'])
  })

  it('suppresses cookie auth when bearer is also present', () => {
    expect(detectAuthSchemes({ authorization: 'Bearer tok', cookie: 'session=abc' }, {})).toEqual(['bearerAuth'])
  })

  it('is case-insensitive for header keys', () => {
    expect(detectAuthSchemes({ Authorization: 'Bearer tok' }, {})).toEqual(['bearerAuth'])
  })

  it('deduplicates when the same scheme appears via multiple paths', () => {
    const result = detectAuthSchemes({ 'x-api-key': 'a', 'api-key': 'b' }, {})
    expect(result).toEqual(['apiKeyHeader'])
  })

  it('returns multiple schemes when both bearer and api-key are present', () => {
    const result = detectAuthSchemes({ authorization: 'Bearer tok', 'x-api-key': 'k' }, {})
    expect(result).toEqual(['bearerAuth', 'apiKeyHeader'])
  })

  it('returns empty array when no auth signals present', () => {
    expect(detectAuthSchemes({ 'content-type': 'application/json' }, {})).toEqual([])
  })
})

describe('VALID_SCHEME_NAMES', () => {
  it('contains exactly the keys defined in SECURITY_SCHEME_DEFS', () => {
    expect(VALID_SCHEME_NAMES.sort()).toEqual(Object.keys(SECURITY_SCHEME_DEFS).sort())
  })
})

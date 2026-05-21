export type AuthSchemeName = 'bearerAuth' | 'basicAuth' | 'apiKeyHeader' | 'apiKeyQuery' | 'cookieAuth'

export const SECURITY_SCHEME_DEFS: Record<AuthSchemeName, unknown> = {
  bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
  basicAuth: { type: 'http', scheme: 'basic' },
  apiKeyHeader: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
  apiKeyQuery: { type: 'apiKey', in: 'query', name: 'api_key' },
  cookieAuth: { type: 'apiKey', in: 'cookie', name: 'session' },
}

export const VALID_SCHEME_NAMES = Object.keys(SECURITY_SCHEME_DEFS) as AuthSchemeName[]

export function isAuthSchemeName(name: string): name is AuthSchemeName {
  return name in SECURITY_SCHEME_DEFS
}

export function detectAuthSchemes(
  headers: Record<string, string>,
  query: Record<string, string>
): AuthSchemeName[] {
  const h = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]))
  const q = Object.fromEntries(Object.entries(query).map(([k, v]) => [k.toLowerCase(), v]))
  const schemes: AuthSchemeName[] = []

  const auth = h['authorization']
  if (auth) {
    if (/^bearer /i.test(auth)) schemes.push('bearerAuth')
    else if (/^basic /i.test(auth)) schemes.push('basicAuth')
    // unknown auth header — let the AI determine the scheme
  }

  if (h['x-api-key'] ?? h['api-key']) schemes.push('apiKeyHeader')
  if (q['api_key'] ?? q['apikey'] ?? q['key']) schemes.push('apiKeyQuery')

  // Cookie auth only when nothing else is present
  if (schemes.length === 0 && h['cookie']) schemes.push('cookieAuth')

  return [...new Set(schemes)]
}

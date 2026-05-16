import { generateObject } from 'ai'
import { resolveModel } from '../ai/provider.js'
import { OperationSchema } from './schema.js'
import type { CaptureEvent, AIConfig } from '../types.js'

function trimResponse(response: unknown, maxItems = 1): unknown {
  if (Array.isArray(response)) return response.slice(0, maxItems)
  if (response && typeof response === 'object') {
    return Object.fromEntries(
      Object.entries(response as Record<string, unknown>).map(([k, v]) => [k, trimResponse(v)])
    )
  }
  return response
}

function detectAuthSchemes(
  headers: Record<string, string>,
  query: Record<string, string>
): string[] {
  const h = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]))
  const q = Object.fromEntries(Object.entries(query).map(([k, v]) => [k.toLowerCase(), v]))
  const schemes: string[] = []

  const auth = h['authorization']
  if (auth) {
    if (/^bearer /i.test(auth)) schemes.push('bearerAuth')
    else if (/^basic /i.test(auth)) schemes.push('basicAuth')
    else schemes.push('bearerAuth') // unknown auth header, treat as bearer
  }

  if (h['x-api-key'] ?? h['api-key']) schemes.push('apiKeyHeader')
  if (q['api_key'] ?? q['apikey'] ?? q['key']) schemes.push('apiKeyQuery')

  // Cookie auth only when nothing else is present
  if (schemes.length === 0 && h['cookie']) schemes.push('cookieAuth')

  return [...new Set(schemes)]
}

export async function buildOperation(
  event: CaptureEvent,
  existingSpec: unknown | null,
  aiConfig?: AIConfig
) {
  const model = resolveModel(aiConfig)
  const trimmedResponse = trimResponse(event.response)
  const detectedAuth = detectAuthSchemes(event.requestHeaders, event.query)

  const authGuideline =
    detectedAuth.length > 0
      ? `- This request uses authentication. Detected scheme(s): ${detectedAuth.join(', ')}. ` +
        `Set the security field to reference these scheme name(s), e.g. [{ "bearerAuth": [] }].`
      : '- No authentication headers detected. Leave security as undefined unless the existing spec already documents it.'

  const { object } = await generateObject({
    model,
    schema: OperationSchema,
    system: [
      'You are an OpenAPI 3.0 expert. Generate or update an Operation Object based on the captured HTTP request/response.',
      'Rules:',
      '- responses keys MUST be HTTP status code strings e.g. "200", "404"',
      '- infer the tag from the first meaningful path segment, e.g. /api/v1/users/:id → "users"',
      '- omit requestBody entirely for GET/HEAD/DELETE requests with no body',
      '- if a current spec is provided, update it rather than replacing it — preserve documented fields',
      '- write concise but useful summaries and descriptions',
      authGuideline,
      '- valid security scheme names: bearerAuth, basicAuth, apiKeyHeader, apiKeyQuery, cookieAuth',
    ].join('\n'),
    prompt: [
      `Method: ${event.method}`,
      `Path: ${event.path}`,
      `Query params: ${JSON.stringify(event.query)}`,
      `Path params: ${JSON.stringify(event.params)}`,
      `Request body: ${event.body ? JSON.stringify(event.body) : 'none'}`,
      `Response status: ${event.status}`,
      `Response body: ${JSON.stringify(trimmedResponse)}`,
      detectedAuth.length > 0 ? `Detected auth: ${detectedAuth.join(', ')}` : '',
      existingSpec ? `Current spec (update this): ${JSON.stringify(existingSpec)}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  })

  return object
}

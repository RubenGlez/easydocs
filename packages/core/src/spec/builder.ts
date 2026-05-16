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

export async function buildOperation(
  event: CaptureEvent,
  existingSpec: unknown | null,
  aiConfig?: AIConfig
) {
  const model = resolveModel(aiConfig)
  const trimmedResponse = trimResponse(event.response)

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
    ].join('\n'),
    prompt: [
      `Method: ${event.method}`,
      `Path: ${event.path}`,
      `Query params: ${JSON.stringify(event.query)}`,
      `Path params: ${JSON.stringify(event.params)}`,
      `Request body: ${event.body ? JSON.stringify(event.body) : 'none'}`,
      `Response status: ${event.status}`,
      `Response body: ${JSON.stringify(trimmedResponse)}`,
      existingSpec ? `Current spec (update this): ${JSON.stringify(existingSpec)}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  })

  return object
}

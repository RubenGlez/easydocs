import { generateText } from 'ai'
import { resolveModel } from '../ai/provider.js'
import { OperationSchema } from './schema.js'
import type { Operation } from './schema.js'
import { detectAuthSchemes, VALID_SCHEME_NAMES } from './auth.js'
import type { CaptureEvent, AIConfig } from '../types.js'

const VERSION_PREFIX = /^v\d+$/i

/**
 * Derive the OpenAPI tag from the request path: the first static (non-param,
 * non-version) segment, e.g. /api/v1/users/:id → "users", /me → "me",
 * /repos/:owner/:repo/issues → "repos". Computed here rather than asked of the
 * model, so the tag is deterministic and free of run-to-run LLM variance.
 */
export function deriveTag(path: string): string {
  for (const seg of path.split('/').filter(Boolean)) {
    if (seg.startsWith(':') || seg.startsWith('{')) continue
    if (seg.toLowerCase() === 'api' || VERSION_PREFIX.test(seg)) continue
    return seg
  }
  return 'default'
}

function trimResponse(response: unknown, maxItems = 1): unknown {
  if (Array.isArray(response)) return response.slice(0, maxItems)
  if (response && typeof response === 'object') {
    return Object.fromEntries(
      Object.entries(response as Record<string, unknown>).map(([k, v]) => [k, trimResponse(v)])
    )
  }
  return response
}

/** Pull a JSON object out of a model's text reply, tolerating markdown fences and prose. */
function extractJson(text: string): unknown {
  let t = text.trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) t = fence[1].trim()
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) {
    throw new Error('no JSON object found in model output')
  }
  return JSON.parse(t.slice(start, end + 1))
}

const MAX_ATTEMPTS = 3

export async function buildOperation(
  event: CaptureEvent,
  existingSpec: unknown | null,
  aiConfig?: AIConfig
): Promise<Operation> {
  const model = resolveModel(aiConfig)
  const trimmedResponse = trimResponse(event.response)
  const detectedAuth = detectAuthSchemes(event.requestHeaders, event.query)

  const authGuideline =
    detectedAuth.length > 0
      ? `- This request uses authentication. Detected scheme(s): ${detectedAuth.join(', ')}. ` +
        `Set the security field to reference these scheme name(s), e.g. [{ "bearerAuth": [] }].`
      : '- No authentication headers detected. Leave security as undefined unless the existing spec already documents it.'

  // We generate via plain text + JSON parsing rather than the AI SDK's
  // structured-output mode: OpenAPI schema objects are open-ended JSON Schema
  // (z.record(z.any())), which strict structured-output APIs (OpenAI strict,
  // Anthropic's native structured outputs) reject. Freeform text works on every
  // provider; we validate the result against OperationSchema ourselves and retry.
  const system = [
    'You are an OpenAPI 3.0 expert. Generate or update an Operation Object based on the captured HTTP request/response.',
    'Rules:',
    '- responses keys MUST be HTTP status code strings e.g. "200", "404"',
    `- only document the status code actually observed in this capture (${event.status}); do not invent additional response codes (e.g. 400, 401) that were not observed. When updating an existing spec, preserve status codes it already documents.`,
    '- omit requestBody entirely for GET/HEAD/DELETE requests with no body',
    '- in the response and requestBody schemas, document EVERY field present in the observed body — do not omit fields or document only a representative subset. Give each a type, using nested object/array schemas where the value is an object or array.',
    '- if a current spec is provided, update it rather than replacing it — preserve documented fields',
    '- write concise but useful summaries and descriptions',
    authGuideline,
    `- valid security scheme names: ${VALID_SCHEME_NAMES.join(', ')}`,
    '',
    'Output format: respond with ONLY a single JSON object (no markdown fences, no prose) for one OpenAPI 3.0 Operation, with these fields:',
    '- summary (string), description (string), operationId (string, optional)',
    '- parameters: array of { name, in: "query"|"path"|"header"|"cookie", required (boolean), description (optional), schema (a JSON Schema object) }',
    '- requestBody: { required (boolean), content: { "<mediaType>": { schema: <JSON Schema object> } } } — omit entirely when there is no body',
    '- responses: object keyed by status-code string → { description (string), content?: { "<mediaType>": { schema: <JSON Schema object> } } }',
    '- security: array of { "<schemeName>": [] } — omit when no auth',
    '- you may omit "tags"; the system assigns them',
    '',
    'Example of the exact output shape (note the fully-populated response schema with typed properties — always include it):',
    JSON.stringify({
      summary: 'Get a widget',
      description: 'Retrieve a single widget by id.',
      operationId: 'getWidget',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      responses: {
        '200': {
          description: 'The widget',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  price: { type: 'number' },
                },
              },
            },
          },
        },
      },
    }),
  ].join('\n')

  const basePrompt = [
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
    .join('\n')

  let lastError = ''
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const prompt =
      attempt === 1
        ? basePrompt
        : `${basePrompt}\n\nYour previous response was invalid: ${lastError}\nReturn ONLY a corrected JSON object.`

    const { text } = await generateText({ model, system, prompt })

    try {
      const parsed = OperationSchema.safeParse(extractJson(text))
      if (parsed.success) return finalize(parsed.data, event)
      lastError = parsed.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')
        .slice(0, 300)
    } catch (err) {
      lastError = (err instanceof Error ? err.message : String(err)).slice(0, 300)
    }
  }

  throw new Error(
    `Failed to generate a valid OpenAPI Operation after ${MAX_ATTEMPTS} attempts. Last error: ${lastError}`
  )
}

/** Apply the deterministic fields that must not be left to the model's (variable) inference. */
function finalize(object: Operation, event: CaptureEvent): Operation {
  // Tag is a pure function of the path.
  object.tags = [deriveTag(event.path)]

  // Requiredness can't be inferred from a single capture: path params are
  // structurally required, everything else defaults to optional.
  if (object.parameters) {
    object.parameters = object.parameters.map((p) => ({ ...p, required: p.in === 'path' }))
  }

  return object
}

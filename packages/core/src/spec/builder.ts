import { generateText } from 'ai'
import { resolveModel, resolveProvider, DEFAULT_MODELS } from '../ai/provider.js'
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

/**
 * Collapse arrays to a single element before sending a payload to the model.
 * The schema is derived from element *shape*, so the remaining items are pure
 * token cost — a 500-item bulk insert used to be billed in full because only
 * the response was trimmed, never the request body.
 */
function trimPayload(payload: unknown, maxItems = 1): unknown {
  if (Array.isArray(payload)) return payload.slice(0, maxItems).map((v) => trimPayload(v, maxItems))
  if (payload && typeof payload === 'object') {
    return Object.fromEntries(
      Object.entries(payload as Record<string, unknown>).map(([k, v]) => [k, trimPayload(v, maxItems)])
    )
  }
  return payload
}

// A retired or misspelled model ID is the single most likely cause of every
// generation failing at once, and providers report it as an opaque 404/400.
// Say what to do instead of surfacing the raw provider error.
function describeModelError(err: unknown, model: string): string | null {
  const message = err instanceof Error ? err.message : String(err)
  if (!/model|not_found|404|does not exist|deprecated|decommission/i.test(message)) return null
  return (
    `[EasyDocs] The AI provider rejected model "${model}". It may have been retired. ` +
    'Set an explicit { ai: { model: "..." } } in your EasyDocs config. ' +
    `Provider said: ${message}`
  )
}

/**
 * The brackets still open at the end of `text`, outermost first. Only
 * structural brackets count; anything inside a string literal is skipped, so a
 * `}` in a description can't unbalance the count.
 */
function unclosedBrackets(text: string): string[] {
  const open: string[] = []
  let inString = false
  let escaped = false

  for (const ch of text) {
    if (escaped) {
      escaped = false
      continue
    }
    if (ch === '\\') {
      escaped = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (ch === '{' || ch === '[') open.push(ch)
    else if (ch === '}' || ch === ']') open.pop()
  }
  return open
}

const closerFor = (c: string) => (c === '{' ? '}' : ']')

/** Append whatever `text` left open, so the result is bracket-balanced. */
function closeUnbalanced(text: string): string {
  const open = unclosedBrackets(text)
  if (open.length === 0) return text
  return text + open.reverse().map(closerFor).join('')
}

/**
 * Offsets of a `,` that directly follows a closing bracket — the boundaries
 * between sibling members, and the only places a dropped `}` can plausibly
 * belong. Latest first: the deepest truncation is the most likely one.
 */
function memberBoundaries(text: string): number[] {
  const out: number[] = []
  for (let i = 1; i < text.length; i++) {
    if (text[i] !== ',') continue
    const prev = text[i - 1]
    if (prev === '}' || prev === ']') out.push(i)
  }
  return out.reverse()
}

const tryParse = (s: string): { ok: boolean; value?: unknown } => {
  try {
    return { ok: true, value: JSON.parse(s) }
  } catch {
    return { ok: false }
  }
}

/**
 * Every plausible reading of a model reply, cheapest first.
 *
 * Smaller models reliably drop a `}` on deeply nested response schemas and then
 * stop with `finish_reason: "stop"` — they believe they finished, so retrying
 * reproduces the same mistake. Measured on deepseek-chat this accounted for
 * *every* failed fixture in the accuracy suite: 4 of 14 endpoints produced
 * nothing at all, while every reply that did parse scored perfectly.
 *
 * The dropped bracket is usually not missing from the end. In the captured
 * failures the model under-closed just before a trailing top-level key, so
 * naively appending `}` parses but nests `security` inside `responses` — valid
 * JSON, wrong document. Rather than guess, this yields each reading and lets
 * the caller pick the first that satisfies OperationSchema; the schema is the
 * only reliable arbiter of where the bracket belonged.
 */
export function* jsonCandidates(text: string): Generator<unknown> {
  let t = text.trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) t = fence[1].trim()
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) {
    throw new Error('no JSON object found in model output')
  }

  // Bounded at the last `}` so trailing prose is ignored.
  const exact = tryParse(t.slice(start, end + 1))
  if (exact.ok) {
    yield exact.value
    return
  }

  // From here on, work to the end of the reply rather than the last `}`: when a
  // model stops mid-structure that `}` is an *inner* one, and the bounded slice
  // would silently amputate everything after it.
  const body = t.slice(start)
  const open = unclosedBrackets(body)
  if (open.length === 0) throw new Error(`unparseable model output: ${exact.value ?? 'invalid JSON'}`)

  const closers = [...open].reverse().map(closerFor).join('')

  // (a) the model simply stopped early — close at the end.
  const atEnd = tryParse(closeUnbalanced(body))
  if (atEnd.ok) yield atEnd.value

  // (b) it under-closed before a later sibling — close at that boundary instead.
  //     Capped so a pathological reply can't cost unbounded parse attempts.
  for (const idx of memberBoundaries(body).slice(0, 8)) {
    const patched = closeUnbalanced(body.slice(0, idx) + closers + body.slice(idx))
    const attempt = tryParse(patched)
    if (attempt.ok) yield attempt.value
  }
}

/**
 * What to tell the model after a rejected attempt. A raw parser message
 * ("Expected ',' or '}' ... at position 557") is not actionable — in practice
 * the model made the identical mistake on all three attempts. Name the likely
 * cause instead.
 */
function retryGuidance(lastError: string, wasSyntax: boolean): string {
  if (wasSyntax) {
    return (
      'Your previous reply was not valid JSON. The usual cause is a missing closing "}" or "]" ' +
      'on a deeply nested schema. Re-emit the entire object and check that every bracket you ' +
      `open is also closed. Output only the JSON object. Parser said: ${lastError}`
    )
  }
  return `Your previous response did not match the required shape: ${lastError}`
}

const MAX_ATTEMPTS = 3
const DEFAULT_TIMEOUT_MS = 30_000

export async function buildOperation(
  event: CaptureEvent,
  existingSpec: unknown | null,
  aiConfig?: AIConfig,
  offline?: boolean
): Promise<Operation> {
  const model = resolveModel(aiConfig, offline)
  const modelId = aiConfig?.model ?? DEFAULT_MODELS[resolveProvider(aiConfig, offline)]
  const timeoutMs = aiConfig?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const trimmedResponse = trimPayload(event.response)
  const trimmedBody = trimPayload(event.body)
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
    `Request body: ${event.body ? JSON.stringify(trimmedBody) : 'none'}`,
    `Response status: ${event.status}`,
    `Response body: ${JSON.stringify(trimmedResponse)}`,
    detectedAuth.length > 0 ? `Detected auth: ${detectedAuth.join(', ')}` : '',
    existingSpec ? `Current spec (update this): ${JSON.stringify(existingSpec)}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  let lastError = ''
  let lastErrorWasSyntax = false
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const prompt =
      attempt === 1
        ? basePrompt
        : `${basePrompt}\n\n${retryGuidance(lastError, lastErrorWasSyntax)}\nReturn ONLY a corrected JSON object.`

    let text: string
    try {
      ;({ text } = await generateText({
        model,
        system,
        prompt,
        // Bound each attempt so a provider that hangs (no response, no error)
        // can't stall the capture queue indefinitely.
        abortSignal: AbortSignal.timeout(timeoutMs),
      }))
    } catch (err) {
      // The hint already embeds the provider's own message, so nothing is lost.
      const hint = describeModelError(err, modelId)
      throw hint ? new Error(hint) : err
    }

    try {
      // Take the first reading of the reply that satisfies the schema. For a
      // well-formed reply that is the one and only candidate; for a reply with
      // a dropped bracket the schema decides where it belonged.
      let schemaError = ''
      for (const candidate of jsonCandidates(text)) {
        const parsed = OperationSchema.safeParse(candidate)
        if (parsed.success) return finalize(parsed.data, event)
        schemaError ||= parsed.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ')
          .slice(0, 300)
      }
      lastError = schemaError || 'no candidate parse matched the Operation schema'
      lastErrorWasSyntax = false
    } catch (err) {
      // Nothing in the reply could be read as JSON at all.
      lastError = (err instanceof Error ? err.message : String(err)).slice(0, 300)
      lastErrorWasSyntax = true
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

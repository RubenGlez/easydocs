import { describe, it, expect, vi, beforeEach } from 'vitest'

const { replies } = vi.hoisted(() => ({ replies: { queue: [] as string[], prompts: [] as string[] } }))

vi.mock('ai', () => ({
  generateText: vi.fn(async ({ prompt }: { prompt: string }) => {
    replies.prompts.push(prompt)
    return { text: replies.queue.shift() ?? '{}' }
  }),
}))

import { buildOperation } from '../spec/builder.js'
import type { CaptureEvent } from '../types.js'

const event: CaptureEvent = {
  method: 'GET',
  path: '/me',
  query: {},
  params: {},
  body: null,
  response: { user: { id: '1' }, orders: 2 },
  status: 200,
  requestHeaders: {},
  responseHeaders: {},
  durationMs: 5,
}

const ai = { provider: 'ollama' as const }

beforeEach(() => {
  replies.queue = []
  replies.prompts = []
})

// Verbatim output captured from deepseek-chat on the get-me-bearer fixture:
// 16 opening braces, 15 closing, finish_reason "stop" — the model believed it
// was done. This produced a hard 0.00 on 4 of 14 accuracy fixtures.
const DEEPSEEK_TRUNCATED =
  '{"summary":"Get current user info","description":"Retrieves the authenticated user\'s profile.",' +
  '"operationId":"getMe","parameters":[],"responses":{"200":{"description":"Current user profile",' +
  '"content":{"application/json":{"schema":{"type":"object","properties":{"user":{"type":"object",' +
  '"properties":{"id":{"type":"string"},"name":{"type":"string"}}},"orders":{"type":"integer"}}}}}},' +
  '"security":[{"bearerAuth":[]}]}'

describe('recovering truncated model output', () => {
  it('is genuinely unparseable as-is', () => {
    expect(() => JSON.parse(DEEPSEEK_TRUNCATED)).toThrow()
  })

  it('recovers a real deepseek reply missing one closing brace', async () => {
    replies.queue = [DEEPSEEK_TRUNCATED]
    const op = await buildOperation(event, null, ai)

    expect(op.summary).toBe('Get current user info')
    expect(op.operationId).toBe('getMe')
    // The nested schema must survive the repair, not just the outer object.
    const schema = op.responses?.['200']?.content?.['application/json']?.schema as Record<string, any>
    expect(Object.keys(schema.properties)).toEqual(['user', 'orders'])
    expect(Object.keys(schema.properties.user.properties)).toEqual(['id', 'name'])
    // The dropped brace belonged before `,"security"`, not at the end. Closing
    // at the end also parses, but buries security inside responses — so this
    // asserts the repair picked the right insertion point, not merely a valid one.
    expect(op.security).toEqual([{ bearerAuth: [] }])
    expect((op.responses as Record<string, unknown>).security).toBeUndefined()
  })

  it('recovers on the first attempt, without burning retries', async () => {
    replies.queue = [DEEPSEEK_TRUNCATED]
    await buildOperation(event, null, ai)
    expect(replies.prompts).toHaveLength(1)
  })

  it('closes several missing brackets, including arrays', async () => {
    replies.queue = [
      '{"summary":"List","responses":{"200":{"description":"OK"}},"parameters":[{"name":"page","in":"query"',
    ]
    const op = await buildOperation(event, null, ai)
    expect(op.summary).toBe('List')
    expect(op.parameters?.[0]?.name).toBe('page')
  })

  it('ignores braces inside string values when balancing', async () => {
    replies.queue = [
      '{"summary":"Uses {curly} and [square] in prose","responses":{"200":{"description":"OK"}}',
    ]
    const op = await buildOperation(event, null, ai)
    expect(op.summary).toBe('Uses {curly} and [square] in prose')
  })

  it('leaves well-formed output untouched', async () => {
    replies.queue = ['{"summary":"Fine","responses":{"200":{"description":"OK"}}}']
    const op = await buildOperation(event, null, ai)
    expect(op.summary).toBe('Fine')
  })

  it('still handles markdown fences', async () => {
    replies.queue = ['```json\n{"summary":"Fenced","responses":{"200":{"description":"OK"}}}\n```']
    const op = await buildOperation(event, null, ai)
    expect(op.summary).toBe('Fenced')
  })

  it('does not paper over output that is broken some other way', async () => {
    // Balanced brackets, but a missing comma — repair must not mask this.
    const broken = '{"summary":"A" "responses":{"200":{"description":"OK"}}}'
    replies.queue = [broken, broken, broken]
    await expect(buildOperation(event, null, ai)).rejects.toThrow(/after 3 attempts/)
  })
})

describe('retry guidance', () => {
  it('names the likely cause after a syntax failure instead of echoing the parser', async () => {
    // Unrepairable syntax error, so it retries.
    const broken = '{"summary":"A" "x":}'
    replies.queue = [broken, '{"summary":"Recovered","responses":{"200":{"description":"OK"}}}']

    const op = await buildOperation(event, null, ai)
    expect(op.summary).toBe('Recovered')

    const retryPrompt = replies.prompts[1]
    expect(retryPrompt).toContain('missing closing')
    expect(retryPrompt).toContain('every bracket you')
  })

  it('reports the schema mismatch when the JSON parsed but the shape was wrong', async () => {
    // Valid JSON, but `in` is not one of the allowed parameter locations.
    replies.queue = [
      '{"summary":"Bad param","parameters":[{"name":"page","in":"nowhere"}]}',
      '{"summary":"Recovered","responses":{"200":{"description":"OK"}}}',
    ]

    await buildOperation(event, null, ai)

    const retryPrompt = replies.prompts[1]
    expect(retryPrompt).toContain('did not match the required shape')
    expect(retryPrompt).not.toContain('missing closing')
  })
})

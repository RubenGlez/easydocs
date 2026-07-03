import { describe, it, expect, vi, beforeEach } from 'vitest'
import { randomUUID } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'

// Capture the prompt the AI layer receives, and return a canned Operation
// (with a `password` property) so marking has something to stamp.
const { prompts } = vi.hoisted(() => ({ prompts: [] as string[] }))

vi.mock('ai', () => ({
  generateText: vi.fn(async ({ prompt }: { prompt: string }) => {
    prompts.push(prompt)
    return {
      text: JSON.stringify({
        summary: 'Create a user',
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { id: { type: 'string' }, password: { type: 'string' } } },
              },
            },
          },
        },
      }),
    }
  }),
}))

import { createCapturer } from '../capture.js'
import { createSqliteAdapter } from '../storage/sqlite.js'
import { buildCaptureEvent } from '../event.js'
import type { CaptureEvent } from '../types.js'

function tmpDbUrl(): string {
  return `file:${path.join(os.tmpdir(), `easydocs-qa-${randomUUID()}.sqlite`)}`
}

function userSignup(): CaptureEvent {
  return buildCaptureEvent({
    method: 'POST',
    path: '/users',
    requestBody: { username: 'ada', password: 'hunter2' },
    responseBody: { id: 'u_1' },
    status: 200,
  })
}

async function waitForEndpoint(url: string) {
  const reader = createSqliteAdapter(url)
  for (let i = 0; i < 100; i++) {
    const eps = await reader.getAllEndpoints()
    if (eps.length > 0) return eps[0]
    await new Promise((r) => setTimeout(r, 20))
  }
  throw new Error('timed out waiting for the capture queue to persist an endpoint')
}

beforeEach(() => {
  prompts.length = 0
})

describe('capture pipeline + privacy', () => {
  it('redacts the secret before a hosted provider sees it, and flags the field', async () => {
    const url = tmpDbUrl()
    const capturer = createCapturer({
      storage: { type: 'sqlite', url },
      ai: { provider: 'openai', apiKey: 'test-key' },
    })

    capturer.capture(userSignup())
    const endpoint = await waitForEndpoint(url)

    // The prompt the hosted model received must not contain the raw secret.
    expect(prompts).toHaveLength(1)
    expect(prompts[0]).not.toContain('hunter2')
    expect(prompts[0]).toContain('[REDACTED]')

    // The stored spec flags the password property.
    const props = endpoint.spec!.responses['200'].content!['application/json'].schema!.properties
    expect(props.password['x-easydocs-sensitive']).toBe(true)
    expect(props.id['x-easydocs-sensitive']).toBeUndefined()
  })

  it('does NOT redact for local Ollama but still flags the field', async () => {
    const url = tmpDbUrl()
    const capturer = createCapturer({
      storage: { type: 'sqlite', url },
      ai: { provider: 'ollama' },
    })

    capturer.capture(userSignup())
    const endpoint = await waitForEndpoint(url)

    // Local model is allowed to see real values.
    expect(prompts).toHaveLength(1)
    expect(prompts[0]).toContain('hunter2')

    // But the spec is still flagged.
    const props = endpoint.spec!.responses['200'].content!['application/json'].schema!.properties
    expect(props.password['x-easydocs-sensitive']).toBe(true)
  })

  it('offline mode keeps values local even with a hosted key present, and never redacts', async () => {
    const url = tmpDbUrl()
    const capturer = createCapturer({
      storage: { type: 'sqlite', url },
      // A stray hosted key must not cause egress once offline mode is on.
      ai: { apiKey: 'test-key' },
      privacy: { offline: true },
    })

    capturer.capture(userSignup())
    const endpoint = await waitForEndpoint(url)

    // Pinned to a local model, so the real value is kept (nothing left the machine).
    expect(prompts).toHaveLength(1)
    expect(prompts[0]).toContain('hunter2')
    expect(prompts[0]).not.toContain('[REDACTED]')

    // Still flagged in the stored spec.
    const props = endpoint.spec!.responses['200'].content!['application/json'].schema!.properties
    expect(props.password['x-easydocs-sensitive']).toBe(true)
  })

  it('offline mode fails fast when a hosted provider is explicitly configured', () => {
    expect(() =>
      createCapturer({
        storage: { type: 'sqlite', url: tmpDbUrl() },
        ai: { provider: 'anthropic', apiKey: 'test-key' },
        privacy: { offline: true },
      })
    ).toThrow(/offline/i)
  })

  it('sends raw values when privacy is disabled', async () => {
    const url = tmpDbUrl()
    const capturer = createCapturer({
      storage: { type: 'sqlite', url },
      ai: { provider: 'openai', apiKey: 'test-key' },
      privacy: { enabled: false },
    })

    capturer.capture(userSignup())
    const endpoint = await waitForEndpoint(url)

    expect(prompts[0]).toContain('hunter2')
    const props = endpoint.spec!.responses['200'].content!['application/json'].schema!.properties
    expect(props.password['x-easydocs-sensitive']).toBeUndefined()
  })
})

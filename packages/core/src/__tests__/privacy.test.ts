import { describe, it, expect } from 'vitest'
import { normalizeKey, luhnValid, matchesSensitiveValue } from '../privacy/rules.js'
import { detect, markSensitiveProperties } from '../privacy/detect.js'
import { detectAuthSchemes } from '../spec/auth.js'
import { parseConfig } from '../types.js'
import type { CaptureEvent } from '../types.js'
import type { Operation } from '../spec/schema.js'

function event(partial: Partial<CaptureEvent>): CaptureEvent {
  return {
    method: 'POST',
    path: '/users',
    query: {},
    params: {},
    body: null,
    response: null,
    status: 200,
    requestHeaders: {},
    responseHeaders: {},
    durationMs: 1,
    ...partial,
  }
}

describe('rules', () => {
  it('normalizes keys across casing and separators', () => {
    expect(normalizeKey('api_key')).toBe('apikey')
    expect(normalizeKey('apiKey')).toBe('apikey')
    expect(normalizeKey('X-API-Key')).toBe('xapikey')
  })

  it('validates card numbers with Luhn', () => {
    expect(luhnValid('4242 4242 4242 4242')).toBe(true)
    expect(luhnValid('4242-4242-4242-4241')).toBe(false)
    expect(luhnValid('1234')).toBe(false)
  })

  it('matches secret/PII value shapes', () => {
    expect(matchesSensitiveValue('user@example.com')).toBe(true)
    expect(matchesSensitiveValue('sk-abc123')).toBe(true)
    expect(matchesSensitiveValue('a.b.c')).toBe(true) // jwt shape
    expect(matchesSensitiveValue('4242424242424242')).toBe(true) // luhn
    expect(matchesSensitiveValue('hello world')).toBe(false)
  })

  it('honors custom value patterns', () => {
    expect(matchesSensitiveValue('INT-9988', [/^INT-\d+$/])).toBe(true)
  })
})

describe('detect', () => {
  it('redacts by sensitive key name and flags the path', () => {
    const { redactedEvent, sensitivePaths } = detect(
      event({ body: { username: 'ada', password: 'hunter2' } })
    )
    expect((redactedEvent.body as Record<string, unknown>).password).toBe('[REDACTED]')
    expect((redactedEvent.body as Record<string, unknown>).username).toBe('ada')
    expect(sensitivePaths.has('password')).toBe(true)
    expect(sensitivePaths.has('username')).toBe(false)
  })

  it('redacts by value shape even when the key is innocent', () => {
    const { redactedEvent, sensitivePaths } = detect(
      event({ response: { contact: 'user@example.com' } })
    )
    expect((redactedEvent.response as Record<string, unknown>).contact).toBe('[REDACTED]')
    expect(sensitivePaths.has('contact')).toBe(true)
  })

  it('walks nested objects and arrays', () => {
    const { redactedEvent } = detect(
      event({ body: { items: [{ token: 'abc' }, { name: 'ok' }] } })
    )
    const items = (redactedEvent.body as { items: Record<string, unknown>[] }).items
    expect(items[0].token).toBe('[REDACTED]')
    expect(items[1].name).toBe('ok')
  })

  it('preserves the auth scheme prefix so auth detection still works', () => {
    const { redactedEvent } = detect(
      event({ requestHeaders: { authorization: 'Bearer secret-token-value' } })
    )
    expect(redactedEvent.requestHeaders.authorization).toBe('Bearer [REDACTED]')
    expect(detectAuthSchemes(redactedEvent.requestHeaders, {})).toEqual(['bearerAuth'])
  })

  it('redacts sensitive headers by name', () => {
    const { redactedEvent } = detect(
      event({ responseHeaders: { 'set-cookie': 'session=abc; HttpOnly' } })
    )
    expect(redactedEvent.responseHeaders['set-cookie']).toBe('[REDACTED]')
  })

  it('never leaks the raw secret anywhere in the redacted event', () => {
    const secret = 'hunter2'
    const { redactedEvent } = detect(event({ body: { password: secret } }))
    expect(JSON.stringify(redactedEvent)).not.toContain(secret)
  })

  it('respects the allowlist', () => {
    const { redactedEvent, sensitivePaths } = detect(
      event({ body: { token: 'keep-me' } }),
      { allowlist: ['token'] }
    )
    expect((redactedEvent.body as Record<string, unknown>).token).toBe('keep-me')
    expect(sensitivePaths.has('token')).toBe(false)
  })

  it('applies custom key-name rules', () => {
    const { sensitivePaths } = detect(
      event({ body: { internalRef: 'x' } }),
      { customRules: { keyNames: ['internalRef'] } }
    )
    expect(sensitivePaths.has('internalRef')).toBe(true)
  })

  it('uses a custom placeholder', () => {
    const { redactedEvent } = detect(
      event({ body: { password: 'x' } }),
      { placeholder: '***' }
    )
    expect((redactedEvent.body as Record<string, unknown>).password).toBe('***')
  })
})

describe('markSensitiveProperties', () => {
  it('stamps the extension on matching schema properties and parameters', () => {
    const op: Operation = {
      parameters: [{ name: 'token', in: 'query', required: false, schema: { type: 'string' } }],
      responses: {
        '200': {
          description: 'ok',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
      },
    }
    markSensitiveProperties(op, new Set(['password', 'token']))

    const props = op.responses['200'].content!['application/json'].schema!.properties
    expect(props.password['x-easydocs-sensitive']).toBe(true)
    expect(props.id['x-easydocs-sensitive']).toBeUndefined()
    expect((op.parameters![0] as Record<string, unknown>)['x-easydocs-sensitive']).toBe(true)
  })
})

describe('privacy config', () => {
  it('accepts a valid privacy block', () => {
    const cfg = parseConfig({
      privacy: { enabled: true, placeholder: '##', allowlist: ['id'], customRules: { keyNames: ['ref'] } },
    })
    expect(cfg.privacy?.placeholder).toBe('##')
  })

  it('rejects unknown privacy keys', () => {
    expect(() => parseConfig({ privacy: { bogus: 1 } })).toThrow()
  })
})

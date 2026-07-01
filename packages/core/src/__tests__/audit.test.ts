import { describe, it, expect } from 'vitest'
import { collectSensitiveFields } from '../privacy/audit.js'
import { markSensitiveProperties } from '../privacy/detect.js'
import type { Operation } from '../spec/schema.js'

function baseOperation(): Operation {
  return {
    parameters: [
      { name: 'token', in: 'query', required: false },
      { name: 'page', in: 'query', required: false },
    ],
    requestBody: {
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              email: { type: 'string' },
              password: { type: 'string' },
              profile: { type: 'object', properties: { ssn: { type: 'string' } } },
            },
          },
        },
      },
    },
    responses: {
      '200': {
        description: 'OK',
        content: {
          'application/json': {
            schema: { type: 'object', properties: { id: { type: 'string' }, apiKey: { type: 'string' } } },
          },
        },
      },
    },
  }
}

describe('collectSensitiveFields', () => {
  it('collects fields flagged across parameters, requestBody, and responses', () => {
    const op = baseOperation()
    markSensitiveProperties(op, new Set(['token', 'password', 'ssn', 'apiKey']))

    const fields = collectSensitiveFields(op)
    const byField = Object.fromEntries(fields.map((f) => [f.field, f.location]))

    expect(byField.token).toBe('query')
    expect(byField.password).toBe('requestBody')
    expect(byField.ssn).toBe('requestBody') // nested property
    expect(byField.apiKey).toBe('response:200')
    // Non-sensitive fields are not reported.
    expect(fields.some((f) => f.field === 'page')).toBe(false)
    expect(fields.some((f) => f.field === 'id')).toBe(false)
  })

  it('returns an empty array when nothing is flagged', () => {
    expect(collectSensitiveFields(baseOperation())).toEqual([])
  })

  it('de-duplicates by location and field', () => {
    const op: Operation = {
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/json': { schema: { type: 'object', properties: { token: { type: 'string' } } } },
            'application/xml': { schema: { type: 'object', properties: { token: { type: 'string' } } } },
          },
        },
      },
    }
    markSensitiveProperties(op, new Set(['token']))
    const fields = collectSensitiveFields(op)
    expect(fields).toHaveLength(1)
    expect(fields[0]).toEqual({ location: 'response:200', field: 'token' })
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { randomUUID } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'

// Count how many times the AI layer is invoked, so we can assert the shape gate
// skips redundant captures but still regenerates for genuinely new shapes.
const { calls } = vi.hoisted(() => ({ calls: { count: 0 } }))

vi.mock('ai', () => ({
  generateText: vi.fn(async () => {
    calls.count++
    return {
      text: JSON.stringify({
        summary: 'op',
        responses: { '200': { description: 'OK' } },
      }),
    }
  }),
}))

import { createCapturer } from '../capture.js'
import { createSqliteAdapter } from '../storage/sqlite.js'
import { buildCaptureEvent } from '../event.js'
import type { RawCaptureInput } from '../event.js'

function tmpDbUrl(): string {
  return `file:${path.join(os.tmpdir(), `easydocs-gate-${randomUUID()}.sqlite`)}`
}

async function drain(url: string, expected: number) {
  const reader = createSqliteAdapter(url)
  for (let i = 0; i < 200; i++) {
    if (calls.count >= expected) return
    await new Promise((r) => setTimeout(r, 10))
    void reader
  }
}

beforeEach(() => {
  calls.count = 0
})

describe('capture shape gate', () => {
  function capturer(url: string) {
    return createCapturer({
      storage: { type: 'sqlite', url },
      ai: { provider: 'ollama' },
    })
  }

  function event(overrides: Partial<RawCaptureInput>) {
    return buildCaptureEvent({
      method: 'GET',
      path: '/users/:id',
      status: 200,
      responseBody: { id: 'u1' },
      ...overrides,
    })
  }

  it('skips a second capture with an identical shape', async () => {
    const url = tmpDbUrl()
    const c = capturer(url)
    c.capture(event({}))
    await drain(url, 1)
    c.capture(event({}))
    await new Promise((r) => setTimeout(r, 150))
    expect(calls.count).toBe(1)
  })

  it('regenerates when the same route returns a different status class', async () => {
    const url = tmpDbUrl()
    const c = capturer(url)
    c.capture(event({ status: 200, responseBody: { id: 'u1' } }))
    await drain(url, 1)
    c.capture(event({ status: 404, responseBody: { error: 'not found' } }))
    await drain(url, 2)
    // ...and neither of those alternating shapes re-triggers a third time.
    c.capture(event({ status: 200, responseBody: { id: 'u2' } }))
    c.capture(event({ status: 404, responseBody: { error: 'gone' } }))
    await new Promise((r) => setTimeout(r, 150))
    expect(calls.count).toBe(2)
  })

  it('regenerates when the request-body shape changes but the response does not', async () => {
    const url = tmpDbUrl()
    const c = capturer(url)
    c.capture(event({ method: 'POST', requestBody: { name: 'ada' }, responseBody: { ok: true } }))
    await drain(url, 1)
    c.capture(
      event({ method: 'POST', requestBody: { name: 'ada', email: 'a@b.co' }, responseBody: { ok: true } })
    )
    await drain(url, 2)
    expect(calls.count).toBe(2)
  })
})

describe('activeSpec', () => {
  it('returns the manual spec only when it is present', async () => {
    const { activeSpec } = await import('../spec/schema.js')
    const spec = { summary: 's', responses: {} }
    const manual = { summary: 'm', responses: {} }
    expect(activeSpec({ spec, manualSpec: manual, isManuallyEdited: true })).toBe(manual)
    // "Keep mine" promotes manual into spec and clears manualSpec — must not read null.
    expect(activeSpec({ spec: manual, manualSpec: null, isManuallyEdited: true })).toBe(manual)
    expect(activeSpec({ spec, manualSpec: manual, isManuallyEdited: false })).toBe(spec)
    expect(activeSpec({ spec: null, manualSpec: null, isManuallyEdited: false })).toBeNull()
  })
})

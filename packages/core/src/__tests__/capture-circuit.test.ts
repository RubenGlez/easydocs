import { describe, it, expect, vi, beforeEach } from 'vitest'
import { randomUUID } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'

// A provider that always fails, to exercise the circuit breaker (A6).
const { calls } = vi.hoisted(() => ({ calls: { count: 0 } }))
vi.mock('ai', () => ({
  generateText: vi.fn(async () => {
    calls.count++
    throw new Error('provider down')
  }),
}))

import { createCapturer } from '../capture.js'
import { buildCaptureEvent } from '../event.js'

function tmpDbUrl(): string {
  return `file:${path.join(os.tmpdir(), `easydocs-circuit-${randomUUID()}.sqlite`)}`
}

beforeEach(() => {
  calls.count = 0
})

describe('capture circuit breaker (A6)', () => {
  it('stops attempting generation after 5 consecutive failures', async () => {
    const c = createCapturer({
      storage: { type: 'sqlite', url: tmpDbUrl() },
      ai: { provider: 'ollama' },
    })
    // 20 distinct routes → 20 new shapes that each try (and fail) to generate.
    for (let i = 0; i < 20; i++) {
      c.capture(buildCaptureEvent({ method: 'GET', path: `/r${i}`, status: 200, responseBody: { i } }))
    }
    await new Promise((r) => setTimeout(r, 500))
    // The circuit opens on the 5th failure; the remaining 15 captures never call
    // the provider again.
    expect(calls.count).toBe(5)
  })
})

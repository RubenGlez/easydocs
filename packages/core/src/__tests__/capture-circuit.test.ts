import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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

const settle = () => new Promise((r) => setTimeout(r, 500))

beforeEach(() => {
  calls.count = 0
})

afterEach(() => {
  vi.restoreAllMocks()
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
    await settle()
    // The circuit opens on the 5th failure. Captures already in flight when it
    // trips still complete, so the exact count depends on queue concurrency —
    // what matters is that the remaining captures never reach the provider.
    expect(calls.count).toBeGreaterThanOrEqual(5)
    expect(calls.count).toBeLessThan(20)
  })

  it('re-attempts after the cooldown instead of staying open for the process lifetime', async () => {
    const clock = { now: Date.now() }
    vi.spyOn(Date, 'now').mockImplementation(() => clock.now)

    const c = createCapturer({
      storage: { type: 'sqlite', url: tmpDbUrl() },
      ai: { provider: 'ollama' },
    })
    for (let i = 0; i < 20; i++) {
      c.capture(buildCaptureEvent({ method: 'GET', path: `/r${i}`, status: 200, responseBody: { i } }))
    }
    await settle()
    const afterTrip = calls.count
    expect(afterTrip).toBeLessThan(20)

    // While the circuit is open, nothing new reaches the provider.
    c.capture(buildCaptureEvent({ method: 'GET', path: '/later', status: 200, responseBody: { a: 1 } }))
    await settle()
    expect(calls.count).toBe(afterTrip)

    // Once the cooldown elapses it tries again. Previously the circuit was
    // permanent, so a transient provider outage silently stopped all
    // documentation until the next deploy.
    clock.now += 61_000
    c.capture(buildCaptureEvent({ method: 'GET', path: '/recovered', status: 200, responseBody: { b: 2 } }))
    await settle()
    expect(calls.count).toBeGreaterThan(afterTrip)
  })
})

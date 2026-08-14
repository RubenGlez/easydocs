import { describe, it, expect, vi, beforeEach } from 'vitest'
import { randomUUID } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'

const { calls } = vi.hoisted(() => ({ calls: { count: 0 } }))

vi.mock('ai', () => ({
  generateText: vi.fn(async () => {
    calls.count++
    return {
      text: JSON.stringify({ summary: 'op', responses: { '200': { description: 'OK' } } }),
    }
  }),
}))

import { createCapturer, DEFAULT_MAX_BODY_SIZE } from '../capture.js'
import { buildCaptureEvent } from '../event.js'

function tmpDbUrl(): string {
  return `file:${path.join(os.tmpdir(), `easydocs-hot-${randomUUID()}.sqlite`)}`
}

function capturer(overrides: Record<string, unknown> = {}) {
  return createCapturer({
    storage: { type: 'sqlite', url: tmpDbUrl() },
    ai: { provider: 'ollama' },
    ...overrides,
  })
}

const settle = () => new Promise((r) => setTimeout(r, 300))

beforeEach(() => {
  calls.count = 0
})

describe('capture hot path', () => {
  // The dedup check used to live inside the queued task, so every repeat request
  // was enqueued (retaining its body) and queued behind whatever was generating.
  it('generates once for a repeated shape, even in a burst', async () => {
    const c = capturer()
    for (let i = 0; i < 50; i++) {
      c.capture(
        buildCaptureEvent({ method: 'GET', path: '/users', status: 200, responseBody: { data: [] } })
      )
    }
    await c.flush()
    await settle()
    expect(calls.count).toBe(1)
  })

  it('still regenerates for a genuinely new shape', async () => {
    const c = capturer()
    c.capture(buildCaptureEvent({ method: 'GET', path: '/u', status: 200, responseBody: { a: 1 } }))
    await c.flush()
    await settle()
    c.capture(buildCaptureEvent({ method: 'GET', path: '/u', status: 200, responseBody: { a: 1, b: 2 } }))
    await c.flush()
    await settle()
    expect(calls.count).toBe(2)
  })

  describe('body size cap', () => {
    const big = () => ({ items: Array.from({ length: 20_000 }, (_, i) => ({ i, pad: 'x'.repeat(40) })) })

    it('skips oversized payloads by default (no explicit maxBodySize)', async () => {
      expect(JSON.stringify(big()).length).toBeGreaterThan(DEFAULT_MAX_BODY_SIZE)
      const c = capturer()
      c.capture(buildCaptureEvent({ method: 'GET', path: '/big', status: 200, responseBody: big() }))
      await c.flush()
      await settle()
      expect(calls.count).toBe(0)
    })

    it('still captures a payload under the cap', async () => {
      const c = capturer()
      c.capture(
        buildCaptureEvent({ method: 'GET', path: '/small', status: 200, responseBody: { a: 1 } })
      )
      await c.flush()
      await settle()
      expect(calls.count).toBe(1)
    })

    it('honours an explicit maxBodySize', async () => {
      const c = capturer({ capture: { maxBodySize: 20 } })
      c.capture(
        buildCaptureEvent({
          method: 'GET',
          path: '/x',
          status: 200,
          responseBody: { message: 'this is comfortably over twenty bytes' },
        })
      )
      await c.flush()
      await settle()
      expect(calls.count).toBe(0)
    })
  })

  // capture() runs synchronously inside the host app's res.json(), so a throw
  // here would surface as an error in the user's own route handler.
  it('never throws on a self-referential body', async () => {
    const c = capturer()
    const cyclic: Record<string, unknown> = { name: 'node' }
    cyclic.self = cyclic

    expect(() =>
      c.capture(
        buildCaptureEvent({ method: 'POST', path: '/cycle', status: 200, requestBody: cyclic, responseBody: { ok: true } })
      )
    ).not.toThrow()

    await c.flush()
    await settle()
  })

  it('stops generating once an endpoint has too many distinct shapes', async () => {
    const c = capturer()
    // Each response has a different key set, so each is a new shape. The old
    // FIFO eviction meant shape 51 evicted shape 1, which then reappeared and
    // paid for another LLM call — forever.
    for (let round = 0; round < 2; round++) {
      for (let i = 0; i < 60; i++) {
        c.capture(
          buildCaptureEvent({
            method: 'GET',
            path: '/variable',
            status: 200,
            responseBody: Object.fromEntries(Array.from({ length: i + 1 }, (_, k) => [`f${k}`, k])),
          })
        )
        await c.flush()
      }
    }
    await settle()
    expect(calls.count).toBeLessThanOrEqual(50)
  })
})

describe('non-JSON responses', () => {
  it('skips a streaming (text/event-stream) response instead of documenting it', async () => {
    const c = capturer()
    c.capture(
      buildCaptureEvent({
        method: 'GET',
        path: '/stream',
        status: 200,
        responseBody: null,
        responseHeaders: { 'content-type': 'text/event-stream' },
      })
    )
    await c.flush()
    await settle()
    expect(calls.count).toBe(0)
  })

  it('skips an HTML response', async () => {
    const c = capturer()
    c.capture(
      buildCaptureEvent({
        method: 'GET',
        path: '/page',
        status: 200,
        responseBody: null,
        responseHeaders: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    )
    await c.flush()
    await settle()
    expect(calls.count).toBe(0)
  })

  it('still documents a 204 with no content-type at all', async () => {
    const c = capturer()
    c.capture(
      buildCaptureEvent({ method: 'DELETE', path: '/users/{id}', status: 204, responseBody: null })
    )
    await c.flush()
    await settle()
    expect(calls.count).toBe(1)
  })

  it('still documents an application/json response', async () => {
    const c = capturer()
    c.capture(
      buildCaptureEvent({
        method: 'GET',
        path: '/ok',
        status: 200,
        responseBody: { a: 1 },
        responseHeaders: { 'content-type': 'application/json; charset=utf-8' },
      })
    )
    await c.flush()
    await settle()
    expect(calls.count).toBe(1)
  })
})

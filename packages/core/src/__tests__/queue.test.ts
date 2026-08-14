import { describe, it, expect } from 'vitest'
import { CaptureQueue } from '../queue.js'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((r) => { resolve = r })
  return { promise, resolve }
}

describe('CaptureQueue', () => {
  it('executes same-key tasks in order', async () => {
    const queue = new CaptureQueue()
    const results: number[] = []
    queue.add(async () => { await Promise.resolve(); results.push(1) }, 'a')
    queue.add(async () => { results.push(2) }, 'a')
    queue.add(async () => { results.push(3) }, 'a')
    await queue.flush()
    expect(results).toEqual([1, 2, 3])
  })

  it('continues after a failing task', async () => {
    const queue = new CaptureQueue()
    const results: string[] = []
    queue.add(async () => { results.push('before') }, 'a')
    queue.add(async () => { throw new Error('boom') }, 'a')
    queue.add(async () => { results.push('after') }, 'a')
    await queue.flush()
    expect(results).toEqual(['before', 'after'])
  })

  it('flush resolves immediately when queue is empty', async () => {
    const queue = new CaptureQueue()
    await queue.flush() // should not hang
  })

  it('flush waits for in-flight tasks, not just queued ones', async () => {
    const queue = new CaptureQueue()
    const gate = deferred()
    let done = false
    queue.add(async () => { await gate.promise; done = true }, 'a')

    const flushed = queue.flush().then(() => done)
    gate.resolve()
    expect(await flushed).toBe(true)
  })

  // A slow generation on one endpoint used to block every other endpoint,
  // because the queue ran a single task at a time.
  it('runs different keys concurrently', async () => {
    const queue = new CaptureQueue()
    const gates = [deferred(), deferred(), deferred()]
    const started: string[] = []

    gates.forEach((gate, i) => {
      queue.add(async () => { started.push(`k${i}`); await gate.promise }, `k${i}`)
    })

    await Promise.resolve()
    expect(started).toEqual(['k0', 'k1', 'k2'])
    gates.forEach((g) => g.resolve())
    await queue.flush()
  })

  // Two shapes of the same endpoint must not run at once: both would read the
  // same row and race on the read-modify-write inside upsertEndpoint.
  it('never runs two tasks with the same key concurrently', async () => {
    const queue = new CaptureQueue()
    const gate = deferred()
    let running = 0
    let maxConcurrent = 0

    for (let i = 0; i < 3; i++) {
      queue.add(async () => {
        running++
        maxConcurrent = Math.max(maxConcurrent, running)
        if (i === 0) await gate.promise
        running--
      }, 'same-endpoint')
    }

    await Promise.resolve()
    gate.resolve()
    await queue.flush()
    expect(maxConcurrent).toBe(1)
  })

  it('honours the concurrency bound', async () => {
    const queue = new CaptureQueue(1000, 2)
    const gates = Array.from({ length: 4 }, deferred)
    let running = 0
    let maxConcurrent = 0

    gates.forEach((gate, i) => {
      queue.add(async () => {
        running++
        maxConcurrent = Math.max(maxConcurrent, running)
        await gate.promise
        running--
      }, `k${i}`)
    })

    await Promise.resolve()
    expect(maxConcurrent).toBe(2)
    gates.forEach((g) => g.resolve())
    await queue.flush()
    expect(maxConcurrent).toBe(2)
  })

  it('drops the oldest task when the pending bound is exceeded', async () => {
    const queue = new CaptureQueue(2, 1)
    const gate = deferred()
    const ran: number[] = []

    // First task occupies the only worker so the rest accumulate as pending.
    queue.add(() => gate.promise, 'blocker')
    queue.add(async () => { ran.push(1) }, 'a')
    queue.add(async () => { ran.push(2) }, 'b')
    queue.add(async () => { ran.push(3) }, 'c') // pending hits the bound → evicts task 1

    expect(queue.size).toBe(2)
    gate.resolve()
    await queue.flush()
    // Task 1 was evicted before it ran; 2 and 3 survive in order.
    expect(ran).toEqual([2, 3])
  })
})

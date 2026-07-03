import { describe, it, expect } from 'vitest'
import { CaptureQueue } from '../queue.js'

describe('CaptureQueue', () => {
  it('executes tasks in order', async () => {
    const queue = new CaptureQueue()
    const results: number[] = []
    queue.add(async () => { results.push(1) })
    queue.add(async () => { results.push(2) })
    queue.add(async () => { results.push(3) })
    await queue.flush()
    expect(results).toEqual([1, 2, 3])
  })

  it('continues after a failing task', async () => {
    const queue = new CaptureQueue()
    const results: string[] = []
    queue.add(async () => { results.push('before') })
    queue.add(async () => { throw new Error('boom') })
    queue.add(async () => { results.push('after') })
    await queue.flush()
    expect(results).toEqual(['before', 'after'])
  })

  it('flush resolves immediately when queue is empty', async () => {
    const queue = new CaptureQueue()
    await queue.flush() // should not hang
  })

  it('size reflects pending tasks', () => {
    const queue = new CaptureQueue()
    let resolve!: () => void
    const blocker = new Promise<void>((r) => { resolve = r })
    queue.add(() => blocker)
    queue.add(async () => {})
    expect(queue.size).toBe(1)
    resolve()
  })

  it('drops the oldest task when the pending bound is exceeded', async () => {
    const queue = new CaptureQueue(2)
    let release!: () => void
    const blocker = new Promise<void>((r) => { release = r })
    const ran: number[] = []

    // First task blocks the worker so the rest accumulate as pending.
    queue.add(() => blocker)
    queue.add(async () => { ran.push(1) })
    queue.add(async () => { ran.push(2) })
    queue.add(async () => { ran.push(3) }) // pending hits the bound → evicts task 1

    expect(queue.size).toBe(2)
    release()
    await queue.flush()
    // Task 1 was evicted before it ran; 2 and 3 survive in order.
    expect(ran).toEqual([2, 3])
  })
})

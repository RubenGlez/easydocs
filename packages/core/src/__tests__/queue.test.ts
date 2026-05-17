import { describe, it, expect } from 'vitest'
import { CaptureQueue } from '../queue.js'

describe('CaptureQueue', () => {
  it('executes tasks in order', async () => {
    const queue = new CaptureQueue()
    const results: number[] = []
    queue.add(async () => { results.push(1) })
    queue.add(async () => { results.push(2) })
    queue.add(async () => { results.push(3) })
    await new Promise((r) => setTimeout(r, 20))
    expect(results).toEqual([1, 2, 3])
  })

  it('continues after a failing task', async () => {
    const queue = new CaptureQueue()
    const results: string[] = []
    queue.add(async () => { results.push('before') })
    queue.add(async () => { throw new Error('boom') })
    queue.add(async () => { results.push('after') })
    await new Promise((r) => setTimeout(r, 20))
    expect(results).toEqual(['before', 'after'])
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
})

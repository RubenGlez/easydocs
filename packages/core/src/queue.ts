type Task = () => Promise<void>

export class CaptureQueue {
  private tasks: Task[] = []
  private running = false

  add(task: Task) {
    this.tasks.push(task)
    if (!this.running) this.drain()
  }

  private async drain() {
    this.running = true
    while (this.tasks.length > 0) {
      const task = this.tasks.shift()!
      await task().catch((err: unknown) => {
        console.error('[EasyDocs] Capture task failed:', err)
      })
    }
    this.running = false
  }

  get size() {
    return this.tasks.length
  }
}

export const globalQueue = new CaptureQueue()

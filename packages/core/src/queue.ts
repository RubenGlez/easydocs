type Task = () => Promise<void>

export class CaptureQueue {
  private tasks: Task[] = []
  private running = false
  private current: Promise<void> = Promise.resolve()

  add(task: Task) {
    this.tasks.push(task)
    if (!this.running) this.current = this.pump()
  }

  async flush(): Promise<void> {
    await this.current
  }

  private async pump() {
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


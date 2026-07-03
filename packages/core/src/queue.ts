type Task = () => Promise<void>

// Upper bound on pending captures. If generation stalls (e.g. a hung provider),
// tasks would otherwise accumulate until the process runs out of memory; instead
// we drop the oldest and warn, keeping the host app healthy.
const DEFAULT_MAX_PENDING = 1000

export class CaptureQueue {
  private tasks: Task[] = []
  private running = false
  private current: Promise<void> = Promise.resolve()
  private warnedFull = false

  constructor(private readonly maxPending: number = DEFAULT_MAX_PENDING) {}

  add(task: Task) {
    if (this.tasks.length >= this.maxPending) {
      this.tasks.shift()
      if (!this.warnedFull) {
        console.warn(
          `[EasyDocs] Capture queue is full (${this.maxPending} pending) — dropping oldest captures. ` +
          'Generation may be stalled (unreachable AI provider?).'
        )
        this.warnedFull = true
      }
    } else if (this.warnedFull && this.tasks.length === 0) {
      this.warnedFull = false
    }
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


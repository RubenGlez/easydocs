type Task = () => Promise<void>

// Upper bound on pending captures. If generation stalls (e.g. a hung provider),
// tasks would otherwise accumulate until the process runs out of memory; instead
// we drop the oldest and warn, keeping the host app healthy.
const DEFAULT_MAX_PENDING = 1000

// How many capture tasks may run at once. Tasks are serialized per key (one
// endpoint at a time, so two shapes of the same endpoint can't race on the
// read-modify-write in upsertEndpoint) but run in parallel across keys, so a
// slow generation on one endpoint no longer blocks every other endpoint.
const DEFAULT_CONCURRENCY = 4

interface Entry {
  key: string
  task: Task
}

export class CaptureQueue {
  private tasks: Entry[] = []
  private running = 0
  /** Keys with a task currently executing — used to serialize per endpoint. */
  private active = new Set<string>()
  private idle: Promise<void> = Promise.resolve()
  private resolveIdle: (() => void) | null = null
  private warnedFull = false

  constructor(
    private readonly maxPending: number = DEFAULT_MAX_PENDING,
    private readonly concurrency: number = DEFAULT_CONCURRENCY
  ) {}

  add(task: Task, key = '') {
    if (this.tasks.length >= this.maxPending) {
      this.tasks.shift()
      if (!this.warnedFull) {
        console.warn(
          `[EasyDocs] Capture queue is full (${this.maxPending} pending) — dropping oldest captures. ` +
          'Generation may be stalled (unreachable AI provider?).'
        )
        this.warnedFull = true
      }
    }
    this.tasks.push({ key, task })
    if (this.resolveIdle === null) {
      this.idle = new Promise<void>((resolve) => {
        this.resolveIdle = resolve
      })
    }
    this.pump()
  }

  /**
   * Resolves once every queued capture has finished. Adapters call this on
   * framework shutdown so in-flight spec generation isn't lost on deploy.
   */
  async flush(): Promise<void> {
    await this.idle
  }

  private pump() {
    while (this.running < this.concurrency) {
      // Skip entries whose key is already executing: same-endpoint tasks stay
      // strictly ordered, different endpoints proceed in parallel.
      const index = this.tasks.findIndex((e) => e.key === '' || !this.active.has(e.key))
      if (index === -1) break

      const [entry] = this.tasks.splice(index, 1)
      this.running++
      if (entry.key) this.active.add(entry.key)

      entry
        .task()
        .catch((err: unknown) => {
          console.error('[EasyDocs] Capture task failed:', err)
        })
        .finally(() => {
          this.running--
          if (entry.key) this.active.delete(entry.key)
          if (this.tasks.length > 0) {
            // Queue drained below the cap; allow a fresh warning if it fills again.
            if (this.warnedFull && this.tasks.length < this.maxPending) this.warnedFull = false
            this.pump()
          } else if (this.running === 0) {
            this.warnedFull = false
            this.resolveIdle?.()
            this.resolveIdle = null
          }
        })
    }
  }

  get size() {
    return this.tasks.length
  }
}

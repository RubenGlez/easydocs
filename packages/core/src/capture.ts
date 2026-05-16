import { globalQueue } from './queue.js'
import { buildOperation } from './spec/builder.js'
import { createDB, upsertEndpoint, getEndpointByPathMethod } from './storage/sqlite.js'
import { maybeStartDashboard } from './dashboard.js'
import type { CaptureEvent, EasyDocsConfig } from './types.js'

let db: ReturnType<typeof createDB> | null = null

function getDB(config?: EasyDocsConfig) {
  if (!db) db = createDB(config?.storage?.url)
  return db
}

function hashShape(value: unknown): string {
  const shape = extractShape(value)
  return JSON.stringify(shape)
}

function extractShape(value: unknown): unknown {
  if (value === null || value === undefined) return typeof value
  if (Array.isArray(value)) return [extractShape(value[0])]
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, extractShape(v)])
    )
  }
  return typeof value
}

function shouldCapture(path: string, config?: EasyDocsConfig): boolean {
  const captureConfig = config?.capture
  if (!captureConfig) return true

  const { ignoreRoutes, includePaths } = captureConfig

  if (ignoreRoutes?.some((r) => path.startsWith(r))) return false
  if (includePaths && !includePaths.some((p) => path.startsWith(p))) return false

  return true
}

export function capture(event: CaptureEvent, config?: EasyDocsConfig) {
  if (!shouldCapture(event.path, config)) return

  if (config?.dashboard?.autoStart === true) {
    maybeStartDashboard(config.dashboard.port ?? 4999).catch(() => {})
  }

  globalQueue.add(async () => {
    const database = getDB(config)
    const responseHash = hashShape(event.response)

    const existing = await getEndpointByPathMethod(database, event.path, event.method)

    // Skip AI processing if the response shape hasn't changed
    if (existing?.responseHash === responseHash && existing?.spec) return

    const spec = await buildOperation(event, existing?.spec ?? null, config?.ai)
    await upsertEndpoint(database, event.path, event.method, spec, responseHash)
  })
}

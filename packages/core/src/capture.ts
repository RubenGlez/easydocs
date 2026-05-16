import { globalQueue } from './queue.js'
import { buildOperation } from './spec/builder.js'
import { createDB, upsertEndpoint, getEndpointByPathMethod } from './storage/sqlite.js'
import { createPgDB, pgUpsertEndpoint, pgGetByPathMethod } from './storage/postgres.js'
import { maybeStartDashboard } from './dashboard.js'
import type { CaptureEvent, EasyDocsConfig } from './types.js'

type AnyDB = ReturnType<typeof createDB> | ReturnType<typeof createPgDB>

let db: AnyDB | null = null

function getDB(config?: EasyDocsConfig): AnyDB {
  if (!db) {
    if (config?.storage?.type === 'postgres' && config.storage.url) {
      db = createPgDB(config.storage.url)
    } else {
      db = createDB(config?.storage?.url)
    }
  }
  return db
}

function hashShape(value: unknown): string {
  return JSON.stringify(extractShape(value))
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
  const { ignoreRoutes, includePaths } = config?.capture ?? {}
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
    const isPostgres = config?.storage?.type === 'postgres'
    const database = getDB(config)
    const responseHash = hashShape(event.response)

    const existing = isPostgres
      ? await pgGetByPathMethod(database as ReturnType<typeof createPgDB>, event.path, event.method)
      : await getEndpointByPathMethod(database as ReturnType<typeof createDB>, event.path, event.method)

    if (existing?.responseHash === responseHash && existing?.spec) return

    const spec = await buildOperation(event, existing?.spec ?? null, config?.ai)

    if (isPostgres) {
      await pgUpsertEndpoint(
        database as ReturnType<typeof createPgDB>,
        event.path,
        event.method,
        spec,
        responseHash
      )
    } else {
      await upsertEndpoint(
        database as ReturnType<typeof createDB>,
        event.path,
        event.method,
        spec,
        responseHash
      )
    }
  })
}

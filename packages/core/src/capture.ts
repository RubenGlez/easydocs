import { globalQueue } from './queue.js'
import { buildOperation } from './spec/builder.js'
import {
  createDB,
  upsertEndpoint,
  getEndpointByPathMethod,
  findOrCreateProject,
} from './storage/sqlite.js'
import {
  createPgDB,
  pgUpsertEndpoint,
  pgGetByPathMethod,
  pgFindOrCreateProject,
} from './storage/postgres.js'
import { maybeStartDashboard } from './dashboard.js'
import type { CaptureEvent, EasyDocsConfig } from './types.js'

const DEFAULT_PROJECT = 'default'
let _aiKeyWarned = false

function warnIfNoAIKey(config?: EasyDocsConfig) {
  if (_aiKeyWarned) return
  const provider = config?.ai?.provider
  if (provider === 'ollama') return
  const hasKey =
    config?.ai?.apiKey ||
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.DEEPSEEK_API_KEY
  if (!hasKey) {
    _aiKeyWarned = true
    console.warn(
      '\n[EasyDocs] No AI key found. Specs will not be generated.\n' +
      '  Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or DEEPSEEK_API_KEY in your environment,\n' +
      '  or configure { ai: { provider: "ollama" } } to use a local model.\n'
    )
  }
}

type AnyDB = ReturnType<typeof createDB> | ReturnType<typeof createPgDB>

let db: AnyDB | null = null

function getDB(config?: EasyDocsConfig): AnyDB {
  if (!db) {
    db =
      config?.storage?.type === 'postgres' && config.storage.url
        ? createPgDB(config.storage.url, config.storage.poolSize)
        : createDB(config?.storage?.url)
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
  warnIfNoAIKey(config)

  if (config?.dashboard?.autoStart === true) {
    maybeStartDashboard(config.dashboard.port ?? 4999).catch(() => {})
  }

  const projectSlug = config?.project ?? DEFAULT_PROJECT
  const isPostgres = config?.storage?.type === 'postgres'

  globalQueue.add(async () => {
    const database = getDB(config)
    const responseHash = hashShape(event.response)

    const projectId = isPostgres
      ? await pgFindOrCreateProject(database as ReturnType<typeof createPgDB>, projectSlug)
      : await findOrCreateProject(database as ReturnType<typeof createDB>, projectSlug)

    const existing = isPostgres
      ? await pgGetByPathMethod(
          database as ReturnType<typeof createPgDB>,
          projectId,
          event.path,
          event.method
        )
      : await getEndpointByPathMethod(
          database as ReturnType<typeof createDB>,
          projectId,
          event.path,
          event.method
        )

    if (existing?.responseHash === responseHash && existing?.spec) return

    const spec = await buildOperation(event, existing?.spec ?? null, config?.ai)

    if (isPostgres) {
      await pgUpsertEndpoint(
        database as ReturnType<typeof createPgDB>,
        projectId,
        event.path,
        event.method,
        spec,
        responseHash
      )
    } else {
      await upsertEndpoint(
        database as ReturnType<typeof createDB>,
        projectId,
        event.path,
        event.method,
        spec,
        responseHash
      )
    }
  })
}

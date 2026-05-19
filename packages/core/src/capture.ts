import { globalQueue } from './queue.js'
import { buildOperation } from './spec/builder.js'
import { createAdapter } from './storage/adapter.js'
import type { DatabaseAdapter } from './storage/adapter.js'
import { hashShape } from './shape.js'
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

let _adapter: DatabaseAdapter | null = null

function getAdapter(config?: EasyDocsConfig): DatabaseAdapter {
  if (!_adapter) {
    _adapter = createAdapter(config?.storage)
  }
  return _adapter
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

  globalQueue.add(async () => {
    const adapter = getAdapter(config)
    const responseHash = hashShape(event.response)

    const projectId = await adapter.findOrCreateProject(projectSlug)
    const existing = await adapter.getEndpointByPathMethod(projectId, event.path, event.method)

    if (existing?.responseHash === responseHash && existing?.spec) return

    const spec = await buildOperation(event, existing?.spec ?? null, config?.ai)
    await adapter.upsertEndpoint(projectId, event.path, event.method, spec, responseHash)
  })
}

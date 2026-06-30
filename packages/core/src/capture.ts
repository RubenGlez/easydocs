import { CaptureQueue } from './queue.js'
import { buildOperation } from './spec/builder.js'
import { createAdapter } from './storage/adapter.js'
import { hashShape } from './shape.js'
import { maybeStartDashboard } from './dashboard.js'
import { detect, markSensitiveProperties } from './privacy/detect.js'
import { resolveProvider } from './ai/provider.js'
import type { CaptureEvent, EasyDocsConfig } from './types.js'

const DEFAULT_PROJECT = 'default'

function warnIfNoAIKey(config: EasyDocsConfig) {
  const provider = config.ai?.provider
  if (provider === 'ollama') return
  const hasKey =
    config.ai?.apiKey ||
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.DEEPSEEK_API_KEY
  if (hasKey) return

  if (provider) {
    // An explicit hosted provider was chosen but has no key — specs can't generate.
    console.warn(
      `\n[EasyDocs] No API key found for provider "${provider}". Specs will not be generated.\n` +
      '  Set the matching API key, or use { ai: { provider: "ollama" } } for a local model.\n'
    )
  } else {
    // No provider and no key → auto-fallback to a local Ollama server.
    console.warn(
      '\n[EasyDocs] No AI key found — falling back to local Ollama at localhost:11434.\n' +
      '  Make sure Ollama is running (https://ollama.com), or set OPENAI_API_KEY,\n' +
      '  ANTHROPIC_API_KEY, or DEEPSEEK_API_KEY to use a hosted provider.\n'
    )
  }
}

export interface Capturer {
  capture(event: CaptureEvent): void
}

export function createCapturer(config: EasyDocsConfig): Capturer {
  const adapter = createAdapter(config.storage)
  const queue = new CaptureQueue()
  warnIfNoAIKey(config)

  return {
    capture(event: CaptureEvent) {
      const { ignoreRoutes, includePaths } = config.capture ?? {}
      if (ignoreRoutes?.some((r) => event.path.startsWith(r))) return
      if (includePaths && !includePaths.some((p) => event.path.startsWith(p))) return

      if (config.dashboard?.autoStart === true) {
        maybeStartDashboard(config.dashboard.port ?? 4999).catch(() => {})
      }

      const projectSlug = config.project ?? DEFAULT_PROJECT

      queue.add(async () => {
        const responseHash = hashShape(event.response)
        const projectId = await adapter.findOrCreateProject(projectSlug)
        const existing = await adapter.getEndpointByPathMethod(projectId, event.path, event.method)
        if (existing?.responseHash === responseHash && existing?.spec) return

        // Detect PII/secrets. Redact before sending to a hosted provider so values
        // never leave the machine; for local Ollama keep real values (better
        // accuracy, nothing leaves the box). Either way, flag the fields. See ADR 0009.
        const privacyEnabled = config.privacy?.enabled !== false
        let eventForAI = event
        let sensitivePaths = new Set<string>()
        if (privacyEnabled) {
          const result = detect(event, config.privacy)
          sensitivePaths = result.sensitivePaths
          if (resolveProvider(config.ai) !== 'ollama') eventForAI = result.redactedEvent
        }

        const spec = await buildOperation(eventForAI, existing?.spec ?? null, config.ai)
        markSensitiveProperties(spec, sensitivePaths)
        await adapter.upsertEndpoint(projectId, event.path, event.method, spec, responseHash)
      })
    },
  }
}

import { CaptureQueue } from './queue.js'
import { buildOperation } from './spec/builder.js'
import { createAdapter } from './storage/adapter.js'
import { hashShape } from './shape.js'
import { maybeStartDashboard } from './dashboard.js'
import { detect, markSensitiveProperties } from './privacy/detect.js'
import { resolveProvider, isHostedProvider } from './ai/provider.js'
import type { CaptureEvent, EasyDocsConfig } from './types.js'

const DEFAULT_PROJECT = 'default'

// Only document methods that carry a documentable request/response. HEAD and
// OPTIONS (CORS preflight) reach some adapters' hooks but should never become an
// endpoint row or an LLM call. TRACE/CONNECT likewise.
const CAPTURED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])

// A response body we can't meaningfully document as a JSON schema: binary
// payloads (Buffers/streams serialize as {type:'Buffer',data:[…]} garbage) and
// non-JSON strings (text/plain, HTML) that adapters couldn't parse. Skip these
// captures rather than feed noise to the model. `null` (no body) is fine.
/** Approximate serialized byte length of a body, for the maxBodySize cap. */
function jsonSize(value: unknown): number {
  if (value == null) return 0
  try {
    return JSON.stringify(value)?.length ?? 0
  } catch {
    return 0
  }
}

function isNonJsonBody(value: unknown): boolean {
  if (value == null) return false
  if (typeof value === 'string') return true
  if (value instanceof Uint8Array || value instanceof ArrayBuffer) return true
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>
    if (o.type === 'Buffer' && Array.isArray(o.data)) return true
  }
  return false
}

// How many distinct request/response shapes to remember per endpoint before
// evicting the oldest. Bounds the tracking string; large enough to cover an
// endpoint's realistic set of status-class × shape combinations.
const MAX_SEEN_SHAPES = 50

// A capture only needs (re)generation when its *shape* is one we haven't
// documented yet. The key folds in the status class (so an endpoint that mixes
// 200 and 404 remembers both instead of thrashing) and the request-body shape
// (so a new request field re-triggers generation, not just a changed response).
function shapeKey(event: CaptureEvent): string {
  const statusClass = Math.floor(event.status / 100)
  return `${statusClass}:${hashShape(event.body)}:${hashShape(event.response)}`
}

// The endpoint's stored `responseHash` column holds the JSON-encoded set of seen
// shape keys. Tolerates the legacy format (a single bare response-shape hash).
function parseSeenShapes(raw?: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed as string[]
  } catch {
    // not JSON — a pre-set-tracking bare hash
  }
  return [raw]
}

const PROVIDER_ENV_KEY: Record<string, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
}

function warnIfNoAIKey(config: EasyDocsConfig) {
  const provider = config.ai?.provider
  if (provider === 'ollama') return
  if (config.ai?.apiKey) return

  // With an explicit hosted provider, only its matching env key counts — a
  // DEEPSEEK_API_KEY does not satisfy provider:'openai' (which would otherwise
  // warn nothing, then 401 on every generation).
  const hasKey = provider
    ? !!process.env[PROVIDER_ENV_KEY[provider]]
    : !!(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.DEEPSEEK_API_KEY)
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

// Stop attempting generation after this many consecutive failures — otherwise a
// misconfigured/unreachable provider (e.g. Ollama fallback with no server running)
// produces one error log per captured request, forever.
const FAILURE_CIRCUIT_THRESHOLD = 5

export function createCapturer(config: EasyDocsConfig): Capturer {
  const adapter = createAdapter(config.storage)
  const queue = new CaptureQueue()
  const offline = config.privacy?.offline === true
  let consecutiveFailures = 0
  let circuitOpen = false

  if (offline) {
    // Fail fast on a contradictory hosted provider, before any traffic is captured.
    resolveProvider(config.ai, true)
    console.warn(
      '\n[EasyDocs] Offline mode enabled — using a local Ollama model only.\n' +
      '  No captured data will be sent to a hosted AI provider.\n'
    )
  } else {
    warnIfNoAIKey(config)
  }

  return {
    capture(event: CaptureEvent) {
      if (!CAPTURED_METHODS.has(event.method)) return
      if (isNonJsonBody(event.response)) return

      const { ignoreRoutes, includePaths, maxBodySize } = config.capture ?? {}
      // Skip oversized payloads rather than deep-clone/redact/hash a huge body on
      // every capture. Enforces the documented capture.maxBodySize cap.
      if (maxBodySize !== undefined && (jsonSize(event.body) > maxBodySize || jsonSize(event.response) > maxBodySize)) {
        return
      }
      if (ignoreRoutes?.some((r) => event.path.startsWith(r))) return
      if (includePaths && !includePaths.some((p) => event.path.startsWith(p))) return

      if (config.dashboard?.autoStart === true) {
        maybeStartDashboard(config.dashboard.port ?? 4999).catch(() => {})
      }

      const projectSlug = config.project ?? DEFAULT_PROJECT

      queue.add(async () => {
        // Circuit is open: generation has been failing repeatedly, so don't keep
        // hammering the provider (and the error log) on every request.
        if (circuitOpen) return

        const key = shapeKey(event)
        const projectId = await adapter.findOrCreateProject(projectSlug)
        const existing = await adapter.getEndpointByPathMethod(projectId, event.path, event.method)
        const seen = parseSeenShapes(existing?.responseHash)
        // Skip only when this exact shape has already been documented.
        if (existing?.spec && seen.includes(key)) return

        // Detect PII/secrets. Redact before sending to a hosted provider so values
        // never leave the machine; for local Ollama keep real values (better
        // accuracy, nothing leaves the box). Either way, flag the fields. See ADR 0009.
        const privacyEnabled = config.privacy?.enabled !== false
        let eventForAI = event
        let sensitivePaths = new Set<string>()
        if (privacyEnabled) {
          const result = detect(event, config.privacy)
          sensitivePaths = result.sensitivePaths
          // Only a hosted provider receives payloads, so only then do we swap in the
          // redacted event. Offline mode is always local, so real values are kept.
          if (isHostedProvider(resolveProvider(config.ai, offline))) eventForAI = result.redactedEvent
        }

        let spec
        try {
          spec = await buildOperation(eventForAI, existing?.spec ?? null, config.ai, offline)
        } catch (err) {
          if (++consecutiveFailures >= FAILURE_CIRCUIT_THRESHOLD) {
            circuitOpen = true
            console.warn(
              `[EasyDocs] Disabling capture after ${FAILURE_CIRCUIT_THRESHOLD} consecutive ` +
              'generation failures. Check your AI provider (is Ollama running / is the API key valid?).'
            )
          }
          throw err
        }
        consecutiveFailures = 0

        markSensitiveProperties(spec, sensitivePaths)
        // Record this shape as seen (move-to-end, capped) so future identical
        // captures are skipped while genuinely new shapes still regenerate.
        const nextSeen = [...seen.filter((k) => k !== key), key].slice(-MAX_SEEN_SHAPES)
        await adapter.upsertEndpoint(
          projectId,
          event.path,
          event.method,
          spec,
          JSON.stringify(nextSeen)
        )
      })
    },
  }
}

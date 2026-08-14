import { CaptureQueue } from './queue.js'
import { buildOperation } from './spec/builder.js'
import { createAdapter } from './storage/adapter.js'
import { hashShape } from './shape.js'
import { exceedsJsonSize } from './size.js'
import { maybeStartDashboard } from './dashboard.js'
import { detect, markSensitiveProperties } from './privacy/detect.js'
import { resolveProvider, isHostedProvider } from './ai/provider.js'
import type { CaptureEvent, EasyDocsConfig } from './types.js'

const DEFAULT_PROJECT = 'default'

// Only document methods that carry a documentable request/response. HEAD and
// OPTIONS (CORS preflight) reach some adapters' hooks but should never become an
// endpoint row or an LLM call. TRACE/CONNECT likewise.
const CAPTURED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])

// Default cap on a captured body. Without a cap the queue can retain up to
// maxPending payloads of unbounded size in the host app's heap, so `capture` is
// bounded by default rather than only when the user opts in. Raise or lower with
// capture.maxBodySize.
export const DEFAULT_MAX_BODY_SIZE = 256 * 1024

// A response body we can't meaningfully document as a JSON schema: binary
// payloads (Buffers/streams serialize as {type:'Buffer',data:[…]} garbage) and
// non-JSON strings (text/plain, HTML) that adapters couldn't parse. Skip these
// captures rather than feed noise to the model. `null` (no body) is fine.
const JSON_CONTENT_TYPE = /^application\/([\w.+-]+\+)?json\b/i

/**
 * True when the response declared a content type we can't document as a JSON
 * schema (text/html, text/event-stream, an image…). Adapters null out bodies
 * they couldn't parse, so without this an SSE or HTML route still became an
 * endpoint row with an empty spec — and cost an LLM call to produce it. A
 * response with no content-type at all (204 No Content) is still documented.
 */
function hasNonJsonContentType(headers: Record<string, string>): boolean {
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() !== 'content-type') continue
    return value.trim() !== '' && !JSON_CONTENT_TYPE.test(value)
  }
  return false
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

// How many distinct request/response shapes to document per endpoint. Once an
// endpoint has this many, it is considered fully documented and stops
// regenerating: previously the oldest key was evicted, so an endpoint whose
// payload has many optional-field combinations would evict a shape, see it
// again, and pay for another LLM call — forever.
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
  /**
   * Resolves once every queued capture has finished. Adapters that have a
   * framework shutdown hook call this so a deploy doesn't discard specs that
   * were still generating.
   */
  flush(): Promise<void>
}

// Stop attempting generation after this many consecutive failures — otherwise a
// misconfigured/unreachable provider (e.g. Ollama fallback with no server running)
// produces one error log per captured request, forever.
const FAILURE_CIRCUIT_THRESHOLD = 5
// …but re-try one capture after this long. A tripped circuit used to be
// permanent for the process lifetime, so a transient outage (provider restart,
// rate limit, a 529) silently stopped all documentation until the next deploy.
const CIRCUIT_COOLDOWN_MS = 60_000

export function createCapturer(config: EasyDocsConfig): Capturer {
  const adapter = createAdapter(config.storage)
  const queue = new CaptureQueue()
  const offline = config.privacy?.offline === true
  let consecutiveFailures = 0
  let circuitOpenedAt = 0

  // Shapes already documented, per endpoint, mirrored in-process. The whole
  // point is that the *sync* path can drop a repeat capture without enqueueing
  // it: previously every request was queued and the dedup check happened inside
  // the task, so steady-state traffic retained its bodies in the queue and sat
  // behind whatever generation was in flight.
  const seenByEndpoint = new Map<string, Set<string>>()
  const inFlight = new Set<string>()
  const saturated = new Set<string>()

  function circuitIsOpen(): boolean {
    if (circuitOpenedAt === 0) return false
    if (Date.now() - circuitOpenedAt < CIRCUIT_COOLDOWN_MS) return true
    // Half-open: let one capture through. It either succeeds (closing the
    // circuit) or re-opens it for another cooldown.
    circuitOpenedAt = 0
    consecutiveFailures = FAILURE_CIRCUIT_THRESHOLD - 1
    return false
  }

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

  function enqueue(event: CaptureEvent) {
    if (!CAPTURED_METHODS.has(event.method)) return
    if (isNonJsonBody(event.response)) return
    if (hasNonJsonContentType(event.responseHeaders)) return

    const { ignoreRoutes, includePaths, maxBodySize } = config.capture ?? {}
    if (ignoreRoutes?.some((r) => event.path.startsWith(r))) return
    if (includePaths && !includePaths.some((p) => event.path.startsWith(p))) return

    // Skip oversized payloads rather than deep-clone/redact/hash a huge body on
    // every capture. Enforces the documented capture.maxBodySize cap.
    const limit = maxBodySize ?? DEFAULT_MAX_BODY_SIZE
    if (exceedsJsonSize(event.body, limit) || exceedsJsonSize(event.response, limit)) return

    if (config.dashboard?.autoStart === true) {
      maybeStartDashboard(config.dashboard.port ?? 4999).catch(() => {})
    }

    if (circuitIsOpen()) return

    const projectSlug = config.project ?? DEFAULT_PROJECT
    const endpointKey = `${projectSlug} ${event.method} ${event.path}`
    if (saturated.has(endpointKey)) return

    const key = shapeKey(event)
    if (seenByEndpoint.get(endpointKey)?.has(key)) return

    // Without this, a burst of identical first-time requests all enqueue before
    // the first one finishes, and each pays for its own LLM call.
    const flightKey = `${endpointKey} ${key}`
    if (inFlight.has(flightKey)) return
    inFlight.add(flightKey)

    queue.add(async () => {
      try {
        if (circuitIsOpen()) return

        const projectId = await adapter.findOrCreateProject(projectSlug)
        const existing = await adapter.getEndpointByPathMethod(projectId, event.path, event.method)

        // Merge what the DB already knows into the in-process cache, so a fresh
        // process doesn't regenerate everything it documented in a prior run.
        let seen = seenByEndpoint.get(endpointKey)
        if (!seen) {
          seen = new Set<string>()
          seenByEndpoint.set(endpointKey, seen)
        }
        for (const k of parseSeenShapes(existing?.responseHash)) seen.add(k)

        // Skip only when this exact shape has already been documented.
        if (existing?.spec && seen.has(key)) return

        if (seen.size >= MAX_SEEN_SHAPES) {
          saturated.add(endpointKey)
          console.warn(
            `[EasyDocs] ${event.method} ${event.path} has ${seen.size} distinct payload shapes — ` +
            'treating it as fully documented and skipping further generation for it. ' +
            'Highly variable payloads are documented from the shapes seen so far.'
          )
          return
        }

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
            circuitOpenedAt = Date.now()
            console.warn(
              `[EasyDocs] Pausing capture for ${CIRCUIT_COOLDOWN_MS / 1000}s after ` +
              `${FAILURE_CIRCUIT_THRESHOLD} consecutive generation failures. ` +
              'Check your AI provider (is Ollama running / is the API key valid?).'
            )
          }
          throw err
        }
        consecutiveFailures = 0
        circuitOpenedAt = 0

        markSensitiveProperties(spec, sensitivePaths)
        seen.add(key)
        await adapter.upsertEndpoint(
          projectId,
          event.path,
          event.method,
          spec,
          JSON.stringify([...seen].slice(-MAX_SEEN_SHAPES))
        )
      } finally {
        inFlight.delete(flightKey)
      }
    }, endpointKey)
  }

  return {
    capture(event: CaptureEvent) {
      // capture() is called synchronously from inside the host app's response
      // path (e.g. Express's res.json). A throw here would surface as an error
      // in the user's own handler, so documentation can never break their API.
      try {
        enqueue(event)
      } catch (err) {
        console.error('[EasyDocs] Capture failed:', err)
      }
    },
    flush: () => queue.flush(),
  }
}

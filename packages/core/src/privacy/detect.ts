import type { CaptureEvent } from '../types.js'
import type { PrivacyConfig } from '../types.js'
import type { Operation } from '../spec/schema.js'
import {
  normalizeKey,
  matchesSensitiveValue,
  SENSITIVE_KEY_NAMES,
  SENSITIVE_HEADER_NAMES,
} from './rules.js'

const DEFAULT_PLACEHOLDER = '[REDACTED]'

// Keep the auth scheme so detectAuthSchemes still recognizes the request after
// redaction — `Bearer <token>` becomes `Bearer [REDACTED]`, not a wiped header.
const AUTH_SCHEME_PREFIX = /^(Bearer|Basic|Digest|Negotiate|NTLM)\s+/i

interface DetectContext {
  placeholder: string
  allow: Set<string>
  keyNames: Set<string>
  valuePatterns: RegExp[]
  sensitivePaths: Set<string>
}

export interface DetectResult {
  /** A deep clone of the event with sensitive values replaced by the placeholder. */
  redactedEvent: CaptureEvent
  /** Property/key names that matched a rule, used to mark the generated Operation. */
  sensitivePaths: Set<string>
}

function redactValue(value: unknown, placeholder: string): string {
  if (typeof value === 'string') {
    const m = value.match(AUTH_SCHEME_PREFIX)
    if (m) return `${m[1]} ${placeholder}`
  }
  return placeholder
}

function isFlagged(key: string, value: unknown, ctx: DetectContext): boolean {
  if (ctx.keyNames.has(normalizeKey(key))) return true
  return typeof value === 'string' && matchesSensitiveValue(value, ctx.valuePatterns)
}

function redactTree(value: unknown, ctx: DetectContext): unknown {
  if (Array.isArray(value)) return value.map((v) => redactTree(v, ctx))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (ctx.allow.has(normalizeKey(k))) {
        out[k] = v
      } else if (isFlagged(k, v, ctx)) {
        ctx.sensitivePaths.add(k)
        out[k] = redactValue(v, ctx.placeholder)
      } else {
        out[k] = redactTree(v, ctx)
      }
    }
    return out
  }
  return value
}

function redactRecord(record: Record<string, string>, ctx: DetectContext): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(record)) {
    if (ctx.allow.has(normalizeKey(k))) {
      out[k] = v
    } else if (isFlagged(k, v, ctx)) {
      ctx.sensitivePaths.add(k)
      out[k] = redactValue(v, ctx.placeholder)
    } else {
      out[k] = v
    }
  }
  return out
}

function redactHeaders(headers: Record<string, string>, ctx: DetectContext): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers)) {
    if (ctx.allow.has(normalizeKey(k))) {
      out[k] = v
      continue
    }
    const sensitive =
      SENSITIVE_HEADER_NAMES.has(k.toLowerCase()) || isFlagged(k, v, ctx)
    if (sensitive) {
      ctx.sensitivePaths.add(k)
      out[k] = redactValue(v, ctx.placeholder)
    } else {
      out[k] = v
    }
  }
  return out
}

/**
 * Scan a CaptureEvent for sensitive fields. Returns a redacted clone (safe to send
 * to a hosted Provider) and the set of flagged key names. Pure and offline.
 */
export function detect(event: CaptureEvent, config?: PrivacyConfig): DetectResult {
  const ctx: DetectContext = {
    placeholder: config?.placeholder ?? DEFAULT_PLACEHOLDER,
    allow: new Set((config?.allowlist ?? []).map(normalizeKey)),
    keyNames: new Set([
      ...SENSITIVE_KEY_NAMES,
      ...(config?.customRules?.keyNames ?? []).map(normalizeKey),
    ]),
    valuePatterns: (config?.customRules?.valuePatterns ?? []).map((p) => new RegExp(p)),
    sensitivePaths: new Set<string>(),
  }

  const redactedEvent: CaptureEvent = {
    ...event,
    query: redactRecord(event.query, ctx),
    params: redactRecord(event.params, ctx),
    body: redactTree(event.body, ctx),
    response: redactTree(event.response, ctx),
    requestHeaders: redactHeaders(event.requestHeaders, ctx),
    responseHeaders: redactHeaders(event.responseHeaders, ctx),
  }

  return { redactedEvent, sensitivePaths: ctx.sensitivePaths }
}

const SENSITIVE_EXT = 'x-easydocs-sensitive'

function markSchema(schema: unknown, names: Set<string>): void {
  if (!schema || typeof schema !== 'object') return
  const s = schema as Record<string, unknown>
  const props = s.properties
  if (props && typeof props === 'object') {
    for (const [name, prop] of Object.entries(props as Record<string, unknown>)) {
      if (names.has(name) && prop && typeof prop === 'object') {
        ;(prop as Record<string, unknown>)[SENSITIVE_EXT] = true
      }
      markSchema(prop, names)
    }
  }
  if (s.items) markSchema(s.items, names)
}

function markContent(content: Record<string, { schema?: unknown }>, names: Set<string>): void {
  for (const mediaType of Object.values(content)) {
    if (mediaType?.schema) markSchema(mediaType.schema, names)
  }
}

/**
 * Stamp `x-easydocs-sensitive: true` on every Operation parameter or schema
 * property whose name matched a privacy rule. Mutates the Operation in place.
 */
export function markSensitiveProperties(operation: Operation, names: Set<string>): void {
  if (names.size === 0) return

  if (operation.parameters) {
    for (const p of operation.parameters) {
      if (names.has(p.name)) (p as Record<string, unknown>)[SENSITIVE_EXT] = true
    }
  }
  if (operation.requestBody?.content) markContent(operation.requestBody.content, names)
  if (operation.responses) {
    for (const response of Object.values(operation.responses)) {
      if (response?.content) markContent(response.content, names)
    }
  }
}

import type { CaptureEvent, HttpMethod } from './types.js'

export interface RawCaptureInput {
  method: string
  path: string
  query?: Record<string, unknown> | null
  params?: Record<string, unknown> | null
  requestBody?: unknown
  responseBody?: unknown
  status: number
  requestHeaders?: Record<string, unknown> | null
  responseHeaders?: Record<string, unknown> | null
  durationMs?: number
}

function normalizeRecord(value: Record<string, unknown> | null | undefined): Record<string, string> {
  if (!value) return {}
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v ?? '')])
  )
}

export function buildCaptureEvent(raw: RawCaptureInput): CaptureEvent {
  return {
    method: raw.method.toUpperCase() as HttpMethod,
    path: raw.path,
    query: normalizeRecord(raw.query),
    params: normalizeRecord(raw.params),
    body: raw.requestBody ?? null,
    response: raw.responseBody ?? null,
    status: raw.status,
    requestHeaders: normalizeRecord(raw.requestHeaders),
    responseHeaders: normalizeRecord(raw.responseHeaders),
    durationMs: raw.durationMs ?? 0,
  }
}

export function tryParseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

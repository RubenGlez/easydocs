// Endpoint identity normalization. Every adapter funnels its captured path
// through here so the stored identity is always a stable OpenAPI route template
// (`/users/{id}`), never a concrete URL (`/users/123`). This is what keeps one
// endpoint row (and one AI generation) per logical route regardless of how many
// distinct URLs hit it, and it keeps exported specs valid OpenAPI. See ADR 0007.

/** Convert Express/Fastify/Hono ":name" segments to OpenAPI "{name}". Idempotent. */
export function toOpenApiPath(path: string): string {
  return path
    .split('/')
    .map((seg) => (seg.startsWith(':') ? `{${seg.slice(1)}}` : seg))
    .join('/')
}

/**
 * Normalize a captured request path to a stable OpenAPI route template:
 * - ":name" template segments become "{name}" (Express/Fastify/Hono/NestJS).
 * - "{name}" segments are kept as-is.
 * - a concrete segment equal to a path-param value becomes "{name}", so
 *   adapters that report the concrete URL plus resolved params (h3, Elysia,
 *   Next.js) collapse "/users/123" and "/users/456" into one "/users/{id}".
 *
 * Segment matching is exact (after URL-decoding) so a param value can't
 * accidentally rewrite an unrelated segment that merely contains it.
 */
export function normalizePath(path: string, params?: Record<string, unknown> | null): string {
  const byValue = new Map<string, string>()
  if (params) {
    for (const [name, raw] of Object.entries(params)) {
      if (raw == null) continue
      const val = String(raw)
      if (val === '') continue
      byValue.set(val, name)
      try {
        byValue.set(decodeURIComponent(val), name)
      } catch {
        // malformed escape sequence — the raw value is still registered above
      }
    }
  }

  return path
    .split('/')
    .map((seg) => {
      if (seg === '') return seg
      if (seg.startsWith(':')) return `{${seg.slice(1)}}`
      if (seg.startsWith('{') && seg.endsWith('}')) return seg
      let decoded = seg
      try {
        decoded = decodeURIComponent(seg)
      } catch {
        // keep the raw segment for matching
      }
      const name = byValue.get(seg) ?? byValue.get(decoded)
      return name ? `{${name}}` : seg
    })
    .join('/')
}

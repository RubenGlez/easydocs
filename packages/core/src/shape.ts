export function extractShape(value: unknown): unknown {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (Array.isArray(value)) return [extractShape(value[0])]
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((k) => [k, extractShape((value as Record<string, unknown>)[k])])
    )
  }
  return typeof value
}

export function hashShape(value: unknown): string {
  return JSON.stringify(extractShape(value))
}

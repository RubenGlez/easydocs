// Shape extraction runs on the request hot path (see capture.ts), so it must
// terminate on any input a framework can hand us — including self-referential
// objects, which JSON.stringify would reject but which reach us unserialized.
const MAX_DEPTH = 20

function walk(value: unknown, depth: number, seen: Set<object>): unknown {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value !== 'object') return typeof value
  if (depth >= MAX_DEPTH) return 'object'

  const obj = value as object
  if (seen.has(obj)) return 'circular'
  seen.add(obj)
  try {
    if (Array.isArray(obj)) return [walk(obj[0], depth + 1, seen)]
    return Object.fromEntries(
      Object.keys(obj as Record<string, unknown>)
        .sort()
        .map((k) => [k, walk((obj as Record<string, unknown>)[k], depth + 1, seen)])
    )
  } finally {
    // Only reject cycles (an ancestor repeating), not a value that legitimately
    // appears twice in sibling positions.
    seen.delete(obj)
  }
}

export function extractShape(value: unknown): unknown {
  return walk(value, 0, new Set<object>())
}

export function hashShape(value: unknown): string {
  return JSON.stringify(extractShape(value))
}

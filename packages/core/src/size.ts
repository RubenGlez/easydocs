/**
 * True when `value` would serialize to more than `limit` bytes of JSON.
 *
 * Deliberately not `JSON.stringify(value).length > limit`: this runs inline in
 * the response path for every captured request, and the stringify version costs
 * the most on exactly the huge payloads the cap exists to reject (~2ms on 1MB).
 * This walk stops as soon as the budget is blown, so an oversized body costs
 * `limit` bytes of work, not its full size. Self-referential objects terminate
 * rather than overflowing the stack.
 */
export function exceedsJsonSize(value: unknown, limit: number): boolean {
  let budget = limit
  const seen = new Set<object>()

  function walk(v: unknown): boolean {
    if (budget < 0) return true
    if (v === null || v === undefined) {
      budget -= 4
      return budget < 0
    }
    switch (typeof v) {
      case 'string':
        budget -= v.length + 2
        return budget < 0
      case 'number':
      case 'boolean':
        budget -= 8
        return budget < 0
      case 'object':
        break
      default:
        return false
    }

    const obj = v as object
    if (seen.has(obj)) return false
    seen.add(obj)
    try {
      budget -= 2
      if (Array.isArray(obj)) {
        for (const item of obj) {
          if (walk(item)) return true
        }
        return false
      }
      for (const [k, val] of Object.entries(obj as Record<string, unknown>)) {
        budget -= k.length + 4
        if (budget < 0) return true
        if (walk(val)) return true
      }
      return false
    } finally {
      seen.delete(obj)
    }
  }

  return walk(value)
}

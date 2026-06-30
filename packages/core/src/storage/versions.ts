// Spec snapshots are deduped by content: a new version is only recorded when the
// effective spec actually changes. The model emits object keys in varying order,
// so equality is order-independent via a stable (key-sorted) stringification.

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    return Object.fromEntries(Object.keys(obj).sort().map((k) => [k, sortKeys(obj[k])]))
  }
  return value
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value))
}

export function specsEqual(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b)
}

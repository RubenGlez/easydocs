// Field-level diff between two OpenAPI Operation snapshots. Both objects are
// flattened to leaf paths (e.g. "responses.200.description", "parameters[0].name")
// and compared, yielding added / removed / changed fields.

function flatten(value: unknown, prefix = '', out: Record<string, unknown> = {}): Record<string, unknown> {
  if (Array.isArray(value)) {
    if (value.length === 0) out[prefix] = '[]'
    else value.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out))
  } else if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) out[prefix] = '{}'
    else for (const [k, v] of entries) flatten(v, prefix ? `${prefix}.${k}` : k, out)
  } else {
    out[prefix] = value
  }
  return out
}

export type SpecDiff = {
  added: { path: string; value: unknown }[]
  removed: { path: string; value: unknown }[]
  changed: { path: string; before: unknown; after: unknown }[]
}

export function diffSpecs(before: unknown, after: unknown): SpecDiff {
  const a = flatten(before)
  const b = flatten(after)
  const added: SpecDiff['added'] = []
  const removed: SpecDiff['removed'] = []
  const changed: SpecDiff['changed'] = []

  for (const path of Object.keys(b)) {
    if (!(path in a)) added.push({ path, value: b[path] })
    else if (JSON.stringify(a[path]) !== JSON.stringify(b[path]))
      changed.push({ path, before: a[path], after: b[path] })
  }
  for (const path of Object.keys(a)) {
    if (!(path in b)) removed.push({ path, value: a[path] })
  }

  const byPath = (x: { path: string }, y: { path: string }) => x.path.localeCompare(y.path)
  return { added: added.sort(byPath), removed: removed.sort(byPath), changed: changed.sort(byPath) }
}

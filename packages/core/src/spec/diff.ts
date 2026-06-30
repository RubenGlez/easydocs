// Field-level diff between two OpenAPI snapshots. Both objects are flattened to
// leaf paths (e.g. "paths./users.post.responses.200.description") and compared,
// yielding added / removed / changed fields. Shared by the dashboard
// version-history view and the `easydocs diff` CLI command.

function flatten(value: unknown, prefix = '', out: Record<string, unknown> = {}): Record<string, unknown> {
  if (Array.isArray(value)) {
    // The empty-collection marker is meaningful for a nested field, but at the
    // root it would make an empty baseline ({}) diff as a spurious removal.
    if (value.length === 0) { if (prefix) out[prefix] = '[]' }
    else value.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out))
  } else if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) { if (prefix) out[prefix] = '{}' }
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

export function isEmptyDiff(diff: SpecDiff): boolean {
  return diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0
}

function fmt(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value)
}

export interface RenderDiffOptions {
  markdown?: boolean
}

/** Render a SpecDiff as a human-readable terminal summary, or PR-comment Markdown. */
export function renderDiff(diff: SpecDiff, opts: RenderDiffOptions = {}): string {
  if (isEmptyDiff(diff)) {
    return opts.markdown ? '**No API spec changes.**' : 'No API spec changes.'
  }

  if (opts.markdown) {
    const lines: string[] = []
    if (diff.added.length) {
      lines.push(`**Added (${diff.added.length})**`, '')
      for (const a of diff.added) lines.push(`- \`${a.path}\` → ${fmt(a.value)}`)
      lines.push('')
    }
    if (diff.removed.length) {
      lines.push(`**Removed (${diff.removed.length})**`, '')
      for (const r of diff.removed) lines.push(`- \`${r.path}\` (was ${fmt(r.value)})`)
      lines.push('')
    }
    if (diff.changed.length) {
      lines.push(`**Changed (${diff.changed.length})**`, '')
      for (const c of diff.changed) lines.push(`- \`${c.path}\`: ${fmt(c.before)} → ${fmt(c.after)}`)
      lines.push('')
    }
    return lines.join('\n').trimEnd()
  }

  const lines: string[] = []
  if (diff.added.length) {
    lines.push(`Added (${diff.added.length}):`)
    for (const a of diff.added) lines.push(`  + ${a.path}  ${fmt(a.value)}`)
  }
  if (diff.removed.length) {
    lines.push(`Removed (${diff.removed.length}):`)
    for (const r of diff.removed) lines.push(`  - ${r.path}  ${fmt(r.value)}`)
  }
  if (diff.changed.length) {
    lines.push(`Changed (${diff.changed.length}):`)
    for (const c of diff.changed) lines.push(`  ~ ${c.path}: ${fmt(c.before)} -> ${fmt(c.after)}`)
  }
  return lines.join('\n')
}

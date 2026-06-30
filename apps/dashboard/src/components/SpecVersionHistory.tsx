'use client'

import { useEffect, useState } from 'react'
import { diffSpecs } from '@easydocs/core/spec/diff'
import type { Operation } from '@easydocs/core'

type Version = {
  id: string
  source: 'ai' | 'manual'
  spec: Operation
  createdAt: string
}

function fmt(ts: string) {
  const d = new Date(ts)
  return isNaN(d.getTime()) ? ts : d.toLocaleString()
}

function SourceBadge({ source }: { source: 'ai' | 'manual' }) {
  const cls =
    source === 'ai'
      ? 'bg-blue-500/15 text-blue-400 ring-blue-500/30'
      : 'bg-amber-500/15 text-amber-400 ring-amber-500/30'
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {source}
    </span>
  )
}

function val(v: unknown) {
  return typeof v === 'string' ? v : JSON.stringify(v)
}

function VersionSelect({
  versions,
  value,
  onChange,
  label,
}: {
  versions: Version[]
  value: string
  onChange: (id: string) => void
  label: string
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-zinc-500">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-200"
      >
        {versions.map((v, i) => (
          <option key={v.id} value={v.id}>
            #{versions.length - i} · {v.source} · {fmt(v.createdAt)}
          </option>
        ))}
      </select>
    </label>
  )
}

export function SpecVersionHistory({ endpointId }: { endpointId: string }) {
  const [versions, setVersions] = useState<Version[] | null>(null)
  const [fromId, setFromId] = useState<string>('')
  const [toId, setToId] = useState<string>('')

  useEffect(() => {
    let active = true
    fetch(`/api/endpoints/${endpointId}/versions`)
      .then((r) => r.json())
      .then((data: { versions: Version[] }) => {
        if (!active) return
        const vs = data.versions ?? []
        setVersions(vs)
        // Default: compare the second-newest (from) against the newest (to).
        setToId(vs[0]?.id ?? '')
        setFromId(vs[1]?.id ?? vs[0]?.id ?? '')
      })
      .catch(() => active && setVersions([]))
    return () => {
      active = false
    }
  }, [endpointId])

  if (versions === null) {
    return <div className="px-8 py-6 text-sm text-zinc-500">Loading history…</div>
  }
  if (versions.length === 0) {
    return <div className="px-8 py-6 text-sm text-zinc-500">No version history yet.</div>
  }

  const from = versions.find((v) => v.id === fromId)
  const to = versions.find((v) => v.id === toId)
  const diff = from && to ? diffSpecs(from.spec, to.spec) : null
  const unchanged = diff && !diff.added.length && !diff.removed.length && !diff.changed.length

  return (
    <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-6 pt-4">
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <span className="font-semibold uppercase tracking-wider">History</span>
        <span className="text-zinc-600">{versions.length} version{versions.length === 1 ? '' : 's'}</span>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <VersionSelect versions={versions} label="From" value={fromId} onChange={setFromId} />
        <span className="text-zinc-600">→</span>
        <VersionSelect versions={versions} label="To" value={toId} onChange={setToId} />
        {to && <SourceBadge source={to.source} />}
      </div>

      {!diff && <p className="text-sm text-zinc-500">Select two versions to compare.</p>}
      {fromId === toId && <p className="text-sm text-zinc-500">Pick two different versions to see a diff.</p>}
      {unchanged && fromId !== toId && (
        <p className="text-sm text-zinc-500">No field-level differences between these versions.</p>
      )}

      {diff && fromId !== toId && !unchanged && (
        <div className="rounded-lg border border-zinc-800 divide-y divide-zinc-800 font-mono text-xs">
          {diff.changed.map((c) => (
            <div key={`c-${c.path}`} className="px-4 py-2">
              <div className="text-zinc-400">{c.path}</div>
              <div className="text-red-400">- {val(c.before)}</div>
              <div className="text-emerald-400">+ {val(c.after)}</div>
            </div>
          ))}
          {diff.added.map((a) => (
            <div key={`a-${a.path}`} className="px-4 py-2 text-emerald-400">
              + {a.path}: {val(a.value)}
            </div>
          ))}
          {diff.removed.map((r) => (
            <div key={`r-${r.path}`} className="px-4 py-2 text-red-400">
              - {r.path}: {val(r.value)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

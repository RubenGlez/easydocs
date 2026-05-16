'use client'

import { useState } from 'react'
import type { Endpoint } from '@easydocs/core/schema'
import type { Operation } from '@easydocs/core'

interface Props {
  endpoint: Endpoint
  onSaved: (updated: Endpoint) => void
}

export function SpecEditor({ endpoint, onSaved }: Props) {
  const activeSpec = endpoint.isManuallyEdited ? endpoint.manualSpec : endpoint.spec
  const [value, setValue] = useState(() => JSON.stringify(activeSpec, null, 2))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setError(null)
    let parsed: Operation
    try {
      parsed = JSON.parse(value) as Operation
    } catch {
      setError('Invalid JSON')
      return
    }
    setSaving(true)
    const res = await fetch(`/api/endpoints/${endpoint.id}/spec`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spec: parsed }),
    })
    setSaving(false)
    if (res.ok) {
      onSaved({ ...endpoint, manualSpec: parsed, isManuallyEdited: true, hasConflict: false })
    } else {
      setError('Failed to save')
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
        <span className="text-xs text-zinc-400">Edit spec (JSON)</span>
        <div className="flex gap-2">
          {error && <span className="text-xs text-red-400">{error}</span>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-xs px-3 py-1 rounded bg-zinc-700 text-zinc-100 hover:bg-zinc-600 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
      <textarea
        className="flex-1 resize-none bg-zinc-950 text-zinc-200 font-mono text-xs p-4 focus:outline-none"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        spellCheck={false}
      />
    </div>
  )
}

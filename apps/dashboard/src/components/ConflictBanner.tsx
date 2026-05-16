'use client'

import { useState } from 'react'
import type { Endpoint } from '@easydocs/core/schema'

interface Props {
  endpoint: Endpoint
  onResolved: (updated: Endpoint) => void
}

export function ConflictBanner({ endpoint, onResolved }: Props) {
  const [resolving, setResolving] = useState(false)

  async function resolve(keep: 'ai' | 'manual') {
    setResolving(true)
    const res = await fetch(`/api/endpoints/${endpoint.id}/spec`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keep }),
    })
    setResolving(false)
    if (res.ok) {
      onResolved({
        ...endpoint,
        hasConflict: false,
        isManuallyEdited: keep === 'manual',
        manualSpec: keep === 'ai' ? null : endpoint.manualSpec,
        spec: keep === 'manual' ? endpoint.manualSpec : endpoint.spec,
      })
    }
  }

  return (
    <div className="mx-8 mt-6 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-amber-400">Spec conflict</p>
        <p className="text-xs text-amber-300/70 mt-0.5">
          New traffic generated an AI spec that differs from your manual edits. Choose which version
          to keep.
        </p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={() => resolve('manual')}
          disabled={resolving}
          className="text-xs px-3 py-1.5 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 disabled:opacity-50 transition-colors"
        >
          Keep mine
        </button>
        <button
          onClick={() => resolve('ai')}
          disabled={resolving}
          className="text-xs px-3 py-1.5 rounded bg-zinc-700 text-zinc-300 hover:bg-zinc-600 disabled:opacity-50 transition-colors"
        >
          Use AI
        </button>
      </div>
    </div>
  )
}

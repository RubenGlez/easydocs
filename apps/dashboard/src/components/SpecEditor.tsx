'use client'

import { useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { oneDark } from '@codemirror/theme-one-dark'
import type { Endpoint } from '@easydocs/core/schema'
import type { Operation } from '@easydocs/core'
import { OperationSchema } from '@easydocs/core'

interface Props {
  endpoint: Endpoint
  onSaved: (updated: Endpoint) => void
  onCancel: () => void
}

function validate(raw: string): string | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return 'Invalid JSON'
  }
  const result = OperationSchema.safeParse(parsed)
  if (!result.success) {
    const first = result.error.errors[0]
    return `${first.path.join('.') || 'root'}: ${first.message}`
  }
  return null
}

export function SpecEditor({ endpoint, onSaved, onCancel }: Props) {
  const activeSpec = endpoint.isManuallyEdited ? endpoint.manualSpec : endpoint.spec
  const [value, setValue] = useState(() => JSON.stringify(activeSpec, null, 2))
  const validationError = validate(value)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (validationError) return
    setSaveError(null)
    setSaving(true)
    const parsed = JSON.parse(value) as Operation
    const res = await fetch(`/api/endpoints/${endpoint.id}/spec`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spec: parsed }),
    })
    setSaving(false)
    if (res.ok) {
      onSaved({ ...endpoint, manualSpec: parsed, isManuallyEdited: true, hasConflict: false })
    } else {
      setSaveError('Failed to save')
    }
  }

  const invalid = validationError !== null

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
        <span className="text-xs text-zinc-400">Edit spec (JSON)</span>
        <div className="flex items-center gap-2">
          {saveError && <span className="text-xs text-red-400">{saveError}</span>}
          <button
            onClick={onCancel}
            className="text-xs px-3 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || invalid}
            className="text-xs px-3 py-1 rounded bg-zinc-700 text-zinc-100 hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <CodeMirror
          value={value}
          height="100%"
          extensions={[json()]}
          theme={oneDark}
          onChange={setValue}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            bracketMatching: true,
            autocompletion: true,
          }}
          style={{ fontSize: '12px', height: '100%' }}
        />
      </div>
      {validationError && (
        <div className="px-4 py-2 border-t border-red-900/50 bg-red-950/30 text-xs text-red-400 font-mono">
          {validationError}
        </div>
      )}
    </div>
  )
}

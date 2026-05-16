'use client'

import { useState } from 'react'
import { MethodBadge } from './MethodBadge'
import { SchemaViewer } from './SchemaViewer'
import { SpecEditor } from './SpecEditor'
import { ConflictBanner } from './ConflictBanner'
import type { Endpoint } from '@easydocs/core/schema'

export function EndpointDetail({ endpoint: initial }: { endpoint: Endpoint }) {
  const [endpoint, setEndpoint] = useState(initial)
  const [editing, setEditing] = useState(false)

  const activeSpec = endpoint.isManuallyEdited ? endpoint.manualSpec : endpoint.spec

  if (!activeSpec) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
        No spec available for this endpoint.
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {endpoint.hasConflict && (
        <ConflictBanner endpoint={endpoint} onResolved={setEndpoint} />
      )}

      <div className="flex items-center justify-between px-8 pt-6 pb-2">
        <div className="flex items-center gap-3">
          <MethodBadge method={endpoint.method} />
          <code className="text-lg font-mono text-zinc-100">{endpoint.path}</code>
          {endpoint.isManuallyEdited && !endpoint.hasConflict && (
            <span className="text-xs text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">edited</span>
          )}
        </div>
        <button
          onClick={() => setEditing((e) => !e)}
          className="text-xs px-3 py-1.5 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
        >
          {editing ? 'View docs' : 'Edit spec'}
        </button>
      </div>

      {editing ? (
        <div className="flex-1 overflow-hidden border-t border-zinc-800 mt-4">
          <SpecEditor endpoint={endpoint} onSaved={setEndpoint} />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-8">
          {activeSpec.summary && (
            <p className="text-zinc-300 text-sm">{activeSpec.summary}</p>
          )}
          {activeSpec.description && activeSpec.description !== activeSpec.summary && (
            <p className="text-zinc-500 text-sm">{activeSpec.description}</p>
          )}
          {activeSpec.deprecated && (
            <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-500/30">
              Deprecated
            </span>
          )}

          {activeSpec.parameters && activeSpec.parameters.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                Parameters
              </h3>
              <div className="rounded-lg border border-zinc-800 divide-y divide-zinc-800">
                {activeSpec.parameters.map((param) => (
                  <div key={`${param.in}-${param.name}`} className="px-4 py-3 flex gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="text-sm font-mono text-zinc-100">{param.name}</code>
                        <span className="text-xs text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
                          {param.in}
                        </span>
                        {param.required && <span className="text-xs text-red-400">required</span>}
                        {param.deprecated && (
                          <span className="text-xs text-yellow-400">deprecated</span>
                        )}
                      </div>
                      {param.description && (
                        <p className="text-sm text-zinc-500 mt-1">{param.description}</p>
                      )}
                    </div>
                    {param.schema && (
                      <div className="text-xs text-zinc-400 font-mono self-start">
                        {(param.schema as Record<string, unknown>).type as string}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeSpec.requestBody && (
            <section>
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                Request Body
              </h3>
              <div className="rounded-lg border border-zinc-800 p-4 bg-zinc-900/50">
                <SchemaViewer data={activeSpec.requestBody.content} />
              </div>
            </section>
          )}

          {Object.keys(activeSpec.responses ?? {}).length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                Responses
              </h3>
              <div className="space-y-3">
                {Object.entries(activeSpec.responses).map(([status, response]) => (
                  <div key={status} className="rounded-lg border border-zinc-800 overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-2 bg-zinc-900/50 border-b border-zinc-800">
                      <StatusBadge code={status} />
                      <span className="text-sm text-zinc-400">{response.description}</span>
                    </div>
                    {response.content && (
                      <div className="p-4">
                        <SchemaViewer data={response.content} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ code }: { code: string }) {
  const n = parseInt(code, 10)
  const color =
    n < 300
      ? 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/30'
      : n < 400
        ? 'bg-blue-500/15 text-blue-400 ring-blue-500/30'
        : n < 500
          ? 'bg-amber-500/15 text-amber-400 ring-amber-500/30'
          : 'bg-red-500/15 text-red-400 ring-red-500/30'
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold ring-1 ring-inset font-mono ${color}`}>
      {code}
    </span>
  )
}

'use client'

import { useState, useCallback } from 'react'
import { MethodBadge } from './MethodBadge'
import { SpecEditor } from './SpecEditor'
import { SpecVersionHistory } from './SpecVersionHistory'
import { ConflictBanner } from './ConflictBanner'
import type { Endpoint } from '@easydocs/core/schema'

export function EndpointDetail({ endpoint: initial }: { endpoint: Endpoint }) {
  const [endpoint, setEndpoint] = useState(initial)
  const [editing, setEditing] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [exampleOpen, setExampleOpen] = useState<Record<string, boolean>>({})
  const toggleExample = useCallback((key: string) => {
    setExampleOpen((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

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
        <div className="flex items-center gap-3 flex-wrap">
          <MethodBadge method={endpoint.method} />
          <code className="text-lg font-mono text-zinc-100">{endpoint.path}</code>
          {endpoint.isManuallyEdited && !endpoint.hasConflict && (
            <span className="text-xs text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">edited</span>
          )}
          {activeSpec.tags?.map((tag) => (
            <span key={tag} className="text-xs text-zinc-400 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded-full">
              {tag}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowHistory((h) => !h); setEditing(false) }}
            className="text-xs px-3 py-1.5 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
          >
            {showHistory ? 'View docs' : 'History'}
          </button>
          <button
            onClick={() => { setEditing((e) => !e); setShowHistory(false) }}
            className="text-xs px-3 py-1.5 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
          >
            {editing ? 'View docs' : 'Edit spec'}
          </button>
        </div>
      </div>

      {editing ? (
        <div className="flex-1 overflow-hidden border-t border-zinc-800 mt-4">
          <SpecEditor endpoint={endpoint} onSaved={setEndpoint} onCancel={() => setEditing(false)} />
        </div>
      ) : showHistory ? (
        <div className="flex-1 overflow-hidden border-t border-zinc-800 mt-4 flex flex-col">
          <SpecVersionHistory endpointId={endpoint.id} />
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
                  <div key={`${param.in}-${param.name}`} className={`px-4 py-3 flex gap-4 ${param.deprecated ? 'bg-yellow-500/5' : ''}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className={`text-sm font-mono ${param.deprecated ? 'line-through text-zinc-500' : 'text-zinc-100'}`}>
                          {param.name}
                        </code>
                        <span className="text-xs text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
                          {param.in}
                        </span>
                        {param.required && <span className="text-xs text-red-400">required</span>}
                        {(param as Record<string, unknown>)['x-easydocs-sensitive'] === true && <SensitiveBadge />}
                        {param.deprecated && (
                          <span className="text-xs font-medium text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 px-1.5 py-0.5 rounded">
                            deprecated
                          </span>
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

          {activeSpec.security && activeSpec.security.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                Security
              </h3>
              <div className="flex flex-wrap gap-2">
                {activeSpec.security.flatMap((requirement) =>
                  Object.keys(requirement).map((scheme) => (
                    <SecurityBadge key={scheme} scheme={scheme} />
                  ))
                )}
              </div>
            </section>
          )}

          {activeSpec.requestBody && (
            <section>
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                Request Body
              </h3>
              <ContentFields content={activeSpec.requestBody.content} />
            </section>
          )}

          {Object.keys(activeSpec.responses ?? {}).length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                Responses
              </h3>
              <div className="space-y-3">
                {Object.entries(activeSpec.responses).map(([status, response]) => {
                  const mediaType = response.content ? Object.values(response.content)[0] : null
                  const example = mediaType?.example
                  const hasExample = example !== undefined
                  const isOpen = exampleOpen[status] ?? false

                  return (
                    <div key={status} className="rounded-lg border border-zinc-800 overflow-hidden">
                      <div className="flex items-center gap-3 px-4 py-2 bg-zinc-900/50 border-b border-zinc-800">
                        <StatusBadge code={status} />
                        <span className="text-sm text-zinc-400 flex-1">{response.description}</span>
                        {hasExample && (
                          <button
                            onClick={() => toggleExample(status)}
                            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                          >
                            {isOpen ? 'Hide example' : 'Example'}
                          </button>
                        )}
                      </div>
                      {response.content && !isOpen && (
                        <div className="p-4">
                          <ContentFields content={response.content} />
                        </div>
                      )}
                      {hasExample && isOpen && (
                        <pre className="p-4 text-xs font-mono text-zinc-300 leading-5 overflow-x-auto">
                          {JSON.stringify(example, null, 2)}
                        </pre>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

type JsonSchema = {
  type?: string
  format?: string
  description?: string
  enum?: unknown[]
  properties?: Record<string, JsonSchema>
  required?: string[]
  items?: JsonSchema
  'x-easydocs-sensitive'?: boolean
}

function SensitiveBadge() {
  return (
    <span className="text-xs font-medium text-rose-400 bg-rose-500/10 border border-rose-500/30 px-1.5 py-0.5 rounded">
      sensitive
    </span>
  )
}

function ContentFields({ content }: { content: Record<string, { schema?: JsonSchema }> }) {
  const mediaType = Object.values(content ?? {})[0]
  const schema = mediaType?.schema
  if (!schema) return null

  if (schema.type === 'object' && schema.properties) {
    return (
      <PropertiesTable properties={schema.properties} required={schema.required ?? []} depth={0} />
    )
  }

  if (schema.type === 'array' && schema.items) {
    return (
      <div>
        <p className="text-xs text-zinc-500 mb-2 font-mono">array of object</p>
        {schema.items.properties && (
          <PropertiesTable
            properties={schema.items.properties}
            required={schema.items.required ?? []}
            depth={0}
          />
        )}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-zinc-800 px-4 py-3 text-xs text-zinc-400 font-mono">
      {schema.type ?? 'unknown'}
      {schema.format ? <span className="text-zinc-500">({schema.format})</span> : null}
    </div>
  )
}

function PropertiesTable({
  properties,
  required,
  depth,
}: {
  properties: Record<string, JsonSchema>
  required: string[]
  depth: number
}) {
  return (
    <div className={`rounded-lg border border-zinc-800 divide-y divide-zinc-800 ${depth > 0 ? 'mt-2' : ''}`}>
      {Object.entries(properties).map(([name, schema]) => {
        const isRequired = required.includes(name)
        const isArrayOfObject = schema.type === 'array' && schema.items?.properties
        const typeLabel = isArrayOfObject
          ? 'array of object'
          : schema.type === 'array'
            ? `array[${schema.items?.type ?? 'unknown'}]`
            : (schema.type ?? 'unknown')
        const formatSuffix = schema.format ? `(${schema.format})` : ''
        const hasNestedObject = schema.type === 'object' && schema.properties
        const hasNestedArray = isArrayOfObject

        return (
          <div key={name} className="px-4 py-3">
            <div className="flex gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="text-sm font-mono text-zinc-100">{name}</code>
                  {isRequired ? (
                    <span className="text-xs text-red-400">required</span>
                  ) : (
                    <span className="text-xs text-zinc-600">optional</span>
                  )}
                  {schema['x-easydocs-sensitive'] && <SensitiveBadge />}
                  {schema.description && (
                    <p className="text-sm text-zinc-500 mt-1 w-full">{schema.description}</p>
                  )}
                  {schema.enum && (
                    <p className="text-xs text-zinc-500 mt-1 w-full">
                      One of:{' '}
                      {schema.enum.map((v, i) => (
                        <code key={i} className="text-zinc-300 bg-zinc-800 px-1 rounded mx-0.5">
                          {String(v)}
                        </code>
                      ))}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-xs text-zinc-400 font-mono self-start whitespace-nowrap">
                {typeLabel}
                {formatSuffix && <span className="text-zinc-500">{formatSuffix}</span>}
              </div>
            </div>
            {hasNestedObject && (
              <PropertiesTable
                properties={schema.properties!}
                required={schema.required ?? []}
                depth={depth + 1}
              />
            )}
            {hasNestedArray && (
              <PropertiesTable
                properties={schema.items!.properties!}
                required={schema.items!.required ?? []}
                depth={depth + 1}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

const SCHEME_META: Record<string, { label: string; detail: string }> = {
  bearerAuth:   { label: 'Bearer',    detail: 'http, bearer' },
  basicAuth:    { label: 'Basic',     detail: 'http, basic' },
  apiKeyHeader: { label: 'API Key',   detail: 'apiKey, header' },
  apiKeyQuery:  { label: 'API Key',   detail: 'apiKey, query' },
  cookieAuth:   { label: 'Cookie',    detail: 'apiKey, cookie' },
}

function SecurityBadge({ scheme }: { scheme: string }) {
  const meta = SCHEME_META[scheme] ?? { label: scheme, detail: 'unknown' }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs">
      <span className="text-amber-400 font-medium">{meta.label}</span>
      <span className="text-zinc-500">({meta.detail})</span>
    </span>
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

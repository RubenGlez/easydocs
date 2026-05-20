'use client'

function ValueNode({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value === null) return <span className="text-zinc-500">null</span>
  if (value === undefined) return <span className="text-zinc-500">undefined</span>

  if (typeof value === 'boolean')
    return <span className="text-purple-400">{String(value)}</span>
  if (typeof value === 'number')
    return <span className="text-amber-400">{String(value)}</span>
  if (typeof value === 'string')
    return <span className="text-green-400">&quot;{value}&quot;</span>

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-zinc-400">[]</span>
    return (
      <span>
        <span className="text-zinc-400">[</span>
        <div className="ml-4">
          {value.map((item, i) => (
            <div key={i}>
              <ValueNode value={item} depth={depth + 1} />
              {i < value.length - 1 && <span className="text-zinc-600">,</span>}
            </div>
          ))}
        </div>
        <span className="text-zinc-400">]</span>
      </span>
    )
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) return <span className="text-zinc-400">{'{}'}</span>
    return (
      <span>
        <span className="text-zinc-400">{'{'}</span>
        <div className="ml-4">
          {entries.map(([k, v], i) => (
            <div key={k}>
              <span className="text-sky-300">&quot;{k}&quot;</span>
              <span className="text-zinc-400">: </span>
              <ValueNode value={v} depth={depth + 1} />
              {i < entries.length - 1 && <span className="text-zinc-600">,</span>}
            </div>
          ))}
        </div>
        <span className="text-zinc-400">{'}'}</span>
      </span>
    )
  }

  return <span className="text-zinc-300">{String(value)}</span>
}

export function SchemaViewer({ data }: { data: unknown }) {
  return (
    <pre className="text-xs leading-5 font-mono overflow-x-auto">
      <ValueNode value={data} />
    </pre>
  )
}

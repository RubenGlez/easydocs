'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { MethodBadge } from './MethodBadge'
import { EndpointDetail } from './EndpointDetail'
import type { Endpoint, Project } from '@easydocs/core/schema'

interface Props {
  endpoints: Endpoint[]
  projects: Project[]
  currentProject?: string
}

export function Dashboard({ endpoints, projects, currentProject }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<Endpoint | null>(endpoints[0] ?? null)
  const [search, setSearch] = useState('')

  const filtered = useMemo(
    () =>
      endpoints.filter(
        (e) =>
          e.path.toLowerCase().includes(search.toLowerCase()) ||
          e.method.toLowerCase().includes(search.toLowerCase()) ||
          e.spec?.summary?.toLowerCase().includes(search.toLowerCase())
      ),
    [endpoints, search]
  )

  const grouped = useMemo(() => {
    const groups: Record<string, Endpoint[]> = {}
    for (const e of filtered) {
      const tag = e.spec?.tags?.[0] ?? 'other'
      if (!groups[tag]) groups[tag] = []
      groups[tag].push(e)
    }
    return groups
  }, [filtered])

  function handleProjectChange(slug: string) {
    router.push(slug === '__all' ? '/' : `/?project=${slug}`)
  }

  const exportBase = currentProject ? `/api/export?project=${currentProject}` : '/api/export'

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100">
      {/* Sidebar */}
      <aside className="w-72 flex-shrink-0 border-r border-zinc-800 flex flex-col">
        <div className="p-4 border-b border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-zinc-100">EasyDocs</span>
            <span className="text-xs text-zinc-500">{endpoints.length} endpoints</span>
          </div>

          {projects.length > 1 && (
            <select
              value={currentProject ?? '__all'}
              onChange={(e) => handleProjectChange(e.target.value)}
              className="w-full rounded-md bg-zinc-900 border border-zinc-700 px-2 py-1.5 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            >
              <option value="__all">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          {projects.length === 1 && (
            <div className="text-xs text-zinc-500">
              Project: <span className="text-zinc-300">{projects[0].name}</span>
            </div>
          )}

          <input
            type="text"
            placeholder="Search endpoints…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md bg-zinc-900 border border-zinc-700 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          />
        </div>

        {endpoints.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <p className="text-zinc-500 text-sm">No endpoints documented yet.</p>
            <p className="text-zinc-600 text-xs mt-1">
              Add EasyDocs middleware to your server and make some requests.
            </p>
          </div>
        ) : (
          <nav className="flex-1 overflow-y-auto p-2">
            {Object.entries(grouped).map(([tag, items]) => (
              <div key={tag} className="mb-4">
                <div className="px-2 py-1 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  {tag}
                </div>
                {items.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => setSelected(e)}
                    className={`w-full flex items-center gap-2 px-2 py-2 rounded-md text-left transition-colors ${
                      selected?.id === e.id
                        ? 'bg-zinc-800 text-zinc-100'
                        : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                    }`}
                  >
                    <MethodBadge method={e.method} />
                    <span className="text-xs font-mono truncate flex-1">{e.path}</span>
                    {e.hasConflict && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            ))}
          </nav>
        )}

        <div className="p-3 border-t border-zinc-800 flex gap-2">
          <a
            href={`${exportBase}&format=json`}
            className="flex-1 text-center text-xs py-1.5 rounded-md bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
          >
            Export JSON
          </a>
          <a
            href={`${exportBase}&format=yaml`}
            className="flex-1 text-center text-xs py-1.5 rounded-md bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
          >
            Export YAML
          </a>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-hidden">
        {selected ? (
          <EndpointDetail endpoint={selected} />
        ) : (
          <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
            Select an endpoint to view its documentation.
          </div>
        )}
      </main>
    </div>
  )
}

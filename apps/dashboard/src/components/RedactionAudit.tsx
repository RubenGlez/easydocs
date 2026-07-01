'use client'

import { MethodBadge } from './MethodBadge'
import type { Endpoint } from '@easydocs/core/schema'
import type { SensitiveField } from '@easydocs/core/privacy/audit'

export interface AuditItem {
  endpoint: Endpoint
  fields: SensitiveField[]
}

interface Props {
  items: AuditItem[]
  total: number
}

export function RedactionAudit({ items, total }: Props) {
  const endpointCount = items.length

  return (
    <div className="h-full overflow-y-auto p-6">
      <header className="mb-6">
        <h2 className="text-lg font-semibold text-zinc-100">Sensitive fields</h2>
        <p className="text-sm text-zinc-500 mt-1">
          {total === 0 ? (
            'No sensitive fields detected in the captured traffic.'
          ) : (
            <>
              <span className="text-zinc-300">{total}</span> field{total === 1 ? '' : 's'} across{' '}
              <span className="text-zinc-300">{endpointCount}</span> endpoint
              {endpointCount === 1 ? '' : 's'} were detected and flagged. Values are redacted
              before any payload reaches a hosted AI provider — and kept local when using an
              offline model.
            </>
          )}
        </p>
      </header>

      {items.map(({ endpoint, fields }) => (
        <section key={endpoint.id} className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <MethodBadge method={endpoint.method} />
            <span className="text-sm font-mono text-zinc-300">{endpoint.path}</span>
          </div>
          <ul className="flex flex-wrap gap-2">
            {fields.map((f, i) => (
              <li
                key={`${f.location}-${f.field}-${i}`}
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 text-xs"
              >
                <span className="font-mono text-emerald-300">{f.field}</span>
                <span className="text-emerald-500/70">{f.location}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

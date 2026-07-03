'use client'

import type { DriftReport, DriftFinding } from '@easydocs/core'

interface Props {
  report: DriftReport
  specPath: string
}

function fmt(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function Section({
  title,
  hint,
  accent,
  findings,
  render,
}: {
  title: string
  hint: string
  accent: string
  findings: DriftFinding[]
  render: (f: DriftFinding) => React.ReactNode
}) {
  if (findings.length === 0) return null
  return (
    <section className="mb-6">
      <div className="flex items-baseline gap-2 mb-2">
        <h3 className={`text-sm font-semibold ${accent}`}>{title}</h3>
        <span className="text-xs text-zinc-500">{findings.length}</span>
      </div>
      <p className="text-xs text-zinc-500 mb-3">{hint}</p>
      <ul className="space-y-1">
        {findings.map((f, i) => (
          <li
            key={`${f.path}-${i}`}
            className="rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs font-mono text-zinc-300 break-all"
          >
            {render(f)}
          </li>
        ))}
      </ul>
    </section>
  )
}

export function DriftSummary({ report, specPath }: Props) {
  const total = report.undocumented.length + report.unobserved.length + report.mismatch.length

  return (
    <div className="h-full overflow-y-auto p-6">
      <header className="mb-6">
        <h2 className="text-lg font-semibold text-zinc-100">Docs-vs-reality drift</h2>
        <p className="text-sm text-zinc-500 mt-1">
          Comparing <span className="text-zinc-300 font-mono">{specPath}</span> against the spec
          derived from observed traffic.
        </p>
      </header>

      {total === 0 ? (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          Your spec matches observed traffic. No drift.
        </div>
      ) : (
        <>
          <Section
            title="Undocumented"
            hint="Observed in traffic but missing from your spec — your docs are stale."
            accent="text-rose-400"
            findings={report.undocumented}
            render={(f) => (
              <>
                <span className="text-rose-400">+ </span>
                {f.path} <span className="text-zinc-500">→ {fmt(f.observed)}</span>
              </>
            )}
          />
          <Section
            title="Mismatch"
            hint="Your spec contradicts what traffic actually shows."
            accent="text-amber-400"
            findings={report.mismatch}
            render={(f) => (
              <>
                <span className="text-amber-400">~ </span>
                {f.path}: <span className="text-zinc-500">{fmt(f.documented)} → {fmt(f.observed)}</span>
              </>
            )}
          />
          <Section
            title="Documented but unobserved"
            hint="In your spec but never seen in traffic — possibly dead or un-exercised."
            accent="text-zinc-400"
            findings={report.unobserved}
            render={(f) => (
              <>
                <span className="text-zinc-500">− </span>
                {f.path} <span className="text-zinc-500">(documented {fmt(f.documented)})</span>
              </>
            )}
          />
        </>
      )}
    </div>
  )
}

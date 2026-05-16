const styles: Record<string, string> = {
  GET: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/30',
  POST: 'bg-blue-500/15 text-blue-400 ring-blue-500/30',
  PUT: 'bg-amber-500/15 text-amber-400 ring-amber-500/30',
  PATCH: 'bg-orange-500/15 text-orange-400 ring-orange-500/30',
  DELETE: 'bg-red-500/15 text-red-400 ring-red-500/30',
}

export function MethodBadge({ method }: { method: string }) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold ring-1 ring-inset font-mono min-w-[46px] justify-center ${styles[method] ?? 'bg-zinc-500/15 text-zinc-400 ring-zinc-500/30'}`}
    >
      {method}
    </span>
  )
}

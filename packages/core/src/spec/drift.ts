// Docs-vs-reality drift. Unlike `diffSpecs` (which compares two specs
// symmetrically), drift is directional: one side is the spec you *documented*
// (a committed openapi.json), the other is the spec EasyDocs *observed* from
// real traffic. It answers "is my spec still true?", not "did my spec change?".
//
// This is the one comparison only EasyDocs can make, because it is the only tool
// that holds both halves — the committed spec and the live traffic — at once.
// It reuses the field-level `diffSpecs` engine and reinterprets the result:
//
//   observed but not documented  → undocumented (your spec is stale)
//   documented but not observed  → unobserved   (dead or un-exercised)
//   documented value ≠ observed  → mismatch     (your spec contradicts reality)

import { diffSpecs } from './diff.js'

export type DriftKind = 'undocumented' | 'unobserved' | 'mismatch'

export interface DriftFinding {
  path: string
  /** Value in the committed spec (present for `unobserved` and `mismatch`). */
  documented?: unknown
  /** Value seen in observed traffic (present for `undocumented` and `mismatch`). */
  observed?: unknown
}

export interface DriftReport {
  /** Observed in traffic but missing from the committed spec — the spec is stale. */
  undocumented: DriftFinding[]
  /** Present in the committed spec but never observed — possibly dead or un-exercised. */
  unobserved: DriftFinding[]
  /** Documented value contradicts what traffic actually shows. */
  mismatch: DriftFinding[]
}

export interface ComputeDriftOptions {
  /**
   * Only consider leaf paths under this prefix. Defaults to `'paths.'` so drift
   * focuses on the endpoint contract and ignores expected metadata differences
   * (info.title, openapi version, components layout) between a hand-written spec
   * and a generated one. Pass `''` to compare the whole document.
   */
  scope?: string
}

/**
 * Compare a documented spec against an observed one and classify the divergence.
 * Pure and deterministic — no I/O.
 */
export function computeDrift(
  documented: unknown,
  observed: unknown,
  opts: ComputeDriftOptions = {}
): DriftReport {
  const scope = opts.scope ?? 'paths.'
  const inScope = (p: string) => scope === '' || p.startsWith(scope)

  // diffSpecs(documented, observed): `added` is in observed-not-documented,
  // `removed` is in documented-not-observed, `changed` is both-but-differ.
  const diff = diffSpecs(documented, observed)

  return {
    undocumented: diff.added
      .filter((f) => inScope(f.path))
      .map((f) => ({ path: f.path, observed: f.value })),
    unobserved: diff.removed
      .filter((f) => inScope(f.path))
      .map((f) => ({ path: f.path, documented: f.value })),
    mismatch: diff.changed
      .filter((f) => inScope(f.path))
      .map((f) => ({ path: f.path, documented: f.before, observed: f.after })),
  }
}

export function isEmptyDrift(report: DriftReport): boolean {
  return (
    report.undocumented.length === 0 &&
    report.unobserved.length === 0 &&
    report.mismatch.length === 0
  )
}

export function driftCount(report: DriftReport): number {
  return report.undocumented.length + report.unobserved.length + report.mismatch.length
}

function fmt(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value)
}

export interface RenderDriftOptions {
  markdown?: boolean
}

/** Render a DriftReport as a human-readable terminal summary, or PR-comment Markdown. */
export function renderDrift(report: DriftReport, opts: RenderDriftOptions = {}): string {
  if (isEmptyDrift(report)) {
    return opts.markdown
      ? '**No API drift** — your spec matches observed traffic.'
      : 'No API drift — your spec matches observed traffic.'
  }

  const total = driftCount(report)
  const undoc = 'Undocumented — observed in traffic, missing from your spec'
  const unobs = 'Documented but unobserved — in your spec, never seen in traffic'
  const mism = 'Mismatch — your spec contradicts observed traffic'

  if (opts.markdown) {
    const lines: string[] = [
      `**API drift: ${total} finding${total === 1 ? '' : 's'}** — your spec is out of sync with observed traffic.`,
      '',
    ]
    if (report.undocumented.length) {
      lines.push(`**${undoc}** (${report.undocumented.length})`, '')
      for (const f of report.undocumented) lines.push(`- \`${f.path}\` → ${fmt(f.observed)}`)
      lines.push('')
    }
    if (report.unobserved.length) {
      lines.push(`**${unobs}** (${report.unobserved.length})`, '')
      for (const f of report.unobserved) lines.push(`- \`${f.path}\` (documented ${fmt(f.documented)})`)
      lines.push('')
    }
    if (report.mismatch.length) {
      lines.push(`**${mism}** (${report.mismatch.length})`, '')
      for (const f of report.mismatch) lines.push(`- \`${f.path}\`: ${fmt(f.documented)} → ${fmt(f.observed)}`)
      lines.push('')
    }
    return lines.join('\n').trimEnd()
  }

  const lines: string[] = [
    `API drift: ${total} finding${total === 1 ? '' : 's'} — your spec is out of sync with observed traffic.`,
    '',
  ]
  if (report.undocumented.length) {
    lines.push(`${undoc} (${report.undocumented.length}):`)
    for (const f of report.undocumented) lines.push(`  + ${f.path}  ${fmt(f.observed)}`)
  }
  if (report.unobserved.length) {
    lines.push(`${unobs} (${report.unobserved.length}):`)
    for (const f of report.unobserved) lines.push(`  - ${f.path}  ${fmt(f.documented)}`)
  }
  if (report.mismatch.length) {
    lines.push(`${mism} (${report.mismatch.length}):`)
    for (const f of report.mismatch) lines.push(`  ~ ${f.path}: ${fmt(f.documented)} -> ${fmt(f.observed)}`)
  }
  return lines.join('\n').trimEnd()
}

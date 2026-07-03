// Provider/model accuracy matrix.
//
// Runs every ground-truth fixture through buildOperation() for each AI
// provider/model that has credentials available, scores the result with the
// same deterministic scorer the promptfoo suite uses (score.ts), and prints a
// per-model scoreboard. Models without credentials (or an unreachable Ollama)
// are reported as skipped, never silently dropped.
//
//   pnpm matrix              # all available models, full scoreboard
//   pnpm matrix --quiet      # scoreboard only, no per-fixture lines
//   pnpm matrix --markdown   # emit a publishable Markdown table (progress goes to stderr)
//   pnpm matrix --gate       # CI gate: fail (exit 1) if any tested provider's mean < threshold

import { buildOperation } from '@easydocs/core'
import { readFileSync, readdirSync } from 'fs'
import { resolve, join } from 'path'
import score from './score.ts'

const DIR = import.meta.dirname
try {
  // Local dev reads keys from .env; CI sets them directly in the environment.
  process.loadEnvFile(resolve(DIR, '../../.env'))
} catch {
  // no .env (e.g. CI) — env vars are expected to be set already
}

const QUIET = process.argv.includes('--quiet')
const GATE = process.argv.includes('--gate')
const MARKDOWN = process.argv.includes('--markdown')

// In Markdown mode, progress lines go to stderr so stdout is a clean table.
const progress = (s: string) => (MARKDOWN ? process.stderr : process.stdout).write(s)

type Candidate = {
  provider: 'openai' | 'anthropic' | 'deepseek' | 'ollama'
  model: string
  keyEnv?: string
  ollama?: boolean
}

// The matrix to evaluate. Extend with more models freely; unavailable ones are skipped.
const MATRIX: Candidate[] = [
  { provider: 'deepseek', model: 'deepseek-chat', keyEnv: 'DEEPSEEK_API_KEY' },
  { provider: 'deepseek', model: 'deepseek-reasoner', keyEnv: 'DEEPSEEK_API_KEY' },
  { provider: 'openai', model: 'gpt-4o-mini', keyEnv: 'OPENAI_API_KEY' },
  { provider: 'openai', model: 'gpt-4o', keyEnv: 'OPENAI_API_KEY' },
  { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', keyEnv: 'ANTHROPIC_API_KEY' },
  { provider: 'anthropic', model: 'claude-sonnet-4-6', keyEnv: 'ANTHROPIC_API_KEY' },
  { provider: 'ollama', model: 'llama3.1', ollama: true },
  { provider: 'ollama', model: 'mistral', ollama: true },
]

// Collect every fixture that has a ground-truth reference.
const fixturesDir = resolve(DIR, 'fixtures')
const fixtures: string[] = [
  ...readdirSync(fixturesDir).filter((f) => f.endsWith('.json')).map((f) => `fixtures/${f}`),
  ...readdirSync(join(fixturesDir, 'real')).filter((f) => f.endsWith('.json')).map((f) => `fixtures/real/${f}`),
]

async function ollamaReachable(): Promise<boolean> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 2000)
    const res = await fetch('http://localhost:11434/api/tags', { signal: ctrl.signal })
    clearTimeout(t)
    return res.ok
  } catch {
    return false
  }
}

async function available(c: Candidate): Promise<boolean> {
  if (c.ollama) return ollamaReachable()
  return !!process.env[c.keyEnv!]
}

// Run an array of thunks with bounded concurrency.
async function pool<T>(items: (() => Promise<T>)[], concurrency = 4): Promise<T[]> {
  const out: T[] = new Array(items.length)
  let i = 0
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++
        out[idx] = await items[idx]()
      }
    })
  )
  return out
}

async function runModel(c: Candidate) {
  const results = await pool(
    fixtures.map((rel) => async () => {
      const fixture = JSON.parse(readFileSync(resolve(DIR, rel), 'utf8'))
      try {
        const spec = await buildOperation(fixture, null, { provider: c.provider, model: c.model })
        const r = score(JSON.stringify(spec), { vars: { fixture: rel } })
        return { rel, score: r.score, reason: r.reason, named: r.namedScores ?? {} }
      } catch (err) {
        return { rel, score: 0, reason: `ERROR: ${String(err).slice(0, 120)}`, named: {} }
      }
    })
  )
  const mean = results.reduce((s, r) => s + r.score, 0) / results.length
  const worst = results.reduce((a, b) => (b.score < a.score ? b : a))
  // Per-dimension averages, over only the fixtures where each dimension applied.
  const acc: Record<string, { sum: number; n: number }> = {}
  for (const r of results) {
    for (const [k, v] of Object.entries(r.named)) {
      if (!k.startsWith('acc:')) continue
      const d = k.slice(4)
      acc[d] ??= { sum: 0, n: 0 }
      acc[d].sum += v
      acc[d].n += 1
    }
  }
  const dimAvg: Record<string, number> = {}
  for (const [d, { sum, n }] of Object.entries(acc)) dimAvg[d] = sum / n
  return { mean, worst, results, dimAvg }
}

const label = (c: Candidate) => `${c.provider}/${c.model}`

// --- CI gate mode -----------------------------------------------------------
// Gate on one strong, stable model per cloud provider. Running across providers
// (not just one) is what catches provider-compatibility breaks, e.g. a strict
// structured-output API rejecting our schema. The threshold carries a margin
// for the measured run-to-run variance: a single flaky fixture shouldn't fail
// the build, but a systemic break (a provider generating zero valid specs)
// drops the mean far enough to fail.
const GATE_MODELS: Candidate[] = [
  { provider: 'deepseek', model: 'deepseek-chat', keyEnv: 'DEEPSEEK_API_KEY' },
  { provider: 'openai', model: 'gpt-4o', keyEnv: 'OPENAI_API_KEY' },
  { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', keyEnv: 'ANTHROPIC_API_KEY' },
]
const GATE_THRESHOLD = Number(process.env.GATE_THRESHOLD ?? 0.85)

if (GATE) {
  const tested: { c: Candidate; mean: number }[] = []
  for (const c of GATE_MODELS) {
    if (!(await available(c))) {
      console.log(`skip ${label(c)} — ${c.keyEnv} not set`)
      continue
    }
    process.stdout.write(`gating ${label(c)} (${fixtures.length} fixtures)...\n`)
    const { mean, worst } = await runModel(c)
    tested.push({ c, mean })
    console.log(
      `  ${label(c).padEnd(40)} mean=${mean.toFixed(3)}  worst ${worst.rel.replace('fixtures/', '')} (${worst.score.toFixed(2)})`
    )
  }

  if (tested.length === 0) {
    console.log('\nNo provider credentials available — accuracy gate skipped.')
    process.exit(0)
  }

  const failures = tested.filter((t) => t.mean < GATE_THRESHOLD)
  if (failures.length > 0) {
    console.error(`\n❌ Accuracy gate FAILED (threshold ${GATE_THRESHOLD}):`)
    for (const f of failures) console.error(`   ${label(f.c)} mean=${f.mean.toFixed(3)}`)
    process.exit(1)
  }
  console.log(`\n✅ Accuracy gate passed — ${tested.length} model(s) ≥ ${GATE_THRESHOLD}.`)
  process.exit(0)
}

const ran: { c: Candidate; mean: number; worst: any; dimAvg: Record<string, number> }[] = []
const skipped: string[] = []

for (const c of MATRIX) {
  if (!(await available(c))) {
    skipped.push(`${label(c)} — ${c.ollama ? 'Ollama not reachable at localhost:11434' : `${c.keyEnv} not set`}`)
    continue
  }
  progress(`running ${label(c)} (${fixtures.length} fixtures)...\n`)
  const { mean, worst, results, dimAvg } = await runModel(c)
  ran.push({ c, mean, worst, dimAvg })
  if (!QUIET) {
    for (const r of results.filter((r) => r.score < 1)) {
      console.log(`   ${r.rel.replace('fixtures/', '').padEnd(38)} ${r.score.toFixed(3)}  ${r.reason}`)
    }
  }
}

const sorted = ran.sort((a, b) => b.mean - a.mean)

// --- Markdown mode: emit a publishable table on stdout, then exit ------------
if (MARKDOWN) {
  const date = new Date().toISOString().slice(0, 10)
  const DIMS = ['tags', 'responses', 'parameters', 'requestBody', 'security', 'responseSchema']
  const head = ['Model', 'Mean', ...DIMS]
  const cell = (n: number | undefined) => (n == null ? '—' : n.toFixed(2))
  console.log(`<!-- generated by \`pnpm matrix --markdown --quiet\` on ${date}; ${fixtures.length} fixtures -->`)
  console.log('')
  console.log('| ' + head.join(' | ') + ' |')
  console.log('| ' + head.map((_, i) => (i === 0 ? ':--' : '--:')).join(' | ') + ' |')
  for (const r of sorted) {
    const cells = [`\`${label(r.c)}\``, r.mean.toFixed(3), ...DIMS.map((d) => cell(r.dimAvg[d]))]
    console.log('| ' + cells.join(' | ') + ' |')
  }
  if (skipped.length) {
    console.log('')
    console.log(`_Skipped (no credentials on this run): ${skipped.map((s) => `\`${s.split(' — ')[0]}\``).join(', ')}._`)
  }
  process.exit(0)
}

console.log('\n=== SCOREBOARD ===')
console.log('model'.padEnd(40), 'mean', '  worst fixture')
for (const r of sorted) {
  const w = `${r.worst.rel.replace('fixtures/', '')} (${r.worst.score.toFixed(2)})`
  console.log(label(r.c).padEnd(40), r.mean.toFixed(3), ' ', w)
}
if (skipped.length) {
  console.log('\n=== SKIPPED (no credentials) ===')
  for (const s of skipped) console.log(' -', s)
}

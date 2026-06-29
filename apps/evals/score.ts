import { readFileSync } from 'fs'
import { resolve, dirname, basename } from 'path'
import { fileURLToPath } from 'url'
import type { Operation } from '@easydocs/core'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Pass threshold for the overall accuracy score (0..1). Below this the test is
// marked failing so a regression in spec quality is visible, not silent.
const PASS_THRESHOLD = 0.7

type Dimension = { name: string; score: number; weight: number }

type GradingResult = {
  pass: boolean
  score: number
  reason: string
  namedScores?: Record<string, number>
}

/** F1 over two string sets. Both empty → 1 (nothing expected, nothing produced). */
function setF1(expected: string[], actual: string[]): number {
  const e = new Set(expected)
  const a = new Set(actual)
  if (e.size === 0 && a.size === 0) return 1
  if (e.size === 0 || a.size === 0) return 0
  let hit = 0
  for (const k of e) if (a.has(k)) hit++
  const precision = hit / a.size
  const recall = hit / e.size
  if (precision + recall === 0) return 0
  return (2 * precision * recall) / (precision + recall)
}

const paramKeys = (op: Operation): string[] =>
  (op.parameters ?? []).map((p) => `${p.name}|${p.in}`)

const securityNames = (op: Operation): string[] =>
  (op.security ?? []).flatMap((s) => Object.keys(s))

const successCode = (op: Operation): string | undefined =>
  Object.keys(op.responses ?? {}).find((c) => /^2\d\d$/.test(c))

/** Top-level property names of the JSON response schema for a given status code. */
function responseProps(op: Operation, code: string | undefined): string[] {
  if (!code) return []
  const content = op.responses?.[code]?.content
  if (!content) return []
  const media = content['application/json'] ?? Object.values(content)[0]
  const schema = media?.schema as Record<string, any> | undefined
  return Object.keys(schema?.properties ?? {})
}

function gradeParameters(expected: Operation, actual: Operation): number {
  const ek = paramKeys(expected)
  const ak = paramKeys(actual)
  const f1 = setF1(ek, ak)
  // Among parameters present in both, do the `required` flags agree?
  const eMap = new Map((expected.parameters ?? []).map((p) => [`${p.name}|${p.in}`, !!p.required]))
  const matched = (actual.parameters ?? []).filter((p) => eMap.has(`${p.name}|${p.in}`))
  const requiredAcc = matched.length
    ? matched.filter((p) => !!p.required === eMap.get(`${p.name}|${p.in}`)).length / matched.length
    : 1
  return 0.8 * f1 + 0.2 * requiredAcc
}

export default function score(output: string, context: { vars: Record<string, unknown> }): GradingResult {
  let actual: Operation
  try {
    actual = JSON.parse(output)
  } catch {
    return { pass: false, score: 0, reason: 'Generated spec is not valid JSON' }
  }

  const fixture = String(context.vars.fixture)
  const truthPath = resolve(__dirname, 'ground-truth', basename(fixture))
  let expected: Operation
  try {
    expected = JSON.parse(readFileSync(truthPath, 'utf8'))
  } catch {
    return { pass: false, score: 0, reason: `No ground-truth reference at ${truthPath}` }
  }

  const dims: Dimension[] = []

  // tags — reference tag(s) should appear in the generated tags
  dims.push({ name: 'tags', score: setF1(expected.tags ?? [], actual.tags ?? []), weight: 1 })

  // responses — status code set
  dims.push({
    name: 'responses',
    score: setF1(Object.keys(expected.responses ?? {}), Object.keys(actual.responses ?? {})),
    weight: 2,
  })

  // parameters — only when either side has any
  if ((expected.parameters?.length ?? 0) > 0 || (actual.parameters?.length ?? 0) > 0) {
    dims.push({ name: 'parameters', score: gradeParameters(expected, actual), weight: 2 })
  }

  // requestBody presence — only when either side has one
  const eBody = expected.requestBody != null
  const aBody = actual.requestBody != null
  if (eBody || aBody) {
    dims.push({ name: 'requestBody', score: eBody === aBody ? 1 : 0, weight: 1.5 })
  }

  // security — only when either side declares it
  const eSec = securityNames(expected)
  const aSec = securityNames(actual)
  if (eSec.length > 0 || aSec.length > 0) {
    dims.push({ name: 'security', score: setF1(eSec, aSec), weight: 1.5 })
  }

  // response schema — top-level properties of the success response, when the reference has them
  const code = successCode(expected)
  const eProps = responseProps(expected, code)
  if (eProps.length > 0) {
    const aProps = responseProps(actual, code)
    const hit = eProps.filter((p) => aProps.includes(p)).length
    dims.push({ name: 'responseSchema', score: hit / eProps.length, weight: 2 })
  }

  const totalWeight = dims.reduce((s, d) => s + d.weight, 0)
  const overall = dims.reduce((s, d) => s + d.score * d.weight, 0) / totalWeight

  const breakdown = dims.map((d) => `${d.name}=${d.score.toFixed(2)}`).join(' ')
  const namedScores = Object.fromEntries(dims.map((d) => [`acc:${d.name}`, d.score]))

  return {
    pass: overall >= PASS_THRESHOLD,
    score: overall,
    reason: `accuracy=${overall.toFixed(2)} (threshold ${PASS_THRESHOLD}) — ${breakdown}`,
    namedScores,
  }
}

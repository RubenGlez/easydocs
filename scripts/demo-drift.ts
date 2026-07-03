/**
 * Drift demo — see docs-vs-reality drift in one command, no API keys, no setup:
 *
 *   pnpm demo:drift
 *
 * It seeds a throwaway SQLite database with a few endpoints (as if EasyDocs had
 * observed them in real traffic), writes a committed `openapi.json` that has
 * drifted from that reality, and prints the exact report `easydocs drift` gives.
 *
 * Nothing here touches your real data — it all lives under the OS temp dir.
 */

import { createAdapter, buildFullSpec, computeDrift, renderDrift } from '@easydocs/core'
import type { HttpMethod } from '@easydocs/core'
import { writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dbFile = join(tmpdir(), 'easydocs-demo.sqlite')
const specFile = join(tmpdir(), 'easydocs-demo-openapi.json')

async function main() {
  rmSync(dbFile, { force: true }) // start clean each run

  // ── 1. What EasyDocs observed in real traffic (seeded straight into the DB) ──
  const observed: { path: string; method: HttpMethod; spec: Record<string, unknown> }[] = [
    { path: '/users', method: 'GET', spec: { summary: 'List users', responses: { '200': { description: 'OK' } } } },
    {
      path: '/users/{id}',
      method: 'GET',
      // Traffic shows a 404 the committed spec never documented.
      spec: { summary: 'Get a user', responses: { '200': { description: 'OK' }, '404': { description: 'Not found' } } },
    },
    // A whole endpoint the committed spec doesn't know about.
    { path: '/orders', method: 'POST', spec: { summary: 'Create an order', responses: { '201': { description: 'Created' } } } },
  ]

  const adapter = createAdapter({ type: 'sqlite', url: `file:${dbFile}` })
  const projectId = await adapter.findOrCreateProject('demo')
  for (const [i, e] of observed.entries()) {
    await adapter.upsertEndpoint(projectId, e.path, e.method, e.spec, `demo-hash-${i}`)
  }

  // ── 2. The committed spec a developer is maintaining by hand — now stale ──
  const committed = {
    openapi: '3.0.3',
    info: { title: 'Demo API', version: '1.0.0' },
    paths: {
      // Says "Success", but traffic says "OK" → mismatch.
      '/users': { get: { summary: 'List users', responses: { '200': { description: 'Success' } } } },
      // Documents only 200; traffic also returns 404 → undocumented.
      '/users/{id}': { get: { summary: 'Get a user', responses: { '200': { description: 'OK' } } } },
      // Documented, but never seen in traffic → unobserved (dead?).
      '/legacy/reports': { get: { summary: 'Legacy reports', responses: { '200': { description: 'OK' } } } },
      // Note: no /orders here — traffic has it, the docs don't.
    },
  }
  writeFileSync(specFile, JSON.stringify(committed, null, 2))

  // ── 3. Compare the committed spec against the observed reality ──
  const observedSpec = buildFullSpec(await adapter.getAllEndpoints(), 'demo')
  const report = computeDrift(committed, observedSpec)

  console.log('EasyDocs observed 3 endpoints in traffic. Your committed openapi.json has drifted:\n')
  console.log(renderDrift(report))
  console.log('\n' + '─'.repeat(72))
  console.log('That is exactly what this prints against your own captured traffic:\n')
  console.log('  npx easydocs drift openapi.json\n')
  console.log('(demo files: ' + dbFile + ', ' + specFile + ')')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

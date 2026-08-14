import { describe, it, expect, beforeEach } from 'vitest'
import { createTestAdapter } from '../storage/sqlite.js'
import type { DatabaseAdapter } from '../storage/adapter.js'
import type { Operation } from '../spec/schema.js'

function spec(summary: string): Operation {
  return {
    summary,
    tags: ['users'],
    responses: { '200': { description: 'OK' } },
  } as Operation
}

let adapter: DatabaseAdapter

beforeEach(async () => {
  adapter = await createTestAdapter()
})

// A plain select-then-insert races: two workers (cluster mode, several replicas
// behind one Postgres/libsql) both miss the select and both insert, and the
// loser throws on the unique index *after* paying for its LLM call.
describe('concurrent writes', () => {
  it('findOrCreateProject converges on one id under concurrency', async () => {
    const ids = await Promise.all(
      Array.from({ length: 10 }, () => adapter.findOrCreateProject('racy'))
    )
    expect(new Set(ids).size).toBe(1)
  })

  it('upsertEndpoint does not throw when the same endpoint is written concurrently', async () => {
    const projectId = await adapter.findOrCreateProject('p')

    const ids = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        adapter.upsertEndpoint(projectId, '/users', 'GET', spec(`v${i}`), '[]')
      )
    )

    expect(new Set(ids).size).toBe(1)
    const rows = await adapter.getEndpointsByProject(projectId)
    expect(rows).toHaveLength(1)
  })

  it('keeps distinct endpoints separate under concurrency', async () => {
    const projectId = await adapter.findOrCreateProject('p')
    await Promise.all([
      adapter.upsertEndpoint(projectId, '/users', 'GET', spec('a'), '[]'),
      adapter.upsertEndpoint(projectId, '/users', 'POST', spec('b'), '[]'),
      adapter.upsertEndpoint(projectId, '/posts', 'GET', spec('c'), '[]'),
    ])
    const rows = await adapter.getEndpointsByProject(projectId)
    expect(rows).toHaveLength(3)
  })
})

// spec_versions used to grow without bound, and the dashboard loads the whole
// list for an endpoint.
describe('version retention', () => {
  it('keeps a bounded window of the most recent versions', async () => {
    const projectId = await adapter.findOrCreateProject('p')
    let endpointId = ''
    for (let i = 0; i < 70; i++) {
      endpointId = await adapter.upsertEndpoint(projectId, '/users', 'GET', spec(`v${i}`), '[]')
    }

    const versions = await adapter.getEndpointVersions(endpointId)
    expect(versions.length).toBeLessThanOrEqual(50)
    // Newest-first, and the newest snapshot is the one we just wrote.
    expect(versions[0].spec?.summary).toBe('v69')
  })

  it('does not prune below the window', async () => {
    const projectId = await adapter.findOrCreateProject('p')
    let endpointId = ''
    for (let i = 0; i < 5; i++) {
      endpointId = await adapter.upsertEndpoint(projectId, '/users', 'GET', spec(`v${i}`), '[]')
    }
    const versions = await adapter.getEndpointVersions(endpointId)
    expect(versions).toHaveLength(5)
  })
})

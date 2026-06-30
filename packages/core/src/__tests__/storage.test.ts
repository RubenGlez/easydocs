import { describe, it, expect, beforeEach } from 'vitest'
import { randomUUID } from 'node:crypto'
import {
  createTestAdapter,
  createTestDB,
  findOrCreateProject,
  upsertEndpoint,
  getEndpointVersions,
} from '../storage/sqlite.js'
import { endpoints } from '../storage/schema.js'
import type { DatabaseAdapter } from '../storage/adapter.js'

const MOCK_SPEC = {
  summary: 'List users',
  tags: ['users'],
  responses: { '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object' as const } } } } },
}

let adapter: DatabaseAdapter

beforeEach(async () => {
  adapter = await createTestAdapter()
})

describe('projects', () => {
  it('creates a project and returns its id', async () => {
    const id = await adapter.findOrCreateProject('my-service')
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('returns the same id on subsequent calls', async () => {
    const id1 = await adapter.findOrCreateProject('my-service')
    const id2 = await adapter.findOrCreateProject('my-service')
    expect(id1).toBe(id2)
  })

  it('creates separate ids for different slugs', async () => {
    const a = await adapter.findOrCreateProject('service-a')
    const b = await adapter.findOrCreateProject('service-b')
    expect(a).not.toBe(b)
  })

  it('lists all created projects', async () => {
    await adapter.findOrCreateProject('alpha')
    await adapter.findOrCreateProject('beta')
    const all = await adapter.getAllProjects()
    expect(all).toHaveLength(2)
    expect(all.map((p) => p.slug).sort()).toEqual(['alpha', 'beta'])
  })
})

describe('endpoints', () => {
  it('upserts an endpoint and retrieves it by project', async () => {
    const projectId = await adapter.findOrCreateProject('api')
    await adapter.upsertEndpoint(projectId, '/users', 'GET', MOCK_SPEC, 'hash1')
    const list = await adapter.getEndpointsByProject(projectId)
    expect(list).toHaveLength(1)
    expect(list[0].path).toBe('/users')
    expect(list[0].method).toBe('GET')
  })

  it('updates spec on second upsert with same path+method+project', async () => {
    const projectId = await adapter.findOrCreateProject('api')
    await adapter.upsertEndpoint(projectId, '/users', 'GET', MOCK_SPEC, 'hash1')
    const updated = { ...MOCK_SPEC, summary: 'Updated summary' }
    await adapter.upsertEndpoint(projectId, '/users', 'GET', updated, 'hash2')
    const list = await adapter.getEndpointsByProject(projectId)
    expect(list).toHaveLength(1)
    expect(list[0].spec?.summary).toBe('Updated summary')
  })

  it('scopes endpoints to their project', async () => {
    const aId = await adapter.findOrCreateProject('service-a')
    const bId = await adapter.findOrCreateProject('service-b')
    await adapter.upsertEndpoint(aId, '/users', 'GET', MOCK_SPEC, 'h1')
    await adapter.upsertEndpoint(bId, '/orders', 'POST', MOCK_SPEC, 'h2')
    const aEndpoints = await adapter.getEndpointsByProject(aId)
    const bEndpoints = await adapter.getEndpointsByProject(bId)
    expect(aEndpoints).toHaveLength(1)
    expect(aEndpoints[0].path).toBe('/users')
    expect(bEndpoints).toHaveLength(1)
    expect(bEndpoints[0].path).toBe('/orders')
  })

  it('getAllEndpoints returns endpoints across all projects', async () => {
    const aId = await adapter.findOrCreateProject('a')
    const bId = await adapter.findOrCreateProject('b')
    await adapter.upsertEndpoint(aId, '/users', 'GET', MOCK_SPEC, 'h1')
    await adapter.upsertEndpoint(bId, '/orders', 'GET', MOCK_SPEC, 'h2')
    const all = await adapter.getAllEndpoints()
    expect(all).toHaveLength(2)
  })

  it('getEndpointByPathMethod returns the matching endpoint', async () => {
    const projectId = await adapter.findOrCreateProject('api')
    await adapter.upsertEndpoint(projectId, '/users', 'GET', MOCK_SPEC, 'hash1')
    const found = await adapter.getEndpointByPathMethod(projectId, '/users', 'GET')
    expect(found?.path).toBe('/users')
    expect(found?.method).toBe('GET')
    expect(found?.responseHash).toBe('hash1')
  })

  it('getEndpointByPathMethod returns undefined for unknown path', async () => {
    const projectId = await adapter.findOrCreateProject('api')
    const found = await adapter.getEndpointByPathMethod(projectId, '/missing', 'GET')
    expect(found).toBeUndefined()
  })

  it('deletes an endpoint by id', async () => {
    const projectId = await adapter.findOrCreateProject('api')
    const id = await adapter.upsertEndpoint(projectId, '/users', 'GET', MOCK_SPEC, 'h1')
    await adapter.deleteEndpointById(id)
    const list = await adapter.getEndpointsByProject(projectId)
    expect(list).toHaveLength(0)
  })
})

describe('manual spec editing', () => {
  it('saveManualSpec sets isManuallyEdited and clears conflict', async () => {
    const projectId = await adapter.findOrCreateProject('api')
    const id = await adapter.upsertEndpoint(projectId, '/users', 'GET', MOCK_SPEC, 'h1')
    const manual = { ...MOCK_SPEC, summary: 'My custom summary' }
    await adapter.saveManualSpec(id, manual)
    const [endpoint] = await adapter.getEndpointsByProject(projectId)
    expect(endpoint.isManuallyEdited).toBe(true)
    expect(endpoint.hasConflict).toBe(false)
    expect(endpoint.manualSpec?.summary).toBe('My custom summary')
  })

  it('upsert after manual edit sets hasConflict', async () => {
    const projectId = await adapter.findOrCreateProject('api')
    const id = await adapter.upsertEndpoint(projectId, '/users', 'GET', MOCK_SPEC, 'h1')
    await adapter.saveManualSpec(id, { ...MOCK_SPEC, summary: 'Manual' })
    await adapter.upsertEndpoint(projectId, '/users', 'GET', { ...MOCK_SPEC, summary: 'AI updated' }, 'h2')
    const [endpoint] = await adapter.getEndpointsByProject(projectId)
    expect(endpoint.hasConflict).toBe(true)
  })

  it('resolveConflict keep=ai clears manual spec and conflict', async () => {
    const projectId = await adapter.findOrCreateProject('api')
    const id = await adapter.upsertEndpoint(projectId, '/users', 'GET', MOCK_SPEC, 'h1')
    await adapter.saveManualSpec(id, { ...MOCK_SPEC, summary: 'Manual' })
    await adapter.upsertEndpoint(projectId, '/users', 'GET', MOCK_SPEC, 'h2')
    await adapter.resolveConflict(id, 'ai')
    const [endpoint] = await adapter.getEndpointsByProject(projectId)
    expect(endpoint.isManuallyEdited).toBe(false)
    expect(endpoint.hasConflict).toBe(false)
    expect(endpoint.manualSpec).toBeNull()
  })

  it('resolveConflict keep=manual promotes manualSpec to spec', async () => {
    const projectId = await adapter.findOrCreateProject('api')
    const id = await adapter.upsertEndpoint(projectId, '/users', 'GET', MOCK_SPEC, 'h1')
    await adapter.saveManualSpec(id, { ...MOCK_SPEC, summary: 'Keep this' })
    await adapter.upsertEndpoint(projectId, '/users', 'GET', MOCK_SPEC, 'h2')
    await adapter.resolveConflict(id, 'manual')
    const [endpoint] = await adapter.getEndpointsByProject(projectId)
    expect(endpoint.hasConflict).toBe(false)
    expect(endpoint.spec?.summary).toBe('Keep this')
    expect(endpoint.isManuallyEdited).toBe(true)
  })
})

describe('spec version history', () => {
  it('records an initial ai version when an endpoint is created', async () => {
    const projectId = await adapter.findOrCreateProject('api')
    const id = await adapter.upsertEndpoint(projectId, '/users', 'GET', MOCK_SPEC, 'h1')
    const versions = await adapter.getEndpointVersions(id)
    expect(versions).toHaveLength(1)
    expect(versions[0].source).toBe('ai')
    expect(versions[0].spec?.summary).toBe('List users')
  })

  it('records a new version when the spec changes', async () => {
    const projectId = await adapter.findOrCreateProject('api')
    const id = await adapter.upsertEndpoint(projectId, '/users', 'GET', MOCK_SPEC, 'h1')
    await adapter.upsertEndpoint(projectId, '/users', 'GET', { ...MOCK_SPEC, summary: 'Changed' }, 'h2')
    const versions = await adapter.getEndpointVersions(id)
    expect(versions).toHaveLength(2)
    expect(versions.map((v) => v.spec?.summary).sort()).toEqual(['Changed', 'List users'])
  })

  it('does not record a version when the spec is unchanged', async () => {
    const projectId = await adapter.findOrCreateProject('api')
    const id = await adapter.upsertEndpoint(projectId, '/users', 'GET', MOCK_SPEC, 'h1')
    await adapter.upsertEndpoint(projectId, '/users', 'GET', { ...MOCK_SPEC }, 'h2')
    const versions = await adapter.getEndpointVersions(id)
    expect(versions).toHaveLength(1)
  })

  it('dedupes regardless of object key order', async () => {
    const projectId = await adapter.findOrCreateProject('api')
    const id = await adapter.upsertEndpoint(projectId, '/u', 'GET', { summary: 'X', responses: {} }, 'h1')
    await adapter.upsertEndpoint(projectId, '/u', 'GET', { responses: {}, summary: 'X' }, 'h2')
    const versions = await adapter.getEndpointVersions(id)
    expect(versions).toHaveLength(1)
  })

  it('records a manual version on saveManualSpec', async () => {
    const projectId = await adapter.findOrCreateProject('api')
    const id = await adapter.upsertEndpoint(projectId, '/users', 'GET', MOCK_SPEC, 'h1')
    await adapter.saveManualSpec(id, { ...MOCK_SPEC, summary: 'Hand edited' })
    const versions = await adapter.getEndpointVersions(id)
    expect(versions).toHaveLength(2)
    const manual = versions.find((v) => v.source === 'manual')
    expect(manual?.spec?.summary).toBe('Hand edited')
  })

  it('scopes versions to their endpoint', async () => {
    const projectId = await adapter.findOrCreateProject('api')
    const a = await adapter.upsertEndpoint(projectId, '/a', 'GET', MOCK_SPEC, 'h1')
    const b = await adapter.upsertEndpoint(projectId, '/b', 'GET', MOCK_SPEC, 'h2')
    expect(await adapter.getEndpointVersions(a)).toHaveLength(1)
    expect(await adapter.getEndpointVersions(b)).toHaveLength(1)
  })

  it('lists versions newest-first even when written in the same second', async () => {
    const projectId = await adapter.findOrCreateProject('api')
    const id = await adapter.upsertEndpoint(projectId, '/u', 'GET', { summary: 'v1', responses: {} }, 'h1')
    await adapter.upsertEndpoint(projectId, '/u', 'GET', { summary: 'v2', responses: {} }, 'h2')
    await adapter.upsertEndpoint(projectId, '/u', 'GET', { summary: 'v3', responses: {} }, 'h3')
    const versions = await adapter.getEndpointVersions(id)
    expect(versions.map((v) => v.spec?.summary)).toEqual(['v3', 'v2', 'v1'])
  })

  it('backfills the existing spec as a baseline for a pre-feature endpoint', async () => {
    const db = await createTestDB()
    const projectId = await findOrCreateProject(db, 'api')
    // Simulate a legacy endpoint: a row with a spec but no spec_versions.
    const legacyId = randomUUID()
    await db.insert(endpoints).values({
      id: legacyId,
      projectId,
      path: '/legacy',
      method: 'GET',
      spec: { summary: 'old', responses: {} },
      responseHash: 'h0',
    })
    expect(await getEndpointVersions(db, legacyId)).toHaveLength(0)

    await upsertEndpoint(db, projectId, '/legacy', 'GET', { summary: 'new', responses: {} }, 'h1')
    const versions = await getEndpointVersions(db, legacyId)
    expect(versions.map((v) => v.spec?.summary)).toEqual(['new', 'old'])
  })
})

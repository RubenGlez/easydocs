import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDB } from '../storage/sqlite.js'
import {
  findOrCreateProject,
  getAllProjects,
  getEndpointsByProject,
  getAllEndpoints,
  upsertEndpoint,
  saveManualSpec,
  resolveConflict,
  deleteEndpointById,
} from '../storage/sqlite.js'

type DB = Awaited<ReturnType<typeof createTestDB>>

const MOCK_SPEC = {
  summary: 'List users',
  tags: ['users'],
  responses: { '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object' as const } } } } },
}

let db: DB

beforeEach(async () => {
  db = await createTestDB()
})

describe('projects', () => {
  it('creates a project and returns its id', async () => {
    const id = await findOrCreateProject(db, 'my-service')
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('returns the same id on subsequent calls', async () => {
    const id1 = await findOrCreateProject(db, 'my-service')
    const id2 = await findOrCreateProject(db, 'my-service')
    expect(id1).toBe(id2)
  })

  it('creates separate ids for different slugs', async () => {
    const a = await findOrCreateProject(db, 'service-a')
    const b = await findOrCreateProject(db, 'service-b')
    expect(a).not.toBe(b)
  })

  it('lists all created projects', async () => {
    await findOrCreateProject(db, 'alpha')
    await findOrCreateProject(db, 'beta')
    const all = await getAllProjects(db)
    expect(all).toHaveLength(2)
    expect(all.map((p) => p.slug).sort()).toEqual(['alpha', 'beta'])
  })
})

describe('endpoints', () => {
  it('upserts an endpoint and retrieves it by project', async () => {
    const projectId = await findOrCreateProject(db, 'api')
    await upsertEndpoint(db, projectId, '/users', 'GET', MOCK_SPEC, 'hash1')
    const list = await getEndpointsByProject(db, projectId)
    expect(list).toHaveLength(1)
    expect(list[0].path).toBe('/users')
    expect(list[0].method).toBe('GET')
  })

  it('updates spec on second upsert with same path+method+project', async () => {
    const projectId = await findOrCreateProject(db, 'api')
    await upsertEndpoint(db, projectId, '/users', 'GET', MOCK_SPEC, 'hash1')
    const updated = { ...MOCK_SPEC, summary: 'Updated summary' }
    await upsertEndpoint(db, projectId, '/users', 'GET', updated, 'hash2')
    const list = await getEndpointsByProject(db, projectId)
    expect(list).toHaveLength(1)
    expect(list[0].spec?.summary).toBe('Updated summary')
  })

  it('scopes endpoints to their project', async () => {
    const aId = await findOrCreateProject(db, 'service-a')
    const bId = await findOrCreateProject(db, 'service-b')
    await upsertEndpoint(db, aId, '/users', 'GET', MOCK_SPEC, 'h1')
    await upsertEndpoint(db, bId, '/orders', 'POST', MOCK_SPEC, 'h2')
    const aEndpoints = await getEndpointsByProject(db, aId)
    const bEndpoints = await getEndpointsByProject(db, bId)
    expect(aEndpoints).toHaveLength(1)
    expect(aEndpoints[0].path).toBe('/users')
    expect(bEndpoints).toHaveLength(1)
    expect(bEndpoints[0].path).toBe('/orders')
  })

  it('getAllEndpoints returns endpoints across all projects', async () => {
    const aId = await findOrCreateProject(db, 'a')
    const bId = await findOrCreateProject(db, 'b')
    await upsertEndpoint(db, aId, '/users', 'GET', MOCK_SPEC, 'h1')
    await upsertEndpoint(db, bId, '/orders', 'GET', MOCK_SPEC, 'h2')
    const all = await getAllEndpoints(db)
    expect(all).toHaveLength(2)
  })

  it('deletes an endpoint by id', async () => {
    const projectId = await findOrCreateProject(db, 'api')
    const id = await upsertEndpoint(db, projectId, '/users', 'GET', MOCK_SPEC, 'h1')
    await deleteEndpointById(db, id)
    const list = await getEndpointsByProject(db, projectId)
    expect(list).toHaveLength(0)
  })
})

describe('manual spec editing', () => {
  it('saveManualSpec sets isManuallyEdited and clears conflict', async () => {
    const projectId = await findOrCreateProject(db, 'api')
    const id = await upsertEndpoint(db, projectId, '/users', 'GET', MOCK_SPEC, 'h1')
    const manual = { ...MOCK_SPEC, summary: 'My custom summary' }
    await saveManualSpec(db, id, manual)
    const [endpoint] = await getEndpointsByProject(db, projectId)
    expect(endpoint.isManuallyEdited).toBe(true)
    expect(endpoint.hasConflict).toBe(false)
    expect(endpoint.manualSpec?.summary).toBe('My custom summary')
  })

  it('upsert after manual edit sets hasConflict', async () => {
    const projectId = await findOrCreateProject(db, 'api')
    const id = await upsertEndpoint(db, projectId, '/users', 'GET', MOCK_SPEC, 'h1')
    await saveManualSpec(db, id, { ...MOCK_SPEC, summary: 'Manual' })
    await upsertEndpoint(db, projectId, '/users', 'GET', { ...MOCK_SPEC, summary: 'AI updated' }, 'h2')
    const [endpoint] = await getEndpointsByProject(db, projectId)
    expect(endpoint.hasConflict).toBe(true)
  })

  it('resolveConflict keep=ai clears manual spec and conflict', async () => {
    const projectId = await findOrCreateProject(db, 'api')
    const id = await upsertEndpoint(db, projectId, '/users', 'GET', MOCK_SPEC, 'h1')
    await saveManualSpec(db, id, { ...MOCK_SPEC, summary: 'Manual' })
    await upsertEndpoint(db, projectId, '/users', 'GET', MOCK_SPEC, 'h2')
    await resolveConflict(db, id, 'ai')
    const [endpoint] = await getEndpointsByProject(db, projectId)
    expect(endpoint.isManuallyEdited).toBe(false)
    expect(endpoint.hasConflict).toBe(false)
    expect(endpoint.manualSpec).toBeNull()
  })

  it('resolveConflict keep=manual promotes manualSpec to spec', async () => {
    const projectId = await findOrCreateProject(db, 'api')
    const id = await upsertEndpoint(db, projectId, '/users', 'GET', MOCK_SPEC, 'h1')
    await saveManualSpec(db, id, { ...MOCK_SPEC, summary: 'Keep this' })
    await upsertEndpoint(db, projectId, '/users', 'GET', MOCK_SPEC, 'h2')
    await resolveConflict(db, id, 'manual')
    const [endpoint] = await getEndpointsByProject(db, projectId)
    expect(endpoint.hasConflict).toBe(false)
    expect(endpoint.spec?.summary).toBe('Keep this')
    expect(endpoint.isManuallyEdited).toBe(true)
  })
})

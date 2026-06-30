import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { and, desc, eq, sql } from 'drizzle-orm'
import { endpoints, projects, specVersions } from './schema.js'
import { specsEqual } from './versions.js'
import type { Operation } from '../spec/schema.js'
import type { HttpMethod } from '../types.js'
import type { DatabaseAdapter } from './adapter.js'
import os from 'os'
import path from 'path'
import { mkdirSync } from 'fs'

export type DB = ReturnType<typeof createDB>

const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS endpoints (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id),
    path TEXT NOT NULL,
    method TEXT NOT NULL,
    spec TEXT,
    manual_spec TEXT,
    is_manually_edited INTEGER DEFAULT 0,
    has_conflict INTEGER DEFAULT 0,
    response_hash TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
  );

  CREATE UNIQUE INDEX IF NOT EXISTS endpoints_path_method_project
    ON endpoints (path, method, project_id);

  CREATE TABLE IF NOT EXISTS spec_versions (
    id TEXT PRIMARY KEY,
    endpoint_id TEXT REFERENCES endpoints(id) ON DELETE CASCADE,
    spec TEXT,
    source TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS spec_versions_endpoint
    ON spec_versions (endpoint_id, created_at);
`

// Best-effort migration for databases created before project support
const MIGRATE_SQL = `ALTER TABLE endpoints ADD COLUMN project_id TEXT REFERENCES projects(id);`

function defaultDbUrl() {
  const dir = path.join(os.homedir(), '.easydocs')
  return `file:${path.join(dir, 'db.sqlite')}`
}

function ensureDir(url: string) {
  if (url.startsWith('file:')) {
    const filePath = url.slice('file:'.length)
    const dir = path.dirname(filePath)
    mkdirSync(dir, { recursive: true })
  }
}

export function createDB(url?: string) {
  const dbUrl = url ?? process.env.EASYDOCS_DB_URL ?? defaultDbUrl()
  ensureDir(dbUrl)
  const client = createClient({ url: dbUrl })
  const db = drizzle(client, { schema: { projects, endpoints, specVersions } })

  client
    .executeMultiple(INIT_SQL)
    .then(() => client.execute(MIGRATE_SQL).catch(() => { /* column already exists */ }))
    .catch((err: unknown) => console.error('[EasyDocs] DB init error:', err))

  return db
}

// ─── Projects ────────────────────────────────────────────────────────────────

export async function findOrCreateProject(db: DB, slug: string): Promise<string> {
  const existing = await db.select().from(projects).where(eq(projects.slug, slug)).get()
  if (existing) return existing.id
  const id = crypto.randomUUID()
  await db.insert(projects).values({ id, name: slug, slug })
  return id
}

export async function getAllProjects(db: DB) {
  return db.select().from(projects).all()
}

// ─── Endpoints ───────────────────────────────────────────────────────────────

async function recordVersion(db: DB, endpointId: string, spec: Operation, source: 'ai' | 'manual') {
  await db.insert(specVersions).values({ id: crypto.randomUUID(), endpointId, spec, source })
}

async function hasVersions(db: DB, endpointId: string) {
  const row = await db
    .select({ id: specVersions.id })
    .from(specVersions)
    .where(eq(specVersions.endpointId, endpointId))
    .limit(1)
    .get()
  return !!row
}

export async function getEndpointVersions(db: DB, endpointId: string) {
  // created_at is second-granularity; rowid (insertion order) breaks same-second
  // ties so the list is deterministically newest-first regardless of query plan.
  return db
    .select()
    .from(specVersions)
    .where(eq(specVersions.endpointId, endpointId))
    .orderBy(desc(specVersions.createdAt), sql`rowid desc`)
    .all()
}

export async function upsertEndpoint(
  db: DB,
  projectId: string,
  path: string,
  method: HttpMethod,
  spec: Operation,
  responseHash: string
) {
  const existing = await db
    .select()
    .from(endpoints)
    .where(
      and(
        eq(endpoints.projectId, projectId),
        eq(endpoints.path, path),
        eq(endpoints.method, method)
      )
    )
    .get()

  const hasConflict = !!(existing?.isManuallyEdited && existing.manualSpec)

  if (existing) {
    await db
      .update(endpoints)
      .set({ spec, responseHash, hasConflict, updatedAt: new Date() })
      .where(eq(endpoints.id, existing.id))
    if (!specsEqual(spec, existing.spec)) {
      // Endpoints created before version history have no versions; backfill the
      // prior spec as a baseline so this first change has something to diff against.
      if (existing.spec && !(await hasVersions(db, existing.id))) {
        await recordVersion(db, existing.id, existing.spec, 'ai')
      }
      await recordVersion(db, existing.id, spec, 'ai')
    }
    return existing.id
  }

  const id = crypto.randomUUID()
  await db.insert(endpoints).values({ id, projectId, path, method, spec, responseHash })
  await recordVersion(db, id, spec, 'ai')
  return id
}

export async function getEndpointByPathMethod(
  db: DB,
  projectId: string,
  path: string,
  method: HttpMethod
) {
  return db
    .select()
    .from(endpoints)
    .where(
      and(
        eq(endpoints.projectId, projectId),
        eq(endpoints.path, path),
        eq(endpoints.method, method)
      )
    )
    .get()
}

export async function getEndpointsByProject(db: DB, projectId: string) {
  return db.select().from(endpoints).where(eq(endpoints.projectId, projectId)).all()
}

export async function getAllEndpoints(db: DB) {
  return db.select().from(endpoints).all()
}

export async function saveManualSpec(db: DB, id: string, manualSpec: Operation) {
  await db
    .update(endpoints)
    .set({ manualSpec, isManuallyEdited: true, hasConflict: false, updatedAt: new Date() })
    .where(eq(endpoints.id, id))
  await recordVersion(db, id, manualSpec, 'manual')
}

export async function resolveConflict(db: DB, id: string, keep: 'ai' | 'manual') {
  if (keep === 'ai') {
    await db
      .update(endpoints)
      .set({ manualSpec: null, isManuallyEdited: false, hasConflict: false, updatedAt: new Date() })
      .where(eq(endpoints.id, id))
  } else {
    const row = await db.select().from(endpoints).where(eq(endpoints.id, id)).get()
    if (!row?.manualSpec) return
    await db
      .update(endpoints)
      .set({
        spec: row.manualSpec,
        manualSpec: null,
        isManuallyEdited: true,
        hasConflict: false,
        updatedAt: new Date(),
      })
      .where(eq(endpoints.id, id))
    if (!specsEqual(row.manualSpec, row.spec)) await recordVersion(db, id, row.manualSpec, 'manual')
  }
}

export async function deleteEndpointById(db: DB, id: string) {
  await db.delete(endpoints).where(eq(endpoints.id, id))
}

export async function createTestDB() {
  const client = createClient({ url: ':memory:' })
  await client.executeMultiple(INIT_SQL)
  return drizzle(client, { schema: { projects, endpoints, specVersions } })
}

// ─── Adapter ─────────────────────────────────────────────────────────────────

function wrapDB(db: DB): DatabaseAdapter {
  return {
    findOrCreateProject: (slug) => findOrCreateProject(db, slug),
    getEndpointByPathMethod: (projectId, path, method) =>
      getEndpointByPathMethod(db, projectId, path, method),
    upsertEndpoint: (projectId, path, method, spec, responseHash) =>
      upsertEndpoint(db, projectId, path, method, spec, responseHash),
    getAllProjects: () => getAllProjects(db),
    getAllEndpoints: () => getAllEndpoints(db),
    getEndpointsByProject: (projectId) => getEndpointsByProject(db, projectId),
    getEndpointVersions: (endpointId) => getEndpointVersions(db, endpointId),
    deleteEndpointById: (id) => deleteEndpointById(db, id),
    saveManualSpec: (id, manualSpec) => saveManualSpec(db, id, manualSpec),
    resolveConflict: (id, keep) => resolveConflict(db, id, keep),
  }
}

export function createSqliteAdapter(url?: string): DatabaseAdapter {
  return wrapDB(createDB(url))
}

export async function createTestAdapter(): Promise<DatabaseAdapter> {
  return wrapDB(await createTestDB())
}

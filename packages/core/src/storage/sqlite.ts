import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { and, eq } from 'drizzle-orm'
import { endpoints, projects } from './schema.js'
import type { Operation } from '../spec/schema.js'
import type { HttpMethod } from '../types.js'
import os from 'os'
import path from 'path'

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
    try {
      const { mkdirSync } = require('fs') as typeof import('fs')
      mkdirSync(dir, { recursive: true })
    } catch { /* already exists */ }
  }
}

export function createDB(url?: string) {
  const dbUrl = url ?? process.env.EASYDOCS_DB_URL ?? defaultDbUrl()
  ensureDir(dbUrl)
  const client = createClient({ url: dbUrl })
  const db = drizzle(client, { schema: { projects, endpoints } })

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
    return existing.id
  }

  const id = crypto.randomUUID()
  await db.insert(endpoints).values({ id, projectId, path, method, spec, responseHash })
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
  }
}

export async function deleteEndpointById(db: DB, id: string) {
  await db.delete(endpoints).where(eq(endpoints.id, id))
}

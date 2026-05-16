import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { and, eq } from 'drizzle-orm'
import { endpoints } from './schema.js'
import type { Operation } from '../spec/schema.js'
import type { HttpMethod } from '../types.js'
import os from 'os'
import path from 'path'

export type DB = ReturnType<typeof createDB>

const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS endpoints (
    id TEXT PRIMARY KEY,
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
  CREATE UNIQUE INDEX IF NOT EXISTS endpoints_path_method ON endpoints (path, method);
`

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
    } catch {
      // already exists or unsupported
    }
  }
}

export function createDB(url?: string) {
  const dbUrl = url ?? process.env.EASYDOCS_DB_URL ?? defaultDbUrl()
  ensureDir(dbUrl)
  const client = createClient({ url: dbUrl })
  const db = drizzle(client, { schema: { endpoints } })

  client.executeMultiple(INIT_SQL).catch((err: unknown) => {
    console.error('[EasyDocs] Failed to initialize database:', err)
  })

  return db
}

export async function upsertEndpoint(
  db: DB,
  path: string,
  method: HttpMethod,
  spec: Operation,
  responseHash: string
) {
  const existing = await db
    .select()
    .from(endpoints)
    .where(and(eq(endpoints.path, path), eq(endpoints.method, method)))
    .get()

  // If the user has manually edited the spec, flag a conflict instead of overwriting
  const hasConflict = !!(existing?.isManuallyEdited && existing.manualSpec)

  if (existing) {
    await db
      .update(endpoints)
      .set({ spec, responseHash, hasConflict, updatedAt: new Date() })
      .where(eq(endpoints.id, existing.id))
    return existing.id
  }

  const id = crypto.randomUUID()
  await db.insert(endpoints).values({ id, path, method, spec, responseHash })
  return id
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
    // Keep manual — promote manualSpec to spec, clear conflict
    const row = await db.select().from(endpoints).where(eq(endpoints.id, id)).get()
    if (!row?.manualSpec) return
    await db
      .update(endpoints)
      .set({ spec: row.manualSpec, manualSpec: null, isManuallyEdited: true, hasConflict: false, updatedAt: new Date() })
      .where(eq(endpoints.id, id))
  }
}

export async function getEndpointByPathMethod(db: DB, path: string, method: HttpMethod) {
  return db
    .select()
    .from(endpoints)
    .where(and(eq(endpoints.path, path), eq(endpoints.method, method)))
    .get()
}

export async function getAllEndpoints(db: DB) {
  return db.select().from(endpoints).all()
}

export async function deleteEndpointById(db: DB, id: string) {
  await db.delete(endpoints).where(eq(endpoints.id, id))
}

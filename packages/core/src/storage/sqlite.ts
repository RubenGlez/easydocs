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
    // Use sync fs to avoid async in constructor
    try {
      const { mkdirSync } = require('fs') as typeof import('fs')
      mkdirSync(dir, { recursive: true })
    } catch {
      // directory already exists or unsupported
    }
  }
}

export function createDB(url?: string) {
  const dbUrl = url ?? process.env.EASYDOCS_DB_URL ?? defaultDbUrl()
  ensureDir(dbUrl)
  const client = createClient({ url: dbUrl })
  const db = drizzle(client, { schema: { endpoints } })

  // Fire-and-forget schema init
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

  if (existing) {
    await db
      .update(endpoints)
      .set({ spec, responseHash, updatedAt: new Date() })
      .where(eq(endpoints.id, existing.id))
    return existing.id
  }

  const id = crypto.randomUUID()
  await db.insert(endpoints).values({ id, path, method, spec, responseHash })
  return id
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

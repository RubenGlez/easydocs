import { drizzle } from 'drizzle-orm/postgres-js'
import postgresJs from 'postgres'
import { and, eq } from 'drizzle-orm'
import { pgTable, uuid, text, jsonb, timestamp, boolean } from 'drizzle-orm/pg-core'
import type { Operation } from '../spec/schema.js'
import type { HttpMethod } from '../types.js'

export const pgProjects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow(),
})

export const pgEndpoints = pgTable('endpoints', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => pgProjects.id),
  path: text('path').notNull(),
  method: text('method').notNull(),
  spec: jsonb('spec').$type<Operation>(),
  manualSpec: jsonb('manual_spec').$type<Operation>(),
  isManuallyEdited: boolean('is_manually_edited').default(false),
  hasConflict: boolean('has_conflict').default(false),
  responseHash: text('response_hash'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS endpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id),
    path TEXT NOT NULL,
    method TEXT NOT NULL,
    spec JSONB,
    manual_spec JSONB,
    is_manually_edited BOOLEAN DEFAULT false,
    has_conflict BOOLEAN DEFAULT false,
    response_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (path, method, project_id)
  );
`

export type PgDB = ReturnType<typeof createPgDB>

export function createPgDB(url: string, poolSize?: number) {
  const client = postgresJs(url, { max: poolSize ?? 10 })
  const db = drizzle(client, { schema: { projects: pgProjects, endpoints: pgEndpoints } })

  client.unsafe(INIT_SQL).catch((err: unknown) => {
    console.error('[EasyDocs] Failed to initialize Postgres schema:', err)
  })

  return db
}

// ─── Projects ────────────────────────────────────────────────────────────────

export async function pgFindOrCreateProject(db: PgDB, slug: string): Promise<string> {
  const existing = await db
    .select()
    .from(pgProjects)
    .where(eq(pgProjects.slug, slug))
    .limit(1)
    .then((r) => r[0])

  if (existing) return existing.id

  const result = await db
    .insert(pgProjects)
    .values({ name: slug, slug })
    .returning({ id: pgProjects.id })
  return result[0].id
}

export async function pgGetAllProjects(db: PgDB) {
  return db.select().from(pgProjects)
}

// ─── Endpoints ───────────────────────────────────────────────────────────────

export async function pgUpsertEndpoint(
  db: PgDB,
  projectId: string,
  path: string,
  method: HttpMethod,
  spec: Operation,
  responseHash: string
) {
  const existing = await db
    .select()
    .from(pgEndpoints)
    .where(
      and(
        eq(pgEndpoints.projectId, projectId),
        eq(pgEndpoints.path, path),
        eq(pgEndpoints.method, method)
      )
    )
    .limit(1)
    .then((r) => r[0])

  const hasConflict = !!(existing?.isManuallyEdited && existing.manualSpec)

  if (existing) {
    await db
      .update(pgEndpoints)
      .set({ spec, responseHash, hasConflict, updatedAt: new Date() })
      .where(eq(pgEndpoints.id, existing.id))
    return existing.id
  }

  const result = await db
    .insert(pgEndpoints)
    .values({ projectId, path, method, spec, responseHash })
    .returning({ id: pgEndpoints.id })
  return result[0].id
}

export async function pgGetByPathMethod(
  db: PgDB,
  projectId: string,
  path: string,
  method: HttpMethod
) {
  return db
    .select()
    .from(pgEndpoints)
    .where(
      and(
        eq(pgEndpoints.projectId, projectId),
        eq(pgEndpoints.path, path),
        eq(pgEndpoints.method, method)
      )
    )
    .limit(1)
    .then((r) => r[0])
}

export async function pgGetEndpointsByProject(db: PgDB, projectId: string) {
  return db.select().from(pgEndpoints).where(eq(pgEndpoints.projectId, projectId))
}

export async function pgGetAll(db: PgDB) {
  return db.select().from(pgEndpoints)
}

export async function pgDeleteById(db: PgDB, id: string) {
  await db.delete(pgEndpoints).where(eq(pgEndpoints.id, id))
}

export async function pgSaveManualSpec(db: PgDB, id: string, manualSpec: Operation) {
  await db
    .update(pgEndpoints)
    .set({ manualSpec, isManuallyEdited: true, hasConflict: false, updatedAt: new Date() })
    .where(eq(pgEndpoints.id, id))
}

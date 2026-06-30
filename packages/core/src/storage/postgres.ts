import { drizzle } from 'drizzle-orm/postgres-js'
import postgresJs from 'postgres'
import { and, desc, eq } from 'drizzle-orm'
import { pgTable, uuid, text, jsonb, timestamp, boolean } from 'drizzle-orm/pg-core'
import { specsEqual } from './versions.js'
import type { Operation } from '../spec/schema.js'
import type { HttpMethod } from '../types.js'
import type { DatabaseAdapter } from './adapter.js'
import type { Endpoint, Project, SpecVersion } from './schema.js'

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

export const pgSpecVersions = pgTable('spec_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  endpointId: uuid('endpoint_id').references(() => pgEndpoints.id, { onDelete: 'cascade' }),
  spec: jsonb('spec').$type<Operation>(),
  source: text('source').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
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

  CREATE TABLE IF NOT EXISTS spec_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint_id UUID REFERENCES endpoints(id) ON DELETE CASCADE,
    spec JSONB,
    source TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS spec_versions_endpoint
    ON spec_versions (endpoint_id, created_at);
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

async function pgRecordVersion(db: PgDB, endpointId: string, spec: Operation, source: 'ai' | 'manual') {
  await db.insert(pgSpecVersions).values({ endpointId, spec, source })
}

async function pgHasVersions(db: PgDB, endpointId: string) {
  const row = await db
    .select({ id: pgSpecVersions.id })
    .from(pgSpecVersions)
    .where(eq(pgSpecVersions.endpointId, endpointId))
    .limit(1)
    .then((r) => r[0])
  return !!row
}

export async function pgGetEndpointVersions(db: PgDB, endpointId: string) {
  return db
    .select()
    .from(pgSpecVersions)
    .where(eq(pgSpecVersions.endpointId, endpointId))
    .orderBy(desc(pgSpecVersions.createdAt))
}

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
    if (!specsEqual(spec, existing.spec)) {
      // Endpoints created before version history have no versions; backfill the
      // prior spec as a baseline so this first change has something to diff against.
      if (existing.spec && !(await pgHasVersions(db, existing.id))) {
        await pgRecordVersion(db, existing.id, existing.spec, 'ai')
      }
      await pgRecordVersion(db, existing.id, spec, 'ai')
    }
    return existing.id
  }

  const result = await db
    .insert(pgEndpoints)
    .values({ projectId, path, method, spec, responseHash })
    .returning({ id: pgEndpoints.id })
  await pgRecordVersion(db, result[0].id, spec, 'ai')
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
  await pgRecordVersion(db, id, manualSpec, 'manual')
}

export async function pgResolveConflict(db: PgDB, id: string, keep: 'ai' | 'manual') {
  if (keep === 'ai') {
    await db
      .update(pgEndpoints)
      .set({ manualSpec: null, isManuallyEdited: false, hasConflict: false, updatedAt: new Date() })
      .where(eq(pgEndpoints.id, id))
  } else {
    const row = await db.select().from(pgEndpoints).where(eq(pgEndpoints.id, id)).limit(1).then((r) => r[0])
    if (!row?.manualSpec) return
    await db
      .update(pgEndpoints)
      .set({ spec: row.manualSpec, manualSpec: null, isManuallyEdited: true, hasConflict: false, updatedAt: new Date() })
      .where(eq(pgEndpoints.id, id))
    if (!specsEqual(row.manualSpec, row.spec)) await pgRecordVersion(db, id, row.manualSpec, 'manual')
  }
}

// ─── Adapter ─────────────────────────────────────────────────────────────────

function toEndpoint(row: typeof pgEndpoints.$inferSelect): Endpoint {
  return row as unknown as Endpoint
}

function toProject(row: typeof pgProjects.$inferSelect): Project {
  return row as unknown as Project
}

export function createPostgresAdapter(url: string, poolSize?: number): DatabaseAdapter {
  const db = createPgDB(url, poolSize)
  return {
    findOrCreateProject: (slug) => pgFindOrCreateProject(db, slug),
    getEndpointByPathMethod: async (projectId, path, method) => {
      const row = await pgGetByPathMethod(db, projectId, path, method)
      return row ? toEndpoint(row) : undefined
    },
    upsertEndpoint: (projectId, path, method, spec, responseHash) =>
      pgUpsertEndpoint(db, projectId, path, method, spec, responseHash),
    getAllProjects: async () => {
      const rows = await pgGetAllProjects(db)
      return rows.map(toProject)
    },
    getAllEndpoints: async () => {
      const rows = await pgGetAll(db)
      return rows.map(toEndpoint)
    },
    getEndpointsByProject: async (projectId) => {
      const rows = await pgGetEndpointsByProject(db, projectId)
      return rows.map(toEndpoint)
    },
    getEndpointVersions: async (endpointId) => {
      const rows = await pgGetEndpointVersions(db, endpointId)
      return rows as unknown as SpecVersion[]
    },
    deleteEndpointById: (id) => pgDeleteById(db, id),
    saveManualSpec: (id, manualSpec) => pgSaveManualSpec(db, id, manualSpec),
    resolveConflict: (id, keep) => pgResolveConflict(db, id, keep),
  }
}

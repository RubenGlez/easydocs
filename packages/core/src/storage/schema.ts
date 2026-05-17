import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import type { Operation } from '../spec/schema.js'

export const projects = sqliteTable('projects', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
})

export const endpoints = sqliteTable('endpoints', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  projectId: text('project_id').references(() => projects.id),
  path: text('path').notNull(),
  method: text('method', {
    enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  }).notNull(),
  spec: text('spec', { mode: 'json' }).$type<Operation>(),
  manualSpec: text('manual_spec', { mode: 'json' }).$type<Operation>(),
  isManuallyEdited: integer('is_manually_edited', { mode: 'boolean' }).default(false),
  hasConflict: integer('has_conflict', { mode: 'boolean' }).default(false),
  responseHash: text('response_hash'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
})

export type Project = typeof projects.$inferSelect
export type Endpoint = typeof endpoints.$inferSelect
export type NewEndpoint = typeof endpoints.$inferInsert

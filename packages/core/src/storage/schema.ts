import { sql } from 'drizzle-orm'
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import type { Operation } from '../spec/schema.js'

export const endpoints = sqliteTable('endpoints', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
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

export type Endpoint = typeof endpoints.$inferSelect
export type NewEndpoint = typeof endpoints.$inferInsert

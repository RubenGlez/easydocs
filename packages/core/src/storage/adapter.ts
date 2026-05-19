import type { Operation } from '../spec/schema.js'
import type { HttpMethod, StorageConfig } from '../types.js'
import type { Endpoint, Project } from './schema.js'
import { createSqliteAdapter } from './sqlite.js'
import { createPostgresAdapter } from './postgres.js'

export interface DatabaseAdapter {
  findOrCreateProject(slug: string): Promise<string>
  getEndpointByPathMethod(projectId: string, path: string, method: HttpMethod): Promise<Endpoint | undefined>
  upsertEndpoint(projectId: string, path: string, method: HttpMethod, spec: Operation, responseHash: string): Promise<string>
  getAllProjects(): Promise<Project[]>
  getAllEndpoints(): Promise<Endpoint[]>
  getEndpointsByProject(projectId: string): Promise<Endpoint[]>
  deleteEndpointById(id: string): Promise<void>
  saveManualSpec(id: string, manualSpec: Operation): Promise<void>
  resolveConflict(id: string, keep: 'ai' | 'manual'): Promise<void>
}

export function createAdapter(config?: StorageConfig): DatabaseAdapter {
  if (config?.type === 'postgres' && config.url) {
    return createPostgresAdapter(config.url, config.poolSize)
  }
  return createSqliteAdapter(config?.url)
}

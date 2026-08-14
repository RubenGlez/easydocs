import type { Operation } from '../spec/schema.js'
import type { HttpMethod, StorageConfig } from '../types.js'
import type { Endpoint, Project, SpecVersion } from './schema.js'
import { createSqliteAdapter } from './sqlite.js'

export interface DatabaseAdapter {
  findOrCreateProject(slug: string): Promise<string>
  findProject(slug: string): Promise<string | null>
  getEndpointByPathMethod(projectId: string, path: string, method: HttpMethod): Promise<Endpoint | undefined>
  upsertEndpoint(projectId: string, path: string, method: HttpMethod, spec: Operation, responseHash: string): Promise<string>
  getAllProjects(): Promise<Project[]>
  getAllEndpoints(): Promise<Endpoint[]>
  getEndpointsByProject(projectId: string): Promise<Endpoint[]>
  getEndpointVersions(endpointId: string): Promise<SpecVersion[]>
  deleteEndpointById(id: string): Promise<void>
  saveManualSpec(id: string, manualSpec: Operation): Promise<void>
  resolveConflict(id: string, keep: 'ai' | 'manual'): Promise<void>
}

/**
 * Defer every call until `pending` resolves. Lets `createAdapter` stay
 * synchronous while the Postgres driver is loaded with a dynamic import.
 */
function lazyAdapter(pending: Promise<DatabaseAdapter>): DatabaseAdapter {
  const on = <K extends keyof DatabaseAdapter>(name: K): DatabaseAdapter[K] =>
    ((...args: unknown[]) =>
      pending.then((a) => (a[name] as (...a: unknown[]) => unknown)(...args))) as DatabaseAdapter[K]

  return {
    findOrCreateProject: on('findOrCreateProject'),
    findProject: on('findProject'),
    getEndpointByPathMethod: on('getEndpointByPathMethod'),
    upsertEndpoint: on('upsertEndpoint'),
    getAllProjects: on('getAllProjects'),
    getAllEndpoints: on('getAllEndpoints'),
    getEndpointsByProject: on('getEndpointsByProject'),
    getEndpointVersions: on('getEndpointVersions'),
    deleteEndpointById: on('deleteEndpointById'),
    saveManualSpec: on('saveManualSpec'),
    resolveConflict: on('resolveConflict'),
  }
}

export function createAdapter(config?: StorageConfig): DatabaseAdapter {
  if (config?.type === 'postgres' && config.url) {
    // Imported dynamically so the `postgres` driver is never loaded (or paid for
    // at startup) by the SQLite default, which is what almost every install uses.
    const url = config.url
    const poolSize = config.poolSize
    return lazyAdapter(
      import('./postgres.js').then((m) => m.createPostgresAdapter(url, poolSize))
    )
  }
  return createSqliteAdapter(config?.url)
}

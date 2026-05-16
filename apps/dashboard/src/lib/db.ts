import {
  createDB,
  getAllEndpoints,
  getEndpointsByProject,
  getAllProjects,
  findOrCreateProject,
} from '@easydocs/core'
import type { Endpoint, Project } from '@easydocs/core/schema'

let db: ReturnType<typeof createDB> | null = null

function getDb() {
  if (!db) db = createDB(process.env.EASYDOCS_DB_URL)
  return db
}

export async function fetchAllProjects(): Promise<Project[]> {
  return getAllProjects(getDb())
}

export async function fetchEndpoints(projectSlug?: string): Promise<Endpoint[]> {
  const db = getDb()
  if (!projectSlug) return getAllEndpoints(db)
  const projectId = await findOrCreateProject(db, projectSlug)
  return getEndpointsByProject(db, projectId)
}

const SECURITY_SCHEME_DEFS: Record<string, unknown> = {
  bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
  basicAuth: { type: 'http', scheme: 'basic' },
  apiKeyHeader: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
  apiKeyQuery: { type: 'apiKey', in: 'query', name: 'api_key' },
  cookieAuth: { type: 'apiKey', in: 'cookie', name: 'session' },
}

export function buildFullSpec(endpointList: Endpoint[], projectName?: string) {
  const usedSchemes = new Set<string>()
  const paths: Record<string, Record<string, unknown>> = {}

  for (const e of endpointList) {
    if (!e.path || !e.method) continue
    const activeSpec = e.isManuallyEdited && e.manualSpec ? e.manualSpec : e.spec
    if (!activeSpec) continue

    if (!paths[e.path]) paths[e.path] = {}
    paths[e.path][e.method.toLowerCase()] = activeSpec

    if (activeSpec.security) {
      for (const entry of activeSpec.security) {
        for (const name of Object.keys(entry)) {
          if (SECURITY_SCHEME_DEFS[name]) usedSchemes.add(name)
        }
      }
    }
  }

  const securitySchemes =
    usedSchemes.size > 0
      ? Object.fromEntries([...usedSchemes].map((n) => [n, SECURITY_SCHEME_DEFS[n]]))
      : undefined

  return {
    openapi: '3.0.3',
    info: { title: projectName ?? 'API Documentation', version: '1.0.0' },
    paths,
    ...(securitySchemes ? { components: { securitySchemes } } : {}),
  }
}

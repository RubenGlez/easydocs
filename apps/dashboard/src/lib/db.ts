import {
  createDB,
  getAllEndpoints,
  getEndpointsByProject,
  getAllProjects,
  findOrCreateProject,
  buildFullSpec,
} from '@easydocs/core'
export { buildFullSpec }
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

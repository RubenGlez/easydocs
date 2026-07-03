import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import {
  createDB,
  getAllEndpoints,
  getEndpointsByProject,
  getAllProjects,
  findOrCreateProject,
  buildFullSpec,
  computeDrift,
} from '@easydocs/core'
export { buildFullSpec }
import type { Endpoint, Project } from '@easydocs/core/schema'
import type { DriftReport } from '@easydocs/core'

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

export interface DriftData {
  /** False when no committed spec was found to compare against. */
  configured: boolean
  /** Path (relative to cwd) EasyDocs looked for the committed spec. */
  specPath: string
  report: DriftReport
  /** Endpoint id → number of drift findings on it, for badging the sidebar. */
  byEndpoint: Record<string, number>
  total: number
}

const EMPTY_REPORT: DriftReport = { undocumented: [], unobserved: [], mismatch: [] }

/**
 * Compare the committed spec (EASYDOCS_SPEC_PATH, default ./openapi.json)
 * against the spec derived from observed traffic. This is the producer-side
 * surface for docs-vs-reality drift — it never leaves the local machine.
 */
export async function fetchDrift(projectSlug?: string): Promise<DriftData> {
  const specPath = process.env.EASYDOCS_SPEC_PATH ?? 'openapi.json'

  let documented: unknown
  try {
    // YAML is a JSON superset, so this reads .json and .yaml alike.
    documented = yaml.load(readFileSync(resolve(process.cwd(), specPath), 'utf8'))
  } catch {
    return { configured: false, specPath, report: EMPTY_REPORT, byEndpoint: {}, total: 0 }
  }

  const endpoints = await fetchEndpoints(projectSlug)
  const observed = buildFullSpec(endpoints, projectSlug)
  const report = computeDrift(documented, observed)

  const all = [...report.undocumented, ...report.unobserved, ...report.mismatch]
  const byEndpoint: Record<string, number> = {}
  for (const e of endpoints) {
    const prefix = `paths.${e.path}.${e.method.toLowerCase()}`
    const count = all.filter((f) => f.path === prefix || f.path.startsWith(`${prefix}.`)).length
    if (count > 0) byEndpoint[e.id] = count
  }

  return { configured: true, specPath, report, byEndpoint, total: all.length }
}

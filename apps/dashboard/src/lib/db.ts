import { createDB, getAllEndpoints } from '@easydocs/core'
import type { Endpoint } from '@easydocs/core/schema'

let db: ReturnType<typeof createDB> | null = null

function getDb() {
  if (!db) db = createDB(process.env.EASYDOCS_DB_URL)
  return db
}

export async function fetchAllEndpoints(): Promise<Endpoint[]> {
  return getAllEndpoints(getDb())
}

export function buildFullSpec(endpointList: Endpoint[]) {
  return {
    openapi: '3.0.3',
    info: { title: 'API Documentation', version: '1.0.0' },
    paths: endpointList.reduce<Record<string, Record<string, unknown>>>((acc, e) => {
      if (!e.path || !e.method || !e.spec) return acc
      if (!acc[e.path]) acc[e.path] = {}
      acc[e.path][e.method.toLowerCase()] = e.spec
      return acc
    }, {}),
  }
}

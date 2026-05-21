import type { Endpoint } from '../storage/schema.js'
import { SECURITY_SCHEME_DEFS, isAuthSchemeName } from './auth.js'
import type { AuthSchemeName } from './auth.js'

export function buildFullSpec(endpointList: Endpoint[], projectName?: string) {
  const usedSchemes = new Set<AuthSchemeName>()
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
          if (isAuthSchemeName(name)) usedSchemes.add(name)
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

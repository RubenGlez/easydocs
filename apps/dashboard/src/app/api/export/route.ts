import { NextRequest, NextResponse } from 'next/server'
import { fetchEndpoints, buildFullSpec } from '@/lib/db'
import yaml from 'js-yaml'

export async function GET(req: NextRequest) {
  const format = req.nextUrl.searchParams.get('format') ?? 'json'
  const project = req.nextUrl.searchParams.get('project') ?? undefined
  const endpoints = await fetchEndpoints(project)
  const spec = buildFullSpec(endpoints, project)
  const filename = project ? `openapi-${project}` : 'openapi'

  if (format === 'yaml') {
    return new NextResponse(yaml.dump(spec), {
      headers: {
        'Content-Type': 'application/yaml',
        'Content-Disposition': `attachment; filename="${filename}.yaml"`,
      },
    })
  }

  return new NextResponse(JSON.stringify(spec, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}.json"`,
    },
  })
}

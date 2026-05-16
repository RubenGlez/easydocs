import { NextRequest, NextResponse } from 'next/server'
import { fetchAllEndpoints, buildFullSpec } from '@/lib/db'
import yaml from 'js-yaml'

export async function GET(req: NextRequest) {
  const format = req.nextUrl.searchParams.get('format') ?? 'json'
  const endpoints = await fetchAllEndpoints()
  const spec = buildFullSpec(endpoints)

  if (format === 'yaml') {
    return new NextResponse(yaml.dump(spec), {
      headers: {
        'Content-Type': 'application/yaml',
        'Content-Disposition': 'attachment; filename="openapi.yaml"',
      },
    })
  }

  return new NextResponse(JSON.stringify(spec, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="openapi.json"',
    },
  })
}

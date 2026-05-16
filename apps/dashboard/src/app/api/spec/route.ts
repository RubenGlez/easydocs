import { NextRequest, NextResponse } from 'next/server'
import { fetchEndpoints, buildFullSpec } from '@/lib/db'

export async function GET(req: NextRequest) {
  const project = req.nextUrl.searchParams.get('project') ?? undefined
  const endpoints = await fetchEndpoints(project)
  return NextResponse.json(buildFullSpec(endpoints, project))
}

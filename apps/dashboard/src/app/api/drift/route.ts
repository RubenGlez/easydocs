import { NextRequest, NextResponse } from 'next/server'
import { fetchDrift } from '@/lib/db'

export async function GET(req: NextRequest) {
  const project = req.nextUrl.searchParams.get('project') ?? undefined
  return NextResponse.json(await fetchDrift(project))
}

import { NextResponse } from 'next/server'
import { fetchAllEndpoints, buildFullSpec } from '@/lib/db'

export async function GET() {
  const endpoints = await fetchAllEndpoints()
  return NextResponse.json(buildFullSpec(endpoints))
}

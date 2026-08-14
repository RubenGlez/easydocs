import { NextRequest, NextResponse } from 'next/server'
import { getEndpointVersions } from '@easydocs/core'
import { getDb } from '@/lib/db'

// Version history for an endpoint, newest first.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const versions = await getEndpointVersions(getDb(), id)
  return NextResponse.json({ versions })
}

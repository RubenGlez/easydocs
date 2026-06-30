import { NextRequest, NextResponse } from 'next/server'
import { createDB, getEndpointVersions } from '@easydocs/core'

function getDb() {
  return createDB(process.env.EASYDOCS_DB_URL)
}

// Version history for an endpoint, newest first.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const versions = await getEndpointVersions(getDb(), id)
  return NextResponse.json({ versions })
}

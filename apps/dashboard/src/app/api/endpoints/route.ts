import { NextResponse } from 'next/server'
import { fetchAllEndpoints } from '@/lib/db'
import { createDB, deleteEndpointById } from '@easydocs/core'

export async function GET() {
  const endpoints = await fetchAllEndpoints()
  return NextResponse.json(endpoints)
}

export async function DELETE(req: Request) {
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const db = createDB(process.env.EASYDOCS_DB_URL)
  await deleteEndpointById(db, id as string)
  return NextResponse.json({ ok: true })
}

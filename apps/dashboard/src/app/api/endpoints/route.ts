import { NextRequest, NextResponse } from 'next/server'
import { fetchEndpoints, getDb } from '@/lib/db'
import { deleteEndpointById } from '@easydocs/core'

export async function GET(req: NextRequest) {
  const project = req.nextUrl.searchParams.get('project') ?? undefined
  const endpoints = await fetchEndpoints(project)
  return NextResponse.json(endpoints)
}

export async function DELETE(req: Request) {
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  await deleteEndpointById(getDb(), id as string)
  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { saveManualSpec, resolveConflict } from '@easydocs/core'
import { getDb } from '@/lib/db'
import type { Operation } from '@easydocs/core'

// Save a manual spec edit
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json() as { spec: Operation }
  if (!body.spec) return NextResponse.json({ error: 'spec required' }, { status: 400 })
  await saveManualSpec(getDb(), id, body.spec)
  return NextResponse.json({ ok: true })
}

// Resolve a conflict: keep 'ai' or 'manual'
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json() as { keep: 'ai' | 'manual' }
  if (body.keep !== 'ai' && body.keep !== 'manual') {
    return NextResponse.json({ error: 'keep must be "ai" or "manual"' }, { status: 400 })
  }
  await resolveConflict(getDb(), id, body.keep)
  return NextResponse.json({ ok: true })
}

import { NextResponse } from 'next/server'
import { fetchAllProjects } from '@/lib/db'

export async function GET() {
  const projects = await fetchAllProjects()
  return NextResponse.json(projects)
}

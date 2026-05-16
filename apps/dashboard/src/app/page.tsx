import { fetchEndpoints, fetchAllProjects } from '@/lib/db'
import { Dashboard } from '@/components/Dashboard'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ project?: string }>
}

export default async function HomePage({ searchParams }: Props) {
  const { project } = await searchParams
  const [endpoints, projects] = await Promise.all([
    fetchEndpoints(project),
    fetchAllProjects(),
  ])

  return <Dashboard endpoints={endpoints} projects={projects} currentProject={project} />
}

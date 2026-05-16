import { fetchAllEndpoints } from '@/lib/db'
import { Dashboard } from '@/components/Dashboard'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const endpoints = await fetchAllEndpoints()
  return <Dashboard endpoints={endpoints} />
}

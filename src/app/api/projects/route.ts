import { listProjects } from '@/server/services/storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  return Response.json(listProjects())
}

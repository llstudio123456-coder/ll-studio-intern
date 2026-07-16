import { listRuns } from '@/server/services/kundenfinder/companiesRepo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  return Response.json({ ok: true, runs: listRuns(80) })
}

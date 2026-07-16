import type { InspirationSearchConfig } from '@shared/types'
import { runInspirationSearch } from '@/server/services/inspirationSearch'
import { sseRun } from '@/server/sse'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const config = (await req.json()) as InspirationSearchConfig
  return sseRun((emit) => runInspirationSearch(config, emit))
}

import type { RunConfig } from '@shared/types'
import { runPipeline } from '@/server/services/urlPipeline'
import { sseRun } from '@/server/sse'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const config = (await req.json()) as RunConfig
  return sseRun((emit) => runPipeline(config, emit))
}

import { aiStatus } from '@/server/services/ai'
import { providerStatus } from '@/server/services/providers/registry'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  return Response.json({ ai: aiStatus(), providers: providerStatus() })
}

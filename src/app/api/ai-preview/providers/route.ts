import { getPublicProviderStatus } from '@/server/services/aiProviderSettings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** ÖFFENTLICH: liefert nur Provider-Verfügbarkeit/Modell/Key-vorhanden(ja/nein) – NIEMALS den Key selbst. */
export async function GET() {
  try {
    return Response.json({ ok: true, status: getPublicProviderStatus() })
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

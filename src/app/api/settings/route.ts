import type { SettingsPatch } from '@/server/services/config'
import { settingsView, saveSettings } from '@/server/services/config'
import { guardApi } from '@/server/auth/guard'
import { audit } from '@/server/auth/repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Einstellungen/API-Schlüssel sind sensibel → nur Administratoren (autoritativ serverseitig).
export async function GET() {
  const g = await guardApi({ role: 'admin' })
  if (!g.ok) return g.response
  return Response.json(settingsView())
}

export async function POST(req: Request) {
  const g = await guardApi({ role: 'admin' })
  if (!g.ok) return g.response
  const patch = (await req.json()) as SettingsPatch
  saveSettings(patch)
  audit('settings_updated', { userId: g.user?.id, email: g.user?.email, resource: 'settings' })
  return Response.json(settingsView())
}

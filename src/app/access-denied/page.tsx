import Link from 'next/link'
import { signOut } from '@/auth'
import { AuthShell } from '@/components/auth/AuthShell'

export const dynamic = 'force-dynamic'

const MESSAGES: Record<string, { title: string; text: string }> = {
  setup: { title: 'Sicherheitseinrichtung erforderlich', text: 'Die Anmeldung ist für diese Umgebung noch nicht vollständig konfiguriert. Bitte wende dich an die Administration.' },
  role: { title: 'Keine Berechtigung', text: 'Dein Konto hat nicht die erforderliche Rolle für diesen Bereich.' },
  AccessDenied: { title: 'Zugriff nicht freigegeben', text: 'Dieses Google-Konto ist nicht für das interne LL-Studio-Tool freigeschaltet.' },
  default: { title: 'Zugriff nicht freigegeben', text: 'Der Zugriff ist ausschließlich für freigeschaltete Mitarbeiter von LL Studio vorgesehen.' }
}

export default async function AccessDeniedPage({ searchParams }: { searchParams: Promise<{ reason?: string; error?: string }> }) {
  const sp = await searchParams
  const key = sp.reason || sp.error || 'default'
  const m = MESSAGES[key] || MESSAGES.default

  async function doSignOut() {
    'use server'
    await signOut({ redirectTo: '/login' })
  }

  return (
    <AuthShell title={m.title} subtitle={m.text}>
      <div className="space-y-2">
        <form action={doSignOut}>
          <button type="submit" className="btn-ink flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-medium">Mit anderem Konto anmelden</button>
        </form>
        <Link href="/login" className="block text-center text-xs text-[var(--color-muted)] hover:underline">Zur Anmeldung</Link>
      </div>
    </AuthShell>
  )
}

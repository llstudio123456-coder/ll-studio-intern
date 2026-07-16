import Link from 'next/link'
import { auth, signIn } from '@/auth'
import { authConfigured } from '@/server/auth/config'
import { AuthShell, GoogleMark } from '@/components/auth/AuthShell'

export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  const configured = authConfigured()
  const session = configured ? await auth() : null

  if (!configured) {
    return (
      <AuthShell title="Sicherheitseinrichtung erforderlich" subtitle="Die Anmeldung ist noch nicht konfiguriert.">
        <div className="space-y-3 text-sm text-[var(--color-ink-soft)]">
          <p>Trage in <code className="rounded bg-[var(--color-paper-2)] px-1">.env.local</code> die Google-OAuth-Zugangsdaten ein (<code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code>, <code>AUTH_SECRET</code>) und starte den Server neu.</p>
          <p className="text-[var(--color-muted)]">Lokal läuft die App bis dahin offen. In Produktion bleibt der Zugriff gesperrt.</p>
        </div>
      </AuthShell>
    )
  }

  if (session?.user?.id) {
    return (
      <AuthShell title="Bereits angemeldet" subtitle={session.user.email || undefined}>
        <Link href="/" className="btn-ink flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-medium">Weiter zum Tool</Link>
      </AuthShell>
    )
  }

  async function googleSignIn() {
    'use server'
    await signIn('google', { redirectTo: '/' })
  }

  return (
    <AuthShell
      title="LL Studio – Internes Tool"
      subtitle="Melde dich mit deinem freigegebenen Google-Konto an."
      footer="Der Zugriff ist ausschließlich für freigeschaltete Mitarbeiter von LL Studio vorgesehen."
    >
      <form action={googleSignIn}>
        <button type="submit" className="flex w-full items-center justify-center gap-3 rounded-xl border border-[var(--color-line-strong)] bg-white px-4 py-3 text-sm font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-paper-2)]">
          <GoogleMark /> Mit Google anmelden
        </button>
      </form>
    </AuthShell>
  )
}

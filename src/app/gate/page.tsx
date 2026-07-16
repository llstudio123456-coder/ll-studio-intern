'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Eye, EyeOff, ShieldCheck, RefreshCw } from 'lucide-react'
import { AuthShell } from '@/components/auth/AuthShell'

export default function GatePage() {
  return (
    <Suspense fallback={null}>
      <GateInner />
    </Suspense>
  )
}

function GateInner() {
  const router = useRouter()
  const params = useSearchParams()
  const [me, setMe] = useState<{ configured: boolean; authenticated: boolean; user?: { email?: string } | null; gate?: { isDev?: boolean; needsSetup?: boolean; canSetup?: boolean } } | null>(null)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/auth/me').then((r) => r.json()).then((d) => {
      setMe(d)
      if (d.configured && !d.authenticated) router.replace('/login')
      if (d.configured && d.gate?.verified) router.replace(safeFrom(params.get('from')))
    }).catch(() => {})
  }, [router, params])

  const setupMode = !!me?.gate?.needsSetup

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (setupMode && pw !== pw2) { setError('Die beiden Passwörter stimmen nicht überein.'); return }
    setBusy(true); setError('')
    try {
      const r = await fetch(setupMode ? '/api/auth/gate/setup' : '/api/auth/gate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: pw })
      })
      if (r.ok) { router.replace(safeFrom(params.get('from'))); return }
      // Bei der Vergabe die konkrete Regel zeigen; bei der Eingabe bewusst neutral bleiben.
      if (setupMode) {
        const d = await r.json().catch(() => null)
        setError(d?.error || 'Die Einrichtung war nicht erfolgreich.')
      } else {
        setError('Die Sicherheitsfreigabe war nicht erfolgreich.')
      }
    } catch {
      setError(setupMode ? 'Die Einrichtung war nicht erfolgreich.' : 'Die Sicherheitsfreigabe war nicht erfolgreich.')
    } finally { setBusy(false) }
  }

  // Einrichtung ist fällig, aber dieses Konto ist kein Admin → kein Formular, sondern klare Ansage.
  if (setupMode && me?.authenticated && !me.gate?.canSetup) {
    return (
      <AuthShell title="Sicherheitsfreigabe fehlt" subtitle="Das interne Zugangspasswort wurde noch nicht eingerichtet.">
        <p className="text-sm text-[var(--color-ink-soft)]">Nur ein Administrator kann die Sicherheitsfreigabe einrichten. Bitte wende dich an LL Studio.</p>
        <AccountRow email={me?.user?.email} />
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title={setupMode ? 'Sicherheitsfreigabe einrichten' : 'Interne Sicherheitsfreigabe'}
      subtitle={setupMode
        ? 'Lege jetzt das interne LL-Studio-Zugangspasswort fest. Es gilt für alle Mitarbeiter und wird nur als Hash gespeichert.'
        : 'Gib das interne LL-Studio-Zugangspasswort ein, um das Tool zu öffnen.'}
    >
      {!setupMode && me?.gate?.isDev && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">Entwicklungsmodus – unsicheres Testpasswort aktiv.</div>}
      {setupMode && (
        <div className="mb-4 rounded-lg border border-[var(--color-gold)]/40 bg-[var(--color-gold)]/10 px-3 py-2 text-xs text-[var(--color-ink-soft)]">
          Mindestens 14 Zeichen, Buchstaben und Zahlen. Bewahre das Passwort sicher auf — es lässt sich hier später nicht zurücksetzen.
        </div>
      )}
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[var(--color-muted)]">{setupMode ? 'Neues Zugangspasswort' : 'Zugangspasswort'}</span>
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoComplete={setupMode ? 'new-password' : 'current-password'}
              autoFocus
              className="inp pr-10"
              aria-label="Internes Zugangspasswort"
            />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute top-1/2 right-2 -translate-y-1/2 text-[var(--color-muted)]" aria-label={show ? 'Verbergen' : 'Anzeigen'}>
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>
        {setupMode && (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--color-muted)]">Passwort wiederholen</span>
            <input
              type={show ? 'text' : 'password'}
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              autoComplete="new-password"
              className="inp"
              aria-label="Zugangspasswort wiederholen"
            />
          </label>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button type="submit" disabled={busy || !pw || (setupMode && !pw2)} className="btn-ink flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium">
          {busy ? <RefreshCw size={15} className="animate-spin" /> : <ShieldCheck size={15} />} {setupMode ? 'Passwort festlegen' : 'Tool freigeben'}
        </button>
      </form>
      <AccountRow email={me?.user?.email} />
    </AuthShell>
  )
}

function AccountRow({ email }: { email?: string }) {
  return (
    <div className="mt-5 flex items-center justify-between text-xs text-[var(--color-muted)]">
      <span className="truncate">{email || ''}</span>
      <div className="flex gap-3">
        <button onClick={() => signOut({ redirectTo: '/login' })} className="hover:text-[var(--color-ink)] hover:underline">Anderes Konto</button>
        <button onClick={() => signOut({ redirectTo: '/login' })} className="hover:text-[var(--color-ink)] hover:underline">Abmelden</button>
      </div>
    </div>
  )
}

function safeFrom(from: string | null): string {
  // Nur interne, relative Pfade erlauben (kein Open-Redirect).
  if (from && from.startsWith('/') && !from.startsWith('//') && !from.startsWith('/login') && !from.startsWith('/gate')) return from
  return '/'
}

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
  const [me, setMe] = useState<{ configured: boolean; authenticated: boolean; user?: { email?: string } | null; gate?: { isDev?: boolean } } | null>(null)
  const [pw, setPw] = useState('')
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      const r = await fetch('/api/auth/gate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: pw }) })
      if (r.ok) { router.replace(safeFrom(params.get('from'))); return }
      setError('Die Sicherheitsfreigabe war nicht erfolgreich.')
    } catch {
      setError('Die Sicherheitsfreigabe war nicht erfolgreich.')
    } finally { setBusy(false) }
  }

  return (
    <AuthShell title="Interne Sicherheitsfreigabe" subtitle="Gib das interne LL-Studio-Zugangspasswort ein, um das Tool zu öffnen.">
      {me?.gate?.isDev && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">Entwicklungsmodus – unsicheres Testpasswort aktiv.</div>}
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[var(--color-muted)]">Zugangspasswort</span>
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoComplete="current-password"
              autoFocus
              className="inp pr-10"
              aria-label="Internes Zugangspasswort"
            />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute top-1/2 right-2 -translate-y-1/2 text-[var(--color-muted)]" aria-label={show ? 'Verbergen' : 'Anzeigen'}>
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button type="submit" disabled={busy || !pw} className="btn-ink flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium">
          {busy ? <RefreshCw size={15} className="animate-spin" /> : <ShieldCheck size={15} />} Tool freigeben
        </button>
      </form>
      <div className="mt-5 flex items-center justify-between text-xs text-[var(--color-muted)]">
        <span className="truncate">{me?.user?.email || ''}</span>
        <div className="flex gap-3">
          <button onClick={() => signOut({ redirectTo: '/login' })} className="hover:text-[var(--color-ink)] hover:underline">Anderes Konto</button>
          <button onClick={() => signOut({ redirectTo: '/login' })} className="hover:text-[var(--color-ink)] hover:underline">Abmelden</button>
        </div>
      </div>
    </AuthShell>
  )
}

function safeFrom(from: string | null): string {
  // Nur interne, relative Pfade erlauben (kein Open-Redirect).
  if (from && from.startsWith('/') && !from.startsWith('//') && !from.startsWith('/login') && !from.startsWith('/gate')) return from
  return '/'
}

'use client'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, ShieldAlert, RefreshCw } from 'lucide-react'
import { AuthShell } from '@/components/auth/AuthShell'

export default function AdminStepUpPage() {
  return (
    <Suspense fallback={null}>
      <StepUpInner />
    </Suspense>
  )
}

function StepUpInner() {
  const router = useRouter()
  const params = useSearchParams()
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      const r = await fetch('/api/admin/step-up', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: pw }) })
      if (r.ok) { router.replace(safeFrom(params.get('from'))); return }
      setError('Die Bestätigung war nicht erfolgreich.')
    } catch {
      setError('Die Bestätigung war nicht erfolgreich.')
    } finally { setBusy(false) }
  }

  return (
    <AuthShell title="Adminbereich bestätigen" subtitle="Der Adminbereich verlangt eine erneute Bestätigung mit dem internen Sicherheitscode.">
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-[var(--color-gold)]/40 bg-[var(--color-gold)]/10 px-3 py-2 text-xs text-[var(--color-ink-soft)]">
        <ShieldAlert size={14} className="mt-0.5 shrink-0 text-[var(--color-gold)]" />
        <span>Die Freigabe gilt 30 Minuten. Danach ist sie erneut nötig.</span>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-[var(--color-muted)]">Interner Sicherheitscode</span>
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoComplete="current-password"
              autoFocus
              className="inp pr-10"
              aria-label="Interner Sicherheitscode"
            />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute top-1/2 right-2 -translate-y-1/2 text-[var(--color-muted)]" aria-label={show ? 'Verbergen' : 'Anzeigen'}>
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button type="submit" disabled={busy || !pw} className="btn-ink flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium">
          {busy ? <RefreshCw size={15} className="animate-spin" /> : <ShieldAlert size={15} />} Adminbereich öffnen
        </button>
      </form>
    </AuthShell>
  )
}

function safeFrom(from: string | null): string {
  // Nur interne Admin-Pfade erlauben (kein Open-Redirect, keine Umleitung aus dem Adminbereich heraus).
  if (from && from.startsWith('/admin') && !from.startsWith('//') && from !== '/admin/bestaetigen') return from
  return '/admin'
}

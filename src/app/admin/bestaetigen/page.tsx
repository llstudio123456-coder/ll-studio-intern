'use client'
import { Suspense, useRef, useState } from 'react'
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
  const inputRef = useRef<HTMLInputElement>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return // Doppelklick / Enter-Spam: keine zweite parallele Anfrage
    setBusy(true); setError('')
    try {
      const from = params.get('from')
      const r = await fetch(`/api/admin/step-up${from ? `?from=${encodeURIComponent(from)}` : ''}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password: pw })
      })
      const d = (await r.json().catch(() => null)) as { success?: boolean; redirectTo?: string } | null

      if (r.ok && d?.success) {
        // Die Reihenfolge ist der eigentliche Fix.
        //
        // Next.js prefetcht die Nav-Links; die Middleware beantwortet diese Prefetches (mangels
        // Admin-Cookie) mit einer Weiterleitung hierher, und der Client Router Cache merkt sich
        // das. Ein bloßes router.replace('/admin') träfe diesen Cache, löste KEINE Netzwerkanfrage
        // aus — die Middleware sähe das gerade gesetzte Cookie also nie und schickte uns
        // scheinbar erneut zur Passwortabfrage. Genau das war der Fehler.
        //
        // router.refresh() verwirft den Cache, erst danach navigieren wir. Kein Reload, kein
        // Timeout — die Session wird direkt korrekt erkannt.
        router.refresh()
        router.replace(d.redirectTo || '/admin')
        return // busy bleibt an: Die Seite verschwindet gleich, ein „bereit"-Zustand wäre irreführend.
      }

      setError('Die Bestätigung war nicht erfolgreich.')
      setPw('') // Falsche Eingabe nicht stehen lassen
      inputRef.current?.focus()
      setBusy(false)
    } catch {
      setError('Die Bestätigung konnte gerade nicht abgeschlossen werden. Bitte versuche es erneut.')
      inputRef.current?.focus()
      setBusy(false)
    }
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
              ref={inputRef}
              type={show ? 'text' : 'password'}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              disabled={busy}
              autoComplete="current-password"
              autoFocus
              className="inp pr-10 disabled:opacity-60"
              aria-label="Interner Sicherheitscode"
            />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute top-1/2 right-2 -translate-y-1/2 text-[var(--color-muted)]" aria-label={show ? 'Verbergen' : 'Anzeigen'}>
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
        <button type="submit" disabled={busy || !pw} className="btn-ink flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium">
          {busy ? <RefreshCw size={15} className="animate-spin" /> : <ShieldAlert size={15} />}
          {busy ? 'Bestätigung wird geprüft …' : 'Adminbereich öffnen'}
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

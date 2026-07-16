'use client'
import { useEffect, useState } from 'react'

/**
 * Dezenter Hinweisstreifen zum Sicherheitszustand:
 * - Anmeldung nicht konfiguriert (läuft lokal offen)
 * - Entwicklungsmodus mit unsicherem Testpasswort aktiv
 * Erscheint nie, wenn alles regulär konfiguriert ist.
 */
export function SecurityBanner() {
  const [state, setState] = useState<{ configured: boolean; gate?: { isDev?: boolean } } | null>(null)
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => setState(d))
      .catch(() => {})
  }, [])
  if (!state) return null
  if (!state.configured) {
    return (
      <div className="w-full bg-amber-100 px-4 py-1.5 text-center text-xs text-amber-900">
        ⚠ Anmeldung noch nicht konfiguriert — die App läuft <b>lokal offen</b>. Google-Login in <code>.env.local</code> aktivieren (siehe README/Bericht). In Produktion wird dieser Zustand verweigert.
      </div>
    )
  }
  if (state.gate?.isDev) {
    return (
      <div className="w-full bg-red-100 px-4 py-1.5 text-center text-xs font-medium text-red-800">
        ⚠ Entwicklungsmodus — unsicheres Testpasswort aktiv. Vor Produktivbetrieb ein sicheres Zugangspasswort setzen.
      </div>
    )
  }
  return null
}

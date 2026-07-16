'use client'
import { ExternalLink, Search } from 'lucide-react'
import type { SearchQuery } from '@shared/types'

/** Generierte Suchanfragen + Buttons zum manuellen Öffnen (Fallback ohne API). */
export function QueriesPanel({ queries }: { queries: SearchQuery[] }) {
  if (!queries.length) return null
  return (
    <div className="card p-5 fade-up">
      <div className="mb-1 flex items-center gap-2">
        <Search size={16} className="text-[var(--color-gold)]" />
        <h3 className="font-display text-lg">Generierte Suchanfragen</h3>
      </div>
      <p className="mb-4 text-xs text-[var(--color-muted)]">
        Falls die automatische Suche blockiert wird: Anfrage öffnen, passende Webseiten kopieren und unten als manuelle URL einfügen.
      </p>
      <div className="space-y-2">
        {queries.map((q) => (
          <div key={q.id} className="flex flex-col gap-2 rounded-xl border border-[var(--color-line)] p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm font-medium">{q.query}</div>
            <div className="flex flex-wrap gap-1.5">
              {q.manualSearchUrls.map((s) => (
                <a key={s.engine} href={s.url} target="_blank" rel="noreferrer" className="btn-ghost inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs">
                  {s.engine} <ExternalLink size={11} />
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

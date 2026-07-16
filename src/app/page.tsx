'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Link2, Sparkles, ArrowRight, FileText, Clock, Wand2, Copy } from 'lucide-react'
import { getJson } from '@/lib/client'
import { QUICK_CHIPS } from '@/lib/categories'
import { PageHeader } from '@/components/ui/Ui'
import { useToast } from '@/lib/stores/toastStore'
import type { ProjectSummary } from '@/server/services/storage'
import type { SavedPrompt } from '@shared/types'

export default function Dashboard() {
  const [recent, setRecent] = useState<ProjectSummary[]>([])
  const [prompts, setPrompts] = useState<SavedPrompt[]>([])
  const toast = useToast((s) => s.show)
  useEffect(() => {
    getJson<ProjectSummary[]>('/api/projects').then((p) => setRecent(p.slice(0, 4))).catch(() => {})
    getJson<SavedPrompt[]>('/api/prompts').then((p) => setPrompts(p.slice(0, 4))).catch(() => {})
  }, [])

  const copyPrompt = (p: SavedPrompt) => {
    navigator.clipboard.writeText(p.promptText)
    toast('Prompt kopiert', 'success')
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-7">
      <PageHeader
        eyebrow="LL Studio · Internes Tool"
        title="Kundenanalyse & Website-Inspiration"
        subtitle="Analysiere eine Kunden-Webseite oder suche gezielt nach optisch starken Vorbildern – als Inspiration für Design, Struktur, Inhalte und Funktionen."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <ModeCard
          href="/url-analyse"
          icon={<Link2 size={20} />}
          title="URL Analyse"
          desc="Webseite eines Kunden eingeben → Analyse + passende Mitbewerber & Inspiration."
        />
        <ModeCard
          href="/inspiration"
          icon={<Sparkles size={20} />}
          title="Inspiration Suche"
          desc="Begriff oder Kategorien wählen → die besten, ästhetischen Webseiten der Branche finden."
          gold
        />
      </div>

      <section>
        <h2 className="mb-2 font-display text-xl">Schnellstart</h2>
        <div className="flex flex-wrap gap-2">
          {QUICK_CHIPS.map((c) => (
            <Link key={c} href={`/inspiration?q=${encodeURIComponent(c)}`} className="chip rounded-full px-3.5 py-1.5 text-sm">
              {c}
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-xl">Letzte Reports</h2>
          <Link href="/reports" className="text-sm text-[var(--color-gold)] hover:underline">alle ansehen</Link>
        </div>
        {recent.length === 0 ? (
          <div className="card p-6 text-sm text-[var(--color-muted)]">Noch keine Analysen. Starte oben deine erste Suche.</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {recent.map((p) => (
              <Link key={p.id} href={`/reports?open=${p.id}`} className="card flex items-center gap-3 p-4 transition hover:shadow-[0_6px_24px_rgb(0,0,0,0.05)]">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--color-paper-2)] text-[var(--color-gold)]">
                  {p.mode === 'search' ? <Sparkles size={17} /> : <Link2 size={17} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{p.title}</div>
                  <div className="truncate text-xs text-[var(--color-muted)]">{p.subtitle || '—'} · {p.resultCount} Webseiten</div>
                </div>
                <div className="text-right text-xs text-[var(--color-muted)]">
                  <div className="flex items-center gap-1"><Clock size={11} /> {new Date(p.createdAt).toLocaleDateString('de-DE')}</div>
                  <div className="mt-0.5 font-semibold text-[var(--color-ink)]">Top {p.topScore}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {prompts.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-xl">Letzte Prompts</h2>
            <Link href="/prompt-generator" className="text-sm text-[var(--color-gold)] hover:underline">zum Prompt Generator</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {prompts.map((p) => (
              <div key={p.id} className="card flex items-center gap-3 p-4">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--color-paper-2)] text-[var(--color-gold)]">
                  <Wand2 size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{p.title}</div>
                  <div className="truncate text-xs text-[var(--color-muted)]">
                    Vorlage: {p.inspirationSource} · {new Date(p.createdAt).toLocaleDateString('de-DE')}
                  </div>
                </div>
                <button onClick={() => copyPrompt(p)} className="btn-ghost grid h-9 w-9 place-items-center rounded-lg" title="Prompt kopieren">
                  <Copy size={15} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="rounded-xl border border-[var(--color-gold-soft)] bg-[var(--color-gold-soft)]/40 px-4 py-3 text-xs text-[var(--color-ink-soft)]">
        ⚠️ Nur als Inspiration verwenden. Keine Inhalte, Bilder, Logos oder Designs 1:1 kopieren.
      </div>
    </div>
  )
}

function ModeCard({ href, icon, title, desc, gold }: { href: string; icon: React.ReactNode; title: string; desc: string; gold?: boolean }) {
  return (
    <Link href={href} className="card group relative overflow-hidden p-6 transition hover:shadow-[0_10px_40px_rgb(0,0,0,0.07)]">
      <div className={'grid h-12 w-12 place-items-center rounded-2xl ' + (gold ? 'bg-[var(--color-gold)] text-white' : 'bg-[var(--color-ink)] text-[var(--color-paper)]')}>
        {icon}
      </div>
      <h3 className="mt-4 font-display text-2xl">{title}</h3>
      <p className="mt-1 text-sm text-[var(--color-muted)]">{desc}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[var(--color-gold)]">
        Öffnen <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
      </span>
      <FileText size={120} className="absolute -right-6 -bottom-6 text-[var(--color-paper-2)] opacity-50" />
    </Link>
  )
}

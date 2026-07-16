'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Wand2, Copy, Download, Trash2, Plus } from 'lucide-react'
import type { SavedPrompt } from '@shared/types'
import { getJson } from '@/lib/client'
import { usePromptStore } from '@/lib/stores/promptStore'
import { useToast } from '@/lib/stores/toastStore'
import { PROMPT_TYPES, PLATFORMS } from '@/lib/categories'

const typeLabel = (v: string) => PROMPT_TYPES.find((t) => t.value === v)?.label || v
const platformLabel = (v: string) => PLATFORMS.find((p) => p.value === v)?.label || v

/** Zeigt die zu einem Report-Projekt gespeicherten Prompts + Schnellzugang zum Generator. */
export function RelatedPrompts({ projectId, projectTitle }: { projectId: string; projectTitle?: string }) {
  const [list, setList] = useState<SavedPrompt[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const router = useRouter()
  const setField = usePromptStore((s) => s.setField)
  const toast = useToast((s) => s.show)

  const refresh = useCallback(() => {
    getJson<SavedPrompt[]>('/api/prompts')
      .then((all) => setList(all.filter((p) => p.projectId === projectId)))
      .catch(() => {})
  }, [projectId])
  useEffect(() => refresh(), [refresh])

  const del = async (id: string) => {
    await fetch(`/api/prompts/${id}`, { method: 'DELETE' })
    toast('Prompt gelöscht', 'info')
    refresh()
  }
  const copy = (t: string) => {
    navigator.clipboard.writeText(t)
    toast('Prompt kopiert', 'success')
  }
  const download = (p: SavedPrompt) => {
    const blob = new Blob([p.promptText], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${p.targetCompany.replace(/[^a-z0-9]/gi, '_')}_prompt.txt`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const newPrompt = () => {
    setField({ projectId })
    router.push('/prompt-generator')
  }

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wand2 size={17} className="text-[var(--color-gold)]" />
          <h3 className="font-display text-lg">Zugehörige Prompts</h3>
          <span className="rounded-full bg-[var(--color-paper-2)] px-2 py-0.5 text-xs text-[var(--color-muted)]">{list.length}</span>
        </div>
        <button onClick={newPrompt} className="btn-ghost inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm">
          <Plus size={14} /> Neuer Prompt für dieses Projekt
        </button>
      </div>

      {list.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">
          Noch keine Prompts für {projectTitle || 'dieses Projekt'}. Wähle oben eine Webseite und klicke „Prompt erstellen“ –
          beim Speichern dieses Projekt auswählen.
        </p>
      ) : (
        <div className="space-y-2">
          {list.map((p) => (
            <div key={p.id} className="rounded-xl border border-[var(--color-line)] p-3">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{p.title}</div>
                  <div className="truncate text-xs text-[var(--color-muted)]">
                    Vorlage: {p.inspirationSource} · {typeLabel(p.promptType)} · {platformLabel(p.platform)} · {new Date(p.createdAt).toLocaleDateString('de-DE')}
                  </div>
                </div>
                <button onClick={() => setOpenId(openId === p.id ? null : p.id)} className="btn-ghost rounded-lg px-2.5 py-1 text-xs">{openId === p.id ? 'schließen' : 'ansehen'}</button>
                <button onClick={() => copy(p.promptText)} className="btn-ghost grid h-8 w-8 place-items-center rounded-lg" title="Kopieren"><Copy size={14} /></button>
                <button onClick={() => download(p)} className="btn-ghost grid h-8 w-8 place-items-center rounded-lg" title="Download"><Download size={14} /></button>
                <button onClick={() => del(p.id)} className="btn-ghost grid h-8 w-8 place-items-center rounded-lg text-[var(--color-muted)] hover:text-red-600" title="Löschen"><Trash2 size={14} /></button>
              </div>
              {openId === p.id && (
                <pre className="mt-2 max-h-80 overflow-auto rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-2)]/40 p-3 font-mono text-[12px] whitespace-pre-wrap">{p.promptText}</pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

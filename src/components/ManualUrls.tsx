'use client'
import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { ManualUrlInput } from '@shared/types'

export function ManualUrls({ urls, onChange }: { urls: ManualUrlInput[]; onChange: (u: ManualUrlInput[]) => void }) {
  const [val, setVal] = useState('')
  const add = () => {
    const u = val.trim()
    if (u) {
      onChange([...urls, { url: u }])
      setVal('')
    }
  }
  return (
    <div>
      <div className="mb-1.5 block text-xs font-medium tracking-wide text-[var(--color-muted)] uppercase">
        Eigene Webseiten manuell hinzufügen
      </div>
      <div className="flex gap-2">
        <input
          className="inp flex-1"
          placeholder="https://beispiel.de"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
        />
        <button onClick={add} className="btn-ghost grid h-10 w-10 place-items-center rounded-lg">
          <Plus size={18} />
        </button>
      </div>
      {urls.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {urls.map((m, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-paper-2)] px-3 py-1 text-xs">
              {m.url}
              <button onClick={() => onChange(urls.filter((_, j) => j !== i))} className="text-[var(--color-muted)] hover:text-[var(--color-ink)]">
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

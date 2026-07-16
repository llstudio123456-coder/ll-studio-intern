'use client'
import { FileJson, FileSpreadsheet, FileText, RotateCcw } from 'lucide-react'

/** Export-Leiste: lädt JSON/CSV/PDF über die /api/export-Route herunter. */
export function ExportBar({ projectId, onReset }: { projectId: string; onReset?: () => void }) {
  const href = (format: string) => `/api/export?id=${encodeURIComponent(projectId)}&format=${format}`
  return (
    <div className="card flex flex-wrap items-center gap-2 p-4">
      <span className="mr-1 text-sm font-medium">Export:</span>
      <a href={href('json')} className="btn-ghost inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm">
        <FileJson size={15} /> JSON
      </a>
      <a href={href('csv')} className="btn-ghost inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm">
        <FileSpreadsheet size={15} /> CSV
      </a>
      <a href={href('pdf')} target="_blank" rel="noreferrer" className="btn-ghost inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm">
        <FileText size={15} /> PDF-Report
      </a>
      {onReset && (
        <button onClick={onReset} className="btn-ghost ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm">
          <RotateCcw size={15} /> Neue Analyse
        </button>
      )}
    </div>
  )
}

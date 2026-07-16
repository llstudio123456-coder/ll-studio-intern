import type { ExportFormat } from '@shared/types'
import { loadProject } from '@/server/services/storage'
import { exportProjectBuffer } from '@/server/services/exporter'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function GET(req: Request) {
  const url = new URL(req.url)
  const id = url.searchParams.get('id') || ''
  const format = (url.searchParams.get('format') || 'json') as ExportFormat
  const project = loadProject(id)
  if (!project) return new Response('Projekt nicht gefunden', { status: 404 })

  const { filename, buffer, mime } = await exportProjectBuffer(project, format)
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': mime,
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  })
}

import { existsSync, readFileSync } from 'fs'
import { basename, join } from 'path'
import { screenshotsDir } from '@/server/utils/paths'

export const runtime = 'nodejs'

/** Liefert einen Screenshot aus dem .data/screenshots-Ordner. */
export async function GET(req: Request) {
  const f = new URL(req.url).searchParams.get('f') || ''
  const safe = basename(f) // Path-Traversal verhindern
  if (!safe.endsWith('.png')) return new Response('not found', { status: 404 })
  const path = join(screenshotsDir(), safe)
  if (!existsSync(path)) return new Response('not found', { status: 404 })
  const buf = readFileSync(path)
  return new Response(new Uint8Array(buf), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' }
  })
}

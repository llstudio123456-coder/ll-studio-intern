import type { ExtractedWebsiteImage, ImageRole } from '@shared/types'
import { BrowserManager } from './browser'
import { log } from '../utils/logger'

const SKIP = /logo|icon|sprite|favicon|placeholder|avatar|loader|spinner|pixel|tracking|\.svg($|\?)/i

interface ImgRaw {
  url: string
  w: number
  h: number
  alt: string
  top: number
}

function absolute(base: string, u: string): string | null {
  try {
    return new URL(u, base).toString()
  } catch {
    return null
  }
}

/** Extrahiert geeignete Bilder von der Website von Kunde A (für den Bild-Transfer). */
export async function extractWebsiteImages(bm: BrowserManager, url: string): Promise<ExtractedWebsiteImage[]> {
  let page
  try {
    page = await bm.newPage()
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 })
    await page.waitForTimeout(1200)
    const raw = (await page.evaluate(() => {
      const imgs = Array.from(document.images).map((im) => {
        const r = im.getBoundingClientRect()
        return { url: im.currentSrc || im.src, w: im.naturalWidth || Math.round(r.width), h: im.naturalHeight || Math.round(r.height), alt: im.alt || '', top: r.top + window.scrollY }
      })
      const bgs: { url: string; w: number; h: number; alt: string; top: number }[] = []
      document.querySelectorAll('section,header,div,figure').forEach((el) => {
        const bi = getComputedStyle(el as Element).backgroundImage
        const m = bi && bi.includes('url(') ? bi.match(/url\(["']?(.*?)["']?\)/) : null
        if (m) {
          const r = (el as HTMLElement).getBoundingClientRect()
          if (r.width > 480 && r.height > 220) bgs.push({ url: m[1], w: Math.round(r.width), h: Math.round(r.height), alt: '', top: r.top + window.scrollY })
        }
      })
      const og = (document.querySelector('meta[property="og:image"]') as HTMLMetaElement)?.content || ''
      return { imgs, bgs, og }
    })) as { imgs: ImgRaw[]; bgs: ImgRaw[]; og: string }

    const seen = new Set<string>()
    const collected: { url: string; w: number; h: number; alt: string; top: number; og?: boolean }[] = []
    const add = (it: { url: string; w: number; h: number; alt: string; top: number; og?: boolean }) => {
      const abs = absolute(page!.url(), it.url)
      if (!abs || !/^https?:/.test(abs)) return
      if (SKIP.test(abs)) return
      if (seen.has(abs)) return
      seen.add(abs)
      collected.push({ ...it, url: abs })
    }
    if (raw.og) add({ url: raw.og, w: 1200, h: 630, alt: 'og', top: 0, og: true })
    for (const i of [...raw.imgs, ...raw.bgs]) add(i)

    const usable = collected.filter((c) => {
      const area = c.w * c.h
      const ar = c.w / Math.max(1, c.h)
      return area >= 32000 && ar <= 4 && ar >= 0.3
    })

    usable.sort((a, b) => (b.og ? 1e9 : b.w * b.h) - (a.og ? 1e9 : a.w * a.h))

    let heroAssigned = false
    const out: ExtractedWebsiteImage[] = usable.slice(0, 14).map((c) => {
      const area = c.w * c.h
      const ar = c.w / Math.max(1, c.h)
      let role: ImageRole = 'gallery'
      if (!heroAssigned && (c.og || (ar >= 1.1 && ar <= 2.7 && area >= 120000))) {
        role = 'hero'
        heroAssigned = true
      } else if (ar < 0.9) role = 'section'
      else if (area < 60000) role = 'card'
      let quality = area >= 400000 ? 90 : area >= 150000 ? 82 : area >= 60000 ? 70 : 56
      if (ar > 2.6 || ar < 0.45) quality -= 12
      return { url: c.url, width: c.w, height: c.h, area, alt: c.alt, role, quality: Math.max(30, Math.min(100, quality)) }
    })
    return out
  } catch (e) {
    log.warn('Bild-Extraktion fehlgeschlagen:', e)
    return []
  } finally {
    try {
      await page?.close()
    } catch {
      /* ignore */
    }
  }
}

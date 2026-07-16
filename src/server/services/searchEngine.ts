import type { Page } from 'playwright'
import type {
  SearchQuery,
  LocalBrowserSearchResult,
  CompetitorCandidate
} from '@shared/types'
import { BrowserManager, looksBlocked } from './browser'
import { getDomain, isUsefulCandidate } from '../utils/url'
import { log } from '../utils/logger'

interface RawResult {
  url: string
  title: string
  snippet: string
}

/** Primär: Startpage (Google-Index, scrape-tolerant, direkte Links). */
async function searchStartpage(page: Page, query: string): Promise<{ raw: RawResult[]; blocked: boolean }> {
  const url = `https://www.startpage.com/sp/search?query=${encodeURIComponent(query)}`
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 })
  await page.waitForTimeout(1000)
  const html = await page.content()
  if ((resp && resp.status() >= 400) || looksBlocked(html, page.url())) return { raw: [], blocked: true }

  const raw = (await page.evaluate(() => {
    const out: { url: string; title: string; snippet: string }[] = []
    document.querySelectorAll('a.result-title, a.w-gl__result-title').forEach((a) => {
      const anchor = a as HTMLAnchorElement
      const container = anchor.closest('.w-gl__result, .result') as HTMLElement | null
      const snip =
        (container?.querySelector('.w-gl__description, .description, p') as HTMLElement)?.innerText || ''
      if (anchor.href) out.push({ url: anchor.href, title: (anchor.innerText || '').trim(), snippet: snip.trim() })
    })
    return out
  })) as RawResult[]
  return { raw, blocked: false }
}

/** Fallback: Bing (organische Ergebnisse; Links sind base64-kodierte Redirects). */
async function searchBing(page: Page, query: string): Promise<{ raw: RawResult[]; blocked: boolean }> {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=de&cc=de`
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 })
  await page.waitForTimeout(900)
  const html = await page.content()
  if ((resp && resp.status() >= 400) || looksBlocked(html, page.url())) return { raw: [], blocked: true }

  const raw = (await page.evaluate(() => {
    const out: { url: string; title: string; snippet: string }[] = []
    const decode = (href: string): string => {
      try {
        const u = new URL(href)
        if (u.hostname.includes('bing.com') && u.pathname.startsWith('/ck/')) {
          let raw = u.searchParams.get('u') || ''
          if (raw.startsWith('a1')) raw = raw.slice(2)
          raw = raw.replace(/-/g, '+').replace(/_/g, '/')
          const pad = raw.length % 4 ? '='.repeat(4 - (raw.length % 4)) : ''
          const dec = atob(raw + pad)
          if (/^https?:\/\//.test(dec)) return dec
        }
      } catch {}
      return href
    }
    document.querySelectorAll('#b_results li.b_algo').forEach((el) => {
      const a = el.querySelector('h2 a') as HTMLAnchorElement | null
      if (!a) return
      const snip = (el.querySelector('.b_caption p') as HTMLElement)?.innerText || ''
      out.push({ url: decode(a.href), title: a.innerText.trim(), snippet: snip.trim() })
    })
    return out
  })) as RawResult[]
  return { raw, blocked: false }
}

/** Weiterer Fallback: DuckDuckGo HTML (in manchen Netzen/Regionen verfügbar). */
async function searchDuckDuckGo(page: Page, query: string): Promise<{ raw: RawResult[]; blocked: boolean }> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=de-de`
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 })
  await page.waitForTimeout(800)
  const html = await page.content()
  if ((resp && resp.status() >= 400) || looksBlocked(html, page.url())) return { raw: [], blocked: true }

  const raw = (await page.evaluate(() => {
    const out: { url: string; title: string; snippet: string }[] = []
    const decode = (href: string): string => {
      try {
        if (href.includes('uddg=')) {
          const u = new URL(href, location.href)
          const real = u.searchParams.get('uddg')
          if (real) return decodeURIComponent(real)
        }
      } catch {}
      return href
    }
    document.querySelectorAll('.result__body, .web-result').forEach((el) => {
      const a = el.querySelector('a.result__a') as HTMLAnchorElement | null
      if (!a) return
      const snip = (el.querySelector('.result__snippet') as HTMLElement)?.innerText || ''
      out.push({ url: decode(a.href), title: a.innerText.trim(), snippet: snip.trim() })
    })
    return out
  })) as RawResult[]
  return { raw, blocked: false }
}

function toCandidates(
  raw: RawResult[],
  query: string,
  targetUrl: string,
  seen: Set<string>
): CompetitorCandidate[] {
  const out: CompetitorCandidate[] = []
  for (const r of raw) {
    if (!r.url || !isUsefulCandidate(r.url, targetUrl)) continue
    const domain = getDomain(r.url)
    if (seen.has(domain)) continue
    seen.add(domain)
    out.push({
      url: r.url,
      domain,
      title: r.title || undefined,
      snippet: r.snippet || undefined,
      source: 'search',
      foundVia: query,
      analyzed: false
    })
  }
  return out
}

export interface SearchOutcome {
  results: LocalBrowserSearchResult[]
  candidates: CompetitorCandidate[]
  anyBlocked: boolean
}

/**
 * Führt alle Suchanfragen lokal aus und sammelt eindeutige Kandidaten (max ~40).
 * Robuste Fehlerbehandlung: blockierte Engines werden markiert, nicht abgebrochen.
 */
export async function runLocalSearch(
  bm: BrowserManager,
  queries: SearchQuery[],
  targetUrl: string,
  maxCandidates = 40,
  onQueryDone?: (done: number, total: number, found: number) => void
): Promise<SearchOutcome> {
  const results: LocalBrowserSearchResult[] = []
  const allCandidates: CompetitorCandidate[] = []
  const seen = new Set<string>()
  seen.add(getDomain(targetUrl))
  let anyBlocked = false

  const page = await bm.newPage()
  try {
    let i = 0
    for (const q of queries) {
      i++
      if (allCandidates.length >= maxCandidates) break

      const engines: [string, (p: Page, query: string) => Promise<{ raw: RawResult[]; blocked: boolean }>][] = [
        ['Startpage', searchStartpage],
        ['Bing', searchBing],
        ['DuckDuckGo', searchDuckDuckGo]
      ]

      let success = false
      let blocked = false
      let errMsg: string | undefined
      let found: CompetitorCandidate[] = []
      let usedEngine = ''

      for (const [name, fn] of engines) {
        try {
          const { raw, blocked: b } = await fn(page, q.query)
          usedEngine = name
          if (b) {
            blocked = true
            anyBlocked = true
            continue // nächste Engine versuchen
          }
          const cands = toCandidates(raw, q.query, targetUrl, seen)
          success = true
          blocked = false
          if (cands.length > 0) {
            found = cands
            break // brauchbare Treffer -> fertig für diese Query
          }
          // 0 Treffer -> nächste Engine probieren
        } catch (e) {
          errMsg = e instanceof Error ? e.message : String(e)
          log.warn(`Suche fehlgeschlagen (${name}) für "${q.query}":`, errMsg)
        }
      }

      allCandidates.push(...found)
      results.push({
        query: q.query,
        engine: usedEngine || 'keine',
        success,
        blocked,
        error: errMsg,
        candidates: found
      })
      onQueryDone?.(i, queries.length, allCandidates.length)
      await page.waitForTimeout(400 + Math.random() * 600) // höfliche Pause
    }
  } finally {
    try {
      await page.close()
    } catch {}
  }

  return { results, candidates: allCandidates.slice(0, maxCandidates), anyBlocked }
}

/**
 * Einzelne Suchanfrage über den lokalen Browser (Startpage → Bing → DuckDuckGo).
 * Liefert Rohergebnisse (url/title/snippet) ohne Filterung – für das Provider-System.
 */
export async function localSearchSingle(
  bm: BrowserManager,
  query: string
): Promise<{ raw: RawResult[]; blocked: boolean; engine: string; error?: string }> {
  const engines: [string, (p: Page, q: string) => Promise<{ raw: RawResult[]; blocked: boolean }>][] = [
    ['Startpage', searchStartpage],
    ['Bing', searchBing],
    ['DuckDuckGo', searchDuckDuckGo]
  ]
  const page = await bm.newPage()
  let anyBlocked = false
  let lastError: string | undefined
  try {
    for (const [name, fn] of engines) {
      try {
        const { raw, blocked } = await fn(page, query)
        if (blocked) {
          anyBlocked = true
          continue
        }
        if (raw.length > 0) return { raw, blocked: false, engine: name }
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e)
        log.warn(`localSearchSingle (${name}) fehlgeschlagen:`, lastError)
      }
    }
  } finally {
    try {
      await page.close()
    } catch {}
  }
  return { raw: [], blocked: anyBlocked, engine: 'keine', error: lastError }
}

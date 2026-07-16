/**
 * Serverseitige Personen-/Entscheider-Recherche via Playwright.
 *
 * Streng begrenzt auf geschäftlich veröffentlichte Quellen der EIGENEN Unternehmenswebsite
 * (Impressum, Team, Über-uns, Kontakt). Es werden KEINE externen Personensuchdienste,
 * privaten Profile, Datenleaks oder kostenpflichtigen Register verwendet, KEINE Logins/Captchas
 * umgangen und KEINE Kontaktdaten erraten.
 */
import { BrowserManager } from '../browser'
import { normalizeUrl } from '../../utils/url'
import { normalizeDomain } from './normalize'
import { isInternalHost } from './websiteAnalyzer'
import { extractPeopleFromPage, type PageKind, type PageExtract } from './personExtract'
import { log } from '../../utils/logger'

export interface PageResult {
  url: string
  kind: PageKind
  extract: PageExtract
}

export interface ResearchResult {
  pagesChecked: { url: string; kind: PageKind; label: string }[]
  results: PageResult[]
  log: string[]
}

const KIND_LABEL: Record<PageKind, string> = {
  impressum: 'Impressum geprüft',
  kontakt: 'Kontaktseite geprüft',
  team: 'Teamseite geprüft',
  ueber_uns: 'Über-uns-Seite geprüft',
  startseite: 'Startseite geprüft',
  sonstige: 'Seite geprüft'
}

/** Klassifiziert eine URL/Linktext-Kombination als geschäftliche Recherche-Seite. */
function classifyLink(href: string, text: string): PageKind | null {
  const s = (href + ' ' + text).toLowerCase()
  if (/impressum|imprint/.test(s)) return 'impressum'
  if (/\bteam\b|mitarbeiter|ansprechpartner|unser[- ]?team|das[- ]?team|kollegen|praxisteam/.test(s)) return 'team'
  if (/über[- ]?uns|ueber[- ]?uns|about|unternehmen|wir[- ]?über|philosophie|leitbild|geschichte/.test(s)) return 'ueber_uns'
  if (/kontakt|contact/.test(s)) return 'kontakt'
  return null
}

async function loadPage(bm: BrowserManager, url: string): Promise<{ text: string; links: { href: string; text?: string }[] } | null> {
  let page
  try {
    page = await bm.newPage()
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
    if (!resp || resp.status() >= 400) return null
    await page.waitForTimeout(600)
    return await page.evaluate(() => {
      const text = document.body?.innerText || ''
      const links = Array.from(document.querySelectorAll('a')).map((a) => ({ href: a.getAttribute('href') || '', text: (a.textContent || '').trim().slice(0, 80) }))
      return { text, links }
    })
  } catch {
    return null
  } finally {
    try {
      await page?.close()
    } catch {}
  }
}

/**
 * Führt die Recherche für eine Unternehmenswebsite aus.
 * @param maxPages Obergrenze zusätzlicher Unterseiten (neben der Startseite).
 */
export async function researchPeople(bm: BrowserManager, website?: string, maxPages = 5): Promise<ResearchResult> {
  const logs: string[] = []
  const pagesChecked: ResearchResult['pagesChecked'] = []
  const results: PageResult[] = []

  const start = website ? normalizeUrl(website) || '' : ''
  if (!start) {
    logs.push('Keine Unternehmenswebsite hinterlegt – Personenrecherche nicht möglich.')
    return { pagesChecked, results, log: logs }
  }
  if (isInternalHost(start)) {
    logs.push('Interne/geschützte URL – Recherche abgebrochen.')
    return { pagesChecked, results, log: logs }
  }
  const baseDomain = normalizeDomain(start)

  logs.push('Unternehmenswebsite geprüft: ' + start)
  const home = await loadPage(bm, start)
  if (!home) {
    logs.push('Startseite nicht erreichbar.')
    return { pagesChecked, results, log: logs }
  }
  // Startseite selbst auswerten (oft Team/Kontakt-Anrisse)
  results.push({ url: start, kind: 'startseite', extract: extractPeopleFromPage({ text: home.text, links: home.links, sourceUrl: start, kind: 'startseite' }) })
  pagesChecked.push({ url: start, kind: 'startseite', label: KIND_LABEL.startseite })

  // Kandidaten-Unterseiten aus den Links der Startseite bestimmen (nur eigene Domain)
  const seen = new Set<string>([start.replace(/#.*$/, '')])
  const targets: { url: string; kind: PageKind }[] = []
  for (const l of home.links) {
    if (targets.length >= maxPages) break
    let abs = ''
    try {
      abs = new URL(l.href, start).toString().replace(/#.*$/, '')
    } catch {
      continue
    }
    if (seen.has(abs)) continue
    if (normalizeDomain(abs) !== baseDomain) continue // nur eigene Domain
    if (isInternalHost(abs)) continue
    const kind = classifyLink(l.href, l.text || '')
    if (!kind) continue
    seen.add(abs)
    targets.push({ url: abs, kind })
  }
  // Priorisieren: Impressum + Team + Kontakt zuerst
  const order: PageKind[] = ['impressum', 'team', 'kontakt', 'ueber_uns']
  targets.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))

  logs.push('Geschäftsführer/Inhaber und Ansprechpartner werden gesucht …')
  for (const t of targets.slice(0, maxPages)) {
    const p = await loadPage(bm, t.url)
    pagesChecked.push({ url: t.url, kind: t.kind, label: KIND_LABEL[t.kind] })
    if (!p) {
      logs.push(`${KIND_LABEL[t.kind]} – nicht erreichbar.`)
      continue
    }
    const extract = extractPeopleFromPage({ text: p.text, links: p.links, sourceUrl: t.url, kind: t.kind })
    results.push({ url: t.url, kind: t.kind, extract })
    logs.push(`${KIND_LABEL[t.kind]} – ${extract.people.length} Person(en), ${extract.people.reduce((n, x) => n + x.contacts.length, 0) + extract.generalContacts.length} Kontakt(e).`)
  }

  const totalPeople = results.reduce((n, r) => n + r.extract.people.length, 0)
  logs.push(`Quellen abgeglichen · insgesamt ${totalPeople} Personenfund(e) über ${pagesChecked.length} Seite(n).`)
  log.info(`Personenrecherche ${baseDomain}: ${totalPeople} Personen auf ${pagesChecked.length} Seiten`)
  return { pagesChecked, results, log: logs }
}

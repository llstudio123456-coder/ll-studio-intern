import { writeFileSync } from 'fs'
import { join } from 'path'
import type { ExportFormat, CompetitorAnalysis, InspirationReport } from '@shared/types'
import type { AnyProject } from './storage'
import { isSearchProject } from './storage'
import { BrowserManager } from './browser'
import { exportsDir } from '../utils/paths'
import { log } from '../utils/logger'

function results(p: AnyProject): CompetitorAnalysis[] {
  return isSearchProject(p) ? p.results : p.competitors
}
function report(p: AnyProject): InspirationReport {
  return p.report
}
function projectTitle(p: AnyProject): string {
  return isSearchProject(p) ? p.config.query || p.detected.industry || 'Inspiration-Suche' : p.target.companyName || p.target.domain
}

function csvEscape(v: unknown): string {
  const s = String(v ?? '')
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function toCsv(p: AnyProject): string {
  const headers = ['Rang', 'Unternehmen', 'Domain', 'URL', 'Branche', 'Standort', 'Stil', 'Score', 'Relevanz', 'Design', 'Mobile', 'Vertrauen', 'Hauptfarben', 'Starke Elemente', 'Ideen']
  const rows = results(p).map((c, i) => [
    i + 1, c.snapshot.companyName || '', c.snapshot.domain, c.snapshot.finalUrl,
    c.snapshot.industry || '', c.snapshot.location || '', c.snapshot.designStyle,
    c.score.total, c.queryRelevance ?? '', c.score.breakdown.designQuality, c.score.breakdown.mobile, c.score.breakdown.trustSignals,
    c.snapshot.colors.slice(0, 3).map((x) => x.hex).join(' '), c.strongElements.join(' | '), c.ideasToAdopt.join(' | ')
  ])
  return [headers, ...rows].map((r) => r.map(csvEscape).join(',')).join('\n')
}

function reportHtml(p: AnyProject): string {
  const r = report(p)
  const fmtColors = (c: CompetitorAnalysis) => c.snapshot.colors.slice(0, 4).map((x) => `<span class="sw" style="background:${x.hex}"></span>`).join('')
  const comps = results(p).map((c, i) => `
    <div class="card">
      <div class="head"><span class="rank">#${i + 1}</span><h3>${c.snapshot.companyName || c.snapshot.domain}</h3><span class="score">${c.score.total}</span></div>
      <a href="${c.snapshot.finalUrl}">${c.snapshot.finalUrl}</a>
      <p class="meta">${c.snapshot.industry || ''} · ${c.snapshot.location || ''} · Stil: ${c.snapshot.designStyle}${c.queryRelevance != null ? ` · Relevanz ${c.queryRelevance}` : ''}</p>
      <div class="colors">${fmtColors(c)}</div>
      <p>${c.shortDescription}</p>
      <p><b>${isSearchProject(p) ? 'Warum passend' : 'Warum inspirierend'}:</b> ${c.whyMatches || c.whyInspiring}</p>
      <p><b>Starke Elemente:</b> ${c.strongElements.join(', ')}</p>
      <p><b>Ideen:</b> ${c.ideasToAdopt.join(', ')}</p>
      <p class="warn">${c.doNotCopyWarning}</p>
    </div>`).join('')
  const ul = (arr: string[]) => `<ul>${arr.map((x) => `<li>${x}</li>`).join('')}</ul>`
  const learnLabel = isSearchProject(p) ? 'Was LL Studio lernen kann' : 'Fehler der Zielseite vs. Mitbewerber'

  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><style>
    :root{--ink:#1e1e22;--paper:#faf8f4;--gold:#b08d57}
    *{box-sizing:border-box} body{font-family:Inter,Arial,sans-serif;color:var(--ink);margin:0;padding:40px}
    h1,h2,h3{font-family:Georgia,serif;font-weight:600;letter-spacing:-.02em}
    h1{font-size:30px;border-bottom:2px solid var(--gold);padding-bottom:10px}
    .sub{color:#666} .card{border:1px solid #e8e3da;border-radius:14px;padding:18px;margin:14px 0;page-break-inside:avoid}
    .head{display:flex;align-items:center;gap:12px}.rank{background:var(--ink);color:#fff;border-radius:8px;padding:2px 8px;font-size:13px}
    .score{margin-left:auto;background:var(--gold);color:#fff;border-radius:8px;padding:4px 12px;font-weight:700}
    .meta{color:#777;font-size:13px}.sw{display:inline-block;width:22px;height:22px;border-radius:5px;margin-right:5px;border:1px solid #0001}
    .warn{color:#9a6b00;font-size:12px;background:#fff7e6;padding:8px;border-radius:8px}
    .report{background:var(--paper);border-radius:14px;padding:24px;margin:20px 0}a{color:var(--gold)}
    .disclaimer{margin-top:30px;font-size:12px;color:#888;border-top:1px solid #eee;padding-top:12px}
  </style></head><body>
    <h1>LL Studio — Inspirations-Report</h1>
    <p class="sub">${projectTitle(p)} · Erstellt: ${new Date(p.createdAt).toLocaleString('de-DE')} · ${results(p).length} Webseiten${p.aiUsed ? ' · KI-gestützt' : ' · regelbasiert'}</p>
    <div class="report">
      <h2>Inspirations-Auswertung</h2>
      <p><b>Empfohlene Design-Richtung:</b> ${r.recommendedDesignDirection}</p>
      <h3>Notwendige Seiten</h3>${ul(r.mustHavePages)}
      <h3>Startseiten-Inhalte</h3>${ul(r.homepageContent)}
      <h3>Passende CTAs</h3>${ul(r.recommendedCtas)}
      <h3>Farben & Layout</h3>${ul(r.colorAndLayoutIdeas)}
      <h3>Sinnvolle Funktionen</h3>${ul(r.recommendedFeatures)}
      <h3>${learnLabel}</h3>${ul(r.targetMistakesVsCompetitors)}
    </div>
    <h2>Beste Webseiten (${results(p).length})</h2>${comps}
    <p class="disclaimer">${r.disclaimer}</p>
  </body></html>`
}

/** Exportiert ein Projekt; gibt {filename, buffer, mime} zurück (für Download via API). */
export async function exportProjectBuffer(p: AnyProject, format: ExportFormat): Promise<{ filename: string; buffer: Buffer; mime: string }> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const base = `${projectTitle(p).replace(/[^a-z0-9]/gi, '_')}_${stamp}`

  if (format === 'json') return { filename: `${base}.json`, buffer: Buffer.from(JSON.stringify(p, null, 2), 'utf-8'), mime: 'application/json' }
  if (format === 'csv') return { filename: `${base}.csv`, buffer: Buffer.from('﻿' + toCsv(p), 'utf-8'), mime: 'text/csv' }

  // PDF via Playwright
  const bm = new BrowserManager(true)
  try {
    const page = await bm.newPage()
    await page.setContent(reportHtml(p), { waitUntil: 'networkidle' })
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' } })
    return { filename: `${base}.pdf`, buffer: Buffer.from(pdf), mime: 'application/pdf' }
  } finally {
    await bm.close()
  }
}

/** Optional: zusätzlich auf Platte speichern. */
export async function exportToDisk(p: AnyProject, format: ExportFormat): Promise<string> {
  const { filename, buffer } = await exportProjectBuffer(p, format)
  const path = join(exportsDir(), filename)
  writeFileSync(path, buffer)
  log.info('Export gespeichert:', path)
  return path
}

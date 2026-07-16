import type { LeadCandidate } from '@shared/kundenfinder'
import { importCandidates } from '@/server/services/kundenfinder/searchService'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Sehr einfacher CSV-Parser (Komma/Semikolon, Anführungszeichen). */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let cur: string[] = []
  let field = ''
  let inQ = false
  const sep = (text.split('\n')[0] || '').includes(';') && !(text.split('\n')[0] || '').includes(',') ? ';' : ','
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQ) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (ch === '"') inQ = false
      else field += ch
    } else {
      if (ch === '"') inQ = true
      else if (ch === sep) { cur.push(field); field = '' }
      else if (ch === '\n') { cur.push(field); rows.push(cur); cur = []; field = '' }
      else if (ch === '\r') { /* skip */ }
      else field += ch
    }
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur) }
  if (!rows.length) return []
  const header = rows[0].map((h) => h.trim().toLowerCase())
  return rows.slice(1).filter((r) => r.some((c) => c.trim())).map((r) => {
    const o: Record<string, string> = {}
    header.forEach((h, i) => (o[h] = (r[i] || '').trim()))
    return o
  })
}

const pick = (o: Record<string, string>, keys: string[]) => {
  for (const k of keys) if (o[k]) return o[k]
  return ''
}

function rowToCandidate(o: Record<string, string>): LeadCandidate {
  return {
    name: pick(o, ['name', 'firma', 'unternehmen', 'company']),
    industry: pick(o, ['branche', 'industry', 'kategorie']) || undefined,
    street: pick(o, ['straße', 'strasse', 'street']) || undefined,
    houseNumber: pick(o, ['hausnummer', 'nr', 'housenumber']) || undefined,
    plz: pick(o, ['plz', 'postleitzahl', 'zip']) || undefined,
    city: pick(o, ['ort', 'stadt', 'city']) || undefined,
    website: pick(o, ['website', 'web', 'url', 'homepage']) || undefined,
    phone: pick(o, ['telefon', 'phone', 'tel']) || undefined,
    email: pick(o, ['email', 'e-mail', 'mail']) || undefined,
    contactName: pick(o, ['ansprechpartner', 'kontakt', 'contact']) || undefined,
    source: 'csv'
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { csv?: string; candidates?: LeadCandidate[]; commit?: boolean }
    let cands: LeadCandidate[] = []
    if (body.candidates?.length) cands = body.candidates
    else if (body.csv) cands = parseCsv(body.csv).map(rowToCandidate).filter((c) => c.name)
    if (!cands.length) return Response.json({ ok: false, error: 'Keine gültigen Datensätze gefunden (Spalte „name“ nötig).' }, { status: 400 })
    const result = importCandidates(cands)
    return Response.json({ ok: true, ...result, total: cands.length })
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

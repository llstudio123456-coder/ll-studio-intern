import type { LeadStatus, Company } from '@shared/kundenfinder'
import { LEAD_STATUS_LABELS } from '@shared/kundenfinder'
import { listCompanies, type CompanyFilter } from '@/server/services/kundenfinder/companiesRepo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const esc = (v: unknown) => {
  const s = v == null ? '' : String(v)
  return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

/** Exportiert gefilterte Unternehmen als CSV (Excel-kompatibel, Semikolon-getrennt). */
export async function GET(req: Request) {
  const u = new URL(req.url)
  const q = u.searchParams
  const f: CompanyFilter = {
    savedOnly: q.get('savedOnly') === '1',
    status: (q.get('status') as LeadStatus) || undefined,
    city: q.get('city') || undefined,
    industry: q.get('industry') || undefined,
    q: q.get('q') || undefined,
    limit: 5000
  }
  const { rows } = listCompanies(f)
  const cols: [string, (c: Company) => unknown][] = [
    ['Unternehmen', (c) => c.name],
    ['Branche', (c) => c.industry],
    ['Ansprechpartner', (c) => c.contactName],
    ['Position', (c) => c.contactPosition],
    ['E-Mail', (c) => c.email],
    ['Telefon', (c) => c.phone],
    ['Website', (c) => c.website],
    ['Straße', (c) => [c.street, c.houseNumber].filter(Boolean).join(' ')],
    ['PLZ', (c) => c.plz],
    ['Ort', (c) => c.city],
    ['Website-Score', (c) => c.websiteScore],
    ['Lead-Score', (c) => c.leadScore],
    ['Status', (c) => LEAD_STATUS_LABELS[c.status] || c.status],
    ['Nächster Schritt', (c) => c.nextStep],
    ['Wiedervorlage', (c) => c.followupDate],
    ['Letzter Kontakt', (c) => c.lastContactAt]
  ]
  const header = cols.map((c) => c[0]).join(';')
  const lines = rows.map((r) => cols.map((c) => esc(c[1](r))).join(';'))
  const csv = '﻿' + [header, ...lines].join('\r\n')
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="kundenfinder-export-${new Date().toISOString().slice(0, 10)}.csv"`
    }
  })
}

import type { LeadStatus } from '@shared/kundenfinder'
import { listCompanies, companyStats, type CompanyFilter } from '@/server/services/kundenfinder/companiesRepo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const u = new URL(req.url)
    const q = u.searchParams
    const b = (k: string) => (q.get(k) === '1' || q.get(k) === 'true' ? true : q.get(k) === '0' || q.get(k) === 'false' ? false : undefined)
    const n = (k: string) => (q.get(k) != null && q.get(k) !== '' ? Number(q.get(k)) : undefined)
    const f: CompanyFilter = {
      savedOnly: b('savedOnly'),
      excludedOnly: b('excludedOnly'),
      status: (q.get('status') as LeadStatus) || undefined,
      city: q.get('city') || undefined,
      industry: q.get('industry') || undefined,
      minWebsiteScore: n('minWebsiteScore'),
      minLeadScore: n('minLeadScore'),
      hasEmail: b('hasEmail'),
      hasPhone: b('hasPhone'),
      hasWebsite: b('hasWebsite'),
      contact: (q.get('contact') as CompanyFilter['contact']) || undefined,
      priority: (q.get('priority') as CompanyFilter['priority']) || undefined,
      potentialMin: n('potentialMin'),
      potentialMax: n('potentialMax'),
      decider: (q.get('decider') as CompanyFilter['decider']) || undefined,
      direct: (q.get('direct') as CompanyFilter['direct']) || undefined,
      quality: (q.get('quality') as CompanyFilter['quality']) || undefined,
      preset: (q.get('preset') as CompanyFilter['preset']) || undefined,
      sort: (q.get('sort') as CompanyFilter['sort']) || undefined,
      q: q.get('q') || undefined,
      limit: n('limit') ?? 200,
      offset: n('offset') ?? 0
    }
    const { rows, total } = listCompanies(f)
    const stats = q.get('stats') === '1' ? companyStats({ savedOnly: f.savedOnly, excludedOnly: f.excludedOnly }) : undefined
    return Response.json({ ok: true, companies: rows, total, stats })
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

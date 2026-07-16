import type { LeadCandidate } from '@shared/kundenfinder'
import { log } from '../../../utils/logger'

const UA = 'LLStudioInspector/1.0 (internal lead research; contact via app)'
const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
/** Mehrere Overpass-Mirror (der öffentliche Haupt-Server liefert oft 504/Timeout). */
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
]

/** Branchen-Stichwort → OSM-Tag-Filter (mehrere möglich). */
function industryTags(industry: string): { k: string; v: string }[] {
  const s = (industry || '').toLowerCase()
  const map: [RegExp, { k: string; v: string }[]][] = [
    [/restaurant|gastst|gastro/, [{ k: 'amenity', v: 'restaurant' }]],
    [/café|cafe|kaffee/, [{ k: 'amenity', v: 'cafe' }]],
    [/hotel|pension|übernacht/, [{ k: 'tourism', v: 'hotel' }]],
    [/friseur|frisör|hairdress/, [{ k: 'shop', v: 'hairdresser' }]],
    [/kosmetik|beauty|nagel/, [{ k: 'shop', v: 'beauty' }]],
    [/elektr/, [{ k: 'craft', v: 'electrician' }]],
    [/sanit|heizung|klempn|installat/, [{ k: 'craft', v: 'plumber' }, { k: 'craft', v: 'hvac' }]],
    [/dachdeck|dach\b/, [{ k: 'craft', v: 'roofer' }]],
    [/maler|lackier/, [{ k: 'craft', v: 'painter' }]],
    [/garten|landschaft|gala/, [{ k: 'craft', v: 'gardener' }, { k: 'shop', v: 'garden_centre' }]],
    [/reinig|gebäuderein/, [{ k: 'craft', v: 'cleaning' }, { k: 'shop', v: 'laundry' }]],
    [/bau\b|bauunternehm|hochbau|tiefbau/, [{ k: 'craft', v: 'builder' }, { k: 'office', v: 'construction' }]],
    [/tischler|schreiner/, [{ k: 'craft', v: 'carpenter' }]],
    [/autowerkstatt|kfz|werkstatt|autoreparatur/, [{ k: 'shop', v: 'car_repair' }]],
    [/autohaus|autohändler/, [{ k: 'shop', v: 'car' }]],
    [/fahrschule/, [{ k: 'amenity', v: 'driving_school' }]],
    [/immobil|makler/, [{ k: 'office', v: 'estate_agent' }]],
    [/hausverwalt/, [{ k: 'office', v: 'property_management' }, { k: 'office', v: 'estate_agent' }]],
    [/zahnarzt|zahn/, [{ k: 'amenity', v: 'dentist' }]],
    [/physio|krankengym/, [{ k: 'healthcare', v: 'physiotherapist' }]],
    [/arzt|praxis|mediz/, [{ k: 'amenity', v: 'doctors' }, { k: 'healthcare', v: 'doctor' }]],
    [/fitness|gym|sportstudio/, [{ k: 'leisure', v: 'fitness_centre' }]],
    [/anwalt|kanzlei|recht/, [{ k: 'office', v: 'lawyer' }]],
    [/steuerberat/, [{ k: 'office', v: 'tax_advisor' }]],
    [/pflege|ambulant/, [{ k: 'office', v: 'social_care' }, { k: 'healthcare', v: 'nurse' }]],
    [/logistik|spedition|transport/, [{ k: 'office', v: 'logistics' }]],
    [/sicherheit|security|wachdienst/, [{ k: 'office', v: 'security' }]],
    [/event|veranstalt|catering/, [{ k: 'amenity', v: 'events_venue' }]],
    [/einzelhandel|laden|geschäft|shop/, [{ k: 'shop', v: 'yes' }]]
  ]
  for (const [re, tags] of map) if (re.test(s)) return tags
  return []
}

interface GeoResult {
  lat: number
  lng: number
  displayName: string
}

/** Geocoding via Nominatim (Ort/PLZ → Koordinaten). Respektiert Nutzungspolicy (User-Agent, 1 Anfrage). */
export async function geocode(query: string): Promise<GeoResult | null> {
  try {
    const url = `${NOMINATIM}?q=${encodeURIComponent(query + ', Deutschland')}&format=json&limit=1&countrycodes=de`
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'de' }, signal: AbortSignal.timeout(12000) })
    if (!r.ok) return null
    const j = (await r.json()) as { lat: string; lon: string; display_name: string }[]
    if (!j.length) return null
    return { lat: parseFloat(j[0].lat), lng: parseFloat(j[0].lon), displayName: j[0].display_name }
  } catch (e) {
    log.warn('Nominatim-Geocoding fehlgeschlagen:', e)
    return null
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function elementToCandidate(el: any): LeadCandidate | null {
  const t = el.tags || {}
  const name: string = t.name || t['brand'] || ''
  if (!name) return null
  const website = t.website || t['contact:website'] || t.url || ''
  const phone = t.phone || t['contact:phone'] || t['contact:mobile'] || ''
  const email = t.email || t['contact:email'] || ''
  const lat = el.lat ?? el.center?.lat
  const lng = el.lon ?? el.center?.lon
  const street = t['addr:street'] || ''
  const houseNumber = t['addr:housenumber'] || ''
  const plz = t['addr:postcode'] || ''
  const city = t['addr:city'] || ''
  const social: Record<string, string> = {}
  if (t['contact:facebook']) social.facebook = t['contact:facebook']
  if (t['contact:instagram']) social.instagram = t['contact:instagram']
  return {
    name,
    industry: t.amenity || t.shop || t.craft || t.office || t.healthcare || t.leisure || t.tourism || undefined,
    street: street || undefined,
    houseNumber: houseNumber || undefined,
    plz: plz || undefined,
    city: city || undefined,
    country: 'Germany',
    lat: typeof lat === 'number' ? lat : undefined,
    lng: typeof lng === 'number' ? lng : undefined,
    website: website || undefined,
    phone: phone || undefined,
    email: email || undefined,
    openingHours: t.opening_hours || undefined,
    social: Object.keys(social).length ? social : undefined,
    source: 'osm',
    externalProvider: 'osm',
    externalId: `osm/${el.type}/${el.id}`,
    sourceUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Sucht Unternehmen via OpenStreetMap/Overpass im Umkreis eines Ortes. */
export async function searchOsm(params: { area: string; industry: string; keyword?: string; radiusKm?: number; limit?: number }): Promise<{ candidates: LeadCandidate[]; area: string; error?: string }> {
  const geo = await geocode(params.area)
  if (!geo) return { candidates: [], area: params.area, error: `Ort „${params.area}“ nicht gefunden.` }
  const radius = Math.round((params.radiusKm ?? 10) * 1000)
  const tags = industryTags(params.industry)
  const kw = (params.keyword || '').trim()

  let filters: string
  if (tags.length) {
    filters = tags
      .map((t) => {
        const nameF = kw ? `["name"~"${kw.replace(/["\\]/g, '')}",i]` : ''
        return `node["${t.k}"="${t.v}"]${nameF}(around:${radius},${geo.lat},${geo.lng});way["${t.k}"="${t.v}"]${nameF}(around:${radius},${geo.lat},${geo.lng});`
      })
      .join('')
  } else if (kw) {
    const k = kw.replace(/["\\]/g, '')
    filters = `node["name"~"${k}",i](around:${radius},${geo.lat},${geo.lng});way["name"~"${k}",i](around:${radius},${geo.lat},${geo.lng});`
  } else {
    return { candidates: [], area: geo.displayName, error: 'Keine Branche erkannt und kein Suchbegriff angegeben.' }
  }
  const query = `[out:json][timeout:25];(${filters});out center tags ${Math.min(params.limit ?? 60, 200)};`

  let lastErr = ''
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
        body: 'data=' + encodeURIComponent(query),
        signal: AbortSignal.timeout(30000)
      })
      if (!r.ok) { lastErr = `Overpass-Fehler ${r.status}`; continue } // nächsten Mirror versuchen
      const j = (await r.json()) as { elements: unknown[] }
      const seen = new Set<string>()
      const candidates: LeadCandidate[] = []
      for (const el of j.elements || []) {
        const c = elementToCandidate(el)
        if (!c) continue
        const key = c.externalId || c.name + (c.plz || '')
        if (seen.has(key)) continue
        seen.add(key)
        candidates.push(c)
      }
      log.info(`OSM (${endpoint}): ${candidates.length} Kandidaten für „${params.industry}“ um ${geo.displayName} (r=${radius}m)`)
      return { candidates, area: geo.displayName }
    } catch (e) {
      lastErr = 'Overpass-Anfrage fehlgeschlagen: ' + (e instanceof Error ? e.message : String(e))
    }
  }
  return { candidates: [], area: geo.displayName, error: `${lastErr} (alle Overpass-Server derzeit überlastet – bitte später erneut versuchen).` }
}

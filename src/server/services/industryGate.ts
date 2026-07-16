import type { WebsiteSnapshot } from '@shared/types'

export type IndustryFamily =
  | 'gastronomy'
  | 'medical'
  | 'automotive'
  | 'beauty'
  | 'fitness'
  | 'hotel'
  | 'realestate'
  | 'legal'
  | 'agency'
  | 'craft'
  | 'construction'
  | 'cleaning'
  | 'retail'
  | 'other'

export const FAMILY_LABEL: Record<IndustryFamily, string> = {
  gastronomy: 'Restaurant / Gastronomie',
  medical: 'Medizin / Praxis',
  automotive: 'Automobil / Kfz',
  beauty: 'Beauty / Friseur',
  fitness: 'Fitness / Studio',
  hotel: 'Hotel / Beherbergung',
  realestate: 'Immobilien',
  legal: 'Recht / Steuer',
  agency: 'Agentur / Studio',
  craft: 'Handwerk',
  construction: 'Bau / Architektur',
  cleaning: 'Reinigung / Service',
  retail: 'Handel / Shop',
  other: 'unklar'
}

const FAMILY_PATTERNS: [IndustryFamily, RegExp][] = [
  ['gastronomy', /restaurant|gastronom|gastro|caf[ée]|bistro|pizzeria|trattoria|brasserie|imbiss|speisekart|men[üu]\b|reservier|k[üu]che|\bessen\b|dining|\bfood\b|\bbar\b|sushi|steakhouse|weinbar|catering|b[äa]ckerei|konditorei|kaffee|lunch|dinner|tapas|ramen|burger/i],
  ['medical', /zahn[aä]rzt|zahnmedizin|dental|kieferorthop|\barzt\b|[äa]rzt|praxis|medizin|klinik|therapie|physio|orthop|hautarzt|hausarzt|heilprakt/i],
  ['automotive', /autohaus|autoh[äa]ndl|\bkfz\b|werkstatt|fahrzeug|automobile|gebrauchtwagen|neuwagen|reifen|car dealer|autoreparatur/i],
  ['beauty', /friseur|fris[öo]r|barber|\bsalon\b|kosmetik|beauty|nagelstudio|wimpern|\bspa\b|wellness|make-?up/i],
  ['fitness', /fitness|\bgym\b|yoga|pilates|crossfit|personal training|workout/i],
  ['hotel', /\bhotel\b|pension|ferienwohnung|g[äa]stehaus|[üu]bernacht|hostel|\bresort\b/i],
  ['realestate', /immobilie|makler|hausverwaltung|real estate|expos[ée]/i],
  ['legal', /rechtsanwalt|\banwalt\b|kanzlei|\bnotar\b|steuerberat|wirtschaftspr[üu]f/i],
  ['agency', /werbeagentur|webdesign|design studio|kreativagentur|marketingagentur|digitalagentur/i],
  ['craft', /fenster|t[üu]ren|dachdeck|\bdach\b|maler|lackier|elektr|sanit[äa]r|heizung|installateur|garten|galabau|landschaftsbau|tischler|schreiner|zimmerei|schl[üu]sseldienst|handwerk|klempner|estrich/i],
  ['construction', /bauunternehm|hochbau|tiefbau|rohbau|baufirma|architekt/i],
  ['cleaning', /reinigung|geb[äa]udereinig|geb[äa]udeservice/i],
  ['retail', /\bshop\b|onlineshop|store|boutique|einzelhandel/i]
]

/** Ordnet einen Text (Branche/Titel/Headings/Domain) einer Branchen-Familie zu. */
export function familyOf(text: string): IndustryFamily {
  const t = (text || '').toLowerCase()
  for (const [fam, re] of FAMILY_PATTERNS) if (re.test(t)) return fam
  return 'other'
}

/** Plattform-/Social-/Musik-/Messe-/Verzeichnis-Seiten (nie echte Branchen-Website). */
const PLATFORM = /spotify|soundcloud|deezer|apple\.com|music|youtube|youtu\.be|vimeo|facebook|instagram|twitter|tiktok|pinterest|behance|dribbble|linkedin|xing|amazon|primevideo|ebay|etsy|wikipedia|\bmesse\b|\bexpo\b|exhibition|fair|tripadvisor|yelp|lieferando|ubereats|opentable|google\.|maps\.|booking\.com|wordpress\.com|medium\.com|notion\.so|primevideo/i

/** Website-Builder / Design-Showcases / Tutorials / Agenturen → kein echtes Branchen-Business. */
const BUILDER_SHOWCASE = /awwwards|cssdesignawards|css-?winner|webflow|framer\.com|squarespace|wix\.|wixsite|weebly|godaddy|jimdo|strikingly|carrd|tilda|tutsplus|tuts\+|colorlib|hostinger|hubspot|canva|envato|themeforest|templatemonster|muzli|siteinspire|landbook|onepagelove|designrush|clutch\.co|sortfolio|intechnic|dribbble|elementor|elias\.studio|\.myshopify|figma\.com|adobe\.com|invisionapp|sketch\.com|gastronovi|resmio|dish\.co|foodamigos|simpolo|gloriafood|motocms|orderbird|lightspeed|deliverect/i

export interface GateResult {
  match: boolean
  family: IndustryFamily
  reason?: string
}

/** Text-Familie aus einem Snapshot (Branche zuerst, dann Inhalt). */
export function familyOfSnapshot(snap: WebsiteSnapshot): IndustryFamily {
  const byIndustry = familyOf(snap.industry || '')
  if (byIndustry !== 'other') return byIndustry
  return familyOf(`${snap.title || ''} ${snap.companyName || ''} ${snap.headings.join(' ')} ${snap.domain}`)
}

/** Agentur/Software-Dienstleister „für die Gastronomie“ – kein echtes Restaurant. */
const SERVICE_TEXT = /\b(webdesign|web ?design|webagentur|werbeagentur|internetagentur|marketingagentur|seo-?agentur|digitalagentur|agentur|agency|kassensystem|pos[- ]?system|bestellsystem|reservierungssoftware|gastro-?software|software für|für gastronomen|für die gastronomie|für restaurants|restaurant-?websites?|homepage erstellen|website(s)? erstellen|webseiten? für|online-?shop-?system)\b/i
const SERVICE_DOMAIN = /webdesign|agentur|-media\b|-digital\b|software|\bcms\b|restaurantwebsites?|websites?\b/i

/** SaaS-/Software-/App-Signale (kein lokales Restaurant). */
const SAAS_TEXT = /\b(pricing|free trial|kostenlos testen|jetzt testen|14 tage|30 tage kostenlos|sign ?up|log ?in|anmelden und loslegen|integrations?|\bapi\b|app store|google play|download the app|app herunterladen|dashboard|saas|platform|plattform für)\b/i

function looksLikeServiceProvider(snap: WebsiteSnapshot): boolean {
  const text = `${snap.title || ''} ${snap.companyName || ''} ${snap.heroText || ''} ${snap.headings.join(' ')} ${(snap.services || []).join(' ')}`
  return SERVICE_TEXT.test(text) || SAAS_TEXT.test(text) || SERVICE_DOMAIN.test(snap.domain)
}

/** „Beste X Webseiten“-Artikel / Listen / Showcases erkennen (keine echte Website). */
function looksLikeListicle(snap: WebsiteSnapshot): boolean {
  const t = `${snap.title || ''} ${snap.headings.slice(0, 3).join(' ')}`.toLowerCase()
  const topic = /(websites?|web ?design|designs?|examples|beispiele|inspiration|templates?|showcase)/.test(t)
  const listy = /(\b\d{1,3}\b|best|top|beste|besten|examples|beispiele|inspiration|showcase|gallery|galerie|roundup|guide)/.test(t)
  return topic && listy
}

/** Harte Branchen-Prüfung: Kandidat muss zur Zielfamilie passen. */
export function gateSnapshot(snap: WebsiteSnapshot, target: IndustryFamily): GateResult {
  const dom = `${snap.domain} ${snap.finalUrl || ''}`
  if (PLATFORM.test(dom)) return { match: false, family: 'other', reason: 'Plattform-/Social-/Musik-/Verzeichnisseite' }
  if (BUILDER_SHOWCASE.test(dom)) return { match: false, family: 'other', reason: 'Website-Builder/Design-Showcase/Tutorial (keine echte Website)' }
  if (!snap.reachable) return { match: false, family: 'other', reason: 'nicht erreichbar/blockiert' }
  if (snap.wordCount < 60) return { match: false, family: 'other', reason: 'keine echte Unternehmensseite (zu wenig Inhalt)' }
  if (looksLikeListicle(snap)) return { match: false, family: 'other', reason: 'Liste/Artikel/Showcase statt echter Website' }
  if (looksLikeServiceProvider(snap)) return { match: false, family: 'agency', reason: 'Agentur/Software-Dienstleister (kein echtes Restaurant)' }
  const fam = familyOfSnapshot(snap)
  if (target === 'other') return { match: true, family: fam }
  if (fam === target) return { match: true, family: fam }
  return { match: false, family: fam, reason: `Branche „${FAMILY_LABEL[fam]}“ passt nicht zur Zielbranche „${FAMILY_LABEL[target]}“` }
}

/** Günstige Vorab-Prüfung anhand von Titel/Snippet/Domain (spart Vollanalyse). */
export function preGate(text: string, domain: string, target: IndustryFamily): GateResult {
  if (PLATFORM.test(domain)) return { match: false, family: 'other', reason: 'Plattform-/Social-/Musik-/Verzeichnisseite' }
  if (BUILDER_SHOWCASE.test(domain)) return { match: false, family: 'other', reason: 'Website-Builder/Design-Showcase/Tutorial' }
  if (SERVICE_DOMAIN.test(domain)) return { match: false, family: 'agency', reason: 'Agentur/Software-Dienstleister' }
  if (target === 'other') return { match: true, family: 'other' }
  const fam = familyOf(`${text} ${domain}`)
  // nur ablehnen, wenn eindeutig eine ANDERE Familie erkannt wurde
  if (fam !== 'other' && fam !== target)
    return { match: false, family: fam, reason: `Branche „${FAMILY_LABEL[fam]}“ passt nicht zur Zielbranche „${FAMILY_LABEL[target]}“` }
  return { match: true, family: fam }
}

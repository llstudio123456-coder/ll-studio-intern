/**
 * Regelbasierte Branchen-Erkennung über deutsche Keyword-Listen.
 * Liefert Branche + Konfidenz + abgeleitete Dienstleistungs-Begriffe.
 */

interface IndustryDef {
  name: string
  keywords: string[]
  services: string[]
}

const INDUSTRIES: IndustryDef[] = [
  {
    name: 'Fenster- & Türenbau',
    keywords: ['fenster', 'türen', 'rollladen', 'haustür', 'beschattung', 'wintergarten', 'markise'],
    services: ['Fenstermontage', 'Haustüren', 'Rollläden', 'Insektenschutz', 'Wintergärten']
  },
  {
    name: 'Maler & Lackierer',
    keywords: ['maler', 'lackier', 'anstrich', 'tapezier', 'fassadenanstrich', 'malerbetrieb'],
    services: ['Innenanstrich', 'Fassadenanstrich', 'Tapezierarbeiten', 'Lackierungen']
  },
  {
    name: 'Dachdecker',
    keywords: ['dachdecker', 'dachsanierung', 'dachstuhl', 'dacheindeckung', 'dachrinne', 'flachdach'],
    services: ['Dacheindeckung', 'Dachsanierung', 'Dachrinnen', 'Dämmung']
  },
  {
    name: 'Sanitär / Heizung / Klima (SHK)',
    keywords: ['sanitär', 'heizung', 'klempner', 'shk', 'badezimmer', 'wärmepumpe', 'installateur', 'klima'],
    services: ['Badsanierung', 'Heizungsbau', 'Wärmepumpen', 'Sanitärinstallation']
  },
  {
    name: 'Elektriker / Elektrotechnik',
    keywords: ['elektro', 'elektriker', 'elektrotechnik', 'photovoltaik', 'pv-anlage', 'smart home', 'elektroinstallation'],
    services: ['Elektroinstallation', 'Photovoltaik', 'Smart Home', 'E-Check']
  },
  {
    name: 'Zimmerei / Tischlerei / Schreinerei',
    keywords: ['tischler', 'schreiner', 'zimmerei', 'zimmermann', 'möbelbau', 'holzbau', 'innenausbau'],
    services: ['Möbelbau', 'Innenausbau', 'Holzbau', 'Treppen']
  },
  {
    name: 'Garten- & Landschaftsbau',
    keywords: ['garten', 'landschaftsbau', 'galabau', 'pflaster', 'gartengestaltung', 'baumpflege', 'gärtner'],
    services: ['Gartengestaltung', 'Pflasterarbeiten', 'Baumpflege', 'Bewässerung']
  },
  {
    name: 'Restaurant / Gastronomie',
    keywords: ['restaurant', 'speisekarte', 'küche', 'gastronomie', 'menü', 'reservierung', 'bistro', 'pizzeria', 'café', 'gaststätte'],
    services: ['Mittagstisch', 'Reservierung', 'Catering', 'Lieferservice']
  },
  {
    name: 'Café / Bäckerei / Konditorei',
    keywords: ['bäckerei', 'konditorei', 'café', 'kaffee', 'kuchen', 'torten', 'patisserie'],
    services: ['Frühstück', 'Torten', 'Catering', 'Kaffeespezialitäten']
  },
  {
    name: 'Autohaus / Kfz-Werkstatt',
    keywords: ['autohaus', 'kfz', 'werkstatt', 'fahrzeuge', 'gebrauchtwagen', 'neuwagen', 'reifen', 'inspektion', 'automobile'],
    services: ['Fahrzeugverkauf', 'Inspektion', 'Reifenservice', 'Unfallinstandsetzung']
  },
  {
    name: 'Zahnarzt / Zahnmedizin',
    keywords: ['zahnarzt', 'zahnmedizin', 'zahnarztpraxis', 'implantologie', 'prophylaxe', 'kieferorthopädie', 'zahnersatz'],
    services: ['Prophylaxe', 'Implantologie', 'Zahnersatz', 'Bleaching']
  },
  {
    name: 'Arztpraxis / Heilberufe',
    keywords: ['praxis', 'arzt', 'ärztin', 'orthopäde', 'physiotherapie', 'heilpraktiker', 'medizin', 'sprechstunde'],
    services: ['Sprechstunde', 'Behandlung', 'Vorsorge', 'Therapie']
  },
  {
    name: 'Friseur / Beauty / Kosmetik',
    keywords: ['friseur', 'salon', 'kosmetik', 'beauty', 'nagelstudio', 'wimpern', 'barbier', 'haarschnitt'],
    services: ['Haarschnitt', 'Coloration', 'Kosmetikbehandlung', 'Styling']
  },
  {
    name: 'Steuerberatung / Recht',
    keywords: ['steuerberater', 'steuerkanzlei', 'rechtsanwalt', 'kanzlei', 'notar', 'buchhaltung', 'wirtschaftsprüfer'],
    services: ['Steuererklärung', 'Buchhaltung', 'Beratung', 'Jahresabschluss']
  },
  {
    name: 'Immobilien / Makler',
    keywords: ['immobilien', 'makler', 'hausverwaltung', 'wohnung', 'immobilienmakler', 'exposé', 'vermietung'],
    services: ['Verkauf', 'Vermietung', 'Bewertung', 'Hausverwaltung']
  },
  {
    name: 'Bau / Hochbau / Sanierung',
    keywords: ['bauunternehmen', 'hochbau', 'rohbau', 'sanierung', 'putz', 'estrich', 'maurer', 'baufirma'],
    services: ['Rohbau', 'Sanierung', 'Putzarbeiten', 'Umbau']
  },
  {
    name: 'Reinigung / Gebäudeservice',
    keywords: ['reinigung', 'gebäudereinigung', 'gebäudeservice', 'reinigungsfirma', 'unterhaltsreinigung'],
    services: ['Unterhaltsreinigung', 'Glasreinigung', 'Grundreinigung', 'Hausmeisterservice']
  },
  {
    name: 'Fitness / Yoga / Studio',
    keywords: ['fitness', 'fitnessstudio', 'yoga', 'personal training', 'workout', 'pilates', 'gym'],
    services: ['Mitgliedschaft', 'Kurse', 'Personal Training', 'Probetraining']
  },
  {
    name: 'Hotel / Pension',
    keywords: ['hotel', 'pension', 'übernachtung', 'zimmer buchen', 'gästehaus', 'ferienwohnung'],
    services: ['Zimmer', 'Frühstück', 'Tagungen', 'Wellness']
  }
]

export interface IndustryDetection {
  industry: string
  confidence: number
  services: string[]
}

/**
 * Erkennt die Branche anhand eines Textkorpus (Titel + Headings + sichtbarer Text + URL).
 */
export function detectIndustry(corpus: string): IndustryDetection {
  const text = corpus.toLowerCase()
  let best: { def: IndustryDef; hits: number } | null = null

  for (const def of INDUSTRIES) {
    let hits = 0
    for (const kw of def.keywords) {
      const re = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g')
      const m = text.match(re)
      if (m) hits += m.length
    }
    if (hits > 0 && (!best || hits > best.hits)) best = { def, hits }
  }

  if (!best) {
    return { industry: 'Unbekannt / allgemein', confidence: 0, services: [] }
  }

  // Konfidenz grob aus Trefferzahl ableiten (gedeckelt)
  const confidence = Math.min(1, 0.3 + best.hits * 0.12)
  return {
    industry: best.def.name,
    confidence: Number(confidence.toFixed(2)),
    services: best.def.services
  }
}

export function industryList(): string[] {
  return INDUSTRIES.map((i) => i.name)
}

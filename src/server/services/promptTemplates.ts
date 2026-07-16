import type { PromptType, InspirationReference, TargetCompanyBrief } from '@shared/types'

export const PROMPT_TYPE_LABELS: Record<PromptType, string> = {
  'full-rebuild': 'Komplette Website',
  homepage: 'Nur Startseite',
  landing: 'Landingpage',
  redesign: 'Redesign',
  'content-structure': 'Inhalt + Struktur',
  'design-system': 'Design-System'
}

/** Ableitung der „Wirkung“ aus dem Designstil (für die Inspirations-Beschreibung). */
export function styleProfile(style?: string): {
  navigation: string
  typography: string
  imagery: string
  cta: string
  mood: string
} {
  const s = (style || '').toLowerCase()
  if (/premium|luxuriös|luxury|elegant|hochwertig/.test(s))
    return {
      navigation: 'reduzierte, ruhige Navigation mit klarem Header und viel Weißraum',
      typography: 'elegante Typografie, oft mit Serifen-Akzenten in Überschriften',
      imagery: 'großformatige, ruhige, hochwertige Bilder',
      cta: 'dezente, klar gesetzte Call-to-Actions',
      mood: 'edel, ruhig, vertrauenswürdig'
    }
  if (/minimalistisch|clean|minimal/.test(s))
    return {
      navigation: 'minimalistische Navigation, wenige klare Menüpunkte',
      typography: 'klare, moderne Sans-Serif-Typografie',
      imagery: 'wenige, gezielte Bilder mit viel Freiraum',
      cta: 'klare, gut sichtbare, aber nicht aufdringliche CTAs',
      mood: 'aufgeräumt, fokussiert, modern'
    }
  if (/handwerklich|warm/.test(s))
    return {
      navigation: 'bodenständige, klare Navigation mit direktem Kontakt-CTA',
      typography: 'kräftige, gut lesbare Typografie',
      imagery: 'echte Projekt-/Arbeitsbilder, authentisch statt Stockfotos',
      cta: 'prominente Kontakt-/Anruf-Buttons',
      mood: 'vertrauenswürdig, regional, handfest'
    }
  return {
    navigation: 'moderne, klare Navigation mit deutlichem Haupt-CTA',
    typography: 'moderne, gut lesbare Typografie mit klarer Hierarchie',
    imagery: 'hochwertige, konsistente Bildsprache',
    cta: 'klare, gut platzierte Call-to-Actions',
    mood: 'modern, professionell, einladend'
  }
}

/** Klarer Rechts-/Ethik-Block – immer enthalten. */
export function legalBlock(inspName: string): string {
  return [
    'WICHTIG – nur Inspiration, kein Kopieren:',
    `- Nutze ${inspName} ausschließlich als Design-Inspiration für die allgemeine Wirkung.`,
    '- Übernimm KEINE Texte, Bilder, Logos, Marken, Farben-Eins-zu-eins, Code oder exakten Layouts.',
    '- Kopiere keine Inhalte oder Strukturen 1:1 – entwickle ein eigenständiges, originelles Design.',
    '- Verwende keine fremden Markenelemente. Erstelle eine komplett eigene Umsetzung für das Zielunternehmen.'
  ].join('\n')
}

const INDUSTRY_PAGES: { match: RegExp; pages: string[] }[] = [
  { match: /restaurant|gastro|café|cafe|bistro/i, pages: ['Startseite', 'Speisekarte', 'Über uns', 'Galerie', 'Reservierung / Kontakt', 'Impressum / Datenschutz'] },
  { match: /zahnarzt|arzt|praxis|medizin/i, pages: ['Startseite', 'Leistungen', 'Praxis / Team', 'Sprechzeiten', 'Kontakt & Anfahrt', 'Impressum / Datenschutz'] },
  { match: /handwerk|maler|dach|elektr|sanitär|garten|bau/i, pages: ['Startseite', 'Leistungen', 'Über uns', 'Referenzen / Galerie', 'Kontakt', 'Impressum / Datenschutz'] },
  { match: /autohaus|kfz|fahrzeug/i, pages: ['Startseite', 'Fahrzeuge / Angebote', 'Werkstatt & Service', 'Über uns', 'Kontakt', 'Impressum / Datenschutz'] },
  { match: /friseur|beauty|kosmetik|salon/i, pages: ['Startseite', 'Leistungen & Preise', 'Galerie', 'Über uns', 'Termin / Kontakt', 'Impressum / Datenschutz'] }
]

/** Seitenstruktur für Unternehmen B (Branche + Nutzerwünsche berücksichtigen). */
export function structurePages(brief: TargetCompanyBrief): string[] {
  if (brief.preferredPages && brief.preferredPages.length) {
    const base = [...brief.preferredPages]
    if (!base.some((p) => /impressum|datenschutz/i.test(p))) base.push('Impressum / Datenschutz (Platzhalter)')
    return base
  }
  const found = INDUSTRY_PAGES.find((i) => i.match.test(brief.industry || ''))
  if (found) return found.pages
  return ['Startseite', 'Leistungen / Angebot', 'Über uns', 'Referenzen / Galerie (falls sinnvoll)', 'Kontakt', 'Impressum / Datenschutz (Platzhalter)']
}

/** Homepage-Sektionen, an die Funktionen der Referenz angelehnt. */
export function homepageSections(insp: InspirationReference, brief: TargetCompanyBrief): string[] {
  const sections = [
    'Hero-Sektion: klare Kernaussage (Was, für wen, Region) + Haupt-CTA',
    'Vertrauenselemente: Bewertungen/Auszeichnungen/Jahre Erfahrung (Platzhalter, falls noch nicht vorhanden)',
    'Leistungsübersicht: 3–6 klare Kacheln der wichtigsten Angebote',
    'Über-uns-Abschnitt: kurze, sympathische Vorstellung',
    'Nutzen/Vorteile: warum dieses Unternehmen die richtige Wahl ist'
  ]
  if (insp.features.some((f) => /galerie|referenz|vorher/i.test(f)) || /handwerk|restaurant|friseur|beauty/i.test(brief.industry || ''))
    sections.push('Galerie / Referenzen: echte Bilder (Platzhalter, bis Material vorliegt)')
  sections.push('CTA-Sektion: deutlicher Handlungsaufruf (Anfrage / Termin / Anruf)')
  sections.push('Kontakt-Sektion: Formular, Telefon (Klick-zum-Anrufen), Adresse/Karte')
  sections.push('Footer: Navigation, Kontaktdaten, rechtliche Links')
  return sections
}

export function designInstructions(insp: InspirationReference, brief: TargetCompanyBrief): string {
  const prof = styleProfile(insp.designStyle)
  const colorLine = insp.colors.length
    ? `Die Referenz wirkt über folgende Farben: ${insp.colors.slice(0, 5).join(', ')}. Leite daraus eine EIGENE, zu ${brief.companyName} passende Farbpalette ab (nicht 1:1 übernehmen).`
    : `Wähle eine hochwertige, zu ${brief.companyName} passende Farbpalette (2–3 Akzentfarben).`
  return [
    'Design-Anweisungen:',
    `- Gesamtwirkung: ${prof.mood}. Stilrichtung: ${insp.designStyle || 'modern/clean'}.`,
    `- ${colorLine}`,
    `- Navigation: ${prof.navigation}.`,
    `- Typografie: ${prof.typography}.`,
    `- Bildsprache: ${prof.imagery}.`,
    `- Call-to-Actions: ${prof.cta}.`,
    '- Responsive, mobile-first, großzügige Abstände, hochwertige Cards, klare visuelle Hierarchie.',
    '- Kein generischer Template-Look – eigenständig und premium wirken.'
  ].join('\n')
}

export function contentInstructions(): string {
  return [
    'Content-Anweisungen:',
    '- Alle Texte auf Deutsch, natürlich und kundenorientiert, professionell aber nicht steif.',
    '- Klare Nutzen statt Floskeln. Konkrete, glaubwürdige Formulierungen.',
    '- KEINE erfundenen Versprechen, KEINE Fake-Bewertungen, KEINE erfundenen Zertifikate oder Referenzen.',
    '- Wo echte Infos fehlen: klar gekennzeichnete Platzhalter verwenden (z. B. „[Platzhalter: Öffnungszeiten]“).'
  ].join('\n')
}

export function promptTypeIntro(type: PromptType, company: string): string {
  switch (type) {
    case 'homepage':
      return `Erstelle eine hochwertige, vollständige Startseite für ${company}.`
    case 'landing':
      return `Erstelle eine fokussierte, conversion-starke Landingpage für ${company} mit einem klaren Ziel-CTA.`
    case 'redesign':
      return `Erstelle ein modernes Redesign der bestehenden Website von ${company} – gleiche Inhalte, deutlich bessere Wirkung, Struktur und Conversion.`
    case 'content-structure':
      return `Erarbeite Inhaltskonzept und Seitenstruktur (inkl. Texten/Platzhaltern) für die neue Website von ${company}.`
    case 'design-system':
      return `Erstelle ein konsistentes Design-System (Farben, Typografie, Komponenten, Abstände, Buttons, Cards) für ${company} als Basis der neuen Website.`
    case 'full-rebuild':
    default:
      return `Erstelle eine neue, vollständige Website für ${company}.`
  }
}

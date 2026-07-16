import type {
  AIPreviewPrompt,
  AIPreviewProvider,
  PreviewCodeFormat,
  PreviewValidation,
  ReferenceBlueprint,
  SourceCompany,
  InspirationReference,
  DesignPreviewResult,
  PreviewPalette
} from '@shared/types'

export const AI_PREVIEW_LEGAL_NOTE =
  'RECHTLICHE REGEL: Übernimm KEINE Texte, Bilder, Logos, Marken, Codes oder exakten Layouts von Referenz B. ' +
  'Nutze Referenz B ausschließlich als visuelle Struktur- und Stil-Inspiration. Erstelle eine eigene, originale Vorschau für Kunde A. ' +
  'Nur als Inspiration verwenden – nichts 1:1 kopieren.'

const FORMAT_INSTRUCTION: Record<PreviewCodeFormat, string> = {
  html:
    'AUSGABEFORMAT: Schreibe ZUERST 2–3 Sätze „Design-Zusammenfassung“ (was du aus Kunde A und was aus Referenz B übernimmst). ' +
    'DANN genau EINEN ```html Codeblock: ein eigenständiges HTML5-Dokument mit eingebettetem <style> im <head>. ' +
    'KEINE externen/fremden Skripte, KEIN Tracking, KEIN <script>. Der Code muss ohne weitere Schritte direkt im Browser rendern.',
  'react-tailwind':
    'AUSGABEFORMAT: Schreibe ZUERST 2–3 Sätze „Design-Zusammenfassung“. DANN genau EINEN ```jsx Codeblock: ' +
    'EINE React-Funktionskomponente (default export, Tailwind-Klassen, keine externen UI-Libs), direkt renderbar.',
  nextjs:
    'AUSGABEFORMAT: Schreibe ZUERST 2–3 Sätze „Design-Zusammenfassung“. DANN genau EINEN ```tsx Codeblock: ' +
    "EINE Next.js-Client-Komponente (App Router, erste Zeile 'use client', Tailwind, default export), direkt renderbar.",
  'lovable-prompt': 'Formuliere einen fertigen, kopierbaren Prompt für Lovable. Gib NUR den Prompt-Text aus (kein Code).',
  'claude-code-prompt': 'Formuliere einen fertigen, kopierbaren Prompt für Claude Code. Gib NUR den Prompt-Text aus (kein Code).',
  'v0-prompt': 'Formuliere einen fertigen, kopierbaren Prompt für v0. Gib NUR den Prompt-Text aus (kein Code).'
}

/** true, wenn das Format ein Prompt für eine externe KI ist (kein direkt renderbarer Code). */
export function isPromptFormat(f: PreviewCodeFormat): boolean {
  return f === 'lovable-prompt' || f === 'claude-code-prompt' || f === 'v0-prompt'
}

/** Sammelt die finalen CSS-Farbrollen (HEX) von Kunde A aus der berechneten Palette. */
export function paletteLines(p: PreviewPalette): string {
  return [
    `- Primär: ${p.primary}`,
    `- Sekundär: ${p.secondary}`,
    `- CTA/Buttons: ${p.cta} (Hover ${p.ctaHover}), Text auf CTA: ${p.accentInk}`,
    `- Akzent: ${p.accent}`,
    `- Hintergrund (Paper): ${p.paper}`,
    `- Fläche/Surface: ${p.surface}`,
    `- Text/Ink: ${p.ink}`,
    `- Gedämpfter Text: ${p.muted}`,
    `- Linien/Rahmen: ${p.line}`
  ].join('\n')
}

/** Erzeugt eine natürlichsprachliche Struktur-Beschreibung aus der Referenz-Blueprint. */
export function buildBlueprintSummary(bp: ReferenceBlueprint | undefined, inspiration: InspirationReference): string {
  if (!bp || !bp.ok) {
    return (
      `Referenz „${inspiration.companyName || inspiration.url || 'B'}“ konnte nicht vollständig live analysiert werden. ` +
      `Nutze eine klare, hochwertige Restaurant-/Business-Struktur: Kopfzeile mit Navigation, großer Hero mit CTA, ` +
      `Inhalts-Sektionen, Galerie, Kontakt/Reservierung, Footer.`
    )
  }
  const parts: string[] = []
  // Header / Navigation
  if (bp.navPosition === 'over-hero') parts.push('Header/Nav: transparente Top-Navigation ÜBER dem Hero-Bild (über Vollbild)')
  else parts.push('Header/Nav: feste Top-Navigationsleiste am oberen Rand')
  parts.push(bp.logoPosition === 'center' ? 'Logo mittig platziert' : 'Logo links platziert')
  // Buttonposition (CTA)
  if (bp.navHasCta) parts.push('Buttonposition: eigener CTA-Button oben rechts in der Navigation')
  else if (bp.reservationCta) parts.push('Buttonposition: prominenter CTA im Hero (zusätzlich Reservierungs-/Buchungsleiste)')
  else parts.push('Buttonposition: primärer CTA im Hero')
  // Hero-Struktur
  if (bp.heroType === 'cinematic-full') parts.push('Hero: großes Full-Width-Hero-Bild (bildschirmfüllend)')
  else if (bp.heroType === 'split-image') parts.push('Hero: zweispaltiger Split-Hero (Text neben Bild)')
  else parts.push('Hero: zentrierter Hero mit viel Weißraum')
  if (bp.heroOverlay) parts.push('Text-Overlay direkt auf dem Hero-Bild (heller Text auf abgedunkeltem Bild)')
  // Textposition
  parts.push(`Textposition im Hero: ${bp.heroTextAlign === 'center' ? 'mittig zentriert' : bp.heroTextAlign === 'right' ? 'rechtsbündig' : 'linksbündig'}`)
  // Bildposition
  if (bp.heroType === 'cinematic-full') parts.push('Bildposition: Hauptbild als vollflächiger Hero-Hintergrund')
  else if (bp.heroType === 'split-image') parts.push(`Bildposition: großes Hero-Bild ${bp.heroTextAlign === 'right' ? 'links' : 'rechts'} neben dem Text`)
  if ((bp.sectionSequence || []).includes('gallery') || (bp.sectionSequence || []).includes('image')) parts.push('Bildposition: zusätzliche große Bildflächen/Galerie im Seitenverlauf')
  if (bp.imageDominant) parts.push('bilddominanter Aufbau mit großen Bildflächen')
  // Slider/Carousel
  if (bp.hasSlider) parts.push('Slider/Karussell-Element vorhanden (mehrere Bilder rotierend)')
  // Section-Reihenfolge
  const seq = bp.sectionSequence?.length ? bp.sectionSequence.join(' → ') : '—'
  parts.push(`Section-Reihenfolge der Referenz (genau in dieser Reihenfolge nachempfinden): ${seq}`)
  // Design-Rhythmus & Atmosphäre
  const dark = bp.backgroundStyle === 'dark' || bp.darkness >= 0.5
  const atmosphere = dark
    ? 'Atmosphäre: dunkel, edel, cinematic'
    : bp.imageDominant
      ? 'Atmosphäre: hell, bildstark, einladend'
      : 'Atmosphäre: hell, ruhig, editorial-hochwertig'
  parts.push(`Design-Rhythmus: großzügige Abstände, klare Sektionsblöcke; ${atmosphere}`)
  parts.push(`Typografie-Gefühl: ${bp.typography === 'serif-display' ? 'elegante Serif-Headlines' : 'moderne Sans-Serif'}`)
  parts.push(`Footer: ${bp.footerColumns >= 2 ? `${bp.footerColumns}-spaltig (mehrspaltig mit Links/Kontakt)` : 'einfach/einzeilig'}`)
  return parts.join('; ') + '.'
}

/** Nicht-Inhalts-Bilder ausschließen (Cookie-/Consent-/Maps-/Tracking-/Icon-Grafiken). */
export function isJunkImageUrl(url: string): boolean {
  return /consentmanager|googlemaps|google\.[a-z.]+\/maps|maps\.google|gstatic|doubleclick|google-analytics|googletagmanager|facebook\.com\/tr|\/cookie|consent|sprite|favicon|\/icons?\//i.test(url)
}

/** Konkrete Kunde-A-Bilder (URL + Rolle), gefiltert & dedupliziert. */
export function customerImages(result: DesignPreviewResult, source: SourceCompany): { url: string; role: string }[] {
  const seen = new Set<string>()
  const rows: { url: string; role: string }[] = []
  const roleLabel: Record<string, string> = { hero: 'Hero', about: 'Über-uns', gallery: 'Galerie', menu: 'Speisekarte', services: 'Leistungen' }
  const push = (url?: string, role?: string) => {
    if (!url || seen.has(url) || url.startsWith('data:') || isJunkImageUrl(url)) return
    seen.add(url)
    rows.push({ url, role: role || 'Bild' })
  }
  for (const s of result.concept.sections) {
    if (s.imageUrl) push(s.imageUrl, roleLabel[s.type] || s.type)
    for (const u of s.imageUrls || []) push(u, 'Galerie')
  }
  for (const pl of result.imagePlacements || []) push(pl.url, `${roleLabel[pl.section] || pl.section}/${pl.role}`)
  for (const im of source.websiteImages || []) push(im.url, roleLabel[im.role] || im.role)
  return rows.slice(0, 8)
}

/** Nur die Bild-URLs von Kunde A (für die Validierung). */
export function customerImageUrls(result: DesignPreviewResult, source: SourceCompany): string[] {
  return customerImages(result, source).map((r) => r.url)
}

/** Konkrete Kunde-A-Bild-URLs mit Rolle (damit die KI echte Bilder statt „insert image here“ nutzt). */
export function customerImageLines(result: DesignPreviewResult, source: SourceCompany): { lines: string; count: number } {
  const imgs = customerImages(result, source)
  return { lines: imgs.map((r) => `- ${r.role}: ${r.url}`).join('\n'), count: imgs.length }
}

/** Echte Inhalte/Überschriften/CTA-Texte von Kunde A (statt Lorem/Platzhalter). */
export function customerContentLines(result: DesignPreviewResult): string {
  const hero = result.concept.sections.find((s) => s.type === 'hero')
  const lines: string[] = []
  if (hero?.eyebrow) lines.push(`- Hero-Eyebrow: „${hero.eyebrow}“`)
  if (hero?.heading) lines.push(`- Hero-Überschrift: „${hero.heading}“`)
  if (hero?.subheading) lines.push(`- Hero-Unterzeile: „${hero.subheading}“`)
  const heads = result.concept.sections.filter((s) => s.heading && s.type !== 'hero').map((s) => s.heading as string)
  if (heads.length) lines.push(`- Abschnitts-Überschriften: ${Array.from(new Set(heads)).slice(0, 6).join(' · ')}`)
  const ctas = Array.from(new Set(result.concept.sections.map((s) => s.ctaLabel).filter(Boolean) as string[]))
  if (ctas.length) lines.push(`- Vorhandene CTA-Texte: ${ctas.join(' · ')}`)
  return lines.length ? lines.join('\n') : '- (keine spezifischen Inhalte erkannt – realistische, deutschsprachige Inhalte für die Branche formulieren)'
}

/** Baut den vollständigen, präzisen KI-Prompt (System + User) aus der Analyse. */
export function buildAIPreviewPrompt(args: {
  source: SourceCompany
  inspiration: InspirationReference
  result: DesignPreviewResult
  format: PreviewCodeFormat
  provider: AIPreviewProvider
  customUser?: string
}): AIPreviewPrompt {
  const { source, inspiration, result, format, provider } = args
  const bp = result.referenceBlueprint
  const palette = result.concept.palette
  const blueprintSummary = buildBlueprintSummary(bp, inspiration)

  const name = source.name?.trim() || result.concept.companyName || '[Firmenname]'
  const industry = source.industry?.trim() || 'Betrieb'
  const location = source.location?.trim() || ''
  const services = (source.services || []).filter(Boolean)
  const navItems = result.concept.navItems || []
  const hasLogo = !!source.logoDataUrl
  const { lines: imageLines, count: imageCount } = customerImageLines(result, source)
  const contentLines = customerContentLines(result)
  const heroCta = result.concept.sections.find((s) => s.type === 'hero')?.ctaLabel
  const mainCta = result.concept.sections.find((s) => s.type === 'contact')?.ctaLabel || heroCta || (bp?.reservationCta ? 'Tisch reservieren' : 'Kontakt aufnehmen')
  const refName = inspiration.companyName || 'Referenz B'

  const imageInstruction =
    imageCount > 0
      ? `Es liegen ${imageCount} ECHTE Kunde-A-Bilder vor. Nutze exakt diese URLs als <img src="…"> an passenden Stellen (Hero/Galerie/Über-uns). Setze aussagekräftige alt-Texte. Verwende NIEMALS Platzhalter wie „insert image here“.`
      : 'Es liegen keine echten Bild-URLs vor. Verwende KEINE „insert image here“-Platzhalter, sondern elegante CSS-Fallback-Flächen (dezente Farbverläufe aus der Kunde-A-Palette) mit sinnvollem alt-Text.'

  const system =
    'Du bist ein Senior-Webdesigner und Frontend-Entwickler einer Premium-Agentur. ' +
    'Deine Aufgabe: eine kundentaugliche, hochwertige Website-Startseiten-Vorschau für KUNDE A bauen. ' +
    'KUNDE A liefert Marke, Farben, Logo, Bilder und Inhalte. REFERENZ B liefert AUSSCHLIESSLICH Struktur, Layout-Rhythmus und Stilrichtung. ' +
    'Erzeuge KEINE generische Landingpage, KEINE Standard-SaaS-Cards, KEINE zufälligen/blauen Default-Farben, KEINE Platzhalter-Marke, KEIN Standard-Restaurant-Template. ' +
    'Verwende ausschließlich die angegebenen Kunde-A-Farben als finale CSS-Farben. ' +
    AI_PREVIEW_LEGAL_NOTE +
    ' ' +
    FORMAT_INSTRUCTION[format]

  const user = args.customUser
    ? args.customUser
    : [
        `Erstelle eine hochwertige, kundentaugliche Website-Startseiten-Vorschau für „${name}“ (${industry}${location ? `, ${location}` : ''}).`,
        '',
        '## 1) KUNDE A — Marke, Farben, Logo, Bilder, Inhalte (VERPFLICHTEND verwenden)',
        `- Name: ${name}`,
        source.url ? `- Website: ${source.url}` : '- Website: (keine)',
        `- Branche: ${industry}`,
        location ? `- Standort: ${location}` : '- Standort: (unbekannt)',
        `- Navigation (genau diese Punkte): ${navItems.length ? navItems.join(', ') : 'Start, Angebot, Über uns, Kontakt'}`,
        `- Leistungen/Inhalte: ${services.length ? services.join(', ') : '(allgemeine Leistungen der Branche)'}`,
        `- Haupt-CTA-Text: „${mainCta}“${heroCta && heroCta !== mainCta ? ` · Hero-CTA: „${heroCta}“` : ''}`,
        `- Logo: ${hasLogo ? `Kunde-A-Logo vorhanden – im Header als <img alt="${name} Logo"> einsetzen (echtes Logo wird später eingefügt).` : `kein Bild-Logo – elegantes Text-Logo „${name}“ im Header (Markenschrift) nutzen.`}`,
        '- Inhalte (echte Texte von Kunde A – nutzen, nicht erfinden):',
        contentLines,
        '- Bilder (echte Kunde-A-Bild-URLs):',
        imageLines || '  (keine konkreten Bild-URLs verfügbar)',
        `  → ${imageInstruction}`,
        '',
        '### FINALE CSS-FARBROLLEN VON KUNDE A (HEX – exakt diese Werte als finale Farben verwenden)',
        paletteLines(palette),
        '',
        `## 2) REFERENZ B — „${refName}“ (NUR Struktur & Stil, NICHT den Inhalt)`,
        `- Referenz-URL: ${inspiration.url || '(keine)'}`,
        `- Erkannte Struktur (Screenshot-/DOM-Analyse): ${blueprintSummary}`,
        '  → Baue Header, Navigation, Hero, Text-/Buttonpositionen, Bildpositionen und die Section-Reihenfolge SICHTBAR nach diesem Aufbau.',
        '',
        '## 3) HARTE REGELN',
        '1. Finale Farben kommen AUSSCHLIESSLICH aus Kunde A (Hintergrund, Text, Buttons, Akzente = obige HEX-Werte).',
        '2. Referenz B liefert NUR Struktur/Stil/Rhythmus – niemals Inhalte.',
        `3. KEINE Bilder von Referenz B (${refName}). Nur Kunde-A-Bilder oder CSS-Fallbacks.`,
        '4. KEINE Texte von Referenz B. Nur Kunde-A-Inhalte / realistische deutsche Texte.',
        '5. KEIN Logo/Marke von Referenz B. Nur Kunde-A-Logo bzw. Text-Logo.',
        '6. KEINE exakte 1:1-Kopie des Referenz-Layouts.',
        '7. KEIN generisches Template, KEIN Standard-Restaurant-Layout, KEIN blaues Default-Design, KEIN SaaS-Layout, keine SaaS-Feature-Cards.',
        '8. Deutschsprachig; erfundene Bewertungen/Preise/Zahlen als [Platzhalter] kennzeichnen (nicht erfinden).',
        '',
        '## 4) AUSGABE',
        FORMAT_INSTRUCTION[format],
        '- Der Code muss DIREKT renderbar sein (keine TODOs, keine „insert image here“, keine leeren src-Attribute).',
        '- Nutze die echten Kunde-A-Bild-URLs bzw. elegante CSS-Fallback-Flächen aus der Palette.',
        '',
        '## 5) SELBST-QUALITÄTSKONTROLLE (am Ende des Codes als HTML-Kommentar prüfen)',
        'Füge nach dem Code einen kurzen Kommentar `<!-- Selbstprüfung: … -->` an und beantworte darin ehrlich:',
        '- Stimmen die finalen Farben mit der Kunde-A-Palette überein?',
        '- Ist die Struktur klar von Referenz B inspiriert (Header/Hero/CTA/Section-Reihenfolge)?',
        '- Ist es NICHT generisch (kein SaaS/Default-Template)?',
        '- Ist es kundentauglich (fertig wirkend, echte Inhalte)?',
        '- Wurden KEINE Inhalte/Bilder/Logos von Referenz B kopiert?',
        '',
        AI_PREVIEW_LEGAL_NOTE
      ].join('\n')

  return { system, user, blueprintSummary, legalNote: AI_PREVIEW_LEGAL_NOTE, format, provider }
}

/** Baut aus einem fehlgeschlagenen Validierungslauf einen gezielten Korrektur-Prompt. */
export function buildCorrectionPrompt(
  validation: PreviewValidation,
  palette: PreviewPalette,
  bp?: ReferenceBlueprint,
  customerImages?: string[]
): string {
  const fixes: string[] = []
  const d = validation.details
  for (const c of validation.checks) {
    if (c.pass) continue
    switch (c.id) {
      case 'customerColors':
        fixes.push(`Die Vorschau nutzt Kunde-A-Farben nicht stark genug. Verwende diese Palette als finale Farben: Hintergrund ${palette.paper}, Fläche ${palette.surface}, Text ${palette.ink}, Primär ${palette.primary}, CTA/Buttons ${palette.cta} (Text darauf ${palette.accentInk}), Akzent ${palette.accent}.`)
        break
      case 'noReferenceColors':
        fixes.push(`Entferne Referenz-Farben (${(d?.referenceColorsFound || []).join(', ') || 'aus Referenz B'}) – nutze ausschließlich die Kunde-A-Palette.`)
        break
      case 'logo':
        fixes.push('Ergänze ein Logo im Header (Kunde-A-Logo als <img> oder Text-Logo mit dem Firmennamen).')
        break
      case 'images':
        fixes.push('Ergänze echte Bilder (<img> mit alt-Text) an Hero/Galerie/Über-uns – keine leeren src-Attribute.')
        break
      case 'customerImages':
        fixes.push(
          `Nutze mehr Kunde-A-Bilder. Verwende exakt diese URLs als <img src>: ${(customerImages || d?.missingCustomerImages || []).slice(0, 5).join(' , ') || '(Kunde-A-Bild-URLs aus dem Original-Prompt)'}.`
        )
        break
      case 'noReferenceImages':
        fixes.push(`Entferne alle Bilder von Referenz B (${(d?.referenceImagesFound || []).slice(0, 3).join(', ') || 'Referenz-Domain'}). Verwende nur Kunde-A-Bilder.`)
        break
      case 'header':
        fixes.push('Die Navigation muss wie die Referenz aufgebaut sein: klare Kopfzeile mit <header>/<nav>.')
        break
      case 'hero':
        fixes.push(
          bp?.heroType === 'cinematic-full'
            ? 'Der Hero muss ein großes Full-Width-Bild mit Text-Overlay und CTA sein (wie Referenz B).'
            : 'Der Hero muss klar erkennbar sein (Überschrift + Untertitel + CTA), passend zur Referenzstruktur.'
        )
        break
      case 'cta':
        fixes.push(`Der CTA muss wie in der Referenz platziert sein (${bp?.navHasCta ? 'oben rechts in der Navigation' : 'prominent im Hero'}), z. B. „${bp?.reservationCta ? 'Tisch reservieren' : 'Kontakt'}“.`)
        break
      case 'structure':
        fixes.push(`Die Struktur muss näher an Referenz B liegen: Section-Reihenfolge ${bp?.sectionSequence?.join(' → ') || 'Header → Hero → Inhalt → Kontakt → Footer'}, inkl. Header und Footer.`)
        break
      case 'notGeneric':
        fixes.push('Entferne generische Layout-Elemente (Lorem ipsum, „Sign up free“, SaaS-Feature-Cards). Nutze echte Kunde-A-Inhalte.')
        break
      case 'noPlaceholders':
        fixes.push('Entferne alle Platzhalter („insert image here“, leere src="") – setze echte Kunde-A-Bilder oder CSS-Fallback-Flächen ein.')
        break
      case 'security':
        fixes.push(`Entferne unsichere Elemente (${(d?.securityIssues || []).join('; ') || 'Scripts/Event-Handler'}). Kein <script>, keine on…-Events, keine externen iframes.`)
        break
      case 'renderable':
        fixes.push('Der Code muss valide und renderbar sein (vollständiges HTML-Dokument bzw. gültige Komponente in EINEM Codeblock).')
        break
    }
  }
  return (
    'Überarbeite den folgenden Code. Er erfüllt noch nicht alle Anforderungen. Korrigiere gezielt:\n- ' +
    fixes.join('\n- ') +
    '\n\nGib den überarbeiteten, vollständigen Code in EINEM Codeblock aus.'
  )
}

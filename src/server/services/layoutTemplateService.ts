import type { SourceCompany, StyleProfile, PreviewSection, PreviewSectionType } from '@shared/types'

const pick = <T>(arr: T[], seed: number): T => arr[Math.abs(seed) % arr.length]

function mainCta(source: SourceCompany, profile: StyleProfile): string {
  if (isRestaurant(profile)) return 'Tisch reservieren'
  const i = (source.industry || '').toLowerCase()
  if (/zahnarzt|arzt|friseur|beauty|praxis|therapie/.test(i)) return 'Termin vereinbaren'
  if (/autohaus|kfz|fahrzeug/.test(i)) return 'Probefahrt anfragen'
  return 'Jetzt unverbindlich anfragen'
}

const isRestaurant = (p: StyleProfile) => p.archetype === 'dark-cinematic-restaurant' || p.archetype === 'light-premium-restaurant'

/** Erzeugt archetyp-passende Sektionsinhalte (deutsch, originell, mit Platzhaltern). */
export function buildSections(source: SourceCompany, profile: StyleProfile, seed = 0): { sections: PreviewSection[]; navItems: string[] } {
  const name = source.name?.trim() || '[Firmenname]'
  const loc = source.location?.trim()
  const services = source.services.filter(Boolean)
  const audience = source.targetGroup?.trim()
  const cta = mainCta(source, profile)
  const restaurant = isRestaurant(profile)

  const restHeads = [
    `Frisch. Herzlich.${loc ? ` In ${loc}.` : ''}`,
    `Frische Küche und Genuss${loc ? ` in ${loc}` : ''}`,
    `Mit Liebe serviert`,
    `${name} – Küche mit Charakter${loc ? ` in ${loc}` : ''}`
  ]
  const restEyebrows = [loc ? `Restaurant in ${loc}` : 'Genuss vor Ort', 'Willkommen im ' + name, 'Küche & Atmosphäre']
  const restSubs = [
    `Saisonale Gerichte, ehrliche Zutaten und eine Atmosphäre zum Wohlfühlen${loc ? ` – mitten in ${loc}` : ''}.`,
    `Mit Liebe gekocht, herzlich serviert${audience ? ` – für ${audience}` : ''}.`,
    `Ein Ort für gute Küche, schöne Abende und besondere Momente.`
  ]

  const genHeads = [
    `${name}${loc ? ` – ${profile.emotionalMood.split(',')[0]} in ${loc}` : ''}`,
    `Willkommen bei ${name}`,
    `${source.industry || 'Ihr Fachbetrieb'}${loc ? ` in ${loc}` : ''} mit Anspruch`
  ]
  const genSubs = [
    `Hochwertige Leistungen${loc ? ` in ${loc} und Umgebung` : ''}${audience ? ` – für ${audience}` : ''}.`,
    `Persönlich, zuverlässig und mit klarem Fokus auf Qualität.`,
    services.length ? `Ihr Partner für ${services.slice(0, 2).join(' & ')}.` : 'Ihr verlässlicher Partner vor Ort.'
  ]

  const build: Record<PreviewSectionType, () => PreviewSection> = {
    header: () => ({ type: 'header' }),
    hero: () =>
      restaurant
        ? {
            type: 'hero',
            eyebrow: pick(restEyebrows, seed),
            heading: pick(restHeads, seed),
            subheading: pick(restSubs, seed + 1),
            ctaLabel: cta,
            imageLabels: ['Signature-Gericht', 'Ambiente'],
            note: 'Stimmungsvolles Food-/Interieur-Bild – eigenes Foto einsetzen.'
          }
        : {
            type: 'hero',
            eyebrow: loc ? `${source.industry || 'Vor Ort'} · ${loc}` : source.industry,
            heading: pick(genHeads, seed),
            subheading: pick(genSubs, seed + 1),
            ctaLabel: cta,
            imageLabels: ['Heldenbild'],
            note: 'Heldenbild als Platzhalter – echtes Bild später einsetzen.'
          },
    trust: () => ({
      type: 'trust',
      items: restaurant
        ? [
            { title: '★★★★★', text: 'Gäste-Bewertungen [Platzhalter]' },
            { title: loc || 'Mittendrin', text: 'Zentrale Lage' },
            { title: 'Frisch', text: 'Saisonale Küche' }
          ]
        : [
            { title: '★★★★★', text: 'Zufriedene Kund:innen [Platzhalter]' },
            { title: loc || 'Regional', text: 'Persönlich vor Ort' },
            { title: 'Erfahrung', text: '[Platzhalter: Jahre]' }
          ],
      note: 'Keine erfundenen Bewertungen – echte Zahlen einsetzen.'
    }),
    menu: () => ({
      type: 'menu',
      eyebrow: 'Speisekarte',
      heading: 'Unsere Karte',
      subheading: 'Eine Auswahl – frisch und saisonal zubereitet.',
      items: [
        { title: 'Vorspeisen', text: '[Platzhalter: 3–4 Gerichte mit Preis]' },
        { title: 'Hauptgänge', text: '[Platzhalter: Fleisch · Fisch · Vegetarisch]' },
        { title: 'Desserts', text: '[Platzhalter: hausgemacht]' },
        { title: 'Getränke & Wein', text: '[Platzhalter: Weinkarte]' }
      ],
      ctaLabel: 'Ganze Karte ansehen',
      note: 'Echte Gerichte/Preise einsetzen.'
    }),
    services: () => ({
      type: 'services',
      heading: restaurant ? 'Das erwartet Sie' : 'Unsere Leistungen',
      subheading: restaurant ? 'Küche, Ambiente und Service.' : 'Was wir für Sie tun – klar und verständlich.',
      items: (services.length ? services : ['Leistung 1', 'Leistung 2', 'Leistung 3']).slice(0, 6).map((s) => ({
        title: s,
        text: `Kurze Beschreibung zu „${s}“. [Platzhalter]`
      }))
    }),
    about: () => ({
      type: 'about',
      eyebrow: 'Über uns',
      heading: `Über ${name}`,
      body: restaurant
        ? `Bei ${name} dreht sich alles um ${pick(['ehrlichen Geschmack und gute Gesellschaft', 'frische Zutaten und Leidenschaft am Kochen', 'gemütliche Abende und besondere Momente'], seed)}.${
            loc ? ` Sie finden uns in ${loc}.` : ''
          } [Platzhalter: kurze, persönliche Geschichte]`
        : `${name} steht für ${pick(['Qualität und Verlässlichkeit', 'persönlichen Service', 'handwerkliche Sorgfalt'], seed)}.${
            loc ? ` Seit Jahren ${loc} und Umgebung verbunden.` : ''
          } [Platzhalter: kurze Vorstellung]`,
      imageLabels: restaurant ? ['Küche / Team'] : ['Team / Über uns'],
      ctaLabel: 'Mehr erfahren'
    }),
    benefits: () => ({
      type: 'benefits',
      heading: 'Ihre Vorteile',
      items: restaurant
        ? [
            { title: 'Frische Küche', text: 'Saisonal und mit Sorgfalt zubereitet.' },
            { title: 'Schöne Atmosphäre', text: 'Zum Genießen und Verweilen.' },
            { title: 'Herzlicher Service', text: 'Aufmerksam und entspannt.' },
            { title: loc ? 'Zentrale Lage' : 'Gut erreichbar', text: loc ? `Mitten in ${loc}.` : 'Bequem erreichbar.' }
          ]
        : [
            { title: 'Persönlich', text: 'Direkter Ansprechpartner.' },
            { title: 'Zuverlässig', text: 'Termine, auf die Verlass ist.' },
            { title: 'Hochwertig', text: 'Sorgfalt in jedem Detail.' },
            { title: loc ? 'Regional' : 'Flexibel', text: loc ? `Für Sie in ${loc}.` : 'Passend zu Ihren Wünschen.' }
          ]
    }),
    gallery: () => ({
      type: 'gallery',
      eyebrow: 'Galerie',
      heading: restaurant ? 'Einblicke' : 'Einblicke & Referenzen',
      subheading: restaurant ? 'Gerichte, Ambiente, Momente.' : 'Ein Eindruck unserer Arbeit.',
      imageLabels: restaurant
        ? ['Gericht', 'Ambiente', 'Bar', 'Dessert', 'Interieur', 'Detail']
        : ['Projekt 1', 'Projekt 2', 'Projekt 3', 'Projekt 4', 'Projekt 5', 'Projekt 6'],
      note: restaurant ? 'Eigene Food-/Interieur-Fotos einsetzen (keine fremden Bilder).' : 'Eigene Projektfotos einsetzen.'
    }),
    reviews: () => ({
      type: 'reviews',
      heading: restaurant ? 'Was Gäste sagen' : 'Das sagen Kund:innen',
      items: [
        { title: '★★★★★', text: '„[Platzhalter: echtes Zitat]“ – Gast' },
        { title: '★★★★★', text: '„[Platzhalter: echtes Zitat]“ – Gast' }
      ],
      note: 'Nur echte, freigegebene Bewertungen verwenden.'
    }),
    contact: () => ({
      type: 'contact',
      eyebrow: restaurant ? 'Reservierung' : 'Kontakt',
      heading: restaurant ? 'Tisch reservieren' : 'Kontakt aufnehmen',
      subheading: `${loc ? `${loc} · ` : ''}[Platzhalter: Telefon, E-Mail, Adresse, Öffnungszeiten]`,
      ctaLabel: cta
    }),
    footer: () => ({ type: 'footer', note: 'Impressum & Datenschutz als Platzhalter ergänzen.' })
  }

  const sections = profile.sectionOrder.map((t) => build[t]())

  const navMap: Partial<Record<PreviewSectionType, string>> = {
    menu: 'Speisekarte',
    services: restaurant ? 'Angebot' : 'Leistungen',
    about: 'Über uns',
    gallery: 'Galerie',
    reviews: 'Bewertungen',
    contact: restaurant ? 'Reservierung' : 'Kontakt'
  }
  const navItems = ['Start', ...(profile.sectionOrder.map((t) => navMap[t]).filter(Boolean) as string[])]

  return { sections, navItems }
}

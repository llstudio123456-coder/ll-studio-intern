/** Kategorie-Daten für die geführte Inspiration-Suche (für nicht-technische Nutzer). */

export const INDUSTRIES = [
  'Restaurant', 'Café', 'Zahnarzt', 'Arzt', 'Handwerker', 'Elektriker', 'Sanitär/Heizung',
  'Dachdecker', 'Autohaus', 'Friseur', 'Beauty Salon', 'Fitnessstudio', 'Hotel',
  'Immobilien', 'Rechtsanwalt', 'Agentur', 'Lokaler Dienstleister', 'Andere'
]

export const STYLES = [
  'Ästhetisch', 'Modern', 'Clean', 'Premium', 'Luxuriös', 'Minimalistisch', 'Elegant',
  'Dunkel', 'Hell', 'Warm', 'Jung / trendig', 'Seriös', 'Handwerklich', 'Hochwertig', 'Kreativ'
]

export const GOALS = [
  'Mehr Kundenanfragen', 'Mehr Reservierungen', 'Mehr Vertrauen', 'Premium-Wirkung',
  'Bessere Startseite', 'Bessere Leistungsseiten', 'Bessere Bilder/Galerie',
  'Bessere mobile Ansicht', 'Bessere Kontaktführung', 'Besseres Branding'
]

export const FEATURES = [
  'Online-Terminbuchung', 'Kontaktformular', 'WhatsApp-Button', 'Speisekarte', 'Galerie',
  'Bewertungen', 'Vorher/Nachher', 'FAQ', 'Karriereseite', 'Google Maps', 'Social Proof', 'Auszeichnungen'
]

export const REGIONS = ['Deutschland', 'NRW', 'Köln', 'Pulheim', 'Kein Regionsfilter']

/** Schnellsuche-Vorschläge (Chips unter der großen Suchleiste). */
export const QUICK_CHIPS = [
  'Restaurant ästhetisch',
  'Zahnarzt premium',
  'Handwerker modern',
  'Café minimalistisch',
  'Friseur luxuriös',
  'Autohaus clean',
  'Hotel elegant'
]

export const PROMPT_TYPES: { value: import('@shared/types').PromptType; label: string; desc: string }[] = [
  { value: 'full-rebuild', label: 'Komplette Website', desc: 'Vollständige neue Website' },
  { value: 'homepage', label: 'Nur Startseite', desc: 'Eine starke Startseite' },
  { value: 'landing', label: 'Landingpage', desc: 'Fokussiert auf ein Ziel' },
  { value: 'redesign', label: 'Redesign', desc: 'Bestehende Seite neu' },
  { value: 'content-structure', label: 'Inhalt + Struktur', desc: 'Texte & Seitenaufbau' },
  { value: 'design-system', label: 'Design-System', desc: 'Farben, Typo, Komponenten' }
]

export const PLATFORMS: { value: import('@shared/types').PromptPlatform; label: string }[] = [
  { value: 'claude-code', label: 'Claude Code' },
  { value: 'lovable', label: 'Lovable' },
  { value: 'cursor', label: 'Cursor' },
  { value: 'generic-builder', label: 'Allgemeiner Website Builder' },
  { value: 'html-css-js', label: 'HTML/CSS/JS' },
  { value: 'nextjs-tailwind', label: 'Next.js/Tailwind' }
]

export const ARCHETYPE_OPTIONS: { value: import('@shared/types').StyleArchetype; label: string }[] = [
  { value: 'dark-cinematic-restaurant', label: 'Dunkel-cinematisch (Restaurant)' },
  { value: 'light-premium-restaurant', label: 'Hell-premium (Restaurant)' },
  { value: 'luxury-service', label: 'Luxuriös (Dienstleistung)' },
  { value: 'minimalist-agency', label: 'Minimalistisch (Agentur)' },
  { value: 'automotive-premium', label: 'Premium (Automobil)' },
  { value: 'craftsman-trust', label: 'Handwerk (Vertrauen)' },
  { value: 'medical-clean', label: 'Clean (Medizin)' },
  { value: 'modern-local-business', label: 'Modern (lokal)' },
  { value: 'generic', label: 'Generisch' }
]

export const ARCHETYPE_LABEL: Record<string, string> = Object.fromEntries(ARCHETYPE_OPTIONS.map((o) => [o.value, o.label]))

/** Manuelle Stil-Regler (Button-Label → Patch für StyleControls). */
export const STYLE_CONTROLS: { label: string; patch: Partial<import('@shared/types').StyleControls> }[] = [
  { label: 'Stil stärker übernehmen', patch: { referenceStrength: 1, lessGeneric: true } },
  { label: 'Mehr Referenz-Look', patch: { referenceStrength: 1 } },
  { label: 'Mehr Kundenbranding', patch: { moreBranding: true } },
  { label: 'Dunkler', patch: { darknessOverride: 'darker' } },
  { label: 'Heller', patch: { darknessOverride: 'lighter' } },
  { label: 'Mehr Bilder', patch: { imageryOverride: 'more' } },
  { label: 'Luxuriöser', patch: { luxury: true } },
  { label: 'Moderner', patch: { modern: true } },
  { label: 'Weniger generisch', patch: { lessGeneric: true, referenceStrength: 1 } }
]

export const SORT_OPTIONS: { value: import('@shared/types').SortMode; label: string }[] = [
  { value: 'score', label: 'Bester Score' },
  { value: 'aesthetic', label: 'Am ästhetischsten' },
  { value: 'modern', label: 'Am modernsten' },
  { value: 'structure', label: 'Beste Struktur' },
  { value: 'mobile', label: 'Beste mobile Ansicht' },
  { value: 'inspiration', label: 'Bester Inspirationswert' },
  { value: 'relevance', label: 'Beste Relevanz' }
]

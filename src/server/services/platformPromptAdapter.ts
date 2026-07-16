import type { PromptPlatform } from '@shared/types'

export const PLATFORM_LABELS: Record<PromptPlatform, string> = {
  'claude-code': 'Claude Code',
  lovable: 'Lovable',
  cursor: 'Cursor',
  'generic-builder': 'Allgemeiner Website Builder',
  'html-css-js': 'HTML/CSS/JS',
  'nextjs-tailwind': 'Next.js/Tailwind'
}

/** Plattform-spezifische technische Anweisungen für den generierten Prompt. */
export function technicalInstructions(platform: PromptPlatform): string {
  switch (platform) {
    case 'claude-code':
      return [
        'Technische Umsetzung (Claude Code):',
        '- Lege ein sauberes Projekt mit Next.js + TypeScript + Tailwind CSS an.',
        '- Arbeite in klar getrennten Komponenten (Header, Hero, Leistungen, Über uns, Galerie, Kontakt, Footer).',
        '- Erstelle echte, funktionsfähige Dateien (keine Pseudodateien) und erkläre kurz jeden Schritt.',
        '- Nutze semantisches HTML, sinnvolle Alt-Texte und gute Barrierefreiheit.',
        '- Mobile-first, sauberes responsives Layout, konsistente Abstände.'
      ].join('\n')
    case 'lovable':
      return [
        'Technische Umsetzung (Lovable):',
        '- Baue eine moderne Single-Page- oder Multi-Page-Website mit React + Tailwind (Lovable-Standard).',
        '- Nutze wiederverwendbare Komponenten und eine klare Sektionsstruktur.',
        '- Formuliere konkrete Inhalte je Sektion, damit die Vorschau direkt überzeugend aussieht.',
        '- Achte auf responsive Darstellung und hochwertige Cards/Buttons.'
      ].join('\n')
    case 'cursor':
      return [
        'Technische Umsetzung (Cursor):',
        '- Erzeuge ein Next.js + TypeScript + Tailwind Projekt mit modularer Komponentenstruktur.',
        '- Schreibe sauberen, typsicheren Code und kommentiere zentrale Stellen knapp.',
        '- Mobile-first und responsiv; achte auf Performance und gute Lighthouse-Werte.'
      ].join('\n')
    case 'html-css-js':
      return [
        'Technische Umsetzung (HTML/CSS/JS):',
        '- Erstelle statische Dateien: index.html plus weitere Seiten, eine zentrale styles.css und bei Bedarf script.js.',
        '- Nutze modernes, responsives CSS (Flexbox/Grid), CSS-Variablen für Farben, keine schweren Frameworks nötig.',
        '- Sauberes semantisches HTML, optimierte Bilder, dezente Animationen.'
      ].join('\n')
    case 'nextjs-tailwind':
      return [
        'Technische Umsetzung (Next.js + Tailwind):',
        '- App Router, TypeScript, Tailwind CSS, komponentenbasiert.',
        '- Design-Tokens (Farben/Typografie) zentral definieren, konsistent einsetzen.',
        '- Mobile-first, responsiv, gute Core-Web-Vitals, Bilder über next/image.'
      ].join('\n')
    case 'generic-builder':
    default:
      return [
        'Technische Umsetzung (allgemeiner Website-Builder):',
        '- Beschreibe die Website Sektion für Sektion, sodass sie in einem visuellen Builder umsetzbar ist.',
        '- Achte auf responsives Verhalten, klare Hierarchie und hochwertige, konsistente Komponenten.'
      ].join('\n')
  }
}

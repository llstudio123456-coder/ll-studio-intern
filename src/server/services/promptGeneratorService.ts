import type {
  PromptGenerationInput,
  PromptGenerationResult,
  TargetCompanyBrief,
  InspirationReference,
  TargetWebsiteAnalysis
} from '@shared/types'
import {
  legalBlock,
  structurePages,
  homepageSections,
  designInstructions,
  contentInstructions,
  promptTypeIntro,
  styleProfile,
  PROMPT_TYPE_LABELS
} from './promptTemplates'
import { technicalInstructions, PLATFORM_LABELS } from './platformPromptAdapter'
import { BrowserManager } from './browser'
import { analyzeTarget } from './targetAnalyzer'
import { isAiConfigured, aiComplete } from './ai'
import { normalizeUrl } from '../utils/url'
import { log } from '../utils/logger'

function ph(value: string | undefined, placeholder: string): string {
  const v = (value || '').trim()
  return v || `[Platzhalter: ${placeholder}]`
}

function mainCtaFor(brief: TargetCompanyBrief): string {
  const i = (brief.industry || '').toLowerCase()
  const g = (brief.goal || '').toLowerCase()
  if (/reservierung|reservieren/.test(g) || /restaurant|café|cafe|gastro/.test(i)) return 'Tisch reservieren'
  if (/termin/.test(g) || /zahnarzt|arzt|friseur|beauty|praxis/.test(i)) return 'Termin vereinbaren'
  if (/anruf|telefon/.test(g)) return 'Jetzt anrufen'
  return 'Jetzt unverbindlich anfragen'
}

function inspName(insp: InspirationReference): string {
  return insp.companyName || insp.url || 'die Referenz-Website'
}

/** Optionale Analyse von Unternehmen B (falls URL vorhanden). */
async function analyzeTargetCompany(url: string): Promise<TargetWebsiteAnalysis | null> {
  const bm = new BrowserManager(true)
  try {
    return await analyzeTarget(bm, {
      url,
      maxResults: 0,
      manualUrls: [],
      country: 'Germany'
    })
  } catch (e) {
    log.warn('Ziel-Analyse fehlgeschlagen:', e)
    return null
  } finally {
    await bm.close()
  }
}

function keepContentFrom(t: TargetWebsiteAnalysis): string[] {
  const keep: string[] = []
  if (t.services.length) keep.push(`Bestehende Leistungen beibehalten: ${t.services.join(', ')}`)
  if (t.location) keep.push(`Standort/Adresse übernehmen: ${t.location}`)
  if (t.companyName) keep.push(`Firmenname & Markenkern: ${t.companyName}`)
  if (t.features.contactForm) keep.push('Funktionierende Kontaktmöglichkeit erhalten/verbessern')
  if (t.pages.find((p) => p.type === 'references' || p.type === 'gallery')) keep.push('Vorhandene Referenzen/Galerie-Inhalte weiterverwenden')
  if (keep.length === 0) keep.push('Vorhandene echte Inhalte (Texte, Kontaktdaten) übernehmen, wo sinnvoll')
  return keep
}

/** Baut den eigentlichen deutschen Prompt (regelbasiert). */
function assemblePrompt(input: PromptGenerationInput, targetAnalysis: TargetWebsiteAnalysis | null): { prompt: string; styleDirection: string; pages: string[]; mainCta: string } {
  const { inspiration: insp, target, promptType, platform } = input
  const prof = styleProfile(insp.designStyle)
  const pages = structurePages(target)
  const sections = homepageSections(insp, target)
  const mainCta = mainCtaFor(target)
  const styleDirection = `${insp.designStyle || 'modern/clean'} – ${prof.mood}`

  const blocks: string[] = []

  blocks.push(promptTypeIntro(promptType, target.companyName || '[Platzhalter: Firmenname]'))
  blocks.push(
    `Nutze ${inspName(insp)}${insp.url ? ` (${insp.url})` : ''} ausschließlich als Design-Inspiration. ` +
      'Übernimm keine Texte, Bilder, Logos, Marken, Code oder exakten Layouts.'
  )

  // 1. Projektkontext
  blocks.push(
    [
      '1) Projektkontext (Unternehmen B):',
      `- Unternehmen: ${ph(target.companyName, 'Firmenname')}`,
      `- Branche: ${ph(target.industry, 'Branche')}`,
      `- Standort: ${ph(target.location, 'Standort')}`,
      `- Leistungen: ${ph(target.services, 'Leistungen')}`,
      `- Zielgruppe: ${ph(target.targetGroup, 'Zielgruppe')}`,
      `- Ziel der Website: ${ph(target.goal, 'Ziel, z. B. mehr Anfragen')}`,
      target.notes ? `- Wünsche/Hinweise: ${target.notes}` : '',
      target.hasLogo ? `- Logo/Assets vorhanden: ja${target.assetsNote ? ` (${target.assetsNote})` : ''}` : '- Logo/Assets: noch nicht vorhanden → dezenten Wortmarken-Platzhalter verwenden'
    ]
      .filter(Boolean)
      .join('\n')
  )

  // 2. Inspirations-Referenz
  blocks.push(
    [
      '2) Inspirations-Referenz (Website A – nur zur Orientierung):',
      `- Referenz: ${inspName(insp)}${insp.url ? ` (${insp.url})` : ''}`,
      insp.whyInspiring ? `- Warum als Vorbild: ${insp.whyInspiring}` : '',
      `- Designstil: ${insp.designStyle || 'modern/clean'}`,
      insp.colors.length ? `- Farbwirkung (nur als Stimmung, nicht 1:1): ${insp.colors.slice(0, 5).join(', ')}` : '',
      `- Navigationsstil: ${prof.navigation}`,
      `- Typografie-Gefühl: ${prof.typography}`,
      `- Bildstil: ${prof.imagery}`,
      `- CTA-Stil: ${prof.cta}`,
      insp.usefulSections.length ? `- Nützliche Sektionen/Komponenten: ${insp.usefulSections.join(', ')}` : '',
      insp.features.length ? `- Sinnvolle Funktionen der Referenz: ${insp.features.join(', ')}` : ''
    ]
      .filter(Boolean)
      .join('\n')
  )

  // 3. Rechtlicher Hinweis
  blocks.push('3) ' + legalBlock(inspName(insp)))

  // 4. Seitenstruktur
  blocks.push('4) Seitenstruktur für ' + (target.companyName || 'Unternehmen B') + ':\n' + pages.map((p) => `- ${p}`).join('\n'))

  // 5. Homepage-Struktur
  if (promptType !== 'design-system')
    blocks.push('5) Startseiten-Sektionen (von oben nach unten):\n' + sections.map((sct) => `- ${sct}`).join('\n'))

  // 6. Design
  blocks.push('6) ' + designInstructions(insp, target))

  // 7. Content
  if (promptType !== 'design-system') blocks.push('7) ' + contentInstructions())

  // Bestehende Website (falls analysiert)
  if (targetAnalysis && targetAnalysis.reachable) {
    blocks.push(
      [
        'Bestehende Website von Unternehmen B (Analyse):',
        targetAnalysis.strengths.length ? `- Stärken (erhalten): ${targetAnalysis.strengths.slice(0, 5).join('; ')}` : '',
        targetAnalysis.weaknesses.length ? `- Schwächen (verbessern): ${targetAnalysis.weaknesses.slice(0, 6).join('; ')}` : '',
        `- Inhalte übernehmen: ${keepContentFrom(targetAnalysis).join('; ')}`
      ]
        .filter(Boolean)
        .join('\n')
    )
  }

  // 8. Technik
  blocks.push('8) ' + technicalInstructions(platform))

  // Abschluss
  blocks.push(
    `Ziel: eine moderne, responsive, hochwertige und eigenständige Website für ${target.companyName || 'Unternehmen B'} ` +
      `mit klarem Haupt-CTA „${mainCta}“. Erfinde keine Geschäftsdaten – nutze gekennzeichnete Platzhalter, wo Infos fehlen.`
  )

  return { prompt: blocks.join('\n\n'), styleDirection, pages, mainCta }
}

/** Optionale KI-Veredelung des Wortlauts (Struktur/Regeln bleiben erhalten). */
async function refineWithAi(prompt: string, platform: string): Promise<{ text: string; used: boolean }> {
  if (!isAiConfigured()) return { text: prompt, used: false }
  try {
    const out = await aiComplete(
      'Du bist Senior-Webdesign-Stratege bei LL Studio. Verbessere den folgenden deutschen Website-Brief sprachlich und in der Klarheit. ' +
        'Behalte ALLE Abschnitte, Platzhalter und besonders die rechtlichen Hinweise (kein Kopieren) bei. Gib nur den finalen Prompt-Text zurück.',
      `Zielplattform: ${platform}\n\n${prompt}`,
      1800
    )
    if (out && out.trim().length > 200) return { text: out.trim(), used: true }
  } catch (e) {
    log.warn('KI-Veredelung übersprungen:', e)
  }
  return { text: prompt, used: false }
}

export async function generatePrompt(input: PromptGenerationInput): Promise<PromptGenerationResult> {
  let targetAnalysis: TargetWebsiteAnalysis | null = null
  const url = input.target.url ? normalizeUrl(input.target.url) : null
  if (input.analyzeTargetUrl && url) {
    targetAnalysis = await analyzeTargetCompany(url)
  }

  const { prompt, styleDirection, pages, mainCta } = assemblePrompt(input, targetAnalysis)
  const refined = await refineWithAi(prompt, PLATFORM_LABELS[input.platform])

  const warnings = [
    'Nur als Inspiration verwenden – keine Inhalte, Bilder, Logos oder Designs 1:1 kopieren.',
    'Keine erfundenen Bewertungen, Zertifikate oder Geschäftsdaten verwenden.'
  ]
  if (!input.target.companyName?.trim()) warnings.push('Firmenname fehlt – als Platzhalter eingesetzt.')
  if (!input.target.services?.trim()) warnings.push('Leistungen fehlen – als Platzhalter eingesetzt.')
  if (!input.inspiration.fromAnalysis) warnings.push('Referenz wurde nicht analysiert – Stilangaben sind teils geschätzt.')

  return {
    prompt: refined.text,
    summary: {
      inspirationSource: inspName(input.inspiration) + (input.inspiration.url ? ` (${input.inspiration.url})` : ''),
      targetCompany: input.target.companyName || '[Platzhalter: Firmenname]',
      styleDirection,
      recommendedPages: pages,
      mainCta,
      warnings
    },
    targetAnalysis: targetAnalysis
      ? {
          reachable: targetAnalysis.reachable,
          strengths: targetAnalysis.strengths,
          weaknesses: targetAnalysis.weaknesses,
          keepContent: keepContentFrom(targetAnalysis)
        }
      : undefined,
    meta: { promptType: input.promptType, platform: input.platform, generatedAt: new Date().toISOString(), aiUsed: refined.used }
  }
}

export { PROMPT_TYPE_LABELS, PLATFORM_LABELS }

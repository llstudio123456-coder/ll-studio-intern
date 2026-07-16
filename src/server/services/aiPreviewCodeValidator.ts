import type { PreviewCodeFormat, PreviewValidation, PreviewValidationCheck, ReferenceBlueprint, PreviewPalette } from '@shared/types'
import { detectSecurityIssues } from './aiPreviewRenderer'

export interface ValidatorContext {
  palette: PreviewPalette
  referenceColors: string[]
  hasLogo: boolean
  companyName: string
  mainCta: string
  blueprint?: ReferenceBlueprint
  /** echte Kunde-A-Bild-URLs (für die Bild-Nutzungsprüfung) */
  customerImageUrls?: string[]
  /** Referenz-B-URL (um kopierte Referenz-Bilder zu erkennen) */
  referenceUrl?: string
}

/** Zieht die „nackte“ Domain aus einer URL (ohne Protokoll/www). */
function domainOf(url?: string): string {
  if (!url) return ''
  const m = url.match(/^(?:https?:\/\/)?(?:www\.)?([^/:?#]+)/i)
  return m ? m[1].toLowerCase() : ''
}
const basename = (url: string) => (url.split('?')[0].split('#')[0].split('/').pop() || url).toLowerCase()

/** Zieht den ersten Codeblock aus einer KI-Antwort; fällt auf den Rohtext zurück. */
export function extractCode(raw: string, format: PreviewCodeFormat): { code: string; language: 'html' | 'jsx' | 'tsx' | 'text' } {
  const text = (raw || '').trim()
  const fence = text.match(/```(?:html|jsx|tsx|javascript|typescript|react)?\s*\n([\s\S]*?)```/i)
  let code = fence ? fence[1].trim() : text
  // Falls kein Fence, aber HTML/Komponente offensichtlich enthalten ist: ab erstem sinnvollen Token schneiden
  if (!fence) {
    const idx = code.search(/<!doctype|<html|<section|<header|<div|import\s|export\s|'use client'|function\s/i)
    if (idx > 0) code = code.slice(idx).trim()
  }
  const language: 'html' | 'jsx' | 'tsx' | 'text' =
    format === 'html' ? 'html' : format === 'nextjs' ? 'tsx' : format === 'react-tailwind' ? 'jsx' : 'text'
  return { code, language }
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ')
const hex = (h: string) => (h || '').toLowerCase().replace(/^#/, '')

/** Prüft generierten/eingefügten Code gegen die harten Kriterien (Kunde-A-Marke + Referenz-B-Struktur + Sicherheit). */
export function validateGeneratedCode(rawCode: string, ctx: ValidatorContext): PreviewValidation {
  const code = rawCode || ''
  const low = norm(code)
  const p = ctx.palette
  const custHexes = [p.primary, p.secondary, p.cta, p.accent, p.ink, p.paper].map(hex).filter((h) => /^[0-9a-f]{6}$/.test(h))
  const refHexes = (ctx.referenceColors || []).map(hex).filter((h) => /^[0-9a-f]{6}$/.test(h))

  const usedColors = custHexes.filter((h) => low.includes(h)).map((h) => '#' + h)
  const usesCustomer = usedColors.length > 0
  const refOnly = refHexes.filter((h) => !custHexes.includes(h) && low.includes(h)).map((h) => '#' + h)
  const hasHeader = /<header|<nav[\s>]|role="navigation"/i.test(code)
  const hasFooter = /<footer|role="contentinfo"/i.test(code)
  const sectionCount = (code.match(/<section|<main|class="[^"]*section/gi) || []).length
  const hasHero = /hero|<h1[\s>]/i.test(code)
  const ctaWords = ['reservier', 'tisch', 'termin', 'buchen', 'book', 'kontakt', 'anfrag', 'bestell', ...norm(ctx.mainCta).split(' ')].filter((w) => w.length > 3)
  const hasCta = /<button|<a[^>]+(class|href)=/i.test(code) && ctaWords.some((w) => low.includes(w))
  const imageCountInCode = (code.match(/<img[\s>]/gi) || []).length
  const hasImages = imageCountInCode > 0 || /background-image|url\(|<picture|role="img"/i.test(code)
  const nameOk = ctx.companyName ? low.includes(norm(ctx.companyName)) : true
  const logoOk = /logo/i.test(code) || nameOk
  const genericMarkers = ['lorem ipsum', 'sign up free', 'get started for free', 'your company name', 'example.com', 'feature 1', 'feature 2', 'placeholder company', 'acme', 'lorem']
  const generic = genericMarkers.filter((m) => low.includes(m))
  const notGeneric = generic.length === 0
  const placeholderMarkers = ['insert image here', 'image here', 'bild hier', 'your image', 'todo', 'src=""', "src=''", 'placeholder.jpg', 'via.placeholder']
  const placeholders = placeholderMarkers.filter((m) => low.includes(m))
  // renderbar: vollständiges HTML-Dokument ODER gültige Komponente (export/return) ODER erkennbare Struktur-Tags
  const looksRenderable =
    /<!doctype|<html|<body/i.test(code) || (/export\s|function\s/i.test(code) && /return\s*\(/.test(code)) || /<section|<div|<main|<header/i.test(code)
  const structureOk = hasHeader && (hasHero || sectionCount >= 1) && hasFooter

  // Kunde-A-Bilder: welche echten URLs (oder deren Dateiname) tatsächlich im Code vorkommen
  const custUrls = ctx.customerImageUrls || []
  const usedCustomerImages = custUrls.filter((u) => code.includes(u) || low.includes(basename(u)))
  const missingCustomerImages = custUrls.filter((u) => !usedCustomerImages.includes(u))
  const customerImagesOk = custUrls.length === 0 ? hasImages : usedCustomerImages.length >= 1

  // Referenz-B-Bilder: kommen Bild-URLs von der Referenz-Domain im Code vor?
  const refDomain = domainOf(ctx.referenceUrl)
  const referenceImagesFound: string[] = []
  if (refDomain) {
    const dom = refDomain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp("(?:src\\s*=\\s*[\"']?|url\\([\"']?)([^\"')\\s]*" + dom + "[^\"')\\s]*)", 'gi')
    let m: RegExpExecArray | null
    while ((m = re.exec(code)) && referenceImagesFound.length < 10) referenceImagesFound.push(m[1])
  }

  // Sicherheit
  const securityIssues = detectSecurityIssues(code)

  const checks: PreviewValidationCheck[] = [
    { id: 'customerColors', label: 'Kunde-A-Farben verwendet', pass: usesCustomer, detail: usesCustomer ? `genutzt: ${usedColors.join(', ')}` : 'Kunde-A-Farben fehlen: keine Kunde-A-HEX-Farbe im Code gefunden.' },
    { id: 'noReferenceColors', label: 'Keine Referenz-B-Farben', pass: refOnly.length === 0, detail: refOnly.length ? `Referenzfarben gefunden: ${refOnly.join(', ')}` : undefined },
    { id: 'logo', label: 'Logo / Markenname im Header', pass: logoOk, detail: logoOk ? undefined : 'Kein Logo und kein Firmenname gefunden.' },
    { id: 'images', label: 'Bilder/Platzhalter genutzt', pass: hasImages, detail: hasImages ? `${imageCountInCode} <img> im Code` : 'Keine Bilder gefunden.' },
    { id: 'customerImages', label: 'Kunde-A-Bilder genutzt', pass: customerImagesOk, detail: customerImagesOk ? (custUrls.length ? `${usedCustomerImages.length}/${custUrls.length} Kunde-A-Bilder genutzt` : undefined) : `Zu wenige Kunde-A-Bilder genutzt (0/${custUrls.length}).` },
    { id: 'noReferenceImages', label: 'Keine Referenz-B-Bilder', pass: referenceImagesFound.length === 0, detail: referenceImagesFound.length ? `Falsche Referenz-Inhalte gefunden: ${referenceImagesFound.slice(0, 3).join(', ')}` : undefined },
    { id: 'structure', label: 'Struktur ähnlich Referenz-Blueprint', pass: structureOk, detail: structureOk ? undefined : 'Header/Hero/Footer nicht vollständig.' },
    { id: 'header', label: 'Navigation wie Referenz (Header/Nav)', pass: hasHeader, detail: hasHeader ? undefined : 'Navigation wirkt nicht wie Referenz: kein <header>/<nav>.' },
    { id: 'hero', label: 'Hero-Struktur wie Referenz', pass: hasHero, detail: hasHero ? undefined : 'Hero-Struktur passt nicht zur Referenz: keine Hero-/<h1>-Struktur.' },
    { id: 'cta', label: 'CTA ähnlich Referenz platziert', pass: hasCta, detail: hasCta ? undefined : 'Kein passender CTA-Button gefunden.' },
    { id: 'notGeneric', label: 'Kein generisches/SaaS-Template', pass: notGeneric, detail: notGeneric ? undefined : `Code wirkt generisch – Marker: ${generic.join(', ')}` },
    { id: 'noPlaceholders', label: 'Keine Platzhalter (insert image here / lorem)', pass: placeholders.length === 0, detail: placeholders.length ? `Platzhalter gefunden: ${placeholders.join(', ')}` : undefined },
    { id: 'security', label: 'Keine gefährlichen Scripts', pass: securityIssues.length === 0, detail: securityIssues.length ? securityIssues.join('; ') : undefined },
    { id: 'renderable', label: 'Code ist renderbar', pass: looksRenderable, detail: looksRenderable ? undefined : 'Kein renderbarer HTML-/Komponenten-Code erkannt.' }
  ]

  const passCount = checks.filter((c) => c.pass).length
  const score = Math.round((passCount / checks.length) * 100)
  const failures = checks.filter((c) => !c.pass).map((c) => c.label)
  // „passed“: mind. 80 UND kritische Prüfungen (Farben, renderbar, Struktur, Sicherheit, keine Referenz-Bilder)
  const critical = checks.filter((c) => ['customerColors', 'renderable', 'structure', 'security', 'noReferenceImages'].includes(c.id)).every((c) => c.pass)
  const passed = score >= 80 && critical
  const details = {
    usedColors,
    usedCustomerImages,
    missingCustomerImages,
    referenceColorsFound: refOnly,
    referenceImagesFound,
    securityIssues,
    imageCountInCode
  }
  return { score, passed, checks, failures, details }
}

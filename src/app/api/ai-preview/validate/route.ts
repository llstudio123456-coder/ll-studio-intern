import type { AIPreviewRequest, PreviewCodeFormat } from '@shared/types'
import { extractCode, validateGeneratedCode, type ValidatorContext } from '@/server/services/aiPreviewCodeValidator'
import { buildCorrectionPrompt, customerImageUrls } from '@/server/services/aiPreviewPromptBuilder'
import { toRenderableHtml, sanitizePreviewHtml } from '@/server/services/aiPreviewRenderer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Bewertet KI-/extern eingefügten Code gegen die harten Kriterien
 * (Kunde-A-Marke + Referenz-B-Struktur + Sicherheit) und liefert eine sichere Sandbox-Vorschau.
 * Kernstück des manuellen „KI-Code einfügen & prüfen“-Workflows.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as AIPreviewRequest & { rawCode: string; codeType?: PreviewCodeFormat | 'auto' }
    if (!body?.rawCode) return Response.json({ ok: false, error: 'rawCode fehlt.' }, { status: 400 })
    const r = body.result
    if (!r?.concept?.palette) return Response.json({ ok: false, error: 'Analyse-Daten (result) fehlen.' }, { status: 400 })

    // Code-Typ: 'auto' → aus dem Code erraten
    let format: PreviewCodeFormat = body.codeType && body.codeType !== 'auto' ? body.codeType : (body.format || 'html')
    if (body.codeType === 'auto' || !body.codeType) {
      if (/'use client'|from ['"]next/i.test(body.rawCode)) format = 'nextjs'
      else if (/import\s+React|export\s+default\s+function|className=|=>\s*\(/.test(body.rawCode) && !/<!doctype|<html/i.test(body.rawCode)) format = 'react-tailwind'
      else format = 'html'
    }

    const mainCta = r.concept.sections?.find((s) => s.type === 'contact')?.ctaLabel || (r.referenceBlueprint?.reservationCta ? 'Tisch reservieren' : 'Kontakt')
    const ctx: ValidatorContext = {
      palette: r.concept.palette,
      referenceColors: body.inspiration?.colors || [],
      hasLogo: !!body.source?.logoDataUrl,
      companyName: r.concept.companyName || body.source?.name || '',
      mainCta,
      blueprint: r.referenceBlueprint,
      customerImageUrls: customerImageUrls(r, body.source),
      referenceUrl: body.inspiration?.url
    }

    const extracted = extractCode(body.rawCode, format)
    const validation = validateGeneratedCode(extracted.code, ctx)
    const correctionPrompt = validation.passed ? null : buildCorrectionPrompt(validation, ctx.palette, ctx.blueprint, ctx.customerImageUrls)
    // Sichere Vorschau nur für HTML; React/Next → als Code anzeigen (kein direktes Rendern)
    const renderableHtml = format === 'html' ? toRenderableHtml(sanitizePreviewHtml(extracted.code), 'html') : undefined

    return Response.json({ ok: true, format, extracted, validation, correctionPrompt, renderableHtml })
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

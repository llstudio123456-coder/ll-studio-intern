import type { PreviewSection, ExtractedWebsiteImage, PreviewImagePlacement, StyleProfile, ImageFitScore } from '@shared/types'
import { treatmentFor } from './imageTreatmentService'
import { evaluateImageFit } from './imageQualityEvaluator'

export interface ImageMappingResult {
  placements: PreviewImagePlacement[]
  summary: { found: number; used: number; placeholders: number; recommendations: string[]; fit?: ImageFitScore }
}

/**
 * Ordnet echte Bilder von Kunde A zweckgerecht den Sektionen zu (mutiert sections).
 * Referenz B liefert nur Stil/Behandlung – Inhalte/Bilder kommen von A.
 */
export function mapImagesToSections(
  sections: PreviewSection[],
  images: ExtractedWebsiteImage[],
  profile: StyleProfile,
  useCustomerImages: boolean
): ImageMappingResult {
  const imageSlots = sections.filter((s) => s.type === 'hero' || s.type === 'gallery' || s.type === 'about').length

  if (!useCustomerImages || images.length === 0) {
    const { fit, recommendations } = evaluateImageFit([], images)
    return { placements: [], summary: { found: images.length, used: 0, placeholders: imageSlots, recommendations, fit: images.length ? fit : undefined } }
  }

  const placements: PreviewImagePlacement[] = []
  const usedUrls = new Set<string>()
  const byQuality = [...images].sort((a, b) => b.quality - a.quality)
  const take = (pred: (i: ExtractedWebsiteImage) => boolean) => byQuality.find((i) => !usedUrls.has(i.url) && pred(i))

  for (const s of sections) {
    if (s.type === 'hero') {
      const img = take((i) => i.role === 'hero') || take((i) => (i.width || 0) >= (i.height || 1)) || take(() => true)
      if (img) {
        s.imageUrl = img.url
        usedUrls.add(img.url)
        placements.push({ section: 'hero', url: img.url, role: 'hero', treatment: treatmentFor('hero', profile) })
      }
    } else if (s.type === 'about') {
      const img = take((i) => i.role === 'section') || take((i) => i.role === 'gallery') || take(() => true)
      if (img) {
        s.imageUrl = img.url
        usedUrls.add(img.url)
        placements.push({ section: 'about', url: img.url, role: 'section', treatment: treatmentFor('section', profile) })
      }
    } else if (s.type === 'gallery') {
      const urls: string[] = []
      for (let k = 0; k < 6; k++) {
        const img = take((i) => i.role === 'gallery' || i.role === 'card' || i.role === 'section')
        if (!img) break
        usedUrls.add(img.url)
        urls.push(img.url)
        placements.push({ section: 'gallery', url: img.url, role: 'gallery', treatment: treatmentFor('gallery', profile) })
      }
      if (urls.length) s.imageUrls = urls
    }
  }

  const { fit, recommendations } = evaluateImageFit(placements, images)
  const placeholders = Math.max(0, imageSlots - new Set(placements.map((p) => p.section)).size)
  if (placeholders > 0) recommendations.push(`${placeholders} Bereich(e) nutzen noch Platzhalter – weitere echte Fotos einfügen.`)

  return { placements, summary: { found: images.length, used: placements.length, placeholders, recommendations, fit } }
}

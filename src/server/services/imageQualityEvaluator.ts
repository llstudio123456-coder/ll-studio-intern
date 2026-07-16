import type { ExtractedWebsiteImage, PreviewImagePlacement, ImageFitScore } from '@shared/types'

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

/** Bewertet, wie gut die gewählten Bilder zum Konzept passen + Empfehlungen. */
export function evaluateImageFit(placements: PreviewImagePlacement[], all: ExtractedWebsiteImage[]): { fit: ImageFitScore; recommendations: string[] } {
  const notes: string[] = []
  const recommendations: string[] = []
  if (placements.length === 0) {
    recommendations.push('Noch keine echten Bilder genutzt – hochwertige Fotos von Kunde A einfügen.')
    return { fit: { score: 0, notes: ['keine Bilder zugeordnet'] }, recommendations }
  }

  const used = placements.map((p) => all.find((i) => i.url === p.url)).filter((x): x is ExtractedWebsiteImage => !!x)
  const avgQuality = used.reduce((a, b) => a + b.quality, 0) / Math.max(1, used.length)
  const hero = placements.find((p) => p.role === 'hero')
  const galleryCount = placements.filter((p) => p.role === 'gallery').length

  let score = 40 + avgQuality * 0.4
  if (hero) score += 14
  else recommendations.push('Hero-Bild austauschen für stärkere Wirkung (kein starkes Hero-Bild gefunden).')
  if (galleryCount >= 3) score += 10
  else recommendations.push('Mehr Food-/Ambiente-Fotos würden die Galerie stärken.')
  if (avgQuality < 65) recommendations.push('Bildmaterial ist teils niedrig aufgelöst – hochwertigere Fotos verbessern die Wirkung deutlich.')

  if (avgQuality >= 75) notes.push('gute Bildqualität')
  notes.push(`${placements.length} echte Bilder zugeordnet`)
  return { fit: { score: clamp(score), notes }, recommendations }
}

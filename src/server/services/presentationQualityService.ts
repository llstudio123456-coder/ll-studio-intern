import type { BrandProfile, PresentationQuality } from '@shared/types'

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

/**
 * Berechnet Brand-Match- und Client-Presentable-Score.
 * @param styleScore Style-Match (0..100)
 * @param brandStrength 0..100 (wie stark A-Branding wirkt)
 * @param brand Markenprofil
 * @param hasLogo Logo vorhanden
 * @param imageFit optionaler Bild-Fit-Score
 */
export function computePresentationQuality(
  styleScore: number,
  brandStrength: number,
  brand: BrandProfile,
  hasLogo: boolean,
  imageFit?: number
): PresentationQuality {
  const hasBrandColors = brand.source !== 'default'

  let brandMatch = 50 + (brandStrength / 100) * 40
  if (hasLogo) brandMatch += 6
  if (hasBrandColors) brandMatch += 6
  if (!hasBrandColors) brandMatch = Math.min(brandMatch, 60)
  brandMatch = clamp(brandMatch)

  const imgComponent = imageFit != null ? imageFit : 76
  const presentable = clamp(styleScore * 0.42 + brandMatch * 0.3 + imgComponent * 0.18 + (hasLogo ? 100 : 70) * 0.1)

  return {
    style: clamp(styleScore),
    brand: brandMatch,
    presentable,
    imageFit,
    ready: styleScore >= 80 && brandMatch >= 80 && presentable >= 85
  }
}

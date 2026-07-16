import type { ImageRole, StyleProfile } from '@shared/types'

/** Beschreibt, wie ein Bild an den Referenzstil angepasst wird. */
export function treatmentFor(role: ImageRole, profile: StyleProfile): string {
  const dark = profile.backgroundStyle === 'dark'
  const radius = profile.cornerRadius === 'scharf' ? 'scharfe Kanten' : profile.cornerRadius === 'rund' ? 'runde Ecken' : 'weiche Ecken'
  const crop = 'intelligenter Cover-Crop (Motiv erhalten)'
  if (role === 'hero') return dark ? `${crop}, dunkles Overlay (cinematic), ${radius}` : `${crop}, dezentes Overlay, ${radius}`
  if (role === 'background') return `${crop}, abgedunkelt, ${radius}`
  return `${crop}, ${radius}`
}

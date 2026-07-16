/** Wandelt einen serverseitigen Screenshot-Pfad in eine /api/shot-URL. */
export function shotUrl(absPath?: string): string | undefined {
  if (!absPath) return undefined
  const base = absPath.split(/[\\/]/).pop()
  if (!base) return undefined
  return `/api/shot?f=${encodeURIComponent(base)}`
}

export function scoreColor(score: number): string {
  if (score >= 80) return '#3f7d4e'
  if (score >= 65) return '#b08d57'
  if (score >= 50) return '#c08a2e'
  return '#a85b4a'
}

export function scoreLabel(score: number): string {
  if (score >= 80) return 'Top-Vorbild'
  if (score >= 65) return 'Stark'
  if (score >= 50) return 'Solide'
  return 'Schwach'
}

export function cls(...parts: (string | false | undefined | null)[]): string {
  return parts.filter(Boolean).join(' ')
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

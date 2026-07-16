/** Initialen für ein Text-Logo, falls kein Logo hochgeladen wurde. */
export function logoInitials(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'LL'
  return (parts[0][0] + (parts[1]?.[0] || parts[0][1] || '')).toUpperCase()
}

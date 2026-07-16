'use client'
import { useState } from 'react'

/** LL-Studio-Logo aus public/logo/. Fallback: SVG-Monogramm. */
export function Logo({ className = 'h-8' }: { className?: string }) {
  const [failed, setFailed] = useState(false)
  if (!failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src="/logo/LL-logo-trim.png"
        alt="LL Studio"
        className={`${className} object-contain`}
        onError={() => setFailed(true)}
        draggable={false}
      />
    )
  }
  return (
    <svg viewBox="0 0 112 92" className={className} role="img" aria-label="LL Studio">
      <text x="2" y="72" fontFamily="'Cormorant Garamond', Georgia, serif" fontWeight={500} fontSize={90} fill="currentColor">
        L
      </text>
      <text x="44" y="72" fontFamily="'Cormorant Garamond', Georgia, serif" fontWeight={500} fontStyle="italic" fontSize={90} fill="currentColor">
        L
      </text>
    </svg>
  )
}

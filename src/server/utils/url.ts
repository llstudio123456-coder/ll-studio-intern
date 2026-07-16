/** URL-Hilfsfunktionen. */

/** Normalisiert eine vom Nutzer eingegebene URL (fügt https:// hinzu etc.). */
export function normalizeUrl(input: string): string | null {
  if (!input) return null
  let s = input.trim()
  if (!s) return null
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s
  try {
    const u = new URL(s)
    if (!u.hostname.includes('.')) return null
    return u.toString()
  } catch {
    return null
  }
}

export function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function sameDomain(a: string, b: string): boolean {
  return getDomain(a).toLowerCase() === getDomain(b).toLowerCase()
}

/** Domains, die als Mitbewerber-Kandidaten ungeeignet sind (Verzeichnisse, Social, Plattformen). */
const BLOCKLIST = [
  'google.', 'bing.com', 'duckduckgo.com', 'startpage.com', 'ecosia.org',
  'facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'linkedin.com',
  'youtube.com', 'tiktok.com', 'pinterest.', 'xing.com', 'wikipedia.org',
  'yelp.', 'tripadvisor.', 'jameda.de', 'gelbeseiten.de', 'dasoertliche.de',
  '11880.com', 'meinestadt.de', 'wlw.de', 'cylex', 'golocal.de', 'kununu.com',
  'trustpilot.', 'proven-expert', 'amazon.', 'ebay.', 'etsy.com',
  'maps.google', 'goo.gl', 'apple.com', 'play.google', 'apps.apple',
  'youtu.be', 'wa.me', 't.me', 'pdf',
  // Musik/Streaming/Plattformen/Portale – nie echte Branchen-Website
  'spotify.com', 'soundcloud.com', 'deezer.com', 'music.apple', 'bandcamp.com',
  'vimeo.com', 'behance.net', 'dribbble.com', 'medium.com', 'wordpress.com',
  'blogspot.', 'notion.so', 'reddit.com', 'quora.com', 'github.com',
  'lieferando.', 'ubereats.', 'opentable.', 'booking.com', 'expedia.',
  'messe', 'expo.', 'eventbrite.', 'meetup.com', 'primevideo.',
  // Website-Builder / Design-Showcases / Tutorials (kein echtes Business)
  'awwwards.com', 'cssdesignawards.com', 'csswinner.com', 'webflow.com', 'framer.com',
  'squarespace.com', 'wix.com', 'wixsite.com', 'weebly.com', 'godaddy.com', 'jimdo.',
  'strikingly.com', 'carrd.co', 'tilda.cc', 'tutsplus.com', 'colorlib.com', 'hostinger.',
  'hubspot.com', 'canva.com', 'envato.com', 'themeforest.net', 'templatemonster.com',
  'muzli', 'siteinspire.com', 'land-book.com', 'onepagelove.com', 'designrush.com',
  'clutch.co', 'sortfolio.com', 'intechnic.com', 'myshopify.com'
]

export function isUsefulCandidate(url: string, targetUrl?: string): boolean {
  const d = getDomain(url).toLowerCase()
  if (!d.includes('.')) return false
  if (targetUrl && sameDomain(url, targetUrl)) return false
  return !BLOCKLIST.some((b) => d.includes(b))
}

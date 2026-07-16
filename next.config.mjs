/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production'

// Content-Security-Policy: nur tatsächlich benötigte Quellen. In Prod ohne 'unsafe-eval'.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: https:", // Google-Profilbilder (lh3.googleusercontent.com) u. Ä.
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self'",
  "frame-ancestors 'none'", // Clickjacking-Schutz
  "form-action 'self' https://accounts.google.com",
  "base-uri 'self'",
  "object-src 'none'"
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  // Internes Tool: nie durch Suchmaschinen indexieren (zusätzlich zur Auth, ersetzt sie nicht).
  { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
  // HSTS nur in Produktion (über HTTPS) aktivieren.
  ...(isProd ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }] : [])
]

const nextConfig = {
  // Playwright + native Module serverseitig – nicht ins Client-Bundle ziehen.
  serverExternalPackages: ['playwright', 'playwright-core', 'better-sqlite3', '@node-rs/argon2'],
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  }
}

export default nextConfig

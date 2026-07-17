import type { Metadata } from 'next'
import { Suspense } from 'react'
import './globals.css'
import { Nav } from '@/components/Nav'
import { MobileNav } from '@/components/MobileNav'
import { Toaster } from '@/components/Toaster'
import { SecurityBanner } from '@/components/SecurityBanner'

export const metadata: Metadata = {
  title: 'LL Studio Inspector',
  description: 'Konkurrenz- & Inspirationsanalyse für LL Studio',
  // Internes Tool: nie indexieren (zusätzlich zur Auth + X-Robots-Tag-Header).
  robots: { index: false, follow: false, nocache: true }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,500&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <SecurityBanner />
        {/* Mobile Navigation (< lg): feste Top-Bar, Bottom-Nav und Vollmenü-Drawer.
            Nutzt dieselbe Navigationskonfiguration wie die Desktop-Sidebar. */}
        <MobileNav />
        <div className="flex min-h-screen">
          {/* Nav liest ?view= via useSearchParams → Suspense-Grenze, damit statisches Prerendering (z. B. /_not-found) funktioniert.
              Fallback reserviert exakt die Sidebar-Breite, damit es keinen Layout-Sprung gibt. Ab lg sichtbar. */}
          <Suspense fallback={<div aria-hidden className="sticky top-0 hidden h-screen w-[256px] shrink-0 border-r border-[var(--color-line)] bg-[var(--color-surface)] lg:block" />}>
            <Nav />
          </Suspense>
          <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-7 lg:px-10 xl:px-12">{children}</main>
        </div>
        <Toaster />
      </body>
    </html>
  )
}

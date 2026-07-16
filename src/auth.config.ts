import type { NextAuthConfig } from 'next-auth'
import Google from 'next-auth/providers/google'
import { authConfigured, SESSION } from '@/server/auth/config'

/**
 * Edge-sichere Basis-Konfiguration (KEIN DB-/Node-Zugriff). Wird sowohl von der Middleware
 * (nur Token-Dekodierung) als auch von der vollständigen Node-Instanz (auth.ts) genutzt.
 *
 * Minimale Scopes: openid, email, profile — ausschließlich zur Identitätsprüfung.
 * Google verlangt kein Passwort in der App; der Flow läuft über die offizielle Google-Anmeldeseite.
 */
export const authConfig: NextAuthConfig = {
  trustHost: true,
  session: { strategy: 'jwt', maxAge: SESSION.maxAge },
  pages: { signIn: '/login', error: '/access-denied' },
  providers: authConfigured()
    ? [
        Google({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          authorization: { params: { scope: 'openid email profile', prompt: 'select_account' } }
        })
      ]
    : [],
  callbacks: {
    // Grobe, edge-sichere Prüfung (Feinprüfung von Status/Rolle/Version in guard.ts).
    authorized({ auth }) {
      return !!auth?.user
    },
    // Edge-sicher: bildet Token-Felder auf die Session ab (KEIN DB-Zugriff).
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.uid as string) || ''
        session.user.role = token.role as never
        session.user.status = token.status as never
        session.user.tv = (token.tv as number) ?? 0
        if (token.picture) session.user.image = token.picture as string
      }
      return session
    }
  }
}

import NextAuth from 'next-auth'
import { authConfig } from '@/auth.config'
import { isEmailAllowed } from '@/server/auth/config'
import { upsertGoogleUser, getUserByEmail, audit } from '@/server/auth/repo'
import { INACTIVE_STATUSES } from '@shared/auth'

/**
 * Vollständige (Node) Auth.js-Instanz mit serverseitiger, geschlossener Zugriffssteuerung.
 * signIn/jwt greifen nur während des OAuth-Callbacks (Node) auf die DB zu – niemals in der Edge-Middleware.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ profile }) {
      const email = typeof profile?.email === 'string' ? profile.email : undefined
      const verified = (profile as { email_verified?: boolean } | undefined)?.email_verified === true
      // Default-Deny: nur verifizierte, allowlisted E-Mail-Adressen.
      if (!isEmailAllowed(email, verified)) {
        audit('login_denied', { email, success: false, resource: 'signIn' })
        return false
      }
      const u = upsertGoogleUser({
        sub: String((profile as { sub?: string }).sub ?? ''),
        email: email!,
        emailVerified: verified,
        name: typeof profile?.name === 'string' ? profile.name : undefined,
        picture: typeof (profile as { picture?: string }).picture === 'string' ? (profile as { picture?: string }).picture : undefined
      })
      if (INACTIVE_STATUSES.includes(u.status)) {
        audit('login_blocked', { userId: u.id, email: u.email, success: false, meta: { status: u.status } })
        return false
      }
      audit('login_success', { userId: u.id, email: u.email })
      return true
    },
    async jwt({ token, user, profile }) {
      // Nur beim Login (Node) DB lesen; bei Edge-Re-Invocations sind user/profile leer.
      if (user || profile) {
        const email = (typeof profile?.email === 'string' ? profile.email : token.email) as string | undefined
        if (email) {
          const u = getUserByEmail(email)
          if (u) {
            token.uid = u.id
            token.role = u.role
            token.status = u.status
            token.tv = u.tokenVersion
            token.email = u.email
            token.name = u.name
            token.picture = u.picture
          }
        }
      }
      return token
    }
  }
})

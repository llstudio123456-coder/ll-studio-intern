import NextAuth from 'next-auth'
import { authConfig } from '@/auth.config'
import { isEmailAllowed, isOwnerEmail } from '@/server/auth/config'
import { upsertGoogleUser, getUserByEmail, audit } from '@/server/auth/repo'
import { decideAccess, ensureEntryForEnv, markSignedIn } from '@/server/auth/allowlistRepo'
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

      // 1) Google muss die Adresse selbst bestätigt haben. Ein unbestätigtes Konto könnte eine
      //    fremde Adresse behaupten und sich damit eine Freigabe erschleichen.
      if (!email || !verified) {
        audit('login_denied', { email, success: false, resource: 'signIn', meta: { reason: 'E-Mail nicht durch Google bestätigt' } })
        return false
      }

      // 2) Autoritative Entscheidung aus der Freigabeliste (Default-Deny). Die Umgebung dient
      //    nur noch als Notzugang für Inhaber und als Startpunkt, solange die Liste leer ist.
      const decision = decideAccess(email, isEmailAllowed(email, verified), isOwnerEmail(email))
      if (!decision.allowed) {
        audit('login_denied', { email, success: false, resource: 'signIn', meta: { reason: decision.reason } })
        return false
      }

      // 3) Erst jetzt entsteht ein interner Account. Wer nicht freigegeben ist, hinterlässt
      //    keinen Benutzer — die bloße Existenz eines Google-Kontos genügt nie.
      const u = upsertGoogleUser({
        sub: String((profile as { sub?: string }).sub ?? ''),
        email,
        emailVerified: verified,
        name: typeof profile?.name === 'string' ? profile.name : undefined,
        picture: typeof (profile as { picture?: string }).picture === 'string' ? (profile as { picture?: string }).picture : undefined,
        // Rolle beim ERSTEN Login aus der Freigabe. Bei Folge-Logins bleibt die in der
        // Verwaltung gesetzte Rolle unangetastet (Ausnahme: Inhaber, siehe repo.ts).
        initialRole: decision.role
      })

      if (INACTIVE_STATUSES.includes(u.status)) {
        audit('login_blocked', { userId: u.id, email: u.email, success: false, meta: { status: u.status } })
        return false
      }

      // Liste und Wirklichkeit zusammenhalten: Env-Zugänge in die Liste aufnehmen,
      // Eingeladene auf „aktiv" heben.
      if (decision.reason.includes('OWNER_EMAILS')) ensureEntryForEnv(email, 'owner')
      else if (decision.reason === 'ALLOWED_GOOGLE_EMAILS') ensureEntryForEnv(email, u.role)
      markSignedIn(email)

      audit('login_success', { userId: u.id, email: u.email, meta: { via: decision.reason } })
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

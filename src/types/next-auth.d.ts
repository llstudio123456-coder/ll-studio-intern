import type { Role, UserStatus } from '@shared/auth'
import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role?: Role
      status?: UserStatus
      tv?: number
      name?: string | null
      email?: string | null
      image?: string | null
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    uid?: string
    role?: Role
    status?: UserStatus
    tv?: number
    picture?: string
  }
}

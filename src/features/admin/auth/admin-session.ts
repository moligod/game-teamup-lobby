import type { User } from '@/lib/types'

const ADMIN_USER_KEY = 'adminUser'
const ADMIN_TOKEN_KEY = 'adminToken'

export interface AdminSession {
  user: User | null
  token: string | null
}

export function loadAdminSession(): AdminSession {
  try {
    const user = localStorage.getItem(ADMIN_USER_KEY)
    return {
      user: user ? (JSON.parse(user) as User) : null,
      token: localStorage.getItem(ADMIN_TOKEN_KEY),
    }
  } catch {
    return { user: null, token: null }
  }
}

export function storeAdminSession(user: User, token: string) {
  localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user))
  localStorage.setItem(ADMIN_TOKEN_KEY, token)
}

export function clearAdminSession() {
  localStorage.removeItem(ADMIN_USER_KEY)
  localStorage.removeItem(ADMIN_TOKEN_KEY)
}

import type { User } from './types'

export const USER_SESSION_INVALIDATED_EVENT = 'trovebbs:user-session-invalidated'

type SessionStorage = Pick<Storage, 'getItem' | 'removeItem'>

function removeSession(storage: Pick<Storage, 'removeItem'>) {
  storage.removeItem('user')
  storage.removeItem('token')
}

function readTokenExpiry(token: string | null): number | null {
  if (!token) return null
  try {
    const encodedPayload = token.split('.')[0]
    if (!encodedPayload) return null
    const base64 = encodedPayload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(encodedPayload.length / 4) * 4, '=')
    const payload = JSON.parse(window.atob(base64)) as { exp?: unknown }
    return typeof payload.exp === 'number' && Number.isFinite(payload.exp) ? payload.exp : null
  } catch {
    return null
  }
}

export function getSessionExpiry(token: string | null): number | null {
  return readTokenExpiry(token)
}

export function loadStoredUser() {
  try {
    const user = localStorage.getItem('user')
    const token = localStorage.getItem('token')
    const parsedUser = user ? (JSON.parse(user) as User) : null
    const expiresAt = readTokenExpiry(token)
    if (parsedUser?.role === 'admin' || (parsedUser && (!token || !expiresAt || expiresAt <= Date.now()))) {
      clearSession()
      return { user: null, token: null }
    }
    return {
      user: parsedUser,
      token,
    }
  } catch {
    return { user: null, token: null }
  }
}

export function storeSession(user: User, token?: string | null) {
  localStorage.setItem('user', JSON.stringify(user))
  if (token) {
    localStorage.setItem('token', token)
  } else {
    localStorage.removeItem('token')
  }
}

export function clearSession() {
  removeSession(localStorage)
}

export function invalidateSessionForToken(
  rejectedToken: string | null | undefined,
  storage: SessionStorage = localStorage,
  notify: () => void = () => window.dispatchEvent(new Event(USER_SESSION_INVALIDATED_EVENT)),
) {
  if (!rejectedToken || storage.getItem('token') !== rejectedToken) return false
  removeSession(storage)
  notify()
  return true
}

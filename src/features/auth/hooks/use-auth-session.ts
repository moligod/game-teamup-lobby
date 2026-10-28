import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { AuthState } from '../model/auth-types'
import {
  clearSession,
  getSessionExpiry,
  loadStoredUser,
  storeSession,
  USER_SESSION_INVALIDATED_EVENT,
} from '@/lib/storage'
import type { User } from '@/lib/types'
import { authenticateLocal, exchangeQqLoginTicket, getQqLoginUrl } from '../api/auth-api'

export function useAuthSession() {
  const navigate = useNavigate()
  const location = useLocation()
  const [auth, setAuth] = useState<AuthState>(() => loadStoredUser())

  useEffect(() => {
    const syncSession = () => setAuth(loadStoredUser())
    const syncSessionFromStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === 'user' || event.key === 'token') syncSession()
    }

    window.addEventListener(USER_SESSION_INVALIDATED_EVENT, syncSession)
    window.addEventListener('storage', syncSessionFromStorage)
    return () => {
      window.removeEventListener(USER_SESSION_INVALIDATED_EVENT, syncSession)
      window.removeEventListener('storage', syncSessionFromStorage)
    }
  }, [])

  useEffect(() => {
    const search = new URLSearchParams(location.search)
    const ticket = search.get('ticket')
    const authError = search.get('auth_error')
    if (!ticket && !authError) return

    if (ticket) {
      exchangeQqLoginTicket(ticket)
        .then((payload) => {
          const user = { ...payload.user, role: payload.user.role ?? 'user' } as User
          storeSession(user, payload.token)
          setAuth({ user, token: payload.token ?? null })
        })
        .catch(() => {
          clearSession()
          setAuth({ user: null, token: null })
        })
    }

    search.delete('qq_login')
    search.delete('ticket')
    search.delete('auth_error')
    navigate(`${location.pathname}${search.toString() ? `?${search.toString()}` : ''}${location.hash}`, { replace: true })
  }, [location.hash, location.pathname, location.search, navigate])

  useEffect(() => {
    const expiresAt = getSessionExpiry(auth.token)
    if (!auth.user || !expiresAt) return

    const timeout = window.setTimeout(() => {
      clearSession()
      setAuth({ user: null, token: null })
    }, Math.max(0, expiresAt - Date.now()))

    return () => window.clearTimeout(timeout)
  }, [auth.token, auth.user])

  const loginWithQQ = useCallback(async () => {
    const returnTo = `${window.location.origin}${location.pathname}${location.search}${location.hash}`
    const payload = await getQqLoginUrl(returnTo)
    window.location.href = payload.url
  }, [location.hash, location.pathname, location.search])

  const loginLocal = useCallback(async (mode: 'login' | 'register', username: string, password: string) => {
    const payload = await authenticateLocal(mode, username, password)
    storeSession(payload.user, payload.token)
    setAuth({ user: payload.user, token: payload.token ?? null })
  }, [])

  const logout = useCallback(() => {
    clearSession()
    setAuth({ user: null, token: null })
    navigate('/')
  }, [navigate])

  return { auth, loginWithQQ, loginLocal, logout }
}

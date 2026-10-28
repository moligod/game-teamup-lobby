import { get, post } from '@/lib/api'
import type { User } from '@/lib/types'

export interface AuthSessionPayload {
  user: User
  token?: string | null
}

export function getQqLoginUrl(returnTo?: string) {
  const query = returnTo ? `?return_to=${encodeURIComponent(returnTo)}` : ''
  return get<{ url: string }>(`/api/auth/qq/start${query}`)
}

export function exchangeQqLoginTicket(ticket: string) {
  return post<AuthSessionPayload>('/api/auth/qq/session', { ticket })
}
